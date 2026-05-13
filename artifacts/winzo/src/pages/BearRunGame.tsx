import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 500;
const GROUND = H - 60;
const BEAR_X = 80;

interface Obstacle { x: number; type: "log" | "rock" | "bee"; h: number }
interface Honey { x: number; y: number; collected: boolean }

export default function BearRunGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    bearY: GROUND - 48, bearVY: 0, jumping: false, ducking: false,
    obstacles: [] as Obstacle[], honey: [] as Honey[],
    speed: 5, score: 0, frame: 0, running: false,
    spawnTimer: 0, trees: [{ x: 300, h: 60 }, { x: 500, h: 80 }, { x: 700, h: 50 }],
    bgX: 0,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [botScore] = useState(() => Math.floor(Math.random() * 800 + 700));
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function jump() {
    const s = stateRef.current;
    if (s.jumping || !s.running) return;
    s.bearVY = -13; s.jumping = true;
  }

  function startGame() {
    const s = stateRef.current;
    s.bearY = GROUND - 48; s.bearVY = 0; s.jumping = false;
    s.obstacles = []; s.honey = []; s.speed = 5; s.score = 0; s.frame = 0;
    s.spawnTimer = 0; s.running = true; s.bgX = 0;
    s.trees = [{ x: 300, h: 60 }, { x: 500, h: 80 }, { x: 700, h: 50 }];
    setScore(0); setPhase("playing");
    loop();
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++; s.score++;
    s.speed = Math.min(12, 5 + s.frame / 300);
    if (s.frame % 3 === 0) setScore(s.score);

    // Bear physics
    if (s.jumping) {
      s.bearVY += 0.7;
      s.bearY += s.bearVY;
      if (s.bearY >= GROUND - 48) { s.bearY = GROUND - 48; s.bearVY = 0; s.jumping = false; }
    }

    // Trees scroll
    s.trees.forEach(t => { t.x -= s.speed * 0.4; if (t.x < -40) t.x = W + Math.random() * 200 + 100; });
    s.bgX = (s.bgX - s.speed * 0.2) % W;

    // Spawn
    s.spawnTimer++;
    if (s.spawnTimer > Math.max(50 - s.frame / 80, 28)) {
      const types: Array<"log" | "rock" | "bee"> = ["log", "rock", "bee"];
      const type = types[Math.floor(Math.random() * 3)];
      s.obstacles.push({ x: W + 20, type, h: type === "bee" ? 120 : 40 });
      s.spawnTimer = 0;
    }
    if (s.frame % 60 === 0) {
      s.honey.push({ x: W + 20, y: GROUND - 80 - Math.random() * 40, collected: false });
    }

    // Move obstacles + honey
    s.obstacles.forEach(o => { o.x -= s.speed; });
    s.honey.forEach(h => { h.x -= s.speed; });
    s.obstacles = s.obstacles.filter(o => o.x > -60);
    s.honey = s.honey.filter(h => h.x > -20);

    // Collect honey
    s.honey.forEach(h => {
      if (!h.collected && Math.abs(h.x - BEAR_X) < 28 && Math.abs(h.y - s.bearY) < 30) {
        h.collected = true; s.score += 100;
      }
    });

    // Collision
    for (const o of s.obstacles) {
      const hitX = Math.abs(o.x - BEAR_X) < 26;
      const hitY = o.type === "bee"
        ? s.bearY < o.h + 30 && s.bearY > o.h - 30
        : s.bearY >= GROUND - 48 - 5 && s.bearY <= GROUND - 48 + 5;
      if (hitX && hitY) {
        s.running = false;
        const didWin = s.score > botScore;
        setWon(didWin);
        if (didWin) addWinning(prize, "Bear Run Win");
        setPhase("result");
        return;
      }
    }

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#1a3a1a"); sky.addColorStop(1, "#0a1a0a");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

    // Moon
    ctx.fillStyle = "rgba(255,240,180,0.8)"; ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 18;
    ctx.beginPath(); ctx.arc(340, 50, 26, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Trees (bg)
    s.trees.forEach(t => {
      ctx.fillStyle = "#2d5a2d";
      ctx.beginPath();
      ctx.moveTo(t.x, GROUND - t.h);
      ctx.lineTo(t.x - 20, GROUND - 10);
      ctx.lineTo(t.x + 20, GROUND - 10);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#4a2a10";
      ctx.fillRect(t.x - 4, GROUND - 14, 8, 14);
    });

    // Ground
    ctx.fillStyle = "#3d5a1a"; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#4a6f22"; ctx.fillRect(0, GROUND, W, 6);

    // Ground dots
    for (let x = (s.bgX % 60); x < W; x += 60) {
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.arc(x, GROUND + 2, 3, 0, Math.PI * 2); ctx.fill();
    }

    // Honey
    s.honey.forEach(h => {
      if (h.collected) return;
      ctx.fillStyle = "#FFD700"; ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 8;
      ctx.font = "22px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🍯", h.x, h.y);
      ctx.shadowBlur = 0;
    });

    // Obstacles
    s.obstacles.forEach(o => {
      ctx.font = "30px sans-serif"; ctx.textAlign = "center";
      if (o.type === "log") ctx.fillText("🪵", o.x, GROUND - 8);
      else if (o.type === "rock") ctx.fillText("🪨", o.x, GROUND - 10);
      else ctx.fillText("🐝", o.x, o.h);
    });

    // Bear
    const bob = s.jumping ? 0 : Math.sin(s.frame * 0.3) * 2;
    ctx.font = "44px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🐻", BEAR_X, s.bearY + bob);

    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(BEAR_X, GROUND + 3, 20, 5, 0, 0, Math.PI * 2); ctx.fill();

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(8, 8, 145, 44, 8); ctx.fill();
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Score: ${s.score}`, 18, 26);
    ctx.fillStyle = "#a78bfa"; ctx.font = "11px sans-serif";
    ctx.fillText(`Bot: ${botScore}`, 18, 44);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onTap = () => { if (phase === "playing") jump(); };
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === "ArrowUp") jump(); };
    canvas.addEventListener("touchend", onTap, { passive: true });
    canvas.addEventListener("click", onTap);
    window.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("touchend", onTap);
      canvas.removeEventListener("click", onTap);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a1a0a", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🐻 Bear Run</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee} Entry</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,26,10,0.92)" }}>
              <div className="text-7xl">🐻</div>
              <div className="text-white font-black text-3xl">Bear Run</div>
              <div className="text-zinc-400 text-sm text-center px-8">Tap to jump! Dodge logs, rocks & bees. Collect honey for bonus points!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
                Beat Bot Score: <b>{botScore}</b>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                RUN! 🐻
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,26,10,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💀"}</div>
              <div className="text-white font-black text-2xl">{won ? "BEAR WINS!" : "BEAR DOWN!"}</div>
              <div className="flex gap-8 text-center">
                <div><div className="text-zinc-400 text-xs">Your Score</div><div className="text-white font-black text-xl">{score}</div></div>
                <div><div className="text-zinc-400 text-xs">Bot Score</div><div className="text-zinc-300 font-black text-xl">{botScore}</div></div>
              </div>
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
      {phase === "playing" && (
        <div className="px-6 py-3">
          <motion.button whileTap={{ scale: 0.93 }} onClick={jump}
            className="w-full py-4 rounded-2xl font-black text-black text-xl"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
            ↑ JUMP
          </motion.button>
        </div>
      )}
    </div>
  );
}
