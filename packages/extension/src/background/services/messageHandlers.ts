/**
 * Message Handlers
 * Chrome runtime message 핸들러
 */

import type { CheckVocaDB } from '@catchvoca/core';
import {
  createWordRepository,
  createReviewStateRepository,
  AIAnalysisHistoryRepository,
  eventBus,
  calculateNextReview,
  validateSnapshotDetailed,
} from '@catchvoca/core';
import { getDbInstance } from '../dbInstance';

// Lazy initialization
let db: CheckVocaDB | null = null;
let wordRepository: ReturnType<typeof createWordRepository> | null = null;
let reviewStateRepository: ReturnType<typeof createReviewStateRepository> | null = null;

async function ensureRepositories() {
  if (!db) {
    db = await getDbInstance();
    wordRepository = createWordRepository(db);
    reviewStateRepository = createReviewStateRepository(db);
  }
  // After this call, repositories are guaranteed to be non-null
}
import type { Rating, Snapshot, GeminiAnalysisRequest, WordEntry } from '@catchvoca/types';
import { lookupWord } from './dictionaryAPI';
import { saveWord, getWordInfo, incrementWordViewCount } from './wordService';
import { getSettings, updateSettings } from './storage';
import { analyzePageWithGemini } from './geminiAPI';
import { calculateBatchImportance, getRecommendedWords } from './wordImportance';
import { canUseAI, incrementAIUsage, getAIUsageStats } from './aiUsageManager';
import { uploadQuizToFirebase } from './firebaseQuizService';
import { exportAllData, importAllData } from './backupService';
import { syncService } from './syncService';

