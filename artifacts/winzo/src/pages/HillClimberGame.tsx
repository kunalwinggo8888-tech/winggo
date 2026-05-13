import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 500;
const WHEEL_R = 20;
const FINISH_X = 3500;

function generateTerrain(startX: number, count: number) {
  const pts: { x: number; y: number }[] = [];
  let x = startX, y = H - 100;
  for (let i = 0; i < count; i++) {
    pts.push({ x, y });
    x += 60 + Math.random() * 40;
    y = Math.max(H - 240, Math.min(H - 60, y + (Math.random() - 0.48) * 60));
  }
  return pts;
}

export default function HillClimberGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    carX: 80, carY: H - 130, carAngle: 0,
    carVX: 0, carVY: 0, onGround: false,
    fuel: 100, accel: false,
    terrain: generateTerrain(0, 80),
    cameraX: 0,
    frame: 0, running: false,
    frontWheelAngle: 0, rearWheelAngle: 0,
    coins: [] as { x: number; y: number; collected: boolean }[],
    distance: 0,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [fuel, setFuel] = useState(100);
  const [distance, setDistance] = useState(0);
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function getTerrainY(x: number, terrain: { x: number; y: number }[]) {
    for (let i = 0; i < terrain.length - 1; i++) {
      if (x >= terrain[i].x && x <= terrain[i + 1].x) {
        const t = (x - terrain[i].x) / (terrain[i + 1].x - terrain[i].x);
        return terrain[i].y * (1 - t) + terrain[i + 1].y * t;
      }
    }
    return H - 100;
  }

  function getTerrainAngle(x: number, terrain: typeof stateRef.current.terrain) {
    for (let i = 0; i < terrain.length - 1; i++) {
      if (x >= terrain[i].x && x <= terrain[i + 1].x) {
        return Math.atan2(terrain[i + 1].y - terrain[i].y, terrain[i + 1].x - terrain[i].x);
      }
    }
    return 0;
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    // Accelerate
    if (s.accel && s.fuel > 0) {
      const angle = getTerrainAngle(s.carX, s.terrain);
      s.carVX += Math.cos(angle) * 0.4;
      s.carVY += Math.sin(angle) * 0.4;
      s.fuel -= 0.12;
      if (s.fuel < 0) s.fuel = 0;
      if (s.frame % 5 === 0) setFuel(Math.round(s.fuel));
    }

    // Gravity
    s.carVY += 0.4;
    s.carVX *= 0.97;
    s.carX += s.carVX;
    s.carY += s.carVY;

    // Ground collision
    const groundY = getTerrainY(s.carX, s.terrain) - 30;
    if (s.carY >= groundY) {
      s.carY = groundY;
      s.carVY = Math.min(0, s.carVY) * -0.2;
      s.onGround = true;
      s.carAngle = getTerrainAngle(s.carX, s.terrain);
    } else {
      s.onGround = false;
    }

    // Wheel spin
    s.frontWheelAngle += s.carVX * 0.08;
    s.rearWheelAngle += s.carVX * 0.08;

    // Camera
    s.cameraX = s.carX - 100;
    s.distance = Math.max(s.distance, s.carX);
    if (s.frame % 8 === 0) setDistance(Math.round(s.distance));

    // Collect coins
    s.coins.forEach(c => {
      if (!c.collected && Math.abs(c.x - s.carX) < 30 && Math.abs(c.y - s.carY) < 30) {
        c.collected = true; s.fuel = Math.min(100, s.fuel + 10);
      }
    });

    // End conditions
    if (s.fuel <= 0 && s.carVX < 0.3) {
      s.running = false;
      const didWin = s.distance >= FINISH_X * 0.75;
      setWon(didWin);
      if (didWin) addWinning(prize, "Hill Climber Win");
      setPhase("result");
      return;
    }
    if (s.carX >= FINISH_X) {
      s.running = false;
      setWon(true);
      addWinning(prize, "Hill Climber Win");
      setPhase("result");
      return;
    }
    if (s.carX < 0) s.carX = 0;

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.translate(-s.cameraX, 0);

    // Sky
    const sky = ctx.createLinearGradient(s.cameraX, 0, s.cameraX, H);
    sky.addColorStop(0, "#0a1628"); sky.addColorStop(1, "#1e3a5f");
    ctx.fillStyle = sky; ctx.fillRect(s.cameraX, 0, W, H);

    // Moon/Stars
    ctx.fillStyle = "rgba(255,240,180,0.9)"; ctx.shadowColor = "#ffe066"; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(s.cameraX + 320, 50, 20, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Terrain
    const terrainInView = s.terrain.filter(p => p.x > s.cameraX - 60 && p.x < s.cameraX + W + 60);
    if (terrainInView.length > 1) {
      ctx.beginPath();
      ctx.moveTo(terrainInView[0].x, H);
      terrainInView.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(terrainInView[terrainInView.length - 1].x, H);
      ctx.closePath();
      const ground = ctx.createLinearGradient(0, H - 200, 0, H);
      ground.addColorStop(0, "#3d7a2a"); ground.addColorStop(0.3, "#2d5a1e"); ground.addColorStop(1, "#1a3a0f");
      ctx.fillStyle = ground; ctx.fill();
      ctx.strokeStyle = "#4a9a30"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(terrainInView[0].x, terrainInView[0].y);
      terrainInView.forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    }

    // Coins
    s.coins.forEach(c => {
      if (c.collected) return;
      ctx.fillStyle = "#FFD700"; ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 8;
      ctx.font = "18px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("⛽", c.x, c.y); ctx.shadowBlur = 0;
    });

    // Finish flag
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(FINISH_X, getTerrainY(FINISH_X, s.terrain) - 80, 8, 80);
    ctx.fillStyle = "#FFD700"; ctx.font = "22px sans-serif";
    ctx.fillText("🏁", FINISH_X - 4, getTerrainY(FINISH_X, s.terrain) - 80);

    // Car
    ctx.save();
    ctx.translate(s.carX, s.carY);
    ctx.rotate(s.carAngle);
    // Body
    ctx.fillStyle = "#ef4444"; ctx.strokeStyle = "#c0392b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-35, -22, 70, 28, 8); ctx.fill(); ctx.stroke();
    // Cab
    ctx.fillStyle = "#ff6b6b";
    ctx.beginPath(); ctx.roundRect(-18, -38, 38, 18, 5); ctx.fill();
    // Windows
    ctx.fillStyle = "rgba(150,220,255,0.7)";
    ctx.beginPath(); ctx.roundRect(-14, -36, 30, 12, 3); ctx.fill();

    // Wheels
    [{ dx: -22, dy: 6 }, { dx: 22, dy: 6 }].forEach((w, i) => {
      const wa = i === 0 ? s.rearWheelAngle : s.frontWheelAngle;
      ctx.save(); ctx.translate(w.dx, w.dy);
      ctx.fillStyle = "#1a1a1a"; ctx.beginPath(); ctx.arc(0, 0, WHEEL_R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#555"; ctx.lineWidth = 3; ctx.stroke();
      // Spokes
      ctx.strokeStyle = "#888"; ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const a = wa + (k * Math.PI / 2);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * (WHEEL_R - 4), Math.sin(a) * (WHEEL_R - 4)); ctx.stroke();
      }
      // Hubcap
      ctx.fillStyle = "#aaa"; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    ctx.restore();

    // HUD (fixed to screen)
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`${Math.round(s.distance)}m / ${FINISH_X}m`, 16, 28);

    // Fuel bar
    const fuelColor = s.fuel > 40 ? "#22c55e" : s.fuel > 20 ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(16, 36, 120, 14, 7); ctx.fill();
    ctx.fillStyle = fuelColor; ctx.beginPath(); ctx.roundRect(16, 36, 120 * (s.fuel / 100), 14, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "9px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`⛽ FUEL ${Math.round(s.fuel)}%`, 76, 46);

    // Progress
    const pct = Math.min(s.distance / FINISH_X, 1);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(16, 56, W - 32, 8, 4); ctx.fill();
    ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.roundRect(16, 56, (W - 32) * pct, 8, 4); ctx.fill();
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.carX = 80; s.carY = H - 130; s.carVX = 0; s.carVY = 0;
    s.fuel = 100; s.accel = false; s.distance = 0;
    s.terrain = generateTerrain(0, 80);
    // Scatter fuel pickups
    s.coins = Array.from({ length: 12 }, (_, i) => ({
      x: 300 + i * 280, y: H - 160, collected: false,
    }));
    s.cameraX = 0; s.frame = 0; s.running = true;
    setFuel(100); setDistance(0); setPhase("playing");
    loop();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); stateRef.current.accel = true; }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") stateRef.current.accel = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("keyup", onKeyUp); };
  }, []);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a1628", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">⛰️ Hill Climber</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,22,40,0.93)" }}>
              <div className="text-7xl">⛰️</div>
              <div className="text-white font-black text-3xl">Hill Climber</div>
              <div className="text-zinc-400 text-sm text-center px-8">Hold GAS to climb hills! Collect fuel pickups. Reach the finish flag!</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                CLIMB! ⛰️
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,22,40,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "⛽"}</div>
              <div className="text-white font-black text-2xl">{won ? "SUMMIT REACHED!" : "OUT OF FUEL!"}</div>
              <div className="text-center">
                <div className="text-zinc-400 text-xs">Distance</div>
                <div className="text-white font-black text-2xl">{distance}m / {FINISH_X}m</div>
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
          <motion.button
            onTouchStart={() => { stateRef.current.accel = true; }}
            onTouchEnd={() => { stateRef.current.accel = false; }}
            onMouseDown={() => { stateRef.current.accel = true; }}
            onMouseUp={() => { stateRef.current.accel = false; }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-5 rounded-2xl font-black text-black text-2xl select-none"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", userSelect: "none" }}>
            ⛽ HOLD GAS
          </motion.button>
        </div>
      )}
    </div>
  );
}
