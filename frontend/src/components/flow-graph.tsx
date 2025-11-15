import React, { useEffect, useRef } from "react";
import { DataSet, Network } from "vis-network/standalone";

type Category =
    | "리서치"
    | "아이디어"
    | "개발"
    | "디자인"
    | "운영";

const CATEGORY_COLORS: Record<Category, any> = {
    "리서치": {
        background: "rgba(230, 247, 255, 0.9)",
        border: "#4A90E2",
        highlightBackground: "rgba(210, 235, 255, 1)",
        highlightBorder: "#2C6FBf"
    },
    "아이디어": {
        background: "rgba(255, 243, 210, 0.9)",
        border: "#F5A623",
        highlightBackground: "rgba(255, 235, 190, 1)",
        highlightBorder: "#CC7F15"
    },
    "개발": {
        background: "rgba(230, 255, 230, 0.9)",
        border: "#7ED321",
        highlightBackground: "rgba(210, 245, 210, 1)",
        highlightBorder: "#5EA11A"
    },
    "디자인": {
        background: "rgba(245, 230, 255, 0.9)",
        border: "#BD10E0",
        highlightBackground: "rgba(235, 210, 255, 1)",
        highlightBorder: "#9400C8"
    },
    "운영": {
        background: "rgba(230, 240, 245, 0.9)",
        border: "#4A4A4A",
        highlightBackground: "rgba(210, 220, 230, 1)",
        highlightBorder: "#2E2E2E"
    }
};

export function FlowGraphScreen() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const networkRef = useRef<Network | null>(null);

    const nodes = useRef(new DataSet<any>()).current;
    const edges = useRef(new DataSet<any>()).current;

    const inputRef = useRef<HTMLInputElement | null>(null);
    const categoryRef = useRef<HTMLSelectElement | null>(null);

    const selectedNodeRef = useRef<number | null>(1);
    const nodeCounterRef = useRef(1);

    useEffect(() => {
        nodes.add({
            id: 1,
            label: "일반\n회의 시작 (Root)"
        });

        const options = {
            nodes: {
                shape: "box",
                shapeProperties: {
                    borderRadius: 16   // 둥근 모서리
                },
                margin: {
                    top: 12,
                    right: 12,
                    bottom: 12,
                    left: 12
                },          // 패딩
                font: {
                    size: 15,
                    multi: true,
                    color: "#000000ff",
                    face: "Inter, Pretendard, sans-serif"
                },
                borderWidth: 2,
                shadow: {
                    enabled: true,
                    color: "rgba(0,0,0,0.25)",
                    size: 20,
                    x: 0,
                    y: 4
                }
            },
            edges: {
                arrows: "to",
                smooth: {
                    enabled : true,
                    type: "cubicBezier",
                    forceDirection: "horizontal",
                    roundness: 0.4
                }
            },
            layout: {
                hierarchical: {
                    direction: "LR",
                    sortMethod: "directed"
                }
            }
        };

        networkRef.current = new Network(
            containerRef.current!,
            { nodes, edges },
            options
        );

        networkRef.current.on("selectNode", params => {
            selectedNodeRef.current = params.nodes[0];
        });

        networkRef.current.on("deselectNode", () => {
            selectedNodeRef.current = null;
        });
        
    }, []);

    const addNode = () => {
        const text = inputRef.current!.value.trim();
        const category = categoryRef.current!.value as Category;

        if (!text) return alert("키워드를 입력하세요!");

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
                    border: color.highlightBorder
                }
            }
        });

        if (selectedNodeRef.current) {
            edges.add({ from: selectedNodeRef.current, to: id });
        }

        selectedNodeRef.current = id;
        networkRef.current!.selectNodes([id]);

        inputRef.current!.value = "";
    };

    return (
        <div style={{ width: "100%" }}>
            <h2>회의 키워드 흐름 시각화 (Flow)</h2>

            <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <select ref={categoryRef} style={{ padding: "10px" }}>
                    <option value="리서치">리서치</option>
                    <option value="아이디어">아이디어</option>
                    <option value="개발">개발</option>
                    <option value="디자인">디자인</option>
                    <option value="운영">운영</option>
                </select>

                <input
                    ref={inputRef}
                    type="text"
                    placeholder="키워드 입력..."
                    style={{ flexGrow: 1, padding: "10px" }}
                />

                <button
                    onClick={addNode}
                    style={{
                        padding: "10px 20px",
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "5px",
                        cursor: "pointer"
                    }}
                >
                    키워드 추가
                </button>
            </div>

            <div
                ref={containerRef}
                style={{
                    width: "100%",
                    height: "600px",
                    border: "1px solid #d1d5da",
                    borderRadius: "8px",
                    background: "#fdfdfd",
                    backgroundImage:
                        "radial-gradient(circle, #dcdcdc 1px, transparent 1px)",
                    backgroundSize: "20px 20px"
                }}
            ></div>
        </div>
    );
}