// 간단한 로거 (background service worker용)
const log = {
  info: (msg: string, data?: any) => console.log(`[MessageHandler] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[MessageHandler] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[MessageHandler] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`[MessageHandler] ${msg}`, data || ''),
};

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

      // 모바일 퀴즈 관련 핸들러 (Week 5-6)
      case 'GOOGLE_SIGN_IN':
        await handleGoogleSignIn(sendResponse);
        break;

      case 'GOOGLE_SIGN_OUT':
        await handleGoogleSignOut(sendResponse);
        break;

      case 'GET_CURRENT_USER':
        await handleGetCurrentUser(sendResponse);
        break;

      case 'SYNC_FROM_MOBILE':
        await handleSyncFromMobile(message, sendResponse);
        break;

      case 'GENERATE_MOBILE_QUIZ_LINK':
        await handleGenerateMobileQuizLink(message, sendResponse);
        break;

      // 온라인 동기화 핸들러 (Phase 3)
      case 'GET_SYNC_STATUS':
        await handleGetSyncStatus(sendResponse);
        break;

      case 'SYNC_LOGIN':
        await handleSyncLogin(sendResponse);
        break;

      case 'SYNC_LOGOUT':
        await handleSyncLogout(sendResponse);
        break;

      case 'SYNC_NOW':
        await handleSyncNow(sendResponse);
        break;

      case 'SYNC_RESET':
        await handleSyncReset(sendResponse);
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
    log.error('Message handler error', error);
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
  await ensureRepositories();
  const words = await wordRepository!.findAll();
  sendResponse({ success: true, data: words });
}

async function handleDeleteWord(message: any, sendResponse: (response: MessageResponse) => void) {
  await ensureRepositories();
  await wordRepository!.delete(message.wordId);
  sendResponse({ success: true });
}

async function handleUpdateWord(message: any, sendResponse: (response: MessageResponse) => void) {
  await ensureRepositories();
  await wordRepository!.update(message.wordId, message.changes);
  sendResponse({ success: true });
}

async function handleIncrementViewCount(message: any, sendResponse: (response: MessageResponse) => void) {
  const success = await incrementWordViewCount(message.word);
  sendResponse({ success });
}

async function handleGetReviewStats(sendResponse: (response: MessageResponse) => void) {
  await ensureRepositories();
  const stats = await reviewStateRepository!.getReviewStats();
  sendResponse({ success: true, data: stats });
}

async function handleGetReviewState(message: any, sendResponse: (response: MessageResponse) => void) {
  try {
    await ensureRepositories();
    const reviewState = await reviewStateRepository!.findByWordId(message.wordId);
    sendResponse({ success: true, data: reviewState });
  } catch (error) {
    sendResponse({ success: false, error: 'Failed to get review state' });
  }
}

async function handleGetDueReviews(message: any, sendResponse: (response: MessageResponse) => void) {
  await ensureRepositories();
  const dueReviews = await reviewStateRepository!.findDueReviews(message.limit || 20);
  const dueWords = await Promise.all(
    dueReviews.map((review) => wordRepository!.findById(review.wordId))
  );
  sendResponse({ success: true, data: dueWords.filter((w) => w !== null) });
}

async function handleStartReviewSession(message: any, sendResponse: (response: MessageResponse) => void) {
  await ensureRepositories();
  const sessionLimit = message.limit || 20;
  const sessionDueReviews = await reviewStateRepository!.findDueReviews(sessionLimit);
  const sessionWords = await Promise.all(
    sessionDueReviews.map((review) => wordRepository!.findById(review.wordId))
  );
  const validSessionWords = sessionWords.filter((w) => w !== null);

  log.info('Review session started', {
    totalDue: sessionDueReviews.length,
    sessionSize: validSessionWords.length,
    limit: sessionLimit,
  });

  sendResponse({ success: true, data: validSessionWords });
}

async function handleSubmitReview(message: any, sendResponse: (response: MessageResponse) => void) {
  try {
    await ensureRepositories();
    const reviewState = await reviewStateRepository!.findByWordId(message.wordId);

    if (!reviewState) {
      log.warn('ReviewState not found for wordId:', message.wordId);
      sendResponse({ success: false, error: 'ReviewState를 찾을 수 없습니다.' });
      return;
    }

    const rating: Rating = message.rating;

    const sm2Result = calculateNextReview(
      {
        interval: reviewState.interval,
        easeFactor: reviewState.easeFactor,
        repetitions: reviewState.repetitions,
      },
      rating
    );

    await reviewStateRepository!.recordReview(
      message.wordId,
      rating,
      sm2Result.nextReviewAt,
      sm2Result.interval,
      sm2Result.easeFactor,
      sm2Result.repetitions
    );

    log.info('SM-2 review recorded', {
      wordId: message.wordId,
      rating,
      interval: sm2Result.interval,
    });

    sendResponse({ success: true });
  } catch (error) {
    log.error('Submit review error:', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : '평가 제출 중 오류가 발생했습니다.'
    });
  }
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
  await ensureRepositories();
  const allWords = await wordRepository!.findAll();
  sendResponse({
    success: true,
    data: {
      wordCount: allWords.length,
      storageUsed: '< 1 MB',
    },
  });
}

async function handleExportData(sendResponse: (response: MessageResponse) => void) {
  await ensureRepositories();
  const exportWords = await wordRepository!.findAll();
  const exportReviews = await reviewStateRepository!.findAll();
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
    log.error('JSON parse error', parseError);
    sendResponse({
      success: false,
      error: 'Invalid JSON format',
    });
    return;
  }

  // Snapshot 구조 검증
  const validationErrors = validateSnapshotDetailed(snapshot);
  if (validationErrors.length > 0) {
    log.error('Validation errors', validationErrors);
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

  await ensureRepositories();

  // WordEntry 가져오기
  for (const wordEntry of snapshot.wordEntries) {
    try {
      const existing = await wordRepository!.findById(wordEntry.id);

      if (existing) {
        if (wordEntry.updatedAt > existing.updatedAt) {
          await db!.wordEntries.put({
            ...wordEntry,
            updatedAt: Date.now(),
          });
          importedWords++;
        } else {
          skippedWords++;
        }
      } else {
        await db!.wordEntries.add(wordEntry);
        importedWords++;
      }
    } catch (error) {
      log.error(`Failed to import word: ${wordEntry.id}`, error);
      skippedWords++;
    }
  }

  // ReviewState 가져오기
  for (const reviewState of snapshot.reviewStates) {
    try {
      const existing = await reviewStateRepository!.findById(reviewState.id);

      if (existing) {
        if (reviewState.history.length > existing.history.length) {
          await db!.reviewStates.put(reviewState);
          importedReviews++;
        } else {
          skippedReviews++;
        }
      } else {
        await db!.reviewStates.add(reviewState);
        importedReviews++;
      }
    } catch (error) {
      log.error(`Failed to import review state: ${reviewState.id}`, error);
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
  await ensureRepositories();
  const allWordsToDelete = await wordRepository!.findAll();
  await Promise.all(allWordsToDelete.map((w) => wordRepository!.delete(w.id)));
  const allReviewsToDelete = await reviewStateRepository!.findAll();
  await Promise.all(allReviewsToDelete.map((r) => reviewStateRepository!.delete(r.id)));
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
    log.error('Failed to open popup', err);
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

  await ensureRepositories();
  const snapshotWords = await wordRepository!.findAll();
  const allReviewStates = await reviewStateRepository!.findAll();

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
    log.error('Snapshot upload error', uploadError);
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
    // 사용량 확인 (항상 허용, 광고 표시 여부만 확인)
    const usageCheck = await canUseAI();

    // AI 분석은 항상 허용 (allowed는 항상 true)
    // showAd가 true면 프론트엔드에서 광고 표시

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
      await ensureRepositories();
      await AIAnalysisHistoryRepository.createAnalysisHistory(db!, {
        pageUrl: request.pageUrl,
        pageTitle: request.pageTitle,
        summary: result.summary,
        difficulty: result.difficulty,
        recommendedWords: result.recommendedWords,
      });
      log.info('AI analysis history saved');
    } catch (historyError) {
      log.error('Failed to save analysis history', historyError);
      // 이력 저장 실패는 메인 기능에 영향을 주지 않음
    }

    log.info('AI analysis completed', {
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
          log.debug('Failed to send AI_ANALYSIS_COMPLETED message', err);
        });
      }
    } catch (err) {
      log.debug('Failed to notify content script', err);
    }

    sendResponse({
      success: true,
      data: {
        ...result,
        showAd: usageCheck.showAd, // 3회 초과 시 광고 표시 필요
        usedCount: usageCheck.usedCount,
        freeLimit: usageCheck.freeLimit,
      },
    });
  } catch (error) {
    log.error('AI analysis failed', error);
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
    await ensureRepositories();
    const histories = await AIAnalysisHistoryRepository.findAllAnalysisHistory(db!, 20);

    sendResponse({
      success: true,
      data: histories,
    });
  } catch (error) {
    log.error('Failed to get analysis history', error);
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
    log.error('Failed to get AI usage stats', error);
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
    log.error('Failed to get recommended words', error);
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
    log.error('Failed to calculate word importance', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Calculation failed',
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
    await ensureRepositories();

    // PC 퀴즈와 동일하게 복습 대상 단어만 가져오기
    const dueReviews = await reviewStateRepository!.findDueReviews(20); // 최대 20개
    const dueWords = await Promise.all(
      dueReviews.map((review) => wordRepository!.findById(review.wordId))
    );
    // 타입 안전성: null 체크 후 WordEntry 배열로 변환
    const validDueWords = dueWords.filter((w): w is WordEntry => w !== null);

    if (validDueWords.length === 0) {
      sendResponse({
        success: false,
        error: '복습할 단어가 없습니다.',
      });
      return;
    }

    // Firebase에 업로드
    const result = await uploadQuizToFirebase(validDueWords);

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
    log.error('Generate mobile quiz link handler error', error);
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
    log.error('Export all data handler error', error);
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
    log.error('Import all data handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import data',
    });
  }
}

/**
 * 구글 로그인 핸들러
 */
async function handleGoogleSignIn(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    const { signInWithGoogle } = await import('./firebaseAuthService');
    const user = await signInWithGoogle();

    if (user) {
      sendResponse({
        success: true,
        data: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        },
      });
    } else {
      sendResponse({
        success: false,
        error: '로그인에 실패했습니다.',
      });
    }
  } catch (error) {
    log.error('Google sign-in handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign in',
    });
  }
}

/**
 * 로그아웃 핸들러
 */
async function handleGoogleSignOut(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    const { signOut } = await import('./firebaseAuthService');
    await signOut();

    sendResponse({
      success: true,
    });
  } catch (error) {
    log.error('Sign out handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign out',
    });
  }
}

/**
 * 현재 사용자 정보 가져오기 핸들러
 */
async function handleGetCurrentUser(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    // syncService의 사용자 정보를 사용 (chrome.storage.local에 저장되어 있음)
    const status = syncService.getStatus();

    if (status.currentUser) {
      sendResponse({
        success: true,
        data: {
          uid: status.currentUser.uid,
          email: status.currentUser.email,
          displayName: status.currentUser.displayName,
          photoURL: status.currentUser.photoURL,
        },
      });
    } else {
      sendResponse({
        success: true,
        data: null,
      });
    }
  } catch (error) {
    log.error('Get current user handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get user',
    });
  }
}

/**
 * 모바일 학습 데이터 동기화 핸들러
 */
async function handleSyncFromMobile(
  message: { quizId: string },
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    const { syncReviewStatesFromFirebase } = await import('./firebaseQuizService');
    const syncedCount = await syncReviewStatesFromFirebase(message.quizId);

    sendResponse({
      success: true,
      data: { syncedCount },
    });
  } catch (error) {
    log.error('Sync from mobile handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync from mobile',
    });
  }
}

/**
 * Get sync status handler
 */
async function handleGetSyncStatus(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    const status = syncService.getStatus();

    sendResponse({
      success: true,
      data: status,
    });
  } catch (error) {
    log.error('Get sync status handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sync status',
    });
  }
}

/**
 * Sync login handler
 */
async function handleSyncLogin(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    await syncService.authenticate();
    const status = syncService.getStatus();

    sendResponse({
      success: true,
      data: status,
    });
  } catch (error) {
    log.error('Sync login handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to login',
    });
  }
}

/**
 * Sync logout handler
 */
async function handleSyncLogout(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    await syncService.signOut();

    sendResponse({
      success: true,
      data: {
        isAuthenticated: false,
        currentUser: null,
        lastSyncedAt: 0,
        syncInProgress: false,
      },
    });
  } catch (error) {
    log.error('Sync logout handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to logout',
    });
  }
}

/**
 * Sync now handler
 */
async function handleSyncNow(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    const syncResult = await syncService.sync();
    const status = syncService.getStatus();

    sendResponse({
      success: true,
      data: {
        ...status,
        syncResult,
      },
    });
  } catch (error) {
    log.error('Sync now handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync',
    });
  }
}

/**
 * Reset sync timestamp handler
 */
async function handleSyncReset(sendResponse: (response: MessageResponse) => void): Promise<void> {
  try {
    await syncService.resetLastSyncedAt();
    const status = syncService.getStatus();

    sendResponse({
      success: true,
      data: status,
    });
  } catch (error) {
    log.error('Sync reset handler error', error);
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset sync timestamp',
    });
  }
}
