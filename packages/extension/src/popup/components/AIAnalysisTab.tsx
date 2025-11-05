/**
 * AI 페이지 분석 탭
 * - 현재 페이지 AI 분석
 * - 추천 단어 표시
 * - 분석 이력 관리
 */

import { useState, useEffect } from 'react';
import type { GeminiAnalysisResponse, RecommendedWord, AIAnalysisHistory, LookupResult } from '@catchvoca/types';

interface AIAnalysisTabProps {
  onSwitchToSettings: () => void;
}

export function AIAnalysisTab({ onSwitchToSettings }: AIAnalysisTabProps) {
  // AI 분석 상태
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<GeminiAnalysisResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

  // AI 분석 이력 상태
  const [analysisHistories, setAnalysisHistories] = useState<AIAnalysisHistory[]>([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(true);

  // 추천 단어 상태
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set());
  const [wordLookupCache, setWordLookupCache] = useState<Map<string, LookupResult>>(new Map());
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
      console.error('[AIAnalysisTab] Failed to load analysis history:', err);
    }
  };

  /**
   * AI 페이지 분석 핸들러
   */
  const handleAnalyzePage = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    setAnalysisResult(null);
    setShowAnalysisPanel(false);

    try {
      // 현재 활성 탭 가져오기
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];

      if (!currentTab || !currentTab.id) {
        throw new Error('활성 탭을 찾을 수 없습니다.');
      }

      // Content script에서 페이지 텍스트 추출
      const extractResponse = await chrome.tabs.sendMessage(currentTab.id, {
        type: 'EXTRACT_PAGE_TEXT',
      });

      if (!extractResponse.success) {
        throw new Error(extractResponse.error || '페이지 텍스트 추출 실패');
      }

      const pageText = extractResponse.data.text;
      const pageUrl = currentTab.url || '';
      const pageTitle = currentTab.title || '';

      console.log('[AIAnalysisTab] Extracted text length:', pageText.length);

      // 이미 학습한 단어 목록 가져오기
      const wordsResponse = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      const userWords: string[] = wordsResponse.success && wordsResponse.data
        ? wordsResponse.data.map((w: any) => w.normalizedWord || w.word.toLowerCase())
        : [];

      // Background Worker에 AI 분석 요청
      const analysisResponse = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE_AI',
        pageContent: pageText,
        pageUrl: pageUrl,
        pageTitle: pageTitle,
        userWords: userWords,
      });

      if (analysisResponse.success) {
        setAnalysisResult(analysisResponse.data);
        setShowAnalysisPanel(true);

        // 분석 이력 다시 로드
        await loadAnalysisHistory();

        // 자동으로 하이라이트 적용
        await applyHighlights(analysisResponse.data.recommendedWords);
      } else {
        setAiError(analysisResponse.error || 'AI 분석에 실패했습니다.');

        // 사용량 제한 에러 시 설정 탭으로 이동 유도
        if (analysisResponse.error?.includes('한도') || analysisResponse.error?.includes('제한')) {
          setTimeout(() => {
            if (confirm('AI 사용량 제한에 도달했습니다. 설정에서 Pro로 업그레이드하시겠습니까?')) {
              onSwitchToSettings();
            }
          }, 100);
        }
      }
    } catch (err: any) {
      console.error('[AIAnalysisTab] Analyze error:', err);
      setAiError(err.message || 'AI 분석 중 오류가 발생했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * 하이라이트 적용
   */
  const applyHighlights = async (recommendedWords: RecommendedWord[]) => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tabId = tabs[0]?.id;

      if (!tabId) {
        console.warn('[AIAnalysisTab] No active tab found for highlights');
        return;
      }

      // 현재 저장된 단어 목록 가져오기
      const wordsResponse = await chrome.runtime.sendMessage({
        type: 'GET_ALL_WORDS',
      });

      const learnedWords: string[] = wordsResponse.success && wordsResponse.data
        ? wordsResponse.data.map((w: any) => w.normalizedWord || w.word.toLowerCase())
        : [];

      // Content script에 메시지 전송 (RecommendedWord 그대로 전송)
      await chrome.tabs.sendMessage(tabId, {
        type: 'APPLY_AI_HIGHLIGHTS',
        data: {
          learnedWords: learnedWords,
          recommendedWords: recommendedWords,
        }
      });

      console.log('[AIAnalysisTab] Highlights applied:', {
        learnedCount: learnedWords.length,
        recommendedCount: recommendedWords.length,
      });
    } catch (err) {
      console.error('[AIAnalysisTab] Apply highlights error:', err);
    }
  };

  /**
   * 추천 단어 클릭 핸들러 (정의 펼침/접기)
   */
  const handleRecommendedWordClick = async (word: string) => {
    // 이미 펼쳐진 단어면 접기
    if (expandedWords.has(word)) {
      const newExpanded = new Set(expandedWords);
      newExpanded.delete(word);
      setExpandedWords(newExpanded);
      return;
    }

    // 펼치기
    const newExpanded = new Set(expandedWords);
    newExpanded.add(word);
    setExpandedWords(newExpanded);

    // 캐시에 없으면 단어 뜻 조회
    if (!wordLookupCache.has(word)) {
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
        console.error('[AIAnalysisTab] Word lookup error:', err);
      }
    }
  };

  /**
   * 발음 재생 핸들러
   */
  const handlePlayAudio = (audioUrl: string) => {
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch((err) => {
        console.error('[AIAnalysisTab] Audio play error:', err);
      });
    }
  };

  /**
   * 체크박스 토글
   */
  const handleWordCheckbox = (word: string) => {
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
      setSelectedWords(new Set(analysisResult.recommendedWords.map(w => w.word)));
    }
  };

  /**
   * 일괄 저장
   */
  const handleBulkSave = async () => {
    if (selectedWords.size === 0) {
      alert('저장할 단어를 선택해주세요.');
      return;
    }

    setIsBulkSaving(true);

    try {
      const wordsToSave = Array.from(selectedWords);
      let successCount = 0;
      let failCount = 0;

      for (const word of wordsToSave) {
        // 캐시에서 뜻 가져오기 (없으면 조회)
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
      }

      alert(
        `✅ ${successCount}개 단어가 저장되었습니다!${
          failCount > 0 ? `\n⚠️ ${failCount}개 단어 저장 실패` : ''
        }`
      );

      // 선택 초기화
      setSelectedWords(new Set());

      // 하이라이트 재적용
      if (analysisResult) {
        await applyHighlights(analysisResult.recommendedWords);
      }
    } catch (err) {
      console.error('[AIAnalysisTab] Bulk save error:', err);
      alert('일괄 저장 중 오류가 발생했습니다.');
    } finally {
      setIsBulkSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* AI 페이지 분석 버튼 */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">🤖 AI 페이지 분석</h3>
        <p className="text-sm text-gray-600 mb-4">
          현재 페이지에서 학습할 만한 단어를 AI가 추천합니다
        </p>
        <button
          onClick={handleAnalyzePage}
          disabled={isAnalyzing}
          className="w-full px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
        >
          {isAnalyzing ? '분석 중...' : '✨ 분석 시작'}
        </button>

        {aiError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {aiError}
          </div>
        )}
      </div>

      {/* AI 분석 결과 */}
      {showAnalysisPanel && analysisResult && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">📊 분석 결과</h3>
            <button
              onClick={() => setShowAnalysisPanel(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* 추천 단어 목록 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium text-gray-700">
                추천 단어 ({analysisResult.recommendedWords.length}개)
              </div>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {selectedWords.size === analysisResult.recommendedWords.length
                    ? '전체 해제'
                    : '전체 선택'}
                </button>
                {selectedWords.size > 0 && (
                  <button
                    onClick={handleBulkSave}
                    disabled={isBulkSaving}
                    className="text-xs px-2 py-1 bg-primary-600 text-white hover:bg-primary-700 rounded disabled:bg-gray-300"
                  >
                    {isBulkSaving ? '저장 중...' : `${selectedWords.size}개 저장`}
                  </button>
                )}
              </div>
            </div>

            {analysisResult.recommendedWords.map((word) => {
              const isExpanded = expandedWords.has(word.word);
              const isSelected = selectedWords.has(word.word);
              const lookup = wordLookupCache.get(word.word);

              return (
                <div
                  key={word.word}
                  className="border border-gray-200 rounded-md overflow-hidden"
                >
                  <div className="flex items-center p-3 bg-gray-50 hover:bg-gray-100">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleWordCheckbox(word.word)}
                      className="mr-3 h-4 w-4 text-primary-600 rounded"
                    />
                    <button
                      onClick={() => handleRecommendedWordClick(word.word)}
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{word.word}</span>
                        <span className="text-xs text-gray-500">
                          {word.importanceScore}점
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {word.reasons.join(' · ')}
                      </div>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-white border-t border-gray-200">
                      {lookup ? (
                        <>
                          {lookup.phonetic && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-gray-600">
                                [{lookup.phonetic}]
                              </span>
                              {lookup.audioUrl && (
                                <button
                                  onClick={() => handlePlayAudio(lookup.audioUrl!)}
                                  className="text-primary-600 hover:text-primary-700 transition-colors"
                                  title="발음 듣기"
                                >
                                  🔊
                                </button>
                              )}
                            </div>
                          )}
                          {lookup.definitions && lookup.definitions.length > 0 ? (
                            <ol className="list-decimal list-inside space-y-1">
                              {lookup.definitions.map((def, idx) => (
                                <li key={idx} className="text-sm text-gray-700">
                                  {def}
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <div className="text-sm text-gray-500">정의를 찾을 수 없습니다.</div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-gray-500">정의를 불러오는 중...</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 분석 이력 */}
      {analysisHistories.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">📜 최근 분석 이력</h3>
            <button
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              {showHistoryPanel ? '접기' : '펼치기'}
            </button>
          </div>

          {showHistoryPanel && (
            <div className="space-y-3">
              {analysisHistories.slice(0, 5).map((history) => (
                <div
                  key={history.id}
                  className="border border-gray-200 rounded-md p-3 hover:bg-gray-50 cursor-pointer"
                  onClick={async () => {
                    setAnalysisResult({
                      recommendedWords: history.recommendedWords,
                      summary: history.summary,
                      difficulty: history.difficulty,
                    });
                    setShowAnalysisPanel(true);
                    await applyHighlights(history.recommendedWords);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {history.pageTitle || '제목 없음'}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="text-xs text-gray-500 truncate flex-1">
                          {history.pageUrl}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            chrome.tabs.create({ url: history.pageUrl });
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex-shrink-0"
                          title="페이지로 이동"
                        >
                          🔗 이동
                        </button>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(history.analyzedAt).toLocaleString('ko-KR')} ·{' '}
                        {history.recommendedWords.length}개 단어
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
