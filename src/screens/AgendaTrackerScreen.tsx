import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { StatusPill } from "../components/StatusPill";
import { AgendaTag } from "../components/AgendaTag";
import {
  Plus,
  Info,
  X,
  Trash2,
  GripVertical,
  Check,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AgendaItem, AgendaMapData } from "../App";
import { DataSet, Network } from "vis-network/standalone";

interface AgendaTrackerScreenProps {
  hasPresentation: boolean;
  presentationTitle: string;
  extractedKeywords: string[];
  agendaItems: AgendaItem[];
  onAgendaItemsChange: (items: AgendaItem[]) => void;
  agendaMapData: AgendaMapData;
  onAgendaMapDataChange: (data: AgendaMapData) => void;
  onEnd: () => void;
  onHomeClick: () => void;
  onBack: () => void;
}

interface NodeMetadata {
  id: number;
  label: string;
  category: Category;
  transcript: string;
  timestamp: string;
  summary: string;
}

interface STTEntry {
  id: string;
  text: string;
  type: string;
  timestamp: string;
  nodeId?: number;
}

interface ImportantItem {
  id: string;
  text: string;
}

type Category = "리서치" | "아이디어" | "개발" | "디자인" | "일반";

const CATEGORY_COLORS: Record<
  Category,
  {
    background: string;
    border: string;
    highlightBackground: string;
    highlightBorder: string;
  }
> = {
  리서치: {
    background: "rgba(220, 252, 231, 0.9)",
    border: "#22C55E",
    highlightBackground: "rgba(187, 247, 208, 1)",
    highlightBorder: "#16A34A",
  },
  아이디어: {
    background: "rgba(255, 243, 210, 0.9)",
    border: "#F97316",
    highlightBackground: "rgba(254, 215, 170, 1)",
    highlightBorder: "#EA580C",
  },
  개발: {
    background: "rgba(219, 234, 254, 0.9)",
    border: "#3B82F6",
    highlightBackground: "rgba(191, 219, 254, 1)",
    highlightBorder: "#1D4ED8",
  },
  디자인: {
    background: "rgba(245, 230, 255, 0.9)",
    border: "#A855F7",
    highlightBackground: "rgba(233, 213, 255, 1)",
    highlightBorder: "#7C3AED",
  },
  일반: {
    background: "rgba(230, 240, 245, 0.9)",
    border: "#4B5563",
    highlightBackground: "rgba(209, 213, 219, 1)",
    highlightBorder: "#374151",
  },
};

const categoryStyles = {
  리서치: "bg-green-100 text-green-700 border-green-300",
  아이디어: "bg-blue-100 text-blue-700 border-blue-300",
  개발: "bg-purple-100 text-purple-700 border-purple-300",
  디자인: "bg-orange-100 text-orange-700 border-orange-300",
  일반: "bg-gray-100 text-gray-700 border-gray-300",
};

