import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { useWallet } from "@/context/WalletContext";

// ─────────────────────────────────────────────────────────────
// BOARD DATA
// ─────────────────────────────────────────────────────────────

const C = 30; // SVG cell size

const MAIN_PATH: [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],
  [0,8],[1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],
  [8,14],[8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],
  [14,6],[13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],
]; // 52 cells

const HOME_COLS: [number, number][][] = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],    // Red  – row 7, left→right
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],    // Blue  – col 7, top→bottom
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],// Green – row 7, right→left
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],// Yellow– col 7, bottom→top
];

const OFFSETS = [0, 13, 26, 39]; // path-start index per player
const SAFE_SET = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const YARD: [number, number][][] = [
  [[1,1],[1,4],[4,1],[4,4]],          // Red    (top-left)
  [[1,10],[1,13],[4,10],[4,13]],      // Blue   (top-right)
  [[10,10],[10,13],[13,10],[13,13]],  // Green  (bottom-right)
  [[10,1],[10,4],[13,1],[13,4]],      // Yellow (bottom-left)
];

const TH = [
  { name:"Red",    fill:"#e74c3c", bg:"#922b21", home:"#5c1b16", col:"#a93226", glow:"rgba(231,76,60,.7)"  },
  { name:"Blue",   fill:"#2980b9", bg:"#1a5276", home:"#152945", col:"#1f618d", glow:"rgba(41,128,185,.7)" },
  { name:"Green",  fill:"#27ae60", bg:"#1e8449", home:"#144d2d", col:"#239b56", glow:"rgba(39,174,96,.7)"  },
  { name:"Yellow", fill:"#d4ac0d", bg:"#9a7d0a", home:"#4a3b05", col:"#b7950b", glow:"rgba(212,172,13,.7)" },
];

const BOT_NAMES = ["ArjunBot","RiyaBot","DevBot","AnaBot"];
const EMOJIS = ["🔥","😎","💪","🎉","😤","👏"];

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface Token { step: number }

interface Player {
  id: number;
  name: string;
  isBot: boolean;
  tokens: Token[];
}

interface GS {
  players: Player[];
  activePIs: number[];
  curTurn: number;
  dice: number | null;
  rolled: boolean;
  validMoves: number[];
  winner: number | null;
  mode: "2p" | "4p";
  entryFee: number;
}

// ─────────────────────────────────────────────────────────────
// GAME LOGIC
// ─────────────────────────────────────────────────────────────

function gridPos(pi: number, step: number): [number, number] | null {
  if (step === 0) return null;
  if (step >= 59) return [7, 7];
  if (step >= 53) return HOME_COLS[pi][step - 53];
  return MAIN_PATH[(OFFSETS[pi] + step - 1) % 52];
}

function calcValidMoves(players: Player[], pi: number, dice: number): number[] {
  return players[pi].tokens.reduce<number[]>((acc, t, ti) => {
    if (t.step === 59) return acc;
    if (t.step === 0 && dice === 6) return [...acc, ti];
    if (t.step > 0 && t.step + dice <= 58) return [...acc, ti];
    return acc;
  }, []);
}

function applyMove(players: Player[], pi: number, ti: number, dice: number): Player[] {
  const p2 = players.map(pl => ({ ...pl, tokens: pl.tokens.map(t => ({ ...t })) }));
  const tok = p2[pi].tokens[ti];
  tok.step = tok.step === 0 ? 1 : Math.min(tok.step + dice, 58);
  if (tok.step >= 58) tok.step = 59;

  if (tok.step >= 1 && tok.step <= 52) {
    const idx = (OFFSETS[pi] + tok.step - 1) % 52;
    if (!SAFE_SET.has(idx)) {
      const pos = gridPos(pi, tok.step);
      if (pos) {
        p2.forEach((pl, pj) => {
          if (pj === pi) return;
          pl.tokens.forEach(t2 => {
            if (t2.step >= 1 && t2.step <= 52) {
              const tp = gridPos(pj, t2.step);
              if (tp?.[0] === pos[0] && tp?.[1] === pos[1]) t2.step = 0;
            }
          });
        });
      }
    }
  }
  return p2;
}

function isWinner(players: Player[], pi: number) {
  return players[pi].tokens.every(t => t.step === 59);
}

