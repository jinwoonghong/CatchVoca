/**
 * AI Highlighter
 * 웹페이지 단어에 AI 하이라이트 적용
 *
 * 녹색 (#4ade80): 학습 완료 단어
 * 노란색 (#fbbf24): 추천 단어
 */

import type { HighlightSettings, RecommendedWord } from '@catchvoca/types';

const HIGHLIGHT_CLASS_PREFIX = 'catchvoca-highlight';
const LEARNED_CLASS = `${HIGHLIGHT_CLASS_PREFIX}-learned`;
const RECOMMENDED_CLASS = `${HIGHLIGHT_CLASS_PREFIX}-recommended`;

// 하이라이트 상태
let isHighlightEnabled = true;
let highlightSettings: HighlightSettings = {
  enabled: true,
  learnedColor: '#4ade80',
  recommendedColor: '#fbbf24',
  showTooltip: true,
};

// 학습 완료 단어 목록 (normalizedWord -> WordEntry 정보)
interface LearnedWordInfo {
  normalizedWord: string;
  viewCount: number;
  repetitions: number; // SM-2 학습 횟수
}

let learnedWords: Map<string, LearnedWordInfo> = new Map();

// 추천 단어 목록 (RecommendedWord from AI analysis)
let recommendedWords: Map<string, RecommendedWord> = new Map();

// MutationObserver for dynamic content
let observer: MutationObserver | null = null;

// Debounce timer for performance optimization
let debounceTimer: number | null = null;
const DEBOUNCE_DELAY = 300; // 300ms

// 성능 최적화: 처리할 노드 큐
let pendingNodes: Set<Node> = new Set();
let isProcessing = false;

// 성능 최적화: 하이라이트할 최대 단어 개수 제한
const MAX_WORDS_TO_HIGHLIGHT = 200;

// 툴팁 관리
let currentTooltip: HTMLElement | null = null;
let tooltipTimer: number | null = null;
let currentTooltipTarget: HTMLElement | null = null;

/**
 * AI 하이라이트 초기화
 */
export function initializeAIHighlighter(): void {
  console.log('[AIHighlighter] Initializing...');

  // CSS 스타일 주입
  injectHighlightStyles();

  // 설정 로드
  loadHighlightSettings();

  // 학습 단어 로드
  loadLearnedWords();

  // 추천 단어 로드 (최근 AI 분석 결과)
  loadRecommendedWords();

  // DOM 변경 감지 (동적 콘텐츠 지원)
  setupMutationObserver();

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'APPLY_AI_HIGHLIGHTS') {
      const { learnedWords: learned, recommendedWords: recommended } = message.data;
      applyHighlights(learned, recommended);
      sendResponse({ success: true });
    } else if (message.type === 'AI_ANALYSIS_COMPLETED') {
      // AI 분석 완료 시 추천 단어 다시 로드
      console.log('[AIHighlighter] AI analysis completed, reloading recommended words');
      loadRecommendedWords();
      sendResponse({ success: true });
    } else if (message.type === 'TOGGLE_HIGHLIGHTS') {
      toggleHighlights(message.enabled);
      sendResponse({ success: true });
    } else if (message.type === 'UPDATE_HIGHLIGHT_SETTINGS') {
      updateHighlightSettings(message.settings);
      sendResponse({ success: true });
    } else if (message.type === 'WORD_SAVED') {
      // 단어 저장 시 학습 단어 목록에 추가하고 하이라이트 재적용
      const normalizedWord = message.word?.toLowerCase();
      if (normalizedWord) {
        // 새로 저장된 단어 정보 추가 (기본값)
        learnedWords.set(normalizedWord, {
          normalizedWord,
          viewCount: 1,
          repetitions: 0,
        });

        // 추천 단어에서 제거 (학습 단어가 우선)
        recommendedWords.delete(normalizedWord);

        console.log('[AIHighlighter] Word saved, updating highlights:', normalizedWord);

        if (isHighlightEnabled && highlightSettings.enabled) {
          // 성능 최적화: 전체 페이지 대신 body만 큐에 추가
          pendingNodes.add(document.body);
          scheduleDebouncedHighlight();
        }
      }
      sendResponse({ success: true });
    }
    return true;
  });

  console.log('[AIHighlighter] Initialized');
}

