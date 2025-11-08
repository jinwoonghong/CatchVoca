/**
 * Word Service
 * 단어 저장 및 조회 로직
 */

import { createWordRepository, createReviewStateRepository, eventBus, createInitialReviewState } from '@catchvoca/core';
import type { WordEntryInput } from '@catchvoca/types';
import { lookupWord } from './dictionaryAPI';
import { getDbInstance } from '../dbInstance';
import { syncService } from './syncService';

// Lazy initialization
let wordRepository: ReturnType<typeof createWordRepository> | null = null;
let reviewStateRepository: ReturnType<typeof createReviewStateRepository> | null = null;

async function ensureRepositories() {
  if (!wordRepository) {
    const db = await getDbInstance();
    wordRepository = createWordRepository(db);
    reviewStateRepository = createReviewStateRepository(db);
  }
}

// 간단한 로거 (background service worker용)
const logger = {
  info: (msg: string, data?: any) => console.log(`[WordService] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[WordService] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[WordService] ${msg}`, data || ''),
  debug: (msg: string, data?: any) => console.debug(`[WordService] ${msg}`, data || ''),
};

/**
 * 단어 저장 (API 조회 + DB 저장)
 */
export async function saveWord(wordData: Partial<WordEntryInput>): Promise<string> {
  await ensureRepositories();

  if (!wordData.word) {
    throw new Error('Word is required');
  }

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
  const wordId = await wordRepository!.create(wordEntryData);

  // 4. ReviewState 자동 생성 (SM-2 복습 시스템)
  try {
    const initialReviewState = createInitialReviewState(wordId);
    await reviewStateRepository!.create({
      wordId: initialReviewState.wordId,
      nextReviewAt: initialReviewState.nextReviewAt,
      interval: initialReviewState.interval,
      easeFactor: initialReviewState.easeFactor,
      repetitions: initialReviewState.repetitions,
      history: [], // 초기 히스토리는 빈 배열
    });
    logger.info(`ReviewState created for word: ${wordId}`);
  } catch (reviewError) {
    // ReviewState 생성 실패해도 단어는 저장됨
    logger.warn(`Failed to create ReviewState for ${wordId}`, reviewError);
  }

  // 5. EventBus를 통해 알림
  eventBus.emit('word:created', { id: wordId });

  logger.info(`Word saved: ${wordId}`);

  // 6. 자동 동기화 트리거 (로그인 상태일 경우)
  try {
    const status = syncService.getStatus();
    if (status.isAuthenticated) {
      logger.info('Triggering debounced sync after word creation');
      syncService.triggerDebouncedSync();
    }
  } catch (err) {
    logger.debug('Failed to trigger sync', err);
  }

  // 7. Content Script에 단어 저장 알림 (하이라이트 업데이트용)
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'WORD_SAVED',
        word: wordData.word,
      }).catch((err) => {
        // Content script가 없는 페이지에서는 실패할 수 있음 (무시)
        logger.debug('Failed to send WORD_SAVED message', err);
      });
    }
  } catch (err) {
    logger.debug('Failed to notify content script', err);
  }

  // 8. 사용자 알림
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon48.png',
    title: 'CatchVoca',
    message: `"${wordData.word}" 저장 완료!`,
  });

  return wordId;
}

/**
 * 단어 정보 가져오기 (viewCount, isSaved 포함)
 */
export async function getWordInfo(word: string) {
  await ensureRepositories();

  let viewCount = 0;
  let isSaved = false;
  let wordId: string | undefined;

  try {
    const existingWords = await wordRepository!.findByNormalizedWord(word);
    if (existingWords.length > 0 && existingWords[0]) {
      viewCount = existingWords[0].viewCount || 0;
      isSaved = true;
      wordId = existingWords[0].id;
    }
  } catch (err) {
    logger.warn('Failed to get word info', err);
  }

  return { viewCount, isSaved, wordId };
}

/**
 * 단어 조회수 증가
 */
export async function incrementWordViewCount(word: string): Promise<boolean> {
  await ensureRepositories();

  try {
    const existingWords = await wordRepository!.findByNormalizedWord(word);
    if (existingWords.length > 0 && existingWords[0]) {
      await wordRepository!.incrementViewCount(existingWords[0].id);
      return true;
    }
    return false;
  } catch (err) {
    logger.error('Increment view count error', err);
    return false;
  }
}
