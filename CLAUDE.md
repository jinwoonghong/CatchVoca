# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CatchVoca** is a Local-First vocabulary learning Chrome extension that automatically collects words during web browsing and uses the SM-2 spaced repetition algorithm for effective memorization.

**Core Philosophy**: Local-First architecture with IndexedDB as the single source of truth, enabling full offline functionality and complete user data privacy.

**Current Status**: ✅ Week 1-2 Core Package Complete (113/113 tests passing) → ⏳ Week 3-4 Chrome Extension Development Next

## Technology Stack

**Frontend**: React 18, TypeScript 5, Vite 5, TailwindCSS 3
**State Management**: Zustand 4
**Database**: Dexie.js 3.2+ (IndexedDB wrapper)
**Testing**: Vitest 1.2+ with fake-indexeddb, Playwright (planned)
**Extension**: Chrome Manifest V3
**Package Manager**: pnpm 8+ (monorepo workspace)
**External APIs**:
- Naver Dictionary API (primary): `https://en.dict.naver.com/api3/enko/search`
- Free Dictionary API (fallback): `https://api.dictionaryapi.dev`
- Google Apps Script (mobile quiz, Pro feature)

## Development Commands

### Testing
```bash
# Run all tests (113/113 currently passing)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests for core package only
pnpm test:core

# Run tests with UI
pnpm --filter @catchvoca/core test:ui

# Run specific test file
pnpm --filter @catchvoca/core test -- algorithm.test.ts

# Run tests matching pattern
pnpm --filter @catchvoca/core test -- -t "SM-2"
```

### Building
```bash
# Build all packages
pnpm build

# Build core package only
pnpm build:core

# Build extension only (planned Week 3-4)
pnpm build:extension
```

### Code Quality
```bash
# Type checking across all packages
pnpm typecheck

# Lint all packages
pnpm lint

# Lint and auto-fix
pnpm lint:fix

# Clean build artifacts and node_modules
pnpm clean
```

## Architecture

### Monorepo Structure (pnpm workspace)

```
CatchVoca/
├── packages/
│   ├── types/         # Shared TypeScript type definitions
│   ├── core/          # Core business logic (Dexie, SM-2, EventBus)
│   └── extension/     # Chrome Extension UI (planned Week 3-4)
├── docs/              # Project documentation
└── scripts/           # Build scripts
```

**Package Dependencies**:
- `@catchvoca/types`: Shared by both core and extension
- `@catchvoca/core`: Used by extension
- All type imports use `import type { } from '@catchvoca/types'`

### Core Package Architecture

**Layer 1: Database (Dexie.js)**
- `db/database.ts`: CheckVocaDB class with two tables
  - `wordEntries`: Stores word information (indexed: normalizedWord, url, tags, timestamps)
  - `reviewStates`: Stores SM-2 algorithm state (indexed: wordId, nextReviewAt)
- **Pattern**: Singleton instance exported as `db`
- **Version**: Schema v2 with migration support

**Layer 2: Repository Pattern**
- `repositories/BaseRepository.ts`: Abstract base class with common CRUD operations
- `repositories/WordRepository.ts`: Word-specific operations
  - `create()`, `findById()`, `findByNormalizedWord()`, `search()`, `update()`, `delete()`
  - Features: Pagination, soft delete (tombstone), cascade delete ReviewState
- `repositories/ReviewStateRepository.ts`: Review state management
  - `create()`, `findByWordId()`, `findDueReviews()`, `update()`, `delete()`
  - Optimized query for due reviews: `where('nextReviewAt').below(Date.now())`

**Layer 3: Business Logic**
- `services/sm2/algorithm.ts`: SuperMemo 2 spaced repetition algorithm
  - `calculateNextReview(state, rating)`: Core SM-2 calculation (pure function)
  - `createInitialReviewState(wordId)`: Initialize new review state
  - Rating enum: Again(1), Hard(2), Good(3), Easy(4), VeryEasy(5)
- `services/events/EventBus.ts`: BroadcastChannel wrapper
  - Real-time cross-tab synchronization
  - Event types: 'word:created', 'word:updated', 'word:deleted', 'review:completed', 'sync:completed'
  - Self-message filtering via unique senderId

**Layer 4: Utilities**
- `utils/normalize.ts`: Text normalization (word, context, URL, HTML sanitization)
- `utils/validation.ts`: Input validation (word 1-50 chars, context max 500, URL format)

### Data Models (packages/types/src/index.ts)

**WordEntry**: Stores all word information
- ID format: `${normalizedWord}::${url}` (enables duplicate detection and re-learning)
- Fields: word, normalizedWord, definitions[], phonetic, audioUrl, language, context, url, sourceTitle, tags[], isFavorite, note, viewCount, lastViewedAt, createdAt, updatedAt, deletedAt

**ReviewState**: SM-2 algorithm state
- Fields: id, wordId (FK), nextReviewAt, interval, easeFactor, repetitions, history[]
- Lifecycle: Created on first word save, updated after each quiz review

**EventType**: String literal union
- Values: 'word:created' | 'word:updated' | 'word:deleted' | 'review:completed' | 'sync:completed'

### SM-2 Algorithm Implementation Details

**Formula**: `easeFactor = easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))`

**Interval Calculation**:
- First review: Always 1 day
- Second review: Always 6 days
- Third+ review: `Math.round(interval * easeFactor)`
- On failure (rating < 3): Reset repetitions=0, interval=1

**Bounds**: easeFactor min=1.3, max=2.5

**Test Coverage**: 100% - validates all edge cases (consecutive failures, consecutive successes, easeFactor bounds)

### EventBus Self-Message Filtering

