/**
 * Dexie.js IndexedDB 데이터베이스 설정
 */

import Dexie, { type Table } from 'dexie';
import type { WordEntry, ReviewState, AIAnalysisHistory } from '@catchvoca/types';

/**
 * CheckVocaDB - 메인 데이터베이스 클래스
 */
export class CheckVocaDB extends Dexie {
  // 테이블 선언
  wordEntries!: Table<WordEntry, string>;
  reviewStates!: Table<ReviewState, string>;
  analysisHistory!: Table<AIAnalysisHistory, string>;

  constructor() {
    super('CheckVocaDB');

    // 데이터베이스 버전 및 스키마 정의
    this.version(3).stores({
      // word_entries 테이블
      // &id: Primary Key (unique)
      // normalizedWord: 검색용 인덱스
      // url: 출처별 필터링
      // createdAt, updatedAt, lastViewedAt: 정렬용
      // *tags: 다중 값 인덱스 (배열)
      wordEntries: `
        &id,
        normalizedWord,
        url,
        createdAt,
        updatedAt,
        lastViewedAt,
        *tags
      `,

      // review_states 테이블
      // &id: Primary Key (unique)
      // wordId: Foreign Key (WordEntry 참조)
      // nextReviewAt: 복습 대기 단어 쿼리용
      reviewStates: `
        &id,
        wordId,
        nextReviewAt
      `,

      // analysis_history 테이블 (v3에서 추가)
      // &id: Primary Key (unique)
      // analyzedAt: 분석 시각 정렬용
      // pageUrl: URL별 필터링용
      analysisHistory: `
        &id,
        analyzedAt,
        pageUrl
      `,
    });
  }
}

// 싱글톤 인스턴스 생성
export const db = new CheckVocaDB();

// 개발 환경에서 디버깅을 위한 전역 노출
if (typeof window !== 'undefined') {
  (window as unknown as { db: CheckVocaDB }).db = db;
}
