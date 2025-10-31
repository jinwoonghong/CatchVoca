/**
 * 수집 모드 (Collect Mode)
 * - 단어 검색
 * - 정의 표시
 * - 저장 기능
 */

import { useState } from 'react';
import type { LookupResult } from '@catchvoca/types';

export function CollectTab() {
  const [searchWord, setSearchWord] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

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
   * 단어 저장 핸들러
   */
  const handleSave = async () => {
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
          url: '',
          sourceTitle: 'Manual Entry',
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
      console.error('[CollectTab] Save error:', err);
    } finally {
      setIsSaving(false);
    }
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
      {/* 검색 입력 */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchWord}
          onChange={(e) => setSearchWord(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="단어를 입력하세요..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          disabled={isLoading}
        />
        <button
          onClick={handleSearch}
          disabled={isLoading || !searchWord.trim()}
          className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isLoading ? '검색 중...' : '검색'}
        </button>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 저장 성공 메시지 */}
      {saveSuccess && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
          ✅ 단어가 저장되었습니다!
        </div>
      )}

      {/* 검색 결과 */}
      {lookupResult && (
        <div className="space-y-4">
          {/* 단어 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{searchWord}</h2>
              {lookupResult.phonetic && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-600">{lookupResult.phonetic}</p>
                  {lookupResult.audioUrl && (
                    <button
                      onClick={handlePlayAudio}
                      className="text-primary-600 hover:text-primary-700"
                      title="발음 듣기"
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
                          d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '💾 저장'}
            </button>
          </div>

          {/* 정의 목록 */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-800">정의</h3>
            {lookupResult.definitions.length > 0 ? (
              <ol className="list-decimal list-inside space-y-2">
                {lookupResult.definitions.map((definition, index) => (
                  <li key={index} className="text-gray-700 pl-2">
                    {definition}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 text-sm">정의를 찾을 수 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!lookupResult && !isLoading && !error && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="mt-4 text-gray-500">단어를 검색해보세요</p>
        </div>
      )}
    </div>
  );
}