/**
 * MutationObserver 설정 (동적 콘텐츠 감지)
 */
function setupMutationObserver(): void {
  // 이미 설정되어 있으면 스킵
  if (observer) {
    return;
  }

  observer = new MutationObserver((mutations) => {
    // 하이라이트가 비활성화되어 있으면 스킵
    if (!isHighlightEnabled || !highlightSettings.enabled) {
      return;
    }

    // 학습 단어가 없으면 스킵
    if (learnedWords.size === 0 && recommendedWords.size === 0) {
      return;
    }

    // 새로 추가된 노드를 큐에 추가
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          // CatchVoca 관련 노드는 스킵 (무한 루프 방지)
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            if (element.classList?.contains('catchvoca-highlight') ||
                element.classList?.contains('catchvoca-tooltip')) {
              return;
            }
          }

          if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
            pendingNodes.add(node);
          }
        });
      }
    }

    // Debounced 처리 실행
    scheduleDebouncedHighlight();
  });

  // Body 요소 감시 시작
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log('[AIHighlighter] MutationObserver started');
}

/**
 * Debounced 하이라이트 스케줄링
 */
function scheduleDebouncedHighlight(): void {
  // 이미 타이머가 있으면 취소
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }

  // 새로운 타이머 설정
  debounceTimer = window.setTimeout(() => {
    debounceTimer = null;
    processPendingNodes();
  }, DEBOUNCE_DELAY);
}

/**
 * 대기 중인 노드 일괄 처리 (requestIdleCallback 사용)
 */
function processPendingNodes(): void {
  if (isProcessing || pendingNodes.size === 0) {
    return;
  }

  isProcessing = true;
  const nodesToProcess = Array.from(pendingNodes);
  pendingNodes.clear();

  // requestIdleCallback으로 유휴 시간에 처리
  if ('requestIdleCallback' in window) {
    requestIdleCallback(
      (deadline) => {
        processNodesInBatches(nodesToProcess, deadline);
      },
      { timeout: 1000 } // 최대 1초 후 강제 실행
    );
  } else {
    // requestIdleCallback 미지원 브라우저는 setTimeout으로 fallback
    setTimeout(() => {
      processNodesInBatches(nodesToProcess);
    }, 0);
  }
}

/**
 * 노드를 배치로 나눠서 처리 (성능 최적화)
 */
function processNodesInBatches(
  nodes: Node[],
  deadline?: IdleDeadline
): void {
  const BATCH_SIZE = 50; // 한 번에 50개씩 처리
  let processed = 0;

  while (processed < nodes.length) {
    // deadline이 있고 시간이 부족하면 다음 idle로 연기
    if (deadline && deadline.timeRemaining() < 5) {
      const remaining = nodes.slice(processed);
      requestIdleCallback(
        (newDeadline) => processNodesInBatches(remaining, newDeadline),
        { timeout: 1000 }
      );
      return;
    }

    const batch = nodes.slice(processed, processed + BATCH_SIZE);
    batch.forEach((node) => {
      try {
        highlightTextNodes(node);
      } catch (error) {
        console.error('[AIHighlighter] Error processing node:', error);
      }
    });

    processed += BATCH_SIZE;
  }

  isProcessing = false;
}

/**
 * 하이라이트 스타일 주입
 */
