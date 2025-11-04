# 환경 변수 설정 가이드

## Gemini API 키 설정

CatchVoca의 AI 웹페이지 분석 기능을 사용하려면 Google Gemini API 키가 필요합니다.

### 1. API 키 발급

1. [Google AI Studio](https://ai.google.dev/)에 접속
2. "Get API Key" 클릭
3. API 키 생성 및 복사

**무료 한도**:
- 하루 1,500 요청
- 월 4M 토큰

### 2. 환경 변수 설정

#### 개발 환경

1. `packages/extension` 디렉토리에 `.env` 파일 생성:
```bash
cd packages/extension
cp .env.example .env
```

2. `.env` 파일에서 API 키 수정:
```bash
VITE_GEMINI_API_KEY=여기에_실제_API_키_입력
```

#### 프로덕션 빌드

프로덕션 빌드 시 `.env` 파일의 값이 자동으로 번들에 포함됩니다.

**⚠️ 보안 주의사항**:
- `.env` 파일은 Git에 커밋하지 마세요 (이미 .gitignore에 포함됨)
- API 키를 공개 저장소에 노출하지 마세요
- 프로덕션에서는 Chrome Extension의 한계로 인해 API 키가 번들에 포함되므로, 사용량 제한 및 모니터링을 권장합니다

### 3. 빌드 및 테스트

```bash
# 타입 체크
pnpm typecheck

# 개발 빌드
pnpm dev

# 프로덕션 빌드
pnpm build:extension
```

### 4. API 키 확인

빌드된 파일에서 API 키가 올바르게 설정되었는지 확인:
```bash
grep -o "AIzaSy[A-Za-z0-9_-]*" packages/extension/dist/assets/*.js | head -1
```

## 환경 변수 목록

| 변수명 | 설명 | 기본값 | 필수 |
|--------|------|--------|------|
| `VITE_GEMINI_API_KEY` | Google Gemini API 키 | - | ✅ |
| `VITE_GEMINI_API_URL` | Gemini API 엔드포인트 | (자동 설정) | ❌ |

## 문제 해결

### API 키가 작동하지 않는 경우

1. `.env` 파일이 `packages/extension` 디렉토리에 있는지 확인
2. 파일명이 정확히 `.env`인지 확인 (`.env.txt` 등이 아님)
3. API 키에 공백이나 따옴표가 없는지 확인
4. 빌드를 다시 실행: `pnpm build:extension`

### API 호출이 실패하는 경우

1. Gemini API 할당량 확인: [Google Cloud Console](https://console.cloud.google.com/)
2. 네트워크 연결 확인
3. Chrome 개발자 도구에서 콘솔 에러 확인

## 관련 파일

- `packages/extension/.env.example` - 환경 변수 템플릿
- `packages/extension/src/background/services/geminiAPI.ts` - API 통합 코드
- `packages/extension/vite.config.ts` - Vite 빌드 설정
