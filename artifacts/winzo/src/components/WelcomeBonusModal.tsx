/**
 * WelcomeBonusModal — WINGGO
 * Premium WinZO-style new user bonus popup.
 * Full-screen cinematic reveal: chest open → coin rain → ₹50 → CLAIM NOW.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  onClose: () => void;
}

// ─── COIN RAIN ────────────────────────────────────────────────
function CoinRain() {
  const coins = Array.from({ length: 22 }, (_, i) => ({
    id: i,
    x: 3 + (i * 4.4),
    delay: (i * 0.08) % 1.4,
    dur: 1.1 + (i % 5) * 0.18,
    size: 14 + (i % 4) * 5,
    spin: i % 2 === 0,
    emoji: i % 5 === 0 ? "💎" : "🪙",
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {coins.map((c) => (
        <motion.div key={c.id}
          className="absolute select-none"
          style={{ left: `${c.x}%`, top: -40, fontSize: c.size, lineHeight: 1 }}
          initial={{ y: -60, opacity: 0, rotate: 0, scale: 0.5 }}
          animate={{ y: 700, opacity: [0, 1, 1, 0], rotate: c.spin ? 360 : -360, scale: [0.5, 1.1, 1] }}
          transition={{ delay: c.delay, duration: c.dur, ease: "easeIn", repeat: Infinity, repeatDelay: 0.6 }}>
          {c.emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ─── CONFETTI BURST ────────────────────────────────────────────
const CONF_COLORS = ["#FFD700","#ff8c00","#a855f7","#7c3aed","#22c55e","#3b82f6","#f43f5e","#fbbf24","#34d399"];

function ConfettiBurst() {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    color: CONF_COLORS[i % CONF_COLORS.length],
    x: 5 + (i * 2.5),
    delay: (i * 0.04) % 0.9,
    dur: 1.3 + (i % 5) * 0.2,
    size: 4 + (i % 4) * 3,
    rot: (i * 47) % 360,
    shape: i % 3,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {pieces.map((p) => (
        <motion.div key={p.id}
          className="absolute"
          style={{
            width: p.size, height: p.shape === 0 ? p.size : p.size * 0.5,
            left: `${p.x}%`, top: -12,
            background: p.color,
            borderRadius: p.shape === 2 ? "50%" : 2,
          }}
          initial={{ y: -20, opacity: 1, rotate: p.rot, scale: 1 }}
          animate={{ y: 520, opacity: [1, 1, 0.5, 0], rotate: p.rot + 540, scale: [1, 0.8, 0.5] }}
          transition={{ delay: p.delay, duration: p.dur, ease: [0.2, 0, 0.8, 1] }}
        />
      ))}
    </div>
  );
}

// ─── NEON ORB ─────────────────────────────────────────────────
function NeonOrb({ color, x, y, size, dur }: { color: string; x: string; y: string; size: number; dur: number }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, left: x, top: y, background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, filter: "blur(30px)" }}
      animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }} />
  );
}

// ─── PULSING RING ─────────────────────────────────────────────
function PulseRings({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[1, 2, 3].map((i) => (
        <motion.div key={i} className="absolute rounded-full border-2"
          style={{ borderColor: color, width: 60 + i * 28, height: 60 + i * 28 }}
          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }} />
      ))}
    </div>
  );
}

// ─── CHEST ANIMATION ──────────────────────────────────────────
function ChestReveal() {
  const [frame, setFrame] = useState(0);
  // 0 → chest  1 → shaking  2 → burst  3 → coins
  const frames = ["📦", "📦", "🎁", "💰"];

  useEffect(() => {
    const timings = [400, 700, 500];
    let t: ReturnType<typeof setTimeout>;
    function step(f: number) {
      if (f >= 3) return;
      t = setTimeout(() => { setFrame(f + 1); step(f + 1); }, timings[f]);
    }
    step(0);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div className="relative flex items-center justify-center"
      animate={frame === 1 ? { rotate: [-8, 8, -8, 8, 0], scale: [1, 1.08, 1] } : frame === 2 ? { scale: [1, 1.4, 0.9, 1.1, 1] } : {}}
      transition={{ duration: 0.5 }}>
      <motion.div className="text-7xl select-none"
        key={frame}
        initial={{ scale: 0.7, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 18 }}>
        {frames[Math.min(frame, 3)]}
      </motion.div>
      {/* Burst rays when chest opens */}
      {frame >= 2 && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 8 }, (_, i) => (
            <motion.div key={i} className="absolute"
              style={{
                width: 3, height: 28,
                left: "50%", top: "50%",
                transformOrigin: "0 0",
                background: "linear-gradient(0deg, #FFD700, transparent)",
                rotate: `${i * 45}deg`,
                borderRadius: 4,
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: [0, 1.4, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 0.6, delay: 0.05 * i }} />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── PERKS ────────────────────────────────────────────────────
const PERKS = [
  { icon: "⚔️", text: "Use bonus in World War battles" },
  { icon: "💳", text: "Bonus for new users only"       },
  { icon: "⚡", text: "Instant credit after signup"    },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function WelcomeBonusModal({ visible, onClose }: Props) {
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (visible) {
      setClaimed(false);
      timerRef.current = setTimeout(onClose, 9000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, onClose]);

  function handleClaim() {
    setClaimed(true);
    setTimeout(onClose, 1200);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ maxWidth: 480, margin: "0 auto" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

          {/* ── Full-screen dark backdrop ── */}
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 10%, rgba(124,58,237,0.35) 0%, rgba(7,5,15,0.97) 55%)" }} />

          {/* ── Neon orbs ── */}
          <NeonOrb color="rgba(124,58,237,0.8)"  x="-10%" y="5%"  size={260} dur={3.2} />
          <NeonOrb color="rgba(255,215,0,0.6)"   x="70%"  y="60%" size={180} dur={2.6} />
          <NeonOrb color="rgba(34,197,94,0.5)"   x="10%"  y="70%" size={140} dur={3.8} />
          <NeonOrb color="rgba(239,68,68,0.35)"  x="80%"  y="5%"  size={120} dur={2.9} />

          {/* ── Coin rain ── */}
          <CoinRain />
          <ConfettiBurst />

          {/* ── Card ── */}
          <motion.div className="relative w-full rounded-[28px] overflow-hidden z-20"
            style={{
              background: "linear-gradient(160deg, #130530 0%, #0a0020 50%, #050210 100%)",
              border: "1.5px solid rgba(167,139,250,0.3)",
              boxShadow: "0 0 60px rgba(124,58,237,0.3), 0 0 120px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
            initial={{ scale: 0.6, y: 80, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}>

            {/* ── Top gradient bar ── */}
            <motion.div className="h-1.5 w-full"
              style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7, #FFD700, #ff8c00, #FFD700, #a855f7, #7c3aed)" }}
              animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />

            <div className="px-5 pt-5 pb-6 flex flex-col items-center text-center relative">

              {/* ── NEW USER BONUS banner ── */}
              <motion.div
                className="flex items-center gap-2 px-4 py-2 rounded-full mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(167,139,250,0.12))",
                  border: "1px solid rgba(167,139,250,0.4)",
                  boxShadow: "0 0 20px rgba(124,58,237,0.3)",
                }}
                initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <motion.span animate={{ rotate: [-10, 10, -10] }} transition={{ duration: 0.8, repeat: Infinity }}>🎉</motion.span>
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#c4b5fd" }}>NEW USER BONUS</span>
                <motion.span animate={{ rotate: [10, -10, 10] }} transition={{ duration: 0.8, repeat: Infinity }}>🎉</motion.span>
              </motion.div>

              {/* ── Chest ── */}
              <motion.div className="relative mb-3" initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 18 }}>
                <ChestReveal />
                {/* Glow halo behind chest */}
                <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(255,215,0,0.35) 0%, transparent 70%)" }}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.6, repeat: Infinity }} />
              </motion.div>

              {/* ── GET ₹50 BONUS heading ── */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <p className="text-xs font-black tracking-widest uppercase mb-1" style={{ color: "rgba(167,139,250,0.6)" }}>
                  GET INSTANTLY
                </p>
              </motion.div>

              {/* ── ₹50 amount with pulse rings ── */}
              <motion.div className="relative flex items-center justify-center mb-1"
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5, type: "spring", stiffness: 280, damping: 18 }}>
                <PulseRings color="#FFD700" />
                <div className="relative z-10 flex flex-col items-center px-10 py-4 rounded-3xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,140,0,0.06) 100%)",
                    border: "2px solid rgba(255,215,0,0.5)",
                    boxShadow: "0 0 40px rgba(255,215,0,0.2), inset 0 1px 0 rgba(255,215,0,0.15)",
                  }}>
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: "rgba(255,215,0,0.55)" }}>
                    🎁 BONUS BALANCE
                  </span>
                  <motion.div
                    className="font-black leading-none mt-1"
                    style={{ fontSize: 62, color: "#FFD700", textShadow: "0 0 30px rgba(255,215,0,0.7), 0 0 60px rgba(255,215,0,0.4)" }}
                    animate={{ textShadow: [
                      "0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)",
                      "0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,215,0,0.5)",
                      "0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)",
                    ] }}
                    transition={{ duration: 1.8, repeat: Infinity }}>
                    ₹50
                  </motion.div>
                  <span className="text-xs mt-1.5 font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Added to your wallet
                  </span>
                </div>
              </motion.div>

              {/* ── Perks list ── */}
              <div className="w-full space-y-2 mt-4">
                {PERKS.map((p, i) => (
                  <motion.div key={p.text}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.07)",
                    }}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)" }}>
                      {p.icon}
                    </div>
                    <span className="text-sm font-semibold text-white text-left">{p.text}</span>
                    <motion.div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
                      initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.85 + i * 0.1, type: "spring" }}>
                      <span className="text-xs" style={{ color: "#22c55e" }}>✓</span>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* ── CLAIM NOW button ── */}
              <motion.div className="w-full mt-5"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
                <AnimatePresence mode="wait">
                  {!claimed ? (
                    <motion.button key="claim"
                      className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer relative overflow-hidden"
                      style={{
                        background: "linear-gradient(135deg, #16a34a 0%, #15803d 50%, #166534 100%)",
                        color: "#fff",
                        boxShadow: "0 0 30px rgba(22,163,74,0.6), 0 0 60px rgba(22,163,74,0.25)",
                        letterSpacing: "0.06em",
                        border: "1px solid rgba(74,222,128,0.4)",
                      }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleClaim}
                      animate={{ boxShadow: [
                        "0 0 20px rgba(22,163,74,0.5), 0 0 40px rgba(22,163,74,0.2)",
                        "0 0 40px rgba(22,163,74,0.85), 0 0 70px rgba(22,163,74,0.4)",
                        "0 0 20px rgba(22,163,74,0.5), 0 0 40px rgba(22,163,74,0.2)",
                      ] }}
                      transition={{ duration: 1.6, repeat: Infinity }}>
                      {/* Shimmer sweep */}
                      <motion.div className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)" }}
                        animate={{ x: ["-110%", "210%"] }}
                        transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 0.9 }} />
                      💰 CLAIM NOW
                    </motion.button>
                  ) : (
                    <motion.div key="claimed"
                      className="w-full py-4 rounded-2xl font-black text-lg text-center"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.4)" }}
                      initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      ✅ Bonus Credited!
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* ── Gold shimmer divider ── */}
              <div className="w-full h-px mt-4 mb-3 rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)" }} />

              {/* ── Bottom note ── */}
              <motion.div className="flex items-center gap-4 w-full justify-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                {[["🔒","Secure"], ["⚡","Instant"], ["🏆","Real Cash"]].map(([icon, label]) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="text-base">{icon}</span>
                    <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>{label}</span>
                  </div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
