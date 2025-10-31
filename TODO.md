# CatchVoca 개발 Todo 리스트

> **Phase 1 MVP (6주)** 상세 작업 목록

## 📌 범례

- ⏳ **대기 중** (Pending)
- 🔄 **진행 중** (In Progress)
- ✅ **완료** (Completed)
- 🚧 **블로커** (Blocked)

**의존성 표시**: `→ 선행 작업 필요`

---

## Week 1-2: Core Package + 아키텍처

### 1️⃣ 프로젝트 초기 설정

#### 1.1 프로젝트 구조 생성
- ⏳ 루트 디렉토리 구조 생성
  ```
  CatchVoca/
  ├── packages/
  │   ├── core/          # 핵심 로직 (Dexie, SM-2)
  │   ├── extension/     # Chrome Extension
  │   └── types/         # 공유 타입 정의
  ├── docs/              # 문서
  ├── scripts/           # 빌드 스크립트
  └── tests/             # E2E 테스트
  ```

- ⏳ pnpm workspace 설정
  ```yaml
  # pnpm-workspace.yaml
  packages:
    - 'packages/*'
  ```

- ⏳ 루트 package.json 생성
  ```json
  {
    "name": "catchvoca-monorepo",
    "private": true,
    "scripts": {
      "dev": "pnpm --filter extension dev",
      "build": "pnpm -r build",
      "test": "pnpm -r test",
      "lint": "pnpm -r lint"
    }
  }
  ```

#### 1.2 TypeScript 설정
- ⏳ 루트 tsconfig.json 생성 (strict mode)
- ⏳ 각 패키지별 tsconfig.json 상속 설정
- ⏳ Path alias 설정 (`@core/*`, `@types/*`)

#### 1.3 개발 도구 설정
- ⏳ ESLint + Prettier 설정
  - `@typescript-eslint/parser`
  - `eslint-config-prettier`
  - `.prettierrc` 생성
- ⏳ Vitest 설정 (`packages/core/vitest.config.ts`)
- ⏳ Git hooks (Husky) 설정
  - pre-commit: lint-staged
  - pre-push: 테스트 실행

**완료 기준**: `pnpm install` 성공, `pnpm lint` 통과

---

### 2️⃣ Core Package - 데이터 레이어

#### 2.1 타입 정의 (`packages/types/`)
- ⏳ `WordEntry` 인터페이스 정의
- ⏳ `ReviewState` 인터페이스 정의
- ⏳ `Snapshot` 인터페이스 정의
- ⏳ `EventType` 타입 정의
- ⏳ `LookupResult` 인터페이스 정의

**파일**: `packages/types/src/index.ts`

#### 2.2 Dexie 스키마 (`packages/core/src/db/`)
- ⏳ Dexie 인스턴스 생성 (`database.ts`)
  ```typescript
  export const db = new Dexie('CheckVocaDB');

  db.version(2).stores({
    word_entries: '&id, normalizedWord, url, createdAt, updatedAt, lastViewedAt, *tags',
    review_states: '&id, wordId, nextReviewAt'
  });
  ```

- ⏳ 마이그레이션 전략 수립
  - v1 → v2 마이그레이션 스크립트
  - 데이터 무결성 검증

- ⏳ 단위 테스트 작성
  - 데이터베이스 생성 테스트
  - 인덱스 확인 테스트
  - 마이그레이션 테스트

**완료 기준**: Dexie DB 생성 및 테스트 100% 통과

#### 2.3 Repository 패턴 구현 (`packages/core/src/repositories/`)

##### WordRepository.ts
- ⏳ `create(word: WordEntry): Promise<string>`
  - 중복 확인 (normalizedWord + url)
  - ID 생성: `${normalizedWord}::${url}`
  - timestamp 자동 설정
- ⏳ `findById(id: string): Promise<WordEntry | null>`
- ⏳ `findByNormalizedWord(word: string): Promise<WordEntry[]>`
- ⏳ `update(id: string, changes: Partial<WordEntry>): Promise<void>`
  - updatedAt 자동 갱신
  - 낙관적 잠금 (optimistic locking)
