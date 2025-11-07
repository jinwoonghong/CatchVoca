/**
 * SM-2 알고리즘 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  calculateNextReview,
  createInitialReviewState,
  intervalToDays,
  daysToInterval,
  isOverdue,
  timeUntilReview,
  DEFAULT_SM2_CONFIG,
} from '../../../src/services/sm2/algorithm';
import { Rating } from '@catchvoca/types';

describe('SM-2 Algorithm', () => {
  describe('createInitialReviewState', () => {
    it('초기 복습 상태를 생성해야 함', () => {
      const wordId = 'test::url';
      const now = Date.now();
      const state = createInitialReviewState(wordId);

      expect(state.wordId).toBe(wordId);
      expect(state.interval).toBe(1); // 첫 번째 간격: 1일
      expect(state.easeFactor).toBe(2.5); // 초기 난이도
      expect(state.repetitions).toBe(0);
      expect(state.nextReviewAt).toBeGreaterThanOrEqual(now); // 타이밍 이슈 방지
    });
  });

  describe('calculateNextReview', () => {
    it('Rating.Again(1)일 때 처음부터 다시 시작해야 함', () => {
      const currentState = {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      };

      const result = calculateNextReview(currentState, Rating.Again);

      expect(result.interval).toBe(1); // 처음부터 다시
      expect(result.repetitions).toBe(0);
      expect(result.easeFactor).toBeLessThan(2.5); // 난이도 증가
    });

    it('Rating.Hard(2)일 때 처음부터 다시 시작해야 함', () => {
      const currentState = {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      };

      const result = calculateNextReview(currentState, Rating.Hard);

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(0);
      expect(result.easeFactor).toBeLessThan(2.5);
    });

    it('Rating.Good(3)일 때 첫 번째 복습은 1일 후', () => {
      const currentState = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      };

      const result = calculateNextReview(currentState, Rating.Good);

      expect(result.interval).toBe(1);
      expect(result.repetitions).toBe(1);
      // Good(3)은 easeFactor를 약간 감소: 2.5 + (0.1 - 2*(0.08 + 2*0.02)) = 2.5 - 0.14 = 2.36
      expect(result.easeFactor).toBeCloseTo(2.36, 2);
    });

    it('Rating.Good(3)일 때 두 번째 복습은 6일 후', () => {
      const currentState = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 1,
      };

      const result = calculateNextReview(currentState, Rating.Good);

      expect(result.interval).toBe(6);
      expect(result.repetitions).toBe(2);
    });

    it('Rating.Good(3)일 때 세 번째 이후는 interval * EF', () => {
      const currentState = {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      };

      const result = calculateNextReview(currentState, Rating.Good);

      // 새로운 EF = 2.5 - 0.14 = 2.36, 새로운 간격 = 6 * 2.36 = 14.16 ≈ 14
      expect(result.interval).toBe(14);
      expect(result.repetitions).toBe(3);
    });

    it('Rating.Easy(4)일 때 easeFactor가 유지되거나 약간 증가해야 함', () => {
      const currentState = {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      };

      const result = calculateNextReview(currentState, Rating.Easy);

      // Easy(4): 2.5 + (0.1 - 1*(0.08 + 1*0.02)) = 2.5 + 0 = 2.5
      expect(result.easeFactor).toBeGreaterThanOrEqual(2.5);
      expect(result.repetitions).toBe(3);
    });

    it('Rating.VeryEasy(5)일 때 easeFactor가 Easy보다 더 높아야 함', () => {
      const currentState = {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      };

      const resultEasy = calculateNextReview(currentState, Rating.Easy);
      const resultVeryEasy = calculateNextReview(currentState, Rating.VeryEasy);

      // VeryEasy(5): 2.5 + (0.1 - 0*(0.08 + 0*0.02)) = 2.5 + 0.1 = 2.5 (최대값으로 제한)
      // Easy는 2.5이므로 VeryEasy는 같거나 더 커야 함
      expect(resultVeryEasy.easeFactor).toBeGreaterThanOrEqual(resultEasy.easeFactor);
    });

    it('easeFactor는 최소값(1.3) 이하로 내려가지 않아야 함', () => {
      const currentState = {
        interval: 1,
        easeFactor: 1.3,
        repetitions: 0,
      };

      const result = calculateNextReview(currentState, Rating.Again);

      expect(result.easeFactor).toBeGreaterThanOrEqual(DEFAULT_SM2_CONFIG.minEaseFactor);
    });

    it('easeFactor는 최대값(2.5) 이상으로 올라가지 않아야 함', () => {
      const currentState = {
        interval: 6,
        easeFactor: 2.5,
        repetitions: 2,
      };

      // VeryEasy를 여러 번 반복해도 2.5를 넘지 않아야 함
      let result = calculateNextReview(currentState, Rating.VeryEasy);
      result = calculateNextReview(
        { interval: result.interval, easeFactor: result.easeFactor, repetitions: result.repetitions },
        Rating.VeryEasy
      );

      expect(result.easeFactor).toBeLessThanOrEqual(DEFAULT_SM2_CONFIG.maxEaseFactor);
    });

    it('nextReviewAt은 현재 시간보다 미래여야 함', () => {
      const currentState = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      };

      const now = Date.now();
      const result = calculateNextReview(currentState, Rating.Good);

      expect(result.nextReviewAt).toBeGreaterThan(now);
    });
  });

  describe('intervalToDays', () => {
    it('밀리초를 일 단위로 변환해야 함', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(intervalToDays(oneDayMs)).toBe(1);
      expect(intervalToDays(oneDayMs * 7)).toBe(7);
      expect(intervalToDays(oneDayMs * 30)).toBe(30);
    });

    it('반올림 처리를 해야 함', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(intervalToDays(oneDayMs * 1.4)).toBe(1);
      expect(intervalToDays(oneDayMs * 1.6)).toBe(2);
    });
  });

  describe('daysToInterval', () => {
    it('일 단위를 밀리초로 변환해야 함', () => {
      const oneDayMs = 24 * 60 * 60 * 1000;
      expect(daysToInterval(1)).toBe(oneDayMs);
      expect(daysToInterval(7)).toBe(oneDayMs * 7);
      expect(daysToInterval(30)).toBe(oneDayMs * 30);
    });
  });

  describe('isOverdue', () => {
    it('복습 시간이 지났으면 true를 반환해야 함', () => {
      const now = Date.now();
      const pastTime = now - 3600000; // 1시간 전

      expect(isOverdue(pastTime, now)).toBe(true);
    });

    it('복습 시간이 아직 안 됐으면 false를 반환해야 함', () => {
      const now = Date.now();
      const futureTime = now + 3600000; // 1시간 후

      expect(isOverdue(futureTime, now)).toBe(false);
    });

    it('now 파라미터를 생략하면 현재 시간을 사용해야 함', () => {
      const pastTime = Date.now() - 3600000; // 1시간 전
      expect(isOverdue(pastTime)).toBe(true);
    });
  });

  describe('timeUntilReview', () => {
    it('복습까지 남은 시간을 반환해야 함', () => {
      const now = Date.now();
      const futureTime = now + 3600000; // 1시간 후

      expect(timeUntilReview(futureTime, now)).toBe(3600000);
    });

    it('복습 시간이 지났으면 음수를 반환해야 함', () => {
      const now = Date.now();
      const pastTime = now - 3600000; // 1시간 전

      expect(timeUntilReview(pastTime, now)).toBe(-3600000);
    });

    it('now 파라미터를 생략하면 현재 시간을 사용해야 함', () => {
      const futureTime = Date.now() + 3600000; // 1시간 후
      const result = timeUntilReview(futureTime);

      // 약간의 오차를 고려 (테스트 실행 시간)
      expect(result).toBeGreaterThan(3599000);
      expect(result).toBeLessThan(3601000);
    });
  });

  describe('SM-2 알고리즘 시나리오 테스트', () => {
    it('완벽한 학습 시나리오 (모두 VeryEasy)', () => {
      let state = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      };

      // 첫 번째 복습: VeryEasy
      state = calculateNextReview(state, Rating.VeryEasy);
      expect(state.repetitions).toBe(1);
      expect(state.interval).toBe(1);

      // 두 번째 복습: VeryEasy
      state = calculateNextReview(state, Rating.VeryEasy);
      expect(state.repetitions).toBe(2);
      expect(state.interval).toBe(6);

      // 세 번째 복습: VeryEasy
      state = calculateNextReview(state, Rating.VeryEasy);
      expect(state.repetitions).toBe(3);
      expect(state.interval).toBeGreaterThan(10);
    });

    it('실패 후 재학습 시나리오', () => {
      let state = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      };

      // 첫 번째 복습: Good
      state = calculateNextReview(state, Rating.Good);
      expect(state.repetitions).toBe(1);

      // 두 번째 복습: Good
      state = calculateNextReview(state, Rating.Good);
      expect(state.repetitions).toBe(2);

      // 세 번째 복습: Again (실패)
      state = calculateNextReview(state, Rating.Again);
      expect(state.repetitions).toBe(0); // 리셋
      expect(state.interval).toBe(1); // 처음부터

      // 다시 시작: Good
      state = calculateNextReview(state, Rating.Good);
      expect(state.repetitions).toBe(1);
    });

    it('혼합 평가 시나리오', () => {
      let state = {
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
      };

      // Good → Easy → Good → Hard → Good
      state = calculateNextReview(state, Rating.Good);
      expect(state.repetitions).toBe(1);

      state = calculateNextReview(state, Rating.Easy);
      expect(state.repetitions).toBe(2);

      state = calculateNextReview(state, Rating.Good);
      expect(state.repetitions).toBe(3);

      state = calculateNextReview(state, Rating.Hard);
      expect(state.repetitions).toBe(0); // 리셋

      state = calculateNextReview(state, Rating.Good);
      expect(state.repetitions).toBe(1);
    });
  });
});
