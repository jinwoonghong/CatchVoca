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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

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
   * 모바일 퀴즈 URL 생성 (URL Hash 기반 - LZ-String 압축)
   */
  const handleGenerateMobileQuiz = async () => {
    setIsUploading(true);
    setMobileUrl(null);
    setQrCodeDataUrl(null);

    try {
      // 1. Background에서 모바일 퀴즈 링크 생성 요청
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_MOBILE_QUIZ_LINK',
        options: {
          maxWords: 20,
          prioritizeDue: true,
          includeRecent: true,
        },
      });

      if (response.success && response.data) {
        const { url, wordCount, compressedSize, estimatedUrlLength } = response.data;

        // URL 안전성 확인 (2048자 제한)
        if (estimatedUrlLength > 2048) {
          alert(`⚠️ URL이 너무 깁니다 (${estimatedUrlLength}자)\n\n단어 수를 줄이거나 짧은 정의를 사용해주세요.`);
          return;
        }

        setMobileUrl(url);

        // 2. QR 코드 생성
        try {
          const qrDataUrl = await QRCode.toDataURL(url, {
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

        // 3. 성공 메시지
        alert(
          `✅ 모바일 퀴즈 링크 생성 완료!\n\n` +
          `📝 단어 수: ${wordCount}개\n` +
          `📦 압축 크기: ${compressedSize}자\n` +
          `🔗 전체 URL 길이: ${estimatedUrlLength}자`
        );
      } else {
        alert('❌ 복습할 단어가 없습니다.\n\n먼저 단어를 저장해주세요!');
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

      {/* AI 설정 (Phase 2-B) */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">AI 기능</h3>

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
