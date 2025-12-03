import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Upload, Info, AlertTriangle } from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

interface PresentationSetupScreenProps {
  onComplete: (title: string, script: string, targetTimeSeconds: number) => void; // targetTimeSeconds 추가
  onHomeClick: () => void;
  onBack: () => void;
}

export default function PresentationSetupScreen({ onComplete, onHomeClick, onBack }: PresentationSetupScreenProps) {
  const [presentationTitle, setPresentationTitle] = useState("");
  const [script, setScript] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [showTimeTooltip, setShowTimeTooltip] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 컬포넌트 마운트 시 최근 스크립트 불러오기
  useEffect(() => {
    const fetchLatestScript = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          console.log('로그인하지 않음');
          setIsLoading(false);
          return;
        }

        // 가장 최근 저장된 세션 가져오기
        const { data, error } = await supabase
          .schema('fos')
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          console.log('저장된 스크립트 없음:', error);
          setIsLoading(false);
          return;
        }

        if (data) {
          console.log('불러온 스크립트:', data);
          setPresentationTitle(data.title || '');
          setScript(data.script_content || '');
        }

        setIsLoading(false);
      } catch (err) {
        console.error('스크립트 불러오기 오류:', err);
        setIsLoading(false);
      }
    };

    fetchLatestScript();
  }, []);

  // Calculate character units for mixed-language script
  const { totalUnits, estimatedSeconds } = useMemo(() => {
    let units = 0;

    for (const char of script) {
      // Hangul syllables: 1.0 unit
      if (/[\u3131-\u314e\u314f-\u3163\uac00-\ud7a3]/.test(char)) {
        units += 1.0;
      }
      // English letters, digits, visible symbols/punctuation: 0.5 unit
      else if (/[a-zA-Z0-9!-/:-@[-`{-~]/.test(char)) {
        units += 0.5;
      }
      // Whitespace and line breaks: 0 (ignored)
    }

    const seconds = Math.floor(units / 5);
    return { totalUnits: units, estimatedSeconds: seconds };
  }, [script]);

  // Format seconds to MM:SS or HH:MM:SS
  const formatTime = (totalSeconds: number): string => {
    if (totalSeconds === 0) return "0초";

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${seconds}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    } else {
      return `${seconds}초`;
    }
  };

  // Parse target time input (handles MM:SS or HH:MM:SS format)
  const parseTargetTime = (input: string): number => {
    if (!input) return 0;

    const parts = input.split(':').map(p => parseInt(p) || 0);

    if (parts.length === 1) {
      // If user enters just a number (e.g. "10"), treat as minutes
      return parts[0] * 60;
    } else if (parts.length === 2) {
      // MM:SS
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      // HH:MM:SS
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    return 0;
  };

  // Format input as user types (auto-insert colons)
  const handleTargetTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^0-9]/g, ''); // Remove non-digits

    if (value.length === 0) {
      setTargetTime('');
      return;
    }

    // Auto-format based on length
    if (value.length <= 4) {
      // MM:SS format
      if (value.length >= 3) {
        value = value.slice(0, 2) + ':' + value.slice(2);
      }
    } else {
      // HH:MM:SS format
      if (value.length <= 6) {
        const hours = value.slice(0, -4) || '0';
        const minutes = value.slice(-4, -2);
        const seconds = value.slice(-2);
        value = hours + ':' + minutes + ':' + seconds;
      } else {
        value = value.slice(0, 6);
        const hours = value.slice(0, -4);
        const minutes = value.slice(-4, -2);
        const seconds = value.slice(-2);
        value = hours + ':' + minutes + ':' + seconds;
      }
    }

    setTargetTime(value);
  };

  // Calculate difference between estimated and target
  const targetSeconds = parseTargetTime(targetTime);
  const timeDifference = estimatedSeconds - targetSeconds;

  // Convert time difference to equivalent Hangul character units
  // Since 5 units = 1 second, difference in seconds * 5 = difference in units
  const unitDifference = timeDifference * 5;
  // Round to whole number for display
  const charEquivalent = Math.round(Math.abs(unitDifference));

  const needsAdjustment = targetTime && Math.abs(timeDifference) > 30; // More than 30 seconds difference

  // Check if target time is significantly shorter (more than 70% shorter or 2+ minutes shorter)
  const isTooShort = targetTime && targetSeconds > 0 && (
    timeDifference > 120 || // More than 2 minutes shorter
    (estimatedSeconds > 0 && targetSeconds < estimatedSeconds * 0.7) // Target is less than 70% of estimated
  );

  const tooltipText = useMemo(() => {
    if (!targetTime) {
      return "발표 시간은 한글 5글자(또는 영문·숫자·기호 10자)를 1초로 환산해 계산합니다.";
    }

    if (unitDifference > 0) {
      return `발표 시간은 한글 5글자(또는 영문·숫자·기호 10자)를 1초로 환산해 계산합니다.\n현재 스크립트는 목표 시간보다 약 ${charEquivalent}글자 분량만큼 깁니다.`;
    } else if (unitDifference < 0) {
      return `발표 시간은 한글 5글자(또는 영문·숫자·기호 10자)를 1초로 환산해 계산합니다.\n현재 스크립트는 목표 시간보다 약 ${charEquivalent}글자 분량만큼 짧습니다.`;
    } else {
      return `발표 시간은 한글 5글자(또는 영문·숫자·기호 10자)를 1초로 환산해 계산합니다.\n현재 스크립트는 목표 시간과 일치합니다.`;
    }
  }, [targetTime, unitDifference, charEquivalent]);

  const isFormValid = presentationTitle.trim().length > 0 && script.trim().length > 0;

  // 스크립트를 DB에 저장하고 다음 화면으로 이동
  const handleComplete = async () => {
    if (!isFormValid || isSaving) return;

    setIsSaving(true);

    try {
      // 현재 로그인한 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('사용자 인증 오류:', userError);
        alert('로그인이 필요합니다.');
        setIsSaving(false);
        return;
      }

      // upsert 사용: user_id가 unique constraint라면 자동으로 UPDATE, 아니면 INSERT
      const { error } = await supabase
        .schema('fos')
        .from('sessions')
        .upsert({
          user_id: user.id,
          script_content: script,
          title: presentationTitle,
        }, {
          onConflict: 'user_id', // user_id가 중복되면 UPDATE
        });

      if (error) {
        console.error('스크립트 저장 실패:', error);
        alert('스크립트 저장에 실패했습니다.');
        setIsSaving(false);
        return;
      }

      console.log('스크립트 저장 성공');

      // 저장 성공 후 다음 화면으로 (targetSeconds도 함께 전달)
      onComplete(presentationTitle, script, targetSeconds);
    } catch (err) {
      console.error('예외 발생:', err);
      alert('오류가 발생했습니다.');
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#FAFBFC] flex flex-col">
      <TopNavBar title="발표 준비" onHomeClick={onHomeClick} showBackButton={true} onBackClick={onBack} />

      <div className="px-8 py-8 pb-10 overflow-y-auto flex-1">
        {/* Title Input */}
        <div className="mb-6 max-w-7xl mx-auto">
          <Label className="text-sm font-medium mb-2 block text-[#030213]">발표 제목</Label>
          <Input
            placeholder="예: LG전자 미래사업전략 보고 회의안 발표"
            value={presentationTitle}
            onChange={(e) => setPresentationTitle(e.target.value)}
            className="h-12 rounded-lg border-[rgba(0,0,0,0.1)] bg-white"
          />
        </div>

        <div
          className="flex gap-6 max-w-7xl mx-auto"
          style={{ height: "950px" }}
        >
          <div className="flex-[2] h-full">
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6 h-18 flex flex-col">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <h3 className="text-base font-semibold text-[#030213]">스크립트 입력</h3>
                <span className="text-xs text-[#717182]">
                  {script.length > 0 ? `${script.length}자` : ''}
                </span>
              </div>

              <Textarea
                placeholder="여기에 발표 스크립트를 붙여넣으세요."
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="rounded-lg border-[rgba(0,0,0,0.1)] bg-[#FAFBFC] resize-none text-sm leading-relaxed p-4"
                style={{
                  height: "800px",
                  maxHeight: "800px",
                  overflowY: "auto",
                }}
              />

              <p className="text-xs text-[#717182] mt-3 leading-relaxed shrink-0">
                스크립트는 실시간 STT와 음절 단위로 매칭되어 텔레프롬프터에 표시됩니다.
              </p>
            </div>
          </div>

          {/* Right Column - File Upload & Time (자연스럽게 쌓임) */}
          <div className="flex-1 flex flex-col gap-6">
            {/* File Upload */}
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <h3 className="text-base font-semibold text-[#030213] mb-4">발표 자료 입력</h3>

              <div className="border-2 border-dashed border-[rgba(0,0,0,0.1)] rounded-lg bg-[#FAFBFC] p-8 flex flex-col items-center justify-center mb-4 cursor-pointer hover:border-[#0064FF] hover:bg-[#F4F6FF] transition-all">
                <Upload className="size-10 text-[#717182] mb-2" />
                <p className="text-center text-sm text-[#717182]">
                  클릭하거나 드래그하여 업로드
                  <br />
                  <span className="text-xs">(pptx, pdf)</span>
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full h-10 border-[#0064FF] text-[#0064FF] hover:bg-[#F4F6FF] rounded-lg text-sm"
              >
                자료-스크립트 자동 매칭
              </Button>
            </div>

            {/* Time Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <h3 className="text-base font-semibold text-[#030213] mb-4">발표 시간 설정</h3>

              <div className="space-y-4">
                {/* Estimated Time */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Label className="text-xs text-[#717182]">예상 발표 시간</Label>
                    <div className="relative">
                      <button
                        onMouseEnter={() => setShowTimeTooltip(true)}
                        onMouseLeave={() => setShowTimeTooltip(false)}
                        className="text-[#717182] hover:text-[#0064FF] transition-colors"
                      >
                        <Info className="size-3.5" />
                      </button>
                      {showTimeTooltip && (
                        <div className="absolute left-0 top-full mt-2 w-72 bg-[#030213] text-white text-xs p-3 rounded-lg shadow-lg z-10 whitespace-pre-line leading-relaxed">
                          {tooltipText}
                          <div className="absolute -top-1 left-4 w-2 h-2 bg-[#030213] transform rotate-45" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`h-10 px-4 rounded-lg border flex items-center text-sm font-medium ${script.length === 0
                    ? 'bg-[#FAFBFC] border-[rgba(0,0,0,0.06)] text-[#717182]'
                    : 'bg-[#F4F6FF] border-[rgba(0,0,0,0.06)] text-[#0064FF]'
                    }`}>
                    {formatTime(estimatedSeconds)} {estimatedSeconds > 0 && '(자동 계산)'}
                  </div>
                </div>

                {/* Target Time */}
                <div>
                  <Label className="text-xs text-[#717182] mb-2 block">목표 발표 시간</Label>
                  <Input
                    placeholder="예: 10:00"
                    value={targetTime}
                    onChange={handleTargetTimeChange}
                    className="h-10 rounded-lg border-[rgba(0,0,0,0.1)] text-sm"
                  />
                </div>

                {/* Warning if adjustment needed */}
                {needsAdjustment && (
                  <div className={`flex items-start gap-2 p-3 rounded-lg border ${unitDifference > 0
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-blue-50 border-blue-200'
                    }`}>
                    <AlertTriangle className={`size-4 mt-0.5 shrink-0 ${unitDifference > 0 ? 'text-amber-600' : 'text-blue-600'
                      }`} />
                    <div className="flex flex-col gap-1">
                      <p className={`text-xs font-medium ${unitDifference > 0 ? 'text-amber-800' : 'text-blue-800'
                        }`}>
                        속도 조정 필요
                      </p>
                      <p className={`text-xs ${unitDifference > 0 ? 'text-amber-700' : 'text-blue-700'
                        }`}>
                        {unitDifference > 0
                          ? `스크립트를 약 ${charEquivalent}글자 가량 줄이거나 발표 속도를 높이세요.`
                          : `스크립트를 약 ${charEquivalent}글자 가량 늘리거나 발표 속도를 낮추세요.`
                        }
                      </p>
                    </div>
                  </div>
                )}

                {/* Strong warning if target time is too short */}
                {isTooShort && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border bg-red-50 border-red-200">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0 text-red-600" />
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold text-red-800">
                        ⚠️ 목표 시간이 너무 짧습니다
                      </p>
                      <p className="text-xs text-red-700 leading-relaxed">
                        예상 발표 시간보다 {formatTime(Math.abs(timeDifference))} 짧습니다. <strong>엄청 빠르게 말하거나</strong> 스크립트 분량을 약 <strong>{charEquivalent}글자 대폭 줄여야</strong> 합니다.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Button
              onClick={handleComplete}
              disabled={!isFormValid || isSaving}
              className={`h-12 rounded-lg shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98] ${isFormValid && !isSaving
                ? 'bg-[#0064FF] hover:bg-[#0052CC] text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed hover:bg-gray-200 hover:scale-100'
                }`}
            >
              {isSaving ? '저장 중...' : '발표 준비 완료'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}