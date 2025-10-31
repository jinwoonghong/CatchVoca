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
  sanitizeHtml,
  generateWordId,
} from './utils/normalize';

export {
  isValidWord,
  isValidContext,
  isValidUrl,
  isValidTags,
  isValidLanguageCode,
  WORD_CONSTRAINTS,
  CONTEXT_CONSTRAINTS,
  TAG_CONSTRAINTS,
} from './utils/validation';

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
