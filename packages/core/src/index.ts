/**
 * @catchvoca/core - 공개 API
 */

// Database
export { db, CheckVocaDB } from './db/database';

// Repositories
export { BaseRepository } from './repositories/BaseRepository';
export { WordRepository, wordRepository } from './repositories/WordRepository';
export {
  ReviewStateRepository,
  reviewStateRepository,
} from './repositories/ReviewStateRepository';

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
