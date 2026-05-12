/**
 * SnakesGame — WINGGO Premium Snake & Ladder (Sapsidi)
 * Full WinZO-style rebuild: colorful board, cartoon snakes/ladders,
 * 3D dice, confetti, bot AI, wallet integration.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

// ─── BOARD CONFIG ──────────────────────────────────────────────────────────────

const SNAKES: Record<number, number> = {
  99: 21,
  92: 37,
  87: 24,
  74: 53,
  62: 18,
  48: 26,
  36: 6,
};

const LADDERS: Record<number, number> = {
  4:  25,
  13: 46,
  28: 76,
  33: 68,
  51: 67,
  63: 81,
  71: 91,
};

const WIN_POS = 100;
const PLATFORM_PCT = 0.10;

// vivid colors for each snake (index 0…)
const SNAKE_COLORS = ["#ff3d3d", "#ff6b35", "#e040fb", "#ff1744", "#f50057", "#ff6d00", "#c62828"];
// vivid colors for each ladder
const LADDER_COLORS = ["#FFD700", "#69F0AE", "#40C4FF", "#FFAB40", "#EA80FC", "#80D8FF", "#B9F6CA"];

// Row background colors (display row 0 = top = cells 91-100)
const ROW_COLORS = [
  "rgba(148,0,211,0.22)",   // row 0  – deep violet
  "rgba(75,0,230,0.18)",    // row 1  – indigo
  "rgba(0,60,220,0.18)",    // row 2  – royal blue
  "rgba(0,150,200,0.18)",   // row 3  – teal blue
  "rgba(0,170,100,0.18)",   // row 4  – green
  "rgba(200,140,0,0.18)",   // row 5  – amber
  "rgba(220,80,0,0.18)",    // row 6  – orange
  "rgba(210,30,30,0.18)",   // row 7  – red
  "rgba(160,20,120,0.18)",  // row 8  – magenta
  "rgba(90,0,180,0.18)",    // row 9  – purple
];

// ─── CELL GEOMETRY ─────────────────────────────────────────────────────────────

function cellPct(cell: number): { x: number; y: number } {
  const idx  = cell - 1;
  const bRow = Math.floor(idx / 10);
  const bCol = idx % 10;
  const rtl  = bRow % 2 === 1;
  const dCol = rtl ? 9 - bCol : bCol;
  const dRow = 9 - bRow;
  return { x: (dCol + 0.5) * 10, y: (dRow + 0.5) * 10 };
}

function cellAt(dRow: number, dCol: number): number {
  const bRow = 9 - dRow;
  const rtl  = bRow % 2 === 1;
  const bCol = rtl ? 9 - dCol : dCol;
  return bRow * 10 + bCol + 1;
}

// ─── 3D DICE ──────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 20], [73, 20], [27, 50], [73, 50], [27, 80], [73, 80]],
};

function Dice3D({ value, rolling, whose }: { value: number; rolling: boolean; whose: "player" | "bot" }) {
  const isPlayer = whose === "player";
  return (
    <div style={{ perspective: 200 }}>
      <motion.div
        style={{
          width: 62, height: 62,
          borderRadius: 14,
          background: isPlayer
            ? "linear-gradient(135deg, #1c1430, #0d0820)"
            : "linear-gradient(135deg, #1a0000, #0d0d0d)",
          border: isPlayer
            ? "2px solid rgba(255,215,0,0.6)"
            : "2px solid rgba(239,68,68,0.5)",
          boxShadow: isPlayer
            ? "0 0 20px rgba(255,215,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)"
            : "0 0 20px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
          position: "relative",
        }}
        animate={rolling ? {
          rotateX: [0, 90, 180, 270, 360],
          rotateY: [0, 60, 120, 180, 0],
          scale: [1, 1.08, 0.95, 1.08, 1],
        } : { rotateX: 0, rotateY: 0, scale: 1 }}
        transition={rolling ? { duration: 0.5, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
      >
        <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {(PIPS[value] ?? []).map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={9.5}
              fill={isPlayer ? "#FFD700" : "#ef4444"}
              style={{ filter: `drop-shadow(0 0 3px ${isPlayer ? "rgba(255,215,0,0.8)" : "rgba(239,68,68,0.8)"})` }}
            />
          ))}
        </svg>
      </motion.div>
    </div>
  );
}

// ─── SNAKE SVG ────────────────────────────────────────────────────────────────

function SnakeSvg({ from, to, color }: { from: number; to: number; color: string }) {
  const h = cellPct(from);
  const t = cellPct(to);

  const dx = h.x - t.x;
  const dy = h.y - t.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = (-dy / len) * 9;
  const py = (dx / len) * 9;

  const q1x = t.x + dx * 0.33 + px;
  const q1y = t.y + dy * 0.33 + py;
  const q2x = t.x + dx * 0.66 - px;
  const q2y = t.y + dy * 0.66 - py;

  const body = `M${t.x},${t.y} C${q1x},${q1y} ${q2x},${q2y} ${h.x},${h.y}`;

  // head direction
  const hAngle = Math.atan2(h.y - q2y, h.x - q2x);
  const ex1x = h.x + Math.cos(hAngle + 1.2) * 2.4;
  const ex1y = h.y + Math.sin(hAngle + 1.2) * 2.4;
  const ex2x = h.x + Math.cos(hAngle - 1.2) * 2.4;
  const ex2y = h.y + Math.sin(hAngle - 1.2) * 2.4;
  // tongue
  const tx0x = h.x + Math.cos(hAngle) * 4.5;
  const tx0y = h.y + Math.sin(hAngle) * 4.5;
  const tf1x = tx0x + Math.cos(hAngle + 0.5) * 2.2;
  const tf1y = tx0y + Math.sin(hAngle + 0.5) * 2.2;
  const tf2x = tx0x + Math.cos(hAngle - 0.5) * 2.2;
  const tf2y = tx0y + Math.sin(hAngle - 0.5) * 2.2;

  return (
    <g>
      {/* Glow */}
      <path d={body} fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity="0.18" />
      {/* Body */}
      <path d={body} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
      {/* Highlight */}
      <path d={body} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" strokeLinecap="round" />
      {/* Head */}
      <circle cx={h.x} cy={h.y} r={3.8} fill={color} opacity="0.95" />
      <circle cx={h.x} cy={h.y} r={3.8} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
      {/* Eyes */}
      <circle cx={ex1x} cy={ex1y} r={1} fill="white" />
      <circle cx={ex2x} cy={ex2y} r={1} fill="white" />
      <circle cx={ex1x + Math.cos(hAngle) * 0.3} cy={ex1y + Math.sin(hAngle) * 0.3} r={0.5} fill="#111" />
      <circle cx={ex2x + Math.cos(hAngle) * 0.3} cy={ex2y + Math.sin(hAngle) * 0.3} r={0.5} fill="#111" />
      {/* Tongue */}
      <line x1={h.x + Math.cos(hAngle) * 3.8} y1={h.y + Math.sin(hAngle) * 3.8} x2={tx0x} y2={tx0y}
        stroke="#ff1744" strokeWidth="0.8" strokeLinecap="round" />
      <line x1={tx0x} y1={tx0y} x2={tf1x} y2={tf1y} stroke="#ff1744" strokeWidth="0.8" strokeLinecap="round" />
      <line x1={tx0x} y1={tx0y} x2={tf2x} y2={tf2y} stroke="#ff1744" strokeWidth="0.8" strokeLinecap="round" />
      {/* Tail */}
      <circle cx={t.x} cy={t.y} r={1.5} fill={color} opacity="0.7" />
    </g>
  );
}

