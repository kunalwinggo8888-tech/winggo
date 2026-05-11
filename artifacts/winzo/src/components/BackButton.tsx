import { motion } from "framer-motion";

interface BackButtonProps {
  onBack?: () => void;
  label?: string;
  className?: string;
}

export default function BackButton({ onBack, label = "Home", className = "" }: BackButtonProps) {
  return (
    <motion.button
      onClick={onBack}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.04 }}
      className={`flex items-center gap-2 cursor-pointer select-none ${className}`}
      style={{
        background: "rgba(255,215,0,0.08)",
        border: "1px solid rgba(255,215,0,0.22)",
        borderRadius: "999px",
        padding: "6px 14px 6px 10px",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: "0 0 12px rgba(255,215,0,0.12), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
      animate={{
        boxShadow: [
          "0 0 8px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
          "0 0 16px rgba(255,215,0,0.24), inset 0 1px 0 rgba(255,255,255,0.06)",
          "0 0 8px rgba(255,215,0,0.10), inset 0 1px 0 rgba(255,255,255,0.04)",
        ],
      }}
      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Gold arrow */}
      <motion.span
        className="flex items-center justify-center font-black text-base leading-none"
        style={{
          color: "#FFD700",
          textShadow: "0 0 8px rgba(255,215,0,0.9), 0 0 20px rgba(255,215,0,0.5)",
          lineHeight: 1,
        }}
        animate={{ x: [0, -2, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        ←
      </motion.span>

      {/* Label */}
      <span
        className="font-black text-xs tracking-wide"
        style={{ color: "rgba(255,255,255,0.75)", letterSpacing: "0.04em" }}
      >
        {label}
      </span>
    </motion.button>
  );
}
