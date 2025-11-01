/**
 * 라이브러리 모드 (Library Mode)
 * - 저장된 단어 목록
 * - 검색/필터링
 * - 단어 삭제
 */

import { useState, useEffect } from 'react';
import type { WordEntry } from '@catchvoca/types';

export function LibraryTab() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [filteredWords, setFilteredWords] = useState<WordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);

  /**
   * 단어 목록 가져오기
   */
  useEffect(() => {
    loadWords();
  }, []);

  /**
   * 검색 필터링
   */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredWords(words);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = words.filter(
      (word) =>
        word.word.toLowerCase().includes(query) ||
        word.definitions?.some((def) => def.toLowerCase().includes(query)) ||
        word.context?.toLowerCase().includes(query)
    );
    setFilteredWords(filtered);
  }, [searchQuery, words]);

  const loadWords = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      if (response.success) {
        const sortedWords = response.data.sort((a: WordEntry, b: WordEntry) => b.createdAt - a.createdAt);
        setWords(sortedWords);
        setFilteredWords(sortedWords);
      } else {
        setError(response.error || '단어 목록을 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('단어 목록을 불러오는 중 오류가 발생했습니다.');
      console.error('[LibraryTab] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 단어 삭제 핸들러
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
        setError(response.error || '단어 삭제에 실패했습니다.');
      }
    } catch (err) {
      setError('단어 삭제 중 오류가 발생했습니다.');
      console.error('[LibraryTab] Delete error:', err);
    }
  };

  /**
   * 발음 재생 핸들러
   */
  const handlePlayAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
      console.error('[LibraryTab] Audio play error:', err);
    });
  };

  /**
   * 단어 확장/축소 토글
   */
  const toggleExpand = (wordId: string) => {
    setExpandedWordId((prev) => (prev === wordId ? null : wordId));
  };

  return (
    <div className="space-y-4">
      {/* 검색 바 */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="단어, 정의, 문맥 검색..."
          className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <svg
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
          <div className="text-gray-500">단어 목록을 불러오는 중...</div>
        </div>
      )}

      {/* 단어 개수 */}
      {!isLoading && filteredWords.length > 0 && (
        <div className="text-sm text-gray-600">
          총 {filteredWords.length}개의 단어
          {searchQuery && ` (${words.length}개 중)`}
        </div>
      )}

      {/* 단어가 없는 경우 */}
      {!isLoading && words.length === 0 && (
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
          <p className="mt-2 text-sm text-gray-400">단어를 추가하여 학습을 시작하세요!</p>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!isLoading && words.length > 0 && filteredWords.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">검색 결과가 없습니다</p>
          <p className="mt-2 text-sm text-gray-400">다른 검색어를 입력해보세요</p>
        </div>
      )}

      {/* 단어 목록 */}
      {!isLoading && filteredWords.length > 0 && (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filteredWords.map((word) => (
            <div
              key={word.id}
              className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 transition-colors"
            >
              {/* 단어 헤더 */}
              <div className="flex items-start justify-between">
                <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(word.id)}>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-gray-900">{word.word}</h3>
                    {word.phonetic && (
                      <span className="text-sm text-gray-600">{word.phonetic}</span>
                    )}
                    {word.audioUrl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayAudio(word.audioUrl!);
                        }}
                        className="text-xs px-2 py-0.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                        title="발음 듣기"
                      >
                        🔊
                      </button>
                    )}
                  </div>

                  {/* 첫 번째 정의 미리보기 */}
                  {word.definitions && word.definitions.length > 0 && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                      {word.definitions[0]}
                    </p>
                  )}

                  {/* 저장 날짜 */}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(word.createdAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={() => handleDelete(word.id)}
                  className="ml-2 px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                  title="삭제"
                >
                  🗑️
                </button>
              </div>

              {/* 확장된 내용 */}
              {expandedWordId === word.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                  {/* 모든 정의 */}
                  {word.definitions && word.definitions.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">정의</h4>
                      <ol className="list-decimal list-inside space-y-1">
                        {word.definitions.map((definition, index) => (
                          <li key={index} className="text-sm text-gray-600 pl-2">
                            {definition}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* 문맥 */}
                  {word.context && word.context !== word.word && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">문맥</h4>
                      <p className="text-sm text-gray-600 italic">"{word.context}"</p>
                    </div>
                  )}

                  {/* 출처 */}
                  {word.sourceTitle && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-1">출처</h4>
                      <p className="text-sm text-gray-600">{word.sourceTitle}</p>
                      {word.url && (
                        <a
                          href={word.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {word.url}
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
