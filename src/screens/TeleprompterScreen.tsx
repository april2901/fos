import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { StatusPill } from "../components/StatusPill";
import { Play, Pause, FileText, Type, Mic } from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";

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

export default function TeleprompterScreen({ presentationTitle, script, onEnd, onKeywordsExtracted, onHomeClick, onBack }: TeleprompterScreenProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentPhraseInSentence, setCurrentPhraseInSentence] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [autoAdvanceSlides, setAutoAdvanceSlides] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [speed, setSpeed] = useState<"느림" | "적정" | "빠름">("적정");
  const [volume, setVolume] = useState(6.5);
  const [fontSize, setFontSize] = useState(32); // Default font size in px

  // Web Speech API states
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [cumulativeTranscript, setCumulativeTranscript] = useState(""); // 누적 음성 인식 결과
  const [skippedRanges, setSkippedRanges] = useState<Array<{ start: number; end: number }>>([]); // 틀린 부분 (스킵된 구간)
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);
  const isRunningRef = useRef(isRunning); // isRunning을 ref로 추적
  const pendingApiCall = useRef(false); // API 호출 중복 방지
  const lastApiCallTime = useRef(0); // 마지막 API 호출 시간

  // isRunning 상태를 ref에 동기화
  useEffect(() => {
    isRunningRef.current = isRunning;
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

  const fullScript = script;

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

  // currentCharIndex가 변경되면 해당하는 문장/구절 인덱스 계산
  useEffect(() => {
    if (parsedScript.length === 0) return;

    // 현재 문자 위치에 해당하는 문장 찾기
    let foundSentenceIndex = 0;
    let foundPhraseIndex = 0;

    for (let sIdx = 0; sIdx < parsedScript.length; sIdx++) {
      const sentence = parsedScript[sIdx];

      // 현재 위치가 이 문장 범위 안에 있는지 확인
      if (currentCharIndex >= sentence.startIndex && currentCharIndex < sentence.endIndex) {
        foundSentenceIndex = sIdx;

        // 문장 내에서 현재 구절 찾기
        for (let pIdx = 0; pIdx < sentence.phrases.length; pIdx++) {
          const phrase = sentence.phrases[pIdx];
          if (currentCharIndex >= phrase.startIndex && currentCharIndex < phrase.endIndex) {
            foundPhraseIndex = pIdx;
            break;
          } else if (currentCharIndex >= phrase.endIndex) {
            // 이 구절을 지나쳤으면 다음 구절로
            foundPhraseIndex = Math.min(pIdx + 1, sentence.phrases.length - 1);
          }
        }
        break;
      } else if (currentCharIndex >= sentence.endIndex) {
        // 이 문장을 완전히 지나쳤으면 다음 문장으로
        foundSentenceIndex = Math.min(sIdx + 1, parsedScript.length - 1);
        foundPhraseIndex = 0;
      }
    }

    // 상태 업데이트 (변경된 경우에만)
    if (foundSentenceIndex !== currentSentenceIndex) {
      setCurrentSentenceIndex(foundSentenceIndex);
      setCurrentPhraseInSentence(foundPhraseIndex);
    } else if (foundPhraseIndex !== currentPhraseInSentence) {
      setCurrentPhraseInSentence(foundPhraseIndex);
    }
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
      console.log('🎙️ 음성 인식 시작됨');
      setIsListening(true);
    };

    recognition.onend = () => {
      console.log('🔴 음성 인식 종료됨, isRunning:', isRunningRef.current);
      setIsListening(false);
      // isRunning이 true면 자동 재시작
      if (isRunningRef.current) {
        setTimeout(() => {
          try {
            recognition.start();
            console.log('🔄 음성 인식 재시작');
          } catch (err) {
            console.error("Failed to restart recognition:", err);
          }
        }, 100);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // aborted는 정상적인 중지 시 발생하므로 로그만 남김
      if (event.error === "aborted") {
        console.log('ℹ️ 음성 인식 중지됨 (aborted)');
        setIsListening(false);
        return;
      }

      // no-speech는 조용할 때 발생 - 에러 아님
      if (event.error === "no-speech") {
        console.log('🔇 음성 감지 안 됨 - 재시작 시도');
        // no-speech 후 자동 재시작
        if (isRunningRef.current) {
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
        console.log('⏸️ 일시정지 상태 - 음성 무시');
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

      // API 호출 쓰로틀링: 이미 호출 중이거나 150ms 이내면 스킵
      const now = Date.now();
      if (pendingApiCall.current || (now - lastApiCallTime.current) < 150) {
        return;
      }

      // Final 결과일 때만 API 호출 (interim은 UI 업데이트만)
      if (!finalTranscript.trim() && interimTranscript.length < 10) {
        return;
      }

      pendingApiCall.current = true;
      lastApiCallTime.current = now;

      // 백엔드 API를 통한 음성-스크립트 매칭
      try {
        const response = await fetch('/api/speech-comparison', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            spokenText: searchText,
            scriptText: fullScript,
            lastMatchedIndex: currentCharIndexRef.current,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result && typeof result.currentMatchedIndex === 'number') {
            const newIndex = result.currentMatchedIndex;
            if (result.isCorrect && newIndex > currentCharIndexRef.current) {
              // 스킵된 부분이 있으면 저장
              if (result.skippedRange) {
                setSkippedRanges(prev => [...prev, result.skippedRange]);
              }
              setCurrentCharIndex(newIndex);
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
  }, [fullScript]); // fullScript가 변경될 때만 재초기화

  const handlePlayPause = async () => {
    const newRunningState = !isRunning;
    setIsRunning(newRunningState);

    if (newRunningState) {
      // 시작할 때 누적 transcript 초기화 (처음 시작할 때만)
      if (currentCharIndex === 0) {
        setCumulativeTranscript("");
        setSkippedRanges([]); // 틀린 부분도 초기화
      }

      // 음성 인식 시작
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          console.log('▶️ 발표 시작 - 음성 인식 활성화');
        } catch (err) {
          // 이미 시작된 경우 무시
          console.log('ℹ️ 음성 인식이 이미 활성화되어 있음');
        }
      }
    } else {
      // 일시정지
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          console.log('⏸️ 발표 일시정지 - 음성 인식 중지');
        } catch (err) {
          // 이미 중지된 경우 무시
        }
      }
    }
  };

  const volumeCategory = volume < 4 ? "작음" : volume > 7.5 ? "큼" : "적정";
  const nextPage = currentPage < totalPages ? currentPage + 1 : totalPages;

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

                {/* 발표 속도 */}
                <div>
                  <p className="text-xs text-[#717182] mb-2 font-medium">발표 속도</p>
                  <div className="flex gap-2">
                    <div className={`flex-1 h-9 rounded-lg border flex items-center justify-center text-xs transition-all ${speed === "느림"
                      ? 'bg-[#0064FF] text-white font-semibold shadow-sm border-[#0064FF]'
                      : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#717182]'
                      }`}>
                      느림
                    </div>
                    <div className={`flex-1 h-9 rounded-lg border flex items-center justify-center text-xs transition-all ${speed === "적정"
                      ? 'bg-[#0064FF] text-white font-semibold shadow-sm border-[#0064FF]'
                      : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#717182]'
                      }`}>
                      적정
                    </div>
                    <div className={`flex-1 h-9 rounded-lg border flex items-center justify-center text-xs transition-all ${speed === "빠름"
                      ? 'bg-[#0064FF] text-white font-semibold shadow-sm border-[#0064FF]'
                      : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#717182]'
                      }`}>
                      빠름
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