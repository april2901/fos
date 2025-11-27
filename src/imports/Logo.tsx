import img11 from "figma:asset/d692dd00d65a6ea5f38975549befd627c2cd7f1e.png";

export default function Logo() {
  return (
    <div className="relative size-full" data-name="LOGO">
      <p className="absolute font-['Poppins:Bold',sans-serif] leading-[normal] left-[calc(50%-342px)] not-italic text-[#0064ff] text-[70px] text-nowrap top-0 whitespace-pre">Focus On Speaking</p>
      <div className="absolute h-[76px] left-[219px] top-[14px] w-[71px]" data-name="제목 없음-1 1">
        <img alt="" className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full" src={img11} />
      </div>
    </div>
  );
}