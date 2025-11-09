/**
 * 설정 모드 (Settings Mode)
 * - Pro 상태 표시
 * - 동기화 설정
 * - 일반 설정
 */

import { useState, useEffect } from 'react';
import type { Settings, SyncStatus } from '@catchvoca/types';
import { DEFAULT_SETTINGS } from '@catchvoca/types';

interface SettingsTabProps {
  onUserAuthChanged?: () => void;
}

export function SettingsTab({ onUserAuthChanged }: SettingsTabProps) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    wordCount: number;
    storageUsed: string;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isAuthenticated: false,
    currentUser: null,
    authToken: null,
    lastSyncedAt: 0,
    syncInProgress: false,
  });
  const [isSyncing, setIsSyncing] = useState(false);

  /**
   * 설정 로드
   */
  useEffect(() => {
    loadSettings();
    loadStorageInfo();
    loadSyncStatus();
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

  const loadSyncStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_SYNC_STATUS',
      });

      if (response.success) {
        setSyncStatus(response.data);
      }
    } catch (err) {
      console.error('[SettingsTab] Load sync status error:', err);
    }
  };

  /**
   * Google 로그인
   */
  const handleGoogleLogin = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_LOGIN',
      });

      if (response.success) {
        setSyncStatus(response.data);
        alert(`✅ 로그인 성공!\n\n${response.data.currentUser?.email}`);

        // Notify App component to update header
        onUserAuthChanged?.();
      } else {
        alert(`로그인 실패: ${response.error}`);
      }
    } catch (err) {
      alert('로그인 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Login error:', err);
    }
  };

  /**
   * 로그아웃
   */
  const handleLogout = async () => {
    if (!confirm('로그아웃하시겠습니까?')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_LOGOUT',
      });

      if (response.success) {
        setSyncStatus({
          isAuthenticated: false,
          currentUser: null,
          authToken: null,
          lastSyncedAt: 0,
          syncInProgress: false,
        });
        alert('로그아웃되었습니다.');

        // Notify App component to update header
        onUserAuthChanged?.();
      } else {
        alert(`로그아웃 실패: ${response.error}`);
      }
    } catch (err) {
      alert('로그아웃 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Logout error:', err);
    }
  };

  /**
   * 수동 동기화
   */
  const handleManualSync = async () => {
    setIsSyncing(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_NOW',
      });

      if (response.success) {
        setSyncStatus(response.data);
        const result = response.syncResult;
        alert(
          `✅ 동기화 완료!\n\n단어: ${result.wordsSynced}개\n복습 상태: ${result.reviewsSynced}개`
        );
      } else {
        alert(`동기화 실패: ${response.error}`);
      }
    } catch (err) {
      alert('동기화 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  /**
   * 동기화 초기화 (전체 동기화 강제)
   */
  const handleResetSync = async () => {
    if (!confirm('동기화를 초기화하시겠습니까?\n\n모든 로컬 데이터를 서버로 다시 전송합니다.')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_RESET',
      });

      if (response.success) {
        setSyncStatus(response.data);
        alert('✅ 동기화가 초기화되었습니다.\n\n"지금 동기화"를 눌러 전체 동기화를 시작하세요.');
      } else {
        alert(`초기화 실패: ${response.error}`);
      }
    } catch (err) {
      alert('초기화 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Reset sync error:', err);
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
   * CSV 형식으로 변환
   */
  const convertToCSV = (words: any[]): string => {
    // CSV 헤더
    const headers = ['단어', '발음', '정의', '문맥', '조회수'];

    // CSV 행 생성
    const rows = words.map(word => {
      // 정의들을 세미콜론으로 구분
      const definitions = (word.definitions || []).join('; ');

      // 조회수 (숫자)
      const viewCount = word.viewCount || 0;

      // CSV 필드 이스케이프 처리 (쉼표, 따옴표, 줄바꿈 포함 시)
      const escapeField = (field: string) => {
        if (!field) return '';
        const needsEscape = field.includes(',') || field.includes('"') || field.includes('\n');
        if (needsEscape) {
          return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
      };

      return [
        escapeField(word.word || ''),
        escapeField(word.phonetic || ''),
        escapeField(definitions),
        escapeField(word.context || ''),
        viewCount,
      ].join(',');
    });

    // BOM 추가 (Excel에서 UTF-8 인식을 위해)
    return '\uFEFF' + [headers.join(','), ...rows].join('\n');
  };

  /**
   * 데이터 내보내기 (CSV 형식)
   */
  const handleExportData = async () => {
    // TODO: Pro 기능 - 광고 팝업 표시
    // 현재는 일반 확인 팝업으로 대체
    const confirmed = confirm(
      '단어장을 CSV 파일로 내보내시겠습니까?\n\n' +
      '💡 Pro 버전에서는 광고 없이 즉시 다운로드됩니다.'
    );

    if (!confirmed) return;

    setIsExporting(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      if (response.success && response.data) {
        const words = response.data;

        if (words.length === 0) {
          alert('내보낼 단어가 없습니다.');
          return;
        }

        // CSV 변환
        const csvContent = convertToCSV(words);

        // Blob 생성 및 다운로드
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `catchvoca-단어장-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert(`✅ CSV 내보내기 완료!\n\n단어 수: ${words.length}개`);
      } else {
        alert(`내보내기 실패: ${response.error || '알 수 없는 오류'}`);
      }
    } catch (err) {
      alert('데이터 내보내기 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * 데이터 가져오기
   */
  const handleImportData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const backupData = JSON.parse(content);

          const confirmed = confirm(
            `백업 파일을 가져오시겠습니까?\n\n단어: ${backupData.metadata?.totalWords || 0}개\n복습 상태: ${backupData.metadata?.totalReviewStates || 0}개\n\n기존 데이터와 중복되는 단어는 건너뜁니다.`
          );

          if (!confirmed) {
            setIsImporting(false);
            return;
          }

          const response = await chrome.runtime.sendMessage({
            type: 'IMPORT_ALL_DATA',
            data: {
              backupData,
              options: {
                clearExisting: false,
                skipDuplicates: true,
              },
            },
          });

          if (response.success) {
            const result = response.data;
            alert(
              `가져오기 완료!\n\n가져온 단어: ${result.importedWords}개\n가져온 복습 상태: ${result.importedReviewStates}개\n건너뛴 단어: ${result.skippedWords}개`
            );
            loadStorageInfo(); // 스토리지 정보 갱신
          } else {
            alert(`가져오기 실패: ${response.error}`);
          }
        } catch (parseErr) {
          alert('백업 파일 형식이 올바르지 않습니다.');
          console.error('[SettingsTab] Import parse error:', parseErr);
        } finally {
          setIsImporting(false);
        }
      };

      reader.readAsText(file);
    } catch (err) {
      alert('데이터 가져오기 중 오류가 발생했습니다.');
      console.error('[SettingsTab] Import error:', err);
      setIsImporting(false);
    }

    // Reset file input
    event.target.value = '';
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

      {/* 온라인 동기화 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">온라인 동기화</h3>

        {!syncStatus.isAuthenticated ? (
          // 로그인되지 않은 상태
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-600 mb-3">
              Google 계정으로 로그인하여 여러 기기에서 단어장을 동기화하세요.
            </p>
            <button
              onClick={handleGoogleLogin}
              className="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 로그인
            </button>
          </div>
        ) : (
          // 로그인된 상태
          <div className="space-y-3">
            {/* 사용자 정보 */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {syncStatus.currentUser?.photoURL && (
                    <img
                      src={syncStatus.currentUser.photoURL}
                      alt="Profile"
                      className="w-10 h-10 rounded-full"
                    />
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {syncStatus.currentUser?.displayName}
                    </p>
                    <p className="text-xs text-gray-600">
                      {syncStatus.currentUser?.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-gray-900"
                >
                  로그아웃
                </button>
              </div>
            </div>

            {/* 동기화 설정 */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  자동 동기화
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {settings.syncSettings.autoSyncInterval}분마다 자동 동기화
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.syncSettings.syncEnabled}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      syncSettings: {
                        ...settings.syncSettings,
                        syncEnabled: e.target.checked,
                      },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* 마지막 동기화 시각 */}
            {syncStatus.lastSyncedAt > 0 && (
              <p className="text-xs text-gray-500 text-center">
                마지막 동기화:{' '}
                {new Date(syncStatus.lastSyncedAt).toLocaleString('ko-KR')}
              </p>
            )}

            {/* 수동 동기화 버튼 */}
            <button
              onClick={handleManualSync}
              disabled={isSyncing || syncStatus.syncInProgress}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSyncing || syncStatus.syncInProgress ? '동기화 중...' : '지금 동기화'}
            </button>

            {/* 동기화 초기화 버튼 */}
            <button
              onClick={handleResetSync}
              disabled={isSyncing || syncStatus.syncInProgress}
              className="w-full py-2 px-4 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
            >
              동기화 초기화
            </button>
          </div>
        )}
      </div>

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

      {/* 키보드 단축키 설정 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">⌨️ 키보드 단축키</h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            학습 단어 하이라이트 토글 키
          </label>
          <select
            value={settings.keyboardSettings.toggleLearnedHighlight}
            onChange={(e) =>
              setSettings({
                ...settings,
                keyboardSettings: {
                  ...settings.keyboardSettings,
                  toggleLearnedHighlight: e.target.value,
                },
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="Shift">Shift</option>
            <option value="Alt">Alt</option>
            <option value="Control">Ctrl</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            선택한 키를 누르고 있는 동안만 학습 단어가 하이라이트됩니다 (녹색)
          </p>
        </div>
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

      {/* AI 설정 (Phase 2-B) */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">AI 기능</h3>

        {/* Gemini API Key 입력 */}
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-md space-y-3">
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              🔑 Gemini API 키
            </label>
            <p className="text-xs text-gray-600 mb-2">
              AI 웹페이지 분석 기능을 사용하려면 Google Gemini API 키가 필요합니다
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={settings.geminiApiKey || ''}
              onChange={(e) =>
                setSettings({ ...settings, geminiApiKey: e.target.value })
              }
              placeholder="AIzaSy..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <button
              onClick={() => {
                const input = document.querySelector('input[type="password"]') as HTMLInputElement;
                if (input) {
                  input.type = input.type === 'password' ? 'text' : 'password';
                }
              }}
              className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 text-sm"
            >
              {settings.geminiApiKey ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <a
              href="https://aistudio.google.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              🔗 API 키 발급받기 →
            </a>
            {settings.geminiApiKey && (
              <span className="text-xs text-green-600 font-medium">
                ✅ API 키 등록됨
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500">
            💡 무료 플랜: 월 4M 토큰 제공 (약 1,500회 분석 가능)
          </p>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
          <div>
            <div className="font-medium text-gray-900">AI 분석 활성화</div>
            <div className="text-sm text-gray-500">웹페이지 단어 분석 및 추천</div>
          </div>
          <button
            onClick={() => {
              setSettings((prev) => ({
                ...prev,
                aiAnalysisEnabled: !prev.aiAnalysisEnabled,
              }));
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.aiAnalysisEnabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.aiAnalysisEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
          <div>
            <div className="font-medium text-gray-900">단어 하이라이트</div>
            <div className="text-sm text-gray-500">학습 완료/추천 단어 표시</div>
          </div>
          <button
            onClick={() => {
              setSettings((prev) => ({
                ...prev,
                highlightSettings: {
                  ...prev.highlightSettings,
                  enabled: !prev.highlightSettings.enabled,
                },
              }));
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.highlightSettings.enabled ? 'bg-primary-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.highlightSettings.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <div>
            <div className="font-medium text-gray-900">⚠️ AI 사용량 제한 해제</div>
            <div className="text-sm text-gray-600">
              개발/테스트용 - 일일 사용량 제한을 해제합니다
            </div>
            <div className="text-xs text-orange-600 mt-1">
              💡 나중에 다시 켤 수 있습니다
            </div>
          </div>
          <button
            onClick={() => {
              setSettings((prev) => ({
                ...prev,
                disableAIUsageLimit: !prev.disableAIUsageLimit,
              }));
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              settings.disableAIUsageLimit ? 'bg-orange-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                settings.disableAIUsageLimit ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {settings.highlightSettings.enabled && (
          <div className="ml-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">학습 완료 색상</span>
              <input
                type="color"
                value={settings.highlightSettings.learnedColor}
                onChange={(e) => {
                  setSettings((prev) => ({
                    ...prev,
                    highlightSettings: {
                      ...prev.highlightSettings,
                      learnedColor: e.target.value,
                    },
                  }));
                }}
                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">추천 단어 색상</span>
              <input
                type="color"
                value={settings.highlightSettings.recommendedColor}
                onChange={(e) => {
                  setSettings((prev) => ({
                    ...prev,
                    highlightSettings: {
                      ...prev.highlightSettings,
                      recommendedColor: e.target.value,
                    },
                  }));
                }}
                className="w-12 h-8 rounded border border-gray-300 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">툴팁 표시</span>
              <button
                onClick={() => {
                  setSettings((prev) => ({
                    ...prev,
                    highlightSettings: {
                      ...prev.highlightSettings,
                      showTooltip: !prev.highlightSettings.showTooltip,
                    },
                  }));
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  settings.highlightSettings.showTooltip ? 'bg-primary-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    settings.highlightSettings.showTooltip ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 단축키 설정 - 통합된 섹션 */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">⌨️ 단축키 설정</h3>

        {/* 전역 단축키 */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-sm text-blue-800 mb-3">
            <strong>전역 단축키</strong>는 어떤 웹페이지에서든 작동합니다.
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
              <div>
                <div className="font-medium text-gray-900">단어 저장</div>
                <div className="text-sm text-gray-500">선택한 단어를 빠르게 저장</div>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                  Ctrl+Shift+S
                </kbd>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
              <div>
                <div className="font-medium text-gray-900">퀴즈 시작</div>
                <div className="text-sm text-gray-500">퀴즈 모드 열기</div>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                  Ctrl+Shift+Q
                </kbd>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
              <div>
                <div className="font-medium text-gray-900">PDF 단어 조회</div>
                <div className="text-sm text-gray-500">PDF에서 단어 자동 복사 + 조회</div>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                  Alt+C
                </kbd>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded border border-gray-200">
              <div>
                <div className="font-medium text-gray-900">팝업 열기</div>
                <div className="text-sm text-gray-500">CatchVoca 팝업 열기</div>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-sm font-mono">
                  Ctrl+Shift+V
                </kbd>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
            }}
            className="mt-4 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            🔧 단축키 커스터마이징
          </button>

          <p className="mt-3 text-xs text-gray-500 text-center">
            단축키는 Chrome 설정에서 변경할 수 있습니다
          </p>
        </div>

        {/* 단어 읽기 모드 */}
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-md space-y-4">
          <div>
            <div className="text-sm font-semibold text-purple-900 mb-1">🖱️ 단어 읽기 모드</div>
            <p className="text-sm text-purple-800">
              웹페이지와 PDF에서 단어를 읽는 방법을 선택할 수 있습니다.
            </p>
          </div>

          {/* 웹페이지 읽기 모드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📄 웹페이지 단어 읽기
            </label>
            <select
              value={settings.wordReadingMode.webpage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  wordReadingMode: {
                    ...settings.wordReadingMode,
                    webpage: e.target.value as any,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="drag">마우스 드래그 (기본)</option>
              <option value="ctrl-click">Ctrl + 클릭</option>
              <option value="alt-click">Alt + 클릭</option>
              <option value="ctrl-drag">Ctrl + 드래그</option>
              <option value="alt-drag">Alt + 드래그</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {settings.wordReadingMode.webpage === 'drag' && '단어를 드래그하여 선택'}
              {settings.wordReadingMode.webpage === 'ctrl-click' && 'Ctrl 키를 누른 채 단어 클릭'}
              {settings.wordReadingMode.webpage === 'alt-click' && 'Alt 키를 누른 채 단어 클릭하면 즉시 저장'}
              {settings.wordReadingMode.webpage === 'ctrl-drag' && 'Ctrl 키를 누른 채 드래그'}
              {settings.wordReadingMode.webpage === 'alt-drag' && 'Alt 키를 누른 채 드래그'}
            </p>
          </div>

          {/* PDF 읽기 모드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📑 PDF 단어 읽기
            </label>
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-sm font-medium text-gray-900 mb-2">
                ⚡ 자동 복사 + 단축키 (고정)
              </p>
              <ol className="text-xs text-gray-700 space-y-1 list-decimal list-inside">
                <li>PDF에서 단어를 <strong>드래그</strong>하여 선택</li>
                <li><strong>Alt+C</strong>를 누르면 자동 복사 + 조회</li>
                <li>팝업이 열리며 단어 뜻이 표시됩니다</li>
              </ol>
            </div>
            <p className="mt-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
              ✨ 자동 복사 기능으로 Ctrl+C 단계가 생략됩니다!
            </p>
          </div>
        </div>
      </div>

      {/* 데이터 백업/복원 (Phase 2-D) */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">💾 데이터 백업/복원</h3>

        <div className="p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800 mb-4">
            단어장을 CSV 파일로 내보내거나, JSON 백업 파일을 복원할 수 있습니다.
          </p>

          <div className="space-y-3">
            {/* 내보내기 */}
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-md transition-colors font-medium ${
                isExporting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-green-700'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              {isExporting ? '내보내는 중...' : '📥 단어장 내보내기 (CSV)'}
            </button>

            {/* 가져오기 */}
            <label
              className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md transition-colors font-medium cursor-pointer ${
                isImporting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-blue-700'
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              {isImporting ? '가져오는 중...' : '📤 데이터 가져오기'}
              <input
                type="file"
                accept=".json"
                onChange={handleImportData}
                disabled={isImporting}
                className="hidden"
              />
            </label>
          </div>

          <p className="mt-3 text-xs text-gray-600">
            💡 CSV: 학습용 데이터 (Excel, Google Sheets에서 열기 가능)<br/>
            💡 JSON: 완전한 백업 (복습 상태 포함, 다른 기기로 복원 가능)
          </p>
        </div>
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
