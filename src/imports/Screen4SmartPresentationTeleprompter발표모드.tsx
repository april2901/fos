import svgPaths from "./svg-suaf89uy8j";

function IconHome() {
  return (
    <div className="absolute left-[25px] size-[70px] top-[6px]" data-name="icon_home">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 70 70">
        <g id="icon_home">
          <path clipRule="evenodd" d={svgPaths.p3ad4c000} fill="var(--fill-0, #212124)" fillRule="evenodd" id="vector" />
        </g>
      </svg>
    </div>
  );
}

function IconProfile() {
  return (
    <div className="absolute left-[1345px] size-[70px] top-[6px]" data-name="icon_profile">
      <svg className="block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 70 70">
        <g id="icon_profile">
          <path clipRule="evenodd" d={svgPaths.p15536b00} fill="var(--fill-0, #212124)" fillRule="evenodd" id="vector" />
        </g>
      </svg>
    </div>
  );
}

function Group1() {
  return (
    <div className="absolute contents left-0 top-0">
      <div className="absolute bg-[#d9d9d9] h-[82px] left-0 top-0 w-[1440px]" />
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-1/2 not-italic text-[32px] text-black text-center top-[40.5px] translate-x-[-50%] translate-y-[-50%] w-[434px]">
        <p className="leading-[normal]">실시간 텔레프롬프터(발표중)</p>
      </div>
      <IconHome />
      <IconProfile />
    </div>
  );
}

function Group6() {
  return (
    <div className="absolute contents left-[60px] top-[843px]">
      <div className="absolute bg-white border-[#a3b7ff] border-[3px] border-solid h-[167px] left-[60px] rounded-[15px] shadow-[2px_2px_7px_0px_rgba(0,0,0,0.1)] top-[843px] w-[422px]" />
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[normal] left-[calc(50%-449.5px)] not-italic text-[32px] text-black text-center top-[926.5px] translate-x-[-50%] translate-y-[-50%] w-[337px]">
        <p className="mb-0">발표 속도</p>
        <p>(특정 스크립트 시점의 예상 시간 대비 경과 시간)</p>
      </div>
    </div>
  );
}

function Group7() {
  return (
    <div className="absolute contents left-[60px] top-[843px]">
      <Group6 />
    </div>
  );
}

function Group11() {
  return (
    <div className="absolute contents left-[25px] top-[790px]">
      <Group7 />
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-[calc(50%-695px)] not-italic text-[32px] text-black top-[816.5px] translate-y-[-50%] w-[278px]">
        <p className="leading-[normal]">발표자 대시보드</p>
      </div>
    </div>
  );
}

function Group5() {
  return (
    <div className="absolute contents left-[511px] top-[843px]">
      <div className="absolute bg-white border-[#a3b7ff] border-[3px] border-solid h-[167px] left-[511px] rounded-[15px] shadow-[2px_2px_7px_0px_rgba(0,0,0,0.1)] top-[843px] w-[422px]" />
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-[calc(50%+2px)] not-italic text-[32px] text-black text-center top-[926.5px] translate-x-[-50%] translate-y-[-50%] w-[278px]">
        <p className="leading-[normal]">현재 페이지</p>
      </div>
    </div>
  );
}

function Group8() {
  return (
    <div className="absolute contents left-[511px] top-[843px]">
      <Group5 />
    </div>
  );
}

function Group4() {
  return (
    <div className="absolute contents left-[962px] top-[843px]">
      <div className="absolute bg-white border-[#a3b7ff] border-[3px] border-solid h-[167px] left-[962px] rounded-[15px] shadow-[2px_2px_7px_0px_rgba(0,0,0,0.1)] top-[843px] w-[422px]" />
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-[calc(50%+453px)] not-italic text-[32px] text-black text-center top-[926.5px] translate-x-[-50%] translate-y-[-50%] w-[278px]">
        <p className="leading-[normal]">다음 페이지</p>
      </div>
    </div>
  );
}

function Group9() {
  return (
    <div className="absolute contents left-[962px] top-[843px]">
      <Group4 />
    </div>
  );
}

function Frame() {
  return (
    <div className="basis-0 content-stretch flex gap-[10px] grow items-center justify-center min-h-px min-w-px relative shrink-0" data-name="Frame">
      <div className="bg-white h-[10px] shrink-0 w-px" data-name="AX Label" />
    </div>
  );
}

function Knob() {
  return <div className="bg-white h-[24px] rounded-[100px] shrink-0 w-[39px]" data-name="Knob" />;
}

function ToggleSwitch() {
  return (
    <div className="absolute bg-[#34c759] box-border content-stretch flex items-center justify-between left-[813px] overflow-clip p-[2px] rounded-[100px] top-[801px] w-[64px]" data-name="Toggle - Switch">
      <Frame />
      <Knob />
    </div>
  );
}

