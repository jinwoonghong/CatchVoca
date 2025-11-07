/**
 * Message Handlers
 * Chrome runtime message 핸들러
 */

import {
  wordRepository,
  reviewStateRepository,
  AIAnalysisHistoryRepository,
  eventBus,
  db,
  calculateNextReview,
  validateSnapshotDetailed,
  Logger,
} from '@catchvoca/core';
import type { Rating, Snapshot, GeminiAnalysisRequest } from '@catchvoca/types';
import { lookupWord } from './dictionaryAPI';
import { saveWord, getWordInfo, incrementWordViewCount } from './wordService';
import { getSettings, updateSettings } from './storage';
import { analyzePageWithGemini } from './geminiAPI';
import { calculateBatchImportance, getRecommendedWords } from './wordImportance';
import { canUseAI, incrementAIUsage, getAIUsageStats } from './aiUsageManager';
import { uploadQuizToFirebase } from './firebaseQuizService';
import { exportAllData, importAllData } from './backupService';

const logger = new Logger('MessageHandler');

type MessageResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
  details?: unknown;
};

/**
 * 메시지 핸들러 라우터
 */
export async function handleMessage(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    switch (message.type) {
      case 'LOOKUP_WORD':
        await handleLookupWord(message, sendResponse);
        break;

      case 'SAVE_WORD':
        await handleSaveWord(message, sendResponse);
        break;

      case 'GET_ALL_WORDS':
        await handleGetAllWords(sendResponse);
        break;

      case 'DELETE_WORD':
        await handleDeleteWord(message, sendResponse);
        break;

      case 'UPDATE_WORD':
        await handleUpdateWord(message, sendResponse);
        break;

      case 'INCREMENT_VIEW_COUNT':
        await handleIncrementViewCount(message, sendResponse);
        break;

      case 'GET_REVIEW_STATS':
        await handleGetReviewStats(sendResponse);
        break;

      case 'GET_REVIEW_STATE':
        await handleGetReviewState(message, sendResponse);
        break;

      case 'GET_DUE_REVIEWS':
        await handleGetDueReviews(message, sendResponse);
        break;

      case 'START_REVIEW_SESSION':
        await handleStartReviewSession(message, sendResponse);
        break;

      case 'SUBMIT_REVIEW':
        await handleSubmitReview(message, sendResponse);
        break;

      case 'GET_SETTINGS':
        await handleGetSettings(sendResponse);
        break;

      case 'UPDATE_SETTINGS':
        await handleUpdateSettings(message, sendResponse);
        break;

      case 'GET_STORAGE_INFO':
        await handleGetStorageInfo(sendResponse);
        break;

      case 'EXPORT_DATA':
        await handleExportData(sendResponse);
        break;

      case 'IMPORT_DATA':
        await handleImportData(message, sendResponse);
        break;

      case 'CLEAR_ALL_DATA':
        await handleClearAllData(sendResponse);
        break;

      case 'OPEN_LIBRARY':
        await handleOpenLibrary(message, sendResponse);
        break;

      case 'UPLOAD_SNAPSHOT':
        await handleUploadSnapshot(sendResponse);
        break;

      // AI 관련 핸들러 (Phase 2-B)
      case 'ANALYZE_PAGE_AI':
        await handleAnalyzePageAI(message, sendResponse);
        break;

      case 'GET_AI_USAGE_STATS':
        await handleGetAIUsageStats(sendResponse);
        break;

      case 'GET_ANALYSIS_HISTORY':
        await handleGetAnalysisHistory(sendResponse);
        break;

      case 'GET_RECOMMENDED_WORDS':
        await handleGetRecommendedWords(message, sendResponse);
        break;

      case 'CALCULATE_WORD_IMPORTANCE':
        await handleCalculateWordImportance(message, sendResponse);
        break;

      // PDF & Keyboard 관련 핸들러 (Phase 2-C)
      case 'PDF_TEXT_SELECTED':
        await handlePDFTextSelected(message, sendResponse);
        break;

      case 'QUICK_LOOKUP':
        await handleQuickLookup(message, sendResponse);
        break;

      case 'QUICK_SAVE':
        await handleQuickSave(message, sendResponse);
        break;

      // 모바일 퀴즈 관련 핸들러 (Week 5-6)
      case 'GENERATE_MOBILE_QUIZ_LINK':
        await handleGenerateMobileQuizLink(message, sendResponse);
        break;

      // 백업/복원 관련 핸들러 (Phase 2-D)
      case 'EXPORT_ALL_DATA':
        await handleExportAllData(sendResponse);
        break;

      case 'IMPORT_ALL_DATA':
        await handleImportAllData(message, sendResponse);
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    logger.error('Message handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Individual handlers

async function handleLookupWord(message: any, sendResponse: (response: MessageResponse) => void) {
  const lookupResult = await lookupWord(message.word);
  const wordInfo = await getWordInfo(message.word);

  sendResponse({
    success: true,
    data: {
      ...lookupResult,
      ...wordInfo,
    },
  });
}

async function handleSaveWord(message: any, sendResponse: (response: MessageResponse) => void) {
  await saveWord(message.wordData);
  sendResponse({ success: true });
}

async function handleGetAllWords(sendResponse: (response: MessageResponse) => void) {
  const words = await wordRepository.findAll();
  sendResponse({ success: true, data: words });
}

async function handleDeleteWord(message: any, sendResponse: (response: MessageResponse) => void) {
  await wordRepository.delete(message.wordId);
  sendResponse({ success: true });
}

async function handleUpdateWord(message: any, sendResponse: (response: MessageResponse) => void) {
  await wordRepository.update(message.wordId, message.changes);
  sendResponse({ success: true });
}

async function handleIncrementViewCount(message: any, sendResponse: (response: MessageResponse) => void) {
  const success = await incrementWordViewCount(message.word);
  sendResponse({ success });
}

async function handleGetReviewStats(sendResponse: (response: MessageResponse) => void) {
  const stats = await reviewStateRepository.getReviewStats();
  sendResponse({ success: true, data: stats });
}

async function handleGetReviewState(message: any, sendResponse: (response: MessageResponse) => void) {
  try {
    const reviewState = await reviewStateRepository.findByWordId(message.wordId);
    sendResponse({ success: true, data: reviewState });
  } catch (error) {
    sendResponse({ success: false, error: 'Failed to get review state' });
  }
}

async function handleGetDueReviews(message: any, sendResponse: (response: MessageResponse) => void) {
  const dueReviews = await reviewStateRepository.findDueReviews(message.limit || 20);
  const dueWords = await Promise.all(
    dueReviews.map((review) => wordRepository.findById(review.wordId))
  );
  sendResponse({ success: true, data: dueWords.filter((w) => w !== null) });
}

async function handleStartReviewSession(message: any, sendResponse: (response: MessageResponse) => void) {
  const sessionLimit = message.limit || 20;
  const sessionDueReviews = await reviewStateRepository.findDueReviews(sessionLimit);
  const sessionWords = await Promise.all(
    sessionDueReviews.map((review) => wordRepository.findById(review.wordId))
  );
  const validSessionWords = sessionWords.filter((w) => w !== null);

  logger.info('Review session started', {
    totalDue: sessionDueReviews.length,
    sessionSize: validSessionWords.length,
    limit: sessionLimit,
  });

  sendResponse({ success: true, data: validSessionWords });
}

async function handleSubmitReview(message: any, sendResponse: (response: MessageResponse) => void) {
  const reviewState = await reviewStateRepository.findByWordId(message.wordId);
  if (reviewState) {
    const rating: Rating = message.rating;

    const sm2Result = calculateNextReview(
      {
        interval: reviewState.interval,
        easeFactor: reviewState.easeFactor,
        repetitions: reviewState.repetitions,
      },
      rating
    );

    await reviewStateRepository.recordReview(
      message.wordId,
      rating,
      sm2Result.nextReviewAt,
      sm2Result.interval,
      sm2Result.easeFactor,
      sm2Result.repetitions
    );

    logger.info('SM-2 review recorded', {
      wordId: message.wordId,
      rating,
      interval: sm2Result.interval,
    });
  }
  sendResponse({ success: true });
}

async function handleGetSettings(sendResponse: (response: MessageResponse) => void) {
  const settings = await getSettings();
  sendResponse({ success: true, data: settings });
}

async function handleUpdateSettings(message: any, sendResponse: (response: MessageResponse) => void) {
  await updateSettings(message.settings);
  sendResponse({ success: true });
}

async function handleGetStorageInfo(sendResponse: (response: MessageResponse) => void) {
  const allWords = await wordRepository.findAll();
  sendResponse({
    success: true,
    data: {
      wordCount: allWords.length,
      storageUsed: '< 1 MB',
    },
  });
}

async function handleExportData(sendResponse: (response: MessageResponse) => void) {
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
}

async function handleImportData(message: any, sendResponse: (response: MessageResponse) => void) {
  // JSON 파싱 검증
  let snapshot: Snapshot;
  try {
    if (typeof message.data === 'string') {
      snapshot = JSON.parse(message.data);
    } else {
      snapshot = message.data;
    }
  } catch (parseError) {
    logger.error('JSON parse error', parseError);
    sendResponse({
      success: false,
      error: 'Invalid JSON format',
    });
    return;
  }

  // Snapshot 구조 검증
  const validationErrors = validateSnapshotDetailed(snapshot);
  if (validationErrors.length > 0) {
    logger.error('Validation errors', validationErrors);
    sendResponse({
      success: false,
      error: 'Invalid data format',
      details: validationErrors,
    });
    return;
  }

  // 데이터 가져오기
  let importedWords = 0;
  let importedReviews = 0;
  let skippedWords = 0;
  let skippedReviews = 0;

  // WordEntry 가져오기
  for (const wordEntry of snapshot.wordEntries) {
    try {
      const existing = await wordRepository.findById(wordEntry.id);

      if (existing) {
        if (wordEntry.updatedAt > existing.updatedAt) {
          await db.wordEntries.put({
            ...wordEntry,
            updatedAt: Date.now(),
          });
          importedWords++;
        } else {
          skippedWords++;
        }
      } else {
        await db.wordEntries.add(wordEntry);
        importedWords++;
      }
    } catch (error) {
      logger.error(`Failed to import word: ${wordEntry.id}`, error);
      skippedWords++;
    }
  }

  // ReviewState 가져오기
  for (const reviewState of snapshot.reviewStates) {
    try {
      const existing = await reviewStateRepository.findById(reviewState.id);

      if (existing) {
        if (reviewState.history.length > existing.history.length) {
          await db.reviewStates.put(reviewState);
          importedReviews++;
        } else {
          skippedReviews++;
        }
      } else {
        await db.reviewStates.add(reviewState);
        importedReviews++;
      }
    } catch (error) {
      logger.error(`Failed to import review state: ${reviewState.id}`, error);
      skippedReviews++;
    }
  }

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

  eventBus.emit('sync:completed', { importedWords, importedReviews });
}

async function handleClearAllData(sendResponse: (response: MessageResponse) => void) {
  const allWordsToDelete = await wordRepository.findAll();
  await Promise.all(allWordsToDelete.map((w) => wordRepository.delete(w.id)));
  const allReviewsToDelete = await reviewStateRepository.findAll();
  await Promise.all(allReviewsToDelete.map((r) => reviewStateRepository.delete(r.id)));
  sendResponse({ success: true });
}

async function handleOpenLibrary(message: any, sendResponse: (response: MessageResponse) => void) {
  try {
    await chrome.action.openPopup();
    chrome.runtime.sendMessage({
      type: 'SWITCH_TO_LIBRARY',
      wordId: message.wordId,
    }).catch(() => {
      // Popup이 아직 로드되지 않은 경우 무시
    });
    sendResponse({ success: true });
  } catch (err) {
    logger.error('Failed to open popup', err);
    sendResponse({ success: false, error: 'Failed to open popup' });
  }
}

async function handleUploadSnapshot(sendResponse: (response: MessageResponse) => void) {
  const appsScriptUrl = import.meta.env.VITE_APPS_SCRIPT_URL || '';

  if (!appsScriptUrl) {
    sendResponse({
      success: false,
      error: 'Apps Script URL이 설정되지 않았습니다. .env 파일을 확인해주세요.',
    });
    return;
  }

  const snapshotWords = await wordRepository.findAll();
  const allReviewStates = await reviewStateRepository.findAll();

  const reviewStatesMap: Record<string, unknown> = {};
  allReviewStates.forEach((state) => {
    reviewStatesMap[state.wordId] = state;
  });

  const snapshotData = {
    words: snapshotWords,
    reviewStates: reviewStatesMap,
  };

  try {
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
    logger.error('Snapshot upload error', uploadError);
    sendResponse({
      success: false,
      error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
    });
  }
}

// ============================================================================
// AI 관련 핸들러 (Phase 2-B)
// ============================================================================

/**
 * AI 페이지 분석 핸들러
 */
async function handleAnalyzePageAI(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    // 사용량 확인
    const usageCheck = await canUseAI();

    if (!usageCheck.allowed) {
      sendResponse({
        success: false,
        error: usageCheck.isPro
          ? 'AI analysis temporarily unavailable'
          : `Daily limit reached (${usageCheck.remaining} remaining)`,
        data: {
          isPro: usageCheck.isPro,
          remaining: usageCheck.remaining,
        },
      });
      return;
    }

    // Gemini API 호출
    const request: GeminiAnalysisRequest = {
      pageContent: message.pageContent,
      pageUrl: message.pageUrl,
      pageTitle: message.pageTitle,
      userWords: message.userWords || [],
    };
    const result = await analyzePageWithGemini(request);

    // 사용량 증가
    await incrementAIUsage();

    // 분석 이력 저장
    try {
      await AIAnalysisHistoryRepository.createAnalysisHistory({
        pageUrl: request.pageUrl,
        pageTitle: request.pageTitle,
        summary: result.summary,
        difficulty: result.difficulty,
        recommendedWords: result.recommendedWords,
      });
      logger.info('AI analysis history saved');
    } catch (historyError) {
      logger.error('Failed to save analysis history', historyError);
      // 이력 저장 실패는 메인 기능에 영향을 주지 않음
    }

    logger.info('AI analysis completed', {
      url: request.pageUrl,
      recommendedWords: result.recommendedWords.length,
    });

    // Content Script에 AI 분석 완료 알림 (추천 단어 하이라이트 업데이트용)
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'AI_ANALYSIS_COMPLETED',
        }).catch((err) => {
          logger.debug('Failed to send AI_ANALYSIS_COMPLETED message', err);
        });
      }
    } catch (err) {
      logger.debug('Failed to notify content script', err);
    }

    sendResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('AI analysis failed', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'AI analysis failed',
    });
  }
}

