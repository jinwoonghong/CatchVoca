/**
 * Content Script
 * 웹페이지에서 텍스트 선택을 감지하고 Background Worker에 전달
 */

import type { WordEntryInput, LookupResult } from '@catchvoca/types';

// 툴팁 요소
let tooltip: HTMLDivElement | null = null;

// 텍스트 선택 감지 (툴팁 내부 클릭 제외)
document.addEventListener('mouseup', (e: MouseEvent) => {
  // 툴팁 내부를 클릭한 경우 무시
  if (tooltip && tooltip.contains(e.target as Node)) {
    return;
  }
  handleTextSelection(e);
});

// 툴팁 외부 클릭 시 닫기
document.addEventListener('mousedown', (e) => {
  if (tooltip && !tooltip.contains(e.target as Node)) {
    removeTooltip();
  }
});

// 툴팁 내부 클릭 시 이벤트 전파 중지 (외부 클릭 감지 방지)
document.addEventListener('mousedown', (e) => {
  if (tooltip && tooltip.contains(e.target as Node)) {
    e.stopPropagation();
  }
}, true);

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
async function handleTextSelection(event: MouseEvent): Promise<void> {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  // 기존 툴팁 제거
  removeTooltip();

  if (!selectedText || selectedText.length === 0) {
    return;
  }

  // 단어 길이 검증 (1-50자)
  if (selectedText.length < 1 || selectedText.length > 50) {
    return;
  }

  // 단어만 선택했는지 확인 (최대 3단어)
  const words = selectedText.split(/\s+/);
  if (words.length > 3) {
    return;
  }

  console.log('[CatchVoca] Text selected:', selectedText);

  // 마우스 위치 기준으로 툴팁 표시
  await showTooltip(selectedText, event.clientX, event.clientY);
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

  // CatchVoca 툴팁 제외하고 텍스트 추출
  const clonedElement = element.cloneNode(true) as HTMLElement;
  const catchvocaTooltip = clonedElement.querySelector('#catchvoca-tooltip');
  if (catchvocaTooltip) {
    catchvocaTooltip.remove();
  }

  // 요소의 전체 텍스트 추출
  const fullText = clonedElement.textContent || '';

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

/**
 * 툴팁 표시
 */
async function showTooltip(word: string, mouseX: number, mouseY: number): Promise<void> {
  // 툴팁 생성
  tooltip = document.createElement('div');
  tooltip.id = 'catchvoca-tooltip';
  tooltip.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    min-width: 250px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  `;

  // 로딩 상태 표시
  tooltip.innerHTML = `
    <div style="text-align: center; padding: 8px;">
      <div style="color: #6b7280;">검색 중...</div>
    </div>
  `;

  // 위치 계산 (마우스 우측하단, 여백 10px)
  const offsetX = 10;
  const offsetY = 10;

  // 화면 밖으로 나가지 않도록 조정
  let top = mouseY + offsetY;
  let left = mouseX + offsetX;

  // 임시로 추가해서 크기 측정
  document.body.appendChild(tooltip);
  const tooltipRect = tooltip.getBoundingClientRect();

  // 우측 경계 확인
  if (left + tooltipRect.width > window.innerWidth) {
    left = mouseX - tooltipRect.width - offsetX; // 마우스 왼쪽에 표시
  }

  // 하단 경계 확인
  if (top + tooltipRect.height > window.innerHeight) {
    top = mouseY - tooltipRect.height - offsetY; // 마우스 위쪽에 표시
  }

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;

  // API 조회
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LOOKUP_WORD',
      word: word,
    });

    if (response.success) {
      const result: LookupResult = response.data;
      updateTooltipContent(word, result);

      // 단어 조회 시 viewCount 증가 (비동기로 실행, 결과 무시)
      chrome.runtime.sendMessage({
        type: 'INCREMENT_VIEW_COUNT',
        word: word,
      }).catch((err) => {
        console.warn('[CatchVoca] Increment view count warning:', err);
      });
    } else {
      updateTooltipError('단어를 찾을 수 없습니다.');
    }
  } catch (error) {
    console.error('[CatchVoca] Tooltip lookup error:', error);
    updateTooltipError('검색 중 오류가 발생했습니다.');
  }
}

/**
 * 툴팁 내용 업데이트 (검색 결과)
 */
function updateTooltipContent(word: string, result: LookupResult): void {
  if (!tooltip) return;

  console.log('[CatchVoca] Lookup result:', result);

  // 발음기호와 재생 버튼을 한 줄로 표시
  const phoneticHtml = result.phonetic
    ? `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="color: #6b7280; font-size: 13px;">${result.phonetic}</span>
        ${result.audioUrl
          ? `<button id="catchvoca-play-audio" style="
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 2px 8px;
              cursor: pointer;
              font-size: 11px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">🔊 듣기</button>`
          : `<button disabled style="
              background: #d1d5db;
              color: #9ca3af;
              border: none;
              border-radius: 4px;
              padding: 2px 8px;
              cursor: not-allowed;
              font-size: 11px;
            ">🔊 없음</button>`
        }
      </div>`
    : `<div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="color: #9ca3af; font-size: 13px; font-style: italic;">발음 정보 없음</span>
        <button disabled style="
          background: #d1d5db;
          color: #9ca3af;
          border: none;
          border-radius: 4px;
          padding: 2px 8px;
          cursor: not-allowed;
          font-size: 11px;
        ">🔊 없음</button>
      </div>`;

  const definitionsHtml = result.definitions.length > 0
    ? result.definitions.slice(0, 3).map((def, idx) => `
        <div style="margin-bottom: 4px;">
          <span style="color: #6b7280;">${idx + 1}.</span> ${def}
        </div>
      `).join('')
    : '<div style="color: #9ca3af;">정의를 찾을 수 없습니다.</div>';

  tooltip.innerHTML = `
    <div style="position: relative;">
      <button id="catchvoca-close-btn" style="
        position: absolute;
        top: -8px;
        right: -8px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        cursor: pointer;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        line-height: 1;
      " title="닫기">×</button>
      <div style="font-weight: 600; font-size: 16px; margin-bottom: 4px;">${word}</div>
      ${phoneticHtml}
      <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
        ${definitionsHtml}
      </div>
      <button id="catchvoca-save-btn" style="
        background: #10b981;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 6px 12px;
        cursor: pointer;
        font-size: 13px;
        margin-top: 8px;
        width: 100%;
      ">💾 CatchVoca에 저장</button>
    </div>
  `;

  // X 버튼 이벤트
  const closeBtn = tooltip.querySelector('#catchvoca-close-btn');
  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeTooltip();
  });

  // 오디오 재생 버튼 이벤트 (이벤트 전파 중지로 위치 고정)
  if (result.audioUrl) {
    const playBtn = tooltip.querySelector('#catchvoca-play-audio');
    playBtn?.addEventListener('click', (e) => {
      e.stopPropagation(); // 이벤트 전파 중지
      e.preventDefault();
      const audio = new Audio(result.audioUrl);
      audio.play().catch(err => console.error('[CatchVoca] Audio play error:', err));
    });
  }

  // 저장 버튼 이벤트
  const saveBtn = tooltip.querySelector('#catchvoca-save-btn');
  saveBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const wordData = extractWordData(word);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        wordData: {
          ...wordData,
          definitions: result.definitions,
          phonetic: result.phonetic,
          audioUrl: result.audioUrl,
        },
      });

      if (response.success) {
        updateTooltipSuccess();
      } else {
        updateTooltipError('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('[CatchVoca] Save error:', error);
      updateTooltipError('저장 중 오류가 발생했습니다.');
    }
  });
}

/**
 * 툴팁 에러 표시
 */
function updateTooltipError(message: string): void {
  if (!tooltip) return;

  tooltip.innerHTML = `
    <div style="color: #ef4444; text-align: center; padding: 8px;">
      ${message}
    </div>
  `;

  // 3초 후 자동 닫기
  setTimeout(removeTooltip, 3000);
}

/**
 * 툴팁 성공 메시지 표시
 */
function updateTooltipSuccess(): void {
  if (!tooltip) return;

  tooltip.innerHTML = `
    <div style="color: #10b981; text-align: center; padding: 8px; font-weight: 600;">
      ✅ 저장되었습니다!
    </div>
  `;

  // 2초 후 자동 닫기
  setTimeout(removeTooltip, 2000);
}

/**
 * 툴팁 제거
 */
function removeTooltip(): void {
  if (tooltip) {
    tooltip.remove();
    tooltip = null;
  }
}

console.log('[CatchVoca] Content script loaded');
