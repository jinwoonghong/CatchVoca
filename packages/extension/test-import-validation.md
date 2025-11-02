# Import/Export Data Validation Test Plan

## 개요
IMPORT_DATA 메시지 핸들러의 데이터 검증 기능 테스트

## 구현된 기능

### 1. JSON 파싱 검증
- **목적**: 입력 데이터가 유효한 JSON인지 확인
- **에러 처리**: 파싱 실패 시 `{ success: false, error: 'Invalid JSON format' }` 반환
- **지원 형식**: JSON 문자열 또는 객체

### 2. Snapshot 구조 검증 (validateSnapshotDetailed)
- **필수 필드 검증**:
  - `snapshotVersion`: number (현재 버전 1만 지원)
  - `wordEntries`: WordEntry[] 배열
  - `reviewStates`: ReviewState[] 배열
  - `createdAt`: valid timestamp

- **WordEntry 검증**:
  - 필수: id, word, normalizedWord, context, url, sourceTitle, language, tags, isFavorite, manuallyEdited, createdAt, updatedAt
  - 선택: definitions, phonetic, audioUrl, note, viewCount, lastViewedAt, deletedAt, contextSnapshot, selectionRange
  - 제약조건:
    - word: 1-50자
    - context: 1-500자
    - language: ISO 639-1 코드 (en, ja, zh, ko, es, fr, de, it, pt, ru)
    - tags: 최대 10개, 각 20자 이하
    - timestamps: 양수이며 현재+10년 이내

- **ReviewState 검증**:
  - 필수: id, wordId, nextReviewAt, interval, easeFactor, repetitions, history
  - 제약조건:
    - interval >= 0
    - easeFactor: 1.3 ~ 2.5
    - repetitions >= 0
    - history 각 항목: reviewedAt (timestamp), rating (1-5), interval (>=0)

### 3. 데이터 가져오기 전략
- **중복 처리**: 기존 ID가 있으면 업데이트 (최신 데이터 우선)
- **WordEntry**: `updatedAt` 비교
- **ReviewState**: `history.length` 비교
- **에러 처리**: 개별 항목 실패 시 계속 진행, 스킵 카운트 기록

### 4. 응답 형식
**성공**:
```json
{
  "success": true,
  "data": {
    "importedWords": 10,
    "importedReviews": 8,
    "skippedWords": 2,
    "skippedReviews": 1,
    "totalWords": 12,
    "totalReviews": 9
  }
}
```

**실패**:
```json
{
  "success": false,
  "error": "Invalid data format",
  "details": [
    {
      "field": "wordEntries[0]",
      "message": "Invalid word entry",
      "value": {...}
    }
  ]
}
```

## 테스트 케이스

### 케이스 1: 유효한 Snapshot 데이터
**입력**:
```json
{
  "snapshotVersion": 1,
  "wordEntries": [
    {
      "id": "test::https://example.com",
      "word": "test",
      "normalizedWord": "test",
      "definitions": ["테스트"],
      "language": "en",
      "context": "This is a test sentence.",
      "contextSnapshot": null,
      "url": "https://example.com",
      "sourceTitle": "Test Page",
      "selectionRange": null,
      "tags": ["test"],
      "isFavorite": false,
      "note": "",
      "manuallyEdited": false,
      "viewCount": 0,
      "createdAt": 1700000000000,
      "updatedAt": 1700000000000
    }
  ],
  "reviewStates": [],
  "createdAt": 1700000000000
}
```

**예상 결과**:
```json
{
  "success": true,
  "data": {
    "importedWords": 1,
    "importedReviews": 0,
    "skippedWords": 0,
    "skippedReviews": 0,
    "totalWords": 1,
    "totalReviews": 0
  }
}
```

### 케이스 2: 잘못된 JSON
**입력**: `"{invalid json}"`

**예상 결과**:
```json
{
  "success": false,
  "error": "Invalid JSON format"
}
```

### 케이스 3: 잘못된 snapshotVersion
**입력**:
```json
{
  "snapshotVersion": 2,
  "wordEntries": [],
  "reviewStates": [],
  "createdAt": 1700000000000
}
```

**예상 결과**:
```json
{
  "success": false,
  "error": "Invalid data format",
  "details": [
    {
      "field": "snapshotVersion",
      "message": "Unsupported snapshot version (expected: 1)",
      "value": 2
    }
  ]
}
```

