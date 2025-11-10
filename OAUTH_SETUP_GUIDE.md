# Firebase OAuth 2.0 설정 가이드

## 개요
CatchVoca Extension의 Google 로그인 기능을 활성화하기 위한 Firebase OAuth 2.0 설정 가이드입니다.

## 현재 Firebase 프로젝트 정보
- **프로젝트 ID**: `catchvoca-6c9a8`
- **프로젝트 번호**: `967073037521`
- **Auth Domain**: `catchvoca-6c9a8.firebaseapp.com`

---

## 📝 설정 순서

### Step 1: Firebase Authentication 활성화

1. **Firebase Console 접속**: https://console.firebase.google.com
2. **프로젝트 선택**: `catchvoca-6c9a8`
3. **왼쪽 메뉴에서 `Build` → `Authentication` 클릭**
4. **"Get started" 버튼 클릭** (처음 사용하는 경우)
5. **"Sign-in method" 탭 클릭**
6. **Google 제공업체 활성화:**
   - "Google" 항목 클릭
   - "사용 설정" 토글 ON
   - "프로젝트 지원 이메일" 선택 (본인 이메일)
   - "저장" 클릭

✅ **완료 확인**: Sign-in method 목록에 Google이 "사용 설정됨"으로 표시

---

### Step 2: Chrome Extension 빌드 및 로드

Extension ID를 얻기 위해 먼저 Extension을 로드해야 합니다.

#### 2-1. Extension 빌드

```bash
cd d:\project\CatchVoca
pnpm --filter extension build
```

#### 2-2. Chrome에 Extension 로드

1. **Chrome 브라우저 열기**
2. **주소창에 입력**: `chrome://extensions/`
3. **우측 상단 "개발자 모드" 토글 ON**
4. **"압축해제된 확장 프로그램을 로드합니다." 클릭**
5. **폴더 선택**: `d:\project\CatchVoca\packages\extension\dist`
6. **Extension ID 복사**:
   - Extension 카드에서 ID 확인 (예: `abcdefghijklmnopqrstuvwxyzabcd`)
   - 메모장에 복사해두기

---

### Step 3: Google Cloud Console - OAuth Client ID 생성

Chrome Extension 전용 OAuth Client ID를 생성합니다.

#### 3-1. Google Cloud Console 접속

1. **Google Cloud Console**: https://console.cloud.google.com
2. **프로젝트 선택**: 상단 드롭다운에서 `catchvoca-6c9a8` 선택

#### 3-2. OAuth 동의 화면 구성 (처음 한 번만)

1. **왼쪽 메뉴**: `API 및 서비스` → `OAuth 동의 화면`
2. **사용자 유형 선택**: `외부` (개인 사용자) 또는 `내부` (조직 내)
3. **"만들기" 클릭**
4. **앱 정보 입력:**
   - 앱 이름: `CatchVoca`
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처 정보: 본인 이메일
5. **"저장 후 계속" 클릭**
6. **범위 추가** (선택사항, 나중에 추가 가능)
7. **"저장 후 계속" 클릭**
8. **테스트 사용자 추가** (외부 선택 시):
   - 본인 이메일 추가
   - "저장 후 계속" 클릭

#### 3-3. OAuth Client ID 생성

1. **왼쪽 메뉴**: `API 및 서비스` → `사용자 인증 정보`
2. **상단 "+ 사용자 인증 정보 만들기"** 클릭
3. **"OAuth 클라이언트 ID" 선택**
4. **애플리케이션 유형**: **"Chrome 앱"** 선택
5. **이름**: `CatchVoca Chrome Extension` 입력
6. **애플리케이션 ID**:
   - Step 2에서 복사한 Chrome Extension ID 입력
   - 예: `abcdefghijklmnopqrstuvwxyzabcd`
7. **"만들기" 클릭**
8. **생성된 Client ID 복사:**
   - 형식: `967073037521-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com`
   - 메모장에 복사해두기

---

### Step 4: manifest.json 업데이트

생성된 Client ID를 Extension에 설정합니다.

**파일 경로**: `d:\project\CatchVoca\packages\extension\public\manifest.json`

**수정할 부분** (79-85줄):

```json
"oauth2": {
  "client_id": "967073037521-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

**변경 사항**:
- `client_id`의 `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 부분을 Step 3에서 생성한 실제 Client ID로 교체

