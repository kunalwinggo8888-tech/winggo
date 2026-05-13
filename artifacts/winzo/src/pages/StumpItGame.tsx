import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 520;
const STUMP_X = W / 2, STUMP_Y = H - 80;
const BALL_START_X = 70, BALL_START_Y = H - 120;
const THROWS = 6;

export default function StumpItGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    ballX: BALL_START_X, ballY: BALL_START_Y,
    aimX: STUMP_X, aimY: STUMP_Y, aimOscX: 0, aimOscDir: 1,
    power: 0, powerDir: 1, charging: false,
    ballVX: 0, ballVY: 0, flying: false,
    throwsLeft: THROWS, hits: 0, botHits: 0, frame: 0, running: false,
    hitFlash: 0,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [hits, setHits] = useState(0);
  const [throwsLeft, setThrowsLeft] = useState(THROWS);
  const [msg, setMsg] = useState("");
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function startCharge() {
    stateRef.current.charging = true;
    stateRef.current.power = 0;
  }

  function release() {
    const s = stateRef.current;
    if (!s.charging || s.flying) return;
    s.charging = false;
    const targetX = STUMP_X + s.aimOscX;
    const angle = Math.atan2(targetX - BALL_START_X, BALL_START_Y - BALL_START_Y + 10);
    const spd = 8 + s.power * 0.1;
    s.ballVX = (targetX - BALL_START_X) / 28;
    s.ballVY = -spd;
    s.ballX = BALL_START_X; s.ballY = BALL_START_Y;
    s.flying = true;
    s.throwsLeft--;
    setThrowsLeft(s.throwsLeft);
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    // Aim oscillation
    s.aimOscX += s.aimOscDir * (1.5 + s.frame / 200);
    if (s.aimOscX > 80 || s.aimOscX < -80) s.aimOscDir *= -1;

    // Power charge
    if (s.charging) {
      s.power += s.powerDir * 2;
      if (s.power >= 100 || s.power <= 0) s.powerDir *= -1;
    }

    // Ball flight
    if (s.flying) {
      s.ballVY += 0.4;
      s.ballX += s.ballVX;
      s.ballY += s.ballVY;

      // Hit stumps
      if (Math.abs(s.ballX - STUMP_X) < 28 && Math.abs(s.ballY - STUMP_Y) < 30) {
        s.hits++; s.hitFlash = 20;
        setHits(s.hits); setMsg("🏏 HIT! +100");
        setTimeout(() => setMsg(""), 700);
        s.flying = false; s.ballX = BALL_START_X; s.ballY = BALL_START_Y;
      }
      // Miss / bounce
      if (s.ballY > H + 20) {
        setMsg("MISS ❌");
        setTimeout(() => setMsg(""), 600);
        s.flying = false; s.ballX = BALL_START_X; s.ballY = BALL_START_Y;
      }

      if (!s.flying && s.throwsLeft <= 0) {
        s.running = false;
        const botH = Math.floor(Math.random() * 3 + 2);
        s.botHits = botH;
        const didWin = s.hits > botH;
        setWon(didWin);
        if (didWin) addWinning(prize, "Stump It Win");
        setTimeout(() => setPhase("result"), 700);
        return;
      }
    }

    if (s.hitFlash > 0) s.hitFlash--;
    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d1f0d"); bg.addColorStop(1, "#1a3a1a");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Ground
    ctx.fillStyle = "#2e6b2e"; ctx.fillRect(0, H - 55, W, 55);
    ctx.fillStyle = "#3a8030"; ctx.fillRect(0, H - 58, W, 3);
    // Pitch
    ctx.fillStyle = "#c8a855"; ctx.fillRect(STUMP_X - 40, H - 58, 80, 58);
    ctx.strokeStyle = "#e0c070"; ctx.lineWidth = 1.5;
    ctx.strokeRect(STUMP_X - 40, H - 58, 80, 58);

    // Stumps
    const hitGlow = s.hitFlash > 0;
    if (hitGlow) { ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 24; }
    ctx.fillStyle = hitGlow ? "#FFD700" : "#e8d5a0";
    [-16, 0, 16].forEach(dx => {
      ctx.fillRect(STUMP_X + dx - 3, STUMP_Y - 55, 6, 55);
    });
    // Bails
    ctx.fillStyle = hitGlow ? "#ff8c00" : "#c8a050";
    ctx.fillRect(STUMP_X - 20, STUMP_Y - 57, 40, 6);
    ctx.shadowBlur = 0;

    // Batter (emoji)
    ctx.font = "42px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🏏", STUMP_X + 40, STUMP_Y - 20);

    // Aim indicator
    if (!s.flying) {
      const aimX = STUMP_X + s.aimOscX;
      ctx.strokeStyle = "rgba(255,215,0,0.35)"; ctx.lineWidth = 1.5; ctx.setLineDash([5, 6]);
      ctx.beginPath(); ctx.moveTo(BALL_START_X, BALL_START_Y); ctx.lineTo(aimX, STUMP_Y - 30); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,215,0,0.6)";
      ctx.beginPath(); ctx.arc(aimX, STUMP_Y - 30, 8, 0, Math.PI * 2); ctx.fill();
    }

    // Ball
    const ballGrad = ctx.createRadialGradient(s.ballX - 4, s.ballY - 4, 1, s.ballX, s.ballY, 12);
    ballGrad.addColorStop(0, "#ff4444"); ballGrad.addColorStop(1, "#aa0000");
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = "#ff2222"; ctx.shadowBlur = s.flying ? 12 : 0;
    ctx.beginPath(); ctx.arc(s.ballX, s.ballY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // Power bar
    if (s.charging) {
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(20, H - 30, 160, 14, 7); ctx.fill();
      const pColor = s.power > 66 ? "#ef4444" : s.power > 33 ? "#FFD700" : "#22c55e";
      ctx.fillStyle = pColor;
      ctx.beginPath(); ctx.roundRect(20, H - 30, 160 * (s.power / 100), 14, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("POWER", 100, H - 20);
    }

    // HUD
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Hits: ${s.hits} / ${THROWS}`, 16, 30);
    ctx.fillStyle = "#a78bfa"; ctx.font = "12px sans-serif";
    ctx.fillText(`Throws left: ${s.throwsLeft}`, 16, 50);
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.ballX = BALL_START_X; s.ballY = BALL_START_Y; s.flying = false;
    s.hits = 0; s.throwsLeft = THROWS; s.frame = 0; s.running = true;
    s.aimOscX = 0; s.aimOscDir = 1; s.charging = false;
    setHits(0); setThrowsLeft(THROWS); setPhase("playing"); setMsg("");
    loop();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ts = () => startCharge();
    const te = () => release();
    const ms = () => startCharge();
    const mu = () => release();
    canvas.addEventListener("touchstart", ts, { passive: true });
    canvas.addEventListener("touchend", te, { passive: true });
    canvas.addEventListener("mousedown", ms);
    canvas.addEventListener("mouseup", mu);
    return () => {
      canvas.removeEventListener("touchstart", ts);
      canvas.removeEventListener("touchend", te);
      canvas.removeEventListener("mousedown", ms);
      canvas.removeEventListener("mouseup", mu);
    };
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d1f0d", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🏏 Stump It</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        {msg && (
          <motion.div key={msg} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            className="absolute font-black text-xl text-white pointer-events-none"
            style={{ top: "40%", left: "50%", transform: "translateX(-50%)" }}>
            {msg}
          </motion.div>
        )}
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(13,31,13,0.93)" }}>
              <div className="text-7xl">🏏</div>
              <div className="text-white font-black text-3xl">Stump It!</div>
              <div className="text-zinc-400 text-sm text-center px-8">Hold & release to throw! Hit the stumps {THROWS} times to beat the bot!</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                BOWL! 🏏
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(13,31,13,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "🏏"}</div>
              <div className="text-white font-black text-2xl">{won ? "STUMPED IT!" : "BOT WINS!"}</div>
              <div className="flex gap-8 text-center">
                <div><div className="text-zinc-400 text-xs">Your Hits</div><div className="text-white font-black text-2xl">{hits}/{THROWS}</div></div>
                <div><div className="text-zinc-400 text-xs">Bot Hits</div><div className="text-zinc-300 font-black text-2xl">{stateRef.current.botHits}/{THROWS}</div></div>
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
            whileTap={{ scale: 0.92 }}
            onTouchStart={startCharge} onTouchEnd={release}
            onMouseDown={startCharge} onMouseUp={release}
            className="w-full py-5 rounded-2xl font-black text-black text-xl select-none"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", userSelect: "none" }}>
            HOLD &amp; RELEASE to Throw!
          </motion.button>
        </div>
      )}
    </div>
  );
}
