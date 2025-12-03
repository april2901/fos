import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { StatusPill } from "../components/StatusPill";
import { AgendaTag } from "../components/AgendaTag";
import { Plus, Info, X, Trash2, GripVertical, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { AgendaItem, AgendaMapData } from "../App";
import { DataSet, Network } from "vis-network/standalone";
import { supabase } from "../lib/supabaseClient";

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

  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef("");
  const finalCountRef = useRef(0);
  const lastAnalysisTimeRef = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<Network | null>(null);
  const nodes = useRef(new DataSet<any>()).current;
  const edges = useRef(new DataSet<any>()).current;
  const selectedNodeRef = useRef<number | null>(1);
  const nodeCounterRef = useRef(5);
  const guardRef = useRef(false);

  const [nodeMetadata, setNodeMetadata] = useState<
    Record<number, NodeMetadata>
  >({});

  const [decisions, setDecisions] = useState<ImportantItem[]>([]);

  const [actionItems, setActionItems] = useState<ImportantItem[]>([]);

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

  const sttEntryRefs = useRef<Record<string, HTMLDivElement | null>>(
    {}
  );
  const sttLogContainerRef = useRef<HTMLDivElement | null>(null);
  const sttEntriesRef = useRef<STTEntry[]>([]);

  const [sttEntries, setSTTEntries] = useState<STTEntry[]>([]);

  // DB에서 노드와 엣지 불러오기
  const fetchNodesFromDB = async () => {
    try {
      // 현재 로그인한 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.log('로그인하지 않음 - 기본 노드 사용');
        return;
      }

      // 사용자의 세션 찾기
      const { data: session, error: sessionError } = await supabase
        .schema('fos')
        .from('sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        console.log('저장된 세션 없음 - 기본 노드 사용');
        return;
      }

      // 노드 불러오기
      const { data: dbNodes, error: nodesError } = await supabase
        .schema('fos')
        .from('nodes')
        .select('*')
        .eq('session_id', session.session_id)
        .order('node_id');

      // 엣지 불러오기
      const { data: dbEdges, error: edgesError } = await supabase
        .schema('fos')
        .from('edges')
        .select('*')
        .eq('session_id', session.session_id);

      if (nodesError || edgesError) {
        console.error('노드/엣지 불러오기 실패:', nodesError || edgesError);
        return;
      }

      if (dbNodes && dbNodes.length > 0) {
        console.log('DB에서 노드 불러오기 성공:', dbNodes.length, '개');

        // 노드 메타데이터 설정
        const metadata: Record<number, NodeMetadata> = {};
        dbNodes.forEach((node: any) => {
          metadata[node.node_id] = {
            id: node.node_id,
            label: node.label,
            category: node.category as Category,
            transcript: node.transcript || '',
            timestamp: node.timestamp || '',
            summary: node.summary || '',
          };
        });
        setNodeMetadata(metadata);

        // vis-network에 노드 추가
        const visNodes = dbNodes.map((node: any) => ({
          id: node.node_id,
          label: node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label,
          level: node.level || 0,
          fixed: { x: true, y: false },
          color: {
            background: CATEGORY_COLORS[node.category as Category].background,
            border: CATEGORY_COLORS[node.category as Category].border,
            highlight: {
              background: CATEGORY_COLORS[node.category as Category].highlightBackground,
              border: CATEGORY_COLORS[node.category as Category].highlightBorder,
            },
          },
        }));

        nodes.clear();
        nodes.add(visNodes);

        // 노드 카운터 업데이트
        const maxNodeId = Math.max(...dbNodes.map((n: any) => n.node_id));
        nodeCounterRef.current = maxNodeId;
      }

      if (dbEdges && dbEdges.length > 0) {
        console.log('DB에서 엣지 불러오기 성공:', dbEdges.length, '개');

        const visEdges = dbEdges.map((edge: any) => ({
          from: edge.from_node_id,
          to: edge.to_node_id,
        }));

        edges.clear();
        edges.add(visEdges);
      }

    } catch (err) {
      console.error('DB 불러오기 예외:', err);
    }
  };

  // 최신 STT 엔트리 목록을 ref에 동기화
  useEffect(() => {
    sttEntriesRef.current = sttEntries;
  }, [sttEntries]);

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

  const getExistingTopics = (): string[] => {
    return Object.values(nodeMetadata).map((meta) => meta.label);
  };

  // 노드를 DB에 저장
  const saveNodeToDB = async (
    nodeId: number,
    label: string,
    category: Category,
    level: number,
    transcript: string,
    timestamp: string,
    summary: string
  ) => {
    try {
      // 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.log('로그인 필요 - DB 저장 스킵');
        return;
      }

      // 세션 찾기
      const { data: session, error: sessionError } = await supabase
        .schema('fos')
        .from('sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        console.log('세션 없음 - DB 저장 스킵');
        return;
      }

      // 노드 저장
      const { error } = await supabase
        .schema('fos')
        .from('nodes')
        .insert({
          session_id: session.session_id,
          node_id: nodeId,
          label,
          category,
          level,
          transcript,
          timestamp,
          summary,
        });

      if (error) {
        console.error('노드 DB 저장 실패:', error);
      } else {
        console.log('노드 DB 저장 성공:', nodeId);
      }
    } catch (err) {
      console.error('노드 저장 예외:', err);
    }
  };

  // 엣지를 DB에 저장
  const saveEdgeToDB = async (fromNodeId: number, toNodeId: number) => {
    try {
      // 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) return;

      // 세션 찾기
      const { data: session, error: sessionError } = await supabase
        .schema('fos')
        .from('sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) return;

      // 엣지 저장
      const { error } = await supabase
        .schema('fos')
        .from('edges')
        .insert({
          session_id: session.session_id,
          from_node_id: fromNodeId,
          to_node_id: toNodeId,
        });

      if (error) {
        console.error('엣지 DB 저장 실패:', error);
      } else {
        console.log('엣지 DB 저장 성공:', fromNodeId, '->', toNodeId);
      }
    } catch (err) {
      console.error('엣지 저장 예외:', err);
    }
  };

  // 현재 세션의 모든 노드와 엣지 삭제
  const clearAllSessionData = async () => {
    const confirmed = window.confirm('정말로 모든 노드와 엣지를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.');

    if (!confirmed) return;

    try {
      // 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        alert('로그인이 필요합니다.');
        return;
      }

      // 세션 찾기
      const { data: session, error: sessionError } = await supabase
        .schema('fos')
        .from('sessions')
        .select('session_id')
        .eq('user_id', user.id)
        .single();

      if (sessionError || !session) {
        alert('세션을 찾을 수 없습니다.');
        return;
      }

      // 노드와 엣지 삭제
      const [nodesResult, edgesResult] = await Promise.all([
        supabase.schema('fos').from('nodes').delete().eq('session_id', session.session_id),
        supabase.schema('fos').from('edges').delete().eq('session_id', session.session_id)
      ]);

      if (nodesResult.error || edgesResult.error) {
        console.error('삭제 실패:', nodesResult.error || edgesResult.error);
        alert('삭제 중 오류가 발생했습니다.');
        return;
      }

      // 로컬 state 초기화
      nodes.clear();
      edges.clear();
      setNodeMetadata({});
      nodeCounterRef.current = 0;
      selectedNodeRef.current = null;
      setSelectedNodeId(null);

      console.log('모든 노드와 엣지 삭제 완료');
      alert('모든 데이터가 삭제되었습니다.');
    } catch (err) {
      console.error('삭제 예외:', err);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const analyzeMeetingContent = async (transcript: string) => {
    console.log(
      "[DEBUG] analyzeMeetingContent called with:",
      transcript.substring(0, 50)
    );

    if (isAnalyzing || transcript.length < 10) {
      console.log(
        "[DEBUG] Skipped: isAnalyzing=",
        isAnalyzing,
        "length=",
        transcript.length
      );
      return;
    }

    const now = Date.now();
    if (now - lastAnalysisTimeRef.current < 2000) {
      console.log(
        "[DEBUG] Skipped: too soon, wait",
        2000 - (now - lastAnalysisTimeRef.current),
        "ms"
      );
      return;
    }

    setIsAnalyzing(true);
    lastAnalysisTimeRef.current = now;
    console.log("[DEBUG] Starting API call...");

    try {
      const response = await fetch("/api/analyze-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript,
          existingTopics: getExistingTopics(),
        }),
      });

      console.log("[DEBUG] API response status:", response.status);

      if (response.ok) {
        const result = await response.json();
        console.log("[DEBUG] API result:", result);

        createNodeFromAnalysis(result, transcript);
        console.log("[DEBUG] Node created!");

        transcriptBufferRef.current = "";
      } else {
        const errorText = await response.text();
        console.error("[DEBUG] API error response:", errorText);
      }
    } catch (error) {
      console.error("Meeting analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 분석 결과로 노드 생성
  const createNodeFromAnalysis = (
    result: {
      keyword: string;
      category: Category;
      summary: string;
      isNewTopic: boolean;
      relatedTopicIndex?: number;
    },
    transcript: string
  ) => {
    const existingIds = nodes.getIds() as number[];
    const maxExistingId =
      existingIds.length > 0 ? Math.max(...existingIds) : 0;
    if (nodeCounterRef.current <= maxExistingId) {
      nodeCounterRef.current = maxExistingId;
    }
    const newNodeId = ++nodeCounterRef.current;
    const color = CATEGORY_COLORS[result.category];

    // 부모 노드 결정
    let parentId = 1;
    if (
      result.relatedTopicIndex !== undefined &&
      result.relatedTopicIndex !== null
    ) {
      const existingNodes = Object.keys(nodeMetadata).map(Number);
      if (existingNodes[result.relatedTopicIndex]) {
        parentId = existingNodes[result.relatedTopicIndex];
      }
    } else if (selectedNodeRef.current) {
      parentId = selectedNodeRef.current;
    }

    const parentNode = nodes.get(parentId);
    const parentLevel =
      parentNode?.level !== undefined ? parentNode.level : 0;

    nodes.add({
      id: newNodeId,
      label:
        result.keyword.length > 15
          ? result.keyword.substring(0, 12) + "..."
          : result.keyword,
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

    const newTimestamp = new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    setNodeMetadata((prev) => ({
      ...prev,
      [newNodeId]: {
        id: newNodeId,
        label: result.keyword,
        category: result.category,
        timestamp: newTimestamp,
        summary: result.summary,
        transcript: transcript,
      },
    }));

    // 이번 분석에 사용된 발화(아직 nodeId가 없는 로그) 전체를 새 노드에 연결
    setSTTEntries((prev) =>
      prev.map((entry) =>
        entry.nodeId == null
          ? {
            ...entry,
            type: result.category,
            nodeId: newNodeId,
          }
          : entry
      )
    );

    selectedNodeRef.current = newNodeId;
    networkRef.current?.selectNodes([newNodeId]);

    // DB에 노드와 엣지 저장
    saveNodeToDB(
      newNodeId,
      result.keyword,
      result.category,
      parentLevel + 1,
      transcript,
      newTimestamp,
      result.summary
    );
    saveEdgeToDB(parentId, newNodeId);

    // Physics 출렁임 효과 트리거
    if (networkRef.current) {
      networkRef.current.startSimulation();
    }

    setTimeout(() => syncMapDataToParent(), 100);
  };

  const initializeSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Web Speech API not supported");
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "ko-KR";

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      setCurrentTranscript(interimTranscript || finalTranscript);

      if (finalTranscript.trim()) {
        const finalText = finalTranscript.trim();

        const newTimestamp = new Date().toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        const newEntryId = `s${Date.now()}`;

        setSTTEntries((prev) => [
          ...prev,
          {
            id: newEntryId,
            text: finalText,
            type: "General",
            timestamp: newTimestamp,
          },
        ]);

        transcriptBufferRef.current += finalText + " ";
        finalCountRef.current += 1;

        console.log(
          "[DEBUG] Final result added, count:",
          finalCountRef.current,
          "buffer:",
          transcriptBufferRef.current.substring(0, 50)
        );

        const buffer = transcriptBufferRef.current;
        if (finalCountRef.current >= 1 || buffer.length >= 50) {
          console.log("[DEBUG] Triggering analysis...");
          analyzeMeetingContent(buffer.trim());
          finalCountRef.current = 0;
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.error("Speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (isRecording) {
        try {
          recognition.start();
        } catch (e) { }
      }
    };

    return recognition;
  };

  const toggleRecording = () => {
    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      setCurrentTranscript("");

      if (transcriptBufferRef.current.length >= 10) {
        analyzeMeetingContent(transcriptBufferRef.current.trim());
      }
    } else {
      if (!recognitionRef.current) {
        recognitionRef.current = initializeSpeechRecognition();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
          transcriptBufferRef.current = "";
        } catch (e) {
          console.error("Failed to start recording:", e);
        }
      }
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    const initializeNetwork = async () => {
      if (networkRef.current || !containerRef.current) return;

      // DB에서 노드 불러오기 시도
      await fetchNodesFromDB();

      // DB에서 노드를 불러오지 못한 경우, 빈 상태로 시작
      // 사용자가 직접 노드를 추가하거나 STT로 생성할 수 있음
      if (nodes.length === 0) {
        console.log('빈 노드 맵으로 시작');
      }

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

        const matchingEntry = sttEntriesRef.current.find(
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
    };

    initializeNetwork();
  }, []);

  useEffect(() => {
    if (networkRef.current) {
      syncMapDataToParent();
    }
  }, [nodeMetadata]);

  // 새 로그가 추가될 때마다 스크롤을 가장 아래로
  useEffect(() => {
    if (sttLogContainerRef.current) {
      const el = sttLogContainerRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [sttEntries]);

  const handleCreateNode = () => {
    if (!newNodeText.trim()) return;

    if (guardRef.current) return;
    guardRef.current = true;
    setTimeout(() => {
      guardRef.current = false;
    }, 100);

    const newNodeId = ++nodeCounterRef.current;
    const color = CATEGORY_COLORS[selectedNodeType];

    // 부모 노드 결정
    let actualParentId: number | null = null;
    let level = 0;

    const allNodes = nodes.get();

    if (allNodes.length === 0) {
      // 첫 번째 노드인 경우 (루트)
      actualParentId = null;
      level = 0;
    } else {
      // 기존 노드가 있는 경우
      if (selectedNodeRef.current) {
        actualParentId = selectedNodeRef.current;
      } else {
        // 선택된 노드가 없으면 루트(1) 또는 첫 번째 노드를 부모로
        actualParentId = 1;
        // 만약 1번 노드가 없다면(삭제 등으로) 존재하는 첫 번째 노드를 부모로
        if (!nodes.get(actualParentId)) {
          actualParentId = allNodes[0].id as number;
        }
      }

      const parentNode = nodes.get(actualParentId);
      level = (parentNode?.level !== undefined ? parentNode.level : 0) + 1;
    }

    nodes.add({
      id: newNodeId,
      label: newNodeText,
      level: level,
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

    if (actualParentId !== null) {
      edges.add({ from: actualParentId, to: newNodeId });
    }

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

    // DB에 노드와 엣지 저장
    saveNodeToDB(
      newNodeId,
      newNodeText,
      selectedNodeType,
      level,
      "",
      newTimestamp,
      newNodeText
    );

    if (actualParentId !== null) {
      saveEdgeToDB(actualParentId, newNodeId);
    }

    setNewNodeText("");
    setSelectedNodeType("일반");

    // Physics 출렁임 효과 트리거
    if (networkRef.current) {
      networkRef.current.startSimulation();
    }

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
              <h3 className="text-base font-semibold text-[#030213]">
                실시간 논점 지도
              </h3>

              <div className="flex items-center gap-3">
                <Button
                  onClick={toggleRecording}
                  variant={isRecording ? "destructive" : "outline"}
                  className={`h-9 px-4 rounded-lg text-sm transition-transform hover:scale-[1.02] active:scale-[0.98] ${isRecording
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "border-[#0064FF] text-[#0064FF] hover:bg-[#F0F6FF]"
                    }`}
                >
                  {isRecording ? (
                    <>
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse mr-2" />
                      녹음 중지
                    </>
                  ) : (
                    "🎙️ 녹음 시작"
                  )}
                </Button>
                {isRecording && (
                  <StatusPill text="REC" variant="recording" />
                )}
                {isAnalyzing && (
                  <span className="text-xs text-blue-500 animate-pulse">
                    분석 중...
                  </span>
                )}
                <Button
                  onClick={onEnd}
                  variant="outline"
                  className="h-9 px-4 border-[#0064FF] text-[#0064FF] hover:bg-[#F0F6FF] rounded-lg text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  회의 종료
                </Button>
                <Button
                  onClick={clearAllSessionData}
                  variant="outline"
                  className="h-8 px-3 border-red-300 text-red-500 hover:bg-red-50 rounded-lg text-xs transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  title="모든 노드와 엣지 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
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
                  backgroundImage:
                    "radial-gradient(circle, #e5e5e5 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }}
              />

              {selectedNodeId &&
                popoverPosition &&
                nodeMetadata[selectedNodeId] && (
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
                        <p className="text-xs text-[#717182] font-medium mb-1.5">
                          유형
                        </p>
                        <AgendaTag
                          type={nodeMetadata[selectedNodeId].category}
                        />
                      </div>

                      <div>
                        <p className="text-xs text-[#717182] font-medium mb-1.5">
                          요약
                        </p>
                        <p className="text-xs text-[#030213] leading-relaxed bg-[#F4F6FF] p-2.5 rounded-lg">
                          {nodeMetadata[selectedNodeId].summary}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-[#717182] font-medium mb-1.5">
                          발화 전문
                        </p>
                        <div className="text-xs text-[#030213] leading-relaxed bg-[#FAFBFC] p-2.5 rounded-lg border border-[rgba(0,0,0,0.06)] max-h-32 overflow-y-auto">
                          {nodeMetadata[selectedNodeId].transcript}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            <div className="border-t border-[rgba(0,0,0,0.06)] p-5 bg-white shrink-0">
              <p className="text-xs text-[#717182] mb-3 font-medium">
                실시간 STT 로그
              </p>

              <div
                ref={sttLogContainerRef}
                className="bg-[#FAFBFC] rounded-lg p-3 mb-3 max-h-20 overflow-y-auto space-y-2 text-sm border border-[rgba(0,0,0,0.06)]"
              >
                {sttEntries.map((entry) => (
                  <div
                    key={entry.id}
                    ref={(el) => {
                      sttEntryRefs.current[entry.id] = el;
                    }}
                    className={`text-[#030213] leading-relaxed transition-colors rounded px-2 py-1 border ${selectedNodeId === entry.nodeId
                      ? "bg-blue-100 border-blue-300"
                      : "border-transparent"
                      }`}
                  >
                    <span className="text-[#717182] text-xs mr-2">
                      {entry.timestamp}
                    </span>
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
                    {(
                      ["리서치", "아이디어", "개발", "디자인", "일반"] as const
                    ).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSelectedNodeType(type)}
                        className={`transition-all ${selectedNodeType === type
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
            <h3 className="text-base font-semibold text-[#030213] mb-6">
              실시간 중요 사항
            </h3>

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="size-1.5 rounded-full bg-purple-500" />
                <p className="text-sm font-semibold text-[#030213]">
                  Decision
                </p>
              </div>
              <div className="space-y-2">
                {decisions.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) =>
                      handleItemDragStart(e, item.id, "decision")
                    }
                    onDragOver={(e) => handleItemDragOver(e, item.id)}
                    onDrop={(e) =>
                      handleItemDrop(e, item.id, "decision")
                    }
                    className={`bg-white border rounded-lg p-3 transition-all cursor-move ${dragOverItem === item.id
                      ? "border-[#0064FF] shadow-lg"
                      : "border-[rgba(0,0,0,0.1)]"
                      } hover:shadow-md hover:border-[#0064FF]`}
                  >
                    {editingItem?.id === item.id &&
                      editingItem?.type === "decision" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) =>
                            setEditText(e.target.value)
                          }
                          className="flex-grow text-sm text-[#030213] border-b border-[#0064FF] outline-none"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="text-green-600 hover:bg-green-50 p-1 rounded"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-4 text-[#717182] shrink-0" />
                        <p
                          onClick={() =>
                            startEdit(item.id, "decision", item.text)
                          }
                          className="flex-grow text-sm text-[#030213] cursor-pointer"
                        >
                          {item.text}
                        </p>
                        <button
                          onClick={() =>
                            deleteItem(item.id, "decision")
                          }
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
                <p className="text-sm font-semibold text-[#030213]">
                  Action Item
                </p>
              </div>
              <div className="space-y-2">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) =>
                      handleItemDragStart(e, item.id, "action")
                    }
                    onDragOver={(e) => handleItemDragOver(e, item.id)}
                    onDrop={(e) =>
                      handleItemDrop(e, item.id, "action")
                    }
                    className={`bg-white border rounded-lg p-3 transition-all cursor-move ${dragOverItem === item.id
                      ? "border-[#0064FF] shadow-lg"
                      : "border-[rgba(0,0,0,0.1)]"
                      } hover:shadow-md hover:border-[#0064FF]`}
                  >
                    {editingItem?.id === item.id &&
                      editingItem?.type === "action" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) =>
                            setEditText(e.target.value)
                          }
                          className="flex-grow text-sm text-[#030213] border-b border-[#0064FF] outline-none"
                          autoFocus
                        />
                        <button
                          onClick={saveEdit}
                          className="text-green-600 hover:bg-green-50 p-1 rounded"
                        >
                          <Check className="size-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-red-600 hover:bg-red-50 p-1 rounded"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <GripVertical className="size-4 text-[#717182] shrink-0" />
                        <p
                          onClick={() =>
                            startEdit(item.id, "action", item.text)
                          }
                          className="flex-grow text-sm text-[#030213] cursor-pointer"
                        >
                          {item.text}
                        </p>
                        <button
                          onClick={() =>
                            deleteItem(item.id, "action")
                          }
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
                  카드를 클릭하여 우선순위 변경 또는 수정/삭제를 할 수
                  있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
