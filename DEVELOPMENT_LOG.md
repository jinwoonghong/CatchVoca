# CatchVoca 개발 이력

> 프로젝트 개발 과정의 주요 마일스톤과 커밋 이력을 기록합니다.

## 📌 커밋 규칙

### 커밋 메시지 형식
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 종류
- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 포맷팅, 세미콜론 누락 등
- `refactor`: 코드 리팩토링
- `test`: 테스트 코드 추가/수정
- `chore`: 빌드 업무, 패키지 매니저 설정 등
- `init`: 프로젝트 초기 설정

### Scope 종류
- `core`: Core Package (Dexie, SM-2, EventBus)
- `extension`: Chrome Extension (Content Script, Background, Popup)
- `types`: 타입 정의
- `gas`: Google Apps Script
- `docs`: 문서
- `config`: 설정 파일
- `tests`: 테스트

---

## 🎯 Phase 1 MVP - 개발 이력

### 2025-10-31 - 프로젝트 기획 완료

#### ✅ 완료 사항
1. 프로젝트 기획서 및 요구사항 명세서 작성
2. AI 에이전트용 컨텍스트 문서 (CLAUDE.md) 생성
3. 개발자용 간소화 기획서 (DEV_PLAN.md) 작성
4. 상세 Todo 리스트 (TODO.md) 작성
5. 개발 이력 추적 시스템 구축

#### 📝 커밋 권장
```bash
# Git 초기화 (아직 안 했다면)
git init
git add .
git commit -m "init(project): 프로젝트 초기 설정 및 기획 문서 작성

- 최종 기획서 (v0.2.0) 작성
- 요구사항 명세서 (v1.0) 작성
- AI 에이전트용 CLAUDE.md 생성
- 개발자용 DEV_PLAN.md 생성
- Phase 1 MVP Todo 리스트 작성
- 개발 이력 추적 시스템 (DEVELOPMENT_LOG.md) 구축

프로젝트 개요:
- Local-First 어휘 학습 Chrome Extension
- SM-2 알고리즘 기반 간격 반복 학습
- 네이버 사전 API + Dictionary API 통합
- Google Apps Script 모바일 퀴즈
- Pro 구독 모델 (Freemium)

기술 스택:
- React 18 + TypeScript 5 + Vite 5
- Dexie.js (IndexedDB)
- Chrome Extension Manifest V3
- TailwindCSS 3 + Zustand 4"

# 원격 저장소 연결 (GitHub에 repo 생성 후)
git remote add origin https://github.com/YOUR_USERNAME/CatchVoca.git
git branch -M main
git push -u origin main
```

#### 📊 상태
- **진행률**: 기획 단계 완료 (100%)
- **다음 단계**: Week 1-2 Core Package 개발 시작
- **예상 소요 시간**: 2주

---

## Week 1-2: Core Package 개발

### 🔄 진행 중

#### 다음 작업 목록
1. [ ] 프로젝트 구조 생성 (pnpm monorepo)
2. [ ] TypeScript 및 개발 도구 설정
3. [ ] 타입 정의 작성 (packages/types/)
4. [ ] Dexie 스키마 구현
5. [ ] Repository 패턴 구현
6. [ ] SM-2 알고리즘 구현
7. [ ] BroadcastChannel EventBus 구현

#### 🎯 커밋 포인트 (권장)

##### 1️⃣ 프로젝트 초기 구조 완성 시
**타이밍**: 폴더 구조, package.json, tsconfig.json, 개발 도구 설정 완료
```bash
git add .
git commit -m "chore(config): 프로젝트 초기 구조 및 개발 환경 설정

- pnpm workspace 설정 (monorepo 구조)
- TypeScript 5 설정 (strict mode)
- ESLint + Prettier 설정
- Vitest 테스트 환경 구축
- Husky pre-commit hooks 설정

폴더 구조:
packages/
├── core/          # 핵심 로직
├── extension/     # Chrome Extension
└── types/         # 공유 타입 정의"
```

