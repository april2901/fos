import { Button } from "../components/ui/button";
import { Users, Monitor, LogOut } from "lucide-react";
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface MainScreenProps {
  onStartMeeting: () => void;
  onStartPresentation: () => void;
  onBack: () => void;
}

export default function MainScreen({ onStartMeeting, onStartPresentation, onBack }: MainScreenProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
    } catch (error) {
      console.error('로그아웃 오류:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="w-full h-full bg-gradient-to-br from-[#F4F6FF] to-white">
      {/* Logout - 우측 상단 */}
      <div className="w-full flex justify-end p-6">
        <Button
          variant="outline"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 rounded-full px-4 py-2 border-[rgba(0,0,0,0.1)] hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
        >
          <LogOut className="size-4" />
          <span className="text-sm">{isLoggingOut ? '로그아웃 중...' : '로그아웃'}</span>
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center h-full px-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-2xl font-semibold text-[#030213] mt-8 mb-3">
            무엇을 준비하시겠어요?
          </h1>
          <p className="text-[#717182]">
            회의 또는 발표를 선택하세요
          </p>
        </div>

        {/* Cards */}
        <div className="flex gap-6 max-w-4xl w-full">
          {/* Meeting Card */}
          <div className="flex-1 bg-white rounded-2xl shadow-md border border-[rgba(0,0,0,0.06)] p-8 flex flex-col items-center hover:shadow-xl hover:scale-[1.03] hover:border-[#10B981]/20 transition-all duration-300 cursor-pointer">
            <div className="size-16 rounded-2xl bg-[#10B981] flex items-center justify-center mb-6">
              <Users className="size-8 text-white" />
            </div>
            
            <h2 className="text-lg font-semibold text-[#030213] mb-3">회의</h2>
            
            <p className="text-sm text-[#717182] text-center mb-10 leading-relaxed">
              실시간 아젠다 트래킹과<br />회의 키워드를 시각화합니다
            </p>

            <Button 
              onClick={onStartMeeting}
              className="w-full h-11 bg-[#10B981] hover:bg-[#059669] text-white rounded-lg shadow-sm transition-transform hover:scale-[1.05] active:scale-[0.98]"
            >
              회의 시작하기
            </Button>
          </div>

          {/* Presentation Card */}
          <div className="flex-1 bg-white rounded-2xl shadow-md border border-[rgba(0,0,0,0.06)] p-8 flex flex-col items-center hover:shadow-xl hover:scale-[1.03] hover:border-[#0064FF]/20 transition-all duration-300 cursor-pointer">
            <div className="size-16 rounded-2xl bg-[#0064FF] flex items-center justify-center mb-6">
              <Monitor className="size-8 text-white" />
            </div>
            
            <h2 className="text-lg font-semibold text-[#030213] mb-3">발표</h2>
            
            <p className="text-sm text-[#717182] text-center mb-10 leading-relaxed">
              스마트 텔레프롬프터로<br />완벽한 발표를 준비하세요
            </p>

            <Button 
              onClick={onStartPresentation}
              className="w-full h-11 bg-[#0064FF] hover:bg-[#0052CC] text-white rounded-lg shadow-sm transition-transform hover:scale-[1.05] active:scale-[0.98]"
            >
              발표 시작하기
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}