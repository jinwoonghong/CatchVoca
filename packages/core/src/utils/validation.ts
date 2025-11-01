/**
 * 입력 검증 유틸리티
 */

/**
 * 단어 길이 제약
 */
export const WORD_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 50,
} as const;

/**
 * 문맥 길이 제약
 */
export const CONTEXT_CONSTRAINTS = {
  MIN_LENGTH: 1,
  MAX_LENGTH: 500,
} as const;

/**
 * 태그 제약
 */
export const TAG_CONSTRAINTS = {
  MAX_COUNT: 10,
  MAX_LENGTH: 20,
} as const;

/**
 * 단어 유효성 검증
 */
export function isValidWord(word: string): boolean {
  if (!word || typeof word !== 'string') {
    return false;
  }

  const trimmed = word.trim();
  return (
    trimmed.length >= WORD_CONSTRAINTS.MIN_LENGTH &&
    trimmed.length <= WORD_CONSTRAINTS.MAX_LENGTH
  );
}

/**
 * 문맥 유효성 검증
 */
export function isValidContext(context: string): boolean {
  if (!context || typeof context !== 'string') {
    return false;
  }

  const trimmed = context.trim();
  return (
    trimmed.length >= CONTEXT_CONSTRAINTS.MIN_LENGTH &&
    trimmed.length <= CONTEXT_CONSTRAINTS.MAX_LENGTH
  );
}

/**
 * URL 유효성 검증
 * 빈 문자열은 허용 (수동 입력의 경우 URL이 없을 수 있음)
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string') {
    return false;
  }

  // 빈 문자열은 허용
  if (url.trim() === '') {
    return true;
  }

  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 태그 유효성 검증
 */
export function isValidTags(tags: string[]): boolean {
  if (!Array.isArray(tags)) {
    return false;
  }

  if (tags.length > TAG_CONSTRAINTS.MAX_COUNT) {
    return false;
  }

  return tags.every(
    (tag) =>
      typeof tag === 'string' &&
      tag.trim().length > 0 &&
      tag.trim().length <= TAG_CONSTRAINTS.MAX_LENGTH
  );
}

/**
 * 언어 코드 유효성 검증 (ISO 639-1)
 */
export function isValidLanguageCode(code: string): boolean {
  const validCodes = ['en', 'ja', 'zh', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru'];
  return validCodes.includes(code);
}

/**
 * 타임스탬프 유효성 검증
 */
export function isValidTimestamp(timestamp: number): boolean {
  return (
    typeof timestamp === 'number' &&
    timestamp > 0 &&
    timestamp <= Date.now() + 1000 * 60 * 60 * 24 * 365 * 10 // 10년 이내
  );
}
