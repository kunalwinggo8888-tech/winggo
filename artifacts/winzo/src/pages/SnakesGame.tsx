/**
 * SnakesGame — WINGGO Premium Snake & Ladder (Sapsidi)
 * WinZO-style gameplay: 2-player vs smart bot, wallet-integrated,
 * animated board, matchmaking, win/loss rewards.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useAuth } from "@/context/useAuth";

// ─── BOARD CONFIG ──────────────────────────────────────────────────────────────

const SNAKES: Record<number, number> = {
  97: 78, 95: 56, 88: 24, 74: 53,
  62: 18, 48: 26, 36: 6,  32: 10,
};
const LADDERS: Record<number, number> = {
  2: 38, 7: 14,  8: 30, 28: 76,
  40: 59, 51: 67, 63: 81, 71: 91,
};

const WIN_POS = 100;
const PLATFORM_PCT = 0.10;

// ─── CELL GEOMETRY ────────────────────────────────────────────────────────────

/** Returns (x%, y%) center of a cell (1–100) as percentage of board width/height */
function cellPct(cell: number): { x: number; y: number } {
  const idx  = cell - 1;
  const bRow = Math.floor(idx / 10);     // 0 = bottom row
  const bCol = idx % 10;
  const rtl  = bRow % 2 === 1;
  const dCol = rtl ? 9 - bCol : bCol;   // display column (left→right)
  const dRow = 9 - bRow;                // display row (0 = top)
  return {
    x: (dCol + 0.5) * 10,   // %
    y: (dRow + 0.5) * 10,   // %
  };
}

/** Cell number at display grid position (row 0 = top, col 0 = left) */
function cellAt(dRow: number, dCol: number): number {
  const bRow = 9 - dRow;
  const rtl  = bRow % 2 === 1;
  const bCol = rtl ? 9 - dCol : dCol;
  return bRow * 10 + bCol + 1;
}

// ─── DICE ─────────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 22], [72, 22], [28, 50], [72, 50], [28, 78], [72, 78]],
};

function DiceFace({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <motion.div
      className="relative flex-shrink-0"
      style={{
        width: 56, height: 56,
        borderRadius: 12,
        background: "linear-gradient(135deg, #1a1a2e, #0d0d1a)",
        border: "2px solid rgba(255,215,0,0.5)",
        boxShadow: "0 0 16px rgba(255,215,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
      animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.1, 0.9, 1.1, 1] } : {}}
      transition={{ duration: 0.4, repeat: rolling ? Infinity : 0 }}
    >
      <svg viewBox="0 0 100 100" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {(PIPS[value] || []).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={10} fill="#FFD700" />
        ))}
      </svg>
    </motion.div>
  );
}

// ─── SNAKE / LADDER SVG PATHS ─────────────────────────────────────────────────

function SnakePath({ from, to }: { from: number; to: number }) {
  const h = cellPct(from);
  const t = cellPct(to);
  const mx = (h.x + t.x) / 2;
  const my = (h.y + t.y) / 2;
  const d = `M${h.x},${h.y} C${mx + 12},${my - 10} ${mx - 12},${my + 10} ${t.x},${t.y}`;
  return (
    <path d={d} fill="none" stroke="rgba(239,68,68,0.75)" strokeWidth="2.5"
      strokeLinecap="round" strokeDasharray="none" />
  );
}

function LadderPath({ from, to }: { from: number; to: number }) {
  const b = cellPct(from);
  const tp = cellPct(to);
  const dx = 1.8; // rail offset %
  const rungs = 4;
  return (
    <g>
      <line x1={`${b.x - dx}%`} y1={`${b.y}%`} x2={`${tp.x - dx}%`} y2={`${tp.y}%`}
        stroke="rgba(255,215,0,0.7)" strokeWidth="2" strokeLinecap="round" />
      <line x1={`${b.x + dx}%`} y1={`${b.y}%`} x2={`${tp.x + dx}%`} y2={`${tp.y}%`}
        stroke="rgba(255,215,0,0.7)" strokeWidth="2" strokeLinecap="round" />
      {Array.from({ length: rungs }, (_, i) => {
        const t2 = (i + 1) / (rungs + 1);
        const rx = b.x + (tp.x - b.x) * t2;
        const ry = b.y + (tp.y - b.y) * t2;
        return (
          <line key={i}
            x1={`${rx - dx}%`} y1={`${ry}%`} x2={`${rx + dx}%`} y2={`${ry}%`}
            stroke="rgba(255,215,0,0.5)" strokeWidth="1.5" />
        );
      })}
    </g>
  );
}

