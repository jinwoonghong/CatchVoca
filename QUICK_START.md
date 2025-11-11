# CatchVoca OAuth 설정 빠른 시작 가이드

## 🚀 5분 만에 OAuth 설정 완료하기

이 가이드를 따라하면 Google 로그인 기능을 빠르게 설정할 수 있습니다.

---

## ✅ 사전 준비

- [x] Extension 빌드 완료 (`packages/extension/dist/` 폴더 생성됨)
- [ ] Chrome 브라우저 설치
- [ ] Google 계정 로그인

---

## 📝 설정 단계 (순서대로 진행)

### 1️⃣ Chrome Extension 로드 및 ID 확인

**목적**: Extension ID를 얻어서 OAuth Client 등록에 사용

1. **Chrome 열기** → 주소창에 `chrome://extensions/` 입력
2. **우측 상단 "개발자 모드" 켜기**
3. **"압축해제된 확장 프로그램을 로드합니다." 클릭**
4. **폴더 선택**: `d:\project\CatchVoca\packages\extension\dist` 선택
5. **Extension ID 복사**:
   ```
   예시: abcdefghijklmnopqrstuvwxyzabcd
   ```
   - Extension 카드 하단에 표시됨
   - 메모장에 복사 (다음 단계에서 사용)

---

### 2️⃣ Firebase Console - Authentication 활성화

**링크**: https://console.firebase.google.com/project/catchvoca-6c9a8/authentication

1. **"Get started" 또는 "Sign-in method" 탭 클릭**
2. **Google 항목 클릭**
3. **"사용 설정" 토글 ON**
4. **프로젝트 지원 이메일**: 본인 이메일 선택
5. **"저장" 클릭**

✅ **확인**: Google이 "사용 설정됨"으로 표시

---

### 3️⃣ Google Cloud Console - OAuth Client ID 생성

#### 3-1. OAuth 동의 화면 구성 (최초 1회)

**링크**: https://console.cloud.google.com/apis/credentials/consent?project=catchvoca-6c9a8

1. **사용자 유형**: "외부" 선택 → "만들기" 클릭
2. **앱 정보 입력**:
   - 앱 이름: `CatchVoca`
   - 사용자 지원 이메일: 본인 이메일
   - 개발자 연락처: 본인 이메일
3. **"저장 후 계속" 3번 클릭** (범위, 테스트 사용자는 건너뛰기)
4. **마지막 화면에서 "대시보드로 돌아가기" 클릭**

#### 3-2. Chrome 앱용 OAuth Client ID 생성

**링크**: https://console.cloud.google.com/apis/credentials?project=catchvoca-6c9a8

1. **"+ 사용자 인증 정보 만들기" 클릭**
2. **"OAuth 클라이언트 ID" 선택**
3. **애플리케이션 유형**: "Chrome 앱" 선택
4. **이름**: `CatchVoca Extension` 입력
5. **애플리케이션 ID**: [Step 1에서 복사한 Extension ID] 붙여넣기
6. **"만들기" 클릭**
7. **생성된 Client ID 복사**:
   ```
   예시: 967073037521-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com
   ```
   - 전체 문자열 복사 (다음 단계에서 사용)

---

### 4️⃣ manifest.json 업데이트

**파일 경로**: `packages/extension/public/manifest.json`

**79-80번째 줄 수정**:

```json
"oauth2": {
  "client_id": "967073037521-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com",
```

**변경**:
```json
"oauth2": {
  "client_id": "967073037521-abc123def456ghi789jkl012mno345pq.apps.googleusercontent.com",
```
↑ Step 3에서 복사한 실제 Client ID로 교체

**저장** 후 다음 단계 진행

---

### 5️⃣ Extension 재빌드 및 새로고침

**터미널에서 실행**:

```bash
cd d:\project\CatchVoca
pnpm --filter extension build
```

**Chrome에서 새로고침**:
1. `chrome://extensions/` 페이지로 이동
2. CatchVoca Extension 카드에서 **"새로고침" 버튼 클릭**

---

### 6️⃣ 테스트

1. **Extension 아이콘 클릭** (Chrome 우측 상단)
2. **"퀴즈" 탭 선택**
3. **"📱 모바일 학습" 버튼 클릭**
4. **Google 로그인 팝업 확인:**
   - 계정 선택 화면이 나타나야 함
   - 본인 계정 선택 → 권한 승인
5. **로그인 성공 확인:**
   - ✅ 프로필 사진과 이름 표시
   - ✅ QR 코드 생성됨
   - ✅ "로그아웃" 버튼 표시

---

## 🎉 완료!

이제 Google 로그인이 작동합니다!

**다음 단계**:
- 모바일 PWA에서도 로그인하려면 → [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md) Step 6 참고
- 전체 설정 가이드 → [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)

---

## ❓ 문제 해결

### "Error: invalid_client"
→ manifest.json의 client_id와 Extension ID가 일치하지 않음
- Step 1의 Extension ID와 Step 3에서 등록한 ID 비교
- manifest.json 저장 후 재빌드 했는지 확인

### "This app isn't verified" 경고
→ 정상입니다 (개발 중)
- "고급" → "CatchVoca로 이동(안전하지 않음)" 클릭

### 로그인 팝업이 안 뜸
→ manifest.json 확인
- `"permissions"` 배열에 `"identity"` 포함되어 있는지 확인
- Extension 새로고침 다시 시도

---

**작성일**: 2025-01-07
**소요 시간**: 약 5-10분
**난이도**: 🟢 쉬움
