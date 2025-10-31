# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CatchVoca is a Local-First vocabulary learning Chrome extension that automatically collects words during web browsing and uses SM-2 spaced repetition for effective learning. The project prioritizes offline-first, privacy-conscious design with optional Pro features (AI analysis, cloud sync).

**Current Status**: Planning phase - comprehensive requirements and specifications exist, but source code implementation has not yet begun.

## Technology Stack

**Frontend**:
- React 18+ with TypeScript 5+ (strict mode)
- Vite 5+ for build tooling
- TailwindCSS 3+ for styling
- Zustand 4+ for state management
- React Router 6+ for navigation
- Recharts 2+ for data visualization

**Data Layer**:
- **Primary Database**: Dexie.js (IndexedDB wrapper) - single source of truth
- **Cloud Sync**: Firestore (Pro users only)
- **Auth**: Firebase Authentication
- **Payments**: Stripe

**External APIs**:
- **Naver Dictionary API** (primary): `https://en.dict.naver.com/api3/enko/search`
- **Free Dictionary API** (fallback): `https://api.dictionaryapi.dev`
- **OpenAI GPT-3.5**: Word importance analysis (Pro feature)
- **Google Apps Script**: Mobile quiz distribution backend

**Infrastructure**:
- Hosting: Vercel (Hobby tier)
- Monitoring: Sentry (Free tier)
- Analytics: Google Analytics 4
- Package Manager: pnpm (monorepo structure planned)

## Development Commands

*Note: Project is in planning phase. Expected commands once implemented:*

```bash
# Setup
pnpm install                    # Install dependencies

# Development
pnpm dev                        # Start development server
pnpm build                      # Production build
pnpm preview                    # Preview production build

# Testing
pnpm test                       # Run unit tests (Vitest)
pnpm test:watch                 # Watch mode for tests
pnpm test:e2e                   # Run E2E tests (Playwright)

# Code Quality
pnpm lint                       # ESLint + Prettier
pnpm typecheck                  # TypeScript type checking
```

## Architecture Principles

### Local-First Design

**IndexedDB is the Single Source of Truth (SSOT)**:
- All data operations happen locally first
- Cloud sync (Firestore) is optional and only for Pro users
- Offline-first: All core features work without network connection
- BroadcastChannel API for real-time UI updates across tabs/windows

### Core Data Models

**WordEntry** (Primary entity):
```typescript
{
  id: string;                    // UUID
  word: string;                  // Normalized word
  definitions: Definition[];     // Multiple definitions from APIs
  context: string;               // User-selected sentence
  url: string;                   // Source webpage URL
  tags: string[];                // User-defined tags
  createdAt: number;            // Unix timestamp
  updatedAt: number;            // Last modified timestamp
}
```

**ReviewState** (SM-2 algorithm state):
```typescript
{
  id: string;                    // UUID
  wordId: string;                // FK to WordEntry
  nextReviewAt: number;         // Unix timestamp for next review
  interval: number;             // Days until next review
  repetitions: number;          // Consecutive correct reviews
  easeFactor: number;           // SM-2 ease factor (1.3-2.5)
  history: ReviewLog[];         // Review attempt history
}
```

### Chrome Extension Architecture

**Manifest V3 Structure**:
- **Content Script**: Detects text selection on webpages, sends to background
- **Background Service Worker**: Fetches definitions from APIs, stores in Dexie
- **Popup UI**: Unified interface for word collection, management, quiz, settings
- **declarativeNetRequest**: Required for Naver Dictionary API Referer header

**Data Flow**:
1. User selects text → Content Script captures selection
2. Content Script → Background Worker (chrome.runtime.sendMessage)
3. Background Worker fetches from Naver Dictionary API (fallback to DictionaryAPI)
4. Data stored in IndexedDB via Dexie
5. BroadcastChannel notifies all tabs/windows to refresh UI

### API Fallback Strategy

**Primary → Fallback Pattern**:
1. Try Naver Dictionary API first (more comprehensive definitions)
2. On failure (network error, rate limit, API down) → Free Dictionary API
3. On complete failure → Store word with user's context only, mark for retry
4. Background retry mechanism for failed API calls

**Naver Dictionary API Requirements**:
- Requires `declarativeNetRequest` permission in manifest.json
- Custom Referer header: `https://en.dict.naver.com/`
- Rate limiting: Implement exponential backoff

### SM-2 Spaced Repetition Algorithm

**Core Implementation**:
- Based on SuperMemo 2 algorithm
- Calculates optimal review intervals based on user performance
- Adjusts ease factor (difficulty) per word based on review history
- Default ease factor: 2.5, range: 1.3-2.5

**Review Grading**:
- Grade 5 (Perfect): No hesitation, correct
- Grade 4 (Good): Slight hesitation, correct
- Grade 3 (Pass): Difficult recall, correct
- Grade 0-2 (Fail): Incorrect, reset interval to 1 day

**Critical**: Unit tests MUST validate SM-2 calculations for correctness.

### Conflict Resolution Strategy