// ─── BOARD ────────────────────────────────────────────────────────────────────

const SNAKE_CELLS = new Set(Object.keys(SNAKES).map(Number));
const LADDER_CELLS = new Set(Object.keys(LADDERS).map(Number));

function GameBoard({ pos1, pos2, animPos1, animPos2 }: {
  pos1: number; pos2: number; animPos1: number; animPos2: number;
}) {
  const p1 = animPos1 > 0 ? cellPct(animPos1) : null;
  const p2 = animPos2 > 0 ? cellPct(animPos2) : null;

  return (
    <div className="relative w-full" style={{ aspectRatio: "1", userSelect: "none" }}>
      {/* ── Cell grid ── */}
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: "repeat(10, 1fr)", gridTemplateRows: "repeat(10, 1fr)" }}>
        {Array.from({ length: 10 }, (_, dRow) =>
          Array.from({ length: 10 }, (_, dCol) => {
            const num = cellAt(dRow, dCol);
            const isSnakeHead = SNAKE_CELLS.has(num);
            const isLadder    = LADDER_CELLS.has(num);
            const parity      = (dRow + dCol) % 2 === 0;
            const isWin       = num === 100;
            return (
              <div
                key={`${dRow}-${dCol}`}
                className="relative flex items-center justify-center overflow-hidden"
                style={{
                  background: isWin
                    ? "rgba(255,215,0,0.15)"
                    : isSnakeHead
                    ? "rgba(239,68,68,0.08)"
                    : isLadder
                    ? "rgba(34,197,94,0.07)"
                    : parity
                    ? "rgba(255,255,255,0.025)"
                    : "rgba(0,0,0,0.18)",
                  border: "0.5px solid rgba(255,215,0,0.1)",
                }}
              >
                <span style={{
                  fontSize: "clamp(6px,1.2vw,9px)",
                  fontWeight: 800,
                  color: isWin ? "#FFD700" : isSnakeHead ? "rgba(239,68,68,0.7)" : isLadder ? "rgba(34,197,94,0.7)" : "rgba(255,255,255,0.3)",
                  lineHeight: 1,
                }}>
                  {num === 100 ? "🏆" : num}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* ── SVG overlay: snakes + ladders ── */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" overflow="visible">
        {Object.entries(LADDERS).map(([from, to]) => (
          <LadderPath key={`l-${from}`} from={Number(from)} to={to} />
        ))}
        {Object.entries(SNAKES).map(([from, to]) => (
          <SnakePath key={`s-${from}`} from={Number(from)} to={to} />
        ))}
      </svg>

      {/* ── Player tokens ── */}
      {p1 && (
        <motion.div
          className="absolute flex items-center justify-center font-black text-xs z-20"
          style={{
            left: `${p1.x}%`, top: `${p1.y}%`,
            transform: "translate(-50%,-50%)",
            width: "clamp(20px,5.5vw,26px)", height: "clamp(20px,5.5vw,26px)",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #FFD700, #ff8c00)",
            border: "2px solid #fff",
            boxShadow: "0 0 12px rgba(255,215,0,0.8), 0 0 24px rgba(255,215,0,0.4)",
            zIndex: 20,
          }}
          animate={{ left: `${p1.x}%`, top: `${p1.y}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
        >
          👤
        </motion.div>
      )}
      {p2 && (
        <motion.div
          className="absolute flex items-center justify-center font-black text-xs z-10"
          style={{
            left: `${p2.x + 2}%`, top: `${p2.y + 2}%`,
            transform: "translate(-50%,-50%)",
            width: "clamp(18px,5vw,24px)", height: "clamp(18px,5vw,24px)",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444, #b91c1c)",
            border: "2px solid #fff",
            boxShadow: "0 0 12px rgba(239,68,68,0.8), 0 0 24px rgba(239,68,68,0.4)",
            zIndex: 10,
          }}
          animate={{ left: `${p2.x + 2}%`, top: `${p2.y + 2}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
        >
          🤖
        </motion.div>
      )}
    </div>
  );
}

// ─── MATCHMAKING SCREEN ───────────────────────────────────────────────────────

function MatchmakingScreen({ entryFee, onFound }: { entryFee: number; onFound: () => void }) {
  const [dots, setDots] = useState(".");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const di = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 500);
    const ci = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(ci); setTimeout(onFound, 300); return 0; }
        return c - 1;
      });
    }, 900);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [onFound]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
      {/* Pulsing spinner */}
      <div className="relative">
        <motion.div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{
            background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
            border: "2px solid rgba(34,197,94,0.4)",
            boxShadow: "0 0 40px rgba(34,197,94,0.3)",
          }}
          animate={{ scale: [1, 1.06, 1], boxShadow: ["0 0 30px rgba(34,197,94,0.25)", "0 0 55px rgba(34,197,94,0.5)", "0 0 30px rgba(34,197,94,0.25)"] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          🔍
        </motion.div>
        {/* Rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ border: "2px dashed rgba(34,197,94,0.35)" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="text-center">
        <div className="text-white font-black text-xl">Finding Opponent{dots}</div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          Searching nearby players
        </div>
      </div>

      {/* Entry fee display */}
      <div className="px-6 py-3 rounded-2xl flex items-center gap-3"
        style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.25)" }}>
        <span className="text-xl">💰</span>
        <div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.5)" }}>ENTRY FEE</div>
          <div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{entryFee}</div>
        </div>
        <div className="h-8 w-px mx-2" style={{ background: "rgba(255,215,0,0.2)" }} />
        <div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.5)" }}>YOU WIN</div>
          <div className="text-xl font-black" style={{ color: "#22c55e" }}>
            ₹{Math.floor(entryFee * 2 * (1 - PLATFORM_PCT))}
          </div>
        </div>
      </div>

      {/* Simulated player cards */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.25)" }}>
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)" }}>👤</div>
          <div className="text-xs font-black text-white">You</div>
          <div className="text-[10px]" style={{ color: "rgba(34,197,94,0.7)" }}>● Ready</div>
        </div>
        <div className="text-2xl font-black" style={{ color: "rgba(255,255,255,0.3)" }}>VS</div>
        <div className="flex-1 flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <motion.div
            className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
            style={{ background: "rgba(255,255,255,0.1)", border: "2px dashed rgba(255,255,255,0.2)" }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity }}
          >❓</motion.div>
          <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Searching</div>
          <div className="text-[10px]" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ {countdown}s</div>
        </div>
      </div>
    </div>
  );
}

