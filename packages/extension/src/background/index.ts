/**
 * Background Service Worker
 * API 호출, 데이터 저장, 컨텍스트 메뉴 관리
 */

import { wordRepository, reviewStateRepository, eventBus, db, calculateNextReview, validateSnapshotDetailed } from '@catchvoca/core';
import type { WordEntryInput, LookupResult, Rating, Settings, Snapshot } from '@catchvoca/types';
import { DEFAULT_SETTINGS } from '@catchvoca/types';

// DB 초기화 (Extension 환경에서 명시적으로 open)
let dbInitialized = false;

async function ensureDbInitialized(): Promise<void> {
  if (!dbInitialized) {
    try {
      await db.open();
      dbInitialized = true;
      console.log('[CatchVoca] Database initialized successfully');
    } catch (error) {
      console.error('[CatchVoca] Database initialization failed:', error);
      throw error;
    }
  }
}

// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(async () => {
  // DB 초기화
  await ensureDbInitialized();

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

  // DB 초기화 확인
  await ensureDbInitialized();

  try {
    // 1. 사전 정보 준비 (이미 제공된 경우 사용, 없으면 API 조회)
    let definitions = wordData.definitions;
    let phonetic = wordData.phonetic;
    let audioUrl = wordData.audioUrl;

    // definitions가 없으면 API 조회
    if (!definitions || definitions.length === 0) {
      const lookupResult = await lookupWord(wordData.word);
      definitions = lookupResult.definitions;
      phonetic = lookupResult.phonetic;
      audioUrl = lookupResult.audioUrl;
    }

    // 2. WordEntry 생성 데이터 준비
    const wordEntryData = {
      word: wordData.word,
      context: wordData.context || wordData.word,
      url: wordData.url || '',
      sourceTitle: wordData.sourceTitle || '',
      definitions: definitions || [],
      phonetic: phonetic,
      audioUrl: audioUrl,
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
    throw error;
  }
}

/**
 * Settings 저장소 키
 */
const SETTINGS_STORAGE_KEY = 'catchvoca_settings';

/**
 * Settings 가져오기
 */
