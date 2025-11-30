import { VercelRequest, VercelResponse } from '@vercel/node';

interface SpeechComparisonRequest {
    spokenText: string;
    scriptText: string;
    lastMatchedIndex: number;
}

// 텍스트 정규화 (공백, 문장부호 제거, 소문자화)
function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[\s\n\r]+/g, '') // 모든 공백 제거
        .replace(/[.,!?;:'"「」『』【】\-–—…·()（）\[\]~@#$%^&*+=<>{}|\\\/]/g, ''); // 문장부호 제거
}

// 한글 자모 분리 (더 정확한 매칭을 위해)
function decomposeHangul(text: string): string {
    const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

    let result = '';
    for (const char of text) {
        const code = char.charCodeAt(0);
        if (code >= 0xAC00 && code <= 0xD7A3) {
            const offset = code - 0xAC00;
            const cho = Math.floor(offset / 588);
            const jung = Math.floor((offset % 588) / 28);
            const jong = offset % 28;
            result += CHO[cho] + JUNG[jung] + JONG[jong];
        } else {
            result += char;
        }
    }
    return result;
}

// 두 문자열의 공통 부분문자열 찾기 (LCS 기반) - 모든 매칭 반환
function findAllCommonSubstrings(s1: string, s2: string, minLength: number = 3): Array<{ start: number; length: number }> {
    if (s1.length === 0 || s2.length === 0) return [];

    const m = s1.length;
    const n = s2.length;
    const matches: Array<{ start: number; length: number }> = [];

    // DP 테이블
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1[i - 1] === s2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
        }
    }

    // 매칭 추출 (끝 위치 기준)
    for (let j = 1; j <= n; j++) {
        let maxLen = 0;
        for (let i = 1; i <= m; i++) {
            if (dp[i][j] > maxLen) {
                maxLen = dp[i][j];
            }
        }
        if (maxLen >= minLength) {
            matches.push({ start: j - maxLen, length: maxLen });
        }
    }

    return matches;
}

