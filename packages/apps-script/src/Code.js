/**
 * CatchVoca Apps Script - Mobile Quiz Web App
 * - doPost(): 스냅샷 저장 (Chrome Extension → Drive)
 * - doGet(): 모바일 퀴즈 UI 제공
 */

const FOLDER_NAME = 'CatchVoca_Snapshots';
const CACHE_DURATION = 21600; // 6시간

/**
 * HTTP POST 핸들러 - 스냅샷 저장
 *
 * @param {Object} e - HTTP POST 이벤트 객체
 * @returns {Object} JSON 응답 (모바일 URL 포함)
 */
function doPost(e) {
  try {
    // Content-Type 검증
    if (!e.postData || e.postData.type !== 'application/json') {
      return createErrorResponse('Invalid Content-Type. Expected application/json');
    }

    // JSON 파싱
    const data = JSON.parse(e.postData.contents);

    // 필수 필드 검증
    if (!data.words || !Array.isArray(data.words)) {
      return createErrorResponse('Missing or invalid "words" field');
    }

    if (!data.reviewStates || typeof data.reviewStates !== 'object') {
      return createErrorResponse('Missing or invalid "reviewStates" field');
    }

    // Drive 폴더 생성/조회
    const folder = getOrCreateFolder(FOLDER_NAME);

    // 고유 스냅샷 ID 생성 (타임스탬프 기반)
    const snapshotId = `snapshot_${Date.now()}`;
    const fileName = `${snapshotId}.json`;

    // 스냅샷 메타데이터 추가
    const snapshot = {
      id: snapshotId,
      createdAt: Date.now(),
      wordCount: data.words.length,
      words: data.words,
      reviewStates: data.reviewStates,
    };

    // Drive에 JSON 파일 저장
    const file = folder.createFile(
      fileName,
      JSON.stringify(snapshot, null, 2),
      MimeType.PLAIN_TEXT
    );

    // 파일 공유 설정 (누구나 링크로 접근 가능)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // 웹앱 URL 생성
    const webAppUrl = ScriptApp.getService().getUrl();
    const mobileUrl = `${webAppUrl}?snapshot=${snapshotId}`;

    // 성공 응답
    return createSuccessResponse({
      snapshotId: snapshotId,
      mobileUrl: mobileUrl,
      fileId: file.getId(),
      createdAt: snapshot.createdAt,
      wordCount: snapshot.wordCount,
    });

  } catch (error) {
    Logger.log(`[doPost] Error: ${error.message}`);
    return createErrorResponse(`Server error: ${error.message}`);
  }
}

/**
 * HTTP GET 핸들러 - 모바일 퀴즈 UI
 *
 * @param {Object} e - HTTP GET 이벤트 객체
 * @returns {HtmlOutput} HTML 페이지
 */
function doGet(e) {
  try {
    // URL 파라미터에서 snapshotId 추출
    const snapshotId = e.parameter.snapshot;

    if (!snapshotId) {
      return createErrorPage('Missing snapshot parameter');
    }

    // 스냅샷 데이터 로드
    const snapshot = loadSnapshot(snapshotId);

    if (!snapshot) {
      return createErrorPage('Snapshot not found or expired');
    }

    // 복습 대기 단어 필터링
    const now = Date.now();
    const dueWords = snapshot.words.filter(word => {
      const reviewState = snapshot.reviewStates[word.id];
      return reviewState && reviewState.nextReviewAt <= now;
    });

    // 통계 계산
    const stats = {
      total: snapshot.words.length,
      dueToday: dueWords.length,
      createdAt: snapshot.createdAt,
    };

    // HTML 템플릿 생성 (퀴즈 UI)
    const template = HtmlService.createTemplateFromFile('QuizUI');
    template.stats = stats;
    template.dueWords = dueWords;
    template.snapshotId = snapshotId;

    return template.evaluate()
      .setTitle('CatchVoca - Mobile Quiz')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (error) {
    Logger.log(`[doGet] Error: ${error.message}`);
    return createErrorPage(`Error loading quiz: ${error.message}`);
  }
}

/**
 * 스냅샷 데이터 로드 (캐싱 사용)
 *
 * @param {string} snapshotId - 스냅샷 ID
 * @returns {Object|null} 스냅샷 데이터 또는 null
 */
function loadSnapshot(snapshotId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `snapshot_${snapshotId}`;

  // 캐시 확인
  const cached = cache.get(cacheKey);
  if (cached) {
    Logger.log(`[Cache] Hit for ${snapshotId}`);
    return JSON.parse(cached);
  }

  // Drive에서 파일 검색
  const folder = getOrCreateFolder(FOLDER_NAME);
  const files = folder.getFilesByName(`${snapshotId}.json`);

  if (!files.hasNext()) {
    Logger.log(`[loadSnapshot] File not found: ${snapshotId}`);
    return null;
  }

  const file = files.next();
  const content = file.getBlob().getDataAsString();
  const snapshot = JSON.parse(content);

  // 캐시 저장 (6시간)
  cache.put(cacheKey, content, CACHE_DURATION);
  Logger.log(`[Cache] Stored ${snapshotId}`);

  return snapshot;
}

/**
 * Drive 폴더 생성/조회
 *
 * @param {string} folderName - 폴더 이름
 * @returns {Folder} Drive 폴더 객체
 */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  // 폴더 생성
  const folder = DriveApp.createFolder(folderName);
  Logger.log(`[Drive] Created folder: ${folderName}`);
  return folder;
}

/**
 * 성공 응답 생성
 *
 * @param {Object} data - 응답 데이터
 * @returns {TextOutput} JSON 응답
 */
function createSuccessResponse(data) {
  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      data: data,
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 에러 응답 생성
 *
 * @param {string} message - 에러 메시지
 * @returns {TextOutput} JSON 응답
 */
function createErrorResponse(message) {
  return ContentService.createTextOutput(
    JSON.stringify({
      success: false,
      error: message,
    })
  ).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 에러 페이지 생성
 *
 * @param {string} message - 에러 메시지
 * @returns {HtmlOutput} HTML 페이지
 */
function createErrorPage(message) {
  return HtmlService.createHtmlOutput(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Error - CatchVoca</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: #f3f4f6;
            padding: 1rem;
          }
          .error-container {
            background: white;
            border-radius: 0.5rem;
            padding: 2rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            text-align: center;
            max-width: 400px;
          }
          h1 {
            color: #ef4444;
            margin: 0 0 1rem 0;
          }
          p {
            color: #6b7280;
            line-height: 1.5;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>⚠️ Error</h1>
          <p>${message}</p>
        </div>
      </body>
    </html>
  `);
}
