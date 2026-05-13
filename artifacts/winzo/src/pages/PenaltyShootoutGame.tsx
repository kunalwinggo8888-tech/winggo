import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 520;
const GOAL_X = W / 2, GOAL_Y = 130, GOAL_W = 200, GOAL_H = 110;
const BALL_X = W / 2, BALL_Y = H - 90;
const TOTAL_SHOTS = 5;

type ZoneKey = "tl" | "tc" | "tr" | "bl" | "bc" | "br";

export default function PenaltyShootoutGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const stateRef = useRef({
    ballX: BALL_X, ballY: BALL_Y, flying: false,
    targetX: GOAL_X, targetY: GOAL_Y + GOAL_H / 2,
    keeperX: GOAL_X, keeperDir: 1, keeperSpeed: 3,
    shotsLeft: TOTAL_SHOTS, scored: 0, botScored: 0,
    frame: 0, running: false,
    result: "" as "" | "goal" | "saved",
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [scored, setScored] = useState(0);
  const [shotsLeft, setShotsLeft] = useState(TOTAL_SHOTS);
  const [msg, setMsg] = useState("");
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const ZONES: { key: ZoneKey; label: string; x: number; y: number }[] = [
    { key: "tl", label: "↖", x: GOAL_X - 65, y: GOAL_Y + 28 },
    { key: "tc", label: "↑", x: GOAL_X,       y: GOAL_Y + 28 },
    { key: "tr", label: "↗", x: GOAL_X + 65,  y: GOAL_Y + 28 },
    { key: "bl", label: "↙", x: GOAL_X - 65,  y: GOAL_Y + 86 },
    { key: "bc", label: "↓", x: GOAL_X,        y: GOAL_Y + 86 },
    { key: "br", label: "↘", x: GOAL_X + 65,  y: GOAL_Y + 86 },
  ];

  function shoot(zone: ZoneKey) {
    const s = stateRef.current;
    if (s.flying || !s.running) return;
    const z = ZONES.find(z => z.key === zone)!;
    s.targetX = z.x; s.targetY = z.y; s.flying = true;
    s.ballX = BALL_X; s.ballY = BALL_Y;
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    // Keeper swing
    s.keeperX += s.keeperDir * s.keeperSpeed;
    if (s.keeperX < GOAL_X - GOAL_W / 2 + 20) s.keeperDir = 1;
    if (s.keeperX > GOAL_X + GOAL_W / 2 - 20) s.keeperDir = -1;

    // Ball flight
    if (s.flying) {
      const spd = 0.055;
      s.ballX += (s.targetX - s.ballX) * spd * 4;
      s.ballY += (s.targetY - s.ballY) * spd * 4;

      if (Math.abs(s.ballX - s.targetX) < 6 && Math.abs(s.ballY - s.targetY) < 6) {
        // Check if keeper blocks
        const blocked = Math.abs(s.targetX - s.keeperX) < 40 && s.targetY < GOAL_Y + GOAL_H - 10;
        const inGoal = s.targetX > GOAL_X - GOAL_W / 2 && s.targetX < GOAL_X + GOAL_W / 2
          && s.targetY > GOAL_Y && s.targetY < GOAL_Y + GOAL_H;

        if (inGoal && !blocked) {
          s.scored++; s.result = "goal"; setScored(s.scored); setMsg("⚽ GOAL!!!");
        } else {
          s.result = "saved"; setMsg(blocked ? "🧤 SAVED!" : "❌ WIDE!");
        }
        const botGot = Math.random() < 0.55 ? 1 : 0;
        s.botScored += botGot;
        s.shotsLeft--;
        s.flying = false;
        setShotsLeft(s.shotsLeft);

        setTimeout(() => {
          setMsg("");
          s.ballX = BALL_X; s.ballY = BALL_Y;
          if (s.shotsLeft <= 0) {
            s.running = false;
            const didWin = s.scored > s.botScored;
            setWon(didWin);
            if (didWin) addWinning(prize, "Penalty Shootout Win");
            setPhase("result");
          }
        }, 900);
      }
    }

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    // Stadium bg
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d1f0d"); bg.addColorStop(1, "#1a3a1a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Pitch
    ctx.fillStyle = "#1e5c1e"; ctx.fillRect(0, H - 140, W, 140);
    // Pitch markings
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H - 60, 50, Math.PI, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, H - 140); ctx.lineTo(W, H - 140); ctx.stroke();
    // Penalty spot
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(W / 2, H - 90, 5, 0, Math.PI * 2); ctx.fill();

    // Goal posts
    ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 10;
    ctx.fillRect(GOAL_X - GOAL_W / 2 - 5, GOAL_Y - 8, 10, GOAL_H + 16);
    ctx.fillRect(GOAL_X + GOAL_W / 2 - 5, GOAL_Y - 8, 10, GOAL_H + 16);
    ctx.fillRect(GOAL_X - GOAL_W / 2, GOAL_Y - 8, GOAL_W, 10);
    ctx.shadowBlur = 0;
    // Net
    for (let x = GOAL_X - GOAL_W / 2; x < GOAL_X + GOAL_W / 2; x += 18) {
      ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, GOAL_Y); ctx.lineTo(x, GOAL_Y + GOAL_H); ctx.stroke();
    }
    for (let y = GOAL_Y; y < GOAL_Y + GOAL_H; y += 14) {
      ctx.beginPath(); ctx.moveTo(GOAL_X - GOAL_W / 2, y); ctx.lineTo(GOAL_X + GOAL_W / 2, y); ctx.stroke();
    }
    // Goal area
    ctx.fillStyle = "rgba(0,200,0,0.07)";
    ctx.fillRect(GOAL_X - GOAL_W / 2, GOAL_Y, GOAL_W, GOAL_H);

    // Keeper (goalkeeper)
    ctx.font = "38px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🧤", s.keeperX, GOAL_Y + GOAL_H - 10);

    // Ball
    const ballGrad = ctx.createRadialGradient(s.ballX - 4, s.ballY - 4, 1, s.ballX, s.ballY, 16);
    ballGrad.addColorStop(0, "#fff"); ballGrad.addColorStop(1, "#555");
    ctx.fillStyle = ballGrad;
    ctx.beginPath(); ctx.arc(s.ballX, s.ballY, 16, 0, Math.PI * 2); ctx.fill();
    ctx.font = "20px sans-serif";
    ctx.fillText("⚽", s.ballX, s.ballY + 7);

    // HUD
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Goals: ${s.scored} / ${TOTAL_SHOTS - s.shotsLeft}`, 16, 30);
    ctx.fillStyle = "#ef4444";
    ctx.fillText(`Bot: ${s.botScored}`, 16, 50);
    ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`Shots left: ${s.shotsLeft}`, W - 16, 30);
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.ballX = BALL_X; s.ballY = BALL_Y; s.flying = false;
    s.scored = 0; s.botScored = 0; s.shotsLeft = TOTAL_SHOTS;
    s.keeperX = GOAL_X; s.keeperDir = 1; s.frame = 0; s.running = true;
    setScored(0); setShotsLeft(TOTAL_SHOTS); setPhase("playing"); setMsg("");
    loop();
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d1f0d", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">⚽ Penalty Shootout</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
      </div>

      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        {msg && (
          <motion.div key={msg} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute font-black text-2xl text-white pointer-events-none"
            style={{ top: "38%", left: "50%", transform: "translateX(-50%)" }}>
            {msg}
          </motion.div>
        )}
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(13,31,13,0.93)" }}>
              <div className="text-7xl">⚽</div>
              <div className="text-white font-black text-3xl">Penalty Shootout</div>
              <div className="text-zinc-400 text-sm text-center px-8">Choose a zone to shoot. Dodge the goalkeeper! {TOTAL_SHOTS} shots each.</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                KICK OFF! ⚽
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(13,31,13,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "🧤"}</div>
              <div className="text-white font-black text-2xl">{won ? "YOU WIN!" : "BOT WINS!"}</div>
              <div className="flex gap-8 text-center">
                <div><div className="text-zinc-400 text-xs">Your Goals</div><div className="text-white font-black text-2xl">{scored}/{TOTAL_SHOTS}</div></div>
                <div><div className="text-zinc-400 text-xs">Bot Goals</div><div className="text-zinc-300 font-black text-2xl">{stateRef.current.botScored}/{TOTAL_SHOTS}</div></div>
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
        <div className="px-4 pt-2 pb-4">
          <p className="text-zinc-400 text-xs text-center mb-2">Choose where to shoot:</p>
          <div className="grid grid-cols-3 gap-2">
            {ZONES.map(z => (
              <motion.button key={z.key} whileTap={{ scale: 0.9 }}
                onClick={() => shoot(z.key)}
                className="py-3 rounded-xl font-black text-2xl"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#fff",
                }}>
                {z.label}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
