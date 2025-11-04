# CatchVoca 개발 계획서

> **개발자용 간소화 문서** - 실제 구현을 위한 핵심 가이드

## 📌 프로젝트 개요

**CatchVoca**는 웹 브라우징 중 발견한 단어를 자동으로 수집하고, SM-2 알고리즘 기반 간격 반복 학습(SRS)으로 효과적으로 암기하는 Local-First 어휘 학습 크롬 확장 프로그램입니다.

### 핵심 차별점
- **자동 수집**: 텍스트 선택만으로 단어+뜻+문맥 자동 저장
- **Local-First**: IndexedDB가 SSOT, 오프라인 완벽 지원
- **과학적 복습**: SM-2 알고리즘으로 최적 복습 시점 계산
- **재학습 지원**: 이전에 저장한 단어 재발견 시 복습 유도

### 비즈니스 모델
```
무료: 1,000단어 제한, 광고 포함, 기본 기능, AI 분석 3회/일
Pro ($2.99/월): 무제한 단어, AI 분석 무제한, AI 하이라이트, 실시간 동기화, 광고 제거
```

**기능 차별화**:
- **AI 분석**: 무료 일일 3회 제한 → Pro 무제한 사용
- **AI 하이라이트**: Pro 전용 (녹색=학습완료, 노란색=추천 단어)
- **광고**: 무료는 퀴즈/내보내기/모바일 링크에 광고 → Pro는 완전 제거
- **단어 수**: 무료 1,000개 제한 → Pro 무제한

---

## 🏗️ 시스템 아키텍처

### 전체 구조 (v0.2.0)
```
Chrome Extension (통합)
├── Content Script: 텍스트 선택 감지
├── Background Worker: API 호출, 데이터 저장
└── Popup UI (React): 수집/관리/퀴즈/설정 통합

Core Package (로컬)
├── IndexedDB (Dexie): word_entries, review_states
├── SM-2 Engine: 복습 간격 계산
└── BroadcastChannel: 실시간 이벤트 동기화

Google Apps Script (Pro 전용)
└── 모바일 퀴즈 웹앱: Drive 스냅샷 저장/제공
```

### 데이터 흐름
```
1. 사용자 텍스트 선택
   ↓
2. Content Script 감지 → Background Worker
   ↓
3. 네이버 사전 API (Primary) → Dictionary API (Fallback)
   ↓
4. Dexie에 WordEntry 저장
   ↓
5. BroadcastChannel로 'word:created' 이벤트
   ↓
6. Popup UI 즉시 갱신
```

---

## 💾 데이터 모델

### WordEntry (단어 정보)
```typescript
interface WordEntry {
  id: string;                    // PK: "${normalizedWord}::${url}"
  word: string;                  // 원문
  normalizedWord: string;        // 소문자 정규화
  definitions?: string[];        // 정의 목록
  phonetic?: string;             // 발음기호
  audioUrl?: string;             // 발음 오디오
  language: string;              // 언어 코드 (en)
  context: string;               // 선택된 문장
  url: string;                   // 출처 URL
  sourceTitle: string;           // 페이지 제목
  tags: string[];                // 태그 배열
  viewCount?: number;            // 조회 횟수
  lastViewedAt?: number;         // 마지막 조회 시각
  createdAt: number;             // 생성 시각
  updatedAt: number;             // 수정 시각
  deletedAt?: number;            // 삭제 시각 (tombstone)
}
```

### ReviewState (SM-2 상태)
```typescript
interface ReviewState {
  id: string;                    // PK
  wordId: string;                // FK → WordEntry.id
  nextReviewAt: number;          // 다음 복습 시각 (timestamp)
  interval: number;              // 복습 간격 (일 단위)
  easeFactor: number;            // 난이도 계수 (1.3 ~ 2.5)
  repetitions: number;           // 성공 반복 횟수
  history: {                     // 복습 히스토리
    reviewedAt: number;
    rating: number;              // 평가 (1-4)
    interval: number;
  }[];
}
```

### Dexie 스키마
```typescript
const db = new Dexie('CheckVocaDB');

db.version(2).stores({
  word_entries: `
    &id,
    normalizedWord,
    url,
    createdAt,
    updatedAt,
    lastViewedAt,
    *tags
  `,
  review_states: `
    &id,
    wordId,
    nextReviewAt
  `
});
```

