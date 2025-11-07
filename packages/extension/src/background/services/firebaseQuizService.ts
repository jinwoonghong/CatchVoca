/**
 * Firebase Realtime Database를 사용한 모바일 퀴즈 서비스
 * URL Hash 방식의 한계(2048자)를 극복하기 위한 대안
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, remove } from 'firebase/database';
import type { WordEntry } from '@catchvoca/types';
import { firebaseConfig, FIREBASE_PATHS, QUIZ_EXPIRATION_MS } from '../../config/firebase.config';
import { Logger } from '@catchvoca/core';

const logger = new Logger('FirebaseQuizService');

/**
 * Firebase 앱 초기화 (싱글톤)
 */
let firebaseApp: ReturnType<typeof initializeApp> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

function initializeFirebase() {
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    database = getDatabase(firebaseApp);
    logger.info('Firebase initialized');
  }
  return database!;
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
    const db = initializeFirebase();

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

    // Firebase에 저장
    const quizRef = ref(db, `${FIREBASE_PATHS.QUIZZES}/${quizId}`);
    await set(quizRef, quizData);

    logger.info('Quiz uploaded to Firebase', {
      quizId,
      wordCount: words.length,
      expiresAt: new Date(expiresAt).toISOString(),
    });

    // PWA URL 생성
    const pwaUrl = import.meta.env.VITE_PWA_URL || 'https://jinwoonghong.github.io/CatchVoca_quiz/';
    const fullUrl = `${pwaUrl}?id=${quizId}`;

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
    const db = initializeFirebase();

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
 * 만료된 퀴즈 정리 (백그라운드 작업)
 */
export async function cleanupExpiredQuizzes(): Promise<number> {
  try {
    const db = initializeFirebase();

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
