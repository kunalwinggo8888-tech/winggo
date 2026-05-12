/**
 * Pool3DGame — WINGGO 8-Ball Pool
 * Canvas 2D: cue aiming, realistic ball physics, wall bouncing, pocket detection, bot opponent.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const W = 360, H = 500;
const TBL = { x: 28, y: 70, w: 304, h: 360 };
const BALL_R = 11;
const FRICTION = 0.975;
const POCKET_R = 17;

const POCKETS = [
  { x: TBL.x + POCKET_R, y: TBL.y + POCKET_R },
  { x: TBL.x + TBL.w / 2, y: TBL.y + POCKET_R - 2 },
  { x: TBL.x + TBL.w - POCKET_R, y: TBL.y + POCKET_R },
  { x: TBL.x + POCKET_R, y: TBL.y + TBL.h - POCKET_R },
  { x: TBL.x + TBL.w / 2, y: TBL.y + TBL.h - POCKET_R + 2 },
  { x: TBL.x + TBL.w - POCKET_R, y: TBL.y + TBL.h - POCKET_R },
];

const BALL_COLORS = ["#ffffff", "#fbbf24", "#3b82f6", "#ef4444", "#7c3aed", "#f97316", "#16a34a", "#dc2626", "#1f2937",
  "#ca8a04", "#1d4ed8", "#b91c1c", "#6d28d9", "#c2410c", "#15803d", "#991b1b", "#111827"];

interface Ball { id: number; x: number; y: number; vx: number; vy: number; pocketed: boolean; color: string; isEight: boolean; solid: boolean }

function makeBalls(): Ball[] {
  const balls: Ball[] = [];
  // Cue ball
  balls.push({ id: 0, x: TBL.x + TBL.w * 0.28, y: TBL.y + TBL.h / 2, vx: 0, vy: 0, pocketed: false, color: "#ffffff", isEight: false, solid: false });
  // Rack
  const cx = TBL.x + TBL.w * 0.68, cy = TBL.y + TBL.h / 2;
  const positions: { x: number; y: number }[] = [];
  const sp = BALL_R * 2.05;
  let id = 1;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= row; col++) {
      positions.push({ x: cx + row * sp * 0.87, y: cy + (col - row / 2) * sp });
    }
  }
  // Shuffle non-8 ball positions
  const solids = [1,2,3,4,5,6,7], stripes = [9,10,11,12,13,14,15];
  const nums = [...solids, 8, ...stripes];
  positions.forEach((p, i) => {
    const n = nums[i] ?? i + 1;
    balls.push({ id: id++, x: p.x, y: p.y, vx: 0, vy: 0, pocketed: false, color: BALL_COLORS[n] ?? "#888", isEight: n === 8, solid: n <= 7 });
  });
  return balls;
}

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
        style={{ background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.4)" }}
        animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>🎱</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Pool 3D Master</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Pocket all your balls + 8-ball to win!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.25)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(34,197,94,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function Pool3DGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [scoreDisp, setScoreDisp] = useState(0);
  const [won, setWon] = useState(false);
  const [turn, setTurn] = useState<"player" | "bot">("player");
  const [msg, setMsg] = useState("Aim and shoot!");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("matchmaking");
  phaseRef.current = phase;
  const animRef = useRef<number>(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const gRef = useRef({
    balls: makeBalls(),
    aim: { x: 0, y: 0 },
    aimActive: false,
    shooting: false,
    power: 0,
    powerDir: 1,
    playerSolid: null as boolean | null,
    score: 0,
    turn: "player" as "player" | "bot",
    botTimer: 0,
    status: "Aim and shoot!",
  });

  const startGame = useCallback(() => {
    const g = gRef.current;
    g.balls = makeBalls(); g.aim = { x: 0, y: 0 }; g.aimActive = false;
    g.shooting = false; g.power = 0; g.powerDir = 1;
    g.playerSolid = null; g.score = 0; g.turn = "player"; g.botTimer = 0;
    g.status = "Aim and shoot!";
    setScoreDisp(0); setTurn("player"); setMsg("Aim and shoot!");
    setPhase("playing");
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gRef.current;

    function ballsMoving() { return g.balls.some(b => !b.pocketed && (Math.abs(b.vx) > 0.02 || Math.abs(b.vy) > 0.02)); }

    function shoot(power: number) {
      const cue = g.balls[0];
      const dx = g.aim.x - cue.x, dy = g.aim.y - cue.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = power * 14;
      cue.vx = (dx / d) * force; cue.vy = (dy / d) * force;
    }

    function botShoot() {
      // Bot aims at random ball (not 8 if not ready) then randomly toward a pocket
      const targets = g.balls.filter(b => !b.pocketed && !b.isEight && b.id !== 0);
      if (targets.length === 0) return;
      const target = targets[Math.floor(Math.random() * targets.length)];
      const pocket = POCKETS[Math.floor(Math.random() * POCKETS.length)];
      const cue = g.balls[0];
      // Aim: direction from cue through target toward pocket
      const tx = target.x - (pocket.x - target.x) * 0.3;
      const ty = target.y - (pocket.y - target.y) * 0.3;
      g.aim = { x: tx, y: ty };
      shoot(0.4 + Math.random() * 0.4);
      g.turn = "player"; setTurn("player");
    }

    let animId: number;
    function loop() {
      if (phaseRef.current !== "playing") return;

      // Physics
      for (const b of g.balls) {
        if (b.pocketed) continue;
        b.vx *= FRICTION; b.vy *= FRICTION;
        if (Math.abs(b.vx) < 0.02) b.vx = 0;
        if (Math.abs(b.vy) < 0.02) b.vy = 0;
        b.x += b.vx; b.y += b.vy;

        // Wall bounce
        if (b.x - BALL_R < TBL.x) { b.x = TBL.x + BALL_R; b.vx = Math.abs(b.vx); }
        if (b.x + BALL_R > TBL.x + TBL.w) { b.x = TBL.x + TBL.w - BALL_R; b.vx = -Math.abs(b.vx); }
        if (b.y - BALL_R < TBL.y) { b.y = TBL.y + BALL_R; b.vy = Math.abs(b.vy); }
        if (b.y + BALL_R > TBL.y + TBL.h) { b.y = TBL.y + TBL.h - BALL_R; b.vy = -Math.abs(b.vy); }

        // Pocket check
        for (const p of POCKETS) {
          const dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy < POCKET_R * POCKET_R) {
            b.pocketed = true; b.vx = 0; b.vy = 0;
            if (b.isEight) {
              // Pocket 8-ball: player wins if their balls are done
              const playerBalls = g.balls.filter(bb => !bb.pocketed && !bb.isEight && bb.id !== 0 && (g.playerSolid === null || bb.solid === g.playerSolid));
              if (playerBalls.length === 0 && g.turn === "player") {
                setWon(true); addWinning(prize, `🎱 Pool 3D — Won ₹${prize}`); setPhase("result"); return;
              } else { setWon(false); setPhase("result"); return; }
            } else if (b.id === 0) {
              // Scratch: reset cue ball
              b.pocketed = false; b.x = TBL.x + TBL.w * 0.28; b.y = TBL.y + TBL.h / 2; b.vx = 0; b.vy = 0;
            } else {
              if (g.playerSolid === null && g.turn === "player") g.playerSolid = b.solid;
              if (g.turn === "player") { g.score += 10; setScoreDisp(g.score); }
            }
          }
        }
      }

      // Ball-ball collisions
      for (let i = 0; i < g.balls.length; i++) {
        for (let j = i + 1; j < g.balls.length; j++) {
          const a = g.balls[i], b = g.balls[j];
          if (a.pocketed || b.pocketed) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < (BALL_R * 2) * (BALL_R * 2) && d2 > 0) {
            const d = Math.sqrt(d2);
            const nx = dx / d, ny = dy / d;
            const overlap = BALL_R * 2 - d;
            a.x -= nx * overlap / 2; a.y -= ny * overlap / 2;
            b.x += nx * overlap / 2; b.y += ny * overlap / 2;
            const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rv < 0) {
              a.vx += rv * nx; a.vy += rv * ny;
              b.vx -= rv * nx; b.vy -= rv * ny;
            }
          }
        }
      }

      // Turn logic
      if (!ballsMoving() && g.turn === "bot") {
        g.botTimer--;
        if (g.botTimer <= 0) { botShoot(); g.botTimer = 90; }
      }

      // Power meter
      if (g.shooting) {
        g.power += g.powerDir * 0.012;
        if (g.power >= 1) { g.power = 1; g.powerDir = -1; }
        if (g.power <= 0) { g.power = 0; g.powerDir = 1; }
      }

      // --- DRAW ---
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = "#0e1a0e"; ctx.fillRect(0, 0, W, H);

      // Table felt
      const feltGrad = ctx.createRadialGradient(TBL.x + TBL.w / 2, TBL.y + TBL.h / 2, 10, TBL.x + TBL.w / 2, TBL.y + TBL.h / 2, 220);
      feltGrad.addColorStop(0, "#1a6b1a"); feltGrad.addColorStop(1, "#0f4a0f");
      ctx.fillStyle = feltGrad; ctx.fillRect(TBL.x, TBL.y, TBL.w, TBL.h);

      // Table border
      ctx.fillStyle = "#5c3d1e"; ctx.fillRect(TBL.x - 16, TBL.y - 16, TBL.w + 32, TBL.h + 32);
      ctx.fillStyle = feltGrad; ctx.fillRect(TBL.x, TBL.y, TBL.w, TBL.h);

      // Center line & spots
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(TBL.x + TBL.w / 2, TBL.y); ctx.lineTo(TBL.x + TBL.w / 2, TBL.y + TBL.h); ctx.stroke();

      // Pockets
      for (const p of POCKETS) {
        ctx.fillStyle = "#000"; ctx.shadowColor = "transparent";
        ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(139,90,43,0.8)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_R, 0, Math.PI * 2); ctx.stroke();
      }

      // Aim line
      const cue = g.balls[0];
      if (!cue.pocketed && g.aimActive && g.turn === "player" && !ballsMoving()) {
        const dx = g.aim.x - cue.x, dy = g.aim.y - cue.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = dx / d, ny = dy / d;
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(cue.x, cue.y); ctx.lineTo(cue.x + nx * 120, cue.y + ny * 120); ctx.stroke(); ctx.setLineDash([]);
        // Cue stick
        ctx.strokeStyle = "#b5860c"; ctx.lineWidth = 4; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cue.x - nx * 18, cue.y - ny * 18); ctx.lineTo(cue.x - nx * 70, cue.y - ny * 70); ctx.stroke();
      }

      // Balls
      for (const b of g.balls) {
        if (b.pocketed) continue;
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(b.x + 2, b.y + 3, BALL_R, BALL_R * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        // Ball
        const grad = ctx.createRadialGradient(b.x - 3, b.y - 4, 1, b.x, b.y, BALL_R);
        grad.addColorStop(0, "#fff");
        grad.addColorStop(0.3, b.color);
        grad.addColorStop(1, b.id === 0 ? "#ccc" : "#000");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(b.x, b.y, BALL_R, 0, Math.PI * 2); ctx.fill();
        if (b.isEight) {
          ctx.fillStyle = "#fff"; ctx.font = "8px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText("8", b.x, b.y);
        }
        // Stripe balls
        if (!b.solid && !b.isEight && b.id !== 0) {
          ctx.save(); ctx.clip(); ctx.fillStyle = "#fff";
          ctx.fillRect(b.x - BALL_R, b.y - BALL_R * 0.35, BALL_R * 2, BALL_R * 0.7); ctx.restore();
        }
      }

      // Power meter
      if (g.shooting) {
        const MX = 28, MY = H - 28, MW = W - 56;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.beginPath(); ctx.roundRect(MX, MY - 8, MW, 16, 8); ctx.fill();
        const col = g.power > 0.7 ? "#ef4444" : g.power > 0.4 ? "#FFD700" : "#22c55e";
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(MX, MY - 8, MW * g.power, 16, 8); ctx.fill();
        ctx.fillStyle = "white"; ctx.font = "bold 9px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`POWER ${Math.floor(g.power * 100)}%`, W / 2, MY);
      }

      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    animRef.current = animId;

    // Controls
    const getXY = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width, scaleY = H / rect.height;
      if ("touches" in e) return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
      return { x: ((e as MouseEvent).clientX - rect.left) * scaleX, y: ((e as MouseEvent).clientY - rect.top) * scaleY };
    };

    const onDown = (e: MouseEvent | TouchEvent) => {
      if (g.turn !== "player" || ballsMoving()) return;
      const { x, y } = getXY(e);
      g.aim = { x, y }; g.aimActive = true; g.shooting = true;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!g.aimActive) return;
      const { x, y } = getXY(e);
      g.aim = { x, y };
    };
    const onUp = () => {
      if (!g.aimActive || !g.shooting) return;
      shoot(g.power);
      g.aimActive = false; g.shooting = false; g.power = 0;
      g.turn = "bot"; setTurn("bot"); g.botTimer = 80;
    };

    canvas.addEventListener("mousedown", onDown as (e: Event) => void);
    canvas.addEventListener("mousemove", onMove as (e: Event) => void);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", onDown as (e: Event) => void, { passive: true });
    canvas.addEventListener("touchmove", onMove as (e: Event) => void, { passive: true });
    canvas.addEventListener("touchend", onUp);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown", onDown as (e: Event) => void);
      canvas.removeEventListener("mousemove", onMove as (e: Event) => void);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onDown as (e: Event) => void);
      canvas.removeEventListener("touchmove", onMove as (e: Event) => void);
      canvas.removeEventListener("touchend", onUp);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() { setWon(false); setScoreDisp(0); setTurn("player"); setMsg("Aim and shoot!"); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(14,26,14,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(34,197,94,0.15)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0e1a0e", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🎱</span><span className="font-black text-white text-base">Pool 3D Master</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>
      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col">
          <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(0,0,0,0.6)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.7)" }}>SCORE</div><div className="text-sm font-black" style={{ color: "#22c55e" }}>{scoreDisp}</div></div>
            <div className="text-sm font-bold" style={{ color: turn === "player" ? "#FFD700" : "#ef4444" }}>
              {turn === "player" ? "🎱 Your Turn" : "🤖 Bot thinking..."}
            </div>
            <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Hold & release</div>
          </div>
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, touchAction: "none", cursor: "crosshair" }} />
        </div>
      )}
      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(34,197,94,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#22c55e" : "#ef4444" }}>{won ? "8-Ball Champion! 🎉" : "Potted Early!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Score: {scoreDisp}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(34,197,94,0.2)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#22c55e" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#22c55e,#166534)", color: "#fff", boxShadow: "0 0 28px rgba(34,197,94,0.4)" }}>
            🎱 Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