/**
 * AI 분석 이력 조회 핸들러
 */
async function handleGetAnalysisHistory(
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const histories = await AIAnalysisHistoryRepository.findAllAnalysisHistory(20);

    sendResponse({
      success: true,
      data: histories,
    });
  } catch (error) {
    logger.error('Failed to get analysis history', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get analysis history',
    });
  }
}

/**
 * AI 사용량 통계 조회 핸들러
 */
async function handleGetAIUsageStats(
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const stats = await getAIUsageStats();

    sendResponse({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Failed to get AI usage stats', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get stats',
    });
  }
}

/**
 * 추천 단어 조회 핸들러
 */
async function handleGetRecommendedWords(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { words, limit, minScore, isPro } = message.data;

    const recommended = getRecommendedWords(
      words,
      limit || 15,
      minScore || 30,
      isPro || false
    );

    sendResponse({
      success: true,
      data: recommended,
    });
  } catch (error) {
    logger.error('Failed to get recommended words', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get recommendations',
    });
  }
}

/**
 * 단어 중요도 계산 핸들러
 */
async function handleCalculateWordImportance(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { words, contextScores, isPro } = message.data;

    const importance = calculateBatchImportance(
      words,
      contextScores || new Map(),
      isPro || false
    );

    sendResponse({
      success: true,
      data: importance,
    });
  } catch (error) {
    logger.error('Failed to calculate word importance', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Calculation failed',
    });
  }
}

