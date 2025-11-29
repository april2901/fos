import { Home, User, ChevronLeft } from "lucide-react";
import { Logo } from "./Logo";

interface TopNavBarProps {
  title?: string;
  showUser?: boolean;
  userName?: string;
  showHomeButton?: boolean;
  onHomeClick?: () => void;
  showBackButton?: boolean;
  onBackClick?: () => void;
}

export function TopNavBar({ title, showUser = true, userName = "김민수", showHomeButton = true, onHomeClick, showBackButton = false, onBackClick }: TopNavBarProps) {
  return (
    <div className="sticky relative top-0 left-0 right-0 h-16 bg-white border-b border-[rgba(0,0,0,0.08)] z-50 flex items-center justify-between px-6">
      <div className="flex items-center gap-2">
        {showHomeButton ? (
          <>
            <button 
              onClick={onHomeClick}
              className="flex items-center justify-center size-9 hover:bg-[#F4F6FF] rounded-lg transition-colors"
              aria-label="메인으로 이동"
              title="메인으로 이동"
            >
              <Home className="size-5 text-[#717182]" />
            </button>
            {showBackButton && (
              <button 
                onClick={onBackClick}
                className="flex items-center justify-center size-9 hover:bg-[#F4F6FF] rounded-lg transition-colors"
                aria-label="이전 화면으로 이동"
                title="이전 화면으로 이동"
              >
                <ChevronLeft className="size-5 text-[#717182]" />
              </button>
            )}
          </>
        ) : (
          <Logo size="sm" />
        )}
      </div>
      
      {title && (
        <h1 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-lg font-semibold text-[#030213] whitespace-nowrap pointer-events-none">
          {title}
        </h1>
      )}
      
      {showUser && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#717182]">{userName}</span>
          <button className="flex items-center justify-center size-9 bg-[#F4F6FF] rounded-full hover:bg-[#e9ebef] transition-colors">
            <User className="size-5 text-[#717182]" />
          </button>
        </div>
      )}
    </div>
  );
}