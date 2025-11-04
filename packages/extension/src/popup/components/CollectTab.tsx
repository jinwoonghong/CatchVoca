/**
 * 수집 모드 (Collect Mode)
 * - 단어 검색
 * - 정의 표시
 * - 저장 기능
 * - AI 웹페이지 분석 (Phase 2-B)
 */

import { useState, useEffect } from 'react';
import type { LookupResult, GeminiAnalysisResponse, RecommendedWord, AIAnalysisHistory } from '@catchvoca/types';

interface CollectTabProps {
  onSwitchToSettings: () => void;
}

export function CollectTab({ onSwitchToSettings }: CollectTabProps) {
  const [searchWord, setSearchWord] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showRelearningDialog, setShowRelearningDialog] = useState(false);
  const [existingWordId, setExistingWordId] = useState<string | null>(null);

  // AI 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

  // AI 분석 이력 상태
  const [analysisHistories, setAnalysisHistories] = useState<AIAnalysisHistory[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(true);

  // 추천 단어 상태
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set()); // 펼쳐진 단어들
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set()); // 선택된 단어들
  const [wordLookupCache, setWordLookupCache] = useState<Map<string, LookupResult>>(new Map()); // 단어 뜻 캐시
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  // 컴포넌트 마운트 시 분석 이력 로드
  useEffect(() => {
    loadAnalysisHistory();
  }, []);

  const loadAnalysisHistory = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_ANALYSIS_HISTORY',
      });

      if (response.success) {
        setAnalysisHistories(response.data || []);
      }
    } catch (err) {
      console.error('[CollectTab] Failed to load analysis history:', err);
    }
  };

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

    setIsSaving(true);
    setError(null);

    try {
      // 1. 기존 단어 존재 여부 확인
      const checkResponse = await chrome.runtime.sendMessage({
        type: 'LOOKUP_WORD',
        word: searchWord.trim(),
      });

      if (checkResponse.success && checkResponse.data.isSaved && checkResponse.data.wordId) {
        // 기존 단어가 있으면 재학습 다이얼로그 표시
        setExistingWordId(checkResponse.data.wordId);
        setShowRelearningDialog(true);
        setIsSaving(false);
        return;
      }

      // 2. 새 단어 저장
      await saveNewWord();
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
      console.error('[CollectTab] Save error:', err);
      setIsSaving(false);
    }
  };

  /**
   * 새 단어 저장
   */
  const saveNewWord = async () => {
    if (!searchWord.trim() || !lookupResult) {
      return;
    }

    try {
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

  /**
   * 현재 페이지 AI 분석
   */
  const handleAnalyzeCurrentPage = async () => {
    // 0. API 키 확인
    try {
      const settingsResponse = await chrome.runtime.sendMessage({
        type: 'GET_SETTINGS',
      });

      if (!settingsResponse.success || !settingsResponse.data?.geminiApiKey) {
        // API 키가 없으면 Settings 탭으로 이동
        if (confirm('AI 분석 기능을 사용하려면 Gemini API 키가 필요합니다.\n\n설정 페이지로 이동하시겠습니까?')) {
          onSwitchToSettings();
        }
        return;
      }
    } catch (err) {
      console.error('[CollectTab] Failed to check API key:', err);
      setAiError('설정을 확인할 수 없습니다.');
      return;
    }

    setIsAnalyzing(true);
    setAiError(null);
    setShowAnalysisPanel(true);

    try {
      // 1. 현재 활성 탭 정보 가져오기
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.id) {
        throw new Error('현재 탭 정보를 가져올 수 없습니다.');
      }

      // 2. Content script에서 페이지 내용 추출
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          // 페이지 본문 추출 (최대 5000자)
          const bodyText = document.body.innerText || '';
          return {
            pageUrl: window.location.href,
            pageTitle: document.title,
            pageContent: bodyText.substring(0, 5000),
          };
        },
      });

      if (!result || !result.result) {
        throw new Error('페이지 내용을 추출할 수 없습니다.');
      }

      const { pageUrl, pageTitle, pageContent } = result.result;

      // 3. 사용자가 이미 학습한 단어 목록 가져오기
      const wordsResponse = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      const userWords: string[] = wordsResponse.success && wordsResponse.data
        ? wordsResponse.data.map((w: any) => w.normalizedWord || w.word.toLowerCase())
        : [];

      // 4. Background에 AI 분석 요청
      const analysisResponse = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE_AI',
        data: {
          pageUrl,
          pageTitle,
          pageContent,
          userWords,
        },
      });

      if (analysisResponse.success) {
        setAnalysisResult(analysisResponse.data);

        // 5. Content script에 하이라이트 적용 요청
        await applyHighlights(tab.id, analysisResponse.data.recommendedWords);

        // 6. 분석 이력 다시 로드
        await loadAnalysisHistory();
      } else {
        setAiError(analysisResponse.error || 'AI 분석에 실패했습니다.');
      }
    } catch (err) {
      console.error('[CollectTab] AI analysis error:', err);
      setAiError(err instanceof Error ? err.message : 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Content script에 하이라이트 적용
   */
  const applyHighlights = async (tabId: number, recommendedWords: RecommendedWord[]) => {
    try {
      // 학습한 단어 목록 가져오기
      const wordsResponse = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      const learnedWords: string[] = wordsResponse.success && wordsResponse.data
        ? wordsResponse.data.map((w: any) => w.normalizedWord || w.word.toLowerCase())
        : [];

      // Content script에 메시지 전송 (RecommendedWord 그대로 전송)
      await chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_AI_HIGHLIGHTS',
        learned: learnedWords,
        recommended: recommendedWords,
      });

      console.log('[CollectTab] Highlights applied:', {
        learnedCount: learnedWords.length,
        recommendedCount: recommendedWords.length,
      });
    } catch (err) {
      console.error('[CollectTab] Apply highlights error:', err);
    }
  };

  /**
   * 추천 단어 클릭 시 뜻 토글
   */
  const handleRecommendedWordClick = async (word: string) => {
    // 이미 펼쳐져 있으면 접기
    if (expandedWords.has(word)) {
      const newExpanded = new Set(expandedWords);
      newExpanded.delete(word);
      setExpandedWords(newExpanded);
      return;
    }

    // 펼치기 - 캐시에 있으면 캐시 사용, 없으면 API 조회
    const newExpanded = new Set(expandedWords);
    newExpanded.add(word);
    setExpandedWords(newExpanded);

    if (!wordLookupCache.has(word)) {
      // API 조회
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'LOOKUP_WORD',
          word: word.trim(),
        });

        if (response.success) {
          const newCache = new Map(wordLookupCache);
          newCache.set(word, response.data);
          setWordLookupCache(newCache);
        }
      } catch (err) {
        console.error('[CollectTab] Lookup error:', err);
      }
    }
  };

  /**
   * 체크박스 토글
   */
  const handleCheckboxToggle = (word: string) => {
    const newSelected = new Set(selectedWords);
    if (newSelected.has(word)) {
      newSelected.delete(word);
    } else {
      newSelected.add(word);
    }
    setSelectedWords(newSelected);
  };

  /**
   * 전체 선택/해제
   */
  const handleSelectAll = () => {
    if (!analysisResult) return;

    if (selectedWords.size === analysisResult.recommendedWords.length) {
      // 전체 해제
      setSelectedWords(new Set());
    } else {
      // 전체 선택
      const allWords = new Set(analysisResult.recommendedWords.map(w => w.word));
      setSelectedWords(allWords);
    }
  };

  /**
   * 선택한 단어들 일괄 저장
   */
  const handleBulkSave = async () => {
    if (selectedWords.size === 0) return;

    setIsBulkSaving(true);
    setError(null);

    try {
      const wordsToSave = Array.from(selectedWords);
      let successCount = 0;
      let failCount = 0;

      for (const word of wordsToSave) {
        try {
          // 단어 뜻 조회 (캐시 사용 또는 새로 조회)
          let lookup = wordLookupCache.get(word);
          if (!lookup) {
            const response = await chrome.runtime.sendMessage({
              type: 'LOOKUP_WORD',
              word: word.trim(),
            });
            if (response.success) {
              lookup = response.data;
            }
          }

          if (lookup) {
            // 단어 저장
            const saveResponse = await chrome.runtime.sendMessage({
              type: 'SAVE_WORD',
              wordData: {
                word: word,
                definitions: lookup.definitions,
                phonetic: lookup.phonetic,
                audioUrl: lookup.audioUrl,
                context: word,
                url: window.location.href,
                sourceTitle: document.title,
              },
            });

            if (saveResponse.success) {
              successCount++;
            } else {
              failCount++;
            }
          } else {
            failCount++;
          }
        } catch (err) {
          console.error(`[CollectTab] Failed to save word: ${word}`, err);
          failCount++;
        }
      }

      // 결과 표시
      if (successCount > 0) {
        setSaveSuccess(true);
        setError(null);
        alert(`✅ ${successCount}개 단어가 저장되었습니다!${failCount > 0 ? `\n⚠️ ${failCount}개 단어 저장 실패` : ''}`);

        // 선택 초기화
        setSelectedWords(new Set());
      } else {
        setError('단어 저장에 실패했습니다.');
      }
    } catch (err) {
      setError('일괄 저장 중 오류가 발생했습니다.');
      console.error('[CollectTab] Bulk save error:', err);
    } finally {
      setIsBulkSaving(false);
    }
  };

  /**
   * 분석 이력 클릭 시 해당 분석 결과 표시
   */
  const handleHistoryClick = (history: AIAnalysisHistory) => {
    // 분석 결과를 현재 분석 결과로 설정
    setAnalysisResult({
      summary: history.summary,
      recommendedWords: history.recommendedWords,
      difficulty: history.difficulty,
    });
    setShowAnalysisPanel(true);
    setAiError(null);
  };

  return (
    <div className="space-y-4">
      {/* 재학습 확인 다이얼로그 */}
      {showRelearningDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              이미 학습 중인 단어입니다
            </h3>
            <p className="text-gray-600 mb-4">
              "{searchWord}"는 이미 저장된 단어입니다. 어떻게 하시겠습니까?
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleKeepExisting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                📚 이전 기록 유지 (그대로 학습 계속)
              </button>
              <button
                onClick={handleStartNew}
                className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              >
                🔄 새로 시작 (기록 초기화)
              </button>
              <button
                onClick={handleCancelRelearning}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 분석 버튼 */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-md">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">🤖 AI 페이지 분석</h3>
            <p className="text-xs text-gray-600">현재 페이지에서 학습할 단어를 AI가 추천합니다</p>
          </div>
          <button
            onClick={handleAnalyzeCurrentPage}
            disabled={isAnalyzing}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors whitespace-nowrap"
          >
            {isAnalyzing ? '분석 중...' : '✨ 분석 시작'}
          </button>
        </div>

        {/* 최근 분석 이력 (간단 버전) */}
        {analysisHistories.length > 0 && showHistoryPanel && (
          <div className="mt-3 pt-3 border-t border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">📋 최근 분석</h4>
              <button
                onClick={() => setShowHistoryPanel(false)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                숨기기
              </button>
            </div>
            <div className="space-y-2">
              {analysisHistories.slice(0, 3).map((history) => (
                <div
                  key={history.id}
                  className="p-2 bg-white border border-purple-100 rounded text-xs cursor-pointer hover:border-purple-300 hover:shadow-sm transition-all"
                  onClick={() => handleHistoryClick(history)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-gray-900 truncate flex-1">{history.pageTitle}</div>
                    <a
                      href={history.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="ml-2 text-purple-600 hover:text-purple-800 text-sm"
                      title="원본 페이지 열기"
                    >
                      🔗
                    </a>
                  </div>
                  <div className="text-gray-600 text-xs">
                    {history.recommendedWords.length}개 단어 • {new Date(history.analyzedAt).toLocaleDateString()}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {history.recommendedWords.slice(0, 5).map((word, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchWord(word.word);
                          handleSearch();
                        }}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 text-xs"
                      >
                        {word.word}
                      </button>
                    ))}
                    {history.recommendedWords.length > 5 && (
                      <span className="px-2 py-1 text-gray-500 text-xs">+{history.recommendedWords.length - 5}개 더</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI 분석 결과 패널 */}
      {showAnalysisPanel && (
        <div className="p-4 bg-white border border-gray-200 rounded-md space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">📊 분석 결과</h3>
            <button
              onClick={() => setShowAnalysisPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* AI 오류 메시지 */}
          {aiError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {aiError}
            </div>
          )}

          {/* 분석 중 */}
          {isAnalyzing && (
            <div className="text-center py-8 text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-2"></div>
              AI가 페이지를 분석하고 있습니다...
            </div>
          )}

          {/* 분석 완료 */}
          {!isAnalyzing && analysisResult && (
            <div className="space-y-4">
              {/* 요약 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">페이지 요약</h4>
                <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">{analysisResult.summary}</p>
              </div>

              {/* 난이도 */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-1">난이도</h4>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                  analysisResult.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                  analysisResult.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysisResult.difficulty === 'beginner' ? '초급' :
                   analysisResult.difficulty === 'intermediate' ? '중급' : '고급'}
                </span>
              </div>

              {/* 추천 단어 목록 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">
                    추천 단어 ({analysisResult.recommendedWords.length}개)
                  </h4>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {selectedWords.size === analysisResult.recommendedWords.length ? '전체 해제' : '전체 선택'}
                    </button>
                    {selectedWords.size > 0 && (
                      <button
                        onClick={handleBulkSave}
                        disabled={isBulkSaving}
                        className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {isBulkSaving ? '저장 중...' : `${selectedWords.size}개 저장`}
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {analysisResult.recommendedWords.map((word, index) => {
                    const isExpanded = expandedWords.has(word.word);
                    const isSelected = selectedWords.has(word.word);
                    const lookup = wordLookupCache.get(word.word);

                    return (
                      <div
                        key={index}
                        className="bg-yellow-50 border border-yellow-200 rounded-md overflow-hidden"
                      >
                        <div className="p-3">
                          <div className="flex items-start gap-2">
                            {/* 체크박스 */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleCheckboxToggle(word.word);
                              }}
                              className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                            />

                            {/* 단어 정보 */}
                            <div className="flex-1">
                              <div
                                onClick={() => handleRecommendedWordClick(word.word)}
                                className="cursor-pointer hover:bg-yellow-100 -m-1 p-1 rounded transition-colors"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-medium text-gray-900">{word.word}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-600">점수: {word.importanceScore}</span>
                                    <span className="text-gray-400 text-xs">
                                      {isExpanded ? '▼' : '▶'}
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {word.reasons.map((reason, idx) => (
                                    <span key={idx} className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded">
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* 단어 뜻 (펼쳐졌을 때만 표시) */}
                              {isExpanded && (
                                <div className="mt-3 pt-3 border-t border-yellow-300">
                                  {lookup ? (
                                    <div className="space-y-2">
                                      {/* 발음 */}
                                      {lookup.phonetic && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-sm text-gray-600">{lookup.phonetic}</span>
                                          {lookup.audioUrl && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                new Audio(lookup.audioUrl).play();
                                              }}
                                              className="text-blue-600 hover:text-blue-800"
                                            >
                                              🔊
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      {/* 정의 */}
                                      <div className="space-y-2">
                                        {lookup.definitions.map((def, idx) => (
                                          <div key={idx} className="text-sm">
                                            <div className="text-gray-700">
                                              {idx + 1}. {def}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500">불러오는 중...</div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 하이라이트 안내 */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                💡 페이지에서 <span className="bg-green-200 px-1">학습한 단어</span>와{' '}
                <span className="bg-yellow-200 px-1">추천 단어</span>가 하이라이트되었습니다.
              </div>
            </div>
          )}
        </div>
      )}

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
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{searchWord}</h2>
              {/* 발음기호와 재생 버튼을 한 줄로 */}
              <div className="flex items-center gap-2 mt-1">
                {lookupResult.phonetic ? (
                  <>
                    <span className="text-sm text-gray-600">{lookupResult.phonetic}</span>
                    {lookupResult.audioUrl ? (
                      <button
                        onClick={handlePlayAudio}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
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
