/**
 * FlyMeGame — WINGGO Premium Flappy Bird
 * Canvas-based side-scroller with parallax bg, animated bird,
 * and increasing pipe speed. Beat the bot score to win.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 560;
const BIRD_X   = 80;
const GRAVITY  = 0.42;
const JUMP_VY  = -8.5;
const PIPE_W   = 52;
const GAP      = 150;
const BASE_SPD = 2.8;

interface Pipe { x: number; topH: number; scored: boolean }
interface Cloud { x: number; y: number; w: number; speed: number }

function makeClouds(): Cloud[] {
  return Array.from({ length: 6 }, (_, i) => ({
    x: 60 + i * 70, y: 30 + Math.random() * 80,
    w: 50 + Math.random() * 60,
    speed: 0.3 + Math.random() * 0.4,
  }));
}

function drawBird(ctx: CanvasRenderingContext2D, y: number, angle: number, flap: number) {
  ctx.save();
  ctx.translate(BIRD_X, y);
  ctx.rotate(angle);

  // Body
  ctx.fillStyle = "#facc15";
  ctx.shadowColor = "#facc1599";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Wing
  const wingAng = Math.sin(flap * 0.5) * 0.6;
  ctx.fillStyle = "#fbbf24";
  ctx.save();
  ctx.translate(-4, -2);
  ctx.rotate(-wingAng);
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eye
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(10, -4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(11.5, -4, 2.5, 0, Math.PI * 2); ctx.fill();

  // Beak
  ctx.fillStyle = "#f97316";
  ctx.beginPath();
  ctx.moveTo(16, -2);
  ctx.lineTo(24, 0);
  ctx.lineTo(16, 3);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPipe(ctx: CanvasRenderingContext2D, pipe: Pipe) {
  const { x, topH } = pipe;
  const botY = topH + GAP;
  const botH = H - botY;

  // Gradient for pipes
  const grad1 = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  grad1.addColorStop(0, "#065f46");
  grad1.addColorStop(0.5, "#10b981");
  grad1.addColorStop(1, "#065f46");

  // Top pipe
  ctx.fillStyle = grad1;
  ctx.fillRect(x, 0, PIPE_W, topH);
  ctx.fillStyle = "#10b981";
  ctx.shadowColor = "#10b981";
  ctx.shadowBlur = 8;
  ctx.fillRect(x - 5, topH - 22, PIPE_W + 10, 22);
  ctx.shadowBlur = 0;

  // Bottom pipe
  const grad2 = ctx.createLinearGradient(x, 0, x + PIPE_W, 0);
  grad2.addColorStop(0, "#065f46");
  grad2.addColorStop(0.5, "#10b981");
  grad2.addColorStop(1, "#065f46");
  ctx.fillStyle = grad2;
  ctx.fillRect(x, botY, PIPE_W, botH);
  ctx.fillStyle = "#10b981";
  ctx.shadowColor = "#10b981";
  ctx.shadowBlur = 8;
  ctx.fillRect(x - 5, botY, PIPE_W + 10, 22);
  ctx.shadowBlur = 0;
}

export default function FlyMeGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const [botScore] = useState(() => getBotScore(30, difficulty));
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef(0);

  const stateRef = useRef({
    birdY: H / 2, birdVY: 0,
    pipes: [] as Pipe[],
    clouds: makeClouds(),
    score: 0, frame: 0,
    speed: BASE_SPD,
    running: false, dead: false,
    flapAngle: 0,
    bgX: 0, groundX: 0,
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [won, setWon]     = useState(false);

  function jump() {
    const s = stateRef.current;
    if (!s.running || s.dead) return;
    s.birdVY = JUMP_VY;
  }

  function startGame() {
    const s = stateRef.current;
    s.birdY = H / 2; s.birdVY = 0;
    s.pipes = []; s.clouds = makeClouds();
    s.score = 0; s.frame = 0;
    s.speed = BASE_SPD; s.running = true; s.dead = false;
    s.bgX = 0; s.groundX = 0;
    setScore(0); setWon(false);
    setPhase("playing");
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;

    function handleKey(e: KeyboardEvent) { if (e.code === "Space") { e.preventDefault(); jump(); } }
    function handlePointer() { jump(); }
    document.addEventListener("keydown", handleKey);
    canvas.addEventListener("pointerdown", handlePointer);

    function loop() {
      if (!s.running) return;
      s.frame++;

      // Speed up every 10 pipes
      s.speed = BASE_SPD + Math.floor(s.score / 10) * 0.35;

      // Bird physics
      s.birdVY += GRAVITY;
      s.birdY  += s.birdVY;
      s.flapAngle = s.frame;
      const birdAngle = Math.max(-0.5, Math.min(1.2, s.birdVY * 0.06));

      // Spawn pipes
      if (s.frame % Math.round(120 / (s.speed / BASE_SPD)) === 0) {
        const topH = 60 + Math.random() * (H - GAP - 120);
        s.pipes.push({ x: W + 10, topH, scored: false });
      }

      // Move pipes
      for (const p of s.pipes) {
        p.x -= s.speed;
        if (!p.scored && p.x + PIPE_W < BIRD_X) {
          p.scored = true;
          s.score++;
          setScore(s.score);
        }
      }
      s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 10);

      // Move clouds
      for (const c of s.clouds) {
        c.x -= c.speed;
        if (c.x < -c.w - 20) { c.x = W + 20; c.y = 20 + Math.random() * 100; }
      }
      s.groundX = (s.groundX + s.speed) % W;

      // Collision
      const bx = BIRD_X, by = s.birdY;
      const died = by < 0 || by > H - 30 || s.pipes.some((p) => {
        const inX = bx + 14 > p.x + 4 && bx - 14 < p.x + PIPE_W - 4;
        const inTopY = by - 12 < p.topH;
        const inBotY = by + 12 > p.topH + GAP;
        return inX && (inTopY || inBotY);
      });

      if (died) {
        s.running = false;
        s.dead = true;
        const didWin = s.score > botScore;
        setWon(didWin);
        if (didWin) addWinning(prize, "Fly Me Win");
        setPhase("result");
        return;
      }

      // ─── DRAW ─────────────────────────────────────────────────────
      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a0520");
      sky.addColorStop(0.7, "#1a0a3a");
      sky.addColorStop(1, "#0d1b2a");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars (parallax slow)
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 60; i++) {
        const sx = (((i * 97 + s.bgX * 0.2) | 0) % W + W) % W;
        const sy = ((i * 137) % (H - 80));
        ctx.fillRect(sx, sy, 1.2, 1.2);
      }

      // Clouds
      for (const c of s.clouds) {
        ctx.fillStyle = "rgba(255,255,255,0.07)";
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, c.w / 2, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(c.x + 18, c.y - 8, c.w / 3, 11, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pipes
      for (const p of s.pipes) drawPipe(ctx, p);

      // Ground
      ctx.fillStyle = "#1b4332";
      ctx.fillRect(0, H - 30, W, 30);
      ctx.fillStyle = "#2d6a4f";
      ctx.fillRect(0, H - 30, W, 6);
      // Ground stripes
      ctx.fillStyle = "#2d6a4f";
      for (let i = 0; i < 8; i++) {
        const gx = ((i * 50 - s.groundX % 50 + 50) % (W + 50)) - 50;
        ctx.fillRect(gx, H - 24, 30, 6);
      }

      // Bird
      drawBird(ctx, s.birdY, birdAngle, s.flapAngle);

      // Score HUD
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - 50, 12, 100, 36, 12);
      ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700";
      ctx.shadowBlur = 8;
      ctx.font = "bold 20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2, 36);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "10px sans-serif";
      ctx.fillText(`Bot: ${botScore}`, W / 2, 52);

      s.bgX += s.speed;
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("keydown", handleKey);
      canvas.removeEventListener("pointerdown", handlePointer);
    };
  }, [phase, addWinning, botScore, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0520", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🐦 Fly Me</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef} width={W} height={H}
          className="w-full" style={{ display: "block", touchAction: "none" }}
        />

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.93)" }}>
              <motion.div className="text-7xl" animate={{ y: [-4, 4, -4] }} transition={{ duration: 1.2, repeat: Infinity }}>🐦</motion.div>
              <div className="text-white font-black text-3xl">Fly Me</div>
              <div className="text-zinc-400 text-sm text-center px-8">Tap / Space to flap! Dodge the pipes. Score more than the bot to win!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} vs <b className="text-white">{difficulty.botName}</b> · Beat {botScore} pipes
              </div>
              <div className="px-4 py-2 rounded-xl text-xs text-zinc-400" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                Tap screen · Space key · Speed increases every 10 pipes
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                FLY! 🐦
              </motion.button>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8"
              style={{ background: "rgba(10,5,32,0.95)" }}>
              <motion.div className="text-6xl" animate={{ rotate: won ? [0, -10, 10, 0] : [0, 5, -5, 0] }} transition={{ duration: 0.5 }}>
                {won ? "🏆" : "💥"}
              </motion.div>
              <div className="text-white font-black text-3xl">{won ? "YOU WIN!" : "Crashed!"}</div>
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
                  Fly Again
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
