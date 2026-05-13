/**
 * BottleShootGame — WINGGO Premium Shooter
 * Canvas-based bottle shooting game.
 * Crosshair follows pointer; click/tap to fire a bullet.
 * Bottles stand on a shelf — shatter on hit with particles.
 * 60-second timer; beat the bot score to win.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 560;
const SHELF_Y = H - 120;
const GAME_DURATION = 60;

interface Bottle {
  x: number; y: number;
  w: number; h: number;
  color: string; alive: boolean;
  shakeT: number;
}
interface Bullet { x: number; y: number; vx: number; vy: number; alive: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; alpha: number; color: string; r: number }

const BOTTLE_COLORS = ["#3b82f6","#10b981","#f97316","#a855f7","#ef4444","#eab308"];

function makeBottles(): Bottle[] {
  const bottles: Bottle[] = [];
  const count = 6;
  const spacing = (W - 60) / count;
  for (let i = 0; i < count; i++) {
    bottles.push({
      x: 30 + i * spacing + spacing / 2,
      y: SHELF_Y,
      w: 28, h: 52,
      color: BOTTLE_COLORS[i % BOTTLE_COLORS.length],
      alive: true,
      shakeT: 0,
    });
  }
  return bottles;
}

function spawnParticles(x: number, y: number, color: string): Particle[] {
  const pts: Particle[] = [];
  for (let i = 0; i < 18; i++) {
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const speed = 2 + Math.random() * 5;
    pts.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      alpha: 1,
      color,
      r: 2 + Math.random() * 3,
    });
  }
  return pts;
}

function drawBottle(ctx: CanvasRenderingContext2D, b: Bottle) {
  if (!b.alive) return;
  const { x, y, w, h, color } = b;
  const bx = x - w / 2, by = y - h;

  // Body
  ctx.fillStyle = color + "cc";
  ctx.beginPath();
  ctx.roundRect(bx + 4, by + h * 0.3, w - 8, h * 0.7, [0, 0, 6, 6]);
  ctx.fill();

  // Neck
  ctx.fillStyle = color + "aa";
  ctx.beginPath();
  ctx.roundRect(bx + 8, by, w - 16, h * 0.35, 4);
  ctx.fill();

  // Cap
  ctx.fillStyle = "#ffffff33";
  ctx.beginPath();
  ctx.roundRect(bx + 7, by - 6, w - 14, 8, 2);
  ctx.fill();

  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.roundRect(bx + 6, by + h * 0.35, 5, h * 0.45, 3);
  ctx.fill();

  // Neon glow outline
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.roundRect(bx + 4, by + h * 0.3, w - 8, h * 0.7, [0, 0, 6, 6]);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export default function BottleShootGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const [botScore] = useState(() => getBotScore(120, difficulty));
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const gameRef = useRef({
    bottles: [] as Bottle[],
    bullets: [] as Bullet[],
    particles: [] as Particle[],
    crosshair: { x: W / 2, y: H / 2 },
    score: 0,
    timeLeft: GAME_DURATION,
    running: false,
    frame: 0,
    respawnTimer: 0,
    combo: 0,
    comboTimer: 0,
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [won, setWon] = useState(false);
  const [comboMsg, setComboMsg] = useState("");

  function startGame() {
    const g = gameRef.current;
    g.bottles = makeBottles();
    g.bullets = [];
    g.particles = [];
    g.score = 0;
    g.timeLeft = GAME_DURATION;
    g.running = true;
    g.frame = 0;
    g.respawnTimer = 0;
    g.combo = 0;
    g.comboTimer = 0;
    g.crosshair = { x: W / 2, y: H / 2 };
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setComboMsg("");
    setPhase("playing");
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gameRef.current;

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      g.crosshair.x = (e.clientX - rect.left) * scaleX;
      g.crosshair.y = (e.clientY - rect.top) * scaleY;
    }

    function shoot(e: PointerEvent) {
      e.preventDefault();
      if (!g.running) return;
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const tx = (e.clientX - rect.left) * scaleX;
      const ty = (e.clientY - rect.top) * scaleY;
      const GUN_X = W / 2, GUN_Y = H - 20;
      const dx = tx - GUN_X, dy = ty - GUN_Y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      g.bullets.push({ x: GUN_X, y: GUN_Y, vx: (dx / len) * 16, vy: (dy / len) * 16, alive: true });
    }

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", shoot);

    let lastSec = 0;

    function loop(ts: number) {
      if (!g.running) return;

      // Timer (1 tick per second)
      const sec = Math.floor(ts / 1000);
      if (sec !== lastSec) {
        lastSec = sec;
        g.timeLeft--;
        setTimeLeft(g.timeLeft);
        if (g.timeLeft <= 0) {
          g.running = false;
          const didWin = g.score > botScore;
          setWon(didWin);
          if (didWin) addWinning(prize, "Bottle Shoot Win");
          setPhase("result");
          return;
        }
      }

      // Move bullets
      for (const b of g.bullets) {
        b.x += b.vx; b.y += b.vy;
        if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) b.alive = false;
      }
      g.bullets = g.bullets.filter((b) => b.alive);

      // Bullet ↔ bottle collisions
      for (const bullet of g.bullets) {
        for (const bottle of g.bottles) {
          if (!bottle.alive || !bullet.alive) continue;
          const bx = bottle.x - bottle.w / 2, by = bottle.y - bottle.h;
          if (bullet.x > bx && bullet.x < bx + bottle.w && bullet.y > by && bullet.y < by + bottle.h) {
            bullet.alive = false;
            bottle.alive = false;
            g.particles.push(...spawnParticles(bottle.x, bottle.y - bottle.h / 2, bottle.color));
            g.combo++;
            g.comboTimer = 90;
            const pts = 10 * (g.combo >= 3 ? 2 : 1);
            g.score += pts;
            setScore(g.score);
            if (g.combo >= 3) setComboMsg(`🔥 COMBO ×${g.combo}!`);
          }
        }
      }
      g.bullets = g.bullets.filter((b) => b.alive);

      // Combo timer
      if (g.comboTimer > 0) {
        g.comboTimer--;
        if (g.comboTimer === 0) { g.combo = 0; setComboMsg(""); }
      }

      // Respawn bottles when all gone
      g.respawnTimer++;
      if (g.bottles.every((b) => !b.alive) && g.respawnTimer > 40) {
        g.bottles = makeBottles();
        g.respawnTimer = 0;
      }

      // Particles
      for (const p of g.particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.18;
        p.alpha -= 0.022;
      }
      g.particles = g.particles.filter((p) => p.alpha > 0);

      // ─── DRAW ───────────────────────────────────────────────
      // Background
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#0a0415");
      grad.addColorStop(1, "#120820");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);

      // Stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 40; i++) {
        const sx = ((i * 97 + 13) % W);
        const sy = ((i * 137 + 7) % (SHELF_Y - 40));
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Wooden shelf
      ctx.fillStyle = "#5c3a1e";
      ctx.fillRect(0, SHELF_Y, W, 18);
      ctx.fillStyle = "#7c4f2b";
      ctx.fillRect(0, SHELF_Y, W, 5);
      // Shelf neon glow
      ctx.strokeStyle = "#FFD70066";
      ctx.lineWidth = 1;
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 10;
      ctx.strokeRect(0, SHELF_Y, W, 18);
      ctx.shadowBlur = 0;

      // Floor
      ctx.fillStyle = "#1a0d2e";
      ctx.fillRect(0, SHELF_Y + 18, W, H);
      // Floor neon lines
      for (let l = 1; l <= 3; l++) {
        ctx.strokeStyle = `rgba(139,92,246,${0.08 * l})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, SHELF_Y + 18 + l * 25);
        ctx.lineTo(W, SHELF_Y + 18 + l * 25);
        ctx.stroke();
      }

      // Bottles
      for (const b of g.bottles) drawBottle(ctx, b);

      // Particles
      for (const p of g.particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Bullets
      for (const b of g.bullets) {
        ctx.fillStyle = "#FFD700";
        ctx.shadowColor = "#FFD700";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Gun at bottom
      const GUN_X = W / 2, GUN_Y = H - 20;
      ctx.fillStyle = "#4a5568";
      ctx.beginPath();
      ctx.roundRect(GUN_X - 12, GUN_Y - 6, 24, 28, 4);
      ctx.fill();
      ctx.fillStyle = "#718096";
      ctx.beginPath();
      ctx.roundRect(GUN_X - 4, GUN_Y - 24, 8, 22, 3);
      ctx.fill();

      // Crosshair
      const cx = g.crosshair.x, cy = g.crosshair.y;
      ctx.strokeStyle = "#ef444499";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(GUN_X, GUN_Y - 10); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx - 16, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx + 16, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy - 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + 16); ctx.lineTo(cx, cy + 20); ctx.stroke();
      ctx.shadowBlur = 0;

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath(); ctx.roundRect(8, 8, 140, 38, 10); ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${g.score}`, 18, 28);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "11px sans-serif";
      ctx.fillText(`Bot: ${botScore}`, 90, 28);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", shoot);
    };
  }, [phase, addWinning, botScore, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#050412", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🔫 Bottle Shoot</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      {/* Timer bar (playing) */}
      {phase === "playing" && (
        <div className="px-4 py-2 flex items-center gap-3" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div className="h-full rounded-full" style={{ background: timeLeft > 20 ? "#22c55e" : "#ef4444" }}
              animate={{ width: `${(timeLeft / GAME_DURATION) * 100}%` }} transition={{ duration: 0.5 }} />
          </div>
          <span className="text-xs font-black w-10 text-right" style={{ color: timeLeft <= 20 ? "#ef4444" : "#22c55e" }}>
            {timeLeft}s
          </span>
          {comboMsg && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xs font-black" style={{ color: "#ff8c00" }}>
              {comboMsg}
            </motion.span>
          )}
        </div>
      )}

      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", cursor: "none", touchAction: "none" }} />

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(5,4,18,0.93)" }}>
              <div className="text-7xl">🔫</div>
              <div className="text-white font-black text-3xl">Bottle Shoot</div>
              <div className="text-zinc-400 text-sm text-center px-8">Aim & click to shoot bottles! Combos earn double points. Beat the bot!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} vs <b className="text-white">{difficulty.botName}</b> · Bot target: {botScore} pts
              </div>
              <div className="px-4 py-2 rounded-xl text-xs text-zinc-400" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                🖱️ Move to aim · Click/Tap to fire · 3× combo = 2× pts
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                FIRE! 🔫
              </motion.button>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8"
              style={{ background: "rgba(5,4,18,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "😞"}</div>
              <div className="text-white font-black text-3xl">{won ? "WINNER!" : "Bot Wins!"}</div>
              <div className="w-full rounded-2xl px-5 py-4 flex justify-between" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div><div className="text-zinc-400 text-xs">Your Score</div><div className="text-white font-black text-2xl">{score}</div></div>
                <div className="text-right"><div className="text-zinc-400 text-xs">Bot Score</div><div className="text-zinc-300 font-black text-2xl">{botScore}</div></div>
              </div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black text-base"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                  Play Again
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                  Home
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
