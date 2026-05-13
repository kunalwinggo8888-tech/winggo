/**
 * LiquidSortGame — WINGGO Premium Puzzle
 * Glass tubes filled with coloured liquid layers.
 * Click a tube to select it, then click another to pour.
 * Rules: top colours must match, or target must be empty.
 * Win condition: every non-empty tube contains only one colour.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;

const LIQUID_COLORS: { id: string; bg: string; glow: string; label: string }[] = [
  { id: "red",    bg: "linear-gradient(180deg,#ff6b6b,#c0392b)", glow: "#ff6b6b", label: "Red" },
  { id: "blue",   bg: "linear-gradient(180deg,#74b9ff,#2980b9)", glow: "#74b9ff", label: "Blue" },
  { id: "green",  bg: "linear-gradient(180deg,#55efc4,#00b894)", glow: "#55efc4", label: "Green" },
  { id: "yellow", bg: "linear-gradient(180deg,#fdcb6e,#e17055)", glow: "#fdcb6e", label: "Yellow" },
];

const TUBE_CAPACITY = 4;
const NUM_COLORS    = 4;
const EMPTY_TUBES   = 2;

function buildPuzzle(): string[][] {
  const pool: string[] = [];
  for (const c of LIQUID_COLORS.slice(0, NUM_COLORS)) {
    for (let i = 0; i < TUBE_CAPACITY; i++) pool.push(c.id);
  }
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const tubes: string[][] = [];
  for (let t = 0; t < NUM_COLORS; t++) {
    tubes.push(pool.slice(t * TUBE_CAPACITY, (t + 1) * TUBE_CAPACITY));
  }
  for (let e = 0; e < EMPTY_TUBES; e++) tubes.push([]);
  return tubes;
}

function isSolved(tubes: string[][]): boolean {
  return tubes.every(
    (t) => t.length === 0 || (t.length === TUBE_CAPACITY && t.every((c) => c === t[0]))
  );
}

function topColor(tube: string[]): string | null {
  return tube.length > 0 ? tube[tube.length - 1] : null;
}

function canPour(from: string[], to: string[]): boolean {
  if (from.length === 0) return false;
  if (to.length >= TUBE_CAPACITY) return false;
  const fromTop = topColor(from)!;
  const toTop   = topColor(to);
  return toTop === null || toTop === fromTop;
}

function pourOnce(tubes: string[][]): string[][] {
  const next = tubes.map((t) => [...t]);
  const fromIdx = next.findIndex((t) => t.length > 0);
  if (fromIdx === -1) return next;
  const col = topColor(next[fromIdx])!;
  const toIdx = next.findIndex(
    (t, i) => i !== fromIdx && t.length < TUBE_CAPACITY && (t.length === 0 || topColor(t) === col)
  );
  if (toIdx === -1) return next;
  next[toIdx].push(next[fromIdx].pop()!);
  return next;
}

function getColorCfg(id: string) {
  return LIQUID_COLORS.find((c) => c.id === id) ?? LIQUID_COLORS[0];
}

// ── Tube component ─────────────────────────────────────────────────────────

function Tube({
  layers, isSelected, isSolved: solved, onClick,
}: {
  layers: string[]; isSelected: boolean; isSolved: boolean; onClick: () => void;
}) {
  return (
    <motion.div
      onClick={onClick}
      animate={{ y: isSelected ? -20 : 0 }}
      transition={{ type: "spring", stiffness: 500, damping: 28 }}
      className="relative flex flex-col-reverse items-center cursor-pointer"
      style={{ width: 52, height: 200 }}
    >
      {/* Glass tube body */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-b-3xl rounded-t-xl overflow-hidden"
        style={{
          height: 190,
          background: "rgba(255,255,255,0.06)",
          border: `2px solid ${isSelected ? "#FFD700" : solved ? "#22c55e" : "rgba(255,255,255,0.18)"}`,
          boxShadow: isSelected
            ? "0 0 20px rgba(255,215,0,0.6), inset 0 0 10px rgba(255,215,0,0.1)"
            : solved
            ? "0 0 18px rgba(34,197,94,0.5)"
            : "inset 2px 0 6px rgba(255,255,255,0.06)",
          transition: "border-color 0.2s, box-shadow 0.2s",
        }}
      >
        {/* Liquid layers — bottom up */}
        {layers.map((colorId, i) => {
          const cfg = getColorCfg(colorId);
          return (
            <motion.div
              key={`${i}-${colorId}`}
              style={{
                height: `${100 / TUBE_CAPACITY}%`,
                background: cfg.bg,
                boxShadow: `inset 0 2px 4px rgba(255,255,255,0.3), 0 0 8px ${cfg.glow}55`,
              }}
              initial={{ scaleY: 0, originY: 1 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
            />
          );
        })}
        {/* Glass shine */}
        <div
          className="absolute top-0 left-1 w-2 rounded-full pointer-events-none"
          style={{ height: "80%", background: "linear-gradient(180deg,rgba(255,255,255,0.22),transparent)" }}
        />
      </div>

      {/* Tube open top rim */}
      <div
        className="absolute top-0 left-0 right-0 h-3 rounded-t-xl"
        style={{ background: "rgba(255,255,255,0.12)", border: "2px solid rgba(255,255,255,0.2)" }}
      />
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function LiquidSortGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [tubes, setTubes]       = useState<string[][]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [won, setWon]           = useState(false);
  const [moves, setMoves]       = useState(0);
  const [shake, setShake]       = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const TIME_LIMIT = difficulty.level === "Beginner" ? 180 : difficulty.level === "Pro" ? 120 : 90;

  function startGame() {
    const p = buildPuzzle();
    setTubes(p);
    setSelected(null);
    setMoves(0);
    setWon(false);
    setTimeLeft(TIME_LIMIT);
    setPhase("playing");
  }

  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setWon(false);
          setPhase("result");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [phase]);

  function handleTubeClick(idx: number) {
    if (phase !== "playing") return;

    if (selected === null) {
      if (tubes[idx].length === 0) return;
      setSelected(idx);
      return;
    }

    if (selected === idx) {
      setSelected(null);
      return;
    }

    const from = tubes[selected];
    const to   = tubes[idx];

    if (!canPour(from, to)) {
      setShake(idx);
      setTimeout(() => setShake(null), 400);
      setSelected(null);
      return;
    }

    // Pour as many matching layers as possible
    const next = tubes.map((t) => [...t]);
    const col  = topColor(next[selected])!;
    while (
      next[selected].length > 0 &&
      topColor(next[selected]) === col &&
      next[idx].length < TUBE_CAPACITY
    ) {
      next[idx].push(next[selected].pop()!);
    }

    setTubes(next);
    setSelected(null);
    setMoves((m) => m + 1);

    if (isSolved(next)) {
      clearInterval(timerRef.current!);
      setWon(true);
      addWinning(prize, "Liquid Sort Win");
      setPhase("result");
    }
  }

  const tubeRows = [tubes.slice(0, 3), tubes.slice(3)];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0d0820 0%,#050412 100%)", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🧪 Liquid Sort</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      {/* Live HUD */}
      {phase === "playing" && (
        <div className="flex items-center justify-between px-5 py-2" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-sm font-black" style={{ color: timeLeft <= 20 ? "#ef4444" : "#22c55e" }}>
            ⏱ {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
          <div className="text-sm font-black text-zinc-300">Moves: {moves}</div>
          <div className="text-xs font-bold" style={{ color: "#FFD700" }}>🏆 ₹{prize}</div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative">
        <AnimatePresence>

          {/* ── INTRO ── */}
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 text-center">
              <div className="text-7xl">🧪</div>
              <div className="text-white font-black text-3xl">Liquid Sort</div>
              <div className="text-zinc-400 text-sm px-8">Sort the coloured liquids — each tube must contain only one colour!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} <b>{difficulty.level}</b> · Solve in {TIME_LIMIT}s
              </div>
              <div className="flex gap-3 px-4 py-3 rounded-2xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-zinc-300 text-xs">👆 Tap tube to select · Tap again to pour</span>
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                SORT! 🧪
              </motion.button>
            </motion.div>
          )}

          {/* ── PLAYING ── */}
          {phase === "playing" && (
            <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col items-center gap-8">
              {tubeRows.map((row, rowIdx) => (
                <div key={rowIdx} className="flex gap-5 justify-center">
                  {row.map((tube, relIdx) => {
                    const absIdx = rowIdx === 0 ? relIdx : relIdx + 3;
                    const solved = tube.length === 0 || (tube.length === TUBE_CAPACITY && tube.every((c) => c === tube[0]));
                    return (
                      <motion.div
                        key={absIdx}
                        animate={shake === absIdx ? { x: [-6, 6, -4, 4, 0] } : {}}
                        transition={{ duration: 0.35 }}
                      >
                        <Tube
                          layers={tube}
                          isSelected={selected === absIdx}
                          isSolved={solved}
                          onClick={() => handleTubeClick(absIdx)}
                        />
                      </motion.div>
                    );
                  })}
                </div>
              ))}

              {/* Reset button */}
              <motion.button whileTap={{ scale: 0.94 }} onClick={startGame}
                className="px-6 py-2.5 rounded-xl font-black text-sm cursor-pointer"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)" }}>
                🔄 Reset Puzzle
              </motion.button>
            </motion.div>
          )}

          {/* ── RESULT ── */}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-5 text-center px-6">
              <motion.div className="text-7xl" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }}>
                {won ? "🎉" : "⏰"}
              </motion.div>
              <div className="text-white font-black text-3xl">{won ? "SORTED!" : "Time's Up!"}</div>
              {won ? (
                <>
                  <div className="text-sm text-zinc-400">Completed in <b className="text-white">{moves}</b> moves · {TIME_LIMIT - timeLeft}s used</div>
                  <div className="px-8 py-4 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                    <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                    <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                  </div>
                </>
              ) : (
                <div className="text-zinc-400 text-sm">The liquids remained unsorted. Better luck next time!</div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black text-base"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                  Play Again
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>
                  Home
                </motion.button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
