import { VercelRequest, VercelResponse } from '@vercel/node';

// ESM/CJS 호환성을 위해 require 사용
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Hangul = require('hangul-js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const diff_match_patch = require('diff-match-patch');

// --- 인터페이스 정의 ---
interface SpeechComparisonRequest {
    spokenText: string;
    scriptText: string;
    lastMatchedIndex: number;
}

interface JamoScriptData {
    jamoText: string;
    indexMap: number[];
    originalLength: number;
}

// --- 캐싱 설정 ---
const SCRIPT_CACHE = new Map<string, JamoScriptData>();
const MAX_CACHE_SIZE = 5;

// --- Helper Functions ---
function getJamoScriptData(scriptText: string): JamoScriptData {
    if (SCRIPT_CACHE.has(scriptText)) return SCRIPT_CACHE.get(scriptText)!;
    const data = normalizeAndDecompose(scriptText);
    if (SCRIPT_CACHE.size >= MAX_CACHE_SIZE) {
        const firstKey = SCRIPT_CACHE.keys().next().value;
        if (firstKey) SCRIPT_CACHE.delete(firstKey);
    }
    SCRIPT_CACHE.set(scriptText, data);
    return data;
}

function findJamoIndexByOriginal(indexMap: number[], originalIndex: number): number {
    if (originalIndex <= 0) return 0;
    let left = 0, right = indexMap.length - 1, result = indexMap.length;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (indexMap[mid] >= originalIndex) {
            result = mid;
            right = mid - 1;
        } else {
            left = mid + 1;
        }
    }
    return result;
}

function normalizeAndDecompose(text: string): JamoScriptData {
    let jamoStr = "";
    const map: number[] = [];
    const FILTER_REGEX = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (!FILTER_REGEX.test(char)) {
            const disassembled = Hangul.disassemble(char);
            for (const jamo of disassembled) {
                jamoStr += jamo;
                map.push(i);
            }
        }
    }
    return { jamoText: jamoStr, indexMap: map, originalLength: text.length };
}