function botPick(players: Player[], pi: number, dice: number): number {
  const vm = calcValidMoves(players, pi, dice);
  if (!vm.length) return -1;
  for (const ti of vm) {
    const ns = players[pi].tokens[ti].step === 0 ? 1 : players[pi].tokens[ti].step + dice;
    if (ns >= 1 && ns <= 52) {
      const idx = (OFFSETS[pi] + ns - 1) % 52;
      if (!SAFE_SET.has(idx)) {
        const pos = gridPos(pi, ns);
        const caps = players.some((pl, pj) =>
          pj !== pi && pl.tokens.some(t2 => {
            if (t2.step < 1 || t2.step > 52) return false;
            const tp = gridPos(pj, t2.step);
            return tp?.[0] === pos?.[0] && tp?.[1] === pos?.[1];
          })
        );
        if (caps) return ti;
      }
    }
  }
  let best = vm[0], bestStep = -1;
  for (const ti of vm) {
    if (players[pi].tokens[ti].step > bestStep) { bestStep = players[pi].tokens[ti].step; best = ti; }
  }
  return best;
}

// ─────────────────────────────────────────────────────────────
// DICE
// ─────────────────────────────────────────────────────────────

const DOTS: Record<number, [number, number][]> = {
  1: [[50,50]],
  2: [[25,25],[75,75]],
  3: [[25,25],[50,50],[75,75]],
  4: [[25,25],[75,25],[25,75],[75,75]],
  5: [[25,25],[75,25],[50,50],[25,75],[75,75]],
  6: [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
};

function Dice({ value, rolling, onRoll, disabled }: {
  value: number | null; rolling: boolean; onRoll: () => void; disabled: boolean;
}) {
  const v = value ?? 1;
  return (
    <motion.button
      onClick={!disabled ? onRoll : undefined}
      disabled={disabled}
      whileTap={!disabled ? { scale: 0.85 } : {}}
      animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.15, 0.9, 1.1, 1] } : {}}
      transition={rolling ? { duration: 0.7, times: [0, .25, .5, .75, 1] } : {}}
      className="relative rounded-2xl select-none"
      style={{
        width: 64, height: 64,
        background: disabled && !value ? "rgba(255,255,255,0.08)" : "linear-gradient(145deg,#fff 0%,#d0d0d0 100%)",
        boxShadow: !disabled ? "0 6px 20px rgba(255,215,0,.5),0 2px 8px rgba(0,0,0,.8)" : "none",
        opacity: disabled && !value ? 0.4 : 1,
        border: !disabled && !rolling ? "2px solid rgba(255,215,0,.6)" : "2px solid transparent",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", padding: 6 }}>
        {DOTS[v].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={10} fill="#1a1a2e" />
        ))}
      </svg>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// BOARD SVG
// ─────────────────────────────────────────────────────────────

