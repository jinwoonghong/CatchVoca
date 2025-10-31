/**
 * SM-2 알고리즘 구현
 * SuperMemo 2 간격 반복 알고리즘
 *
 * @see https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
 */

import { Rating } from '@catchvoca/types';
import type { ReviewState } from '@catchvoca/types';

/**
 * SM-2 알고리즘 계산 결과
 */
export interface SM2Result {
  /** 다음 복습 시각 (timestamp) */
  nextReviewAt: number;
  /** 복습 간격 (일 단위) */
  interval: number;
  /** 난이도 계수 (1.3 ~ 2.5) */
  easeFactor: number;
  /** 성공 반복 횟수 */
  repetitions: number;
}

/**
 * SM-2 알고리즘 설정
 */
export interface SM2Config {
  /** 최소 난이도 계수 */
  minEaseFactor: number;
  /** 최대 난이도 계수 */
  maxEaseFactor: number;
  /** 첫 번째 복습 간격 (일) */
  firstInterval: number;
  /** 두 번째 복습 간격 (일) */
  secondInterval: number;
}

/**
 * 기본 SM-2 설정
 */
export const DEFAULT_SM2_CONFIG: SM2Config = {
  minEaseFactor: 1.3,
  maxEaseFactor: 2.5,
  firstInterval: 1,
  secondInterval: 6,
};

/**
 * 초기 ReviewState 생성
 * @param wordId 단어 ID
 * @param config SM-2 설정 (선택사항)
 * @returns 초기 ReviewState 데이터
 */
export function createInitialReviewState(
  wordId: string,
  config: SM2Config = DEFAULT_SM2_CONFIG
): Omit<ReviewState, 'id' | 'history'> {
  const now = Date.now();
  const nextReviewAt = now + config.firstInterval * 24 * 60 * 60 * 1000;

  return {
    wordId,
    nextReviewAt,
    interval: config.firstInterval,
    easeFactor: 2.5, // 초기 난이도 계수
    repetitions: 0,
  };
}

/**
 * SM-2 알고리즘을 사용하여 다음 복습 일정 계산
 *
 * @param currentState 현재 복습 상태
 * @param rating 사용자의 평가 (1-5)
 * @param config SM-2 설정 (선택사항)
 * @returns 다음 복습 일정 정보
 */
export function calculateNextReview(
  currentState: Pick<ReviewState, 'interval' | 'easeFactor' | 'repetitions'>,
  rating: Rating,
  config: SM2Config = DEFAULT_SM2_CONFIG
): SM2Result {
  let { interval, easeFactor, repetitions } = currentState;

  // 1. EaseFactor 계산
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const newEaseFactor = Math.max(
    config.minEaseFactor,
    Math.min(
      config.maxEaseFactor,
      easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
    )
  );

  // 2. 평가에 따른 간격 및 반복 횟수 계산
  let newInterval: number;
  let newRepetitions: number;

  if (rating < Rating.Good) {
    // Rating이 Good(3) 미만이면 처음부터 다시 시작
    newInterval = config.firstInterval;
    newRepetitions = 0;
  } else {
    // Rating이 Good(3) 이상이면 성공
    newRepetitions = repetitions + 1;

    if (newRepetitions === 1) {
      // 첫 번째 성공 복습
      newInterval = config.firstInterval;
    } else if (newRepetitions === 2) {
      // 두 번째 성공 복습
      newInterval = config.secondInterval;
    } else {
      // 세 번째 이후 성공 복습
      // I(n) = I(n-1) * EF
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // 3. 다음 복습 시각 계산
  const now = Date.now();
  const nextReviewAt = now + newInterval * 24 * 60 * 60 * 1000;

  return {
    nextReviewAt,
    interval: newInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
  };
}

/**
 * 복습 간격을 일 단위로 변환
 * @param milliseconds 밀리초
 * @returns 일 단위
 */
export function intervalToDays(milliseconds: number): number {
  return Math.round(milliseconds / (24 * 60 * 60 * 1000));
}

/**
 * 일 단위를 밀리초로 변환
 * @param days 일 단위
 * @returns 밀리초
 */
export function daysToInterval(days: number): number {
  return days * 24 * 60 * 60 * 1000;
}

/**
 * 복습이 지연되었는지 확인
 * @param nextReviewAt 예정된 복습 시각
 * @param now 현재 시각 (선택사항, 기본값: Date.now())
 * @returns 지연 여부
 */
export function isOverdue(nextReviewAt: number, now: number = Date.now()): boolean {
  return now > nextReviewAt;
}

/**
 * 복습까지 남은 시간 계산
 * @param nextReviewAt 예정된 복습 시각
 * @param now 현재 시각 (선택사항, 기본값: Date.now())
 * @returns 남은 시간 (밀리초, 음수면 지연)
 */
export function timeUntilReview(nextReviewAt: number, now: number = Date.now()): number {
  return nextReviewAt - now;
}
