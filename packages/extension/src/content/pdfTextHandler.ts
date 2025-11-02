/**
 * PDF Text Handler
 * PDF 페이지에서 텍스트 선택 처리
 */

import type { PDFTextSelection } from '@catchvoca/types';
import {
  isPDFPage,
  getPDFPageInfo,
  getSelectedPDFText,
  isPDFSupportEnabled,
} from './utils/pdfDetector';

let pdfSupportEnabled = true; // 기본값

/**
 * PDF 텍스트 핸들러 초기화
 */
export function initializePDFTextHandler(): void {
  console.log('[PDFTextHandler] Initializing...');

  // 설정 로드
  loadPDFSettings();

  // PDF 페이지인 경우에만 리스너 등록
  if (isPDFPage()) {
    console.log('[PDFTextHandler] PDF page detected, setting up listeners');
    setupPDFListeners();
  }

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'UPDATE_PDF_SETTINGS') {
      pdfSupportEnabled = message.enabled;
      sendResponse({ success: true });
    }
    return true;
  });

  console.log('[PDFTextHandler] Initialized');
}

/**
 * PDF 설정 로드
 */
async function loadPDFSettings(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS',
    });

    if (response.success && response.data) {
      pdfSupportEnabled = response.data.pdfSupportEnabled ?? true;
    }
  } catch (error) {
    console.error('[PDFTextHandler] Failed to load settings:', error);
  }
}

/**
 * PDF 리스너 설정
 */
function setupPDFListeners(): void {
  // mouseup 이벤트로 텍스트 선택 감지
  document.addEventListener('mouseup', handlePDFMouseUp);

  // keyup 이벤트로 키보드 선택 감지
  document.addEventListener('keyup', handlePDFKeyUp);

  console.log('[PDFTextHandler] Listeners attached');
}

/**
 * PDF mouseup 이벤트 핸들러
 */
function handlePDFMouseUp(event: MouseEvent): void {
  if (!isPDFSupportEnabled(pdfSupportEnabled)) {
    return;
  }

  // 약간의 지연 후 선택 텍스트 처리 (브라우저 선택 완료 대기)
  setTimeout(() => {
    processPDFTextSelection(event);
  }, 50);
}

/**
 * PDF keyup 이벤트 핸들러 (Shift + 화살표 등)
 */
function handlePDFKeyUp(event: KeyboardEvent): void {
  if (!isPDFSupportEnabled(pdfSupportEnabled)) {
    return;
  }

  // Shift 키를 사용한 선택인 경우
  if (event.shiftKey) {
    setTimeout(() => {
      processPDFTextSelection();
    }, 50);
  }
}

/**
 * PDF 텍스트 선택 처리
 */
function processPDFTextSelection(event?: MouseEvent): void {
  const selectedText = getSelectedPDFText();

  if (!selectedText) {
    return;
  }

  const pageInfo = getPDFPageInfo();

  if (!pageInfo) {
    console.warn('[PDFTextHandler] Failed to get PDF page info');
    return;
  }

  // 선택 영역의 bounding rect 가져오기
  const selection = window.getSelection();
  let boundingRect: DOMRect | null = null;

  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    boundingRect = range.getBoundingClientRect();
  }

  // 기본 rect (선택 영역을 찾지 못한 경우)
  if (!boundingRect || (boundingRect.width === 0 && boundingRect.height === 0)) {
    if (event) {
      boundingRect = new DOMRect(event.clientX, event.clientY, 0, 0);
    } else {
      boundingRect = new DOMRect(0, 0, 0, 0);
    }
  }

  const pdfSelection: PDFTextSelection = {
    text: selectedText,
    pageInfo,
    boundingRect,
  };

  console.log('[PDFTextHandler] Text selected:', {
    text: selectedText,
    page: pageInfo.pageNumber,
    totalPages: pageInfo.totalPages,
  });

  // Background worker에 메시지 전송
  notifyPDFTextSelected(pdfSelection);
}

/**
 * PDF 텍스트 선택 알림
 */
function notifyPDFTextSelected(selection: PDFTextSelection): void {
  try {
    chrome.runtime.sendMessage({
      type: 'PDF_TEXT_SELECTED',
      data: selection,
    });
  } catch (error) {
    console.error('[PDFTextHandler] Failed to notify text selection:', error);
  }
}

/**
 * PDF 텍스트 핸들러 정리
 */
export function cleanupPDFTextHandler(): void {
  document.removeEventListener('mouseup', handlePDFMouseUp);
  document.removeEventListener('keyup', handlePDFKeyUp);
  console.log('[PDFTextHandler] Cleaned up');
}
