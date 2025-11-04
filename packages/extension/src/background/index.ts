/**
 * Background Service Worker (v0.3.0)
 * 메시지 라우팅 및 컨텍스트 메뉴 관리
 */

import { db, Logger } from '@catchvoca/core';
import type { WordEntryInput } from '@catchvoca/types';
import { handleMessage } from './services/messageHandlers';
import { saveWord } from './services/wordService';

const logger = new Logger('Background');

// DB 초기화
let dbInitialized = false;

async function ensureDbInitialized(): Promise<void> {
  if (!dbInitialized) {
    try {
      await db.open();
      dbInitialized = true;
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Database initialization failed', error);
      throw error;
    }
  }
}

// 컨텍스트 메뉴 생성
chrome.runtime.onInstalled.addListener(async () => {
  await ensureDbInitialized();

  chrome.contextMenus.create({
    id: 'catchvoca-save-word',
    title: 'CatchVoca에 저장',
    contexts: ['selection'],
  });

  logger.info('Background service worker installed');
});

// 컨텍스트 메뉴 클릭 이벤트
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'catchvoca-save-word' && info.selectionText && tab?.id) {
    const selectedText = info.selectionText.trim();

    if (selectedText.length < 1 || selectedText.length > 50) {
      logger.warn('Invalid word length', { length: selectedText.length });
      return;
    }

    try {
      // Content Script에서 전체 컨텍스트 가져오기
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'GET_SELECTION',
      });

      if (response.success) {
        await saveWord(response.data);
      }
    } catch (error) {
      logger.error('Failed to get selection context', error);

      // 최소한의 정보로 저장
      await saveWord({
        word: selectedText,
        context: selectedText,
        url: tab.url || '',
        sourceTitle: tab.title || '',
      } as Partial<WordEntryInput>);
    }
  }
});

// Message handlers
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    await ensureDbInitialized();
    await handleMessage(message, sendResponse);
  })();
  return true; // Keep message channel open for async response
});

// Keyboard shortcuts (Commands API)
chrome.commands.onCommand.addListener(async (command) => {
  await ensureDbInitialized();

  logger.info('Command triggered', { command });

  if (command === 'save-word') {
    await handleSaveWordShortcut();
  } else if (command === 'start-quiz') {
    await handleStartQuizShortcut();
  } else if (command === 'lookup-word-pdf') {
    await handleLookupWordPdfShortcut();
  }
});

/**
 * Handle save-word shortcut (Ctrl+Shift+S)
 */
async function handleSaveWordShortcut(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      logger.warn('No active tab found');
      return;
    }

    // Get selection from content script
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_SELECTION',
    });

    if (response.success && response.data.word) {
      await saveWord(response.data);

      // Show success notification
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'CatchVoca',
        message: `"${response.data.word}" saved successfully!`,
      });
    } else {
      logger.warn('No text selected');
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'CatchVoca',
        message: 'Please select a word first',
      });
    }
  } catch (error) {
    logger.error('Save word shortcut failed', error);
  }
}

/**
 * Handle start-quiz shortcut (Ctrl+Shift+Q)
 */
async function handleStartQuizShortcut(): Promise<void> {
  try {
    // Open popup and switch to quiz tab
    await chrome.action.openPopup();

    // Send message to popup to switch to quiz tab
    chrome.runtime.sendMessage({
      type: 'SWITCH_TO_QUIZ',
    }).catch(() => {
      // Popup might not be loaded yet, ignore error
    });

    logger.info('Quiz shortcut triggered');
  } catch (error) {
    logger.error('Start quiz shortcut failed', error);
  }
}

/**
 * Handle lookup-word-pdf shortcut (Ctrl+Shift+D)
 * PDF에서 선택된 단어를 자동으로 복사하고 조회
 */
