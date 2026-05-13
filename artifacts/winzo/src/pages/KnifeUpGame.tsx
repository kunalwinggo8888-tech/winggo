import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 600;
const LOG_CX = W / 2, LOG_CY = 240, LOG_R = 80;
const KNIFE_LEN = 60, MAX_KNIVES = 7;

export default function KnifeUpGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const TARGET_HITS_REQUIRED = difficulty.level === "Beginner" ? 10 : difficulty.level === "Pro" ? 12 : 15;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    angle: 0, rotSpeed: 0.025,
    knives: [] as { angle: number }[],
    thrown: [] as { x: number; y: number; angle: number; progress: number; embedded: boolean }[],
    knifeAngle: Math.PI / 2,
    level: 1, hits: 0, misses: 0,
    phase: "playing" as "playing" | "hit" | "level",
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [hits, setHits] = useState(0);
  const [level, setLevel] = useState(1);
  const [won, setWon] = useState(false);
  const [msg, setMsg] = useState("");
  const TARGET_HITS = TARGET_HITS_REQUIRED;
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const throwKnife = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== "playing") return;

    // Check collision with embedded knives
    const knifeAngleNorm = s.angle % (Math.PI * 2);
    for (const k of s.knives) {
      const diff = Math.abs((k.angle - knifeAngleNorm + Math.PI * 4) % (Math.PI * 2));
      if (diff < 0.22 || diff > Math.PI * 2 - 0.22) {
        setMsg("HIT KNIFE! ❌");
        setTimeout(() => {
          const won = s.hits >= TARGET_HITS - 3;
          setWon(won);
          if (won) addWinning(prize, "Knife Up Win");
          setPhase("result");
        }, 600);
        return;
      }
    }
    s.knives.push({ angle: knifeAngleNorm });
    s.hits++;
    setHits(s.hits);
    setMsg(["Nice! 🎯", "Clean! ✅", "Precise! 💫"][Math.floor(Math.random() * 3)]);
    setTimeout(() => setMsg(""), 500);

    if (s.knives.length >= MAX_KNIVES) {
      s.knives = [];
      s.level++;
      s.rotSpeed += 0.008 * (s.level % 2 === 0 ? -1 : 1);
      setLevel(s.level);
      if (s.hits >= TARGET_HITS) {
        setWon(true);
        addWinning(prize, "Knife Up Win");
        setPhase("result");
      }
    }
  }, [addWinning, prize]);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;

    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0d0d1a"); bg.addColorStop(1, "#1a0a2e");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    // Log
    const logGrad = ctx.createRadialGradient(LOG_CX, LOG_CY, 20, LOG_CX, LOG_CY, LOG_R);
    logGrad.addColorStop(0, "#8B4513"); logGrad.addColorStop(1, "#5c3d1e");
    ctx.fillStyle = logGrad;
    ctx.beginPath(); ctx.arc(LOG_CX, LOG_CY, LOG_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a0522d"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(LOG_CX, LOG_CY, LOG_R, 0, Math.PI * 2); ctx.stroke();

    // Rings on log
    [60, 40, 20].forEach(r => {
      ctx.strokeStyle = `rgba(160,82,45,0.4)`;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(LOG_CX, LOG_CY, r, 0, Math.PI * 2); ctx.stroke();
    });

    // Embedded knives
    s.knives.forEach(k => {
      ctx.save();
      ctx.translate(LOG_CX + (LOG_R + 10) * Math.cos(k.angle - Math.PI / 2),
        LOG_CY + (LOG_R + 10) * Math.sin(k.angle - Math.PI / 2));
      ctx.rotate(k.angle);
      ctx.fillStyle = "#c0c0c0";
      ctx.fillRect(-3, -KNIFE_LEN * 0.6, 6, KNIFE_LEN * 0.6);
      ctx.fillStyle = "#8B4513";
      ctx.fillRect(-4, 0, 8, KNIFE_LEN * 0.4);
      ctx.restore();
    });

    // Rotating log indicator
    ctx.save();
    ctx.translate(LOG_CX, LOG_CY);
    ctx.rotate(s.angle);
    ctx.strokeStyle = "rgba(255,215,0,0.2)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 8]);
    ctx.beginPath(); ctx.moveTo(0, -LOG_R); ctx.lineTo(0, LOG_R); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Knife at bottom (ready to throw)
    const kx = W / 2, ky = H - 80;
    ctx.fillStyle = "#e0e0e0";
    ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(kx, ky - KNIFE_LEN * 0.75);
    ctx.lineTo(kx - 4, ky + 10);
    ctx.lineTo(kx + 4, ky + 10);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#8B4513";
    ctx.beginPath(); ctx.roundRect(kx - 5, ky + 10, 10, 25, 3); ctx.fill();

    // Glow under knife
    const kGlow = ctx.createRadialGradient(kx, ky + 10, 0, kx, ky + 10, 40);
    kGlow.addColorStop(0, "rgba(255,215,0,0.3)"); kGlow.addColorStop(1, "rgba(255,215,0,0)");
    ctx.fillStyle = kGlow; ctx.beginPath(); ctx.ellipse(kx, ky + 20, 40, 14, 0, 0, Math.PI * 2); ctx.fill();

    // HUD
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 15px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Hits: ${s.hits}/${TARGET_HITS}`, 16, 30);
    ctx.fillStyle = "#a78bfa"; ctx.font = "13px sans-serif";
    ctx.fillText(`Level ${s.level}`, 16, 50);
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`Knives: ${MAX_KNIVES - s.knives.length} left`, W - 16, 30);

    s.angle += s.rotSpeed;
    rafRef.current = requestAnimationFrame(draw);
  }

  function startGame() {
    const s = stateRef.current;
    s.angle = 0; s.rotSpeed = 0.025; s.knives = []; s.hits = 0; s.level = 1;
    setHits(0); setLevel(1); setPhase("playing"); setMsg("");
    draw();
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleClick = () => { if (phase === "playing") throwKnife(); };
    const handleTouch = (e: TouchEvent) => { e.preventDefault(); if (phase === "playing") throwKnife(); };
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchend", handleTouch, { passive: false });
    return () => {
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("touchend", handleTouch);
    };
  }, [phase, throwKnife]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0d0d1a", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🔪 Knife Up</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      <div className="relative" style={{ width: W, maxWidth: "100%" }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", cursor: "pointer" }} />

        {msg && (
          <motion.div key={msg + Date.now()} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="absolute text-white font-black text-xl pointer-events-none"
            style={{ top: "58%", left: "50%", transform: "translateX(-50%)" }}>
            {msg}
          </motion.div>
        )}

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(13,13,26,0.92)" }}>
              <div className="text-7xl">🔪</div>
              <div className="text-white font-black text-3xl">Knife Up</div>
              <div className="text-zinc-400 text-sm text-center px-8">Tap to throw knives into the rotating log. Don't hit existing knives!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
                Hit <b>{TARGET_HITS}</b> knives without collision to win!
              </div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} <b>{difficulty.level}</b> · Target: {TARGET_HITS} hits to win
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                THROW! 🔪
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(13,13,26,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💥"}</div>
              <div className="text-white font-black text-2xl">{won ? "KNIFE MASTER!" : "MISS!"}</div>
              <div className="text-center">
                <div className="text-zinc-400 text-sm">Knives Landed</div>
                <div className="text-white font-black text-3xl">{hits} / {TARGET_HITS}</div>
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
        <div className="px-6 py-4 text-center">
          <motion.button whileTap={{ scale: 0.92 }} onClick={throwKnife}
            className="w-full py-5 rounded-2xl font-black text-black text-xl"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", boxShadow: "0 0 20px rgba(255,215,0,0.4)" }}>
            🔪 THROW
          </motion.button>
        </div>
      )}
    </div>
  );
}
