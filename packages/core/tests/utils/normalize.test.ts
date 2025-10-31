/**
 * normalize.ts 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeWord,
  normalizeContext,
  normalizeUrl,
  sanitizeHtml,
  generateWordId,
} from '../../src/utils/normalize';

describe('normalizeWord', () => {
  it('단어를 소문자로 변환해야 함', () => {
    expect(normalizeWord('Hello')).toBe('hello');
    expect(normalizeWord('WORLD')).toBe('world');
  });

  it('앞뒤 공백을 제거해야 함', () => {
    expect(normalizeWord('  test  ')).toBe('test');
  });

  it('특수문자를 제거해야 함', () => {
    expect(normalizeWord('hello!')).toBe('hello');
    expect(normalizeWord('test@word')).toBe('testword');
  });

  it('하이픈은 유지해야 함', () => {
    expect(normalizeWord('multi-word')).toBe('multi-word');
  });

  it('연속 공백을 하나로 변환해야 함', () => {
    expect(normalizeWord('hello   world')).toBe('hello world');
  });
});

describe('normalizeContext', () => {
  it('앞뒤 공백을 제거해야 함', () => {
    expect(normalizeContext('  This is a test  ')).toBe('This is a test');
  });

  it('연속 공백을 하나로 변환해야 함', () => {
    expect(normalizeContext('Hello    world')).toBe('Hello world');
  });

  it('개행을 공백으로 변환해야 함', () => {
    expect(normalizeContext('Hello\nworld')).toBe('Hello world');
    expect(normalizeContext('Hello\n\nworld')).toBe('Hello world');
  });
});

describe('normalizeUrl', () => {
  it('유효한 URL을 정규화해야 함', () => {
    const result = normalizeUrl('https://example.com/path/');
    expect(result).toBe('example.com/path');
  });

  it('쿼리 파라미터를 유지해야 함', () => {
    const result = normalizeUrl('https://example.com/path?query=test');
    expect(result).toBe('example.com/path?query=test');
  });

  it('잘못된 URL은 원본을 반환해야 함', () => {
    const invalidUrl = 'not-a-url';
    expect(normalizeUrl(invalidUrl)).toBe(invalidUrl);
  });
});

describe('sanitizeHtml', () => {
  it('HTML 태그를 제거해야 함', () => {
    expect(sanitizeHtml('<p>Hello</p>')).toBe('Hello');
    expect(sanitizeHtml('<b>Bold</b> text')).toBe('Bold text');
  });

  it('HTML 엔티티를 변환해야 함', () => {
    expect(sanitizeHtml('test&nbsp;word')).toBe('test word');
    expect(sanitizeHtml('&amp;')).toBe('&');
    expect(sanitizeHtml('&lt;test&gt;')).toBe('<test>');
  });

  it('앞뒤 공백을 제거해야 함', () => {
    expect(sanitizeHtml('  <p>test</p>  ')).toBe('test');
  });
});

describe('generateWordId', () => {
  it('단어와 URL로 ID를 생성해야 함', () => {
    const id = generateWordId('Test', 'https://example.com/path/');
    expect(id).toBe('test::example.com/path');
  });

  it('동일한 단어와 URL은 동일한 ID를 생성해야 함', () => {
    const id1 = generateWordId('Hello', 'https://example.com/');
    const id2 = generateWordId('HELLO', 'https://example.com');
    expect(id1).toBe(id2);
  });
});
