/**
 * Mobile Quiz Service
 * URL Hash 기반 모바일 퀴즈 링크 생성 서비스
 */

import type { WordEntry, ReviewState } from '@catchvoca/types';
import LZString from 'lz-string';

/**
 * 퀴즈용 압축된 단어 데이터 인터페이스
 */
export interface CompressedWordData {
  w: string; // word
  d: string[]; // definitions
  p?: string; // phonetic
  a?: string; // audioUrl
}

/**
 * 모바일 퀴즈 링크 생성 옵션
 */
export interface MobileQuizLinkOptions {
  /** 퀴즈에 포함할 최대 단어 수 (기본: 20) */
  maxWords?: number;

  /** 복습 우선순위 적용 여부 (기본: true) */
  prioritizeDue?: boolean;

  /** 최근 추가된 단어 포함 여부 (기본: true) */
  includeRecent?: boolean;

  /** PWA 앱 URL (기본: github pages) */
  pwaUrl?: string;
}

/**
 * 단어 및 복습 상태를 압축된 포맷으로 변환
 */
export function compressWordData(
  words: WordEntry[]
): CompressedWordData[] {
  return words.map((word) => {
    const compressed: CompressedWordData = {
      w: word.word,
      d: word.definitions || ['정의 없음'],
    };

    // 선택 필드만 포함 (압축 효율)
    if (word.phonetic) {
      compressed.p = word.phonetic;
    }
    if (word.audioUrl) {
      compressed.a = word.audioUrl;
    }

    return compressed;
  });
}

/**
 * 압축된 데이터를 URL 해시로 인코딩
 */
export function encodeToUrlHash(data: CompressedWordData[]): string {
  const jsonString = JSON.stringify(data);
  const compressed = LZString.compressToEncodedURIComponent(jsonString);
  return compressed;
}

/**
 * URL 해시에서 단어 데이터 디코딩
 */
export function decodeFromUrlHash(hash: string): CompressedWordData[] | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(hash);
    if (!decompressed) {
      return null;
    }

    const data = JSON.parse(decompressed) as CompressedWordData[];
    return data;
  } catch (error) {
    console.error('[MobileQuizService] Failed to decode URL hash:', error);
    return null;
  }
}

/**
 * 복습 우선순위에 따라 단어 정렬
 * 1순위: 복습 예정 단어 (nextReviewAt이 현재보다 이전)
 * 2순위: easeFactor가 낮은 단어 (어려운 단어)
 * 3순위: 최근 추가된 단어
 */
export function sortWordsByPriority(
  words: WordEntry[],
  reviewStates: Map<string, ReviewState>,
  options: MobileQuizLinkOptions = {}
): WordEntry[] {
  const { prioritizeDue = true, includeRecent = true } = options;
  const now = Date.now();

  return words.sort((a, b) => {
    const stateA = reviewStates.get(a.id);
    const stateB = reviewStates.get(b.id);

    // 1순위: 복습 예정 단어
    if (prioritizeDue && stateA && stateB) {
      const isDueA = stateA.nextReviewAt <= now;
      const isDueB = stateB.nextReviewAt <= now;

      if (isDueA !== isDueB) {
        return isDueA ? -1 : 1; // 복습 예정 단어 우선
      }

      // 같은 복습 상태면 easeFactor 낮은 순 (어려운 단어 우선)
      if (isDueA && isDueB) {
        return stateA.easeFactor - stateB.easeFactor;
      }
    }

    // 2순위: 최근 추가된 단어
    if (includeRecent) {
      return b.createdAt - a.createdAt; // 최신순
    }

    return 0;
  });
}

/**
 * 모바일 퀴즈 링크 생성
 * @returns PWA URL with compressed word data in hash
 */
export async function generateMobileQuizLink(
  words: WordEntry[],
  reviewStates: Map<string, ReviewState>,
  options: MobileQuizLinkOptions = {}
): Promise<{
  url: string;
  wordCount: number;
  compressedSize: number;
  estimatedUrlLength: number;
}> {
  const {
    maxWords = 20,
    pwaUrl = 'https://YOUR_GITHUB_USERNAME.github.io/catchvoca-quiz/',
  } = options;

  // 1. 단어 정렬 및 필터링
  const sortedWords = sortWordsByPriority(words, reviewStates, options);
  const selectedWords = sortedWords.slice(0, maxWords);

  // 2. 데이터 압축
  const compressedData = compressWordData(selectedWords);
  const urlHash = encodeToUrlHash(compressedData);

  // 3. URL 생성
  const fullUrl = `${pwaUrl}#${urlHash}`;

  return {
    url: fullUrl,
    wordCount: selectedWords.length,
    compressedSize: urlHash.length,
    estimatedUrlLength: fullUrl.length,
  };
}

/**
 * URL 길이 제한 확인 (대부분의 브라우저는 2048자 제한)
 */
export function isUrlSafe(url: string): {
  safe: boolean;
  length: number;
  maxLength: number;
} {
  const MAX_URL_LENGTH = 2048;
  const length = url.length;

  return {
    safe: length <= MAX_URL_LENGTH,
    length,
    maxLength: MAX_URL_LENGTH,
  };
}

/**
 * 압축 효율 계산
 */
export function calculateCompressionRatio(
  originalData: CompressedWordData[],
  compressedHash: string
): {
  originalSize: number;
  compressedSize: number;
  ratio: number;
} {
  const originalSize = JSON.stringify(originalData).length;
  const compressedSize = compressedHash.length;
  const ratio = compressedSize / originalSize;

  return {
    originalSize,
    compressedSize,
    ratio: Math.round(ratio * 100) / 100,
  };
}
