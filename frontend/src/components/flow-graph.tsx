import React, { useEffect, useRef, useState } from "react";
import { DataSet, Network } from "vis-network/standalone";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Share2 } from "lucide-react";

type Category = "리서치" | "아이디어" | "개발" | "디자인" | "운영";

const CATEGORY_COLORS: Record<Category, any> = {
  리서치: {
    background: "rgba(230, 247, 255, 0.9)",
    border: "#4A90E2",
    highlightBackground: "rgba(210, 235, 255, 1)",
    highlightBorder: "#2C6FBf",
  },
  아이디어: {
    background: "rgba(255, 243, 210, 0.9)",
    border: "#F5A623",
    highlightBackground: "rgba(255, 235, 190, 1)",
    highlightBorder: "#CC7F15",
  },
  개발: {
    background: "rgba(230, 255, 230, 0.9)",
    border: "#7ED321",
    highlightBackground: "rgba(210, 245, 210, 1)",
    highlightBorder: "#5EA11A",
  },
  디자인: {
    background: "rgba(245, 230, 255, 0.9)",
    border: "#BD10E0",
    highlightBackground: "rgba(235, 210, 255, 1)",
    highlightBorder: "#9400C8",
  },
  운영: {
    background: "rgba(230, 240, 245, 0.9)",
    border: "#4A4A4A",
    highlightBackground: "rgba(210, 220, 230, 1)",
    highlightBorder: "#2E2E2E",
  },
};

interface FlowGraphScreenProps {
  keywords?: string[];
}

export function FlowGraphScreen({ keywords = [] }: FlowGraphScreenProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);

  const nodes = useRef(new DataSet<any>()).current;
  const edges = useRef(new DataSet<any>()).current;

  const selectedNodeRef = useRef<number | null>(1);
  const nodeCounterRef = useRef(1);

  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<Category>("리서치");
  const [, forceRender] = useState({}); // 노드 수 UI 업데이트용

  useEffect(() => {
    // StrictMode에서 두 번 실행 방지
    if (networkRef.current) return;

    nodes.add({
      id: 1,
      label: "일반\n회의 시작 (Root)",
    });

    const options = {
      nodes: {
        shape: "box",
        shapeProperties: {
          borderRadius: 16,
        },
        margin: {
          top: 12,
          right: 12,
          bottom: 12,
          left: 12,
        },
        font: {
          size: 15,
          multi: true,
          color: "#000000ff",
          face: "Inter, Pretendard, sans-serif",
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
        enabled: false,
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
  }, [nodes, edges]);

  // Auto-create nodes from keywords prop
  useEffect(() => {
    if (!networkRef.current || keywords.length === 0) return;

    // Check if keywords have already been added to avoid duplicates
    const existingLabels = nodes.get().map(n => n.label);

    keywords.forEach((keyword, index) => {
      const label = `아이디어\n${keyword}`;

      // Skip if already exists
      if (existingLabels.some(l => l.includes(keyword))) return;

      const id = ++nodeCounterRef.current;
      const color = CATEGORY_COLORS["아이디어"];

      nodes.add({
        id,
        label,
        color: {
          background: color.background,
          border: color.border,
          highlight: {
            background: color.highlightBackground,
            border: color.highlightBorder,
          },
        },
      });

      // Connect to root or previous keyword node
      const fromId = index === 0 ? 1 : nodeCounterRef.current - 1;
      edges.add({ from: fromId, to: id });
    });

    // Force re-render to update node count
    forceRender({});
  }, [keywords, nodes, edges]);

  const addNode = () => {
    const text = keyword.trim();
    if (!text) {
      alert("키워드를 입력하세요!");
      return;
    }

    const id = ++nodeCounterRef.current;
    const color = CATEGORY_COLORS[category];

    nodes.add({
      id,
      label: `${category}\n${text}`,
      color: {
        background: color.background,
        border: color.border,
        highlight: {
          background: color.highlightBackground,
          border: color.highlightBorder,
        },
      },
    });

    if (selectedNodeRef.current) {
      edges.add({ from: selectedNodeRef.current, to: id });
    }

    selectedNodeRef.current = id;
    networkRef.current?.selectNodes([id]);

    setKeyword("");
    // 노드 수 다시 그리기용 강제 렌더
    forceRender({});
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="mb-2">회의 키워드 흐름 맵</h1>
        <p className="text-muted-foreground">
          회의 중 나온 키워드를 카테고리별로 정리하고 흐름을 한눈에 시각화합니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>흐름 맵 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Share2 className="w-6 h-6 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">현재 노드 수</p>
                <p className="text-2xl font-semibold">
                  {nodeCounterRef.current}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>카테고리</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">리서치</Badge>
            <Badge variant="outline">아이디어</Badge>
            <Badge variant="outline">개발</Badge>
            <Badge variant="outline">디자인</Badge>
            <Badge variant="outline">운영</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle>회의 키워드 흐름 시각화</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-4 lg:flex-row">
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="리서치">리서치</option>
                <option value="아이디어">아이디어</option>
                <option value="개발">개발</option>
                <option value="디자인">디자인</option>
                <option value="운영">운영</option>
              </select>
            </div>

            <div className="flex flex-1 gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="키워드를 입력하고 흐름에 추가하세요"
                className="flex-1"
              />
              <Button onClick={addNode} className="shrink-0">
                키워드 추가
              </Button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="w-full rounded-xl border bg-background"
            style={{
              height: "600px",
              backgroundImage:
                "radial-gradient(circle, #dcdcdc 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
