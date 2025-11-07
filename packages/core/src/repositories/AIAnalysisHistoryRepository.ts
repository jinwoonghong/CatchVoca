/**
 * AI Analysis History Repository
 * AI 웹페이지 분석 이력 관리
 */

import type { AIAnalysisHistory } from '@catchvoca/types';
import type { CheckVocaDB } from '../db/database';

// 간단한 로거 (service worker 호환)
const log = {
  info: (msg: string, data?: any) => console.log(`[AIAnalysisHistoryRepository] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[AIAnalysisHistoryRepository] ${msg}`, error || ''),
};

/**
 * AI 분석 이력 조회 (최신순)
 */
export async function findAllAnalysisHistory(db: CheckVocaDB, limit = 20): Promise<AIAnalysisHistory[]> {
  try {
    const histories = await db.analysisHistory
      .orderBy('analyzedAt')
      .reverse()
      .limit(limit)
      .toArray();

    log.info('Find all analysis history', { count: histories.length });
    return histories;
  } catch (error) {
    log.error('Failed to find analysis history', error);
    throw error;
  }
}

/**
 * AI 분석 이력 생성
 */
export async function createAnalysisHistory(
  db: CheckVocaDB,
  data: Omit<AIAnalysisHistory, 'id' | 'analyzedAt' | 'savedWordsCount'>
): Promise<AIAnalysisHistory> {
  try {
    const now = Date.now();
    const history: AIAnalysisHistory = {
      ...data,
      id: `analysis::${now}`,
      analyzedAt: now,
      savedWordsCount: 0,
    };

    await db.analysisHistory.add(history);
    log.info('Created analysis history', { id: history.id });

    return history;
  } catch (error) {
    log.error('Failed to create analysis history', error);
    throw error;
  }
}

/**
 * AI 분석 이력 단어 저장 카운트 증가
 */
export async function incrementSavedWordsCount(db: CheckVocaDB, id: string): Promise<void> {
  try {
    const history = await db.analysisHistory.get(id);
    if (!history) {
      throw new Error(`Analysis history not found: ${id}`);
    }

    await db.analysisHistory.update(id, {
      savedWordsCount: (history.savedWordsCount || 0) + 1,
    });

    log.info('Incremented saved words count', { id, newCount: history.savedWordsCount + 1 });
  } catch (error) {
    log.error('Failed to increment saved words count', error);
    throw error;
  }
}

/**
 * AI 분석 이력 삭제
 */
export async function deleteAnalysisHistory(db: CheckVocaDB, id: string): Promise<void> {
  try {
    await db.analysisHistory.delete(id);
    log.info('Deleted analysis history', { id });
  } catch (error) {
    log.error('Failed to delete analysis history', error);
    throw error;
  }
}

/**
 * 모든 AI 분석 이력 삭제
 */
export async function clearAllAnalysisHistory(db: CheckVocaDB): Promise<void> {
  try {
    await db.analysisHistory.clear();
    log.info('Cleared all analysis history');
  } catch (error) {
    log.error('Failed to clear analysis history', error);
    throw error;
  }
}
