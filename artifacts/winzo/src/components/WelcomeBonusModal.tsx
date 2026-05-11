/**
 * WelcomeBonusModal — WINGGO
 * Shown once after a new user signs up.
 * WinZO-style animated welcome popup with ₹50 bonus reveal.
 */
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const CONFETTI_COLORS = [
  "#FFD700", "#ff8c00", "#e74c3c", "#27ae60",
  "#3498db", "#9b59b6", "#ff6b6b", "#ffd93d",
];

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id:    i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    x:     Math.random() * 100,
    delay: Math.random() * 0.6,
    dur:   1.2 + Math.random() * 0.8,
    size:  5 + Math.random() * 6,
    rot:   Math.random() * 360,
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {pieces.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-sm"
          style={{
            width:  p.size,
            height: p.size * 0.6,
            left:   `${p.x}%`,
            top:    "-10px",
            background: p.color,
          }}
          initial={{ y: -20, opacity: 1, rotate: p.rot }}
          animate={{ y: 420, opacity: [1, 1, 0], rotate: p.rot + 360 }}
          transition={{ delay: p.delay, duration: p.dur, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

const PERKS = [
  { icon: "🎮", text: "Play any game instantly" },
  { icon: "🏆", text: "Win real cash prizes" },
  { icon: "💸", text: "Withdraw your winnings" },
];

export default function WelcomeBonusModal({ visible, onClose }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(onClose, 6000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, onClose]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-6"
          style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(12px)", maxWidth: 480, margin: "0 auto" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <Confetti />

          <motion.div
            className="relative w-full rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(160deg, #0d0b1e 0%, #0a0a1f 60%, #07050f 100%)",
              border: "1.5px solid rgba(255,215,0,0.25)",
              boxShadow: "0 0 60px rgba(255,215,0,0.12), 0 0 120px rgba(255,140,0,0.08)",
            }}
            initial={{ scale: 0.7, y: 60, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
          >
            {/* Gold glow top bar */}
            <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#FFD700,#ff8c00,#FFD700)" }} />

            <div className="px-6 pt-7 pb-8 flex flex-col items-center text-center">

              {/* Animated trophy */}
              <motion.div
                className="text-7xl mb-1"
                animate={{ scale: [1, 1.18, 1], rotate: [0, -8, 8, 0] }}
                transition={{ duration: 1.2, repeat: 2, ease: "easeInOut" }}
              >
                🎉
              </motion.div>

              <h2 className="font-black text-2xl text-white mt-2 tracking-tight">
                Welcome to <span style={{ color: "#FFD700" }}>WINGGO</span>!
              </h2>
              <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                Your account is ready. Here's your starter gift:
              </p>

              {/* ₹50 bonus badge */}
              <motion.div
                className="mt-6 relative flex flex-col items-center justify-center rounded-3xl px-10 py-6"
                style={{
                  background: "linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,140,0,0.08) 100%)",
                  border: "2px solid rgba(255,215,0,0.4)",
                  boxShadow: "0 0 30px rgba(255,215,0,0.18)",
                }}
                animate={{ boxShadow: ["0 0 20px rgba(255,215,0,0.15)", "0 0 40px rgba(255,215,0,0.35)", "0 0 20px rgba(255,215,0,0.15)"] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(255,215,0,0.6)" }}>
                  🎁 Bonus Balance Added
                </span>
                <motion.div
                  className="font-black mt-1"
                  style={{ fontSize: "54px", color: "#FFD700", lineHeight: 1, textShadow: "0 0 24px rgba(255,215,0,0.5)" }}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.35, type: "spring", stiffness: 260, damping: 16 }}
                >
                  ₹50
                </motion.div>
                <span className="text-xs mt-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                  Use to play any game today
                </span>
              </motion.div>

              {/* Perks list */}
              <div className="mt-5 w-full space-y-2.5">
                {PERKS.map((p, i) => (
                  <motion.div
                    key={p.text}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.12 }}
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-sm font-semibold text-white">{p.text}</span>
                    <span className="ml-auto text-green-400 text-base">✓</span>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <motion.button
                className="mt-7 w-full py-4 rounded-2xl font-black text-lg cursor-pointer relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg,#FFD700,#ff8c00)",
                  color: "#000",
                  boxShadow: "0 0 28px rgba(255,215,0,0.45)",
                  letterSpacing: "0.04em",
                }}
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
              >
                🚀 LET'S PLAY &amp; WIN!
              </motion.button>

              <p className="text-xs mt-3" style={{ color: "rgba(255,255,255,0.22)" }}>
                Auto-closing in a few seconds…
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
