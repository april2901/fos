interface AgendaTagProps {
  type: string;
  active?: boolean;
  onClick?: () => void;
  asButton?: boolean;
}

export function AgendaTag({ type, active = false, onClick, asButton = true }: AgendaTagProps) {
  const typeColors: Record<string, string> = {
    "리서치": "bg-emerald-50 text-emerald-700 border-emerald-200",
    "아이디어": "bg-amber-50 text-amber-700 border-amber-200",
    "개발": "bg-blue-50 text-blue-700 border-blue-200",
    "디자인": "bg-purple-50 text-purple-700 border-purple-200",
    "일반": "bg-gray-50 text-gray-700 border-gray-200",
    "결정": "bg-purple-50 text-purple-700 border-purple-200",
    "Question": "bg-yellow-50 text-yellow-700 border-yellow-200",
    "Decision": "bg-purple-50 text-purple-700 border-purple-200",
    "Action Item": "bg-blue-50 text-blue-700 border-blue-200",
    "Idea": "bg-amber-50 text-amber-700 border-amber-200"
  };

  const className = `
    px-2.5 py-1 rounded-md text-xs font-medium border
    ${active ? 'ring-2 ring-[#0064FF] ring-offset-1' : ''}
    ${typeColors[type] || 'bg-gray-50 text-gray-700 border-gray-200'}
    ${asButton ? 'hover:opacity-80 transition-opacity' : ''}
  `;

  if (!asButton) {
    return (
      <div className={className}>
        {type}
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={className}
    >
      {type}
    </button>
  );
}