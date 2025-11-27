import { TopNavBar } from "../components/TopNavBar";
import { Button } from "../components/ui/button";
import { AgendaNode } from "../components/AgendaNode";
import { AgendaTag } from "../components/AgendaTag";
import { ZoomIn, ZoomOut, Download, Move } from "lucide-react";
import { AgendaItem } from "../App";

interface MeetingSummaryScreenProps {
  agendaItems: AgendaItem[];
  onBackToMain: () => void;
  onBack: () => void;
}

export default function MeetingSummaryScreen({
  agendaItems,
  onBackToMain,
  onBack,
}: MeetingSummaryScreenProps) {
  return (
    <div className="w-full h-full bg-[#FAFBFC]">
      <TopNavBar
        title="Meeting Report"
        onHomeClick={onBackToMain}
        showBackButton={true}
        onBackClick={onBack}
      />

      <div className="pt-16 px-8 py-6 h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {/* Top Section - Map + Summary */}
          <div className="flex gap-6 mb-6">
            {/* Left - Final Agenda Map */}
            <div className="flex-[1.8] bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[#030213]">
                  최종 Agenda Map
                </h3>
                <div className="flex gap-1">
                  <button className="p-2 hover:bg-[#F4F6FF] rounded-lg transition-colors">
                    <ZoomIn className="size-4 text-[#717182]" />
                  </button>
                  <button className="p-2 hover:bg-[#F4F6FF] rounded-lg transition-colors">
                    <ZoomOut className="size-4 text-[#717182]" />
                  </button>
                  <button className="p-2 hover:bg-[#F4F6FF] rounded-lg transition-colors">
                    <Move className="size-4 text-[#717182]" />
                  </button>
                </div>
              </div>

              <div className="bg-gradient-to-br from-[#FAFBFC] to-white rounded-lg p-6 h-[400px] border border-[rgba(0,0,0,0.06)] relative">
                <svg
                  className="w-full h-full"
                  viewBox="0 0 700 350"
                >
                  {/* Connection lines */}
                  <path
                    d="M 180 100 Q 230 100 260 130"
                    stroke="#0064FF"
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd="url(#arrowblue)"
                    opacity="0.6"
                  />
                  <path
                    d="M 180 100 Q 200 150 220 200"
                    stroke="#FF9500"
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd="url(#arroworange)"
                    opacity="0.6"
                  />
                  <path
                    d="M 360 150 Q 380 170 360 210"
                    stroke="#8B5CF6"
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd="url(#arrowpurple)"
                    opacity="0.6"
                  />
                  <path
                    d="M 360 150 Q 430 190 480 230"
                    stroke="#10B981"
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd="url(#arrowgreen)"
                    opacity="0.6"
                  />
                  <path
                    d="M 320 210 Q 340 250 300 280"
                    stroke="#0EA5E9"
                    strokeWidth="1.5"
                    fill="none"
                    markerEnd="url(#arrowcyan)"
                    opacity="0.6"
                  />

                  <defs>
                    <marker
                      id="arrowblue"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="2.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path
                        d="M0,0 L0,5 L7,2.5 z"
                        fill="#0064FF"
                        opacity="0.6"
                      />
                    </marker>
                    <marker
                      id="arroworange"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="2.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path
                        d="M0,0 L0,5 L7,2.5 z"
                        fill="#FF9500"
                        opacity="0.6"
                      />
                    </marker>
                    <marker
                      id="arrowpurple"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="2.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path
                        d="M0,0 L0,5 L7,2.5 z"
                        fill="#8B5CF6"
                        opacity="0.6"
                      />
                    </marker>
                    <marker
                      id="arrowgreen"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="2.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path
                        d="M0,0 L0,5 L7,2.5 z"
                        fill="#10B981"
                        opacity="0.6"
                      />
                    </marker>
                    <marker
                      id="arrowcyan"
                      markerWidth="8"
                      markerHeight="8"
                      refX="7"
                      refY="2.5"
                      orient="auto"
                      markerUnits="strokeWidth"
                    >
                      <path
                        d="M0,0 L0,5 L7,2.5 z"
                        fill="#0EA5E9"
                        opacity="0.6"
                      />
                    </marker>
                  </defs>

                  <foreignObject
                    x="30"
                    y="80"
                    width="220"
                    height="50"
                  >
                    <AgendaNode
                      text="Focus on Speaking 서비스 기획안"
                      type="idea"
                      isRoot
                    />
                  </foreignObject>
                  <foreignObject
                    x="260"
                    y="120"
                    width="180"
                    height="50"
                  >
                    <AgendaNode
                      text="개발 기술 프레임워크 선정"
                      type="design"
                    />
                  </foreignObject>
                  <foreignObject
                    x="220"
                    y="190"
                    width="160"
                    height="50"
                  >
                    <AgendaNode
                      text="아이디어: 실시간 STT 구현"
                      type="idea"
                    />
                  </foreignObject>
                  <foreignObject
                    x="360"
                    y="200"
                    width="120"
                    height="50"
                  >
                    <AgendaNode
                      text="디자인 시안 검토"
                      type="design"
                    />
                  </foreignObject>
                  <foreignObject
                    x="480"
                    y="220"
                    width="140"
                    height="50"
                  >
                    <AgendaNode
                      text="리서치 결과 공유"
                      type="research"
                    />
                  </foreignObject>
                  <foreignObject
                    x="300"
                    y="270"
                    width="120"
                    height="50"
                  >
                    <AgendaNode
                      text="A안으로 진행"
                      type="decision"
                    />
                  </foreignObject>
                </svg>
              </div>
            </div>

            {/* Right - Summary List */}
            <div className="flex-1 bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-semibold text-[#030213]">
                  최종 결정 사항 & 액션 아이템
                </h3>
                <Button
                  variant="outline"
                  className="h-9 px-4 border-[#0064FF] text-[#0064FF] hover:bg-[#F4F6FF] rounded-lg gap-2 text-sm transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="size-4" />
                  PDF 내보내기
                </Button>
              </div>

              <div className="space-y-5">
                {/* Key Topics */}
                <div>
                  <p className="text-sm font-semibold text-[#030213] mb-2">
                    주요 토픽
                  </p>
                  <ul className="space-y-1.5 text-sm text-[#717182]">
                    <li className="flex items-start gap-2">
                      <span className="text-[#0064FF] mt-1">
                        •
                      </span>
                      <span>서비스 범위 정의</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#0064FF] mt-1">
                        •
                      </span>
                      <span>데이터 파이프라인 설계</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#0064FF] mt-1">
                        •
                      </span>
                      <span>UI/UX 프로토타입 검토</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-[#0064FF] mt-1">
                        •
                      </span>
                      <span>개발 일정 수립</span>
                    </li>
                  </ul>
                </div>

                {/* Decisions */}
                <div>
                  <p className="text-sm font-semibold text-[#030213] mb-2">
                    결정 사항
                  </p>
                  <ol className="space-y-1.5 text-sm text-[#717182] list-decimal list-inside">
                    <li>A안으로 진행 (디자인 시안 채택)</li>
                    <li>개발 일정 1주 연장 합의</li>
                    <li>
                      MVP 범위에서 Agenda Tracker 우선 개발
                    </li>
                    <li>다음 회의는 월요일 오후 2시</li>
                  </ol>
                </div>

                {/* Action Items */}
                <div>
                  <p className="text-sm font-semibold text-[#030213] mb-2">
                    Action Item
                  </p>
                  <ol className="space-y-1.5 text-sm text-[#717182] list-decimal list-inside">
                    <li>
                      @민수: 경쟁사 리서치 정리 (금요일까지)
                    </li>
                    <li>
                      @지영: 프로토타입 공유 (다음 주 월요일)
                    </li>
                    <li>@현우: 기술 스택 검토 문서 작성</li>
                    <li>@수진: 사용자 테스트 시나리오 준비</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section - Timeline */}
          <div className="bg-white rounded-xl shadow-sm border border-[rgba(0,0,0,0.06)] p-6">
            <h3 className="text-base font-semibold text-[#030213] mb-2">
              Meeting Agenda Timeline
            </h3>

            <p className="text-xs text-[#717182] mb-6 leading-relaxed">
              타임라인의 토픽을 클릭하면 상단 Agenda Map에서
              해당 노드가 하이라이트됩니다.
            </p>

            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute top-[16px] left-0 right-0 h-px bg-[#e9ebef]" />

              {/* Timeline Items */}
              <div className="flex justify-between relative">
                <TimelineItem
                  time="10:03"
                  speaker="A"
                  label="서비스 기획안 발표"
                  tag="Idea"
                />
                <TimelineItem
                  time="10:15"
                  speaker="B"
                  label="기술 스택 논의"
                  tag="개발"
                />
                <TimelineItem
                  time="10:28"
                  speaker="C"
                  label="디자인 시안 검토"
                  tag="디자인"
                />
                <TimelineItem
                  time="10:42"
                  speaker="A"
                  label="A안 채택 결정"
                  tag="Decision"
                />
                <TimelineItem
                  time="10:55"
                  speaker="B"
                  label="액션 아이템 배정"
                  tag="Action Item"
                />
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
}: {
  time: string;
  speaker: string;
  label: string;
  tag: string;
}) {
  return (
    <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
      <div className="size-8 rounded-full bg-gradient-to-br from-[#0064FF] to-[#0052CC] text-white flex items-center justify-center font-semibold text-xs mb-2 z-10 border-2 border-white shadow-sm">
        {speaker}
      </div>
      <p className="text-xs text-[#717182] mb-1.5 font-medium">
        {time}
      </p>
      <AgendaTag type={tag} />
      <p className="text-xs text-[#030213] mt-2 max-w-[100px] text-center leading-tight">
        {label}
      </p>
    </div>
  );
}