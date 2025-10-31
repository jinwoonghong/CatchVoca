/**
 * Background Service Worker
 * API 호출, 데이터 저장, 컨텍스트 메뉴 관리
 */

import { wordRepository, reviewStateRepository, eventBus } from '@catchvoca/core';
import type { WordEntryInput, LookupResult, Rating } from '@catchvoca/types';

// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'catchvoca-save-word',
    title: 'CatchVoca에 저장',
    contexts: ['selection'],
  });

  console.log('[CatchVoca] Background service worker installed');
});

// 컨텍스트 메뉴 클릭 이벤트
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'catchvoca-save-word' && info.selectionText && tab?.id) {
    const selectedText = info.selectionText.trim();

    if (selectedText.length < 1 || selectedText.length > 50) {
      console.warn('[CatchVoca] Invalid word length:', selectedText.length);
      return;
    }

    try {
      // Content Script에서 전체 컨텍스트 가져오기
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTION',
      });

      if (response.success) {
        await saveWord(response.data);
      }
    } catch (error) {
      console.error('[CatchVoca] Failed to get selection context:', error);

      // 최소한의 정보로 저장
      await saveWord({
        word: selectedText,
        context: selectedText,
        url: tab.url || '',
        sourceTitle: tab.title || '',
      });
    }
  }
});

/**
 * 단어 저장 (API 조회 + DB 저장)
 */
async function saveWord(wordData: Partial<WordEntryInput>): Promise<void> {
  if (!wordData.word) {
    throw new Error('Word is required');
  }

  try {
    // 1. 사전 API 조회
    const lookupResult = await lookupWord(wordData.word);

    // 2. WordEntry 생성 데이터 준비
    const wordEntryData = {
      word: wordData.word,
      context: wordData.context || wordData.word,
      url: wordData.url || '',
      sourceTitle: wordData.sourceTitle || '',
      definitions: lookupResult.definitions,
      phonetic: lookupResult.phonetic,
      audioUrl: lookupResult.audioUrl,
      language: 'en' as const,
      contextSnapshot: null,
      selectionRange: null,
      tags: [],
      isFavorite: false,
    };

    // 3. Repository를 통해 저장
    const wordId = await wordRepository.create(wordEntryData);

    // 4. EventBus를 통해 알림
    eventBus.emit('word:created', { id: wordId });

    console.log('[CatchVoca] Word saved:', wordId);

    // 5. 사용자 알림
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'CatchVoca',
      message: `"${wordData.word}" 저장 완료!`,
    });
  } catch (error) {
    console.error('[CatchVoca] Failed to save word:', error);

    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'CatchVoca',
      message: `저장 실패: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

/**
 * 사전 API 조회 (네이버 Primary → Dictionary API Fallback)
 */
async function lookupWord(word: string): Promise<LookupResult> {
  // 1. 네이버 사전 API 시도
  try {
    const naverResult = await fetchNaverDictionary(word);
    if (naverResult.definitions && naverResult.definitions.length > 0) {
      console.log('[CatchVoca] Naver Dictionary API success');
      return naverResult;
    }
  } catch (error) {
    console.warn('[CatchVoca] Naver Dictionary API failed:', error);
  }

  // 2. Free Dictionary API Fallback
  try {
    const dictResult = await fetchDictionaryAPI(word);
    console.log('[CatchVoca] Dictionary API fallback success');
    return dictResult;
  } catch (error) {
    console.warn('[CatchVoca] Dictionary API failed:', error);
  }

  // 3. 모든 API 실패 시 빈 결과 반환
  console.warn('[CatchVoca] All dictionary APIs failed');
  return {
    definitions: [],
    phonetic: undefined,
    audioUrl: undefined,
  };
}

/**
 * 네이버 사전 API 호출
 */
async function fetchNaverDictionary(word: string): Promise<LookupResult> {
  const url = `https://en.dict.naver.com/api3/enko/search?query=${encodeURIComponent(word)}&m=pc&range=word`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Naver API returned ${response.status}`);
  }

  const data = await response.json();

  // 응답 파싱
  const items = data?.searchResultMap?.searchResultListMap?.WORD?.items || [];

  if (items.length === 0) {
    return {
      definitions: [],
      phonetic: undefined,
      audioUrl: undefined,
    };
  }

  const firstItem = items[0];

  // 정의 추출
  const definitions: string[] = [];
  const meansCollector = firstItem.meansCollector || [];
  for (const collector of meansCollector) {
    const means = collector.means || [];
    for (const mean of means) {
      if (mean.value) {
        // HTML 태그 제거
        const cleanValue = mean.value.replace(/<[^>]*>/g, '').trim();
        if (cleanValue) {
          definitions.push(cleanValue);
        }
      }
    }
  }

  // 발음 기호 추출
  const phonetic = firstItem.phoneticSymbol || firstItem.pronSymbol;

  return {
    definitions,
    phonetic,
    audioUrl: undefined, // 네이버는 오디오 URL 제공하지 않음
  };
}

/**
 * Free Dictionary API 호출
 */
