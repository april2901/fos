import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { AgendaTag } from "../components/AgendaTag";
import { ZoomIn, ZoomOut, Download, Move } from "lucide-react";
import { AgendaMapData } from "../App";
import { useEffect, useRef, useMemo, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";

interface MeetingSummaryScreenProps {
  agendaMapData: AgendaMapData;
  onBackToMain: () => void;
  onBack: () => void;
}

const CATEGORY_COLORS: Record<string, { background: string; border: string }> =
  {
    리서치: { background: "rgba(220, 252, 231, 0.9)", border: "#22C55E" },
    아이디어: { background: "rgba(255, 243, 210, 0.9)", border: "#F97316" },
    개발: { background: "rgba(219, 234, 254, 0.9)", border: "#3B82F6" },
    디자인: { background: "rgba(245, 230, 255, 0.9)", border: "#A855F7" },
    일반: { background: "rgba(230, 240, 245, 0.9)", border: "#4B5563" },
  };

const CATEGORY_LIST = ["리서치", "아이디어", "개발", "디자인", "일반"];

const DEFAULT_NODE_SIZE = 30;
const HIGHLIGHT_NODE_SIZE = 80;
const DIM_NODE_SIZE = 18;

export default function MeetingSummaryScreen({
  agendaMapData,
  onBackToMain,
  onBack,
}: MeetingSummaryScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodesRef = useRef<DataSet<any> | null>(null);
  const nodeCategoryMapRef = useRef<Record<number, string>>({});

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 카테고리 필터 적용 (색 + 크기)
  const applyCategoryFilter = (category: string | null) => {
  if (!nodesRef.current) return;

  const nodes = nodesRef.current;
  const allNodes = nodes.get() as any[];

  allNodes.forEach((n) => {
    const cat = nodeCategoryMapRef.current[n.id] || "일반";
    const baseColor = CATEGORY_COLORS[cat] || CATEGORY_COLORS["일반"];

    if (!category) {
      // 필터 없음: 기본 스타일
      nodes.update({
        id: n.id,
        color: {
          background: baseColor.background,
          border: baseColor.border,
        },
        borderWidth: 2,
        font: {
          ...(n.font || {}),
          size: 13,
          color: "#030213",
        },
        margin: { top: 12, right: 12, bottom: 12, left: 12 },
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.1)",
          size: 8,
          x: 0,
          y: 2,
        },
      });
    } else if (cat === category) {
      // 선택된 카테고리: 확실하게 강조
      nodes.update({
        id: n.id,
        color: {
          background: baseColor.background,
          border: baseColor.border,
        },
        borderWidth: 3,
        font: {
          ...(n.font || {}),
          size: 18,           // 글자 크게
          color: "#030213",
        },
        margin: { top: 20, right: 20, bottom: 20, left: 20 }, // 박스도 키우기
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.18)",
          size: 14,
          x: 0,
          y: 3,
        },
      });
    } else {
      // 나머지 카테고리: 작게 + 흐리게
      nodes.update({
        id: n.id,
        color: {
          background: "rgba(243, 244, 246, 0.5)",
          border: "#E5E7EB",
        },
        borderWidth: 1,
        font: {
          ...(n.font || {}),
          size: 11,
          color: "#9CA3AF",
        },
        margin: { top: 8, right: 8, bottom: 8, left: 8 },
        shadow: {
          enabled: false,
        },
      });
    }
  });
};

  const handleCategoryClick = (category: string) => {
    const next =
      selectedCategory === category ? null : (category as string);
    setSelectedCategory(next);
    applyCategoryFilter(next);
  };

  useEffect(() => {
    if (!containerRef.current || networkRef.current) return;

    const nodes = new DataSet<any>();
    const edges = new DataSet<any>();

    nodeCategoryMapRef.current = {};

    agendaMapData.nodes.forEach((node) => {
      const color =
        CATEGORY_COLORS[node.category] || CATEGORY_COLORS["일반"];

      nodeCategoryMapRef.current[node.id] = node.category;

      nodes.add({
        id: node.id,
        label: node.label,
        size: DEFAULT_NODE_SIZE,
        color: {
          background: color.background,
          border: color.border,
        },
      });
    });

    nodesRef.current = nodes;

    agendaMapData.edges.forEach((edge) => {
      edges.add({ from: edge.from, to: edge.to });
    });

    const options = {
      nodes: {
        shape: "box",
        shapeProperties: { borderRadius: 12 },
        margin: { top: 12, right: 12, bottom: 12, left: 12 },
        font: {
          size: 13,
          color: "#030213",
          face: "Inter, Pretendard, system-ui, sans-serif",
        },
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.1)",
          size: 8,
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
        color: { color: "#C8D0E0" },
        width: 2,
      },
      layout: {
        hierarchical: {
          enabled: true,
          direction: "LR",
          sortMethod: "directed",
          levelSeparation: 200,
          nodeSpacing: 100,
        },
      },
      physics: { enabled: false },
      interaction: {
        dragView: true,
        zoomView: true,
        dragNodes: false,
      },
    };

    networkRef.current = new Network(
      containerRef.current,
      { nodes, edges },
      options
    );

    // 초기엔 필터 없음 상태로 스타일 맞추기
    applyCategoryFilter(null);

    return () => {
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
      nodesRef.current = null;
      nodeCategoryMapRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agendaMapData]);

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.2 });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale / 1.2 });
    }
  };

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit();
    }
  };

  const majorTimelineNodes = useMemo(() => {
    const MIN_ITEMS = 5;
    const MAX_ITEMS = 6;

    const { nodes, edges } = agendaMapData;
    if (!nodes || nodes.length === 0) return [];

    const childCount: Record<number, number> = {};
    edges?.forEach((edge) => {
      childCount[edge.from] = (childCount[edge.from] || 0) + 1;
    });

    const sortNodes = (arr: typeof nodes) =>
      [...arr].sort((a, b) => {
        const ta = a.timestamp ?? "";
        const tb = b.timestamp ?? "";

        if (ta && tb && ta !== tb) {
          return ta.localeCompare(tb);
        }
        if (ta && !tb) return -1;
        if (!ta && tb) return 1;
        return a.id - b.id;
      });

    const centralNodes = nodes.filter(
      (node) => (childCount[node.id] || 0) >= 3
    );
    let result = sortNodes(centralNodes);

    if (result.length < MIN_ITEMS) {
      const sortedAll = sortNodes(nodes);
      for (const n of sortedAll) {
        if (result.find((r) => r.id === n.id)) continue;
        result.push(n);
        if (result.length >= MIN_ITEMS) break;
      }
    }

    if (nodes.length < MIN_ITEMS) {
      result = sortNodes(nodes);
    }

    return result.slice(0, MAX_ITEMS);
  }, [agendaMapData]);

  const handleTimelineClick = (nodeId: number) => {
    if (!networkRef.current || !nodesRef.current) return;

    const network = networkRef.current;
    const nodes = nodesRef.current;

    network.selectNodes([nodeId]);
    network.focus(nodeId, {
      scale: 1.2,
      animation: {
        duration: 500,
        easingFunction: "easeInOutQuad",
      },
    });

    const node = nodes.get(nodeId);
    if (!node) return;

    const originalColor = node.color || {};
    const highlightBg = "#FEF3C7";
    const highlightBorder = "#FBBF24";

    nodes.update({
      id: nodeId,
      color: {
        ...originalColor,
        background: highlightBg,
        border: highlightBorder,
      },
    });

    setTimeout(() => {
      nodes.update({
        id: nodeId,
        color: originalColor,
      });
    }, 600);
  };

  return (
    <div className="w-full h-full bg-[#FAFBFC]">
      <TopNavBar
        title="Meeting Report"
        onHomeClick={onBackToMain}
        showBackButton={true}
        onBackClick={onBack}
      />

      <div className="px-8 py-6 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex gap-6 mb-6">
            <div className="flex-[1.8] bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#030213]">
                  최종 Agenda Map
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-[#F4F6FF] rounded-lg transition-colors"
                  >
                    <ZoomIn className="size-4 text-[#717182]" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-[#F4F6FF] rounded-lg transition-colors"
                  >
                    <ZoomOut className="size-4 text-[#717182]" />
                  </button>
                  <button
                    onClick={handleFit}
                    className="p-2 hover:bg-[#F4F6FF] rounded-lg transition-colors"
                  >
                    <Move className="size-4 text-[#717182]" />
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#FAFBFC] to-white rounded-lg h-[400px] border border-[rgba(0,0,0,0.06)] relative mb-4">
                <div
                  ref={containerRef}
                  className="w-full h-full"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
                    backgroundSize: "20px 20px",
                  }}
                />
                {agendaMapData.nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-[#717182]">
                    아젠다 맵 데이터가 없습니다.
                  </div>
                )}
              </div>

              {/* 카테고리 필터 버튼 */}
              <div className="flex flex-wrap gap-2">
                {CATEGORY_LIST.map((cat) => {
                  const isActive = selectedCategory === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategoryClick(cat)}
                      className={`
                        relative rounded-full transition-all cursor-pointer
                        focus:outline-none
                        ${
                          isActive
                            ? "scale-110 drop-shadow-[0_8px_16px_rgba(37,99,235,0.35)]"
                            : "opacity-30 hover:opacity-80 hover:scale-105 filter grayscale"
                        }
                      `}
                    >
                      {/* 선택된 경우: 강한 하이라이트 배경 + 파란 링 */}
                      {isActive && (
                        <div
                          className="
                            absolute inset-[-6px]
                            rounded-full
                            bg-white
                            ring-2 ring-[#0064FF]
                            ring-offset-2 ring-offset-[#F3F4F6]
                          "
                        />
                      )}

                      {/* 실제 태그 */}
                      <div className="relative z-10">
                        <AgendaTag type={cat} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-[#030213]">
                  최종 결정 사항 & 액션 아이템
                </h3>
                <Button
                  variant="outline"
                  className="h-9 px-4 border-[#0064FF] text-[#0064FF] hover:bg-[#F4F6FF] rounded-lg gap-2 text-sm"
                >
                  <Download className="size-4" />
                  PDF 내보내기
                </Button>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="text-sm font-semibold text-[#030213] mb-2">
                    주요 토픽
                  </p>
                  <ul className="space-y-1.5 text-sm text-[#717182]">
                    {agendaMapData.nodes.length > 0 ? (
                      agendaMapData.nodes.slice(0, 5).map((node) => (
                        <li key={node.id} className="flex items-start gap-2">
                          <span className="text-[#0064FF] mt-1">•</span>
                          <span>{node.label}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-[#717182]">토픽이 없습니다.</li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#030213] mb-2">
                    결정 사항
                  </p>
                  <ol className="space-y-1.5 text-sm text-[#717182] list-decimal list-inside">
                    <li>A안으로 진행 (디자인 시안 채택)</li>
                    <li>개발 일정 1주 연장 합의</li>
                    <li>MVP 범위에서 Agenda Tracker 우선 개발</li>
                    <li>다음 회의는 월요일 오후 2시</li>
                  </ol>
                </div>

                <div>
                  <p className="text-sm font-semibold text-[#030213] mb-2">
                    Action Item
                  </p>
                  <ol className="space-y-1.5 text-sm text-[#717182] list-decimal list-inside">
                    <li>@민수: 경쟁사 리서치 정리 (금요일까지)</li>
                    <li>@지영: 프로토타입 공유 (다음 주 월요일)</li>
                    <li>@현우: 기술 스택 검토 문서 작성</li>
                    <li>@수진: 사용자 테스트 시나리오 준비</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
            <h3 className="text-base font-semibold text-[#030213] mb-2">
              Meeting Agenda Timeline
            </h3>
            <p className="text-xs text-[#717182] mb-6 leading-relaxed">
              타임라인의 토픽을 클릭하면 상단 Agenda Map에서 해당 노드가
              하이라이트됩니다.
            </p>

            <div className="relative">
              <div className="absolute top-[16px] left-0 right-0 h-px bg-[#e9ebef]" />
              <div className="flex justify-between relative">
                {majorTimelineNodes.length > 0 ? (
                  majorTimelineNodes.map((node, index) => (
                    <TimelineItem
                      key={node.id}
                      time={node.timestamp || `10:0${index}`}
                      speaker={String.fromCharCode(65 + (index % 3))}
                      label={node.label}
                      tag={node.category}
                      onClick={() => handleTimelineClick(node.id)}
                    />
                  ))
                ) : (
                  <p className="text-[#717182] text-sm">
                    타임라인 데이터가 없습니다.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  time,
  speaker,
  label,
  tag,
  onClick,
}: {
  time: string;
  speaker: string;
  label: string;
  tag: string;
  onClick: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity"
      onClick={onClick}
    >
      <div className="size-8 rounded-full bg-gradient-to-br from-[#0064FF] to-[#0052CC] text-white flex items-center justify-center font-semibold text-xs mb-2 z-10 border-2 border-white shadow-sm">
        {speaker}
      </div>
      <p className="text-xs text-[#717182] mb-1.5 font-medium">{time}</p>
      <AgendaTag type={tag} />
      <p className="text-xs text-[#030213] mt-2 max-w-[100px] text-center leading-tight">
        {label.length > 15 ? label.substring(0, 15) + "…" : label}
      </p>
    </div>
  );
}