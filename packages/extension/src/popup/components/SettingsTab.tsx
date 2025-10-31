/**
 * 설정 모드 (Settings Mode)
 * - Pro 상태 표시
 * - 동기화 설정
 * - 일반 설정
 */

import { useState, useEffect } from 'react';

interface Settings {
  dailyReviewGoal: number;
  autoSync: boolean;
  notifications: boolean;
  theme: 'light' | 'dark' | 'auto';
}

export function SettingsTab() {
  const [settings, setSettings] = useState<Settings>({
    dailyReviewGoal: 20,
    autoSync: false,
    notifications: true,
    theme: 'auto',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    wordCount: number;
    storageUsed: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);

  /**
   * 설정 로드
   */
  useEffect(() => {
    loadSettings();
    loadStorageInfo();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS',
      });

      if (response.success) {
        setSettings(response.data);
      }
    } catch (err) {
      console.error('[SettingsTab] Load settings error:', err);
    }
  };

  const loadStorageInfo = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STORAGE_INFO',
      });

      if (response.success) {
        setStorageInfo(response.data);
      }
    } catch (err) {
      console.error('[SettingsTab] Load storage info error:', err);
    }
  };

  /**
   * 설정 저장
   */
  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings,
      });

      if (response.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (err) {
      alert('설정 저장 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Save settings error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 데이터 내보내기
   */
  const handleExport = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_DATA',
      });

      if (response.success) {
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `catchvoca-backup-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('데이터 내보내기 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Export error:', err);
    }
  };

  /**
   * 데이터 가져오기
   */
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        const response = await chrome.runtime.sendMessage({
          type: 'IMPORT_DATA',
          data,
        });

        if (response.success) {
          alert('데이터를 가져왔습니다.');
          loadStorageInfo();
        } else {
          alert('데이터 가져오기에 실패했습니다.');
        }
      } catch (err) {
        alert('잘못된 파일 형식입니다.');
        console.error('[SettingsTab] Import error:', err);
      }
    };
    input.click();
  };

  /**
   * 모든 데이터 삭제
   */
  const handleClearAll = async () => {
    if (!confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CLEAR_ALL_DATA',
      });

      if (response.success) {
        alert('모든 데이터가 삭제되었습니다.');
        loadStorageInfo();
      } else {
        alert('데이터 삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('데이터 삭제 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Clear all error:', err);
    }
  };

  /**
   * 모바일 퀴즈 스냅샷 업로드
   */
  const handleUploadSnapshot = async () => {
    setIsUploading(true);
    setMobileUrl(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPLOAD_SNAPSHOT',
      });

      if (response.success) {
        setMobileUrl(response.data.mobileUrl);
      } else {
        alert('스냅샷 업로드에 실패했습니다.');
      }
    } catch (err) {
      alert('스냅샷 업로드 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Upload snapshot error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * 모바일 URL 복사
   */
  const handleCopyUrl = () => {
    if (mobileUrl) {
      navigator.clipboard.writeText(mobileUrl);
      alert('URL이 클립보드에 복사되었습니다!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Pro 상태 (Free 버전 표시) */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">무료 버전</h3>
            <p className="text-sm text-gray-600 mt-1">
              Local-First 방식으로 모든 기능을 무료로 이용할 수 있습니다
            </p>
          </div>
          <svg
            className="w-12 h-12 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
      </div>

      {/* 저장 성공 메시지 */}
      {saveSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          ✅ 설정이 저장되었습니다!
        </div>
      )}

      {/* 학습 설정 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">학습 설정</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            일일 복습 목표
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value={settings.dailyReviewGoal}
            onChange={(e) =>
              setSettings({ ...settings, dailyReviewGoal: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            하루에 복습할 단어 수 (기본: 20개)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">알림</label>
            <p className="text-xs text-gray-500">복습 알림 받기</p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, notifications: !settings.notifications })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.notifications ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.notifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 동기화 설정 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">동기화 설정</h3>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">자동 동기화</label>
            <p className="text-xs text-gray-500">브라우저 간 자동 동기화 (향후 지원 예정)</p>
          </div>
          <button
            disabled
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 cursor-not-allowed"
          >
            <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
          </button>
        </div>
      </div>

      {/* 모바일 퀴즈 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">📱 모바일 퀴즈</h3>
        <p className="text-sm text-gray-600">
          Google Apps Script로 모바일에서 간편하게 복습하세요
        </p>

        <button
          onClick={handleUploadSnapshot}
          disabled={isUploading}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isUploading ? '업로드 중...' : '📤 모바일 퀴즈 생성'}
        </button>

        {mobileUrl && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800 font-medium mb-2">
              ✅ 모바일 퀴즈가 생성되었습니다!
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={mobileUrl}
                readOnly
                className="flex-1 px-3 py-2 text-sm bg-white border border-green-300 rounded-md"
              />
              <button
                onClick={handleCopyUrl}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm whitespace-nowrap"
              >
                복사
              </button>
            </div>
            <p className="text-xs text-green-700 mt-2">
              💡 이 URL을 모바일 브라우저에서 열어 복습하세요
            </p>
          </div>
        )}
      </div>

      {/* 데이터 관리 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">데이터 관리</h3>

        {storageInfo && (
          <div className="p-3 bg-gray-50 rounded-md">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">저장된 단어</span>
              <span className="font-medium text-gray-900">{storageInfo.wordCount}개</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">사용 중인 저장 공간</span>
              <span className="font-medium text-gray-900">{storageInfo.storageUsed}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            📤 내보내기
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
          >
            📥 가져오기
          </button>
        </div>

        <button
          onClick={handleClearAll}
          className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
        >
          🗑️ 모든 데이터 삭제
        </button>
      </div>

      {/* 정보 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">정보</h3>

        <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>버전</span>
            <span className="font-medium text-gray-900">0.1.0</span>
          </div>
          <div className="flex justify-between">
            <span>복습 알고리즘</span>
            <span className="font-medium text-gray-900">SM-2</span>
          </div>
          <div className="flex justify-between">
            <span>저장 방식</span>
            <span className="font-medium text-gray-900">Local-First (IndexedDB)</span>
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full px-4 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
      >
        {isSaving ? '저장 중...' : '설정 저장'}
      </button>
    </div>
  );
}
