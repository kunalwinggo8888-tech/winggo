/**
 * SaanpSidiGame — WINGGO Saanp Sidi (Snake & Ladders Fast Mode)
 * 20 moves each · Score = highest square reached · Ladder = boost · Snake = fall
 * God Mode (₹20+): bot uses weighted dice to land on ladders and avoid snakes
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Board config ────────────────────────────────────────────────────────────
const SNAKES: Record<number, number> = {
  99: 21, 92: 37, 87: 24, 74: 53, 62: 18, 48: 26, 36: 6,
};
const LADDERS: Record<number, number> = {
  4: 25, 13: 46, 28: 76, 33: 68, 51: 67, 63: 81, 71: 91,
};

const MAX_MOVES = 20;
const BOT_NAMES = ["PriyaBot", "VikramBot", "NitaBot", "RajBot", "DevBot"];

// ── Helpers ─────────────────────────────────────────────────────────────────
function cellPct(cell: number): { x: number; y: number } {
  const idx = cell - 1;
  const bRow = Math.floor(idx / 10);
  const bCol = idx % 10;
  const rtl = bRow % 2 === 1;
  const dCol = rtl ? 9 - bCol : bCol;
  const dRow = 9 - bRow;
  return { x: (dCol + 0.5) * 10, y: (dRow + 0.5) * 10 };
}

function normalDice(): number {
  return Math.ceil(Math.random() * 6);
}

// God Mode: look ahead and prefer landing on ladders, avoid snakes
function godModeDice(pos: number): number {
  const scored = Array.from({ length: 6 }, (_, i) => {
    const roll = i + 1;
    const next = pos + roll;
    if (next > 100) return { roll, score: -50 };
    let score = roll; // prefer advancing
    if (LADDERS[next]) score += 25;
    if (SNAKES[next]) score -= 40;
    return { roll, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // 88% pick best, 12% pick second-best (prevents perfect play looking suspicious)
  const pick = Math.random() < 0.88 ? scored[0] : (scored[1] ?? scored[0]);
  return pick.roll;
}

// ── Animated 3D Dice ────────────────────────────────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

function Dice3D({ value, rolling, size = 58 }: { value: number; rolling: boolean; size?: number }) {
  const dots = PIPS[value] ?? PIPS[1];
  const pip = size * 0.145;
  return (
    <motion.div
      animate={rolling
        ? { rotate: [0, -24, 24, -16, 16, -8, 8, 0], scale: [1, 1.2, 0.88, 1.13, 0.94, 1.06, 1], y: [0, -10, 4, -6, 2, -2, 0] }
        : { rotate: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.65 }}
      style={{
        width: size, height: size, borderRadius: size * 0.18,
        background: "linear-gradient(145deg, #ffffff, #dedede)",
        boxShadow: "5px 5px 14px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(0,0,0,0.14), inset 2px 2px 5px rgba(255,255,255,0.9)",
        flexShrink: 0, overflow: "hidden",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={pip * 50} fill="#1a1a2e" />
        ))}
      </svg>
    </motion.div>
  );
}

// ── Row colors for board ─────────────────────────────────────────────────────
const ROW_COLORS = [
  "#94007740", "#4b00e640", "#003cdc40", "#009cc840", "#00aa6440",
  "#c88c0040", "#dc500040", "#d21e1e40", "#a0147840", "#5a00b440",
];

// ── Board SVG ────────────────────────────────────────────────────────────────
function Board({ pPos, bPos }: { pPos: number; bPos: number }) {
  const cells = [] as React.ReactElement[];

  for (let dRow = 0; dRow < 10; dRow++) {
    for (let dCol = 0; dCol < 10; dCol++) {
      const bRow = 9 - dRow;
      const rtl = bRow % 2 === 1;
      const bCol = rtl ? 9 - dCol : dCol;
      const cell = bRow * 10 + bCol + 1;
      const { x, y } = cellPct(cell);
      const isSnake = cell in SNAKES;
      const isLadder = cell in LADDERS;
      const isSnakeTail = Object.values(SNAKES).includes(cell);
      const isLadderTop = Object.values(LADDERS).includes(cell);
      const pHere = pPos === cell;
      const bHere = bPos === cell;

      cells.push(
        <g key={cell}>
          <rect
            x={`${x - 4.8}%`} y={`${y - 4.8}%`} width="9.6%" height="9.6%" rx="1.5"
            fill={ROW_COLORS[dRow]}
            stroke={isSnake ? "#ff4444" : isLadder ? "#FFD700" : "rgba(255,255,255,0.1)"}
            strokeWidth={isSnake || isLadder ? "0.6%" : "0.25%"}
          />
          <text x={`${x}%`} y={`${y - 2}%`} textAnchor="middle" fontSize="2.2%"
            fill="rgba(255,255,255,0.55)" fontWeight="600">{cell}</text>
          {isSnake && <text x={`${x}%`} y={`${y + 2.8}%`} textAnchor="middle" fontSize="3.2%">🐍</text>}
          {isLadder && <text x={`${x}%`} y={`${y + 2.8}%`} textAnchor="middle" fontSize="3.2%">🪜</text>}
          {isSnakeTail && !isSnake && <text x={`${x}%`} y={`${y + 2.8}%`} textAnchor="middle" fontSize="2.4%">☠️</text>}
          {isLadderTop && !isLadder && <text x={`${x}%`} y={`${y + 2.8}%`} textAnchor="middle" fontSize="2.4%">⭐</text>}
        </g>
      );
    }
  }

  // Snake connection lines
  const snakeLines = Object.entries(SNAKES).map(([from, to]) => {
    const f = cellPct(Number(from));
    const t = cellPct(Number(to));
    return (
      <line key={`sl${from}`}
        x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
        stroke="#ff5555" strokeWidth="0.7%" strokeDasharray="1.5%,1%" opacity={0.45} />
    );
  });

  // Ladder connection lines
  const ladderLines = Object.entries(LADDERS).map(([from, to]) => {
    const f = cellPct(Number(from));
    const t = cellPct(Number(to));
    return (
      <line key={`ll${from}`}
        x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
        stroke="#FFD700" strokeWidth="0.7%" opacity={0.4} />
    );
  });

  const pp = pPos > 0 ? cellPct(pPos) : null;
  const bp = bPos > 0 ? cellPct(bPos) : null;
  const sameCell = pPos > 0 && pPos === bPos;

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%"
      style={{ display: "block", borderRadius: 12, overflow: "hidden" }}>
      <defs>
        <filter id="glow-p">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="glow-b">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect width="100" height="100" fill="#0c0c1a" />
      {cells}
      {snakeLines}
      {ladderLines}

      {/* Start positions (pos=0) */}
      {pPos === 0 && (
        <g>
          <circle cx="5%" cy="96%" r="3.8%" fill="#4ade80" stroke="#fff" strokeWidth="0.8%" filter="url(#glow-p)" />
          <text x="5%" y="97.2%" textAnchor="middle" fontSize="3%" fill="#000" fontWeight="bold">Y</text>
        </g>
      )}
      {bPos === 0 && (
        <g>
          <circle cx={pPos === 0 ? "12%" : "5%"} cy="96%" r="3.8%" fill="#f87171" stroke="#fff" strokeWidth="0.8%" filter="url(#glow-b)" />
          <text x={pPos === 0 ? "12%" : "5%"} y="97.2%" textAnchor="middle" fontSize="3%" fill="#000" fontWeight="bold">B</text>
        </g>
      )}

      {/* Player token (green) */}
      {pp && (
        <g>
          <circle cx={`${sameCell ? pp.x - 2 : pp.x}%`} cy={`${pp.y}%`} r="3.8%"
            fill="#4ade80" stroke="#fff" strokeWidth="0.8%" filter="url(#glow-p)" />
          <text x={`${sameCell ? pp.x - 2 : pp.x}%`} y={`${pp.y + 1.2}%`}
            textAnchor="middle" fontSize="3%" fill="#000" fontWeight="bold">Y</text>
        </g>
      )}

      {/* Bot token (red) */}
      {bp && (
        <g>
          <circle cx={`${sameCell ? bp.x + 2 : bp.x}%`} cy={`${bp.y}%`} r="3.8%"
            fill="#f87171" stroke="#fff" strokeWidth="0.8%" filter="url(#glow-b)" />
          <text x={`${sameCell ? bp.x + 2 : bp.x}%`} y={`${bp.y + 1.2}%`}
            textAnchor="middle" fontSize="3%" fill="#000" fontWeight="bold">B</text>
        </g>
      )}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onBack: () => void; initialFee?: number }