// ─── LADDER SVG ────────────────────────────────────────────────────────────────

function LadderSvg({ from, to, color }: { from: number; to: number; color: string }) {
  const b  = cellPct(from);
  const tp = cellPct(to);

  const dx = tp.x - b.x;
  const dy = tp.y - b.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = (-dy / len) * 2.2;
  const py = (dx / len) * 2.2;

  const rungs = 5;

  return (
    <g>
      {/* Left rail glow */}
      <line x1={`${b.x - px}%`} y1={`${b.y - py}%`} x2={`${tp.x - px}%`} y2={`${tp.y - py}%`}
        stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.15" />
      {/* Right rail glow */}
      <line x1={`${b.x + px}%`} y1={`${b.y + py}%`} x2={`${tp.x + px}%`} y2={`${tp.y + py}%`}
        stroke={color} strokeWidth="4" strokeLinecap="round" opacity="0.15" />
      {/* Left rail */}
      <line x1={`${b.x - px}%`} y1={`${b.y - py}%`} x2={`${tp.x - px}%`} y2={`${tp.y - py}%`}
        stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      {/* Right rail */}
      <line x1={`${b.x + px}%`} y1={`${b.y + py}%`} x2={`${tp.x + px}%`} y2={`${tp.y + py}%`}
        stroke={color} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      {/* Rungs */}
      {Array.from({ length: rungs }, (_, i) => {
        const t2 = (i + 1) / (rungs + 1);
        const rx = b.x + dx * t2;
        const ry = b.y + dy * t2;
        return (
          <g key={i}>
            <line x1={`${rx - px}%`} y1={`${ry - py}%`} x2={`${rx + px}%`} y2={`${ry + py}%`}
              stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1={`${rx - px}%`} y1={`${ry - py}%`} x2={`${rx + px}%`} y2={`${ry + py}%`}
              stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        );
      })}
      {/* Base cap */}
      <circle cx={`${b.x}%`} cy={`${b.y}%`} r="2" fill={color} opacity="0.6" />
      <circle cx={`${tp.x}%`} cy={`${tp.y}%`} r="1.5" fill={color} opacity="0.5" />
    </g>
  );
}

