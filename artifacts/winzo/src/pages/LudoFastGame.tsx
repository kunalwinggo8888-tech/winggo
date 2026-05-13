/**
 * LudoFastGame – WINGGO Ludo Fast Mode
 * 20 moves each · Score = cells moved + cut bonus + home bonus · Highest score wins
 * God Mode (₹20+): bot rolls 5-6 (70%) and always targets your tokens
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Board constants (identical to standard LudoGame) ──────────────────────────
const C = 28;

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
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
];

const OFFSETS = [0, 13, 26, 39];
const SAFE_SET = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const YARD: [number, number][][] = [
  [[1,1],[1,4],[4,1],[4,4]],
  [[1,10],[1,13],[4,10],[4,13]],
  [[10,10],[10,13],[13,10],[13,13]],
  [[10,1],[10,4],[13,1],[13,4]],
];

const TH = [
  { name: "Red",  fill: "#e74c3c", bg: "#922b21", home: "#5c1b16", col: "#a93226", glow: "rgba(231,76,60,.7)" },
  { name: "Blue", fill: "#3b82f6", bg: "#1d4ed8", home: "#1e3a8a", col: "#2563eb", glow: "rgba(59,130,246,.7)" },
];

const MAX_MOVES = 20;
const BOT_NAMES = ["ArjunBot", "RajBot", "VikramBot", "PriyaBot", "DevBot"];

// ── Token step → board position ────────────────────────────────────────────────
function gridPos(pi: number, step: number): [number, number] | null {
  if (step <= 0) return null;
  if (step >= 59) return [7, 7];
  if (step >= 53) return HOME_COLS[pi][step - 53];
  return MAIN_PATH[(OFFSETS[pi] + step - 1) % 52];
}

// ── Dice roll ──────────────────────────────────────────────────────────────────
function rollDice(godMode: boolean): number {
  if (godMode) {
    const r = Math.random();
    if (r < 0.38) return 6;
    if (r < 0.70) return 5;
    return Math.ceil(Math.random() * 4);
  }
  return Math.ceil(Math.random() * 6);
}

// ── Animated 3D Dice ──────────────────────────────────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

function Dice3D({ value, rolling, size = 64 }: { value: number; rolling: boolean; size?: number }) {
  const dots = PIPS[value] ?? PIPS[1];
  const pip = size * 0.145;
  return (
    <motion.div
      animate={rolling
        ? { rotate: [0, -22, 22, -15, 15, -8, 8, 0], scale: [1, 1.18, 0.9, 1.12, 0.95, 1.05, 1], y: [0, -10, 4, -6, 2, -2, 0] }
        : { rotate: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.65 }}
      style={{
        width: size, height: size, borderRadius: size * 0.18,
        background: "linear-gradient(145deg, #ffffff, #e0e0e0)",
        boxShadow: "5px 5px 14px rgba(0,0,0,0.55), inset -2px -2px 5px rgba(0,0,0,0.15), inset 2px 2px 5px rgba(255,255,255,0.9)",
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

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onBack: () => void; initialFee?: number }

export default function LudoFastGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch } = useMatchHistory();
  const isGodMode = initialFee >= 20;
  const botName = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const scored = useRef(false);

  const [phase, setPhase] = useState<"matchmaking" | "playing" | "result">("matchmaking");

  // Tokens: step 0 = yard, 1-52 = main path, 53-58 = home col, 59 = finished
  // Bot = Red (pi=0), Player = Blue (pi=1)
  const [pTokens, setPTokens] = useState([0, 0, 0, 0]);
  const [bTokens, setBTokens] = useState([0, 0, 0, 0]);

  const [pScore, setPScore] = useState(0);
  const [bScore, setBScore] = useState(0);
  const [pMoves, setPMoves] = useState(0);
  const [bMoves, setBMoves] = useState(0);

  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState<"player" | "bot">("player");
  const [logMsgs, setLogMsgs] = useState<string[]>([]);
  const [validTokens, setValidTokens] = useState<number[]>([]);
  const [pendingDice, setPendingDice] = useState(1);

  function pushLog(msg: string) {
    setLogMsgs(prev => [msg, ...prev.slice(0, 3)]);
  }

  // Matchmaking timer
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
      const won = pScore > bScore;
      const prize = won ? Math.floor(initialFee * 2 * 0.9) : 0;
      if (won) addWinning(prize);
      addMatch({
        gameId: "ludofast", gameName: "Ludo Fast", gameIcon: "🎲",
        result: won ? "win" : "loss", entryFee: initialFee,
        prize, userScore: pScore, opponentScore: bScore,
        opponentName: botName.current, isGodMode,
      });
    }
  }, [pMoves, bMoves, phase]);

  // ── Player roll ────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || pMoves >= MAX_MOVES || validTokens.length > 0) return;
    const val = rollDice(false);
    setRolling(true);
    setDice(val);
    setPendingDice(val);
    setTimeout(() => {
      setRolling(false);
      const valid: number[] = [];
      pTokens.forEach((step, i) => {
        if (step === 59) return;
        if (step === 0 && val === 6) valid.push(i);
        if (step > 0 && step + val <= 58) valid.push(i);
      });
      if (valid.length === 0) {
        pushLog(`🎲 Rolled ${val} — no moves!`);
        setPMoves(m => m + 1);
        setTurn("bot");
      } else if (valid.length === 1) {
        applyPlayerMove(val, valid[0], pTokens, bTokens);
      } else {
        setValidTokens(valid);
      }
    }, 680);
  }, [rolling, turn, pMoves, pTokens, bTokens, validTokens]);

  function applyPlayerMove(val: number, ti: number, curPTokens: number[], curBTokens: number[]) {
    setValidTokens([]);
    const newP = [...curPTokens];
    const prev = newP[ti];
    const nxt = prev === 0 ? 1 : Math.min(prev + val, 58);
    const finalStep = nxt >= 58 ? 59 : nxt;
    let pts = finalStep === 59 ? (59 - prev) + 10 : finalStep - prev;

    const pi = 1; const bi = 0;
    let newB = [...curBTokens];
    if (finalStep >= 1 && finalStep <= 52) {
      const myPos = gridPos(pi, finalStep);
      const pathIdx = (OFFSETS[pi] + finalStep - 1) % 52;
      if (!SAFE_SET.has(pathIdx) && myPos) {
        let cut = false;
        newB = newB.map((bs) => {
          if (bs >= 1 && bs <= 52) {
            const bp = gridPos(bi, bs);
            if (bp && bp[0] === myPos[0] && bp[1] === myPos[1]) { cut = true; return 0; }
          }
          return bs;
        });
        if (cut) { pts += 5; pushLog(`⚔️ Cut! +${pts} pts`); }
      }
    }
    newP[ti] = finalStep;
    setPTokens(newP);
    setBTokens(newB);
    setPScore(s => s + pts);
    setPMoves(m => m + 1);
    if (finalStep === 59) pushLog(`🏠 Token home! +${pts} pts`);
    else pushLog(`🔵 You: rolled ${val} → +${pts} pts`);
    setTurn("bot");
  }

  const handleTokenSelect = useCallback((ti: number) => {
    if (!validTokens.includes(ti)) return;
    applyPlayerMove(pendingDice, ti, pTokens, bTokens);
  }, [validTokens, pendingDice, pTokens, bTokens]);

  // ── Bot turn ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES) { setTurn("player"); return; }
    const delay = 950 + Math.random() * 550;
    const t = setTimeout(() => {
      const val = rollDice(isGodMode);
      setDice(val);
      setRolling(true);
      setTimeout(() => {
        setRolling(false);
        const bi = 0; const pi = 1;
        const valid: number[] = [];
        bTokens.forEach((step, i) => {
          if (step === 59) return;
          if (step === 0 && val === 6) valid.push(i);
          if (step > 0 && step + val <= 58) valid.push(i);
        });
        if (valid.length === 0) {
          pushLog(`🔴 ${botName.current}: no moves!`);
          setBMoves(m => m + 1);
          setTurn("player");
          return;
        }
        // Strategy: God mode targets player tokens; normal prefers furthest
        let chosen = valid[0];
        if (isGodMode) {
          for (const ti of valid) {
            const ns = bTokens[ti] === 0 ? 1 : Math.min(bTokens[ti] + val, 58);
            if (ns >= 1 && ns <= 52) {
              const pathIdx = (OFFSETS[bi] + ns - 1) % 52;
              if (!SAFE_SET.has(pathIdx)) {
                const bp = gridPos(bi, ns);
                if (bp && pTokens.some(ps => {
                  if (ps < 1 || ps > 52) return false;
                  const pp = gridPos(pi, ps);
                  return pp && pp[0] === bp[0] && pp[1] === bp[1];
                })) { chosen = ti; break; }
              }
            }
          }
        } else {
          chosen = valid.reduce((best, ti) => bTokens[ti] > bTokens[best] ? ti : best, valid[0]);
        }
        const prev = bTokens[chosen];
        const nxt = prev === 0 ? 1 : Math.min(prev + val, 58);
        const finalStep = nxt >= 58 ? 59 : nxt;
        let pts = finalStep === 59 ? (59 - prev) + 10 : finalStep - prev;

        let newP = [...pTokens];
        if (finalStep >= 1 && finalStep <= 52) {
          const myPos = gridPos(bi, finalStep);
          const pathIdx = (OFFSETS[bi] + finalStep - 1) % 52;
          if (!SAFE_SET.has(pathIdx) && myPos) {
            let cut = false;
            newP = newP.map((ps) => {
              if (ps >= 1 && ps <= 52) {
                const pp = gridPos(pi, ps);
                if (pp && pp[0] === myPos[0] && pp[1] === myPos[1]) { cut = true; return 0; }
              }
              return ps;
            });
            if (cut) { pts += 5; pushLog(`🔴 Bot cuts your token! +${pts} pts`); }
          }
        }
        const newB = [...bTokens];
        newB[chosen] = finalStep;
        setBTokens(newB);
        setPTokens(newP);
        setBScore(s => s + pts);
        setBMoves(m => m + 1);
        if (finalStep === 59) pushLog(`🏠 Bot home! +${pts} pts`);
        else pushLog(`🔴 ${botName.current}: rolled ${val} → +${pts} pts`);
        setTurn("player");
      }, 680);
    }, delay);
    return () => clearTimeout(t);
  }, [turn, phase, bMoves]);

  // ── Board SVG ──────────────────────────────────────────────────────────────
  function renderBoard() {
    const sz = 15 * C;
    return (
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}
        style={{ display: "block", borderRadius: 10, overflow: "hidden" }}>

        {/* Background */}
        <rect width={sz} height={sz} fill="#f5ede0" />

        {/* Grid lines */}
        {Array.from({ length: 15 }).map((_, i) => (
          <g key={i}>
            <line x1={i * C} y1={0} x2={i * C} y2={sz} stroke="#cbb88a" strokeWidth={0.5} />
            <line x1={0} y1={i * C} x2={sz} y2={i * C} stroke="#cbb88a" strokeWidth={0.5} />
          </g>
        ))}

        {/* Path cell highlights */}
        {MAIN_PATH.map(([r, c], idx) => {
          const isSafe = SAFE_SET.has(idx);
          return (
            <rect key={idx} x={c * C} y={r * C} width={C} height={C}
              fill={isSafe ? "rgba(39,174,96,0.25)" : "rgba(255,255,255,0.5)"}
              stroke={isSafe ? "#27ae60" : "none"} strokeWidth={0.8} />
          );
        })}

        {/* Home column — Red (pi=0) */}
        {HOME_COLS[0].map(([r, c], i) => (
          <rect key={`hc0-${i}`} x={c * C + 1} y={r * C + 1} width={C - 2} height={C - 2}
            fill={TH[0].col} opacity={0.55} rx={3} />
        ))}

        {/* Home column — Blue (pi=1) */}
        {HOME_COLS[1].map(([r, c], i) => (
          <rect key={`hc1-${i}`} x={c * C + 1} y={r * C + 1} width={C - 2} height={C - 2}
            fill={TH[1].col} opacity={0.55} rx={3} />
        ))}

        {/* Safe cell star markers */}
        {[...SAFE_SET].map(idx => {
          const [r, c] = MAIN_PATH[idx];
          return (
            <text key={idx} x={c * C + C / 2} y={r * C + C / 2 + 4}
              textAnchor="middle" fontSize={9} fill="#27ae60">★</text>
          );
        })}

        {/* Red home corner */}
        <rect x={0} y={0} width={6 * C} height={6 * C} fill={TH[0].fill} rx={8} />
        <rect x={C} y={C} width={4 * C} height={4 * C} fill={TH[0].bg} rx={6} />
        <text x={3 * C} y={3.3 * C} textAnchor="middle" fontSize={14} fill="rgba(255,255,255,0.4)" fontWeight="bold">BOT</text>

        {/* Blue home corner */}
        <rect x={9 * C} y={0} width={6 * C} height={6 * C} fill={TH[1].fill} rx={8} />
        <rect x={10 * C} y={C} width={4 * C} height={4 * C} fill={TH[1].bg} rx={6} />
        <text x={12 * C} y={3.3 * C} textAnchor="middle" fontSize={14} fill="rgba(255,255,255,0.4)" fontWeight="bold">YOU</text>

        {/* Unused corners (dimmed) */}
        <rect x={0} y={9 * C} width={6 * C} height={6 * C} fill="#27ae60" rx={8} opacity={0.18} />
        <rect x={9 * C} y={9 * C} width={6 * C} height={6 * C} fill="#d4ac0d" rx={8} opacity={0.18} />

        {/* Center finish */}
        <rect x={6 * C} y={6 * C} width={3 * C} height={3 * C} fill="none" stroke="#FFD700" strokeWidth={1.5} />
        <text x={7.5 * C} y={7.6 * C} textAnchor="middle" fontSize={8} fill="#FFD700" fontWeight="bold">🏆</text>

        {/* Bot tokens (Red, pi=0) */}
        {bTokens.map((step, ti) => {
          const [yr, yc] = YARD[0][ti];
          let tr = yr, tc = yc;
          let onBoard = false;
          if (step > 0) {
            const gp = gridPos(0, step);
            if (gp) { [tr, tc] = gp; onBoard = true; }
          }
          const offX = onBoard ? 0 : (ti % 2 === 0 ? -5 : 5);
          const offY = onBoard ? 0 : (ti < 2 ? -5 : 5);
          const cx = tc * C + C / 2 + offX;
          const cy = tr * C + C / 2 + offY;
          return (
            <g key={`b${ti}`}>
              <circle cx={cx} cy={cy} r={onBoard ? 10 : 8}
                fill={TH[0].fill} stroke="#fff" strokeWidth={2}
                style={{ filter: `drop-shadow(0 2px 4px ${TH[0].glow})` }} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="bold">R</text>
            </g>
          );
        })}

        {/* Player tokens (Blue, pi=1) */}
        {pTokens.map((step, ti) => {
          const [yr, yc] = YARD[1][ti];
          let tr = yr, tc = yc;
          let onBoard = false;
          if (step > 0) {
            const gp = gridPos(1, step);
            if (gp) { [tr, tc] = gp; onBoard = true; }
          }
          const offX = onBoard ? 0 : (ti % 2 === 0 ? -5 : 5);
          const offY = onBoard ? 0 : (ti < 2 ? -5 : 5);
          const cx = tc * C + C / 2 + offX;
          const cy = tr * C + C / 2 + offY;
          const isValid = validTokens.includes(ti);
          return (
            <g key={`p${ti}`} onClick={() => handleTokenSelect(ti)}
              style={{ cursor: isValid ? "pointer" : "default" }}>
              {isValid && (
                <circle cx={cx} cy={cy} r={15} fill="none" stroke="#FFD700" strokeWidth={2} opacity={0.7}>
                  <animate attributeName="r" values="14;19;14" dur="0.9s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0.15;0.7" dur="0.9s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={cx} cy={cy} r={onBoard ? 10 : 8}
                fill={TH[1].fill} stroke={isValid ? "#FFD700" : "#fff"} strokeWidth={isValid ? 2.5 : 2}
                style={{ filter: `drop-shadow(0 2px 4px ${TH[1].glow})` }} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="bold">B</text>
            </g>
          );
        })}
      </svg>
    );
  }

  const wonGame = pScore > bScore;
  const prize = wonGame ? Math.floor(initialFee * 2 * 0.9) : 0;
  const pMovesLeft = MAX_MOVES - pMoves;
  const bMovesLeft = MAX_MOVES - bMoves;
  const canRoll = turn === "player" && !rolling && pMoves < MAX_MOVES && validTokens.length === 0;

  // ── Matchmaking ────────────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 px-6"
        style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #12051f 100%)", maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }} className="text-8xl">🎲</motion.div>
        <div className="text-center">
          <h2 className="text-3xl font-black text-white tracking-tight">LUDO</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mt-1"
            style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)" }}>
            <span className="text-xs font-black" style={{ color: "#FFD700" }}>⚡ FAST MODE</span>
          </div>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.45)" }}>20 Moves · Highest Score Wins</p>
        </div>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full border-[3px]"
          style={{ borderColor: "#FFD700", borderTopColor: "transparent" }} />
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>Finding opponent…</p>
        <div className="flex items-center gap-2 px-4 py-2 rounded-2xl"
          style={{ background: isGodMode ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)", border: `1px solid ${isGodMode ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.1)"}` }}>
          <span className="text-xs font-black" style={{ color: isGodMode ? "#f87171" : "#4ade80" }}>
            {isGodMode ? "⚡ GOD MODE ROOM" : "Standard Room"}
          </span>
          <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.3)" }}>· ₹{initialFee}</span>
        </div>
      </div>
    );
  }

  // ── Result ─────────────────────────────────────────────────────────────────
  if (phase === "result") {
    return (
      <div className="flex flex-col h-full items-center justify-center px-6 gap-5"
        style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #12051f 100%)", maxWidth: 480, margin: "0 auto" }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}
          className="text-8xl">{wonGame ? "🏆" : "💀"}</motion.div>
        <h2 className="text-4xl font-black" style={{ color: wonGame ? "#FFD700" : "#f87171" }}>
          {wonGame ? "YOU WIN!" : "YOU LOSE!"}
        </h2>
        <div className="flex gap-3 w-full max-w-xs">
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(59,130,246,0.13)", border: "1px solid rgba(59,130,246,0.3)" }}>
            <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "#3b82f6" }}>YOU</div>
            <div className="text-3xl font-black text-white">{pScore}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>pts</div>
          </div>
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(231,76,60,0.13)", border: "1px solid rgba(231,76,60,0.3)" }}>
            <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "#e74c3c" }}>{botName.current}</div>
            <div className="text-3xl font-black text-white">{bScore}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>pts</div>
          </div>
        </div>
        {wonGame && (
          <div className="px-6 py-3 rounded-2xl"
            style={{ background: "rgba(255,215,0,0.13)", border: "1px solid rgba(255,215,0,0.35)" }}>
            <span className="text-xl font-black" style={{ color: "#FFD700" }}>+₹{prize} Prize!</span>
          </div>
        )}
        <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
          className="w-full max-w-xs py-4 rounded-2xl font-black text-lg"
          style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
          Back to Lobby
        </motion.button>
      </div>
    );
  }

  // ── Playing ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full"
      style={{ background: "linear-gradient(180deg, #0a0a0f 0%, #0d0520 100%)", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-safe pt-3 pb-1.5 shrink-0">
        <button onClick={onBack}
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 4l-4 4 4 4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 flex items-center gap-2">
          <span className="font-black text-base text-white">LUDO</span>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,215,0,0.13)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.3)" }}>
            FAST MODE
          </span>
        </div>
        {isGodMode && (
          <span className="text-[10px] font-black px-2 py-1 rounded-xl"
            style={{ background: "rgba(239,68,68,0.13)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
            ⚡ GOD
          </span>
        )}
      </div>

      {/* Score panel */}
      <div className="flex gap-2 px-3 pb-1.5 shrink-0">
        <div className="flex-1 p-2.5 rounded-2xl relative overflow-hidden"
          style={{
            background: "rgba(59,130,246,0.1)",
            border: `2px solid ${turn === "player" ? "#3b82f6" : "rgba(59,130,246,0.18)"}`,
            transition: "border-color 0.3s",
          }}>
          {turn === "player" && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full"
              style={{ background: "#3b82f6", boxShadow: "0 0 8px #3b82f6" }} />
          )}
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(59,130,246,0.6)" }}>YOU (Blue)</div>
          <div className="text-2xl font-black text-white leading-none mt-0.5">{pScore}</div>
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${(pMoves / MAX_MOVES) * 100}%`, background: "#3b82f6", transition: "width 0.4s" }} />
            </div>
            <span className="text-[9px] font-bold shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{pMovesLeft} left</span>
          </div>
        </div>
        <div className="flex-1 p-2.5 rounded-2xl relative overflow-hidden"
          style={{
            background: "rgba(231,76,60,0.1)",
            border: `2px solid ${turn === "bot" ? "#e74c3c" : "rgba(231,76,60,0.18)"}`,
            transition: "border-color 0.3s",
          }}>
          {turn === "bot" && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full"
              style={{ background: "#e74c3c", boxShadow: "0 0 8px #e74c3c" }} />
          )}
          <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: "rgba(231,76,60,0.6)" }}>BOT (Red)</div>
          <div className="text-2xl font-black text-white leading-none mt-0.5">{bScore}</div>
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex-1 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full" style={{ width: `${(bMoves / MAX_MOVES) * 100}%`, background: "#e74c3c", transition: "width 0.4s" }} />
            </div>
            <span className="text-[9px] font-bold shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{bMovesLeft} left</span>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <div style={{ transform: "scale(0.94)", transformOrigin: "center center" }}>
          {renderBoard()}
        </div>
      </div>

      {/* Controls */}
      <div className="px-3 pb-4 pt-1 shrink-0">
        <div className="min-h-7 mb-2 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {logMsgs[0] && (
              <motion.p key={logMsgs[0]} initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-bold text-center px-3 py-1 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)" }}>
                {logMsgs[0]}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        {validTokens.length > 0 && (
          <p className="text-center text-xs font-black mb-2" style={{ color: "#FFD700" }}>
            Tap a glowing token to move!
          </p>
        )}
        <div className="flex items-center justify-center gap-5">
          <Dice3D value={dice} rolling={rolling} size={62} />
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleRoll}
            disabled={!canRoll}
            className="px-8 py-4 rounded-2xl font-black text-lg"
            style={{
              background: canRoll ? "linear-gradient(135deg,#FFD700,#ff8c00)" : "rgba(255,255,255,0.06)",
              color: canRoll ? "#000" : "rgba(255,255,255,0.2)",
              boxShadow: canRoll ? "0 0 28px rgba(255,215,0,0.38)" : "none",
              transition: "all 0.25s",
            }}>
            {validTokens.length > 0 ? "Pick token" : turn === "bot" ? "Bot…" : pMoves >= MAX_MOVES ? "Done ✓" : "ROLL 🎲"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
