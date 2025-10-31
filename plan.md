물론입니다. 제공해주신 3개의 문서를 바탕으로 AI 개발 에이전트가 작업을 수행할 수 있도록 **프로젝트 요약, 핵심 요구사항, 개발 Todo List** 형태로 명확하게 정리해 드리겠습니다.

---

### 1. AI Agent를 위한 프로젝트 요약 (기획서 기반)

**1.1. 프로젝트명**
- CheckVoca

**1.2. 핵심 비전**
- "웹 브라우징 경험을 자동화된 어휘 학습으로 전환하는 Local-First 플랫폼"을 구축합니다.
- 사용자가 웹서핑 중 발견한 단어를 즉시 수집하고, 과학적 방법(SRS)으로 복습하여 자연스럽게 장기 기억으로 전환시키는 것을 목표로 합니다.

**1.3. 핵심 차별점**
- **로컬 우선 (Local-First)**: 모든 데이터는 사용자의 브라우저(IndexedDB)에 저장됩니다. 이를 통해 빠른 속도, 완전한 오프라인 기능, 강력한 프라이버시를 보장합니다.
- **매끄러운 학습 흐름**: `발견(웹서핑) → 자동 저장(확장 프로그램) → 복습(퀴즈) → 재학습(기존 단어 알림)`의 워크플로우를 완성합니다.
- **자동화된 수집**: Anki처럼 수동으로 단어를 입력할 필요 없이, 텍스트 선택만으로 단어, 뜻, 원문(context)을 자동으로 수집합니다.

**1.4. 비즈니스 모델**
- **Freemium 모델**을 따릅니다.
- **무료 사용자**: 핵심 기능(단어 수집, 퀴즈)을 광고와 함께 제공하며, 1,000 단어 저장 제한이 있습니다.
- **Pro 사용자 (구독)**: 광고 제거, 단어 무제한 저장, **AI 웹페이지 분석**, 실시간 클라우드 동기화 등 고급 기능을 제공합니다.

---

### 2. AI Agent를 위한 핵심 요구사항 명세 (요구사항 명세서 기반)

**2.1. 데이터 모델**
- **`WordEntry`**: 단어의 모든 정보를 저장합니다. (id, word, definitions, context, url, tags, createdAt 등)
- **`ReviewState`**: SM-2 알고리즘 상태를 저장합니다. (wordId, nextReviewAt, interval, easeFactor, repetitions)
- 데이터베이스는 **Dexie.js**를 사용하여 IndexedDB에 `word_entries`와 `review_states` 테이블을 생성합니다.

**2.2. 핵심 기능별 명세**

#### A. Chrome Extension (핵심 인터페이스)
- **(A-1) 단어 정의 조회**:
    - **Primary**: 네이버 영한사전 API(`https://en.dict.naver.com/api3/enko/search`)를 호출하여 한국어 뜻을 가져옵니다.
    - **API 차단 우회**: `declarativeNetRequest` 규칙을 사용하여 API 요청 시 `Referer` 헤더를 `https://en.dict.naver.com`으로 설정해야 합니다.
    - **Fallback**: 네이버 API 호출 실패 시, `https://api.dictionaryapi.dev`를 호출하여 영어 정의와 발음(audio) 데이터를 가져옵니다.
    - **결과 병합**: 네이버의 '한국어 정의'와 Dictionary API의 '발음 오디오 URL'을 조합하여 최종 결과를 생성합니다.
- **(A-2) 재학습 지원**:
    - 사용자가 이미 저장한 단어를 다시 선택하면, "이미 학습한 단어입니다"라는 알림과 함께 마지막 복습일, 복습 횟수, 숙련도 등의 정보를 표시해야 합니다.
- **(A-3) AI 웹페이지 분석 (Pro 기능)**:
    - 현재 페이지의 텍스트를 추출하고 토큰화합니다.
    - 로컬 DB와 대조하여 **학습한 단어는 녹색**, COCA 빈도 등 알고리즘 기반으로 **중요 미학습 단어는 노란색**으로 하이라이트합니다.
    - 사이드 패널에 분석 요약(총 단어 수, 학습률, 추천 단어)을 표시합니다.

#### B. SM-2 퀴즈 로직
- **(B-1) 복습 대상 선정**:
    - `review_states` 테이블에서 `nextReviewAt`이 현재 시각 이전인 단어를 쿼리합니다.
- **(B-2) SM-2 알고리즘 구현**:
    - 사용자의 평가(1: 모름, 2: 어려움, 3: 보통, 4: 쉬움)에 따라 `interval`, `repetitions`, `easeFactor` 값을 조정하여 다음 복습 날짜(`nextReviewAt`)를 계산해야 합니다.
    - **규칙**: 틀렸을 경우(평가 < 3), `repetitions`는 0으로, `interval`은 1일로 리셋합니다.

