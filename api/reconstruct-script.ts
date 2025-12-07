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
  // CORS 설정 (기존과 동일)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
    const apiKey = process.env.GEMINI_API_KEY;

    const { script, skippedRanges, currentIndex } = req.body as ReconstructRequest;

    if (!script || !skippedRanges) return res.status(400).json({ error: 'Missing' });

    // 1. 건너뛴 내용 추출
    const skippedTexts = skippedRanges.slice(0, 5).map(r => 
      script.slice(Math.max(0, r.start), Math.min(script.length, r.end)).trim()
    ).filter(t => t.length > 0);
    const skippedContent = skippedTexts.join(' ... ');

    if (!skippedContent) return res.status(200).json({ reconstructed: '', skipped: true });

    // 2. 문맥 추출
    const currentReadingContext = script.slice(currentIndex, Math.min(script.length, currentIndex + 300)).trim();
    const prevContext = script.slice(Math.max(0, currentIndex - 300), currentIndex).trim();

    // 🔥 [프롬프트 수정] "실수 인정 금지" 및 "자연스러운 연결" 강조
    const prompt = `
당신은 노련한 전문 발표자입니다. 원고의 일부 내용을 건너뛰고 다음 내용을 읽고 있습니다.
건너뛴 내용(Target)을 **마치 원래 지금 말하려고 계획했던 부연 설명인 것처럼** 자연스럽게 한 문장으로 언급해야 합니다.

[데이터]
1. 🔴 복구할 내용 (Target): "${skippedContent}"
2. 🟢 현재 읽고 있는 내용 (Current): "${currentReadingContext}"
3. 🟡 직전에 읽은 내용 (Previous): "${prevContext}"

[핵심 전략: 실수 감추기]
청중은 당신이 실수했다는 것을 몰라야 합니다. 절대 사과하거나 당황하지 마세요.
마치 "이 점을 강조하고 싶어서 지금 말하는 것"처럼 연기하세요.

[작성 규칙]
1. **금지어:** "놓쳤는데", "빠뜨렸는데", "실수했는데", "아,", "죄송합니다만" 같은 표현 **절대 금지**.
2. **연결어 추천:** 
   - "덧붙이자면,"
   - "이와 관련해 한 가지 더 말씀드리면,"
   - "특히 강조하고 싶은 점은,"
   - "물론,"
   - 또는 접속사 없이 자연스럽게 문장으로 시작.
3. **중복 회피:** '복구할 내용'이 '현재 읽고 있는 내용'에 이미 포함되어 있다면 **SKIP** 출력.
4. **어조:** 자신감 있고 정중한 '해요체' 또는 '하십시오체' (발표 톤앤매너 유지).
5. **길이:** 30~50자 내외의 간결한 1문장.

[출력 예시]
- 상황: '준비 과정이 힘들었다'는 내용을 건너뜀.
- (X) "아 제가 놓쳤는데 준비가 힘들었습니다." (실수 티냄 -> 탈락)
- (O) "물론, 그 준비 과정이 순탄치만은 않았다는 점도 말씀드리고 싶군요." (자연스러움 -> 합격)
`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4, // 적당한 창의성 + 문맥 유지
        maxOutputTokens: 100,
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

    if (!response.ok) return res.status(200).json({ reconstructed: '', skipped: true });

    const data = await response.json();
    let reconstructed = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    reconstructed = reconstructed.replace(/^["']|["']$/g, '');

    // AI가 SKIP 하라고 했거나, 빈 내용이면
    if (!reconstructed || reconstructed.toUpperCase().includes('SKIP')) {
      return res.status(200).json({ reconstructed: '', skipped: true });
    }

    return res.status(200).json({ reconstructed }); 
  } catch (error) {
    console.error(error);
    return res.status(200).json({ reconstructed: '', skipped: true });
  }
}