import { motion } from "framer-motion";

interface BackButtonProps {
  onBack?: () => void;
  label?: string;
  className?: string;
}

export default function BackButton({ onBack, label = "Home", className = "" }: BackButtonProps) {
  return (
    <motion.button
      onClick={(e) => {
        e.stopPropagation();
        onBack?.();
      }}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.05 }}
      className={`flex items-center gap-2 cursor-pointer select-none ${className}`}
      style={{
        position: "relative",
        zIndex: 9999,
        background: "rgba(10,10,20,0.72)",
        border: "1px solid rgba(255,215,0,0.30)",
        borderRadius: "999px",
        padding: "7px 16px 7px 10px",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        boxShadow: "0 0 0 1px rgba(255,215,0,0.06), 0 0 14px rgba(255,215,0,0.14)",
        WebkitTapHighlightColor: "transparent",
        touchAction: "manipulation",
      }}
      animate={{
        boxShadow: [
          "0 0 0 1px rgba(255,215,0,0.06), 0 0 10px rgba(255,215,0,0.12)",
          "0 0 0 1px rgba(255,215,0,0.14), 0 0 20px rgba(255,215,0,0.28)",
          "0 0 0 1px rgba(255,215,0,0.06), 0 0 10px rgba(255,215,0,0.12)",
        ],
      }}
      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Glowing arrow */}
      <motion.span
        className="font-black text-base leading-none"
        style={{
          color: "#FFD700",
          textShadow: "0 0 8px rgba(255,215,0,1), 0 0 22px rgba(255,215,0,0.6)",
          display: "block",
          lineHeight: 1,
        }}
        animate={{ x: [0, -3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        ←
      </motion.span>

      {/* Label */}
      <span
        className="font-black text-xs tracking-widest uppercase"
        style={{ color: "rgba(255,255,255,0.80)", letterSpacing: "0.06em" }}
      >
        {label}
      </span>
    </motion.button>
  );
}
