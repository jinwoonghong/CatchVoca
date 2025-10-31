/**
 * 단어 정규화 유틸리티
 */

/**
 * 단어를 정규화합니다 (소문자 변환, 특수문자 제거)
 */
export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // 특수문자 제거 (단어, 공백, 하이픈만 유지)
    .replace(/\s+/g, ' '); // 연속 공백 제거
}

/**
 * 문맥 텍스트를 정규화합니다
 */
export function normalizeContext(context: string): string {
  return context
    .trim()
    .replace(/\s+/g, ' ') // 연속 공백 제거
    .replace(/\n+/g, ' '); // 개행을 공백으로 변환
}

/**
 * URL을 정규화합니다 (프로토콜 제거, 끝 슬래시 제거)
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // 프로토콜 제외, pathname 끝의 슬래시 제거
    return `${urlObj.hostname}${urlObj.pathname.replace(/\/$/, '')}${urlObj.search}`;
  } catch {
    // URL 파싱 실패 시 원본 반환
    return url.trim();
  }
}

/**
 * HTML 태그를 제거합니다
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/&nbsp;/g, ' ') // &nbsp; → 공백
    .replace(/&amp;/g, '&') // &amp; → &
    .replace(/&lt;/g, '<') // &lt; → <
    .replace(/&gt;/g, '>') // &gt; → >
    .replace(/&quot;/g, '"') // &quot; → "
    .trim();
}

/**
 * WordEntry ID를 생성합니다 (normalizedWord::normalizedUrl)
 */
export function generateWordId(word: string, url: string): string {
  const normalized = normalizeWord(word);
  const normalizedUrl = normalizeUrl(url);
  return `${normalized}::${normalizedUrl}`;
}
