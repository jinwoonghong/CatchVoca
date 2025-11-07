/**
 * ReviewStateRepository 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewStateRepository } from '../../src/repositories/ReviewStateRepository';
import { db } from '../../src/db/database';
import type { ReviewStateCreateDTO } from '@catchvoca/types';
import { Rating } from '@catchvoca/types';

describe('ReviewStateRepository', () => {
  let repository: ReviewStateRepository;

  beforeEach(() => {
    repository = new ReviewStateRepository(db);
  });

  afterEach(async () => {
    await db.wordEntries.clear();
    await db.reviewStates.clear();
  });

  const createMockData = (wordId: string = 'test::https://example.com'): ReviewStateCreateDTO => ({
    wordId,
    nextReviewAt: Date.now() + 86400000, // 내일
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    history: [],
  });

  describe('create', () => {
    it('복습 상태를 생성해야 함', async () => {
      const data = createMockData();
      const id = await repository.create(data);

      expect(id).toBe(data.wordId);

      const saved = await repository.findById(id);
      expect(saved).toBeDefined();
      expect(saved?.wordId).toBe(data.wordId);
      expect(saved?.interval).toBe(1);
      expect(saved?.easeFactor).toBe(2.5);
      expect(saved?.history).toEqual([]);
    });

    it('중복된 wordId를 거부해야 함', async () => {
      const data = createMockData();
      await repository.create(data);

      await expect(repository.create(data)).rejects.toThrow(
        'ReviewState already exists'
      );
    });

    it('입력 검증을 수행해야 함', async () => {
      const data = createMockData();

      // Invalid wordId
      const invalidWordId = { ...data, wordId: '' };
      await expect(repository.create(invalidWordId)).rejects.toThrow('Invalid wordId');

      // Invalid easeFactor
      const invalidEaseFactor = { ...data, easeFactor: 3.0 };
      await expect(repository.create(invalidEaseFactor)).rejects.toThrow(
        'Invalid easeFactor'
      );
    });
  });

  describe('findByWordId', () => {
    it('wordId로 복습 상태를 조회해야 함', async () => {
      const data = createMockData('word1::url1');
      await repository.create(data);

      const result = await repository.findByWordId('word1::url1');
      expect(result).toBeDefined();
      expect(result?.wordId).toBe('word1::url1');
    });

    it('존재하지 않는 wordId는 null을 반환해야 함', async () => {
      const result = await repository.findByWordId('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('findDueReviews', () => {
    it('복습이 필요한 단어를 조회해야 함', async () => {
      const now = Date.now();

      // 과거 (복습 필요)
      await repository.create({
        ...createMockData('word1::url1'),
        nextReviewAt: now - 3600000, // 1시간 전
      });

      // 현재 (복습 필요)
      await repository.create({
        ...createMockData('word2::url2'),
        nextReviewAt: now,
      });

      // 미래 (복습 불필요)
      await repository.create({
        ...createMockData('word3::url3'),
        nextReviewAt: now + 86400000, // 내일
      });

      const results = await repository.findDueReviews();
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.wordId)).toContain('word1::url1');
      expect(results.map((r) => r.wordId)).toContain('word2::url2');
    });

    it('limit 파라미터를 적용해야 함', async () => {
      const now = Date.now();

      // 복습 필요한 단어 3개 생성
      await repository.create({
        ...createMockData('word1::url1'),
        nextReviewAt: now - 1000,
      });
      await repository.create({
        ...createMockData('word2::url2'),
        nextReviewAt: now - 2000,
      });
      await repository.create({
        ...createMockData('word3::url3'),
        nextReviewAt: now - 3000,
      });

      const results = await repository.findDueReviews(2);
      expect(results).toHaveLength(2);
    });
  });

  describe('recordReview', () => {
    it('복습 완료를 기록해야 함', async () => {
      const data = createMockData('word1::url1');
      await repository.create(data);

      const nextReviewAt = Date.now() + 172800000; // 2일 후
      await repository.recordReview(
        'word1::url1',
        Rating.Good,
        nextReviewAt,
        2, // interval
        2.6, // easeFactor
        1 // repetitions
      );

      const updated = await repository.findByWordId('word1::url1');
      expect(updated).toBeDefined();
      expect(updated?.nextReviewAt).toBe(nextReviewAt);
      expect(updated?.interval).toBe(2);
      expect(updated?.easeFactor).toBe(2.6);
      expect(updated?.repetitions).toBe(1);
      expect(updated?.history).toHaveLength(1);
      expect(updated?.history[0]?.rating).toBe(Rating.Good);
    });

    it('히스토리를 누적해야 함', async () => {
      const data = createMockData('word1::url1');
      await repository.create(data);

      // 첫 번째 복습
      await repository.recordReview(
        'word1::url1',
        Rating.Good,
        Date.now() + 86400000,
        1,
        2.5,
        1
      );

      // 두 번째 복습
      await repository.recordReview(
        'word1::url1',
        Rating.Easy,
        Date.now() + 172800000,
        2,
        2.6,
        2
      );

      const updated = await repository.findByWordId('word1::url1');
      expect(updated?.history).toHaveLength(2);
      expect(updated?.history[0]?.rating).toBe(Rating.Good);
      expect(updated?.history[1]?.rating).toBe(Rating.Easy);
    });
  });

  describe('getReviewStats', () => {
    it('복습 통계를 반환해야 함', async () => {
      const now = Date.now();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // 총 3개 생성
      await repository.create({
        ...createMockData('word1::url1'),
        nextReviewAt: now - 3600000, // 복습 필요
      });
      await repository.create({
        ...createMockData('word2::url2'),
        nextReviewAt: now + 86400000, // 복습 불필요
      });
      await repository.create({
        ...createMockData('word3::url3'),
        nextReviewAt: now - 1000, // 복습 필요
      });

      // 오늘 복습 완료 1개
      await repository.recordReview(
        'word1::url1',
        Rating.Good,
        now + 86400000,
        1,
        2.5,
        1
      );

      const stats = await repository.getReviewStats();
      expect(stats.total).toBe(3);
      expect(stats.dueToday).toBe(1); // word3만 복습 필요
      expect(stats.completedToday).toBe(1); // word1 복습 완료
    });
  });
});
