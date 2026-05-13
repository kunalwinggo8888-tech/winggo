/**
 * SaanpSidiGame — WINGGO · Fast Saanp Sidi · Points Battle
 *
 * WinZO-style score system:
 *  +1 pt  per step moved
 *  +climbed pts  on ladder (bonus)
 *  –fallen pts   on snake  (penalty, min 0)
 *  +50 pts  reaching square 100 (game continues)
 *  +10 / –10  landing on opponent square (no reset)
 *  Highest score after 24 moves OR 2.5-min timer wins
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_MOVES   = 24;
const MATCH_SECS  = 150;   // 2.5 minutes
const HOME_BONUS  = 50;
const HIT_BONUS   = 10;
const HIT_PENALTY = 10;
const BOT_NAMES   = ["PriyaBot","VikramBot","NitaBot","RajBot","DevBot","AnuBot"];

// ── Board data ─────────────────────────────────────────────────────────────────
const SNAKES:  Record<number, number> = { 99:21, 92:37, 87:24, 74:53, 62:18, 48:26, 36:6  };
const LADDERS: Record<number, number> = { 4:25,  13:46, 28:76, 33:68, 51:67, 63:81, 71:91 };

// ── Row neon colors ────────────────────────────────────────────────────────────
const ROW_COLORS = [
  "rgba(168,0,128,.28)","rgba(90,0,220,.28)","rgba(0,60,230,.28)","rgba(0,160,210,.28)",
  "rgba(0,190,100,.28)","rgba(220,160,0,.28)","rgba(230,80,0,.28)","rgba(220,20,20,.28)",
  "rgba(170,0,130,.28)","rgba(100,0,200,.28)",
];

// ── Cell position helper ───────────────────────────────────────────────────────
function cellPct(cell: number): { x: number; y: number } {
  const idx  = cell - 1;
  const bRow = Math.floor(idx / 10);
  const bCol = idx % 10;
  const rtl  = bRow % 2 === 1;
  const dCol = rtl ? 9 - bCol : bCol;
  const dRow = 9 - bRow;
  return { x: (dCol + 0.5) * 10, y: (dRow + 0.5) * 10 };
}

// ── Dice helpers ───────────────────────────────────────────────────────────────
function normalDice(): number { return Math.ceil(Math.random() * 6); }

function mediumDice(pos: number): number {
  const rolls = Array.from({ length: 6 }, (_, i) => {
    const r = i + 1; const n = pos + r;
    if (n > 100) return { r, sc: -10 };
    let sc = r;
    if (LADDERS[n]) sc += 15;
    if (SNAKES[n])  sc -= 20;
    return { r, sc };
  });
  rolls.sort((a, b) => b.sc - a.sc);
  return Math.random() < 0.65 ? rolls[0].r : rolls[Math.floor(Math.random() * rolls.length)].r;
}

function godDice(pos: number): number {
  const rolls = Array.from({ length: 6 }, (_, i) => {
    const r = i + 1; const n = pos + r;
    if (n > 100) return { r, sc: -30 };
    let sc = r * 1.2;
    if (LADDERS[n]) sc += (LADDERS[n] - n) + 30;
    if (SNAKES[n])  sc -= (pos - SNAKES[n]) + 40;
    if (n === 100)  sc += HOME_BONUS;
    return { r, sc };
  });
  rolls.sort((a, b) => b.sc - a.sc);
  return Math.random() < 0.9 ? rolls[0].r : (rolls[1] ?? rolls[0]).r;
}

// ── White 3D Dice ──────────────────────────────────────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
};

function Dice3D({
  value, rolling, onClick, disabled,
}: {
  value: number; rolling: boolean; onClick?: () => void; disabled: boolean;
}) {
  const sz   = 68;
  const dots = PIPS[value] ?? PIPS[1];
  return (
    <motion.div
      onClick={!disabled ? onClick : undefined}
      whileTap={!disabled ? { scale: 0.88 } : {}}
      style={{ cursor: disabled ? "not-allowed" : "pointer", userSelect: "none", flexShrink: 0 }}
      animate={rolling
        ? { rotate: [0,-44,44,-28,28,-15,15,0], scale: [1,1.38,0.76,1.24,0.87,1.13,1], y: [0,-28,11,-16,5,-8,0] }
        : { rotate: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.72 }}
    >
      <div style={{
        width: sz, height: sz, borderRadius: 15,
        background: "#ffffff",
        border: "2.5px solid #111111",
        boxShadow: rolling
          ? "4px 6px 18px rgba(0,0,0,.8),-2px -2px 6px rgba(255,255,255,.9),inset 0 2px 4px rgba(255,255,255,.8),0 0 50px rgba(255,215,0,1),0 0 100px rgba(255,215,0,.55)"
          : disabled
          ? "2px 3px 8px rgba(0,0,0,.4)"
          : "4px 6px 14px rgba(0,0,0,.6),-2px -2px 5px rgba(255,255,255,.7),inset 0 2px 3px rgba(255,255,255,.6),0 0 22px rgba(17,200,160,.45)",
        opacity: disabled && !rolling ? 0.48 : 1,
        transition: "box-shadow .22s,opacity .22s",
      }}>
        <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ display: "block" }}>
          <rect x={3} y={3} width={93} height={93} rx={13}
            fill="none" stroke="rgba(255,255,255,.7)" strokeWidth={2.5} />
          <rect x={5} y={5} width={91} height={91} rx={11}
            fill="none" stroke="rgba(0,0,0,.08)" strokeWidth={1.5} />
          {dots.map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx + 1} cy={cy + 1.5} r={8.5} fill="rgba(0,0,0,.22)" />
              <circle cx={cx} cy={cy} r={8.5} fill="#111111" />
              <circle cx={cx - 2.5} cy={cy - 2.5} r={2.8} fill="rgba(255,255,255,.18)" />
            </g>
          ))}
        </svg>
      </div>
    </motion.div>
  );
}

// ── Floating Score Text ────────────────────────────────────────────────────────
interface Floater { id: number; text: string; color: string; x: number; y: number }

function FloatText({ floaters }: { floaters: Floater[] }) {
  return (
    <div className="pointer-events-none"
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }}>
      <AnimatePresence>
        {floaters.map(f => (
          <motion.div key={f.id}
            initial={{ opacity: 1, y: 0, scale: 0.9 }}
            animate={{ opacity: 0, y: -80, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            style={{
              position: "absolute", left: f.x, top: f.y,
              transform: "translate(-50%,-50%)",
              fontSize: 20, fontWeight: 900, color: f.color,
              textShadow: `0 0 14px ${f.color}, 0 0 30px ${f.color}40`,
              letterSpacing: 1, whiteSpace: "nowrap",
            }}>
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Premium Board SVG ──────────────────────────────────────────────────────────
function Board({ pPos, bPos }: { pPos: number; bPos: number }) {
  const cells: React.ReactElement[] = [];
  const snakeTails  = new Set(Object.values(SNAKES));
  const ladderTops  = new Set(Object.values(LADDERS));

  for (let dRow = 0; dRow < 10; dRow++) {
    for (let dCol = 0; dCol < 10; dCol++) {
      const bRow = 9 - dRow;
      const rtl  = bRow % 2 === 1;
      const bCol = rtl ? 9 - dCol : dCol;
      const cell = bRow * 10 + bCol + 1;
      const { x, y } = cellPct(cell);
      const isSnake  = cell in SNAKES;
      const isLadder = cell in LADDERS;

      cells.push(
        <g key={cell}>
          <rect
            x={`${x - 4.85}%`} y={`${y - 4.85}%`} width="9.7%" height="9.7%" rx="0.8"
            fill={isSnake ? "rgba(255,40,40,.22)" : isLadder ? "rgba(255,215,0,.22)" : ROW_COLORS[dRow]}
            stroke={isSnake ? "rgba(255,80,80,.65)" : isLadder ? "rgba(255,215,0,.65)" : "rgba(255,255,255,.06)"}
            strokeWidth={isSnake || isLadder ? "0.5%" : "0.12%"}
          />
          <text x={`${x}%`} y={`${y - 2}%`} textAnchor="middle" fontSize="1.85%"
            fill="rgba(255,255,255,.5)" fontWeight="600">{cell}</text>
          {isSnake  && <text x={`${x}%`} y={`${y + 2.6}%`} textAnchor="middle" fontSize="3%">🐍</text>}
          {isLadder && <text x={`${x}%`} y={`${y + 2.6}%`} textAnchor="middle" fontSize="3%">🪜</text>}
          {!isSnake  && snakeTails.has(cell)  && <text x={`${x}%`} y={`${y + 2.6}%`} textAnchor="middle" fontSize="2.2%">☠️</text>}
          {!isLadder && ladderTops.has(cell)  && <text x={`${x}%`} y={`${y + 2.6}%`} textAnchor="middle" fontSize="2.2%">⭐</text>}
        </g>
      );
    }
  }

  const snakeLines = Object.entries(SNAKES).map(([from, to]) => {
    const f = cellPct(Number(from)); const t = cellPct(Number(to));
    return (
      <g key={`sl${from}`}>
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="#ff3333" strokeWidth="1.1%" strokeDasharray="1.8%,0.7%" opacity={0.65} />
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="rgba(255,140,140,.4)" strokeWidth="0.35%" />
      </g>
    );
  });

  const ladderLines = Object.entries(LADDERS).map(([from, to]) => {
    const f = cellPct(Number(from)); const t = cellPct(Number(to));
    return (
      <g key={`ll${from}`}>
        <line x1={`${f.x - 0.9}%`} y1={`${f.y}%`} x2={`${t.x - 0.9}%`} y2={`${t.y}%`}
          stroke="#c8a000" strokeWidth="0.9%" opacity={0.65} />
        <line x1={`${f.x + 0.9}%`} y1={`${f.y}%`} x2={`${t.x + 0.9}%`} y2={`${t.y}%`}
          stroke="#c8a000" strokeWidth="0.9%" opacity={0.65} />
        <line x1={`${f.x}%`} y1={`${f.y}%`} x2={`${t.x}%`} y2={`${t.y}%`}
          stroke="#FFD700" strokeWidth="0.45%" opacity={0.55} />
      </g>
    );
  });

  const pp       = pPos > 0 ? cellPct(pPos) : null;
  const bp       = bPos > 0 ? cellPct(bPos) : null;
  const sameCell = pPos > 0 && pPos === bPos;

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%"
      style={{ display: "block", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 0 50px rgba(0,0,0,.95), 0 0 3px rgba(17,200,160,.25)" }}>
      <defs>
        <radialGradient id="ss2-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#080820" />
          <stop offset="100%" stopColor="#030310" />
        </radialGradient>
        <filter id="ss2-glow-p" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ss2-glow-b" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect width="100" height="100" fill="url(#ss2-bg)" />
      {cells}
      {snakeLines}
      {ladderLines}

      {/* Start zone tokens (pos=0) */}
      {pPos === 0 && (
        <g>
          <circle cx="5%" cy="96%" r="3.6%"
            fill="#22c55e" stroke="rgba(255,255,255,.88)" strokeWidth=".7%" filter="url(#ss2-glow-p)" />
          <text x="5%" y="97.5%" textAnchor="middle" fontSize="2.5%" fill="#000" fontWeight="bold">Y</text>
        </g>
      )}
      {bPos === 0 && (
        <g>
          <circle cx={pPos === 0 ? "13%" : "5%"} cy="96%" r="3.6%"
            fill="#f43f5e" stroke="rgba(255,255,255,.88)" strokeWidth=".7%" filter="url(#ss2-glow-b)" />
          <text x={pPos === 0 ? "13%" : "5%"} y="97.5%"
            textAnchor="middle" fontSize="2.5%" fill="#fff" fontWeight="bold">B</text>
        </g>
      )}

      {/* Player token (green Y) */}
      {pp && (
        <g>
          <circle cx={`${sameCell ? pp.x - 2.8 : pp.x}%`} cy={`${pp.y}%`} r="5.5%"
            fill="none" stroke="rgba(34,197,94,.35)" strokeWidth=".6%">
            <animate attributeName="r" values="4%;6%;4%" dur="1.1s" repeatCount="indefinite" />
            <animate attributeName="opacity" values=".6;0;.6" dur="1.1s" repeatCount="indefinite" />
          </circle>
          <circle cx={`${sameCell ? pp.x - 2.8 : pp.x}%`} cy={`${pp.y}%`} r="3.8%"
            fill="#22c55e" stroke="rgba(255,255,255,.9)" strokeWidth=".7%" filter="url(#ss2-glow-p)" />
          <circle cx={`${sameCell ? pp.x - 2.8 - 1.1 : pp.x - 1.1}%`} cy={`${pp.y - 1.1}%`}
            r="1.1%" fill="rgba(255,255,255,.35)" />
          <text x={`${sameCell ? pp.x - 2.8 : pp.x}%`} y={`${pp.y + 1.3}%`}
            textAnchor="middle" fontSize="2.5%" fill="#000" fontWeight="bold">Y</text>
        </g>
      )}

      {/* Bot token (red B) */}
      {bp && (
        <g>
          <circle cx={`${sameCell ? bp.x + 2.8 : bp.x}%`} cy={`${bp.y}%`} r="3.8%"
            fill="#f43f5e" stroke="rgba(255,255,255,.9)" strokeWidth=".7%" filter="url(#ss2-glow-b)" />
          <circle cx={`${sameCell ? bp.x + 2.8 - 1.1 : bp.x - 1.1}%`} cy={`${bp.y - 1.1}%`}
            r="1.1%" fill="rgba(255,255,255,.3)" />
          <text x={`${sameCell ? bp.x + 2.8 : bp.x}%`} y={`${bp.y + 1.3}%`}
            textAnchor="middle" fontSize="2.5%" fill="#fff" fontWeight="bold">B</text>
        </g>
      )}
    </svg>
  );
}

