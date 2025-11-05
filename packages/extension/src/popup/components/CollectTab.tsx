/**
 * 수집 모드 (Collect Mode)
 * - 단어 검색
 * - 정의 표시
 * - 저장 기능
 */

import { useState } from 'react';
import type { LookupResult } from '@catchvoca/types';

interface CollectTabProps {
  onSwitchToSettings?: () => void;
}

export function CollectTab({ onSwitchToSettings: _onSwitchToSettings }: CollectTabProps) {
  const [searchWord, setSearchWord] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showRelearningDialog, setShowRelearningDialog] = useState(false);
  const [existingWordId, setExistingWordId] = useState<string | null>(null);

  /**
   * 단어 검색 핸들러
   */
  const handleSearch = async () => {
    if (!searchWord.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setLookupResult(null);
    setSaveSuccess(false);

    try {
      // Background Worker에 검색 요청
      const response = await chrome.runtime.sendMessage({
        type: 'LOOKUP_WORD',
        word: searchWord.trim(),
      });

      if (response.success) {
        console.log('[CollectTab] Lookup result:', response.data);
        setLookupResult(response.data);
      } else {
        setError(response.error || '단어를 찾을 수 없습니다.');
      }
    } catch (err) {
      setError('검색 중 오류가 발생했습니다.');
      console.error('[CollectTab] Search error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 단어 저장 핸들러 (재학습 체크 포함)
   */
  const handleSave = async () => {
    if (!searchWord.trim() || !lookupResult) {
      return;
    }

    // 재학습 체크
    if (lookupResult.isSaved && lookupResult.wordId) {
      setExistingWordId(lookupResult.wordId);
      setShowRelearningDialog(true);
      return;
    }

    await saveNewWord();
  };

  /**
   * 새 단어로 저장
   */
  const saveNewWord = async () => {
    if (!searchWord.trim() || !lookupResult) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Background Worker에 저장 요청
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_WORD',
        wordData: {
          word: searchWord.trim(),
          definitions: lookupResult.definitions,
          phonetic: lookupResult.phonetic,
          audioUrl: lookupResult.audioUrl,
          context: searchWord.trim(),
          url: window.location.href,
          sourceTitle: document.title,
        },
      });

      if (response.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError(response.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
      console.error('[CollectTab] Save new word error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 재학습 - 이전 기록 유지
   */
  const handleKeepExisting = () => {
    setShowRelearningDialog(false);
    setExistingWordId(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  /**
   * 재학습 - 새로 시작
   */
  const handleStartNew = async () => {
    setShowRelearningDialog(false);
    setIsSaving(true);

    try {
      // 기존 단어 삭제 후 새로 저장
      if (existingWordId) {
        await chrome.runtime.sendMessage({
          type: 'DELETE_WORD',
          wordId: existingWordId,
        });
      }

      await saveNewWord();
    } catch (err) {
      setError('재학습 중 오류가 발생했습니다.');
      console.error('[CollectTab] Restart learning error:', err);
    } finally {
      setExistingWordId(null);
    }
  };

  /**
   * 재학습 다이얼로그 취소
   */
  const handleCancelRelearning = () => {
    setShowRelearningDialog(false);
    setExistingWordId(null);
  };

  /**
   * Enter 키 핸들러
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  /**
   * 발음 재생 핸들러
   */
  const handlePlayAudio = () => {
    if (lookupResult?.audioUrl) {
      const audio = new Audio(lookupResult.audioUrl);
      audio.play().catch((err) => {
        console.error('[CollectTab] Audio play error:', err);
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 단어 검색창 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-3">🔍 단어 검색</h3>
        <div className="flex space-x-2">
          <input
            type="text"
            value={searchWord}
            onChange={(e) => setSearchWord(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="단어를 입력하세요..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <button
            onClick={handleSearch}
            disabled={isLoading || !searchWord.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {saveSuccess && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
            ✅ 단어가 저장되었습니다!
          </div>
        )}
      </div>

      {/* 검색 결과 */}
      {lookupResult && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900">{searchWord}</h3>
              {lookupResult.phonetic && (
                <p className="text-sm text-gray-600 mt-1">[{lookupResult.phonetic}]</p>
              )}
              {lookupResult.isSaved && (
                <p className="text-xs text-green-600 mt-1">✅ 이미 저장된 단어입니다</p>
              )}
            </div>
            <div className="flex space-x-2">
              {lookupResult.audioUrl && (
                <button
                  onClick={handlePlayAudio}
                  className="p-2 text-gray-600 hover:text-primary-600"
                  title="발음 듣기"
                >
                  🔊
                </button>
              )}
            </div>
          </div>

          {/* 정의 목록 */}
          {lookupResult.definitions && lookupResult.definitions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-700">정의</h4>
              <ol className="list-decimal list-inside space-y-2">
                {lookupResult.definitions.map((def, idx) => (
                  <li key={idx} className="text-gray-700">
                    {def}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="text-gray-500">정의를 찾을 수 없습니다.</p>
          )}

          {/* 저장 버튼 */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {isSaving ? '저장 중...' : lookupResult.isSaved ? '📗 저장됨' : '💾 저장하기'}
          </button>
        </div>
      )}

      {/* 재학습 다이얼로그 */}
      {showRelearningDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-3">🔄 재학습</h3>
            <p className="text-gray-600 mb-4">
              이미 저장된 단어입니다. 어떻게 하시겠습니까?
            </p>

            <div className="space-y-2">
              <button
                onClick={handleKeepExisting}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                이전 기록 유지
              </button>
              <button
                onClick={handleStartNew}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                새로 시작 (기존 기록 삭제)
              </button>
              <button
                onClick={handleCancelRelearning}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