##### 2️⃣ 타입 정의 완성 시
**타이밍**: WordEntry, ReviewState 등 모든 인터페이스 정의 완료
```bash
git add packages/types/
git commit -m "feat(types): 핵심 데이터 타입 정의 추가

- WordEntry 인터페이스 (단어 정보)
- ReviewState 인터페이스 (SM-2 상태)
- Snapshot 인터페이스 (모바일 스냅샷)
- EventType 타입 정의 (BroadcastChannel)
- LookupResult 인터페이스 (API 응답)

타입 안정성 확보 및 패키지 간 공유 가능"
```

##### 3️⃣ Dexie 스키마 완성 시
**타이밍**: 데이터베이스 생성, 인덱스 설정, 테스트 통과
```bash
git add packages/core/src/db/
git commit -m "feat(core): Dexie.js 스키마 구현 및 IndexedDB 설정

- CheckVocaDB 데이터베이스 생성
- word_entries 테이블 (인덱스: normalizedWord, tags, createdAt)
- review_states 테이블 (인덱스: wordId, nextReviewAt)
- 마이그레이션 전략 구현 (v1 → v2)
- 단위 테스트 작성 및 통과

테스트 커버리지: 100%"
```

##### 4️⃣ Repository 패턴 완성 시
**타이밍**: CRUD 메서드, 검색, 페이지네이션 구현 및 테스트 통과
```bash
git add packages/core/src/repositories/
git commit -m "feat(core): Repository 패턴 구현 (WordRepository, ReviewStateRepository)

WordRepository:
- create, findById, findByNormalizedWord, update, delete
- search (relevance score 정렬)
- pagination 및 필터링

ReviewStateRepository:
- create, findByWordId, findDueReviews, update, delete
- 복습 대기 단어 쿼리 최적화

특징:
- 낙관적 잠금 (optimistic locking)
- Soft delete (tombstone 패턴)
- Cascade 삭제 (ReviewState 자동 삭제)

테스트 커버리지: 100%"
```

##### 5️⃣ SM-2 알고리즘 완성 시 ⭐ **중요**
**타이밍**: SM-2 계산 로직 구현 및 모든 테스트 통과
```bash
git add packages/core/src/sm2/
git commit -m "feat(core): SM-2 간격 반복 학습 알고리즘 구현

SuperMemo 2 알고리즘 구현:
- easeFactor 조정 (1.3 ~ 2.5 범위)
- interval 계산 (틀리면 리셋, 맞으면 증가)
- nextReviewAt 자동 계산
- 복습 히스토리 기록

테스트 시나리오:
- 첫 번째 복습: 1일
- 두 번째 복습: 6일
- 세 번째 이후: interval * easeFactor
- 틀렸을 때 리셋
- easeFactor 범위 검증
- 엣지 케이스 (연속 틀림, 연속 쉬움)

테스트 커버리지: 100%
수학적 정확성 검증 완료"
```

##### 6️⃣ EventBus 완성 시
**타이밍**: BroadcastChannel 래퍼 구현 및 테스트 통과
```bash
git add packages/core/src/events/
git commit -m "feat(core): BroadcastChannel 기반 EventBus 구현

실시간 이벤트 동기화 시스템:
- word:created, word:updated, word:deleted
- review:completed

특징:
- 탭/윈도우 간 실시간 동기화
- 타입 안전한 이벤트 핸들링
- 메모리 누수 방지 (리스너 제거)

테스트 커버리지: 100%"
```

##### 7️⃣ Week 1-2 완료 시 ⭐ **마일스톤**
**타이밍**: Core Package 전체 통합 테스트 통과
```bash
git add .
git commit -m "feat(core): Week 1-2 Core Package 개발 완료

완료 항목:
✅ 프로젝트 초기 구조 및 개발 환경 설정
✅ 타입 정의 (WordEntry, ReviewState, Snapshot)
✅ Dexie.js 스키마 (word_entries, review_states)
✅ Repository 패턴 (WordRepository, ReviewStateRepository)
✅ SM-2 알고리즘 (간격 반복 학습)
✅ BroadcastChannel EventBus (실시간 동기화)

테스트 결과:
- 단위 테스트: 100% 통과
- 통합 테스트: 100% 통과
- 코드 커버리지: 85%

성능 벤치마크:
- Dexie 쿼리: <200ms (1K 단어)
- SM-2 계산: <1ms
- EventBus 발송: <5ms

다음 단계: Week 3-4 Chrome Extension 개발 시작"

git push origin main
```

