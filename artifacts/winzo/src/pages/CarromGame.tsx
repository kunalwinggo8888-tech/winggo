/**
 * CarromGame — WINGGO Premium Carrom Board
 * Full canvas physics: elastic collisions, friction, pockets, bot AI, wallet.
 */
import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const BS = 340;          // board size (internal canvas px)
const CR = 12;           // coin radius
const SR = 17;           // striker radius
const PR = 27;           // pocket detection radius
const FRICT = 0.984;     // per-frame friction multiplier
const MIN_V = 0.06;      // velocity snap-to-zero threshold
const MAX_SPEED = 17;    // max striker launch speed
const PLATFORM_PCT = 0.10;
const WIN_TARGET = 9;    // coins to pocket to win

// Corner pocket positions
const POCKETS = [
  { x: 22, y: 22 },
  { x: BS - 22, y: 22 },
  { x: 22, y: BS - 22 },
  { x: BS - 22, y: BS - 22 },
] as const;

const P1_BASE_Y = BS - 46;  // player (human) baseline Y
const P2_BASE_Y = 46;        // bot baseline Y
const BASE_X_MIN = 62;
const BASE_X_MAX = BS - 62;

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface Disc { x: number; y: number; vx: number; vy: number; r: number }

interface Coin extends Disc {
  id: number;
  kind: "w" | "b" | "q";   // white | black | queen
  pocketed: boolean;
}

interface Striker extends Disc { active: boolean }

interface GState {
  coins: Coin[];
  striker: Striker;
  turn: 0 | 1;
  scores: [number, number];
  phase: "aiming" | "moving" | "bot_thinking";
  strikerFoul: boolean;   // striker went in pocket
}

// ─── COIN INIT ────────────────────────────────────────────────────────────────

function initCoins(): Coin[] {
  const cx = BS / 2, cy = BS / 2;
  const coins: Coin[] = [];
  let id = 0;

  // Queen at center
  coins.push({ id: id++, x: cx, y: cy, vx: 0, vy: 0, r: CR, kind: "q", pocketed: false });

  // Inner ring — 6 coins
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI * 2) / 6;
    coins.push({ id: id++, x: cx + Math.cos(a) * 44, y: cy + Math.sin(a) * 44, vx: 0, vy: 0, r: CR, kind: i % 2 === 0 ? "b" : "w", pocketed: false });
  }

  // Outer ring — 12 coins
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    coins.push({ id: id++, x: cx + Math.cos(a) * 88, y: cy + Math.sin(a) * 88, vx: 0, vy: 0, r: CR, kind: i % 2 === 0 ? "w" : "b", pocketed: false });
  }

  return coins;
}

function makeStriker(turn: 0 | 1, xPos = BS / 2): Striker {
  return {
    x: xPos,
    y: turn === 0 ? P1_BASE_Y : P2_BASE_Y,
    vx: 0, vy: 0,
    r: SR,
    active: false,
  };
}

// ─── PHYSICS ──────────────────────────────────────────────────────────────────