function Board({ gs, onToken }: { gs: GS; onToken: (pi: number, ti: number) => void }) {
  const curPI = gs.activePIs[gs.curTurn];
  const isHuman = curPI === 0;

  const posMap = new Map<string, { pi: number; ti: number }[]>();
  gs.players.forEach((pl, pi) => {
    if (!gs.activePIs.includes(pi)) return;
    pl.tokens.forEach((t, ti) => {
      if (t.step > 0 && t.step < 59) {
        const pos = gridPos(pi, t.step);
        if (pos) {
          const k = `${pos[0]},${pos[1]}`;
          const arr = posMap.get(k) ?? [];
          arr.push({ pi, ti });
          posMap.set(k, arr);
        }
      }
    });
  });

  return (
    <svg viewBox="0 0 450 450" width="100%" style={{ display: "block", maxWidth: "100%" }}>
      <rect width="450" height="450" fill="#0d0d1a" rx="4" />

      {/* ── CELLS ── */}
      {Array.from({ length: 15 }, (_, row) =>
        Array.from({ length: 15 }, (_, col) => {
          const x = col * C, y = row * C;
          let fill = "#13131f", stroke = "#1a1a2e";

          if (row <= 5 && col <= 5) { fill = TH[0].home; stroke = TH[0].bg; }
          else if (row <= 5 && col >= 9) { fill = TH[1].home; stroke = TH[1].bg; }
          else if (row >= 9 && col >= 9) { fill = TH[2].home; stroke = TH[2].bg; }
          else if (row >= 9 && col <= 5) { fill = TH[3].home; stroke = TH[3].bg; }
          else if (row === 7 && col === 7) { fill = "transparent"; }
          else if (row === 7 && col >= 1 && col <= 6) { fill = TH[0].col; stroke = TH[0].fill; }
          else if (col === 7 && row >= 1 && row <= 6) { fill = TH[1].col; stroke = TH[1].fill; }
          else if (row === 7 && col >= 8 && col <= 13) { fill = TH[2].col; stroke = TH[2].fill; }
          else if (col === 7 && row >= 8 && row <= 13) { fill = TH[3].col; stroke = TH[3].fill; }

          const mpIdx = MAIN_PATH.findIndex(([r, c]) => r === row && c === col);
          const safe = mpIdx !== -1 && SAFE_SET.has(mpIdx);

          return (
            <g key={`c${row}-${col}`}>
              <rect x={x} y={y} width={C} height={C} fill={fill} stroke={stroke} strokeWidth="0.6" />
              {safe && (
                <text x={x + 15} y={y + 19} textAnchor="middle" fontSize="11" dominantBaseline="auto">⭐</text>
              )}
            </g>
          );
        })
      )}

      {/* ── YARD INNER GLOW ── */}
      {([
        [30,30,0],[270,30,1],[270,270,2],[30,270,3],
      ] as [number,number,number][]).map(([x, y, i]) => (
        <rect key={`yi${i}`} x={x} y={y} width={120} height={120} rx="12"
          fill={TH[i].fill} opacity="0.12" stroke={TH[i].fill} strokeWidth="1.5" strokeOpacity="0.4" />
      ))}

      {/* ── YARD SLOTS ── */}
      {gs.players.map((_, pi) =>
        !gs.activePIs.includes(pi) ? null :
          YARD[pi].map(([row, col], si) => (
            <circle key={`ys${pi}-${si}`}
              cx={col * C + 15} cy={row * C + 15} r={11}
              fill={TH[pi].bg} stroke={TH[pi].fill} strokeWidth="1.5" opacity="0.55" />
          ))
      )}

      {/* ── CENTER TRIANGLES ── */}
      <polygon points="180,180 180,270 225,225" fill={TH[0].fill} opacity="0.9" />
      <polygon points="180,180 270,180 225,225" fill={TH[1].fill} opacity="0.9" />
      <polygon points="270,180 270,270 225,225" fill={TH[2].fill} opacity="0.9" />
      <polygon points="180,270 270,270 225,225" fill={TH[3].fill} opacity="0.9" />
      <circle cx="225" cy="225" r="26" fill="#07070d" stroke="#FFD700" strokeWidth="2.5" />
      <text x="225" y="232" textAnchor="middle" fontSize="18">🏠</text>

      {/* ── TOKENS ── */}
      {gs.players.map((pl, pi) =>
        !gs.activePIs.includes(pi) ? null :
          pl.tokens.map((t, ti) => {
            const th = TH[pi];
            const canMove = isHuman && curPI === pi && gs.rolled && gs.validMoves.includes(ti) && gs.winner === null;
            let cx: number, cy: number;

            if (t.step === 0) {
              const [row, col] = YARD[pi][ti];
              cx = col * C + 15; cy = row * C + 15;
            } else if (t.step === 59) {
              const offs: [number,number][] = [[-7,-7],[7,-7],[-7,7],[7,7]];
              cx = 225 + offs[ti][0]; cy = 225 + offs[ti][1];
            } else {
              const pos = gridPos(pi, t.step)!;
              const k = `${pos[0]},${pos[1]}`;
              const stack = posMap.get(k) ?? [];
              const idx = stack.findIndex(s => s.pi === pi && s.ti === ti);
              const offsets: [number,number][] = [[0,0],[-5,-5],[5,-5],[0,5]];
              const off = offsets[Math.min(idx, 3)];
              cx = pos[1] * C + 15 + off[0]; cy = pos[0] * C + 15 + off[1];
            }

            return (
              <g key={`tok${pi}-${ti}`}
                onClick={() => canMove && onToken(pi, ti)}
                style={{ cursor: canMove ? "pointer" : "default" }}>
                {canMove && (
                  <circle cx={cx} cy={cy} r={14} fill={th.fill} opacity="0.4">
                    <animate attributeName="r" values="12;17;12" dur="0.85s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.65;0.4" dur="0.85s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={cx} cy={cy} r={11} fill={th.fill} stroke={t.step === 59 ? "#FFD700" : th.bg} strokeWidth="2" />
                <circle cx={cx} cy={cy} r={5.5} fill={th.bg} opacity="0.55" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff">{ti + 1}</text>
              </g>
            );
          })
      )}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// HOME SCREEN
// ─────────────────────────────────────────────────────────────

function LudoHome({ onStart, onBack }: {
  onStart: (fee: number, mode: "2p" | "4p") => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"2p" | "4p">("2p");
  const FEES = [1, 5, 10, 50];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0f", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,215,0,0.12)", background: "rgba(10,10,20,0.95)", backdropFilter: "blur(10px)" }}>
        <BackButton onBack={onBack} label="Home" />
        <div className="flex-1">
          <div className="text-white font-black text-lg leading-none">🎲 Ludo Classic</div>
          <div className="text-xs mt-0.5" style={{ color: "#666" }}>Real Money · Instant Win</div>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5 rounded-full"
          style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.25)" }}>
          <span className="text-xs font-bold" style={{ color: "#FFD700" }}>₹0.00</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Featured banner */}
        <div className="rounded-2xl p-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg,#1a0a3e,#2d1060)", border: "1.5px solid rgba(139,92,246,0.4)" }}>
          <div>
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "#9b59b6" }}>Live Now</div>
            <div className="text-white font-black text-lg">4.2L+ Players</div>
            <div className="text-xs mt-0.5" style={{ color: "#888" }}>Win up to ₹90 per game</div>
          </div>
          <div className="text-5xl">🎲</div>
        </div>

        {/* Mode */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#555" }}>Select Mode</div>
          <div className="grid grid-cols-2 gap-3">
            {(["2p", "4p"] as const).map(m => (
              <motion.button key={m} whileTap={{ scale: 0.96 }} onClick={() => setMode(m)}
                className="py-4 rounded-2xl text-center"
                style={{
                  background: mode === m ? "linear-gradient(135deg,#5b2c99,#8e44ad)" : "rgba(255,255,255,0.05)",
                  border: `2px solid ${mode === m ? "#9b59b6" : "rgba(255,255,255,0.08)"}`,
                  color: mode === m ? "#fff" : "#555",
                }}>
                <div className="text-3xl mb-1">{m === "2p" ? "👥" : "👨‍👩‍👧‍👦"}</div>
                <div className="font-black text-sm">{m === "2p" ? "2 Players" : "4 Players"}</div>
                <div className="text-xs mt-0.5 opacity-70">{m === "2p" ? "1 vs 1" : "Battle Royale"}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Entry fee */}
        <div>
          <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#555" }}>Choose Entry Fee</div>
          <div className="grid grid-cols-2 gap-3">
            {FEES.map(fee => (
              <motion.button key={fee} whileTap={{ scale: 0.94 }} onClick={() => onStart(fee, mode)}
                className="py-5 rounded-2xl flex flex-col items-center gap-1.5 relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,140,0,0.06))",
                  border: "1.5px solid rgba(255,215,0,0.25)",
                }}>
                <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div>
                <div className="text-xs" style={{ color: "#888" }}>Win ₹{Math.floor(fee * 1.8)}</div>
                <div className="text-xs px-2.5 py-0.5 rounded-full font-bold mt-0.5"
                  style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>
                  {fee === 1 ? "🔥 Popular" : fee === 5 ? "⚡ Trending" : fee === 10 ? "💎 Pro" : "👑 Elite"}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Rules */}
        <div className="rounded-2xl p-4 space-y-2"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-white font-bold text-sm">How to Play</div>
          {[
            ["🎲","Roll the dice to move tokens around the board"],
            ["6️⃣","Roll a 6 to take a token out of yard + bonus turn"],
            ["⭐","Land on ★ safe squares — can't be captured"],
            ["🏠","Get all 4 tokens home first to win"],
            ["🤖","Bot joins automatically if no player in 20s"],
          ].map(([icon, text], i) => (
            <div key={i} className="flex items-start gap-2 text-xs" style={{ color: "#777" }}>
              <span className="flex-shrink-0">{icon}</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MATCHMAKING
// ─────────────────────────────────────────────────────────────

function Matchmaking({ mode, fee, onReady, onBack }: {
  mode: "2p" | "4p"; fee: number;
  onReady: (gs: GS) => void; onBack: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [found, setFound] = useState(false);
  const BOT_DELAY = 5;

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (elapsed >= BOT_DELAY && !found) setFound(true);
  }, [elapsed, found]);

  useEffect(() => {
    if (!found) return;
    const t = setTimeout(() => {
      const activePIs = mode === "2p" ? [0, 2] : [0, 1, 2, 3];
      const players: Player[] = [0, 1, 2, 3].map(id => ({
        id,
        name: id === 0 ? "You" : BOT_NAMES[id - 1],
        isBot: id !== 0,
        tokens: [{ step: 0 }, { step: 0 }, { step: 0 }, { step: 0 }],
      }));
      onReady({ players, activePIs, curTurn: 0, dice: null, rolled: false, validMoves: [], winner: null, mode, entryFee: fee });
    }, 1200);
    return () => clearTimeout(t);
  }, [found]);

  const slots = mode === "2p" ? 2 : 4;
  const playerColors = [0, 2, 1, 3]; // Red, Green, Blue, Yellow for 2P and 4P

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: "#0a0a0f", maxWidth: 480, margin: "0 auto" }}>
      <motion.div className="w-full rounded-3xl p-6 space-y-5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1.5px solid rgba(255,215,0,0.2)" }}
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}>

        <div className="text-center">
          <div className="text-white font-black text-xl">Finding Opponents...</div>
          <div className="text-xs mt-1" style={{ color: "#666" }}>
            {mode === "2p" ? "2 Player" : "4 Player"} · Entry ₹{fee}
          </div>
        </div>

        <div className={`grid gap-3 ${slots === 2 ? "grid-cols-2" : "grid-cols-2"}`}>
          {Array.from({ length: slots }, (_, i) => {
            const isFilled = i === 0 || found || (mode === "4p" && elapsed > i * 1.5);
            const piColor = playerColors[i];
            return (
              <motion.div key={i}
                className="rounded-2xl p-3 flex flex-col items-center gap-2 text-center"
                style={{
                  background: isFilled ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.03)",
                  border: `1.5px solid ${isFilled ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}>
                {isFilled ? (
                  <>
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
                      style={{ background: `linear-gradient(135deg,${TH[piColor].bg},${TH[piColor].fill})` }}>
                      {i === 0 ? "😎" : "🤖"}
                    </div>
                    <div className="text-xs font-black text-white">{i === 0 ? "You" : BOT_NAMES[i - 1]}</div>
                    <div className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ background: "rgba(39,174,96,0.2)", color: "#27ae60" }}>✓ Ready</div>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center text-xl"
                      style={{ borderColor: "rgba(255,255,255,0.15)", color: "#444" }}
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                      ?
                    </motion.div>
                    <div className="text-xs" style={{ color: "#444" }}>Searching…</div>
                    <div className="text-xs" style={{ color: "#333" }}>
                      Bot in {Math.max(0, BOT_DELAY - elapsed)}s
                    </div>
                  </>
                )}
              </motion.div>
            );
          })}
        </div>

        <div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#8e44ad,#FFD700)" }}
              animate={{ width: found ? "100%" : `${Math.min((elapsed / BOT_DELAY) * 100, 95)}%` }}
              transition={{ duration: 0.4 }} />
          </div>
          <div className="text-center text-xs mt-2" style={{ color: "#555" }}>
            {found ? "🎉 Match Found! Starting game…" : `Searching… ${elapsed}s`}
          </div>
        </div>

        <button onClick={onBack} className="w-full py-3 rounded-xl text-sm font-medium"
          style={{ color: "#555", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          Cancel
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RESULT SCREEN
// ─────────────────────────────────────────────────────────────

function Result({ gs, onHome, onRematch }: { gs: GS; onHome: () => void; onRematch: () => void }) {
  const won = gs.winner === 0;
  const winnerName = gs.winner !== null ? gs.players[gs.winner].name : "—";
  const reward = Math.floor(gs.entryFee * 1.8);

  const { addWinning } = useWallet();
  useEffect(() => {
    if (won) addWinning(reward, "Ludo Classic Win");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5"
      style={{ background: "#0a0a0f", maxWidth: 480, margin: "0 auto" }}>
      {/* Confetti-like particles */}
      {won && Array.from({ length: 20 }, (_, i) => (
        <motion.div key={i}
          className="fixed text-xl pointer-events-none"
          style={{ left: `${Math.random() * 100}%`, top: "-10%" }}
          animate={{ y: "110vh", rotate: Math.random() * 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 1.5, ease: "linear" }}>
          {["🎊","🎉","✨","⭐","💛","🟡"][Math.floor(Math.random() * 6)]}
        </motion.div>
      ))}

      <motion.div className="w-full rounded-3xl p-7 text-center space-y-5"
        style={{
          background: "linear-gradient(135deg,rgba(20,20,40,0.98),rgba(8,8,16,0.99))",
          border: `2px solid ${won ? "#FFD700" : "rgba(255,255,255,0.1)"}`,
          boxShadow: won ? "0 0 40px rgba(255,215,0,0.2)" : "none",
        }}
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}>

        <motion.div className="text-7xl"
          animate={{ scale: [1, 1.25, 1], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 2 }}>
          {won ? "🏆" : "😞"}
        </motion.div>

        <div>
          <div className="text-3xl font-black text-white">{won ? "You Won!" : "You Lost!"}</div>
          <div className="text-sm mt-1" style={{ color: "#666" }}>
            {won ? "Congratulations!" : `${winnerName} wins this match`}
          </div>
        </div>

        {won && (
          <motion.div className="rounded-2xl py-4 px-5"
            style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.3)" }}
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
            <div className="text-xs mb-1" style={{ color: "#888" }}>Reward Credited to Wallet</div>
            <div className="text-4xl font-black" style={{ color: "#FFD700" }}>+₹{reward}</div>
            <div className="text-xs mt-1 font-bold" style={{ color: "#27ae60" }}>✓ Instant Transfer</div>
          </motion.div>
        )}

        {/* Token scores */}
        <div className="flex justify-center gap-4">
          {gs.activePIs.map(pi => {
            const done = gs.players[pi].tokens.filter(t => t.step === 59).length;
            return (
              <div key={pi} className="flex flex-col items-center gap-1.5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black"
                  style={{ background: `linear-gradient(135deg,${TH[pi].bg},${TH[pi].fill})`, boxShadow: `0 0 12px ${TH[pi].glow}` }}>
                  {done}
                </div>
                <div className="text-xs" style={{ color: "#555" }}>{gs.players[pi].name.slice(0, 6)}</div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button onClick={onHome}
            className="py-3.5 rounded-xl font-bold text-sm"
            style={{ background: "rgba(255,255,255,0.06)", color: "#888", border: "1px solid rgba(255,255,255,0.08)" }}>
            🏠 Home
          </button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={onRematch}
            className="py-3.5 rounded-xl font-black text-black text-sm"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", boxShadow: "0 4px 16px rgba(255,215,0,0.4)" }}>
            🔄 Rematch
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GAME SCREEN
// ─────────────────────────────────────────────────────────────

function GameScreen({ initialGS, onGameEnd }: { initialGS: GS; onGameEnd: (gs: GS) => void }) {
  const [gs, setGS] = useState<GS>(initialGS);
  const [rolling, setRolling] = useState(false);
  const [emoji, setEmoji] = useState<{ e: string; id: number } | null>(null);
  const [autoTick, setAutoTick] = useState(0);
  const emojiId = useRef(0);
  const endedRef = useRef(false);

  const curPI = gs.activePIs[gs.curTurn];
  const isHuman = curPI === 0;

  // Watch winner → go to result after celebration
  useEffect(() => {
    if (gs.winner === null || endedRef.current) return;
    endedRef.current = true;
    const t = setTimeout(() => onGameEnd(gs), 2200);
    return () => clearTimeout(t);
  }, [gs.winner]);

  // Roll dice function
  const doRoll = useCallback(() => {
    setRolling(true);
    setAutoTick(0);
    setTimeout(() => {
      const d = Math.floor(Math.random() * 6) + 1;
      setRolling(false);
      setGS(prev => {
        const vm = calcValidMoves(prev.players, prev.activePIs[prev.curTurn], d);
        return { ...prev, dice: d, rolled: true, validMoves: vm };
      });
    }, 700);
  }, []);

  // Auto-roll timer for human (10s)
  useEffect(() => {
    if (!isHuman || gs.rolled || rolling || gs.winner !== null) return;
    setAutoTick(10);
    const tick = setInterval(() => setAutoTick(t => t - 1), 1000);
    const roll = setTimeout(doRoll, 10000);
    return () => { clearInterval(tick); clearTimeout(roll); };
  }, [isHuman, gs.rolled, gs.winner, gs.curTurn, rolling]);

  // Bot: auto-roll
  useEffect(() => {
    if (isHuman || gs.rolled || rolling || gs.winner !== null) return;
    const t = setTimeout(() => doRoll(), 1100);
    return () => clearTimeout(t);
  }, [isHuman, gs.rolled, gs.winner, gs.curTurn, rolling]);

  // After roll: handle no moves or auto-move
  useEffect(() => {
    if (!gs.rolled || gs.winner !== null) return;

    if (gs.validMoves.length === 0) {
      const t = setTimeout(() => {
        setGS(prev => {
          if (!prev.rolled) return prev;
          const nextTurn = (prev.curTurn + 1) % prev.activePIs.length;
          return { ...prev, dice: null, rolled: false, validMoves: [], curTurn: nextTurn };
        });
      }, 1000);
      return () => clearTimeout(t);
    }

    // Bot or only 1 option → auto-move
    const pi = gs.activePIs[gs.curTurn];
    const autoMove = pi !== 0 || gs.validMoves.length === 1;
    if (!autoMove) return;

    const delay = pi !== 0 ? 700 : 350;
    const t = setTimeout(() => {
      setGS(prev => {
        if (!prev.rolled) return prev;
        const cpi = prev.activePIs[prev.curTurn];
        const ti = cpi !== 0
          ? botPick(prev.players, cpi, prev.dice!)
          : prev.validMoves[0];
        if (ti === -1) {
          const nextTurn = (prev.curTurn + 1) % prev.activePIs.length;
          return { ...prev, dice: null, rolled: false, validMoves: [], curTurn: nextTurn };
        }
        const newPlayers = applyMove(prev.players, cpi, ti, prev.dice!);
        const won = isWinner(newPlayers, cpi);
        const extra = prev.dice === 6 && !won;
        const nextTurn = extra ? prev.curTurn : (prev.curTurn + 1) % prev.activePIs.length;
        return { ...prev, players: newPlayers, dice: null, rolled: false, validMoves: [], curTurn: nextTurn, winner: won ? cpi : null };
      });
    }, delay);
    return () => clearTimeout(t);
  }, [gs.rolled, gs.curTurn, gs.winner, gs.validMoves.length]);

  // Human token click
  function handleToken(pi: number, ti: number) {
    setGS(prev => {
      if (!prev.rolled || prev.winner !== null || !prev.validMoves.includes(ti)) return prev;
      const cpi = prev.activePIs[prev.curTurn];
      const newPlayers = applyMove(prev.players, cpi, ti, prev.dice!);
      const won = isWinner(newPlayers, cpi);
      const extra = prev.dice === 6 && !won;
      const nextTurn = extra ? prev.curTurn : (prev.curTurn + 1) % prev.activePIs.length;
      return { ...prev, players: newPlayers, dice: null, rolled: false, validMoves: [], curTurn: nextTurn, winner: won ? cpi : null };
    });
  }

  function sendEmoji(e: string) {
    emojiId.current += 1;
    setEmoji({ e, id: emojiId.current });
    setTimeout(() => setEmoji(null), 2000);
  }

  const myDone = gs.players[0].tokens.filter(t => t.step === 59).length;
  const oppPI = gs.activePIs.find(p => p !== 0) ?? 2;
  const oppDone = gs.players[oppPI].tokens.filter(t => t.step === 59).length;

  return (
    <div className="flex flex-col" style={{ height: "100dvh", background: "#0a0a0f", maxWidth: 480, margin: "0 auto", overflow: "hidden" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,7,14,0.95)" }}>
        <button onClick={() => onGameEnd(gs)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{ background: "rgba(255,255,255,0.06)", color: "#666" }}>✕</button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
              style={{ background: TH[0].fill }}>{myDone}</div>
            <span className="text-sm font-black text-white">You</span>
          </div>
          <span className="text-xs" style={{ color: "#333" }}>vs</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: "#666" }}>{gs.players[oppPI].name.slice(0, 7)}</span>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
              style={{ background: TH[oppPI].fill }}>{oppDone}</div>
          </div>
        </div>

        <div className="text-xs font-bold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700" }}>₹{gs.entryFee}</div>
      </div>

      {/* Turn bar */}
      <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <motion.div className="text-xs font-bold"
          style={{ color: TH[curPI].fill }}
          animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          {isHuman ? "🎯 Your Turn" : `🤖 ${gs.players[curPI].name} thinking…`}
        </motion.div>
        {isHuman && !gs.rolled && autoTick > 0 && (
          <div className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,68,68,0.15)", color: "#ff6b6b" }}>
            Auto-roll in {autoTick}s
          </div>
        )}
        {gs.rolled && gs.validMoves.length > 0 && isHuman && (
          <div className="text-xs" style={{ color: "#888" }}>Tap a highlighted token</div>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-1 min-h-0">
        <Board gs={gs} onToken={handleToken} />
      </div>

      {/* Floating emoji */}
      <AnimatePresence>
        {emoji && (
          <motion.div key={emoji.id}
            className="fixed text-5xl pointer-events-none select-none"
            style={{ left: "50%", bottom: "25%", zIndex: 100 }}
            initial={{ y: 0, opacity: 1, x: "-50%" }}
            animate={{ y: -130, opacity: 0, x: "-50%" }}
            transition={{ duration: 1.6, ease: "easeOut" }}>
            {emoji.e}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="flex-shrink-0 px-4 py-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(7,7,14,0.95)" }}>
        <div className="flex items-center justify-between gap-2">

          {/* Emoji reactions */}
          <div className="flex gap-1.5">
            {EMOJIS.slice(0, 4).map(e => (
              <motion.button key={e} whileTap={{ scale: 0.85 }} onClick={() => sendEmoji(e)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                {e}
              </motion.button>
            ))}
          </div>

          {/* Dice */}
          <div className="flex flex-col items-center gap-0.5">
            {gs.dice !== null && (
              <div className="text-xs font-bold text-center" style={{ color: TH[curPI].fill }}>
                Rolled {gs.dice}{gs.dice === 6 ? " 🎉" : ""}
              </div>
            )}
            <Dice
              value={gs.dice}
              rolling={rolling}
              onRoll={doRoll}
              disabled={!isHuman || gs.rolled || rolling || gs.winner !== null}
            />
            {isHuman && !gs.rolled && !rolling && (
              <div className="text-xs mt-0.5" style={{ color: "#444" }}>Tap to roll</div>
            )}
          </div>

          {/* Player tokens status */}
          <div className="flex flex-col gap-1.5">
            {gs.activePIs.map(pi => (
              <div key={pi} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: TH[pi].fill }} />
                <div className="text-xs" style={{ color: "#555" }}>
                  {gs.players[pi].tokens.filter(t => t.step === 59).length}/4
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT CONTAINER
// ─────────────────────────────────────────────────────────────

type Phase = "home" | "matchmaking" | "playing" | "result";

export default function LudoGame({ onBack }: { onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>("home");
  const [config, setConfig] = useState<{ fee: number; mode: "2p" | "4p" } | null>(null);
  const [gs, setGS] = useState<GS | null>(null);
  const { deductFee } = useWallet();

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <AnimatePresence mode="wait">
        {phase === "home" && (
          <motion.div key="home" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}>
            <LudoHome onBack={onBack} onStart={(fee, mode) => {
              deductFee(fee, `Ludo Entry Fee ₹${fee}`);
              setConfig({ fee, mode });
              setPhase("matchmaking");
            }} />
          </motion.div>
        )}
        {phase === "matchmaking" && config && (
          <motion.div key="mm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Matchmaking mode={config.mode} fee={config.fee}
              onBack={() => setPhase("home")}
              onReady={readyGS => { setGS(readyGS); setPhase("playing"); }} />
          </motion.div>
        )}
        {phase === "playing" && gs && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GameScreen initialGS={gs} onGameEnd={finalGS => { setGS(finalGS); setPhase("result"); }} />
          </motion.div>
        )}
        {phase === "result" && gs && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Result gs={gs} onHome={onBack} onRematch={() => {
              if (config) { setPhase("matchmaking"); }
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