---

## Week 3-4: Chrome Extension 개발

### 🔄 대기 중

#### 🎯 커밋 포인트 (권장)

##### 1️⃣ Manifest V3 설정 완료 시
```bash
git commit -m "feat(extension): Chrome Extension Manifest V3 설정

- manifest.json 작성 (permissions, host_permissions)
- declarativeNetRequest 규칙 (네이버 API Referer)
- content_scripts, background, action 설정
- 아이콘 및 assets 추가"
```

##### 2️⃣ Content Script 완료 시
```bash
git commit -m "feat(extension): Content Script 구현

- 텍스트 선택 감지 (mouseup 이벤트)
- 선택 텍스트 정규화 (1-50자 검증)
- Background Worker 메시지 전송
- 컨텍스트 메뉴 통합"
```

##### 3️⃣ Background Worker 완료 시 ⭐ **중요**
```bash
git commit -m "feat(extension): Background Service Worker 및 API 통합

네이버 사전 API (Primary):
- Referer 헤더 자동 설정 (declarativeNetRequest)
- 응답 파싱 및 HTML 태그 제거
- 한국어 정의 추출

Dictionary API (Fallback):
- 영어 정의 및 발음 데이터
- audioUrl 추출

통합 Lookup:
- 캐싱 전략 (10분 TTL)
- Fallback 자동 전환
- 에러 핸들링

Dexie 저장 및 EventBus 통합"
```

##### 4️⃣ Popup UI 완성 시 ⭐ **마일스톤**
```bash
git commit -m "feat(extension): Popup UI 구현 (React + Vite + TailwindCSS)

4가지 모드:
✅ 수집 모드: 단어 검색, 정의 표시, 저장
✅ 관리 모드: 단어 목록, 검색, 필터링, 태그 관리
✅ 퀴즈 모드: SM-2 카드 UI, 진행률, 단축키
✅ 설정 모드: Pro 상태, 동기화, 업그레이드

특징:
- 가상 스크롤링 (react-window)
- 300ms debouncing 검색
- Zustand 상태 관리
- EventBus 실시간 업데이트
- 재학습 지원 (이미 학습한 단어 알림)"
```

##### 5️⃣ Week 3-4 완료 시 ⭐ **마일스톤**
```bash
git commit -m "feat(extension): Week 3-4 Chrome Extension 개발 완료

완료 항목:
✅ Manifest V3 설정
✅ Content Script (텍스트 선택)
✅ Background Service Worker (API 통합)
✅ Popup UI (4개 모드)
✅ 재학습 지원 기능

E2E 테스트 결과:
✅ 텍스트 선택 → 저장 → Popup 확인
✅ 단어 검색 → 결과 표시
✅ 퀴즈 진행 → SM-2 적용
✅ 재학습 알림 동작

성능 측정:
- API 응답: <2s (네이버 Primary)
- Popup 로딩: <500ms
- 검색 응답: <300ms
- 카드 전환: <100ms

다음 단계: Week 5-6 Apps Script 모바일 퀴즈"

git push origin main
```

---

## Week 5-6: Apps Script 모바일 퀴즈

### 🔄 대기 중

#### 🎯 커밋 포인트 (권장)

##### 1️⃣ Apps Script 기본 구현 완료 시
```bash
git commit -m "feat(gas): Google Apps Script 모바일 퀴즈 구현

doPost(): 스냅샷 저장
- Drive 폴더 생성/조회
- JSON 파일 저장
- 메타데이터 캐싱
- 모바일 URL 반환

doGet(): 모바일 웹앱 제공
- 메타데이터 조회
- Drive 파일 로드
- HTML 템플릿 렌더링"
```

##### 2️⃣ MobileQuiz.html 완료 시
```bash
git commit -m "feat(gas): 모바일 퀴즈 UI 구현

특징:
- 세로 모드 전체 화면 최적화
- 터치 친화적 버튼 UI
- SM-2 계산 (로컬 실행)
- 진행률 표시 (진행도 바)
- 완료 화면 (통계 요약)

테스트:
✅ Android Chrome
✅ iOS Safari
✅ 터치 제스처"
```

