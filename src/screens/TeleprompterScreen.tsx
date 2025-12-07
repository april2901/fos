import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { StatusPill } from "../components/StatusPill";
import { Play, Pause, FileText, Type, Mic, Clock } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";

// Web Speech API Type Definitions
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface CustomSpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: CustomSpeechRecognition, ev: Event) => any) | null;
  onend: ((this: CustomSpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: CustomSpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: CustomSpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => CustomSpeechRecognition;
    webkitSpeechRecognition: new () => CustomSpeechRecognition;
  }
}

interface TeleprompterScreenProps {
  presentationTitle: string;
  script: string;
  targetTimeSeconds?: number; // 목표 발표 시간 (초 단위)
  onEnd: () => void;
  onKeywordsExtracted: (keywords: string[]) => void;
  onHomeClick: () => void;
  onBack: () => void;
}

interface Phrase {
  text: string;
  startIndex: number;
  endIndex: number;
}

interface Sentence {
  text: string;
  phrases: Phrase[];
  startIndex: number;
  endIndex: number;
}

interface NormalizedScriptData {
  text: string;
  indexMap: number[];
}

interface LocalMatchResult {
  matched: boolean;
  newIndex: number;
  confidence: number;
  skippedRange?: { start: number; end: number } | null;
}

const NORMALIZE_REGEX = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/g;
const CHAR_CHECK_REGEX = /[\s\n\r.,!?;:'"「」『』【】\-–—…·()（）\[\]]/;
const LOCAL_CONFIDENCE_THRESHOLD = 0.45;

function normalizeTextLocal(text: string): string {
  return text.toLowerCase().replace(NORMALIZE_REGEX, '');
}

function normalizeScriptWithIndexMapClient(scriptText: string): NormalizedScriptData {
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

function findLongestCommonSubstringLocal(s1: string, s2: string): { start: number; length: number } {
  if (s1.length === 0 || s2.length === 0) return { start: -1, length: 0 };

  const m = s1.length;
  const n = s2.length;
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
          endIndex = j;
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

function matchSpeechLocally(
  spokenText: string,
  normalizedData: NormalizedScriptData | null,
  lastMatchedIndex: number,
  scriptLength: number
): LocalMatchResult | null {
  if (!normalizedData) return null;

  const normalizedSpoken = normalizeTextLocal(spokenText);
  if (normalizedSpoken.length < 2) return null;

  const currentNormalizedIndex = findNormalizedIndexByOriginal(normalizedData.indexMap, lastMatchedIndex);
  const searchStart = Math.max(0, currentNormalizedIndex - 5);
  const searchEnd = Math.min(normalizedData.text.length, currentNormalizedIndex + 400);
  const searchScript = normalizedData.text.slice(searchStart, searchEnd);

  let bestMatch = { index: -1, length: 0 };

  const maxLen = Math.min(25, normalizedSpoken.length);
  for (let len = maxLen; len >= 2; len--) {
    const searchPhrase = normalizedSpoken.slice(-len);
    const idx = searchScript.indexOf(searchPhrase);

    if (idx !== -1) {
      bestMatch = { index: searchStart + idx, length: len };
      break;
    }
  }

  if (bestMatch.index === -1 && normalizedSpoken.length >= 4) {
    const spokenEnd = normalizedSpoken.slice(-20);
    const lcsResult = findLongestCommonSubstringLocal(spokenEnd, searchScript.slice(0, 250));

    if (lcsResult.length >= 3) {
      bestMatch = {
        index: searchStart + lcsResult.start,
        length: lcsResult.length,
      };
    }
  }

  if (bestMatch.index === -1) {
    return null;
  }

  const normalizedMatchEnd = bestMatch.index + bestMatch.length;
  const originalIndex = findOriginalIndexFromMap(normalizedData.indexMap, normalizedMatchEnd, scriptLength);

  if (originalIndex < lastMatchedIndex) {
    return null;
  }

  const matchStartOriginal = findOriginalIndexFromMap(normalizedData.indexMap, bestMatch.index, scriptLength);
  const skippedStart = lastMatchedIndex;
  const skippedEnd = matchStartOriginal;
  const hasSkipped = skippedEnd > skippedStart + 2;

  return {
    matched: true,
    newIndex: originalIndex,
    confidence: Math.min(1, bestMatch.length / 15),
    skippedRange: hasSkipped ? { start: skippedStart, end: skippedEnd } : null,
  };
}

// 시간 포맷팅 헬퍼 함수 (MM:SS 형식)
function formatTimeMMSS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function TeleprompterScreen({ presentationTitle, script, targetTimeSeconds = 0, onEnd, onKeywordsExtracted, onHomeClick, onBack }: TeleprompterScreenProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentPhraseInSentence, setCurrentPhraseInSentence] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [autoAdvanceSlides, setAutoAdvanceSlides] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  // 발표 속도 관련 state 주석 처리
  // const [speed, setSpeed] = useState<"느림" | "적정" | "빠름">("적정");
  // const [volume, setVolume] = useState(6.5);
  const [fontSize, setFontSize] = useState(32); // Default font size in px
  const [modifiedScript, setModifiedScript] = useState<string>(script);
  const [reconstructedSuggestion, setReconstructedSuggestion] = useState<string | null>(null);
  const [suggestionInsertIndex, setSuggestionInsertIndex] = useState<number>(0); // LLM이 계산한 삽입 위치
  const [isReconstructing, setIsReconstructing] = useState(false);
  const [showSuggestionBanner, setShowSuggestionBanner] = useState(false);

  // 현재 소요 시간 (초 단위)
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Web Speech API states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [cumulativeTranscript, setCumulativeTranscript] = useState(""); // 누적 음성 인식 결과
  const [skippedRanges, setSkippedRanges] = useState<Array<{ start: number; end: number }>>([]); // 틀린 부분 (스킵된 구간)
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const isRunningRef = useRef(isRunning); // isRunning을 ref로 추적
  const pendingApiCall = useRef(false); // API 호출 중복 방지
  const lastApiCallTime = useRef(0); // 마지막 API 호출 시간
  const fullScriptRef = useRef(modifiedScript); // modifiedScript를 ref로 추적 (콜백에서 최신값 사용)
  const intentionalStopRef = useRef(false); // 의도적 중지 여부 (일시정지 시 true)

  // isRunning 상태를 ref에 동기화
  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  // fullScript(modifiedScript) 변경 시 ref 동기화
  useEffect(() => {
    fullScriptRef.current = modifiedScript;
  }, [modifiedScript]);

  // 타이머 관리 (isRunning에 따라 시작/정지)
  useEffect(() => {
    if (isRunning) {
      // 타이머 시작
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      // 타이머 정지
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    // cleanup
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRunning]);

  // Extract keywords from script using Gemini API
  useEffect(() => {
    const extractKeywords = async () => {
      if (!script || script.trim().length === 0) return;

      try {
        const response = await fetch('/api/extract-keywords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ script }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.keywords && Array.isArray(data.keywords)) {
            onKeywordsExtracted(data.keywords);
          }
        } else {
          console.error('Failed to extract keywords:', response.statusText);
        }
      } catch (error) {
        console.error('Error extracting keywords:', error);
      }
    };

    extractKeywords();
  }, [script, onKeywordsExtracted]);

  // Use a modifiable copy of the script so we can inject suggested reconstruction
  const fullScript = modifiedScript;

  const normalizedScriptData = useMemo(() => normalizeScriptWithIndexMapClient(fullScript), [fullScript]);
  const normalizedScriptRef = useRef<NormalizedScriptData | null>(normalizedScriptData);
  useEffect(() => {
    normalizedScriptRef.current = normalizedScriptData;
  }, [normalizedScriptData]);

  // Keep modifiedScript in sync when prop `script` changes (new session)
  useEffect(() => {
    setModifiedScript(script);
    setReconstructedSuggestion(null);
    setShowSuggestionBanner(false);
    setSkippedRanges([]);
  }, [script]);

  const totalPages = 20;

  const parsedScript = useMemo((): Sentence[] => {
    const sentences: Sentence[] = [];
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    let match;
    let lastIndex = 0;

    while ((match = sentenceRegex.exec(fullScript)) !== null) {
      const sentenceText = match[0].trim();
      const sentenceStart = match.index;
      const sentenceEnd = sentenceRegex.lastIndex;

      const phrases = splitIntoPhrasesWithContext(sentenceText, sentenceStart);

      sentences.push({
        text: sentenceText,
        phrases,
        startIndex: sentenceStart,
        endIndex: sentenceEnd
      });

      lastIndex = sentenceEnd;
    }

    if (lastIndex < fullScript.length) {
      const remainingText = fullScript.substring(lastIndex).trim();
      if (remainingText) {
        const phrases = splitIntoPhrasesWithContext(remainingText, lastIndex);
        sentences.push({
          text: remainingText,
          phrases,
          startIndex: lastIndex,
          endIndex: fullScript.length
        });
      }
    }

    return sentences;
  }, [fullScript]);

  function splitIntoPhrasesWithContext(sentence: string, sentenceStart: number): Phrase[] {
    const phrases: Phrase[] = [];

    const commaSplits = sentence.split(',').map(s => s.trim()).filter(s => s.length > 0);
    let globalOffset = sentenceStart;

    for (let segmentIdx = 0; segmentIdx < commaSplits.length; segmentIdx++) {
      let segment = commaSplits[segmentIdx];
      const segmentStartInSentence = sentence.indexOf(segment, globalOffset - sentenceStart);
      const segmentStart = sentenceStart + segmentStartInSentence;

      const particleMarkers = [
        '은 ', '는 ', '이 ', '가 ',
        '을 ', '를 ',
        '에서 ', '에게 ', '으로 ', '로 ',
        '하지만 ', '때문에 ', '그리고 ',
        '와 ', '과 ', '하고 '
      ];

      const subBreakPoints: number[] = [0];

      for (let i = 0; i < segment.length; i++) {
        for (const marker of particleMarkers) {
          if (segment.substring(i, i + marker.length) === marker) {
            const position = i + marker.length;
            const lastBreak = subBreakPoints[subBreakPoints.length - 1];

            if (position - lastBreak >= 8) {
              subBreakPoints.push(position);
            }
          }
        }

        if (segment[i] === '"') {
          const closeQuote = segment.indexOf('"', i + 1);
          if (closeQuote !== -1 && closeQuote - i > 3) {
            const lastBreak = subBreakPoints[subBreakPoints.length - 1];
            if (i - lastBreak >= 5) {
              subBreakPoints.push(i);
            }
            if (closeQuote + 1 < segment.length) {
              subBreakPoints.push(closeQuote + 1);
            }
          }
        }
      }

      subBreakPoints.push(segment.length);

      const tempSpans: { text: string; start: number; end: number; koreanCount: number }[] = [];

      for (let i = 0; i < subBreakPoints.length - 1; i++) {
        const start = subBreakPoints[i];
        const end = subBreakPoints[i + 1];
        const spanText = segment.substring(start, end).trim();

        if (spanText.length === 0) continue;

        const koreanCount = (spanText.match(/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/g) || []).length;

        tempSpans.push({
          text: spanText,
          start: segmentStart + start,
          end: segmentStart + end,
          koreanCount
        });
      }

      let i = 0;
      while (i < tempSpans.length) {
        const span = tempSpans[i];
        const wordCount = span.text.split(/\s+/).length;

        if ((span.koreanCount < 10 || wordCount < 3) && i < tempSpans.length - 1) {
          const nextSpan = tempSpans[i + 1];
          const mergedText = sentence.substring(
            span.start - sentenceStart,
            nextSpan.end - sentenceStart
          ).trim();
          const mergedKoreanCount = (mergedText.match(/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/g) || []).length;

          if (mergedKoreanCount <= 30) {
            tempSpans[i] = {
              text: mergedText,
              start: span.start,
              end: nextSpan.end,
              koreanCount: mergedKoreanCount
            };
            tempSpans.splice(i + 1, 1);
          } else {
            i++;
          }
        } else {
          i++;
        }
      }

      for (const span of tempSpans) {
        phrases.push({
          text: span.text,
          startIndex: span.start,
          endIndex: span.end
        });
      }

      globalOffset = segmentStart + segment.length + 1;
    }

    return phrases;
  }

  const allPhrases = useMemo(() => {
    return parsedScript.flatMap(sentence => sentence.phrases);
  }, [parsedScript]);

  // Trigger LLM reconstruction when skipped ranges grow large enough
  // 헬퍼: 현재 커서 위치에서 문장이 끝나는 지점(마침표/물음표/줄바꿈)을 찾음
  const findNextSentenceEnd = useCallback((text: string, currentIdx: number) => {
    const afterText = text.slice(currentIdx);
    // 문장 부호(.!?) 혹은 줄바꿈을 찾음
    const match = /[.!?\n]/.exec(afterText);
    
    if (match) {
      // 찾았으면 그 바로 뒤 (공백 포함)
      return currentIdx + match.index + 1;
    }
    // 못 찾으면 그냥 현재 위치에서 20자 뒤 (너무 멀리 안 가도록)
    return Math.min(text.length, currentIdx + 20);
  }, []);


  // LLM 호출 로직 (useEffect 대체)
  useEffect(() => {
    if (!skippedRanges || skippedRanges.length === 0) return;
    if (isReconstructing) return; 
    if (showSuggestionBanner) return; // 이미 떠있으면 유지

    const totalSkippedChars = skippedRanges.reduce((acc, r) => acc + Math.max(0, r.end - r.start), 0);

    let skippedSentences = 0;
    for (const sentence of parsedScript) {
      for (const range of skippedRanges) {
        if (range.start <= sentence.startIndex && range.end >= sentence.endIndex) {
          skippedSentences++;
          break;
        }
      }
    }

    // 1문장 이상 또는 10글자 이상 스킵 시 발동
    const shouldCall = skippedSentences >= 1 || totalSkippedChars >= 10;
    
    if (!shouldCall) return;

    // 디바운싱: 1.2초 동안 추가 스킵이 없으면 호출 (말이 끝날 때쯤)
    const timeoutId = setTimeout(async () => {
      setIsReconstructing(true);
      
      try {
        const resp = await fetch('/api/reconstruct-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script: fullScript,
            skippedRanges,
            currentIndex: currentCharIndexRef.current, // 요청 시점의 문맥
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          
          if (data.reconstructed) {
            // 🔥 [위치 동기화] 응답이 온 시점의 커서 위치를 기준으로 삽입점 재계산
            const currentRealtimeIndex = currentCharIndexRef.current;
            
            // 사용자가 이미 너무 멀리(500자 이상) 가버렸으면 제안 포기 (너무 뒷북이라)
            const lastSkipEnd = skippedRanges[skippedRanges.length - 1].end;
            if (currentRealtimeIndex - lastSkipEnd > 500) {
               console.log("Suggestion dropped: User moved too far.");
            } else {
               // 지금 읽고 있는 문장이 끝나면 바로 보여주도록 위치 설정
               const dynamicInsertIndex = findNextSentenceEnd(fullScriptRef.current, currentRealtimeIndex);
               
               setReconstructedSuggestion(data.reconstructed.trim());
               setSuggestionInsertIndex(dynamicInsertIndex);
               setShowSuggestionBanner(true);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsReconstructing(false);
      }
    }, 1200);

    return () => clearTimeout(timeoutId);

  }, [skippedRanges, parsedScript, isReconstructing, showSuggestionBanner, findNextSentenceEnd, fullScript]);

  // currentCharIndex가 변경되면 해당하는 문장/구절 인덱스 계산
  useEffect(() => {
    if (parsedScript.length === 0) return;

    // 현재 문자 위치에 해당하는 문장 찾기 (이진 검색 방식)
    let foundSentenceIndex = 0;
    let foundPhraseIndex = 0;

    // 현재 위치보다 뒤에 있는 첫 번째 문장 찾기
    for (let sIdx = 0; sIdx < parsedScript.length; sIdx++) {
      const sentence = parsedScript[sIdx];

      // 현재 위치가 이 문장 끝을 넘어섰으면 다음 문장으로
      if (currentCharIndex >= sentence.endIndex) {
        foundSentenceIndex = Math.min(sIdx + 1, parsedScript.length - 1);
        foundPhraseIndex = 0;
        continue; // 다음 문장 확인
      }

      // 현재 위치가 이 문장 범위 안에 있음
      if (currentCharIndex >= sentence.startIndex) {
        foundSentenceIndex = sIdx;

        // 문장 내에서 현재 구절 찾기
        for (let pIdx = 0; pIdx < sentence.phrases.length; pIdx++) {
          const phrase = sentence.phrases[pIdx];
          if (currentCharIndex < phrase.endIndex) {
            foundPhraseIndex = pIdx;
            break;
          }
        }
        break; // 문장 찾았으면 종료
      }
    }

    // 항상 상태 업데이트 (React가 알아서 최적화)
    setCurrentSentenceIndex(foundSentenceIndex);
    setCurrentPhraseInSentence(foundPhraseIndex);
  }, [currentCharIndex, parsedScript]);

  // 슬라이드 자동 넘기기
  useEffect(() => {
    if (!autoAdvanceSlides || !isRunning) return;

    const progress = currentSentenceIndex / parsedScript.length;
    const newPage = Math.min(Math.floor(progress * totalPages) + 1, totalPages);

    if (newPage !== currentPage) {
      setCurrentPage(newPage);
    }
  }, [currentSentenceIndex, parsedScript.length, autoAdvanceSlides, isRunning, currentPage, totalPages]);

  // Get visible sentences for rolling viewport (current +/- 2)
  const visibleSentences = useMemo(() => {
    const contextSize = 2;
    const startIdx = Math.max(0, currentSentenceIndex - contextSize);
    const endIdx = Math.min(parsedScript.length, currentSentenceIndex + contextSize + 1);

    return parsedScript.slice(startIdx, endIdx).map((sentence, idx) => ({
      sentence,
      globalIndex: startIdx + idx,
      position: (startIdx + idx) - currentSentenceIndex // -2, -1, 0, 1, 2
    }));
  }, [parsedScript, currentSentenceIndex]);

  // 텍스트를 스킵된 부분과 정상 부분으로 나누어 렌더링하는 헬퍼 함수
  const renderTextWithSkipped = (text: string, sentenceStart: number, className: string, style?: React.CSSProperties) => {
    // 이 문장에 해당하는 스킵된 구간 찾기
    const sentenceEnd = sentenceStart + text.length;
    const relevantSkips = skippedRanges.filter(
      range => range.start < sentenceEnd && range.end > sentenceStart
    );

    if (relevantSkips.length === 0) {
      return <span className={className} style={style}>{text}</span>;
    }

    // 텍스트를 조각으로 나누기
    const segments: Array<{ text: string; isSkipped: boolean }> = [];
    let lastIndex = 0;

    for (const range of relevantSkips) {
      const skipStartInSentence = Math.max(0, range.start - sentenceStart);
      const skipEndInSentence = Math.min(text.length, range.end - sentenceStart);

      if (skipStartInSentence > lastIndex) {
        segments.push({ text: text.substring(lastIndex, skipStartInSentence), isSkipped: false });
      }
      if (skipEndInSentence > skipStartInSentence) {
        segments.push({ text: text.substring(skipStartInSentence, skipEndInSentence), isSkipped: true });
      }
      lastIndex = skipEndInSentence;
    }

    if (lastIndex < text.length) {
      segments.push({ text: text.substring(lastIndex), isSkipped: false });
    }

    return (
      <>
        {segments.map((seg, idx) => (
          <span
            key={idx}
            className={seg.isSkipped ? "" : className}
            style={seg.isSkipped ? 
              { color : '#FF0000' } : style} // 스킵된 부분 주황색으로 표시
          >
            {seg.text}
          </span>
        ))}
      </>
    );
  };

  const renderSentenceWithHighlight = (sentence: Sentence, position: number) => {
    if (position < 0) {
      // Previous sentence - 스킵된 부분은 주황색, 나머지는 회색
      return renderTextWithSkipped(sentence.text, sentence.startIndex, "text-[#D0D0D0]");
    } else if (position === 0) {
      // Current sentence - entire text in blue, current phrase with blue bg + white text
      const currentSentence = parsedScript[currentSentenceIndex];
      const currentPhrase = currentSentence.phrases[currentPhraseInSentence];

      if (!currentPhrase) {
        return renderTextWithSkipped(sentence.text, sentence.startIndex, "text-[#0064FF]");
      }

      // Split sentence into parts: before current phrase, current phrase, after current phrase
      const phraseStartInSentence = currentPhrase.startIndex - sentence.startIndex;
      const phraseEndInSentence = currentPhrase.endIndex - sentence.startIndex;

      const beforePhrase = sentence.text.substring(0, phraseStartInSentence);
      const phraseText = sentence.text.substring(phraseStartInSentence, phraseEndInSentence);
      const afterPhrase = sentence.text.substring(phraseEndInSentence);

      return (
        <>
          {renderTextWithSkipped(beforePhrase, sentence.startIndex, "text-[#0064FF]")}
          <span className="bg-[#0064FF] text-white px-1.5 py-0.5 rounded">{phraseText}</span>
          {renderTextWithSkipped(afterPhrase, sentence.startIndex + phraseEndInSentence, "text-[#0064FF]")}
        </>
      );
    } else {
      // Upcoming sentence - dark text with reduced opacity
      return (
        <span className="text-[#030213]" style={{ opacity: 0.7 }}>
          {sentence.text}
        </span>
      );
    }
  };

  const getSentenceOpacity = (position: number) => {
    if (position === 0) return 1.0;
    if (position < 0) return 0.4 + (0.2 * (position + 2)); // -2 = 0.4, -1 = 0.6
    return 0.7 - (0.15 * (position - 1)); // 1 = 0.7, 2 = 0.55
  };

  // 현재 charIndex를 ref로 추적 (콜백 내에서 최신 값 사용)
  const currentCharIndexRef = useRef(currentCharIndex);
  useEffect(() => {
    currentCharIndexRef.current = currentCharIndex;
  }, [currentCharIndex]);

  // 누적 transcript를 ref로 추적
  const cumulativeTranscriptRef = useRef(cumulativeTranscript);
  useEffect(() => {
    cumulativeTranscriptRef.current = cumulativeTranscript;
  }, [cumulativeTranscript]);


  const handleMatchUpdate = useCallback(
    (newIndex: number, skippedRange?: { start: number; end: number } | null) => {
      // 1. 커서 업데이트 (뒤로 가는 것 방지)
      if (newIndex > currentCharIndexRef.current) {
        currentCharIndexRef.current = newIndex;
        setCurrentCharIndex(newIndex);
      }

      // 2. 스킵 범위 업데이트 (중복 방지 강화)
      if (skippedRange && skippedRange.end > skippedRange.start + 1) {
        setSkippedRanges(prev => {
          // 이미 있는 범위 안에 포함되면 무시
          const isRedundant = prev.some(
            r => r.start <= skippedRange.start && r.end >= skippedRange.end
          );
          if (isRedundant) return prev;

          // 겹치는 범위가 있으면 병합 (선택사항, 여기선 단순 추가)
          return [...prev, skippedRange];
        });
      }
    },
    []
  );

  // Initialize Web Speech API (한 번만 초기화)
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn("Web Speech API not supported in this browser");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      // 의도적 중지가 아니고 isRunning이 true면 자동 재시작 (브라우저가 자동으로 끊은 경우)
      if (isRunningRef.current && !intentionalStopRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            // 재시작 실패 시 무시
          }
        }, 100);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // aborted는 정상적인 중지 시 발생
      if (event.error === "aborted") {
        setIsListening(false);
        return;
      }

      // no-speech는 조용할 때 발생 - 에러 아님
      if (event.error === "no-speech") {
        // 의도적 중지가 아니고 isRunning이 true면 자동 재시작
        if (isRunningRef.current && !intentionalStopRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch (err) {
              // 이미 시작된 경우 무시
            }
          }, 100);
        }
        return;
      }

      // 그 외 실제 오류
      console.error("❌ Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      // 일시정지 상태에서는 이벤트 무시
      if (!isRunningRef.current) {
        return;
      }

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += result + " ";
        } else {
          interimTranscript += result;
        }
      }

      // final transcript가 있으면 누적
      if (finalTranscript.trim()) {
        setCumulativeTranscript(prev => {
          const updated = (prev + " " + finalTranscript).trim();
          // 최대 200자까지만 유지 (더 짧게)
          return updated.length > 200 ? updated.slice(-200) : updated;
        });
      }

      // 매칭에 사용할 텍스트: 최근 음성만 사용 (더 짧게)
      const currentText = (finalTranscript || interimTranscript).trim();
      const searchText = (cumulativeTranscriptRef.current.slice(-100) + " " + currentText).trim();
      if (!searchText || searchText.length < 2) return;

      setTranscript(currentText);

      // API 호출 쓰로틀링: 이미 호출 중이거나 50ms 이내면 스킵
      const now = Date.now();
      if (pendingApiCall.current || (now - lastApiCallTime.current) < 50) {
        return;
      }

      pendingApiCall.current = true;
      lastApiCallTime.current = now;

      // 백엔드 API를 통한 음성-스크립트 매칭 (최신 modifiedScript 사용)
      try {
        const response = await fetch('/api/speech-comparison', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spokenText: searchText,
            scriptText: fullScriptRef.current,
            lastMatchedIndex: currentCharIndexRef.current,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result && typeof result.currentMatchedIndex === 'number') {
            const newIndex = result.currentMatchedIndex;
            if (result.isCorrect && newIndex > currentCharIndexRef.current) {
              handleMatchUpdate(newIndex, result.skippedRange);
            }
          }
        }
      } catch (error) {
        console.error('❌ API 실패:', error);
      } finally {
        pendingApiCall.current = false;
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // 이미 중지된 경우 무시
        }
      }
    };
  }, []); // 초기화는 한 번만, fullScriptRef를 통해 최신 스크립트 사용

  const handlePlayPause = async () => {
    const newRunningState = !isRunning;
    setIsRunning(newRunningState);

    if (newRunningState) {
      // 시작할 때 누적 transcript 초기화 (처음 시작할 때만)
      if (currentCharIndex === 0) {
        setCumulativeTranscript("");
        setSkippedRanges([]); // 틀린 부분도 초기화
        setElapsedSeconds(0); // 타이머도 초기화
      }

      // 의도적 중지 플래그 해제
      intentionalStopRef.current = false;

      // 음성 인식 시작
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (err) {
          // 이미 시작된 경우 무시
        }
      }
    } else {
      // 일시정지 - 의도적 중지 플래그 설정
      intentionalStopRef.current = true;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // 이미 중지된 경우 무시
        }
      }
    }
  };

  // 발표 속도 관련 변수 주석 처리
  // const volumeCategory = volume < 4 ? "작음" : volume > 7.5 ? "큼" : "적정";
  const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

  // 시간 초과 여부 계산
  const isOverTime = targetTimeSeconds > 0 && elapsedSeconds > targetTimeSeconds;

  return (
    <div className="w-full h-full bg-[#FAFBFC]">
      <TopNavBar title="실시간 텔레프롬프터" onHomeClick={onHomeClick} showBackButton={true} onBackClick={onBack} />

      <div className="px-8 py-6 h-full">
        <div className="flex gap-6 h-[calc(100%-64px)] max-w-7xl mx-auto">
          {/* Left - Teleprompter */}
          <div className="flex-[2.2] flex flex-col">
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] flex-grow flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-start justify-between px-8 pt-6 pb-4 border-b border-[rgba(0,0,0,0.06)]">
                <div className="flex-grow">
                  <p className="text-xs text-[#717182] mb-1 font-medium">발표 제목</p>
                  <p className="text-base font-semibold text-[#030213]">
                    {presentationTitle}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill text="STT ON · Recording" variant={isRunning ? "recording" : "default"} />
                  <Button
                    onClick={handlePlayPause}
                    className="h-9 bg-[#0064FF] hover:bg-[#0052CC] rounded-lg gap-2 text-sm px-4 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {isRunning ? '일시 정지' : '시작하기'}
                  </Button>
                  <Button
                    onClick={onEnd}
                    variant="outline"
                    className="h-9 border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm px-4 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    발표 종료
                  </Button>
                </div>
              </div>

              {/* Teleprompter Text - Rolling Dial Viewport with Sentence Lines */}
              <div className="flex-grow flex items-center justify-center overflow-hidden px-12 py-10 relative">
                <div
                  className="w-full max-w-5xl"
                  style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: 600,
                    lineHeight: 1.7
                  }}
                >
                  {visibleSentences.map(({ sentence, globalIndex, position }) => {
                    const opacity = getSentenceOpacity(position);
                    return (
                      <div
                        key={globalIndex}
                        className="transition-all duration-500 ease-out mb-8"
                        style={{
                          opacity: opacity
                        }}
                      >
                        {renderSentenceWithHighlight(sentence, position)}
                      </div>
                    );
                  })}
                </div>

                {/* Font Size Controls */}
                <div className="absolute top-6 right-8 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg border border-[rgba(0,0,0,0.1)] px-3 py-2 shadow-sm">
                  <Type className="size-4 text-[#717182]" />
                  <button
                    onClick={() => setFontSize(Math.max(20, fontSize - 4))}
                    className="size-7 rounded flex items-center justify-center hover:bg-[#F4F6FF] transition-colors text-[#030213] font-semibold"
                    disabled={fontSize <= 20}
                  >
                    -
                  </button>
                  <span className="text-xs text-[#717182] min-w-[2.5rem] text-center font-medium">
                    {fontSize}px
                  </span>
                  <button
                    onClick={() => setFontSize(Math.min(52, fontSize + 4))}
                    className="size-7 rounded flex items-center justify-center hover:bg-[#F4F6FF] transition-colors text-[#030213] font-semibold"
                    disabled={fontSize >= 52}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Dashboard & Slides */}
          <div className="flex-1 flex flex-col gap-6">
            {/* Presenter Dashboard */}
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <h3 className="text-base font-semibold text-[#030213] mb-5">발표자 대시보드</h3>

              <div className="space-y-5">
                {/* 발표 진행률 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#717182] font-medium">발표 진행률</p>
                    <span className="text-sm font-semibold text-[#0064FF]">
                      {Math.round((currentCharIndex / fullScript.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 bg-[#F4F6FF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0064FF] rounded-full transition-all duration-300"
                      style={{ width: `${(currentCharIndex / fullScript.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-[#717182] mt-1">
                    문장 {currentSentenceIndex + 1} / {parsedScript.length}
                  </p>
                </div>

                {/* 실시간 음성 인식 */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Mic className={`size-4 ${isListening ? 'text-red-500 animate-pulse' : 'text-[#717182]'}`} />
                    <p className="text-xs text-[#717182] font-medium">실시간 음성 인식</p>
                    {isListening && (
                      <span className="text-xs text-red-500 font-medium">녹음 중</span>
                    )}
                  </div>
                  <div className="bg-[#FAFBFC] rounded-lg p-3 border border-[rgba(0,0,0,0.06)] min-h-[60px] max-h-[80px] overflow-y-auto">
                    {transcript ? (
                      <p className="text-sm text-[#030213] leading-relaxed">{transcript}</p>
                    ) : (
                      <p className="text-sm text-[#717182] italic">
                        {isRunning ? '음성을 인식하고 있습니다...' : '시작 버튼을 누르면 음성 인식이 시작됩니다'}
                      </p>
                    )}
                  </div>
                </div>

                {/* 누락 보완 제안 (LLM) */}
                {reconstructedSuggestion && showSuggestionBanner && (
                  <div className="mt-3 bg-yellow-50 border-l-4 border-yellow-300 p-3 rounded">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-[#5A4D00] font-medium mb-1">누락된 내용을 자연스럽게 포함한 제안</p>
                        <div className="max-h-40 overflow-y-auto text-sm text-[#3b2f00] leading-relaxed whitespace-pre-wrap">
                          {reconstructedSuggestion}
                        </div>
                        <p className="text-xs text-[#5A4D00] mt-2">자동 제안은 편집 없이도 발표에 참고용으로 활용할 수 있습니다.</p>
                      </div>
                      <div className="ml-3 flex flex-col gap-2">
                        <button
                          onClick={() => {
                            // API에서 계산한 위치(1문장 뒤)에 삽입
                            const insertAt = Math.min(suggestionInsertIndex, modifiedScript.length);
                            const before = modifiedScript.slice(0, insertAt);
                            const after = modifiedScript.slice(insertAt);
                            const merged = `${before}${before.endsWith(' ') ? '' : ' '}${reconstructedSuggestion}${reconstructedSuggestion.endsWith(' ') ? '' : ' '}${after}`;
                            setModifiedScript(merged);
                            setShowSuggestionBanner(false);
                            setReconstructedSuggestion(null);
                            setSkippedRanges([]);
                            // 누적 음성 인식 결과도 리셋하여 새 스크립트 기준으로 매칭 시작
                            setCumulativeTranscript("");
                          }}
                          className="h-8 bg-[#0064FF] text-white rounded px-3 text-xs"
                        >적용</button>
                        <button
                          onClick={() => { setShowSuggestionBanner(false); setReconstructedSuggestion(null); }}
                          className="h-8 bg-white border text-[#5A4D00] rounded px-3 text-xs"
                        >닫기</button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 발표 시간 정보 */}
                <div className="flex gap-3">
                  {/* 현재 발표 시간 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="size-4 text-[#717182]" />
                      <p className="text-xs font-medium text-[#717182]">현재 발표 시간</p>
                    </div>
                    <div className="h-12 px-4 rounded-lg bg-[#F4F6FF] border border-[rgba(0,0,0,0.06)] flex items-center justify-center">
                      <span className="text-xl font-semibold tabular-nums text-[#030213]">
                        {formatTimeMMSS(elapsedSeconds)}
                      </span>
                    </div>
                  </div>

                  {/* 잔여 시간 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="size-4 text-[#717182]" />
                      <p className="text-xs font-medium text-[#717182]">잔여 시간</p>
                    </div>
                    <div className={`h-12 px-4 rounded-lg border flex items-center justify-center ${
                      isOverTime 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)]'
                    }`}>
                      {isOverTime ? (
                        <span className="text-xl font-semibold text-red-600">
                          -{formatTimeMMSS(elapsedSeconds - targetTimeSeconds)}  
                        </span>
                      ) : (
                        <span className="text-xl font-semibold tabular-nums text-[#030213]">
                          {targetTimeSeconds > 0 ? formatTimeMMSS(Math.max(0, targetTimeSeconds - elapsedSeconds)) : '--:--'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide Preview */}
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6 flex-grow flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#030213]">발표 자료 미리보기</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#717182]">자동 넘기기</span>
                  <button
                    onClick={() => setAutoAdvanceSlides(!autoAdvanceSlides)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${autoAdvanceSlides ? 'bg-[#34c759]' : 'bg-gray-300'
                      }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${autoAdvanceSlides ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mb-4">
                {/* Current Slide */}
                <div className="flex-1">
                  <div className="bg-[#F4F6FF] rounded-lg aspect-[16/9] flex items-center justify-center border border-[rgba(0,0,0,0.06)] mb-2">
                    <FileText className="size-12 text-[#717182]" />
                  </div>
                  <p className="text-xs text-[#030213] font-medium text-center">
                    현재 페이지
                  </p>
                </div>

                {/* Next Slide */}
                <div className="flex-1 opacity-60">
                  <div className="bg-[#F4F6FF] rounded-lg aspect-[16/9] flex items-center justify-center border border-[rgba(0,0,0,0.06)] mb-2">
                    <FileText className="size-12 text-[#717182]" />
                  </div>
                  <p className="text-xs text-[#717182] text-center">
                    다음 페이지
                  </p>
                </div>
              </div>

              <div className="space-y-1 mb-3">
                <p className="text-sm text-[#030213] font-medium">
                  현재 페이지: {currentPage} / {totalPages}
                </p>
                <p className="text-xs text-[#717182]">
                  다음 페이지: {nextPage} / {totalPages}
                </p>
              </div>

              <p className="text-xs text-[#717182] leading-relaxed">
                스크립트와 매칭된 구간에 도달하면 자동으로 다음 슬라이드로 넘어갑니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}