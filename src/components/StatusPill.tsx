import { motion } from "motion/react";

interface StatusPillProps {
  text: string;
  variant?: "recording" | "active" | "default";
}

export function StatusPill({ text, variant = "default" }: StatusPillProps) {
  const styles = {
    recording: "bg-red-50 text-red-600 border border-red-200",
    active: "bg-blue-50 text-[#0064FF] border border-blue-200",
    default: "bg-gray-50 text-[#717182] border border-gray-200"
  };

  return (
    <motion.div 
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${styles[variant]}`}
      animate={variant === "recording" ? {
        boxShadow: [
          "0 0 0 0 rgba(239, 68, 68, 0)",
          "0 0 0 4px rgba(239, 68, 68, 0.2)",
          "0 0 0 0 rgba(239, 68, 68, 0)"
        ]
      } : {}}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      {variant === "recording" && (
        <motion.div 
          className="size-1.5 rounded-full bg-red-500"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {text}
    </motion.div>
  );
}
