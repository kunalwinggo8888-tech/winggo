/**
 * SaanpSidiGame — WINGGO Saanp Sidi · PREMIUM EDITION
 * Dark neon board · Glassmorphism UI · 20 moves each · God Mode bot at ₹20+
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Board config ──────────────────────────────────────────────────────────────
const SNAKES: Record<number, number> = {
  99: 21, 92: 37, 87: 24, 74: 53, 62: 18, 48: 26, 36: 6,
};
const LADDERS: Record<number, number> = {
  4: 25, 13: 46, 28: 76, 33: 68, 51: 67, 63: 81, 71: 91,
};

const MAX_MOVES = 20;
const BOT_NAMES = ["PriyaBot", "VikramBot", "NitaBot", "RajBot", "DevBot"];

// ── Dice helpers ──────────────────────────────────────────────────────────────
function normalDice(): number { return Math.ceil(Math.random() * 6); }

function godModeDice(pos: number): number {
  const scored = Array.from({ length: 6 }, (_, i) => {
    const roll = i + 1;
    const next = pos + roll;
    if (next > 100) return { roll, score: -50 };
    let score = roll;
    if (LADDERS[next]) score += 25;
    if (SNAKES[next])  score -= 40;
    return { roll, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const pick = Math.random() < 0.88 ? scored[0] : (scored[1] ?? scored[0]);
  return pick.roll;
}

// ── Bot tier ──────────────────────────────────────────────────────────────────
function botTier(fee: number): { label: string; color: string } {
  if (fee >= 20) return { label: "⚡ GOD MODE", color: "#ff3b5c" };
  if (fee >= 5)  return { label: "🔶 MEDIUM",   color: "#f97316" };
  return              { label: "🟢 EASY",        color: "#4ade80" };
}

// ── Cell position helper ──────────────────────────────────────────────────────
function cellPct(cell: number): { x: number; y: number } {
  const idx  = cell - 1;
  const bRow = Math.floor(idx / 10);
  const bCol = idx % 10;
  const rtl  = bRow % 2 === 1;
  const dCol = rtl ? 9 - bCol : bCol;
  const dRow = 9 - bRow;
  return { x: (dCol + 0.5) * 10, y: (dRow + 0.5) * 10 };
}

// ── Row colors — vivid neon palette ──────────────────────────────────────────
const ROW_COLORS = [
  "rgba(168,0,128,0.35)",
  "rgba(90,0,220,0.35)",
  "rgba(0,60,230,0.35)",
  "rgba(0,160,210,0.35)",
  "rgba(0,190,100,0.35)",
  "rgba(220,160,0,0.35)",
  "rgba(230,80,0,0.35)",
  "rgba(220,20,20,0.35)",
  "rgba(170,0,130,0.35)",
  "rgba(100,0,200,0.35)",
];

// ── Premium 3D Dice ───────────────────────────────────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

function Dice3D({ value, rolling, size = 66 }: { value: number; rolling: boolean; size?: number }) {
  const dots = PIPS[value] ?? PIPS[1];
  const pip  = size * 0.13;
  return (
    <motion.div
      animate={rolling
        ? { rotate: [0, -32, 32, -20, 20, -10, 10, 0], scale: [1, 1.26, 0.83, 1.17, 0.91, 1.08, 1], y: [0, -16, 6, -10, 3, -4, 0] }
        : { rotate: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.72 }}
      style={{
        width: size, height: size,
        borderRadius: size * 0.2,
        background: "linear-gradient(145deg, #ffffff, #e8e8f0)",
        boxShadow: rolling
          ? `5px 5px 16px rgba(0,0,0,0.7), inset -3px -3px 7px rgba(0,0,0,0.1), inset 3px 3px 7px rgba(255,255,255,0.9), 0 0 40px rgba(17,200,160,0.9), 0 0 80px rgba(17,200,160,0.4)`
          : `4px 4px 14px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(0,0,0,0.1), inset 2px 2px 6px rgba(255,255,255,0.9), 0 0 22px rgba(17,200,160,0.5)`,
        flexShrink: 0, overflow: "hidden",
        transition: "box-shadow 0.3s",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <radialGradient id="ss-pip" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#002e22" />
            <stop offset="100%" stopColor="#000f0a" />
          </radialGradient>
        </defs>
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={pip * 50} fill="url(#ss-pip)" />
        ))}
      </svg>
    </motion.div>
  );
}

// ── Premium Board SVG ─────────────────────────────────────────────────────────
function Board({ pPos, bPos }: { pPos: number; bPos: number }) {
  const cells = [] as React.ReactElement[];

  for (let dRow = 0; dRow < 10; dRow++) {
    for (let dCol = 0; dCol < 10; dCol++) {
      const bRow = 9 - dRow;
      const rtl  = bRow % 2 === 1;
      const bCol = rtl ? 9 - dCol : dCol;
      const cell = bRow * 10 + bCol + 1;
      const { x, y } = cellPct(cell);
      const isSnake     = cell in SNAKES;
      const isLadder    = cell in LADDERS;
      const isSnakeTail = Object.values(SNAKES).includes(cell);
      const isLadderTop = Object.values(LADDERS).includes(cell);
      const pHere = pPos === cell;
      const bHere = bPos === cell;

      cells.push(
        <g key={cell}>
          {/* Cell background */}
          <rect
            x={`${x - 4.8}%`} y={`${y - 4.8}%`} width="9.6%" height="9.6%" rx="1.2"
            fill={isSnake ? "rgba(255,30,30,0.18)" : isLadder ? "rgba(255,210,0,0.18)" : ROW_COLORS[dRow]}
            stroke={isSnake ? "#ff5555" : isLadder ? "#FFD700" : "rgba(255,255,255,0.08)"}
            strokeWidth={isSnake || isLadder ? "0.55%" : "0.2%"}
          />
          {/* Cell number */}
          <text x={`${x}%`} y={`${y - 1.8}%`} textAnchor="middle" fontSize="2%"
            fill="rgba(255,255,255,0.6)" fontWeight="700">{cell}</text>

          {/* Emoji markers */}
          {isSnake    && <text x={`${x}%`} y={`${y + 3}%`} textAnchor="middle" fontSize="3.4%">🐍</text>}
          {isLadder   && <text x={`${x}%`} y={`${y + 3}%`} textAnchor="middle" fontSize="3.4%">🪜</text>}
          {isSnakeTail && !isSnake  && <text x={`${x}%`} y={`${y + 3}%`} textAnchor="middle" fontSize="2.6%">☠️</text>}
          {isLadderTop && !isLadder && <text x={`${x}%`} y={`${y + 3}%`} textAnchor="middle" fontSize="2.6%">⭐</text>}
        </g>
      );
    }
  }

  // Snake lines — vivid red dashed
  const snakeLines = Object.entries(SNAKES).map(([from, to]) => {
    const f = cellPct(Number(from));
    const t = cellPct(Number(to));
    return (
      <g key={`sl${from}`}>
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="#ff2222" strokeWidth="0.9%" strokeDasharray="1.5%,0.8%" opacity={0.55} />
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="#ff0000" strokeWidth="0.25%" opacity={0.4} />
      </g>
    );
  });

  // Ladder lines — glowing gold
  const ladderLines = Object.entries(LADDERS).map(([from, to]) => {
    const f = cellPct(Number(from));
    const t = cellPct(Number(to));
    return (
      <g key={`ll${from}`}>
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="#FFD700" strokeWidth="0.9%" opacity={0.5} />
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="#fff9c0" strokeWidth="0.25%" opacity={0.35} />
      </g>
    );
  });

  const pp       = pPos > 0 ? cellPct(pPos) : null;
  const bp       = bPos > 0 ? cellPct(bPos) : null;
  const sameCell = pPos > 0 && pPos === bPos;

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%"
      style={{ display: "block", borderRadius: 14, overflow: "hidden" }}>
      <defs>
        <filter id="ss-glow-p" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ss-glow-b" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#0a0a1e" />
          <stop offset="100%" stopColor="#04040f" />
        </radialGradient>
      </defs>

      {/* Dark background */}
      <rect width="100" height="100" fill="url(#bg-grad)" />
      {cells}
      {snakeLines}
      {ladderLines}

      {/* Start zone tokens (pos=0) */}
      {pPos === 0 && (
        <g>
          <circle cx="5%" cy="96%" r="3.8%" fill="#22c55e" stroke="rgba(255,255,255,0.8)"
            strokeWidth="0.7%" filter="url(#ss-glow-p)" />
          <text x="5%" y="97.5%" textAnchor="middle" fontSize="2.8%" fill="#000" fontWeight="bold">Y</text>
        </g>
      )}
      {bPos === 0 && (
        <g>
          <circle cx={pPos === 0 ? "13%" : "5%"} cy="96%" r="3.8%"
            fill="#f43f5e" stroke="rgba(255,255,255,0.8)" strokeWidth="0.7%" filter="url(#ss-glow-b)" />
          <text x={pPos === 0 ? "13%" : "5%"} y="97.5%" textAnchor="middle"
            fontSize="2.8%" fill="#fff" fontWeight="bold">B</text>
        </g>
      )}

      {/* Player token (green, Y) */}
      {pp && (
        <g>
          {/* Pulse ring */}
          <circle cx={`${sameCell ? pp.x - 2.5 : pp.x}%`} cy={`${pp.y}%`} r="5.5%"
            fill="none" stroke="rgba(34,197,94,0.4)" strokeWidth="0.6%">
            <animate attributeName="r" values="4.5%;6.5%;4.5%" dur="1.2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="1.2s" repeatCount="indefinite" />
          </circle>
          <circle cx={`${sameCell ? pp.x - 2.5 : pp.x}%`} cy={`${pp.y}%`} r="3.8%"
            fill="#22c55e" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7%" filter="url(#ss-glow-p)" />
          <text x={`${sameCell ? pp.x - 2.5 : pp.x}%`} y={`${pp.y + 1.3}%`}
            textAnchor="middle" fontSize="2.8%" fill="#000" fontWeight="bold">Y</text>
        </g>
      )}

      {/* Bot token (red, B) */}
      {bp && (
        <g>
          <circle cx={`${sameCell ? bp.x + 2.5 : bp.x}%`} cy={`${bp.y}%`} r="3.8%"
            fill="#f43f5e" stroke="rgba(255,255,255,0.9)" strokeWidth="0.7%" filter="url(#ss-glow-b)" />
          <text x={`${sameCell ? bp.x + 2.5 : bp.x}%`} y={`${bp.y + 1.3}%`}
            textAnchor="middle" fontSize="2.8%" fill="#fff" fontWeight="bold">B</text>
        </g>
      )}
    </svg>
  );
}