function Group10() {
  return (
    <div className="absolute contents left-[511px] top-[790px]">
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-[calc(50%-209px)] not-italic text-[32px] text-black top-[816.5px] translate-y-[-50%] w-[327px]">
        <p className="leading-[normal]">발표 자료 자동 넘기기</p>
      </div>
      <Group8 />
      <Group9 />
      <ToggleSwitch />
    </div>
  );
}

function Group12() {
  return (
    <div className="absolute contents left-[511px] top-[790px]">
      <Group10 />
    </div>
  );
}

function Group3() {
  return (
    <div className="absolute contents left-[25px] top-[96px]">
      <div className="absolute bg-white border-[#a3b7ff] border-[3px] border-solid h-[599px] left-[60px] rounded-[15px] shadow-[2px_2px_7px_0px_rgba(0,0,0,0.1)] top-[163px] w-[1324px]" />
      <div className="absolute flex flex-col font-['Inter:Medium','Noto_Sans_KR:Medium',sans-serif] font-medium justify-center leading-[70px] left-[103px] not-italic text-[48px] text-black top-[471px] translate-y-[-50%] w-[1238px]">
        <p className="mb-0 text-[#a7a7a7] whitespace-pre-wrap">{`안녕하세요. 오늘 회의에서는 실시간 커뮤니케이션 지원 서비스인 “Focus on Speaking” 기획안을  공유드리겠습니다.`}</p>
        <p className="mb-0">
          <span className="text-[#a7a7a7]">먼저 배경부터 말씀드리면,</span> <span className="text-[#0064ff]">{`발표나 회의 중에 말하고 있는 내용이 스크립트나 자료 흐름과 어긋나거나 `}</span>
          <span>
            , 혹은 회의 도중 논점이 엉키는 문제를 자주 경험합니다.
            <br aria-hidden="true" />
            {` 특히 발표자는 시선이 자료로 쏠리고, 회의 참여자들은 흐름을 놓치기 쉬워 효율이 떨어지는 경우가 많았습니다.`}
          </span>
        </p>
        <p>{`이 문제를 해결하고자 저희가 제안하는 서비스가 “Focus on `}</p>
      </div>
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-[calc(50%-695px)] not-italic text-[32px] text-black top-[122.5px] translate-y-[-50%] w-[141px]">
        <p className="leading-[normal]">발표 제목</p>
      </div>
    </div>
  );
}

function Group() {
  return (
    <div className="absolute contents left-[calc(50%-438px)] top-[calc(50%-389.12px)] translate-x-[-50%] translate-y-[-50%]">
      <div className="absolute bg-[#d9d9d9] h-[45.752px] left-[calc(50%-438px)] rounded-[15px] top-[calc(50%-389.12px)] translate-x-[-50%] translate-y-[-50%] w-[198px]" />
    </div>
  );
}

function Group2() {
  return (
    <div className="absolute contents left-[calc(50%-438px)] top-[96px] translate-x-[-50%]">
      <Group />
      <div className="absolute flex flex-col font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal h-[53px] justify-center leading-[0] left-[calc(50%-437.5px)] not-italic text-[32px] text-black text-center top-[122.5px] translate-x-[-50%] translate-y-[-50%] w-[141px]">
        <p className="leading-[normal]">진행 상태</p>
      </div>
    </div>
  );
}

function Button() {
  return (
    <div className="absolute bg-[#0064ff] h-[48px] left-[1171px] rounded-[8px] top-[101px] w-[211px]" data-name="Button">
      <div className="box-border content-stretch flex gap-[8px] h-[48px] items-center justify-center overflow-clip p-[12px] relative rounded-[inherit] w-[211px]">
        <p className="font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal leading-none not-italic relative shrink-0 text-[30px] text-neutral-100 text-nowrap whitespace-pre">발표 종료</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#2c2c2c] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

function Button1() {
  return (
    <div className="absolute bg-[#0064ff] h-[48px] left-[395px] rounded-[8px] top-[101px] w-[211px]" data-name="Button">
      <div className="box-border content-stretch flex gap-[8px] h-[48px] items-center justify-center overflow-clip p-[12px] relative rounded-[inherit] w-[211px]">
        <p className="font-['Inter:Regular','Noto_Sans_KR:Regular',sans-serif] font-normal leading-none not-italic relative shrink-0 text-[30px] text-neutral-100 text-nowrap whitespace-pre">시작/정지</p>
      </div>
      <div aria-hidden="true" className="absolute border border-[#2c2c2c] border-solid inset-0 pointer-events-none rounded-[8px]" />
    </div>
  );
}

export default function Screen4SmartPresentationTeleprompter() {
  return (
    <div className="bg-white relative size-full" data-name="Screen 4. Smart Presentation Teleprompter (발표 모드)">
      <Group1 />
      <Group11 />
      <Group12 />
      <Group3 />
      <Group2 />
      <Button />
      <Button1 />
    </div>
  );
}