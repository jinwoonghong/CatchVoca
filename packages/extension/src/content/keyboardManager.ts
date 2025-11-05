/**
 * Keyboard Manager
 * 특수키 조합 처리 (Ctrl/Alt/Shift + 클릭)
 */

import type { KeyboardSettings, KeyboardShortcut } from '@catchvoca/types';

// 키보드 설정
let keyboardSettings: KeyboardSettings = {
  quickLookup: {
    enabled: true,
    key: 'ctrl',
    requiresClick: true,
  },
  quickSave: {
    enabled: true,
    key: 'alt',
    requiresClick: true,
  },
  toggleLearnedHighlight: 'Shift', // 기본: Shift 키
};

/**
 * KeyboardManager 초기화
 */
export function initializeKeyboardManager(): void {
  console.log('[KeyboardManager] Initializing...');

  // 설정 로드
  loadKeyboardSettings();

  // 클릭 이벤트 리스너 등록
  document.addEventListener('click', handleClick, true); // capture phase

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'UPDATE_KEYBOARD_SETTINGS') {
      keyboardSettings = message.settings;
      sendResponse({ success: true });
    }
    return true;
  });

  console.log('[KeyboardManager] Initialized');
}

/**
 * 키보드 설정 로드
 */
async function loadKeyboardSettings(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS',
    });

    if (response.success && response.data.keyboardSettings) {
      keyboardSettings = response.data.keyboardSettings;
    }
  } catch (error) {
    console.error('[KeyboardManager] Failed to load settings:', error);
  }
}

/**
 * 클릭 이벤트 핸들러
 */
function handleClick(event: MouseEvent): void {
  // Quick Lookup (Ctrl/Alt + 클릭으로 즉시 조회)
  if (isShortcutActive(keyboardSettings.quickLookup, event)) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;
    const word = extractWordFromElement(target);

    if (word) {
      console.log('[KeyboardManager] Quick lookup triggered:', word);
      triggerQuickLookup(word);
    }
  }

  // Quick Save (Alt + 클릭으로 즉시 저장)
  if (isShortcutActive(keyboardSettings.quickSave, event)) {
    event.preventDefault();
    event.stopPropagation();

    const target = event.target as HTMLElement;
    const word = extractWordFromElement(target);

    if (word) {
      console.log('[KeyboardManager] Quick save triggered:', word);
      triggerQuickSave(word);
    }
  }
}

/**
 * 단축키가 활성화되었는지 확인
 */
function isShortcutActive(
  shortcut: KeyboardShortcut,
  event: MouseEvent
): boolean {
  if (!shortcut.enabled) {
    return false;
  }

  // 클릭이 필요한 경우
  if (shortcut.requiresClick && event.type !== 'click') {
    return false;
  }

  // 키 확인
  switch (shortcut.key) {
    case 'ctrl':
      return event.ctrlKey && !event.altKey && !event.shiftKey;
    case 'alt':
      return event.altKey && !event.ctrlKey && !event.shiftKey;
    case 'shift':
      return event.shiftKey && !event.ctrlKey && !event.altKey;
    default:
      return false;
  }
}

/**
 * 요소에서 단어 추출
 */
function extractWordFromElement(element: HTMLElement): string | null {
  // 텍스트 노드에서 단어 추출
  const text = element.textContent?.trim();

  if (!text) {
    return null;
  }

  // 단일 단어인 경우
  if (/^[a-zA-Z]+$/.test(text)) {
    return text;
  }

  // 여러 단어인 경우 (예: 하이라이트된 span) - 첫 단어 반환
  const words = text.match(/\b[a-zA-Z]+\b/);
  if (words && words.length > 0) {
    return words[0] || null;
  }

  return null;
}

/**
 * 빠른 조회 트리거
 */
function triggerQuickLookup(word: string): void {
  try {
    chrome.runtime.sendMessage({
      type: 'QUICK_LOOKUP',
      data: { word },
    });

    // 사용자 피드백 (간단한 알림)
    showQuickFeedback('🔍 조회 중...', word);
  } catch (error) {
    console.error('[KeyboardManager] Failed to trigger quick lookup:', error);
  }
}

/**
 * 빠른 저장 트리거
 */
function triggerQuickSave(word: string): void {
  try {
    // 현재 페이지 정보 포함
    const context = extractContextAroundWord(word);
    const url = window.location.href;
    const sourceTitle = document.title;

    chrome.runtime.sendMessage({
      type: 'QUICK_SAVE',
      data: {
        word,
        context,
        url,
        sourceTitle,
      },
    });

    // 사용자 피드백
    showQuickFeedback('💾 저장 완료', word);
  } catch (error) {
    console.error('[KeyboardManager] Failed to trigger quick save:', error);
  }
}

/**
 * 단어 주변 문맥 추출
 */
function extractContextAroundWord(word: string): string {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return word;
  }

  const range = selection.getRangeAt(0);
  const container = range.commonAncestorContainer;

  // 부모 요소의 텍스트 가져오기
  let parentText = '';

  if (container.nodeType === Node.TEXT_NODE && container.parentElement) {
    parentText = container.parentElement.textContent || '';
  } else if (container.nodeType === Node.ELEMENT_NODE) {
    parentText = (container as HTMLElement).textContent || '';
  }

  // 단어 주변 100자 추출
  const wordIndex = parentText.toLowerCase().indexOf(word.toLowerCase());

  if (wordIndex === -1) {
    return word;
  }

  const start = Math.max(0, wordIndex - 50);
  const end = Math.min(parentText.length, wordIndex + word.length + 50);

  return parentText.substring(start, end).trim();
}

/**
 * 빠른 피드백 표시
 */
function showQuickFeedback(message: string, word: string): void {
  // 기존 피드백 제거
  const existingFeedback = document.getElementById('catchvoca-quick-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }

  // 피드백 요소 생성
  const feedback = document.createElement('div');
  feedback.id = 'catchvoca-quick-feedback';
  feedback.textContent = `${message}: ${word}`;

  // 스타일 적용
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 16px;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    color: #1f2937;
    animation: slideIn 0.3s ease-out;
  `;

  // 애니메이션 추가
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  // DOM에 추가
  document.body.appendChild(feedback);

  // 2초 후 제거
  setTimeout(() => {
    feedback.style.opacity = '0';
    feedback.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
      feedback.remove();
      style.remove();
    }, 300);
  }, 2000);
}

/**
 * KeyboardManager 정리
 */
export function cleanupKeyboardManager(): void {
  document.removeEventListener('click', handleClick, true);
  console.log('[KeyboardManager] Cleaned up');
}