/**
 * PDF 텍스트 선택 핸들러
 */
async function handlePDFTextSelected(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { text, pageInfo } = message.data;

    logger.info('PDF text selected', {
      text: text.substring(0, 50),
      page: pageInfo.pageNumber,
      pdfTitle: pageInfo.pdfTitle,
    });

    // 단어 조회 (일반 텍스트 선택과 동일)
    const lookupResult = await lookupWord(text);
    const wordInfo = await getWordInfo(text);

    sendResponse({
      success: true,
      data: {
        ...lookupResult,
        isSaved: wordInfo.isSaved,
        wordId: wordInfo.wordId,
        viewCount: wordInfo.viewCount,
        pdfPageInfo: pageInfo,
      },
    });
  } catch (error) {
    logger.error('PDF text selection handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'PDF selection failed',
    });
  }
}

/**
 * 빠른 조회 핸들러 (Ctrl/Alt + 클릭)
 */
async function handleQuickLookup(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { word } = message.data;

    logger.info('Quick lookup requested', { word });

    // 단어 조회
    const lookupResult = await lookupWord(word);
    const wordInfo = await getWordInfo(word);

    // 조회수 증가
    if (wordInfo.isSaved) {
      await incrementWordViewCount(word);
    }

    sendResponse({
      success: true,
      data: {
        ...lookupResult,
        isSaved: wordInfo.isSaved,
        wordId: wordInfo.wordId,
        viewCount: wordInfo.isSaved ? wordInfo.viewCount + 1 : 0,
      },
    });
  } catch (error) {
    logger.error('Quick lookup handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Quick lookup failed',
    });
  }
}