// ─── EVENT POPUP ──────────────────────────────────────────────────────────────

function EventPopup({ event, who }: { event: "snake" | "ladder" | null; who: "player" | "bot" }) {
  if (!event) return null;
  const isSnake = event === "snake";
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none"
      style={{ maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.2 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex flex-col items-center gap-2 px-8 py-5 rounded-3xl text-center"
        style={{
          background: isSnake ? "rgba(239,68,68,0.95)" : "rgba(34,197,94,0.95)",
          boxShadow: isSnake ? "0 0 40px rgba(239,68,68,0.6)" : "0 0 40px rgba(34,197,94,0.6)",
          backdropFilter: "blur(10px)",
        }}>
        <span className="text-5xl">{isSnake ? "🐍" : "🪜"}</span>
        <div className="font-black text-white text-xl">
          {isSnake ? "Bitten by Snake!" : "Climbed the Ladder!"}
        </div>
        <div className="text-white/80 text-sm">
          {who === "player" ? "You" : "Opponent"} {isSnake ? "slid down!" : "zoomed up!"}
        </div>
      </div>
    </motion.div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────

function ResultScreen({
  won, entryFee, onBack, onRematch,
}: {
  won: boolean; entryFee: number; onBack: () => void; onRematch: () => void;
}) {
  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
  return (
    <motion.div
      className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Trophy / Loss icon */}
      <motion.div
        className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
        style={{
          background: won
            ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,140,0,0.1))"
            : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.08))",
          border: won
            ? "3px solid rgba(255,215,0,0.5)"
            : "3px solid rgba(239,68,68,0.4)",
          boxShadow: won
            ? "0 0 50px rgba(255,215,0,0.4), 0 0 100px rgba(255,215,0,0.15)"
            : "0 0 40px rgba(239,68,68,0.3)",
        }}
        animate={won ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {won ? "🏆" : "💔"}
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <div
          className="font-black text-3xl"
          style={{
            color: won ? "#FFD700" : "#ef4444",
            textShadow: won ? "0 0 20px rgba(255,215,0,0.6)" : "0 0 16px rgba(239,68,68,0.4)",
          }}
        >
          {won ? "You Won! 🎉" : "Better Luck!"}
        </div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          {won ? "Excellent play! Keep winning!" : "The snake got you this time!"}
        </div>
      </div>

      {/* Prize card */}
      <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>Entry Fee</span>
          <span className="font-black" style={{ color: "rgba(255,255,255,0.7)" }}>₹{entryFee}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>Platform Fee (10%)</span>
          <span className="font-black" style={{ color: "rgba(255,255,255,0.4)" }}>-₹{entryFee * 2 - prize}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-4"
          style={{ background: won ? "rgba(255,215,0,0.06)" : "rgba(239,68,68,0.05)" }}>
          <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
          <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>
            {won ? `+₹${prize}` : `-₹${entryFee}`}
          </span>
        </div>
      </div>

      {/* CTA buttons */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onRematch}
        className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #22c55e, #15803d)",
          color: "#fff",
          boxShadow: "0 0 24px rgba(34,197,94,0.4)",
          letterSpacing: "0.05em",
        }}
      >
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.2) 50%, transparent 65%)" }}
          animate={{ x: ["-120%", "220%"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1 }} />
        🎮 Play Again
      </motion.button>

      <button
        onClick={onBack}
        className="text-sm font-bold cursor-pointer"
        style={{ color: "rgba(255,255,255,0.35)" }}
      >
        ← Back to Games
      </button>
    </motion.div>
  );
}

