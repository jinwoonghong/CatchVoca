/**
 * ReviewStateRepository - 복습 상태 데이터 관리
 */

import type {
  ReviewState,
  ReviewStateCreateDTO,
  ReviewStateUpdateDTO,
  ReviewLog,
  Rating,
} from '@catchvoca/types';
import { BaseRepository } from './BaseRepository';
import type { CheckVocaDB } from '../db/database';

export class ReviewStateRepository extends BaseRepository<
  ReviewState,
  ReviewStateCreateDTO,
  ReviewStateUpdateDTO
> {
  constructor(db: CheckVocaDB) {
    super(db.reviewStates);
  }

  /**
   * ReviewState 생성
   */
  async create(data: ReviewStateCreateDTO): Promise<string> {
    // 입력 검증
    this.validateCreateData(data);

    // ID 생성 (wordId 사용)
    const id = data.wordId;

    // 중복 체크
    const exists = await this.exists(id);
    if (exists) {
      throw new Error(`ReviewState already exists for word: ${data.wordId}`);
    }

    // ReviewState 생성
    const reviewState: ReviewState = {
      id,
      wordId: data.wordId,
      nextReviewAt: data.nextReviewAt,
      interval: data.interval,
      easeFactor: data.easeFactor,
      repetitions: data.repetitions,
      history: [],
    };

    await this.table.add(reviewState);
    return id;
  }

  /**
   * wordId로 ReviewState 조회
   */
  async findByWordId(wordId: string): Promise<ReviewState | null> {
    return await this.findById(wordId);
  }

  /**
   * 복습이 필요한 단어 목록 조회
   * @param limit 조회할 최대 개수
   * @returns 복습이 필요한 ReviewState 배열 (nextReviewAt 오름차순)
   */
  async findDueReviews(limit: number = 20): Promise<ReviewState[]> {
    const now = Date.now();
    return await this.table
      .where('nextReviewAt')
      .belowOrEqual(now)
      .limit(limit)
      .toArray();
  }

  /**
   * 복습 완료 처리
   * @param wordId 단어 ID
   * @param rating 평가 등급
   * @param nextReviewAt 다음 복습 시각
   * @param interval 복습 간격
   * @param easeFactor 난이도 계수
   * @param repetitions 성공 반복 횟수
   */
  async recordReview(
    wordId: string,
    rating: Rating,
    nextReviewAt: number,
    interval: number,
    easeFactor: number,
    repetitions: number
  ): Promise<void> {
    const reviewState = await this.findByWordId(wordId);
    if (!reviewState) {
      throw new Error(`ReviewState not found for word: ${wordId}`);
    }

    // 복습 히스토리 추가
    const reviewLog: ReviewLog = {
      reviewedAt: Date.now(),
      rating,
      interval: reviewState.interval,
    };

    // ✅ history가 undefined이거나 배열이 아닐 수 있으므로 안전하게 처리
    const existingHistory = Array.isArray(reviewState.history) ? reviewState.history : [];
    const updatedHistory = [...existingHistory, reviewLog];

    // ReviewState 업데이트
    await this.update(wordId, {
      nextReviewAt,
      interval,
      easeFactor,
      repetitions,
      history: updatedHistory,
    });
  }

  /**
   * 전체 복습 통계 조회
   */
  async getReviewStats(): Promise<{
    total: number;
    dueToday: number;
    completedToday: number;
  }> {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTimestamp = todayStart.getTime();

    const all = await this.table.toArray();

    const total = all.length;
    const dueToday = all.filter((state) => state.nextReviewAt <= now).length;

    // 오늘 복습한 개수 계산
    const completedToday = all.filter((state) => {
      if (!state.history || state.history.length === 0) return false;
      const lastReview = state.history[state.history.length - 1];
      return lastReview && lastReview.reviewedAt >= todayStartTimestamp;
    }).length;

    return {
      total,
      dueToday,
      completedToday,
    };
  }

  /**
   * 입력 데이터 검증
   */
  private validateCreateData(data: ReviewStateCreateDTO): void {
    if (!data.wordId || typeof data.wordId !== 'string') {
      throw new Error('Invalid wordId: must be a non-empty string');
    }

    if (typeof data.nextReviewAt !== 'number' || data.nextReviewAt < 0) {
      throw new Error('Invalid nextReviewAt: must be a positive number');
    }

    if (typeof data.interval !== 'number' || data.interval < 0) {
      throw new Error('Invalid interval: must be a non-negative number');
    }

    if (
      typeof data.easeFactor !== 'number' ||
      data.easeFactor < 1.3 ||
      data.easeFactor > 2.5
    ) {
      throw new Error('Invalid easeFactor: must be between 1.3 and 2.5');
    }

    if (typeof data.repetitions !== 'number' || data.repetitions < 0) {
      throw new Error('Invalid repetitions: must be a non-negative number');
    }
  }
}

// Factory function for creating ReviewStateRepository instances
export function createReviewStateRepository(db: CheckVocaDB): ReviewStateRepository {
  return new ReviewStateRepository(db);
}
