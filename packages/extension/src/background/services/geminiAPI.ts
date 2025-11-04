/**
 * Gemini API Service
 * Google Gemini 1.5 Flash를 사용한 웹페이지 분석
 */

import { Logger, NetworkError, withRetry } from '@catchvoca/core';
import type {
  GeminiAnalysisRequest,
  GeminiAnalysisResponse,
  RecommendedWord,
} from '@catchvoca/types';

const logger = new Logger('GeminiAPI');

// Gemini API 설정
const GEMINI_API_URL = import.meta.env.VITE_GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * chrome.storage에서 Gemini API 키 가져오기
 */
async function getGeminiApiKey(): Promise<string> {
  try {
    const result = await chrome.storage.sync.get('settings');
    const apiKey = result.settings?.geminiApiKey || '';

    // 개발 모드: 환경 변수 fallback
    if (!apiKey && import.meta.env.DEV) {
      const devKey = import.meta.env.VITE_GEMINI_API_KEY || '';
      if (devKey) {
        logger.info('Using development API key from environment variable');
        return devKey;
      }
    }

    return apiKey;
  } catch (error) {
    logger.error('Failed to load Gemini API key from storage', error);

    // 개발 모드: 환경 변수 fallback
    if (import.meta.env.DEV) {
      return import.meta.env.VITE_GEMINI_API_KEY || '';
    }

    return '';
  }
}

/**
 * Gemini API로 웹페이지 분석 요청
 */
export async function analyzePageWithGemini(
  request: GeminiAnalysisRequest
): Promise<GeminiAnalysisResponse> {
  logger.info('Analyzing page with Gemini', {
    url: request.pageUrl,
    contentLength: request.pageContent.length,
    userWordsCount: request.userWords.length,
  });

  // API 키 가져오기
  const apiKey = await getGeminiApiKey();

  if (!apiKey) {
    logger.warn('Gemini API key not found');
    throw new Error('Gemini API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.');
  }

  return withRetry(
    async () => {
      const prompt = buildAnalysisPrompt(request);

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        throw new NetworkError(
          `Gemini API returned ${response.status}`,
          response.status,
          GEMINI_API_URL
        );
      }

      const data = await response.json();
      return parseGeminiResponse(data);
    },
    { maxAttempts: 2, initialDelay: 1000 }
  );
}

/**
 * Gemini API 프롬프트 생성
 */
function buildAnalysisPrompt(request: GeminiAnalysisRequest): string {
  return `
You are an English vocabulary learning assistant. Analyze the following webpage content and provide:

1. A concise summary (max 500 characters) of the page content
2. Recommend 10-15 important English words that would be valuable for an ESL learner to study
3. Assess the overall difficulty level (beginner/intermediate/advanced)

**Webpage Information:**
- URL: ${request.pageUrl}
- Title: ${request.pageTitle}

**Content:**
${request.pageContent.substring(0, 5000)}

**User's Already Learned Words:**
${request.userWords.join(', ')}

**IMPORTANT:**
- Do NOT recommend words the user has already learned
- Focus on academically important words (COCA frequency, Academic Word List)
- Consider words useful for TOEIC/TOEFL exams
- For each recommended word, provide a brief reason (e.g., "Academic word", "High frequency", "TOEFL common")

**Output Format (JSON):**
{
  "summary": "Brief page summary...",
  "recommendedWords": [
    {
      "word": "example",
      "importanceScore": 85,
      "reasons": ["Academic word", "High frequency"]
    }
  ],
  "difficulty": "intermediate"
}
`.trim();
}

/**
 * Gemini API 응답 파싱
 */
function parseGeminiResponse(data: any): GeminiAnalysisResponse {
  try {
    // Gemini API 응답 구조: data.candidates[0].content.parts[0].text
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      logger.warn('Gemini API returned empty response');
      return {
        summary: '',
        recommendedWords: [],
        difficulty: 'intermediate',
      };
    }

    // JSON 추출 (마크다운 코드 블록 제거)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Failed to extract JSON from Gemini response');
      return {
        summary: text.substring(0, 500),
        recommendedWords: [],
        difficulty: 'intermediate',
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // recommendedWords 정규화
    const recommendedWords: RecommendedWord[] = (parsed.recommendedWords || []).map(
      (word: any) => ({
        word: word.word || '',
        normalizedWord: (word.word || '').toLowerCase().trim(),
        importanceScore: Math.min(100, Math.max(0, word.importanceScore || 50)),
        reasons: Array.isArray(word.reasons) ? word.reasons : [],
      })
    );

    logger.info('Gemini analysis complete', {
      recommendedWordsCount: recommendedWords.length,
      difficulty: parsed.difficulty,
    });

    return {
      summary: (parsed.summary || '').substring(0, 500),
      recommendedWords,
      difficulty: validateDifficulty(parsed.difficulty),
    };
  } catch (error) {
    logger.error('Failed to parse Gemini response', error);
    return {
      summary: '',
      recommendedWords: [],
      difficulty: 'intermediate',
    };
  }
}

/**
 * 난이도 검증
 */
function validateDifficulty(
  difficulty: string
): 'beginner' | 'intermediate' | 'advanced' {
  if (difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced') {
    return difficulty;
  }
  return 'intermediate';
}

/**
 * Gemini API 키 설정
 * @deprecated API 키는 이제 chrome.storage.sync를 통해 관리됩니다
 */
export function setGeminiAPIKey(_apiKey: string): void {
  logger.warn('setGeminiAPIKey is deprecated. Use chrome.storage.sync directly.');
}

/**
 * Gemini API 사용 가능 여부 확인
 */
export async function isGeminiAvailable(): Promise<boolean> {
  const apiKey = await getGeminiApiKey();
  return apiKey.length > 0 && apiKey !== 'YOUR_GEMINI_API_KEY';
}