export default function AgendaTrackerScreen({
  hasPresentation,
  presentationTitle,
  extractedKeywords,
  agendaItems,
  onAgendaItemsChange,
  agendaMapData,
  onAgendaMapDataChange,
  onEnd,
  onHomeClick,
  onBack,
}: AgendaTrackerScreenProps) {
  const [newNodeText, setNewNodeText] = useState("");
  const [selectedNodeType, setSelectedNodeType] =
    useState<Category>("일반");
  const [selectedNodeId, setSelectedNodeId] =
    useState<number | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodes = useRef(new DataSet<any>()).current;
  const edges = useRef(new DataSet<any>()).current;
  const selectedNodeRef = useRef<number | null>(1);
  const nodeCounterRef = useRef(5);
  const guardRef = useRef(false);

  const [nodeMetadata, setNodeMetadata] = useState<
    Record<number, NodeMetadata>
  >({
    1: {
      id: 1,
      label: "Focus on Speaking 서비스 기획안",
      category: "아이디어",
      transcript:
        "오늘 회의에서는 Focus on Speaking 서비스 기획안을 논의하겠습니다.",
      timestamp: "10:04",
      summary: "서비스 전반 기획안 소개",
    },
    2: {
      id: 2,
      label: "개발 기술 프레임워크 선정",
      category: "디자인",
      transcript:
        "개발 일정은 어떻게 되나요? A안으로 진행하도록 하겠습니다.",
      timestamp: "10:06",
      summary: "프레임워크 및 기술 스택 결정",
    },
    3: {
      id: 3,
      label: "실시간 STT 구현",
      category: "아이디어",
      transcript:
        "STT를 활용한 실시간 스크립트 매칭 기능을 구현하면 좋겠습니다.",
      timestamp: "10:12",
      summary: "STT 기반 텔레프롬프터 아이디어",
    },
    4: {
      id: 4,
      label: "디자인 시안 검토",
      category: "디자인",
      transcript: "Figma에서 작업한 시안을 공유합니다.",
      timestamp: "10:15",
      summary: "디자인 시스템 및 UI 검토",
    },
    5: {
      id: 5,
      label: "리서치 결과 공유",
      category: "리서치",
      transcript: "경쟁 서비스 분석 결과를 공유합니다.",
      timestamp: "10:18",
      summary: "경쟁사 분석 결과",
    },
  });

  const [decisions, setDecisions] = useState<ImportantItem[]>([
    { id: "d1", text: "결정사항 1 – A안으로 진행" },
    { id: "d2", text: "결정사항 2 – 일정 1주 연장" },
  ]);

  const [actionItems, setActionItems] = useState<ImportantItem[]>([
    { id: "a1", text: "@민수: 경쟁사 리서치 정리" },
    { id: "a2", text: "@지영: 다음 주까지 프로토타입 공유" },
  ]);

  const [editingItem, setEditingItem] = useState<{
    id: string;
    type: "decision" | "action";
  } | null>(null);
  const [editText, setEditText] = useState("");
  const [draggedItem, setDraggedItem] = useState<{
    id: string;
    type: "decision" | "action";
  } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(
    null
  );

  const sttEntryRefs = useRef<
    Record<string, HTMLDivElement | null>
  >({});

  const [sttEntries, setSTTEntries] = useState<STTEntry[]>([
    {
      id: "s1",
      text: "개발 일정은 어떻게 되나요?",
      type: "Question",
      timestamp: "10:06",
      nodeId: 2,
    },
    {
      id: "s2",
      text: "A안으로 진행하도록 하겠습니다.",
      type: "Decision",
      timestamp: "10:09",
      nodeId: 2,
    },
    {
      id: "s3",
      text: "STT를 활용한 실시간 스크립트 매칭 기능을 구현하면 좋겠습니다.",
      type: "Idea",
      timestamp: "10:12",
      nodeId: 3,
    },
    {
      id: "s4",
      text: "Figma에서 작업한 시안을 공유합니다.",
      type: "General",
      timestamp: "10:15",
      nodeId: 4,
    },
  ]);

  const syncMapDataToParent = () => {
    const allNodes = nodes.get();
    const allEdges = edges.get();

    const nodesData = allNodes.map((node: any) => ({
      id: node.id,
      label: node.label,
      category: nodeMetadata[node.id]?.category || "일반",
      timestamp: nodeMetadata[node.id]?.timestamp,
      summary: nodeMetadata[node.id]?.summary,
      transcript: nodeMetadata[node.id]?.transcript,
    }));

    const edgesData = allEdges.map((edge: any) => ({
      from: edge.from,
      to: edge.to,
    }));

    onAgendaMapDataChange({
      nodes: nodesData,
      edges: edgesData,
    });
  };

  useEffect(() => {
    if (networkRef.current || !containerRef.current) return;

    nodes.add([
      {
        id: 1,
        level: 0,
        fixed: { x: true, y: false },
        label: "Focus on Speaking\n서비스 기획안",
        color: {
          background: CATEGORY_COLORS["아이디어"].background,
          border: CATEGORY_COLORS["아이디어"].border,
          highlight: {
            background:
              CATEGORY_COLORS["아이디어"].highlightBackground,
            border: CATEGORY_COLORS["아이디어"].highlightBorder,
          },
        },
      },
      {
        id: 2,
        label: "개발 기술\n프레임워크 선정",
        color: {
          background: CATEGORY_COLORS["디자인"].background,
          border: CATEGORY_COLORS["디자인"].border,
          highlight: {
            background:
              CATEGORY_COLORS["디자인"].highlightBackground,
            border: CATEGORY_COLORS["디자인"].highlightBorder,
          },
        },
      },
      {
        id: 3,
        level: 1,
        fixed: { x: true, y: false },
        label: "실시간 STT 구현",
        color: {
          background: CATEGORY_COLORS["아이디어"].background,
          border: CATEGORY_COLORS["아이디어"].border,
          highlight: {
            background:
              CATEGORY_COLORS["아이디어"].highlightBackground,
            border: CATEGORY_COLORS["아이디어"].highlightBorder,
          },
        },
      },
      {
        id: 4,
        level: 2,
        fixed: { x: true, y: false },
        label: "디자인 시안 검토",
        color: {
          background: CATEGORY_COLORS["디자인"].background,
          border: CATEGORY_COLORS["디자인"].border,
          highlight: {
            background:
              CATEGORY_COLORS["디자인"].highlightBackground,
            border: CATEGORY_COLORS["디자인"].highlightBorder,
          },
        },
      },
      {
        id: 5,
        level: 2,
        fixed: { x: true, y: false },
        label: "리서치 결과 공유",
        color: {
          background: CATEGORY_COLORS["리서치"].background,
          border: CATEGORY_COLORS["리서치"].border,
          highlight: {
            background:
              CATEGORY_COLORS["리서치"].highlightBackground,
            border: CATEGORY_COLORS["리서치"].highlightBorder,
          },
        },
      },
    ]);

    edges.add([
      { from: 1, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 4 },
      { from: 2, to: 5 },
    ]);

    nodes.update({
      id: 2,
      level: 1,
      fixed: { x: true, y: false },
    });

    const options = {
      nodes: {
        shape: "box",
        shapeProperties: { borderRadius: 12 },
        margin: { top: 12, right: 12, bottom: 12, left: 12 },
        font: {
          size: 14,
          multi: true,
          color: "#030213",
          face: "Inter, Pretendard, system-ui, sans-serif",
        },
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.15)",
          size: 10,
          x: 0,
          y: 2,
        },
      },
      edges: {
        arrows: "to",
        smooth: {
          enabled: true,
          type: "cubicBezier",
          forceDirection: "horizontal",
          roundness: 0.4,
        },
        color: { color: "#C8D0E0", highlight: "#0064FF" },
        width: 2,
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: "LR",
          sortMethod: "directed",
          levelSeparation: 250,
          nodeSpacing: 120,
        },
      },
      physics: {
        enabled: true,
        hierarchicalRepulsion: {
          centralGravity: 0.0,
          springLength: 150,
          springConstant: 0.01,
          nodeDistance: 150,
          damping: 0.09,
        },
        solver: "hierarchicalRepulsion",
      },
      interaction: {
        dragView: true,
        zoomView: true,
        dragNodes: true,
        hover: true,
      },
    };

    networkRef.current = new Network(
      containerRef.current,
      { nodes, edges },
      options
    );

    networkRef.current.on("selectNode", (params) => {
      const nodeId = params.nodes[0];
      selectedNodeRef.current = nodeId;
      setSelectedNodeId(nodeId);


      if (networkRef.current && containerRef.current) {
        const positions = networkRef.current.getPositions([nodeId]);
        const canvasPos =
          networkRef.current.canvasToDOM(positions[nodeId]);
        const containerRect =
          containerRef.current.getBoundingClientRect();

        setPopoverPosition({
          x: canvasPos.x - containerRect.left + 20,
          y: canvasPos.y - containerRect.top,
        });
      }

      const matchingEntry = sttEntries.find(
        (entry) => entry.nodeId === nodeId
      );
      if (matchingEntry && sttEntryRefs.current[matchingEntry.id]) {
        sttEntryRefs.current[matchingEntry.id]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }
    });

    networkRef.current.on("deselectNode", () => {
      selectedNodeRef.current = null;
      setSelectedNodeId(null);
      setPopoverPosition(null);
    });

    networkRef.current.on("click", (params) => {
      if (params.nodes.length === 0) {
        selectedNodeRef.current = null;
        setSelectedNodeId(null);
        setPopoverPosition(null);
        networkRef.current?.unselectAll();
      }
    });

    setTimeout(() => syncMapDataToParent(), 500);

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (networkRef.current) {
      syncMapDataToParent();
    }
  }, [nodeMetadata]);

  const handleCreateNode = () => {
    if (!newNodeText.trim()) return;

    if (guardRef.current) return;
    guardRef.current = true;
    setTimeout(() => {
      guardRef.current = false;
    }, 100);

    const newNodeId = ++nodeCounterRef.current;
    const color = CATEGORY_COLORS[selectedNodeType];

    const parentId = selectedNodeRef.current || 1;
    const parentNode = nodes.get(parentId);
    const parentLevel =
      parentNode?.level !== undefined ? parentNode.level : 0;

    nodes.add({
      id: newNodeId,
      label: newNodeText,
      level: parentLevel + 1,
      fixed: { x: true, y: false },
      color: {
        background: color.background,
        border: color.border,
        highlight: {
          background: color.highlightBackground,
          border: color.highlightBorder,
        },
      },
    });

    edges.add({ from: parentId, to: newNodeId });

    selectedNodeRef.current = newNodeId;
    networkRef.current?.selectNodes([newNodeId]);

    const newTimestamp = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    setNodeMetadata((prev) => ({
      ...prev,
      [newNodeId]: {
        id: newNodeId,
        label: newNodeText,
        category: selectedNodeType,
        timestamp: newTimestamp,
        summary: newNodeText,
        transcript: "",
      },
    }));

    setNewNodeText("");
    setSelectedNodeType("일반");

    setTimeout(() => syncMapDataToParent(), 100);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleCreateNode();
    }
  };

  const startEdit = (
    id: string,
    type: "decision" | "action",
    currentText: string
  ) => {
    setEditingItem({ id, type });
    setEditText(currentText);
  };

  const saveEdit = () => {
    if (!editingItem) return;

    if (editingItem.type === "decision") {
      setDecisions((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? { ...item, text: editText }
            : item
        )
      );
    } else {
      setActionItems((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? { ...item, text: editText }
            : item
        )
      );
    }
    setEditingItem(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setEditText("");
  };

  const deleteItem = (id: string, type: "decision" | "action") => {
    if (window.confirm("이 항목을 삭제하시겠습니까?")) {
      if (type === "decision") {
        setDecisions((prev) =>
          prev.filter((item) => item.id !== id)
        );
      } else {
        setActionItems((prev) =>
          prev.filter((item) => item.id !== id)
        );
      }
    }
  };

  const handleItemDragStart = (
    e: React.DragEvent,
    id: string,
    type: "decision" | "action"
  ) => {
    setDraggedItem({ id, type });
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (
    e: React.DragEvent,
    id: string
  ) => {
    e.preventDefault();
    setDragOverItem(id);
  };

  const handleItemDrop = (
    e: React.DragEvent,
    targetId: string,
    type: "decision" | "action"
  ) => {
    e.preventDefault();
    if (
      !draggedItem ||
      draggedItem.type !== type ||
      draggedItem.id === targetId
    ) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    const items = type === "decision" ? decisions : actionItems;
    const setItems =
      type === "decision" ? setDecisions : setActionItems;

    const draggedIndex = items.findIndex(
      (item) => item.id === draggedItem.id
    );
    const targetIndex = items.findIndex(
      (item) => item.id === targetId
    );

    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);

    setItems(newItems);
    setDraggedItem(null);
    setDragOverItem(null);
  };

  return (
    <div className="w-full min-h-screen bg-[#FAFBFC]">
      <TopNavBar
        title="Agenda Map"
        onHomeClick={onHomeClick}
        showBackButton={true}
        onBackClick={onBack}
      />

      <div 
        className="px-8 py-6 pb-10 flex gap-6"
        style={{ height: "640px" }} 
      >
        {/* Left - Agenda Map */}
        <div className="flex-[2.5] flex flex-col h-full">
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.06)] shrink-0">
              <h3 className="text-base font-semibold text-[#030213]">실시간 논점 지도</h3>
              
              <div className="flex items-center gap-3">
                <StatusPill text="REC" variant="recording" />
                <Button
                  onClick={onEnd}
                  variant="outline"
                  className="h-9 px-4 border-[#0064FF] text-[#0064FF] hover:bg-[#F0F6FF] rounded-lg text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  회의 종료
                </Button>
              </div>
            </div>


            <div 
              className="flex-grow p-8 bg-gradient-to-br from-[#FAFBFC] to-white relative overflow-hidden"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedNodeId(null);
                  setPopoverPosition(null);
                  networkRef.current?.unselectAll();
                }
              }}
            >
              <div
                ref={containerRef}
                className="w-full h-full"
                style={{
                  backgroundImage: "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              
              {/* 팝오버 등 기존 로직 유지 */}
              {selectedNodeId && popoverPosition && nodeMetadata[selectedNodeId] && (
                <div
                  className="absolute bg-white rounded-xl shadow-2xl border border-[rgba(0,0,0,0.12)] p-4 w-[320px] max-h-[350px] overflow-y-auto z-50"
                  style={{
                    left: `${popoverPosition.x}px`,
                    top: `${popoverPosition.y}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-grow pr-2">
                      <h4 className="text-sm font-semibold text-[#030213] mb-1 leading-tight">
                        {nodeMetadata[selectedNodeId].label}
                      </h4>
                      <p className="text-xs text-[#717182]">
                        {nodeMetadata[selectedNodeId].timestamp}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedNodeId(null);
                        setPopoverPosition(null);
                        networkRef.current?.unselectAll();
                      }}
                      className="text-[#717182] hover:text-[#030213] hover:bg-gray-100 p-1 rounded transition-colors shrink-0"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-[#717182] font-medium mb-1.5">유형</p>
                      <AgendaTag type={nodeMetadata[selectedNodeId].category} />
                    </div>

                    <div>
                      <p className="text-xs text-[#717182] font-medium mb-1.5">요약</p>
                      <p className="text-xs text-[#030213] leading-relaxed bg-[#F4F6FF] p-2.5 rounded-lg">
                        {nodeMetadata[selectedNodeId].summary}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-[#717182] font-medium mb-1.5">발화 전문</p>
                      <div className="text-xs text-[#030213] leading-relaxed bg-[#FAFBFC] p-2.5 rounded-lg border border-[rgba(0,0,0,0.06)] max-h-32 overflow-y-auto">
                        {nodeMetadata[selectedNodeId].transcript}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-[rgba(0,0,0,0.06)] p-5 bg-white shrink-0">
              <p className="text-xs text-[#717182] mb-3 font-medium">실시간 STT 로그</p>

              <div className="bg-[#FAFBFC] rounded-lg p-3 mb-3 max-h-20 overflow-y-auto space-y-2 text-sm border border-[rgba(0,0,0,0.06)]">
                {sttEntries.map((entry) => (
                  <div
                    key={entry.id}

                    ref={(el) => { sttEntryRefs.current[entry.id] = el; }}
                    className={`text-[#030213] leading-relaxed transition-colors rounded px-2 py-1 border ${
                      selectedNodeId === entry.nodeId
                        ? "bg-blue-100 border-blue-300"
                        : "border-transparent"
                    }`}
                  >
                    <span className="text-[#717182] text-xs mr-2">{entry.timestamp}</span>
                    {entry.text}
                    <span className="ml-2">
                      <AgendaTag type={entry.type} />
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 items-center">
                <div className="flex-grow flex items-center gap-2 px-4 py-2.5 bg-white border border-[rgba(0,0,0,0.1)] rounded-lg hover:border-[#0064FF] transition-colors">
                  <input
                    type="text"
                    placeholder="새 아젠다 내용을 입력하세요…"
                    value={newNodeText}
                    onChange={(e) => setNewNodeText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-grow bg-transparent outline-none text-sm"
                  />
                  <div className="flex gap-1.5">

                    {(["리서치", "아이디어", "개발", "디자인", "일반"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedNodeType(type)}
                        className={`transition-all ${
                          selectedNodeType === type
                            ? categoryStyles[type] + " border"
                            : "opacity-50 hover:opacity-100"
                        }`}
                      >
                        <AgendaTag type={type} asButton={false} />
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleCreateNode}
                  className="size-10 rounded-lg bg-[#0064FF] flex items-center justify-center hover:bg-[#0052CC] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!newNodeText.trim()}
                >
                  <Plus className="size-5 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right - Important Items Dashboard */}
        <div className="flex-1 h-full">
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6 h-full flex flex-col overflow-y-auto">
            <h3 className="text-base font-semibold text-[#030213] mb-6">실시간 중요 사항</h3>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-purple-500" />
                <p className="text-sm font-semibold text-[#030213]">Decision</p>
              </div>
              <div className="space-y-2">
                {decisions.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleItemDragStart(e, item.id, "decision")}
                    onDragOver={(e) => handleItemDragOver(e, item.id)}
                    onDrop={(e) => handleItemDrop(e, item.id, "decision")}
                    className={`bg-white border rounded-lg p-3 transition-all cursor-move ${dragOverItem === item.id
                      ? "border-[#0064FF] shadow-lg"
                      : "border-[rgba(0,0,0,0.1)]"
                      } hover:shadow-md hover:border-[#0064FF]`}
                  >

                    {editingItem?.id === item.id && editingItem?.type === "decision" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-grow text-sm text-[#030213] border-b border-[#0064FF] outline-none"
                          autoFocus
                        />
                        <button onClick={saveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded">
                          <Check className="size-4" />
                        </button>
                        <button onClick={cancelEdit} className="text-red-600 hover:bg-red-50 p-1 rounded">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-4 text-[#717182] shrink-0" />
                        <p
                          onClick={() => startEdit(item.id, "decision", item.text)}
                          className="flex-grow text-sm text-[#030213] cursor-pointer"
                        >
                          {item.text}
                        </p>
                        <button
                          onClick={() => deleteItem(item.id, "decision")}
                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-blue-500" />
                <p className="text-sm font-semibold text-[#030213]">Action Item</p>
              </div>
              <div className="space-y-2">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleItemDragStart(e, item.id, "action")}
                    onDragOver={(e) => handleItemDragOver(e, item.id)}
                    onDrop={(e) => handleItemDrop(e, item.id, "action")}
                    className={`bg-white border rounded-lg p-3 transition-all cursor-move ${dragOverItem === item.id
                      ? "border-[#0064FF] shadow-lg"
                      : "border-[rgba(0,0,0,0.1)]"
                      } hover:shadow-md hover:border-[#0064FF]`}
                  >

                    {editingItem?.id === item.id && editingItem?.type === "action" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="flex-grow text-sm text-[#030213] border-b border-[#0064FF] outline-none"
                          autoFocus
                        />
                        <button onClick={saveEdit} className="text-green-600 hover:bg-green-50 p-1 rounded">
                          <Check className="size-4" />
                        </button>
                        <button onClick={cancelEdit} className="text-red-600 hover:bg-red-50 p-1 rounded">
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-4 text-[#717182] shrink-0" />
                        <p
                          onClick={() => startEdit(item.id, "action", item.text)}
                          className="flex-grow text-sm text-[#030213] cursor-pointer"
                        >
                          {item.text}
                        </p>
                        <button
                          onClick={() => deleteItem(item.id, "action")}
                          className="text-red-500 hover:bg-red-50 p-1 rounded"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-[rgba(0,0,0,0.06)]">
              <div className="flex items-start gap-2 text-xs text-[#717182] bg-[#F4F6FF] p-3 rounded-lg">
                <Info className="size-4 shrink-0 mt-0.5 text-[#0064FF]" />
                <p className="leading-relaxed">
                  카드를 클릭하여 우선순위 변경 또는 수정/삭제를 할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}