---

## 🎯 Phase 1 MVP (6주 개발 계획)

### Week 1-2: Core Package + 아키텍처 (현재 시작)
**목표**: 로컬 데이터 모델 및 SM-2 알고리즘 구현

#### 주요 작업
1. **프로젝트 초기 설정**
   - pnpm monorepo 구조 생성
   - TypeScript + Vite 설정
   - ESLint + Prettier 설정
   - 테스트 환경 (Vitest) 구축

2. **Dexie 스키마 구현**
   - `word_entries` 테이블
   - `review_states` 테이블
   - 인덱스 설정 및 마이그레이션 전략

3. **Repository 패턴 구현**
   ```typescript
   class WordRepository {
     async create(word: WordEntry): Promise<string>;
     async findById(id: string): Promise<WordEntry | null>;
     async findByNormalizedWord(word: string): Promise<WordEntry[]>;
     async update(id: string, changes: Partial<WordEntry>): Promise<void>;
     async delete(id: string): Promise<void>;
     async search(query: string): Promise<WordEntry[]>;
   }
   ```

4. **SM-2 알고리즘 구현**
   ```typescript
   function calculateNextReview(
     state: ReviewState,
     rating: number // 1-4
   ): ReviewState {
     // SM-2 계산 로직
   }
   ```

5. **BroadcastChannel 이벤트 버스**
   ```typescript
   type EventType = 'word:created' | 'word:updated' | 'word:deleted' | 'review:completed';

   class EventBus {
     emit(type: EventType, payload: any): void;
     on(type: EventType, handler: Function): void;
   }
   ```

**완료 기준**:
- ✅ Dexie 스키마 생성 및 마이그레이션 테스트 통과
- ✅ Repository CRUD 메서드 단위 테스트 100% 통과
- ✅ SM-2 알고리즘 계산 테스트 통과
- ✅ BroadcastChannel 이벤트 발송/수신 확인

---

### Week 3-4: Chrome Extension 통합 UI
**목표**: 웹페이지에서 단어 수집 + 통합 팝업 UI

#### 주요 작업
1. **Manifest V3 설정**
   ```json
   {
     "manifest_version": 3,
     "name": "CheckVoca",
     "version": "0.1.0",
     "permissions": ["storage", "contextMenus", "activeTab"],
     "host_permissions": ["https://*/*"],
     "content_scripts": [...],
     "background": { "service_worker": "background.js" }
   }
   ```

2. **Content Script (텍스트 선택)**
   - `mouseup` 이벤트로 텍스트 선택 감지
   - 선택 텍스트 정규화 (1-50자 검증)
   - Background Worker에 메시지 전송
   - 컨텍스트 메뉴 "CheckVoca에 저장" 추가