async function fetchDictionaryAPI(word: string): Promise<LookupResult> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Dictionary API returned ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data) || data.length === 0) {
    return {
      definitions: [],
      phonetic: undefined,
      audioUrl: undefined,
    };
  }

  const entry = data[0];

  // 정의 추출
  const definitions: string[] = [];
  const meanings = entry.meanings || [];
  for (const meaning of meanings) {
    const defs = meaning.definitions || [];
    for (const def of defs) {
      if (def.definition) {
        definitions.push(def.definition);
      }
    }
  }

  // 발음 기호 추출
  let phonetic = entry.phonetic;
  if (!phonetic && entry.phonetics && entry.phonetics.length > 0) {
    phonetic = entry.phonetics[0].text;
  }

  // 오디오 URL 추출
  let audioUrl: string | undefined;
  if (entry.phonetics) {
    for (const ph of entry.phonetics) {
      if (ph.audio) {
        audioUrl = ph.audio;
        break;
      }
    }
  }

  return {
    definitions,
    phonetic,
    audioUrl,
  };
}

// Message handlers for UI components
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.type) {
        case 'LOOKUP_WORD':
          const lookupResult = await lookupWord(message.word);
          sendResponse({ success: true, data: lookupResult });
          break;

        case 'SAVE_WORD':
          await saveWord(message.wordData);
          sendResponse({ success: true });
          break;

        case 'GET_ALL_WORDS':
          const words = await wordRepository.findAll();
          sendResponse({ success: true, data: words });
          break;

        case 'DELETE_WORD':
          await wordRepository.delete(message.wordId);
          sendResponse({ success: true });
          break;

        case 'UPDATE_WORD':
          await wordRepository.update(message.wordId, message.changes);
          sendResponse({ success: true });
          break;

        case 'GET_REVIEW_STATS':
          const stats = await reviewStateRepository.getReviewStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'GET_DUE_REVIEWS':
          const dueReviews = await reviewStateRepository.findDueReviews(message.limit || 20);
          // Get full word entries for due reviews
          const dueWords = await Promise.all(
            dueReviews.map((review) => wordRepository.findById(review.wordId))
          );
          sendResponse({ success: true, data: dueWords.filter((w) => w !== null) });
          break;

        case 'SUBMIT_REVIEW':
          // TODO: Implement SM-2 algorithm for calculating next review
          // For now, just mark as reviewed
          const reviewState = await reviewStateRepository.findByWordId(message.wordId);
          if (reviewState) {
            const rating: Rating = message.rating;
            // Simple placeholder: next review in 1 day
            const nextReviewAt = Date.now() + 86400000;
            await reviewStateRepository.recordReview(
              message.wordId,
              rating,
              nextReviewAt,
              1,
              2.5,
              0
            );
          }
          sendResponse({ success: true });
          break;

        case 'GET_SETTINGS':
          // TODO: Implement settings storage
          sendResponse({
            success: true,
            data: {
              dailyReviewGoal: 20,
              autoSync: false,
              notifications: true,
              theme: 'auto',
            },
          });
          break;

        case 'UPDATE_SETTINGS':
          // TODO: Implement settings storage
          sendResponse({ success: true });
          break;

        case 'GET_STORAGE_INFO':
          const allWords = await wordRepository.findAll();
          sendResponse({
            success: true,
            data: {
              wordCount: allWords.length,
              storageUsed: '< 1 MB',
            },
          });
          break;

        case 'EXPORT_DATA':
          const exportWords = await wordRepository.findAll();
          const exportReviews = await reviewStateRepository.findAll();
          sendResponse({
            success: true,
            data: {
              words: exportWords,
              reviews: exportReviews,
              exportedAt: Date.now(),
            },
          });
          break;

        case 'IMPORT_DATA':
          // TODO: Implement data import with validation
          sendResponse({ success: true });
          break;

        case 'CLEAR_ALL_DATA':
          const allWordsToDelete = await wordRepository.findAll();
          await Promise.all(allWordsToDelete.map((w) => wordRepository.delete(w.id)));
          const allReviewsToDelete = await reviewStateRepository.findAll();
          await Promise.all(allReviewsToDelete.map((r) => reviewStateRepository.delete(r.id)));
          sendResponse({ success: true });
          break;

        case 'UPLOAD_SNAPSHOT':
          // Apps Script 웹앱 URL (배포 후 설정 필요)
          const appsScriptUrl = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';

          // 스냅샷 데이터 준비
          const snapshotWords = await wordRepository.findAll();
          const allReviewStates = await reviewStateRepository.findAll();

          // reviewStates를 wordId로 인덱싱
          const reviewStatesMap: Record<string, unknown> = {};
          allReviewStates.forEach((state) => {
            reviewStatesMap[state.wordId] = state;
          });

          const snapshotData = {
            words: snapshotWords,
            reviewStates: reviewStatesMap,
          };

          try {
            // Apps Script로 POST 요청
            const uploadResponse = await fetch(appsScriptUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(snapshotData),
            });

            const result = await uploadResponse.json();

            if (result.success) {
              sendResponse({ success: true, data: result.data });
            } else {
              sendResponse({ success: false, error: result.error || 'Upload failed' });
            }
          } catch (uploadError) {
            console.error('[Background] Snapshot upload error:', uploadError);
            sendResponse({
              success: false,
              error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
            });
          }
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('[Background] Message handler error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })();
  return true; // Keep message channel open for async response
});

console.log('[CatchVoca] Background service worker loaded');
