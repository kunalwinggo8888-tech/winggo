/**
 * CricketT20Game — WINGGO 3D Cricket Batting
 * Canvas 2D: ball tracking, timing-based shots, scoring system, stadium atmosphere.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const W = 360, H = 520;
const TOTAL_BALLS = 12;
const TARGET_SCORE = 60;

type ShotResult = "" | "1" | "2" | "4" | "6" | "OUT";

function MM({ fee, onStart }: { fee: number; onStart: () => void }) {
  const [cd, setCd] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 200); return 0; } return c - 1; }), 900);
    return () => clearInterval(t);
  }, [onStart]);
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{ background: "rgba(255,165,0,0.12)", border: "2px solid rgba(255,165,0,0.45)" }}
        animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>🏏</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Cricket T20</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Score {TARGET_SCORE}+ in {TOTAL_BALLS} balls!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,165,0,0.07)", border: "1px solid rgba(255,165,0,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(255,165,0,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function CricketT20Game({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [ballsDisp, setBallsDisp] = useState(TOTAL_BALLS);
  const [wicketsDisp, setWicketsDisp] = useState(0);
  const [won, setWon] = useState(false);
  const [lastShot, setLastShot] = useState<ShotResult>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("matchmaking");
  phaseRef.current = phase;
  const animRef = useRef<number>(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const gRef = useRef({
    score: 0, ballsLeft: TOTAL_BALLS, wickets: 0,
    ballX: W / 2, ballY: 40, ballR: 13,
    ballVX: 0, ballVY: 0,
    ballActive: false, ballPhase: "incoming" as "incoming" | "hit" | "idle",
    bowlTimer: 90,
    timingMeter: 0, timingDir: 1, meterSpeed: 2.8,
    batAngle: 0, batting: false,
    hitDisplay: "" as ShotResult, hitTimer: 0,
    particles: [] as { x: number; y: number; vx: number; vy: number; color: string; life: number }[],
    deliveryType: "normal" as "normal" | "fast" | "spin",
  });

  const startGame = useCallback(() => {
    const g = gRef.current;
    g.score = 0; g.ballsLeft = TOTAL_BALLS; g.wickets = 0;
    g.ballX = W / 2; g.ballY = 40; g.ballR = 13;
    g.ballVX = 0; g.ballVY = 0;
    g.ballActive = false; g.ballPhase = "idle"; g.bowlTimer = 60;
    g.timingMeter = 0; g.timingDir = 1; g.meterSpeed = 2.8;
    g.batAngle = 0; g.batting = false;
    g.hitDisplay = ""; g.hitTimer = 0; g.particles = [];
    setScoreDisp(0); setBallsDisp(TOTAL_BALLS); setWicketsDisp(0); setLastShot("");
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gRef.current;
    const CREASE_Y = H - 100;
    const BATSMAN_X = W / 2;

    function bowl() {
      g.deliveryType = Math.random() < 0.3 ? "fast" : Math.random() < 0.5 ? "spin" : "normal";
      const curve = g.deliveryType === "spin" ? (Math.random() - 0.5) * 3 : (Math.random() - 0.5) * 1.5;
      g.ballX = BATSMAN_X + (Math.random() - 0.5) * 60;
      g.ballY = 60; g.ballVX = curve * 0.3; g.ballVY = 5 + (g.deliveryType === "fast" ? 2 : 0);
      g.ballActive = true; g.ballPhase = "incoming";
      g.batting = true;
    }

    function spawnParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        g.particles.push({ x, y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10 - 3, color, life: 1 });
      }
    }

    function hit() {
      if (!g.ballActive || g.ballPhase !== "incoming") return;
      const timing = g.timingMeter;
      let runs: ShotResult = "1";
      let ptColor = "#fff";
      if (timing >= 38 && timing <= 62) { runs = "6"; ptColor = "#FFD700"; }
      else if (timing >= 28 && timing <= 72) { runs = "4"; ptColor = "#22c55e"; }
      else if (timing >= 18 && timing <= 82) { runs = "2"; ptColor = "#00e5ff"; }
      else if (timing >= 8 && timing <= 92) { runs = "1"; ptColor = "#fff"; }
      else { runs = "OUT"; ptColor = "#ef4444"; }

      g.hitDisplay = runs; g.hitTimer = 80;
      setLastShot(runs);

      if (runs === "OUT") {
        g.wickets++; setWicketsDisp(g.wickets);
        spawnParticles(BATSMAN_X, CREASE_Y, "#ef4444", 8);
        if (g.wickets >= 3) {
          g.ballActive = false; g.batting = false;
          const w = g.score >= TARGET_SCORE;
          setWon(w); if (w) addWinning(prize, `🏏 Cricket T20 — Won ₹${prize}`); setPhase("result"); return;
        }
      } else {
        const r = parseInt(runs);
        g.score += r; setScoreDisp(g.score);
        spawnParticles(BATSMAN_X, CREASE_Y - 30, ptColor, r * 4);
        // Ball flies away
        g.ballVY = -12; g.ballVX = (timing - 50) * 0.15;
        g.ballPhase = "hit";
      }

      g.batAngle = -40; setTimeout(() => { g.batAngle = 0; }, 300);
      g.ballsLeft--; setBallsDisp(g.ballsLeft);

      if (g.ballsLeft <= 0) {
        g.ballActive = false; g.batting = false;
        setTimeout(() => {
          const w = g.score >= TARGET_SCORE;
          setWon(w); if (w) addWinning(prize, `🏏 Cricket T20 — Won ₹${prize}`); setPhase("result");
        }, 500);
      } else {
        g.ballActive = false; g.batting = false;
        g.bowlTimer = 70;
      }
    }

    let animId: number;
    function loop() {
      if (phaseRef.current !== "playing") return;

      // Bowl timer
      if (!g.ballActive && g.ballsLeft > 0 && g.wickets < 3) {
        g.bowlTimer--;
        if (g.bowlTimer <= 0) bowl();
      }

      // Ball physics
      if (g.ballActive) {
        g.ballY += g.ballVY;
        if (g.ballPhase === "incoming") {
          g.ballVY += 0.08; // Pitch dip
          g.ballX += g.ballVX;
          // Bounce at pitch
          if (g.ballY >= H * 0.6) {
            g.ballVY = -(g.ballVY * 0.6);
            g.ballVX += (Math.random() - 0.5) * 0.5;
          }
          if (g.ballY > CREASE_Y + 20) { g.ballActive = false; g.batting = false; g.bowlTimer = 50; }
        } else if (g.ballPhase === "hit") {
          g.ballX += g.ballVX; g.ballVY += 0.25;
          if (g.ballY < -20 || g.ballY > H + 20) { g.ballActive = false; }
        }
      }

      // Timing meter
      if (g.batting) {
        g.timingMeter += g.meterSpeed * g.timingDir;
        if (g.timingMeter >= 100) { g.timingMeter = 100; g.timingDir = -1; }
        if (g.timingMeter <= 0) { g.timingMeter = 0; g.timingDir = 1; }
      }

      // Hit display
      if (g.hitTimer > 0) g.hitTimer--;

      // Particles
      for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.3; p.life -= 0.025;
        if (p.life <= 0) { g.particles.splice(i, 1); }
      }

      // DRAW
      ctx.clearRect(0, 0, W, H);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.5);
      sky.addColorStop(0, "#0d1b4b"); sky.addColorStop(1, "#1a3060");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H * 0.5);

      // Stadium lights
      ctx.fillStyle = "rgba(255,255,200,0.05)";
      [[40, 80], [W - 40, 80], [20, 200], [W - 20, 200]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.arc(x as number, y as number, 30, 0, Math.PI * 2); ctx.fill();
      });

      // Crowd silhouette
      ctx.fillStyle = "#1a2044";
      for (let i = 0; i < 40; i++) {
        const x = i * 9 + 4, baseY = H * 0.42;
        ctx.beginPath(); ctx.arc(x, baseY - (i % 3) * 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 4, baseY - (i % 3) * 3, 8, 12);
      }

      // Ground
      const ground = ctx.createLinearGradient(0, H * 0.45, 0, H);
      ground.addColorStop(0, "#2d6a1a"); ground.addColorStop(1, "#1a4a0e");
      ctx.fillStyle = ground; ctx.fillRect(0, H * 0.45, W, H);

      // Pitch
      const pitchGrad = ctx.createLinearGradient(0, H * 0.45, 0, H);
      pitchGrad.addColorStop(0, "#c8a870"); pitchGrad.addColorStop(1, "#a0845a");
      ctx.fillStyle = pitchGrad;
      ctx.beginPath(); ctx.moveTo(W / 2 - 30, H * 0.45); ctx.lineTo(W / 2 + 30, H * 0.45);
      ctx.lineTo(W / 2 + 18, H); ctx.lineTo(W / 2 - 18, H); ctx.closePath(); ctx.fill();

      // Crease
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(BATSMAN_X - 25, CREASE_Y); ctx.lineTo(BATSMAN_X + 25, CREASE_Y); ctx.stroke();

      // Stumps
      [BATSMAN_X - 8, BATSMAN_X, BATSMAN_X + 8].forEach(sx => {
        ctx.fillStyle = "#f0e0c0"; ctx.fillRect(sx - 2, CREASE_Y, 4, 25);
      });
      ctx.fillStyle = "#f0e0c0"; ctx.fillRect(BATSMAN_X - 10, CREASE_Y - 4, 20, 5);

      // Batsman
      ctx.fillStyle = "#1a40aa"; // Blue jersey
      ctx.beginPath(); ctx.arc(BATSMAN_X, CREASE_Y - 45, 12, 0, Math.PI * 2); ctx.fill(); // Head
      ctx.fillRect(BATSMAN_X - 10, CREASE_Y - 33, 20, 30); // Body
      // Bat
      ctx.save();
      ctx.translate(BATSMAN_X + 14, CREASE_Y - 22);
      ctx.rotate((g.batAngle * Math.PI) / 180);
      ctx.fillStyle = "#c8a830"; ctx.fillRect(-3, 0, 6, 28); // Handle
      ctx.fillStyle = "#e0c060"; ctx.fillRect(-6, 28, 14, 6); // Blade
      ctx.restore();

      // Wicketkeeper (bot end)
      ctx.fillStyle = "#44aa22";
      ctx.beginPath(); ctx.arc(W / 2 + 20, 180, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(W / 2 + 12, 188, 16, 22);

      // Ball
      if (g.ballActive) {
        const ballScale = 0.4 + (g.ballY / H) * 0.6;
        const br = g.ballR * ballScale;
        ctx.shadowColor = "#ff4444"; ctx.shadowBlur = 8;
        const bg2 = ctx.createRadialGradient(g.ballX - 2, g.ballY - 2, 1, g.ballX, g.ballY, br);
        bg2.addColorStop(0, "#ff8888"); bg2.addColorStop(1, "#cc0000");
        ctx.fillStyle = bg2;
        ctx.beginPath(); ctx.arc(g.ballX, g.ballY, br, 0, Math.PI * 2); ctx.fill();
        // Seam
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(g.ballX, g.ballY, br * 0.7, 0, Math.PI); ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Particles
      for (const p of g.particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // HIT display
      if (g.hitTimer > 0 && g.hitDisplay) {
        const alpha = Math.min(1, g.hitTimer / 20);
        const scale = 1 + (1 - g.hitTimer / 80) * 0.5;
        ctx.save();
        ctx.translate(W / 2, H * 0.35);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        const col = g.hitDisplay === "6" ? "#FFD700" : g.hitDisplay === "4" ? "#22c55e" : g.hitDisplay === "OUT" ? "#ef4444" : "#fff";
        ctx.fillStyle = col; ctx.font = `bold 52px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(g.hitDisplay === "OUT" ? "OUT!" : `${g.hitDisplay}${g.hitDisplay === "6" ? " 🎉" : ""}`, 0, 0);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // Timing meter (bottom)
      if (g.batting) {
        const MX = 28, MY = H - 32, MW = W - 56, MH = 20;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(MX, MY, MW, MH, 10); ctx.fill();
        // Zones
        ctx.fillStyle = "rgba(239,68,68,0.4)"; ctx.beginPath(); ctx.roundRect(MX, MY, MW * 0.2, MH, [10, 0, 0, 10]); ctx.fill();
        ctx.fillStyle = "rgba(255,215,0,0.4)"; ctx.beginPath(); ctx.roundRect(MX + MW * 0.2, MY, MW * 0.15, MH, 0); ctx.fill();
        ctx.fillStyle = "rgba(34,197,94,0.5)"; ctx.beginPath(); ctx.roundRect(MX + MW * 0.35, MY, MW * 0.3, MH, 0); ctx.fill();
        ctx.fillStyle = "rgba(255,215,0,0.4)"; ctx.beginPath(); ctx.roundRect(MX + MW * 0.65, MY, MW * 0.15, MH, 0); ctx.fill();
        ctx.fillStyle = "rgba(239,68,68,0.4)"; ctx.beginPath(); ctx.roundRect(MX + MW * 0.8, MY, MW * 0.2, MH, [0, 10, 10, 0]); ctx.fill();
        // Cursor
        const cursorX = MX + (g.timingMeter / 100) * MW;
        ctx.fillStyle = "#fff"; ctx.shadowColor = "#fff"; ctx.shadowBlur = 8;
        ctx.fillRect(cursorX - 3, MY - 4, 6, MH + 8); ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    animRef.current = animId;

    const onTap = () => { if (g.batting && g.ballPhase === "incoming") hit(); };
    canvas.addEventListener("click", onTap);
    canvas.addEventListener("touchstart", onTap, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("click", onTap);
      canvas.removeEventListener("touchstart", onTap);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() { setWon(false); setScoreDisp(0); setBallsDisp(TOTAL_BALLS); setWicketsDisp(0); setLastShot(""); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,165,0,0.2)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0d1b4b", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🏏</span><span className="font-black text-white text-base">Cricket T20</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>
      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>SCORE</div><div className="text-base font-black" style={{ color: "#FFD700" }}>{scoreDisp}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>TARGET</div><div className="text-sm font-bold" style={{ color: scoreDisp >= TARGET_SCORE ? "#22c55e" : "white" }}>{TARGET_SCORE}</div></div>
            <div className="flex gap-3">
              <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>BALLS</div><div className="text-sm font-black text-white">{ballsDisp}</div></div>
              <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(239,68,68,0.7)" }}>WKTS</div><div className="text-sm font-black" style={{ color: "#ef4444" }}>{wicketsDisp}/3</div></div>
            </div>
          </div>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, touchAction: "none", cursor: "pointer" }} />
          <div className="text-center text-xs font-bold py-1" style={{ color: "rgba(255,255,255,0.3)" }}>Tap when ball is in GREEN ZONE!</div>
        </div>
      )}
      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(255,165,0,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(255,165,0,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(255,165,0,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "🏏"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? "Century Star! 🎉" : "Bowled Out!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Final Score: {scoreDisp} / {TARGET_SCORE} to win</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,165,0,0.2)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(255,165,0,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#ff8c00,#FFD700)", color: "#000", boxShadow: "0 0 28px rgba(255,165,0,0.4)" }}>
            🏏 Bat Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
