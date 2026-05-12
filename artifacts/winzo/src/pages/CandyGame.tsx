/**
 * CandyGame — WINGGO Premium Candy Match-3 (Candy Crush style)
 * 8×8 grid, 6 candy types, click-to-swap, match detection,
 * cascade gravity, combo multiplier, wallet integration.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const ROWS         = 8;
const COLS         = 8;
const CANDY_TYPES  = 6;
const TOTAL_MOVES  = 30;
const PLATFORM_PCT = 0.10;

const CANDIES = [
  { emoji: "🍬", color: "#00E5FF", bg: "rgba(0,229,255,0.18)",  glow: "rgba(0,229,255,0.7)"   },
  { emoji: "🍭", color: "#FF4081", bg: "rgba(255,64,129,0.18)", glow: "rgba(255,64,129,0.7)"  },
  { emoji: "🍫", color: "#FF6D00", bg: "rgba(255,109,0,0.18)",  glow: "rgba(255,109,0,0.7)"   },
  { emoji: "🍩", color: "#D500F9", bg: "rgba(213,0,249,0.18)",  glow: "rgba(213,0,249,0.7)"   },
  { emoji: "🧁", color: "#00E676", bg: "rgba(0,230,118,0.18)",  glow: "rgba(0,230,118,0.7)"   },
  { emoji: "🍪", color: "#FFD700", bg: "rgba(255,215,0,0.18)",  glow: "rgba(255,215,0,0.7)"   },
] as const;

// ─── GRID HELPERS ─────────────────────────────────────────────────────────────

function makeGrid(): number[][] {
  const g = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => Math.floor(Math.random() * CANDY_TYPES))
  );
  // Remove initial 3-in-a-row
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const avoid = new Set<number>();
      if (r >= 2 && g[r-1][c] === g[r-2][c]) avoid.add(g[r-1][c]);
      if (c >= 2 && g[r][c-1] === g[r][c-2]) avoid.add(g[r][c-1]);
      while (avoid.has(g[r][c])) g[r][c] = (g[r][c] + 1) % CANDY_TYPES;
    }
  }
  return g;
}

function cloneGrid(g: number[][]): number[][] {
  return g.map(row => [...row]);
}

function findMatches(g: number[][]): Set<string> {
  const hits = new Set<string>();
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      const v = g[r][c];
      if (v === -1) { c++; continue; }
      let len = 1;
      while (c + len < COLS && g[r][c + len] === v) len++;
      if (len >= 3) for (let i = 0; i < len; i++) hits.add(`${r},${c+i}`);
      c += len;
    }
  }
  // Vertical
  for (let c = 0; c < COLS; c++) {
    let r = 0;
    while (r < ROWS) {
      const v = g[r][c];
      if (v === -1) { r++; continue; }
      let len = 1;
      while (r + len < ROWS && g[r + len][c] === v) len++;
      if (len >= 3) for (let i = 0; i < len; i++) hits.add(`${r+i},${c}`);
      r += len;
    }
  }
  return hits;
}

function applyGravity(g: number[][]): { next: number[][]; newKeys: Set<string> } {
  const next = cloneGrid(g);
  const newKeys = new Set<string>();
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (next[r][c] !== -1) { next[write][c] = next[r][c]; if (write !== r) next[r][c] = -1; write--; }
    }
    for (let r = write; r >= 0; r--) {
      next[r][c] = Math.floor(Math.random() * CANDY_TYPES);
      newKeys.add(`${r},${c}`);
    }
  }
  return { next, newKeys };
}

function scoreForMatch(size: number, combo: number): number {
  const base = size === 3 ? 30 : size === 4 ? 80 : size >= 5 ? 150 : size * 25;
  return Math.round(base * (1 + combo * 0.5));
}

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ─── SCORE POP ────────────────────────────────────────────────────────────────

interface ScorePop { id: number; text: string; x: number; y: number }

// ─── MATCHMAKING ──────────────────────────────────────────────────────────────

function MatchmakingScreen({ entryFee, onFound }: { entryFee: number; onFound: () => void }) {
  const [dots, setDots]   = useState(".");
  const [cd, setCd]       = useState(3);
  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));

  useEffect(() => {
    const di = setInterval(() => setDots(d => d.length >= 3 ? "." : d + "."), 480);
    const ci = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(ci); setTimeout(onFound, 300); return 0; } return c - 1; }), 900);
    return () => { clearInterval(di); clearInterval(ci); };
  }, [onFound]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <div className="relative">
        <motion.div
          className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
          style={{ background: "linear-gradient(135deg, rgba(255,64,129,0.15), rgba(0,229,255,0.1))", border: "2px solid rgba(255,64,129,0.4)" }}
          animate={{ scale: [1, 1.07, 1], boxShadow: ["0 0 30px rgba(255,64,129,0.2)", "0 0 60px rgba(255,64,129,0.5)", "0 0 30px rgba(255,64,129,0.2)"] }}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          🍬
        </motion.div>
        <motion.div className="absolute inset-0 rounded-full" style={{ border: "2px dashed rgba(0,229,255,0.35)" }}
          animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} />
      </div>

      <div className="text-center">
        <div className="text-white font-black text-xl">Finding Opponent{dots}</div>
        <div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Matching skill level</div>
      </div>

      <div className="flex items-center gap-4 px-6 py-3 rounded-2xl"
        style={{ background: "rgba(255,64,129,0.08)", border: "1px solid rgba(255,64,129,0.3)" }}>
        <div className="text-center">
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div>
          <div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{entryFee}</div>
        </div>
        <div className="h-8 w-px" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center">
          <div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div>
          <div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div>
        </div>
      </div>

      {/* Player vs Bot */}
      <div className="w-full flex items-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.3)" }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)", boxShadow: "0 0 14px rgba(255,215,0,0.5)" }}>👤</div>
          <div className="text-xs font-black text-white">You</div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.8)" }}>● Ready</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="text-2xl font-black" style={{ color: "rgba(255,255,255,0.22)" }}>VS</div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ {cd}s</div>
        </div>
        <div className="flex-1 flex flex-col items-center gap-2 px-3 py-3 rounded-2xl"
          style={{ background: "rgba(255,64,129,0.07)", border: "1px solid rgba(255,64,129,0.2)" }}>
          <motion.div className="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #FF4081, #c62828)", boxShadow: "0 0 12px rgba(255,64,129,0.5)" }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.85, repeat: Infinity }}>
            🤖
          </motion.div>
          <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>CandyBot</div>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ Joining</div>
        </div>
      </div>
    </div>
  );
}

