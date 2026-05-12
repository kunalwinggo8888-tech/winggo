/**
 * AlienFusionGame — WINGGO Drop & Merge Puzzle (Suika-style)
 * Canvas 2D: gravity + collision physics, merge same-tier aliens, glow animations.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const W = 360, H = 520;
const GRAVITY = 0.22;
const BOUNCE = 0.22;
const FRICTION = 0.98;

const ALIENS = [
  { emoji: "👾", color: "#22c55e", r: 18, pts: 1 },
  { emoji: "👽", color: "#00e5ff", r: 24, pts: 3 },
  { emoji: "🛸", color: "#a855f7", r: 30, pts: 6 },
  { emoji: "🌟", color: "#FFD700", r: 38, pts: 12 },
  { emoji: "🚀", color: "#ef4444", r: 46, pts: 25 },
  { emoji: "🌌", color: "#ff8c00", r: 54, pts: 50 },
];

interface Ball { id: number; x: number; y: number; vx: number; vy: number; tier: number; merging: boolean; glowT: number }

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
        style={{ background: "rgba(168,85,247,0.12)", border: "2px solid rgba(168,85,247,0.45)" }}
        animate={{ scale: [1, 1.1, 1], rotate: [0, 10, -10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>👽</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Alien Fusion</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Drop & merge aliens to evolve!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(168,85,247,0.07)", border: "1px solid rgba(168,85,247,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(168,85,247,0.9)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function AlienFusionGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [nextTier, setNextTier] = useState(0);
  const [won, setWon] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("matchmaking");
  phaseRef.current = phase;
  const animRef = useRef<number>(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
  const WIN_SCORE = 400;
  const WALL_L = 30, WALL_R = W - 30, FLOOR = H - 30;

  const gRef = useRef({
    balls: [] as Ball[],
    nextId: 0,
    score: 0,
    dropX: W / 2,
    canDrop: true,
    nextTier: 0,
    dropCooldown: 0,
    mergeQueue: [] as { a: number; b: number }[],
  });

  const startGame = useCallback(() => {
    const g = gRef.current;
    g.balls = []; g.nextId = 0; g.score = 0; g.dropX = W / 2;
    g.canDrop = true; g.nextTier = 0; g.dropCooldown = 0; g.mergeQueue = [];
    setScoreDisp(0); setNextTier(0);
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gRef.current;

    function dropBall(x: number) {
      if (!g.canDrop) return;
      g.canDrop = false;
      g.balls.push({ id: g.nextId++, x, y: 60, vx: 0, vy: 1, tier: g.nextTier, merging: false, glowT: 0 });
      g.nextTier = Math.floor(Math.random() * 3);
      setNextTier(g.nextTier);
      g.dropCooldown = 40;
    }

    function collide(a: Ball, b: Ball) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ra = ALIENS[a.tier].r, rb = ALIENS[b.tier].r;
      const minDist = ra + rb;
      if (dist >= minDist || dist < 0.1) return;
      const nx = dx / dist, ny = dy / dist;
      const overlap = (minDist - dist) / 2;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
      // Velocity exchange
      const relV = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relV > 0) return;
      const imp = relV * BOUNCE;
      a.vx += imp * nx; a.vy += imp * ny;
      b.vx -= imp * nx; b.vy -= imp * ny;
    }

    let animId: number;
    function loop() {
      if (phaseRef.current !== "playing") return;

      // Cooldown
      if (g.dropCooldown > 0) { g.dropCooldown--; if (g.dropCooldown <= 0) g.canDrop = true; }

      // Physics
      for (const b of g.balls) {
        b.vy += GRAVITY; b.vx *= FRICTION; b.vy *= FRICTION;
        b.x += b.vx; b.y += b.vy;
        const r = ALIENS[b.tier].r;
        if (b.x - r < WALL_L) { b.x = WALL_L + r; b.vx = Math.abs(b.vx) * BOUNCE; }
        if (b.x + r > WALL_R) { b.x = WALL_R - r; b.vx = -Math.abs(b.vx) * BOUNCE; }
        if (b.y + r > FLOOR) { b.y = FLOOR - r; b.vy = -Math.abs(b.vy) * BOUNCE; }
        if (b.glowT > 0) b.glowT--;
      }

      // Collision
      for (let i = 0; i < g.balls.length; i++) {
        for (let j = i + 1; j < g.balls.length; j++) {
          collide(g.balls[i], g.balls[j]);
        }
      }

      // Merge same-tier
      const toRemove = new Set<number>();
      for (let i = 0; i < g.balls.length; i++) {
        for (let j = i + 1; j < g.balls.length; j++) {
          const a = g.balls[i], b = g.balls[j];
          if (toRemove.has(a.id) || toRemove.has(b.id)) continue;
          if (a.tier !== b.tier || a.merging || b.merging) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < ALIENS[a.tier].r * 1.8) {
            const newTier = Math.min(a.tier + 1, ALIENS.length - 1);
            g.score += ALIENS[newTier].pts;
            setScoreDisp(g.score);
            toRemove.add(a.id); toRemove.add(b.id);
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            g.balls.push({ id: g.nextId++, x: mx, y: my, vx: 0, vy: -2, tier: newTier, merging: false, glowT: 30 });
            if (g.score >= WIN_SCORE) {
              setWon(true); addWinning(prize, `👽 Alien Fusion — Won ₹${prize}`); setPhase("result"); return;
            }
          }
        }
      }
      g.balls = g.balls.filter(b => !toRemove.has(b.id));

      // Overflow check
      if (g.balls.some(b => b.y - ALIENS[b.tier].r < 70 && b.vy < 0.5)) {
        if (g.balls.length > 12) { setWon(false); setPhase("result"); return; }
      }

      // Draw
      ctx.clearRect(0, 0, W, H);
      // Background
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "#080018"); bg.addColorStop(1, "#020010");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97 + 13) % W, sy = (i * 173 + 37) % (H - 60) + 60;
        ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
      }

      // Glass container
      ctx.strokeStyle = "rgba(168,85,247,0.6)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(WALL_L, 60); ctx.lineTo(WALL_L, FLOOR); ctx.lineTo(WALL_R, FLOOR); ctx.lineTo(WALL_R, 60); ctx.stroke();
      ctx.fillStyle = "rgba(168,85,247,0.05)"; ctx.fillRect(WALL_L, 60, WALL_R - WALL_L, FLOOR - 60);

      // Drop preview
      const previewR = ALIENS[g.nextTier].r;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = ALIENS[g.nextTier].color;
      ctx.beginPath(); ctx.arc(g.dropX, 35, previewR, 0, Math.PI * 2); ctx.fill();
      ctx.font = `${previewR * 1.1}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.5; ctx.fillText(ALIENS[g.nextTier].emoji, g.dropX, 35);
      ctx.globalAlpha = 1;

      // Drop line
      ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(g.dropX, 60); ctx.lineTo(g.dropX, FLOOR); ctx.stroke(); ctx.setLineDash([]);

      // Balls
      for (const b of g.balls) {
        const alien = ALIENS[b.tier];
        if (b.glowT > 0) { ctx.shadowColor = alien.color; ctx.shadowBlur = 20 * (b.glowT / 30); }
        ctx.fillStyle = alien.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, alien.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.font = `${alien.r * 1.1}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(alien.emoji, b.x, b.y);
      }

      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    animRef.current = animId;

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const x = ((cx - rect.left) / rect.width) * W;
      g.dropX = Math.max(WALL_L + ALIENS[g.nextTier].r, Math.min(WALL_R - ALIENS[g.nextTier].r, x));
    };
    const onDrop = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const cx = "touches" in e ? (e as TouchEvent).changedTouches[0].clientX : (e as MouseEvent).clientX;
      const x = ((cx - rect.left) / rect.width) * W;
      g.dropX = Math.max(WALL_L + ALIENS[g.nextTier].r, Math.min(WALL_R - ALIENS[g.nextTier].r, x));
      dropBall(g.dropX);
    };

    canvas.addEventListener("mousemove", onPointerMove as (e: Event) => void);
    canvas.addEventListener("touchmove", onPointerMove as (e: Event) => void, { passive: true });
    canvas.addEventListener("click", onDrop as (e: Event) => void);
    canvas.addEventListener("touchend", onDrop as (e: Event) => void);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousemove", onPointerMove as (e: Event) => void);
      canvas.removeEventListener("touchmove", onPointerMove as (e: Event) => void);
      canvas.removeEventListener("click", onDrop as (e: Event) => void);
      canvas.removeEventListener("touchend", onDrop as (e: Event) => void);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() { setWon(false); setScoreDisp(0); setNextTier(0); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(168,85,247,0.2)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#080018", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">👽</span><span className="font-black text-white text-base">Alien Fusion</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>
      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col items-center relative">
          <div className="flex items-center justify-between w-full px-3 py-2" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(168,85,247,0.8)" }}>SCORE</div><div className="text-base font-black" style={{ color: "#a855f7" }}>{scoreDisp}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>TARGET</div><div className="text-sm font-bold" style={{ color: scoreDisp >= WIN_SCORE ? "#22c55e" : "rgba(255,255,255,0.4)" }}>{scoreDisp}/{WIN_SCORE}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>NEXT</div><div className="text-lg">{ALIENS[nextTier].emoji}</div></div>
          </div>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, touchAction: "none", cursor: "crosshair" }} />
          <div className="text-center text-xs font-bold py-1" style={{ color: "rgba(255,255,255,0.3)" }}>Tap/click to drop alien</div>
        </div>
      )}
      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(168,85,247,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(168,85,247,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(168,85,247,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💀"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#a855f7" : "#ef4444" }}>{won ? "Fusion Master! 🎉" : "Container Full!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Score: {scoreDisp}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(168,85,247,0.2)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(168,85,247,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#a855f7" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#a855f7,#6d28d9)", color: "#fff", boxShadow: "0 0 28px rgba(168,85,247,0.4)" }}>
            👽 Fuse Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
