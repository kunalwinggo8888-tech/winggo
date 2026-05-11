import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";

const SEGMENTS = [
  { label: "₹5 Cash",              color: "#FFD700", textColor: "#000" },
  { label: "10 Coins",             color: "#3B82F6", textColor: "#fff" },
  { label: "Better Luck",          color: "#374151", textColor: "#9CA3AF" },
  { label: "₹10 Cash",            color: "#EF4444", textColor: "#fff" },
  { label: "2x Referral",          color: "#8B5CF6", textColor: "#fff" },
  { label: "₹2 Bonus",            color: "#10B981", textColor: "#fff" },
  { label: "50 Coins",             color: "#F97316", textColor: "#fff" },
  { label: "₹20 Cash",            color: "#EC4899", textColor: "#fff" },
];

const N = SEGMENTS.length;
const SEG_ANGLE = 360 / N;
const CX = 160;
const CY = 160;
const R = 148;
const INNER_R = 40;

const DAILY_KEY = "winggo_last_spin_date";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function segmentPath(i: number): string {
  const start = polarToCartesian(CX, CY, R, i * SEG_ANGLE);
  const end   = polarToCartesian(CX, CY, R, (i + 1) * SEG_ANGLE);
  const iStart = polarToCartesian(CX, CY, INNER_R, i * SEG_ANGLE);
  const iEnd   = polarToCartesian(CX, CY, INNER_R, (i + 1) * SEG_ANGLE);
  const large  = SEG_ANGLE > 180 ? 1 : 0;
  return [
    `M ${iStart.x} ${iStart.y}`,
    `L ${start.x} ${start.y}`,
    `A ${R} ${R} 0 ${large} 1 ${end.x} ${end.y}`,
    `L ${iEnd.x} ${iEnd.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${large} 0 ${iStart.x} ${iStart.y}`,
    "Z",
  ].join(" ");
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ["#FFD700","#EF4444","#3B82F6","#10B981","#8B5CF6","#F97316","#EC4899","#fff"];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: 6 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 2 + Math.random() * 4,
      angle: Math.random() * 360,
      spin:  (Math.random() - 0.5) * 6,
      drift: (Math.random() - 0.5) * 2,
    }));

    function draw() {
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      let alive = false;
      for (const p of pieces) {
        p.y     += p.speed;
        p.x     += p.drift;
        p.angle += p.spin;
        if (p.y < canvas!.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
        ctx.rotate((p.angle * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ctx.clearRect(0, 0, canvas.width, canvas.height); };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50 w-full h-full"
      style={{ display: active ? "block" : "none" }}
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface SpinWheelProps {
  onBack: () => void;
}

export default function SpinWheel({ onBack }: SpinWheelProps) {
  const [rotation, setRotation]   = useState(0);
  const [spinning, setSpinning]   = useState(false);
  const [winner, setWinner]       = useState<typeof SEGMENTS[0] | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confetti, setConfetti]   = useState(false);
  const [alreadySpun, setAlreadySpun] = useState(() => localStorage.getItem(DAILY_KEY) === todayStr());
  const rotRef = useRef(0);

  const spin = useCallback(() => {
    if (spinning || alreadySpun) return;

    const winIdx   = Math.floor(Math.random() * N);
    const winAngle = winIdx * SEG_ANGLE + SEG_ANGLE / 2;
    const normalizedCurrent = rotRef.current % 360;
    const delta     = (winAngle - normalizedCurrent + 360) % 360;
    const target    = rotRef.current + 5 * 360 + delta;

    rotRef.current = target;
    setRotation(target);
    setSpinning(true);

    setTimeout(() => {
      setSpinning(false);
      setWinner(SEGMENTS[winIdx]);
      setShowModal(true);
      setConfetti(true);
      localStorage.setItem(DAILY_KEY, todayStr());
      setAlreadySpun(true);
      setTimeout(() => setConfetti(false), 3500);
    }, 4500);
  }, [spinning, alreadySpun]);

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center relative overflow-hidden"
      style={{ background: "#07070d", maxWidth: "480px", margin: "0 auto" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Confetti active={confetti} />

      {/* ── Header ── */}
      <div
        className="w-full flex items-center gap-3 px-4 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <BackButton onBack={onBack} label="Home" />
        <h2 className="text-white font-black text-xl tracking-tight flex-1">
          Spin &amp; Win
        </h2>
        {alreadySpun && (
          <span
            className="text-xs font-semibold px-2 py-1 rounded-full"
            style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444" }}
          >
            Used Today
          </span>
        )}
      </div>

      {/* ── Subtitle ── */}
      <p className="text-zinc-500 text-sm mt-4 mb-2 text-center px-6">
        {alreadySpun
          ? "You've already spun today. Come back tomorrow!"
          : "Spin once daily for a chance to win big prizes!"}
      </p>

      {/* ── Wheel Container ── */}
      <div className="relative flex items-center justify-center mt-4" style={{ width: 340, height: 340 }}>
        {/* Outer glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "transparent",
            boxShadow: "0 0 40px rgba(255,215,0,0.25), 0 0 80px rgba(255,215,0,0.1), inset 0 0 30px rgba(0,0,0,0.5)",
            borderRadius: "50%",
          }}
        />

        {/* Pointer / Arrow at top */}
        <div
          className="absolute z-20 flex flex-col items-center"
          style={{ top: -2, left: "50%", transform: "translateX(-50%)" }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: "12px solid transparent",
              borderRight: "12px solid transparent",
              borderTop: "28px solid #FFD700",
              filter: "drop-shadow(0 0 8px rgba(255,215,0,0.9))",
            }}
          />
        </div>

        {/* Rotating wheel SVG */}
        <div
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? "transform 4.4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : "none",
            width: 320,
            height: 320,
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 0 0 4px rgba(255,215,0,0.3)",
          }}
        >
          <svg viewBox="0 0 320 320" width="320" height="320">
            {/* Segments */}
            {SEGMENTS.map((seg, i) => {
              const mid = polarToCartesian(CX, CY, R * 0.68, i * SEG_ANGLE + SEG_ANGLE / 2);
              const textAngle = i * SEG_ANGLE + SEG_ANGLE / 2;
              return (
                <g key={i}>
                  <path
                    d={segmentPath(i)}
                    fill={seg.color}
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth="1.5"
                  />
                  <text
                    x={mid.x}
                    y={mid.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={seg.textColor}
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="Inter, sans-serif"
                    transform={`rotate(${textAngle}, ${mid.x}, ${mid.y})`}
                    style={{ userSelect: "none", letterSpacing: "-0.3px" }}
                  >
                    {seg.label.length > 10
                      ? seg.label.split(" ").map((w, wi) => (
                          <tspan key={wi} x={mid.x} dy={wi === 0 ? "-5" : "13"}>
                            {w}
                          </tspan>
                        ))
                      : seg.label}
                  </text>
                </g>
              );
            })}

            {/* Center circle (background) */}
            <circle cx={CX} cy={CY} r={INNER_R + 4} fill="#0a0a14" />
            <circle
              cx={CX} cy={CY} r={INNER_R + 4}
              fill="none"
              stroke="rgba(255,215,0,0.3)"
              strokeWidth="2"
            />
          </svg>
        </div>

        {/* SPIN button — center overlay (fixed, doesn't rotate) */}
        <motion.button
          data-testid="button-spin"
          onClick={spin}
          disabled={spinning || alreadySpun}
          className="absolute z-30 rounded-full font-black text-sm cursor-pointer"
          style={{
            width: 76,
            height: 76,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: spinning || alreadySpun
              ? "linear-gradient(135deg, #374151, #1f2937)"
              : "linear-gradient(135deg, #FFD700, #ff8c00)",
            color: spinning || alreadySpun ? "#6b7280" : "#000",
            boxShadow: spinning || alreadySpun
              ? "none"
              : "0 0 20px rgba(255,215,0,0.7), 0 0 40px rgba(255,140,0,0.3)",
            border: "3px solid rgba(255,255,255,0.15)",
            letterSpacing: "0.05em",
          }}
          whileHover={!spinning && !alreadySpun ? { scale: 1.08 } : {}}
          whileTap={!spinning && !alreadySpun ? { scale: 0.93 } : {}}
          animate={!spinning && !alreadySpun ? {
            boxShadow: [
              "0 0 20px rgba(255,215,0,0.7), 0 0 40px rgba(255,140,0,0.3)",
              "0 0 30px rgba(255,215,0,1), 0 0 60px rgba(255,140,0,0.5)",
              "0 0 20px rgba(255,215,0,0.7), 0 0 40px rgba(255,140,0,0.3)",
            ]
          } : {}}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {spinning ? "..." : "SPIN"}
        </motion.button>
      </div>

      {/* ── Prize Legend ── */}
      <div className="w-full px-5 mt-8">
        <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mb-3">
          Prize Slots
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {SEGMENTS.map((seg, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: seg.color, boxShadow: `0 0 6px ${seg.color}80` }}
              />
              <span className="text-zinc-300 text-xs font-medium truncate">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Win Modal ── */}
      <AnimatePresence>
        {showModal && winner && (
          <>
            <motion.div
              className="fixed inset-0 z-40"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
            />
            <motion.div
              className="fixed z-50 flex flex-col items-center text-center"
              style={{
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "min(340px, 88vw)",
                background: "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)",
                border: "1.5px solid rgba(255,215,0,0.3)",
                borderRadius: "28px",
                padding: "36px 28px 28px",
                boxShadow: "0 0 60px rgba(255,215,0,0.2), 0 24px 64px rgba(0,0,0,0.8)",
              }}
              initial={{ opacity: 0, scale: 0.7, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
            >
              {/* Trophy */}
              <motion.div
                className="text-6xl mb-3"
                animate={{ rotate: [-8, 8, -8], scale: [1, 1.1, 1] }}
                transition={{ duration: 0.7, repeat: 2 }}
              >
                🎉
              </motion.div>

              <h2 className="text-white font-black text-2xl leading-tight">
                Congratulations!
              </h2>
              <p className="text-zinc-400 text-sm mt-1 mb-5">You've won today's prize</p>

              {/* Prize Badge */}
              <div
                className="px-6 py-3 rounded-2xl font-black text-2xl mb-6"
                style={{
                  background: `linear-gradient(135deg, ${winner.color}33, ${winner.color}11)`,
                  border: `2px solid ${winner.color}`,
                  color: winner.color,
                  boxShadow: `0 0 24px ${winner.color}50`,
                  minWidth: "160px",
                }}
              >
                {winner.label}
              </div>

              {winner.label !== "Better Luck" && (
                <p className="text-zinc-400 text-xs mb-5">
                  Reward added to your wallet automatically
                </p>
              )}

              <motion.button
                data-testid="button-modal-close"
                onClick={() => setShowModal(false)}
                className="w-full h-12 rounded-2xl font-bold text-black cursor-pointer"
                style={{
                  background: "linear-gradient(135deg, #FFD700, #ff8c00)",
                  boxShadow: "0 0 16px rgba(255,215,0,0.4)",
                }}
                whileTap={{ scale: 0.97 }}
              >
                Awesome! 🎯
              </motion.button>

              <p className="text-zinc-600 text-xs mt-4">
                Next spin available tomorrow
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