##### 3️⃣ Extension 통합 완료 시
```bash
git commit -m "feat(extension): Apps Script 통합 및 Pro 게이팅

스냅샷 생성:
- createSnapshot() 함수
- Apps Script API 호출
- QR 코드 생성 (qrcode.react)

Pro 게이팅:
- 무료: 3초 광고 + 30% Pro 제안
- Pro: 광고 없이 즉시 생성

UI:
- QR 코드 표시
- 링크 복사 버튼
- Pro 업그레이드 모달"
```

##### 4️⃣ Week 5-6 완료 시 ⭐ **마일스톤**
```bash
git commit -m "feat(gas): Week 5-6 모바일 퀴즈 개발 완료

완료 항목:
✅ Apps Script 프로젝트 구현
✅ doPost/doGet 핸들러
✅ MobileQuiz.html (모바일 최적화)
✅ Extension 통합
✅ Pro 게이팅 시스템
✅ QR 코드 생성

E2E 테스트 결과:
✅ Extension → POST → Drive 저장
✅ QR 스캔 → 모바일 퀴즈 로드
✅ 터치 버튼 → 퀴즈 완료
✅ Pro/무료 게이팅 동작

성능 측정:
- 스냅샷 생성: <1s (1K 단어)
- Apps Script 응답: <2s
- 모바일 로딩: <3s

다음 단계: Phase 1 MVP 최종 검증"

git push origin main
```

---

## Phase 1 MVP 최종 완료

### 🎯 최종 커밋 ⭐ **릴리스**

```bash
# 버전 태그 추가
git tag -a v0.1.0 -m "Phase 1 MVP 완료 - CatchVoca v0.1.0

✅ Chrome Extension 개발 완료
✅ Core Package (Dexie, SM-2, EventBus)
✅ Popup UI (4개 모드)
✅ 재학습 지원 기능
✅ Apps Script 모바일 퀴즈
✅ Pro 게이팅 시스템

MVP 완성 체크리스트: 100%
테스트 커버리지: 85%
E2E 테스트: 모두 통과

다음 단계: Phase 2 수익화 (광고 + Pro 구독)"

git push origin v0.1.0
git push origin main
```

---

## 📊 통계 (자동 업데이트)

### 커밋 통계
- **총 커밋 수**: 0 (현재 기획 단계)
- **예상 커밋 수**: 약 15-20개 (Phase 1)

### 개발 진행률
- **기획 단계**: ✅ 100%
- **Week 1-2 (Core)**: ⏳ 0%
- **Week 3-4 (Extension)**: ⏳ 0%
- **Week 5-6 (Apps Script)**: ⏳ 0%
- **전체 진행률**: 0% (0/6주)

### 코드 통계 (예상)
- **총 파일 수**: 0
- **총 라인 수**: 0
- **테스트 커버리지**: 0%

---

## 🚨 중요 알림 규칙

다음과 같은 상황에서 커밋/푸시를 권장합니다:

### 🔴 즉시 커밋 (High Priority)
1. **SM-2 알고리즘 완성**: 핵심 로직, 반드시 백업 필요
2. **API 통합 완료**: 네이버/Dictionary API, 데이터 손실 방지
3. **데이터베이스 스키마 변경**: 마이그레이션 이력 보존
4. **주요 기능 완성**: 퀴즈 모드, 재학습 지원 등

### 🟡 일일 커밋 (Medium Priority)
1. **하루 작업 종료 시**: 진행 상황 백업
2. **새로운 컴포넌트 추가**: UI 컴포넌트, Repository 등
3. **테스트 코드 작성**: 단위 테스트, E2E 테스트

### 🟢 주간 커밋 (Low Priority)
1. **문서 업데이트**: README, 기획서 수정
2. **설정 파일 변경**: tsconfig, eslint 등
3. **스타일링 작업**: CSS, TailwindCSS

---

## 📝 다음 업데이트 예정

이 문서는 개발 진행에 따라 자동으로 업데이트됩니다.

**마지막 업데이트**: 2025-10-31
**다음 업데이트 예상**: Week 1-2 Core Package 개발 시작 시
