/**
 * PDF Detector Utility
 * Chrome 내장 PDF 뷰어 감지 및 정보 추출
 */

import type { PDFPageInfo } from '@catchvoca/types';

/**
 * 현재 페이지가 PDF인지 확인
 */
export function isPDFPage(): boolean {
  // Chrome 내장 PDF 뷰어는 embed 태그를 사용
  const embedTags = document.getElementsByTagName('embed');

  for (let i = 0; i < embedTags.length; i++) {
    const embed = embedTags[i];
    if (!embed) continue;

    const type = embed.getAttribute('type');
    const src = embed.getAttribute('src');

    // PDF MIME 타입 확인
    if (type === 'application/pdf') {
      return true;
    }

    // PDF 파일 확장자 확인
    if (src && src.toLowerCase().endsWith('.pdf')) {
      return true;
    }
  }

  // URL 확인 (직접 PDF 링크)
  if (window.location.href.toLowerCase().endsWith('.pdf')) {
    return true;
  }

  // Content-Type 헤더 확인 (performance API 사용)
  // Note: Content-Type은 직접 접근 불가능하지만,
  // Chrome PDF 뷰어는 document 구조로 감지 가능
  try {
    const entries = performance.getEntriesByType('navigation');
    if (entries.length > 0) {
      // entries 존재 여부만 확인
    }
  } catch (error) {
    console.error('[PDFDetector] Failed to check performance entries:', error);
  }

  // PDF.js 감지 (일부 사이트에서 사용)
  const pdfViewerContainer = document.getElementById('viewer');
  const pdfViewerClass = document.querySelector('.pdfViewer');

  if (pdfViewerContainer || pdfViewerClass) {
    return true;
  }

  return false;
}

/**
 * PDF 페이지 정보 추출
 */
export function getPDFPageInfo(): PDFPageInfo | null {
  if (!isPDFPage()) {
    return null;
  }

  try {
    const pdfUrl = window.location.href;

    // PDF 제목 추출
    let pdfTitle = document.title;

    // 제목이 비어있으면 URL에서 추출
    if (!pdfTitle || pdfTitle === pdfUrl) {
      const urlParts = pdfUrl.split('/');
      const filename = urlParts[urlParts.length - 1];
      pdfTitle = filename ? decodeURIComponent(filename) : 'Untitled PDF';

      // .pdf 확장자 제거
      if (pdfTitle.toLowerCase().endsWith('.pdf')) {
        pdfTitle = pdfTitle.substring(0, pdfTitle.length - 4);
      }
    }

    // Chrome 내장 PDF 뷰어의 경우 페이지 번호 추출은 제한적
    // PDF.js를 사용하는 경우 더 정확한 정보 추출 가능
    const pageInfo: PDFPageInfo = {
      pageNumber: 1, // 기본값 (정확한 추출 어려움)
      totalPages: 1, // 기본값 (정확한 추출 어려움)
      pdfUrl,
      pdfTitle,
    };

    // PDF.js가 있는 경우 페이지 정보 추출 시도
    const pageNumberElement = document.getElementById('pageNumber');
    const numPagesElement = document.getElementById('numPages');

    if (pageNumberElement && numPagesElement) {
      const pageNumber = parseInt(
        pageNumberElement.getAttribute('value') || '1',
        10
      );
      const totalPages = parseInt(numPagesElement.textContent || '1', 10);

      pageInfo.pageNumber = isNaN(pageNumber) ? 1 : pageNumber;
      pageInfo.totalPages = isNaN(totalPages) ? 1 : totalPages;
    }

    return pageInfo;
  } catch (error) {
    console.error('[PDFDetector] Failed to get PDF page info:', error);
    return null;
  }
}

/**
 * PDF 텍스트 레이어 요소 찾기
 */
export function findPDFTextLayer(): HTMLElement | null {
  // PDF.js 텍스트 레이어
  const textLayer = document.querySelector('.textLayer') as HTMLElement;
  if (textLayer) {
    return textLayer;
  }

  // Chrome 내장 PDF 뷰어는 텍스트 레이어 없음
  // embed 태그 반환
  const embed = document.querySelector('embed[type="application/pdf"]') as HTMLElement;
  if (embed) {
    return embed;
  }

  return null;
}

/**
 * PDF에서 선택된 텍스트 추출
 */
export function getSelectedPDFText(): string | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const selectedText = selection.toString().trim();

  if (!selectedText) {
    return null;
  }

  return selectedText;
}

/**
 * PDF 지원 여부 확인
 * @param settings 사용자 설정
 */
export function isPDFSupportEnabled(pdfSupportEnabled: boolean): boolean {
  return pdfSupportEnabled && isPDFPage();
}
