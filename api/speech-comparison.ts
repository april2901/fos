import { VercelRequest, VercelResponse } from '@vercel/node';

interface SpeechComparisonRequest {
    spokenText: string;
    scriptText: string;
    lastMatchedIndex: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS handling
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
        const { spokenText, scriptText, lastMatchedIndex } = req.body as SpeechComparisonRequest;

        if (!spokenText || !scriptText) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 텍스트 정규화 함수
        const normalizeText = (text: string) => {
            return text.toLowerCase()
                .replace(/\s+/g, ' ')  // 여러 공백을 하나로
                .replace(/[.,!?]/g, '') // 문장부호 제거
                .trim();
        };

        const spoken = normalizeText(spokenText);
        const script = normalizeText(scriptText);

        // 최근 발화된 단어들로 매칭 (마지막 10단어)
        const spokenWords = spoken.split(' ');
        const searchPhrase = spokenWords.slice(-10).join(' ');

        if (searchPhrase.length < 3) {
            return res.status(200).json({
                currentMatchedIndex: lastMatchedIndex || 0,
                isCorrect: false,
                skippedParts: [],
            });
        }

        // 현재 위치 근처에서 먼저 검색 (± 500자)
        const currentIndex = lastMatchedIndex || 0;
        const searchStart = Math.max(0, currentIndex - 500);
        const searchEnd = Math.min(script.length, currentIndex + 1000);
        const nearbyScript = script.substring(searchStart, searchEnd);

        let matchIndex = nearbyScript.indexOf(searchPhrase);
        let absoluteIndex = currentIndex;

        if (matchIndex !== -1) {
            // 근처에서 찾음
            absoluteIndex = searchStart + matchIndex + searchPhrase.length;
            console.log('✅ 매칭 성공 (근처):', absoluteIndex);
        } else {
            // 전체 스크립트에서 검색
            matchIndex = script.indexOf(searchPhrase);
            if (matchIndex !== -1) {
                absoluteIndex = matchIndex + searchPhrase.length;
                console.log('✅ 전체 매칭:', absoluteIndex);
            } else {
                // 단어 단위로 부분 매칭 시도
                for (let i = spokenWords.length - 1; i >= Math.max(0, spokenWords.length - 5); i--) {
                    const partialPhrase = spokenWords.slice(i).join(' ');
                    matchIndex = script.indexOf(partialPhrase);
                    if (matchIndex !== -1) {
                        absoluteIndex = matchIndex + partialPhrase.length;
                        console.log('⚠️ 부분 매칭:', absoluteIndex);
                        break;
                    }
                }
            }
        }

        return res.status(200).json({
            currentMatchedIndex: absoluteIndex,
            isCorrect: matchIndex !== -1,
            skippedParts: [],
        });
    } catch (error) {
        console.error('Speech comparison error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