**Last-Write-Wins (LWW)**:
- For Pro users with Firestore sync enabled
- Use `updatedAt` timestamp to resolve conflicts
- Local changes always preferred if timestamps equal
- Firestore acts as backup, not primary database

## Pro Feature Gating

**Free Tier Limits**:
- 1,000 words maximum
- Basic statistics only
- Ads on mobile quiz links
- Local storage only (no cloud sync)

**Pro Features** ($4.99/month):
- Unlimited words
- AI-powered word importance analysis (OpenAI GPT-3.5)
- Real-time Firestore cloud sync across devices
- Mobile quiz distribution (no ads)
- Advanced statistics and dashboard

**Implementation Pattern**:
```typescript
// Check Pro status before feature access
if (user.isPro) {
  // Enable Pro feature
} else {
  // Show upgrade prompt or limit functionality
}
```

## Key Configuration Points

### Dexie Schema Setup

```typescript
const db = new Dexie('CatchVocaDB');
db.version(1).stores({
  word_entries: 'id, word, *tags, createdAt, updatedAt',
  review_states: 'id, wordId, nextReviewAt'
});
```

**Indexes**:
- `word_entries`: Indexed by `word` (unique lookup), `tags` (multi-entry), `createdAt` (sorting)
- `review_states`: Indexed by `wordId` (FK), `nextReviewAt` (due review queries)

### BroadcastChannel Event Bus

**Channel Name**: `catchvoca-sync`

**Event Types**:
- `word-added`: New word collected
- `word-updated`: Word modified (tags, notes)
- `word-deleted`: Word removed
- `review-completed`: Quiz review finished
- `sync-status-changed`: Firestore sync status update

**Usage**: All UI components subscribe to this channel for real-time updates without prop drilling or complex state management.

### Performance Targets

- Word list loading: <500ms for 1,000 words
- Quiz card transitions: <100ms
- API response handling: <2s timeout with fallback
- IndexedDB queries: <50ms for typical operations
- Mobile quiz page load: <3s on 3G

## Testing Strategy

### Unit Tests (Vitest)

**Critical Test Coverage**:
- SM-2 algorithm calculations (interval, ease factor, next review date)
- Dexie repository methods (CRUD operations)
- API fallback logic (Naver → DictionaryAPI)
- Word importance scoring algorithm
- Conflict resolution (LWW timestamp comparison)

### E2E Tests (Playwright)

**User Journeys to Test**:
1. Text selection → Word collection → Review in popup
2. Quiz flow: Start quiz → Answer cards → Review results
3. Word management: Search, filter, tag, delete
4. Pro upgrade flow: Payment → Feature unlock
5. Sync flow: Local change → Firestore update → Cross-device sync

### Extension Testing

**Chrome Extension Specific**:
- Content script injection on webpages
- Background worker persistence and lifecycle
- Storage API usage and quota limits
- declarativeNetRequest rule application

## Development Roadmap

**Phase 1 - MVP (6 weeks)**:
- Week 1-2: Core package + Dexie setup
- Week 3-4: Chrome Extension integrated UI (word collection, quiz)
- Week 5-6: Google Apps Script mobile quiz backend

**Phase 2 - Monetization (6 weeks)**:
- Week 9-10: Ad system integration
- Week 11-12: Pro subscription (Firebase Auth + Stripe)
- Week 13-14: AI webpage analysis (OpenAI integration)

**Phase 3 - Advanced Features (4 weeks)**:
- Week 15-16: Firestore real-time sync
- Week 17-18: Dashboard + statistics + Recharts

**Phase 4 - Polish (2 weeks)**:
- Week 19-20: Performance optimization, accessibility (WCAG 2.1 AA), launch prep

## Important Documentation

- [Final Product Plan](docs/docs/최종_기획서.md) - v0.2.0 comprehensive specification
- [Requirements Specification](docs/docs/요구사항_명세서.md) - Detailed functional requirements
- [Naver Dictionary API Spec](docs/docs/etc/네이버_사전_API_명세_2025-10-27.md) - API integration details
- [User Journey](docs/docs/etc/사용자_여정_기반_기능_명세.md) - User flow and feature mapping
- [Web Parsing Strategy](docs/docs/parsing.md) - Content script implementation guide
- [AI Agent Guide](plan.md) - Implementation guide for AI-assisted development

## Error Handling

**Sentry Integration**:
- Track API failures (Naver, DictionaryAPI, OpenAI, Firestore)
- Monitor extension lifecycle errors (content script, background worker)
- IndexedDB quota exceeded errors
- Payment flow failures (Stripe)

**User-Facing Error Messages**:
- API failures: "Unable to fetch definition. Word saved with your context."
- Quota exceeded: "Storage limit reached. Please upgrade to Pro or delete old words."
- Sync failures: "Unable to sync. Changes saved locally and will retry automatically."

## Security Considerations

- Never store sensitive data (API keys, tokens) in extension storage
- Use Firebase Admin SDK server-side for Stripe webhook verification
- Implement Content Security Policy (CSP) in manifest.json
- Sanitize user input before IndexedDB storage to prevent XSS
- Pro status verification must happen server-side (Firebase Functions)
