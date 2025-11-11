# CatchVoca v1.0.0 서비스 기획서

> **버전**: v1.0.0 (2025-11-10)
> **상태**: 정식 출시 준비 완료
> **목표**: Chrome 웹 스토어 배포

---

## 📌 프로젝트 개요

**CatchVoca**는 웹서핑 중 모르는 단어를 클릭 한 번으로 저장하고, AI 분석과 SM-2 알고리즘으로 효과적으로 암기할 수 있는 Chrome 확장 프로그램입니다.

### 핵심 가치

1. **편리한 수집**: 웹페이지에서 단어 선택 → 우클릭 저장 또는 확장 프로그램에서 직접 검색
2. **AI 기반 학습**: Gemini AI로 웹페이지 분석, 학습에 유용한 단어 자동 추천
3. **과학적 복습**: SM-2 알고리즘 기반 간격 반복 학습(Spaced Repetition)
4. **클라우드 동기화**: Google 계정으로 로그인하여 여러 기기에서 단어장 동기화

### 타겟 사용자

- 영어 학습자 (대학생, 직장인, 수험생)
- 외국어 콘텐츠(뉴스, 논문, 블로그)를 자주 읽는 사용자
- 체계적인 단어 암기를 원하는 사용자
- Chrome 브라우저 사용자

---

## 💰 수익 모델

### 기본 서비스 (무료)
- ✅ 기본 단어 수집 및 관리 (무제한)
- ✅ SM-2 알고리즘 복습 (무제한)
- ✅ Google 계정 동기화 (무제한)
- ✅ **AI 웹페이지 분석 (무제한)**
- ⚠️ **AI 3회 초과 시 광고 표시**
- ⚠️ **단어장 내보내기 시 광고 표시**

### 광고 수익 모델

광고는 다음 2가지 기능 사용 시에만 표시됩니다:

1. **AI 웹페이지 분석 (3회 초과 시)**
   - 일일 3회까지 무료 (광고 없음)
   - 4회째부터 분석 전 광고 새창 표시
   - 광고 시청 후 계속 무제한 분석 가능

2. **단어장 내보내기**
   - CSV/Anki/Quizlet 형식 내보내기 시 광고 새창 표시
   - 광고 시청 완료 후 다운로드 진행

**광고 형태**: 새 창(팝업) 방식
**광고 제공**: Google AdSense 또는 자체 광고 네트워크

### 광고 제거 결제 (선택)
- **가격**: 2,000원 (일회성 결제)
- **혜택**:
  - AI 분석 무제한 (광고 없음)
  - 내보내기 무제한 (광고 없음)
- **결제 방식**: Chrome 웹 스토어 인앱 결제 또는 Stripe

---

## 🎯 주요 기능

### 1. 단어 수집 (Collect Tab)

**기능 설명**:
- 웹페이지에서 단어 선택 → 우클릭 → "CatchVoca에 저장"
- 확장 프로그램 팝업에서 직접 단어 검색 및 저장
- 네이버 영어사전 API (Primary) + Dictionary API (Fallback)

**데이터 저장**:
- 단어(word), 정의(definitions), 발음(phonetic), 발음 오디오(audioUrl)
- 문맥(context), 출처 URL(url), 페이지 제목(sourceTitle)
- IndexedDB에 로컬 저장 (오프라인 지원)

**재학습 감지**:
- 이전에 저장한 단어를 다시 저장하려 할 때 알림
- 기존 단어 확인 or 새 단어로 저장 선택 가능

### 2. 단어 관리 (Vocabulary Tab)

**기능 설명**:
- 저장된 모든 단어 목록 표시
- 검색: 단어 또는 정의로 검색
- 필터: 태그, 즐겨찾기, 언어별 필터링
- 정렬: 생성일, 조회수, 알파벳 순
- 단어별 상세 정보 표시 (정의, 발음, 문맥, 출처)

**편집 기능**:
- 즐겨찾기 토글
- 태그 추가/제거
- 메모 작성
- 단어 삭제

### 3. AI 웹페이지 분석 (AI Analysis Tab)

**기능 설명**:
- 현재 웹페이지를 Gemini AI로 분석
- 사용자가 학습하면 유용할 단어 추천
- 각 단어의 중요도(0-100), 난이도(beginner/intermediate/advanced), 이유 표시

