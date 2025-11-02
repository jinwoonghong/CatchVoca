/**
 * Word Importance Algorithm
 * 단어 중요도 계산 알고리즘
 *
 * 점수 구성:
 * - COCA 빈도: 40점
 * - Academic Word List: 30점
 * - 토익/토플 빈출: 20점
 * - Gemini 문맥 분석: 10점 (Pro만)
 */

import { Logger } from '@catchvoca/core';
import type { WordImportance } from '@catchvoca/types';

const logger = new Logger('WordImportance');

// COCA (Corpus of Contemporary American English) 빈도 데이터 (상위 5000개)
// 실제로는 전체 데이터베이스를 사용하지만, 여기서는 샘플로 상위 100개만 포함
const COCA_TOP_5000: Set<string> = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
  'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
  'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
  'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
  'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me',
  // ... (실제로는 5000개)
]);

// Academic Word List (AWL) - 570개 단어
const ACADEMIC_WORD_LIST: Set<string> = new Set([
  'analyze', 'approach', 'area', 'assess', 'assume', 'authority', 'available',
  'benefit', 'concept', 'consist', 'constitute', 'context', 'contract', 'create',
  'data', 'define', 'derive', 'distribute', 'economy', 'environment', 'establish',
  'estimate', 'evident', 'export', 'factor', 'finance', 'formula', 'function',
  'identify', 'income', 'indicate', 'individual', 'interpret', 'involve', 'issue',
  'labor', 'legal', 'legislate', 'major', 'method', 'occur', 'percent', 'period',
  'policy', 'principle', 'proceed', 'process', 'require', 'research', 'respond',
  'role', 'section', 'sector', 'significant', 'similar', 'source', 'specific',
  'structure', 'theory', 'vary', 'achieve', 'acquire', 'administrate', 'affect',
  'appropriate', 'aspect', 'assist', 'category', 'chapter', 'commission', 'community',
  'complex', 'compute', 'conclude', 'conduct', 'consequent', 'construct', 'consume',
  'credit', 'culture', 'design', 'distinct', 'element', 'equate', 'evaluate',
  'feature', 'final', 'focus', 'impact', 'injure', 'institute', 'invest', 'item',
  'journal', 'maintain', 'normal', 'obtain', 'participate', 'perceive', 'positive',
  'potential', 'previous', 'primary', 'purchase', 'range', 'region', 'regulate',
  'relevant', 'reside', 'resource', 'restrict', 'secure', 'seek', 'select', 'site',
  'strategy', 'survey', 'text', 'tradition', 'transfer',
  // ... (실제로는 570개)
]);

// 토익/토플 빈출 단어 (상위 1000개)
const TOEIC_TOEFL_WORDS: Set<string> = new Set([
  'accommodate', 'accomplish', 'accumulate', 'accurate', 'achieve', 'acknowledge',
  'acquire', 'adapt', 'adequate', 'adjust', 'administrate', 'advance', 'advantage',
  'adverse', 'advocate', 'affect', 'aggregate', 'allocate', 'alternative', 'ambiguous',
  'analyze', 'annual', 'anticipate', 'apparent', 'applicable', 'appoint', 'appreciate',
  'approach', 'appropriate', 'approximate', 'arbitrary', 'aspect', 'assemble', 'assess',
  'assign', 'assist', 'associate', 'assume', 'assure', 'attach', 'attain', 'attitude',
  'attribute', 'author', 'authority', 'automatic', 'available', 'aware', 'behalf',
  'benefit', 'bias', 'bond', 'brief', 'bulk', 'capable', 'capacity', 'category',
  'cease', 'challenge', 'channel', 'chapter', 'chart', 'circumstance', 'cite', 'civil',
  'clarify', 'classic', 'clause', 'coherent', 'coincide', 'collapse', 'colleague',
  'commence', 'comment', 'commission', 'commit', 'commodity', 'communicate', 'community',
  'compatible', 'compensate', 'compile', 'complement', 'complex', 'component', 'compound',
  'comprehensive', 'comprise', 'compute', 'conceive', 'concentrate', 'concept', 'conclude',
  'concurrent', 'conduct', 'confer', 'confine', 'confirm', 'conflict', 'conform',
  'consent', 'consequent', 'considerable', 'consist', 'constant', 'constitute', 'constrain',
  'construct', 'consult', 'consume', 'contact', 'contemporary', 'context', 'contract',
  'contradict', 'contrary', 'contrast', 'contribute', 'controversy', 'convene', 'convention',
  'converse', 'convert', 'convince', 'cooperate', 'coordinate', 'core', 'corporate',
  'correspond', 'couple', 'create', 'credit', 'criteria', 'crucial', 'culture', 'currency',
  // ... (실제로는 1000개)
]);

