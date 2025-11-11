/**
 * Firebase Realtime Database를 사용한 모바일 퀴즈 서비스
 * URL Hash 방식의 한계(2048자)를 극복하기 위한 대안
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove, type Database } from 'firebase/database';
import { getAuth, type Auth, type User as FirebaseUser } from 'firebase/auth';
import type { WordEntry } from '@catchvoca/types';
import { firebaseConfig, FIREBASE_PATHS, QUIZ_EXPIRATION_MS } from '../../config/firebase.config';
import { createWordRepository, createReviewStateRepository } from '@catchvoca/core';
import { getDbInstance } from '../dbInstance';

// 간단한 로거 (background service worker용)
const logger = {
  info: (msg: string, data?: any) => console.log(`[FirebaseQuizService] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[FirebaseQuizService] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[FirebaseQuizService] ${msg}`, data || ''),
};

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

/**
 * Firebase 앱 초기화 (싱글톤)
 */
let firebaseApp: FirebaseApp | null = null;
let database: Database | null = null;
let auth: Auth | null = null;

function initializeFirebase(): { db: Database; auth: Auth } {
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
    auth = getAuth(firebaseApp);
    logger.info('Firebase initialized');
  }
  return { db: database!, auth: auth! };
}

/**
 * Firebase Auth 인증
 * 수정: Anonymous Auth 제거, firebaseAuthService 사용
 */
async function ensureAuthenticated(): Promise<void> {
  const firebaseAuth = initializeFirebase().auth;

  // 이미 로그인되어 있으면 스킵
  if (firebaseAuth.currentUser) {
    logger.info('Already authenticated', { uid: firebaseAuth.currentUser.uid });
    return;
  }

  logger.info('Not authenticated, checking firebaseAuthService...');

  // firebaseAuthService에서 현재 사용자 확인
  const { getCurrentUser } = await import('./firebaseAuthService');
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('로그인이 필요합니다. 먼저 구글 로그인을 해주세요.');
  }

  // firebaseAuthService가 이미 Firebase Auth 세션을 관리하므로
  // firebaseAuth.currentUser가 자동으로 설정되어 있어야 함
  if (!firebaseAuth.currentUser) {
    logger.warn('User exists but Firebase session not found');
    throw new Error('Firebase 인증 세션을 찾을 수 없습니다. 다시 로그인해주세요.');
  }

  // TypeScript narrowing을 위한 변수 할당
  const currentFirebaseUser: FirebaseUser = firebaseAuth.currentUser;
  logger.info('Firebase Auth session confirmed', { uid: currentFirebaseUser.uid });
}

/**
 * 퀴즈 데이터 인터페이스
 */
export interface QuizData {
  id: string;
  words: Array<{
    w: string; // word
    d: string[]; // definitions
    p: string | null; // phonetic
    a: string | null; // audioUrl
  }>;
  createdAt: number;
  expiresAt: number;
}

/**
 * 고유 퀴즈 ID 생성
 */
