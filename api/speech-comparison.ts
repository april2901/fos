import { VercelRequest, VercelResponse } from '@vercel/node';

interface SpeechComparisonRequest {
    spokenText: string;
    scriptText: string;
    lastMatchedIndex: number;
}

// 간단한 텍스트 정규화 (공백, 문장부호 제거)
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\s\n\r]+/g, '') // 모든 공백 제거
        .replace(/[.,!?;:'"「」『』【】\-–—…·()（）\[\]]/g, ''); // 문장부호 제거
}

// 두 문자열의 공통 부분문자열 찾기 (LCS 기반)
function findLongestCommonSubstring(s1: string, s2: string): { start: number; length: number } {
    if (s1.length === 0 || s2.length === 0) return { start: -1, length: 0 };

    const m = s1.length;
    const n = s2.length;

    // 메모리 효율을 위해 2행만 사용
    let prev = new Array(n + 1).fill(0);
    let curr = new Array(n + 1).fill(0);

    let maxLength = 0;
    let endIndex = -1;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                curr[j] = prev[j - 1] + 1;
                if (curr[j] > maxLength) {
                    maxLength = curr[j];
                    endIndex = j; // s2에서의 끝 위치
                }
            } else {
                curr[j] = 0;
            }
        }
        [prev, curr] = [curr, prev];
        curr.fill(0);
    }

    return { start: endIndex - maxLength, length: maxLength };
}

// 원본 텍스트에서 정규화된 위치에 해당하는 원본 위치 찾기
function findOriginalIndex(original: string, normalizedIndex: number): number {
    let normalizedCount = 0;

    for (let i = 0; i < original.length; i++) {
        const char = original[i];
        // 정규화에서 유지되는 문자인지 확인
        if (!/[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/.test(char)) {
            if (normalizedCount >= normalizedIndex) {
                return i;
            }
            normalizedCount++;
        }
    }

    return original.length;
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

        console.log('📥 요청:', {
            spokenLength: spokenText.length,
            scriptLength: scriptText.length,
            lastMatchedIndex
        });

        // 정규화
        const normalizedSpoken = normalizeText(spokenText);
        const normalizedScript = normalizeText(scriptText);

        console.log('📝 정규화된 음성:', normalizedSpoken.slice(-50));
        console.log('📜 정규화된 스크립트 (처음 100자):', normalizedScript.slice(0, 100));

        if (normalizedSpoken.length < 2) {
            return res.status(200).json({
                currentMatchedIndex: lastMatchedIndex || 0,
                isCorrect: false,
                confidence: 0,
            });
        }

        // 현재 위치 이후의 스크립트에서 검색
        const currentNormalizedIndex = (() => {
            let count = 0;
            for (let i = 0; i < Math.min(lastMatchedIndex || 0, scriptText.length); i++) {
                if (!/[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/.test(scriptText[i])) {
                    count++;
                }
            }
            return count;
        })();

        // 검색할 스크립트 범위 (현재 위치부터 + 여유분)
        const searchStart = Math.max(0, currentNormalizedIndex - 20);
        const searchScript = normalizedScript.slice(searchStart);

        // 음성의 마지막 부분으로 매칭 (다양한 길이 시도)
        let bestMatch = { index: -1, length: 0 };

        // 마지막 5~30자로 매칭 시도
        for (let len = Math.min(30, normalizedSpoken.length); len >= 3; len--) {
            const searchPhrase = normalizedSpoken.slice(-len);

            // 정확한 부분문자열 매칭
            const idx = searchScript.indexOf(searchPhrase);
            if (idx !== -1) {
                const matchEnd = searchStart + idx + len;
                if (matchEnd > bestMatch.index + bestMatch.length) {
                    bestMatch = { index: searchStart + idx, length: len };
                    console.log('✅ 정확 매칭:', {
                        searchPhrase,
                        idx,
                        matchEnd,
                        normalizedMatchEnd: matchEnd
                    });
                    break;
                }
            }
        }

        // 정확한 매칭 실패 시 LCS로 유사 매칭 시도
        if (bestMatch.index === -1) {
            const spokenEnd = normalizedSpoken.slice(-20); // 마지막 20자
            const lcsResult = findLongestCommonSubstring(spokenEnd, searchScript.slice(0, 500));

            if (lcsResult.length >= 3) {
                bestMatch = {
                    index: searchStart + lcsResult.start,
                    length: lcsResult.length
                };
                console.log('🔍 LCS 매칭:', lcsResult);
            }
        }

        if (bestMatch.index !== -1) {
            const normalizedMatchEnd = bestMatch.index + bestMatch.length;
            const originalIndex = findOriginalIndex(scriptText, normalizedMatchEnd);

            // 진행 방향으로만 (현재 위치보다 앞으로만)
            if (originalIndex > (lastMatchedIndex || 0)) {
                console.log('🎯 매칭 성공:', {
                    normalizedMatchEnd,
                    originalIndex,
                    이동거리: originalIndex - (lastMatchedIndex || 0)
                });

                return res.status(200).json({
                    currentMatchedIndex: originalIndex,
                    isCorrect: true,
                    confidence: bestMatch.length / 20, // 0~1.5 범위
                });
            }
        }

        console.log('❌ 매칭 실패 - 위치 유지');

        // 매칭 실패 시 현재 위치 유지
        return res.status(200).json({
            currentMatchedIndex: lastMatchedIndex || 0,
            isCorrect: false,
            confidence: 0,
        });

    } catch (error) {
        console.error('Speech comparison error:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}
