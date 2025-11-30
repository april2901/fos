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

    // 누락된 실제 텍스트 추출
    const skippedTexts = skippedRanges.slice(0, 3).map(r => {
      const text = script.slice(Math.max(0, r.start), Math.min(script.length, r.end));
      return text.trim();
    }).filter(t => t.length > 0);

    const skippedContent = skippedTexts.join(' ... ');

    // 현재 위치에서 1~2문장 뒤 찾기 (삽입 위치 계산)
    const afterCurrent = script.slice(currentIndex);
    const sentenceEndRegex = /[.!?]/g;
    let sentenceCount = 0;
    let insertOffset = 0;
    let match;
    
    while ((match = sentenceEndRegex.exec(afterCurrent)) !== null) {
      sentenceCount++;
      if (sentenceCount >= 1) { // 1문장 뒤
        insertOffset = match.index + 1;
        break;
      }
    }
    
    // 삽입 위치가 없으면 현재 위치 + 50자 정도
    if (insertOffset === 0) {
      insertOffset = Math.min(50, afterCurrent.length);
    }
    
    const insertIndex = currentIndex + insertOffset;

    // 삽입 지점 앞뒤 문맥
    const beforeInsert = script.slice(Math.max(0, insertIndex - 100), insertIndex).trim();
    const afterInsert = script.slice(insertIndex, Math.min(script.length, insertIndex + 150)).trim();

    const prompt = `당신은 발표 원고 편집 AI입니다. 발표자가 일부 내용을 건너뛰었습니다.

[건너뛴 내용]
"${skippedContent}"

[삽입 지점 앞 문맥]
"${beforeInsert}"

[삽입 지점 뒤 문맥]  
"${afterInsert}"

위에서 건너뛴 내용 중, 앞뒤 문맥에 이미 포함되어 있거나 유사한 내용은 제외하고, 새롭게 언급해야 할 핵심 정보만 추출하여 1문장으로 작성하세요.

규칙:
- 반드시 1문장만 출력 (30~60자)
- 앞뒤 문맥과 중복되는 단어나 표현은 절대 사용하지 않기
- 건너뛴 내용에서 앞뒤에 없는 새로운 정보만 간결하게 요약
- "참고로", "덧붙이자면", "한 가지 더" 같은 자연스러운 연결어 사용
- 발표 구어체 유지
- 추가 설명 없이 문장만 출력

만약 건너뛴 내용이 앞뒤 문맥과 거의 동일하다면, "SKIP"만 출력하세요.`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 200,
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
    const reconstructed = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    // 중복으로 인해 SKIP 응답이 왔거나 빈 응답인 경우
    if (!reconstructed || reconstructed.toUpperCase() === 'SKIP') {
      return res.status(200).json({ 
        reconstructed: '',
        insertIndex: insertIndex,
        skipped: true // 프론트엔드에서 처리용
      });
    }

    return res.status(200).json({ 
      reconstructed: reconstructed,
      insertIndex: insertIndex
    });
  } catch (error) {
    console.error('Reconstruct error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