3. **Background Service Worker**
   - 네이버 사전 API 호출 (Primary)
     - URL: `https://en.dict.naver.com/api3/enko/search`
     - `declarativeNetRequest`로 Referer 헤더 설정
   - Dictionary API 호출 (Fallback)
     - URL: `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
   - 결과 병합: 네이버 정의 + 영어사전 발음
   - Dexie에 저장 + BroadcastChannel 이벤트 발송
   - 캐싱 전략 (10분 TTL)

4. **Popup UI (React + Vite)**
   - **수집 모드**: 단어 검색 → 정의 표시 → 저장
   - **관리 모드**: 단어 목록 → 검색/필터 → 태그 관리
   - **퀴즈 모드**: PC용 SM-2 퀴즈 UI
   - **설정 모드**: 동기화, Pro 업그레이드

5. **재학습 지원 기능** ⭐
   - 단어 검색 시 기존 학습 데이터 감지
   - 알림: "이미 학습한 단어입니다!"
   - 표시: 마지막 복습일, 복습 횟수, 숙련도, 다음 복습일
   - 옵션: [지금 복습하기] [나중에] [정의 보기]

**완료 기준**:
- ✅ 웹페이지에서 텍스트 선택 시 컨텍스트 메뉴 표시
- ✅ 네이버 사전 API → Fallback 정상 동작
- ✅ Popup UI에서 모든 모드 전환 가능
- ✅ 단어 저장 시 목록 즉시 갱신
- ✅ 재학습 알림 정상 작동

---

### Week 5-6: 모바일 퀴즈 (URL Hash 기반) ✅ **완료**
**목표**: 서버 불필요, 완전 로컬 기반 모바일 퀴즈 링크 공유

**완료 날짜**: 2025-01-XX
**구현 내용**:
- ✅ LZ-String 라이브러리 통합 (URL 압축)
- ✅ 모바일 퀴즈 링크 생성 서비스 (mobileQuizService.ts)
- ✅ LibraryTab에 "📱 모바일 퀴즈 링크 생성" 버튼 추가
- ✅ 모바일 PWA HTML 페이지 (public/mobile/index.html)
- ✅ Quiz.js 컴포넌트 (LZ-String 디코딩, 퀴즈 로직)
- ✅ PWA manifest.json (홈 화면 추가 지원)
- ✅ 단어 우선순위 정렬 (복습 예정 > easeFactor 낮은 순 > 최신순)
- ✅ URL 길이 검증 (2048자 제한)
- ✅ 클립보드 자동 복사 기능

#### 주요 작업
1. **LZ-String 라이브러리 추가**
   ```bash
   pnpm add lz-string
   pnpm add -D @types/lz-string
   ```

2. **링크 생성 함수 (Extension)**
   ```typescript
   import LZString from 'lz-string';

   async function generateQuizLink(): Promise<string> {
     // 복습 예정 단어 가져오기 (최대 50개)
     const dueWords = await reviewStateRepository.findDueReviews({ limit: 50 });

     // 필요한 데이터만 추출
     const snapshot = {
       words: dueWords.map(w => ({
         id: w.id,
         word: w.word,
         definitions: w.definitions,
         phonetic: w.phonetic,
         context: w.context
       })),
       createdAt: Date.now()
     };

     // 압축 (60% 압축률)
     const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(snapshot));

     // URL 생성 (최대 ~8000자, 브라우저 제한)
     return `https://catchvoca.app/quiz#data=${compressed}`;
   }
   ```

3. **Popup UI 통합**
   - "모바일 퀴즈" 버튼 추가
   - 클릭 시 링크 생성 → 클립보드 자동 복사
   - 토스트 알림: "링크가 복사되었습니다. 카카오톡에 공유하세요!"
   - Pro/무료 게이팅:
     - 무료: 3초 전면 광고 → 링크 생성
     - Pro: 즉시 링크 생성

4. **모바일 PWA 페이지**
   ```typescript
   // /quiz 페이지
   function parseQuizData(): Snapshot | null {
     const hash = window.location.hash.substring(6); // #data= 제거
     if (!hash) return null;

     try {
       const decompressed = LZString.decompressFromEncodedURIComponent(hash);
       return JSON.parse(decompressed);
     } catch (error) {
       console.error('Failed to parse quiz data', error);
       return null;
     }
   }

   function QuizPage() {
     const snapshot = parseQuizData();

     if (!snapshot) {
       return <ErrorScreen message="유효하지 않은 퀴즈 링크입니다" />;
     }

     // 24시간 제한 검증
     const isExpired = Date.now() - snapshot.createdAt > 24 * 60 * 60 * 1000;
     if (isExpired) {
       return <ErrorScreen message="만료된 링크입니다 (24시간 제한)" />;
     }

     return <MobileQuiz words={snapshot.words} />;
   }
   ```

5. **MobileQuiz 컴포넌트**
   - 세로 모드 전체 화면 UI
   - 터치 제스처: 왼쪽 스와이프 (다음), 오른쪽 스와이프 (이전)
   - 평가 버튼: [모름/어려움/보통/쉬움] (4단계)
   - 진행률 표시: N/M (진행도 바)
   - 완료 화면: 통계 요약 (정답률, 소요시간)

**완료 기준**:
- ✅ Extension "모바일 퀴즈" 버튼 클릭 → 링크 생성 및 복사
- ✅ 모바일에서 링크 접속 → 즉시 퀴즈 시작
- ✅ 50개 단어 정상 로드 (URL 길이 제한 통과)
- ✅ 터치 제스처 및 평가 버튼 동작
- ✅ 24시간 만료 검증 정상 작동
- ✅ Pro 게이팅 정상 작동 (무료 사용자 광고 표시)

**장점**:
- ✅ 서버 불필요 (100% 로컬)
- ✅ 개인정보 보호 극대화
- ✅ 오프라인 동작 가능
- ✅ 개발/유지보수 비용 제로
- ✅ 카카오톡 링크 공유 지원

**단점 및 제약**:
- ❌ URL 길이 제한 (~8000자, 최대 50단어)
- ❌ 카카오톡 링크 미리보기 불가능
- ℹ️ 향후 확장: 사용자 증가 시 서버 기반 옵션 추가 가능

---

## 🔑 핵심 기능 상세

### 1. 네이버 사전 API 통합 (Primary)
**목적**: 한국 사용자를 위한 한국어 정의 우선 제공

**API 엔드포인트**:
```
GET https://en.dict.naver.com/api3/enko/search?query={word}&m=pc&range=word
```

**문제점**: API가 Referer 체크를 하므로 크롬 확장에서 직접 호출 불가

**해결책**: `declarativeNetRequest` 사용
```json
// rule_endic.json
[
  {
    "id": 1,
    "priority": 1,
    "action": {
      "type": "modifyHeaders",
      "requestHeaders": [
        {
          "header": "Referer",
          "operation": "set",
          "value": "https://en.dict.naver.com/"
        }
      ]
    },
    "condition": {
      "urlFilter": "*://en.dict.naver.com/api3/enko/search*",
      "resourceTypes": ["xmlhttprequest"]
    }
  }
]
```

**응답 처리**:
```typescript
interface NaverWordItem {
  stems?: { match?: string }[];
  meansCollector?: {
    means?: { value?: string }[]
  }[];
  phoneticSymbol?: string;
}

