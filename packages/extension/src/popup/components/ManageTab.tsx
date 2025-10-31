/**
 * 관리 모드 (Manage Mode)
 * - 단어 목록 표시
 * - 검색/필터
 * - 태그 관리
 * - 삭제 기능
 */

import { useState, useEffect } from 'react';
import type { WordEntry } from '@catchvoca/types';

export function ManageTab() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [filteredWords, setFilteredWords] = useState<WordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 단어 목록 로드
   */
  useEffect(() => {
    loadWords();
  }, []);

  /**
   * 검색/필터 적용
   */
  useEffect(() => {
    applyFilters();
  }, [words, searchQuery, selectedTag]);

  const loadWords = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      if (response.success) {
        setWords(response.data);
      } else {
        setError(response.error || '단어 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('단어 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('[ManageTab] Load words error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...words];

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((word) =>
        word.word.toLowerCase().includes(query) ||
        (word.definitions && word.definitions.some((def) => def.toLowerCase().includes(query)))
      );
    }

    // 태그 필터
    if (selectedTag !== 'all') {
      if (selectedTag === 'favorite') {
        filtered = filtered.filter((word) => word.isFavorite);
      } else {
        filtered = filtered.filter((word) => word.tags.includes(selectedTag));
      }
    }

    // 최신순 정렬
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    setFilteredWords(filtered);
  };

  /**
   * 단어 삭제
   */
  const handleDelete = async (wordId: string) => {
    if (!confirm('이 단어를 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'DELETE_WORD',
        wordId,
      });

      if (response.success) {
        setWords((prev) => prev.filter((w) => w.id !== wordId));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
      console.error('[ManageTab] Delete error:', err);
    }
  };

  /**
   * 즐겨찾기 토글
   */
  const handleToggleFavorite = async (wordId: string, currentFavorite: boolean) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_WORD',
        wordId,
        changes: {
          isFavorite: !currentFavorite,
        },
      });

      if (response.success) {
        setWords((prev) =>
          prev.map((w) =>
            w.id === wordId ? { ...w, isFavorite: !currentFavorite } : w
          )
        );
      }
    } catch (err) {
      console.error('[ManageTab] Toggle favorite error:', err);
    }
  };

  /**
   * 모든 태그 추출
   */
  const allTags = Array.from(new Set(words.flatMap((w) => w.tags)));

  return (
    <div className="space-y-4">
      {/* 검색 및 필터 */}
      <div className="space-y-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="단어 또는 정의 검색..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />

        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedTag('all')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              selectedTag === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            전체
          </button>
          <button
            onClick={() => setSelectedTag('favorite')}
            className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
              selectedTag === 'favorite'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ⭐ 즐겨찾기
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 */}
      <div className="flex gap-4 text-sm text-gray-600">
        <span>전체: {words.length}개</span>
        <span>검색 결과: {filteredWords.length}개</span>
      </div>

      {/* 오류 메시지 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">로딩 중...</p>
        </div>
      )}

      {/* 단어 목록 */}
      {!isLoading && filteredWords.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredWords.map((word) => (
            <div
              key={word.id}
              className="p-3 bg-white border border-gray-200 rounded-md hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {word.word}
                    </h3>
                    {word.phonetic && (
                      <span className="text-sm text-gray-500">{word.phonetic}</span>
                    )}
                    <button
                      onClick={() => handleToggleFavorite(word.id, word.isFavorite ?? false)}
                      className="text-lg"
                      title={word.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    >
                      {word.isFavorite ? '⭐' : '☆'}
                    </button>
                  </div>
                  {word.definitions && word.definitions.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {word.definitions[0]}
                    </p>
                  )}
                  {word.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {word.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(word.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(word.id)}
                  className="ml-2 text-red-600 hover:text-red-700"
                  title="삭제"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && filteredWords.length === 0 && words.length === 0 && (
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
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <p className="mt-4 text-gray-500">저장된 단어가 없습니다</p>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!isLoading && filteredWords.length === 0 && words.length > 0 && (
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
          <p className="mt-4 text-gray-500">검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  );
}
