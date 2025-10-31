/**
 * Content Script
 * 웹페이지에서 텍스트 선택을 감지하고 Background Worker에 전달
 */

import type { WordEntryInput } from '@catchvoca/types';

// 텍스트 선택 감지
document.addEventListener('mouseup', handleTextSelection);

// 컨텍스트 메뉴 클릭 이벤트
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_SELECTION') {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() || '';

    if (selectedText) {
      const wordData = extractWordData(selectedText);
      sendResponse({ success: true, data: wordData });
    } else {
      sendResponse({ success: false, error: 'No text selected' });
    }
  }
  return true;
});

/**
 * 텍스트 선택 핸들러
 */
function handleTextSelection(): void {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  if (!selectedText || selectedText.length === 0) {
    return;
  }

  // 단어 길이 검증 (1-50자)
  if (selectedText.length < 1 || selectedText.length > 50) {
    return;
  }

  // 단어만 선택했는지 확인 (여러 단어는 제외)
  const words = selectedText.split(/\s+/);
  if (words.length > 3) {
    return;
  }

  console.log('[CatchVoca] Text selected:', selectedText);
}

/**
 * 선택된 텍스트에서 WordEntryInput 데이터 추출
 */
function extractWordData(selectedText: string): Partial<WordEntryInput> {
  const selection = window.getSelection();

  // 문맥 추출 (선택된 문장)
  const context = extractContext(selection);

  // 현재 페이지 정보
  const url = window.location.href;
  const sourceTitle = document.title;

  return {
    word: selectedText,
    context,
    url,
    sourceTitle,
  };
}

/**
 * 선택 위치를 기반으로 문맥(전체 문장) 추출
 */
function extractContext(selection: Selection | null): string {
  if (!selection || selection.rangeCount === 0) {
    return '';
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // 텍스트 노드인 경우 부모 요소 사용
  const element = container.nodeType === Node.TEXT_NODE
    ? container.parentElement
    : container as HTMLElement;

  if (!element) {
    return selection.toString();
  }

  // 요소의 전체 텍스트 추출
  const fullText = element.textContent || '';

  // 마침표, 물음표, 느낌표로 문장 분리
  const sentences = fullText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);

  // 선택된 텍스트가 포함된 문장 찾기
  const selectedText = selection.toString().trim();
  const containingSentence = sentences.find(s => s.includes(selectedText));

  if (containingSentence) {
    // 문장이 너무 길면 잘라내기 (최대 500자)
    return containingSentence.length > 500
      ? containingSentence.substring(0, 500) + '...'
      : containingSentence;
  }

  // 문장을 찾지 못한 경우 선택된 텍스트 주변 200자
  const selectedIndex = fullText.indexOf(selectedText);
  if (selectedIndex !== -1) {
    const start = Math.max(0, selectedIndex - 100);
    const end = Math.min(fullText.length, selectedIndex + selectedText.length + 100);
    let context = fullText.substring(start, end).trim();

    if (start > 0) context = '...' + context;
    if (end < fullText.length) context = context + '...';

    return context;
  }

  // 최후의 수단: 선택된 텍스트만 반환
  return selectedText;
}

console.log('[CatchVoca] Content script loaded');
