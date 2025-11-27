import { Button } from "../components/ui/button";

interface EndPresentationModalProps {
  onStartMeeting: () => void;
  onFinish: () => void;
}

export default function EndPresentationModal({ onStartMeeting, onFinish }: EndPresentationModalProps) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-[rgba(0,0,0,0.06)] p-8 w-[480px] text-center">
        <h2 className="text-xl font-semibold text-[#030213] mb-3">발표 종료</h2>
        
        <p className="text-[#030213] mb-2 leading-relaxed">
          후속 회의를 바로 시작하시겠습니까?
        </p>
        
        <p className="text-sm text-[#717182] mb-8 leading-relaxed">
          발표에서 다룬 내용이 회의의 Agenda Map으로 정리되어 표시됩니다.
        </p>

        <div className="flex flex-col gap-3">
          <Button 
            onClick={onStartMeeting}
            className="w-full h-11 bg-[#0064FF] hover:bg-[#0052CC] text-white rounded-lg shadow-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            후속 회의 시작하기
          </Button>
          
          <Button 
            onClick={onFinish}
            variant="outline"
            className="w-full h-11 border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            종료하기
          </Button>
        </div>
      </div>
    </div>
  );
}