function stepPhysics(coins: Coin[], striker: Striker): Coin[] {
  const all: Disc[] = [striker, ...coins.filter(c => !c.pocketed)];

  // Move + friction + wall bounce
  all.forEach(d => {
    d.x += d.vx; d.y += d.vy;
    d.vx *= FRICT; d.vy *= FRICT;
    if (Math.abs(d.vx) < MIN_V) d.vx = 0;
    if (Math.abs(d.vy) < MIN_V) d.vy = 0;
    // Wall bounce (inner playing area border at 36px)
    const pad = 4;
    if (d.x < d.r + pad) { d.x = d.r + pad; d.vx = Math.abs(d.vx) * 0.72; }
    if (d.x > BS - d.r - pad) { d.x = BS - d.r - pad; d.vx = -Math.abs(d.vx) * 0.72; }
    if (d.y < d.r + pad) { d.y = d.r + pad; d.vy = Math.abs(d.vy) * 0.72; }
    if (d.y > BS - d.r - pad) { d.y = BS - d.r - pad; d.vy = -Math.abs(d.vy) * 0.72; }
  });

  // Circle-circle elastic collisions (3 stability passes)
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 0.001) continue;
        const dist = Math.sqrt(d2);
        const nx = dx / dist, ny = dy / dist;
        // Separate overlapping discs
        const over = (minD - dist) * 0.52;
        a.x -= nx * over; a.y -= ny * over;
        b.x += nx * over; b.y += ny * over;
        // Elastic collision response (equal mass)
        const dvx = b.vx - a.vx, dvy = b.vy - a.vy;
        const dot = dvx * nx + dvy * ny;
        if (dot > 0) continue; // already separating
        a.vx += dot * nx; a.vy += dot * ny;
        b.vx -= dot * nx; b.vy -= dot * ny;
      }
    }
  }

  // Pocket detection for coins
  const newlyPocketed: Coin[] = [];
  coins.forEach(c => {
    if (c.pocketed) return;
    for (const p of POCKETS) {
      const dx = c.x - p.x, dy = c.y - p.y;
      if (dx * dx + dy * dy < PR * PR) {
        c.pocketed = true; c.vx = 0; c.vy = 0;
        newlyPocketed.push(c);
        break;
      }
    }
  });

  // Striker pocket check → foul
  for (const p of POCKETS) {
    const dx = striker.x - p.x, dy = striker.y - p.y;
    if (dx * dx + dy * dy < PR * PR) {
      striker.x = BS / 2;
      striker.y = striker.y < BS / 2 ? P2_BASE_Y : P1_BASE_Y;
      striker.vx = 0; striker.vy = 0;
      break;
    }
  }

  return newlyPocketed;
}

function isMoving(coins: Coin[], striker: Striker): boolean {
  if (striker.vx !== 0 || striker.vy !== 0) return true;
  return coins.some(c => !c.pocketed && (c.vx !== 0 || c.vy !== 0));
}

// ─── BOT AI ───────────────────────────────────────────────────────────────────

function getBotShot(state: GState): { vx: number; vy: number } {
  const active = state.coins.filter(c => !c.pocketed);
  if (!active.length) return { vx: 0, vy: MAX_SPEED * 0.5 }; // aim down

  const sx = state.striker.x, sy = state.striker.y;

  let bestScore = Infinity;
  let bestAngle = Math.PI / 2;

  active.forEach(coin => {
    POCKETS.forEach(pocket => {
      const coinToPocketDist = Math.hypot(coin.x - pocket.x, coin.y - pocket.y);
      // Aim at coin from striker position
      const angle = Math.atan2(coin.y - sy, coin.x - sx);
      const strikerToCoinDist = Math.hypot(coin.x - sx, coin.y - sy);
      const score = strikerToCoinDist + coinToPocketDist * 0.7;
      if (score < bestScore) {
        bestScore = score;
        bestAngle = angle;
      }
    });
  });

  // Add slight randomness to bot accuracy
  bestAngle += (Math.random() - 0.5) * 0.28;
  const speed = MAX_SPEED * (0.4 + Math.random() * 0.5);

  return {
    vx: Math.cos(bestAngle) * speed,
    vy: Math.sin(bestAngle) * speed,
  };
}

// ─── DRAWING ──────────────────────────────────────────────────────────────────

