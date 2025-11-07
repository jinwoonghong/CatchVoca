/**
 * Backup Service
 * 데이터 백업 및 복원 서비스
 */

import { createWordRepository, createReviewStateRepository } from '@catchvoca/core';
import type { WordEntry, ReviewState } from '@catchvoca/types';
import { getDbInstance } from '../dbInstance';

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
  info: (msg: string, data?: any) => console.log(`[BackupService] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[BackupService] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[BackupService] ${msg}`, data || ''),
};

export interface BackupData {
  version: string;
  exportedAt: number;
  words: WordEntry[];
  reviewStates: ReviewState[];
  metadata: {
    totalWords: number;
    totalReviewStates: number;
  };
}

/**
 * 모든 데이터 백업
 */
export async function exportAllData(): Promise<BackupData> {
  await ensureRepositories();

  try {
    logger.info('Starting data export');

    // 모든 단어 조회
    const words = await wordRepository!.findAll();

    // 모든 복습 상태 조회
    const reviewStates: ReviewState[] = [];
    for (const word of words) {
      const reviewState = await reviewStateRepository!.findByWordId(word.id);
      if (reviewState) {
        reviewStates.push(reviewState);
      }
    }

    const backupData: BackupData = {
      version: '0.3.0',
      exportedAt: Date.now(),
      words,
      reviewStates,
      metadata: {
        totalWords: words.length,
        totalReviewStates: reviewStates.length,
      },
    };

    logger.info('Data export completed', {
      wordCount: words.length,
      reviewStateCount: reviewStates.length,
    });

    return backupData;
  } catch (error) {
    logger.error('Data export failed', error);
    throw new Error('데이터 내보내기에 실패했습니다.');
  }
}

/**
 * 백업 데이터 복원
 */
export async function importAllData(
  backupData: BackupData,
  options: {
    clearExisting?: boolean;
    skipDuplicates?: boolean;
  } = {}
): Promise<{
  importedWords: number;
  importedReviewStates: number;
  skippedWords: number;
}> {
  await ensureRepositories();

  const { clearExisting = false, skipDuplicates = true } = options;

  try {
    logger.info('Starting data import', {
      wordCount: backupData.words.length,
      reviewStateCount: backupData.reviewStates.length,
      clearExisting,
      skipDuplicates,
    });

    // 기존 데이터 삭제 옵션
    if (clearExisting) {
      logger.warn('Clearing existing data');
      const existingWords = await wordRepository!.findAll();
      for (const word of existingWords) {
        await wordRepository!.delete(word.id);
      }
    }

    let importedWords = 0;
    let importedReviewStates = 0;
    let skippedWords = 0;

    // 단어 복원
    for (const word of backupData.words) {
      try {
        // 중복 체크
        if (skipDuplicates) {
          const existing = await wordRepository!.findById(word.id);
          if (existing) {
            skippedWords++;
            continue;
          }
        }

        // 단어 저장
        await wordRepository!.create(word);
        importedWords++;

        // 해당 단어의 복습 상태 복원
        const reviewState = backupData.reviewStates.find(
          (rs) => rs.wordId === word.id
        );
        if (reviewState) {
          await reviewStateRepository!.create(reviewState);
          importedReviewStates++;
        }
      } catch (error) {
        logger.error('Failed to import word', { word: word.word, error });
      }
    }

    logger.info('Data import completed', {
      importedWords,
      importedReviewStates,
      skippedWords,
    });

    return {
      importedWords,
      importedReviewStates,
      skippedWords,
    };
  } catch (error) {
    logger.error('Data import failed', error);
    throw new Error('데이터 가져오기에 실패했습니다.');
  }
}

/**
 * JSON 파일로 다운로드
 */
export function downloadBackupAsJson(backupData: BackupData, filename?: string): void {
  const jsonString = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename || `catchvoca-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  logger.info('Backup downloaded', { filename: a.download });
}

/**
 * JSON 파일 읽기
 */
export async function readBackupFromFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const backupData = JSON.parse(content) as BackupData;

        // 버전 확인
        if (!backupData.version) {
          throw new Error('유효하지 않은 백업 파일입니다.');
        }

        // 데이터 검증
        if (!Array.isArray(backupData.words) || !Array.isArray(backupData.reviewStates)) {
          throw new Error('백업 데이터 형식이 올바르지 않습니다.');
        }

        logger.info('Backup file read successfully', {
          version: backupData.version,
          wordCount: backupData.words.length,
        });

        resolve(backupData);
      } catch (error) {
        logger.error('Failed to read backup file', error);
        reject(new Error('백업 파일을 읽을 수 없습니다.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('파일 읽기에 실패했습니다.'));
    };

    reader.readAsText(file);
  });
}

/**
 * 백업 데이터 검증
 */
export function validateBackupData(backupData: BackupData): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!backupData.version) {
    errors.push('버전 정보가 없습니다.');
  }

  if (!backupData.exportedAt || typeof backupData.exportedAt !== 'number') {
    errors.push('내보내기 날짜 정보가 올바르지 않습니다.');
  }

  if (!Array.isArray(backupData.words)) {
    errors.push('단어 데이터가 배열이 아닙니다.');
  }

  if (!Array.isArray(backupData.reviewStates)) {
    errors.push('복습 상태 데이터가 배열이 아닙니다.');
  }

  if (backupData.words.length === 0) {
    errors.push('백업 파일에 단어가 없습니다.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
