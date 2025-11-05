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
  VeryEasy = 5, // 매우 쉽게 기억
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
  viewCount?: number; // 조회 횟수 (기존 단어인 경우)
  isSaved?: boolean; // 이미 저장된 단어 여부
  wordId?: string; // 저장된 단어의 ID (isSaved가 true인 경우)
  reviewState?: {
    // 복습 상태 정보 (재학습 지원)
    lastReviewedAt?: number; // 마지막 복습일
    repetitions: number; // 복습 횟수
    easeFactor: number; // 숙련도
    nextReviewAt: number; // 다음 복습일
    isDue: boolean; // 복습 예정 여부
  };
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
// AI Analysis History Types
// ============================================================================

/**
 * AI 분석 이력 항목
 */
export interface AIAnalysisHistory {
  // === 식별자 ===
  id: string; // PK, format: "analysis::${timestamp}"

  // === 페이지 정보 ===
  pageUrl: string; // 분석한 페이지 URL
  pageTitle: string; // 페이지 제목

  // === 분석 결과 ===
  summary: string; // AI 요약
  difficulty: 'beginner' | 'intermediate' | 'advanced'; // 난이도
  recommendedWords: RecommendedWord[]; // 추천 단어 목록

  // === 타임스탬프 ===
  analyzedAt: number; // 분석 시각 (timestamp)

  // === 메타 정보 ===
  savedWordsCount: number; // 이 분석에서 저장한 단어 수 (초기값: 0)
}

// ============================================================================
// PDF Support Types
// ============================================================================

/**
 * PDF 페이지 정보
 */
export interface PDFPageInfo {
  pageNumber: number;
  totalPages: number;
  pdfUrl: string;
  pdfTitle: string;
}

/**
 * PDF 텍스트 선택 정보
 */
export interface PDFTextSelection {
  text: string;
  pageInfo: PDFPageInfo;
  boundingRect: DOMRect;
}

// ============================================================================
// Keyboard Shortcut Types
// ============================================================================

/**
 * 특수키 조합 설정
 */
export interface KeyboardShortcut {
  enabled: boolean;
  key: 'ctrl' | 'alt' | 'shift'; // 조합할 키
  requiresClick: boolean; // 클릭 필요 여부
}

/**
 * 키보드 단축키 설정
 */
export interface KeyboardSettings {
  quickLookup: KeyboardShortcut; // Ctrl/Alt + 클릭으로 즉시 조회
  quickSave: KeyboardShortcut; // Ctrl/Alt + 클릭으로 즉시 저장
  toggleLearnedHighlight: string; // 학습 단어 하이라이트 토글 (예: 'Shift', 'Alt', 'Control')
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

/**
 * AI 분석 일일 사용량 (Phase 2)
 */
export interface AIUsage {
  date: string; // 날짜 (YYYY-MM-DD 형식)
  count: number; // 사용 횟수
}

/**
 * AI 분석 사용량 제한 상수
 */
export const AI_USAGE_LIMITS = {
  FREE_DAILY_LIMIT: 3, // 무료 사용자 일일 한도
  PRO_DAILY_LIMIT: -1, // Pro 사용자 무제한 (-1)
} as const;

/**
 * Gemini API 분석 요청
 */
export interface GeminiAnalysisRequest {
  pageUrl: string; // 페이지 URL
  pageTitle: string; // 페이지 제목
  pageContent: string; // 페이지 본문 (최대 5000자)
  userWords: string[]; // 사용자가 이미 학습한 단어 목록
}

/**
 * Gemini API 분석 응답
 */
export interface GeminiAnalysisResponse {
  summary: string; // AI 요약 (500자 이내)
  recommendedWords: RecommendedWord[]; // 추천 단어 목록
  difficulty: 'beginner' | 'intermediate' | 'advanced'; // 난이도
}

/**
 * AI 추천 단어
 */
export interface RecommendedWord {
  word: string; // 단어
  normalizedWord: string; // 정규화된 단어
  importanceScore: number; // 중요도 점수 (0-100)
  reasons: string[]; // 추천 이유 목록
}

/**
 * 단어 중요도 점수 구성 요소
 */
export interface WordImportance {
  word: string;
  normalizedWord: string;
  cocaScore: number; // COCA 빈도 점수 (0-40)
  awlScore: number; // Academic Word List 점수 (0-30)
  testScore: number; // 토익/토플 점수 (0-20)
  contextScore: number; // Gemini 문맥 점수 (0-10, Pro만)
  totalScore: number; // 총점 (0-100)
}

/**
 * AI 하이라이트 타입
 */
export type HighlightType = 'learned' | 'recommended' | 'none';

/**
 * AI 하이라이트 설정
 */
export interface HighlightSettings {
  enabled: boolean; // 하이라이트 활성화
  learnedColor: string; // 학습 완료 색상 (기본: #4ade80)
  recommendedColor: string; // 추천 단어 색상 (기본: #fbbf24)
  showTooltip: boolean; // 툴팁 표시 여부
}

/**
 * 사용자 설정
 */
export interface Settings {
  // 일반 설정
  defaultLanguage: string; // 기본 언어 (en, ja, zh, ko 등)
  autoPlayAudio: boolean; // 발음 자동 재생 여부

