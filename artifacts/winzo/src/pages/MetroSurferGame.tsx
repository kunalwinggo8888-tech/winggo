import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 600;
const LANE_X = [W / 4, W / 2, (W * 3) / 4];
const LANE_W = W / 4;

interface Obstacle { x: number; y: number; lane: number; type: "barrier" | "train"; h: number }
interface Coin { x: number; y: number; lane: number; collected: boolean }

export default function MetroSurferGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    lane: 1, targetLane: 1, laneX: LANE_X[1], playerY: H - 130,
    obstacles: [] as Obstacle[], coins: [] as Coin[],
    speed: 4, score: 0, running: false, dead: false,
    frame: 0, spawnTimer: 0, bobAngle: 0,
    swipeStartX: 0, swipeStartY: 0,
  });
  const rafRef = useRef(0);
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [botScore] = useState(() => getBotScore(1200, difficulty));
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function spawnObstacle() {
    const s = stateRef.current;
    const lane = Math.floor(Math.random() * 3);
    const type = Math.random() < 0.4 ? "train" : "barrier";
    s.obstacles.push({ x: LANE_X[lane], y: -60, lane, type, h: type === "train" ? 90 : 50 });
  }
  function spawnCoin() {
    const s = stateRef.current;
    const lane = Math.floor(Math.random() * 3);
    s.coins.push({ x: LANE_X[lane], y: -20, lane, collected: false });
  }

  function startGame() {
    const s = stateRef.current;
    s.lane = 1; s.targetLane = 1; s.laneX = LANE_X[1];
    s.obstacles = []; s.coins = []; s.speed = 4;
    s.score = 0; s.running = true; s.dead = false;
    s.frame = 0; s.spawnTimer = 0; s.bobAngle = 0;
    setPhase("playing"); setScore(0);
    loop();
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!s.running) return;

    s.frame++;
    s.bobAngle += 0.22;
    s.speed = Math.min(12, 4 + s.frame / 400);
    s.score += 1;
    if (s.frame % 2 === 0) setScore(s.score);

    // Smooth lane transition
    const targetX = LANE_X[s.targetLane];
    s.laneX += (targetX - s.laneX) * 0.2;

    // Spawn
    s.spawnTimer++;
    if (s.spawnTimer > Math.max(38 - s.frame / 100, 22)) {
      spawnObstacle();
      s.spawnTimer = 0;
    }
    if (s.frame % 40 === 0) spawnCoin();

    // Move obstacles + coins
    s.obstacles.forEach(o => { o.y += s.speed; });
    s.coins.forEach(c => { c.y += s.speed; });
    s.obstacles = s.obstacles.filter(o => o.y < H + 80);
    s.coins = s.coins.filter(c => c.y < H + 20);

    // Collect coins
    s.coins.forEach(c => {
      if (!c.collected && Math.abs(c.x - s.laneX) < 30 && Math.abs(c.y - s.playerY) < 30) {
        c.collected = true; s.score += 50;
      }
    });

    // Collision
    for (const o of s.obstacles) {
      if (Math.abs(o.x - s.laneX) < LANE_W * 0.36 && Math.abs(o.y - s.playerY) < o.h * 0.5 + 24) {
        s.running = false; s.dead = true;
        const finalScore = s.score;
        const didWin = finalScore > botScore;
        setWon(didWin);
        if (didWin) addWinning(prize, "Metro Surfer Win");
        setPhase("result");
        return;
      }
    }

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);

    // Road bg
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#050510"); grad.addColorStop(1, "#0a0a20");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Neon lane lines
    for (let i = 0; i <= 3; i++) {
      const lx = i * (W / 3);
      ctx.strokeStyle = "rgba(100,80,255,0.3)";
      ctx.lineWidth = 1;
      ctx.setLineDash([20, 14]);
      ctx.lineDashOffset = -(s.frame * s.speed * 0.5) % 34;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Ground glow
    const ground = ctx.createLinearGradient(0, H - 40, 0, H);
    ground.addColorStop(0, "rgba(80,40,255,0.3)"); ground.addColorStop(1, "rgba(80,40,255,0)");
    ctx.fillStyle = ground; ctx.fillRect(0, H - 40, W, 40);

    // Obstacles
    s.obstacles.forEach(o => {
      if (o.type === "train") {
        ctx.fillStyle = "#e74c3c";
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(o.x - LANE_W * 0.38, o.y - o.h / 2, LANE_W * 0.76, o.h, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🚃", o.x, o.y + 7);
      } else {
        ctx.fillStyle = "#e67e22"; ctx.strokeStyle = "#ffa500"; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(o.x - LANE_W * 0.32, o.y - o.h / 2, LANE_W * 0.64, o.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("🚧", o.x, o.y + 6);
      }
    });

    // Coins
    s.coins.forEach(c => {
      if (c.collected) return;
      ctx.fillStyle = "#FFD700";
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(c.x, c.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#000"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("₹", c.x, c.y + 4);
    });

    // Player (bear running)
    const bob = Math.sin(s.bobAngle) * 3;
    ctx.font = "44px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🏃", s.laneX, s.playerY + bob);

    // Speed glow under player
    const pg = ctx.createRadialGradient(s.laneX, s.playerY + 20, 2, s.laneX, s.playerY + 20, 36);
    pg.addColorStop(0, "rgba(100,80,255,0.5)"); pg.addColorStop(1, "rgba(100,80,255,0)");
    ctx.fillStyle = pg; ctx.beginPath(); ctx.ellipse(s.laneX, s.playerY + 24, 36, 12, 0, 0, Math.PI * 2); ctx.fill();

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.beginPath(); ctx.roundRect(10, 10, 130, 44, 10); ctx.fill();
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Score: ${s.score}`, 20, 28);
    ctx.fillStyle = "#a78bfa"; ctx.font = "11px sans-serif";
    ctx.fillText(`Bot: ${botScore}`, 20, 46);

    // Speed bar
    const spd = (s.speed - 4) / 8;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(W - 100, 10, 88, 12, 6); ctx.fill();
    ctx.fillStyle = `hsl(${120 - spd * 120},100%,50%)`;
    ctx.beginPath(); ctx.roundRect(W - 100, 10, 88 * spd, 12, 6); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("SPEED", W - 56, 19);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleTouchStart = (e: TouchEvent) => {
      stateRef.current.swipeStartX = e.touches[0].clientX;
      stateRef.current.swipeStartY = e.touches[0].clientY;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - stateRef.current.swipeStartX;
      const s = stateRef.current;
      if (Math.abs(dx) > 30) {
        if (dx > 0 && s.targetLane < 2) s.targetLane++;
        else if (dx < 0 && s.targetLane > 0) s.targetLane--;
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowLeft" && s.targetLane > 0) s.targetLane--;
      if (e.key === "ArrowRight" && s.targetLane < 2) s.targetLane++;
    };
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("keydown", handleKey);
    return () => {
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKey);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: "#050510", maxWidth: 480, margin: "0 auto" }}>
      <div className="w-full flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🚇 Metro Surfer</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(5,5,16,0.92)" }}>
              <div className="text-7xl">🚇</div>
              <div className="text-white font-black text-3xl">Metro Surfer</div>
              <div className="text-zinc-400 text-sm text-center px-8">Swipe left/right to change lanes. Dodge obstacles, collect coins!</div>
              <div className="px-5 py-2 rounded-xl text-sm font-bold" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} vs <span className="text-white">{difficulty.botName}</span> · Beat {botScore} pts
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                START RUNNING →
              </motion.button>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(5,5,16,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💀"}</div>
              <div className="text-white font-black text-2xl">{won ? "YOU WIN!" : "GAME OVER"}</div>
              <div className="flex gap-6 text-center">
                <div><div className="text-zinc-400 text-xs">Your Score</div><div className="text-white font-black text-xl">{score}</div></div>
                <div><div className="text-zinc-400 text-xs">Bot Score</div><div className="text-zinc-300 font-black text-xl">{botScore}</div></div>
              </div>
              {won && <div className="text-green-400 font-black text-lg">+₹{prize} Added!</div>}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                  className="px-7 py-3 rounded-xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Play Again</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="px-7 py-3 rounded-xl font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "playing" && (
        <div className="flex w-full justify-around px-6 pt-3 pb-4">
          {[["←", -1], ["→", 1]].map(([label, dir]) => (
            <motion.button key={label as string} whileTap={{ scale: 0.9 }}
              onTouchStart={() => {
                const s = stateRef.current;
                const next = s.targetLane + (dir as number);
                if (next >= 0 && next <= 2) s.targetLane = next;
              }}
              className="w-20 h-14 rounded-2xl font-black text-2xl text-white"
              style={{ background: "rgba(100,80,255,0.25)", border: "1px solid rgba(100,80,255,0.4)" }}>
              {label}
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
