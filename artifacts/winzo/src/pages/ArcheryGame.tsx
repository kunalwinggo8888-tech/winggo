import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 560;
const TARGET_X = W - 80, TARGET_CX = W - 80, TARGET_CY = H / 2;
const ROUNDS = 6;

export default function ArcheryGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    aimY: H / 2, aimDir: 1, aimSpeed: 2.5,
    wind: 0, round: 0, score: 0, botScore: 0,
    arrows: [] as { x: number; y: number; angle: number; hit: number }[],
    flying: null as { x: number; y: number; tx: number; ty: number; t: number } | null,
    frame: 0, running: false, targetY: TARGET_CY, targetDir: 1,
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [wind, setWind] = useState(0);
  const [won, setWon] = useState(false);
  const [lastHit, setLastHit] = useState("");
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function newRound() {
    const s = stateRef.current;
    s.wind = (Math.random() - 0.5) * 60;
    s.aimSpeed = 2 + s.round * 0.3;
    setWind(Math.round(s.wind));
  }

  function shoot() {
    const s = stateRef.current;
    if (s.flying || !s.running) return;
    const windOffset = s.wind;
    const ty = s.aimY + windOffset;
    s.flying = { x: 60, y: H / 2, tx: TARGET_X, ty, t: 0 };
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    // Aim oscillation
    s.aimY += s.aimDir * s.aimSpeed;
    if (s.aimY < TARGET_CY - 100 || s.aimY > TARGET_CY + 100) s.aimDir *= -1;

    // Moving target (later rounds)
    if (s.round > 3) {
      s.targetY += s.targetDir * 1.5;
      if (s.targetY < TARGET_CY - 80 || s.targetY > TARGET_CY + 80) s.targetDir *= -1;
    }

    // Flying arrow
    if (s.flying) {
      s.flying.t += 0.07;
      s.flying.x = 60 + (TARGET_X - 60) * s.flying.t;
      s.flying.y = H / 2 + (s.flying.ty - H / 2) * s.flying.t;
      if (s.flying.t >= 1) {
        const dy = s.flying.ty - (s.targetY ?? TARGET_CY);
        const dist = Math.abs(dy);
        let pts = 0, hitLabel = "";
        if (dist < 14) { pts = 100; hitLabel = "BULLSEYE! 🎯"; }
        else if (dist < 30) { pts = 75; hitLabel = "Inner! ✅"; }
        else if (dist < 55) { pts = 50; hitLabel = "Middle! 👍"; }
        else if (dist < 80) { pts = 25; hitLabel = "Outer ↗"; }
        else { hitLabel = "MISS! ❌"; }

        const botPts = getBotScore(100, difficulty);
        s.arrows.push({ x: s.flying.tx, y: s.flying.ty, angle: 0, hit: pts });
        s.score += pts; s.botScore += botPts;
        s.flying = null; s.round++;
        setRound(s.round); setScore(s.score); setBotScore(s.botScore); setLastHit(hitLabel);
        setTimeout(() => setLastHit(""), 1000);

        if (s.round >= ROUNDS) {
          s.running = false;
          const didWin = s.score > s.botScore;
          setWon(didWin);
          if (didWin) addWinning(prize, "Archery Win");
          setTimeout(() => setPhase("result"), 600);
          return;
        }
        newRound();
      }
    }

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a1628"); bg.addColorStop(1, "#1e0a3c");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Grass
    ctx.fillStyle = "#1a4a1a"; ctx.fillRect(0, H - 40, W, 40);
    ctx.fillStyle = "#225a22"; ctx.fillRect(0, H - 44, W, 4);

    // Archer
    ctx.font = "42px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("🏹", 55, H / 2 + 14);

    // Aim line
    if (!s.flying) {
      ctx.strokeStyle = "rgba(255,215,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(80, H / 2); ctx.lineTo(TARGET_X - 30, s.aimY); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(255,215,0,0.8)";
      ctx.beginPath(); ctx.arc(TARGET_X - 30, s.aimY, 6, 0, Math.PI * 2); ctx.fill();
    }

    // Flying arrow
    if (s.flying) {
      const angle = Math.atan2(s.flying.ty - H / 2, TARGET_X - 60);
      ctx.save();
      ctx.translate(s.flying.x, s.flying.y);
      ctx.rotate(angle);
      ctx.strokeStyle = "#c0a050"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.stroke();
      ctx.fillStyle = "#e0e0e0";
      ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(12, -4); ctx.lineTo(12, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Target
    const ty = s.targetY;
    [70, 55, 40, 25, 10].forEach((r, i) => {
      const colors = ["#fff", "#000", "#0000ff", "#ff0000", "#FFD700"];
      ctx.fillStyle = colors[i];
      ctx.beginPath(); ctx.arc(TARGET_CX, ty, r, 0, Math.PI * 2); ctx.fill();
    });

    // Embedded arrows
    s.arrows.forEach(a => {
      ctx.strokeStyle = "#c0a050"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(a.x - 20, a.y); ctx.lineTo(a.x + 4, a.y); ctx.stroke();
    });

    // Wind indicator
    const wx = 16, wy = 90;
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(wx, wy, 120, 36, 8); ctx.fill();
    ctx.fillStyle = "#a78bfa"; ctx.font = "11px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Wind: ${s.wind > 0 ? "→" : "←"} ${Math.abs(Math.round(s.wind))}`, wx + 10, wy + 14);
    ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif";
    ctx.fillText("Aim higher/lower to compensate", wx + 10, wy + 28);

    // HUD
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(W - 150, 10, 138, 54, 8); ctx.fill();
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`You: ${s.score}`, W - 16, 30);
    ctx.fillStyle = "#ef4444"; ctx.fillText(`Bot: ${s.botScore}`, W - 16, 50);

    ctx.fillStyle = "#fff"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Round ${s.round + 1}/${ROUNDS}`, 16, 30);
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.aimY = H / 2; s.aimDir = 1; s.round = 0;
    s.score = 0; s.botScore = 0; s.arrows = []; s.flying = null;
    s.running = true; s.frame = 0; s.targetY = TARGET_CY;
    setRound(0); setScore(0); setBotScore(0); setPhase("playing");
    newRound();
    loop();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onTap = () => { if (phase === "playing") shoot(); };
    canvas.addEventListener("touchend", onTap, { passive: true });
    canvas.addEventListener("click", onTap);
    return () => {
      canvas.removeEventListener("touchend", onTap);
      canvas.removeEventListener("click", onTap);
    };
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a1628", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🏹 Archery</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        {lastHit && (
          <motion.div key={lastHit} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute font-black text-xl text-white pointer-events-none"
            style={{ top: "42%", left: "50%", transform: "translateX(-50%)" }}>
            {lastHit}
          </motion.div>
        )}
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,22,40,0.93)" }}>
              <div className="text-7xl">🏹</div>
              <div className="text-white font-black text-3xl">Archery</div>
              <div className="text-zinc-400 text-sm text-center px-8">Tap when the aim is on target. Watch the wind direction!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} vs <b className="text-white">{difficulty.botName}</b> · {ROUNDS} rounds · {difficulty.level}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                AIM & SHOOT 🏹
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,22,40,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "🎯"}</div>
              <div className="text-white font-black text-2xl">{won ? "ARCHERY CHAMPION!" : "BOT WINS!"}</div>
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
          <motion.button whileTap={{ scale: 0.93 }} onClick={shoot}
            className="w-full py-4 rounded-2xl font-black text-black text-xl"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
            🏹 SHOOT — Wind: {wind > 0 ? "→" : "←"} {Math.abs(wind)}
          </motion.button>
        </div>
      )}
    </div>
  );
}
