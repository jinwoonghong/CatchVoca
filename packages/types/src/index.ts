/**
 * CatchVoca - Shared TypeScript Types
 * 모든 패키지에서 공유되는 타입 정의
 */

// ============================================================================
// Word Entry (단어 정보)
// ============================================================================

/**
 * 선택 범위 정보 (미래 기능을 위한 확장)
 */
export interface SelectionRangeSnapshot {
  startOffset: number;
  endOffset: number;
  selectedText: string;
}

/**
 * 문맥 스냅샷
 */
export interface ContextSnapshot {
  sentences: string[]; // 전후 문장 배열
  selectedSentenceIndex: number; // 선택된 문장 인덱스
  rawText: string; // 원본 텍스트
}

/**
 * WordEntry - 단어의 모든 정보를 저장
 */
export interface WordEntry {
  // === 식별자 ===
  id: string; // PK, format: "${normalizedWord}::${url}"

  // === 단어 정보 ===
  word: string; // 원문
  normalizedWord: string; // 소문자 정규화
  definitions?: string[]; // 정의 목록
  phonetic?: string; // 발음기호
  audioUrl?: string; // 발음 오디오 URL
  language: string; // 언어 코드 (en, ja, zh, etc.)

  // === 문맥 정보 ===
  context: string; // 선택된 문장
  contextSnapshot: ContextSnapshot | null; // 상세 문맥 (선택사항)
  url: string; // 출처 URL
  sourceTitle: string; // 페이지 제목
  selectionRange: SelectionRangeSnapshot | null; // 선택 위치 (선택사항)

  // === 메타데이터 ===
  tags: string[]; // 태그 배열
  isFavorite: boolean; // 즐겨찾기 여부
  note?: string; // 사용자 메모
  manuallyEdited: boolean; // 수동 편집 여부

  // === 학습 통계 ===
  viewCount?: number; // 조회 횟수
  lastViewedAt?: number; // 마지막 조회 시각 (timestamp)

  // === 타임스탬프 ===
  createdAt: number; // 생성 시각 (timestamp)
  updatedAt: number; // 수정 시각 (timestamp)
  deletedAt?: number; // 삭제 시각 (tombstone, soft delete)
}

/**
 * WordEntry 생성을 위한 입력 타입
 */
export interface WordEntryInput {
  word: string;
  context: string;
  url: string;
  sourceTitle: string;
  definitions?: string[];
  phonetic?: string;
  audioUrl?: string;
  language?: string;
  tags?: string[];
}

// ============================================================================
// Review State (SM-2 상태)
// ============================================================================

/**
 * 복습 히스토리 로그
 */
export interface ReviewLog {
  reviewedAt: number; // 복습 시각 (timestamp)
  rating: number; // 평가 (1-4)
  interval: number; // 당시 간격 (일)
}

/**
 * ReviewState - SM-2 알고리즘 상태
 */
export interface ReviewState {
  // === 식별자 ===
  id: string; // PK
  wordId: string; // FK → WordEntry.id

  // === SM-2 알고리즘 상태 ===
  nextReviewAt: number; // 다음 복습 시각 (timestamp)
  interval: number; // 복습 간격 (일 단위)
  easeFactor: number; // 난이도 계수 (1.3 ~ 2.5)
  repetitions: number; // 성공 반복 횟수

  // === 히스토리 ===
  history: ReviewLog[]; // 복습 히스토리
}

/**
 * SM-2 평가 등급
 */
export enum Rating {
  Again = 1, // 완전히 못 외움
  Hard = 2, // 어렵게 기억
  Good = 3, // 보통
  Easy = 4, // 쉽게 기억
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * 사전 API 조회 결과
 */
export interface LookupResult {
  definitions: string[]; // 정의 목록
  phonetic?: string; // 발음기호
  audioUrl?: string; // 발음 오디오 URL
}

/**
 * 네이버 사전 API 응답 (일부)
 */
export interface NaverWordItem {
  stems?: { match?: string }[];
  meansCollector?: {
    means?: { value?: string }[];
  }[];
  phoneticSymbol?: string;
  pronSymbol?: string;
}

export interface NaverResponse {
  searchResultMap?: {
    searchResultListMap?: {
      WORD?: { items?: NaverWordItem[] };
    };
  };
}

/**
 * Dictionary API 응답 (일부)
 */
export interface DictEntry {
  phonetic?: string;
  phonetics?: { text?: string; audio?: string }[];
  meanings?: {
    partOfSpeech?: string;
    definitions?: { definition?: string; example?: string }[];
  }[];
}

// ============================================================================
// Snapshot (모바일 퀴즈용)
// ============================================================================

/**
 * Snapshot - Google Apps Script로 전송하는 데이터
 */
export interface Snapshot {
  snapshotVersion: number; // 스냅샷 버전 (호환성 관리)
  wordEntries: WordEntry[]; // 단어 목록
  reviewStates: ReviewState[]; // 복습 상태 목록
  createdAt: number; // 생성 시각 (timestamp)
}

/**
 * Apps Script API 응답
 */
export interface AppsScriptResponse {
  success: boolean;
  data?: {
    mobileUrl: string; // 모바일 퀴즈 URL
    snapshotId: string; // 스냅샷 ID
    wordCount: number; // 단어 개수
  };
  error?: string;
}

// ============================================================================
// Event Bus Types
// ============================================================================

/**
 * BroadcastChannel 이벤트 타입
 */
export type EventType =
  | 'word:created'
  | 'word:updated'
  | 'word:deleted'
  | 'review:completed'
  | 'sync:completed';

/**
 * BroadcastChannel 이벤트 페이로드
 */
export interface BroadcastEvent {
  type: EventType;
  payload: unknown;
  timestamp: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * 페이지네이션 옵션
 */
export interface PaginationOptions {
  offset?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'normalizedWord' | 'viewCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 필터 옵션
 */
export interface FilterOptions {
  tags?: string[]; // 태그로 필터링
  language?: string; // 언어로 필터링
  isFavorite?: boolean; // 즐겨찾기만
  fromDate?: number; // 시작 날짜
  toDate?: number; // 종료 날짜
}

/**
 * Pro 사용자 상태
 */
export interface ProStatus {
  active: boolean;
  expiresAt?: number; // 만료 시각
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}
