import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 560;

interface Monster { x: number; y: number; r: number; alive: boolean; hp: number }
interface Block { x: number; y: number; w: number; h: number; alive: boolean }
interface Ball { x: number; y: number; vx: number; vy: number; active: boolean; trail: {x:number;y:number}[] }

export default function AngryMonstersGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(5);
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const gameRef = useRef({
    monsters: [] as Monster[],
    blocks: [] as Block[],
    ball: { x: 70, y: H - 80, vx: 0, vy: 0, active: false, trail: [] } as Ball,
    dragging: false, dragX: 0, dragY: 0,
    score: 0, shotsLeft: 5, frame: 0, running: false,
    slingX: 70, slingY: H - 80,
  });

  function buildLevel() {
    const g = gameRef.current;
    g.monsters = [
      { x: 280, y: H - 60, r: 22, alive: true, hp: 2 },
      { x: 330, y: H - 60, r: 22, alive: true, hp: 2 },
      { x: 305, y: H - 120, r: 22, alive: true, hp: 1 },
    ];
    g.blocks = [
      { x: 250, y: H - 50, w: 100, h: 20, alive: true },
      { x: 250, y: H - 90, w: 100, h: 20, alive: true },
      { x: 255, y: H - 120, w: 90, h: 20, alive: true },
    ];
    g.ball = { x: g.slingX, y: g.slingY, vx: 0, vy: 0, active: false, trail: [] };
    g.score = 0; g.shotsLeft = 5; g.frame = 0;
  }

  function launch(tx: number, ty: number) {
    const g = gameRef.current;
    if (g.ball.active || g.shotsLeft <= 0) return;
    const dx = tx - g.slingX, dy = ty - g.slingY;
    const power = Math.sqrt(dx * dx + dy * dy) * 0.18;
    const angle = Math.atan2(dy, dx);
    g.ball.vx = Math.cos(angle) * power;
    g.ball.vy = Math.sin(angle) * power;
    g.ball.active = true;
    g.ball.trail = [];
    g.shotsLeft--;
    setShots(g.shotsLeft);
  }

  function loop() {
    const g = gameRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !g.running) return;
    const ctx = canvas.getContext("2d")!;
    g.frame++;

    // Physics
    if (g.ball.active) {
      g.ball.trail.push({ x: g.ball.x, y: g.ball.y });
      if (g.ball.trail.length > 18) g.ball.trail.shift();
      g.ball.vy += 0.45;
      g.ball.x += g.ball.vx;
      g.ball.y += g.ball.vy;

      // Floor
      if (g.ball.y > H - 40) {
        g.ball.y = g.ball.vy > 0 ? H - 40 : g.ball.y;
        g.ball.vy *= -0.4; g.ball.vx *= 0.7;
        if (Math.abs(g.ball.vy) < 1) { g.ball.active = false; g.ball.x = g.slingX; g.ball.y = g.slingY; }
      }
      // Walls
      if (g.ball.x < 0 || g.ball.x > W) { g.ball.vx *= -0.6; }

      // Block collision
      g.blocks.forEach(b => {
        if (!b.alive) return;
        if (g.ball.x > b.x && g.ball.x < b.x + b.w && g.ball.y > b.y && g.ball.y < b.y + b.h) {
          b.alive = false; g.score += 100; setScore(g.score);
          g.ball.vy *= -0.5;
        }
      });

      // Monster collision
      g.monsters.forEach(m => {
        if (!m.alive) return;
        const dx = g.ball.x - m.x, dy = g.ball.y - m.y;
        if (dx * dx + dy * dy < (m.r + 10) ** 2) {
          m.hp--;
          if (m.hp <= 0) { m.alive = false; g.score += 300; setScore(g.score); }
          g.ball.vx *= -0.5; g.ball.vy *= -0.5;
        }
      });
    }

    // Check end
    const allDead = g.monsters.every(m => !m.alive);
    if (allDead || (g.shotsLeft <= 0 && !g.ball.active)) {
      g.running = false;
      const didWin = allDead;
      setWon(didWin);
      if (didWin) addWinning(prize, "Angry Monsters Win");
      setPhase("result");
      return;
    }

    draw(ctx, g);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, g: typeof gameRef.current) {
    ctx.clearRect(0, 0, W, H);
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#0a0520"); sky.addColorStop(1, "#1a0a40");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = "#2d1a00";
    ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = "#3d2a00";
    ctx.fillRect(0, H - 44, W, 4);

    // Sling
    ctx.strokeStyle = "#8B4513"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(g.slingX - 14, H - 40); ctx.lineTo(g.slingX, g.slingY - 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.slingX + 14, H - 40); ctx.lineTo(g.slingX, g.slingY - 20); ctx.stroke();

    if (!g.ball.active) {
      // Draw aiming lines from sling
      if (g.dragging) {
        const dx = g.dragX - g.slingX, dy = g.dragY - g.slingY;
        for (let i = 1; i <= 8; i++) {
          const t = i * 0.18;
          const px = g.slingX + dx * t + 0.5 * 0 * t * t;
          const py = g.slingY + dy * t + 0.5 * 18 * t * t;
          ctx.fillStyle = `rgba(255,215,0,${0.6 - i * 0.06})`;
          ctx.beginPath(); ctx.arc(px, py, 5 - i * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        // ball at drag
        ctx.fillStyle = "#FF4500"; ctx.shadowColor = "#FF4500"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(g.dragX, g.dragY, 14, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("😡", g.dragX, g.dragY + 6);
      } else {
        ctx.fillStyle = "#FF4500"; ctx.shadowColor = "#FF4500"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(g.slingX, g.slingY, 14, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("😡", g.slingX, g.slingY + 6);
      }
    } else {
      // Trail
      g.ball.trail.forEach((p, i) => {
        const a = (i / g.ball.trail.length) * 0.5;
        ctx.fillStyle = `rgba(255,100,0,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8 * (i / g.ball.trail.length), 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "#FF4500"; ctx.shadowColor = "#FF4500"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(g.ball.x, g.ball.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff"; ctx.font = "16px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("😡", g.ball.x, g.ball.y + 6);
    }

    // Blocks
    g.blocks.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = "#8B7355"; ctx.strokeStyle = "#a0856b"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.beginPath(); ctx.roundRect(b.x + 2, b.y + 2, b.w - 4, 6, 2); ctx.fill();
    });

    // Monsters
    g.monsters.forEach(m => {
      if (!m.alive) return;
      ctx.fillStyle = m.hp > 1 ? "#22c55e" : "#86efac";
      ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fff"; ctx.font = `${m.r * 1.2}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText("👹", m.x, m.y + m.r * 0.4);
    });

    // HUD
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Score: ${g.score}`, 14, 28);
    ctx.fillText(`Shots: ${"⭕".repeat(g.shotsLeft)}`, 14, 48);
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const g = gameRef.current;
    buildLevel();
    g.running = true;
    setScore(0); setShots(5); setPhase("playing");
    loop();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = () => canvas.getBoundingClientRect();
    const scaleX = () => W / rect().width;
    const scaleY = () => H / rect().height;

    const onStart = (cx: number, cy: number) => {
      const g = gameRef.current;
      if (!g.ball.active) { g.dragging = true; g.dragX = cx; g.dragY = cy; }
    };
    const onMove = (cx: number, cy: number) => {
      if (gameRef.current.dragging) { gameRef.current.dragX = cx; gameRef.current.dragY = cy; }
    };
    const onEnd = (cx: number, cy: number) => {
      const g = gameRef.current;
      if (g.dragging) { g.dragging = false; launch(cx, cy); }
    };
    const ts = (e: TouchEvent) => { e.preventDefault(); const t = e.touches[0]; const r = rect(); onStart((t.clientX - r.left) * scaleX(), (t.clientY - r.top) * scaleY()); };
    const tm = (e: TouchEvent) => { const t = e.touches[0]; const r = rect(); onMove((t.clientX - r.left) * scaleX(), (t.clientY - r.top) * scaleY()); };
    const te = (e: TouchEvent) => { e.preventDefault(); const t = e.changedTouches[0]; const r = rect(); onEnd((t.clientX - r.left) * scaleX(), (t.clientY - r.top) * scaleY()); };
    const ms = (e: MouseEvent) => { const r = rect(); onStart((e.clientX - r.left) * scaleX(), (e.clientY - r.top) * scaleY()); };
    const mm = (e: MouseEvent) => { const r = rect(); onMove((e.clientX - r.left) * scaleX(), (e.clientY - r.top) * scaleY()); };
    const me = (e: MouseEvent) => { const r = rect(); onEnd((e.clientX - r.left) * scaleX(), (e.clientY - r.top) * scaleY()); };
    canvas.addEventListener("touchstart", ts, { passive: false });
    canvas.addEventListener("touchmove", tm, { passive: true });
    canvas.addEventListener("touchend", te, { passive: false });
    canvas.addEventListener("mousedown", ms);
    canvas.addEventListener("mousemove", mm);
    canvas.addEventListener("mouseup", me);
    return () => {
      canvas.removeEventListener("touchstart", ts);
      canvas.removeEventListener("touchmove", tm);
      canvas.removeEventListener("touchend", te);
      canvas.removeEventListener("mousedown", ms);
      canvas.removeEventListener("mousemove", mm);
      canvas.removeEventListener("mouseup", me);
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0520", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">👹 Angry Monsters</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee} Entry</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.93)" }}>
              <div className="text-7xl">👹</div>
              <div className="text-white font-black text-3xl">Angry Monsters</div>
              <div className="text-zinc-400 text-sm text-center px-8">Drag & release the slingshot to destroy all monsters!</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                LAUNCH! 😡
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💀"}</div>
              <div className="text-white font-black text-2xl">{won ? "MONSTERS DESTROYED!" : "THEY SURVIVED!"}</div>
              <div className="text-center"><div className="text-zinc-400 text-sm">Score</div><div className="text-white font-black text-3xl">{score}</div></div>
              {won && <div className="text-green-400 font-black text-lg">+₹{prize} Added!</div>}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                  className="px-7 py-3 rounded-xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Retry</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="px-7 py-3 rounded-xl font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