function injectHighlightStyles(): void {
  const styleId = 'catchvoca-highlight-styles';

  // 이미 주입되어 있으면 스킵
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .${LEARNED_CLASS} {
      background-color: ${highlightSettings.learnedColor};
      background-color: ${highlightSettings.learnedColor}33; /* 20% opacity */
      border-bottom: 2px solid ${highlightSettings.learnedColor};
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .${LEARNED_CLASS}:hover {
      background-color: ${highlightSettings.learnedColor}66; /* 40% opacity */
    }

    .${RECOMMENDED_CLASS} {
      background-color: ${highlightSettings.recommendedColor};
      background-color: ${highlightSettings.recommendedColor}33; /* 20% opacity */
      border-bottom: 2px solid ${highlightSettings.recommendedColor};
      cursor: pointer;
      transition: background-color 0.2s ease;
    }

    .${RECOMMENDED_CLASS}:hover {
      background-color: ${highlightSettings.recommendedColor}66; /* 40% opacity */
    }

    .catchvoca-tooltip {
      position: absolute;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
      z-index: 10000;
      max-width: 300px;
      font-size: 14px;
      line-height: 1.5;
    }

    .catchvoca-tooltip-header {
      font-weight: 600;
      margin-bottom: 8px;
      color: #1f2937;
    }

    .catchvoca-tooltip-content {
      color: #6b7280;
      font-size: 13px;
    }

    .catchvoca-tooltip-score {
      display: inline-block;
      background: #f3f4f6;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      margin-top: 4px;
    }
  `;

  document.head.appendChild(style);
}

/**
 * 설정 로드
 */
async function loadHighlightSettings(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_SETTINGS',
    });

    if (response.success && response.data.highlightSettings) {
      highlightSettings = response.data.highlightSettings;
      isHighlightEnabled = response.data.aiAnalysisEnabled;
    }
  } catch (error) {
    console.error('[AIHighlighter] Failed to load settings:', error);
  }
}

/**
 * 학습 완료 단어 로드
 */
async function loadLearnedWords(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ALL_WORDS',
    });

    if (response.success && Array.isArray(response.data)) {
      // 성능 최적화: 최근 단어만 하이라이트 (최대 MAX_WORDS_TO_HIGHLIGHT개)
      const recentWords = response.data
        .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, MAX_WORDS_TO_HIGHLIGHT);

      // ReviewState 정보도 함께 조회
      const reviewStatsResponse = await chrome.runtime.sendMessage({
        type: 'GET_REVIEW_STATS',
      });

      const reviewStatsMap = new Map();
      if (reviewStatsResponse.success && reviewStatsResponse.data) {
        // ReviewState 정보를 wordId로 매핑
        const allReviews = await chrome.runtime.sendMessage({
          type: 'GET_DUE_REVIEWS',
          limit: 10000, // 전체 조회
        });

        if (allReviews.success && Array.isArray(allReviews.data)) {
          // 모든 ReviewState를 조회하기 위해 다른 방법 사용
          // 각 단어의 ReviewState를 개별 조회
          for (const word of recentWords) {
            try {
              const reviewResponse = await chrome.runtime.sendMessage({
                type: 'GET_REVIEW_STATE',
                wordId: word.id,
              });
              if (reviewResponse.success && reviewResponse.data) {
                reviewStatsMap.set(word.id, reviewResponse.data);
              }
            } catch {
              // ReviewState 없는 단어는 스킵
            }
          }
        }
      }

      // 학습 단어 정보 저장
      learnedWords = new Map(
        recentWords.map((word: any) => {
          const reviewState = reviewStatsMap.get(word.id);
          return [
            word.normalizedWord,
            {
              normalizedWord: word.normalizedWord,
              viewCount: word.viewCount || 0,
              repetitions: reviewState?.repetitions || 0,
            },
          ];
        })
      );

      console.log('[AIHighlighter] Loaded learned words:', learnedWords.size);

      // 학습 단어가 있으면 자동으로 하이라이트 적용 (debounced)
      if (learnedWords.size > 0 && isHighlightEnabled && highlightSettings.enabled) {
        console.log('[AIHighlighter] Auto-applying highlights for learned words');
        pendingNodes.add(document.body);
        scheduleDebouncedHighlight();
      }
    }
  } catch (error) {
    console.error('[AIHighlighter] Failed to load learned words:', error);
  }
}

/**
 * 추천 단어 로드 (최근 AI 분석 결과)
 */
async function loadRecommendedWords(): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_ANALYSIS_HISTORY',
      limit: 5, // 최근 5개 분석 결과
    });

    if (response.success && Array.isArray(response.data)) {
      // 모든 분석 결과에서 추천 단어 수집
      const allRecommendedWords: RecommendedWord[] = [];

      response.data.forEach((history: any) => {
        if (Array.isArray(history.recommendedWords)) {
          allRecommendedWords.push(...history.recommendedWords);
        }
      });

      // 중복 제거 및 점수 순 정렬 (상위 50개만)
      const uniqueWords = new Map<string, RecommendedWord>();
      allRecommendedWords.forEach((word) => {
        const existing = uniqueWords.get(word.normalizedWord);
        if (!existing || word.importanceScore > existing.importanceScore) {
          uniqueWords.set(word.normalizedWord, word);
        }
      });

      const topRecommended = Array.from(uniqueWords.values())
        .sort((a, b) => b.importanceScore - a.importanceScore)
        .slice(0, 50)
        .filter((w) => !learnedWords.has(w.normalizedWord)); // 학습 단어와 겹치는 것 제거

      recommendedWords = new Map(
        topRecommended.map((w) => [w.normalizedWord, w])
      );

      console.log('[AIHighlighter] Loaded recommended words:', recommendedWords.size);

      // 추천 단어가 있으면 자동으로 하이라이트 적용 (debounced)
      if (recommendedWords.size > 0 && isHighlightEnabled && highlightSettings.enabled) {
        console.log('[AIHighlighter] Auto-applying highlights for recommended words');
        pendingNodes.add(document.body);
        scheduleDebouncedHighlight();
      }
    }
  } catch (error) {
    console.error('[AIHighlighter] Failed to load recommended words:', error);
  }
}

/**
 * 하이라이트 적용
 */
export function applyHighlights(
  learned: string[],
  recommended: RecommendedWord[]
): void {
  if (!isHighlightEnabled || !highlightSettings.enabled) {
    return;
  }

  console.log('[AIHighlighter] Applying highlights...', {
    learned: learned.length,
    recommended: recommended.length,
  });

  // 기존 하이라이트 제거
  removeHighlights();

  // 학습 완료 단어 업데이트 (기본 정보만)
  learnedWords = new Map(
    learned.map((w) => [
      w.toLowerCase(),
      {
        normalizedWord: w.toLowerCase(),
        viewCount: 0,
        repetitions: 0,
      },
    ])
  );

  // 추천 단어 업데이트 (학습 단어와 겹치는 것 제거)
  recommendedWords = new Map(
    recommended
      .filter((w) => !learnedWords.has(w.normalizedWord))
      .map((w) => [w.normalizedWord, w])
  );

  // 페이지 텍스트 노드 순회하며 하이라이트
  highlightTextNodes(document.body);

  console.log('[AIHighlighter] Highlights applied');
}

/**
 * 텍스트 노드 하이라이트
 */
function highlightTextNodes(node: Node): void {
  // 스크립트, 스타일 태그는 제외
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).tagName.match(/^(SCRIPT|STYLE|NOSCRIPT)$/)
  ) {
    return;
  }

  // 이미 하이라이트된 요소는 제외
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    (node as Element).classList.contains(HIGHLIGHT_CLASS_PREFIX)
  ) {
    return;
  }

  // 텍스트 노드 처리
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    const words = text.match(/\b[a-zA-Z]+\b/g);

    if (words && words.length > 0) {
      const parent = node.parentElement;
      if (!parent) return;

      // 단어별로 하이라이트 적용
      let newHTML = text;
      const replacements: Array<{ word: string; type: 'learned' | 'recommended'; data?: RecommendedWord }> = [];

      for (const word of words) {
        const normalized = word.toLowerCase();

        if (learnedWords.has(normalized)) {
          replacements.push({ word, type: 'learned' });
        } else if (recommendedWords.has(normalized)) {
          replacements.push({
            word,
            type: 'recommended',
            data: recommendedWords.get(normalized),
          });
        }
      }

      // HTML 생성
      for (const { word, type, data } of replacements) {
        const className = type === 'learned' ? LEARNED_CLASS : RECOMMENDED_CLASS;
        // JSON을 Base64로 인코딩하여 속성값 충돌 방지
        const dataAttr = data
          ? `data-importance="${btoa(JSON.stringify(data)).replace(/"/g, '&quot;')}"`
          : '';
        const regex = new RegExp(`\\b${word}\\b`, 'g');

        newHTML = newHTML.replace(
          regex,
          `<span class="${className}" ${dataAttr}>${word}</span>`
        );
      }

      if (replacements.length > 0) {
        const wrapper = document.createElement('span');
        wrapper.innerHTML = newHTML;

        // 이벤트 리스너 추가
        wrapper.querySelectorAll(`.${LEARNED_CLASS}, .${RECOMMENDED_CLASS}`).forEach((el) => {
          el.addEventListener('mouseenter', handleHighlightHover);
          el.addEventListener('mouseleave', handleHighlightLeave);
        });

        parent.replaceChild(wrapper, node);
      }
    }
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    // 자식 노드 재귀 처리
    Array.from(node.childNodes).forEach((child) => {
      highlightTextNodes(child);
    });
  }
}

