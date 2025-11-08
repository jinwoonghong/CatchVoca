/**
 * 퀴즈 모드 (Quiz Mode)
 * - SM-2 기반 복습
 * - 카드 UI
 * - 진행률 표시
 * - 모바일 퀴즈 생성 (구글 로그인 필요)
 */

import { useState, useEffect } from 'react';
import type { WordEntry, Rating } from '@catchvoca/types';
import QRCode from 'qrcode';

interface ReviewSession {
  words: WordEntry[];
  currentIndex: number;
  completed: number;
  showAnswer: boolean;
}

interface QuizTabProps {
  onSwitchToSettings: () => void;
}

export function QuizTab({ onSwitchToSettings }: QuizTabProps) {
  const [session, setSession] = useState<ReviewSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    dueToday: number;
    completedToday: number;
  } | null>(null);

  // 모바일 퀴즈 상태
  const [isUploading, setIsUploading] = useState(false);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  /**
   * 복습 통계 로드
   */
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_REVIEW_STATS',
      });

      if (response.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('[QuizTab] Load stats error:', err);
    }
  };

  /**
   * 복습 세션 시작
   */
  const startReview = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DUE_REVIEWS',
        limit: 20,
      });

      if (response.success && response.data.length > 0) {
        setSession({
          words: response.data,
          currentIndex: 0,
          completed: 0,
          showAnswer: false,
        });
      } else {
        setError('복습할 단어가 없습니다.');
      }
    } catch (err) {
      setError('복습 시작 중 오류가 발생했습니다.');
      console.error('[QuizTab] Start review error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 답안 표시 토글
   */
  const toggleAnswer = () => {
    if (session) {
      setSession({
        ...session,
        showAnswer: !session.showAnswer,
      });
    }
  };

  /**
   * 평가 제출
   */
  const submitRating = async (rating: Rating) => {
    if (!session) return;

    const currentWord = session.words[session.currentIndex];
    if (!currentWord) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SUBMIT_REVIEW',
        wordId: currentWord.id,
        rating,
      });

      if (!response.success) {
        alert('평가 제출에 실패했습니다.');
        return;
      }

      // 다음 단어로 이동 또는 세션 자동 종료
      if (session.currentIndex + 1 < session.words.length) {
        setSession({
          ...session,
          currentIndex: session.currentIndex + 1,
          completed: session.completed + 1,
          showAnswer: false,
        });
      } else {
        // 마지막 단어 완료 → 자동 종료
        setSession(null);
        loadStats();

        // 완료 메시지 표시
        setTimeout(() => {
          alert(`🎉 복습 완료!\n\n${session.words.length}개의 단어를 모두 복습했습니다.`);
        }, 100);
      }
    } catch (err) {
      alert('평가 제출 중 오류가 발생했습니다.');
      console.error('[QuizTab] Submit rating error:', err);
    }
  };

  /**
   * 세션 종료
   */
  const endSession = () => {
    setSession(null);
    loadStats();
  };

  /**
   * 모바일 퀴즈 URL 생성 (Firebase 방식)
   */
  const handleGenerateMobileQuiz = async () => {
    setIsUploading(true);
    setMobileUrl(null);
    setQrCodeDataUrl(null);

    try {
      // 최신 로그인 상태 확인
      const userResponse = await chrome.runtime.sendMessage({ type: 'GET_CURRENT_USER' });

      if (!userResponse.success || !userResponse.data) {
        // 로그인이 안 되어 있으면 설정 탭으로 이동
        setIsUploading(false);
        onSwitchToSettings();
        return;
      }

      // 1. Background에서 모바일 퀴즈 링크 생성 요청 (Firebase 방식)
      const response = await chrome.runtime.sendMessage({ type: 'GENERATE_MOBILE_QUIZ_LINK' });

      if (response.success && response.data) {
        const { url, expiresAt } = response.data;
        setMobileUrl(url);

        // 2. QR 코드 생성
        try {
          const qrDataUrl = await QRCode.toDataURL(url, {
            width: 200,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF',
            },
          });
          setQrCodeDataUrl(qrDataUrl);
        } catch (qrErr) {
          console.error('[QuizTab] QR code generation error:', qrErr);
          alert('⚠️ QR 코드 생성에 실패했습니다.\nURL을 직접 복사해서 사용해주세요.');
        }

        // 3. 성공 메시지
        const expirationDate = new Date(expiresAt);
        const expirationStr = `${expirationDate.getMonth() + 1}/${expirationDate.getDate()} ${expirationDate.getHours()}:${expirationDate.getMinutes().toString().padStart(2, '0')}`;

        alert(
          `✅ 모바일 퀴즈가 생성되었습니다!\n\n` +
          `📱 만료일시: ${expirationStr}\n` +
          `🔗 링크가 자동으로 복사되었습니다.\n\n` +
          `💡 QR 코드를 스캔하거나 링크를 공유하세요!`
        );
      } else {
        alert(response.error || '❌ 저장된 단어가 없습니다.\n\n먼저 단어를 저장해주세요!');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류';
      alert(`모바일 퀴즈 생성 중 오류가 발생했습니다.\n\n${errorMessage}`);
      console.error('[QuizTab] Generate mobile quiz error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * 모바일 URL 복사
   */
  const handleCopyUrl = async () => {
    if (!mobileUrl) return;

    try {
      await navigator.clipboard.writeText(mobileUrl);
      alert('✅ URL이 클립보드에 복사되었습니다!');
    } catch (err) {
      console.error('[QuizTab] Copy URL error:', err);
      alert('❌ URL 복사에 실패했습니다.');
    }
  };

  // 세션이 없는 경우 (시작 화면)
  if (!session) {
    return (
      <div className="space-y-4">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-center">
              <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              <p className="text-xs text-blue-700">전체 단어</p>
            </div>
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md text-center">
              <p className="text-2xl font-bold text-orange-600">{stats.dueToday}</p>
              <p className="text-xs text-orange-700">오늘 복습</p>
            </div>
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-center">
              <p className="text-2xl font-bold text-green-600">{stats.completedToday}</p>
              <p className="text-xs text-green-700">완료</p>
            </div>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* 시작 버튼 */}
        <div className="text-center py-12">
          <svg
            className="mx-auto h-16 w-16 text-primary-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            복습을 시작하세요
          </h3>
          <p className="mt-2 text-sm text-gray-600">
            {stats ? `오늘 ${stats.dueToday}개의 단어를 복습할 수 있습니다` : '복습할 단어를 불러오는 중...'}
          </p>

          <div className="mt-6 flex gap-3">
            <button
              onClick={startReview}
              disabled={isLoading || (stats?.dueToday === 0)}
              className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {isLoading ? '로딩 중...' : '학습하기'}
            </button>
            <button
              onClick={handleGenerateMobileQuiz}
              disabled={isUploading}
              className="flex-1 px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              {isUploading ? '생성 중...' : '📱 모바일 학습'}
            </button>
          </div>
        </div>

        {/* 모바일 퀴즈 URL & QR 코드 (버튼 클릭 후 표시) */}
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
    );
  }

  // 세션 완료 화면
  const isCompleted = session.currentIndex >= session.words.length;
  if (isCompleted) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-16 w-16 text-green-600"
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
        <h3 className="mt-4 text-lg font-semibold text-gray-900">
          복습 완료!
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {session.completed}개의 단어를 복습했습니다
        </p>
        <button
          onClick={endSession}
          className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          확인
        </button>
      </div>
    );
  }

  // 퀴즈 카드 화면
  const currentWord = session.words[session.currentIndex];
  if (!currentWord) {
    return <div>오류: 단어를 찾을 수 없습니다.</div>;
  }
  const progress = ((session.completed / session.words.length) * 100).toFixed(0);

  return (
    <div className="space-y-4">
      {/* 진행률 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>진행률</span>
          <span>{session.completed} / {session.words.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-primary-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 퀴즈 카드 */}
      <div className="p-6 bg-white border-2 border-gray-200 rounded-lg shadow-md min-h-64">
        {/* 단어 */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">{currentWord.word}</h2>
          {currentWord.phonetic && (
            <p className="text-sm text-gray-500 mt-2">{currentWord.phonetic}</p>
          )}
        </div>

        {/* 문맥 */}
        {currentWord.context && (
          <div className="mb-6 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-700 italic">
              "{currentWord.context}"
            </p>
          </div>
        )}

        {/* 답안 표시/숨기기 버튼 */}
        {!session.showAnswer && (
          <div className="text-center">
            <button
              onClick={toggleAnswer}
              className="px-6 py-3 bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              답안 보기
            </button>
          </div>
        )}

        {/* 답안 (정의) */}
        {session.showAnswer && (
          <div className="space-y-4">
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">정의</h3>
              <ol className="list-decimal list-inside space-y-2">
                {currentWord.definitions && currentWord.definitions.map((definition, index) => (
                  <li key={index} className="text-gray-700 pl-2">
                    {definition}
                  </li>
                ))}
              </ol>
            </div>

            {/* 평가 버튼 */}
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">얼마나 잘 기억하셨나요?</p>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => submitRating(1)}
                  className="px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 text-sm"
                >
                  ❌<br />전혀
                </button>
                <button
                  onClick={() => submitRating(2)}
                  className="px-3 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 text-sm"
                >
                  😓<br />어려움
                </button>
                <button
                  onClick={() => submitRating(3)}
                  className="px-3 py-2 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 text-sm"
                >
                  🤔<br />보통
                </button>
                <button
                  onClick={() => submitRating(4)}
                  className="px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-sm"
                >
                  ✅<br />쉬움
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 세션 종료 버튼 */}
      <button
        onClick={endSession}
        className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
      >
        복습 종료
      </button>
    </div>
  );
}