function parseNaverResponse(response: NaverResponse): LookupResult {
  const items = response.searchResultMap?.searchResultListMap?.WORD?.items || [];
  const firstItem = items[0];

  const definitions = firstItem.meansCollector?.[0]?.means
    ?.map(m => sanitizeDefinition(m.value))
    .filter(Boolean) || [];

  const phonetic = firstItem.phoneticSymbol || firstItem.pronSymbol;

  return { definitions, phonetic };
}
```

**Fallback 전략**:
```typescript
async function lookupWord(word: string): Promise<LookupResult> {
  // 1. 캐시 확인
  const cached = cache.get(word.toLowerCase());
  if (cached) return cached;

  // 2. 네이버 시도
  try {
    const naverResult = await fetchNaverDictionary(word);
    if (naverResult.definitions.length > 0) {
      cache.set(word.toLowerCase(), naverResult);
      return naverResult;
    }
  } catch (error) {
    console.warn('Naver API failed, falling back to Dictionary API', error);
  }

  // 3. Dictionary API Fallback
  try {
    const dictResult = await fetchDictionaryAPI(word);
    cache.set(word.toLowerCase(), dictResult);
    return dictResult;
  } catch (error) {
    console.error('Both APIs failed', error);
    return { definitions: [], phonetic: undefined };
  }
}
```

---

### 2. SM-2 알고리즘 구현

**SuperMemo 2 알고리즘**: 과학적으로 검증된 간격 반복 학습 알고리즘

**핵심 공식**:
```typescript
function calculateNextReview(
  state: ReviewState,
  rating: number // 1: 모름, 2: 어려움, 3: 보통, 4: 쉬움
): ReviewState {
  let { interval, repetitions, easeFactor } = state;

  // 1. easeFactor 조정 (1.3 ~ 2.5)
  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  );

  // 2. 간격 계산
  if (rating < 3) {
    // 틀림: 리셋
    repetitions = 0;
    interval = 1;
  } else {
    // 맞음: 간격 증가
    repetitions++;
    if (repetitions === 1) {
      interval = 1;
    } else if (repetitions === 2) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }

  // 3. 다음 복습 시각
  const nextReviewAt = Date.now() + interval * 24 * 60 * 60 * 1000;

  return { interval, repetitions, easeFactor, nextReviewAt };
}
```

**테스트 케이스**:
```typescript
test('SM-2: 첫 번째 복습', () => {
  const state = { interval: 0, repetitions: 0, easeFactor: 2.5 };
  const result = calculateNextReview(state, 3); // Good
  expect(result.interval).toBe(1); // 1일
  expect(result.repetitions).toBe(1);
});