- ⏳ `delete(id: string): Promise<void>`
  - Soft delete (deletedAt 설정)
  - Cascade: ReviewState도 삭제
- ⏳ `search(query: string): Promise<WordEntry[]>`
  - normalizedWord, definitions, context 검색
  - relevance score 정렬
- ⏳ `findAll(options: PaginationOptions): Promise<WordEntry[]>`
  - 정렬, 페이지네이션
  - 필터링 (tags, language)

##### ReviewStateRepository.ts
- ⏳ `create(review: ReviewState): Promise<string>`
- ⏳ `findByWordId(wordId: string): Promise<ReviewState | null>`
- ⏳ `findDueReviews(now: number): Promise<ReviewState[]>`
  - `nextReviewAt <= now` 쿼리
  - 우선순위 정렬 (만기일 오래된 순)
- ⏳ `update(id: string, changes: Partial<ReviewState>): Promise<void>`
- ⏳ `delete(id: string): Promise<void>`

##### 단위 테스트
- ⏳ Repository CRUD 테스트 (각 메서드별)
- ⏳ 중복 처리 테스트
- ⏳ Cascade 삭제 테스트
- ⏳ 검색 relevance 테스트

**완료 기준**: Repository 테스트 100% 통과

---

### 3️⃣ Core Package - SM-2 Engine

#### 3.1 SM-2 알고리즘 구현 (`packages/core/src/sm2/`)
- ⏳ `calculateNextReview()` 함수 구현
  ```typescript
  function calculateNextReview(
    state: ReviewState,
    rating: number // 1-4
  ): ReviewState
  ```
  - easeFactor 조정 (1.3 ~ 2.5)
  - interval 계산 (틀리면 리셋, 맞으면 증가)
  - nextReviewAt 계산
  - history 업데이트

- ⏳ 단위 테스트 작성
  - 첫 번째 복습: interval = 1
  - 두 번째 복습: interval = 6
  - 세 번째 이후: interval * easeFactor
  - 틀렸을 때 리셋
  - easeFactor 범위 검증 (1.3 ~ 2.5)
  - 엣지 케이스 (연속 틀림, 연속 쉬움)

**완료 기준**: SM-2 테스트 100% 통과, 수학적 정확성 검증

---

### 4️⃣ Core Package - Event Bus

#### 4.1 BroadcastChannel 래퍼 (`packages/core/src/events/`)
- ⏳ `EventBus` 클래스 구현
  ```typescript
  class EventBus {
    private channel: BroadcastChannel;

    emit(type: EventType, payload: any): void;
    on(type: EventType, handler: Function): void;
    off(type: EventType, handler: Function): void;
  }
  ```

- ⏳ 이벤트 타입 정의
  - `word:created`
  - `word:updated`
  - `word:deleted`
  - `review:completed`

- ⏳ 단위 테스트
  - 이벤트 발송/수신 테스트
  - 다중 리스너 테스트
  - 리스너 제거 테스트

**완료 기준**: EventBus 테스트 통과, 실시간 동기화 확인

---

### 5️⃣ Week 1-2 통합 테스트
- ⏳ 전체 Core Package 통합 테스트
  - 단어 생성 → Repository 저장 → EventBus 발송
  - 퀴즈 진행 → SM-2 계산 → ReviewState 업데이트
  - 검색 → 결과 정렬 → 페이지네이션

**완료 기준**: 모든 테스트 통과, 코드 커버리지 ≥80%

---

## Week 3-4: Chrome Extension 통합 UI

### 1️⃣ Manifest V3 설정

#### 1.1 기본 구조 (`packages/extension/`)
- ⏳ 폴더 구조 생성
  ```
  packages/extension/
  ├── public/
  │   ├── manifest.json
  │   ├── icons/
  │   └── rules/
  │       └── rule_endic.json  # declarativeNetRequest 규칙
  ├── src/
  │   ├── background/
  │   │   └── service-worker.ts
  │   ├── content/
  │   │   └── content-script.ts
  │   ├── popup/
  │   │   ├── App.tsx
  │   │   └── main.tsx
  │   └── shared/
  │       └── api.ts
  ├── vite.config.ts
  └── package.json
  ```