**추천 단어 관리**:
- 단어별 체크박스 선택
- 선택한 단어 일괄 저장
- 이미 저장된 단어는 자동 필터링

**AI 사용량 및 광고**:
- 일일 3회까지 무료 (광고 없음)
- 4회째부터 분석 전 광고 새창 표시
- 광고 시청 후 계속 무제한 분석 가능
- 설정에서 사용량 제한 비활성화 옵션 제공 (개발/테스트용)

**하이라이트 기능**:
- AI 분석 후 페이지에 자동 하이라이트 적용
- 노란색: 추천 단어 (아직 저장 안 함)
- 초록색: 이미 학습한 단어
- 클릭 시 정의 툴팁 표시 및 바로 저장 가능

### 4. SM-2 복습 시스템 (Quiz Tab)

**기능 설명**:
- 과학적 간격 반복 학습(Spaced Repetition) 알고리즘
- 복습 필요한 단어만 자동으로 선별
- 4단계 평가: 전혀(Again), 어려움(Hard), 보통(Good), 쉬움(Easy)
- 평가에 따라 다음 복습 시점 자동 계산

**복습 통계**:
- 전체 단어 수
- 오늘 복습할 단어 수
- 학습 완료 단어 수
- 진행률 시각화

**SM-2 알고리즘**:
- 첫 복습: 1일 후
- 두 번째 복습: 6일 후
- 세 번째 이후: `이전 간격 × 난이도 계수(easeFactor)`
- 난이도 계수 범위: 1.3 ~ 2.5
- 실패 시 간격 초기화

### 5. 모바일 퀴즈 (향후 구현 예정)

**기능 설명**:
- PC에서 모바일 퀴즈 링크 생성
- Firebase Realtime Database에 퀴즈 데이터 저장
- 링크를 통해 모바일 브라우저에서 접속하여 학습
- 모바일 최적화 UI (터치 친화적)

**학습 결과 동기화**:
- 모바일에서 복습한 결과가 Firebase를 통해 PC와 동기화
- 링크 기반 접근으로 별도 앱 설치 불필요

### 6. 클라우드 동기화 (Settings Tab)

**기능 설명**:
- Google OAuth 2.0 로그인
- 단어장을 Firebase Realtime Database에 동기화
- 여러 기기에서 동일한 단어장 접근 가능
- 로그인 상태 표시 및 로그아웃 기능

**동기화 방식**:
- 로그인 시 자동 동기화
- 수동 동기화 버튼 제공
- 마지막 동기화 시간 표시

### 7. 데이터 내보내기/가져오기

**내보내기 형식**:
1. **CSV (엑셀용)**:
   - 헤더: 단어, 발음, 정의, 문맥, 조회수
   - Excel에서 바로 열기 가능
   - BOM 포함 (UTF-8 인식)

2. **Anki 덱 (TSV)**:
   - 앞면: 영어 단어
   - 뒷면: 정의 + 발음 + 예문
   - 태그: 사용자 태그 또는 기본값
   - Anki에서 바로 가져오기 가능

3. **Quizlet 세트 (TSV)**:
   - Term: 영어 단어
   - Definition: 정의만
   - Quizlet에서 바로 가져오기 가능

**광고 정책**:
- 기본: 내보내기 전 광고 새창 표시
- 광고 제거 결제 시: 광고 없이 즉시 다운로드

**가져오기**:
- JSON 형식 단어장 가져오기
- 백업 및 복원 기능

### 8. 일반 설정

**언어 설정**:
- 기본 언어: 영어(en)
- 향후 다국어 지원 예정

**알림 설정**:
- 저장 성공 알림
- 복습 필요 알림
- AI 사용량 알림

**스토리지 정보**:
- 저장된 단어 수
- 사용 중인 저장 공간
- 전체 저장 공간

**개발자 옵션**:
- AI 사용량 제한 비활성화 (테스트용)

---

## 🏗️ 기술 아키텍처

### 프론트엔드
- **React 18.2**: UI 라이브러리
- **TypeScript 5.3**: 타입 안전성
- **Vite 5.0**: 빌드 도구
- **TailwindCSS 3.4**: 유틸리티 CSS
- **Zustand 4**: 상태 관리

