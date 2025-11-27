import { motion } from "motion/react";
import { useState } from "react";

interface AgendaNodeProps {
  text: string;
  type: "research" | "idea" | "design" | "decision" | "action" | "general" | "question" | "negative" | "positive";
  isRoot?: boolean;
  onClick?: (e?: any) => void;
}

export function AgendaNode({ text, type, isRoot = false, onClick }: AgendaNodeProps) {
  const [isClicked, setIsClicked] = useState(false);

  const typeColors = {
    research: "bg-emerald-50 border-emerald-200 text-emerald-700",
    idea: "bg-amber-50 border-amber-200 text-amber-700",
    design: "bg-sky-50 border-sky-200 text-sky-700",
    decision: "bg-purple-50 border-purple-200 text-purple-700",
    action: "bg-blue-50 border-blue-200 text-blue-700",
    general: "bg-gray-50 border-gray-200 text-gray-700",
    question: "bg-yellow-50 border-yellow-200 text-yellow-700",
    negative: "bg-red-50 border-red-200 text-red-700",
    positive: "bg-teal-50 border-teal-200 text-teal-700"
  };

  const handleClick = (e: any) => {
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 600);
    onClick?.(e);
  };

  return (
    <motion.div 
      className={`
        px-3 py-2 rounded-lg border shadow-sm
        ${isRoot ? 'text-sm font-medium' : 'text-xs'}
        ${typeColors[type]}
        hover:shadow-md transition-all cursor-pointer
      `}
      onClick={handleClick}
      animate={isClicked ? {
        y: [0, -8, 0, -4, 0, -2, 0]
      } : {}}
      transition={{
        duration: 0.6,
        ease: "easeOut",
        times: [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1]
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {text}
    </motion.div>
  );
}