#### 1.2 manifest.json 작성
- ⏳ 기본 정보 (name, version, description)
- ⏳ permissions 설정
  ```json
  "permissions": [
    "storage",
    "contextMenus",
    "activeTab",
    "declarativeNetRequest"
  ]
  ```
- ⏳ host_permissions
  ```json
  "host_permissions": [
    "https://*/*",
    "https://en.dict.naver.com/*",
    "https://api.dictionaryapi.dev/*"
  ]
  ```
- ⏳ content_scripts 설정
- ⏳ background service_worker 설정
- ⏳ action (popup) 설정
- ⏳ declarativeNetRequest 규칙 파일 연결

**완료 기준**: manifest.json 유효성 검증 통과

---

### 2️⃣ Content Script 구현

#### 2.1 텍스트 선택 감지 (`content-script.ts`)
- ⏳ `mouseup` 이벤트 리스너 등록
- ⏳ `document.getSelection()` 텍스트 추출
- ⏳ 텍스트 정규화
  - 공백 제거 (`trim()`)
  - 길이 검증 (1-50자)
  - 특수문자 정리
- ⏳ 선택 위치 정보 추출 (`SelectionRangeSnapshot`)
- ⏳ Background Worker에 메시지 전송
  ```typescript
  chrome.runtime.sendMessage({
    type: 'LOOKUP_WORD',
    payload: { word, context, url, sourceTitle }
  });
  ```

#### 2.2 컨텍스트 메뉴 통합
- ⏳ Background Worker에서 컨텍스트 메뉴 생성
  ```typescript
  chrome.contextMenus.create({
    id: 'save-to-checkvoca',
    title: '📚 CheckVoca에 저장',
    contexts: ['selection']
  });
  ```
- ⏳ 메뉴 클릭 이벤트 핸들러

**완료 기준**: 웹페이지에서 텍스트 선택 시 메시지 전송 확인

---

### 3️⃣ Background Service Worker 구현

#### 3.1 API 통합 (`background/api.ts`)

##### 네이버 사전 API
- ⏳ `fetchNaverDictionary(word: string): Promise<LookupResult>`
  - URL: `https://en.dict.naver.com/api3/enko/search?query=${word}`
  - Referer 헤더는 declarativeNetRequest로 자동 설정
  - 응답 파싱 (NaverResponse → LookupResult)
  - HTML 태그 제거 (`sanitizeDefinition()`)

##### Dictionary API (Fallback)
- ⏳ `fetchDictionaryAPI(word: string): Promise<LookupResult>`
  - URL: `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`
  - 응답 파싱
  - audioUrl 추출

##### 통합 Lookup 함수
- ⏳ `lookupWord(word: string): Promise<LookupResult>`
  - 캐싱 전략 (10분 TTL)
  - 네이버 → Fallback → 빈 결과
  - 에러 핸들링

**완료 기준**: API 호출 성공, Fallback 동작 확인

#### 3.2 메시지 핸들러
- ⏳ `LOOKUP_WORD` 메시지 처리
  - API 호출
  - Dexie에 저장
  - EventBus 이벤트 발송
  - Popup에 응답 전송

**완료 기준**: Content Script → Background → Dexie 플로우 확인

---

### 4️⃣ Popup UI 구현 (React + Vite)

#### 4.1 개발 환경 설정
- ⏳ Vite 설정 (`vite.config.ts`)
  - React plugin
  - Extension 빌드 설정
  - HMR (Hot Module Reload) 설정
- ⏳ TailwindCSS 설정
- ⏳ React Router 설정 (4개 모드)
  - `/collect` - 수집 모드
  - `/manage` - 관리 모드
  - `/quiz` - 퀴즈 모드
  - `/settings` - 설정 모드