/**
 * 단어 중요도 계산
 */
export function calculateWordImportance(
  word: string,
  contextScore: number = 0,
  isPro: boolean = false
): WordImportance {
  const normalizedWord = word.toLowerCase().trim();

  // 1. COCA 빈도 점수 (40점)
  const cocaScore = calculateCOCAScore(normalizedWord);

  // 2. Academic Word List 점수 (30점)
  const awlScore = ACADEMIC_WORD_LIST.has(normalizedWord) ? 30 : 0;

  // 3. 토익/토플 점수 (20점)
  const testScore = TOEIC_TOEFL_WORDS.has(normalizedWord) ? 20 : 0;

  // 4. Gemini 문맥 점수 (10점, Pro만)
  const finalContextScore = isPro ? Math.min(10, Math.max(0, contextScore)) : 0;

  // 총점 계산
  const totalScore = cocaScore + awlScore + testScore + finalContextScore;

  logger.debug('Word importance calculated', {
    word,
    cocaScore,
    awlScore,
    testScore,
    contextScore: finalContextScore,
    totalScore,
  });

  return {
    word,
    normalizedWord,
    cocaScore,
    awlScore,
    testScore,
    contextScore: finalContextScore,
    totalScore,
  };
}

/**
 * COCA 빈도 점수 계산 (40점 만점)
 *
 * 빈도 순위에 따른 점수 배분:
 * - Top 1000: 40점
 * - Top 2000: 30점
 * - Top 3000: 20점
 * - Top 5000: 10점
 * - 그 외: 0점
 */
function calculateCOCAScore(normalizedWord: string): number {
  // 실제로는 COCA 빈도 데이터베이스에서 순위를 조회
  // 여기서는 간단히 Top 5000에 포함 여부만 확인
  if (COCA_TOP_5000.has(normalizedWord)) {
    // 실제 구현에서는 순위에 따라 점수 차등 부여
    return 40;
  }

  return 0;
}

/**
 * 여러 단어의 중요도를 배치로 계산
 */
export function calculateBatchImportance(
  words: string[],
  contextScores: Map<string, number> = new Map(),
  isPro: boolean = false
): WordImportance[] {
  return words.map((word) => {
    const contextScore = contextScores.get(word.toLowerCase()) || 0;
    return calculateWordImportance(word, contextScore, isPro);
  });
}

/**
 * 중요도 점수로 단어 필터링
 * @param words 단어 목록
 * @param minScore 최소 점수 (기본: 30)
 */
export function filterByImportance(
  words: WordImportance[],
  minScore: number = 30
): WordImportance[] {
  return words.filter((word) => word.totalScore >= minScore);
}

/**
 * 중요도 점수로 단어 정렬 (내림차순)
 */
export function sortByImportance(words: WordImportance[]): WordImportance[] {
  return [...words].sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * 학습 추천 단어 추출
 * @param words 단어 목록
 * @param limit 최대 개수 (기본: 15)
 * @param minScore 최소 점수 (기본: 30)
 */
export function getRecommendedWords(
  words: string[],
  limit: number = 15,
  minScore: number = 30,
  isPro: boolean = false
): WordImportance[] {
  const importance = calculateBatchImportance(words, new Map(), isPro);
  const filtered = filterByImportance(importance, minScore);
  const sorted = sortByImportance(filtered);
  return sorted.slice(0, limit);
}