function drawBoard(ctx: CanvasRenderingContext2D) {
  // Wood grain background
  const bg = ctx.createLinearGradient(0, 0, BS, BS);
  bg.addColorStop(0, "#7a4e2d");
  bg.addColorStop(0.3, "#9d6b3a");
  bg.addColorStop(0.6, "#8a5c30");
  bg.addColorStop(1, "#6d3e1e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BS, BS);

  // Wood grain lines
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x < BS; x += 22) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 8, BS); ctx.stroke();
  }

  // Outer frame
  ctx.strokeStyle = "#3d1e0a";
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, BS - 6, BS - 6);

  // Playing area (inner) border — gold
  ctx.strokeStyle = "rgba(255,215,0,0.55)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, BS - 72, BS - 72);

  // Diagonal lines corner to center
  ctx.strokeStyle = "rgba(255,215,0,0.18)";
  ctx.lineWidth = 1;
  const cx = BS / 2, cy = BS / 2;
  [[36,36],[BS-36,36],[36,BS-36],[BS-36,BS-36]].forEach(([px, py]) => {
    ctx.beginPath();
    const angle = Math.atan2(cy - py, cx - px);
    const ex = cx - Math.cos(angle) * 52, ey = cy - Math.sin(angle) * 52;
    ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
  });

  // Center circle (outer)
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,215,0,0.5)";
  ctx.lineWidth = 1.5; ctx.stroke();

  // Center circle (inner)
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,215,0,0.35)";
  ctx.lineWidth = 1; ctx.stroke();

  // Cardinal arrows
  [[cx,36,cx,50],[cx,BS-36,cx,BS-50],[36,cy,50,cy],[BS-36,cy,BS-50,cy]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
    ctx.strokeStyle = "rgba(255,200,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
  });

  // Pocket holes (radial gradient → black)
  POCKETS.forEach(p => {
    const g = ctx.createRadialGradient(p.x, p.y, 3, p.x, p.y, PR);
    g.addColorStop(0, "#000");
    g.addColorStop(0.55, "#090909");
    g.addColorStop(1, "#2d1508");
    ctx.beginPath(); ctx.arc(p.x, p.y, PR, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    // Pocket rim
    ctx.strokeStyle = "rgba(255,215,0,0.25)"; ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Baselines
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(255,215,0,0.35)";
  ctx.beginPath(); ctx.moveTo(BASE_X_MIN, P1_BASE_Y); ctx.lineTo(BASE_X_MAX, P1_BASE_Y); ctx.stroke();
  ctx.strokeStyle = "rgba(239,68,68,0.3)";
  ctx.beginPath(); ctx.moveTo(BASE_X_MIN, P2_BASE_Y); ctx.lineTo(BASE_X_MAX, P2_BASE_Y); ctx.stroke();
  ctx.setLineDash([]);

  // Player labels
  ctx.fillStyle = "rgba(255,215,0,0.45)";
  ctx.font = "bold 9px sans-serif";
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  ctx.fillText("YOU ▾", BASE_X_MIN, P1_BASE_Y + 10);
  ctx.fillStyle = "rgba(239,68,68,0.45)";
  ctx.fillText("BOT ▴", BASE_X_MIN, P2_BASE_Y - 10);
}

function drawCoin(ctx: CanvasRenderingContext2D, c: Coin) {
  if (c.pocketed) return;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);

  if (c.kind === "q") {
    const g = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, c.r);
    g.addColorStop(0, "#ff8080"); g.addColorStop(0.5, "#e53e3e"); g.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = g;
  } else if (c.kind === "w") {
    const g = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, c.r);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.5, "#ebebeb"); g.addColorStop(1, "#aaaaaa");
    ctx.fillStyle = g;
  } else {
    const g = ctx.createRadialGradient(c.x - 3, c.y - 3, 1, c.x, c.y, c.r);
    g.addColorStop(0, "#555"); g.addColorStop(0.5, "#222"); g.addColorStop(1, "#000");
    ctx.fillStyle = g;
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = c.kind === "q" ? "rgba(220,0,0,0.5)" : "rgba(0,0,0,0.2)";
  ctx.lineWidth = 1; ctx.stroke();

  if (c.kind === "q") {
    ctx.fillStyle = "#fff"; ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("Q", c.x, c.y);
  }
  ctx.restore();
}

