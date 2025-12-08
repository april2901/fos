import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { StatusPill } from "../components/StatusPill";
import { Play, Pause, FileText, Type, Mic, Clock, Plus, X } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";

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

// 시간 포맷팅 헬퍼 함수 (MM:SS 형식)
function formatTimeMMSS(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function TeleprompterScreen({
  presentationTitle,
  script,
  targetTimeSeconds = 0,
  onEnd,
  onKeywordsExtracted,
  onHomeClick,
  onBack,
}: TeleprompterScreenProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentPhraseInSentence, setCurrentPhraseInSentence] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [autoAdvanceSlides, setAutoAdvanceSlides] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
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

  // 헬퍼: 현재 커서 위치에서 문장이 끝나는 지점(마침표/물음표/줄바꿈)을 찾음
  const findNextSentenceEnd = useCallback((text: string, currentIdx: number) => {
    const afterText = text.slice(currentIdx);
    const match = /[.!?\n]/.exec(afterText);

    if (match) {
      return currentIdx + match.index + 1;
    }
    return Math.min(text.length, currentIdx + 20);
  }, []);

  // 누락 구간 많아지면 LLM 재구성 호출 (디바운스 포함)
  useEffect(() => {
    if (!skippedRanges || skippedRanges.length === 0) return;
    if (isReconstructing) return;
    if (showSuggestionBanner) return;

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

    const timeoutId = setTimeout(async () => {
      setIsReconstructing(true);

      try {
        const resp = await fetch('/api/reconstruct-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            script: fullScript,
            skippedRanges,
            currentIndex: currentCharIndexRef.current,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();

          if (data.reconstructed) {
            const currentRealtimeIndex = currentCharIndexRef.current;

            const lastSkipEnd = skippedRanges[skippedRanges.length - 1].end;
            if (currentRealtimeIndex - lastSkipEnd > 500) {
              console.log("Suggestion dropped: User moved too far.");
            } else {
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

    let foundSentenceIndex = 0;
    let foundPhraseIndex = 0;

    for (let sIdx = 0; sIdx < parsedScript.length; sIdx++) {
      const sentence = parsedScript[sIdx];

      if (currentCharIndex >= sentence.endIndex) {
        foundSentenceIndex = Math.min(sIdx + 1, parsedScript.length - 1);
        foundPhraseIndex = 0;
        continue;
      }

      if (currentCharIndex >= sentence.startIndex) {
        foundSentenceIndex = sIdx;

        for (let pIdx = 0; pIdx < sentence.phrases.length; pIdx++) {
          const phrase = sentence.phrases[pIdx];
          if (currentCharIndex < phrase.endIndex) {
            foundPhraseIndex = pIdx;
            break;
          }
        }
        break;
      }
    }

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
  }, [currentSentenceIndex, parsedScript.length, autoAdvanceSlides, isRunning, currentPage]);

  // Get visible sentences for rolling viewport (current +/- 2)
  const visibleSentences = useMemo(() => {
    // 위에서 2번째 줄에 현재 문장을 고정하기 위한 오프셋
    // [-1, 0, 1, 2] = (이전 문장, 현재 문장, 다음 1~2문장)
    const offsets = [-1, 0, 1, 2];
  
    return offsets
      .map((offset) => {
        const index = currentSentenceIndex + offset;
        if (index < 0 || index >= parsedScript.length) return null;
  
        return {
          sentence: parsedScript[index],
          globalIndex: index,
          position: offset, // -1, 0, 1, 2
        };
      })
      .filter(
        (item): item is { sentence: Sentence; globalIndex: number; position: number } =>
          item !== null
      );
  }, [parsedScript, currentSentenceIndex]);  

  // 텍스트를 스킵된 부분과 정상 부분으로 나누어 렌더링하는 헬퍼 함수
  const renderTextWithSkipped = (
    text: string,
    sentenceStart: number,
    className: string,
    style?: React.CSSProperties
  ) => {
    const sentenceEnd = sentenceStart + text.length;
    const relevantSkips = skippedRanges.filter(
      range => range.start < sentenceEnd && range.end > sentenceStart
    );

    if (relevantSkips.length === 0) {
      return (
        <span className={className} style={style}>
          {text}
        </span>
      );
    }

    const segments: Array<{ text: string; isSkipped: boolean }> = [];
    let lastIndex = 0;

    for (const range of relevantSkips) {
      const skipStartInSentence = Math.max(0, range.start - sentenceStart);
      const skipEndInSentence = Math.min(text.length, range.end - sentenceStart);

      if (skipStartInSentence > lastIndex) {
        segments.push({
          text: text.substring(lastIndex, skipStartInSentence),
          isSkipped: false,
        });
      }
      if (skipEndInSentence > skipStartInSentence) {
        segments.push({
          text: text.substring(skipStartInSentence, skipEndInSentence),
          isSkipped: true,
        });
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
            style={seg.isSkipped ? { color: '#FF0000' } : style}
          >
            {seg.text}
          </span>
        ))}
      </>
    );
  };

  const renderSentenceWithHighlight = (sentence: Sentence, position: number) => {
    if (position < 0) {
      // Previous sentence - 스킵된 부분은 빨간색, 나머지는 회색
      return renderTextWithSkipped(sentence.text, sentence.startIndex, "text-[#D0D0D0]");
    } else if (position === 0) {
      // Current sentence - entire text in blue, current phrase with blue bg + white text
      const currentSentence = parsedScript[currentSentenceIndex];
      const currentPhrase = currentSentence.phrases[currentPhraseInSentence];

      if (!currentPhrase) {
        return renderTextWithSkipped(sentence.text, sentence.startIndex, "text-[#0064FF]");
      }

      const phraseStartInSentence = currentPhrase.startIndex - sentence.startIndex;
      const phraseEndInSentence = currentPhrase.endIndex - sentence.startIndex;

      const beforePhrase = sentence.text.substring(0, phraseStartInSentence);
      const phraseText = sentence.text.substring(phraseStartInSentence, phraseEndInSentence);
      const afterPhrase = sentence.text.substring(phraseEndInSentence);

      return (
        <>
          {renderTextWithSkipped(beforePhrase, sentence.startIndex, "text-[#0064FF]")}
          <span className="bg-[#0064FF] text-white px-1.5 py-0.5 rounded">
            {phraseText}
          </span>
          {renderTextWithSkipped(afterPhrase, sentence.startIndex + phraseEndInSentence, "text-[#0064FF]")}
        </>
      );
    } else {
      // Upcoming sentence
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
      if (newIndex > currentCharIndexRef.current) {
        currentCharIndexRef.current = newIndex;
        setCurrentCharIndex(newIndex);
      }

      if (skippedRange && skippedRange.end > skippedRange.start + 1) {
        setSkippedRanges(prev => {
          const isRedundant = prev.some(
            r => r.start <= skippedRange.start && r.end >= skippedRange.end
          );
          if (isRedundant) return prev;
          return [...prev, skippedRange];
        });
      }
    },
    []
  );

  // Web Speech API 초기화 (한 번만)
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
      if (isRunningRef.current && !intentionalStopRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (err) {
            // ignore
          }
        }, 100);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === "aborted") {
        setIsListening(false);
        return;
      }

      if (event.error === "no-speech") {
        if (isRunningRef.current && !intentionalStopRef.current) {
          setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // ignore
            }
          }, 100);
        }
        return;
      }

      console.error("❌ Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
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

      if (finalTranscript.trim()) {
        setCumulativeTranscript(prev => {
          const updated = (prev + " " + finalTranscript).trim();
          return updated.length > 200 ? updated.slice(-200) : updated;
        });
      }

      const currentText = (finalTranscript || interimTranscript).trim();
      const searchText = (cumulativeTranscriptRef.current.slice(-100) + " " + currentText).trim();
      if (!searchText || searchText.length < 2) return;

      setTranscript(currentText);

      const now = Date.now();
      if (pendingApiCall.current || (now - lastApiCallTime.current) < 50) {
        return;
      }

      pendingApiCall.current = true;
      lastApiCallTime.current = now;

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
        } catch {
          // ignore
        }
      }
    };
  }, [handleMatchUpdate]);

  const handlePlayPause = async () => {
    const newRunningState = !isRunning;
    setIsRunning(newRunningState);

    if (newRunningState) {
      if (currentCharIndex === 0) {
        setCumulativeTranscript("");
        setSkippedRanges([]);
        setElapsedSeconds(0);
      }

      intentionalStopRef.current = false;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch {
          // ignore
        }
      }
    } else {
      intentionalStopRef.current = true;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    }
  };

  const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

  // 시간 초과 여부 계산
  const isOverTime = targetTimeSeconds > 0 && elapsedSeconds > targetTimeSeconds;

  const handleApplySuggestion = () => {
    if (!reconstructedSuggestion) return;

    const insertAt = Math.min(suggestionInsertIndex, modifiedScript.length);
    const before = modifiedScript.slice(0, insertAt);
    const after = modifiedScript.slice(insertAt);
    const merged = `${before}${before.endsWith(' ') ? '' : ' '}${reconstructedSuggestion}${
      reconstructedSuggestion.endsWith(' ') ? '' : ' '
    }${after}`;

    setModifiedScript(merged);
    setShowSuggestionBanner(false);
    setReconstructedSuggestion(null);
    setSkippedRanges([]);
    setCumulativeTranscript("");
  };

  const handleDismissSuggestion = () => {
    setShowSuggestionBanner(false);
    setReconstructedSuggestion(null);
  };

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

              {/* Teleprompter Text - 상단부터 쌓이고, 제안 카드가 문장 밑에 뜸 */}
              <div className="flex-grow relative overflow-hidden px-12 py-10">
                {/* 제안 뜰 때 연노랑 오버레이 */}
                <div
                  className={`absolute inset-0 bg-[#FFFBEB] transition-opacity duration-300 pointer-events-none ${
                    showSuggestionBanner && reconstructedSuggestion ? "opacity-50" : "opacity-0"
                  }`}
                />

                <div
                  className="w-full max-w-5xl mx-auto relative z-10 mt-6"
                  style={{
                    fontSize: `${fontSize}px`,
                    fontWeight: 600,
                    lineHeight: 1.7,
                  }}
                >
                  {visibleSentences.map(({ sentence, globalIndex, position }) => {
                    const opacity = getSentenceOpacity(position);

                    // 이 문장 안에 삽입점이 들어있는 경우만 인라인 제안 카드 표시
                    const showInlineSuggestion =
                      !!reconstructedSuggestion &&
                      showSuggestionBanner &&
                      suggestionInsertIndex > sentence.startIndex &&
                      suggestionInsertIndex <= sentence.endIndex;

                    return (
                      <div
                        key={globalIndex}
                        className="transition-all duration-500 ease-out mb-8"
                        style={{ opacity }}
                      >
                        {renderSentenceWithHighlight(sentence, position)}

                        {showInlineSuggestion && (
                          <div
                            className="
                              mt-6 w-full
                              rounded-xl
                              p-5
                              shadow-[0_4px_12px_rgba(15,23,42,0.08)]
                              flex flex-col
                            "
                            style={{
                              backgroundColor: "#FFF9E6",
                              border: "1px solid #FFE88F",
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Plus className="size-5 text-[#B8860B]" />
                                <span
                                  className="font-semibold text-[#030213]"
                                  style={{ fontSize: "15px" }}
                                >
                                  누락 내용 제안:
                                </span>
                              </div>
                              <button
                                onClick={handleDismissSuggestion}
                                className="inline-flex items-center justify-center rounded-full p-1.5 hover:bg-black/5 transition-colors"
                                aria-label="제안 닫기"
                              >
                                <X className="w-4 h-4 text-[#B8860B]" />
                              </button>
                            </div>

                            {reconstructedSuggestion && (
                              <p
                                className="leading-relaxed mb-4"
                                style={{
                                  opacity: 0.85,
                                  color: "#4B5563",
                                  fontSize: `${fontSize * 0.9}px`,
                                }}
                              >
                                {reconstructedSuggestion}
                              </p>
                            )}

                            <div className="flex justify-end">
                              <Button
                                onClick={handleApplySuggestion}
                                className="
                                  h-10
                                  px-6
                                  rounded-lg
                                  bg-white
                                  text-[#0064FF]
                                  border border-[#0064FF]
                                  hover:bg-gray-100
                                  text-sm font-semibold
                                  transition-transform
                                  hover:scale-[1.02] active:scale-[0.98]
                                "
                              >
                                적용
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Font Size Controls - 텍스트와 안 겹치게 위쪽 */}
                <div className="absolute top-2 right-8 flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg border border-[rgba(0,0,0,0.1)] px-3 py-2 shadow-sm">
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

                {/* 실시간 음성 인식
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
                </div> */}

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
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      autoAdvanceSlides ? 'bg-[#34c759]' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        autoAdvanceSlides ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
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
