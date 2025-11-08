/**
 * Background Service Worker (v0.3.0)
 * 메시지 라우팅 및 컨텍스트 메뉴 관리
 */

import type { WordEntryInput } from '@catchvoca/types';
import { handleMessage } from './services/messageHandlers';
import { saveWord } from './services/wordService';

// Background Service Worker용 DB 인스턴스는 동적 로드 후 생성
// (Dexie가 window를 참조하므로 모듈 로드 시점에 생성 불가)
let db: any = null;

async function initDb() {
  if (!db) {
    const { CheckVocaDB } = await import('@catchvoca/core');
    db = new CheckVocaDB();
  }
  return db;
}

// 간단한 로거 (background service worker용)
const log = {
  info: (msg: string, data?: any) => console.log(`[Background] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[Background] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[Background] ${msg}`, data || ''),
};

// DB 초기화
let dbInitialized = false;

async function ensureDbInitialized(): Promise<void> {
  if (!dbInitialized) {
    try {
      const dbInstance = await initDb();
      await dbInstance.open();
      dbInitialized = true;
      log.info('Database initialized successfully');
    } catch (error) {
      log.error('Database initialization failed', error);
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

  log.info('Background service worker installed');
});

// 컨텍스트 메뉴 클릭 이벤트
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'catchvoca-save-word' && info.selectionText && tab?.id) {
    const selectedText = info.selectionText.trim();

    if (selectedText.length < 1 || selectedText.length > 50) {
      log.warn('Invalid word length', { length: selectedText.length });
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
      log.error('Failed to get selection context', error);

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

  log.info('Command triggered', { command });

  if (command === 'save-word') {
    await handleSaveWordShortcut();
  } else if (command === 'start-quiz') {
    await handleStartQuizShortcut();
  }
});

/**
 * Handle save-word shortcut (Ctrl+Shift+S)
 */
async function handleSaveWordShortcut(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      log.warn('No active tab found');
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
      log.warn('No text selected');
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png',
        title: 'CatchVoca',
        message: 'Please select a word first',
      });
    }
  } catch (error) {
    log.error('Save word shortcut failed', error);
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

    log.info('Quiz shortcut triggered');
  } catch (error) {
    log.error('Start quiz shortcut failed', error);
  }
}

log.info('Background service worker loaded');
