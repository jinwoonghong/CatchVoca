# CatchVoca

> Local-First 어휘 학습 Chrome Extension with SM-2 Spaced Repetition

웹 브라우징 중 발견한 단어를 자동으로 수집하고, 과학적인 간격 반복 학습(SM-2 알고리즘)으로 효과적으로 암기하는 크롬 확장 프로그램입니다.

## ✨ 주요 기능

- **자동 수집**: 텍스트 선택만으로 단어+뜻+문맥 자동 저장
- **Local-First**: IndexedDB 기반, 오프라인 완벽 지원
- **과학적 복습**: SM-2 알고리즘으로 최적 복습 시점 계산
- **재학습 지원**: 이전에 저장한 단어 재발견 시 복습 유도
- **모바일 퀴즈**: QR 코드로 모바일에서도 학습 가능 (Pro)

## 🏗️ 프로젝트 구조

```
CatchVoca/
├── packages/
│   ├── core/         # 핵심 로직 (Dexie, SM-2, EventBus)
│   ├── extension/    # Chrome Extension
│   └── types/        # 공유 타입 정의
├── docs/             # 프로젝트 문서
└── scripts/          # 빌드 스크립트
```

## 🚀 시작하기

### 필수 요구사항

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 설치

```bash
# 의존성 설치
pnpm install

# 개발 서버 시작
pnpm dev

# 빌드
pnpm build

# 테스트
pnpm test
```

## 🧪 테스트

```bash
# 모든 패키지 테스트
pnpm test

# Core 패키지만 테스트
pnpm test:core

# Watch 모드
pnpm test:watch
```

## 📝 개발 가이드

- [DEV_PLAN.md](./DEV_PLAN.md) - 개발자용 간소화 기획서
- [TODO.md](./TODO.md) - Phase 1 MVP 작업 목록
- [DEVELOPMENT_LOG.md](./DEVELOPMENT_LOG.md) - 개발 이력 및 커밋 가이드
- [CLAUDE.md](./CLAUDE.md) - AI 에이전트용 컨텍스트

## 🛠️ 기술 스택

- **Frontend**: React 18, TypeScript 5, Vite 5, TailwindCSS 3
- **State**: Zustand 4
- **Database**: Dexie.js (IndexedDB)
- **Testing**: Vitest, Playwright
- **Extension**: Chrome Manifest V3

## 📊 개발 진행 상황

- ✅ 프로젝트 기획 및 문서화
- ✅ 초기 프로젝트 구조 설정
- 🔄 Week 1-2: Core Package 개발 중
- ⏳ Week 3-4: Chrome Extension 개발 예정
- ⏳ Week 5-6: Apps Script 모바일 퀴즈 예정

## 📄 라이선스

MIT

## 👥 기여

Phase 1 MVP 개발 중입니다. 기여 가이드라인은 추후 업데이트될 예정입니다.