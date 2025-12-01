// src/components/Logo.tsx
import FOSLogo from "../assets/FOS_Logo.png";

type LogoProps = {
  size?: "sm" | "md" | "lg";
};

export function Logo({ size = "md" }: LogoProps) {
  // px 단위로 직접 컨트롤
  const heightPx =
    size === "sm" ? 60
    : size === "lg" ? 80
    : 70;           

  return (
    <div className="flex items-center gap-2">
      <img
        src={FOSLogo}
        alt="Focus on Speaking"
        style={{ height: heightPx, width: "auto" }}  // 여기서 실제 높이 조절
        className="object-contain"
      />
    </div>
  );
}