// ── Event badge ───────────────────────────────────────────────────────────────
type EventType = "ladder" | "snake" | "normal" | "over" | "none";
function getEventType(msg: string): EventType {
  if (msg.includes("🪜")) return "ladder";
  if (msg.includes("🐍")) return "snake";
  if (msg.includes("over 100")) return "over";
  return "normal";
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onBack: () => void; initialFee?: number }

export default function SaanpSidiGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();
  const isGodMode = initialFee >= 20;
  const botName   = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const scored    = useRef(false);
  const tier      = botTier(initialFee);

  const [phase,     setPhase]     = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [pPos,      setPPos]      = useState(0);
  const [bPos,      setBPos]      = useState(0);
  const [pScore,    setPScore]    = useState(0);
  const [bScore,    setBScore]    = useState(0);
  const [pMoves,    setPMoves]    = useState(0);
  const [bMoves,    setBMoves]    = useState(0);
  const [dice,      setDice]      = useState(1);
  const [rolling,   setRolling]   = useState(false);
  const [turn,      setTurn]      = useState<"player" | "bot">("player");
  const [logMsgs,   setLogMsgs]   = useState<string[]>(["🎮 Match started!"]);
  const [eventType, setEventType] = useState<EventType>("none");
  const [eventKey,  setEventKey]  = useState(0);

  function pushLog(msg: string) {
    setLogMsgs(prev => [msg, ...prev.slice(0, 5)]);
    setEventType(getEventType(msg));
    setEventKey(k => k + 1);
  }

  // Matchmaking
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const t = setTimeout(() => setPhase("playing"), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  // End condition
  useEffect(() => {
    if (phase !== "playing") return;
    if (pMoves >= MAX_MOVES && bMoves >= MAX_MOVES && !scored.current) {
      scored.current = true;
      setPhase("result");
      const won   = pScore >= bScore;
      const prize = won ? Math.floor(initialFee * 2 * 0.9) : 0;
      if (won) addWinning(prize);
      addMatch({
        gameId: "saanpsidi", gameName: "Saanp Sidi", gameIcon: "🐍",
        result: won ? "win" : "loss", entryFee: initialFee,
        prize, userScore: pScore, opponentScore: bScore,
        opponentName: botName.current, isGodMode,
      });
    }
  }, [pMoves, bMoves, phase, pScore, bScore]);

  function applyMove(pos: number, roll: number): { newPos: number; msg: string } {
    const target = pos + roll;
    if (target > 100) return { newPos: pos, msg: `Rolled ${roll} — over 100, no move!` };
    let newPos = target;
    let msg    = `Rolled ${roll} → sq.${target}`;
    if (LADDERS[newPos]) {
      const top = LADDERS[newPos];
      msg      += ` 🪜 Ladder! Up to ${top}`;
      newPos    = top;
    } else if (SNAKES[newPos]) {
      const tail = SNAKES[newPos];
      msg       += ` 🐍 Snake! Down to ${tail}`;
      newPos     = tail;
    }
    return { newPos, msg };
  }

  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || pMoves >= MAX_MOVES) return;
    const val = normalDice();
    setRolling(true);
    setDice(val);
    setTimeout(() => {
      setRolling(false);
      const { newPos, msg } = applyMove(pPos, val);
      setPPos(newPos);
      setPScore(newPos);
      setPMoves(m => m + 1);
      pushLog("🟢 You: " + msg);
      setTurn("bot");
    }, 740);
  }, [rolling, turn, pMoves, pPos]);

  // Bot turn
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES) { setTurn("player"); return; }
    const delay = 900 + Math.random() * 550;
    const t = setTimeout(() => {
      const val = isGodMode ? godModeDice(bPos) : normalDice();
      setDice(val);
      setRolling(true);
      setTimeout(() => {
        setRolling(false);
        const { newPos, msg } = applyMove(bPos, val);
        setBPos(newPos);
        setBScore(newPos);
        setBMoves(m => m + 1);
        pushLog(`🔴 ${botName.current}: ` + msg);
        setTurn("player");
      }, 740);
    }, delay);
    return () => clearTimeout(t);
  }, [turn, phase, bMoves, bPos, isGodMode]);

  const wonGame    = pScore >= bScore;
  const prize      = wonGame ? Math.floor(initialFee * 2 * 0.9) : 0;
  const pMovesLeft = MAX_MOVES - pMoves;
  const bMovesLeft = MAX_MOVES - bMoves;
  const canRoll    = turn === "player" && !rolling && pMoves < MAX_MOVES;

  // ── Matchmaking screen ──────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-6"
        style={{ background: "linear-gradient(180deg, #001a12 0%, #002218 60%, #001a12 100%)", maxWidth: 480, margin: "0 auto" }}>

        <motion.div
          initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180 }}
          className="text-8xl"
          style={{ filter: "drop-shadow(0 0 28px rgba(17,200,160,0.8))" }}>
          🐍
        </motion.div>

        <div className="text-center">
          <h2 className="text-4xl font-black text-white tracking-tight">SAANP SIDI</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-2"
            style={{ background: "rgba(17,200,160,0.12)", border: "1px solid rgba(17,200,160,0.35)" }}>
            <span className="text-sm font-black" style={{ color: "#11c8a0" }}>20 Moves · Score-Based</span>
          </div>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.38)" }}>
            Ladders boost · Snakes reduce · Highest wins
          </p>
        </div>

        {/* Bot tier */}
        <div className="px-5 py-2.5 rounded-2xl flex items-center gap-2"
          style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}40` }}>
          <span className="text-sm font-black" style={{ color: tier.color }}>{tier.label}</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>· ₹{initialFee}</span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-[3px]"
            style={{ borderColor: "#11c8a0", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Finding opponent…</p>
        </div>

        {/* Player slots */}
        <div className="flex gap-3 w-full max-w-xs">
          <div className="flex-1 p-3 rounded-2xl flex items-center gap-2"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span className="text-xs font-black text-white">You</span>
          </div>
          <div className="flex-1 p-3 rounded-2xl flex items-center gap-2"
            style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)" }}>
            <motion.div className="w-3 h-3 rounded-full" style={{ background: "#f43f5e" }}
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
            <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.6)" }}>Finding…</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Result screen ───────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6 gap-6"
        style={{ background: wonGame
          ? "linear-gradient(180deg, #001a08 0%, #002210 60%, #001a08 100%)"
          : "linear-gradient(180deg, #1a0008 0%, #220010 60%, #1a0008 100%)",
          maxWidth: 480, margin: "0 auto" }}>

        <motion.div
          initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="text-8xl"
          style={{ filter: wonGame ? "drop-shadow(0 0 28px rgba(34,197,94,0.9))" : "drop-shadow(0 0 24px rgba(255,59,92,0.8))" }}>
          {wonGame ? "🏆" : "🐍"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="text-5xl font-black"
          style={{ color: wonGame ? "#4ade80" : "#f43f5e", textShadow: wonGame ? "0 0 40px rgba(74,222,128,0.7)" : "0 0 30px rgba(244,63,94,0.7)" }}>
          {wonGame ? "YOU WIN!" : "YOU LOSE!"}
        </motion.h2>

        {/* Prize display */}
        {wonGame && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.25 }}
            className="px-8 py-3 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)", boxShadow: "0 0 30px rgba(255,215,0,0.2)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: "rgba(255,215,0,0.6)" }}>PRIZE WON</div>
            <div className="text-3xl font-black" style={{ color: "#FFD700" }}>+₹{prize}</div>
          </motion.div>
        )}

        {/* Score comparison */}
        <div className="flex gap-3 w-full max-w-sm">
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(34,197,94,0.08)", border: `2px solid ${wonGame ? "rgba(34,197,94,0.5)" : "rgba(34,197,94,0.15)"}` }}>
            <div className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: "#22c55e" }}>YOU</div>
            <div className="text-2xl font-black text-white mb-0.5">Sq.{pScore}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Final position</div>
          </div>
          <div className="flex self-center text-xl font-black" style={{ color: "rgba(255,255,255,0.18)" }}>VS</div>
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(244,63,94,0.08)", border: `2px solid ${!wonGame ? "rgba(244,63,94,0.5)" : "rgba(244,63,94,0.15)"}` }}>
            <div className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: "#f43f5e" }}>{botName.current}</div>
            <div className="text-2xl font-black text-white mb-0.5">Sq.{bScore}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Final position</div>
          </div>
        </div>

        <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
          {wonGame ? "You reached the higher square!" : isGodMode ? "The God Mode bot landed on every ladder!" : "Better luck next time!"}
        </p>

        <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
          className="w-full max-w-sm py-4 rounded-2xl font-black text-lg cursor-pointer"
          style={{ background: "linear-gradient(135deg,#11998e,#38ef7d)", color: "#000", boxShadow: "0 0 30px rgba(17,153,142,0.45)" }}>
          Back to Lobby
        </motion.button>
      </div>
    );
  }

  // ── Playing screen ──────────────────────────────────────────────────────────
  const eventColor =
    eventType === "ladder" ? "#FFD700" :
    eventType === "snake"  ? "#f43f5e" :
    eventType === "over"   ? "#94a3b8" : "rgba(255,255,255,0.5)";

  return (
    <div className="flex flex-col h-full"
      style={{ background: "linear-gradient(180deg, #001a12 0%, #000e0a 100%)", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 shrink-0">
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4l-4 4 4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.button>

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-black text-base text-white">🐍 SAANP SIDI</span>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}40` }}>
            {tier.label}
          </span>
        </div>

        <div className="px-2.5 py-1 rounded-xl shrink-0"
          style={{ background: "rgba(17,200,160,0.1)", border: "1px solid rgba(17,200,160,0.3)" }}>
          <span className="text-xs font-black" style={{ color: "#11c8a0" }}>₹{initialFee}</span>
        </div>
      </div>

      {/* ── Prize + Score cards ── */}
      <div className="px-3 mb-1 shrink-0">
        {/* Prize banner */}
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl mb-1.5"
          style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)" }}>
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "rgba(255,215,0,0.6)" }}>
            Prize Pool
          </span>
          <span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{Math.floor(initialFee * 2 * 0.9)}</span>
        </div>

        {/* You vs Bot score cards */}
        <div className="flex gap-2">
          {/* YOU */}
          <div className="flex-1 p-2.5 rounded-xl"
            style={{
              background: "rgba(34,197,94,0.07)",
              border: `1.5px solid ${turn === "player" ? "#22c55e" : "rgba(34,197,94,0.18)"}`,
              boxShadow: turn === "player" ? "0 0 16px rgba(34,197,94,0.3)" : "none",
              transition: "all 0.3s",
            }}>
            <div className="flex items-center gap-1.5 mb-1">
              <motion.div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "#22c55e" }}
                animate={turn === "player" ? { opacity: [1, 0.3, 1], scale: [1, 1.5, 1] } : { opacity: 0.4 }}
                transition={{ duration: 0.7, repeat: Infinity }} />
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(34,197,94,0.7)" }}>YOU</span>
              {turn === "player" && <span className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>← TURN</span>}
            </div>
            <div className="text-2xl font-black leading-none text-white">Sq.{pScore}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{pMovesLeft} moves left</div>
          </div>

          {/* VS divider */}
          <div className="flex items-center px-1 shrink-0">
            <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.15)" }}>VS</span>
          </div>

          {/* BOT */}
          <div className="flex-1 p-2.5 rounded-xl"
            style={{
              background: "rgba(244,63,94,0.07)",
              border: `1.5px solid ${turn === "bot" ? "#f43f5e" : "rgba(244,63,94,0.18)"}`,
              boxShadow: turn === "bot" ? "0 0 16px rgba(244,63,94,0.3)" : "none",
              transition: "all 0.3s",
            }}>
            <div className="flex items-center gap-1.5 mb-1">
              <motion.div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "#f43f5e" }}
                animate={turn === "bot" ? { opacity: [1, 0.3, 1], scale: [1, 1.5, 1] } : { opacity: 0.4 }}
                transition={{ duration: 0.7, repeat: Infinity }} />
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(244,63,94,0.7)" }}>BOT</span>
              {turn === "bot" && <span className="text-[9px] font-bold" style={{ color: "rgba(244,63,94,0.6)" }}>← TURN</span>}
            </div>
            <div className="text-2xl font-black leading-none text-white">Sq.{bScore}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{bMovesLeft} moves left</div>
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 px-2 py-0.5 min-h-0">
        <div style={{ width: "100%", height: "100%", maxHeight: "calc(100vw - 16px)" }}>
          <Board pPos={pPos} bPos={bPos} />
        </div>
      </div>

      {/* ── Event log ── */}
      <div className="mx-3 mb-1.5 shrink-0 min-h-[32px] flex items-center justify-center">
        <AnimatePresence mode="wait">
          {logMsgs[0] && (
            <motion.div key={eventKey}
              initial={{ opacity: 0, y: -6, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
              className="px-4 py-1.5 rounded-xl text-center"
              style={{
                background: eventType === "ladder" ? "rgba(255,215,0,0.1)" :
                             eventType === "snake"  ? "rgba(244,63,94,0.1)" :
                             "rgba(255,255,255,0.04)",
                border: `1px solid ${eventColor}30`,
                maxWidth: "100%",
              }}>
              <p className="text-xs font-bold truncate" style={{ color: eventColor }}>
                {logMsgs[0]}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center justify-center gap-4 px-4 pb-5 pt-0.5 shrink-0">
        {/* Dice */}
        <Dice3D value={dice} rolling={rolling} size={64} />

        {/* Roll button — large glowing */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleRoll}
          disabled={!canRoll}
          className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{
            background: canRoll
              ? "linear-gradient(135deg,#11998e,#38ef7d)"
              : "rgba(255,255,255,0.05)",
            color: canRoll ? "#000" : "rgba(255,255,255,0.2)",
            boxShadow: canRoll
              ? "0 0 32px rgba(17,153,142,0.6), 0 0 64px rgba(17,153,142,0.2)"
              : "none",
            border: canRoll ? "none" : "1px solid rgba(255,255,255,0.08)",
            transition: "all 0.25s",
          }}
          animate={canRoll ? {
            boxShadow: [
              "0 0 20px rgba(17,153,142,0.4)",
              "0 0 50px rgba(17,153,142,0.7)",
              "0 0 20px rgba(17,153,142,0.4)",
            ],
          } : {}}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          {turn === "bot"
            ? "⏳ Bot rolling…"
            : pMoves >= MAX_MOVES
              ? "✓ Done"
              : "🎲 ROLL DICE"}
        </motion.button>
      </div>

      {/* ── Snake/Ladder event flash ── */}
      <AnimatePresence>
        {eventType === "ladder" && (
          <motion.div
            key={`ladder-${eventKey}`}
            initial={{ scale: 0.5, opacity: 0, y: 20 }}
            animate={{ scale: 2, opacity: 1, y: -20 }}
            exit={{ scale: 2.5, opacity: 0, y: -60 }}
            transition={{ duration: 0.8 }}
            className="fixed left-1/2 bottom-32 -translate-x-1/2 pointer-events-none text-4xl z-50">
            🪜
          </motion.div>
        )}
        {eventType === "snake" && (
          <motion.div
            key={`snake-${eventKey}`}
            initial={{ scale: 0.5, opacity: 0, y: -10 }}
            animate={{ scale: 2, opacity: 1, y: 10 }}
            exit={{ scale: 2.5, opacity: 0, y: 40 }}
            transition={{ duration: 0.8 }}
            className="fixed left-1/2 bottom-32 -translate-x-1/2 pointer-events-none text-4xl z-50">
            🐍
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