/**
 * 하이라이트 호버 핸들러
 */
function handleHighlightHover(event: Event): void {
  if (!highlightSettings.showTooltip) {
    return;
  }

  const target = event.target as HTMLElement;

  // 이미 같은 요소의 툴팁이 표시 중이면 스킵
  if (currentTooltipTarget === target && currentTooltip) {
    return;
  }

  const importance = target.getAttribute('data-importance');

  console.log('[AIHighlighter] Hover on word:', target.textContent, 'has data-importance:', !!importance);

  if (importance) {
    try {
      // Base64 디코딩 후 JSON 파싱
      const decoded = atob(importance);
      console.log('[AIHighlighter] Decoded importance:', decoded);
      const data: RecommendedWord = JSON.parse(decoded);
      console.log('[AIHighlighter] Parsed data:', JSON.stringify(data, null, 2));
      console.log('[AIHighlighter] Data properties:', {
        word: data.word,
        normalizedWord: data.normalizedWord,
        importanceScore: data.importanceScore,
        reasons: data.reasons,
      });
      showHighlightTooltip(target, data);
    } catch (error) {
      console.error('[AIHighlighter] Failed to parse importance data:', error, 'importance:', importance);
    }
  } else {
    // 학습 완료 단어
    console.log('[AIHighlighter] Showing learned word tooltip');
    showLearnedTooltip(target);
  }
}

