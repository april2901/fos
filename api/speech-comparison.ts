import { VercelRequest, VercelResponse } from '@vercel/node';

interface SpeechComparisonRequest {
    spokenText: string;
    scriptText: string;
    lastMatchedIndex: number;
}

interface NormalizedScriptData {
    text: string;
    indexMap: number[];
}

// 간단한 텍스트 정규화 (공백, 문장부호 제거) - 정규식 캐싱
const NORMALIZE_REGEX = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/g;
const CHAR_CHECK_REGEX = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/;

const NORMALIZED_CACHE = new Map<string, NormalizedScriptData>();
const MAX_CACHE_SIZE = 4;

function normalizeText(text: string): string {
    return text.toLowerCase().replace(NORMALIZE_REGEX, '');
}

function normalizeScriptWithIndexMap(scriptText: string): NormalizedScriptData {
    const normalizedChars: string[] = [];
    const indexMap: number[] = [];

    for (let i = 0; i < scriptText.length; i++) {
        const char = scriptText[i];
        if (!CHAR_CHECK_REGEX.test(char)) {
            normalizedChars.push(char.toLowerCase());
            indexMap.push(i);
        }
    }

    return {
        text: normalizedChars.join(''),
        indexMap,
    };
}

function getNormalizedScriptData(scriptText: string): NormalizedScriptData {
    const cached = NORMALIZED_CACHE.get(scriptText);
    if (cached) {
        return cached;
    }

    const normalized = normalizeScriptWithIndexMap(scriptText);
    NORMALIZED_CACHE.set(scriptText, normalized);

    if (NORMALIZED_CACHE.size > MAX_CACHE_SIZE) {
        const firstKey = NORMALIZED_CACHE.keys().next().value;
        if (firstKey) {
            NORMALIZED_CACHE.delete(firstKey);
        }
    }

    return normalized;
}

function findOriginalIndexFromMap(indexMap: number[], normalizedIndex: number, fallbackLength: number): number {
    if (normalizedIndex < 0) return 0;
    if (normalizedIndex >= indexMap.length) return fallbackLength;
    return indexMap[normalizedIndex];
}

function findNormalizedIndexByOriginal(indexMap: number[], originalIndex: number): number {
    if (originalIndex <= 0 || indexMap.length === 0) return 0;

    let left = 0;
    let right = indexMap.length - 1;
    let result = indexMap.length;

    while (left <= right) {
        const mid = (left + right) >> 1;
        if (indexMap[mid] >= originalIndex) {
            result = mid;
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }

    return result;
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

        // 정규화 (script는 인덱스 매핑 포함, spoken은 간단 변환)
        const normalizedSpoken = normalizeText(spokenText);
        const { text: normalizedScript, indexMap } = getNormalizedScriptData(scriptText);

        if (normalizedSpoken.length < 2) {
            return res.status(200).json({
                currentMatchedIndex: lastMatchedIndex || 0,
                isCorrect: false,
                confidence: 0,
            });
        }

        // 현재 위치의 정규화된 인덱스 계산 (간소화)
        const lastIdx = Math.min(lastMatchedIndex || 0, scriptText.length);
        const currentNormalizedIndex = findNormalizedIndexByOriginal(indexMap, lastIdx);

        // 검색 범위: 현재 위치 앞 5자 ~ 뒤 400자
        const searchStart = Math.max(0, currentNormalizedIndex - 5);
        const searchEnd = Math.min(normalizedScript.length, currentNormalizedIndex + 400);
        const searchScript = normalizedScript.slice(searchStart, searchEnd);

        // 음성의 마지막 부분으로 빠른 매칭
        let bestMatch = { index: -1, length: 0 };

        // 마지막 2~25자로 매칭
        const maxLen = Math.min(25, normalizedSpoken.length);
        for (let len = maxLen; len >= 2; len--) {
            const searchPhrase = normalizedSpoken.slice(-len);
            const idx = searchScript.indexOf(searchPhrase);

            if (idx !== -1) {
                bestMatch = { index: searchStart + idx, length: len };
                break; // 가장 긴 매칭 찾으면 즉시 종료
            }
        }

        // 정확 매칭 실패 시 짧은 LCS
        if (bestMatch.index === -1 && normalizedSpoken.length >= 4) {
            const spokenEnd = normalizedSpoken.slice(-20);
            const lcsResult = findLongestCommonSubstring(spokenEnd, searchScript.slice(0, 250));

            if (lcsResult.length >= 3) {
                bestMatch = {
                    index: searchStart + lcsResult.start,
                    length: lcsResult.length
                };
            }
        }

        if (bestMatch.index !== -1) {
            const normalizedMatchEnd = bestMatch.index + bestMatch.length;
            const originalIndex = findOriginalIndexFromMap(indexMap, normalizedMatchEnd, scriptText.length);

            // >= 로 변경하여 문장 끝에서도 진행되도록
            if (originalIndex >= (lastMatchedIndex || 0)) {
                // 스킵된 부분 계산 (매칭 시작 위치 - 현재 위치)
                const matchStartNormalized = bestMatch.index;
                const matchStartOriginal = findOriginalIndexFromMap(indexMap, matchStartNormalized, scriptText.length);

                // 스킵된 구간이 있으면 반환
                const skippedStart = lastMatchedIndex || 0;
                const skippedEnd = matchStartOriginal;
                const hasSkipped = skippedEnd > skippedStart + 2; // 2자 이상 스킵시에만

                return res.status(200).json({
                    currentMatchedIndex: originalIndex,
                    isCorrect: true,
                    confidence: bestMatch.length / 15,
                    skippedRange: hasSkipped ? { start: skippedStart, end: skippedEnd } : null,
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
