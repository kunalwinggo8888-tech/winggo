/**
 * Hexa2048Game — WINGGO 3D Hexagonal 2048
 * React/CSS: hex grid, swipe merging in 6 directions, glow pulse animations, target 2048.
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";

// Hex grid: axial coordinates, radius 2 (19 cells)
function hexNeighbors(q: number, r: number): [number, number][] {
  return [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]].map(([dq,dr]) => [q+dq, r+dr] as [number,number]);
}

const HEX_RADIUS = 2;
function allHexes(): [number, number][] {
  const cells: [number, number][] = [];
  for (let q = -HEX_RADIUS; q <= HEX_RADIUS; q++) {
    for (let r = -HEX_RADIUS; r <= HEX_RADIUS; r++) {
      if (Math.abs(q + r) <= HEX_RADIUS) cells.push([q, r]);
    }
  }
  return cells;
}
const ALL_HEXES = allHexes();

type Grid = Map<string, number>;

function key(q: number, r: number) { return `${q},${r}`; }

function makeEmpty(): Grid {
  const g: Grid = new Map();
  ALL_HEXES.forEach(([q, r]) => g.set(key(q, r), 0));
  return g;
}

function addRandom(g: Grid): Grid {
  const empties = ALL_HEXES.filter(([q, r]) => (g.get(key(q, r)) ?? 0) === 0);
  if (empties.length === 0) return g;
  const [q, r] = empties[Math.floor(Math.random() * empties.length)];
  const ng = new Map(g);
  ng.set(key(q, r), Math.random() < 0.85 ? 2 : 4);
  return ng;
}

// 6 axial directions
const DIRECTIONS: [number, number][] = [[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];

function slideInDirection(grid: Grid, dq: number, dr: number): { grid: Grid; score: number; moved: boolean } {
  const ng = new Map(grid);
  let score = 0, moved = false;
  const merged = new Set<string>();
  // Sort hexes: process in order away from direction
  const sorted = [...ALL_HEXES].sort((a, b) => {
    const aD = a[0] * dq + a[1] * dr;
    const bD = b[0] * dq + b[1] * dr;
    return bD - aD;
  });
  for (const [q, r] of sorted) {
    const val = ng.get(key(q, r));
    if (!val) continue;
    // Slide in direction
    let cq = q, cr = r;
    while (true) {
      const nq = cq + dq, nr = cr + dr;
      if (!ng.has(key(nq, nr))) break; // Edge of board
      const nv = ng.get(key(nq, nr));
      if (nv === 0) { ng.set(key(nq, nr), val); ng.set(key(cq, cr), 0); cq = nq; cr = nr; moved = true; }
      else if (nv === val && !merged.has(key(nq, nr))) {
        ng.set(key(nq, nr), val * 2); ng.set(key(cq, cr), 0);
        merged.add(key(nq, nr)); score += val * 2; moved = true; break;
      } else break;
    }
  }
  return { grid: ng, score, moved };
}

const TILE_COLORS: Record<number, { bg: string; text: string; glow: string }> = {
  0:    { bg: "rgba(255,255,255,0.04)", text: "transparent", glow: "none" },
  2:    { bg: "#1a1a2e", text: "#c0c8e0", glow: "rgba(100,100,200,0.3)" },
  4:    { bg: "#16213e", text: "#a0d0ff", glow: "rgba(80,150,255,0.4)" },
  8:    { bg: "#0f3460", text: "#80ffcc", glow: "rgba(0,255,180,0.4)" },
  16:   { bg: "#0d4a6a", text: "#FFD700", glow: "rgba(255,215,0,0.4)" },
  32:   { bg: "#1a5c00", text: "#adf06a", glow: "rgba(120,255,0,0.4)" },
  64:   { bg: "#7c2d00", text: "#ff9944", glow: "rgba(255,150,0,0.5)" },
  128:  { bg: "#6d0f6d", text: "#ff80ff", glow: "rgba(255,0,255,0.5)" },
  256:  { bg: "#8b0000", text: "#ff4444", glow: "rgba(255,0,0,0.6)" },
  512:  { bg: "#003366", text: "#44aaff", glow: "rgba(0,150,255,0.6)" },
  1024: { bg: "#331a00", text: "#ffaa00", glow: "rgba(255,170,0,0.7)" },
  2048: { bg: "#FFD700", text: "#000", glow: "rgba(255,215,0,1)" },
};

function tileStyle(val: number) {
  const c = TILE_COLORS[val] ?? TILE_COLORS[2048];
  return { background: c.bg, color: c.text, boxShadow: val > 0 ? `0 0 14px ${c.glow}` : "none" };
}

function hexToPixel(q: number, r: number, size: number): { x: number; y: number } {
  const x = size * (Math.sqrt(3) * q + Math.sqrt(3) / 2 * r);
  const y = size * (3 / 2 * r);
  return { x, y };
}

function hexPath(cx: number, cy: number, size: number): string {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function MM({ fee, onStart }: { fee: number; onStart: () => void }) {
  const [cd, setCd] = useState(3);
  const startedRef = useRef(false);
  if (!startedRef.current) {
    startedRef.current = true;
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 200); return 0; } return c - 1; }), 900);
  }
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{ background: "rgba(255,215,0,0.12)", border: "2px solid rgba(255,215,0,0.45)" }}
        animate={{ rotate: [0, 60, 120, 180, 240, 300, 360] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>🔷</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">2048 Hexa 3D</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Merge tiles to reach 2048!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function Hexa2048Game({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [grid, setGrid] = useState<Grid>(makeEmpty());
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [mergeFlash, setMergeFlash] = useState<string[]>([]);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const CELL_SIZE = 34;
  const SVG_W = 260, SVG_H = 260;

  const startGame = useCallback(() => {
    let g = makeEmpty();
    g = addRandom(g); g = addRandom(g);
    setGrid(g); setScore(0); setWon(false); setMergeFlash([]);
    setPhase("playing");
  }, []);

  const doSwipe = useCallback((dq: number, dr: number) => {
    setGrid(prev => {
      const { grid: ng, score: pts, moved } = slideInDirection(prev, dq, dr);
      if (!moved) return prev;
      setScore(s => s + pts);
      // Check win
      let w = false;
      ng.forEach(v => { if (v >= 2048) w = true; });
      if (w) { setWon(true); setTimeout(() => { addWinning(prize, `🔷 2048 Hexa — Won ₹${prize}`); setPhase("result"); }, 400); }
      // Check lose: no moves left
      const hasEmpty = [...ng.values()].some(v => v === 0);
      if (!hasEmpty) {
        let canMove = false;
        for (const [q, r] of ALL_HEXES) {
          const v = ng.get(key(q, r));
          for (const [nq, nr] of hexNeighbors(q, r)) {
            const nv = ng.get(key(nq, nr));
            if (nv !== undefined && nv === v) { canMove = true; break; }
          }
          if (canMove) break;
        }
        if (!canMove) { setWon(false); setTimeout(() => setPhase("result"), 400); return ng; }
      }
      return addRandom(ng);
    });
  }, [prize, addWinning]);

  // Swipe detection
  const onTouchStart = (e: React.TouchEvent) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    // Map swipe to hex direction
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle > -30 && angle <= 30) doSwipe(1, 0);
    else if (angle > 30 && angle <= 90) doSwipe(1, -1);
    else if (angle > 90 && angle <= 150) doSwipe(0, -1);
    else if (angle > 150 || angle <= -150) doSwipe(-1, 0);
    else if (angle > -150 && angle <= -90) doSwipe(-1, 1);
    else doSwipe(0, 1);
  };

  function handleRematch() { setWon(false); setScore(0); setGrid(makeEmpty()); setMergeFlash([]); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,215,0,0.2)" };

  const maxTile = phase === "playing" ? Math.max(0, ...[...grid.values()]) : 0;

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#07060e", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🔷</span><span className="font-black text-white text-base">2048 Hexa 3D</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>
      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col items-center" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* Score + best tile */}
          <div className="flex items-center justify-between w-full px-4 py-2" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.7)" }}>SCORE</div><div className="text-base font-black" style={{ color: "#FFD700" }}>{score}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>BEST TILE</div><div className="text-base font-black" style={{ color: maxTile >= 1024 ? "#FFD700" : "white" }}>{maxTile || "—"}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>TARGET</div><div className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>2048</div></div>
          </div>

          {/* SVG Hex Grid */}
          <div className="flex-1 flex items-center justify-center py-4">
            <svg width={SVG_W} height={SVG_H} viewBox={`${-SVG_W / 2} ${-SVG_H / 2} ${SVG_W} ${SVG_H}`} style={{ overflow: "visible" }}>
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {ALL_HEXES.map(([q, r]) => {
                const { x, y } = hexToPixel(q, r, CELL_SIZE);
                const val = grid.get(key(q, r)) ?? 0;
                const pts = hexPath(x, y, CELL_SIZE - 2);
                const style = TILE_COLORS[val] ?? TILE_COLORS[2048];
                return (
                  <g key={key(q, r)}>
                    <polygon points={pts} fill={style.bg} stroke={val > 0 ? style.glow : "rgba(255,255,255,0.05)"} strokeWidth={val > 0 ? 1.5 : 0.5} filter={val >= 128 ? "url(#glow)" : undefined} />
                    {val > 0 && (
                      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
                        fill={style.text} fontWeight="900" fontSize={val >= 1024 ? 11 : val >= 128 ? 13 : 15}>
                        {val}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Swipe buttons (for desktop) */}
          <div className="px-4 pb-4">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => doSwipe(-1, 1)} className="py-3 rounded-xl text-xs font-black cursor-pointer active:scale-95" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>↙</button>
              <button onClick={() => doSwipe(0, 1)} className="py-3 rounded-xl text-xs font-black cursor-pointer active:scale-95" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>↓</button>
              <button onClick={() => doSwipe(1, 0)} className="py-3 rounded-xl text-xs font-black cursor-pointer active:scale-95" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>↘</button>
              <button onClick={() => doSwipe(-1, 0)} className="py-3 rounded-xl text-xs font-black cursor-pointer active:scale-95" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>↖</button>
              <button onClick={() => doSwipe(0, -1)} className="py-3 rounded-xl text-xs font-black cursor-pointer active:scale-95" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>↑</button>
              <button onClick={() => doSwipe(1, -1)} className="py-3 rounded-xl text-xs font-black cursor-pointer active:scale-95" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>↗</button>
            </div>
            <div className="text-center text-[10px] mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>Swipe or tap arrows to merge</div>
          </div>
        </div>
      )}
      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(255,215,0,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(255,215,0,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(255,215,0,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "🔷"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? "2048 Master! 🎉" : "Board Full!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Final Score: {score}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,215,0,0.2)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(255,215,0,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#FFD700,#b8860b)", color: "#000", boxShadow: "0 0 28px rgba(255,215,0,0.4)" }}>
            🔷 Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
