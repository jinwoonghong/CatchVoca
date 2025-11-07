/**
 * Dexie 데이터베이스 테스트
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CheckVocaDB } from '../../src/db/database';
import type { WordEntry, ReviewState } from '@catchvoca/types';

describe('CheckVocaDB', () => {
  let db: CheckVocaDB;

  beforeEach(() => {
    db = new CheckVocaDB();
  });

  afterEach(async () => {
    await db.delete();
  });

  describe('데이터베이스 생성', () => {
    it('데이터베이스가 정상적으로 생성되어야 함', () => {
      expect(db).toBeDefined();
      expect(db.name).toBe('CheckVocaDB');
      expect(db.verno).toBe(3); // v3: analysisHistory 테이블 추가
    });

    it('wordEntries 테이블이 존재해야 함', () => {
      expect(db.wordEntries).toBeDefined();
      expect(db.wordEntries.schema.name).toBe('wordEntries');
    });

    it('reviewStates 테이블이 존재해야 함', () => {
      expect(db.reviewStates).toBeDefined();
      expect(db.reviewStates.schema.name).toBe('reviewStates');
    });
  });

  describe('인덱스 확인', () => {
    it('wordEntries의 id가 Primary Key여야 함', () => {
      const schema = db.wordEntries.schema;
      expect(schema.primKey.name).toBe('id');
      expect(schema.primKey.keyPath).toBe('id');
    });

    it('wordEntries에 필요한 인덱스가 모두 있어야 함', () => {
      const schema = db.wordEntries.schema;
      const indexNames = schema.indexes.map(idx => idx.name);

      expect(indexNames).toContain('normalizedWord');
      expect(indexNames).toContain('url');
      expect(indexNames).toContain('createdAt');
      expect(indexNames).toContain('updatedAt');
      expect(indexNames).toContain('lastViewedAt');
      expect(indexNames).toContain('tags');
    });

    it('tags 인덱스는 multi-entry여야 함', () => {
      const schema = db.wordEntries.schema;
      const tagsIndex = schema.indexes.find(idx => idx.name === 'tags');

      expect(tagsIndex).toBeDefined();
      expect(tagsIndex?.multi).toBe(true);
    });

    it('reviewStates에 필요한 인덱스가 모두 있어야 함', () => {
      const schema = db.reviewStates.schema;
      const indexNames = schema.indexes.map(idx => idx.name);

      expect(indexNames).toContain('wordId');
      expect(indexNames).toContain('nextReviewAt');
    });
  });

  describe('CRUD 기본 동작', () => {
    const mockWordEntry: WordEntry = {
      id: 'test::https://example.com',
      word: 'test',
      normalizedWord: 'test',
      definitions: ['테스트'],
      language: 'en',
      context: 'This is a test.',
      url: 'https://example.com',
      sourceTitle: 'Example',
      selectionRange: null,
      contextSnapshot: null,
      tags: ['test', 'example'],
      isFavorite: false,
      manuallyEdited: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('WordEntry를 추가할 수 있어야 함', async () => {
      const id = await db.wordEntries.add(mockWordEntry);
      expect(id).toBe(mockWordEntry.id);

      const saved = await db.wordEntries.get(id);
      expect(saved).toBeDefined();
      expect(saved?.word).toBe('test');
    });

    it('WordEntry를 조회할 수 있어야 함', async () => {
      await db.wordEntries.add(mockWordEntry);

      const word = await db.wordEntries.get(mockWordEntry.id);
      expect(word).toBeDefined();
      expect(word?.normalizedWord).toBe('test');
    });

    it('WordEntry를 수정할 수 있어야 함', async () => {
      await db.wordEntries.add(mockWordEntry);

      const updatedAt = Date.now();
      await db.wordEntries.update(mockWordEntry.id, {
        definitions: ['수정된 테스트'],
        updatedAt,
      });

      const updated = await db.wordEntries.get(mockWordEntry.id);
      expect(updated?.definitions).toEqual(['수정된 테스트']);
      expect(updated?.updatedAt).toBe(updatedAt);
    });

    it('WordEntry를 삭제할 수 있어야 함', async () => {
      await db.wordEntries.add(mockWordEntry);
      await db.wordEntries.delete(mockWordEntry.id);

      const deleted = await db.wordEntries.get(mockWordEntry.id);
      expect(deleted).toBeUndefined();
    });
  });

  describe('인덱스 쿼리', () => {
    beforeEach(async () => {
      // 테스트 데이터 추가
      await db.wordEntries.bulkAdd([
        {
          id: 'apple::url1',
          word: 'apple',
          normalizedWord: 'apple',
          language: 'en',
          context: 'I like apples.',
          url: 'url1',
          sourceTitle: 'Test1',
          selectionRange: null,
          contextSnapshot: null,
          tags: ['fruit', 'food'],
          isFavorite: false,
          manuallyEdited: false,
          createdAt: 1000,
          updatedAt: 1000,
        },
        {
          id: 'banana::url2',
          word: 'banana',
          normalizedWord: 'banana',
          language: 'en',
          context: 'Yellow banana.',
          url: 'url2',
          sourceTitle: 'Test2',
          selectionRange: null,
          contextSnapshot: null,
          tags: ['fruit'],
          isFavorite: true,
          manuallyEdited: false,
          createdAt: 2000,
          updatedAt: 2000,
        },
        {
          id: 'cherry::url3',
          word: 'cherry',
          normalizedWord: 'cherry',
          language: 'en',
          context: 'Red cherry.',
          url: 'url3',
          sourceTitle: 'Test3',
          selectionRange: null,
          contextSnapshot: null,
          tags: ['fruit', 'red'],
          isFavorite: false,
          manuallyEdited: false,
          createdAt: 3000,
          updatedAt: 3000,
        },
      ]);
    });

    it('normalizedWord로 검색할 수 있어야 함', async () => {
      const results = await db.wordEntries.where('normalizedWord').equals('apple').toArray();
      expect(results).toHaveLength(1);
      expect(results[0]?.word).toBe('apple');
    });

    it('tags로 필터링할 수 있어야 함', async () => {
      const results = await db.wordEntries.where('tags').equals('fruit').toArray();
      expect(results).toHaveLength(3);
    });

    it('createdAt으로 정렬할 수 있어야 함', async () => {
      const results = await db.wordEntries.orderBy('createdAt').toArray();
      expect(results).toHaveLength(3);
      expect(results[0]?.word).toBe('apple');
      expect(results[2]?.word).toBe('cherry');
    });

    it('역순 정렬이 가능해야 함', async () => {
      const results = await db.wordEntries.orderBy('createdAt').reverse().toArray();
      expect(results[0]?.word).toBe('cherry');
      expect(results[2]?.word).toBe('apple');
    });
  });

  describe('ReviewState 테스트', () => {
    const mockReviewState: ReviewState = {
      id: 'review-1',
      wordId: 'test::https://example.com',
      nextReviewAt: Date.now() + 86400000, // 내일
      interval: 1,
      easeFactor: 2.5,
      repetitions: 0,
      history: [],
    };

    it('ReviewState를 추가할 수 있어야 함', async () => {
      const id = await db.reviewStates.add(mockReviewState);
      expect(id).toBe(mockReviewState.id);

      const saved = await db.reviewStates.get(id);
      expect(saved).toBeDefined();
      expect(saved?.wordId).toBe(mockReviewState.wordId);
    });

    it('nextReviewAt으로 복습 대기 단어를 조회할 수 있어야 함', async () => {
      const now = Date.now();

      await db.reviewStates.bulkAdd([
        { ...mockReviewState, id: 'r1', nextReviewAt: now - 1000 }, // 과거 (대기중)
        { ...mockReviewState, id: 'r2', nextReviewAt: now + 1000 }, // 미래
        { ...mockReviewState, id: 'r3', nextReviewAt: now - 2000 }, // 과거 (대기중)
      ]);

      const dueReviews = await db.reviewStates
        .where('nextReviewAt')
        .belowOrEqual(now)
        .toArray();

      expect(dueReviews).toHaveLength(2);
    });
  });
});
