/**
 * AI Highlighter
 * 웹페이지 단어에 AI 하이라이트 적용
 *
 * 녹색 (#4ade80): 학습 완료 단어
 * 노란색 (#fbbf24): 추천 단어
 */

import type { HighlightSettings, WordImportance } from '@catchvoca/types';

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

// 학습 완료 단어 목록 (normalizedWord)
let learnedWords: Set<string> = new Set();

// 추천 단어 목록 (WordImportance)
let recommendedWords: Map<string, WordImportance> = new Map();

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

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'APPLY_AI_HIGHLIGHTS') {
      const { learnedWords: learned, recommendedWords: recommended } = message.data;
      applyHighlights(learned, recommended);
      sendResponse({ success: true });
    } else if (message.type === 'TOGGLE_HIGHLIGHTS') {
      toggleHighlights(message.enabled);
      sendResponse({ success: true });
    } else if (message.type === 'UPDATE_HIGHLIGHT_SETTINGS') {
      updateHighlightSettings(message.settings);
      sendResponse({ success: true });
    }
    return true;
  });

  console.log('[AIHighlighter] Initialized');
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
      learnedWords = new Set(
        response.data.map((word: any) => word.normalizedWord)
      );
      console.log('[AIHighlighter] Loaded learned words:', learnedWords.size);
    }
  } catch (error) {
    console.error('[AIHighlighter] Failed to load learned words:', error);
  }
}

/**
 * 하이라이트 적용
 */
export function applyHighlights(
  learned: string[],
  recommended: WordImportance[]
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

  // 학습 완료 단어 업데이트
  learnedWords = new Set(learned.map((w) => w.toLowerCase()));

  // 추천 단어 업데이트
  recommendedWords = new Map(
    recommended.map((w) => [w.normalizedWord, w])
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
      const replacements: Array<{ word: string; type: 'learned' | 'recommended'; data?: WordImportance }> = [];

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
        const dataAttr = data ? `data-importance='${JSON.stringify(data)}'` : '';
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
  const importance = target.getAttribute('data-importance');

  if (importance) {
    try {
      const data: WordImportance = JSON.parse(importance);
      showHighlightTooltip(target, data);
    } catch (error) {
      console.error('[AIHighlighter] Failed to parse importance data:', error);
    }
  } else {
    // 학습 완료 단어
    showLearnedTooltip(target);
  }
}

/**
 * 하이라이트 호버 아웃 핸들러
 */
function handleHighlightLeave(_event: Event): void {
  removeTooltip();
}

/**
 * 하이라이트 툴팁 표시 (추천 단어)
 */
function showHighlightTooltip(element: HTMLElement, importance: WordImportance): void {
  removeTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'catchvoca-tooltip';

  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;

  tooltip.innerHTML = `
    <div class="catchvoca-tooltip-header">
      📚 추천 단어: ${importance.word}
    </div>
    <div class="catchvoca-tooltip-content">
      중요도 점수: <span class="catchvoca-tooltip-score">${importance.totalScore}점</span>
      <br>
      COCA: ${importance.cocaScore} | AWL: ${importance.awlScore} | Test: ${importance.testScore}
    </div>
  `;

  document.body.appendChild(tooltip);

  // 5초 후 자동 제거
  setTimeout(() => removeTooltip(), 5000);
}

/**
 * 학습 완료 툴팁 표시
 */
function showLearnedTooltip(element: HTMLElement): void {
  removeTooltip();

  const tooltip = document.createElement('div');
  tooltip.className = 'catchvoca-tooltip';

  const rect = element.getBoundingClientRect();
  tooltip.style.left = `${rect.left + window.scrollX}px`;
  tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;

  tooltip.innerHTML = `
    <div class="catchvoca-tooltip-header">
      ✅ 학습 완료
    </div>
    <div class="catchvoca-tooltip-content">
      이미 학습한 단어입니다!
    </div>
  `;

  document.body.appendChild(tooltip);

  // 3초 후 자동 제거
  setTimeout(() => removeTooltip(), 3000);
}

/**
 * 툴팁 제거
 */
function removeTooltip(): void {
  const existingTooltip = document.querySelector('.catchvoca-tooltip');
  if (existingTooltip) {
    existingTooltip.remove();
  }
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
