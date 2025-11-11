# CatchVoca 로컬 설치 가이드

> Chrome 웹 스토어에 배포되기 전, 다른 PC에서 CatchVoca를 테스트하는 방법입니다.

## 📋 사전 요구사항

- **Node.js**: 18.0.0 이상
- **pnpm**: 8.0.0 이상
- **Chrome 브라우저**
- **Git**

### 버전 확인 방법

```bash
# Node.js 버전 확인
node --version
# v18.0.0 이상이어야 합니다

# pnpm 버전 확인
pnpm --version
# 8.0.0 이상이어야 합니다

# pnpm이 설치되지 않았다면
npm install -g pnpm
```

---

## 🚀 설치 방법

### 1. 저장소 클론

```bash
git clone https://github.com/jinwoonghong/CatchVoca.git
cd CatchVoca
```

**오류 발생 시**:
- `git: command not found` → Git 설치 필요: https://git-scm.com/downloads
- `Permission denied` → 관리자 권한으로 실행 또는 다른 디렉토리 선택

### 2. 올바른 브랜치로 전환

```bash
# 최신 안정 버전 브랜치로 전환
git checkout main
```

**주의**: 특정 개발 브랜치를 테스트하려는 경우 별도로 안내받은 브랜치명을 사용하세요.

### 3. 의존성 설치

```bash
# 프로젝트 의존성 설치
pnpm install
```

**예상 소요 시간**: 2-5분 (네트워크 속도에 따라 다름)

**설치 중 발생 가능한 오류**:

#### ❌ `ERR_PNPM_NO_MATCHING_VERSION`
```bash
# 원인: pnpm 버전이 8.0.0 미만
# 해결: pnpm 업데이트
npm install -g pnpm@latest
pnpm install
```

#### ❌ `EACCES` 권한 오류
```bash
# 원인: npm 글로벌 디렉토리 권한 문제
# 해결: npx 사용하거나 관리자 권한으로 실행
npx pnpm install
```

#### ❌ `Network error` / `ETIMEDOUT`
```bash
# 원인: 네트워크 연결 불안정 또는 방화벽
# 해결: 재시도 또는 npm registry 변경
pnpm install --registry https://registry.npmjs.org
```

### 4. 환경 변수 설정 ⚙️

**`.env` 파일 생성** (`packages/extension/.env`)

#### Windows 사용자:
```bash
# packages/extension 디렉토리로 이동
cd packages\extension

# .env 파일 생성
echo VITE_GEMINI_API_KEY=your_gemini_api_key_here > .env
echo VITE_VERCEL_API_URL=https://catchvoca-server.vercel.app >> .env
```

#### Mac/Linux 사용자:
```bash
# packages/extension 디렉토리로 이동
cd packages/extension

# .env 파일 생성
cat > .env << EOF
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_VERCEL_API_URL=https://catchvoca-server.vercel.app
EOF
```

#### 또는 텍스트 에디터로 직접 생성:
1. `packages/extension/` 폴더에 `.env` 파일 생성
2. 다음 내용 입력:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_VERCEL_API_URL=https://catchvoca-server.vercel.app
```

**Gemini API Key 발급 방법**:
1. https://aistudio.google.com/app/apikey 접속
2. Google 계정으로 로그인
3. **"Create API Key"** 클릭
4. 생성된 키를 복사하여 `.env` 파일의 `your_gemini_api_key_here` 부분에 붙여넣기

**예시**:
```env
VITE_GEMINI_API_KEY=AIzaSyDXXXXXXXXXXXXXXXXXXXXXXXXXXXX
VITE_VERCEL_API_URL=https://catchvoca-server.vercel.app
```

> **참고**:
> - API 키 없이도 기본 기능(단어 수집, 관리, 복습)은 사용 가능합니다.
> - AI 분석 기능만 API 키가 필요합니다.
> - `.env` 파일은 Git에 추적되지 않습니다 (보안상 안전).

### 5. 빌드 🔨

프로젝트 루트 디렉토리로 돌아가서 빌드:

```bash
# 프로젝트 루트로 이동
cd ../..

