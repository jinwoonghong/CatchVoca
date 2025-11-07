/**
 * @catchvoca/core - 공개 API
 */

// Database
export { CheckVocaDB } from './db/database';
// db는 Dexie를 즉시 로드하므로 background service worker와 호환되지 않음
// 필요한 경우 './db/database'에서 직접 import하세요

// Repositories
export { BaseRepository } from './repositories/BaseRepository';
export { WordRepository, createWordRepository } from './repositories/WordRepository';
export {
  ReviewStateRepository,
  createReviewStateRepository,
} from './repositories/ReviewStateRepository';
export * as AIAnalysisHistoryRepository from './repositories/AIAnalysisHistoryRepository';

// Utils
export {
  normalizeWord,
  normalizeContext,
  normalizeUrl,
  decodeHtmlEntities,
  sanitizeHtml,
  generateWordId,
} from './utils/normalize';

export {
  isValidWord,
  isValidContext,
  isValidUrl,
  isValidTags,
  isValidLanguageCode,
  isValidTimestamp,
  isValidWordEntry,
  isValidReviewState,
  isValidSnapshot,
  validateSnapshotDetailed,
  WORD_CONSTRAINTS,
  CONTEXT_CONSTRAINTS,
  TAG_CONSTRAINTS,
} from './utils/validation';
export type { ValidationError } from './utils/validation';

export { logger, Logger, LogLevel } from './utils/logger';

export {
  CatchVocaError,
  NetworkError,
  ValidationError as ValidationException,
  DatabaseError,
  withRetry,
  isErrorType,
  getErrorMessage,
  getErrorContext,
} from './utils/errors';
export type { RetryConfig } from './utils/errors';

// Services - SM-2 Algorithm
export {
  calculateNextReview,
  createInitialReviewState,
  intervalToDays,
  daysToInterval,
  isOverdue,
  timeUntilReview,
  DEFAULT_SM2_CONFIG,
} from './services/sm2/algorithm';
export type { SM2Result, SM2Config } from './services/sm2/algorithm';

// Services - EventBus
export { EventBus, eventBus } from './services/events/EventBus';
export type { EventHandler, EventMessage } from './services/events/EventBus';
