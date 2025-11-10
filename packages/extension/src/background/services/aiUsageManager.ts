/**
 * AI Usage Manager
 * AI 분석 사용량 제한 관리
 *
 * 무료 사용자: 일일 3회 제한
 * Pro 사용자: 무제한
 */

import { Logger } from '@catchvoca/core';
import type { AIUsage, ProStatus } from '@catchvoca/types';
import { AI_USAGE_LIMITS } from '@catchvoca/types';

const logger = new Logger('AIUsageManager');

// Chrome Storage 키
const STORAGE_KEYS = {
  AI_USAGE: 'ai_usage',
  PRO_STATUS: 'pro_status',
} as const;

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayDate(): string {
  const now = new Date();
  const parts = now.toISOString().split('T');
  return parts[0] || '';
}

/**
 * AI 사용 가능 여부 확인
 */
export async function canUseAI(): Promise<{
  allowed: boolean;
  remaining: number;
  isPro: boolean;
}> {
  try {
    // 설정에서 사용량 제한 해제 여부 확인
    const disableLimit = await getAIUsageLimitDisabled();
    if (disableLimit) {
      logger.info('AI usage limit disabled by user setting');
      return {
        allowed: true,
        remaining: -1, // 무제한
        isPro: false,
      };
    }

    // Pro 상태 확인
    const proStatus = await getProStatus();
    const isPro = proStatus.active;

    // Pro 사용자는 무제한
    if (isPro) {
      return {
        allowed: true,
        remaining: -1, // 무제한
        isPro: true,
      };
    }

    // 무료 사용자: 오늘 사용량 확인
    const usage = await getTodayUsage();
    const limit = AI_USAGE_LIMITS.FREE_DAILY_LIMIT;
    const remaining = Math.max(0, limit - usage.count);

    logger.info('AI usage check', {
      isPro,
      used: usage.count,
      limit,
      remaining,
    });

    return {
      allowed: usage.count < limit,
      remaining,
      isPro: false,
    };
  } catch (error) {
    logger.error('Failed to check AI usage', error);
    // 에러 시 보수적으로 허용
    return {
      allowed: true,
      remaining: AI_USAGE_LIMITS.FREE_DAILY_LIMIT,
      isPro: false,
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
      [STORAGE_KEYS.AI_USAGE]: usage,
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
    const result = await chrome.storage.local.get(STORAGE_KEYS.AI_USAGE);
    const today = getTodayDate();
    const stored = result[STORAGE_KEYS.AI_USAGE] as AIUsage | undefined;

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
      [STORAGE_KEYS.AI_USAGE]: newUsage,
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
 * Pro 상태 조회
 */
async function getProStatus(): Promise<ProStatus> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.PRO_STATUS);
    const stored = result[STORAGE_KEYS.PRO_STATUS] as ProStatus | undefined;

    if (stored) {
      // 만료 확인
      if (stored.expiresAt && stored.expiresAt < Date.now()) {
        logger.info('Pro subscription expired');
        return {
          active: false,
        };
      }

      return stored;
    }

    // Pro 상태 없음
    return {
      active: false,
    };
  } catch (error) {
    logger.error('Failed to get Pro status', error);
    return {
      active: false,
    };
  }
}

/**
 * Pro 상태 설정 (테스트 또는 구독 연동용)
 */
export async function setProStatus(status: ProStatus): Promise<void> {
  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.PRO_STATUS]: status,
    });

    logger.info('Pro status updated', status);
  } catch (error) {
    logger.error('Failed to set Pro status', error);
  }
}

/**
 * AI 사용량 초기화 (테스트용)
 */
export async function resetAIUsage(): Promise<void> {
  try {
    const newUsage: AIUsage = {
      date: getTodayDate(),
      count: 0,
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.AI_USAGE]: newUsage,
    });

    logger.info('AI usage reset');
  } catch (error) {
    logger.error('Failed to reset AI usage', error);
  }
}

/**
 * AI 사용량 통계 조회
 */
export async function getAIUsageStats(): Promise<{
  today: AIUsage;
  isPro: boolean;
  limit: number;
  remaining: number;
}> {
  const usage = await getTodayUsage();
  const proStatus = await getProStatus();
  const limit = proStatus.active
    ? AI_USAGE_LIMITS.PRO_DAILY_LIMIT
    : AI_USAGE_LIMITS.FREE_DAILY_LIMIT;
  const remaining = proStatus.active ? -1 : Math.max(0, limit - usage.count);

  return {
    today: usage,
    isPro: proStatus.active,
    limit,
    remaining,
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
