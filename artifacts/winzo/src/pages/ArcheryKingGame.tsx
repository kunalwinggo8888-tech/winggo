/**
 * Archery: King of Target — WINGGO
 * Canvas 2D. 3 rounds, 3 arrows each. Wind system. Highest score vs bot.
 * Drag to aim; release to fire. Arrow arc physics.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 520;
const TARGET_X = W / 2, TARGET_Y = 170;
const TARGET_RINGS = [{ r: 14, pts: 10, color: "#FFD700" }, { r: 28, pts: 8, color: "#ef4444" }, { r: 44, pts: 6, color: "#3b82f6" }, { r: 62, pts: 4, color: "#000000" }, { r: 80, pts: 2, color: "#ffffff" }];
const ARCHER_X = W / 2, ARCHER_Y = H - 60;
const TOTAL_ROUNDS = 3, ARROWS_PER_ROUND = 3;

interface ArrowFlight { x: number; y: number; vx: number; vy: number; alive: boolean; scored: boolean }
interface ArrowOnTarget { x: number; y: number; pts: number }
interface WindIndicator { dx: number; dy: number }

function computeScore(hitX: number, hitY: number): number {
  const dist = Math.sqrt((hitX - TARGET_X) ** 2 + (hitY - TARGET_Y) ** 2);
  for (const ring of TARGET_RINGS) {
    if (dist <= ring.r) return ring.pts;
  }
  return 0;
}

function getBotArrowScore(difficulty: ReturnType<typeof getBotDifficulty>): number {
  if (difficulty.level === "God Mode") return 10;
  if (difficulty.level === "Pro") return 6 + Math.floor(Math.random() * 3);
  return 2 + Math.floor(Math.random() * 5);
}

export default function ArcheryKingGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    arrow: null as ArrowFlight | null,
    arrowsOnTarget: [] as ArrowOnTarget[],
    wind: { dx: 0, dy: 0 } as WindIndicator,
    score: 0, botScore: 0,
    round: 1, arrowCount: 0,
    aimX: TARGET_X, aimY: TARGET_Y,
    aiming: false, charging: false,
    power: 0,
    shakeX: 0, shakeY: 0,
    shake: 0,
    scorePopups: [] as { x: number; y: number; pts: number; life: number }[],
    frame: 0,
    running: false,
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [botScoreState, setBotScoreState] = useState(0);
  const [won, setWon] = useState(false);
  const [round, setRound] = useState(1);
  const [arrows, setArrows] = useState(ARROWS_PER_ROUND);
  const [windDisplay, setWindDisplay] = useState({ dx: 0, dy: 0 });

  function newRound(r: number) {
    const s = stateRef.current;
    s.round = r;
    s.arrowCount = 0;
    s.arrowsOnTarget = [];
    s.wind = { dx: (Math.random() - 0.5) * 0.12, dy: (Math.random() - 0.5) * 0.04 };
    setWindDisplay({ ...s.wind });
    setRound(r);
    setArrows(ARROWS_PER_ROUND);
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    s.score = 0; s.botScore = 0; s.frame = 0; s.running = true;
    s.arrowsOnTarget = []; s.scorePopups = [];
    newRound(1);
    setScore(0); setBotScoreState(0);

    function getPos(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
    }

    function onPointerDown(e: PointerEvent) {
      if (s.arrow || s.arrowCount >= ARROWS_PER_ROUND) return;
      const { x, y } = getPos(e);
      s.aimX = x; s.aimY = y; s.aiming = true; s.charging = true; s.power = 0;
    }
    function onPointerMove(e: PointerEvent) {
      if (!s.aiming) return;
      const { x, y } = getPos(e);
      s.aimX = x; s.aimY = y;
    }
    function onPointerUp() {
      if (!s.aiming || !s.charging) { s.aiming = false; return; }
      s.aiming = false; s.charging = false;
      if (s.arrowCount >= ARROWS_PER_ROUND) return;
      const dx = TARGET_X - s.aimX, dy = TARGET_Y - s.aimY;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const power = Math.min(s.power, 1);
      // Add wind deviation
      const windDeviation = { x: s.wind.dx * 60, y: s.wind.dy * 60 };
      s.arrow = {
        x: ARCHER_X, y: ARCHER_Y,
        vx: (dx / len) * power * 18 + windDeviation.x,
        vy: (dy / len) * power * 18 + windDeviation.y,
        alive: true, scored: false,
      };
      s.power = 0;
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    function loop() {
      if (!s.running) return;
      s.frame++;

      // Charge power
      if (s.charging) { s.power = Math.min(1, s.power + 0.018); }

      // Camera handshake effect
      s.shake *= 0.88;
      s.shakeX = (Math.random() - 0.5) * s.shake;
      s.shakeY = (Math.random() - 0.5) * s.shake;

      // Move arrow
      if (s.arrow?.alive) {
        s.arrow.x += s.arrow.vx;
        s.arrow.y += s.arrow.vy;
        s.arrow.vy += 0.08; // gravity

        // Hit target zone
        const dist = Math.sqrt((s.arrow.x - TARGET_X) ** 2 + (s.arrow.y - TARGET_Y) ** 2);
        if (dist < 85 && !s.arrow.scored) {
          s.arrow.alive = false; s.arrow.scored = true;
          const pts = computeScore(s.arrow.x, s.arrow.y);
          s.arrowsOnTarget.push({ x: s.arrow.x, y: s.arrow.y, pts });
          s.scorePopups.push({ x: s.arrow.x, y: s.arrow.y, pts, life: 60 });
          s.score += pts;
          s.shake = 6;
          s.arrowCount++;
          // Bot shot
          const botPts = getBotArrowScore(difficulty);
          s.botScore += botPts;
          setScore(s.score);
          setBotScoreState(s.botScore);
          setArrows(ARROWS_PER_ROUND - s.arrowCount);

          if (s.arrowCount >= ARROWS_PER_ROUND) {
            // End of round
            if (s.round < TOTAL_ROUNDS) {
              setTimeout(() => { newRound(s.round + 1); }, 1500);
            } else {
              const playerWins = s.score > s.botScore;
              setWon(playerWins);
              if (playerWins) addWinning(prize, "Archery King Win");
              setTimeout(() => { s.running = false; setPhase("result"); }, 1500);
            }
          }
        }

        // Miss (off-screen)
        if (s.arrow.y < -20 || s.arrow.y > H + 20 || s.arrow.x < -20 || s.arrow.x > W + 20) {
          s.arrow.alive = false;
          s.arrowCount++;
          setArrows(ARROWS_PER_ROUND - s.arrowCount);
          if (s.arrowCount >= ARROWS_PER_ROUND) {
            if (s.round < TOTAL_ROUNDS) setTimeout(() => { newRound(s.round + 1); }, 1500);
            else {
              const playerWins = s.score > s.botScore;
              setWon(playerWins);
              if (playerWins) addWinning(prize, "Archery King Win");
              setTimeout(() => { s.running = false; setPhase("result"); }, 1500);
            }
          }
        }
      }

      for (const sp of s.scorePopups) sp.life--;
      s.scorePopups = s.scorePopups.filter((sp) => sp.life > 0);

      // ── DRAW ──────────────────────────────────────────────────
      ctx.save();
      ctx.translate(s.shakeX, s.shakeY);

      // Sky gradient
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#0a0a1f");
      sky.addColorStop(0.6, "#1a0a2e");
      sky.addColorStop(1, "#0a1505");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (let i = 0; i < 50; i++) {
        const sx = (i * 97) % W, sy = (i * 137) % (H * 0.5);
        ctx.fillStyle = `rgba(255,255,255,${0.3 + (i % 4) * 0.15})`;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Ground
      ctx.fillStyle = "#1a3a0a";
      ctx.fillRect(0, H - 80, W, 80);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(0, H - 82, W, 4);

      // Target board (3D perspective)
      // Board stand
      ctx.fillStyle = "#5c3a1e";
      ctx.beginPath(); ctx.roundRect(TARGET_X - 4, TARGET_Y + 60, 8, 80, 2); ctx.fill();
      ctx.fillRect(TARGET_X - 30, TARGET_Y + 135, 60, 8);

      // Target rings (outer to inner)
      for (let ri = TARGET_RINGS.length - 1; ri >= 0; ri--) {
        const ring = TARGET_RINGS[ri];
        ctx.beginPath(); ctx.arc(TARGET_X, TARGET_Y, ring.r, 0, Math.PI * 2);
        ctx.fillStyle = ring.color;
        ctx.shadowColor = ring.color === "#FFD700" ? "#FFD700" : "transparent";
        ctx.shadowBlur = ring.color === "#FFD700" ? 15 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Target crosshairs
      ctx.strokeStyle = "rgba(255,255,255,0.15)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(TARGET_X - 85, TARGET_Y); ctx.lineTo(TARGET_X + 85, TARGET_Y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(TARGET_X, TARGET_Y - 85); ctx.lineTo(TARGET_X, TARGET_Y + 85); ctx.stroke();
      ctx.setLineDash([]);

      // Arrows on target
      for (const a of s.arrowsOnTarget) {
        ctx.fillStyle = "#8B4513";
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(-0.2);
        ctx.fillRect(-2, -12, 4, 18);
        ctx.fillStyle = "#888";
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(-3, -10); ctx.lineTo(3, -10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Score popups
      for (const sp of s.scorePopups) {
        ctx.globalAlpha = sp.life / 60;
        ctx.fillStyle = sp.pts >= 8 ? "#FFD700" : sp.pts >= 6 ? "#22c55e" : "#fff";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 10;
        ctx.font = "bold 20px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`+${sp.pts}`, sp.x, sp.y - (60 - sp.life) * 0.4);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Archer silhouette
      ctx.fillStyle = "#000";
      // Body
      ctx.beginPath(); ctx.ellipse(ARCHER_X - 15, ARCHER_Y - 30, 10, 20, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(ARCHER_X - 12, ARCHER_Y - 55, 12, 0, Math.PI * 2); ctx.fill();
      // Bow
      ctx.strokeStyle = "#8B4513";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(ARCHER_X - 8, ARCHER_Y - 30, 28, -Math.PI / 3, Math.PI / 3); ctx.stroke();
      // String
      ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ARCHER_X - 8 + 14, ARCHER_Y - 30 - 24); ctx.lineTo(ARCHER_X - 8 + 14, ARCHER_Y - 30 + 24); ctx.stroke();

      // Aim indicator
      if (s.aiming) {
        const power = s.power;
        ctx.setLineDash([8, 6]);
        ctx.strokeStyle = `rgba(255,${Math.round(255 * (1 - power))},0,0.7)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Curved trajectory preview
        let tx = ARCHER_X, ty = ARCHER_Y;
        const dx2 = TARGET_X - s.aimX, dy2 = TARGET_Y - s.aimY;
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
        const vx2 = (dx2 / len2) * power * 18 + s.wind.dx * 60;
        const vy2 = (dy2 / len2) * power * 18 + s.wind.dy * 60;
        ctx.moveTo(tx, ty);
        for (let t = 0; t < 20; t++) {
          tx += vx2 * 0.4; ty += vy2 * 0.4 + 0.08 * t * 0.4;
          ctx.lineTo(tx, ty);
          if (tx < 0 || tx > W || ty < 0) break;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // Aim reticle
        ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 1.5;
        ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(s.aimX, s.aimY, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        // Power bar
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath(); ctx.roundRect(W / 2 - 50, H - 30, 100, 12, 6); ctx.fill();
        ctx.fillStyle = power > 0.7 ? "#ef4444" : power > 0.4 ? "#fbbf24" : "#22c55e";
        ctx.beginPath(); ctx.roundRect(W / 2 - 50, H - 30, power * 100, 12, 6); ctx.fill();
      }

      // In-flight arrow
      if (s.arrow?.alive) {
        const angle = Math.atan2(s.arrow.vy, s.arrow.vx);
        ctx.save(); ctx.translate(s.arrow.x, s.arrow.y); ctx.rotate(angle);
        // Neon trail
        ctx.strokeStyle = "#00ffff"; ctx.shadowColor = "#00ffff"; ctx.shadowBlur = 12;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(0, 0); ctx.stroke();
        ctx.shadowBlur = 0;
        // Arrow body
        ctx.fillStyle = "#8B4513";
        ctx.fillRect(-18, -2, 20, 4);
        ctx.fillStyle = "#888";
        ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-1, -4); ctx.lineTo(-1, 4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }

      // Wind indicator
      if (Math.abs(s.wind.dx) > 0.005 || Math.abs(s.wind.dy) > 0.005) {
        const speed = Math.sqrt(s.wind.dx ** 2 + s.wind.dy ** 2);
        const angle = Math.atan2(s.wind.dy, s.wind.dx);
        ctx.save(); ctx.translate(W - 50, 60);
        ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2; ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * speed * 200, Math.sin(angle) * speed * 200); ctx.stroke();
        ctx.shadowBlur = 0; ctx.restore();
        ctx.fillStyle = "#fbbf24"; ctx.font = "10px sans-serif"; ctx.textAlign = "right";
        ctx.fillText("🌬️ WIND", W - 20, 46);
      }

      ctx.restore();

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [phase, addWinning, difficulty, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex flex-col" style={{ background: "#0a0a1f", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🏹 Archery King</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>
      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="text-white font-black">Round {round}/{TOTAL_ROUNDS} · {arrows} arrows left</div>
          <div className="flex gap-3">
            <span style={{ color: "#22c55e" }}>You: <b>{score}</b></span>
            <span style={{ color: difficulty.color }}>Bot: <b>{botScoreState}</b></span>
          </div>
        </div>
      )}
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", touchAction: "none" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(10,10,31,0.93)" }}>
              <div className="text-7xl">🏹</div>
              <div className="text-white font-black text-3xl">Archery King</div>
              <div className="text-zinc-400 text-sm text-center px-8">3 rounds, 3 arrows each. Outscore the bot. Watch the wind!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} <b>{difficulty.level}</b> bot · Wind changes each round
              </div>
              <div className="text-zinc-400 text-xs px-8 text-center">Drag the aim reticle over the target · Hold longer = more power</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                DRAW! 🏹
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(10,10,31,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "🎯"}</div>
              <div className="text-white font-black text-3xl">{won ? "Bullseye!" : "Bot Wins!"}</div>
              <div className="w-full rounded-2xl px-5 py-4 flex justify-between" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div><div className="text-zinc-400 text-xs">Your Score</div><div className="text-white font-black text-2xl">{score}</div></div>
                <div className="text-right"><div className="text-zinc-400 text-xs">Bot Score</div><div className="text-zinc-300 font-black text-2xl">{botScoreState}</div></div>
              </div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setScore(0); setBotScoreState(0); setRound(1); setArrows(3); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Play Again</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