function generateQuizId(): string {
  // 8자리 랜덤 ID (Base62: a-zA-Z0-9)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

/**
 * Firebase에 퀴즈 데이터 업로드
 */
export async function uploadQuizToFirebase(
  words: WordEntry[]
): Promise<{
  quizId: string;
  url: string;
  wordCount: number;
  expiresAt: number;
}> {
  try {
    // Firebase Auth 인증 확인 및 로그인
    await ensureAuthenticated();

    const { db } = initializeFirebase();

    // 사용자 로그인 확인
    const { getCurrentUser } = await import('./firebaseAuthService');
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('로그인이 필요합니다. 먼저 구글 로그인을 해주세요.');
    }

    const userId = user.uid;

    // 고유 ID 생성
    const quizId = generateQuizId();

    // 만료 시간 계산
    const now = Date.now();
    const expiresAt = now + QUIZ_EXPIRATION_MS;

    // 데이터 압축 (필요한 필드만)
    const compressedWords = words.map((word) => ({
      w: word.word,
      d: word.definitions || ['정의 없음'],
      p: word.phonetic || null,
      a: word.audioUrl || null,
    }));

    // QuizData 생성
    const quizData: QuizData = {
      id: quizId,
      words: compressedWords,
      createdAt: now,
      expiresAt,
    };

    // Firebase에 저장 (사용자별 경로)
    const quizRef = ref(db, `users/${userId}/${FIREBASE_PATHS.QUIZZES}/${quizId}`);
    await set(quizRef, quizData);

    logger.info('Quiz uploaded to Firebase', {
      quizId,
      wordCount: words.length,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    // PWA URL 생성 (userId도 포함)
    const pwaUrl = import.meta.env.VITE_PWA_URL || 'https://jinwoonghong.github.io/CatchVoca_quiz/';
    const fullUrl = `${pwaUrl}?id=${quizId}&uid=${userId}`;

    return {
      quizId,
      url: fullUrl,
      wordCount: words.length,
      expiresAt,
    };
  } catch (error) {
    logger.error('Failed to upload quiz to Firebase', error);
    throw new Error(
      error instanceof Error
        ? `Firebase 업로드 실패: ${error.message}`
        : 'Firebase 업로드 중 알 수 없는 오류가 발생했습니다'
    );
  }
}

/**
 * Firebase에서 퀴즈 데이터 다운로드
 * (PWA에서 사용)
 */
export async function downloadQuizFromFirebase(quizId: string): Promise<QuizData | null> {
  try {
    // Firebase Auth 인증 확인 및 로그인
    await ensureAuthenticated();

    const { db } = initializeFirebase();

    const quizRef = ref(db, `${FIREBASE_PATHS.QUIZZES}/${quizId}`);
    const snapshot = await get(quizRef);

    if (!snapshot.exists()) {
      logger.warn('Quiz not found', { quizId });
      return null;
    }

    const quizData = snapshot.val() as QuizData;

    // 만료 확인
    if (quizData.expiresAt < Date.now()) {
      logger.info('Quiz expired, deleting', { quizId });
      await remove(quizRef);
      return null;
    }

    logger.info('Quiz downloaded from Firebase', {
      quizId,
      wordCount: quizData.words.length,
    });

    return quizData;
  } catch (error) {
    logger.error('Failed to download quiz from Firebase', error);
    throw new Error(
      error instanceof Error
        ? `Firebase 다운로드 실패: ${error.message}`
        : 'Firebase 다운로드 중 알 수 없는 오류가 발생했습니다'
    );
  }
}

/**
 * SM-2 진행도를 비교하여 incoming이 더 나은지 판단
 * @returns true if incoming is better (should update), false if existing is better (keep existing)
 */
function compareSM2Progress(incoming: any, existing: any): boolean {
  // 1. repetitions가 더 높으면 더 진행된 것
  if (incoming.repetitions > existing.repetitions) {
    return true;
  }
  if (incoming.repetitions < existing.repetitions) {
    return false;
  }

  // 2. repetitions가 같으면 interval이 더 긴 것이 더 진행된 것
  if (incoming.interval > existing.interval) {
    return true;
  }
  if (incoming.interval < existing.interval) {
    return false;
  }

  // 3. interval도 같으면 easeFactor가 더 높은 것이 더 좋음
  if (incoming.easeFactor > existing.easeFactor) {
    return true;
  }
  if (incoming.easeFactor < existing.easeFactor) {
    return false;
  }

  // 4. 모든 값이 같으면 기존 것을 유지 (false)
  return false;
}

/**
 * 모바일에서 업데이트된 ReviewState를 PC로 동기화
 * (모바일에서 퀴즈 완료 후 호출)
 */
export async function syncReviewStatesFromFirebase(quizId: string): Promise<number> {
  await ensureRepositories();

  try {
    // Firebase Auth 인증 확인 및 로그인
    await ensureAuthenticated();

    const { db } = initializeFirebase();

    // 사용자 로그인 확인
    const { getCurrentUser } = await import('./firebaseAuthService');
    const user = await getCurrentUser();

    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    const userId = user.uid;

    // Firebase에서 퀴즈 데이터 가져오기
    const quizRef = ref(db, `users/${userId}/${FIREBASE_PATHS.QUIZZES}/${quizId}`);
    const snapshot = await get(quizRef);

    if (!snapshot.exists()) {
      logger.warn('Quiz not found for sync', { quizId });
      return 0;
    }

    const quizData = snapshot.val() as QuizData;

    // 만료 확인
    if (quizData.expiresAt < Date.now()) {
      logger.info('Quiz expired during sync', { quizId });
      await remove(quizRef);
      return 0;
    }

    // Firebase에서 ReviewState 데이터 가져오기
    const reviewStatesRef = ref(db, `users/${userId}/${FIREBASE_PATHS.QUIZZES}/${quizId}/reviewStates`);
    const reviewStatesSnapshot = await get(reviewStatesRef);

    if (!reviewStatesSnapshot.exists()) {
      logger.info('No review states found in Firebase', { quizId });
      return 0;
    }

    const firebaseReviewStates = reviewStatesSnapshot.val() as Record<string, any>;
    logger.info('Fetched review states from Firebase', { count: Object.keys(firebaseReviewStates).length });

    // ReviewState 동기화 및 병합
    let syncedCount = 0;
    let mergedCount = 0;
    let createdCount = 0;

    for (const [wordId, firebaseState] of Object.entries(firebaseReviewStates)) {
      // wordId 형식: "{normalizedWord}::{quizId}"
      // normalizedWord 추출
      const normalizedWord = wordId.split('::')[0];

      if (!normalizedWord) {
        logger.warn('Invalid wordId format', { wordId });
        continue;
      }

      // normalizedWord로 WordEntry 찾기
      const wordEntries = await wordRepository!.findByNormalizedWord(normalizedWord);

      if (wordEntries.length === 0) {
        logger.warn('Word not found for sync', { normalizedWord });
        continue;
      }

      // 첫 번째 매칭된 단어 사용 (여러 개 있을 수 있음)
      const wordEntry = wordEntries[0];
      if (!wordEntry) {
        continue;
      }

      // 로컬 ReviewState 확인
      const existingReviewState = await reviewStateRepository!.findByWordId(wordEntry.id);

      // Firebase ReviewState를 로컬 형식으로 변환
      const incomingState = {
        id: existingReviewState?.id || `${wordEntry.id}::review`,
        wordId: wordEntry.id,
        nextReviewAt: firebaseState.nextReviewAt || Date.now(),
        interval: firebaseState.interval || 1,
        easeFactor: firebaseState.easeFactor || 2.5,
        repetitions: firebaseState.repetitions || 0,
        history: existingReviewState?.history || [],
      };

      if (!existingReviewState) {
        // 로컬에 없으면 새로 생성
        await reviewStateRepository!.create(incomingState);
        createdCount++;
        syncedCount++;
        logger.info('Created new ReviewState from Firebase', { wordId: wordEntry.id });
      } else {
        // 로컬에 있으면 병합 (더 나은 진도를 유지)
        const shouldUpdate = compareSM2Progress(incomingState, existingReviewState);

        if (shouldUpdate) {
          // Firebase 데이터가 더 진행된 경우 업데이트
          await reviewStateRepository!.update(existingReviewState.id, {
            nextReviewAt: incomingState.nextReviewAt,
            interval: incomingState.interval,
            easeFactor: incomingState.easeFactor,
            repetitions: incomingState.repetitions,
          });
          mergedCount++;
          syncedCount++;
          logger.info('Updated ReviewState from Firebase', {
            wordId: wordEntry.id,
            oldRepetitions: existingReviewState.repetitions,
            newRepetitions: incomingState.repetitions,
          });
        } else {
          logger.info('Kept existing ReviewState (better progress)', {
            wordId: wordEntry.id,
            localRepetitions: existingReviewState.repetitions,
            firebaseRepetitions: incomingState.repetitions,
          });
        }
      }
    }

    logger.info('Review states synced from mobile', {
      quizId,
      total: syncedCount,
      created: createdCount,
      merged: mergedCount,
    });
    return syncedCount;
  } catch (error) {
    logger.error('Failed to sync review states from Firebase', error);
    return 0;
  }
}

/**
 * 만료된 퀴즈 정리 (백그라운드 작업)
 */
export async function cleanupExpiredQuizzes(): Promise<number> {
  try {
    // Firebase Auth 인증 확인 및 로그인
    await ensureAuthenticated();

    const { db } = initializeFirebase();

    const quizzesRef = ref(db, FIREBASE_PATHS.QUIZZES);
    const snapshot = await get(quizzesRef);

    if (!snapshot.exists()) {
      return 0;
    }

    const now = Date.now();
    let deletedCount = 0;

    const quizzes = snapshot.val() as Record<string, QuizData>;
    const deletePromises: Promise<void>[] = [];

    for (const [quizId, quizData] of Object.entries(quizzes)) {
      if (quizData.expiresAt < now) {
        const quizRef = ref(db, `${FIREBASE_PATHS.QUIZZES}/${quizId}`);
        deletePromises.push(remove(quizRef));
        deletedCount++;
      }
    }

    await Promise.all(deletePromises);

    if (deletedCount > 0) {
      logger.info('Expired quizzes cleaned up', { deletedCount });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired quizzes', error);
    return 0;
  }
}
