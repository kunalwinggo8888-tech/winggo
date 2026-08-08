import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

const PLATFORM_PCT = 0.10;
const GAME_DURATION = 180; // 03:00
const W = 390, H = 650;
const MAX_LIVES = 3;

// p5 Fruit Ninja fruit catalogue (name → emoji + value)
const FRUITS = [
  { name: "apple",       emoji: "🍎", color: "#ef4444", value: 1 },
  { name: "banana",      emoji: "🍌", color: "#facc15", value: 1 },
  { name: "peach",       emoji: "🍑", color: "#fb923c", value: 2 },
  { name: "strawberry",  emoji: "🍓", color: "#ec4899", value: 2 },
  { name: "watermelon",  emoji: "🍉", color: "#22c55e", value: 3 },
];
const BOMB = { name: "boom", emoji: "💣", color: "#1e293b", value: -1 };

const BOT_NAMES = ["Mia Slicer", "Leo Blade", "Ava Ninja", "Rohan Chop", "Sara Cut", "Dev Slice"];

interface Fruit {
  id: number; x: number; y: number; xSpeed: number; ySpeed: number;
  size: number; name: string; emoji: string; color: string; value: number;
  sliced: boolean; visible: boolean; alpha: number; rot: number; rotV: number;
}

interface SliceParticle { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number }

interface Props { onBack: () => void; initialFee: number }