export default function SaanpSidiGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch } = useMatchHistory();
  const isGodMode = initialFee >= 20;
  const botName = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const scored = useRef(false);

  const [phase, setPhase] = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [pPos, setPPos] = useState(0);
  const [bPos, setBPos] = useState(0);
  const [pScore, setPScore] = useState(0);
  const [bScore, setBScore] = useState(0);
  const [pMoves, setPMoves] = useState(0);
  const [bMoves, setBMoves] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState<"player" | "bot">("player");
  const [lastEvent, setLastEvent] = useState("");
  const [eventKey, setEventKey] = useState(0);

  // Matchmaking timer
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const t = setTimeout(() => setPhase("playing"), 2600);
    return () => clearTimeout(t);
  }, [phase]);

  // End condition
  useEffect(() => {
    if (phase !== "playing") return;
    if (pMoves >= MAX_MOVES && bMoves >= MAX_MOVES && !scored.current) {
      scored.current = true;
      setPhase("result");
      const won = pScore >= bScore;
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
    let msg = `Rolled ${roll} → sq.${target}`;
    if (LADDERS[newPos]) {
      const top = LADDERS[newPos];
      msg += ` 🪜 Ladder to ${top}!`;
      newPos = top;
    } else if (SNAKES[newPos]) {
      const tail = SNAKES[newPos];
      msg += ` 🐍 Snake to ${tail}!`;
      newPos = tail;
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
      setLastEvent("🟢 You: " + msg);
      setEventKey(k => k + 1);
      setTurn("bot");
    }, 700);
  }, [rolling, turn, pMoves, pPos]);

  // Bot turn
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES) { setTurn("player"); return; }
    const delay = 900 + Math.random() * 500;
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
        setLastEvent(`🔴 ${botName.current}: ` + msg);
        setEventKey(k => k + 1);
        setTurn("player");
      }, 700);
    }, delay);
    return () => clearTimeout(t);
  }, [turn, phase, bMoves, bPos, isGodMode]);

  const wonGame = pScore >= bScore;
  const prize = wonGame ? Math.floor(initialFee * 2 * 0.9) : 0;
  const pMovesLeft = MAX_MOVES - pMoves;
  const bMovesLeft = MAX_MOVES - bMoves;
  const canRoll = turn === "player" && !rolling && pMoves < MAX_MOVES;

  // ── Matchmaking ─────────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6"
        style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #04140f 100%)", maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180 }} className="text-8xl">🐍</motion.div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white tracking-tight">SAANP SIDI</h2>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>20 Moves · Highest Square Wins</p>
        </div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-[3px]"
          style={{ borderColor: "#11998e", borderTopColor: "transparent" }} />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Finding opponent…</p>
        {isGodMode && (
          <div className="px-4 py-2 rounded-2xl"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="text-xs font-black" style={{ color: "#f87171" }}>⚡ UNBEATABLE BOT MODE</span>
          </div>
        )}
        <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Entry: ₹{initialFee}</div>
      </div>
    );
  }

  // ── Result ───────────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 gap-5"
        style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #04140f 100%)", maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring" }} className="text-8xl">{wonGame ? "🏆" : "🐍"}</motion.div>
        <h2 className="text-4xl font-black" style={{ color: wonGame ? "#FFD700" : "#f87171" }}>
          {wonGame ? "YOU WIN!" : "YOU LOSE!"}
        </h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
          {wonGame ? "Highest square wins the pot!" : isGodMode ? "The God Mode bot was unbeatable!" : "Better luck next time!"}
        </p>
        <div className="flex gap-3 w-full max-w-xs">
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(74,222,128,0.1)", border: `1px solid ${wonGame ? "rgba(74,222,128,0.5)" : "rgba(74,222,128,0.15)"}` }}>
            <div className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: "#4ade80" }}>YOU</div>
            <div className="text-3xl font-black text-white">Sq.{pScore}</div>
          </div>
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(248,113,113,0.1)", border: `1px solid ${!wonGame ? "rgba(248,113,113,0.5)" : "rgba(248,113,113,0.15)"}` }}>
            <div className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: "#f87171" }}>{botName.current}</div>
            <div className="text-3xl font-black text-white">Sq.{bScore}</div>
          </div>
        </div>
        {wonGame && (
          <div className="px-6 py-3 rounded-2xl"
            style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)" }}>
            <span className="text-xl font-black" style={{ color: "#FFD700" }}>+₹{prize} Won!</span>
          </div>
        )}
        <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
          className="w-full max-w-xs py-4 rounded-2xl font-black text-lg"
          style={{ background: "linear-gradient(135deg,#11998e,#38ef7d)", color: "#000" }}>
          Back to Lobby
        </motion.button>
      </div>
    );
  }

  // ── Playing ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full"
      style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #04140f 100%)", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-1 shrink-0">
        <button onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4l-4 4 4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="font-black text-base text-white flex-1 flex items-center gap-2">
          🐍 SAANP SIDI
          {isGodMode && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
              style={{ background: "rgba(239,68,68,0.15)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
              ⚡ GOD
            </span>
          )}
        </div>
      </div>

      {/* Moves left bar */}
      <div className="mx-3 mb-1 px-3 py-1.5 rounded-xl flex items-center justify-between shrink-0"
        style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)" }}>
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>MOVES LEFT</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#4ade80" }} />
            <span className="text-xs font-black text-white">{pMovesLeft}</span>
          </div>
          <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 10 }}>|</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: "#f87171" }} />
            <span className="text-xs font-black text-white">{bMovesLeft}</span>
          </div>
        </div>
      </div>

      {/* Score cards */}
      <div className="flex gap-2 px-3 pb-1 shrink-0">
        <div className="flex-1 flex items-center gap-2 p-2.5 rounded-xl"
          style={{
            background: "rgba(74,222,128,0.08)",
            border: `1.5px solid ${turn === "player" ? "#4ade80" : "rgba(74,222,128,0.15)"}`,
            transition: "border-color 0.3s",
          }}>
          <div className="w-2 h-2 rounded-full shrink-0"
            style={{ background: "#4ade80", boxShadow: turn === "player" ? "0 0 8px #4ade80" : "none" }} />
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(74,222,128,0.55)" }}>YOU</div>
            <div className="text-xl font-black text-white leading-none">Sq.{pScore}</div>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-2 p-2.5 rounded-xl"
          style={{
            background: "rgba(248,113,113,0.08)",
            border: `1.5px solid ${turn === "bot" ? "#f87171" : "rgba(248,113,113,0.15)"}`,
            transition: "border-color 0.3s",
          }}>
          <div className="w-2 h-2 rounded-full shrink-0"
            style={{ background: "#f87171", boxShadow: turn === "bot" ? "0 0 8px #f87171" : "none" }} />
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(248,113,113,0.55)" }}>BOT</div>
            <div className="text-xl font-black text-white leading-none">Sq.{bScore}</div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 px-3 py-0.5 min-h-0">
        <div style={{ width: "100%", height: "100%", maxHeight: "calc(100vw - 24px)" }}>
          <Board pPos={pPos} bPos={bPos} />
        </div>
      </div>

      {/* Controls */}
      <div className="px-3 pb-4 pt-1 shrink-0">
        <div className="min-h-8 mb-2 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {lastEvent && (
              <motion.p key={eventKey} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-bold text-center px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", maxWidth: "100%" }}>
                {lastEvent}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex items-center justify-center gap-5">
          <Dice3D value={dice} rolling={rolling} size={60} />
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleRoll}
            disabled={!canRoll}
            className="px-8 py-4 rounded-2xl font-black text-base"
            style={{
              background: canRoll ? "linear-gradient(135deg,#11998e,#38ef7d)" : "rgba(255,255,255,0.06)",
              color: canRoll ? "#000" : "rgba(255,255,255,0.2)",
              boxShadow: canRoll ? "0 0 28px rgba(17,153,142,0.4)" : "none",
              transition: "all 0.25s",
            }}>
            {turn === "bot" ? "Bot rolling…" : pMoves >= MAX_MOVES ? "Done ✓" : "ROLL 🎲"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