// ─── RESULT SCREEN ────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: 2 + Math.random() * 96,
    color: ["#FFD700","#FF4081","#00E5FF","#00E676","#FF6D00","#D500F9"][i % 6],
    delay: Math.random() * 0.7,
    dur: 1.5 + Math.random() * 1.2,
    size: 6 + Math.random() * 7,
    rot: Math.random() * 720,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50" style={{ maxWidth: 480, margin: "0 auto" }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          style={{ position: "absolute", left: `${p.x}%`, top: -12, width: p.size, height: p.size, borderRadius: 2, background: p.color }}
          animate={{ y: "106vh", rotate: p.rot, opacity: [1, 1, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}

function ResultScreen({ won, entryFee, score, target, onBack, onRematch }: {
  won: boolean; entryFee: number; score: number; target: number; onBack: () => void; onRematch: () => void;
}) {
  const prize = Math.floor(entryFee * 2 * (1 - PLATFORM_PCT));
  return (
    <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8"
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
      {won && <Confetti />}

      <motion.div className="w-36 h-36 rounded-full flex items-center justify-center text-7xl"
        style={{
          background: won ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,64,129,0.12))" : "linear-gradient(135deg, rgba(239,68,68,0.18), rgba(185,28,28,0.08))",
          border: `3px solid ${won ? "rgba(255,215,0,0.55)" : "rgba(239,68,68,0.45)"}`,
          boxShadow: won ? "0 0 60px rgba(255,215,0,0.45), 0 0 120px rgba(255,64,129,0.15)" : "0 0 40px rgba(239,68,68,0.3)",
        }}
        animate={won ? { scale: [1, 1.04, 1] } : {}} transition={{ duration: 1.5, repeat: Infinity }}>
        {won ? "🏆" : "💔"}
      </motion.div>

      <div className="text-center">
        <motion.div className="font-black text-3xl"
          style={{ color: won ? "#FFD700" : "#ef4444", textShadow: won ? "0 0 24px rgba(255,215,0,0.65)" : "0 0 16px rgba(239,68,68,0.45)" }}
          initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260 }}>
          {won ? "You Won! 🎉" : "Game Over!"}
        </motion.div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {won ? `Score ${score.toLocaleString()} — winnings added!` : `Score ${score.toLocaleString()} / ${target.toLocaleString()} needed`}
        </div>
      </div>

      <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Entry Fee</span>
          <span className="font-black text-white">₹{entryFee}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Your Score</span>
          <span className="font-black text-white">{score.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-4"
          style={{ background: won ? "rgba(255,215,0,0.06)" : "rgba(239,68,68,0.05)" }}>
          <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
          <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>
            {won ? `+₹${prize}` : `-₹${entryFee}`}
          </span>
        </div>
      </div>

      <motion.button whileTap={{ scale: 0.96 }} onClick={onRematch}
        className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #FF4081, #c62828)", color: "#fff", boxShadow: "0 0 28px rgba(255,64,129,0.45)", letterSpacing: "0.04em" }}>
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.22) 50%, transparent 65%)" }}
          animate={{ x: ["-120%", "220%"] }} transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }} />
        🍬 Play Again
      </motion.button>

      <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>
        ← Back to Games
      </button>
    </motion.div>
  );
}