#### 4.2 수집 모드 (`/collect`)
- ⏳ 단어 입력 UI
- ⏳ 정의 표시 (로딩 상태)
- ⏳ 저장 버튼
- ⏳ 태그 추가 UI
- ⏳ "이미 학습한 단어" 알림 (재학습 지원)
  - 기존 단어 감지
  - 학습 정보 표시 (마지막 복습일, 횟수, 숙련도)
  - 옵션: [지금 복습하기] [나중에] [정의 보기]

#### 4.3 관리 모드 (`/manage`)
- ⏳ 단어 목록 (가상 스크롤링)
  - react-window 사용
  - 50개씩 로딩
- ⏳ 검색 바 (300ms debouncing)
- ⏳ 필터링 UI (태그, 언어, 즐겨찾기)
- ⏳ 정렬 옵션 (최신순, 이름순, 조회수순)
- ⏳ 단어 카드 컴포넌트
  - 단어, 정의, 태그 표시
  - 편집/삭제 버튼
  - 즐겨찾기 토글

#### 4.4 퀴즈 모드 (`/quiz`)
- ⏳ 복습 대기 단어 조회
- ⏳ 퀴즈 카드 UI
  - 앞면: 단어 + 문맥
  - 뒷면: 정의 + 발음 + 오디오
- ⏳ 난이도 평가 버튼 (1-4)
- ⏳ 진행률 표시 (N/M, 진행도 바)
- ⏳ 단축키 지원
  - Space: 정답 보기
  - 1-4: 난이도 평가
  - N: 다음 카드
  - P: 발음 재생
- ⏳ 완료 화면 (통계 요약)

#### 4.5 설정 모드 (`/settings`)
- ⏳ Pro 상태 표시
- ⏳ 동기화 상태 표시 (Phase 2)
- ⏳ Pro 업그레이드 버튼
- ⏳ 연결된 계정 정보

#### 4.6 상태 관리 (Zustand)
- ⏳ `useWordStore`: 단어 목록 상태
- ⏳ `useQuizStore`: 퀴즈 상태
- ⏳ `useSettingsStore`: 설정 상태
- ⏳ EventBus 통합 (실시간 업데이트)

**완료 기준**: 모든 모드 정상 작동, UI/UX 검증

---

### 5️⃣ Week 3-4 통합 테스트
- ⏳ E2E 테스트 (Playwright)
  - 텍스트 선택 → 저장 → Popup 확인
  - 단어 검색 → 결과 확인
  - 퀴즈 진행 → SM-2 적용 확인
  - 재학습 알림 동작 확인

**완료 기준**: E2E 테스트 통과, 확장 프로그램 정상 동작

---

## Week 5-6: Apps Script 모바일 퀴즈

### 1️⃣ Google Apps Script 프로젝트 생성
- ⏳ Apps Script 신규 프로젝트 생성
- ⏳ 웹 앱으로 배포 설정 (Anyone 접근)
- ⏳ 스크립트 ID 확인

---

### 2️⃣ doPost() 구현 (스냅샷 저장)
- ⏳ POST 요청 파싱
  ```javascript
  const data = JSON.parse(e.postData.contents);
  ```
- ⏳ Drive 폴더 생성/조회 (`CheckVoca_Snapshots`)
- ⏳ 고유 ID 생성 (UUID 8자)
- ⏳ JSON 파일 저장
  ```javascript
  folder.createFile(`snapshot_${snapshotId}.json`, JSON.stringify(snapshot));
  ```
- ⏳ 메타데이터 캐싱
  - CacheService (6시간)
  - PropertiesService (영구)
- ⏳ 모바일 URL 반환

**완료 기준**: POST 요청 → Drive 저장 → URL 반환 확인

---

### 3️⃣ doGet() 구현 (모바일 웹앱 제공)
- ⏳ URL 파라미터 `id` 추출
- ⏳ 메타데이터 조회 (Cache → Properties)
- ⏳ Drive 파일 로드
- ⏳ HTML 템플릿 렌더링
  ```javascript
  const template = HtmlService.createTemplateFromFile('MobileQuiz');
  template.snapshot = snapshotJson;
  return template.evaluate();
  ```

