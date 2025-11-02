/**
 * validation.ts 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  isValidWord,
  isValidContext,
  isValidUrl,
  isValidTags,
  isValidLanguageCode,
  isValidTimestamp,
  WORD_CONSTRAINTS,
  CONTEXT_CONSTRAINTS,
  TAG_CONSTRAINTS,
} from '../../src/utils/validation';

describe('isValidWord', () => {
  it('유효한 단어를 통과시켜야 함', () => {
    expect(isValidWord('test')).toBe(true);
    expect(isValidWord('hello world')).toBe(true);
  });

  it('빈 문자열을 거부해야 함', () => {
    expect(isValidWord('')).toBe(false);
    expect(isValidWord('   ')).toBe(false);
  });

  it('너무 긴 단어를 거부해야 함', () => {
    const longWord = 'a'.repeat(WORD_CONSTRAINTS.MAX_LENGTH + 1);
    expect(isValidWord(longWord)).toBe(false);
  });

  it('null/undefined를 거부해야 함', () => {
    expect(isValidWord(null as any)).toBe(false);
    expect(isValidWord(undefined as any)).toBe(false);
  });
});

describe('isValidContext', () => {
  it('유효한 문맥을 통과시켜야 함', () => {
    expect(isValidContext('This is a context.')).toBe(true);
  });

  it('빈 문자열을 거부해야 함', () => {
    expect(isValidContext('')).toBe(false);
    expect(isValidContext('   ')).toBe(false);
  });

  it('너무 긴 문맥을 거부해야 함', () => {
    const longContext = 'a'.repeat(CONTEXT_CONSTRAINTS.MAX_LENGTH + 1);
    expect(isValidContext(longContext)).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('유효한 URL을 통과시켜야 함', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://test.com/path')).toBe(true);
  });

  it('잘못된 URL을 거부해야 함', () => {
    expect(isValidUrl('not-a-url')).toBe(false);
    expect(isValidUrl('example.com')).toBe(false); // 프로토콜 누락
  });

  it('빈 문자열을 허용해야 함 (수동 입력의 경우)', () => {
    expect(isValidUrl('')).toBe(true);
  });
});

describe('isValidTags', () => {
  it('유효한 태그 배열을 통과시켜야 함', () => {
    expect(isValidTags(['tag1', 'tag2'])).toBe(true);
    expect(isValidTags([])).toBe(true); // 빈 배열도 허용
  });

  it('너무 많은 태그를 거부해야 함', () => {
    const manyTags = Array(TAG_CONSTRAINTS.MAX_COUNT + 1).fill('tag');
    expect(isValidTags(manyTags)).toBe(false);
  });

  it('너무 긴 태그를 거부해야 함', () => {
    const longTag = 'a'.repeat(TAG_CONSTRAINTS.MAX_LENGTH + 1);
    expect(isValidTags([longTag])).toBe(false);
  });

  it('빈 태그를 거부해야 함', () => {
    expect(isValidTags(['', 'valid'])).toBe(false);
    expect(isValidTags(['   '])).toBe(false);
  });

  it('배열이 아닌 것을 거부해야 함', () => {
    expect(isValidTags('not-array' as any)).toBe(false);
  });
});

describe('isValidLanguageCode', () => {
  it('지원 언어 코드를 통과시켜야 함', () => {
    expect(isValidLanguageCode('en')).toBe(true);
    expect(isValidLanguageCode('ko')).toBe(true);
    expect(isValidLanguageCode('ja')).toBe(true);
  });

  it('지원하지 않는 언어 코드를 거부해야 함', () => {
    expect(isValidLanguageCode('xx')).toBe(false);
    expect(isValidLanguageCode('EN')).toBe(false); // 대문자 거부
  });
});

describe('isValidTimestamp', () => {
  it('유효한 타임스탬프를 통과시켜야 함', () => {
    const now = Date.now();
    expect(isValidTimestamp(now)).toBe(true);
    expect(isValidTimestamp(now - 1000 * 60 * 60)).toBe(true); // 1시간 전
  });

  it('음수 타임스탬프를 거부해야 함', () => {
    expect(isValidTimestamp(-1)).toBe(false);
    expect(isValidTimestamp(0)).toBe(false);
  });

  it('미래 너무 먼 타임스탬프를 거부해야 함', () => {
    const farFuture = Date.now() + 1000 * 60 * 60 * 24 * 365 * 20; // 20년 후
    expect(isValidTimestamp(farFuture)).toBe(false);
  });
});