// 원본 텍스트에서 정규화된 위치에 해당하는 원본 위치 찾기
function findOriginalIndex(original: string, normalizedIndex: number, returnEndPosition: boolean = false): number {
    let normalizedCount = 0;
    const regex = /[\s\n\r.,!?;:'"「」『』【】\-\u2013\u2014\u2026\u00b7()（）\[\]~@#$%^&*+=<>{}|\\\/]/;

    for (let i = 0; i < original.length; i++) {
        const char = original[i];
        if (!regex.test(char)) {
            if (normalizedCount === normalizedIndex) {
                return returnEndPosition ? i + 1 : i;
            }
            normalizedCount++;
        }
    }

    return original.length;
}

// 슬라이딩 윈도우로 최적 매칭 위치 찾기
function findBestMatchPosition(spoken: string, script: string, searchStart: number, searchEnd: number, currentNormalizedIndex: number): { index: number; length: number; matchStart: number } | null {
    const searchScript = script.slice(searchStart, searchEnd);
    
    // 1. 정확한 부분 문자열 매칭 (끝부분부터 여러 길이 시도)
    // 현재 위치에서 가장 가까운 매칭을 찾기 위해 모든 occurrence를 찾음
    for (let len = Math.min(30, spoken.length); len >= 2; len--) {
        const searchPhrase = spoken.slice(-len);
        
        // 모든 매칭 위치 찾기
        let idx = -1;
        let bestMatch: { idx: number; distance: number } | null = null;
        let searchFrom = 0;
        
        while ((idx = searchScript.indexOf(searchPhrase, searchFrom)) !== -1) {
            const matchStartIndex = searchStart + idx;
            const matchEndIndex = searchStart + idx + len;
            
            // 현재 위치보다 앞이어도, 현재 위치 근처(5자 이내)면 허용 (문장 끝 인식용)
            if (matchEndIndex > currentNormalizedIndex || (matchEndIndex >= currentNormalizedIndex - 5 && len >= 3)) {
                // 현재 위치에서의 거리 계산 (가장 가까운 것 선택)
                const distance = Math.abs(matchStartIndex - currentNormalizedIndex);
                
                if (!bestMatch || distance < bestMatch.distance) {
                    bestMatch = { idx, distance };
                }
            }
            searchFrom = idx + 1;
        }
        
        if (bestMatch) {
            const matchStartIndex = searchStart + bestMatch.idx;
            const matchEndIndex = matchStartIndex + len;
            return { index: matchEndIndex, length: len, matchStart: matchStartIndex };
        }
    }

    // 2. 중간 부분에서도 매칭 시도 (더 적극적으로)
    // 현재 위치에서 가장 가까운 매칭을 우선
    const spokenLen = spoken.length;
    let closestMiddleMatch: { index: number; length: number; matchStart: number; distance: number } | null = null;
    
    for (let offset = 0; offset < spokenLen - 3; offset += 2) {
        for (let len = Math.min(20, spokenLen - offset); len >= 3; len--) {
            const searchPhrase = spoken.slice(offset, offset + len);
            
            let idx = -1;
            let searchFrom = 0;
            
            while ((idx = searchScript.indexOf(searchPhrase, searchFrom)) !== -1) {
                const matchStartIndex = searchStart + idx;
                const matchEndIndex = searchStart + idx + len;
                
                // 현재 위치보다 앞으로 가는 것 방지 (단, 문장 끝 근처는 허용)
                if (matchEndIndex > currentNormalizedIndex - 10) {
                    // 이 매칭 이후의 음성이 스크립트와 얼마나 일치하는지 확인
                    const scriptAfterMatch = script.slice(matchEndIndex, matchEndIndex + 15);
                    const spokenAfterMatch = spoken.slice(offset + len, offset + len + 15);
                    
                    // 간단한 유사도 체크
                    let matchCount = 0;
                    const checkLen = Math.min(scriptAfterMatch.length, spokenAfterMatch.length, 8);
                    for (let i = 0; i < checkLen; i++) {
                        if (scriptAfterMatch[i] === spokenAfterMatch[i]) matchCount++;
                    }
                    
                    // 유사도가 높거나, 긴 매칭이면 수락
                    if (matchCount >= checkLen * 0.4 || len >= 6) {
                        const distance = Math.abs(matchStartIndex - currentNormalizedIndex);
                        if (!closestMiddleMatch || distance < closestMiddleMatch.distance) {
                            closestMiddleMatch = { index: matchEndIndex, length: len, matchStart: matchStartIndex, distance };
                        }
                    }
                }
                searchFrom = idx + 1;
            }
        }
    }
    
    if (closestMiddleMatch) {
        return { index: closestMiddleMatch.index, length: closestMiddleMatch.length, matchStart: closestMiddleMatch.matchStart };
    }

    // 3. 자모 분리 매칭 (마지막 수단)
    const decomposedSpoken = decomposeHangul(spoken.slice(-12));
    const decomposedScript = decomposeHangul(searchScript.slice(0, 150));
    
    for (let len = Math.min(25, decomposedSpoken.length); len >= 6; len--) {
        const searchPhrase = decomposedSpoken.slice(-len);
        const idx = decomposedScript.indexOf(searchPhrase);
        if (idx !== -1) {
            // 자모 인덱스를 원래 인덱스로 변환 (대략적)
            const approxIdx = Math.floor(idx / 2.5);
            const approxLen = Math.floor(len / 2.5);
            const matchStartIndex = searchStart + approxIdx;
            const matchEndIndex = searchStart + approxIdx + approxLen;
            if (matchEndIndex >= currentNormalizedIndex - 5) {
                return { index: matchEndIndex, length: approxLen, matchStart: matchStartIndex };
            }
        }
    }

    return null;
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

        // 정규화
        const normalizedSpoken = normalizeText(spokenText);
        const normalizedScript = normalizeText(scriptText);

        if (normalizedSpoken.length < 2) {
            return res.status(200).json({
                currentMatchedIndex: lastMatchedIndex || 0,
                isCorrect: false,
                confidence: 0,
            });
        }

        // 현재 위치의 정규화된 인덱스 계산
        let currentNormalizedIndex = 0;
        const lastIdx = Math.min(lastMatchedIndex || 0, scriptText.length);
        const regex = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]~@#$%^&*+=<>{}|\\\/]/;
        for (let i = 0; i < lastIdx; i++) {
            if (!regex.test(scriptText[i])) {
                currentNormalizedIndex++;
            }
        }

        // 검색 범위 설정 (더 넓게)
        const searchStart = Math.max(0, currentNormalizedIndex - 30);
        const searchEnd = Math.min(normalizedScript.length, currentNormalizedIndex + 600);

        // 새로운 매칭 함수 사용 (currentNormalizedIndex 전달)
        const matchResult = findBestMatchPosition(normalizedSpoken, normalizedScript, searchStart, searchEnd, currentNormalizedIndex);

        if (matchResult && matchResult.index >= currentNormalizedIndex) {
            // 원본 인덱스로 변환 - 매칭된 끝 위치의 다음 문자
            const originalIndex = findOriginalIndex(scriptText, matchResult.index, true);

            // 현재 위치보다 앞으로 가지 않으면 업데이트 (같은 위치도 허용하여 문장 끝 인식)
            if (originalIndex >= (lastMatchedIndex || 0)) {
                // 스킵된 부분 계산 - matchStart를 직접 사용
                const skippedStartOriginal = lastMatchedIndex || 0;
                const matchStartOriginal = findOriginalIndex(scriptText, matchResult.matchStart, false);

                // 스킵 여부: 매칭 시작 위치가 이전 위치보다 10자 이상 뒤에 있을 때만
                // 그리고 스킵 범위의 끝은 매칭이 시작된 위치까지만 (매칭된 부분은 제외)
                const hasSkipped = matchStartOriginal > skippedStartOriginal + 10;

                console.log('Match found:', {
                    spokenText: spokenText.slice(-30),
                    matchResult,
                    currentNormalizedIndex,
                    matchStartOriginal,
                    originalIndex,
                    lastMatchedIndex,
                    hasSkipped,
                    skippedRange: hasSkipped ? { start: skippedStartOriginal, end: matchStartOriginal } : null
                });

                return res.status(200).json({
                    currentMatchedIndex: originalIndex,
                    isCorrect: true,
                    confidence: Math.min(matchResult.length / 10, 1),
                    skippedRange: hasSkipped ? { start: skippedStartOriginal, end: matchStartOriginal } : null,
                });
            }
        }

        // 대안: LCS 기반 매칭 시도
        const matches = findAllCommonSubstrings(
            normalizedSpoken.slice(-20), 
            normalizedScript.slice(searchStart, Math.min(searchEnd, searchStart + 200)),
            3
        );

        if (matches.length > 0) {
            // 가장 긴 매칭 또는 가장 뒤에 있는 매칭 선택
            const bestMatch = matches.reduce((best, curr) => {
                if (curr.length > best.length) return curr;
                if (curr.length === best.length && curr.start > best.start) return curr;
                return best;
            }, matches[0]);

            const normalizedMatchEnd = searchStart + bestMatch.start + bestMatch.length;
            const originalIndex = findOriginalIndex(scriptText, normalizedMatchEnd, true);

            if (originalIndex >= (lastMatchedIndex || 0)) {
                const matchStartOriginal = findOriginalIndex(scriptText, searchStart + bestMatch.start, false);
                const hasSkipped = matchStartOriginal > (lastMatchedIndex || 0) + 10;

                return res.status(200).json({
                    currentMatchedIndex: originalIndex,
                    isCorrect: true,
                    confidence: bestMatch.length / 10,
                    skippedRange: hasSkipped ? { start: lastMatchedIndex || 0, end: matchStartOriginal } : null,
                });
            }
        }

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