# 확장 프로그램 빌드
pnpm build:extension
```

**예상 소요 시간**: 30초 - 2분

**빌드 성공 메시지**:
```
✓ built in 6.51s
Done
```

빌드가 완료되면 `packages/extension/dist` 폴더가 생성됩니다.

**빌드 중 발생 가능한 오류**:

#### ❌ TypeScript 컴파일 오류
```bash
# 원인: 타입 정의 파일 누락 또는 버전 불일치
# 해결: node_modules 삭제 후 재설치
rm -rf node_modules packages/*/node_modules
pnpm install
pnpm build:extension
```

#### ❌ Vite 빌드 오류
```bash
# 원인: .env 파일 형식 오류 또는 경로 문제
# 해결: .env 파일 위치 확인
# 정확한 경로: packages/extension/.env

# .env 파일 존재 확인 (Windows)
dir packages\extension\.env

# .env 파일 존재 확인 (Mac/Linux)
ls -la packages/extension/.env
```

#### ❌ `Error: ENOENT: no such file or directory`
```bash
# 원인: 빌드 대상 디렉토리가 없음
# 해결: packages/extension 디렉토리 존재 확인
ls packages/extension/
# 또는
dir packages\extension\
```

---

## 🔧 Chrome 확장 프로그램 로드

### 1. Chrome 확장 프로그램 페이지 열기

```
chrome://extensions/
```

또는 메뉴 → 도구 더보기 → 확장 프로그램

### 2. 개발자 모드 활성화

우측 상단의 **"개발자 모드"** 토글 ON

### 3. 압축 해제된 확장 프로그램 로드

1. **"압축 해제된 확장 프로그램을 로드합니다"** 클릭
2. `CatchVoca/packages/extension/dist` 폴더 선택
3. "폴더 선택" 클릭

### 4. 확장 프로그램 확인

- CatchVoca 아이콘이 툴바에 표시됩니다
- 버전 1.0.0이 맞는지 확인하세요

---

## ✅ 테스트 체크리스트

### 기본 기능
- [ ] 웹페이지에서 텍스트 드래그 시 툴팁 표시
- [ ] 단어 저장 기능
- [ ] 팝업에서 저장된 단어 확인
- [ ] 단어 검색 기능
- [ ] 단어 삭제 기능

### AI 기능 (Gemini API Key 필요)
- [ ] AI 웹페이지 분석
- [ ] 추천 단어 하이라이트
- [ ] 일일 사용량 제한 (무료 3회)

### 복습 기능
- [ ] 퀴즈 시작
- [ ] SM-2 평가 (Again, Hard, Good, Easy)
- [ ] 다음 복습 일정 자동 계산

### 동기화 기능
- [ ] Google 로그인
- [ ] 수동 동기화
- [ ] 자동 동기화 설정

### 내보내기 기능
- [ ] CSV 내보내기
- [ ] Anki 덱 내보내기
- [ ] Quizlet 세트 내보내기

---

## 🔄 업데이트 방법

새 버전을 테스트하려면:

```bash
# 최신 코드 가져오기
git pull origin 모바일-단어-기능

# 의존성 업데이트
pnpm install

# 다시 빌드
pnpm build:extension
```

Chrome 확장 프로그램 페이지에서 **새로고침** 버튼 클릭

---

## 🐛 문제 해결

### Chrome 확장 프로그램 로드 오류

#### ❌ "Manifest file is missing or unreadable"

**원인**: `dist` 폴더가 올바르게 생성되지 않음

**해결 방법**:
```bash
# 1. dist 폴더 확인
ls packages/extension/dist/manifest.json
# 또는 Windows
dir packages\extension\dist\manifest.json

# 2. 파일이 없다면 빌드 다시 실행
pnpm build:extension

# 3. 빌드 캐시 문제라면 클린 후 재빌드
pnpm clean
pnpm install
pnpm build:extension
```

#### ❌ "Failed to load extension"

**원인**: 개발자 모드가 비활성화되어 있거나 잘못된 폴더 선택

**해결 방법**:
1. Chrome 확장 프로그램 페이지(`chrome://extensions/`)에서 개발자 모드 활성화
2. `packages/extension/dist` 폴더를 선택했는지 확인 (상위 폴더 선택 시 오류)
3. 폴더 경로에 한글이나 특수문자가 있다면 영문 경로로 이동 후 재시도

#### ❌ "Package is invalid. Details: 'Cannot load extension with file or directory name _metadata'"

**원인**: Chromium 기반 브라우저가 아니거나 잘못된 manifest 버전

**해결 방법**:
```bash
# manifest.json 확인
cat packages/extension/dist/manifest.json | grep "manifest_version"
# 출력: "manifest_version": 3

# manifest_version이 3이 아니라면 빌드 재실행
pnpm build:extension
```

### AI 분석 기능 오류

#### ❌ "AI 분석 실패: API key not configured"

**원인**: Gemini API Key가 설정되지 않음

**해결 방법**:
```bash
# 1. .env 파일 존재 확인
cat packages/extension/.env
# 또는 Windows
type packages\extension\.env

# 2. API 키 형식 확인
# 올바른 형식: VITE_GEMINI_API_KEY=AIzaSy...
# 잘못된 형식: VITE_GEMINI_API_KEY="AIzaSy..." (따옴표 X)

# 3. .env 파일 수정 후 반드시 재빌드
pnpm build:extension

# 4. Chrome에서 확장 프로그램 새로고침
```

#### ❌ "API key invalid" 또는 "PERMISSION_DENIED"

**원인**: Gemini API Key가 잘못되었거나 만료됨

**해결 방법**:
1. https://aistudio.google.com/app/apikey 에서 키 재확인
2. 새 API Key 생성 후 `.env` 파일 업데이트
3. `pnpm build:extension` 재실행
4. Chrome 확장 프로그램 새로고침

#### ❌ "QUOTA_EXCEEDED" 오류

**원인**: Gemini API 무료 할당량 초과

**해결 방법**:
- 일일 할당량 소진: 다음 날까지 대기
- 또는 Google Cloud Console에서 유료 플랜으로 업그레이드

### 동기화 기능 오류

#### ❌ "동기화 실패: Network error"

**원인**: Firebase 서버 연결 실패 또는 네트워크 문제

**해결 방법**:
```bash
# 1. 네트워크 연결 확인
ping google.com

# 2. Firebase 서버 상태 확인
curl https://firebase.google.com

# 3. 방화벽 설정 확인
# Firebase Realtime Database 도메인 허용 필요:
# - *.firebaseio.com
# - *.googleapis.com
```

#### ❌ "Google 로그인 실패"

**원인**: OAuth 클라이언트 ID 설정 오류 또는 Chrome identity API 권한 부족

**해결 방법**:
1. `manifest.json`에 `oauth2` 설정 확인:
```bash
cat packages/extension/dist/manifest.json | grep -A 5 "oauth2"
```

2. Chrome 확장 프로그램 권한에서 `identity` 권한 확인

3. 재로그인 시도:
   - Settings 탭 → 로그아웃 → 다시 로그인

#### ❌ "PERMISSION_DENIED: Client doesn't have permission"

**원인**: Firebase Realtime Database 규칙 설정 문제

**해결 방법**:
- Firebase Console에서 Database Rules 확인
- 인증된 사용자만 읽기/쓰기 가능하도록 설정되어 있는지 확인
- 문제 지속 시: 프로젝트 관리자에게 문의

### 빌드 시스템 오류

#### ❌ `pnpm: command not found`

**원인**: pnpm이 설치되지 않음

**해결 방법**:
```bash
# npm을 통해 pnpm 설치
npm install -g pnpm

# 설치 확인
pnpm --version
```

#### ❌ `ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`

**원인**: Monorepo 패키지 중 하나에서 빌드 실패

**해결 방법**:
```bash
# 1. 개별 패키지 빌드로 오류 위치 확인
pnpm --filter @catchvoca/types build
pnpm --filter @catchvoca/core build
pnpm --filter extension build

# 2. 오류가 발생한 패키지의 node_modules 삭제 후 재설치
rm -rf packages/[패키지명]/node_modules
pnpm install

# 3. 전체 재빌드
pnpm build
```

#### ❌ TypeScript `Cannot find module '@catchvoca/types'`

**원인**: Monorepo 패키지 간 의존성 문제

**해결 방법**:
```bash
# 1. types 패키지 먼저 빌드
pnpm --filter @catchvoca/types build

# 2. core 패키지 빌드
pnpm --filter @catchvoca/core build

# 3. extension 빌드
pnpm --filter extension build

# 또는 전체 순서대로 빌드
pnpm build
```

### 런타임 오류

#### ❌ "IndexedDB quota exceeded"

**원인**: 브라우저 저장 공간 부족

**해결 방법**:
```javascript
// Chrome 콘솔에서 실행
// 1. 저장 공간 확인
navigator.storage.estimate().then(estimate => {
  console.log(`사용: ${estimate.usage / 1024 / 1024} MB`);
  console.log(`할당: ${estimate.quota / 1024 / 1024} MB`);
});

// 2. 불필요한 데이터 삭제
chrome.storage.local.clear();

// 3. 또는 Chrome 설정 → 개인정보 보호 → 쿠키 및 사이트 데이터 → CatchVoca 데이터 삭제
```

#### ❌ "Service worker registration failed"

**원인**: Background script 로드 실패

**해결 방법**:
1. Chrome 확장 프로그램 페이지에서 "오류" 탭 확인
2. Service Worker 콘솔에서 상세 오류 확인
3. 확장 프로그램 제거 후 재설치
4. Chrome 재시작

#### ❌ Content Script가 페이지에서 작동하지 않음

**원인**: Content Script injection 실패 또는 페이지 권한 문제

**해결 방법**:
1. 페이지 새로고침 (F5)
2. `manifest.json`의 `content_scripts` 설정 확인
3. 특정 사이트에서만 문제 발생 시: 해당 사이트의 CSP(Content Security Policy) 확인
4. Chrome 콘솔에서 오류 메시지 확인

### Windows 특화 문제

#### ❌ `'rm' is not recognized as an internal or external command`

**원인**: Windows에서 Linux 명령어 사용

**해결 방법**:
```bash
# rm 대신 사용
rmdir /s /q node_modules

# 또는 PowerShell 사용
Remove-Item -Recurse -Force node_modules

# 또는 Git Bash 사용 (Git 설치 시 포함)
```

#### ❌ 경로 구분자 오류 (`/` vs `\`)

**원인**: Windows 경로 구분자 차이

**해결 방법**:
```bash
# Windows CMD에서는 \ 사용
cd packages\extension

# PowerShell이나 Git Bash에서는 / 사용 가능
cd packages/extension
```

---

## 📱 모바일 퀴즈 테스트 (선택 사항)

1. 설정 탭에서 Google 로그인
2. "모바일 퀴즈 링크 생성" 클릭
3. QR 코드 스캔 또는 URL 복사
4. 모바일 브라우저에서 접속

---

## 💡 유용한 팁

### 개발자 콘솔 확인

- **Popup 콘솔**: 팝업 우클릭 → 검사
- **Background 콘솔**: chrome://extensions/ → CatchVoca → "service worker" 클릭
- **Content Script 콘솔**: 웹페이지 → F12 → Console 탭

### 로그 확인

모든 로그는 `[CatchVoca]` 또는 `[ComponentName]` 접두어가 붙습니다:
- `[Background]` - 백그라운드 작업
- `[Content]` - 컨텐츠 스크립트
- `[Popup]` - 팝업 UI
- `[SyncService]` - 동기화 서비스

### 스토리지 초기화

완전히 새로 시작하고 싶다면:

```javascript
// Chrome 콘솔에서 실행
chrome.storage.local.clear()
```

---

## 🔍 추가 디버깅 방법

### Chrome 콘솔 로그 확인

**Popup 콘솔**:
1. CatchVoca 아이콘 클릭 → 팝업 열기
2. 팝업 우클릭 → "검사"
3. Console 탭에서 로그 확인

**Background Service Worker 콘솔**:
1. `chrome://extensions/` 접속
2. CatchVoca 찾기
3. "service worker" 링크 클릭
4. DevTools에서 로그 확인

**Content Script 콘솔**:
1. 웹페이지에서 F12 눌러 DevTools 열기
2. Console 탭에서 `[CatchVoca]` 또는 `[Content]` 로그 필터링

### 로그 레벨별 의미

- `[DEBUG]`: 개발용 상세 로그
- `[INFO]`: 일반 정보 (정상 작동)
- `[WARN]`: 경고 (기능 작동하지만 주의 필요)
- `[ERROR]`: 오류 (기능 작동 실패)

### 완전 초기화 방법

모든 데이터를 삭제하고 처음부터 시작하려면:

```javascript
// Chrome 콘솔에서 실행
// 1. 로컬 스토리지 초기화
chrome.storage.local.clear(() => {
  console.log('Local storage cleared');
});

// 2. IndexedDB 초기화
indexedDB.deleteDatabase('CheckVocaDB').onsuccess = () => {
  console.log('IndexedDB cleared');
};

// 3. 확장 프로그램 재로드
chrome.runtime.reload();
```

또는 Chrome 설정에서:
1. 설정 → 개인정보 보호 → 쿠키 및 기타 사이트 데이터
2. "모든 사이트 데이터 및 권한 보기"
3. "chrome-extension://[CatchVoca ID]" 검색
4. 삭제 버튼 클릭

---

## 📋 설치 체크리스트

설치 과정에서 다음 항목들을 확인하세요:

- [ ] Node.js 18.0.0 이상 설치됨
- [ ] pnpm 8.0.0 이상 설치됨
- [ ] Git 설치됨
- [ ] 저장소 클론 완료
- [ ] `pnpm install` 성공 (오류 없음)
- [ ] `.env` 파일 생성 (`packages/extension/.env`)
- [ ] Gemini API Key 설정 (선택 사항)
- [ ] `pnpm build:extension` 성공
- [ ] `packages/extension/dist/manifest.json` 파일 존재
- [ ] Chrome 개발자 모드 활성화
- [ ] 확장 프로그램 로드 성공
- [ ] CatchVoca 아이콘 툴바에 표시됨
- [ ] 팝업 열림 확인

---

## 🌐 네트워크 환경별 설정

### 회사/학교 방화벽 환경

방화벽이 있는 환경에서 다음 도메인 허용 필요:

**필수**:
- `registry.npmjs.org` (pnpm 패키지 다운로드)
- `*.firebaseio.com` (동기화 기능)
- `*.googleapis.com` (Gemini AI, OAuth)

**선택**:
- `aistudio.google.com` (Gemini API Key 발급)
- `en.dict.naver.com` (네이버 사전 API)
- `api.dictionaryapi.dev` (무료 사전 API)

### 프록시 환경

프록시를 사용하는 경우:

```bash
# npm/pnpm 프록시 설정
pnpm config set proxy http://proxy.company.com:8080
pnpm config set https-proxy http://proxy.company.com:8080

# 프록시 인증이 필요한 경우
pnpm config set proxy http://username:password@proxy.company.com:8080
```

---

## 📞 문제 발생 시

### 버그 리포트 작성 방법

GitHub Issues에 제출 시 다음 정보를 포함해주세요:

**1. 환경 정보**:
```
- OS: Windows 11 / macOS 14.0 / Ubuntu 22.04
- Chrome 버전: 120.0.6099.109
- Node.js 버전: v18.17.0
- pnpm 버전: 8.10.0
```

**2. 재현 단계**:
```
1. CatchVoca 아이콘 클릭
2. AI 분석 탭 선택
3. "웹페이지 분석" 버튼 클릭
4. 오류 발생
```

**3. 에러 메시지**:
- Console 로그 스크린샷
- Service Worker 콘솔 로그
- Chrome 확장 프로그램 오류 탭

**4. 예상 동작 vs 실제 동작**:
- 예상: AI 분석 결과 표시
- 실제: "API key not configured" 오류

**GitHub Issues**: https://github.com/jinwoonghong/CatchVoca/issues

---

## 🎉 설치 완료!

이제 CatchVoca를 사용할 준비가 되었습니다!

### 빠른 시작

1. **단어 저장**: 웹페이지에서 단어 드래그 → 팝업에서 저장
2. **AI 분석**: 팝업 → AI 탭 → "웹페이지 분석" 클릭
3. **복습하기**: 팝업 → 퀴즈 탭 → SM-2 평가로 복습
4. **동기화**: 설정 탭 → Google 로그인 → 자동 동기화

### 단축키

- **팝업 열기**: `Ctrl+Shift+V` (Windows/Linux) / `Cmd+Shift+V` (Mac)
- **페이지 새로고침**: `F5`
- **DevTools 열기**: `F12`

문제가 발생하면 위의 "문제 해결" 섹션을 참고하세요!
