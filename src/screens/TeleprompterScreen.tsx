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

export default function TeleprompterScreen({ presentationTitle, script, onEnd, onHomeClick, onBack }: TeleprompterScreenProps) {
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
  const recognitionRef = useRef<CustomSpeechRecognition | null>(null);

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

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setCurrentCharIndex((prev) => {
        if (prev >= fullScript.length - 1) {
          setIsRunning(false);
          return prev;
        }

        const newCharIndex = prev + 1;

        // Find which sentence and phrase we're in
        let charCount = 0;
        for (let sentIdx = 0; sentIdx < parsedScript.length; sentIdx++) {
          const sentence = parsedScript[sentIdx];
          const sentenceEnd = charCount + sentence.text.length;

          if (newCharIndex <= sentenceEnd) {
            // We're in this sentence
            setCurrentSentenceIndex(sentIdx);

            // Find which phrase within this sentence
            for (let phraseIdx = 0; phraseIdx < sentence.phrases.length; phraseIdx++) {
              const phrase = sentence.phrases[phraseIdx];
              const phraseLength = phrase.endIndex - phrase.startIndex;
              const progressInPhrase = newCharIndex - phrase.startIndex;
              const progressPercent = progressInPhrase / phraseLength;

              if (newCharIndex >= phrase.startIndex && newCharIndex <= phrase.endIndex) {
                if (progressPercent >= 0.7 && phraseIdx < sentence.phrases.length - 1) {
                  setCurrentPhraseInSentence(phraseIdx + 1);
                } else {
                  setCurrentPhraseInSentence(phraseIdx);
                }
                break;
              }
            }
            break;
          }
          charCount = sentenceEnd + 1;
        }

        return newCharIndex;
      });

      if (Math.random() > 0.7) {
        const speeds: ("느림" | "적정" | "빠름")[] = ["느림", "적정", "빠름"];
        setSpeed(speeds[Math.floor(Math.random() * 3)]);
        setVolume(Math.random() * 4 + 5);
      }
    }, 80);

    return () => clearInterval(interval);
  }, [isRunning, fullScript.length, parsedScript]);

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

  const renderSentenceWithHighlight = (sentence: Sentence, position: number) => {
    if (position < 0) {
      // Previous sentence - light gray
      return (
        <span className="text-[#D0D0D0]">
          {sentence.text}
        </span>
      );
    } else if (position === 0) {
      // Current sentence - entire text in blue, current phrase with blue bg + white text
      const currentSentence = parsedScript[currentSentenceIndex];
      const currentPhrase = currentSentence.phrases[currentPhraseInSentence];

      if (!currentPhrase) {
        return <span className="text-[#0064FF]">{sentence.text}</span>;
      }

      // Split sentence into parts: before current phrase, current phrase, after current phrase
      const phraseStartInSentence = currentPhrase.startIndex - sentence.startIndex;
      const phraseEndInSentence = currentPhrase.endIndex - sentence.startIndex;

      const beforePhrase = sentence.text.substring(0, phraseStartInSentence);
      const phraseText = sentence.text.substring(phraseStartInSentence, phraseEndInSentence);
      const afterPhrase = sentence.text.substring(phraseEndInSentence);

      return (
        <>
          <span className="text-[#0064FF]">{beforePhrase}</span>
          <span className="bg-[#0064FF] text-white px-1.5 py-0.5 rounded">{phraseText}</span>
          <span className="text-[#0064FF]">{afterPhrase}</span>
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

  // Initialize Web Speech API
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
      if (isRunning) {
        try {
          recognition.start();
        } catch (err) {
          console.error("Failed to restart recognition:", err);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setIsListening(false);
      }
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = (finalTranscript || interimTranscript).trim();
      setTranscript(fullTranscript);

      // Match spoken text to script for synchronization
      if (fullTranscript) {
        matchSpeechToScript(fullTranscript);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRunning]);

  // Match speech to script for synchronization
  const matchSpeechToScript = (spokenText: string) => {
    const lowerSpoken = spokenText.toLowerCase();
    const lowerScript = fullScript.toLowerCase();

    // Simple substring matching
    const matchIndex = lowerScript.indexOf(lowerSpoken.slice(-50)); // Last 50 chars

    if (matchIndex !== -1) {
      setCurrentCharIndex(matchIndex + lowerSpoken.slice(-50).length);
    }
  };

  const handlePlayPause = async () => {
    const newRunningState = !isRunning;
    setIsRunning(newRunningState);

    if (recognitionRef.current) {
      if (newRunningState) {
        try {
          await recognitionRef.current.start();
        } catch (err) {
          console.error("Failed to start recognition:", err);
        }
      } else {
        recognitionRef.current.stop();
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

                <div>
                  <p className="text-xs text-[#717182] mb-2 font-medium">발표 볼륨</p>
                  <div className="mb-2">
                    <span className="text-xs text-[#717182]">볼륨: </span>
                    <span className="text-base font-semibold text-[#0064FF]">
                      {volume.toFixed(1)} / 10
                    </span>
                    <span className="text-xs text-[#717182] ml-1">({volumeCategory})</span>
                  </div>
                  <div className="flex gap-2">
                    <div className={`flex-1 h-9 rounded-lg border flex items-center justify-center text-xs transition-all ${volumeCategory === "작음"
                        ? 'bg-[#0064FF] text-white font-semibold shadow-sm border-[#0064FF]'
                        : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#717182]'
                      }`}>
                      작음
                    </div>
                    <div className={`flex-1 h-9 rounded-lg border flex items-center justify-center text-xs transition-all ${volumeCategory === "적정"
                        ? 'bg-[#0064FF] text-white font-semibold shadow-sm border-[#0064FF]'
                        : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#717182]'
                      }`}>
                      적정
                    </div>
                    <div className={`flex-1 h-9 rounded-lg border flex items-center justify-center text-xs transition-all ${volumeCategory === "큼"
                        ? 'bg-[#0064FF] text-white font-semibold shadow-sm border-[#0064FF]'
                        : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#717182]'
                      }`}>
                      큼
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