### 백엔드 & 스토리지
- **IndexedDB (Dexie.js 3.2)**: 로컬 데이터베이스
- **Firebase Realtime Database**: 클라우드 동기화 및 모바일 퀴즈
- **BroadcastChannel API**: 탭 간 실시간 동기화

### 외부 API
- **Naver Dictionary API** (Primary): `https://en.dict.naver.com/api3/enko/search`
- **Free Dictionary API** (Fallback): `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
- **Google Gemini 1.5 Flash**: AI 웹페이지 분석
- **Google OAuth 2.0**: 사용자 인증

### Chrome Extension
- **Manifest V3**: 최신 Chrome 확장 프로그램 표준
- **Service Worker**: Background 작업 처리
- **Content Script**: 웹페이지 상호작용
- **declarativeNetRequest**: Naver API CORS 우회

### 테스트
- **Vitest 1.6**: 단위 테스트
- **fake-indexeddb 5.0**: IndexedDB 모킹
- **테스트 커버리지**: 113/113 tests passing

---

## 💾 데이터 모델

### WordEntry (단어 정보)
```typescript
interface WordEntry {
  id: string;                    // PK: "${normalizedWord}::${url}"
  word: string;                  // 원문 (예: "Hello")
  normalizedWord: string;        // 소문자 정규화 (예: "hello")
  definitions?: string[];        // 정의 목록
  phonetic?: string;             // 발음기호 (예: "/həˈloʊ/")
  audioUrl?: string;             // 발음 오디오 URL
  language: string;              // 언어 코드 (기본: "en")
  context: string;               // 선택된 문장
  url: string;                   // 출처 URL
  sourceTitle: string;           // 페이지 제목
  tags: string[];                // 태그 배열
  isFavorite?: boolean;          // 즐겨찾기 여부
  note?: string;                 // 메모
  viewCount?: number;            // 조회 횟수
  lastViewedAt?: number;         // 마지막 조회 시각 (timestamp)
  createdAt: number;             // 생성 시각 (timestamp)
  updatedAt: number;             // 수정 시각 (timestamp)
  deletedAt?: number;            // 삭제 시각 (tombstone)
}
```

### ReviewState (SM-2 복습 상태)
```typescript
interface ReviewState {
  id: string;                    // PK
  wordId: string;                // FK → WordEntry.id
  nextReviewAt: number;          // 다음 복습 시각 (timestamp)
  interval: number;              // 복습 간격 (일 단위)
  easeFactor: number;            // 난이도 계수 (1.3 ~ 2.5)
  repetitions: number;           // 성공 반복 횟수
  history: ReviewHistory[];      // 복습 히스토리
  createdAt: number;             // 생성 시각
  updatedAt: number;             // 수정 시각
}

interface ReviewHistory {
  reviewedAt: number;            // 복습 시각
  rating: number;                // 평가 (1: Again, 2: Hard, 3: Good, 4: Easy)
  interval: number;              // 적용된 간격
  easeFactor: number;            // 적용된 난이도 계수
}
```

### AIAnalysisHistory (AI 분석 이력)
```typescript
interface AIAnalysisHistory {
  id: string;                    // PK
  url: string;                   // 분석한 페이지 URL
  title: string;                 // 페이지 제목
  summary: string;               // AI 요약
  recommendedWords: RecommendedWord[];  // 추천 단어 목록
  analyzedAt: number;            // 분석 시각
}

