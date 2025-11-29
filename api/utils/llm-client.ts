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
 * LLM API Test Function
 * @param count Number of items to request
 * @returns Generated text from Gemini
 */
export async function llm_api_test(count: number): Promise<string> {
    // Load environment variables
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
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
        const timeoutId = setTimeout(() => controller.abort(), 10000);

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
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
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

    const request: GeminiRequest = {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }],
            },
        ],
        generationConfig: {
            temperature: 0.3,
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

        const keywords = text.split(',').map(k => k.trim()).filter(k => k.length > 0);
        return keywords;
    } catch (error) {
        console.error('Keyword extraction error:', error);
        return ['핵심 내용', '발표 주제', '주요 안건'];
    }
}

interface MeetingAnalysisResult {
    keyword: string;
    category: '리서치' | '아이디어' | '개발' | '디자인' | '일반';
    summary: string;
    isNewTopic: boolean;
    relatedTopicIndex?: number;
}

/**
 * Analyze meeting content and extract keyword, category
 * @param transcript STT recognized meeting content
 * @param existingTopics Existing node topics for duplicate prevention
 * @returns Analysis result with keyword, category, summary
 */
export async function analyzeMeetingContent(
    transcript: string,
    existingTopics: string[]
): Promise<MeetingAnalysisResult> {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }

    const existingTopicsText = existingTopics.length > 0 
        ? `기존 주제들: ${existingTopics.join(', ')}` 
        : '기존 주제 없음';

    const prompt = `
당신은 회의 내용을 분석하는 AI입니다. 다음 회의 발언을 분석해서 JSON 형식으로 결과를 반환하세요.

[회의 발언]
"${transcript}"

[${existingTopicsText}]

분석 기준:
1. keyword: 이 발언의 핵심 키워드 (2~6단어, 명사형)
2. category: 다음 중 하나 선택 - "리서치", "아이디어", "개발", "디자인", "일반"
   - 리서치: 조사, 분석, 데이터, 사용자 연구 관련
   - 아이디어: 새로운 제안, 기획, 컨셉 관련
   - 개발: 기술, 구현, 코딩, 시스템 관련
   - 디자인: UI/UX, 시각, 레이아웃 관련
   - 일반: 위에 해당하지 않는 일반적인 논의
3. summary: 한 문장으로 요약 (15자 이내)
4. isNewTopic: 기존 주제와 다른 새로운 주제인지 (true/false)
5. relatedTopicIndex: 기존 주제와 관련있다면 해당 인덱스 (0부터 시작), 없으면 생략

오직 JSON만 출력하세요. 다른 설명 없이 JSON만:
{"keyword": "...", "category": "...", "summary": "...", "isNewTopic": true/false, "relatedTopicIndex": 숫자 또는 null}
`;

    const request: GeminiRequest = {
        contents: [
            {
                role: 'user',
                parts: [{ text: prompt }],
            },
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 300,
        },
    };

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
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

        // JSON 파싱
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Failed to parse JSON from response');
        }

        const result = JSON.parse(jsonMatch[0]);
        
        // 카테고리 유효성 검사
        const validCategories = ['리서치', '아이디어', '개발', '디자인', '일반'];
        if (!validCategories.includes(result.category)) {
            result.category = '일반';
        }

        return {
            keyword: result.keyword || transcript.substring(0, 20),
            category: result.category,
            summary: result.summary || transcript.substring(0, 15),
            isNewTopic: result.isNewTopic !== false,
            relatedTopicIndex: result.relatedTopicIndex ?? undefined,
        };
    } catch (error) {
        console.error('Meeting analysis error:', error);
        // 폴백: 기본값 반환
        return {
            keyword: transcript.substring(0, 20).trim(),
            category: '일반',
            summary: transcript.substring(0, 15).trim(),
            isNewTopic: true,
        };
    }
}