function drawStriker(ctx: CanvasRenderingContext2D, s: Striker) {
  ctx.save();
  ctx.shadowColor = "rgba(255,215,0,0.7)"; ctx.shadowBlur = 14;
  ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(s.x - 4, s.y - 4, 2, s.x, s.y, s.r);
  g.addColorStop(0, "#fff7d0"); g.addColorStop(0.5, "#FFD700"); g.addColorStop(1, "#aa7a00");
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#886000"; ctx.lineWidth = 2; ctx.stroke();
  // Inner ring detail
  ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.52, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function drawAimLine(ctx: CanvasRenderingContext2D, sx: number, sy: number, angle: number, power: number) {
  const len = 50 + power * 65;
  const ex = sx + Math.cos(angle) * len;
  const ey = sy + Math.sin(angle) * len;

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(255,255,255,0.65)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
  ctx.setLineDash([]);

  // Arrow head
  ctx.save();
  ctx.translate(ex, ey); ctx.rotate(angle);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, 4); ctx.lineTo(-5, -4); ctx.closePath();
  ctx.fill(); ctx.restore();
  ctx.restore();
}

// ─── MATCHMAKING SCREEN ───────────────────────────────────────────────────────

function MatchmakingScreen({ entryFee, onFound }: { entryFee: number; onFound: () => void }) {
  const [dots, setDots] = useState(".");
  const [count, setCount] = useState(3);

  useEffect(() => {
    const di = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    const ci = setInterval(() => {
      setCount(c => { if (c <= 1) { setTimeout(onFound, 200); return 0; } return c - 1; });
    }, 950);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [onFound]);

  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
      <motion.div className="relative w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{ background: "rgba(255,215,0,0.08)", border: "2px solid rgba(255,215,0,0.35)", boxShadow: "0 0 40px rgba(255,215,0,0.2)" }}
        animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 30px rgba(255,215,0,0.15)", "0 0 55px rgba(255,215,0,0.4)", "0 0 30px rgba(255,215,0,0.15)"] }}
        transition={{ duration: 1.6, repeat: Infinity }}>
        🏵️
        <motion.div className="absolute inset-0 rounded-full"
          style={{ border: "2px dashed rgba(255,215,0,0.3)" }}
          animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }} />
      </motion.div>

      <div className="text-center">
        <div className="text-white font-black text-xl">Finding Opponent{dots}</div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Searching carrom players nearby</div>
      </div>

      <div className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
        style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.22)" }}>
        <span className="text-2xl">💰</span>
        <div><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.5)" }}>ENTRY FEE</div>
          <div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{entryFee}</div></div>
        <div className="h-8 w-px mx-2" style={{ background: "rgba(255,215,0,0.2)" }} />
        <div><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.55)" }}>WIN UP TO</div>
          <div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>

      <div className="w-full flex items-center gap-3">
        {[["👤","You","● Ready","rgba(255,215,0,0.25)","#FFD700"], ["🤖","Bot",`⏳ ${count}s`,"rgba(255,255,255,0.08)","rgba(255,255,255,0.25)"]].map(([icon,name,status,bg,border],i) => (
          <motion.div key={i} className="flex-1 flex flex-col items-center gap-2 py-3 rounded-2xl"
            style={{ background: bg as string, border: `1px solid ${border as string}` }}>
            <div className="text-2xl">{icon as string}</div>
            <div className="text-xs font-black text-white">{name as string}</div>
            <div className="text-[10px]" style={{ color: i === 0 ? "#22c55e" : "rgba(255,165,0,0.8)" }}>{status as string}</div>
          </motion.div>
        ))}
        <div className="text-2xl font-black" style={{ color: "rgba(255,255,255,0.25)" }}>VS</div>
      </div>
    </div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────

