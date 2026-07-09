/**
 * SaanpSidiGame — WINGGO · Premium Fast Saanp Sidi · Points Battle
 *
 * Scoring:
 *  +1 pt  per step moved
 *  +50    when token reaches square 100 (HOME) — game continues
 *  –fall  snake penalty (dropped distance, min 0)
 *  Highest score after 40 moves OR 4-minute timer wins
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_MOVES  = 40;
const HOME_BONUS = 50;
const BOT_NAMES   = ["PriyaBot","VikramBot","NitaBot","RajBot","DevBot","AnuBot"];

// ── Board data ─────────────────────────────────────────────────────────────────
const SNAKES:  Record<number, number> = { 99:21, 92:37, 87:24, 74:53, 62:18, 48:26, 36:6  };
const LADDERS: Record<number, number> = { 4:25,  13:46, 28:76, 33:68, 51:67, 63:81, 71:91 };

// ── Cell coordinate in SVG viewBox (0 0 100 100) ──────────────────────────────
function cellXY(cell: number): { x: number; y: number } {
  const idx  = cell - 1;
  const bRow = Math.floor(idx / 10);
  const bCol = idx % 10;
  const rtl  = bRow % 2 === 1;
  const dCol = rtl ? 9 - bCol : bCol;
  const dRow = 9 - bRow;
  return { x: (dCol + 0.5) * 10, y: (dRow + 0.5) * 10 };
}

// ── Row neon palette ───────────────────────────────────────────────────────────
const ROW_COLORS = [
  "#2d0060","#001a6e","#003060","#004d40",
  "#1a4000","#3d3000","#4d1a00","#4d0000",
  "#3d0050","#20005a",
];
const ROW_GLOW = [
  "rgba(160,0,255,.45)","rgba(0,100,255,.45)","rgba(0,180,255,.4)","rgba(0,255,180,.35)",
  "rgba(80,255,0,.35)","rgba(255,200,0,.38)","rgba(255,100,0,.4)","rgba(255,30,30,.4)",
  "rgba(200,0,255,.42)","rgba(120,0,255,.45)",
];

// ── Dice helpers ───────────────────────────────────────────────────────────────
function normalDice(): number { return Math.ceil(Math.random() * 6); }

function mediumDice(pos: number): number {
  const rolls = Array.from({ length: 6 }, (_, i) => {
    const r = i + 1; const n = pos + r;
    if (n > 100) return { r, sc: -5 };
    let sc = r;
    if (LADDERS[n]) sc += 12;
    if (SNAKES[n])  sc -= 18;
    return { r, sc };
  });
  rolls.sort((a, b) => b.sc - a.sc);
  return Math.random() < 0.62 ? rolls[0].r : rolls[Math.floor(Math.random() * rolls.length)].r;
}

function godDice(pos: number): number {
  const rolls = Array.from({ length: 6 }, (_, i) => {
    const r = i + 1; const n = pos + r;
    if (n > 100) return { r, sc: -30 };
    let sc = r * 1.3;
    if (LADDERS[n]) sc += (LADDERS[n] - n) * 1.5 + 25;
    if (SNAKES[n])  sc -= (n - SNAKES[n]) + 35;
    if (n === 100)  sc += HOME_BONUS * 1.2;
    return { r, sc };
  });
  rolls.sort((a, b) => b.sc - a.sc);
  return Math.random() < 0.88 ? rolls[0].r : (rolls[1] ?? rolls[0]).r;
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
  const sz   = 90;
  const dots = PIPS[value] ?? PIPS[1];
  return (
    <motion.div
      onClick={!disabled ? onClick : undefined}
      whileTap={!disabled ? { scale: 0.88 } : {}}
      style={{ cursor: disabled ? "not-allowed" : "pointer", userSelect: "none", flexShrink: 0 }}
      animate={rolling
        ? { rotate: [0, -50, 50, -32, 32, -18, 18, 0], scale: [1, 1.4, 0.74, 1.26, 0.86, 1.14, 1], y: [0, -30, 12, -18, 6, -9, 0] }
        : { rotate: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.78 }}
    >
      <div style={{
        width: sz, height: sz, borderRadius: 16,
        background: "#ffffff",
        border: "2.5px solid #111111",
        boxShadow: rolling
          ? "5px 7px 20px rgba(0,0,0,.85), -2px -2px 8px rgba(255,255,255,.9), inset 0 2px 5px rgba(255,255,255,.85), 0 0 55px rgba(255,215,0,1), 0 0 110px rgba(255,215,0,.6)"
          : disabled
          ? "2px 3px 8px rgba(0,0,0,.4)"
          : "4px 7px 16px rgba(0,0,0,.65), -2px -2px 6px rgba(255,255,255,.75), inset 0 2px 4px rgba(255,255,255,.65), 0 0 24px rgba(17,200,160,.5)",
        opacity: disabled && !rolling ? 0.48 : 1,
        transition: "box-shadow .22s, opacity .22s",
      }}>
        <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ display: "block" }}>
          {/* Bevel highlight */}
          <rect x={3} y={3} width={93} height={93} rx={13}
            fill="none" stroke="rgba(255,255,255,.72)" strokeWidth={2.5} />
          <rect x={5} y={5} width={91} height={91} rx={11}
            fill="none" stroke="rgba(0,0,0,.07)" strokeWidth={1.5} />
          {dots.map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx + 1} cy={cy + 1.8} r={8.8} fill="rgba(0,0,0,.24)" />
              <circle cx={cx} cy={cy} r={8.8} fill="#111111" />
              <circle cx={cx - 2.8} cy={cy - 2.8} r={3} fill="rgba(255,255,255,.2)" />
            </g>
          ))}
        </svg>
      </div>
    </motion.div>
  );
}

