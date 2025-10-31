# CatchVoca Apps Script - 모바일 퀴즈

Google Apps Script 기반 모바일 간편 복습 시스템

## 📋 개요

Chrome Extension에서 생성한 단어 스냅샷을 Google Drive에 저장하고, 모바일 브라우저에서 간편하게 복습할 수 있는 웹앱입니다.

**주요 기능**:
- 📤 Chrome Extension → Apps Script 스냅샷 업로드
- 📱 모바일 최적화 퀴즈 UI
- 💾 Google Drive 자동 저장
- ⚡ 캐싱으로 빠른 로딩

## 🚀 배포 방법

### 1. Google Apps Script 프로젝트 생성

1. [Google Apps Script](https://script.google.com/) 접속
2. "새 프로젝트" 클릭
3. 프로젝트 이름: `CatchVoca Mobile Quiz`

### 2. 코드 업로드

#### 방법 A: 수동 복사 (권장)

1. Apps Script 에디터에서 기본 `Code.gs` 파일 열기
2. `src/Code.js` 내용 전체 복사하여 붙여넣기
3. "+" 버튼 클릭 → "HTML" 선택 → 파일 이름: `QuizUI`
4. `src/QuizUI.html` 내용 전체 복사하여 붙여넣기
5. 저장 (Ctrl+S)

#### 방법 B: clasp CLI 사용

```bash
# 1. clasp 설치 (최초 1회)
npm install -g @google/clasp

# 2. Google 계정 로그인
clasp login

# 3. 새 프로젝트 생성
clasp create --title "CatchVoca Mobile Quiz" --type webapp

# 4. 코드 업로드
clasp push

# 5. 배포
clasp deploy --description "v1.0.0"
```

### 3. 웹앱 배포

1. Apps Script 에디터 우측 상단 "배포" 클릭 → "새 배포"
2. 설정:
   - **유형**: 웹 앱
   - **실행 권한**: 사용자 (나)
   - **액세스 권한**: 모든 사용자
3. "배포" 클릭
4. **웹 앱 URL 복사** (예: `https://script.google.com/macros/s/.../exec`)

### 4. Chrome Extension 설정

1. **웹 앱 URL 업데이트**:
   ```typescript
   // packages/extension/src/background/index.ts
   const appsScriptUrl = 'YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
   ```
   → 복사한 웹 앱 URL로 변경

2. Extension 재빌드:
   ```bash
   cd packages/extension
   pnpm run build
   ```

3. Chrome에서 Extension 새로고침

## 🎯 사용 방법

### Chrome Extension에서 스냅샷 생성

1. Chrome Extension 팝업 열기
2. "설정" 탭 이동
3. "📱 모바일 퀴즈" 섹션에서 "📤 모바일 퀴즈 생성" 클릭
4. 생성된 URL 복사

### 모바일에서 복습

1. 복사한 URL을 모바일 브라우저에 입력
2. 복습 대기 중인 단어가 표시됨
3. "답안 보기" → 정의 확인
4. 4단계 평가 (❌ 전혀 / 😓 어려움 / 🤔 보통 / ✅ 쉬움)

## 🔧 기술 스택

- **Google Apps Script**: 서버리스 백엔드
- **Google Drive API**: 스냅샷 저장소
- **CacheService**: 6시간 캐싱
- **HTML Service**: 모바일 UI

## 📂 프로젝트 구조

```
packages/apps-script/
├── src/
│   ├── Code.js          # 백엔드 로직 (doGet/doPost)
│   └── QuizUI.html      # 모바일 퀴즈 UI
├── appsscript.json      # Apps Script 설정
├── package.json         # npm 설정
└── README.md           # 이 파일
```

## 🔐 보안 및 권한

**필요한 권한**:
- `DriveApp`: 스냅샷 파일 저장 (CatchVoca_Snapshots 폴더)
- `ScriptApp`: 웹 앱 URL 생성
- `CacheService`: 캐싱

**데이터 보호**:
- 모든 스냅샷은 사용자의 개인 Drive에 저장
- 파일 공유 설정: "링크가 있는 모든 사용자" (보기 권한)
- 스냅샷 ID는 타임스탬프 기반 고유 ID

## 🐛 문제 해결

### Q: "스냅샷 업로드에 실패했습니다" 오류

**A**: Apps Script URL이 올바르게 설정되었는지 확인
   ```typescript
   // packages/extension/src/background/index.ts
   const appsScriptUrl = 'https://script.google.com/macros/s/.../exec';
   ```

### Q: "Snapshot not found" 오류

**A**:
1. Drive에 `CatchVoca_Snapshots` 폴더가 있는지 확인
2. 스냅샷 파일이 존재하는지 확인
3. 캐시 문제일 경우 6시간 후 다시 시도

### Q: 모바일 UI가 깨짐

**A**:
1. 브라우저 호환성 확인 (Chrome/Safari/Firefox 최신 버전 권장)
2. viewport 메타 태그 확인
3. 하드 리프레시 (Ctrl+Shift+R)

## 📝 API 명세

### POST /exec (스냅샷 저장)

**Request**:
```json
{
  "words": [
    {
      "id": "uuid",
      "word": "example",
      "definitions": ["정의1", "정의2"],
      "phonetic": "/ɪɡˈzæmpəl/",
      "context": "문맥...",
      ...
    }
  ],
  "reviewStates": {
    "word-id": {
      "wordId": "uuid",
      "nextReviewAt": 1234567890,
      "interval": 1,
      ...
    }
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "snapshotId": "snapshot_1234567890",
    "mobileUrl": "https://script.google.com/macros/s/.../exec?snapshot=snapshot_1234567890",
    "fileId": "drive-file-id",
    "createdAt": 1234567890,
    "wordCount": 42
  }
}
```

### GET /exec?snapshot=ID (모바일 퀴즈)

**Parameters**:
- `snapshot`: 스냅샷 ID

**Response**: HTML 페이지 (모바일 퀴즈 UI)

## 🔄 업데이트 가이드

코드 변경 후 재배포:

```bash
# 1. 코드 업로드
clasp push

# 2. 새 버전 배포
clasp deploy --description "v1.1.0"

# 3. 이전 버전 제거 (선택)
clasp deployments          # 배포 ID 확인
clasp undeploy <deployment-id>
```

## 📊 성능 최적화

- **CacheService**: 6시간 캐싱으로 Drive API 호출 최소화
- **파일 크기**: JSON 스냅샷 압축 (평균 10-50KB)
- **로딩 시간**: 캐시 히트 시 <500ms, 미스 시 ~2초

## 📄 라이선스

MIT License - CatchVoca Project
