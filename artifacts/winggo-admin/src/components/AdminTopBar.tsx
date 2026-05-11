import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { NOTIFICATIONS } from "@/data/mockData";

interface Props {
  title: string;
  onToggleSidebar: () => void;
}

export default function AdminTopBar({ title, onToggleSidebar }: Props) {
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = NOTIFICATIONS.length;

  return (
    <header
      className="flex items-center justify-between px-5 py-3 sticky top-0 z-40"
      style={{
        background: "rgba(8,6,18,0.92)",
        borderBottom: "1px solid rgba(255,215,0,0.07)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-center gap-3">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onToggleSidebar}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="text-sm">☰</span>
        </motion.button>
        <div>
          <h1 className="text-white font-black text-base leading-none">{title}</h1>
          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            WINGGO Admin · May 11, 2026
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.25)" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
          <span className="text-[10px] font-black" style={{ color: "#34d399" }}>LIVE</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowNotifs(!showNotifs)}
            className="relative w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            🔔
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-black flex items-center justify-center"
                style={{ background: "#ef4444", color: "#fff" }}>{unread}</span>
            )}
          </motion.button>

          <AnimatePresence>
            {showNotifs && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.96 }}
                  transition={{ duration: 0.18 }}
                  className="absolute right-0 top-10 w-72 rounded-2xl overflow-hidden z-50"
                  style={{ background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.15)", boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
                    <span className="text-xs font-black text-white">Notifications</span>
                  </div>
                  {NOTIFICATIONS.map((n) => (
                    <div key={n.id} className="px-4 py-3 flex items-start gap-3 border-b"
                      style={{ borderColor: "rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                      <span className="text-base mt-0.5">
                        {n.type === "warning" ? "⚠️" : n.type === "error" ? "🚨" : n.type === "success" ? "✅" : "ℹ️"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white leading-snug">{n.msg}</p>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{n.time}</span>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Admin avatar */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs"
          style={{ background: "linear-gradient(135deg,#7c3aed,#FFD700)", color: "#000" }}>
          A
        </div>
      </div>
    </header>
  );
}