/**
 * 하이라이트 호버 아웃 핸들러
 */
function handleHighlightLeave(event: Event): void {
  const target = event.target as HTMLElement;

  // 현재 타겟에서 벗어날 때만 툴팁 제거
  if (currentTooltipTarget === target) {
    // 약간의 지연을 두고 제거 (마우스가 툴팁으로 이동할 수 있도록)
    setTimeout(() => {
      if (currentTooltipTarget === target) {
        removeTooltip();
      }
    }, 100);
  }
}

/**
 * 하이라이트 툴팁 표시 (추천 단어)
 */
function showHighlightTooltip(element: HTMLElement, recommendedWord: RecommendedWord): void {
  removeTooltip();

  currentTooltipTarget = element;

  const tooltip = document.createElement('div');
  tooltip.className = 'catchvoca-tooltip';

  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;

  tooltip.innerHTML = `
    <div class="catchvoca-tooltip-header">
      📚 추천 단어: ${recommendedWord.word}
    </div>
    <div class="catchvoca-tooltip-content">
      중요도 점수: <span class="catchvoca-tooltip-score">${recommendedWord.importanceScore}점</span>
      <br>
      ${recommendedWord.reasons.join(' | ')}
    </div>
  `;

  // 툴팁 호버 시 자동 제거 타이머 취소
  tooltip.addEventListener('mouseenter', () => {
    if (tooltipTimer !== null) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  });

  tooltip.addEventListener('mouseleave', () => {
    removeTooltip();
  });

  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  // 5초 후 자동 제거
  if (tooltipTimer !== null) {
    clearTimeout(tooltipTimer);
  }
  tooltipTimer = window.setTimeout(() => {
    removeTooltip();
  }, 5000);
}