// ── Event types ────────────────────────────────────────────────────────────────
type EvType = "ladder" | "snake" | "hit" | "home" | "none";

// ── applyMove — pure, returns result + floater info ───────────────────────────
function applyMove(pos: number, roll: number, oppPos: number): {
  newPos: number; scoreDelta: number; oppDelta: number;
  msg: string; evt: EvType;
  floats: { text: string; color: string }[];
} {
  const floats: { text: string; color: string }[] = [];

  const target = pos + roll;
  if (target > 100) {
    return { newPos: pos, scoreDelta: 0, oppDelta: 0, msg: `Rolled ${roll} — over 100, can't move`, evt: "none", floats };
  }

  let newPos      = target;
  let scoreDelta  = roll;
  let oppDelta    = 0;
  let msg         = `Rolled ${roll} → sq.${target}`;
  let evt: EvType = "none";

  if (LADDERS[newPos]) {
    const top   = LADDERS[newPos];
    const climb = top - newPos;
    scoreDelta += climb;
    newPos      = top;
    msg        += ` 🪜 Ladder! +${climb} bonus pts`;
    evt         = "ladder";
    floats.push({ text: `+${climb} LADDER BONUS!`, color: "#FFD700" });
  } else if (SNAKES[newPos]) {
    const tail = SNAKES[newPos];
    const fall = newPos - tail;
    scoreDelta -= fall;
    newPos      = tail;
    msg        += ` 🐍 Snake! –${fall} pts`;
    evt         = "snake";
    floats.push({ text: `–${fall} SNAKE BITE!`, color: "#ff4444" });
  }

  if (newPos === 100) {
    scoreDelta += HOME_BONUS;
    if (evt === "none") evt = "home";
    msg += ` 🏠 HOME BONUS +${HOME_BONUS}!`;
    floats.push({ text: `+${HOME_BONUS} HOME BONUS!`, color: "#4ade80" });
  }

  if (newPos === oppPos && oppPos > 0) {
    scoreDelta += HIT_BONUS;
    oppDelta   -= HIT_PENALTY;
    if (evt === "none") evt = "hit";
    msg += ` ⚔️ HIT! +${HIT_BONUS}pts`;
    floats.push({ text: `⚔️ HIT! +${HIT_BONUS}`, color: "#FFD700" });
  }

  return { newPos, scoreDelta, oppDelta, msg, evt, floats };
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface Props { onBack: () => void; initialFee?: number }

export default function SaanpSidiGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();

  const isFreeMode = initialFee === 0;
  const tier: "easy" | "medium" | "god" =
    isFreeMode || initialFee < 5 ? "easy" : initialFee < 20 ? "medium" : "god";
  const tierLabel = tier === "god" ? "⚡ GOD MODE" : tier === "medium" ? "🔶 MEDIUM" : "🟢 EASY";
  const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";

  const botName  = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const scored   = useRef(false);
  const floatId  = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [phase,    setPhase]    = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [pPos,     setPPos]     = useState(0);
  const [bPos,     setBPos]     = useState(0);
  const [pScore,   setPScore]   = useState(0);
  const [bScore,   setBScore]   = useState(0);
  const [pMoves,   setPMoves]   = useState(0);
  const [bMoves,   setBMoves]   = useState(0);
  const [dice,     setDice]     = useState(1);
  const [rolling,  setRolling]  = useState(false);
  const [turn,     setTurn]     = useState<"player" | "bot">("player");
  const [logMsg,   setLogMsg]   = useState("🎮 Match started! Good luck!");
  const [evKey,    setEvKey]    = useState(0);
  const [evType,   setEvType]   = useState<EvType>("none");
  const [timer,    setTimer]    = useState(MATCH_SECS);
  const [floaters, setFloaters] = useState<Floater[]>([]);

  // ── Spawn floating text ─────────────────────────────────────────────────────
  const spawnFloats = useCallback((list: { text: string; color: string }[]) => {
    list.forEach(({ text, color }) => {
      const id = ++floatId.current;
      const x  = 80 + Math.random() * 280;
      const y  = 200 + Math.random() * 160;
      setFloaters(f => [...f, { id, text, color, x, y }]);
      setTimeout(() => setFloaters(f => f.filter(e => e.id !== id)), 1400);
    });
  }, []);

  const pushLog = useCallback((msg: string, type: EvType) => {
    setLogMsg(msg);
    setEvType(type);
    setEvKey(k => k + 1);
  }, []);

  // ── Matchmaking → playing ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const t = setTimeout(() => setPhase("playing"), 2900);
    return () => clearTimeout(t);
  }, [phase]);

  // ── Match countdown timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── End condition ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const done = (pMoves >= MAX_MOVES && bMoves >= MAX_MOVES) || timer === 0;
    if (!done || scored.current) return;
    scored.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeout(() => {
      setPhase("result");
      const won   = pScore >= bScore;
      const prize = (!isFreeMode && won) ? Math.floor(initialFee * 2 * 0.9) : 0;
      if (!isFreeMode && won) addWinning(prize);
      addMatch({
        gameId: "saanpsidi",
        gameName: isFreeMode ? "Saanp Sidi (Practice)" : "Saanp Sidi",
        gameIcon: "🐍",
        result: won ? "win" : "loss",
        entryFee: initialFee,
        prize,
        userScore: pScore,
        opponentScore: bScore,
        opponentName: botName.current,
        isGodMode: tier === "god",
      });
    }, 500);
  }, [pMoves, bMoves, timer, phase, pScore, bScore]);

  // ── Player roll ─────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || pMoves >= MAX_MOVES || timer === 0 || phase !== "playing") return;
    const val = normalDice();
    setDice(val);
    setRolling(true);
    setTimeout(() => {
      setRolling(false);
      const { newPos, scoreDelta, oppDelta, msg, evt, floats } = applyMove(pPos, val, bPos);
      setPPos(newPos);
      setPScore(s => Math.max(0, s + scoreDelta));
      if (oppDelta !== 0) setBScore(s => Math.max(0, s + oppDelta));
      setPMoves(m => m + 1);
      pushLog("🟢 You: " + msg, evt);
      spawnFloats(floats);
      setTurn("bot");
    }, 740);
  }, [rolling, turn, pMoves, pPos, bPos, timer, phase, pushLog, spawnFloats]);

  // ── Bot turn ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES || timer === 0) { setTurn("player"); return; }
    const delay = 850 + Math.random() * 600;
    const t = setTimeout(() => {
      const val = tier === "god" ? godDice(bPos) : tier === "medium" ? mediumDice(bPos) : normalDice();
      setDice(val);
      setRolling(true);
      setTimeout(() => {
        setRolling(false);
        const { newPos, scoreDelta, oppDelta, msg, evt, floats } = applyMove(bPos, val, pPos);
        setBPos(newPos);
        setBScore(s => Math.max(0, s + scoreDelta));
        if (oppDelta !== 0) setPScore(s => Math.max(0, s + oppDelta));
        setBMoves(m => m + 1);
        pushLog(`🔴 ${botName.current}: ` + msg, evt);
        spawnFloats(floats);
        setTurn("player");
      }, 740);
    }, delay);
    return () => clearTimeout(t);
  }, [turn, phase, bMoves, bPos, pPos, tier, timer, pushLog, spawnFloats]);

  const canRoll  = turn === "player" && !rolling && pMoves < MAX_MOVES && phase === "playing" && timer > 0;
  const won      = pScore >= bScore;
  const prize    = won && !isFreeMode ? Math.floor(initialFee * 2 * 0.9) : 0;
  const fmtTime  = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const evColor  =
    evType === "ladder" ? "#FFD700" : evType === "snake" ? "#ff4444" :
    evType === "hit"    ? "#ff8c00" : evType === "home"  ? "#4ade80" : "rgba(255,255,255,.5)";

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHMAKING SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "matchmaking") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-6"
        style={{ background: "linear-gradient(180deg,#001a14,#000e09,#001a14)", maxWidth: 480, margin: "0 auto" }}>

        <motion.div initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180 }}
          className="text-8xl"
          style={{ filter: "drop-shadow(0 0 28px rgba(17,200,160,.8))" }}>
          🐍
        </motion.div>

        <div className="text-center">
          <h2 className="text-4xl font-black text-white tracking-tight">SAANP SIDI</h2>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-2"
            style={{ background: "rgba(17,200,160,.12)", border: "1px solid rgba(17,200,160,.35)" }}>
            <span className="text-sm font-black" style={{ color: "#11c8a0" }}>
              ⚡ Points Battle · {MAX_MOVES} Moves
            </span>
          </div>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,.38)" }}>
            Ladders boost · Snakes penalize · Highest score wins
          </p>
        </div>

        {/* Scoring rules */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.08)" }}>
          {([
            ["📦", "Every step moved",       "+1 pt"],
            ["🪜", "Ladder climb",           "+climbed pts bonus"],
            ["🐍", "Snake bite",             "–fallen pts penalty"],
            ["🏠", "Reach square 100",       `+${HOME_BONUS} pts bonus`],
            ["⚔️", "Land on opponent",       `+${HIT_BONUS} / –${HIT_PENALTY}`],
          ] as [string, string, string][]).map(([icon, label, val]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,.05)", background: "rgba(255,255,255,.02)" }}>
              <span className="text-sm">{icon}</span>
              <span className="flex-1 text-xs font-bold" style={{ color: "rgba(255,255,255,.5)" }}>{label}</span>
              <span className="text-xs font-black" style={{ color: "#FFD700" }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Player slots */}
        <div className="flex gap-3 w-full">
          <div className="flex-1 p-3 rounded-2xl flex items-center gap-2"
            style={{ background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.3)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
            <span className="text-xs font-black text-white">You</span>
            <span className="ml-auto text-[9px] font-bold" style={{ color: "rgba(255,255,255,.35)" }}>
              {isFreeMode ? "FREE" : `₹${initialFee}`}
            </span>
          </div>
          <div className="flex-1 p-3 rounded-2xl flex items-center gap-2"
            style={{ background: `${tierColor}12`, border: `1px solid ${tierColor}35` }}>
            <motion.div className="w-3 h-3 rounded-full" style={{ background: tierColor }}
              animate={{ opacity: [1, .3, 1] }} transition={{ duration: .9, repeat: Infinity }} />
            <span className="text-xs font-black" style={{ color: "rgba(255,255,255,.55)" }}>
              {botName.current}
            </span>
            <span className="ml-auto text-[9px] font-bold" style={{ color: tierColor }}>{tierLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-[3px]"
            style={{ borderColor: "#11c8a0", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,.4)" }}>Setting up the board…</p>
        </div>

        <div className="w-full">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#11c8a0,#FFD700,#f43f5e)" }}
              initial={{ width: "0%" }} animate={{ width: "100%" }}
              transition={{ duration: 2.7, ease: "linear" }} />
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULT SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "result") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6 gap-5"
        style={{
          background: won
            ? "linear-gradient(180deg,#001a08,#002210,#001a08)"
            : "linear-gradient(180deg,#1a0008,#220010,#1a0008)",
          maxWidth: 480, margin: "0 auto",
        }}>

        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="text-8xl"
          style={{ filter: won
            ? "drop-shadow(0 0 30px rgba(74,222,128,.9))"
            : "drop-shadow(0 0 24px rgba(244,63,94,.8))" }}>
          {won ? "🏆" : "🐍"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }}
          className="text-5xl font-black"
          style={{
            color: won ? "#4ade80" : "#f43f5e",
            textShadow: won ? "0 0 40px rgba(74,222,128,.7)" : "0 0 30px rgba(244,63,94,.7)",
          }}>
          {won ? "YOU WIN!" : "YOU LOSE!"}
        </motion.h2>

        {won && !isFreeMode && prize > 0 && (
          <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: .28 }}
            className="px-8 py-3 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,.1)", border: "1.5px solid rgba(255,215,0,.4)",
              boxShadow: "0 0 30px rgba(255,215,0,.2)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: "rgba(255,215,0,.6)" }}>PRIZE WON</div>
            <div className="text-3xl font-black" style={{ color: "#FFD700" }}>+₹{prize}</div>
          </motion.div>
        )}
        {isFreeMode && (
          <div className="px-6 py-2 rounded-2xl"
            style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)" }}>
            <span className="text-sm font-bold" style={{ color: "#10b981" }}>Practice Match</span>
          </div>
        )}

        {/* Score breakdown */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.1)" }}>
          <div className="flex">
            <div className="flex-1 p-4 text-center"
              style={{ background: "rgba(34,197,94,.1)", borderRight: "1px solid rgba(255,255,255,.06)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1"
                style={{ color: "rgba(34,197,94,.7)" }}>YOU</div>
              <div className="text-4xl font-black" style={{ color: "#22c55e" }}>{pScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,.3)" }}>total points</div>
            </div>
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(244,63,94,.1)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1"
                style={{ color: "rgba(244,63,94,.7)" }}>{botName.current.slice(0, 8)}</div>
              <div className="text-4xl font-black" style={{ color: "#f43f5e" }}>{bScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,.3)" }}>total points</div>
            </div>
          </div>
          <div className="px-4 py-2.5 flex justify-between items-center"
            style={{ background: "rgba(255,255,255,.03)", borderTop: "1px solid rgba(255,255,255,.05)" }}>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,.4)" }}>Entry Fee</span>
            <span className="text-sm font-black" style={{ color: isFreeMode ? "#10b981" : "#FFD700" }}>
              {isFreeMode ? "FREE" : `₹${initialFee}`}
            </span>
          </div>
          {!isFreeMode && (
            <div className="px-4 py-2.5 flex justify-between items-center"
              style={{ background: "rgba(255,255,255,.02)", borderTop: "1px solid rgba(255,255,255,.05)" }}>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,.4)" }}>
                {won ? "You Won" : "You Lost"}
              </span>
              <span className="text-sm font-black" style={{ color: won ? "#4ade80" : "#f43f5e" }}>
                {won ? `+₹${prize}` : `-₹${initialFee}`}
              </span>
            </div>
          )}
        </div>

        <motion.button whileTap={{ scale: .95 }} onClick={onBack}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{ background: "linear-gradient(135deg,#11998e,#38ef7d)", color: "#000",
            boxShadow: "0 0 30px rgba(17,153,142,.45)" }}>
          Back to Lobby
        </motion.button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLAYING SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col min-h-screen"
      style={{ background: "linear-gradient(180deg,#001a12,#000e0a 55%,#001810 100%)",
        maxWidth: 480, margin: "0 auto" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0">
        <motion.button whileTap={{ scale: .88 }} onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.7)", fontSize: 18 }}>
          ←
        </motion.button>
        <div className="text-center">
          <div className="font-black text-white text-sm tracking-widest">SAANP SIDI</div>
          <div className="text-[9px] font-bold" style={{ color: "rgba(17,200,160,.7)" }}>
            {isFreeMode ? "PRACTICE" : `₹${initialFee} · Win ₹${Math.floor(initialFee * 2 * 0.9)}`}
          </div>
        </div>
        <span className="text-[9px] font-black px-2 py-1 rounded-full"
          style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}35` }}>
          {tierLabel}
        </span>
      </div>

      {/* ── Live Scoreboard ── */}
      <div className="px-3 mb-1.5 shrink-0">
        <div className="rounded-2xl px-3 py-2 flex items-center gap-2"
          style={{ background: "rgba(0,0,0,.55)", border: "1px solid rgba(255,255,255,.08)",
            backdropFilter: "blur(12px)" }}>

          {/* YOU */}
          <motion.div className="flex-1 rounded-xl px-2 py-1.5 text-center"
            animate={{ boxShadow: turn === "player" ? "0 0 18px rgba(34,197,94,.55)" : "none" }}
            style={{
              background: turn === "player" ? "rgba(34,197,94,.15)" : "rgba(255,255,255,.03)",
              border: `1.5px solid ${turn === "player" ? "#22c55e" : "rgba(34,197,94,.2)"}`,
              transition: "all .3s",
            }}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <motion.div className="w-2 h-2 rounded-full"
                style={{ background: "#22c55e", boxShadow: turn === "player" ? "0 0 6px #22c55e" : "none" }}
                animate={turn === "player" ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                transition={{ duration: .7, repeat: Infinity }} />
              <span className="text-[9px] font-black tracking-wider"
                style={{ color: "rgba(34,197,94,.85)" }}>YOU</span>
            </div>
            <motion.div className="text-xl font-black leading-none"
              key={`p${pScore}`}
              initial={{ scale: 1.45, color: "#FFD700" }}
              animate={{ scale: 1, color: "#22c55e" }}
              transition={{ duration: .3 }}
              style={{ color: "#22c55e", textShadow: "0 0 10px rgba(34,197,94,.6)" }}>
              {pScore}
            </motion.div>
            <div className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>
              {MAX_MOVES - pMoves} moves left
            </div>
          </motion.div>

          {/* Center — Timer */}
          <div className="flex flex-col items-center gap-0.5 px-1 shrink-0">
            <div className="text-[8px] font-black tracking-wider" style={{ color: "rgba(255,255,255,.25)" }}>TIME</div>
            <motion.div
              className="text-lg font-black tabular-nums"
              animate={timer <= 30 && timer > 0
                ? { scale: [1, 1.08, 1] }
                : { scale: 1 }}
              transition={{ duration: .5, repeat: Infinity }}
              style={{
                color: timer <= 30 ? "#ff4444" : timer <= 60 ? "#f97316" : "#FFD700",
                textShadow: timer <= 30 ? "0 0 14px rgba(255,68,68,.8)" : "none",
              }}>
              {fmtTime(timer)}
            </motion.div>
            <div className="text-[7px] font-black tracking-widest"
              style={{ color: "rgba(255,255,255,.18)" }}>VS</div>
          </div>

          {/* BOT */}
          <motion.div className="flex-1 rounded-xl px-2 py-1.5 text-center"
            animate={{ boxShadow: turn === "bot" ? "0 0 18px rgba(244,63,94,.55)" : "none" }}
            style={{
              background: turn === "bot" ? "rgba(244,63,94,.15)" : "rgba(255,255,255,.03)",
              border: `1.5px solid ${turn === "bot" ? "#f43f5e" : "rgba(244,63,94,.2)"}`,
              transition: "all .3s",
            }}>
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <motion.div className="w-2 h-2 rounded-full"
                style={{ background: "#f43f5e", boxShadow: turn === "bot" ? "0 0 6px #f43f5e" : "none" }}
                animate={turn === "bot" ? { scale: [1, 1.4, 1] } : { scale: 1 }}
                transition={{ duration: .7, repeat: Infinity }} />
              <span className="text-[9px] font-black tracking-wider"
                style={{ color: "rgba(244,63,94,.85)" }}>BOT</span>
            </div>
            <motion.div className="text-xl font-black leading-none"
              key={`b${bScore}`}
              initial={{ scale: 1.45, color: "#FFD700" }}
              animate={{ scale: 1, color: "#f43f5e" }}
              transition={{ duration: .3 }}
              style={{ color: "#f43f5e", textShadow: "0 0 10px rgba(244,63,94,.6)" }}>
              {bScore}
            </motion.div>
            <div className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>
              {MAX_MOVES - bMoves} moves left
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 px-2 min-h-0">
        <div style={{ width: "100%", paddingBottom: "100%", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <Board pPos={pPos} bPos={bPos} />
          </div>
        </div>
      </div>

      {/* ── Event log ── */}
      <div className="mx-3 mb-1 shrink-0 min-h-[30px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.div key={evKey}
            initial={{ opacity: 0, y: -5, scale: .95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: .9 }}
            transition={{ duration: .2 }}
            className="w-full px-3 py-1.5 rounded-xl text-center"
            style={{
              background:
                evType === "ladder" ? "rgba(255,215,0,.1)" :
                evType === "snake"  ? "rgba(255,68,68,.1)" :
                evType === "hit"    ? "rgba(255,140,0,.1)" :
                evType === "home"   ? "rgba(74,222,128,.1)" :
                "rgba(255,255,255,.04)",
              border: `1px solid ${evColor}30`,
            }}>
            <p className="text-[10px] font-bold truncate" style={{ color: evColor }}>{logMsg}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Move progress bars ── */}
      <div className="flex gap-3 px-3 mb-1.5 shrink-0">
        <div className="flex-1">
          <div className="flex justify-between mb-0.5">
            <span className="text-[8px] font-bold" style={{ color: "rgba(34,197,94,.7)" }}>YOU</span>
            <span className="text-[8px] font-bold" style={{ color: "rgba(34,197,94,.7)" }}>
              {pMoves}/{MAX_MOVES}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <motion.div className="h-full rounded-full"
              animate={{ width: `${(pMoves / MAX_MOVES) * 100}%` }}
              style={{ background: "linear-gradient(90deg,#22c55e,#4ade80)" }}
              transition={{ duration: .3 }} />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between mb-0.5">
            <span className="text-[8px] font-bold" style={{ color: "rgba(244,63,94,.7)" }}>BOT</span>
            <span className="text-[8px] font-bold" style={{ color: "rgba(244,63,94,.7)" }}>
              {bMoves}/{MAX_MOVES}
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <motion.div className="h-full rounded-full"
              animate={{ width: `${(bMoves / MAX_MOVES) * 100}%` }}
              style={{ background: "linear-gradient(90deg,#f43f5e,#fb7185)" }}
              transition={{ duration: .3 }} />
          </div>
        </div>
      </div>

      {/* ── Controls: Dice + Roll button ── */}
      <div className="flex items-center gap-3 px-3 pb-5 pt-0.5 shrink-0">
        <Dice3D value={dice} rolling={rolling} onClick={handleRoll} disabled={!canRoll} />

        <motion.button
          whileTap={{ scale: .92 }}
          onClick={handleRoll}
          disabled={!canRoll}
          className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{
            background: canRoll
              ? "linear-gradient(135deg,#11998e,#38ef7d)"
              : "rgba(255,255,255,.05)",
            color: canRoll ? "#000" : "rgba(255,255,255,.22)",
            boxShadow: canRoll
              ? "0 0 32px rgba(17,153,142,.6),0 0 64px rgba(17,153,142,.2)"
              : "none",
            border: canRoll ? "none" : "1px solid rgba(255,255,255,.08)",
            transition: "all .25s",
          }}
          animate={canRoll ? {
            boxShadow: [
              "0 0 18px rgba(17,153,142,.35)",
              "0 0 50px rgba(17,153,142,.7)",
              "0 0 18px rgba(17,153,142,.35)",
            ],
          } : {}}
          transition={{ duration: 1.4, repeat: Infinity }}>
          {timer === 0
            ? "⌛ Time's Up!"
            : turn === "bot"
            ? "⏳ Bot rolling…"
            : pMoves >= MAX_MOVES
            ? "✅ Moves Done"
            : "🎲 ROLL DICE"}
        </motion.button>
      </div>

      {/* ── Floating score popups ── */}
      <FloatText floaters={floaters} />

      {/* ── Big event emoji flash ── */}
      <AnimatePresence>
        {evType === "ladder" && (
          <motion.div key={`lf${evKey}`}
            initial={{ scale: .5, opacity: 0, y: 20 }}
            animate={{ scale: 2.2, opacity: 1, y: -20 }}
            exit={{ scale: 2.8, opacity: 0, y: -70 }}
            transition={{ duration: .85 }}
            className="fixed left-1/2 bottom-36 pointer-events-none text-4xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🪜
          </motion.div>
        )}
        {evType === "snake" && (
          <motion.div key={`sf${evKey}`}
            initial={{ scale: .5, opacity: 0, y: -15 }}
            animate={{ scale: 2.2, opacity: 1, y: 10 }}
            exit={{ scale: 2.8, opacity: 0, y: 50 }}
            transition={{ duration: .85 }}
            className="fixed left-1/2 bottom-36 pointer-events-none text-4xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🐍
          </motion.div>
        )}
        {evType === "home" && (
          <motion.div key={`hf${evKey}`}
            initial={{ scale: .4, opacity: 0 }}
            animate={{ scale: 2.5, opacity: 1 }}
            exit={{ scale: 3, opacity: 0 }}
            transition={{ duration: 1.0 }}
            className="fixed left-1/2 bottom-36 pointer-events-none text-4xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🏠
          </motion.div>
        )}
        {evType === "hit" && (
          <motion.div key={`htf${evKey}`}
            initial={{ scale: .5, opacity: 0 }}
            animate={{ scale: 2.2, opacity: 1 }}
            exit={{ scale: 2.8, opacity: 0 }}
            transition={{ duration: .75 }}
            className="fixed left-1/2 bottom-36 pointer-events-none text-4xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            ⚔️
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
