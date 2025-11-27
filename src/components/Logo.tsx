interface LogoProps {
  size?: "sm" | "md" | "lg";
}

export function Logo({ size = "md" }: LogoProps) {
  const sizes = {
    sm: {
      text: "text-lg",
      spacing: "gap-1.5",
      icon: {
        size: "size-5",
        barGap: "gap-[2px]",
        bars: [
          { width: "w-[2px]", height: "h-2.5" },
          { width: "w-[2px]", height: "h-2" },
          { width: "w-[2px]", height: "h-3" }
        ]
      }
    },
    md: {
      text: "text-2xl",
      spacing: "gap-2",
      icon: {
        size: "size-7",
        barGap: "gap-[2px]",
        bars: [
          { width: "w-[3px]", height: "h-3.5" },
          { width: "w-[3px]", height: "h-2.5" },
          { width: "w-[3px]", height: "h-4" }
        ]
      }
    },
    lg: {
      text: "text-5xl",
      spacing: "gap-3",
      icon: {
        size: "size-11",
        barGap: "gap-1",
        bars: [
          { width: "w-1", height: "h-5" },
          { width: "w-1", height: "h-4" },
          { width: "w-1", height: "h-6" }
        ]
      }
    }
  };

  const currentSize = sizes[size];

  return (
    <div className={`flex items-center ${currentSize.spacing}`}>
      <span className={`font-['Poppins',sans-serif] font-semibold text-[#0064FF] ${currentSize.text}`}>
        Focus
      </span>
      
      {/* O replacement - circular icon with waveform */}
      <div className={`${currentSize.icon.size} rounded-full bg-[#0064FF] flex items-center justify-center shrink-0`}>
        <div className={`flex items-end ${currentSize.icon.barGap}`}>
          {currentSize.icon.bars.map((bar, index) => (
            <div 
              key={index}
              className={`${bar.width} ${bar.height} bg-white rounded-full`} 
            />
          ))}
        </div>
      </div>
      
      <span className={`font-['Poppins',sans-serif] font-semibold text-[#0064FF] ${currentSize.text}`}>
        n
      </span>
      
      <span className={`font-['Poppins',sans-serif] font-semibold text-[#0064FF] ${currentSize.text} ${currentSize.spacing}`}>
        Speaking
      </span>
    </div>
  );
}
