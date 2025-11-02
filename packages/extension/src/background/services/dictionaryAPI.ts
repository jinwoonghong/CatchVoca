/**
 * Dictionary API Service
 * 네이버 사전 API (Primary) + Free Dictionary API (Fallback)
 */

import { decodeHtmlEntities, Logger, NetworkError, withRetry } from '@catchvoca/core';
import type { LookupResult } from '@catchvoca/types';

const logger = new Logger('DictionaryAPI');

/**
 * 사전 API 조회 (네이버 Primary → Dictionary API Fallback)
 */
export async function lookupWord(word: string): Promise<LookupResult> {
  // 1. 네이버 사전 API 시도
  try {
    const naverResult = await fetchNaverDictionary(word);
    if (naverResult.definitions && naverResult.definitions.length > 0) {
      logger.info('Naver Dictionary API success');
      return naverResult;
    }
  } catch (error) {
    logger.warn('Naver Dictionary API failed:', error);
  }

  // 2. Free Dictionary API Fallback
  try {
    const dictResult = await fetchDictionaryAPI(word);
    logger.info('Dictionary API fallback success');
    return dictResult;
  } catch (error) {
    logger.warn('Dictionary API failed:', error);
  }

  // 3. 모든 API 실패 시 빈 결과 반환
  logger.warn('All dictionary APIs failed');
  return {
    definitions: [],
    phonetic: undefined,
    audioUrl: undefined,
  };
}

/**
 * 네이버 사전 API 호출 (with retry)
 */
async function fetchNaverDictionary(word: string): Promise<LookupResult> {
  const url = `https://en.dict.naver.com/api3/enko/search?query=${encodeURIComponent(word)}&m=pc&range=word`;

  return withRetry(
    async () => {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new NetworkError(
          `Naver API returned ${response.status}`,
          response.status,
          url
        );
      }

      const data = await response.json();
      return parseNaverResponse(data);
    },
    { maxAttempts: 3, initialDelay: 1000 }
  );
}

/**
 * 네이버 API 응답 파싱 (extracted for clarity)
 */
function parseNaverResponse(data: any): LookupResult {

  // 응답 파싱
  const items = data?.searchResultMap?.searchResultListMap?.WORD?.items || [];

  if (items.length === 0) {
    logger.warn('Naver API returned no items');
    return {
      definitions: [],
      phonetic: undefined,
      audioUrl: undefined,
    };
  }

  const firstItem = items[0];

  // 정의 추출
  const definitions: string[] = [];
  const meansCollector = firstItem.meansCollector || [];
  for (const collector of meansCollector) {
    const means = collector.means || [];
    for (const mean of means) {
      if (mean.value) {
        // HTML 태그 제거 및 엔티티 디코딩
        const cleanValue = decodeHtmlEntities(mean.value.replace(/<[^>]*>/g, '')).trim();
        if (cleanValue) {
          definitions.push(cleanValue);
        }
      }
    }
  }

  // 발음 기호 추출
  let phonetic: string | undefined;
  let audioUrl: string | undefined;

  if (firstItem.searchPhoneticSymbolList && Array.isArray(firstItem.searchPhoneticSymbolList)) {
    const usPhonetic = firstItem.searchPhoneticSymbolList.find((p: any) => p.symbolTypeCode === 'US');
    const phoneticItem = usPhonetic || firstItem.searchPhoneticSymbolList[0];

    if (phoneticItem) {
      phonetic = phoneticItem.symbolValue;
      audioUrl = phoneticItem.symbolFile;
    }
  }

  // Fallback: 다른 필드에서 시도
  if (!phonetic) {
    phonetic = firstItem.phoneticSymbol
      || firstItem.phonetic
      || firstItem.pronSymbol
      || firstItem.pronunciation
      || (firstItem.phonetics && firstItem.phonetics[0]?.text);
  }

  if (!audioUrl) {
    if (firstItem.phonetics && Array.isArray(firstItem.phonetics)) {
      for (const ph of firstItem.phonetics) {
        if (ph.audio || ph.audioUrl || ph.soundUrl) {
          audioUrl = ph.audio || ph.audioUrl || ph.soundUrl;
          break;
        }
      }
    }

    if (!audioUrl) {
      audioUrl = firstItem.audioUrl
        || firstItem.soundUrl
        || firstItem.mp3Url
        || firstItem.pronUrl;
    }
  }

  logger.debug('Naver API result', { phonetic, audioUrl, definitionsCount: definitions.length });

  return {
    definitions,
    phonetic,
    audioUrl,
  };
}

/**
 * Free Dictionary API 호출 (with retry)
 */
async function fetchDictionaryAPI(word: string): Promise<LookupResult> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;

  return withRetry(
    async () => {
      const response = await fetch(url);

      if (!response.ok) {
        throw new NetworkError(
          `Dictionary API returned ${response.status}`,
          response.status,
          url
        );
      }

      const data = await response.json();
      return parseDictionaryAPIResponse(data);
    },
    { maxAttempts: 3, initialDelay: 1000 }
  );
}

/**
 * Dictionary API 응답 파싱 (extracted for clarity)
 */
function parseDictionaryAPIResponse(data: any): LookupResult {

  if (!Array.isArray(data) || data.length === 0) {
    return {
      definitions: [],
      phonetic: undefined,
      audioUrl: undefined,
    };
  }

  const entry = data[0];

  // 정의 추출
  const definitions: string[] = [];
  const meanings = entry.meanings || [];
  for (const meaning of meanings) {
    const defs = meaning.definitions || [];
    for (const def of defs) {
      if (def.definition) {
        const cleanDef = decodeHtmlEntities(def.definition.replace(/<[^>]*>/g, '')).trim();
        if (cleanDef) {
          definitions.push(cleanDef);
        }
      }
    }
  }

  // 발음 기호 추출
  let phonetic = entry.phonetic;
  if (!phonetic && entry.phonetics && entry.phonetics.length > 0) {
    phonetic = entry.phonetics[0].text;
  }

  // 오디오 URL 추출
  let audioUrl: string | undefined;
  if (entry.phonetics) {
    for (const ph of entry.phonetics) {
      if (ph.audio) {
        audioUrl = ph.audio;
        break;
      }
    }
  }

  logger.debug('Dictionary API result', { phonetic, audioUrl, definitionsCount: definitions.length });

  return {
    definitions,
    phonetic,
    audioUrl,
  };
}