function ResultScreen({ won, entryFee, scores, onBack, onRematch }: {
  won: boolean; entryFee: number; scores: [number, number]; onBack: () => void; onRematch: () => void;
}) {
  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
  return (
    <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-8"
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <motion.div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
        style={{
          background: won ? "rgba(255,215,0,0.12)" : "rgba(239,68,68,0.1)",
          border: won ? "3px solid rgba(255,215,0,0.5)" : "3px solid rgba(239,68,68,0.4)",
          boxShadow: won ? "0 0 55px rgba(255,215,0,0.4)" : "0 0 40px rgba(239,68,68,0.3)",
        }}
        animate={won ? { scale: [1, 1.05, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
        {won ? "🏆" : "💔"}
      </motion.div>

      <div className="text-center">
        <div className="font-black text-3xl"
          style={{ color: won ? "#FFD700" : "#ef4444", textShadow: won ? "0 0 20px rgba(255,215,0,0.5)" : undefined }}>
          {won ? "You Won! 🎉" : "Better Luck!"}
        </div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {won ? "Brilliant carrom play!" : "The bot beat you this time!"}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="w-full flex gap-3">
        {(["You", "Bot"] as const).map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl"
            style={{ background: i === 0 ? "rgba(255,215,0,0.08)" : "rgba(239,68,68,0.06)", border: `1px solid ${i===0?"rgba(255,215,0,0.2)":"rgba(239,68,68,0.15)"}` }}>
            <div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</div>
            <div className="text-2xl font-black" style={{ color: i === 0 ? "#FFD700" : "#ef4444" }}>{scores[i]}</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>coins pocketed</div>
          </div>
        ))}
      </div>

      <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {[
          ["Entry Fee", `₹${entryFee}`, "rgba(255,255,255,0.5)"],
          ["Platform Fee (10%)", `-₹${entryFee * 2 - prize}`, "rgba(255,255,255,0.35)"],
          [won ? "Winnings Credited" : "Amount Lost", won ? `+₹${prize}` : `-₹${entryFee}`, won ? "#22c55e" : "#ef4444"],
        ].map(([label, val, color], i) => (
          <div key={i} className="flex justify-between px-4 py-3"
            style={{ background: i === 2 ? (won ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.05)") : "rgba(255,255,255,0.03)", borderBottom: i < 2 ? "1px solid rgba(255,255,255,0.05)" : undefined }}>
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</span>
            <span className="font-black" style={{ color: color as string }}>{val}</span>
          </div>
        ))}
      </div>

      <motion.button whileTap={{ scale: 0.97 }} onClick={onRematch}
        className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,#22c55e,#15803d)", color: "#fff", boxShadow: "0 0 24px rgba(34,197,94,0.35)", letterSpacing: "0.05em" }}>
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.2) 50%,transparent 65%)" }}
          animate={{ x: ["-120%", "220%"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1 }} />
        🎮 Play Again
      </motion.button>

      <button onClick={onBack} className="text-sm font-bold cursor-pointer"
        style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
    </motion.div>
  );
}

// ─── MAIN GAME COMPONENT ──────────────────────────────────────────────────────

interface Props { onBack: () => void; initialFee?: number }

type UiPhase = "matchmaking" | "playing" | "result";

export default function CarromGame({ onBack, initialFee = 10 }: Props) {
  const { total, deductFee, addWinning } = useWallet();

  // ── Canvas + game state refs ──
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const rafRef      = useRef<number>(0);
  const gameRef     = useRef<GState>({
    coins: initCoins(),
    striker: makeStriker(0),
    turn: 0,
    scores: [0, 0],
    phase: "aiming",
    strikerFoul: false,
  });

  // Aim/power refs (updated from UI, read in rAF without re-subscribing)
  const aimAngleRef  = useRef<number>(Math.PI / 2 * 3); // straight up (toward center)
  const powerRef     = useRef<number>(0.55);
  const strikerXRef  = useRef<number>(BS / 2);

  // ── React UI state ──
  const [uiPhase, setUiPhase]     = useState<UiPhase>("matchmaking");
  const [uiTurn, setUiTurn]       = useState<0 | 1>(0);
  const [uiScores, setUiScores]   = useState<[number, number]>([0, 0]);
  const [power, setPower]         = useState(55);     // 0-100 (slider)
  const [strikerPos, setStrikerPos] = useState(50);   // 0-100 (slider)
  const [aimDeg, setAimDeg]       = useState(270);    // degrees display
  const [winner, setWinner]       = useState<0 | 1 | null>(null);
  const [finalScores, setFinalScores] = useState<[number, number]>([0, 0]);
  const [feeDeducted, setFeeDeducted] = useState(false);
  const [message, setMessage]     = useState("");

  // ── Match message flash ──
  function flashMsg(msg: string) {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2200);
  }

  // ── Deduct entry fee on game start ──
  useEffect(() => {
    if (uiPhase === "playing" && !feeDeducted) {
      deductFee(initialFee, `🏵️ Carrom — Entry ₹${initialFee}`);
      setFeeDeducted(true);
    }
  }, [uiPhase, feeDeducted, deductFee, initialFee]);

  // ── rAF game loop ──
  useEffect(() => {
    if (uiPhase !== "playing") return;

    const loop = () => {
      const state = gameRef.current;
      const ctx   = canvasRef.current?.getContext("2d");
      if (!ctx) { rafRef.current = requestAnimationFrame(loop); return; }

      // ── Physics step ──
      if (state.phase === "moving") {
        const pocketed = stepPhysics(state.coins, state.striker);

        // Score pocketed coins
        pocketed.forEach(c => {
          const pts = c.kind === "q" ? 3 : 1;
          state.scores[state.turn] += pts;
          if (c.kind === "q") flashMsg(`${state.turn === 0 ? "👤 You" : "🤖 Bot"} pocketed the Queen! +3 pts`);
        });

        // Sync scores to UI periodically (only when something pocketed)
        if (pocketed.length > 0) setUiScores([...state.scores] as [number, number]);

        if (!isMoving(state.coins, state.striker)) {
          // Turn ended — check win
          const total = state.scores[0] + state.scores[1];
          const allCoins = 19; // 1 queen + 18 regular
          const allPocketed = state.coins.every(c => c.pocketed);
          const p1Won = state.scores[0] >= WIN_TARGET;
          const p2Won = state.scores[1] >= WIN_TARGET;

          if (p1Won || p2Won || allPocketed) {
            const w: 0 | 1 = state.scores[0] >= state.scores[1] ? 0 : 1;
            setWinner(w);
            setFinalScores([...state.scores] as [number, number]);
            setUiPhase("result");
            if (w === 0) {
              const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
              addWinning(prize, `🏵️ Carrom — Won ₹${prize}`);
            }
            return; // stop loop
          }

          // Switch turn
          state.turn = state.turn === 0 ? 1 : 0;
          strikerXRef.current = BS / 2;
          state.striker = makeStriker(state.turn, BS / 2);
          state.phase = state.turn === 0 ? "aiming" : "bot_thinking";
          setUiTurn(state.turn);
          setUiScores([...state.scores] as [number, number]);

          if (state.turn === 1) {
            // Bot takes its turn
            setTimeout(() => {
              if (uiPhase !== "playing") return; // guard stale closure
              const shot = getBotShot(state);
              state.striker.vx = shot.vx;
              state.striker.vy = shot.vy;
              state.phase = "moving";
            }, 1100 + Math.random() * 700);
          }
        }
      }

      // ── Draw ──
      ctx.clearRect(0, 0, BS, BS);
      drawBoard(ctx);
      state.coins.forEach(c => drawCoin(ctx, c));
      drawStriker(ctx, state.striker);
      if (state.phase === "aiming" && state.turn === 0) {
        drawAimLine(ctx, state.striker.x, state.striker.y, aimAngleRef.current, powerRef.current);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [uiPhase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle match found ──
  function handleMatchFound() {
    // Reset game state
    gameRef.current = {
      coins: initCoins(),
      striker: makeStriker(0, BS / 2),
      turn: 0,
      scores: [0, 0],
      phase: "aiming",
      strikerFoul: false,
    };
    aimAngleRef.current = (Math.PI * 3) / 2; // straight up
    strikerXRef.current = BS / 2;
    setUiScores([0, 0]);
    setUiTurn(0);
    setAimDeg(270);
    setPower(55);
    setStrikerPos(50);
    setUiPhase("playing");
  }

  // ── Shoot handler ──
  function handleShoot() {
    const state = gameRef.current;
    if (state.phase !== "aiming" || state.turn !== 0) return;
    const speed = MAX_SPEED * (0.28 + powerRef.current * 0.72);
    state.striker.vx = Math.cos(aimAngleRef.current) * speed;
    state.striker.vy = Math.sin(aimAngleRef.current) * speed;
    state.phase = "moving";
  }

  // ── Canvas touch → aim ──
  function getCanvasCoords(e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = BS / rect.width, scaleY = BS / rect.height;
    if ("touches" in e) {
      const t = e.touches[0] || e.changedTouches[0];
      return { cx: (t.clientX - rect.left) * scaleX, cy: (t.clientY - rect.top) * scaleY };
    }
    return { cx: (e.clientX - rect.left) * scaleX, cy: (e.clientY - rect.top) * scaleY };
  }

  function handleCanvasAim(e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
    const state = gameRef.current;
    if (state.phase !== "aiming" || state.turn !== 0) return;
    e.preventDefault();
    const { cx, cy } = getCanvasCoords(e);
    const angle = Math.atan2(cy - state.striker.y, cx - state.striker.x);
    aimAngleRef.current = angle;
    const deg = Math.round(((angle * 180) / Math.PI + 360) % 360);
    setAimDeg(deg);
  }

  // ── Striker position slider ──
  function handleStrikerPos(val: number) {
    setStrikerPos(val);
    const state = gameRef.current;
    if (state.phase !== "aiming" || state.turn !== 0) return;
    const newX = BASE_X_MIN + (val / 100) * (BASE_X_MAX - BASE_X_MIN);
    strikerXRef.current = newX;
    state.striker.x = newX;
  }

  // ── Power slider ──
  function handlePower(val: number) {
    setPower(val);
    powerRef.current = val / 100;
  }

  // ── Rematch ──
  function handleRematch() {
    setUiPhase("matchmaking");
    setWinner(null);
    setFeeDeducted(false);
    setFinalScores([0, 0]);
  }

  const canPlay = uiPhase === "playing" && gameRef.current.phase === "aiming" && uiTurn === 0;
  const prize   = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden"
      style={{ background: "#07060e", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(7,6,14,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={onBack} className="flex items-center gap-2 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏵️</span>
          <span className="font-black text-white text-base">Carrom Board</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
          <span className="text-xs">💰</span>
          <span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {/* ── Matchmaking ── */}
      {uiPhase === "matchmaking" && (
        <MatchmakingScreen entryFee={initialFee} onFound={handleMatchFound} />
      )}

      {/* ── Playing ── */}
      {uiPhase === "playing" && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Score bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", boxShadow: uiTurn===0?"0 0 10px rgba(255,215,0,0.6)":"none" }}>👤</div>
              <div>
                <div className="text-xs font-black text-white">You</div>
                <div className="font-black text-lg leading-none" style={{ color: "#FFD700" }}>{uiScores[0]}</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>PRIZE POT</div>
              <div className="text-base font-black" style={{ color: "#22c55e" }}>₹{prize}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-xs font-black text-white">Bot</div>
                <div className="font-black text-lg leading-none" style={{ color: "#ef4444" }}>{uiScores[1]}</div>
              </div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)", boxShadow: uiTurn===1?"0 0 10px rgba(239,68,68,0.6)":"none" }}>🤖</div>
            </div>
          </div>

          {/* Turn indicator */}
          <div className="flex-shrink-0 flex items-center justify-center py-1.5"
            style={{ background: uiTurn===0?"rgba(255,215,0,0.06)":"rgba(239,68,68,0.05)" }}>
            <span className="text-xs font-black" style={{ color: uiTurn===0?"#FFD700":"#ef4444" }}>
              {uiTurn === 0 ? "👤 YOUR TURN — Aim & Shoot!" : "🤖 Bot is thinking..."}
            </span>
          </div>

          {/* Board canvas */}
          <div className="flex-shrink-0 px-2 pt-1">
            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,215,0,0.12)", boxShadow: "0 0 40px rgba(0,0,0,0.7)" }}>
              <canvas
                ref={canvasRef}
                width={BS}
                height={BS}
                style={{ width: "100%", aspectRatio: "1", display: "block", touchAction: "none" }}
                onTouchStart={handleCanvasAim}
                onTouchMove={handleCanvasAim}
                onMouseDown={handleCanvasAim}
                onMouseMove={(e) => { if (e.buttons > 0) handleCanvasAim(e); }}
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex-shrink-0 px-4 py-2 flex flex-col gap-2">
            {/* Striker position */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-14" style={{ color: "rgba(255,215,0,0.5)" }}>POSITION</span>
              <input type="range" min={0} max={100} value={strikerPos}
                disabled={!canPlay}
                onChange={e => handleStrikerPos(Number(e.target.value))}
                className="flex-1 h-2 rounded-full cursor-pointer"
                style={{ accentColor: "#FFD700", opacity: canPlay ? 1 : 0.35 }} />
              <span className="text-[10px] font-bold w-6 text-right" style={{ color: "rgba(255,215,0,0.5)" }}>
                {Math.round((strikerPos / 100) * (BASE_X_MAX - BASE_X_MIN) + BASE_X_MIN)}
              </span>
            </div>

            {/* Power */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold w-14" style={{ color: "rgba(239,68,68,0.55)" }}>POWER</span>
              <input type="range" min={0} max={100} value={power}
                disabled={!canPlay}
                onChange={e => handlePower(Number(e.target.value))}
                className="flex-1 h-2 rounded-full cursor-pointer"
                style={{ accentColor: "#ef4444", opacity: canPlay ? 1 : 0.35 }} />
              <span className="text-[10px] font-bold w-6 text-right" style={{ color: "rgba(239,68,68,0.6)" }}>{power}%</span>
            </div>

            {/* Aim angle indicator + Shoot button */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>AIM</span>
                <span className="text-sm font-black" style={{ color: "#FFD700" }}>{aimDeg}°</span>
              </div>
              <div className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.3)", flex: 1 }}>
                Tap board to aim
              </div>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleShoot}
                disabled={!canPlay}
                className="px-6 py-3 rounded-2xl font-black text-sm cursor-pointer relative overflow-hidden"
                style={{
                  background: canPlay ? "linear-gradient(135deg,#FFD700,#ff8c00)" : "rgba(255,255,255,0.06)",
                  color: canPlay ? "#000" : "rgba(255,255,255,0.2)",
                  boxShadow: canPlay ? "0 0 24px rgba(255,215,0,0.4)" : "none",
                  minWidth: 90,
                }}>
                {canPlay && (
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.25) 50%,transparent 65%)" }}
                    animate={{ x: ["-120%","220%"] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.8 }} />
                )}
                {canPlay ? "🎯 SHOOT" : uiTurn===1 ? "⏳ Bot..." : "Wait..."}
              </motion.button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex-shrink-0 flex items-center justify-center gap-4 pb-2">
            {[["⚪","White",1],["⚫","Black",1],["🔴","Queen",3]].map(([ico,lbl,pts]) => (
              <div key={lbl as string} className="flex items-center gap-1">
                <span className="text-xs">{ico as string}</span>
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{lbl as string} = {pts} pt</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {uiPhase === "result" && (
        <ResultScreen
          won={winner === 0}
          entryFee={initialFee}
          scores={finalScores}
          onBack={onBack}
          onRematch={handleRematch}
        />
      )}

      {/* ── Flash message ── */}
      <AnimatePresence>
        {message && (
          <motion.div className="fixed top-20 left-0 right-0 flex justify-center z-50 pointer-events-none"
            style={{ maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div className="px-5 py-2 rounded-full text-sm font-black text-white"
              style={{ background: "rgba(255,215,0,0.9)", color: "#000", boxShadow: "0 0 20px rgba(255,215,0,0.4)" }}>
              {message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