// ─── CANDY CELL ───────────────────────────────────────────────────────────────

function CandyCell({
  type, selected, exploding, isNew, onClick,
}: {
  type: number; selected: boolean; exploding: boolean; isNew: boolean; onClick: () => void;
}) {
  if (type === -1) return <div />;
  const candy = CANDIES[type];
  return (
    <motion.button
      onClick={onClick}
      className="w-full h-full flex items-center justify-center rounded-xl cursor-pointer relative overflow-hidden"
      style={{
        background: candy.bg,
        border: selected
          ? `2px solid ${candy.color}`
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: selected
          ? `0 0 16px ${candy.glow}, 0 0 32px ${candy.glow}`
          : exploding
          ? `0 0 24px ${candy.glow}`
          : `0 0 6px ${candy.glow.replace("0.7", "0.3")}`,
      }}
      animate={
        exploding
          ? { scale: [1, 1.4, 0], opacity: [1, 1, 0] }
          : selected
          ? { scale: [1, 1.1, 1.05] }
          : isNew
          ? { y: [-40, 0], opacity: [0, 1] }
          : { scale: 1, opacity: 1 }
      }
      transition={
        exploding
          ? { duration: 0.35, ease: "easeOut" }
          : isNew
          ? { duration: 0.3, type: "spring", stiffness: 280, damping: 18 }
          : { duration: 0.15 }
      }
    >
      {/* Inner glow */}
      {selected && (
        <motion.div className="absolute inset-0 rounded-xl pointer-events-none"
          style={{ background: `radial-gradient(circle, ${candy.glow.replace("0.7", "0.25")}, transparent 70%)` }}
          animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.6, repeat: Infinity }} />
      )}
      <span style={{ fontSize: "clamp(16px, 4.5vw, 26px)", lineHeight: 1, zIndex: 1, filter: exploding ? "brightness(2)" : "none" }}>
        {candy.emoji}
      </span>
    </motion.button>
  );
}

// ─── MAIN GAME ────────────────────────────────────────────────────────────────

interface Props { onBack: () => void; initialFee?: number }
type Phase = "matchmaking" | "playing" | "result";