// ─── BOARD ────────────────────────────────────────────────────────────────────

const SNAKE_CELLS  = new Set(Object.keys(SNAKES).map(Number));
const LADDER_CELLS = new Set(Object.keys(LADDERS).map(Number));

const SNAKE_ENTRIES  = Object.entries(SNAKES).map(([k, v]) => ({ from: Number(k), to: v }));
const LADDER_ENTRIES = Object.entries(LADDERS).map(([k, v]) => ({ from: Number(k), to: v }));

function GameBoard({ animPos1, animPos2, turn }: {
  animPos1: number; animPos2: number; turn: number;
}) {
  const p1 = animPos1 > 0 ? cellPct(animPos1) : null;
  const p2 = animPos2 > 0 ? cellPct(animPos2) : null;

  return (
    <div
      className="relative w-full"
      style={{
        aspectRatio: "1",
        userSelect: "none",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(148,0,211,0.25), 0 0 120px rgba(0,0,0,0.8)",
        border: "1.5px solid rgba(255,215,0,0.2)",
      }}
    >
      {/* ── Cell grid ── */}
      <div
        className="absolute inset-0 grid"
        style={{ gridTemplateColumns: "repeat(10, 1fr)", gridTemplateRows: "repeat(10, 1fr)" }}
      >
        {Array.from({ length: 10 }, (_, dRow) =>
          Array.from({ length: 10 }, (_, dCol) => {
            const num     = cellAt(dRow, dCol);
            const isSnake = SNAKE_CELLS.has(num);
            const isLadr  = LADDER_CELLS.has(num);
            const isWin   = num === 100;
            const isStart = num === 1;
            const checker = (dRow + dCol) % 2 === 0;
            const rowBg   = ROW_COLORS[dRow];
            return (
              <div
                key={`${dRow}-${dCol}`}
                className="relative flex items-center justify-center"
                style={{
                  background: isWin
                    ? "rgba(255,215,0,0.22)"
                    : isStart
                    ? "rgba(34,197,94,0.18)"
                    : checker
                    ? rowBg
                    : "rgba(0,0,0,0.28)",
                  border: isWin
                    ? "0.5px solid rgba(255,215,0,0.35)"
                    : "0.5px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* cell number */}
                <span style={{
                  fontSize: "clamp(5px, 1.1vw, 8px)",
                  fontWeight: 900,
                  color: isWin   ? "#FFD700"
                       : isSnake ? "rgba(255,80,80,0.8)"
                       : isLadr  ? "rgba(100,255,140,0.8)"
                       : isStart ? "rgba(100,255,180,0.7)"
                       : "rgba(255,255,255,0.28)",
                  letterSpacing: "-0.5px",
                  lineHeight: 1,
                  zIndex: 2,
                  position: "relative",
                }}>
                  {isWin ? "🏆" : isStart ? "🚀" : num}
                </span>
                {/* Snake/Ladder indicator dot */}
                {isSnake && (
                  <span style={{ position: "absolute", top: 1, right: 1, fontSize: 5, lineHeight: 1 }}>🔴</span>
                )}
                {isLadr && (
                  <span style={{ position: "absolute", top: 1, right: 1, fontSize: 5, lineHeight: 1 }}>🟢</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── SVG overlay: ladders + snakes ── */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        overflow="visible"
        style={{ pointerEvents: "none" }}
      >
        {LADDER_ENTRIES.map(({ from, to }, i) => (
          <LadderSvg key={`l${from}`} from={from} to={to} color={LADDER_COLORS[i % LADDER_COLORS.length]} />
        ))}
        {SNAKE_ENTRIES.map(({ from, to }, i) => (
          <SnakeSvg key={`s${from}`} from={from} to={to} color={SNAKE_COLORS[i % SNAKE_COLORS.length]} />
        ))}
      </svg>

      {/* ── Tokens ── */}
      {p2 && (
        <motion.div
          className="absolute flex items-center justify-center font-black z-10"
          style={{
            left: `${p2.x + 2.5}%`,
            top:  `${p2.y + 2.5}%`,
            transform: "translate(-50%,-50%)",
            width:  "clamp(18px, 5vw, 24px)",
            height: "clamp(18px, 5vw, 24px)",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444, #b91c1c)",
            border: "2px solid rgba(255,255,255,0.7)",
            boxShadow: turn === 1
              ? "0 0 16px rgba(239,68,68,0.9), 0 0 32px rgba(239,68,68,0.5)"
              : "0 0 8px rgba(239,68,68,0.4)",
            fontSize: "clamp(9px, 2.2vw, 13px)",
          }}
          animate={{ left: `${p2.x + 2.5}%`, top: `${p2.y + 2.5}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          🤖
        </motion.div>
      )}
      {p1 && (
        <motion.div
          className="absolute flex items-center justify-center font-black z-20"
          style={{
            left: `${p1.x}%`,
            top:  `${p1.y}%`,
            transform: "translate(-50%,-50%)",
            width:  "clamp(20px, 5.5vw, 27px)",
            height: "clamp(20px, 5.5vw, 27px)",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FFD700, #ff8c00)",
            border: "2px solid rgba(255,255,255,0.85)",
            boxShadow: turn === 0
              ? "0 0 18px rgba(255,215,0,0.95), 0 0 36px rgba(255,215,0,0.5)"
              : "0 0 8px rgba(255,215,0,0.4)",
            fontSize: "clamp(10px, 2.4vw, 14px)",
          }}
          animate={{ left: `${p1.x}%`, top: `${p1.y}%` }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
        >
          👤
        </motion.div>
      )}
    </div>
  );
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    x: 5 + Math.random() * 90,
    color: ["#FFD700","#ff3d3d","#69F0AE","#40C4FF","#E040FB","#FFAB40"][i % 6],
    delay: Math.random() * 0.6,
    dur: 1.4 + Math.random() * 1.2,
    size: 6 + Math.random() * 6,
    rot: Math.random() * 360,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" style={{ maxWidth: 480, margin: "0 auto" }}>
      {pieces.map(p => (
        <motion.div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -12,
            width: p.size,
            height: p.size,
            borderRadius: 2,
            background: p.color,
          }}
          animate={{ y: "105vh", rotate: p.rot + 720, opacity: [1, 1, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

// ─── MATCHMAKING ──────────────────────────────────────────────────────────────

const BOT_NAMES = ["CricketKing99", "LuckyBaba07", "ProGamer_X", "Sanjay786", "MasterBlaster"];

function MatchmakingScreen({ entryFee, onFound }: { entryFee: number; onFound: () => void }) {
  const [dots, setDots]       = useState(".");
  const [countdown, setCountdown] = useState(3);
  const [botName]             = useState(() => BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));

  useEffect(() => {
    const di = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 480);
    const ci = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(ci); setTimeout(onFound, 300); return 0; }
        return c - 1;
      });
    }, 900);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [onFound]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-5">
      {/* Pulsing search ring */}
      <div className="relative">
        <motion.div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
            border: "2px solid rgba(34,197,94,0.45)",
          }}
          animate={{
            scale: [1, 1.06, 1],
            boxShadow: [
              "0 0 30px rgba(34,197,94,0.25)",
              "0 0 60px rgba(34,197,94,0.55)",
              "0 0 30px rgba(34,197,94,0.25)",
            ],
          }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          🔍
        </motion.div>
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: "2px dashed rgba(34,197,94,0.35)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="text-center">
        <div className="text-white font-black text-xl">Finding Opponent{dots}</div>
        <div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Matching nearby players
        </div>
      </div>

      {/* Prize pill */}
      <div className="flex items-center gap-4 px-6 py-3 rounded-2xl"
        style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.25)" }}>
        <div className="text-center">
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.5)" }}>ENTRY</div>
          <div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{entryFee}</div>
        </div>
        <div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center">
          <div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.55)" }}>WIN UP TO</div>
          <div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div>
        </div>
      </div>

      {/* Player cards */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.3)" }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)", boxShadow: "0 0 16px rgba(255,215,0,0.5)" }}>
            👤
          </div>
          <div className="text-xs font-black text-white">You</div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.8)" }}>● Ready</div>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div className="text-2xl font-black" style={{ color: "rgba(255,255,255,0.25)" }}>VS</div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ {countdown}s</div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <motion.div
            className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            style={{
              background: "linear-gradient(135deg, #ef4444, #b91c1c)",
              boxShadow: "0 0 12px rgba(239,68,68,0.5)",
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 0.85, repeat: Infinity }}
          >
            🤖
          </motion.div>
          <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{botName}</div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ Joining</div>
        </div>
      </div>
    </div>
  );
}

// ─── EVENT POPUP ──────────────────────────────────────────────────────────────

function EventPopup({ type, who, from, to }: {
  type: "snake" | "ladder"; who: "player" | "bot"; from: number; to: number;
}) {
  const isSnake = type === "snake";
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      style={{ maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, scale: 0.6, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.15, y: -20 }}
      transition={{ duration: 0.3, type: "spring", stiffness: 260 }}
    >
      <div className="flex flex-col items-center gap-3 px-10 py-6 rounded-3xl text-center"
        style={{
          background: isSnake
            ? "linear-gradient(135deg, rgba(239,68,68,0.97), rgba(185,28,28,0.97))"
            : "linear-gradient(135deg, rgba(34,197,94,0.97), rgba(21,128,61,0.97))",
          boxShadow: isSnake
            ? "0 0 60px rgba(239,68,68,0.7), 0 8px 32px rgba(0,0,0,0.6)"
            : "0 0 60px rgba(34,197,94,0.7), 0 8px 32px rgba(0,0,0,0.6)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
        }}>
        <motion.span
          className="text-6xl"
          animate={{ rotate: isSnake ? [-8, 8, -8] : [0, 0] }}
          transition={{ duration: 0.4, repeat: isSnake ? 2 : 0 }}
        >
          {isSnake ? "🐍" : "🪜"}
        </motion.span>
        <div className="font-black text-white text-2xl leading-tight">
          {isSnake ? "Bitten by Snake!" : "Climbed the Ladder!"}
        </div>
        <div className="text-white/85 text-sm">
          {who === "player" ? "You" : "Opponent"}{" "}
          {isSnake ? `slid down from ${from} → ${to}` : `zoomed up from ${from} → ${to}`}
        </div>
      </div>
    </motion.div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────

function ResultScreen({
  won, entryFee, onBack, onRematch,
}: { won: boolean; entryFee: number; onBack: () => void; onRematch: () => void }) {
  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      {won && <Confetti />}

      {/* Icon */}
      <motion.div
        className="w-36 h-36 rounded-full flex items-center justify-center text-7xl"
        style={{
          background: won
            ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.1))"
            : "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(185,28,28,0.08))",
          border: `3px solid ${won ? "rgba(255,215,0,0.55)" : "rgba(239,68,68,0.45)"}`,
          boxShadow: won
            ? "0 0 60px rgba(255,215,0,0.45), 0 0 120px rgba(255,215,0,0.15)"
            : "0 0 40px rgba(239,68,68,0.3)",
        }}
        animate={won ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {won ? "🏆" : "💔"}
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <motion.div
          className="font-black text-3xl"
          style={{
            color: won ? "#FFD700" : "#ef4444",
            textShadow: won ? "0 0 24px rgba(255,215,0,0.65)" : "0 0 16px rgba(239,68,68,0.45)",
          }}
          initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260 }}
        >
          {won ? "You Won! 🎉" : "Better Luck!"}
        </motion.div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {won ? "Excellent skill! Winnings added to wallet." : "The snake got you this time. Try again!"}
        </div>
      </div>

      {/* Breakdown card */}
      <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Entry Fee</span>
          <span className="font-black text-white">₹{entryFee}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Platform (10%)</span>
          <span className="font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>-₹{entryFee * 2 - prize}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-4"
          style={{ background: won ? "rgba(255,215,0,0.06)" : "rgba(239,68,68,0.05)" }}>
          <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
          <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>
            {won ? `+₹${prize}` : `-₹${entryFee}`}
          </span>
        </div>
      </div>

      {/* CTA */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onRematch}
        className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #22c55e, #15803d)",
          color: "#fff",
          boxShadow: "0 0 28px rgba(34,197,94,0.45)",
          letterSpacing: "0.04em",
        }}
      >
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)" }}
          animate={{ x: ["-120%", "220%"] }}
          transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
        />
        🎮 Play Again
      </motion.button>

      <button onClick={onBack} className="text-sm font-bold cursor-pointer"
        style={{ color: "rgba(255,255,255,0.3)" }}>
        ← Back to Games
      </button>
    </motion.div>
  );
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  initialFee?: number;
}
type Phase = "matchmaking" | "playing" | "result";

export default function SnakesGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();

  const [phase, setPhase]     = useState<Phase>("matchmaking");
  const [pos1, setPos1]       = useState(0);
  const [pos2, setPos2]       = useState(0);
  const [animPos1, setAnimPos1] = useState(0);
  const [animPos2, setAnimPos2] = useState(0);
  const [turn, setTurn]       = useState(0);   // 0 = player, 1 = bot
  const [dice, setDice]       = useState(1);
  const [rolling, setRolling] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [event, setEvent]     = useState<{ type: "snake"|"ladder"; who: "player"|"bot"; from: number; to: number } | null>(null);
  const [winner, setWinner]   = useState<"player"|"bot"|null>(null);
  const [log, setLog]         = useState<string[]>([]);
  const [entryFee]            = useState(initialFee);
  const botTimer              = useRef<ReturnType<typeof setTimeout> | null>(null);

  function addLog(msg: string) {
    setLog(prev => [msg, ...prev].slice(0, 24));
  }

  function handleMatchFound() {
    setPhase("playing");
    addLog("🎮 Match found! Bot player joined.");
    addLog("👤 You go first — roll the dice!");
  }

  // Step-by-step token animation
  async function animateMove(
    current: number,
    target: number,
    setAnim: (p: number) => void,
  ): Promise<void> {
    const steps = target - current;
    if (steps <= 0) return;
    for (let i = 1; i <= steps; i++) {
      setAnim(current + i);
      await new Promise(r => setTimeout(r, 85));
    }
  }

  // Roll dice animation helper (shared)
  async function rollDiceAnim(): Promise<number> {
    const rolled = Math.floor(Math.random() * 6) + 1;
    setRolling(true);
    let ticks = 0;
    await new Promise<void>(resolve => {
      const iv = setInterval(() => {
        setDice(Math.floor(Math.random() * 6) + 1);
        if (++ticks >= 7) { clearInterval(iv); setDice(rolled); setRolling(false); resolve(); }
      }, 90);
    });
    return rolled;
  }

  const processRoll = useCallback(async (who: 0 | 1, rolled: number) => {
    setIsMoving(true);
    const curPos = who === 0 ? pos1 : pos2;
    let   newPos = curPos + rolled;

    if (newPos > WIN_POS) {
      newPos = WIN_POS - (newPos - WIN_POS);
      addLog(`${who === 0 ? "👤 You" : "🤖 Bot"} bounced — too close to 100!`);
    }

    // Animate step by step
    const setAnim = who === 0 ? setAnimPos1 : setAnimPos2;
    await animateMove(curPos, newPos, setAnim);
    if (who === 0) setPos1(newPos); else setPos2(newPos);

    // Snake or Ladder
    const snakeTarget  = SNAKES[newPos];
    const ladderTarget = LADDERS[newPos];
    const evtType: "snake" | "ladder" | null =
      snakeTarget != null ? "snake" : ladderTarget != null ? "ladder" : null;
    const finalPos = snakeTarget ?? ladderTarget ?? newPos;

    if (evtType) {
      const whoStr = who === 0 ? "player" : "bot";
      setEvent({ type: evtType, who: whoStr, from: newPos, to: finalPos });
      addLog(
        `${who === 0 ? "👤 You" : "🤖 Bot"} hit ${evtType === "snake" ? "🐍" : "🪜"} at ${newPos} → ${finalPos}`
      );
      await new Promise(r => setTimeout(r, 350));
      setAnim(finalPos);
      if (who === 0) setPos1(finalPos); else setPos2(finalPos);
      await new Promise(r => setTimeout(r, 600));
      setEvent(null);
    } else {
      addLog(`${who === 0 ? "👤 You" : "🤖 Bot"} rolled ${rolled} → cell ${finalPos}`);
    }

    setIsMoving(false);

    if (finalPos >= WIN_POS) {
      const winnerStr = who === 0 ? "player" : "bot";
      setWinner(winnerStr);
      setPhase("result");
      if (winnerStr === "player") {
        const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
        addWinning(prize, `🐍 Snake & Ladder — Won ₹${prize}`);
        addLog(`🏆 You won ₹${prize}! Congrats!`);
      } else {
        addLog("💔 Bot reached 100 first. Better luck next time!");
      }
      return;
    }

    setTurn(who === 0 ? 1 : 0);
  }, [pos1, pos2, entryFee, addWinning]);

  // Player roll
  async function handlePlayerRoll() {
    if (turn !== 0 || rolling || isMoving || phase !== "playing") return;
    const rolled = await rollDiceAnim();
    addLog(`👤 You rolled a ${rolled}`);
    await processRoll(0, rolled);
  }

  // Bot turn
  useEffect(() => {
    if (turn !== 1 || isMoving || rolling || phase !== "playing" || winner) return;
    botTimer.current = setTimeout(async () => {
      const rolled = await rollDiceAnim();
      addLog(`🤖 Bot rolled a ${rolled}`);
      await processRoll(1, rolled);
    }, 1100 + Math.random() * 900);
    return () => { if (botTimer.current) clearTimeout(botTimer.current); };
  }, [turn, isMoving, rolling, phase, winner, processRoll]);

  // Rematch
  function handleRematch() {
    setPhase("matchmaking");
    setPos1(0); setPos2(0);
    setAnimPos1(0); setAnimPos2(0);
    setTurn(0); setDice(1);
    setRolling(false); setIsMoving(false);
    setEvent(null); setWinner(null); setLog([]);
  }

  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
  const canRoll = turn === 0 && !rolling && !isMoving && phase === "playing";

  return (
    <div
      className="flex flex-col min-h-screen relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at top, #160a2e 0%, #07060e 60%)",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(7,6,14,0.92)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 cursor-pointer"
          style={{ color: "rgba(255,255,255,0.55)" }}
        >
          <span className="text-lg">←</span>
          <span className="text-sm font-bold">Games</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xl">🐍</span>
          <span className="font-black text-white text-base">Snake & Ladder</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.22)" }}>
          <span className="text-xs">💰</span>
          <span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {/* ── Matchmaking ── */}
      {phase === "matchmaking" && (
        <MatchmakingScreen entryFee={entryFee} onFound={handleMatchFound} />
      )}

      {/* ── Playing ── */}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Turn indicator bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 gap-2"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>

            {/* Player card */}
            <motion.div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
              animate={turn === 0
                ? { background: "rgba(255,215,0,0.12)", borderColor: "rgba(255,215,0,0.45)" }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)" }}>👤</div>
              <div>
                <div className="text-xs font-black text-white">You</div>
                <div className="text-[10px]" style={{ color: "rgba(255,215,0,0.65)" }}>
                  Cell {animPos1 || 0}/100
                </div>
              </div>
              {turn === 0 && (
                <motion.div
                  className="ml-auto w-2 h-2 rounded-full"
                  style={{ background: "#FFD700" }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
              )}
            </motion.div>

            {/* Prize */}
            <div className="text-center flex-shrink-0">
              <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>PRIZE</div>
              <div className="text-sm font-black" style={{ color: "#22c55e" }}>₹{prize}</div>
            </div>

            {/* Bot card */}
            <motion.div
              className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl flex-row-reverse"
              animate={turn === 1
                ? { background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.4)" }
                : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }}
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}>🤖</div>
              <div className="text-right">
                <div className="text-xs font-black text-white">Bot</div>
                <div className="text-[10px]" style={{ color: "rgba(239,68,68,0.65)" }}>
                  Cell {animPos2 || 0}/100
                </div>
              </div>
              {turn === 1 && (
                <motion.div
                  className="mr-auto w-2 h-2 rounded-full"
                  style={{ background: "#ef4444" }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 0.7, repeat: Infinity }}
                />
              )}
            </motion.div>
          </div>

          {/* Board */}
          <div className="flex-shrink-0 px-2 pt-2">
            <GameBoard animPos1={animPos1 || 0} animPos2={animPos2 || 0} turn={turn} />
          </div>

          {/* Glassmorphism control panel */}
          <div className="flex-shrink-0 mx-2 mt-2 px-4 py-3 rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}>
            <div className="flex items-center gap-4">
              {/* Dice + label */}
              <div className="flex items-center gap-3">
                <Dice3D value={dice} rolling={rolling} whose={turn === 0 ? "player" : "bot"} />
                <div>
                  <div className="text-xs font-black" style={{
                    color: rolling ? "rgba(255,215,0,0.8)" : turn === 0 ? "#FFD700" : "rgba(239,68,68,0.8)",
                  }}>
                    {rolling ? "Rolling..." : isMoving ? "Moving..." : turn === 0 ? "Your Turn!" : "Bot's Turn"}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {turn === 0 ? "Tap ROLL to play" : "Please wait..."}
                  </div>
                </div>
              </div>

              {/* Roll button */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={handlePlayerRoll}
                disabled={!canRoll}
                className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
                style={{
                  background: canRoll
                    ? "linear-gradient(135deg, #FFD700, #ff8c00)"
                    : "rgba(255,255,255,0.06)",
                  color: canRoll ? "#000" : "rgba(255,255,255,0.2)",
                  boxShadow: canRoll ? "0 0 28px rgba(255,215,0,0.5)" : "none",
                  border: canRoll ? "none" : "1px solid rgba(255,255,255,0.08)",
                  letterSpacing: "0.04em",
                }}
              >
                {canRoll && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.28) 50%, transparent 65%)" }}
                    animate={{ x: ["-120%", "220%"] }}
                    transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 0.7 }}
                  />
                )}
                {rolling ? "🎲 Rolling..." : isMoving ? "Moving..." : canRoll ? "🎲 ROLL DICE" : "⏳ Wait..."}
              </motion.button>
            </div>
          </div>

          {/* Match log */}
          <div className="flex-1 mx-2 mt-2 mb-2 rounded-xl overflow-hidden"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              minHeight: 70,
              maxHeight: 110,
            }}>
            <div className="px-3 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-[9px] font-black tracking-widest" style={{ color: "rgba(255,255,255,0.28)" }}>
                📋 MATCH LOG
              </span>
            </div>
            <div className="overflow-y-auto px-3 py-2 flex flex-col gap-0.5" style={{ maxHeight: 80 }}>
              <AnimatePresence initial={false}>
                {log.map((entry, i) => (
                  <motion.div
                    key={entry + i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-xs"
                    style={{ color: i === 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.28)" }}
                  >
                    {entry}
                  </motion.div>
                ))}
              </AnimatePresence>
              {log.length === 0 && (
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Game events will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <ResultScreen
          won={winner === "player"}
          entryFee={entryFee}
          onBack={onBack}
          onRematch={handleRematch}
        />
      )}

      {/* ── Event popup ── */}
      <AnimatePresence>
        {event && (
          <EventPopup
            key="evt"
            type={event.type}
            who={event.who}
            from={event.from}
            to={event.to}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