**예시**:
```json
"oauth2": {
  "client_id": "967073037521-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

---

### Step 5: Extension 재빌드 및 새로고침

```bash
# Extension 재빌드
pnpm --filter extension build

# Chrome에서 Extension 새로고침
# chrome://extensions/ 페이지에서 CatchVoca Extension의 "새로고침" 버튼 클릭
```

---

### Step 6: 모바일 PWA용 웹 애플리케이션 Client ID 생성 (선택사항)

모바일 PWA에서도 Google 로그인을 사용하려면 별도의 웹 애플리케이션 Client ID가 필요합니다.

#### 6-1. Web Application OAuth Client ID 생성

1. **Google Cloud Console**: `API 및 서비스` → `사용자 인증 정보`
2. **"+ 사용자 인증 정보 만들기"** → **"OAuth 클라이언트 ID"**
3. **애플리케이션 유형**: **"웹 애플리케이션"** 선택
4. **이름**: `CatchVoca Web App` 입력
5. **승인된 JavaScript 원본**:
   - `https://jinwoonghong.github.io`
   - `http://localhost:5173` (로컬 개발용)
6. **승인된 리디렉션 URI**:
   - `https://jinwoonghong.github.io/CatchVoca_quiz/`
   - `http://localhost:5173` (로컬 개발용)
7. **"만들기" 클릭**
8. **생성된 Client ID는 모바일 PWA 설정에서 사용** (현재는 Extension만 설정)

---

## 🧪 테스트

### Extension 로그인 테스트

1. **Chrome Extension 클릭** (브라우저 우측 상단)
2. **"퀴즈" 탭 선택**
3. **"📱 모바일 학습" 버튼 클릭**
4. **Google 로그인 팝업 확인:**
   - 구글 계정 선택 화면이 나타나야 함
   - 계정 선택 후 권한 승인
5. **로그인 성공 확인:**
   - 프로필 사진과 이름 표시
   - QR 코드 생성 성공

### 모바일 PWA 로그인 테스트 (Step 6 완료 후)

1. **모바일 PWA 접속**: QR 코드 스캔 또는 직접 URL 입력
2. **로그인 화면 확인**: "🔒 로그인이 필요합니다" 메시지
3. **"🔑 구글 로그인" 버튼 클릭**
4. **Google 로그인 완료 후 퀴즈 로드 확인**

---

## ❓ 트러블슈팅

### 문제 1: "Error: popup_closed_by_user"
- **원인**: 사용자가 로그인 팝업을 닫음
- **해결**: 다시 로그인 시도

### 문제 2: "Error: invalid_client"
- **원인**: Client ID가 잘못되었거나 Extension ID가 일치하지 않음
- **해결**:
  1. manifest.json의 client_id 확인
  2. Google Cloud Console에서 설정한 Extension ID 확인
  3. 두 값이 정확히 일치하는지 확인

### 문제 3: "This app isn't verified"
- **원인**: OAuth 동의 화면이 게시되지 않음 (외부 사용자 유형)
- **해결**:
  1. 테스트 사용자로 본인 이메일 추가
  2. 또는 "고급" → "CatchVoca로 이동(안전하지 않음)" 클릭 (개발 중에만)

### 문제 4: Firebase 권한 오류
- **원인**: Firebase Authentication이 활성화되지 않음
- **해결**: Step 1 다시 확인

---

## 📌 참고 링크

- **Firebase Console**: https://console.firebase.google.com
- **Google Cloud Console**: https://console.cloud.google.com
- **Chrome Identity API 문서**: https://developer.chrome.com/docs/extensions/reference/identity/
- **Firebase Auth 문서**: https://firebase.google.com/docs/auth/web/google-signin

---

## 🎉 완료 체크리스트

- [ ] Firebase Authentication에서 Google 제공업체 활성화
- [ ] Extension 빌드 및 Chrome에 로드
- [ ] Extension ID 확인
- [ ] Google Cloud Console에서 OAuth 동의 화면 구성
- [ ] Chrome 앱용 OAuth Client ID 생성
- [ ] manifest.json에 실제 Client ID 설정
- [ ] Extension 재빌드 및 새로고침
- [ ] Extension 로그인 테스트 성공
- [ ] (선택) 웹 앱용 OAuth Client ID 생성 (모바일 PWA)
- [ ] (선택) 모바일 PWA 로그인 테스트 성공

---

**작성일**: 2025-01-07
**프로젝트**: CatchVoca v0.5.0
**작성자**: Claude (AI Assistant)
