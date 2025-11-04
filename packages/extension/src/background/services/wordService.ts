/**
 * Word Service
 * 단어 저장 및 조회 로직
 */

import { wordRepository, reviewStateRepository, eventBus, Logger, createInitialReviewState } from '@catchvoca/core';
import type { WordEntryInput } from '@catchvoca/types';
import { lookupWord } from './dictionaryAPI';

const logger = new Logger('WordService');

/**
 * 단어 저장 (API 조회 + DB 저장)
 */
export async function saveWord(wordData: Partial<WordEntryInput>): Promise<string> {
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
  const wordId = await wordRepository.create(wordEntryData);

  // 4. ReviewState 자동 생성 (SM-2 복습 시스템)
  try {
    const initialReviewState = createInitialReviewState(wordId);
    await reviewStateRepository.create({
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

  // 6. 사용자 알림
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
  let viewCount = 0;
  let isSaved = false;
  let wordId: string | undefined;

  try {
    const existingWords = await wordRepository.findByNormalizedWord(word);
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
  try {
    const existingWords = await wordRepository.findByNormalizedWord(word);
    if (existingWords.length > 0 && existingWords[0]) {
      await wordRepository.incrementViewCount(existingWords[0].id);
      return true;
    }
    return false;
  } catch (err) {
    logger.error('Increment view count error', err);
    return false;
  }
}
