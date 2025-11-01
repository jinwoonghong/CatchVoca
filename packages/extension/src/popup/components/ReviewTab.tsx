/**
 * 복습 모드 (Review Mode)
 * - SM-2 알고리즘 기반 복습
 * - 단어 카드 UI
 * - 평가 버튼 (Again, Hard, Good, Easy)
 */

import { useState, useEffect } from 'react';
import type { WordEntry } from '@catchvoca/types';

type Rating = 0 | 1 | 2 | 3 | 4 | 5;

export function ReviewTab() {
  const [dueWords, setDueWords] = useState<WordEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewStats, setReviewStats] = useState({ total: 0, completed: 0 });

  /**
   * 복습할 단어 목록 가져오기
   */
  useEffect(() => {
    loadDueReviews();
  }, []);

  const loadDueReviews = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DUE_REVIEWS',
        limit: 20,
      });

      if (response.success) {
        setDueWords(response.data);
        setReviewStats({ total: response.data.length, completed: 0 });
      } else {
        setError(response.error || '복습할 단어를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('복습 데이터를 불러오는 중 오류가 발생했습니다.');
      console.error('[ReviewTab] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 평가 제출 핸들러
   */
  const handleRating = async (rating: Rating) => {
    const currentWord = dueWords[currentIndex];
    if (!currentWord) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SUBMIT_REVIEW',
        wordId: currentWord.id,
        rating,
      });

      if (response.success) {
        // 다음 단어로 이동
        setReviewStats((prev) => ({ ...prev, completed: prev.completed + 1 }));

        if (currentIndex < dueWords.length - 1) {
          setCurrentIndex((prev) => prev + 1);
          setShowAnswer(false);
        } else {
          // 복습 완료
          setCurrentIndex(0);
          setShowAnswer(false);
          await loadDueReviews(); // 새로운 복습 단어 로드
        }
      } else {
        setError(response.error || '평가 제출에 실패했습니다.');
      }
    } catch (err) {
      setError('평가 제출 중 오류가 발생했습니다.');
      console.error('[ReviewTab] Submit review error:', err);
    }
  };

  /**
   * 발음 재생 핸들러
   */
  const handlePlayAudio = () => {
    const currentWord = dueWords[currentIndex];
    if (currentWord?.audioUrl) {
      const audio = new Audio(currentWord.audioUrl);
      audio.play().catch((err) => {
        console.error('[ReviewTab] Audio play error:', err);
      });
    }
  };

  const currentWord = dueWords[currentIndex];

  return (
    <div className="space-y-4">
      {/* 진행 상황 */}
      {!isLoading && dueWords.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-700 font-medium">
              진행 상황: {reviewStats.completed} / {reviewStats.total}
            </span>
            <span className="text-blue-600">
              {Math.round((reviewStats.completed / reviewStats.total) * 100)}%
            </span>
          </div>
          <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${(reviewStats.completed / reviewStats.total) * 100}%` }}
            />
          </div>
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
          <div className="text-gray-500">복습 데이터를 불러오는 중...</div>
        </div>
      )}

      {/* 복습할 단어가 없는 경우 */}
      {!isLoading && dueWords.length === 0 && (
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-4 text-gray-500">복습할 단어가 없습니다!</p>
          <p className="mt-2 text-sm text-gray-400">새로운 단어를 추가해보세요.</p>
        </div>
      )}

      {/* 단어 카드 */}
      {!isLoading && currentWord && (
        <div className="space-y-4">
          {/* 단어 카드 */}
          <div className="bg-white border-2 border-gray-300 rounded-lg p-6 min-h-[300px] flex flex-col justify-center items-center">
            {/* 앞면: 단어 + 문맥 */}
            <div className="text-center space-y-4 w-full">
              <h2 className="text-3xl font-bold text-gray-900">{currentWord.word}</h2>

              {/* 발음기호와 재생 버튼 */}
              <div className="flex items-center justify-center gap-2">
                {currentWord.phonetic ? (
                  <>
                    <span className="text-sm text-gray-600">{currentWord.phonetic}</span>
                    {currentWord.audioUrl ? (
                      <button
                        onClick={handlePlayAudio}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        title="발음 듣기"
                      >
                        🔊 듣기
                      </button>
                    ) : (
                      <button
                        disabled
                        className="text-xs px-2 py-1 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
                        title="발음 파일 없음"
                      >
                        🔊 없음
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <span className="text-sm text-gray-400 italic">발음 정보 없음</span>
                    <button
                      disabled
                      className="text-xs px-2 py-1 bg-gray-300 text-gray-500 rounded cursor-not-allowed"
                      title="발음 파일 없음"
                    >
                      🔊 없음
                    </button>
                  </>
                )}
              </div>

              {/* 문맥 */}
              {currentWord.context && currentWord.context !== currentWord.word && (
                <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm text-gray-700 italic">
                  "{currentWord.context}"
                </div>
              )}

              {/* 정답 보기 버튼 */}
              {!showAnswer && (
                <button
                  onClick={() => setShowAnswer(true)}
                  className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
                >
                  정답 보기
                </button>
              )}

              {/* 뒷면: 정의 */}
              {showAnswer && (
                <div className="mt-6 space-y-4 animate-fade-in">
                  <div className="border-t-2 border-gray-200 pt-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">정의</h3>
                    {currentWord.definitions && currentWord.definitions.length > 0 ? (
                      <ol className="list-decimal list-inside space-y-2 text-left">
                        {currentWord.definitions.map((definition, index) => (
                          <li key={index} className="text-gray-700 pl-2">
                            {definition}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="text-gray-500 text-sm">정의가 없습니다.</p>
                    )}
                  </div>

                  {/* 출처 정보 */}
                  {currentWord.sourceTitle && (
                    <div className="text-xs text-gray-400">
                      출처: {currentWord.sourceTitle}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 평가 버튼 (정답을 본 후에만 표시) */}
          {showAnswer && (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">얼마나 잘 기억하셨나요?</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleRating(1)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm font-medium"
                >
                  Again
                  <span className="block text-xs text-red-600">&lt;1분</span>
                </button>
                <button
                  onClick={() => handleRating(2)}
                  className="px-3 py-2 bg-orange-100 text-orange-700 rounded hover:bg-orange-200 text-sm font-medium"
                >
                  Hard
                  <span className="block text-xs text-orange-600">~6분</span>
                </button>
                <button
                  onClick={() => handleRating(3)}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm font-medium"
                >
                  Good
                  <span className="block text-xs text-green-600">~10분</span>
                </button>
                <button
                  onClick={() => handleRating(4)}
                  className="px-3 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm font-medium"
                >
                  Easy
                  <span className="block text-xs text-blue-600">~4일</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
