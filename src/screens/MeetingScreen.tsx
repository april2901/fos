import React, { useEffect, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";
import { Input } from "../components/ui/input";
import { Plus } from "lucide-react";
import { motion } from "motion/react";
import { MeetingSidebar } from "../components/meeting-sidebar";

interface MeetingScreenProps {
  onNavigateToWorkspace?: () => void;
  fromPresentation?: boolean;
}

type Category = "리서치" | "아이디어" | "개발" | "디자인" | "일반";

// 카테고리 스타일 (하단 바 Pills)
const categoryStyles = {
  리서치: {
    dot: "bg-green-500",
    line: "#22C55E",
    activeBg: "bg-green-500",
    activeText: "text-white",
  },
  아이디어: {
    dot: "bg-orange-500",
    line: "#F97316",
    activeBg: "bg-orange-500",
    activeText: "text-white",
  },
  개발: {
    dot: "bg-blue-500",
    line: "#3B82F6",
    activeBg: "bg-blue-500",
    activeText: "text-white",
  },
  디자인: {
    dot: "bg-purple-500",
    line: "#A855F7",
    activeBg: "bg-purple-500",
    activeText: "text-white",
  },
  일반: {
    dot: "bg-gray-500",
    line: "#6B7280",
    activeBg: "bg-gray-500",
    activeText: "text-white",
  },
} as const;

// vis-network 노드 색상
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

export default function MeetingScreen({
  onNavigateToWorkspace,
  fromPresentation,
}: MeetingScreenProps) {
  // ===== Refs =====
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodes = useRef(new DataSet<any>()).current;
  const edges = useRef(new DataSet<any>()).current;
  const selectedNodeRef = useRef<number | null>(1);
  const nodeCounterRef = useRef(1);
  const initializedRef = useRef(false);
  const newFlowNextRef = useRef<boolean>(false);
  const lastAddRef = useRef<{ text: string; time: number }>({
    text: "",
    time: 0,
  });
  const guardRef = useRef(false);

  // ===== State =====
  const [keyword, setKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<Category>("리서치");
  const [zoom, setZoom] = useState(1);
  const [branchMode] = useState(false);
  const [topics, setTopics] = useState<
    {
      name: string;
      centralNodes: { id: number; label: string; isHighlighted?: boolean }[];
    }[]
  >([]);

  // ===== 하위 노드 총 개수 계산 (재귀) =====
  const countAllDescendants = (nodeId: number, allEdges: any[]): number => {
    const children = allEdges.filter((edge: any) => edge.from === nodeId);
    if (children.length === 0) return 0;
    let count = children.length;
    children.forEach((edge: any) => {
      count += countAllDescendants(edge.to, allEdges);
    });
    return count;
  };

  // ===== 중심 노드 계산 (자식 3개 이상) =====
  const calculateTopicsWithCentralNodes = () => {
    const allNodes = nodes.get();
    const allEdges = edges.get();

    // 각 노드의 직접 자식 수 계산
    const childCount: Record<number, number> = {};
    allEdges.forEach((edge: any) => {
      const parentId = edge.from;
      childCount[parentId] = (childCount[parentId] || 0) + 1;
    });

    // 카테고리별로 중심 노드 그룹화
    const topicMap: Record<
      string,
      { id: number; label: string; isHighlighted?: boolean }[]
    > = {};

    allNodes.forEach((node: any) => {
      // 직접 자식이 3개 이상인 노드만 중심 노드로 간주
      if (childCount[node.id] >= 3) {
        const label = node.label?.toString() || "";
        const lines = label.split("\\n");
        const category = lines[0] || "일반";
        const displayLabel = lines.length > 1 ? lines.slice(1).join(" ") : label;

        // 전체 하위 노드(descendants) 개수 계산
        const totalDescendants = countAllDescendants(node.id, allEdges);
        const isHighlighted = totalDescendants > 5;

        if (!topicMap[category]) {
          topicMap[category] = [];
        }

        topicMap[category].push({
          id: node.id,
          label: displayLabel,
          isHighlighted,
        });
      }
    });

    const topicsArray = Object.entries(topicMap).map(
      ([name, centralNodes]) => ({
        name,
        centralNodes,
      })
    );

    setTopics(topicsArray);
  };

  // ===== 노드로 이동 =====
  const navigateToNode = (nodeId: number) => {
    if (!networkRef.current) return;

    try {
      networkRef.current.selectNodes([nodeId]);
      selectedNodeRef.current = nodeId;

      const positions = networkRef.current.getPositions([nodeId]) as Record<
        string,
        { x: number; y: number }
      >;
      const pos = positions[nodeId];
      if (pos) {
        networkRef.current.moveTo({
          position: pos,
          scale: 1.2,
          animation: {
            duration: 500,
            easingFunction: "easeInOutQuad",
          },
        });
        setZoom(1.2);
      }
    } catch (error) {
      console.error("Failed to navigate to node:", error);
    }
  };

  // ===== vis-network 초기화 =====
  useEffect(() => {
    if (networkRef.current) return;

    // Root 노드 추가
    nodes.add({
      id: 1,
      label: fromPresentation ? "일반\\n발표 주제" : "일반\\n회의 주제",
      color: {
        background: CATEGORY_COLORS["일반"].background,
        border: CATEGORY_COLORS["일반"].border,
        highlight: {
          background: CATEGORY_COLORS["일반"].highlightBackground,
          border: CATEGORY_COLORS["일반"].highlightBorder,
        },
      },
    });

    const options = {
      nodes: {
        shape: "box",
        shapeProperties: { borderRadius: 16 },
        margin: { top: 12, right: 12, bottom: 12, left: 12 },
        font: {
          size: 15,
          multi: true,
          color: "#000000ff",
          face: "Inter, Pretendard, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        },
        borderWidth: 2,
        shadow: {
          enabled: true,
          color: "rgba(0,0,0,0.25)",
          size: 20,
          x: 0,
          y: 4,
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
      },
      layout: {
        hierarchical: {
          direction: "LR",
          sortMethod: "directed",
        },
      },
      physics: {
        enabled: true,
        stabilization: { iterations: 150 },
        solver: "hierarchicalRepulsion",
      },
      interaction: {
        dragView: true,
        zoomView: true,
      },
    };

    networkRef.current = new Network(
      containerRef.current!,
      { nodes, edges },
      options
    );

    networkRef.current.on("selectNode", (params) => {
      selectedNodeRef.current = params.nodes[0];
    });

    networkRef.current.on("deselectNode", () => {
      selectedNodeRef.current = null;
    });

    networkRef.current.on("zoom", (params) => {
      setZoom(params.scale);
    });

    // 발표 후 회의: 초기 뼈대 노드 생성
    if (fromPresentation && !initializedRef.current) {
      initializedRef.current = true;
      networkRef.current.once("stabilizationIterationsDone", () => {
        const initialTopics = [
          {
            label: "기술 혁신",
            category: "개발" as Category,
            keywords: ["AI 기술", "자동화", "클라우드"],
          },
          {
            label: "사용자 중심",
            category: "디자인" as Category,
            keywords: ["사용자 경험", "직관적 인터페이스", "접근성"],
          },
          {
            label: "성과 분석",
            category: "리서치" as Category,
            keywords: ["데이터 분석", "성능 개선", "생산성"],
          },
        ];

        initialTopics.forEach((topic) => {
          const topicId = ++nodeCounterRef.current;
          const topicColor = CATEGORY_COLORS[topic.category];

          nodes.add({
            id: topicId,
            label: `${topic.category}\\n${topic.label}`,
            color: {
              background: topicColor.background,
              border: topicColor.border,
              highlight: {
                background: topicColor.highlightBackground,
                border: topicColor.highlightBorder,
              },
            },
          });

          edges.add({ from: 1, to: topicId });

          topic.keywords.forEach((kw) => {
            const kwId = ++nodeCounterRef.current;
            const kwColor = CATEGORY_COLORS["아이디어"];

            nodes.add({
              id: kwId,
              label: `아이디어\\n${kw}`,
              color: {
                background: kwColor.background,
                border: kwColor.border,
                highlight: {
                  background: kwColor.highlightBackground,
                  border: kwColor.highlightBorder,
                },
              },
            });

            edges.add({ from: topicId, to: kwId });
          });
        });

        setTimeout(() => {
          calculateTopicsWithCentralNodes();
        }, 500);
      });
    }
  }, [nodes, edges, fromPresentation]);

  // ===== 노드 추가 =====
  const addNode = () => {
    const text = keyword.trim();
    if (!text) return;

    // 중복 호출 방지
    if (guardRef.current) return;
    guardRef.current = true;
    setTimeout(() => {
      guardRef.current = false;
    }, 300);

    const now = Date.now();
    if (
      lastAddRef.current.text === text &&
      now - lastAddRef.current.time < 300
    ) {
      return;
    }
    lastAddRef.current = { text, time: now };

    const id = ++nodeCounterRef.current;
    const color = CATEGORY_COLORS[selectedCategory];

    nodes.add({
      id,
      label: `${selectedCategory}\\n${text}`,
      color: {
        background: color.background,
        border: color.border,
        highlight: {
          background: color.highlightBackground,
          border: color.highlightBorder,
        },
      },
    });

    // 부모 결정
    let parentId: number | null = null;
    if (newFlowNextRef.current) {
      newFlowNextRef.current = false;
    } else if (selectedNodeRef.current != null) {
      parentId = selectedNodeRef.current;
    } else {
      // 선택된 노드가 없으면 루트에 연결
      parentId = 1;
    }

    if (parentId != null) {
      edges.add({ from: parentId, to: id });
    }

    // 체인 모드면 새 노드 선택, 가지 모드면 부모 유지
    if (!branchMode || parentId == null) {
      selectedNodeRef.current = id;
      networkRef.current?.selectNodes([id]);
    }

    // 새 노드로 카메라 이동
    setTimeout(() => {
      if (networkRef.current) {
        try {
          const positions = networkRef.current.getPositions([id]) as Record<
            string,
            { x: number; y: number }
          >;
          const pos = positions[id];
          if (pos) {
            const currentScale =
              (networkRef.current as any).getScale?.() ?? zoom ?? 1;
            networkRef.current.moveTo({
              position: pos,
              scale: currentScale,
              animation: {
                duration: 600,
                easingFunction: "easeInOutQuad",
              },
            });
            setZoom(currentScale);
          }
        } catch {
          // 무시
        }
      }
    }, 100);

    setKeyword("");
  };

  // ===== 사이드바에서 아젠다 추가 =====
  const handleAddAgendaFromSidebar = (text: string, category: Category) => {
    // 중복 호출 방지
    if (guardRef.current) return;
    guardRef.current = true;
    setTimeout(() => {
      guardRef.current = false;
    }, 300);

    const id = ++nodeCounterRef.current;
    const color = CATEGORY_COLORS[category];

    nodes.add({
      id,
      label: `${category}\\n${text}`,
      color: {
        background: color.background,
        border: color.border,
        highlight: {
          background: color.highlightBackground,
          border: color.highlightBorder,
        },
      },
    });

    // 부모 결정 (선택된 노드가 있으면 하위로, 없으면 루트에 연결)
    let parentId: number | null = selectedNodeRef.current ?? 1;

    if (parentId != null) {
      edges.add({ from: parentId, to: id });
    }

    // 새 노드 선택
    selectedNodeRef.current = id;
    networkRef.current?.selectNodes([id]);

    // 새 노드로 카메라 이동
    setTimeout(() => {
      if (networkRef.current) {
        try {
          const positions = networkRef.current.getPositions([id]) as Record<
            string,
            { x: number; y: number }
          >;
          const pos = positions[id];
          if (pos) {
            const currentScale =
              (networkRef.current as any).getScale?.() ?? zoom ?? 1;
            networkRef.current.moveTo({
              position: pos,
              scale: currentScale,
              animation: {
                duration: 600,
                easingFunction: "easeInOutQuad",
              },
            });
            setZoom(currentScale);
          }
        } catch {
          // 무시
        }
      }
    }, 100);
  };

  // ===== 노드/엣지 변경 감지 =====
  useEffect(() => {
    const handleDataChange = () => {
      calculateTopicsWithCentralNodes();
    };

    nodes.on("add", handleDataChange);
    nodes.on("remove", handleDataChange);
    edges.on("add", handleDataChange);
    edges.on("remove", handleDataChange);

    return () => {
      nodes.off("add", handleDataChange);
      nodes.off("remove", handleDataChange);
      edges.off("add", handleDataChange);
      edges.off("remove", handleDataChange);
    };
  }, [nodes, edges]);

  // ===== Render =====
  return (
    <div className="h-full flex bg-white dark:bg-black">
      {/* Sidebar */}
      <MeetingSidebar
        onNavigateHome={() => onNavigateToWorkspace?.()}
        fromPresentation={fromPresentation}
        topics={topics}
        onNodeNavigate={navigateToNode}
        onAddAgenda={handleAddAgendaFromSidebar}
      />

      {/* Canvas */}
      <div className="flex-1 flex flex-col relative">
        {/* Recording Indicator */}
        <div className="absolute top-6 right-6 z-50">
          <motion.div
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 backdrop-blur-sm border border-red-500/30"
            animate={{
              boxShadow: [
                "0 0 0 0 rgba(239, 68, 68, 0)",
                "0 0 0 4px rgba(239, 68, 68, 0.1)",
                "0 0 0 0 rgba(239, 68, 68, 0)",
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <span className="text-xs font-medium text-red-600 dark:text-red-400">
              REC
            </span>
          </motion.div>
        </div>

        {/* vis-network Canvas */}
        <div className="flex-1 relative overflow-hidden bg-white dark:bg-black">
          <div
            ref={containerRef}
            className="absolute inset-0 rounded-xl border bg-background"
            style={{
              backgroundImage:
                "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </div>

        {/* Floating Bottom Bar */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-[900px] z-50"
          animate={{ y: [0, -2, 0] }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div
            className="backdrop-blur-3xl bg-white/10 dark:bg-black/30 border border-white/20 dark:border-white/10 rounded-[32px] shadow-2xl p-6"
            style={{
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              boxShadow:
                "0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
            }}
          >
            {/* Zoom Indicator */}
            <div className="flex items-center justify-end mb-3">
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                줌: {Math.round(zoom * 100)}%
              </span>
            </div>

            {/* Category Pills */}
            <div className="flex items-center justify-center gap-2 mb-4">
              {(
                Object.keys(categoryStyles) as Array<
                  keyof typeof categoryStyles
                >
              ).map((category) => {
                const style = categoryStyles[category];
                const isSelected = selectedCategory === category;

                return (
                  <motion.button
                    key={category}
                    onClick={() => setSelectedCategory(category as Category)}
                    className={`rounded-full px-4 py-2 flex items-center gap-2 transition-all text-sm font-medium ${
                      isSelected
                        ? `${style.activeBg} ${style.activeText} shadow-lg`
                        : "bg-white/30 dark:bg-black/20 backdrop-blur-xl text-gray-700 dark:text-gray-300 hover:bg-white/40 dark:hover:bg-black/30"
                    }`}
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    animate={{
                      opacity: isSelected ? 1 : 0.8,
                      scale: isSelected ? 1 : 0.98,
                    }}
                    transition={{
                      duration: 0.2,
                      ease: "easeOut",
                    }}
                    style={{
                      boxShadow: isSelected
                        ? `0 4px 20px ${style.line}60, 0 0 0 1px ${style.line}20`
                        : "0 2px 8px rgba(0,0,0,0.1)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                    }}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? "bg-white" : style.dot
                      }`}
                    />
                    <span>{category}</span>
                  </motion.button>
                );
              })}
            </div>

            {/* Input and Add Button */}
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Input
                  type="text"
                  placeholder="키워드 입력..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addNode();
                    }
                  }}
                  className="w-full bg-white/40 dark:bg-black/20 backdrop-blur-xl border-white/30 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 rounded-2xl h-12 px-5 font-medium"
                  style={{
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                  }}
                />
              </div>
              <motion.button
                type="button"
                onClick={addNode}
                className="bg-[#0064FF] hover:bg-[#0052CC] text-white rounded-2xl w-12 h-12 flex items-center justify-center transition-colors font-medium"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.05 }}
                style={{
                  boxShadow:
                    "0 4px 20px rgba(0, 100, 255, 0.4), 0 2px 8px rgba(0, 100, 255, 0.2)",
                }}
              >
                <Plus className="w-6 h-6" />
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}