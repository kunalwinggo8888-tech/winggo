/**
 * WelcomeBonusModal — WINGGO
 * Premium new-user bonus popup shown exactly once after first signup.
 * Dark black + gold glow — WinZO-style cinematic reveal.
 *
 * Shown only when the user is brand-new (isNewUser=true from signup).
 * The ₹50 bonus is already written to Firestore (signupBonusClaimed=true)
 * by createUserProfile → initWallet — this popup is purely celebratory.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  onClose: () => void;
  displayName?: string;
}

// ─── COIN RAIN ─────────────────────────────────────────────────────────────────
function CoinRain() {
  const coins = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: 2 + (i * 4.1),
    delay: (i * 0.07) % 1.5,
    dur: 1.0 + (i % 5) * 0.2,
    size: 16 + (i % 4) * 5,
    spin: i % 2 === 0,
    emoji: i % 6 === 0 ? "💎" : i % 4 === 0 ? "⭐" : "🪙",
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
      {coins.map((c) => (
        <motion.div key={c.id}
          className="absolute select-none"
          style={{ left: `${c.x}%`, top: -40, fontSize: c.size, lineHeight: 1 }}
          initial={{ y: -60, opacity: 0, rotate: 0, scale: 0.4 }}
          animate={{ y: 720, opacity: [0, 1, 1, 0], rotate: c.spin ? 360 : -360, scale: [0.4, 1.2, 1] }}
          transition={{ delay: c.delay, duration: c.dur, ease: "easeIn", repeat: Infinity, repeatDelay: 0.5 }}
        />
      ))}
    </div>
  );
}

// ─── CONFETTI BURST ─────────────────────────────────────────────────────────────
const CONF_COLORS = ["#FFD700","#ff8c00","#a855f7","#7c3aed","#22c55e","#3b82f6","#f43f5e","#fbbf24","#34d399","#fff"];

function ConfettiBurst() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: CONF_COLORS[i % CONF_COLORS.length],
    x: 3 + (i * 2.4),
    delay: (i * 0.035) % 1.0,
    dur: 1.2 + (i % 5) * 0.2,
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
            width: p.size, height: p.shape === 0 ? p.size : p.size * 0.45,
            left: `${p.x}%`, top: -12,
            background: p.color,
            borderRadius: p.shape === 2 ? "50%" : 2,
          }}
          initial={{ y: -20, opacity: 1, rotate: p.rot, scale: 1 }}
          animate={{ y: 560, opacity: [1, 1, 0.4, 0], rotate: p.rot + 560, scale: [1, 0.8, 0.4] }}
          transition={{ delay: p.delay, duration: p.dur, ease: [0.2, 0, 0.8, 1] }}
        />
      ))}
    </div>
  );
}

// ─── NEON ORB ─────────────────────────────────────────────────────────────────
function NeonOrb({ color, x, y, size, dur }: { color: string; x: string; y: string; size: number; dur: number }) {
  return (
    <motion.div className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, left: x, top: y, background: `radial-gradient(circle, ${color} 0%, transparent 70%)`, filter: "blur(32px)" }}
      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.65, 0.3] }}
      transition={{ duration: dur, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ─── PULSE RINGS ──────────────────────────────────────────────────────────────
function PulseRings({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      {[1, 2, 3].map((i) => (
        <motion.div key={i} className="absolute rounded-full border-2"
          style={{ borderColor: color, width: 64 + i * 30, height: 64 + i * 30 }}
          animate={{ scale: [1, 1.65], opacity: [0.7, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

// ─── CHEST ANIMATION ──────────────────────────────────────────────────────────
function ChestReveal() {
  const [frame, setFrame] = useState(0);
  const frames = ["📦", "📦", "🎁", "💰"];

  useEffect(() => {
    const timings = [350, 650, 450];
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
      animate={frame === 1 ? { rotate: [-8, 8, -8, 8, 0], scale: [1, 1.1, 1] } : frame === 2 ? { scale: [1, 1.5, 0.9, 1.15, 1] } : {}}
      transition={{ duration: 0.45 }}>
      <motion.div className="text-[72px] select-none"
        key={frame}
        initial={{ scale: 0.6, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}>
        {frames[Math.min(frame, 3)]}
      </motion.div>
      {frame >= 2 && (
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 10 }, (_, i) => (
            <motion.div key={i} className="absolute"
              style={{
                width: 3, height: 32,
                left: "50%", top: "50%",
                transformOrigin: "0 0",
                background: "linear-gradient(0deg, #FFD700, transparent)",
                rotate: `${i * 36}deg`,
                borderRadius: 4,
              }}
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 0.65, delay: 0.04 * i }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── PERKS ────────────────────────────────────────────────────────────────────
const PERKS = [
  { icon: "🎮", text: "Play any game with your bonus" },
  { icon: "💳", text: "New users only — one time bonus" },
  { icon: "⚡", text: "Credited instantly to wallet"  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function WelcomeBonusModal({ visible, onClose, displayName }: Props) {
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [claimed, setClaimed] = useState(false);

  const firstName = displayName ? displayName.split(" ")[0] : "";

  useEffect(() => {
    if (visible) {
      setClaimed(false);
      timerRef.current = setTimeout(onClose, 12000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, onClose]);

  function handleClaim() {
    setClaimed(true);
    setTimeout(onClose, 1400);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
          style={{ maxWidth: 480, margin: "0 auto" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>

          {/* Dark cinematic backdrop */}
          <div className="absolute inset-0"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(255,215,0,0.15) 0%, rgba(7,5,15,0.98) 55%)" }}
          />

          {/* Neon orbs */}
          <NeonOrb color="rgba(255,215,0,0.7)"  x="-5%"  y="5%"  size={280} dur={3.0} />
          <NeonOrb color="rgba(255,140,0,0.5)"  x="65%"  y="55%" size={200} dur={2.5} />
          <NeonOrb color="rgba(124,58,237,0.45)"x="5%"   y="65%" size={160} dur={3.7} />
          <NeonOrb color="rgba(255,215,0,0.3)"  x="75%"  y="0%"  size={130} dur={2.8} />

          {/* Coin rain + confetti */}
          <CoinRain />
          <ConfettiBurst />

          {/* ── Card ── */}
          <motion.div
            className="relative w-full rounded-[28px] overflow-hidden z-20"
            style={{
              background: "linear-gradient(170deg, #0d0800 0%, #080500 45%, #000000 100%)",
              border: "1.5px solid rgba(255,215,0,0.3)",
              boxShadow: "0 0 60px rgba(255,215,0,0.25), 0 0 120px rgba(255,140,0,0.12), inset 0 1px 0 rgba(255,215,0,0.12)",
            }}
            initial={{ scale: 0.55, y: 90, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.88, y: 50, opacity: 0 }}
            transition={{ type: "spring", stiffness: 310, damping: 22 }}>

            {/* Animated gold top bar */}
            <motion.div className="h-1.5 w-full"
              style={{ background: "linear-gradient(90deg, #FFD700, #ff8c00, #FFD700, #fff7a0, #FFD700, #ff8c00, #FFD700)" }}
              animate={{ backgroundPosition: ["0% 50%", "200% 50%"] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
            />

            <div className="px-5 pt-5 pb-6 flex flex-col items-center text-center relative">

              {/* NEW USER BONUS badge */}
              <motion.div
                className="flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,140,0,0.1))",
                  border: "1px solid rgba(255,215,0,0.45)",
                  boxShadow: "0 0 20px rgba(255,215,0,0.25)",
                }}
                initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <motion.span animate={{ rotate: [-12, 12, -12] }} transition={{ duration: 0.9, repeat: Infinity }}>🎉</motion.span>
                <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#FFD700" }}>NEW USER BONUS</span>
                <motion.span animate={{ rotate: [12, -12, 12] }} transition={{ duration: 0.9, repeat: Infinity }}>🎉</motion.span>
              </motion.div>

              {/* Chest */}
              <motion.div className="relative mb-2"
                initial={{ scale: 0.25, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.18, type: "spring", stiffness: 300, damping: 18 }}>
                <ChestReveal />
                <motion.div className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ background: "radial-gradient(circle, rgba(255,215,0,0.4) 0%, transparent 70%)" }}
                  animate={{ scale: [1, 1.6, 1], opacity: [0.45, 0.9, 0.45] }}
                  transition={{ duration: 1.7, repeat: Infinity }}
                />
              </motion.div>

              {/* Welcome headline */}
              <motion.div className="mb-1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h2 className="font-black text-white leading-tight"
                  style={{ fontSize: firstName ? "1.35rem" : "1.25rem", textShadow: "0 0 20px rgba(255,215,0,0.3)" }}>
                  {firstName ? (
                    <>Welcome, <span style={{ color: "#FFD700" }}>{firstName}!</span></>
                  ) : (
                    <>🎉 Welcome to <span style={{ color: "#FFD700" }}>WINGGO!</span></>
                  )}
                </h2>
                <p className="text-xs mt-1 font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Your account is ready. Here's your gift:
                </p>
              </motion.div>

              {/* ₹50 amount — centrepiece */}
              <motion.div
                className="relative flex items-center justify-center my-3 w-full"
                initial={{ scale: 0.35, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.45, type: "spring", stiffness: 270, damping: 18 }}>
                <PulseRings color="#FFD700" />
                <div className="relative z-10 flex flex-col items-center px-10 py-4 rounded-3xl w-full"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,215,0,0.14) 0%, rgba(255,140,0,0.07) 100%)",
                    border: "2px solid rgba(255,215,0,0.55)",
                    boxShadow: "0 0 45px rgba(255,215,0,0.22), inset 0 1px 0 rgba(255,215,0,0.18)",
                  }}>
                  <span className="text-[10px] font-black tracking-[0.22em] uppercase mb-1"
                    style={{ color: "rgba(255,215,0,0.6)" }}>
                    🎁 BONUS ADDED TO WALLET
                  </span>
                  <motion.div
                    className="font-black leading-none"
                    style={{ fontSize: 68, color: "#FFD700", textShadow: "0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4)" }}
                    animate={{ textShadow: [
                      "0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)",
                      "0 0 50px rgba(255,215,0,1.0), 0 0 90px rgba(255,215,0,0.6)",
                      "0 0 20px rgba(255,215,0,0.5), 0 0 40px rgba(255,215,0,0.2)",
                    ] }}
                    transition={{ duration: 1.6, repeat: Infinity }}>
                    ₹50
                  </motion.div>
                  <motion.div
                    className="flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)" }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.85, type: "spring" }}>
                    <span className="text-sm" style={{ color: "#4ade80" }}>✓</span>
                    <span className="text-xs font-black" style={{ color: "#4ade80" }}>Bonus Added Successfully</span>
                  </motion.div>
                </div>
              </motion.div>

              {/* Perks */}
              <div className="w-full space-y-2">
                {PERKS.map((p, i) => (
                  <motion.div key={p.text}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-2xl"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,215,0,0.1)",
                    }}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.7 + i * 0.1 }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
                      style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)" }}>
                      {p.icon}
                    </div>
                    <span className="text-sm font-semibold text-white text-left">{p.text}</span>
                    <motion.div className="ml-auto w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)" }}
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      transition={{ delay: 0.85 + i * 0.1, type: "spring" }}>
                      <span className="text-xs" style={{ color: "#22c55e" }}>✓</span>
                    </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* CLAIM NOW button */}
              <motion.div className="w-full mt-5"
                initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.05 }}>
                <AnimatePresence mode="wait">
                  {!claimed ? (
                    <motion.button key="claim"
                      className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer relative overflow-hidden"
                      style={{
                        background: "linear-gradient(135deg, #FFD700 0%, #ff8c00 50%, #e65c00 100%)",
                        color: "#000",
                        boxShadow: "0 0 35px rgba(255,215,0,0.65), 0 0 70px rgba(255,140,0,0.3)",
                        letterSpacing: "0.06em",
                        border: "1px solid rgba(255,235,100,0.5)",
                      }}
                      whileTap={{ scale: 0.96 }}
                      onClick={handleClaim}
                      animate={{ boxShadow: [
                        "0 0 25px rgba(255,215,0,0.5), 0 0 50px rgba(255,140,0,0.2)",
                        "0 0 50px rgba(255,215,0,0.95), 0 0 90px rgba(255,140,0,0.5)",
                        "0 0 25px rgba(255,215,0,0.5), 0 0 50px rgba(255,140,0,0.2)",
                      ] }}
                      transition={{ duration: 1.5, repeat: Infinity }}>
                      {/* Shimmer sweep */}
                      <motion.div className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.28) 50%, transparent 65%)" }}
                        animate={{ x: ["-120%", "220%"] }}
                        transition={{ duration: 1.7, repeat: Infinity, repeatDelay: 0.8 }}
                      />
                      🎉 CLAIM ₹50 BONUS
                    </motion.button>
                  ) : (
                    <motion.div key="claimed"
                      className="w-full py-4 rounded-2xl font-black text-lg text-center"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.4)" }}
                      initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      ✅ ₹50 Bonus Credited to Wallet!
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Divider */}
              <div className="w-full h-px mt-4 mb-3 rounded-full"
                style={{ background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.25), transparent)" }}
              />

              {/* Bottom trust icons */}
              <motion.div className="flex items-center gap-6 w-full justify-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
                {[["🔒","Secure"], ["⚡","Instant"], ["🏆","Real Cash"]].map(([icon, label]) => (
                  <div key={label} className="flex flex-col items-center gap-0.5">
                    <span className="text-base">{icon}</span>
                    <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</span>
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
