import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 560;
const ROAD_Y = H - 80;
const PLAYER_X = 80;
const FINISH_DIST = 3000;

interface Car { x: number; lane: number; speed: number; emoji: string }

export default function BikeRacingGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    playerY: ROAD_Y - 30, targetY: ROAD_Y - 30,
    speed: 0, maxSpeed: 14, nitro: 100, nitroActive: false,
    distance: 0, botDistance: 0, frame: 0, running: false,
    cars: [] as Car[], spawnTimer: 0,
    bgOffset: 0, roadOffset: 0,
    crashed: false,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [distance, setDistance] = useState(0);
  const [nitro, setNitro] = useState(100);
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.playerY = ROAD_Y - 30; s.targetY = ROAD_Y - 30;
    s.speed = 0; s.nitro = 100; s.nitroActive = false;
    s.distance = 0; s.botDistance = 0; s.frame = 0; s.running = true;
    s.cars = []; s.spawnTimer = 0; s.bgOffset = 0; s.roadOffset = 0; s.crashed = false;
    setDistance(0); setNitro(100); setPhase("playing");
    loop();
  }

  function useNitro() {
    const s = stateRef.current;
    if (s.nitro > 10) s.nitroActive = true;
  }
  function releaseNitro() {
    stateRef.current.nitroActive = false;
  }

  function moveUp() {
    const s = stateRef.current;
    s.targetY = Math.max(ROAD_Y - 100, s.targetY - 45);
  }
  function moveDown() {
    const s = stateRef.current;
    s.targetY = Math.min(ROAD_Y - 10, s.targetY + 45);
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    // Speed
    const targetSpeed = s.nitroActive ? s.maxSpeed * 1.5 : s.maxSpeed;
    s.speed += (targetSpeed - s.speed) * 0.06;
    if (s.nitroActive) { s.nitro = Math.max(0, s.nitro - 0.8); if (s.nitro <= 0) s.nitroActive = false; }
    else { s.nitro = Math.min(100, s.nitro + 0.15); }
    setNitro(Math.round(s.nitro));

    // Player lane smoothing
    s.playerY += (s.targetY - s.playerY) * 0.15;

    // Scroll
    s.roadOffset = (s.roadOffset + s.speed) % 60;
    s.bgOffset = (s.bgOffset + s.speed * 0.4) % W;
    s.distance += s.speed * 0.5;
    s.botDistance += (s.maxSpeed * 0.48) * 0.5;
    if (s.frame % 4 === 0) setDistance(Math.round(s.distance));

    // Spawn traffic
    s.spawnTimer++;
    if (s.spawnTimer > Math.max(60 - s.frame / 60, 30)) {
      const lanes = [ROAD_Y - 90, ROAD_Y - 45, ROAD_Y - 10];
      s.cars.push({
        x: W + 40,
        lane: Math.floor(Math.random() * lanes.length),
        speed: Math.random() * 3 + 2,
        emoji: ["🚗", "🚕", "🚙", "🚌"][Math.floor(Math.random() * 4)],
      });
      s.spawnTimer = 0;
    }
    s.cars.forEach(c => { c.x -= (s.speed - c.speed); });
    s.cars = s.cars.filter(c => c.x > -60);

    // Collision
    const lanes = [ROAD_Y - 90, ROAD_Y - 45, ROAD_Y - 10];
    for (const c of s.cars) {
      const cy = lanes[c.lane];
      if (Math.abs(c.x - PLAYER_X) < 36 && Math.abs(cy - s.playerY) < 28) {
        s.running = false; s.crashed = true;
        setWon(false);
        setPhase("result");
        return;
      }
    }

    // Finish
    if (s.distance >= FINISH_DIST) {
      s.running = false;
      const didWin = s.distance >= s.botDistance;
      setWon(didWin);
      if (didWin) addWinning(prize, "Bike Racing Win");
      setPhase("result");
      return;
    }

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    sky.addColorStop(0, "#0a0520"); sky.addColorStop(1, "#1a0a3c");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.5);

    // Road
    ctx.fillStyle = "#1a1a1a"; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    // Road lines
    for (let x = -(s.roadOffset); x < W + 60; x += 60) {
      // Center dashes
      [-30, 30].forEach(dy => {
        ctx.fillStyle = "rgba(255,215,0,0.6)";
        ctx.fillRect(x, ROAD_Y - 45 + dy, 36, 4);
      });
    }
    // Road edge lines
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(0, H * 0.5 + 2, W, 3);
    ctx.fillRect(0, H - 18, W, 3);

    // Buildings (bg)
    for (let i = 0; i < 6; i++) {
      const bx = ((i * 70 - s.bgOffset * 0.5) % (W + 80)) - 40;
      const bh = 40 + (i % 3) * 30;
      ctx.fillStyle = `rgba(80,40,160,0.4)`;
      ctx.fillRect(bx, H * 0.5 - bh - 20, 50, bh + 20);
      // Windows
      ctx.fillStyle = "rgba(255,215,0,0.3)";
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        if (Math.random() > 0.3) ctx.fillRect(bx + 6 + c * 14, H * 0.5 - bh + 5 + r * 10, 8, 6);
      }
    }

    // Traffic cars
    const lanes = [ROAD_Y - 90, ROAD_Y - 45, ROAD_Y - 10];
    s.cars.forEach(c => {
      ctx.font = "32px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(c.emoji, c.x, lanes[c.lane] + 14);
    });

    // Nitro glow
    if (s.nitroActive) {
      const glow = ctx.createRadialGradient(PLAYER_X, s.playerY, 0, PLAYER_X, s.playerY, 50);
      glow.addColorStop(0, "rgba(100,200,255,0.5)"); glow.addColorStop(1, "rgba(100,200,255,0)");
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    }

    // Player bike
    ctx.font = "36px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🏍️", PLAYER_X, s.playerY + 12);
    // Speed trail
    if (s.speed > 8) {
      for (let i = 1; i <= 3; i++) {
        ctx.globalAlpha = 0.25 / i;
        ctx.font = "36px sans-serif";
        ctx.fillText("🏍️", PLAYER_X - i * 14, s.playerY + 12);
        ctx.globalAlpha = 1;
      }
    }

    // Progress bar
    const pct = Math.min(s.distance / FINISH_DIST, 1);
    const botPct = Math.min(s.botDistance / FINISH_DIST, 1);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(16, 12, W - 32, 14, 7); ctx.fill();
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.roundRect(16, 12, (W - 32) * pct, 14, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,0,0,0.5)";
    ctx.beginPath(); ctx.roundRect(16, 12, (W - 32) * botPct, 8, 4); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`YOU  ${Math.round(pct * 100)}%  |  BOT  ${Math.round(botPct * 100)}%  | FINISH`, W / 2, 22);

    // Nitro bar
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(W - 70, 34, 54, 10, 5); ctx.fill();
    ctx.fillStyle = s.nitro > 30 ? "#00e5ff" : "#ff4444";
    ctx.beginPath(); ctx.roundRect(W - 70, 34, 54 * (s.nitro / 100), 10, 5); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "8px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("NITRO", W - 43, 41);
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") moveUp();
      if (e.key === "ArrowDown") moveDown();
      if (e.key === " ") useNitro();
    };
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === " ") releaseNitro(); };
    window.addEventListener("keydown", handleKey);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKey); window.removeEventListener("keyup", handleKeyUp); };
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0520", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🏍️ Bike Racing</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.93)" }}>
              <div className="text-7xl">🏍️</div>
              <div className="text-white font-black text-3xl">Bike Racing</div>
              <div className="text-zinc-400 text-sm text-center px-8">Dodge traffic, use nitro boost, reach the finish first!</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                RACE! 🏍️
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💥"}</div>
              <div className="text-white font-black text-2xl">{won ? "FINISH LINE!" : stateRef.current.crashed ? "CRASHED!" : "BOT WINS!"}</div>
              <div className="text-center">
                <div className="text-zinc-400 text-xs">Distance Covered</div>
                <div className="text-white font-black text-2xl">{distance}m / {FINISH_DIST}m</div>
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
        <div className="grid grid-cols-3 gap-2 px-4 py-3">
          <motion.button whileTap={{ scale: 0.9 }} onClick={moveUp}
            className="py-4 rounded-xl font-black text-white text-2xl"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>↑</motion.button>
          <motion.button whileTap={{ scale: 0.9 }}
            onTouchStart={useNitro} onTouchEnd={releaseNitro}
            onMouseDown={useNitro} onMouseUp={releaseNitro}
            className="py-4 rounded-xl font-black text-black"
            style={{ background: `linear-gradient(135deg,${nitro > 30 ? "#00e5ff" : "#ff4444"},${nitro > 30 ? "#0077aa" : "#aa0000"})` }}>
            ⚡ {nitro}%
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={moveDown}
            className="py-4 rounded-xl font-black text-white text-2xl"
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>↓</motion.button>
        </div>
      )}
    </div>
  );
}