// ─── MAIN GAME COMPONENT ──────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  initialFee?: number;
}

type Phase = "matchmaking" | "playing" | "result";

export default function SnakesGame({ onBack, initialFee = 10 }: Props) {
  const { total, deductFee, addWinning } = useWallet();
  const { user } = useAuth();

  // ── State ──
  const [phase, setPhase]             = useState<Phase>("matchmaking");
  const [pos1, setPos1]               = useState(0);   // player pos (0 = not started)
  const [pos2, setPos2]               = useState(0);   // bot pos
  const [animPos1, setAnimPos1]       = useState(0);   // animated display pos (player)
  const [animPos2, setAnimPos2]       = useState(0);   // animated display pos (bot)
  const [turn, setTurn]               = useState(0);   // 0 = player, 1 = bot
  const [dice, setDice]               = useState(1);
  const [rolling, setRolling]         = useState(false);
  const [isMoving, setIsMoving]       = useState(false);
  const [event, setEvent]             = useState<{ who: "player" | "bot"; type: "snake" | "ladder" } | null>(null);
  const [winner, setWinner]           = useState<"player" | "bot" | null>(null);
  const [log, setLog]                 = useState<string[]>([]);
  const [feeDeducted, setFeeDeducted] = useState(false);
  const [entryFee]                    = useState(initialFee);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Deduct fee on game start ──
  useEffect(() => {
    if (phase === "playing" && !feeDeducted) {
      deductFee(entryFee, `🐍 Snake & Ladder — Entry ₹${entryFee}`);
      setFeeDeducted(true);
    }
  }, [phase, feeDeducted, deductFee, entryFee]);

  // ── Matchmaking complete ──
  function handleMatchFound() {
    setPhase("playing");
    addLog("🎮 Match found! Bot player joined.");
    addLog("👤 You go first — roll the dice!");
  }

  function addLog(msg: string) {
    setLog(prev => [msg, ...prev].slice(0, 20));
  }

  // ── Move token step by step ──
  async function animateMove(
    current: number,
    steps: number,
    setAnim: (p: number) => void,
  ): Promise<number> {
    let pos = current;
    for (let i = 0; i < steps; i++) {
      pos = Math.min(pos + 1, WIN_POS);
      setAnim(pos);
      await new Promise(r => setTimeout(r, 90));
    }
    return pos;
  }

  // ── Core: process a roll for a player ──
  const processRoll = useCallback(async (who: 0 | 1, rolled: number) => {
    setIsMoving(true);
    const curPos = who === 0 ? pos1 : pos2;
    let   newPos = curPos + rolled;

    // Bounce back if overshoots 100
    if (newPos > WIN_POS) {
      newPos = WIN_POS - (newPos - WIN_POS);
      addLog(`${who === 0 ? "👤 You" : "🤖 Bot"} bounced! Dice ${rolled} → stay near ${WIN_POS}`);
    }

    const steps = newPos - curPos;
    if (steps > 0) {
      if (who === 0) {
        const landed = await animateMove(curPos, steps, setAnimPos1);
        setPos1(landed);
      } else {
        const landed = await animateMove(curPos, steps, setAnimPos2);
        setPos2(landed);
      }
    }

    // Snake or Ladder check
    const snakeTarget  = SNAKES[newPos];
    const ladderTarget = LADDERS[newPos];
    const evtType: "snake" | "ladder" | null = snakeTarget ? "snake" : ladderTarget ? "ladder" : null;
    const finalPos = snakeTarget ?? ladderTarget ?? newPos;

    if (evtType) {
      const whoStr = who === 0 ? "player" : "bot";
      setEvent({ who: whoStr, type: evtType });
      addLog(`${who === 0 ? "👤 You" : "🤖 Bot"} hit a ${evtType === "snake" ? "🐍 Snake" : "🪜 Ladder"}! ${evtType === "snake" ? "Slid down" : "Climbed up"} to ${finalPos}`);
      await new Promise(r => setTimeout(r, 300));
      // Animate to final position
      if (who === 0) {
        setAnimPos1(finalPos);
        setPos1(finalPos);
      } else {
        setAnimPos2(finalPos);
        setPos2(finalPos);
      }
      await new Promise(r => setTimeout(r, 500));
      setEvent(null);
    } else {
      addLog(`${who === 0 ? "👤 You" : "🤖 Bot"} rolled ${rolled} → moved to ${finalPos}`);
      if (who === 0) setPos1(finalPos);
      else setPos2(finalPos);
    }

    setIsMoving(false);

    // Win check
    if (finalPos >= WIN_POS) {
      const winnerStr = who === 0 ? "player" : "bot";
      setWinner(winnerStr);
      setPhase("result");
      if (winnerStr === "player") {
        const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
        addWinning(prize, `🐍 Snake & Ladder — Won ₹${prize}`);
        addLog(`🏆 You won ₹${prize}!`);
      } else {
        addLog("💔 Bot reached 100 first. Better luck next time!");
      }
      return;
    }

    // Switch turn
    setTurn(who === 0 ? 1 : 0);
  }, [pos1, pos2, entryFee, addWinning]);

  // ── Player roll ──
  async function handlePlayerRoll() {
    if (turn !== 0 || rolling || isMoving || phase !== "playing") return;
    const rolled = Math.floor(Math.random() * 6) + 1;
    setRolling(true);
    // Animate dice cycling for 600ms
    let ticks = 0;
    const interval = setInterval(() => {
      setDice(Math.floor(Math.random() * 6) + 1);
      if (++ticks >= 6) { clearInterval(interval); setDice(rolled); setRolling(false); }
    }, 100);
    await new Promise(r => setTimeout(r, 700));
    addLog(`👤 You rolled a ${rolled}`);
    await processRoll(0, rolled);
  }

  // ── Bot turn ──
  useEffect(() => {
    if (turn !== 1 || isMoving || rolling || phase !== "playing" || winner) return;

    botTimer.current = setTimeout(async () => {
      // Bot "thinking" — animate dice
      const rolled = Math.floor(Math.random() * 6) + 1;
      setRolling(true);
      let ticks = 0;
      const iv = setInterval(() => {
        setDice(Math.floor(Math.random() * 6) + 1);
        if (++ticks >= 6) { clearInterval(iv); setDice(rolled); setRolling(false); }
      }, 100);
      await new Promise(r => setTimeout(r, 700));
      addLog(`🤖 Bot rolled a ${rolled}`);
      await processRoll(1, rolled);
    }, 1200 + Math.random() * 800);

    return () => { if (botTimer.current) clearTimeout(botTimer.current); };
  }, [turn, isMoving, rolling, phase, winner, processRoll]);

  // ── Rematch ──
  function handleRematch() {
    setPhase("matchmaking");
    setPos1(0); setPos2(0);
    setAnimPos1(0); setAnimPos2(0);
    setTurn(0);
    setDice(1);
    setRolling(false);
    setIsMoving(false);
    setEvent(null);
    setWinner(null);
    setLog([]);
    setFeeDeducted(false);
  }

  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));

  return (
    <div
      className="flex flex-col min-h-screen relative overflow-hidden"
      style={{ background: "#07060e", maxWidth: 480, margin: "0 auto" }}
    >
      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{
          background: "rgba(7,6,14,0.95)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <button
          onClick={onBack}
          className="flex items-center gap-2 cursor-pointer"
          style={{ color: "rgba(255,255,255,0.6)" }}
        >
          <span className="text-lg">←</span>
          <span className="text-sm font-bold">Games</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xl">🐍</span>
          <span className="font-black text-white text-base">Snake & Ladder</span>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
          <span className="text-xs">💰</span>
          <span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {/* ── Phase: Matchmaking ── */}
      {phase === "matchmaking" && (
        <MatchmakingScreen entryFee={entryFee} onFound={handleMatchFound} />
      )}

      {/* ── Phase: Playing ── */}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Score bar */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-2"
            style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)" }}>👤</div>
              <div>
                <div className="text-xs font-black text-white">You</div>
                <div className="text-[10px]" style={{ color: "rgba(255,215,0,0.7)" }}>
                  Cell {animPos1 || 0}/100
                </div>
              </div>
            </div>

            <div className="text-center">
              <div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>PRIZE</div>
              <div className="text-base font-black" style={{ color: "#22c55e" }}>₹{prize}</div>
            </div>

            <div className="flex items-center gap-2">
              <div>
                <div className="text-xs font-black text-white text-right">Bot</div>
                <div className="text-[10px] text-right" style={{ color: "rgba(239,68,68,0.7)" }}>
                  Cell {animPos2 || 0}/100
                </div>
              </div>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)" }}>🤖</div>
            </div>
          </div>

          {/* Board */}
          <div className="flex-shrink-0 px-2 pt-2">
            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,215,0,0.15)", boxShadow: "0 0 40px rgba(0,0,0,0.6)" }}>
              <GameBoard pos1={pos1} pos2={pos2} animPos1={animPos1 || 0} animPos2={animPos2 || 0} />
            </div>
          </div>

          {/* Dice + turn controls */}
          <div className="flex-shrink-0 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Dice display */}
              <div className="flex items-center gap-3">
                <DiceFace value={dice} rolling={rolling} />
                <div>
                  <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {rolling ? "Rolling..." : turn === 0 ? "Your Turn" : "Bot's Turn"}
                  </div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                    {turn === 0 ? "Tap ROLL to play" : "Wait for bot..."}
                  </div>
                </div>
              </div>

              {/* Roll button */}
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handlePlayerRoll}
                disabled={turn !== 0 || rolling || isMoving}
                className="flex-1 py-3.5 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
                style={{
                  background: turn === 0 && !rolling && !isMoving
                    ? "linear-gradient(135deg, #FFD700, #ff8c00)"
                    : "rgba(255,255,255,0.06)",
                  color: turn === 0 && !rolling && !isMoving ? "#000" : "rgba(255,255,255,0.25)",
                  boxShadow: turn === 0 && !rolling && !isMoving ? "0 0 24px rgba(255,215,0,0.4)" : "none",
                  border: turn === 0 && !rolling && !isMoving ? "none" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                {(turn === 0 && !rolling && !isMoving) && (
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.25) 50%, transparent 65%)" }}
                    animate={{ x: ["-120%", "220%"] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.8 }} />
                )}
                {rolling ? "🎲 Rolling..." : isMoving ? "Moving..." : turn === 0 ? "🎲 ROLL DICE" : "⏳ Bot's Turn"}
              </motion.button>
            </div>
          </div>

          {/* Event log */}
          <div className="flex-1 mx-4 mb-3 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-3 py-2 border-b"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <span className="text-[10px] font-black tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                📋 MATCH LOG
              </span>
            </div>
            <div className="overflow-y-auto px-3 py-2 gap-1 flex flex-col" style={{ maxHeight: "120px" }}>
              {log.map((entry, i) => (
                <div key={i} className="text-xs" style={{ color: i === 0 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)" }}>
                  {entry}
                </div>
              ))}
              {log.length === 0 && (
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Game events will appear here...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: Result ── */}
      {phase === "result" && (
        <ResultScreen
          won={winner === "player"}
          entryFee={entryFee}
          onBack={onBack}
          onRematch={handleRematch}
        />
      )}

      {/* ── Snake / Ladder event popup ── */}
      <AnimatePresence>
        {event && <EventPopup key="evt" event={event.type} who={event.who} />}
      </AnimatePresence>
    </div>
  );
}