test('SM-2: 두 번째 복습', () => {
  const state = { interval: 1, repetitions: 1, easeFactor: 2.5 };
  const result = calculateNextReview(state, 3);
  expect(result.interval).toBe(6); // 6일
});

test('SM-2: 틀렸을 때 리셋', () => {
  const state = { interval: 10, repetitions: 5, easeFactor: 2.5 };
  const result = calculateNextReview(state, 1); // Again
  expect(result.interval).toBe(1);
  expect(result.repetitions).toBe(0);
});
```

---

### 3. BroadcastChannel 이벤트 동기화

**목적**: 확장 프로그램의 여러 컴포넌트(Popup, Content Script, Background) 간 실시간 데이터 동기화

**구현**:
```typescript
// EventBus.ts
const CHANNEL_NAME = 'checkvoca-cache';

class EventBus {
  private channel: BroadcastChannel;

  constructor() {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
  }

  emit(type: EventType, payload: any): void {
    this.channel.postMessage({
      type,
      payload,
      timestamp: Date.now()
    });
  }

  on(type: EventType, handler: (payload: any) => void): void {
    this.channel.onmessage = (event) => {
      if (event.data.type === type) {
        handler(event.data.payload);
      }
    };
  }
}

export const eventBus = new EventBus();
```

**사용 예시**:
```typescript
// Background Worker: 단어 저장 후
await db.wordEntries.add(wordEntry);
eventBus.emit('word:created', { id: wordEntry.id });

