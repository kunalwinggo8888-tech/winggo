/**
 * Gold Miner 3D — WINGGO
 * Classic canvas 2D gold miner. Swinging hook, click to launch.
 * Collect gold/gems to reach level score. Beat the bot target.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 520;
const HOOK_ORIGIN_X = W / 2, HOOK_ORIGIN_Y = 60;
const GAME_TIME = 60;

interface Mineral { x: number; y: number; r: number; type: "gold" | "stone" | "gem"; value: number; weight: number; collected: boolean }
interface Hook { angle: number; length: number; extending: boolean; retracting: boolean; vAngle: number; attached: Mineral | null }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; r: number }

const MINERAL_DEFS: { type: Mineral["type"]; color: string; rimColor: string; glowColor: string }[] = [
  { type: "gold",  color: "#FFD700", rimColor: "#b8860b", glowColor: "#FFD700" },
  { type: "stone", color: "#888888", rimColor: "#555555", glowColor: "#aaaaaa" },
  { type: "gem",   color: "#00e5ff", rimColor: "#0077aa", glowColor: "#00e5ff" },
];

function spawnMinerals(difficulty: ReturnType<typeof getBotDifficulty>): Mineral[] {
  const minerals: Mineral[] = [];
  const goldCount  = difficulty.level === "God Mode" ? 3 : 6;
  const stoneCount = difficulty.level === "God Mode" ? 8 : 4;
  const gemCount   = difficulty.level === "God Mode" ? 1 : 3;

  for (let i = 0; i < goldCount; i++) {
    const r = 20 + Math.random() * 18;
    minerals.push({ x: 50 + Math.random() * (W - 100), y: 160 + Math.random() * (H - 220), r, type: "gold", value: Math.round(r * 4), weight: r * 0.8, collected: false });
  }
  for (let i = 0; i < stoneCount; i++) {
    const r = 22 + Math.random() * 22;
    minerals.push({ x: 50 + Math.random() * (W - 100), y: 160 + Math.random() * (H - 220), r, type: "stone", value: Math.round(r * 0.5), weight: r * 2.2, collected: false });
  }
  for (let i = 0; i < gemCount; i++) {
    const r = 10 + Math.random() * 10;
    minerals.push({ x: 50 + Math.random() * (W - 100), y: 160 + Math.random() * (H - 220), r, type: "gem", value: Math.round(r * 12), weight: r * 0.3, collected: false });
  }
  return minerals;
}

function getMineralDef(type: Mineral["type"]) {
  return MINERAL_DEFS.find((m) => m.type === type)!;
}

function drawMineral(ctx: CanvasRenderingContext2D, m: Mineral) {
  if (m.collected) return;
  const def = getMineralDef(m.type);
  ctx.beginPath();
  if (m.type === "gem") {
    // Diamond shape
    ctx.moveTo(m.x, m.y - m.r);
    ctx.lineTo(m.x + m.r * 0.7, m.y);
    ctx.lineTo(m.x, m.y + m.r);
    ctx.lineTo(m.x - m.r * 0.7, m.y);
    ctx.closePath();
  } else {
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
  }
  ctx.fillStyle = def.color;
  ctx.shadowColor = def.glowColor;
  ctx.shadowBlur = 12;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = def.rimColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  // Shine
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(m.x - m.r * 0.3, m.y - m.r * 0.3, m.r * 0.25, 0, Math.PI * 2);
  ctx.fill();
  // Value label
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.font = `bold ${Math.max(9, Math.round(m.r * 0.45))}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(`$${m.value}`, m.x, m.y + 4);
}

export default function GoldMinerGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const stateRef = useRef({
    hook: { angle: -Math.PI / 4, length: 50, extending: false, retracting: false, vAngle: 0.022, attached: null as Mineral | null } as Hook,
    minerals: [] as Mineral[],
    particles: [] as Particle[],
    score: 0, timeLeft: GAME_TIME, frame: 0, running: false,
    botTarget: 0, lastSec: 0,
    collecting: false, collectTimer: 0, collectLabel: "",
    explosion: false, explodeTimer: 0,
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [won, setWon] = useState(false);
  const [botTarget] = useState(() => {
    const base = difficulty.level === "God Mode" ? 900 : difficulty.level === "Pro" ? 600 : 300;
    return base + Math.floor(Math.random() * 150);
  });

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    s.minerals = spawnMinerals(difficulty);
    s.score = 0; s.timeLeft = GAME_TIME; s.frame = 0; s.running = true;
    s.hook = { angle: -Math.PI / 4, length: 50, extending: false, retracting: false, vAngle: 0.022, attached: null };
    s.particles = []; s.collectLabel = ""; s.collecting = false; s.collectTimer = 0;
    s.botTarget = botTarget; s.lastSec = 0;
    setScore(0); setTimeLeft(GAME_TIME);

    function launch(e: PointerEvent) {
      e.preventDefault();
      const h = s.hook;
      if (!h.extending && !h.retracting && !h.attached) {
        h.extending = true;
      }
    }

    canvas.addEventListener("pointerdown", launch);

    function loop(ts: number) {
      if (!s.running) return;
      s.frame++;

      // Timer
      const nowSec = Math.floor(ts / 1000);
      if (nowSec !== s.lastSec) {
        s.lastSec = nowSec;
        s.timeLeft--;
        setTimeLeft(s.timeLeft);
        if (s.timeLeft <= 0) {
          s.running = false;
          const playerWins = s.score > botTarget;
          setWon(playerWins);
          if (playerWins) addWinning(prize, "Gold Miner Win");
          setPhase("result");
          return;
        }
      }

      const h = s.hook;

      if (!h.extending && !h.retracting && !h.attached) {
        // Swing
        h.angle += h.vAngle;
        if (h.angle > Math.PI / 4 || h.angle < -Math.PI * 0.75) h.vAngle *= -1;
        h.angle = Math.max(-Math.PI * 0.75, Math.min(Math.PI / 4, h.angle));
      }

      const hx = HOOK_ORIGIN_X + Math.sin(h.angle) * h.length;
      const hy = HOOK_ORIGIN_Y + Math.cos(h.angle) * h.length;

      if (h.extending) {
        const retractSpeed = h.attached ? Math.max(0.5, 4 / (h.attached.weight * 0.04 + 1)) : 4;
        h.length += retractSpeed;

        // Check mineral collision
        if (!h.attached) {
          for (const m of s.minerals) {
            if (m.collected) continue;
            const dist = Math.sqrt((hx - m.x) ** 2 + (hy - m.y) ** 2);
            if (dist < m.r + 10) {
              h.attached = m;
              h.extending = false;
              h.retracting = true;
              // Particles
              for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 2 * i) / 12;
                const def = getMineralDef(m.type);
                s.particles.push({ x: m.x, y: m.y, vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3 - 1, life: 25, color: def.glowColor, r: 3 + Math.random() * 3 });
              }
              break;
            }
          }
        }

        // Hit ground
        if (h.length > H - HOOK_ORIGIN_Y - 20) { h.extending = false; h.retracting = true; }
      }

      if (h.retracting) {
        const retractSpeed = h.attached ? Math.max(0.8, 5 / (h.attached.weight * 0.04 + 1)) : 5;
        h.length -= retractSpeed;
        if (h.length <= 50) {
          h.length = 50;
          h.retracting = false;
          if (h.attached) {
            h.attached.collected = true;
            const earned = h.attached.value;
            s.score += earned;
            s.collectLabel = `+$${earned} ${h.attached.type === "gem" ? "💎" : h.attached.type === "gold" ? "🥇" : "🪨"}`;
            s.collectTimer = 60;
            setScore(s.score);
            h.attached = null;
            // Respawn if all collected
            if (s.minerals.every((m) => m.collected)) {
              s.minerals = spawnMinerals(difficulty);
            }
          }
        }
      }

      if (s.collectTimer > 0) s.collectTimer--;
      else s.collectLabel = "";

      // Particles
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; }
      s.particles = s.particles.filter((p) => p.life > 0);

      // ─── DRAW ─────────────────────────────────────────────────────────
      // Background sky to ground gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0a1f");
      bg.addColorStop(0.3, "#1a0a0a");
      bg.addColorStop(0.35, "#5c3a1e");
      bg.addColorStop(1, "#2a1a0a");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Sky stars
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 97) % W, sy = (i * 137) % 80;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Ground surface line
      const groundY = 130;
      ctx.fillStyle = "#7c4f2b";
      ctx.fillRect(0, groundY, W, 8);
      ctx.fillStyle = "#5c3a1e";
      ctx.fillRect(0, groundY + 8, W, H - groundY - 8);

      // Dirt texture lines
      for (let y = groundY + 20; y < H; y += 35) {
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      // Minerals
      for (const m of s.minerals) drawMineral(ctx, m);

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / 25;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Rope
      ctx.strokeStyle = "#c8a060";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(HOOK_ORIGIN_X, HOOK_ORIGIN_Y); ctx.lineTo(hx, hy); ctx.stroke();
      ctx.setLineDash([]);

      // Hook claw
      ctx.strokeStyle = "#aaaaaa";
      ctx.lineWidth = 3;
      ctx.shadowColor = h.attached ? "#FFD700" : "#aaaaaa";
      ctx.shadowBlur = h.attached ? 14 : 6;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 8, hy + 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 8, hy + 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy + 16); ctx.stroke();
      ctx.shadowBlur = 0;

      // If carrying, draw mineral near hook
      if (h.attached && !h.attached.collected) {
        const def = getMineralDef(h.attached.type);
        ctx.beginPath();
        ctx.arc(hx, hy + h.attached.r + 14, h.attached.r, 0, Math.PI * 2);
        ctx.fillStyle = def.color;
        ctx.shadowColor = def.glowColor;
        ctx.shadowBlur = 14;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Mining machine (top platform)
      ctx.fillStyle = "#2d2d4a";
      ctx.beginPath(); ctx.roundRect(W / 2 - 50, 0, 100, 55, 6); ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 10;
      ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("GOLD MINE", W / 2, 22);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#888";
      ctx.fillRect(W / 2 - 3, 40, 6, 20);

      // Collect popup
      if (s.collectTimer > 0 && s.collectLabel) {
        const alpha = Math.min(1, s.collectTimer / 20);
        const flyUp = (60 - s.collectTimer) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#FFD700";
        ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 12;
        ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(s.collectLabel, W / 2, 80 - flyUp);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath(); ctx.roundRect(6, 6, 180, 44, 8); ctx.fill();
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
      ctx.fillText(`$${s.score}`, 16, 26);
      ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.font = "11px sans-serif";
      ctx.fillText(`Bot: $${botTarget}`, 16, 42);
      // Timer
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath(); ctx.roundRect(W - 76, 6, 70, 30, 8); ctx.fill();
      ctx.fillStyle = s.timeLeft <= 10 ? "#ef4444" : "#22c55e";
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
      ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`⏱${s.timeLeft}`, W - 40, 26);
      ctx.shadowBlur = 0;

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", launch);
    };
  }, [phase, addWinning, botTarget, difficulty, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex flex-col" style={{ background: "#0a0a1f", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">⛏️ Gold Miner</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", touchAction: "none" }} />
        {phase === "playing" && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-zinc-400 pointer-events-none">
            Tap to launch hook · Gold 🥇 · Gems 💎 (rare!) · Stones 🪨 (slow)
          </div>
        )}
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(10,10,31,0.93)" }}>
              <div className="text-7xl">⛏️</div>
              <div className="text-white font-black text-3xl">Gold Miner 3D</div>
              <div className="text-zinc-400 text-sm text-center px-8">Launch the hook to grab gold & gems. Earn more than the bot before time's up!</div>
              <div className="flex gap-3 text-sm">
                <span className="px-2 py-1 rounded" style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700" }}>🥇 Gold = High value</span>
                <span className="px-2 py-1 rounded" style={{ background: "rgba(0,229,255,0.1)", color: "#00e5ff" }}>💎 Gem = Rare!</span>
              </div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} Bot target: <b>${botTarget}</b>{difficulty.level === "God Mode" ? " (mostly stones!)" : ""}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                MINE! ⛏️
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(10,10,31,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "😔"}</div>
              <div className="text-white font-black text-3xl">{won ? "Rich!" : "Not enough gold!"}</div>
              <div className="w-full rounded-2xl px-5 py-4 flex justify-between" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div><div className="text-zinc-400 text-xs">Your Total</div><div className="text-white font-black text-2xl">${score}</div></div>
                <div className="text-right"><div className="text-zinc-400 text-xs">Bot Target</div><div className="text-zinc-300 font-black text-2xl">${botTarget}</div></div>
              </div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setScore(0); setTimeLeft(GAME_TIME); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Mine Again</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