/**
 * 학습 완료 툴팁 표시
 */
function showLearnedTooltip(element: HTMLElement): void {
  removeTooltip();

  currentTooltipTarget = element;

  // 단어 정보 가져오기
  const word = element.textContent?.toLowerCase() || '';
  const wordInfo = learnedWords.get(word);

  if (!wordInfo) {
    return; // 정보 없으면 표시 안 함
  }

  const tooltip = document.createElement('div');
  tooltip.className = 'catchvoca-tooltip';

  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;

  tooltip.innerHTML = `
    <div class="catchvoca-tooltip-header">
      📗 학습 중인 단어
    </div>
    <div class="catchvoca-tooltip-content">
      조회수: <span class="catchvoca-tooltip-score">${wordInfo.viewCount}회</span>
      <br>
      학습 횟수: <span class="catchvoca-tooltip-score">${wordInfo.repetitions}회</span>
    </div>
  `;

  // 툴팁 호버 시 자동 제거 타이머 취소
  tooltip.addEventListener('mouseenter', () => {
    if (tooltipTimer !== null) {
      clearTimeout(tooltipTimer);
      tooltipTimer = null;
    }
  });

  tooltip.addEventListener('mouseleave', () => {
    removeTooltip();
  });

  document.body.appendChild(tooltip);
  currentTooltip = tooltip;

  // 3초 후 자동 제거
  if (tooltipTimer !== null) {
    clearTimeout(tooltipTimer);
  }
  tooltipTimer = window.setTimeout(() => {
    removeTooltip();
  }, 3000);
}

/**
 * 툴팁 제거
 */
function removeTooltip(): void {
  // 타이머 정리
  if (tooltipTimer !== null) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }

  // 툴팁 제거
  if (currentTooltip && currentTooltip.parentElement) {
    currentTooltip.remove();
  }

  currentTooltip = null;
  currentTooltipTarget = null;
}

/**
 * 하이라이트 제거
 */
export function removeHighlights(): void {
  document.querySelectorAll(`.${LEARNED_CLASS}, .${RECOMMENDED_CLASS}`).forEach((el) => {
    const parent = el.parentElement;
    if (parent) {
      parent.replaceChild(document.createTextNode(el.textContent || ''), el);
    }
  });
}

/**
 * 하이라이트 토글
 */
export function toggleHighlights(enabled: boolean): void {
  isHighlightEnabled = enabled;

  if (!enabled) {
    removeHighlights();
  } else {
    // 재적용
    loadLearnedWords();
  }
}

/**
 * 하이라이트 설정 업데이트
 */
export function updateHighlightSettings(settings: HighlightSettings): void {
  highlightSettings = settings;

  // 스타일 재주입
  const existingStyle = document.getElementById('catchvoca-highlight-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  injectHighlightStyles();

  // 하이라이트 재적용
  if (isHighlightEnabled && settings.enabled) {
    removeHighlights();
    highlightTextNodes(document.body);
  }
}