// Popup UI: 이벤트 수신
eventBus.on('word:created', async (payload) => {
  const newWord = await db.wordEntries.get(payload.id);
  setWords(prev => [newWord, ...prev]);
});
```

---

## 🧪 테스트 전략

### 단위 테스트 (Vitest)
**필수 커버리지**: 80% 이상

**주요 테스트 대상**:
- SM-2 알고리즘 계산
- Dexie Repository CRUD
- API Fallback 로직
- 단어 정규화 함수
- 충돌 해결 (LWW)

**예시**:
```typescript
// SM-2 테스트
describe('SM-2 Algorithm', () => {
  test('첫 복습은 1일 간격', () => {
    const result = calculateNextReview(initialState, 3);
    expect(result.interval).toBe(1);
  });

  test('틀리면 리셋', () => {
    const state = { interval: 10, repetitions: 5, easeFactor: 2.5 };
    const result = calculateNextReview(state, 1);
    expect(result.repetitions).toBe(0);
  });
});
```

### E2E 테스트 (Playwright)
**필수 시나리오**:
1. 웹페이지에서 단어 선택 → 저장 → Popup에서 확인
2. 퀴즈 시작 → 카드 답변 → 진행률 확인
3. 검색 → 필터링 → 태그 추가
4. Pro 게이팅: 무료 사용자가 AI 분석 클릭 → 모달 표시

---

## 📦 기술 스택

### 프론트엔드
- React 18+
- TypeScript 5+
- Vite 5+ (빌드)
- TailwindCSS 3+ (스타일링)
- Zustand 4+ (상태 관리)

### 백엔드/저장소
- Dexie.js (IndexedDB)
- Google Apps Script (모바일 퀴즈)
- Firestore (Pro 동기화, Phase 2)

### 외부 API
- 네이버 사전 API (Primary)
- Free Dictionary API (Fallback)
- Google Gemini 1.5 Flash (Pro AI 분석, Phase 2)

### 개발 도구
- pnpm (모노레포)
- Vitest (단위 테스트)
- Playwright (E2E 테스트)
- ESLint + Prettier

---

## 🚀 배포 전략

### Chrome Web Store
1. 개발자 계정 등록 ($5 일회성)
2. Extension 패키징 (manifest.json + 모든 assets)
3. 스크린샷 및 설명 작성
4. 리뷰 제출 (평균 1-3일)

### Vercel (Web App, Phase 2)
- GitHub 연동 자동 배포
- Hobby 플랜 (무료)

---

## 📊 성능 목표

| 항목 | 목표 | 측정 방법 |
|------|------|-----------|
| 단어 목록 로딩 | <500ms (1K 단어) | Performance API |
| 검색 응답 | <300ms | Performance API |
| 퀴즈 카드 전환 | <100ms | Performance API |
| 모바일 링크 생성 | <3초 (광고 포함) | Custom metric |
| IndexedDB 쿼리 | <200ms | Custom benchmark |

---

## 🔒 보안 고려사항

1. **로컬 데이터**: IndexedDB는 Same-Origin Policy로 자동 보호
2. **API 키**: manifest.json에 절대 포함 금지
3. **XSS 방지**: React의 기본 이스케이프 활용
4. **Firestore Rules**: 사용자별 데이터 격리
   ```typescript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/words/{wordId} {
         allow read, write: if request.auth.uid == userId;
       }
     }
   }
   ```

---

## 🚀 Phase 2 기능 계획 (v0.2.0 이후)

### Phase 2-A: Pro 사용자 관리 및 광고 시스템 (1주)
**목표**: 무료/Pro 기능 차별화 및 수익화 기반 구축

#### 핵심 작업
1. **Pro 상태 관리**
   - ProStatus 인터페이스 구현 (Stripe 연동)
   - Settings에 Pro 상태 저장/조회
   - Pro 게이팅 HOC 컴포넌트
   - 무료/Pro 기능 분리 체계

2. **광고 시스템 통합**
   - Google AdSense SDK 통합
   - 배너 광고 (퀴즈 화면 하단: 320x50 또는 728x90)
   - 전면 광고 (모바일 링크 생성, CSV 내보내기: 3초)
   - Pro 사용자 자동 광고 제거 로직

3. **Stripe 구독 관리**
   - Stripe Checkout 통합
   - 구독 상태 실시간 확인
   - 만료 처리 및 알림

---

### Phase 2-B: AI 웹페이지 분석 및 하이라이트 (2주) ✅ **완료**
**목표**: AI 기반 웹페이지 분석 및 학습 단어 하이라이트

**완료 날짜**: 2025-01-XX
**구현 내용**:
- ✅ Gemini 1.5 Flash API 통합 (geminiAPI.ts)
- ✅ 단어 중요도 알고리즘 구현 (COCA 40% + AWL 30% + TOEIC/TOEFL 20% + Gemini 10%)
- ✅ AI 사용량 관리 시스템 (무료: 3회/일, Pro: 무제한)
- ✅ AI 하이라이트 시스템 (녹색=학습완료, 노란색=추천 단어)
- ✅ Settings UI에 AI 설정 섹션 추가
- ✅ Pro/무료 기능 차별화 구현

#### Gemini API 통합
1. **API 프록시 구축** (Vercel Edge Function)
   ```typescript
   // api/gemini.ts (Vercel)
   export default async function handler(req: Request) {
     const { content } = await req.json();
     const apiKey = process.env.GEMINI_API_KEY; // 서버 측 보관

     const genAI = new GoogleGenerativeAI(apiKey);
     const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

     const result = await model.generateContent(
       `다음 웹페이지에서 학습할 만한 중요 단어를 추출하세요:\n\n${content}`
     );

     return new Response(JSON.stringify({ analysis: result.response.text() }));
   }
   ```

2. **페이지 분석 기능**
   - Content Script에서 전체 페이지 텍스트 추출
   - 중요 텍스트 우선순위 결정 (헤더, 본문, 리스트)
   - Gemini API 호출 (프롬프트 엔지니어링)
   - 분석 결과 캐싱 (IndexedDB)

3. **사용량 제한 시스템**
   ```typescript
   // Chrome Storage 기반 일일 사용량 추적
   interface AIUsage {
     date: string; // YYYY-MM-DD
     count: number;
   }

   async function checkDailyLimit(isPro: boolean): Promise<{ allowed: boolean; remaining: number }> {
     if (isPro) return { allowed: true, remaining: -1 };

     const today = new Date().toDateString();
     const { aiUsage } = await chrome.storage.local.get(['aiUsage']);

     if (aiUsage?.date !== today) {
       await chrome.storage.local.set({ aiUsage: { date: today, count: 0 } });
       return { allowed: true, remaining: 3 };
     }

     const remaining = 3 - aiUsage.count;
     return { allowed: remaining > 0, remaining };
   }
   ```

#### AI 단어 하이라이트
1. **하이라이트 시스템**
   - 🟢 **녹색 하이라이트**: 학습 완료 단어 (ReviewState 완료)
   - 🟡 **노란색 하이라이트**: 추천 학습 단어 (중요도 높음)
   - 호버 툴팁: 학습 정보 또는 중요도 점수

2. **중요도 알고리즘**
   ```typescript
   interface WordImportance {
     word: string;
     score: number; // 0-100
     factors: {
       cocaFrequency: number; // 40%
       awlIncluded: boolean; // 30%
       toeicToefl: boolean; // 20%
       geminiContext: number; // 10% (Pro만)
     };
   }

   function calculateImportance(word: string, context: string, isPro: boolean): number {
     let score = 0;

     // COCA 빈도 (40%)
     const cocaRank = getCOCARank(word);
     score += (1 - cocaRank / 60000) * 40;

     // AWL (30%)
     if (isInAWL(word)) score += 30;

     // 토익/토플 (20%)
     if (isInTOEICTOEFL(word)) score += 20;

     // Gemini 문맥 분석 (10%, Pro만)
     if (isPro) {
       const contextScore = await analyzeContextImportance(word, context);
       score += contextScore * 10;
     }

     return Math.round(score);
   }
   ```

3. **Content Script 하이라이트 렌더링**
   ```typescript
   function highlightWords(words: WordImportance[]) {
     const walker = document.createTreeWalker(
       document.body,
       NodeFilter.SHOW_TEXT
     );

     let node;
     while (node = walker.nextNode()) {
       words.forEach(({ word, score }) => {
         if (node.textContent?.includes(word)) {
           const color = score >= 70 ? '#FBBF24' : score >= 50 ? '#10B981' : null;
           if (color) highlightText(node, word, color);
         }
       });
     }
   }
   ```

---

### Phase 2-C: PDF 지원 및 특수키 조합 (2-3주) ✅ **완료**
**목표**: PDF 문서 내 단어 조회 및 사용자 정의 단축키

**완료 날짜**: 2025-01-XX
**구현 내용**:
- ✅ PDF 페이지 감지 시스템 (pdfDetector.ts)
- ✅ PDF 텍스트 선택 핸들러 (pdfTextHandler.ts)
- ✅ Chrome 내장 PDF 뷰어 및 PDF.js 지원
- ✅ 키보드 단축키 매니저 구현 (Ctrl+click, Alt+click)
- ✅ 빠른 조회 및 빠른 저장 기능
- ✅ Settings UI에 PDF/키보드 설정 섹션 추가

#### PDF 지원
1. **PDF 감지 및 처리**
   ```typescript
   async function detectPDFPage(): Promise<boolean> {
     return document.contentType === 'application/pdf';
   }

   // PDF.js 통합 (Chrome 내장 PDF 뷰어 분석)
   function extractPDFText(): string {
     const textLayer = document.querySelector('.textLayer');
     return textLayer?.textContent || '';
   }
   ```

2. **PDF 텍스트 레이어 접근**
   - Chrome 내장 PDF 뷰어 텍스트 레이어 분석
   - PDF.js API 활용 연구
   - 대안: 커스텀 PDF.js 뷰어 제공

#### 특수키 조합 기능
1. **KeyboardManager 서비스**
   ```typescript
   class KeyboardManager {
     private shortcuts: Map<string, () => void> = new Map();

     register(key: string, modifiers: string[], handler: () => void) {
       const combo = [...modifiers, key].join('+');
       this.shortcuts.set(combo, handler);
     }

     handleKeyDown(event: KeyboardEvent) {
       const modifiers = [];
       if (event.ctrlKey) modifiers.push('Ctrl');
       if (event.altKey) modifiers.push('Alt');
       if (event.shiftKey) modifiers.push('Shift');

       const combo = [...modifiers, event.key].join('+');
       const handler = this.shortcuts.get(combo);
       if (handler) {
         event.preventDefault();
         handler();
       }
     }
   }

   // 사용 예시
   const km = new KeyboardManager();
   km.register('D', ['Ctrl', 'Alt'], () => {
     const selectedText = window.getSelection()?.toString();
     if (selectedText) lookupWord(selectedText);
   });
   ```

2. **Settings UI 단축키 설정**
   - 키 조합 입력 컴포넌트
   - 충돌 검사 (브라우저 기본 단축키)
   - 사전 정의된 추천 단축키 목록

---

### Phase 2-D: 전역 단축키 및 고급 설정 (1주) ✅ **완료 (2025-01-XX)**
**목표**: Chrome Commands API 활용 전역 단축키 및 UX 개선

**구현 완료 사항**:
- ✅ Chrome Commands API 전역 단축키 (Ctrl+Shift+S 단어저장, Ctrl+Shift+Q 퀴즈시작)
- ✅ manifest.json commands 설정 완료
- ✅ Settings UI 단축키 커스터마이징 안내 추가
- ✅ 데이터 백업/복원 기능 (JSON export/import)
- ✅ backupService.ts 구현 (exportAllData, importAllData)
- ✅ Settings UI 백업/복원 버튼 추가
- ✅ 메시지 핸들러 통합 (EXPORT_ALL_DATA, IMPORT_ALL_DATA)

#### Chrome Commands 통합
1. **manifest.json 설정**
   ```json
   {
     "commands": {
       "toggle-extension": {
         "suggested_key": {
           "default": "Ctrl+Shift+V",
           "mac": "Command+Shift+V"
         },
         "description": "CatchVoca 활성/비활성 토글"
       },
       "quick-lookup": {
         "suggested_key": {
           "default": "Ctrl+Shift+D"
         },
         "description": "선택된 단어 즉시 조회"
       }
     }
   }
   ```

2. **Background Worker 핸들러**
   ```typescript
   chrome.commands.onCommand.addListener(async (command) => {
     if (command === 'toggle-extension') {
       const { isActive } = await chrome.storage.local.get(['isActive']);
       await chrome.storage.local.set({ isActive: !isActive });
       updateBadge(!isActive);
     } else if (command === 'quick-lookup') {
       const [tab] = await chrome.tabs.query({ active: true });
       chrome.tabs.sendMessage(tab.id, { type: 'QUICK_LOOKUP' });
     }
   });
   ```

3. **Badge 상태 표시**
   ```typescript
   async function updateBadge(isActive: boolean, wordCount: number = 0) {
     if (isActive) {
       chrome.action.setBadgeBackgroundColor({ color: '#10B981' }); // 녹색
       chrome.action.setBadgeText({ text: wordCount > 0 ? wordCount.toString() : '' });
     } else {
       chrome.action.setBadgeBackgroundColor({ color: '#6B7280' }); // 회색
       chrome.action.setBadgeText({ text: 'OFF' });
     }
   }
   ```

#### UX 개선
1. **온보딩 튜토리얼**
   - 단축키 가이드 모달
   - 첫 실행 시 설정 안내
   - 기능 소개 슬라이드

2. **설정 화면 개선**
   - 단축키 재설정 UI
   - 충돌 감지 및 대안 키 제안
   - 내보내기/가져오기 설정 백업

---

## 🎯 다음 단계 (이 문서 이후)

1. ✅ **프로젝트 구조 생성** (폴더, package.json)
2. ✅ **Dexie 스키마 구현 및 테스트**
3. ✅ **SM-2 알고리즘 구현 및 테스트**
4. ✅ **Content Script 구현** (Week 3-4 완료)
5. ✅ **Chrome Extension 완성** (Week 3-4 완료)
6. → **Week 5-6: Apps Script 모바일 퀴즈**
7. → **Phase 2: Pro 기능 및 고급 기능 구현**

---

## 📚 참고 자료

- [SM-2 Algorithm](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2)
- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Dexie.js Documentation](https://dexie.org/)
- [Google Apps Script Guide](https://developers.google.com/apps-script)

---

**작성일**: 2025-10-31
**버전**: 1.0
**대상**: 개발자 (Phase 1 MVP 구현)