// ── Component ─────────────────────────────────────────────────────────────────
export default function SuperFruitNinjaGame({ onBack, initialFee }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();
  const isFreeMode     = initialFee === 0;
  const prize          = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const botName    = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]).current;
  const settledRef = useRef(false);

  const [phase,       setPhase]     = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [score,       setScore]     = useState(0);
  const [botScore,    setBotScore]  = useState(0);
  const [lives,       setLives]     = useState(MAX_LIVES);
  const [timeLeft,    setTimeLeft]  = useState(GAME_DURATION);
  const [won,         setWon]       = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef  = useRef(phase); phaseRef.current = phase;
  const animRef   = useRef(0);

  const gRef = useRef({
    fruits: [] as Fruit[],
    particles: [] as SliceParticle[],
    swipes: [] as { x: number; y: number }[],
    score: 0, botScore: 0, lives: MAX_LIVES, timer: GAME_DURATION, nextId: 0,
    spawnCooldown: 0, lastTs: 0, prev: null as { x: number; y: number } | null,
    ended: false,
  });

  const startGame = useCallback(() => {
    const g = gRef.current;
    g.fruits = []; g.particles = []; g.swipes = [];
    g.score = 0; g.botScore = 0; g.lives = MAX_LIVES; g.timer = GAME_DURATION; g.nextId = 0;
    g.spawnCooldown = 0; g.prev = null; g.ended = false;
    setScore(0); setBotScore(0); setLives(MAX_LIVES); setTimeLeft(GAME_DURATION); setWon(false);
    settledRef.current = false;
    setPhase("playing");
  }, []);

  // ── End match helper (idempotent) ─────────────────────────────────────────
  const endMatch = useCallback((g: typeof gRef.current) => {
    if (g.ended) return;
    g.ended = true;
    setPhase("result");
    const w = g.score > g.botScore;
    setWon(w);
    if (!isFreeMode && w) addWinning(prize, `🍉 Super Fruit Ninja — Won ₹${prize}`);
    addMatch({
      gameId: "superfruitninja",
      gameName: isFreeMode ? "Super Fruit Ninja (Practice)" : "Super Fruit Ninja",
      gameIcon: "🍉",
      result: w ? "win" : "loss",
      entryFee: initialFee,
      prize: !isFreeMode && w ? prize : 0,
      userScore: g.score,
      opponentScore: Math.floor(g.botScore),
      opponentName: botName,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeMode, initialFee, prize, botName]);

  // ── Game loop ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gRef.current;

    function spawnFruit() {
      const isBomb = Math.random() < 0.14;
      const def = isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)];
      const x = 30 + Math.random() * (W - 60);
      const size = 38 + Math.random() * 20;
      // xSpeed drives fruit toward the opposite side (p5 randomXSpeed)
      const xSpeed = x > W / 2 ? -(0.5 + Math.random() * 2.3) : (0.5 + Math.random() * 2.3);
      g.fruits.push({
        id: g.nextId++, x, y: H + size, xSpeed, ySpeed: -(7.4 + Math.random() * 3),
        size, name: def.name, emoji: def.emoji, color: def.color, value: def.value,
        sliced: false, visible: true, alpha: 1, rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 0.1,
      });
    }

    function spawnParticles(x: number, y: number, color: string) {
      for (let i = 0; i < 10; i++) {
        g.particles.push({ x, y, vx: (Math.random() - 0.5) * 7, vy: (Math.random() - 0.5) * 7 - 2, life: 1, color, r: 3 + Math.random() * 5 });
      }
    }

    // Sword slice detection — port of p5 Sword.checkSlice (distance based)
    function checkSlice() {
      const swipes = g.swipes;
      if (swipes.length < 2) return;
      const s1 = swipes[swipes.length - 1];
      const s2 = swipes[swipes.length - 2];
      const d3 = Math.hypot(s1.x - s2.x, s1.y - s2.y);
      for (const fruit of g.fruits) {
        if (fruit.sliced || !fruit.visible) continue;
        const d1 = Math.hypot(s1.x - fruit.x, s1.y - fruit.y);
        const d2 = Math.hypot(s2.x - fruit.x, s2.y - fruit.y);
        const sliced = (d1 < fruit.size) || ((d1 < d3 && d2 < d3) && (d3 < W / 4));
        if (sliced) {
          fruit.sliced = true;
          if (fruit.name === "boom") {
            // Bomb! Lose a life
            g.lives = Math.max(0, g.lives - 1);
            spawnParticles(fruit.x, fruit.y, "#ef4444");
          } else {
            g.score += fruit.value;
            spawnParticles(fruit.x, fruit.y, fruit.color);
          }
        }
      }
    }

    let last = performance.now();

    function draw() {
      if (phaseRef.current !== "playing") return;
      const now = performance.now();
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;

      // Timer
      g.timer = Math.max(0, g.timer - dt / 60);
      setTimeLeft(Math.ceil(g.timer));

      // Bot score climbs over time
      g.botScore += dt * (0.28 + Math.random() * 0.2);
      setBotScore(Math.floor(g.botScore));

      // Spawn
      g.spawnCooldown -= dt;
      if (g.spawnCooldown <= 0) { spawnFruit(); g.spawnCooldown = 26 + Math.random() * 18; }

      // Background (dark neon dojo)
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0d0316"); bg.addColorStop(1, "#020006");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(34,197,94,0.07)"; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Sword trail
      if (g.swipes.length > 1) {
        ctx.save();
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        ctx.shadowColor = "#00e5ff"; ctx.shadowBlur = 12;
        for (let i = 1; i < g.swipes.length; i++) {
          const a = g.swipes[i - 1], b = g.swipes[i];
          const alpha = (i / g.swipes.length) * 0.85;
          ctx.strokeStyle = `rgba(0,229,255,${alpha})`;
          ctx.lineWidth = 2 + (i / g.swipes.length) * 5;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.restore();
      }

      // Fruits
      for (const fruit of g.fruits) {
        if (!fruit.visible) continue;
        if (fruit.sliced) {
          fruit.ySpeed += 0.5 * dt; // gravity × 5 for sliced halves
        } else {
          fruit.ySpeed += 0.1 * dt; // gravity
        }
        fruit.x += fruit.xSpeed * dt;
        fruit.y += fruit.ySpeed * dt;
        fruit.rot += fruit.rotV * dt;
        if (fruit.sliced) fruit.alpha -= 0.035 * dt;
        if (fruit.y > H + 60 || fruit.alpha <= 0) {
          // Missed fruit (unsliced & not bomb) → lose life
          if (!fruit.sliced && fruit.name !== "boom") {
            g.lives = Math.max(0, g.lives - 1);
          }
          fruit.visible = false;
          continue;
        }
        ctx.save();
        ctx.translate(fruit.x, fruit.y);
        ctx.rotate(fruit.rot);
        ctx.globalAlpha = Math.max(0, fruit.alpha);
        if (fruit.sliced) {
          // Two halves
          ctx.fillStyle = fruit.color;
          ctx.beginPath(); ctx.arc(-fruit.size * 0.35, 0, fruit.size * 0.62, Math.PI, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(fruit.size * 0.35, 0, fruit.size * 0.62, 0, Math.PI); ctx.fill();
        } else {
          ctx.shadowColor = fruit.color; ctx.shadowBlur = 12;
          ctx.fillStyle = fruit.color;
          ctx.beginPath(); ctx.arc(0, 0, fruit.size * 0.62, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.beginPath(); ctx.arc(-fruit.size * 0.18, -fruit.size * 0.18, fruit.size * 0.16, 0, Math.PI * 2); ctx.fill();
          ctx.font = `${fruit.size * 0.95}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(fruit.emoji, 0, 0);
        }
        ctx.restore();
      }

      // Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.15 * dt;
        p.life -= 0.03 * dt;
        if (p.life <= 0) { g.particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Fade swipes (keep max 20)
      if (g.swipes.length > 20) g.swipes.splice(0, 2);
      if (g.swipes.length > 0) g.swipes.splice(0, 1);

      // Sync UI every few frames
      setScore(g.score); setLives(g.lives);

      // End conditions: timer up OR lives out
      if (g.timer <= 0 || g.lives <= 0) {
        endMatch(g);
        return;
      }

      animRef.current = requestAnimationFrame(draw);
    }
    animRef.current = requestAnimationFrame(draw);

    // ── Pointer events (sword swipe) ──────────────────────────────────────
    const onMove = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / rect.width, sy = H / rect.height;
      const x = (cx - rect.left) * sx, y = (cy - rect.top) * sy;
      g.swipes.push({ x, y });
      checkSlice();
      g.prev = { x, y };
    };
    const onDown = (cx: number, cy: number) => {
      const rect = canvas.getBoundingClientRect();
      const sx = W / rect.width, sy = H / rect.height;
      g.prev = { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
      g.swipes.push(g.prev);
    };
    const onUp = () => { g.prev = null; };

    const onMouseDown = (e: MouseEvent) => onDown(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => { if (e.buttons > 0) onMove(e.clientX, e.clientY); };
    const onTouchStart = (e: TouchEvent) => { e.preventDefault(); onDown(e.touches[0].clientX, e.touches[0].clientY); };
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onMouseUp = () => onUp();
    const onTouchEnd = () => onUp();

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: false });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(animRef.current);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, [phase, endMatch]);

  function handleRematch() { settledRef.current = false; setWon(false); setScore(0); setBotScore(0); setLives(MAX_LIVES); setTimeLeft(GAME_DURATION); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#020006", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🍉</span><span className="font-black text-white text-base">Super Fruit Ninja</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>{isFreeMode ? "FREE" : `₹${initialFee}`}</span>
        </div>
      </div>

      {phase === "matchmaking" && (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
            style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.45)" }}
            animate={{ rotate: [0, 30, -30, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>🍉</motion.div>
          <div className="text-center">
            <div className="text-white font-black text-xl">Super Fruit Ninja!</div>
            <div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Slice fruits for 3 minutes — beat {botName}!</div>
          </div>
          <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>{isFreeMode ? "FREE" : `₹${initialFee}`}</div></div>
            <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
            <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>{isFreeMode ? "—" : `₹${prize}`}</div></div>
          </div>
          <div className="flex items-center gap-3 text-xs font-bold">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>⏳ Matchmaking</span>
            <span style={{ color: "#22c55e" }}>vs {botName}</span>
          </div>
          <MatchCountdown onStart={startGame} />
        </div>
      )}

      {phase === "playing" && (
        <div className="flex-1 flex flex-col items-center relative">
          {/* ── TOP BAR: Your Score / Opponent Score / Name / Live Score / Timer ── */}
          <div className="w-full px-3 py-2 flex items-center justify-between" style={{ background: "rgba(0,0,0,0.7)", borderBottom: "1px solid rgba(255,215,0,0.15)" }}>
            <div className="text-center">
              <div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.7)" }}>YOUR SCORE</div>
              <div className="text-base font-black" style={{ color: "#22c55e" }}>{score}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.7)" }}>⏱ {timeLeft}s</div>
              <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{botName}</div>
            </div>
            <div className="text-center">
              <div className="text-[9px] font-bold" style={{ color: "rgba(239,68,68,0.7)" }}>OPPONENT</div>
              <div className="text-base font-black" style={{ color: "#ef4444" }}>{botScore}</div>
            </div>
          </div>
          {/* Lives */}
          <div className="w-full px-3 py-1 flex items-center justify-center gap-1" style={{ background: "rgba(0,0,0,0.5)" }}>
            {Array.from({ length: MAX_LIVES }).map((_, i) => (
              <span key={i} style={{ fontSize: 16, opacity: i < lives ? 1 : 0.2 }}>🍓</span>
            ))}
            <span className="ml-2 text-[10px] font-bold" style={{ color: lives <= 1 ? "#ef4444" : "rgba(255,255,255,0.4)" }}>
              {lives <= 1 ? "⚠ Careful!" : "3 lives"}
            </span>
          </div>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, touchAction: "none", cursor: "crosshair" }} />
          <div className="text-center text-xs font-bold mt-1 pb-2" style={{ color: "rgba(255,255,255,0.3)" }}>Swipe to slice! Don't hit 💣 — missed fruits cost a life</div>
        </div>
      )}

      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(34,197,94,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#22c55e" : "#ef4444" }}>{won ? "Master Slicer! 🎉" : "Bot Wins!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>You {score} · {botName} {botScore}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>🍉 Fruits Sliced</span>
              <span className="text-base font-black text-white">{score}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>🍓 Lives Left</span>
              <span className="text-base font-black text-white">{lives}</span>
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: won ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.05)", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
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

function MatchCountdown({ onStart }: { onStart: () => void }) {
  const [cd, setCd] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 150); return 0; } return c - 1; }), 900);
    return () => clearInterval(t);
  }, [onStart]);
  return (
    <motion.div key={cd} initial={{ scale: 1.6, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}
      className="font-black text-5xl" style={{ color: "#22c55e", textShadow: "0 0 20px rgba(34,197,94,0.6)" }}>
      {cd}
    </motion.div>
  );
}