// --- Main Handler ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method not allowed' }); }

    try {
        const { spokenText, scriptText, lastMatchedIndex = 0 } = req.body as SpeechComparisonRequest;

        if (!spokenText || !scriptText) return res.status(400).json({ error: 'Missing fields' });
        if (spokenText.length < 2) {
            return res.status(200).json({ currentMatchedIndex: lastMatchedIndex, isCorrect: false, confidence: 0 });
        }

        // 1. 데이터 준비
        const scriptData = getJamoScriptData(scriptText);

        // 발화문도 자소로 변환 (공백/문장부호 제거)
        let spokenJamo = '';
        try {
            const skipRegex = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/;
            for (let i = 0; i < spokenText.length; i++) {
                const ch = spokenText[i];
                if (skipRegex.test(ch)) continue;

                if (Hangul.isHangul(ch)) {
                    const parts = Hangul.disassemble(ch);
                    for (const p of parts) spokenJamo += p;
                } else {
                    spokenJamo += ch.toLowerCase();
                }
            }
        } catch (e) {
            return res.status(200).json({ currentMatchedIndex: lastMatchedIndex, isCorrect: false, confidence: 0 });
        }

        // 2. 윈도우 설정 (넓게 잡음)
        const currentJamoIndex = findJamoIndexByOriginal(scriptData.indexMap, lastMatchedIndex);
        const WINDOW_BACK_BUFFER = 50; 
        const WINDOW_FORWARD_BUFFER = 1500; // 스킵 감지를 위해 충분히 넓게

        const windowStart = Math.max(0, currentJamoIndex - WINDOW_BACK_BUFFER);
        const windowEnd = Math.min(scriptData.jamoText.length, currentJamoIndex + WINDOW_FORWARD_BUFFER);
        const windowText = scriptData.jamoText.slice(windowStart, windowEnd);

        if (!windowText) return res.status(200).json({ currentMatchedIndex: lastMatchedIndex, isCorrect: false });

        // 3. Diff-Match-Patch 설정
        const dmp = new diff_match_patch();
        dmp.Match_Distance = 1000;
        dmp.Match_Threshold = 0.6; // 약간 여유를 줌 (검증 단계에서 거를 것이므로)

        const maxBits = dmp.Match_MaxBits || 32;
        const pattern = spokenJamo.length > maxBits ? spokenJamo.slice(-maxBits) : spokenJamo;
        const expectedLocInWindow = Math.max(0, currentJamoIndex - windowStart);

        // 4. 매칭 실행
        // foundIndexInWindow는 '대략적인' 시작 위치임 (퍼지 매칭)
        let foundIndexInWindow = dmp.match_main(windowText, pattern, expectedLocInWindow);

        if (foundIndexInWindow !== -1) {
            // =================================================================
            // 🔥 [해결책 1 & 2] 정밀 검증 및 시작점 보정 (Trim & Verify)
            // =================================================================
            
            // 매칭된 위치부터 발화 길이만큼(혹은 좀 더 길게) 텍스트를 잘라내서 정밀 비교
            // 자소 단위이므로 패턴 길이보다 약간 여유있게 잘라냄 (삽입/삭제 고려)
            const candidateLength = Math.min(pattern.length + 20, windowText.length - foundIndexInWindow);
            const candidateText = windowText.substr(foundIndexInWindow, candidateLength);
            
            // 정밀 Diff 실행
            const diffs = dmp.diff_main(candidateText, pattern);
            dmp.diff_cleanupSemantic(diffs); // 의미 단위로 정리

            let correctChars = 0;
            let offsetAdjustment = 0;
            let firstMatchFound = false;

            // Diff를 순회하며 실제 매칭 시작점과 정확도를 계산
            for (const [op, text] of diffs) {
                // op: -1(Script에만 있음/삭제), 1(Spoken에만 있음/추가), 0(일치)
                
                if (!firstMatchFound) {
                    // 아직 첫 일치 구간을 못 찾았는데
                    if (op === 0) {
                        // 일치 구간 시작! 여기가 진짜 시작점
                        firstMatchFound = true;
                        correctChars += text.length;
                    } else if (op === -1) {
                        // Script에는 있는데 Spoken에는 없음 -> 매칭 시작점이 아님 (쓰레기 값)
                        // 시작 인덱스를 뒤로 미룸
                        offsetAdjustment += text.length;
                    }
                    // op === 1 (Spoken에만 있는 건 스크립트 인덱스에 영향 안 줌)
                } else {
                    // 이미 시작점을 찾은 후에는 일치하는 글자 수 카운트
                    if (op === 0) correctChars += text.length;
                }
            }

            // [해결 1] 정확도 검사 (Accuracy Check)
            // 실제 일치하는 자소 비율이 65% 미만이면 "틀린 단어" 혹은 "우연한 매칭"으로 간주하고 기각
            const accuracy = correctChars / pattern.length;
            if (accuracy < 0.65) {
                return res.status(200).json({
                    currentMatchedIndex: lastMatchedIndex,
                    isCorrect: false,
                    confidence: 0,
                    message: "Low accuracy match"
                });
            }

            // [해결 2] 시작점 보정 (Trim Leading Garbage)
            // 퍼지 매칭이 앞 문장의 끝부분을 억지로 잡았더라도, diff 분석을 통해
            // 실제 일치(Equal)가 시작되는 지점만큼 인덱스를 뒤로 밈.
            foundIndexInWindow += offsetAdjustment;

            // -------------------------------------------------------------
            // 이후 로직은 기존과 유사하게 인덱스 변환 및 스킵 처리
            // -------------------------------------------------------------

            const absoluteJamoStart = windowStart + foundIndexInWindow;
            // 끝 위치는 패턴 길이만큼 더함 (정확도를 위해 diff기반 길이 계산 가능하나 여기선 단순화)
            const absoluteJamoEnd = absoluteJamoStart + pattern.length; 

            // 자소 인덱스 -> 원본 인덱스 변환
            let originalStart = scriptData.indexMap[Math.min(absoluteJamoStart, scriptData.indexMap.length - 1)];
            const originalEnd = scriptData.indexMap[Math.min(absoluteJamoEnd, scriptData.indexMap.length - 1)];

            // [단어 경계 보정 - Word Snap]
            // 보정된 시작점이 단어 중간이라면, 단어의 시작점으로 당겨줌 (가독성 위해)
            if (originalStart > 0 && originalStart < scriptText.length) {
                const isSeparator = (char: string) => /[\s\n\r.,!?;:'"]/.test(char);
                if (!isSeparator(scriptText[originalStart - 1])) {
                    let backTrackIdx = originalStart;
                    for(let k=0; k<15; k++) {
                        if(backTrackIdx <= 0) break;
                        if(isSeparator(scriptText[backTrackIdx-1])) break;
                        backTrackIdx--;
                    }
                    // 단, 너무 많이 뒤로 가서 이전 매칭 위치보다 전으로 가면 안됨
                    if (backTrackIdx >= lastMatchedIndex) {
                        originalStart = backTrackIdx;
                    }
                }
            }

            // 진행 방향 검사 및 스킵 처리
            if (originalEnd > lastMatchedIndex) {
                const jumpDistance = originalStart - lastMatchedIndex;
                
                // 스킵 판단 기준: 발화 길이보다 현저히 멀리 점프했는지
                // (약 10글자 이상 점프 시 스킵)
                const isSkipped = jumpDistance > 10;

                return res.status(200).json({
                    currentMatchedIndex: originalEnd,
                    isCorrect: true,
                    confidence: accuracy,
                    // 스킵 범위: 이전 위치 끝 ~ 보정된 현재 위치 시작
                    skippedRange: isSkipped ? { start: lastMatchedIndex, end: originalStart } : null
                });
            }
        }

        return res.status(200).json({
            currentMatchedIndex: lastMatchedIndex,
            isCorrect: false,
            confidence: 0
        });

    } catch (error) {
        console.error('Alignment Error:', error);
        return res.status(500).json({ error: 'Internal Error' });
    }
}