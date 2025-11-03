/**
 * 라이브러리 모드 (Library Mode)
 * - 저장된 단어 목록
 * - 검색/필터링
 * - 단어 삭제
 */

import { useState, useEffect } from 'react';
import type { WordEntry } from '@catchvoca/types';
import { useDebounce } from '../hooks/useDebounce';

interface EditingWord {
  id: string;
  definitions: string[];
  context: string;
  tags: string[];
  note: string;
}

export function LibraryTab() {
  const [words, setWords] = useState<WordEntry[]>([]);
  const [filteredWords, setFilteredWords] = useState<WordEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWordId, setExpandedWordId] = useState<string | null>(null);
  const [editingWord, setEditingWord] = useState<EditingWord | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [mobileQuizUrl, setMobileQuizUrl] = useState<string | null>(null);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);

  // Debounced search query (300ms)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  /**
   * 단어 목록 가져오기
   */
  useEffect(() => {
    loadWords();
  }, []);

  /**
   * 검색 및 필터링 (debounced)
   */
  useEffect(() => {
    let filtered = words;

    // 즐겨찾기 필터
    if (showFavoritesOnly) {
      filtered = filtered.filter((word) => word.isFavorite === true);
    }

    // 태그 필터
    if (selectedTags.length > 0) {
      filtered = filtered.filter((word) =>
        selectedTags.some((tag) => word.tags.includes(tag))
      );
    }

    // 검색어 필터 (debounced)
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (word) =>
          word.word.toLowerCase().includes(query) ||
          word.definitions?.some((def) => def.toLowerCase().includes(query)) ||
          word.context?.toLowerCase().includes(query)
      );
    }

    setFilteredWords(filtered);
  }, [debouncedSearchQuery, words, selectedTags, showFavoritesOnly]);

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

  /**
   * 수정 모드 시작
   */
  const handleStartEdit = (word: WordEntry) => {
    setEditingWord({
      id: word.id,
      definitions: word.definitions || [],
      context: word.context || '',
      tags: word.tags || [],
      note: word.note || '',
    });
  };

  /**
   * 수정 취소
   */
  const handleCancelEdit = () => {
    setEditingWord(null);
  };

  /**
   * 수정 저장
   */
  const handleSaveEdit = async () => {
    if (!editingWord) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_WORD',
        wordId: editingWord.id,
        changes: {
          definitions: editingWord.definitions.filter((d) => d.trim() !== ''),
          context: editingWord.context,
          tags: editingWord.tags.filter((t) => t.trim() !== ''),
          note: editingWord.note,
        },
      });

      if (response.success) {
        // 로컬 상태 업데이트
        setWords((prev) =>
          prev.map((w) =>
            w.id === editingWord.id
              ? {
                  ...w,
                  definitions: editingWord.definitions.filter((d) => d.trim() !== ''),
                  context: editingWord.context,
                  tags: editingWord.tags.filter((t) => t.trim() !== ''),
                  note: editingWord.note,
                }
              : w
          )
        );
        setEditingWord(null);
      } else {
        setError(response.error || '단어 수정에 실패했습니다.');
      }
    } catch (err) {
      setError('단어 수정 중 오류가 발생했습니다.');
      console.error('[LibraryTab] Update error:', err);
    }
  };

  /**
   * 정의 추가
   */
  const handleAddDefinition = () => {
    if (!editingWord) return;
    setEditingWord({
      ...editingWord,
      definitions: [...editingWord.definitions, ''],
    });
  };

  /**
   * 정의 제거
   */
  const handleRemoveDefinition = (index: number) => {
    if (!editingWord) return;
    setEditingWord({
      ...editingWord,
      definitions: editingWord.definitions.filter((_, i) => i !== index),
    });
  };

  /**
   * 정의 변경
   */
  const handleDefinitionChange = (index: number, value: string) => {
    if (!editingWord) return;
    setEditingWord({
      ...editingWord,
      definitions: editingWord.definitions.map((d, i) => (i === index ? value : d)),
    });
  };

  /**
   * 태그 입력 처리
   */
  const handleTagsChange = (value: string) => {
    if (!editingWord) return;
    const tags = value.split(',').map((t) => t.trim());
    setEditingWord({
      ...editingWord,
      tags,
    });
  };

  /**
   * 즐겨찾기 토글
   */
  const handleToggleFavorite = async (wordId: string, currentValue: boolean) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'UPDATE_WORD',
        wordId,
        changes: {
          isFavorite: !currentValue,
        },
      });

      if (response.success) {
        setWords((prev) =>
          prev.map((w) => (w.id === wordId ? { ...w, isFavorite: !currentValue } : w))
        );
      } else {
        setError(response.error || '즐겨찾기 변경에 실패했습니다.');
      }
    } catch (err) {
      setError('즐겨찾기 변경 중 오류가 발생했습니다.');
      console.error('[LibraryTab] Toggle favorite error:', err);
    }
  };

  /**
   * 전체 태그 목록 추출
   */
  const getAllTags = (): string[] => {
    const tagSet = new Set<string>();
    words.forEach((word) => {
      word.tags.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  };

  /**
   * 태그 필터 토글
   */
  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  /**
   * 모바일 퀴즈 링크 생성
   */
  const handleGenerateMobileQuizLink = async () => {
    setIsGeneratingLink(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_MOBILE_QUIZ_LINK',
        data: {
          maxWords: 20,
          prioritizeDue: true,
          includeRecent: true,
        },
      });

      if (response.success) {
        setMobileQuizUrl(response.data.url);
        // 클립보드에 자동 복사
        await navigator.clipboard.writeText(response.data.url);
        alert(
          `모바일 퀴즈 링크가 생성되었습니다!\n단어 수: ${response.data.wordCount}개\n압축 크기: ${response.data.compressedSize}자\n\n클립보드에 복사되었습니다.`
        );
      } else {
        setError(response.error || '모바일 퀴즈 링크 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('모바일 퀴즈 링크 생성 중 오류가 발생했습니다.');
      console.error('[LibraryTab] Generate mobile quiz link error:', err);
    } finally {
      setIsGeneratingLink(false);
    }
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

      {/* 필터 섹션 */}
      <div className="space-y-2">
        {/* 즐겨찾기 필터 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              showFavoritesOnly
                ? 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
            }`}
          >
            ⭐ 즐겨찾기 {showFavoritesOnly && '✓'}
          </button>
        </div>

        {/* 태그 필터 */}
        {getAllTags().length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">태그 필터</div>
            <div className="flex flex-wrap gap-1.5">
              {getAllTags().map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleToggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-primary-100 text-primary-800 border border-primary-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {tag} {selectedTags.includes(tag) && '✓'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 활성 필터 표시 */}
        {(selectedTags.length > 0 || showFavoritesOnly) && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>활성 필터:</span>
            {showFavoritesOnly && <span className="px-2 py-0.5 bg-yellow-50 rounded">즐겨찾기</span>}
            {selectedTags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 bg-primary-50 rounded">
                {tag}
              </span>
            ))}
            <button
              onClick={() => {
                setSelectedTags([]);
                setShowFavoritesOnly(false);
              }}
              className="text-blue-600 hover:text-blue-700 ml-1"
            >
              모두 해제
            </button>
          </div>
        )}
      </div>

      {/* 모바일 퀴즈 버튼 */}
      {!isLoading && words.length > 0 && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateMobileQuizLink}
            disabled={isGeneratingLink}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium rounded-md transition-all ${
              isGeneratingLink
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:from-blue-600 hover:to-indigo-700 shadow-md hover:shadow-lg'
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
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {isGeneratingLink ? '생성 중...' : '📱 모바일 퀴즈 링크 생성'}
          </button>
          {mobileQuizUrl && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(mobileQuizUrl);
                alert('링크가 클립보드에 복사되었습니다.');
              }}
              className="px-3 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
              title="링크 다시 복사"
            >
              📋
            </button>
          )}
        </div>
      )}

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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {/* 조회수 표시 */}
                    {word.viewCount !== undefined && word.viewCount > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded flex items-center gap-1"
                        title={`${word.viewCount}번 조회`}
                      >
                        👁️ {word.viewCount}
                      </span>
                    )}
                    {/* 즐겨찾기 표시 */}
                    {word.isFavorite && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded" title="즐겨찾기">
                        ⭐
                      </span>
                    )}
                  </div>

                  {/* 태그 배지 */}
                  {word.tags && word.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {word.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-0.5 bg-primary-50 text-primary-700 rounded-full border border-primary-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

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

                {/* 즐겨찾기, 수정, 삭제 버튼 */}
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(word.id, word.isFavorite);
                    }}
                    className={`px-2 py-1 rounded text-sm transition-colors ${
                      word.isFavorite
                        ? 'text-yellow-600 hover:bg-yellow-50'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-600'
                    }`}
                    title={word.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                  >
                    {word.isFavorite ? '⭐' : '☆'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartEdit(word);
                    }}
                    className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded text-sm"
                    title="수정"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(word.id)}
                    className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                    title="삭제"
                  >
                    🗑️
                  </button>
                </div>
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

      {/* 수정 모달 */}
      {editingWord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">단어 수정</h3>
              <button
                onClick={handleCancelEdit}
                className="text-gray-400 hover:text-gray-600"
                title="닫기"
              >
                ✕
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="px-6 py-4 space-y-4">
              {/* 정의 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  정의
                </label>
                <div className="space-y-2">
                  {editingWord.definitions.map((definition, index) => (
                    <div key={index} className="flex gap-2">
                      <input
                        type="text"
                        value={definition}
                        onChange={(e) => handleDefinitionChange(index, e.target.value)}
                        placeholder={`정의 ${index + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => handleRemoveDefinition(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                        title="제거"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleAddDefinition}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  + 정의 추가
                </button>
              </div>

              {/* 문맥 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  문맥
                </label>
                <textarea
                  value={editingWord.context}
                  onChange={(e) => setEditingWord({ ...editingWord, context: e.target.value })}
                  placeholder="단어가 사용된 문맥..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 태그 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  태그 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  value={editingWord.tags.join(', ')}
                  onChange={(e) => handleTagsChange(e.target.value)}
                  placeholder="예: 비즈니스, 기술, 일상"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  메모
                </label>
                <textarea
                  value={editingWord.note}
                  onChange={(e) => setEditingWord({ ...editingWord, note: e.target.value })}
                  placeholder="개인적인 메모나 참고사항..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            {/* 모달 푸터 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
              >
                취소
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
