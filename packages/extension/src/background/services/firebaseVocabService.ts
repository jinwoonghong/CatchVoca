/**
 * Firebase Vocabulary Synchronization Service
 * PC에서 전체 단어장을 Firebase에 동기화
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set } from 'firebase/database';
import type { WordEntry } from '@catchvoca/types';
import { firebaseConfig, FIREBASE_PATHS } from '../../config/firebase.config';
import { createWordRepository } from '@catchvoca/core/repositories/WordRepository';
import { getDbInstance } from '../dbInstance';

// Logger
const logger = {
  info: (msg: string, data?: any) => console.log(`[FirebaseVocabService] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[FirebaseVocabService] ${msg}`, error || ''),
};

// Firebase 초기화 (싱글톤)
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

// Repository lazy initialization
let wordRepository: ReturnType<typeof createWordRepository> | null = null;

async function ensureRepository() {
  if (!wordRepository) {
    const db = await getDbInstance();
    wordRepository = createWordRepository(db);
  }
}

/**
 * 전체 단어장을 Firebase에 업로드
 * 사용자별 경로에 저장: users/{userId}/vocabulary/{wordId}
 */
export async function uploadVocabularyToFirebase(
  userId: string
): Promise<{
  success: boolean;
  wordCount: number;
  error?: string;
}> {
  try {
    await ensureRepository();
    const db = initializeFirebase();

    // 모든 단어 가져오기
    const allWords = await wordRepository!.findAll();

    if (allWords.length === 0) {
      logger.info('No words to sync');
      return { success: true, wordCount: 0 };
    }

    // Firebase에 저장할 데이터 준비 (간소화)
    const vocabularyData: Record<string, any> = {};

    for (const word of allWords) {
      // 삭제된 단어는 제외
      if (word.deletedAt) continue;

      vocabularyData[word.id] = {
        word: word.word,
        normalizedWord: word.normalizedWord,
        definitions: word.definitions || ['정의 없음'],
        phonetic: word.phonetic || null,
        audioUrl: word.audioUrl || null,
        language: word.language,
        context: word.context || null,
        url: word.url,
        sourceTitle: word.sourceTitle || null,
        tags: word.tags || [],
        isFavorite: word.isFavorite || false,
        note: word.note || null,
        viewCount: word.viewCount || 0,
        lastViewedAt: word.lastViewedAt,
        createdAt: word.createdAt,
        updatedAt: word.updatedAt,
      };
    }

    // Firebase에 저장
    const vocabularyRef = ref(db, `users/${userId}/${FIREBASE_PATHS.VOCABULARY}`);
    await set(vocabularyRef, vocabularyData);

    const wordCount = Object.keys(vocabularyData).length;
    logger.info('Vocabulary uploaded to Firebase', {
      userId,
      wordCount,
    });

    return {
      success: true,
      wordCount,
    };
  } catch (error) {
    logger.error('Failed to upload vocabulary to Firebase', error);
    return {
      success: false,
      wordCount: 0,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * Firebase에서 전체 단어장 다운로드
 * (향후 Mobile PWA에서 사용)
 */
export async function downloadVocabularyFromFirebase(
  userId: string
): Promise<{
  success: boolean;
  words: WordEntry[];
  error?: string;
}> {
  try {
    const db = initializeFirebase();
    const { get } = await import('firebase/database');

    const vocabularyRef = ref(db, `users/${userId}/${FIREBASE_PATHS.VOCABULARY}`);
    const snapshot = await get(vocabularyRef);

    if (!snapshot.exists()) {
      logger.info('No vocabulary found in Firebase', { userId });
      return { success: true, words: [] };
    }

    const vocabularyData = snapshot.val() as Record<string, any>;
    const words: WordEntry[] = Object.values(vocabularyData);

    logger.info('Vocabulary downloaded from Firebase', {
      userId,
      wordCount: words.length,
    });

    return {
      success: true,
      words,
    };
  } catch (error) {
    logger.error('Failed to download vocabulary from Firebase', error);
    return {
      success: false,
      words: [],
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}
