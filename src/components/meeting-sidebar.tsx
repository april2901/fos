import { Home, Download, X, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { useState } from "react";
import { Input } from "./ui/input";

interface Topic {
  name: string;
  centralNodes: {
    id: number;
    label: string;
    isHighlighted?: boolean;
  }[];
}

type Category = "리서치" | "아이디어" | "개발" | "디자인" | "일반";

interface MeetingSidebarProps {
  onNavigateHome?: () => void;
  fromPresentation?: boolean;
  topics: Topic[];
  onNodeNavigate: (nodeId: number) => void;
  onAddAgenda?: (text: string, category: Category) => void;
}

export function MeetingSidebar({
  onNavigateHome,
  fromPresentation,
  topics,
  onNodeNavigate,
  onAddAgenda,
}: MeetingSidebarProps) {
  const [showExportModal, setShowExportModal] = useState(false);
  const [agendaInput, setAgendaInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category>("리서치");

  const categoryColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {
    리서치: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
    아이디어: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", dot: "bg-orange-500" },
    개발: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
    디자인: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
    일반: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200", dot: "bg-gray-500" },
  };

  const handleAddAgenda = () => {
    const text = agendaInput.trim();
    if (!text) return;
    
    onAddAgenda?.(text, selectedCategory);
    setAgendaInput("");
  };

  return (
    <>
      <div className="w-[20%] bg-white border-r border-[rgba(0,0,0,0.06)] flex flex-col">
        {/* Top Actions */}
        <div className="p-4 border-b border-[rgba(0,0,0,0.06)]">
          <div className="flex gap-2">
            <Button
              onClick={onNavigateHome}
              variant="outline"
              className="flex-1 h-9 border-[rgba(0,0,0,0.1)] hover:bg-[#F4F6FF] rounded-lg"
            >
              <Home className="size-4 mr-1.5" />
              홈
            </Button>
            <Button
              onClick={() => setShowExportModal(true)}
              variant="outline"
              className="flex-1 h-9 border-[rgba(0,0,0,0.1)] hover:bg-[#F4F6FF] rounded-lg"
            >
              <Download className="size-4 mr-1.5" />
              내보내기
            </Button>
          </div>
        </div>

        {/* Topics Section */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-[#030213] mb-3">주요 토픽</h3>

          {topics.length === 0 ? (
            <p className="text-xs text-[#717182] italic">
              {fromPresentation
                ? "발표 후 회의를 시작하면 토픽이 자동으로 표시됩니다"
                : "회의가 진행되면 토픽이 자동으로 표시됩니다"}
            </p>
          ) : (
            <div className="space-y-4">
              {topics.map((topic, idx) => {
                const style = categoryColors[topic.name] || categoryColors["일반"];
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
                      <p className="text-xs font-semibold text-[#030213]">{topic.name}</p>
                    </div>
                    <div className="ml-4 space-y-1.5">
                      {topic.centralNodes.map((node) => (
                        <button
                          key={node.id}
                          onClick={() => onNodeNavigate(node.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg border ${style.bg} ${style.border} ${style.text} hover:shadow-md transition-all text-xs leading-tight ${
                            node.isHighlighted ? "font-semibold" : ""
                          }`}
                        >
                          {node.isHighlighted && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
                          )}
                          {node.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agenda Input Section */}
        <div className="border-t border-[rgba(0,0,0,0.06)] p-4 bg-[#FAFBFC]">
          <h3 className="text-xs font-semibold text-[#030213] mb-3">새 아젠다 입력</h3>
          
          {/* Category Pills */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {(["리서치", "아이디어", "개발", "디자인", "일반"] as Category[]).map((category) => {
              const style = categoryColors[category];
              const isSelected = selectedCategory === category;
              
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? `${style.bg} ${style.text} ${style.border} border font-semibold`
                      : "bg-white border border-[rgba(0,0,0,0.1)] text-[#717182] hover:bg-[#F4F6FF]"
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>

          {/* Input and Add Button */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="새 아젠다 내용을 입력하세요..."
              value={agendaInput}
              onChange={(e) => setAgendaInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAgenda();
                }
              }}
              className="flex-1 h-9 text-sm bg-white border-[rgba(0,0,0,0.1)] rounded-lg"
            />
            <Button
              onClick={handleAddAgenda}
              className="h-9 w-9 p-0 bg-[#0064FF] hover:bg-[#0052CC] rounded-lg transition-transform hover:scale-105"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[400px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#030213]">회의 내보내기</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-[#717182] hover:text-[#030213] transition-colors"
              >
                <X className="size-5" />
              </button>
            </div>

            <p className="text-sm text-[#717182] mb-6">
              회의 내용을 다양한 형식으로 내보낼 수 있습니다.
            </p>

            <div className="space-y-2">
              <Button className="w-full h-11 bg-[#0064FF] hover:bg-[#0052CC] rounded-lg">
                JSON으로 내보내기
              </Button>
              <Button
                variant="outline"
                className="w-full h-11 border-[rgba(0,0,0,0.1)] hover:bg-[#F4F6FF] rounded-lg"
              >
                이미지로 저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}