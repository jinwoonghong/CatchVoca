/**
 * Chrome Storage Service
 * Settings 및 Chrome Storage 관리
 */

import { Logger } from '@catchvoca/core';
import type { Settings } from '@catchvoca/types';
import { DEFAULT_SETTINGS } from '@catchvoca/types';

const logger = new Logger('Storage');

const SETTINGS_STORAGE_KEY = 'catchvoca_settings';

/**
 * Settings 가져오기
 */
export async function getSettings(): Promise<Settings> {
  try {
    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const storedSettings = result[SETTINGS_STORAGE_KEY];

    // 저장된 설정이 있으면 기본값과 병합
    if (storedSettings) {
      return {
        ...DEFAULT_SETTINGS,
        ...storedSettings,
      };
    }

    // 없으면 기본값 반환
    return DEFAULT_SETTINGS;
  } catch (error) {
    logger.error('Failed to get settings', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Settings 저장
 */
export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  try {
    // 현재 설정 가져오기
    const currentSettings = await getSettings();

    // 업데이트된 설정 병합
    const updatedSettings: Settings = {
      ...currentSettings,
      ...settings,
    };

    // 저장
    await chrome.storage.local.set({
      [SETTINGS_STORAGE_KEY]: updatedSettings,
    });

    logger.info('Settings updated');
  } catch (error) {
    logger.error('Failed to update settings', error);
    throw error;
  }
}