### 케이스 4: 필수 필드 누락
**입력**:
```json
{
  "snapshotVersion": 1,
  "wordEntries": [
    {
      "id": "test::https://example.com",
      "word": "test"
      // normalizedWord, context, url 등 누락
    }
  ],
  "reviewStates": [],
  "createdAt": 1700000000000
}
```

**예상 결과**:
```json
{
  "success": false,
  "error": "Invalid data format",
  "details": [
    {
      "field": "wordEntries[0]",
      "message": "Invalid word entry",
      "value": {...}
    }
  ]
}
```

### 케이스 5: 단어 길이 제약 위반
**입력**: word가 51자 이상인 WordEntry

**예상 결과**: 검증 실패

### 케이스 6: 잘못된 언어 코드
**입력**: language가 "invalid"인 WordEntry

**예상 결과**: 검증 실패

### 케이스 7: ReviewState easeFactor 범위 위반
**입력**: easeFactor가 1.2 또는 2.6인 ReviewState

**예상 결과**: 검증 실패

### 케이스 8: 중복 데이터 업데이트
**전제조건**: DB에 이미 같은 ID의 WordEntry 존재 (updatedAt: 1700000000000)

**입력**: 같은 ID, 더 최신 updatedAt (1700000001000)

**예상 결과**: 기존 데이터 업데이트, importedWords: 1

### 케이스 9: 중복 데이터 스킵
**전제조건**: DB에 이미 같은 ID의 WordEntry 존재 (updatedAt: 1700000001000)

**입력**: 같은 ID, 더 오래된 updatedAt (1700000000000)

**예상 결과**: 기존 데이터 유지, skippedWords: 1

## 수동 테스트 방법

### Chrome Extension에서 테스트

1. **Extension 로드**:
   - Chrome에서 `chrome://extensions/` 접속
   - "개발자 모드" 활성화
   - "압축해제된 확장 프로그램을 로드합니다" 클릭
   - `packages/extension/dist` 폴더 선택

2. **개발자 도구 콘솔에서 테스트**:
```javascript
// 유효한 데이터 가져오기
chrome.runtime.sendMessage({
  type: 'IMPORT_DATA',
  data: {
    snapshotVersion: 1,
    wordEntries: [
      {
        id: "test::https://example.com",
        word: "test",
        normalizedWord: "test",
        definitions: ["테스트"],
        language: "en",
        context: "This is a test sentence.",
        contextSnapshot: null,
        url: "https://example.com",
        sourceTitle: "Test Page",
        selectionRange: null,
        tags: ["test"],
        isFavorite: false,
        note: "",
        manuallyEdited: false,
        viewCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ],
    reviewStates: [],
    createdAt: Date.now()
  }
}, (response) => {
  console.log('Import result:', response);
});

// 잘못된 버전 테스트
chrome.runtime.sendMessage({
  type: 'IMPORT_DATA',
  data: {
    snapshotVersion: 2,
    wordEntries: [],
    reviewStates: [],
    createdAt: Date.now()
  }
}, (response) => {
  console.log('Invalid version result:', response);
});

// 잘못된 JSON 테스트
chrome.runtime.sendMessage({
  type: 'IMPORT_DATA',
  data: "{invalid json}"
}, (response) => {
  console.log('Invalid JSON result:', response);
});
```

3. **Background Service Worker 로그 확인**:
   - `chrome://extensions/` → CatchVoca → "서비스 워커" 클릭
   - 콘솔에서 `[CatchVoca]` 로그 확인

## 검증 완료 사항

✅ JSON 파싱 검증 구현
✅ Snapshot 구조 검증 (validateSnapshotDetailed) 구현
✅ WordEntry 필수/선택 필드 검증
✅ ReviewState 필수/선택 필드 검증
✅ 제약조건 검증 (길이, 범위, 타입)
✅ 에러 상세 정보 반환
✅ 중복 데이터 처리 (최신 데이터 우선)
✅ 개별 항목 에러 처리
✅ 이벤트 발행 (sync:completed)
✅ TypeScript 타입 체크 통과
✅ 빌드 성공

## 다음 단계

Import/Export UI 구현 시 이 핸들러를 사용하여:
1. 파일 선택 → JSON 읽기
2. IMPORT_DATA 메시지 전송
3. 응답 확인 후 성공/실패 메시지 표시
4. importedWords, skippedWords 등 통계 표시
