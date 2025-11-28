import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
  }>;
}

/**
 * Google Gemini API를 호출하여 누락된 부분을 재구성합니다.
 */
export async function regenerateWithLLM(
  fullScript: string,
  spokenText: string,
  skippedParts: string[]
): Promise<string> {
  // Load environment variables
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    const parentEnvPath = path.resolve(process.cwd(), '../.env.local');
    if (fs.existsSync(parentEnvPath)) {
      dotenv.config({ path: parentEnvPath });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `당신은 프레젠테이션 원고를 작성하는 전문가입니다.

[전체 원고]
${fullScript}

[발표자가 말한 부분]
${spokenText}

[발표자가 누락한 부분]
${skippedParts.join('\n')}

위의 정보를 바탕으로:
1. 발표자가 누락한 부분을 고려하여
2. 원고의 흐름과 맥락에 맞춰
3. 누락된 내용을 자연스럽게 포함하는 재구성된 원고를 작성해주세요.

재구성된 원고만 출력하고, 다른 설명은 하지 마세요.`;

  const request: GeminiRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2000,
    },
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: GeminiResponse = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || '';
  } catch (error) {
    console.error('LLM regeneration error:', error);
    throw error;
  }
}

/**
 * LLM API Test Function
 * @param count Number of items to request
 * @returns Generated text from Gemini
 */
export async function llm_api_test(count: number): Promise<string> {
  // Load environment variables
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    const parentEnvPath = path.resolve(process.cwd(), '../.env.local');
    if (fs.existsSync(parentEnvPath)) {
      dotenv.config({ path: parentEnvPath });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `메뚜기의 종류를 ${count}개 말해봐`;

  const request: GeminiRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data: GeminiResponse = await response.json();
      return data.candidates[0]?.content?.parts[0]?.text || '';
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  } catch (error) {
    console.error('LLM test error:', error);
    throw error;
  }
}

/**
 * Extract keywords from the script using Gemini
 * @param script Full presentation script
 * @returns Array of 3-5 keywords
 */
export async function extractKeywordsFromScript(script: string): Promise<string[]> {
  // Load environment variables
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else {
    const parentEnvPath = path.resolve(process.cwd(), '../.env.local');
    if (fs.existsSync(parentEnvPath)) {
      dotenv.config({ path: parentEnvPath });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const prompt = `
다음 프레젠테이션 대본에서 가장 중요한 핵심 키워드 또는 주제를 3개에서 5개 사이로 추출해줘.
결과는 오직 키워드들만 쉼표(,)로 구분해서 출력해. 다른 설명은 하지 마.

[대본]
${script.substring(0, 5000)} 
`;
  // Limit script length to avoid token limits if necessary, though Gemini has large context. 
  // 5000 chars is a safe initial limit for a summary task.

  const request: GeminiRequest = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.3, // Lower temperature for more deterministic results
      maxOutputTokens: 200,
    },
  };

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`);
    }

    const data: GeminiResponse = await response.json();
    const text = data.candidates[0]?.content?.parts[0]?.text || '';

    // Parse comma-separated keywords
    const keywords = text.split(',').map(k => k.trim()).filter(k => k.length > 0);
    return keywords;
  } catch (error) {
    console.error('Keyword extraction error:', error);
    // Fallback keywords if API fails
    return ['핵심 내용', '발표 주제', '주요 안건'];
  }
}
