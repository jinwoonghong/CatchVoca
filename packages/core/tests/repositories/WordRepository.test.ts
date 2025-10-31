/**
 * WordRepository 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WordRepository } from '../../src/repositories/WordRepository';
import { db } from '../../src/db/database';
import type { WordEntryCreateDTO } from '@catchvoca/types';

describe('WordRepository', () => {
  let repository: WordRepository;

  beforeEach(() => {
    repository = new WordRepository();
  });

  afterEach(async () => {
    // DB 삭제 대신 테이블만 클리어
    await db.wordEntries.clear();
    await db.reviewStates.clear();
  });

  const createMockData = (): WordEntryCreateDTO => ({
    word: 'test',
    context: 'This is a test sentence.',
    url: 'https://example.com/page',
    sourceTitle: 'Example Page',
    definitions: ['테스트', '시험'],
    language: 'en',
    tags: ['example', 'test'],
    isFavorite: false,
    selectionRange: null,
    contextSnapshot: null,
  });

  describe('create', () => {
    it('단어를 생성해야 함', async () => {
      const data = createMockData();
      const id = await repository.create(data);

      expect(id).toBeTruthy();
      expect(id).toContain('test::');

      const saved = await repository.findById(id);
      expect(saved).toBeDefined();
      expect(saved?.word).toBe('test');
      expect(saved?.normalizedWord).toBe('test');
      expect(saved?.definitions).toEqual(['테스트', '시험']);
    });

    it('중복된 단어를 거부해야 함', async () => {
      const data = createMockData();
      await repository.create(data);

      await expect(repository.create(data)).rejects.toThrow('Word already exists');
    });

    it('입력 검증을 수행해야 함', async () => {
      const data = createMockData();
      data.word = '';

      await expect(repository.create(data)).rejects.toThrow('Invalid word');
    });
  });

  describe('findByNormalizedWord', () => {
    it('정규화된 단어로 검색해야 함', async () => {
      const data = createMockData();
      data.word = 'Test';
      await repository.create(data);

      const results = await repository.findByNormalizedWord('test');
      expect(results).toHaveLength(1);
      expect(results[0]?.word).toBe('Test');
    });
  });

  describe('search', () => {
    it('단어로 검색해야 함', async () => {
      await repository.create({
        word: 'apple',
        context: 'I like apples.',
        url: 'https://example.com/1',
        sourceTitle: 'Fruits',
        definitions: ['사과'],
        tags: ['fruit'],
        language: 'en',
        isFavorite: false,
        selectionRange: null,
        contextSnapshot: null,
      });

      const results = await repository.search('apple');
      expect(results).toHaveLength(1);
      expect(results[0]?.word).toBe('apple');
    });

    it('빈 쿼리는 빈 배열을 반환해야 함', async () => {
      const results = await repository.search('');
      expect(results).toHaveLength(0);
    });
  });

  describe('count', () => {
    it('단어 수를 반환해야 함', async () => {
      expect(await repository.count()).toBe(0);

      const data = createMockData();
      await repository.create(data);
      expect(await repository.count()).toBe(1);
    });
  });

  describe('update', () => {
    it('단어를 업데이트해야 함', async () => {
      const data = createMockData();
      const id = await repository.create(data);

      await repository.update(id, {
        definitions: ['수정된 정의'],
        isFavorite: true,
      });

      const updated = await repository.findById(id);
      expect(updated?.definitions).toEqual(['수정된 정의']);
      expect(updated?.isFavorite).toBe(true);
    });
  });

  describe('incrementViewCount', () => {
    it('조회수를 증가시켜야 함', async () => {
      const data = createMockData();
      const id = await repository.create(data);

      await repository.incrementViewCount(id);

      const word = await repository.findById(id);
      expect(word?.viewCount).toBe(1);
      expect(word?.lastViewedAt).toBeTruthy();
    });
  });
});