export default function CandyGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();

  const target   = Math.max(500, initialFee * 50);
  const prize    = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
  const entryFee = initialFee;

  const [phase, setPhase]         = useState<Phase>("matchmaking");
  const [grid, setGrid]           = useState<number[][]>(() => makeGrid());
  const [selected, setSelected]   = useState<[number, number] | null>(null);
  const [exploding, setExploding] = useState<Set<string>>(new Set());
  const [newCells, setNewCells]   = useState<Set<string>>(new Set());
  const [score, setScore]         = useState(0);
  const [movesLeft, setMovesLeft] = useState(TOTAL_MOVES);
  const [combo, setCombo]         = useState(0);
  const [pops, setPops]           = useState<ScorePop[]>([]);
  const [won, setWon]             = useState(false);
  const popId                     = useRef(0);
  const processing                = useRef(false);

  function addPop(text: string, r: number, c: number) {
    const id = ++popId.current;
    const x  = (c / COLS) * 100;
    const y  = (r / ROWS) * 100;
    setPops(prev => [...prev, { id, text, x, y }]);
    setTimeout(() => setPops(prev => prev.filter(p => p.id !== id)), 1100);
  }

  // ── Match cascade loop ──────────────────────────────────────────────────────
  const processCascade = useCallback(async (g: number[][], comboLevel: number) => {
    const matches = findMatches(g);
    if (matches.size === 0) {
      setGrid(g);
      processing.current = false;
      return;
    }

    // Calculate score
    const pts = scoreForMatch(matches.size, comboLevel);
    setScore(s => {
      const next = s + pts;
      return next;
    });
    setCombo(comboLevel + 1);

    // Sample a cell from matches for pop position
    const first = [...matches][0].split(",").map(Number);
    addPop(comboLevel > 0 ? `🔥 COMBO ×${comboLevel + 1}!  +${pts}` : `+${pts}`, first[0], first[1]);

    // Show explosion
    setExploding(matches);
    setGrid(g);
    await delay(360);

    // Remove matched cells
    const next = cloneGrid(g);
    matches.forEach(key => { const [r, c] = key.split(",").map(Number); next[r][c] = -1; });
    setExploding(new Set());

    // Gravity
    const { next: fallen, newKeys } = applyGravity(next);
    setGrid(fallen);
    setNewCells(newKeys);
    await delay(340);
    setNewCells(new Set());

    // Recurse
    await processCascade(fallen, comboLevel + 1);
  }, []);

  // ── Cell tap handler ────────────────────────────────────────────────────────
  async function handleCellTap(r: number, c: number) {
    if (processing.current || phase !== "playing") return;
    if (grid[r][c] === -1) return;

    if (!selected) {
      setSelected([r, c]);
      return;
    }

    const [sr, sc] = selected;

    // Same cell → deselect
    if (sr === r && sc === c) {
      setSelected(null);
      return;
    }

    // Not adjacent → move selection
    const isAdj = (Math.abs(sr - r) === 1 && sc === c) || (Math.abs(sc - c) === 1 && sr === r);
    if (!isAdj) {
      setSelected([r, c]);
      return;
    }

    // Attempt swap
    setSelected(null);
    processing.current = true;

    const swapped = cloneGrid(grid);
    const tmp = swapped[sr][sc];
    swapped[sr][sc] = swapped[r][c];
    swapped[r][c] = tmp;

    const matches = findMatches(swapped);

    if (matches.size === 0) {
      // Invalid swap — animate and revert
      setGrid(swapped);
      await delay(220);
      setGrid(grid);
      processing.current = false;
      return;
    }

    // Valid swap — consume a move
    setMovesLeft(m => m - 1);
    setCombo(0);
    await processCascade(swapped, 0);

    // Check win/loss after cascade settles
    setScore(currentScore => {
      if (currentScore >= target) {
        setWon(true);
        setPhase("result");
        addWinning(prize, `🍬 Candy Match — Won ₹${prize}`);
      }
      return currentScore;
    });
    setMovesLeft(m => {
      if (m <= 0) {
        setScore(s => {
          if (s < target) setPhase("result");
          return s;
        });
      }
      return m;
    });
  }

  // Also check win/loss in an effect (after state settles)
  useEffect(() => {
    if (phase !== "playing") return;
    if (score >= target) {
      setWon(true);
      setPhase("result");
      addWinning(prize, `🍬 Candy Match — Won ₹${prize}`);
    } else if (movesLeft <= 0 && score < target) {
      setWon(false);
      setPhase("result");
    }
  }, [score, movesLeft, target, phase, prize, addWinning]);

  function handleRematch() {
    setPhase("matchmaking");
    setGrid(makeGrid());
    setSelected(null);
    setExploding(new Set());
    setNewCells(new Set());
    setScore(0);
    setMovesLeft(TOTAL_MOVES);
    setCombo(0);
    setPops([]);
    setWon(false);
    processing.current = false;
  }

  const pct = Math.min(100, (score / target) * 100);

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #1a0030 0%, #07060e 60%)", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ background: "rgba(7,6,14,0.92)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span>
          <span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">🍬</span>
          <span className="font-black text-white text-base">Candy Match</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
          style={{ background: "rgba(255,64,129,0.1)", border: "1px solid rgba(255,64,129,0.28)" }}>
          <span className="text-xs">💰</span>
          <span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {/* ── Matchmaking ── */}
      {phase === "matchmaking" && (
        <MatchmakingScreen entryFee={entryFee} onFound={() => setPhase("playing")} />
      )}

      {/* ── Playing ── */}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Score bar */}
          <div className="flex-shrink-0 px-4 pt-3 pb-2">
            {/* Stats row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col items-center px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                <span className="text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>SCORE</span>
                <span className="text-lg font-black" style={{ color: "#FFD700" }}>{score.toLocaleString()}</span>
              </div>

              <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>TARGET</span>
                <span className="text-sm font-black text-white">{target.toLocaleString()}</span>
              </div>

              <div className="flex flex-col items-center px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN</span>
                <span className="text-lg font-black" style={{ color: "#22c55e" }}>₹{prize}</span>
              </div>

              <div className="flex flex-col items-center px-3 py-1.5 rounded-xl"
                style={{
                  background: movesLeft <= 5 ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${movesLeft <= 5 ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}>
                <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>MOVES</span>
                <span className="text-lg font-black" style={{ color: movesLeft <= 5 ? "#ef4444" : "white" }}>{movesLeft}</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
              <motion.div className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, #FF4081, #FFD700, #00E5FF)" }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>0</span>
              <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>Target: {target.toLocaleString()}</span>
            </div>
          </div>

          {/* Combo badge */}
          <AnimatePresence>
            {combo > 1 && (
              <motion.div key={combo}
                className="mx-auto mb-1 px-4 py-1 rounded-full font-black text-sm"
                style={{ background: "linear-gradient(135deg, #FF4081, #FF6D00)", color: "#fff", boxShadow: "0 0 20px rgba(255,64,129,0.5)" }}
                initial={{ scale: 0.5, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 300 }}>
                🔥 {combo}× Combo!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Candy grid */}
          <div className="flex-1 px-2 relative">
            <div
              className="relative w-full"
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${COLS}, 1fr)`,
                gridTemplateRows: `repeat(${ROWS}, 1fr)`,
                gap: 3,
                aspectRatio: "1",
                padding: 6,
                borderRadius: 20,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                boxShadow: "0 0 60px rgba(255,64,129,0.12), 0 0 120px rgba(0,0,0,0.7)",
              }}
            >
              {grid.map((row, r) =>
                row.map((type, c) => (
                  <CandyCell
                    key={`${r}-${c}`}
                    type={type}
                    selected={selected ? selected[0] === r && selected[1] === c : false}
                    exploding={exploding.has(`${r},${c}`)}
                    isNew={newCells.has(`${r},${c}`)}
                    onClick={() => handleCellTap(r, c)}
                  />
                ))
              )}

              {/* Score pops */}
              {pops.map(p => (
                <motion.div key={p.id}
                  className="absolute pointer-events-none z-30 font-black text-sm whitespace-nowrap"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, color: "#FFD700",
                    textShadow: "0 0 10px rgba(255,215,0,0.8), 0 2px 4px rgba(0,0,0,0.8)" }}
                  initial={{ opacity: 1, y: 0, scale: 0.8 }}
                  animate={{ opacity: 0, y: -50, scale: 1.2 }}
                  transition={{ duration: 1, ease: "easeOut" }}>
                  {p.text}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex-shrink-0 flex items-center justify-center gap-4 px-4 py-2">
            {CANDIES.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <span style={{ fontSize: 18, lineHeight: 1 }}>{c.emoji}</span>
              </div>
            ))}
          </div>

          {/* Instruction */}
          <div className="flex-shrink-0 text-center pb-3">
            <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.22)" }}>
              Tap a candy, then tap an adjacent candy to swap • Match 3 or more to score
            </span>
          </div>
        </div>
      )}

      {/* ── Result ── */}
      {phase === "result" && (
        <ResultScreen
          won={won}
          entryFee={entryFee}
          score={score}
          target={target}
          onBack={onBack}
          onRematch={handleRematch}
        />
      )}
    </div>
  );
}