interface RecommendedWord {
  word: string;                  // 단어
  importance: number;            // 중요도 (0-100)
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  reason: string;                // 추천 이유
  isSaved: boolean;              // 이미 저장된 단어인지
}
```

### Settings (설정)
```typescript
interface Settings {
  language: string;              // 언어 (기본: "en")
  notifications: {
    enabled: boolean;            // 알림 활성화
    wordSaved: boolean;          // 단어 저장 알림
    reviewDue: boolean;          // 복습 필요 알림
    aiUsage: boolean;            // AI 사용량 알림
  };
  ai: {
    disableUsageLimit: boolean;  // AI 사용량 제한 비활성화 (개발용)
  };
}
```

### SyncStatus (동기화 상태)
```typescript
interface SyncStatus {
  isAuthenticated: boolean;      // Google 로그인 여부
  currentUser: {
    email: string;
    displayName: string;
    photoURL?: string;
  } | null;
  authToken: string | null;      // Firebase 인증 토큰
  lastSyncedAt: number;          // 마지막 동기화 시각
  syncInProgress: boolean;       // 동기화 진행 중
}
```

---

## 📊 사용자 플로우

### 1. 신규 사용자 온보딩
```
1. Chrome 웹 스토어에서 설치
2. 확장 프로그램 아이콘 클릭
3. 환영 화면 (간단한 사용법 안내)
4. (선택) Google 로그인하여 동기화 활성화
5. 첫 단어 수집 시작
```

### 2. 일반적인 사용 시나리오

**시나리오 A: 웹페이지에서 단어 수집**
```
1. 뉴스 기사 읽다가 모르는 단어 발견
2. 단어 드래그하여 선택
3. 우클릭 → "CatchVoca에 저장" 클릭
4. 자동으로 정의, 발음, 문맥 저장
5. 알림으로 저장 완료 확인
```

**시나리오 B: AI 웹페이지 분석**
```
1. 영어 블로그 글 읽기 시작
2. 확장 프로그램 아이콘 클릭
3. "AI 분석" 탭으로 이동
4. "현재 페이지 분석하기" 버튼 클릭
5. AI가 유용한 단어 10개 추천
6. 원하는 단어 선택 후 일괄 저장
7. 페이지에 자동 하이라이트 적용
```

**시나리오 C: SM-2 복습**
```
1. 매일 아침 확장 프로그램 열기
2. "퀴즈" 탭에서 복습할 단어 수 확인
3. "시작하기" 버튼 클릭
4. 단어 보고 뜻 떠올리기
5. "답안 보기" 클릭하여 정답 확인
6. 4단계 평가 (전혀/어려움/보통/쉬움)
7. 다음 단어로 이동
8. 복습 완료 후 통계 확인
```

**시나리오 D: 모바일 학습**
```
1. PC에서 "설정" 탭 → "모바일 퀴즈" 섹션
2. "모바일 퀴즈 생성" 버튼 클릭
3. (광고 시청)
4. 생성된 URL 복사 또는 QR 코드 스캔
5. 모바일 브라우저에서 URL 접속
6. 모바일 최적화 UI로 복습 진행
7. 복습 결과가 PC와 자동 동기화
```

**시나리오 E: 단어장 내보내기**
```
1. "설정" 탭 → "데이터 관리" 섹션
2. 내보내기 형식 선택 (CSV/Anki/Quizlet)
3. "단어장 다운로드" 버튼 클릭
4. (무료 사용자) 광고 시청
5. 파일 다운로드 완료
6. Anki/Quizlet에 가져오기
```

---

## 🎨 UI/UX 설계 원칙

### 디자인 철학
1. **단순함(Simplicity)**: 최소한의 클릭으로 원하는 기능 수행
2. **직관성(Intuitiveness)**: 설명 없이도 사용 가능한 인터페이스
3. **반응성(Responsiveness)**: 빠른 피드백과 로딩 상태 표시
4. **일관성(Consistency)**: 전체 UI에서 통일된 디자인 언어

### 색상 팔레트
- **Primary**: Blue (#3B82F6) - 주요 액션 버튼
- **Success**: Green (#10B981) - 저장 완료, 학습 완료
- **Warning**: Yellow (#F59E0B) - AI 사용량 제한 경고
- **Danger**: Red (#EF4444) - 삭제, 오류
- **Info**: Cyan (#06B6D4) - 정보, 안내
- **AI Highlight**: Yellow (#FDE047) - 추천 단어 하이라이트
- **Learned Highlight**: Green (#86EFAC) - 학습 완료 단어 하이라이트

### 타이포그래피
- **헤딩**: font-bold, text-lg ~ text-2xl
- **본문**: font-normal, text-sm ~ text-base
- **캡션**: font-medium, text-xs ~ text-sm
- **폰트**: 시스템 기본 폰트 (맑은 고딕, San Francisco 등)

### 반응형 디자인
- **Popup**: 고정 크기 (400px × 600px)
- **모바일 퀴즈**: 모바일 최적화 (터치 친화적, 큰 버튼)
- **태블릿**: 향후 지원 예정

---

## 🚀 배포 계획

### Chrome 웹 스토어 제출 준비
1. ✅ v1.0.0 버전 확정
2. ✅ 모든 기능 테스트 완료
3. ✅ 문서 정리 (README, INSTALLATION_GUIDE)
4. ⏳ 스크린샷 및 프로모션 이미지 준비
5. ⏳ 개인정보 처리방침 작성
6. ⏳ Chrome 웹 스토어 등록

### 필수 제출 자료
- 확장 프로그램 아이콘 (128×128, 48×48, 16×16)
- 스크린샷 (1280×800 또는 640×400, 최소 1개)
- 프로모션 타일 이미지 (440×280, 선택)
- 상세 설명 (한국어)
- 개인정보 처리방침 URL
- 지원 이메일 주소

### 초기 마케팅 전략
1. **무료 버전 배포**: 사용자 확보
2. **SNS 홍보**: 트위터, 페이스북, 레딧
3. **블로그 포스팅**: 개발 스토리, 사용법 가이드
4. **커뮤니티 참여**: Chrome 확장 프로그램 포럼
5. **사용자 피드백 수집**: 개선 사항 반영

---

## 📈 향후 로드맵

### Phase 2: 광고 시스템 및 결제 구현 (Q1 2026)
- [ ] 광고 시스템 구현 (Google AdSense)
- [ ] AI 분석 3회 초과 시 광고 새창 표시 기능
- [ ] 내보내기 시 광고 새창 표시 기능
- [ ] 광고 제거 일회성 결제 (2,000원)
  - Chrome 웹 스토어 인앱 결제 또는 Stripe 연동
- [ ] 모바일 퀴즈 링크 기반 시스템 구현
  - [ ] 모바일 퀴즈 링크 카카오톡 공유 기능
  - [ ] 모바일 퀴즈 링크 Gmail로 전송 기능
- [ ] 외부 플랫폼 직접 연동
  - [ ] Anki Web API 연동 (단어장 직접 전송)
  - [ ] Quizlet API 연동 (단어장 직접 전송)
- [ ] 고급 통계 대시보드
- [ ] 학습 목표 설정 및 진행률 추적

### Phase 3: 모바일 최적화 (Q2 2026)
- [ ] 모바일 웹 UI/UX 개선
- [ ] PWA (Progressive Web App) 지원
- [ ] 오프라인 모드 개선
- [ ] 푸시 알림 (복습 리마인더)

### Phase 4: 협업 기능 (Q3 2026)
- [ ] 단어장 공유 기능
- [ ] 팀/그룹 학습
- [ ] 선생님-학생 연동
- [ ] 공개 단어장 마켓플레이스

### Phase 5: 다국어 지원 (Q4 2026)
- [ ] 한국어 → 영어
- [ ] 일본어 학습 지원
- [ ] 중국어 학습 지원
- [ ] 기타 언어 확장

---

## 🔒 보안 및 개인정보

### 데이터 저장 위치
- **로컬**: IndexedDB (사용자 기기 내부)
- **클라우드**: Firebase Realtime Database (Google 로그인 시)
- **제3자 공유**: 없음

### 개인정보 수집 항목
- Google 계정 정보 (이메일, 프로필 사진) - 동기화 기능 사용 시
- 저장된 단어 및 학습 기록
- 웹페이지 URL 및 제목 (단어 출처)
- AI 분석 이력

### 보안 조치
- Google OAuth 2.0 인증
- Firebase Security Rules로 데이터 접근 제어
- HTTPS 통신 (API 호출)
- 로컬 데이터 암호화 (IndexedDB)

### 개인정보 보호 정책
- 사용자 동의 없는 데이터 수집 금지
- 제3자 공유 금지
- 사용자 요청 시 데이터 완전 삭제 보장
- GDPR 및 CCPA 준수

---

## 📞 지원 및 문의

### 사용자 지원
- **이메일**: support@catchvoca.com (예정)
- **GitHub Issues**: https://github.com/your-username/CatchVoca/issues
- **FAQ**: README.md 참고

### 개발자
- **GitHub**: https://github.com/your-username
- **Email**: developer@catchvoca.com (예정)

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

**Made with ❤️ for vocabulary learners**
