/**
 * AI Usage Manager
 * AI 분석 사용량 및 광고 표시 관리
 *
 * 일일 3회까지 광고 없음, 4회째부터 광고 새창 표시 후 무제한 사용
 */

import { Logger } from '@catchvoca/core';
import type { AIUsage } from '@catchvoca/types';
import { AI_USAGE_LIMITS } from '@catchvoca/types';

const logger = new Logger('AIUsageManager');

// Chrome Storage 키
const STORAGE_KEY_AI_USAGE = 'ai_usage';

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayDate(): string {
  const now = new Date();
  const parts = now.toISOString().split('T');
  return parts[0] || '';
}

/**
 * AI 사용 가능 여부 및 광고 표시 필요 여부 확인
 */
export async function canUseAI(): Promise<{
  allowed: boolean; // 항상 true (무제한)
  showAd: boolean; // 3회 초과 시 true
  usedCount: number; // 오늘 사용 횟수
  freeLimit: number; // 무료 한도 (3회)
}> {
  try {
    // 설정에서 사용량 제한 해제 여부 확인 (개발/테스트용)
    const disableLimit = await getAIUsageLimitDisabled();
    if (disableLimit) {
      logger.info('AI usage limit disabled by user setting');
      return {
        allowed: true,
        showAd: false, // 제한 해제 시 광고 없음
        usedCount: 0,
        freeLimit: AI_USAGE_LIMITS.FREE_DAILY_LIMIT,
      };
    }

    // 오늘 사용량 확인
    const usage = await getTodayUsage();
    const freeLimit = AI_USAGE_LIMITS.FREE_DAILY_LIMIT;
    const showAd = usage.count >= freeLimit; // 3회 이상이면 광고 표시

    logger.info('AI usage check', {
      used: usage.count,
      freeLimit,
      showAd,
    });

    return {
      allowed: true, // 항상 허용 (무제한)
      showAd, // 3회 초과 시 광고 표시
      usedCount: usage.count,
      freeLimit,
    };
  } catch (error) {
    logger.error('Failed to check AI usage', error);
    // 에러 시 보수적으로 허용 (광고 없이)
    return {
      allowed: true,
      showAd: false,
      usedCount: 0,
      freeLimit: AI_USAGE_LIMITS.FREE_DAILY_LIMIT,
    };
  }
}

/**
 * AI 사용량 증가
 */
export async function incrementAIUsage(): Promise<void> {
  try {
    const usage = await getTodayUsage();

    // 오늘 사용량 증가
    usage.count++;

    // Chrome Storage에 저장
    await chrome.storage.local.set({
      [STORAGE_KEY_AI_USAGE]: usage,
    });

    logger.info('AI usage incremented', {
      date: usage.date,
      count: usage.count,
    });
  } catch (error) {
    logger.error('Failed to increment AI usage', error);
  }
}

/**
 * 오늘 AI 사용량 조회
 */
async function getTodayUsage(): Promise<AIUsage> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_AI_USAGE);
    const today = getTodayDate();
    const stored = result[STORAGE_KEY_AI_USAGE] as AIUsage | undefined;

    // 저장된 데이터가 오늘 것이면 반환
    if (stored && stored.date === today) {
      return stored;
    }

    // 오늘 데이터가 없으면 초기화
    const newUsage: AIUsage = {
      date: today,
      count: 0,
    };

    await chrome.storage.local.set({
      [STORAGE_KEY_AI_USAGE]: newUsage,
    });

    return newUsage;
  } catch (error) {
    logger.error('Failed to get today usage', error);
    return {
      date: getTodayDate(),
      count: 0,
    };
  }
}


/**
 * AI 사용량 통계 조회
 */
export async function getAIUsageStats(): Promise<{
  today: AIUsage;
  freeLimit: number; // 무료 한도 (3회)
  showAdAfter: number; // 이 횟수 이후 광고 표시
}> {
  const usage = await getTodayUsage();
  const freeLimit = AI_USAGE_LIMITS.FREE_DAILY_LIMIT;

  return {
    today: usage,
    freeLimit,
    showAdAfter: freeLimit, // 3회 이후 광고 표시
  };
}

/**
 * 설정에서 AI 사용량 제한 해제 여부 조회
 */
async function getAIUsageLimitDisabled(): Promise<boolean> {
  try {
    const result = await chrome.storage.local.get('catchvoca_settings');
    const settings = result.catchvoca_settings;
    // 개발 단계에서는 기본적으로 제한 해제 (정식 배포 전)
    // 설정 값이 명시적으로 false가 아닌 이상 true 반환
    if (settings?.disableAIUsageLimit !== undefined) {
      return settings.disableAIUsageLimit === true;
    }
    return true; // 기본값: 제한 해제
  } catch (error) {
    logger.error('Failed to get AI usage limit setting', error);
    return true; // 에러 시에도 제한 해제 (개발 단계)
  }
}
