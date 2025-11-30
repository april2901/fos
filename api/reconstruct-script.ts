import { VercelRequest, VercelResponse } from '@vercel/node';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

interface ReconstructRequest {
  script: string;
  skippedRanges: Array<{ start: number; end: number }>;
  currentIndex: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const { script, skippedRanges, currentIndex } = req.body as ReconstructRequest;

    if (!script || !skippedRanges || !Array.isArray(skippedRanges)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build human-friendly description of skipped parts (use up to 3 ranges)
    const rangesSummary = skippedRanges.slice(0, 3).map(r => `(${r.start}-${r.end})`).join(', ');

    // Provide context window around currentIndex
    const ctxStart = Math.max(0, currentIndex - 200);
    const ctxEnd = Math.min(script.length, currentIndex + 600);
    const contextSnippet = script.slice(ctxStart, ctxEnd);

    const prompt = `
당신은 발표자의 텔레프롬프터 보조 AI입니다.
아래는 전체 대본 일부와, 발표자가 놓친(스킵된) 구간의 문자 인덱스 목록입니다.
발표자가 현재 위치(인덱스 ${currentIndex})부터 자연스럽게 이어 말할 수 있도록, "다음 부분"을 재구성해 주세요.
재구성 문장은 자연스럽게 누락된 내용을 포함해야 하며, 발표 톤(간결하고 구어체)을 유지하세요. 
발표자가 재구성해준 문장을 그대로 읽어서 발표할 수 있는 문장을 만들어서 제시하세요.
출력은 재구성된 실제 문장 텍스트(한국어)만 반환하고, 추가 설명은 포함하지 마세요.

[누락 구간 요약]
${rangesSummary}

[현재 문맥 - 재구성에 참고할 부분, 맥락만 제공]
${contextSnippet}

요청: 발표자가 다음에 바로 말할 수 있도록, 누락된 내용을 자연스럽게 녹여낸 2~3문장(약 80~250자) 분량의 재구성된 문단을 출력하세요.
`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('Gemini error:', err);
      return res.status(500).json({ error: 'LLM API error' });
    }

    const data = await response.json();
    const reconstructed = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return res.status(200).json({ reconstructed: reconstructed.trim() });
  } catch (error) {
    console.error('Reconstruct error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
