/**
 * Chrome Commands Handler
 * 전역 단축키 처리
 */

import { Logger } from '@catchvoca/core';

const logger = new Logger('CommandHandler');

/**
 * Command 핸들러 등록
 */
export function registerCommandHandlers(): void {
  chrome.commands.onCommand.addListener(async (command) => {
    logger.info('Command received', { command });

    try {
      switch (command) {
        case 'save-word':
          await handleSaveWordCommand();
          break;

        case 'start-quiz':
          await handleStartQuizCommand();
          break;

        default:
          logger.warn('Unknown command', { command });
      }
    } catch (error) {
      logger.error('Command handler error', error);
    }
  });

  logger.info('Command handlers registered');
}

/**
 * 단어 저장 단축키 핸들러
 */
async function handleSaveWordCommand(): Promise<void> {
  try {
    // 현재 활성 탭 가져오기
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      logger.warn('No active tab found');
      return;
    }

    // Content Script에 선택된 텍스트 요청
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_SELECTION',
    });

    if (!response.success || !response.data) {
      // 선택된 텍스트 없음 알림
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'CatchVoca',
        message: '선택된 텍스트가 없습니다.',
      });
      return;
    }

    // Background로 단어 저장 메시지 전송
    const saveResponse = await chrome.runtime.sendMessage({
      type: 'SAVE_WORD',
      wordData: response.data,
    });

    if (saveResponse.success) {
      // 성공 알림
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'CatchVoca',
        message: `"${response.data.word}" 저장 완료!`,
      });
    } else {
      // 실패 알림
      await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: 'CatchVoca',
        message: `저장 실패: ${saveResponse.error || '알 수 없는 오류'}`,
      });
    }
  } catch (error) {
    logger.error('Save word command error', error);
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: 'CatchVoca',
      message: '단어 저장 중 오류가 발생했습니다.',
    });
  }
}

/**
 * 퀴즈 시작 단축키 핸들러
 */
async function handleStartQuizCommand(): Promise<void> {
  try {
    // Popup 열기 (퀴즈 탭)
    await chrome.action.openPopup();

    // Popup에 퀴즈 탭으로 전환 메시지 전송
    // Note: Popup이 열린 직후에는 메시지 전송 실패 가능
    setTimeout(async () => {
      try {
        await chrome.runtime.sendMessage({
          type: 'SWITCH_TO_QUIZ_TAB',
        });
      } catch (error) {
        // Popup이 아직 준비되지 않은 경우 무시
        logger.warn('Failed to send switch tab message', error);
      }
    }, 100);
  } catch (error) {
    logger.error('Start quiz command error', error);
  }
}

/**
 * 현재 설정된 단축키 조회
 */
export async function getAllCommands(): Promise<chrome.commands.Command[]> {
  try {
    const commands = await chrome.commands.getAll();
    return commands;
  } catch (error) {
    logger.error('Get all commands error', error);
    return [];
  }
}

/**
 * 특정 커맨드의 단축키 업데이트
 * Note: Chrome Extensions API는 프로그래밍 방식으로 단축키 변경을 지원하지 않음
 * 사용자가 chrome://extensions/shortcuts에서 직접 변경해야 함
 */
export function openShortcutSettings(): void {
  chrome.tabs.create({
    url: 'chrome://extensions/shortcuts',
  });
}