async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const storedSettings = result[SETTINGS_STORAGE_KEY];

    // 저장된 설정이 있으면 기본값과 병합
    if (storedSettings) {
      return {
        ...DEFAULT_SETTINGS,
        ...storedSettings,
      };
    }

    // 없으면 기본값 반환
    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('[CatchVoca] Failed to get settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Settings 저장
 */
async function updateSettings(settings: Partial<Settings>): Promise<void> {
  try {
    // 현재 설정 가져오기
    const currentSettings = await getSettings();

    // 업데이트된 설정 병합
    const updatedSettings: Settings = {
      ...currentSettings,
      ...settings,
    };

    // 저장
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: updatedSettings,
    });

    console.log('[CatchVoca] Settings updated:', updatedSettings);
  } catch (error) {
    console.error('[CatchVoca] Failed to update settings:', error);
    throw error;
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

  // 전체 응답 구조 로깅
  console.log('[CatchVoca] Naver API full response:', JSON.stringify(data, null, 2));

  // 응답 파싱
  const items = data?.searchResultMap?.searchResultListMap?.WORD?.items || [];

  if (items.length === 0) {
    console.warn('[CatchVoca] Naver API returned no items');
    return {
      definitions: [],
      phonetic: undefined,
      audioUrl: undefined,
    };
  }

  const firstItem = items[0];

  console.log('[CatchVoca] Naver API first item keys:', Object.keys(firstItem));
  console.log('[CatchVoca] Naver API first item:', JSON.stringify(firstItem, null, 2));

  // 정의 추출
  const definitions: string[] = [];
  const meansCollector = firstItem.meansCollector || [];
  for (const collector of meansCollector) {
    const means = collector.means || [];
    for (const mean of means) {
      if (mean.value) {
        // HTML 태그 제거 및 엔티티 디코딩
        let cleanValue = mean.value.replace(/<[^>]*>/g, '').trim();
        cleanValue = cleanValue
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ');
        if (cleanValue) {
          definitions.push(cleanValue);
        }
      }
    }
  }

  // 발음 기호 추출 - searchPhoneticSymbolList에서 가져오기
  let phonetic: string | undefined;
  let audioUrl: string | undefined;

  if (firstItem.searchPhoneticSymbolList && Array.isArray(firstItem.searchPhoneticSymbolList)) {
    // 미국식 발음 우선, 없으면 첫 번째 항목 사용
    const usPhonetic = firstItem.searchPhoneticSymbolList.find((p: any) => p.symbolTypeCode === 'US');
    const phoneticItem = usPhonetic || firstItem.searchPhoneticSymbolList[0];

    if (phoneticItem) {
      phonetic = phoneticItem.symbolValue;
      audioUrl = phoneticItem.symbolFile;
    }
  }

  // Fallback: 다른 필드에서 시도
  if (!phonetic) {
    phonetic = firstItem.phoneticSymbol
      || firstItem.phonetic
      || firstItem.pronSymbol
      || firstItem.pronunciation
      || (firstItem.phonetics && firstItem.phonetics[0]?.text);
  }

  // Fallback: 다른 오디오 필드에서 시도
  if (!audioUrl) {
    // phonetics 배열에서 찾기
    if (firstItem.phonetics && Array.isArray(firstItem.phonetics)) {
      for (const ph of firstItem.phonetics) {
        if (ph.audio || ph.audioUrl || ph.soundUrl) {
          audioUrl = ph.audio || ph.audioUrl || ph.soundUrl;
          break;
        }
      }
    }

    // 직접 필드에서 찾기
    if (!audioUrl) {
      audioUrl = firstItem.audioUrl
        || firstItem.soundUrl
        || firstItem.mp3Url
        || firstItem.pronUrl;
    }
  }

  console.log('[CatchVoca] Naver API result:', { phonetic, audioUrl, definitions: definitions.slice(0, 3) });

  return {
    definitions,
    phonetic,
    audioUrl,
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
        // HTML 태그 제거 및 엔티티 디코딩
        let cleanDef = def.definition.replace(/<[^>]*>/g, '').trim();
        cleanDef = cleanDef
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ');
        if (cleanDef) {
          definitions.push(cleanDef);
        }
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

  console.log('[CatchVoca] Dictionary API result:', { phonetic, audioUrl, definitions: definitions.slice(0, 3) });

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
      // DB 초기화 확인
      await ensureDbInitialized();

      switch (message.type) {
        case 'LOOKUP_WORD':
          const lookupResult = await lookupWord(message.word);

          // 기존 단어의 viewCount 및 저장 여부 조회
          let viewCount = 0;
          let isSaved = false;
          let wordId: string | undefined;
          try {
            const existingWords = await wordRepository.findByNormalizedWord(message.word);
            if (existingWords.length > 0 && existingWords[0]) {
              viewCount = existingWords[0].viewCount || 0;
              isSaved = true;
              wordId = existingWords[0].id;
            }
          } catch (err) {
            console.warn('[CatchVoca] Failed to get word info:', err);
          }

          sendResponse({
            success: true,
            data: {
              ...lookupResult,
              viewCount,
              isSaved,
              wordId
            }
          });
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

        case 'INCREMENT_VIEW_COUNT':
          // 단어 조회 시 viewCount 증가
          try {
            const existingWords = await wordRepository.findByNormalizedWord(message.word);
            if (existingWords.length > 0 && existingWords[0]) {
              await wordRepository.incrementViewCount(existingWords[0].id);
            }
            sendResponse({ success: true });
          } catch (err) {
            console.error('[CatchVoca] Increment view count error:', err);
            sendResponse({ success: false });
          }
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
          // SM-2 알고리즘을 사용하여 다음 복습 일정 계산
          const reviewState = await reviewStateRepository.findByWordId(message.wordId);
          if (reviewState) {
            const rating: Rating = message.rating;

            // SM-2 알고리즘으로 다음 복습 일정 계산
            const sm2Result = calculateNextReview(
              {
                interval: reviewState.interval,
                easeFactor: reviewState.easeFactor,
                repetitions: reviewState.repetitions,
              },
              rating
            );

            // 복습 기록 저장
            await reviewStateRepository.recordReview(
              message.wordId,
              rating,
              sm2Result.nextReviewAt,
              sm2Result.interval,
              sm2Result.easeFactor,
              sm2Result.repetitions
            );

            console.log('[CatchVoca] SM-2 review recorded:', {
              wordId: message.wordId,
              rating,
              nextReviewAt: new Date(sm2Result.nextReviewAt).toLocaleString('ko-KR'),
              interval: sm2Result.interval,
              easeFactor: sm2Result.easeFactor.toFixed(2),
              repetitions: sm2Result.repetitions,
            });
          }
          sendResponse({ success: true });
          break;

        case 'GET_SETTINGS':
          const settings = await getSettings();
          sendResponse({
            success: true,
            data: settings,
          });
          break;

        case 'UPDATE_SETTINGS':
          await updateSettings(message.settings);
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
          try {
            await ensureDbInitialized();

            // JSON 파싱 검증
            let snapshot: Snapshot;
            try {
              if (typeof message.data === 'string') {
                snapshot = JSON.parse(message.data);
              } else {
                snapshot = message.data;
              }
            } catch (parseError) {
              console.error('[CatchVoca] JSON parse error:', parseError);
              sendResponse({
                success: false,
                error: 'Invalid JSON format',
              });
              break;
            }

            // Snapshot 구조 검증
            const validationErrors = validateSnapshotDetailed(snapshot);
            if (validationErrors.length > 0) {
              console.error('[CatchVoca] Validation errors:', validationErrors);
              sendResponse({
                success: false,
                error: 'Invalid data format',
                details: validationErrors,
              });
              break;
            }

            // 데이터 가져오기 전략: 기존 데이터는 유지하고 새 데이터 추가 (중복 ID는 업데이트)
            let importedWords = 0;
            let importedReviews = 0;
            let skippedWords = 0;
            let skippedReviews = 0;

            // WordEntry 가져오기
            for (const wordEntry of snapshot.wordEntries) {
              try {
                // 기존 데이터 확인
                const existing = await wordRepository.findById(wordEntry.id);

                if (existing) {
                  // 기존 데이터가 있으면 업데이트 (최신 데이터 우선)
                  if (wordEntry.updatedAt > existing.updatedAt) {
                    // 전체 데이터 교체 (updatedAt은 가져오기 시점으로 업데이트)
                    await db.wordEntries.put({
                      ...wordEntry,
                      updatedAt: Date.now(),
                    });
                    importedWords++;
                  } else {
                    skippedWords++;
                  }
                } else {
                  // 새 데이터 추가
                  await db.wordEntries.add(wordEntry);
                  importedWords++;
                }
              } catch (error) {
                console.error('[CatchVoca] Failed to import word:', wordEntry.id, error);
                skippedWords++;
              }
            }

            // ReviewState 가져오기
            for (const reviewState of snapshot.reviewStates) {
              try {
                // 기존 데이터 확인
                const existing = await reviewStateRepository.findById(reviewState.id);

                if (existing) {
                  // 기존 데이터가 있으면 업데이트 (최신 히스토리 우선)
                  if (reviewState.history.length > existing.history.length) {
                    await db.reviewStates.put(reviewState);
                    importedReviews++;
                  } else {
                    skippedReviews++;
                  }
                } else {
                  // 새 데이터 추가
                  await db.reviewStates.add(reviewState);
                  importedReviews++;
                }
              } catch (error) {
                console.error('[CatchVoca] Failed to import review state:', reviewState.id, error);
                skippedReviews++;
              }
            }

            // 성공 응답
            sendResponse({
              success: true,
              data: {
                importedWords,
                importedReviews,
                skippedWords,
                skippedReviews,
                totalWords: snapshot.wordEntries.length,
                totalReviews: snapshot.reviewStates.length,
              },
            });

            // 이벤트 발행
            eventBus.emit('sync:completed', { importedWords, importedReviews });
          } catch (error) {
            console.error('[CatchVoca] Import data error:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            });
          }
          break;

        case 'CLEAR_ALL_DATA':
          const allWordsToDelete = await wordRepository.findAll();
          await Promise.all(allWordsToDelete.map((w) => wordRepository.delete(w.id)));
          const allReviewsToDelete = await reviewStateRepository.findAll();
          await Promise.all(allReviewsToDelete.map((r) => reviewStateRepository.delete(r.id)));
          sendResponse({ success: true });
          break;

        case 'OPEN_LIBRARY':
          // Popup 열기 (라이브러리 탭으로 이동)
          try {
            await chrome.action.openPopup();
            // Popup이 열린 후 라이브러리 탭으로 전환하는 메시지 전송
            // (Popup에서 수신하여 처리)
            chrome.runtime.sendMessage({
              type: 'SWITCH_TO_LIBRARY',
              wordId: message.wordId
            }).catch(() => {
              // Popup이 아직 로드되지 않은 경우 무시
            });
            sendResponse({ success: true });
          } catch (err) {
            console.error('[CatchVoca] Failed to open popup:', err);
            sendResponse({ success: false, error: 'Failed to open popup' });
          }
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
