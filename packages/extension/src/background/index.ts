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

logger.info('Background service worker loaded');