// ── Floating Score Popups ─────────────────────────────────────────────────────
interface Floater { id: number; text: string; color: string; x: number; y: number }

function FloatText({ floaters }: { floaters: Floater[] }) {
  return (
    <div className="pointer-events-none"
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", zIndex: 999 }}>
      <AnimatePresence>
        {floaters.map(f => (
          <motion.div key={f.id}
            initial={{ opacity: 1, y: 0, scale: 0.9 }}
            animate={{ opacity: 0, y: -90, scale: 1.6 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3, ease: "easeOut" }}
            style={{
              position: "absolute", left: f.x, top: f.y,
              transform: "translate(-50%,-50%)",
              fontSize: 21, fontWeight: 900, color: f.color,
              textShadow: `0 0 16px ${f.color}, 0 0 32px ${f.color}55`,
              letterSpacing: 1, whiteSpace: "nowrap",
            }}>
            {f.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Premium Board SVG with animated tokens & score labels ─────────────────────
function Board({
  pPos, bPos, pScore, bScore, turn,
}: {
  pPos: number; bPos: number; pScore: number; bScore: number; turn: "player" | "bot";
}) {
  const cells: React.ReactElement[] = [];
  const snakeTails = new Set(Object.values(SNAKES));
  const ladderTops = new Set(Object.values(LADDERS));

  // ── Draw cells ──
  for (let dRow = 0; dRow < 10; dRow++) {
    for (let dCol = 0; dCol < 10; dCol++) {
      const bRow = 9 - dRow;
      const rtl  = bRow % 2 === 1;
      const bCol = rtl ? 9 - dCol : dCol;
      const cell = bRow * 10 + bCol + 1;
      const { x, y } = cellXY(cell);
      const isSnake  = cell in SNAKES;
      const isLadder = cell in LADDERS;

      cells.push(
        <g key={cell}>
          {/* Cell base */}
          <rect x={x - 4.85} y={y - 4.85} width={9.7} height={9.7} rx={0.8}
            fill={ROW_COLORS[dRow]}
            stroke={isSnake ? "rgba(255,60,60,.85)" : isLadder ? "rgba(255,215,0,.85)" : ROW_GLOW[dRow]}
            strokeWidth={isSnake || isLadder ? 0.55 : 0.18}
          />
          {/* Cell number */}
          <text x={x} y={y - 1.8} textAnchor="middle" fontSize="1.9"
            fill="rgba(255,255,255,.6)" fontWeight="700">{cell}</text>
          {/* Special cell emojis */}
          {isSnake  && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="3.1">🐍</text>}
          {isLadder && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="3.1">🪜</text>}
          {!isSnake  && snakeTails.has(cell) && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="2.3">☠️</text>}
          {!isLadder && ladderTops.has(cell)  && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="2.3">⭐</text>}
        </g>
      );
    }
  }

  // ── Draw snake lines (red dashes) ──
  const snakeLines = Object.entries(SNAKES).map(([from, to]) => {
    const f = cellXY(Number(from)); const t = cellXY(Number(to));
    const mx = (f.x + t.x) / 2 + (t.y - f.y) * 0.15;
    const my = (f.y + t.y) / 2 - (t.x - f.x) * 0.15;
    return (
      <g key={`sl${from}`}>
        {/* Snake body */}
        <path d={`M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`}
          fill="none" stroke="#cc2222" strokeWidth="1.2"
          strokeDasharray="2,0.8" opacity={0.7} />
        <path d={`M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`}
          fill="none" stroke="rgba(255,80,80,.4)" strokeWidth="0.4" />
        {/* Snake head dot */}
        <circle cx={f.x} cy={f.y} r="1.2" fill="#ff4444" opacity={0.8} />
        <circle cx={t.x} cy={t.y} r="0.8" fill="#882222" opacity={0.6} />
      </g>
    );
  });

  // ── Draw ladder lines (gold rungs) ──
  const ladderLines = Object.entries(LADDERS).map(([from, to]) => {
    const f = cellXY(Number(from)); const t = cellXY(Number(to));
    const dx = t.x - f.x; const dy = t.y - f.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = -dy / len * 0.8; const uy = dx / len * 0.8;
    // Rung positions along the ladder
    const rungs = [0.2, 0.4, 0.6, 0.8];
    return (
      <g key={`ll${from}`}>
        {/* Rails */}
        <line x1={f.x + ux} y1={f.y + uy} x2={t.x + ux} y2={t.y + uy}
          stroke="#c8a000" strokeWidth="0.8" opacity={0.75} />
        <line x1={f.x - ux} y1={f.y - uy} x2={t.x - ux} y2={t.y - uy}
          stroke="#c8a000" strokeWidth="0.8" opacity={0.75} />
        {/* Rungs */}
        {rungs.map((t2, i) => (
          <line key={i}
            x1={f.x + dx * t2 + ux} y1={f.y + dy * t2 + uy}
            x2={f.x + dx * t2 - ux} y2={f.y + dy * t2 - uy}
            stroke="#FFD700" strokeWidth="0.6" opacity={0.65} />
        ))}
        {/* Glow centre */}
        <line x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke="rgba(255,215,0,.22)" strokeWidth="1.6" />
      </g>
    );
  });

  // ── Token positions ──
  const pp       = pPos > 0 ? cellXY(pPos) : { x: 5,  y: 96 };
  const bp       = bPos > 0 ? cellXY(bPos) : { x: 13, y: 96 };
  const sameCell = pPos > 0 && pPos === bPos;
  const ppx      = sameCell ? pp.x - 2.8 : pp.x;
  const bpx      = sameCell ? bp.x + 2.8 : bp.x;

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%"
      style={{ display: "block", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 0 50px rgba(0,0,0,.95), 0 0 4px rgba(17,200,160,.3)" }}>
      <defs>
        <radialGradient id="ss3-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#07071a" />
          <stop offset="100%" stopColor="#02020e" />
        </radialGradient>
        <filter id="ss3-glow-p" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="ss3-glow-b" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <rect width="100" height="100" fill="url(#ss3-bg)" />

      {cells}
      {snakeLines}
      {ladderLines}

      {/* ── Grid lines overlay ── */}
      {[10,20,30,40,50,60,70,80,90].map(v => (
        <g key={v}>
          <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,.04)" strokeWidth=".15" />
          <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,.04)" strokeWidth=".15" />
        </g>
      ))}

      {/* ── Player token (green, YOU) ── */}
      {/* Pulse ring */}
      {turn === "player" && (
        <circle cx={ppx} cy={pp.y} r="6"
          fill="none" stroke="rgba(34,197,94,.5)" strokeWidth=".7">
          <animate attributeName="r" values="4.5;7;4.5" dur="1.0s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".7;0;.7" dur="1.0s" repeatCount="indefinite" />
        </circle>
      )}
      {/* Token shadow */}
      <circle cx={ppx + 0.6} cy={pp.y + 0.8} r="4" fill="rgba(0,0,0,.5)" />
      {/* Token body */}
      <motion.circle
        cx={ppx} cy={pp.y} r={4}
        fill="#22c55e"
        stroke="rgba(255,255,255,.95)" strokeWidth=".8"
        filter="url(#ss3-glow-p)"
        animate={{ cx: ppx, cy: pp.y }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
      />
      {/* Token shine */}
      <motion.circle
        cx={ppx - 1.2} cy={pp.y - 1.2} r={1.3}
        fill="rgba(255,255,255,.45)"
        animate={{ cx: ppx - 1.2, cy: pp.y - 1.2 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
      />
      {/* Token label */}
      <motion.text
        x={ppx} y={pp.y + 1.5}
        textAnchor="middle" fontSize="2.6" fill="#000" fontWeight="bold"
        animate={{ x: ppx, y: pp.y + 1.5 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}>
        Y
      </motion.text>
      {/* Score label above token */}
      <motion.g animate={{ x: ppx - 4, y: pp.y - 9 }} transition={{ duration: 0.55, ease: "easeInOut" }}>
        <rect x={0} y={0} width={8} height={4.5} rx={1.2} fill="rgba(34,197,94,.92)" />
        <text x={4} y={3.3} textAnchor="middle" fontSize="2.6" fill="#000" fontWeight="900">
          {pScore}
        </text>
      </motion.g>

      {/* ── Bot token (red, BOT) ── */}
      {turn === "bot" && (
        <circle cx={bpx} cy={bp.y} r="6"
          fill="none" stroke="rgba(244,63,94,.5)" strokeWidth=".7">
          <animate attributeName="r" values="4.5;7;4.5" dur="1.0s" repeatCount="indefinite" />
          <animate attributeName="opacity" values=".7;0;.7" dur="1.0s" repeatCount="indefinite" />
        </circle>
      )}
      <circle cx={bpx + 0.6} cy={bp.y + 0.8} r="4" fill="rgba(0,0,0,.5)" />
      <motion.circle
        cx={bpx} cy={bp.y} r={4}
        fill="#f43f5e"
        stroke="rgba(255,255,255,.95)" strokeWidth=".8"
        filter="url(#ss3-glow-b)"
        animate={{ cx: bpx, cy: bp.y }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
      />
      <motion.circle
        cx={bpx - 1.2} cy={bp.y - 1.2} r={1.3}
        fill="rgba(255,255,255,.4)"
        animate={{ cx: bpx - 1.2, cy: bp.y - 1.2 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}
      />
      <motion.text
        x={bpx} y={bp.y + 1.5}
        textAnchor="middle" fontSize="2.6" fill="#fff" fontWeight="bold"
        animate={{ x: bpx, y: bp.y + 1.5 }}
        transition={{ duration: 0.55, ease: "easeInOut" }}>
        B
      </motion.text>
      {/* Score label above bot token */}
      <motion.g animate={{ x: bpx - 4, y: bp.y - 9 }} transition={{ duration: 0.55, ease: "easeInOut" }}>
        <rect x={0} y={0} width={8} height={4.5} rx={1.2} fill="rgba(244,63,94,.92)" />
        <text x={4} y={3.3} textAnchor="middle" fontSize="2.6" fill="#fff" fontWeight="900">
          {bScore}
        </text>
      </motion.g>
    </svg>
  );
}

// ── Event type ─────────────────────────────────────────────────────────────────
type EvType = "ladder" | "snake" | "home" | "none";

// ── Pure move resolver ─────────────────────────────────────────────────────────
function applyMove(pos: number, roll: number): {
  newPos: number; scoreDelta: number;
  msg: string; evt: EvType;
  floats: { text: string; color: string }[];
} {
  const floats: { text: string; color: string }[] = [];
  const target = pos + roll;

  if (target > 100) {
    return { newPos: pos, scoreDelta: 0, msg: `Rolled ${roll} — over 100, no move`, evt: "none", floats };
  }

  let newPos     = target;
  let scoreDelta = roll;        // +1 per step always
  let msg        = `Rolled ${roll} → sq.${target}`;
  let evt: EvType = "none";

  // Ladder — no bonus points, just free climb
  if (LADDERS[newPos]) {
    const top = LADDERS[newPos];
    newPos = top;
    msg   += ` 🪜 Ladder to ${top}!`;
    evt    = "ladder";
    floats.push({ text: "🪜 LADDER CLIMB!", color: "#FFD700" });
  }
  // Snake — penalty = dropped distance
  else if (SNAKES[newPos]) {
    const tail = SNAKES[newPos];
    const fall = newPos - tail;
    scoreDelta -= fall;
    newPos      = tail;
    msg        += ` 🐍 Snake! –${fall} pts`;
    evt         = "snake";
    floats.push({ text: `–${fall} SNAKE BITE!`, color: "#ff4444" });
  }

  // Home bonus
  if (newPos === 100) {
    scoreDelta += HOME_BONUS;
    if (evt === "none") evt = "home";
    msg += ` 🏠 HOME! +${HOME_BONUS} bonus`;
    floats.push({ text: `+${HOME_BONUS} HOME BONUS!`, color: "#4ade80" });
  }

  return { newPos, scoreDelta, msg, evt, floats };
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
  const tierColor = tier === "god" ? "#ff3b5c"   : tier === "medium" ? "#f97316"   : "#4ade80";

  const botName  = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const scored   = useRef(false);
  const floatId  = useRef(0);

  const [phase,   setPhase]   = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [pPos,    setPPos]    = useState(0);
  const [bPos,    setBPos]    = useState(0);
  const [pScore,  setPScore]  = useState(0);
  const [bScore,  setBScore]  = useState(0);
  const [pMoves,  setPMoves]  = useState(0);
  const [bMoves,  setBMoves]  = useState(0);
  const [dice,    setDice]    = useState(1);
  const [rolling, setRolling] = useState(false);
  const [turn,    setTurn]    = useState<"player" | "bot">("player");
  const [logMsg,  setLogMsg]  = useState("🎮 Match started! Good luck!");
  const [evKey,   setEvKey]   = useState(0);
  const [evType,  setEvType]  = useState<EvType>("none");
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [matchTimer, setMatchTimer] = useState(120);  // 2-minute match clock

  // ── Spawn floating text ────────────────────────────────────────────────────
  const spawnFloats = useCallback((list: { text: string; color: string }[]) => {
    list.forEach(({ text, color }) => {
      const id = ++floatId.current;
      const x  = 80 + Math.random() * 280;
      const y  = 220 + Math.random() * 150;
      setFloaters(f => [...f, { id, text, color, x, y }]);
      setTimeout(() => setFloaters(f => f.filter(e => e.id !== id)), 1500);
    });
  }, []);

  const pushLog = useCallback((msg: string, type: EvType) => {
    setLogMsg(msg);
    setEvType(type);
    setEvKey(k => k + 1);
  }, []);

  // ── Matchmaking ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const t = setTimeout(() => setPhase("playing"), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // ── 2-minute match countdown ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setMatchTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Timer end — auto-finish match when 2 minutes elapse ────────────────────
  useEffect(() => {
    if (matchTimer !== 0 || phase !== "playing" || scored.current) return;
    scored.current = true;
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
      });
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTimer, phase]);

  // ── End condition (moves-based only) ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const done = pMoves >= MAX_MOVES && bMoves >= MAX_MOVES;
    if (!done || scored.current) return;
    scored.current = true;
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
  }, [pMoves, bMoves, phase, pScore, bScore]);

  // ── Player roll ────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || pMoves >= MAX_MOVES || phase !== "playing") return;
    const val = normalDice();
    setDice(val);
    setRolling(true);
    setTimeout(() => {
      setRolling(false);
      const { newPos, scoreDelta, msg, evt, floats } = applyMove(pPos, val);
      setPPos(newPos);
      setPScore(s => Math.max(0, s + scoreDelta));
      setPMoves(m => m + 1);
      pushLog("🟢 You: " + msg, evt);
      spawnFloats(floats);
      setTurn("bot");
    }, 800);
  }, [rolling, turn, pMoves, pPos, phase, pushLog, spawnFloats]);

  // ── Bot turn ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES) { setTurn("player"); return; }
    const delay = 900 + Math.random() * 700;
    const t = setTimeout(() => {
      const val = tier === "god" ? godDice(bPos) : tier === "medium" ? mediumDice(bPos) : normalDice();
      setDice(val);
      setRolling(true);
      setTimeout(() => {
        setRolling(false);
        const { newPos, scoreDelta, msg, evt, floats } = applyMove(bPos, val);
        setBPos(newPos);
        setBScore(s => Math.max(0, s + scoreDelta));
        setBMoves(m => m + 1);
        pushLog(`🔴 ${botName.current}: ` + msg, evt);
        spawnFloats(floats);
        setTurn("player");
      }, 800);
    }, delay);
    return () => clearTimeout(t);
  }, [turn, phase, bMoves, bPos, tier, pushLog, spawnFloats]);

  const canRoll   = turn === "player" && !rolling && pMoves < MAX_MOVES && phase === "playing";
  const won       = pScore >= bScore;
  const prize     = won && !isFreeMode ? Math.floor(initialFee * 2 * 0.9) : 0;
  const isLeading = pScore >= bScore;
  const evColor  =
    evType === "ladder" ? "#FFD700" : evType === "snake" ? "#ff4444" :
    evType === "home"   ? "#4ade80" : "rgba(255,255,255,.5)";

  // ═══════════════════════════════════════════════════════════════════════════
  // MATCHMAKING SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (phase === "matchmaking") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-6"
        style={{ background: "linear-gradient(180deg,#001a14,#000e09,#001a14)", maxWidth: 480, margin: "0 auto" }}>

        <motion.div initial={{ scale: 0, y: 24 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 14 }}
          className="text-8xl"
          style={{ filter: "drop-shadow(0 0 32px rgba(17,200,160,.85))" }}>
          🐍
        </motion.div>

        <div className="text-center">
          <h2 className="text-4xl font-black text-white tracking-tight">SAANP SIDI</h2>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mt-2"
            style={{ background: "rgba(17,200,160,.12)", border: "1px solid rgba(17,200,160,.38)" }}>
            <span className="text-sm font-black" style={{ color: "#11c8a0" }}>
              ⚡ Points Battle · {MAX_MOVES} Moves Each
            </span>
          </div>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,.38)" }}>
            Step every square · Snake penalizes · Highest score wins
          </p>
        </div>

        {/* Scoring rules panel */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.08)" }}>
          {([
            ["📦", "Every step moved",        "+1 pt per step"],
            ["🪜", "Climb a ladder",          "Free teleport ↑"],
            ["🐍", "Snake bite",              "–dropped pts penalty"],
            ["🏠", `Reach square 100`,        `+${HOME_BONUS} bonus pts`],
          ] as [string, string, string][]).map(([icon, label, val]) => (
            <div key={label} className="flex items-center gap-3 px-4 py-2.5"
              style={{ borderBottom: "1px solid rgba(255,255,255,.05)", background: "rgba(255,255,255,.025)" }}>
              <span className="text-sm">{icon}</span>
              <span className="flex-1 text-xs font-bold" style={{ color: "rgba(255,255,255,.5)" }}>{label}</span>
              <span className="text-xs font-black" style={{ color: "#FFD700" }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Player vs bot */}
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
            style={{ background: `${tierColor}12`, border: `1px solid ${tierColor}38` }}>
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
              transition={{ duration: 2.8, ease: "linear" }} />
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
            ? "drop-shadow(0 0 32px rgba(74,222,128,.9))"
            : "drop-shadow(0 0 26px rgba(244,63,94,.85))" }}>
          {won ? "🏆" : "🐍"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .18 }}
          className="text-5xl font-black"
          style={{
            color: won ? "#4ade80" : "#f43f5e",
            textShadow: won ? "0 0 40px rgba(74,222,128,.75)" : "0 0 30px rgba(244,63,94,.75)",
          }}>
          {won ? "YOU WIN!" : "YOU LOSE!"}
        </motion.h2>

        {won && !isFreeMode && prize > 0 && (
          <motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: .28 }}
            className="px-8 py-3 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,.1)", border: "1.5px solid rgba(255,215,0,.45)",
              boxShadow: "0 0 32px rgba(255,215,0,.22)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: "rgba(255,215,0,.65)" }}>PRIZE WON</div>
            <div className="text-3xl font-black" style={{ color: "#FFD700" }}>+₹{prize}</div>
          </motion.div>
        )}
        {isFreeMode && (
          <div className="px-6 py-2 rounded-2xl"
            style={{ background: "rgba(16,185,129,.1)", border: "1px solid rgba(16,185,129,.3)" }}>
            <span className="text-sm font-bold" style={{ color: "#10b981" }}>Practice Match</span>
          </div>
        )}

        {/* Score comparison */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.1)" }}>
          <div className="flex">
            <div className="flex-1 p-4 text-center"
              style={{ background: "rgba(34,197,94,.1)", borderRight: "1px solid rgba(255,255,255,.06)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1"
                style={{ color: "rgba(34,197,94,.75)" }}>YOU</div>
              <div className="text-4xl font-black" style={{ color: "#22c55e" }}>{pScore}</div>
              <div className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,.3)" }}>total points</div>
            </div>
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(244,63,94,.1)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1"
                style={{ color: "rgba(244,63,94,.75)" }}>{botName.current.slice(0, 8)}</div>
              <div className="text-4xl font-black" style={{ color: "#f43f5e" }}>{bScore}</div>
              <div className="text-[9px] mt-1" style={{ color: "rgba(255,255,255,.3)" }}>total points</div>
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
            boxShadow: "0 0 32px rgba(17,153,142,.5)" }}>
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
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5 shrink-0">
        <motion.button whileTap={{ scale: .88 }} onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
          style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)",
            color: "rgba(255,255,255,.7)", fontSize: 18 }}>
          ←
        </motion.button>
        <div className="text-center">
          <div className="font-black text-white text-sm tracking-widest">SAANP SIDI</div>
          <div className="text-[9px] font-bold" style={{ color: "rgba(17,200,160,.75)" }}>
            {isFreeMode ? "PRACTICE" : `₹${initialFee} · Win ₹${Math.floor(initialFee * 2 * 0.9)}`}
          </div>
        </div>
        <span className="text-[9px] font-black px-2 py-1 rounded-full"
          style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}38` }}>
          {tierLabel}
        </span>
      </div>

      {/* ── WinZO-style Live Leaderboard ── */}
      <div className="px-3 mb-1.5 shrink-0">
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)",
            backdropFilter: "blur(14px)" }}>

          {/* Header row with live countdown timer */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b"
            style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <span className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,.28)" }}>LIVE LEADERBOARD</span>
            <div className="flex flex-col items-center">
              <span className="text-base font-black tabular-nums leading-none"
                style={{ color: matchTimer <= 30 ? "#ef4444" : matchTimer <= 60 ? "#f97316" : "#FFD700",
                  textShadow: matchTimer <= 30 ? "0 0 10px rgba(239,68,68,0.7)" : "0 0 8px rgba(255,215,0,0.4)" }}>
                {String(Math.floor(matchTimer / 60)).padStart(2,"0")}:{String(matchTimer % 60).padStart(2,"0")}
              </span>
              <span className="text-[7px] font-black uppercase tracking-wider"
                style={{ color: "rgba(255,255,255,.25)" }}>TIME LEFT</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,.28)" }}>{MAX_MOVES} MOVES</span>
          </div>

          {/* YOU row */}
          <div className="flex items-center gap-2 px-3 py-2"
            style={{
              background: turn === "player" ? "rgba(34,197,94,.1)" : "transparent",
              borderBottom: "1px solid rgba(255,255,255,.04)",
              transition: "background .3s",
            }}>
            {isLeading && <span className="text-sm shrink-0">👑</span>}
            {!isLeading && <span className="text-sm shrink-0" style={{ opacity: .3 }}>👤</span>}
            <div className="w-3 h-3 rounded-full shrink-0"
              style={{ background: "#22c55e", boxShadow: turn === "player" ? "0 0 8px #22c55e" : "none" }} />
            <span className="text-xs font-black text-white flex-1">YOU</span>
            {turn === "player" && (
              <motion.span className="text-[8px] font-black px-1.5 py-0.5 rounded-full mr-1"
                style={{ background: "#22c55e", color: "#000" }}
                animate={{ opacity: [1, .35, 1] }} transition={{ duration: .55, repeat: Infinity }}>
                TURN
              </motion.span>
            )}
            <span className="text-[9px] font-bold shrink-0" style={{ color: "rgba(255,255,255,.35)" }}>
              {pMoves}/{MAX_MOVES}
            </span>
            <motion.span className="text-lg font-black leading-none w-12 text-right shrink-0"
              key={`ps${pScore}`}
              initial={{ scale: 1.5, color: "#FFD700" }}
              animate={{ scale: 1, color: "#22c55e" }}
              transition={{ duration: .3 }}
              style={{ color: "#22c55e", textShadow: "0 0 8px rgba(34,197,94,.6)" }}>
              {pScore}
            </motion.span>
          </div>

          {/* BOT row */}
          <div className="flex items-center gap-2 px-3 py-2"
            style={{
              background: turn === "bot" ? "rgba(244,63,94,.1)" : "transparent",
              transition: "background .3s",
            }}>
            {!isLeading && <span className="text-sm shrink-0">👑</span>}
            {isLeading && <span className="text-sm shrink-0" style={{ opacity: .3 }}>🤖</span>}
            <div className="w-3 h-3 rounded-full shrink-0"
              style={{ background: "#f43f5e", boxShadow: turn === "bot" ? "0 0 8px #f43f5e" : "none" }} />
            <span className="text-xs font-black flex-1" style={{ color: "rgba(255,255,255,.8)" }}>
              {botName.current}
            </span>
            {turn === "bot" && (
              <motion.span className="text-[8px] font-black px-1.5 py-0.5 rounded-full mr-1"
                style={{ background: "#f43f5e", color: "#fff" }}
                animate={{ opacity: [1, .35, 1] }} transition={{ duration: .55, repeat: Infinity }}>
                TURN
              </motion.span>
            )}
            <span className="text-[9px] font-bold shrink-0" style={{ color: "rgba(255,255,255,.35)" }}>
              {bMoves}/{MAX_MOVES}
            </span>
            <motion.span className="text-lg font-black leading-none w-12 text-right shrink-0"
              key={`bs${bScore}`}
              initial={{ scale: 1.5, color: "#FFD700" }}
              animate={{ scale: 1, color: "#f43f5e" }}
              transition={{ duration: .3 }}
              style={{ color: "#f43f5e", textShadow: "0 0 8px rgba(244,63,94,.6)" }}>
              {bScore}
            </motion.span>
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 px-2 min-h-0">
        <div style={{ width: "100%", paddingBottom: "100%", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <Board pPos={pPos} bPos={bPos} pScore={pScore} bScore={bScore} turn={turn} />
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
                evType === "home"   ? "rgba(74,222,128,.1)" :
                "rgba(255,255,255,.04)",
              border: `1px solid ${evColor}2e`,
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
              transition={{ duration: .35 }} />
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
              transition={{ duration: .35 }} />
          </div>
        </div>
      </div>

      {/* ── Controls — centered large dice only ── */}
      <div className="flex flex-col items-center gap-1.5 pb-6 pt-1 shrink-0">
        <Dice3D value={dice} rolling={rolling} onClick={handleRoll} disabled={!canRoll} />
        <span className="text-[9px] font-black uppercase tracking-widest"
          style={{
            color: canRoll ? "rgba(17,200,160,.75)" :
                   turn === "bot" ? "rgba(244,63,94,.6)" :
                   "rgba(255,255,255,.2)",
          }}>
          {turn === "bot"
            ? "⏳ Bot thinking…"
            : pMoves >= MAX_MOVES
            ? "✅ Your turns done"
            : "Tap dice to roll"}
        </span>
      </div>

      {/* Floating score popups */}
      <FloatText floaters={floaters} />

      {/* Big emoji event flash */}
      <AnimatePresence>
        {evType === "ladder" && (
          <motion.div key={`lf${evKey}`}
            initial={{ scale: .5, opacity: 0, y: 20 }}
            animate={{ scale: 2.5, opacity: 1, y: -30 }}
            exit={{ scale: 3.0, opacity: 0, y: -90 }}
            transition={{ duration: .9 }}
            className="fixed left-1/2 bottom-28 pointer-events-none text-5xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🪜
          </motion.div>
        )}
        {evType === "snake" && (
          <motion.div key={`sf${evKey}`}
            initial={{ scale: .5, opacity: 0, y: -15 }}
            animate={{ scale: 2.5, opacity: 1, y: 10 }}
            exit={{ scale: 3.0, opacity: 0, y: 60 }}
            transition={{ duration: .9 }}
            className="fixed left-1/2 bottom-28 pointer-events-none text-5xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🐍
          </motion.div>
        )}
        {evType === "home" && (
          <motion.div key={`hf${evKey}`}
            initial={{ scale: .4, opacity: 0 }}
            animate={{ scale: 2.8, opacity: 1 }}
            exit={{ scale: 3.4, opacity: 0 }}
            transition={{ duration: 1.0 }}
            className="fixed left-1/2 bottom-28 pointer-events-none text-5xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🏠
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