/**
 * 빠른 저장 핸들러 (Alt + 클릭)
 */
async function handleQuickSave(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { word, context, url, sourceTitle } = message.data;

    logger.info('Quick save requested', { word });

    // 단어 조회 후 저장
    const lookupResult = await lookupWord(word);

    const wordData = {
      word,
      context: context || word,
      url: url || '',
      sourceTitle: sourceTitle || 'Quick Save',
      definitions: lookupResult.definitions || [],
      phonetic: lookupResult.phonetic,
      audioUrl: lookupResult.audioUrl,
      language: 'en',
    };

    const result = await saveWord(wordData);

    sendResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Quick save handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Quick save failed',
    });
  }
}

/**
 * 모바일 퀴즈 링크 생성 핸들러
 */
async function handleGenerateMobileQuizLink(
  _message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    // 모든 단어 조회
    const allWords = await wordRepository.findAll();

    // 삭제된 단어 제외
    const activeWords = allWords.filter((word) => !word.deletedAt);

    if (activeWords.length === 0) {
      sendResponse({
        success: false,
        error: '저장된 단어가 없습니다.',
      });
      return;
    }

    // Firebase에 업로드
    const result = await uploadQuizToFirebase(activeWords);

    sendResponse({
      success: true,
      data: {
        url: result.url,
        quizId: result.quizId,
        wordCount: result.wordCount,
        expiresAt: result.expiresAt,
      },
    });
  } catch (error) {
    logger.error('Generate mobile quiz link handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Firebase 업로드에 실패했습니다',
    });
  }
}


/**
 * 데이터 내보내기 핸들러
 */
async function handleExportAllData(
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const backupData = await exportAllData();

    sendResponse({
      success: true,
      data: backupData,
    });
  } catch (error) {
    logger.error('Export all data handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to export data',
    });
  }
}

/**
 * 데이터 가져오기 핸들러
 */
async function handleImportAllData(
  message: any,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { backupData, options } = message.data;

    const result = await importAllData(backupData, options);

    sendResponse({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Import all data handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import data',
    });
  }
}