Each EventBus instance generates a unique `senderId` on construction using `crypto.randomUUID().substring(0, 8)`. When emitting events, the senderId is included in the message. On receiving messages, instances check `if (message.senderId === this.senderId)` and return early to prevent infinite loops.

### Repository Cascade Delete Pattern

When deleting a WordEntry via `WordRepository.delete(id)`:
1. Check if ReviewState exists for this wordId: `await reviewStateRepository.findByWordId(id)`
2. If exists, delete ReviewState first: `await reviewStateRepository.delete(reviewState.id)`
3. Then delete WordEntry: `await this.table.delete(id)`

This ensures no orphaned ReviewState records remain in the database.

## Testing Strategy

### Test Environment
- **Framework**: Vitest 1.2+ with fake-indexeddb 5.0+
- **DOM**: jsdom 27.1+ for browser API simulation
- **Coverage**: 100% requirement for core package
- **Current Status**: 113/113 tests passing

### Test Structure
Tests mirror source structure: `packages/core/tests/` matches `packages/core/src/`

**Example**:
- Source: `src/services/sm2/algorithm.ts`
- Tests: `tests/services/sm2/algorithm.test.ts`

### MockBroadcastChannel Pattern
EventBus tests use a custom MockBroadcastChannel class that simulates multi-tab communication:
```typescript
class MockBroadcastChannel {
  private static channels: Map<string, MockBroadcastChannel[]> = new Map();

  postMessage(message: unknown): void {
    // Send to all other instances with same channel name
    channels.forEach(channel => {
      if (channel !== this && channel.onmessage) {
        setTimeout(() => channel.onmessage(new MessageEvent('message', { data: message })), 0);
      }
    });
  }
}
```

### Critical Test Scenarios
1. **SM-2 Algorithm**: First review (1 day), second review (6 days), third+ review (interval * easeFactor), failure resets, easeFactor bounds
2. **Repository CRUD**: Create with auto-generated fields, update with validation, soft delete (tombstone), cascade delete
3. **EventBus**: Cross-instance messaging, self-message filtering, error isolation (one handler error doesn't break others)
4. **Normalization**: Word lowercasing, whitespace trimming, HTML tag stripping, URL sanitization

## Documentation Reference

**Primary Development Guide**: [DEV_PLAN.md](./DEV_PLAN.md)
- Detailed implementation specifications
- Week-by-week development plan with completion criteria
- API integration details (Naver Dictionary, Dictionary API)
- Complete data schemas and code examples

**Progress Tracking**: [PROGRESS.md](./PROGRESS.md)
- Current status: Week 1-2 complete (113/113 tests), Week 3-4 next
- Detailed task breakdowns with 3 priority levels
- Test coverage statistics

**Commit Guidelines**: [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md)
- Commit message format: `<type>(<scope>): <subject>`
- Types: feat, fix, docs, style, refactor, test, chore, init
- Scopes: core, extension, types, gas, docs, config, tests
- Milestone commit templates for each week

**Planning Documents**:
- [plan.md](./plan.md): AI agent-friendly project summary
- [DEV_PLAN.md](./DEV_PLAN.md): Developer implementation guide

## Development Status & Roadmap

**✅ Completed (Week 1-2)**: Core Package Development
- Dexie.js database schema (wordEntries, reviewStates)
- Repository pattern (BaseRepository, WordRepository, ReviewStateRepository)
- SM-2 spaced repetition algorithm with 100% test coverage
- EventBus for real-time cross-tab synchronization
- Utility functions (normalize, validation)
- **Status**: 113/113 tests passing

**⏳ Next (Week 3-4)**: Chrome Extension Development
- Manifest V3 configuration with declarativeNetRequest
- Content Script for text selection detection (mouseup event)
- Background Service Worker with API integration
  - Naver Dictionary API (primary) with Referer header modification
  - Free Dictionary API (fallback)
  - Result merging: Naver definitions + Dictionary API phonetics
- Popup UI with React (4 modes: collect, manage, quiz, settings)
- Re-learning support (detection + alert for previously learned words)

**⏳ Future (Week 5-6)**: Google Apps Script Mobile Quiz
- doPost(): Snapshot upload to Google Drive
- doGet(): Mobile quiz webapp delivery
- Extension integration with QR code generation
- Pro gating: Free users see 3-second ad

## Important Implementation Notes

### Type Safety
Always import types from `@catchvoca/types`:
```typescript
import type { WordEntry, ReviewState, EventType, Rating } from '@catchvoca/types';
```
Never duplicate type definitions. Use `import type` for type-only imports.

### Repository Access Pattern
Never call Dexie directly. Always use repositories:
```typescript
// ✅ Correct
import { wordRepository } from '@catchvoca/core';
await wordRepository.create({ word: 'example', ... });

// ❌ Wrong
import { db } from '@catchvoca/core';
await db.wordEntries.add({ ... });
```

### Word ID Generation
WordEntry IDs follow the format `${normalizedWord}::${url}`:
```typescript
import { generateWordId, normalizeWord, normalizeUrl } from '@catchvoca/core';
const id = generateWordId(normalizeWord('Hello'), normalizeUrl('https://example.com'));
// Result: "hello::https://example.com"
```

This enables:
1. Duplicate detection from same source
2. Re-learning detection (same word from different sources)
3. Efficient lookups

### Testing Best Practices
1. Use `fake-indexeddb` for all database tests
2. Create MockBroadcastChannel for EventBus tests
3. Reset database between tests: `await db.delete()` then `db = new CheckVocaDB()`
4. Test edge cases: empty inputs, max length strings, special characters
5. Validate auto-generated fields: createdAt, updatedAt, normalizedWord
