/**
 * SlapFestGame — WINGGO 1v1 Slap Battle
 * Canvas 2D: moving power meter, timing mechanic, ragdoll reaction, health bars.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const W = 360, H = 440;

function MM({ fee, onStart }: { fee: number; onStart: () => void }) {
  const [cd, setCd] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 200); return 0; } return c - 1; }), 900);
    return () => clearInterval(t);
  }, [onStart]);
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
        style={{ background: "rgba(255,200,0,0.12)", border: "2px solid rgba(255,200,0,0.45)" }}
        animate={{ rotate: [0, -20, 20, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>👋</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Slap Fest!</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Hit the green zone for a power slap!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,200,0,0.07)", border: "1px solid rgba(255,200,0,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(255,200,0,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function SlapFestGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [won, setWon] = useState(false);
  const [statusMsg, setStatusMsg] = useState("TAP to SLAP!");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("matchmaking");
  phaseRef.current = phase;
  const animRef = useRef<number>(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const gameRef = useRef({
    playerHP: 100, botHP: 100,
    meterPos: 0, meterSpeed: 2.2,
    meterDir: 1,
    canSlap: true, slapAnim: 0, slapSide: "player" as "player" | "bot",
    shakeX: 0, shakeY: 0,
    botTimer: 0,
    lastHit: "",
  });

  const startGame = useCallback(() => {
    const g = gameRef.current;
    g.playerHP = 100; g.botHP = 100;
    g.meterPos = 0; g.meterSpeed = 2.2; g.meterDir = 1;
    g.canSlap = true; g.slapAnim = 0; g.botTimer = 80; g.lastHit = "";
    setStatusMsg("TAP to SLAP!");
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gameRef.current;

    function drawCharacter(cx: number, side: "player" | "bot", isSlapping: boolean, hp: number) {
      const faceColor = side === "player" ? "#FFD700" : "#ef4444";
      const bodyColor = side === "player" ? "#ff8c00" : "#cc0000";
      const dead = hp <= 0;
      const headTilt = dead ? (side === "player" ? 30 : -30) : (g.slapSide === side && g.slapAnim > 0 ? (side === "player" ? -15 : 15) : 0);
      const bodyShift = isSlapping ? (side === "player" ? 20 : -20) : 0;

      ctx.save();
      ctx.translate(cx + bodyShift, 200);
      // Body
      ctx.fillStyle = bodyColor;
      ctx.fillRect(-22, 0, 44, 70);
      // Arm (slapping)
      if (isSlapping) {
        ctx.fillStyle = faceColor;
        ctx.save();
        ctx.translate(side === "player" ? 22 : -22, 10);
        ctx.rotate(side === "player" ? -Math.PI / 3 : Math.PI / 3);
        ctx.fillRect(-6, -35, 12, 40);
        ctx.restore();
      } else {
        ctx.fillStyle = faceColor;
        ctx.fillRect(side === "player" ? 22 : -34, 5, 12, 38);
      }
      // Head
      ctx.save();
      ctx.translate(0, -38);
      ctx.rotate((headTilt * Math.PI) / 180);
      ctx.fillStyle = faceColor;
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI * 2); ctx.fill();
      // Eyes
      ctx.fillStyle = "#000";
      if (dead) {
        ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("x x", 0, 5);
      } else {
        ctx.beginPath(); ctx.arc(-9, -4, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(9, -4, 5, 0, Math.PI * 2); ctx.fill();
        // Mouth
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
        ctx.beginPath();
        if (g.slapSide === side && g.slapAnim > 0) {
          ctx.arc(0, 8, 10, 0, Math.PI); // sad
        } else {
          ctx.arc(0, 6, 8, 0, Math.PI, true); // happy
        }
        ctx.stroke();
      }
      ctx.restore();
      ctx.restore();
    }

    function draw() {
      if (phaseRef.current !== "playing") return;

      // Shake
      const sx = g.shakeX * (Math.random() - 0.5) * 2;
      const sy = g.shakeY * (Math.random() - 0.5) * 2;

      ctx.save();
      ctx.translate(sx, sy);
      ctx.clearRect(-10, -10, W + 20, H + 20);

      // Background
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#1a0030"); bg.addColorStop(1, "#0a0010");
      ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);

      // Stage
      ctx.fillStyle = "#2a1a3a";
      ctx.beginPath(); ctx.roundRect(20, 140, W - 40, 200, 12); ctx.fill();
      ctx.strokeStyle = "rgba(255,215,0,0.2)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(20, 140, W - 40, 200, 12); ctx.stroke();

      // Characters
      const pSlapping = g.slapSide === "player" && g.slapAnim > 0;
      const bSlapping = g.slapSide === "bot" && g.slapAnim > 0;
      drawCharacter(90, "player", pSlapping, g.playerHP);
      drawCharacter(270, "bot", bSlapping, g.botHP);

      // VS text
      ctx.fillStyle = "rgba(255,215,0,0.7)"; ctx.font = "bold 20px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("VS", W / 2, 245);

      // Health bars
      const drawHP = (x: number, hp: number, color: string, label: string) => {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(x, 20, 140, 18, 9); ctx.fill();
        const pct = Math.max(0, hp / 100);
        const g2 = ctx.createLinearGradient(x, 0, x + 140 * pct, 0);
        g2.addColorStop(0, color); g2.addColorStop(1, "#fff");
        ctx.fillStyle = g2;
        if (pct > 0) { ctx.beginPath(); ctx.roundRect(x, 20, 140 * pct, 18, 9); ctx.fill(); }
        ctx.fillStyle = "white"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`${label} ${Math.ceil(hp)}%`, x + 70, 33);
      };
      drawHP(10, g.playerHP, "#FFD700", "YOU");
      drawHP(W - 150, g.botHP, "#ef4444", "BOT");

      // Power meter
      const MX = 40, MY = 370, MW = W - 80, MH = 22;
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 11); ctx.fill();
      // Green zone (60-80)
      const greenStart = MW * 0.6, greenEnd = MW * 0.82;
      ctx.fillStyle = "rgba(0,255,80,0.4)"; ctx.beginPath(); ctx.roundRect(MX + greenStart, MY, greenEnd - greenStart, MH, 11); ctx.fill();
      // Red zone (80-100)
      ctx.fillStyle = "rgba(255,80,0,0.35)"; ctx.beginPath(); ctx.roundRect(MX + greenEnd, MY, MW - greenEnd, MH, 11); ctx.fill();
      // Meter fill
      const mFill = (g.meterPos / 100) * MW;
      const mCol = g.meterPos >= 60 && g.meterPos <= 82 ? "#00ff50" : g.meterPos > 82 ? "#ff5500" : "#4488ff";
      ctx.fillStyle = mCol;
      ctx.beginPath(); ctx.roundRect(MX, MY, mFill, MH, 11); ctx.fill();
      // Labels
      ctx.fillStyle = "#00ff50"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center";
      ctx.fillText("POWER ZONE", MX + greenStart + (greenEnd - greenStart) / 2, MY + 14);

      // Hit message
      if (g.lastHit) {
        ctx.fillStyle = "#FFD700"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(g.lastHit, W / 2, 120);
      }
      // Status
      ctx.fillStyle = "rgba(255,255,255,0.55)"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(statusMsg, W / 2, 420);

      ctx.restore();
      g.shakeX *= 0.75; g.shakeY *= 0.75;
    }

    function update() {
      if (phaseRef.current !== "playing") return;
      const g = gameRef.current;

      // Move power meter
      g.meterPos += g.meterSpeed * g.meterDir;
      if (g.meterPos >= 100) { g.meterPos = 100; g.meterDir = -1; }
      if (g.meterPos <= 0) { g.meterPos = 0; g.meterDir = 1; }

      // Slap animation decay
      if (g.slapAnim > 0) g.slapAnim -= 2;

      // Bot auto-slap
      g.botTimer--;
      if (g.botTimer <= 0 && g.canSlap) {
        g.botTimer = 70 + Math.floor(Math.random() * 60);
        // Bot slap
        const power = 40 + Math.random() * 50;
        const dmg = Math.floor(power * 0.4);
        g.playerHP = Math.max(0, g.playerHP - dmg);
        g.slapSide = "bot"; g.slapAnim = 25;
        g.shakeX = 8; g.shakeY = 6;
        g.lastHit = power > 65 ? `🤖 POWER SLAP! -${dmg}` : `🤖 Slap! -${dmg}`;
        setStatusMsg("You got slapped!");
        setTimeout(() => { g.lastHit = ""; setStatusMsg(g.playerHP > 0 ? "TAP to SLAP!" : ""); }, 900);
        if (g.playerHP <= 0) {
          setWon(false); setPhase("result"); return;
        }
      }

      draw();
      animRef.current = requestAnimationFrame(update);
    }
    animRef.current = requestAnimationFrame(update);

    return () => cancelAnimationFrame(animRef.current);
  }, [phase, prize, addWinning, statusMsg]);

  function handleSlap() {
    if (phase !== "playing") return;
    const g = gameRef.current;
    if (!g.canSlap || g.slapAnim > 0) return;
    const power = g.meterPos;
    let dmg = 0, msg = "";
    if (power >= 60 && power <= 82) { dmg = Math.floor(power * 0.55); msg = `🎯 POWER SLAP! -${dmg}`; }
    else if (power > 82) { dmg = Math.floor(power * 0.35); msg = `⚡ Overswing! -${dmg}`; }
    else { dmg = Math.floor(power * 0.25); msg = `👋 Weak Slap -${dmg}`; }
    g.botHP = Math.max(0, g.botHP - dmg);
    g.slapSide = "player"; g.slapAnim = 25;
    g.shakeX = 10; g.shakeY = 8;
    g.lastHit = msg;
    setStatusMsg(g.botHP > 0 ? "TAP to SLAP!" : "KO!");
    setTimeout(() => { gameRef.current.lastHit = ""; }, 900);
    if (g.botHP <= 0) {
      setWon(true); addWinning(prize, `👋 Slap Fest — Won ₹${prize}`); setPhase("result");
    }
  }

  function handleRematch() {
    setWon(false); setStatusMsg("TAP to SLAP!"); setPhase("matchmaking");
  }

  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#100020", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">👋</span><span className="font-black text-white text-base">Slap Fest</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,200,0,0.08)", border: "1px solid rgba(255,200,0,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}

      {phase === "playing" && (
        <div className="flex-1 flex flex-col items-center">
          <canvas ref={canvasRef} width={W} height={H}
            onClick={handleSlap} onTouchStart={handleSlap}
            style={{ width: "100%", maxWidth: W, touchAction: "none", cursor: "pointer" }} />
        </div>
      )}

      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(255,200,0,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(255,200,0,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(255,200,0,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? "KO! You Win! 🎉" : "You Got KO'd!"}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(255,200,0,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 28px rgba(255,200,0,0.4)" }}>
            👋 Slap Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
