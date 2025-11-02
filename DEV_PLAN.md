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

### Week 5-6: Apps Script 모바일 퀴즈
**목표**: 모바일 전용 퀴즈 웹앱 (Pro 전용)

#### 주요 작업
1. **Apps Script 프로젝트 생성**
   - Google Apps Script 신규 프로젝트
   - 웹 앱으로 배포 (Anyone 접근)

2. **doPost() 구현 (스냅샷 저장)**
   ```javascript
   function doPost(e) {
     const data = JSON.parse(e.postData.contents);
     const snapshotId = Utilities.getUuid().substring(0, 8);
     const folder = getOrCreateFolder('CheckVoca_Snapshots');
     folder.createFile(`snapshot_${snapshotId}.json`, JSON.stringify(data.snapshot));

     // 캐싱
     CacheService.getUserCache().put(`meta_${snapshotId}`, metadata, 21600);

     return ContentService.createTextOutput(JSON.stringify({
       success: true,
       mobileUrl: `${webAppUrl}?id=${snapshotId}`
     }));
   }
   ```

3. **doGet() 구현 (모바일 웹앱 제공)**
   ```javascript
   function doGet(e) {
     const snapshotId = e.parameter.id;
     const metadata = CacheService.getUserCache().get(`meta_${snapshotId}`);
     const file = DriveApp.getFileById(metadata.fileId);
     const snapshot = file.getBlob().getDataAsString();

     const template = HtmlService.createTemplateFromFile('MobileQuiz');
     template.snapshot = snapshot;
     return template.evaluate();
   }
   ```

4. **MobileQuiz.html (모바일 최적화)**
   - 세로 모드 전체 화면 UI
   - 터치 버튼: [정답 보기] [모름/어려움/보통/쉬움]
   - SM-2 계산 (간단 버전, 로컬 실행)
   - 진행률 표시: N/M (진행도 바)
   - 완료 화면: 통계 요약

5. **Extension 통합**
   - Pro/무료 게이팅 시스템
   - 무료: 3초 인터스티셜 광고 → 30% Pro 제안
   - Pro: 광고 없이 즉시 생성
   - QR 코드 생성 (qrcode.react)
   - 링크 복사 버튼

**완료 기준**:
- ✅ Extension에서 스냅샷 POST 성공
- ✅ Drive에 JSON 파일 저장 확인
- ✅ 모바일에서 QR 스캔 → 퀴즈 페이지 로드
- ✅ 터치 버튼으로 퀴즈 완료 가능
- ✅ Pro 게이팅 정상 작동

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

## 🎯 다음 단계 (이 문서 이후)

1. ✅ **프로젝트 구조 생성** (폴더, package.json)
2. ✅ **Dexie 스키마 구현 및 테스트**
3. ✅ **SM-2 알고리즘 구현 및 테스트**
4. → **Content Script 구현 시작**

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
