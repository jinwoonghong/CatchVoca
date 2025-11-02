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

/**
 * WordEntry 유효성 검증
 */
export function isValidWordEntry(entry: any): entry is import('@catchvoca/types').WordEntry {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  // 필수 필드 검증
  if (
    typeof entry.id !== 'string' ||
    !isValidWord(entry.word) ||
    typeof entry.normalizedWord !== 'string' ||
    !isValidContext(entry.context) ||
    !isValidUrl(entry.url) ||
    typeof entry.sourceTitle !== 'string' ||
    !isValidLanguageCode(entry.language) ||
    !Array.isArray(entry.tags) ||
    typeof entry.isFavorite !== 'boolean' ||
    typeof entry.manuallyEdited !== 'boolean' ||
    !isValidTimestamp(entry.createdAt) ||
    !isValidTimestamp(entry.updatedAt)
  ) {
    return false;
  }

  // 선택적 필드 검증
  if (entry.definitions !== undefined && !Array.isArray(entry.definitions)) {
    return false;
  }

  if (entry.phonetic !== undefined && typeof entry.phonetic !== 'string') {
    return false;
  }

  if (entry.audioUrl !== undefined && typeof entry.audioUrl !== 'string') {
    return false;
  }

  if (entry.note !== undefined && typeof entry.note !== 'string') {
    return false;
  }

  if (entry.viewCount !== undefined && typeof entry.viewCount !== 'number') {
    return false;
  }

  if (entry.lastViewedAt !== undefined && !isValidTimestamp(entry.lastViewedAt)) {
    return false;
  }

  if (entry.deletedAt !== undefined && !isValidTimestamp(entry.deletedAt)) {
    return false;
  }

  // 태그 검증
  if (!isValidTags(entry.tags)) {
    return false;
  }

  // contextSnapshot 검증
  if (entry.contextSnapshot !== null && entry.contextSnapshot !== undefined) {
    if (
      typeof entry.contextSnapshot !== 'object' ||
      !Array.isArray(entry.contextSnapshot.sentences) ||
      typeof entry.contextSnapshot.selectedSentenceIndex !== 'number' ||
      typeof entry.contextSnapshot.rawText !== 'string'
    ) {
      return false;
    }
  }

  // selectionRange 검증
  if (entry.selectionRange !== null && entry.selectionRange !== undefined) {
    if (
      typeof entry.selectionRange !== 'object' ||
      typeof entry.selectionRange.startOffset !== 'number' ||
      typeof entry.selectionRange.endOffset !== 'number' ||
      typeof entry.selectionRange.selectedText !== 'string'
    ) {
      return false;
    }
  }

  return true;
}

/**
 * ReviewState 유효성 검증
 */
export function isValidReviewState(state: any): state is import('@catchvoca/types').ReviewState {
  if (!state || typeof state !== 'object') {
    return false;
  }

  // 필수 필드 검증
  if (
    typeof state.id !== 'string' ||
    typeof state.wordId !== 'string' ||
    !isValidTimestamp(state.nextReviewAt) ||
    typeof state.interval !== 'number' ||
    typeof state.easeFactor !== 'number' ||
    typeof state.repetitions !== 'number' ||
    !Array.isArray(state.history)
  ) {
    return false;
  }

  // 범위 검증
  if (state.interval < 0 || state.easeFactor < 1.3 || state.easeFactor > 2.5 || state.repetitions < 0) {
    return false;
  }

  // history 검증
  for (const log of state.history) {
    if (
      !log ||
      typeof log !== 'object' ||
      !isValidTimestamp(log.reviewedAt) ||
      typeof log.rating !== 'number' ||
      typeof log.interval !== 'number' ||
      log.rating < 1 ||
      log.rating > 5 ||
      log.interval < 0
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Snapshot 유효성 검증
 */
export function isValidSnapshot(snapshot: any): snapshot is import('@catchvoca/types').Snapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return false;
  }

  // 필수 필드 검증
  if (
    typeof snapshot.snapshotVersion !== 'number' ||
    !Array.isArray(snapshot.wordEntries) ||
    !Array.isArray(snapshot.reviewStates) ||
    !isValidTimestamp(snapshot.createdAt)
  ) {
    return false;
  }

  // snapshotVersion 검증 (현재 버전은 1)
  if (snapshot.snapshotVersion !== 1) {
    return false;
  }

  // wordEntries 검증
  for (const entry of snapshot.wordEntries) {
    if (!isValidWordEntry(entry)) {
      return false;
    }
  }

  // reviewStates 검증
  for (const state of snapshot.reviewStates) {
    if (!isValidReviewState(state)) {
      return false;
    }
  }

  return true;
}

/**
 * Validation 에러 상세 정보 생성
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

/**
 * Snapshot 상세 검증 (에러 정보 반환)
 */
export function validateSnapshotDetailed(snapshot: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    errors.push({ field: 'snapshot', message: 'Snapshot must be an object' });
    return errors;
  }

  // snapshotVersion 검증
  if (typeof snapshot.snapshotVersion !== 'number') {
    errors.push({
      field: 'snapshotVersion',
      message: 'snapshotVersion must be a number',
      value: snapshot.snapshotVersion,
    });
  } else if (snapshot.snapshotVersion !== 1) {
    errors.push({
      field: 'snapshotVersion',
      message: 'Unsupported snapshot version (expected: 1)',
      value: snapshot.snapshotVersion,
    });
  }

  // wordEntries 검증
  if (!Array.isArray(snapshot.wordEntries)) {
    errors.push({
      field: 'wordEntries',
      message: 'wordEntries must be an array',
      value: snapshot.wordEntries,
    });
  } else {
    snapshot.wordEntries.forEach((entry: any, index: number) => {
      if (!isValidWordEntry(entry)) {
        errors.push({
          field: `wordEntries[${index}]`,
          message: 'Invalid word entry',
          value: entry,
        });
      }
    });
  }

  // reviewStates 검증
  if (!Array.isArray(snapshot.reviewStates)) {
    errors.push({
      field: 'reviewStates',
      message: 'reviewStates must be an array',
      value: snapshot.reviewStates,
    });
  } else {
    snapshot.reviewStates.forEach((state: any, index: number) => {
      if (!isValidReviewState(state)) {
        errors.push({
          field: `reviewStates[${index}]`,
          message: 'Invalid review state',
          value: state,
        });
      }
    });
  }

  // createdAt 검증
  if (!isValidTimestamp(snapshot.createdAt)) {
    errors.push({
      field: 'createdAt',
      message: 'Invalid timestamp',
      value: snapshot.createdAt,
    });
  }

  return errors;
}
