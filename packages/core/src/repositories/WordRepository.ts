/**
 * WordRepository - 단어 데이터 관리
 */

import type { WordEntry, WordEntryCreateDTO, WordEntryUpdateDTO } from '@catchvoca/types';
import { BaseRepository } from './BaseRepository';
import { db } from '../db/database';
import {
  normalizeWord,
  normalizeContext,
  generateWordId,
  sanitizeHtml,
} from '../utils/normalize';
import {
  isValidWord,
  isValidContext,
  isValidUrl,
  isValidTags,
  isValidLanguageCode,
} from '../utils/validation';

export class WordRepository extends BaseRepository<
  WordEntry,
  WordEntryCreateDTO,
  WordEntryUpdateDTO
> {
  constructor() {
    super(db.wordEntries);
  }

  /**
   * 단어 생성
   */
  async create(data: WordEntryCreateDTO): Promise<string> {
    // 입력 검증
    this.validateCreateData(data);

    // 정규화
    const normalizedWord = normalizeWord(data.word);
    const normalizedContext = normalizeContext(data.context);
    const id = generateWordId(data.word, data.url);

    // 중복 체크
    const exists = await this.exists(id);
    if (exists) {
      throw new Error(`Word already exists: ${data.word} at ${data.url}`);
    }

    // WordEntry 생성
    const now = Date.now();
    const wordEntry: WordEntry = {
      id,
      word: data.word.trim(),
      normalizedWord,
      definitions: data.definitions?.map((d) => sanitizeHtml(d)) || [],
      phonetic: data.phonetic,
      audioUrl: data.audioUrl,
      language: data.language || 'en',
      context: normalizedContext,
      contextSnapshot: data.contextSnapshot || null,
      url: data.url,
      sourceTitle: data.sourceTitle.trim(),
      selectionRange: data.selectionRange || null,
      tags: data.tags || [],
      isFavorite: data.isFavorite || false,
      note: data.note,
      manuallyEdited: false,
      viewCount: 0,
      lastViewedAt: undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: undefined,
    };

    await this.table.add(wordEntry);
    return id;
  }

  /**
   * 정규화된 단어로 검색
   */
  async findByNormalizedWord(word: string): Promise<WordEntry[]> {
    const normalized = normalizeWord(word);
    return await this.table.where('normalizedWord').equals(normalized).toArray();
  }

  /**
   * URL로 단어 검색
   */
  async findByUrl(url: string): Promise<WordEntry[]> {
    return await this.table.where('url').equals(url).toArray();
  }

  /**
   * 태그로 필터링
   */
  async findByTag(tag: string): Promise<WordEntry[]> {
    return await this.table.where('tags').equals(tag).toArray();
  }

  /**
   * 즐겨찾기 단어 조회
   */
  async findFavorites(): Promise<WordEntry[]> {
    return await this.table.filter((entry) => entry.isFavorite === true).toArray();
  }

  /**
   * 단어 검색 (단어, 정의, 문맥에서 검색)
   */
  async search(query: string): Promise<WordEntry[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerm = query.toLowerCase().trim();

    return await this.table
      .filter((entry) => {
        // Soft delete된 항목 제외
        if (entry.deletedAt) {
          return false;
        }

        // 단어 검색
        if (entry.normalizedWord.includes(searchTerm)) {
          return true;
        }

        // 정의 검색
        if (entry.definitions?.some((def) => def.toLowerCase().includes(searchTerm))) {
          return true;
        }

        // 문맥 검색
        if (entry.context.toLowerCase().includes(searchTerm)) {
          return true;
        }

        // 태그 검색
        if (entry.tags.some((tag) => tag.toLowerCase().includes(searchTerm))) {
          return true;
        }

        return false;
      })
      .toArray();
  }

  /**
   * 최근 추가된 단어 조회
   */
  async findRecent(limit: number = 20): Promise<WordEntry[]> {
    return await this.table
      .orderBy('createdAt')
      .reverse()
      .filter((entry) => !entry.deletedAt)
      .limit(limit)
      .toArray();
  }

  /**
   * 단어 수 조회
   */
  async count(): Promise<number> {
    return await this.table.filter((entry) => !entry.deletedAt).count();
  }

  /**
   * 단어 업데이트 (updatedAt 자동 갱신)
   */
  override async update(id: string, changes: WordEntryUpdateDTO): Promise<void> {
    const updatedChanges = {
      ...changes,
      updatedAt: Date.now(),
    };

    await super.update(id, updatedChanges);
  }

  /**
   * Soft delete (deletedAt 설정)
   */
  async softDelete(id: string): Promise<void> {
    await this.update(id, {
      // @ts-expect-error - deletedAt is not in UpdateDTO but exists in WordEntry
      deletedAt: Date.now(),
    });
  }

  /**
   * 조회수 증가
   */
  async incrementViewCount(id: string): Promise<void> {
    const word = await this.findById(id);
    if (!word) {
      throw new Error(`Word not found: ${id}`);
    }

    await this.update(id, {
      viewCount: (word.viewCount || 0) + 1,
      lastViewedAt: Date.now(),
    });
  }

  /**
   * 입력 데이터 검증
   */
  private validateCreateData(data: WordEntryCreateDTO): void {
    if (!isValidWord(data.word)) {
      throw new Error('Invalid word: must be 1-50 characters');
    }

    if (!isValidContext(data.context)) {
      throw new Error('Invalid context: must be 1-500 characters');
    }

    if (!isValidUrl(data.url)) {
      throw new Error('Invalid URL');
    }

    if (data.tags && !isValidTags(data.tags)) {
      throw new Error('Invalid tags: maximum 10 tags, each up to 20 characters');
    }

    if (data.language && !isValidLanguageCode(data.language)) {
      throw new Error('Invalid language code');
    }
  }
}

// 싱글톤 인스턴스 export
export const wordRepository = new WordRepository();
