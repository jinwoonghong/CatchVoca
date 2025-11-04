# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-11-02

### Added

#### Technical Debt Improvements
- **Logger System**: Centralized logging system with environment-aware log levels
  - Added `Logger` class in `packages/core/src/utils/logger.ts`
  - Supports DEBUG, INFO, WARN, ERROR, NONE log levels
  - Automatically switches to WARN level in production
  - Migrated 34+ console.log calls to use Logger

- **Error Handling System**: Custom error classes with retry logic
  - Added `CatchVocaError`, `NetworkError`, `ValidationException`, `DatabaseError`
  - Implemented `withRetry` utility with exponential backoff (3 attempts, 1000ms initial delay)
  - All API calls now use automatic retry mechanism

- **Background Worker Refactoring**: Reduced from 794 lines to 85 lines (89% reduction)
  - Extracted `dictionaryAPI.ts` (207 lines): Dictionary lookup logic
  - Extracted `storage.ts` (62 lines): Chrome Storage operations
  - Extracted `wordService.ts` (108 lines): Word business logic
  - Extracted `messageHandlers.ts` (428 lines): Message routing with 19 handlers

#### Quick Wins
- **Global Keyboard Shortcuts**: Added 3 keyboard shortcuts
  - `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`): Save selected word
  - `Ctrl+Shift+Q` (Mac: `Cmd+Shift+Q`): Start quiz session
  - `Ctrl+Shift+V` (Mac: `Cmd+Shift+V`): Open popup

- **Re-learning Support**: Duplicate word detection with user choice
  - Detects previously saved words before saving
  - Shows dialog with options: "Keep existing record" or "Start new learning"
  - Prevents accidental duplicate learning

- **Search Performance**: Debounce optimization for LibraryTab search
  - Added `useDebounce` hook with 300ms delay
  - Reduces unnecessary API calls during typing
  - Improves UI responsiveness

#### Mobile Quiz (Phase 1)
- **URL Hash-based Quiz**: Standalone mobile quiz without backend
  - Added `quiz.html` as standalone page with embedded styles and JavaScript
  - Base64 encoding of quiz data in URL hash for sharing
  - Supports offline quiz functionality

- **QR Code Generation**: Easy mobile access via QR code
  - Added `qrcode` library for QR code generation
  - Generate QR codes in SettingsTab for mobile quiz URLs
  - Supports up to 20 due review words per quiz

### Changed
- **Code Organization**: Service-oriented architecture for Background Worker
- **Type Safety**: All utility functions now properly exported from `@catchvoca/core`
- **Performance**: Reduced token usage through code extraction and modularization

### Fixed
- Logger export issue: Added `export` keyword to Logger class
- Error message formatting: Use template literals for multi-argument error logs
- TypeScript errors: Removed unused variables and fixed import statements

## [0.1.0] - 2025-10-26

### Added
- Initial project setup with pnpm monorepo workspace
- Core package with Dexie.js database (wordEntries, reviewStates)
- Repository pattern (WordRepository, ReviewStateRepository)
- SM-2 spaced repetition algorithm with 100% test coverage
- EventBus for real-time cross-tab synchronization
- Chrome Extension with Manifest V3
- Content Script for text selection detection
- Background Service Worker with Naver Dictionary API integration
- Popup UI with 4 modes: Collect, Library, Quiz, Settings
- Complete test suite: 113/113 tests passing

[0.3.0]: https://github.com/yourusername/CatchVoca/compare/v0.1.0...v0.3.0
[0.1.0]: https://github.com/yourusername/CatchVoca/releases/tag/v0.1.0
