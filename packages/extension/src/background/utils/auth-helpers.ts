/**
 * 인증 관련 유틸리티 함수
 */

/**
 * 재시도 로직 (지수 백오프)
 * @param fn 실행할 함수
 * @param maxRetries 최대 재시도 횟수 (기본: 3)
 * @param baseDelay 기본 지연 시간 (기본: 1000ms)
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Retry] Attempt ${i + 1}/${maxRetries} failed:`, error);

      if (i < maxRetries - 1) {
        const delay = Math.min(baseDelay * Math.pow(2, i), 10000); // 최대 10초
        console.log(`[Retry] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new Error(`Operation failed after ${maxRetries} retries: ${lastError!.message}`);
}

/**
 * 타임아웃 래퍼
 * @param promise 실행할 Promise
 * @param timeoutMs 타임아웃 시간 (밀리초)
 * @param errorMessage 타임아웃 시 에러 메시지
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
  );

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Storage quota 확인
 */
export async function checkStorageQuota(): Promise<{
  bytesInUse: number;
  quotaBytes: number;
  usagePercent: number;
}> {
  const bytesInUse = await chrome.storage.local.getBytesInUse();
  const quotaBytes = chrome.storage.local.QUOTA_BYTES || 10485760; // 10MB
  const usagePercent = (bytesInUse / quotaBytes) * 100;

  return { bytesInUse, quotaBytes, usagePercent };
}

/**
 * 오래된 캐시 데이터 정리
 */
export async function cleanupOldStorage(): Promise<void> {
  const keysToKeep = ['firebaseAuthUser', 'googleAccessToken', 'authExpiresAt', 'settings'];

  const allData = await chrome.storage.local.get();

  for (const key of Object.keys(allData)) {
    if (!keysToKeep.includes(key)) {
      await chrome.storage.local.remove(key);
      console.log('[Storage] Removed old key:', key);
    }
  }
}

/**
 * Access Token 만료 확인
 */
export async function isAccessTokenExpired(): Promise<boolean> {
  const result = await chrome.storage.local.get('authExpiresAt');
  const expiresAt = result.authExpiresAt as number | undefined;

  if (!expiresAt) {
    return true; // 만료 시간 없으면 만료된 것으로 간주
  }

  const now = Date.now();
  const buffer = 5 * 60 * 1000; // 5분 버퍼

  return now >= expiresAt - buffer;
}