async function handleLookupWordPdfShortcut(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      logger.warn('No active tab found for PDF lookup');
      return;
    }

    // PDF 페이지인지 확인
    const isPDF = tab.url?.toLowerCase().endsWith('.pdf') ||
                  tab.url?.includes('chrome-extension://') && tab.url?.includes('.pdf');

    if (!isPDF) {
      logger.info('Not a PDF page, ignoring lookup-word-pdf command');
      return;
    }

    logger.info('PDF lookup shortcut triggered on tab', { tabId: tab.id, url: tab.url });

    // 1단계: 선택된 텍스트를 자동으로 복사
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 선택된 텍스트가 있는지 확인
          const selection = window.getSelection();
          const selectedText = selection?.toString().trim();

          if (selectedText) {
            // execCommand를 사용하여 복사
            document.execCommand('copy');
            return { success: true, text: selectedText };
          }
          return { success: false };
        },
      });

      // 복사 완료 대기 (100ms)
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (scriptError) {
      logger.warn('Auto-copy script failed, trying clipboard read', scriptError);
    }

    // 2단계: 클립보드에서 텍스트 읽기
    try {
      // offscreen document를 사용하여 클립보드 읽기
      // (service worker는 직접 navigator.clipboard에 접근 불가)
      const clipboardText = await readClipboard();

      if (!clipboardText || !clipboardText.trim()) {
        logger.warn('Clipboard is empty');
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'CatchVoca',
          message: 'Please copy a word first (Ctrl+C)',
        });
        return;
      }

      const word = clipboardText.trim();

      // 단어 길이 검증 (1-50자)
      if (word.length < 1 || word.length >= 50) {
        logger.warn('Invalid word length', { length: word.length });
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'CatchVoca',
          message: 'Word must be 1-50 characters',
        });
        return;
      }

      // 단어 개수 검증 (최대 3단어)
      const words = word.split(/\s+/);
      if (words.length > 3) {
        logger.warn('Too many words', { count: words.length });
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: 'CatchVoca',
          message: 'Maximum 3 words allowed',
        });
        return;
      }

      logger.info('Valid word from clipboard', { word });

      // 팝업을 열고 PDF 조회 정보 저장
      // 팝업이 열리면 자동으로 이 정보를 읽어서 단어 조회
      await chrome.storage.local.set({
        pdfLookupWord: {
          word,
          timestamp: Date.now(),
        },
      });

      await chrome.action.openPopup();
      logger.info('PDF lookup initiated, popup opened');

    } catch (error) {
      logger.error('Failed to read clipboard', error);
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'CatchVoca',
        message: 'Failed to read clipboard. Please try again.',
      });
    }
  } catch (error) {
    logger.error('PDF lookup shortcut failed', error);
  }
}

/**
 * 클립보드에서 텍스트 읽기
 * Service worker는 navigator.clipboard에 직접 접근할 수 없으므로
 * offscreen document를 사용
 */
async function readClipboard(): Promise<string> {
  try {
    // Offscreen document 생성 (이미 존재하면 재사용)
    await setupOffscreenDocument();

    // Offscreen document에 클립보드 읽기 요청
    const response = await chrome.runtime.sendMessage({
      type: 'READ_CLIPBOARD_OFFSCREEN',
    });

    if (response && response.success) {
      return response.text || '';
    }

    throw new Error('Failed to read clipboard from offscreen document');
  } catch (error) {
    logger.error('Clipboard read failed', error);
    return '';
  }
}

/**
 * Offscreen document 설정
 */
async function setupOffscreenDocument(): Promise<void> {
  // Chrome이 offscreen document API를 지원하는지 확인
  if (!chrome.offscreen) {
    throw new Error('Offscreen API not supported');
  }

  // 이미 offscreen document가 있는지 확인
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
  });

  if (existingContexts.length > 0) {
    return; // 이미 존재함
  }

  // Offscreen document 생성
  await chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['CLIPBOARD' as chrome.offscreen.Reason],
    justification: 'Read clipboard content for word lookup in PDF',
  });
}

logger.info('Background service worker loaded');