#### C. Google Apps Script (모바일 퀴즈 연동)
- **(C-1) 스냅샷 저장 (POST 요청 처리)**:
    - 확장 프로그램으로부터 `WordEntry[]`와 `ReviewState[]`가 포함된 JSON 데이터를 POST 요청으로 받습니다.
    - 받은 JSON 데이터를 사용자의 Google Drive 내 `CheckVoca_Snapshots` 폴더에 파일로 저장합니다.
    - 고유 ID를 생성하고, 해당 ID를 포함한 모바일 퀴즈 URL(`https://script.google.com/.../exec?id=...`)을 생성하여 응답으로 반환합니다.
- **(C-2) 모바일 퀴즈 웹앱 제공 (GET 요청 처리)**:
    - URL의 `id` 파라미터를 사용하여 Drive에 저장된 JSON 파일을 읽습니다.
    - 읽어온 JSON 데이터를 `MobileQuiz.html` 템플릿에 주입하여 모바일 친화적인 퀴즈 페이지를 생성하고 반환합니다.

---

### 3. AI Agent를 위한 개발 Todo List (로드맵 기반)

#### Phase 1: MVP 구축 (핵심 기능 구현)

- **Step 1: Core Package 및 데이터베이스 설정**
    - [ ] `pnpm`을 사용하여 모노레포 환경을 설정합니다.
    - [ ] Dexie.js를 사용하여 IndexedDB 스키마(`word_entries`, `review_states`)를 정의합니다.
    - [ ] 데이터베이스 CRUD 작업을 위한 Repository 클래스를 구현합니다.
    - [ ] SM-2 알고리즘 계산 함수(`calculateNextReview`)를 순수 함수로 구현하고 단위 테스트를 작성합니다.

- **Step 2: Chrome Extension UI 및 기능 개발**
    - [ ] Chrome Manifest V3 규격에 맞는 `manifest.json` 파일을 설정합니다.
    - [ ] `content_script`: 웹페이지에서 텍스트 선택(`mouseup` 이벤트)을 감지하는 로직을 구현합니다.
    - [ ] `background_script`: 사전 API 호출(네이버 Primary, Dictionary API Fallback) 및 결과 병합 로직을 구현합니다.
    - [ ] `rule_endic.json` 파일을 작성하여 네이버 사전 API 호출 시 `Referer` 헤더를 수정하는 `declarativeNetRequest` 규칙을 추가합니다.
    - [ ] React와 Vite를 사용하여 확장 프로그램 팝업 UI를 구축합니다. (수집, 관리, 퀴즈, 설정 탭 포함)
    - [ ] 팝업 내에서 PC 버전 SM-2 퀴즈 기능을 구현합니다.

- **Step 3: Google Apps Script 모바일 연동 기능 개발**
    - [ ] Google Apps Script 프로젝트를 생성합니다.
    - [ ] `doPost` 함수: 확장 프로그램으로부터 받은 데이터 스냅샷을 Google Drive에 저장하는 로직을 구현합니다.
    - [ ] `doGet` 함수: URL 파라미터로 받은 ID를 이용해 Drive의 스냅샷 파일을 읽어 HTML 퀴즈 페이지를 반환하는 로직을 구현합니다.
    - [ ] `MobileQuiz.html`: 모바일 환경에 최적화된 바닐라 JS 기반 퀴즈 UI를 개발합니다.
    - [ ] 확장 프로그램에 '모바일 퀴즈 생성' 버튼과 QR 코드 표시 기능을 추가합니다.

#### Phase 2: 수익화 및 Pro 기능 개발

- **Step 4: 광고 및 구독 시스템 연동**
    - [ ] 무료 사용자의 '모바일 퀴즈 생성' 플로우에 3초간의 인터스티셜 광고(Google AdSense)를 삽입합니다.
    - [ ] Firebase Authentication을 연동하여 Google 계정 로그인을 구현합니다.
    - [ ] Stripe Checkout을 연동하여 Pro 구독 결제 프로세스를 구현하고, Webhook을 통해 구독 상태를 관리합니다.
    - [ ] 1,000 단어 저장 제한 등 Pro 기능 접근을 제어하는 게이팅(gating) 로직을 구현합니다.

- **Step 5: AI 웹페이지 분석 기능 개발**
    - [ ] 현재 웹페이지의 본문 텍스트를 추출하고 정제하는 DOM 파싱 모듈을 개발합니다.
    - [ ] 추출된 단어와 로컬 DB의 `word_entries`를 비교하여 학습 상태를 확인합니다.
    - [ ] COCA 단어 빈도수 데이터를 기반으로 미학습 단어의 중요도를 계산하는 알고리즘을 구현합니다.
    - [ ] 계산된 상태(학습/미학습/중요)에 따라 웹페이지의 단어를 하이라이트하는 DOM 조작 스크립트를 작성합니다.

이 구조화된 문서를 바탕으로 AI 에이전트는 각 단계별 코드 생성, 테스트 케이스 작성, 아키텍처 구현 등의 작업을 수행할 수 있습니다.