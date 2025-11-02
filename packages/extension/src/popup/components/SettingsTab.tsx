/**
 * 설정 모드 (Settings Mode)
 * - Pro 상태 표시
 * - 동기화 설정
 * - 일반 설정
 */

import { useState, useEffect } from 'react';
import type { Settings } from '@catchvoca/types';
import { DEFAULT_SETTINGS } from '@catchvoca/types';
import QRCode from 'qrcode';

export function SettingsTab() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    wordCount: number;
    storageUsed: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

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
          const stats = response.data;
          const message = `✅ 데이터 가져오기 완료!\n\n` +
            `📥 가져온 항목:\n` +
            `  • 단어: ${stats.importedWords}개\n` +
            `  • 복습 상태: ${stats.importedReviews}개\n\n` +
            `⏭️ 건너뛴 항목:\n` +
            `  • 단어: ${stats.skippedWords}개 (기존 데이터가 더 최신)\n` +
            `  • 복습 상태: ${stats.skippedReviews}개\n\n` +
            `📊 전체: ${stats.totalWords}개 단어, ${stats.totalReviews}개 복습 상태`;

          alert(message);
          loadStorageInfo();
        } else {
          const errorMsg = response.error || '데이터 가져오기에 실패했습니다.';
          const details = response.details
            ? '\n\n오류 상세:\n' + response.details.map((d: any) => `  • ${d.field}: ${d.message}`).join('\n')
            : '';
          alert(errorMsg + details);
        }
      } catch (err) {
        alert('❌ 잘못된 파일 형식입니다.\n\nCatchVoca 백업 파일(.json)을 선택해주세요.');
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
   * 모바일 퀴즈 URL 생성 (URL Hash 기반)
   */
  const handleGenerateMobileQuiz = async () => {
    setIsUploading(true);
    setMobileUrl(null);

    try {
      // 1. 복습 대상 단어 가져오기
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DUE_REVIEWS',
        limit: 20,
      });

      if (response.success && response.data.length > 0) {
        // 2. 단어 데이터를 Base64로 인코딩
        const quizData = response.data.map((word: any) => ({
          id: word.id,
          word: word.word,
          definitions: word.definitions,
          phonetic: word.phonetic,
        }));

        const jsonStr = JSON.stringify(quizData);
        const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));

        // 3. URL Hash 생성
        const extensionId = chrome.runtime.id;
        const quizUrl = `chrome-extension://${extensionId}/quiz.html#${base64Data}`;

        setMobileUrl(quizUrl);

        // 4. QR 코드 생성
        try {
          const qrDataUrl = await QRCode.toDataURL(quizUrl, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
          setQrCodeDataUrl(qrDataUrl);
        } catch (qrErr) {
          console.error('[SettingsTab] QR code generation error:', qrErr);
        }
      } else {
        alert('복습할 단어가 없습니다. 먼저 단어를 저장해주세요!');
      }
    } catch (err) {
      alert('모바일 퀴즈 생성 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Generate mobile quiz error:', err);
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

      {/* 일반 설정 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">일반 설정</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            기본 언어
          </label>
          <select
            value={settings.defaultLanguage}
            onChange={(e) =>
              setSettings({ ...settings, defaultLanguage: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh">中文</option>
            <option value="ko">한국어</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">발음 자동 재생</label>
            <p className="text-xs text-gray-500">단어 조회 시 발음 자동 재생</p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, autoPlayAudio: !settings.autoPlayAudio })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoPlayAudio ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoPlayAudio ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

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
            value={settings.dailyReviewLimit}
            onChange={(e) =>
              setSettings({ ...settings, dailyReviewLimit: parseInt(e.target.value) || 20 })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            하루에 복습할 단어 수 (기본: 20개)
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">복습 알림</label>
            <p className="text-xs text-gray-500">복습 시간 알림 받기</p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, reviewNotifications: !settings.reviewNotifications })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.reviewNotifications ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.reviewNotifications ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">자동 복습 추가</label>
            <p className="text-xs text-gray-500">저장 시 자동으로 복습 큐에 추가</p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, autoAddToReview: !settings.autoAddToReview })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.autoAddToReview ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.autoAddToReview ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* UI 설정 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">UI 설정</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            테마
          </label>
          <select
            value={settings.theme}
            onChange={(e) =>
              setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'auto' })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="light">라이트</option>
            <option value="dark">다크</option>
            <option value="auto">시스템 설정 따르기</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700">컴팩트 모드</label>
            <p className="text-xs text-gray-500">간결한 UI 사용</p>
          </div>
          <button
            onClick={() =>
              setSettings({ ...settings, compactMode: !settings.compactMode })
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.compactMode ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.compactMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 모바일 퀴즈 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">📱 모바일 퀴즈</h3>
        <p className="text-sm text-gray-600">
          URL 링크로 모바일에서 간편하게 복습하세요
        </p>

        <button
          onClick={handleGenerateMobileQuiz}
          disabled={isUploading}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isUploading ? '생성 중...' : '🔗 모바일 퀴즈 링크 생성'}
        </button>

        {mobileUrl && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md space-y-3">
            <p className="text-sm text-green-800 font-medium">
              ✅ 모바일 퀴즈가 생성되었습니다!
            </p>

            {/* QR 코드 */}
            {qrCodeDataUrl && (
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-lg shadow-sm">
                  <img
                    src={qrCodeDataUrl}
                    alt="QR Code"
                    className="w-48 h-48"
                  />
                  <p className="text-xs text-center text-gray-600 mt-2">
                    📱 모바일로 스캔하세요
                  </p>
                </div>
              </div>
            )}

            {/* URL */}
            <div>
              <p className="text-xs text-gray-700 mb-1 font-medium">또는 URL 직접 복사:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={mobileUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-xs bg-white border border-green-300 rounded-md"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm whitespace-nowrap"
                >
                  복사
                </button>
              </div>
            </div>

            <p className="text-xs text-green-700">
              💡 QR 코드를 스캔하거나 URL을 복사하여 모바일 브라우저에서 열어 복습하세요
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
            <span className="font-medium text-gray-900">0.3.0</span>
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
