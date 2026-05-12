/**
 * FruitChopGame — WINGGO 3D Fruit Slicing
 * Canvas 2D: swipe-to-slice, blade trail, particle juice, combo multiplier, 60s timer.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const W = 360, H = 500;
const FRUITS = [
  { emoji: "🍎", color: "#ef4444", juice: "#ff6666" },
  { emoji: "🍊", color: "#f97316", juice: "#ffa04d" },
  { emoji: "🍋", color: "#eab308", juice: "#ffd700" },
  { emoji: "🍇", color: "#a855f7", juice: "#cc88ff" },
  { emoji: "🍓", color: "#ec4899", juice: "#ff80b5" },
  { emoji: "🍉", color: "#22c55e", juice: "#66ee88" },
];

interface Fruit { id: number; x: number; y: number; vx: number; vy: number; r: number; fIdx: number; sliced: boolean; alpha: number; rot: number; rotV: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number }
interface Blade { x: number; y: number; age: number }

function MM({ fee, onStart }: { fee: number; onStart: () => void }) {
  const [cd, setCd] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 200); return 0; } return c - 1; }), 900);
    return () => clearInterval(t);
  }, [onStart]);
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.45)" }}
        animate={{ rotate: [0, 30, -30, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>🍉</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Fruit Chop!</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Swipe to slice fruits in 60 seconds!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(34,197,94,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function FruitChopGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [timeDisp, setTimeDisp] = useState(60);
  const [comboDisp, setComboDisp] = useState(0);
  const [won, setWon] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("matchmaking");
  phaseRef.current = phase;
  const animRef = useRef<number>(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
  const WIN_SCORE = 500;

  const gRef = useRef({
    fruits: [] as Fruit[],
    particles: [] as Particle[],
    blade: [] as Blade[],
    score: 0, timer: 60, nextId: 0,
    spawnCooldown: 0, combo: 0, comboTimer: 0,
    prevMouse: null as { x: number; y: number } | null,
    slicedThisFrame: [] as number[],
  });

  const startGame = useCallback(() => {
    const g = gRef.current;
    g.fruits = []; g.particles = []; g.blade = [];
    g.score = 0; g.timer = 60; g.nextId = 0;
    g.spawnCooldown = 0; g.combo = 0; g.comboTimer = 0;
    g.prevMouse = null; g.slicedThisFrame = [];
    setScoreDisp(0); setTimeDisp(60); setComboDisp(0);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gRef.current;

    function spawnFruit() {
      const fIdx = Math.floor(Math.random() * FRUITS.length);
      const x = 50 + Math.random() * (W - 100);
      g.fruits.push({ id: g.nextId++, x, y: H + 30, vx: (Math.random() - 0.5) * 2, vy: -(9 + Math.random() * 5), r: 28 + Math.random() * 14, fIdx, sliced: false, alpha: 1, rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.08 });
    }

    function spawnParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 8; i++) {
        g.particles.push({ x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6 - 2, life: 1, color, r: 4 + Math.random() * 5 });
      }
    }

    function checkSlice(x1: number, y1: number, x2: number, y2: number) {
      const slicedNow: number[] = [];
      for (const fruit of g.fruits) {
        if (fruit.sliced) continue;
        // Line-circle intersection
        const dx = x2 - x1, dy = y2 - y1;
        const fx = fruit.x - x1, fy = fruit.y - y1;
        const t = Math.max(0, Math.min(1, (fx * dx + fy * dy) / (dx * dx + dy * dy)));
        const nx = x1 + t * dx - fruit.x, ny = y1 + t * dy - fruit.y;
        if (nx * nx + ny * ny < fruit.r * fruit.r) {
          fruit.sliced = true; slicedNow.push(fruit.id);
          spawnParticles(fruit.x, fruit.y, FRUITS[fruit.fIdx].juice);
        }
      }
      if (slicedNow.length > 0) {
        g.combo++;
        g.comboTimer = 60;
        const mult = Math.min(4, g.combo);
        const pts = slicedNow.length * 10 * mult;
        g.score += pts;
        setScoreDisp(g.score); setComboDisp(g.combo);
      }
    }

    let lastTime = performance.now();
    let timerMs = 60000;

    function draw() {
      if (phaseRef.current !== "playing") return;
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 16.67, 3);
      lastTime = now;

      timerMs -= (now - (performance.now() - dt * 16.67));
      // Use actual dt for timer
      g.timer = Math.max(0, g.timer - dt / 60);
      setTimeDisp(Math.ceil(g.timer));

      // Spawn
      g.spawnCooldown -= dt;
      if (g.spawnCooldown <= 0) { spawnFruit(); g.spawnCooldown = 28 + Math.random() * 20; }

      // Combo decay
      g.comboTimer -= dt;
      if (g.comboTimer <= 0) { g.combo = 0; setComboDisp(0); }

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0015"); bg.addColorStop(1, "#020008");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Neon grid
      ctx.strokeStyle = "rgba(100,0,200,0.08)"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Blade trail
      if (g.blade.length > 1) {
        ctx.save();
        ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 12;
        for (let i = 1; i < g.blade.length; i++) {
          const a = g.blade[i - 1], b = g.blade[i];
          const alpha = (1 - b.age / 14) * 0.85;
          ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
          ctx.lineWidth = (1 - b.age / 14) * 5;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
      }

      // Fruits
      for (const fruit of g.fruits) {
        fruit.vy += 0.18 * dt;
        fruit.x += fruit.vx * dt; fruit.y += fruit.vy * dt;
        fruit.rot += fruit.rotV * dt;

        if (fruit.sliced) {
          fruit.alpha -= 0.04 * dt;
          if (fruit.alpha <= 0) continue;
        }

        ctx.save();
        ctx.translate(fruit.x, fruit.y);
        ctx.rotate(fruit.rot);
        ctx.globalAlpha = fruit.alpha;

        if (fruit.sliced) {
          // Two halves
          ctx.fillStyle = FRUITS[fruit.fIdx].juice;
          ctx.beginPath(); ctx.arc(0, 0, fruit.r, Math.PI, Math.PI * 2); ctx.fill();
          ctx.fillStyle = FRUITS[fruit.fIdx].color;
          ctx.beginPath(); ctx.arc(0, 0, fruit.r, 0, Math.PI); ctx.fill();
        } else {
          ctx.shadowColor = FRUITS[fruit.fIdx].color; ctx.shadowBlur = 10;
          ctx.fillStyle = FRUITS[fruit.fIdx].color;
          ctx.beginPath(); ctx.arc(0, 0, fruit.r, 0, Math.PI * 2); ctx.fill();
          // Shine
          ctx.fillStyle = "rgba(255,255,255,0.3)";
          ctx.beginPath(); ctx.arc(-fruit.r * 0.3, -fruit.r * 0.3, fruit.r * 0.3, 0, Math.PI * 2); ctx.fill();
          // Emoji
          ctx.globalAlpha = 1; ctx.font = `${fruit.r * 1.1}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(FRUITS[fruit.fIdx].emoji, 0, 0);
        }
        ctx.restore();
      }

      // Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.15 * dt;
        p.life -= 0.025 * dt;
        if (p.life <= 0) { g.particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Blade age
      g.blade.forEach(b => b.age++);
      g.blade = g.blade.filter(b => b.age < 14);

      // Remove off-screen fruits
      g.fruits = g.fruits.filter(f => f.y < H + 80 && f.alpha > 0);

      // End game
      if (g.timer <= 0) {
        const w = g.score >= WIN_SCORE;
        setWon(w); if (w) addWinning(prize, `🍉 Fruit Chop — Won ₹${prize}`);
        setPhase("result"); return;
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);

    // Pointer events for slicing
    const onMove = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / rect.width, sy = H / rect.height;
      const x = (cx - rect.left) * sx, y = (cy - rect.top) * sy;
      g.blade.push({ x, y, age: 0 });
      if (g.prevMouse) checkSlice(g.prevMouse.x, g.prevMouse.y, x, y);
      g.prevMouse = { x, y };
    };
    const onUp = () => { g.prevMouse = null; };

    const onMouseMove = (e: MouseEvent) => { if (e.buttons > 0) onMove(e.clientX, e.clientY); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchEnd = () => onUp();

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("mouseup", onUp);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("mouseup", onUp);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() { setWon(false); setScoreDisp(0); setTimeDisp(60); setComboDisp(0); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0a0015", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🍉</span><span className="font-black text-white text-base">Fruit Chop 3D</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>
      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col items-center relative">
          <div className="flex items-center justify-between w-full px-3 py-2 absolute top-0 z-10" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.7)" }}>SCORE</div><div className="text-base font-black" style={{ color: "#22c55e" }}>{scoreDisp}</div></div>
            {comboDisp > 1 && <div className="text-base font-black" style={{ color: "#FFD700", textShadow: "0 0 10px #FFD700" }}>🔥 x{comboDisp} COMBO</div>}
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>TIME</div><div className="text-base font-black" style={{ color: timeDisp <= 10 ? "#ef4444" : "#ff8c00" }}>{timeDisp}s</div></div>
          </div>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, touchAction: "none", cursor: "crosshair", marginTop: 40 }} />
          <div className="text-center text-xs font-bold mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Swipe to slice! Target: {WIN_SCORE} pts</div>
        </div>
      )}
      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(34,197,94,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#22c55e" : "#ef4444" }}>{won ? "Master Slicer! 🎉" : "Time's Up!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Score: {scoreDisp} / {WIN_SCORE}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#22c55e" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#22c55e,#15803d)", color: "#fff", boxShadow: "0 0 28px rgba(34,197,94,0.4)" }}>
            🍉 Chop Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