  // 복습 설정
  dailyReviewLimit: number; // 일일 복습 목표 (기본: 20)
  reviewNotifications: boolean; // 복습 알림 활성화

  // 저장 설정
  autoAddToReview: boolean; // 저장 시 자동으로 복습 큐에 추가
  defaultTags: string[]; // 기본 태그 목록

  // UI 설정
  theme: 'light' | 'dark' | 'auto'; // 테마 설정
  compactMode: boolean; // 컴팩트 모드

  // AI 설정 (Phase 2-B)
  aiAnalysisEnabled: boolean; // AI 분석 활성화
  highlightSettings: HighlightSettings; // 하이라이트 설정
  geminiApiKey?: string; // Gemini API 키 (사용자 입력)
  disableAIUsageLimit: boolean; // AI 사용량 제한 해제 (개발/테스트용)

  // 편의 기능 설정 (Phase 2-C)
  pdfSupportEnabled: boolean; // PDF 지원 활성화
  keyboardSettings: KeyboardSettings; // 키보드 단축키 설정

  // 단어 읽기 모드 설정
  wordReadingMode: {
    webpage: 'drag' | 'ctrl-drag' | 'alt-drag' | 'ctrl-click' | 'alt-click'; // 웹페이지 단어 읽기 모드
    pdf: 'drag' | 'ctrl-drag' | 'alt-drag' | 'ctrl-click' | 'alt-click'; // PDF 단어 읽기 모드
  };
}

/**
 * 기본 설정 값
 */
export const DEFAULT_SETTINGS: Settings = {
  defaultLanguage: 'en',
  autoPlayAudio: false,
  dailyReviewLimit: 20,
  reviewNotifications: true,
  autoAddToReview: true,
  defaultTags: [],
  theme: 'light',
  compactMode: false,
  aiAnalysisEnabled: true,
  highlightSettings: {
    enabled: true,
    learnedColor: '#4ade80',
    recommendedColor: '#fbbf24',
    showTooltip: true,
  },
  geminiApiKey: undefined,
  disableAIUsageLimit: false,
  pdfSupportEnabled: true,
  keyboardSettings: {
    quickLookup: {
      enabled: true,
      key: 'ctrl',
      requiresClick: true,
    },
    quickSave: {
      enabled: true,
      key: 'alt',
      requiresClick: true,
    },
    toggleLearnedHighlight: 'Shift', // 기본: Shift 키
  },
  wordReadingMode: {
    webpage: 'ctrl-click', // 기본: Ctrl + 클릭
    pdf: 'ctrl-drag', // PDF는 Ctrl+드래그 (clipboard 기반)
  },
};

// ============================================================================
// Repository DTOs
// ============================================================================

/**
 * WordEntry 생성 DTO
 */
export type WordEntryCreateDTO = Omit<
  WordEntry,
  'id' | 'createdAt' | 'updatedAt' | 'normalizedWord' | 'manuallyEdited'
> & {
  word: string;
  context: string;
  url: string;
  sourceTitle: string;
};

/**
 * WordEntry 업데이트 DTO
 */
export type WordEntryUpdateDTO = Partial<
  Pick<
    WordEntry,
    | 'definitions'
    | 'phonetic'
    | 'audioUrl'
    | 'tags'
    | 'isFavorite'
    | 'note'
    | 'viewCount'
    | 'lastViewedAt'
    | 'deletedAt'
  >
>;

/**
 * ReviewState 생성 DTO
 */
export type ReviewStateCreateDTO = Omit<ReviewState, 'id'>;

/**
 * ReviewState 업데이트 DTO
 */
export type ReviewStateUpdateDTO = Partial<
  Pick<ReviewState, 'nextReviewAt' | 'interval' | 'easeFactor' | 'repetitions' | 'history'>
>;