**완료 기준**: GET 요청 → HTML 반환 확인

---

### 4️⃣ MobileQuiz.html 구현
- ⏳ HTML 구조 작성 (세로 모드 최적화)
- ⏳ CSS 스타일 (모바일 친화적)
- ⏳ JavaScript 로직
  - 스냅샷 데이터 파싱
  - 복습 대기 단어 필터링 (`nextReviewAt <= now`)
  - 퀴즈 카드 렌더링 (앞/뒷면)
  - 터치 버튼 핸들러
  - SM-2 계산 (로컬 실행)
  - 진행률 업데이트
  - 완료 화면 표시

**완료 기준**: 모바일 브라우저에서 퀴즈 완료 가능

---

### 5️⃣ Extension 통합

#### 5.1 스냅샷 생성 기능
- ⏳ `createSnapshot()` 함수 구현
  - Dexie에서 모든 단어 조회
  - ReviewState 조회
  - JSON 객체 생성
- ⏳ Apps Script API 호출
  ```typescript
  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'saveSnapshot', snapshot })
  });
  ```

#### 5.2 Pro 게이팅 시스템
- ⏳ Pro 상태 확인 함수
- ⏳ 무료 사용자 플로우
  - 3초 인터스티셜 광고 표시
  - 30% 확률로 Pro 업그레이드 모달
- ⏳ Pro 사용자 플로우
  - 광고 없이 즉시 생성

#### 5.3 QR 코드 생성
- ⏳ qrcode.react 설치
- ⏳ QR 코드 컴포넌트 (`<QRCode value={mobileUrl} />`)
- ⏳ 링크 복사 버튼

**완료 기준**: Extension에서 QR 생성 → 모바일 스캔 → 퀴즈 완료

---

### 6️⃣ Week 5-6 통합 테스트
- ⏳ E2E 테스트 (Playwright)
  - Extension에서 모바일 링크 생성
  - Pro/무료 게이팅 동작 확인
  - 모바일 시뮬레이터에서 퀴즈 테스트
- ⏳ 모바일 디바이스 실제 테스트
  - Android Chrome
  - iOS Safari
  - QR 스캔 테스트

**완료 기준**: E2E 테스트 통과, 모바일 퀴즈 정상 동작

---

## Phase 1 최종 검증

### ✅ MVP 완성 체크리스트
- [ ] Chrome Extension 설치 가능
- [ ] 웹페이지에서 단어 선택 → 저장
- [ ] Popup UI 모든 모드 정상 작동
- [ ] 퀴즈 진행 → SM-2 적용 확인
- [ ] 재학습 알림 동작
- [ ] 모바일 링크 생성 → QR 스캔 → 퀴즈 완료
- [ ] Pro 게이팅 정상 작동
- [ ] 모든 단위 테스트 통과 (커버리지 ≥80%)
- [ ] E2E 테스트 통과
- [ ] 성능 목표 달성
  - 단어 목록 로딩 <500ms
  - 검색 응답 <300ms
  - 퀴즈 카드 전환 <100ms

### 🚀 배포 준비
- [ ] Chrome Web Store 개발자 등록
- [ ] Extension 패키징
- [ ] 스크린샷 및 설명 작성
- [ ] 개인정보 처리방침 작성
- [ ] 리뷰 제출

---

## 다음 단계 (Phase 2)

Phase 1 MVP 완료 후:
1. 광고 시스템 통합 (Week 9-10)
2. Pro 구독 시스템 (Firebase Auth + Stripe) (Week 11-12)
3. AI 웹페이지 분석 (Week 13-14)
4. Firestore 실시간 동기화 (Week 15-16)
5. 고급 통계 대시보드 (Week 17-18)

---

**작성일**: 2025-10-31
**버전**: 1.0
**대상**: Phase 1 MVP 개발
