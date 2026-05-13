import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 560;
const HOOP_CX = W / 2, HOOP_W = 60;
const BALL_START_Y = H - 90;
const BALL_START_X = W / 2;
const ROUNDS = 8;

export default function BasketballGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    ballX: BALL_START_X, ballY: BALL_START_Y,
    ballVX: 0, ballVY: 0, flying: false,
    hoopY: 160, hoopDir: 0, hoopVY: 0,
    score: 0, botScore: 0, round: 0,
    streak: 0, frame: 0, running: false,
    drag: false, dragStartY: 0, dragEndY: 0,
    swipeForce: 0,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [msg, setMsg] = useState("");
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    // Hoop movement in later rounds
    if (s.round > 3) {
      s.hoopVY += 0.08 * s.hoopDir;
      s.hoopY += s.hoopVY;
      if (s.hoopY < 100) { s.hoopDir = 1; s.hoopVY = 0; }
      if (s.hoopY > 240) { s.hoopDir = -1; s.hoopVY = 0; }
    }

    // Ball physics
    if (s.flying) {
      s.ballVY += 0.5;
      s.ballX += s.ballVX;
      s.ballY += s.ballVY;

      // Check score
      const dxH = Math.abs(s.ballX - HOOP_CX);
      const dyH = Math.abs(s.ballY - s.hoopY);
      if (dxH < HOOP_W / 2 - 6 && dyH < 18 && s.ballVY > 0) {
        const bonus = s.streak >= 2 ? " 🔥 STREAK!" : "";
        s.score += s.streak >= 2 ? 150 : 100;
        s.streak++;
        setScore(s.score);
        setMsg(`SCORE! ${bonus}`);
        setTimeout(() => setMsg(""), 900);
        nextShot(true);
        return;
      }

      // Miss
      if (s.ballY > H + 20 || s.ballX < -20 || s.ballX > W + 20) {
        s.streak = 0;
        setMsg("MISS! ❌");
        setTimeout(() => setMsg(""), 700);
        nextShot(false);
        return;
      }
    }

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function nextShot(scored: boolean) {
    const s = stateRef.current;
    const botPts = Math.random() < 0.6 ? 100 : 0;
    s.botScore += botPts;
    s.round++;
    if (s.round >= ROUNDS) {
      s.running = false;
      const didWin = s.score > s.botScore;
      setWon(didWin);
      if (didWin) addWinning(prize, "Basketball Win");
      setTimeout(() => setPhase("result"), 800);
      return;
    }
    s.flying = false;
    s.ballX = BALL_START_X; s.ballY = BALL_START_Y;
    s.ballVX = 0; s.ballVY = 0;
    setRound(s.round);
  }

  function throwBall(swipeForce: number) {
    const s = stateRef.current;
    if (s.flying || !s.running) return;
    const angle = -Math.PI * 0.55;
    const spd = Math.min(Math.max(swipeForce * 0.14, 9), 17);
    s.ballVX = Math.cos(angle) * spd * (Math.random() * 0.2 + 0.9);
    s.ballVY = Math.sin(angle) * spd;
    // Aim toward hoop
    const dxTarget = HOOP_CX - BALL_START_X;
    s.ballVX = dxTarget * 0.04 + (Math.random() - 0.5) * 2;
    s.flying = true;
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    // Court bg
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#1a0a3e"); bg.addColorStop(1, "#0a0520");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Court floor
    ctx.fillStyle = "#5a3a1a"; ctx.fillRect(0, H - 50, W, 50);
    ctx.fillStyle = "#6b4a22"; ctx.fillRect(0, H - 54, W, 4);
    // Court lines
    ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(W / 2, H - 50, 60, Math.PI, 2 * Math.PI); ctx.stroke();

    // Backboard
    ctx.fillStyle = "rgba(255,255,255,0.1)"; ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(HOOP_CX - 44, s.hoopY - 52, 88, 50, 4); ctx.fill(); ctx.stroke();
    // Inner box
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 2;
    ctx.strokeRect(HOOP_CX - 18, s.hoopY - 40, 36, 26);

    // Hoop
    ctx.strokeStyle = "#ff6b00"; ctx.lineWidth = 5;
    ctx.shadowColor = "#ff8c00"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(HOOP_CX, s.hoopY, HOOP_W / 2, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // Net
    for (let i = 0; i < 6; i++) {
      const nx = HOOP_CX - HOOP_W / 2 + (i + 1) * (HOOP_W / 6);
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(nx, s.hoopY);
      ctx.bezierCurveTo(nx, s.hoopY + 20, HOOP_CX, s.hoopY + 35, HOOP_CX, s.hoopY + 38);
      ctx.stroke();
    }

    // Ball
    const ballGrad = ctx.createRadialGradient(s.ballX - 6, s.ballY - 6, 2, s.ballX, s.ballY, 18);
    ballGrad.addColorStop(0, "#FF8C00"); ballGrad.addColorStop(1, "#cc5500");
    ctx.fillStyle = ballGrad;
    ctx.shadowColor = "#FF6600"; ctx.shadowBlur = s.flying ? 16 : 8;
    ctx.beginPath(); ctx.arc(s.ballX, s.ballY, 18, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Ball lines
    ctx.strokeStyle = "#000"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(s.ballX - 18, s.ballY); ctx.lineTo(s.ballX + 18, s.ballY); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.ballX, s.ballY, 18, -Math.PI / 4, Math.PI / 4); ctx.stroke();
    ctx.beginPath(); ctx.arc(s.ballX, s.ballY, 18, Math.PI * 3 / 4, Math.PI * 5 / 4); ctx.stroke();

    // HUD
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`You: ${s.score}`, 16, 30);
    ctx.fillStyle = "#ef4444"; ctx.fillText(`Bot: ${s.botScore}`, 16, 50);
    ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`Shot ${s.round + 1}/${ROUNDS}`, W - 16, 30);
    if (s.streak >= 2) {
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 12px sans-serif";
      ctx.fillText(`🔥 x${s.streak}`, W - 16, 50);
    }
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.ballX = BALL_START_X; s.ballY = BALL_START_Y; s.flying = false;
    s.score = 0; s.botScore = 0; s.round = 0; s.streak = 0;
    s.hoopY = 160; s.hoopDir = 1; s.hoopVY = 0;
    s.running = true; s.frame = 0;
    setScore(0); setRound(0); setPhase("playing"); setMsg("");
    loop();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let startY = 0;
    const ts = (e: TouchEvent) => { startY = e.touches[0].clientY; };
    const te = (e: TouchEvent) => {
      const dy = startY - e.changedTouches[0].clientY;
      if (dy > 20) throwBall(dy);
    };
    const ms = (e: MouseEvent) => { startY = e.clientY; };
    const mu = (e: MouseEvent) => { const dy = startY - e.clientY; if (dy > 20) throwBall(dy); };
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
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0520", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🏀 Basketball</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee} Entry</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        {msg && (
          <motion.div key={msg} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="absolute font-black text-xl pointer-events-none text-white"
            style={{ top: "46%", left: "50%", transform: "translateX(-50%)" }}>
            {msg}
          </motion.div>
        )}
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.93)" }}>
              <div className="text-7xl">🏀</div>
              <div className="text-white font-black text-3xl">Basketball</div>
              <div className="text-zinc-400 text-sm text-center px-8">Swipe UP to shoot! Score in {ROUNDS} shots. 2-streak = bonus points!</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                SHOOT! 🏀
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "🏀"}</div>
              <div className="text-white font-black text-2xl">{won ? "SLAM DUNK WIN!" : "BOT WINS!"}</div>
              <div className="flex gap-8 text-center">
                <div><div className="text-zinc-400 text-xs">Your Score</div><div className="text-white font-black text-xl">{score}</div></div>
                <div><div className="text-zinc-400 text-xs">Bot Score</div><div className="text-zinc-300 font-black text-xl">{stateRef.current.botScore}</div></div>
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
          <motion.button whileTap={{ scale: 0.93 }} onClick={() => throwBall(80)}
            className="w-full py-4 rounded-2xl font-black text-black text-xl"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
            🏀 SHOOT (or Swipe Up)
          </motion.button>
        </div>
      )}
    </div>
  );
}
