/**
 * LudoFastGame – WINGGO Ludo Fast Mode · PREMIUM EDITION
 * Dark neon theme · 20 moves each · Score-based · God Mode bot at ₹20+
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Board constants ────────────────────────────────────────────────────────────
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
];

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

// Player colors — neon palette
const TH = [
  { name: "Red",  fill: "#ff3b5c", bg: "#2d0010", home: "#1a0008", col: "#ff3b5c", glow: "rgba(255,59,92,.85)" },
  { name: "Blue", fill: "#3d9eff", bg: "#001a3d", home: "#000e28", col: "#3d9eff", glow: "rgba(61,158,255,.85)" },
];

const MAX_MOVES = 20;
const BOT_NAMES = ["ArjunBot", "RajBot", "VikramBot", "PriyaBot", "DevBot"];
const REACTIONS  = ["😂", "👍", "😤", "🔥", "🎉"];

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

// ── Bot difficulty label ───────────────────────────────────────────────────────
function botTier(fee: number): { label: string; color: string } {
  if (fee >= 20) return { label: "⚡ GOD MODE", color: "#ff3b5c" };
  if (fee >= 5)  return { label: "🔶 MEDIUM",   color: "#f97316" };
  return              { label: "🟢 EASY",        color: "#4ade80" };
}

// ── Premium 3D Dice ───────────────────────────────────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
};

function Dice3D({ value, rolling, size = 70 }: { value: number; rolling: boolean; size?: number }) {
  const dots = PIPS[value] ?? PIPS[1];
  const pip  = size * 0.13;
  return (
    <motion.div
      animate={rolling
        ? { rotate: [0, -35, 35, -22, 22, -11, 11, 0], scale: [1, 1.28, 0.82, 1.18, 0.9, 1.09, 1], y: [0, -18, 7, -11, 3, -5, 0] }
        : { rotate: 0, scale: 1, y: 0 }}
      transition={{ duration: 0.72 }}
      style={{
        width: size, height: size,
        borderRadius: size * 0.2,
        background: "linear-gradient(145deg, #ffffff, #e8e8f0)",
        boxShadow: rolling
          ? `6px 6px 18px rgba(0,0,0,0.7), inset -3px -3px 8px rgba(0,0,0,0.12), inset 3px 3px 8px rgba(255,255,255,0.9), 0 0 40px rgba(255,215,0,0.9), 0 0 80px rgba(255,215,0,0.4)`
          : `4px 4px 14px rgba(0,0,0,0.6), inset -2px -2px 6px rgba(0,0,0,0.1), inset 2px 2px 6px rgba(255,255,255,0.9), 0 0 22px rgba(255,215,0,0.5)`,
        flexShrink: 0, overflow: "hidden",
        transition: "box-shadow 0.3s",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <radialGradient id="pip-grad" cx="35%" cy="35%">
            <stop offset="0%" stopColor="#2d1a6e" />
            <stop offset="100%" stopColor="#0d0820" />
          </radialGradient>
        </defs>
        {dots.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={pip * 50} fill="url(#pip-grad)" />
        ))}
      </svg>
    </motion.div>
  );
}

// ── Neon Board SVG ────────────────────────────────────────────────────────────
function renderBoard(
  bTokens: number[],
  pTokens: number[],
  validTokens: number[],
  onTokenSelect: (ti: number) => void
) {
  const sz = 15 * C;
  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}
      style={{ display: "block", borderRadius: 12, overflow: "hidden" }}>

      <defs>
        <filter id="neon-red" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="neon-blue" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="neon-gold" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <radialGradient id="center-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3d1f00" />
          <stop offset="100%" stopColor="#1a0d00" />
        </radialGradient>
      </defs>

      {/* Dark neon background */}
      <rect width={sz} height={sz} fill="#06050f" />

      {/* Subtle grid */}
      {Array.from({ length: 16 }).map((_, i) => (
        <g key={i}>
          <line x1={i * C} y1={0} x2={i * C} y2={sz} stroke="rgba(120,80,220,0.12)" strokeWidth={0.6} />
          <line x1={0} y1={i * C} x2={sz} y2={i * C} stroke="rgba(120,80,220,0.12)" strokeWidth={0.6} />
        </g>
      ))}

      {/* Path cells */}
      {MAIN_PATH.map(([r, c], idx) => {
        const isSafe = SAFE_SET.has(idx);
        return (
          <rect key={idx} x={c * C + 0.5} y={r * C + 0.5} width={C - 1} height={C - 1}
            fill={isSafe ? "rgba(0,255,110,0.1)" : "rgba(200,160,255,0.06)"}
            stroke={isSafe ? "rgba(0,255,110,0.55)" : "rgba(160,110,255,0.22)"}
            strokeWidth={isSafe ? 0.8 : 0.4} rx={2} />
        );
      })}

      {/* Home column — Red (pi=0) */}
      {HOME_COLS[0].map(([r, c], i) => (
        <rect key={`hc0-${i}`} x={c * C + 1} y={r * C + 1} width={C - 2} height={C - 2}
          fill={TH[0].col} opacity={0.35} rx={3} />
      ))}

      {/* Home column — Blue (pi=1) */}
      {HOME_COLS[1].map(([r, c], i) => (
        <rect key={`hc1-${i}`} x={c * C + 1} y={r * C + 1} width={C - 2} height={C - 2}
          fill={TH[1].col} opacity={0.35} rx={3} />
      ))}

      {/* Safe cell stars */}
      {[...SAFE_SET].map(idx => {
        const [r, c] = MAIN_PATH[idx];
        return (
          <text key={idx} x={c * C + C / 2} y={r * C + C / 2 + 4}
            textAnchor="middle" fontSize={10} fill="#00ff6e" filter="url(#neon-gold)">★</text>
        );
      })}

      {/* Red home corner — dark neon */}
      <rect x={0} y={0} width={6 * C} height={6 * C} fill={TH[0].home} rx={10} />
      <rect x={0} y={0} width={6 * C} height={6 * C} fill="none" stroke={TH[0].fill}
        strokeWidth={1.5} rx={10} opacity={0.4} />
      <rect x={C} y={C} width={4 * C} height={4 * C} fill={TH[0].bg} rx={8} />
      <rect x={C} y={C} width={4 * C} height={4 * C} fill="none" stroke={TH[0].fill}
        strokeWidth={1} rx={8} opacity={0.5} />
      <text x={3 * C} y={3.2 * C} textAnchor="middle" fontSize={13}
        fill={TH[0].fill} fontWeight="black" filter="url(#neon-red)" opacity={0.9}>BOT</text>

      {/* Blue home corner — dark neon */}
      <rect x={9 * C} y={0} width={6 * C} height={6 * C} fill={TH[1].home} rx={10} />
      <rect x={9 * C} y={0} width={6 * C} height={6 * C} fill="none" stroke={TH[1].fill}
        strokeWidth={1.5} rx={10} opacity={0.4} />
      <rect x={10 * C} y={C} width={4 * C} height={4 * C} fill={TH[1].bg} rx={8} />
      <rect x={10 * C} y={C} width={4 * C} height={4 * C} fill="none" stroke={TH[1].fill}
        strokeWidth={1} rx={8} opacity={0.5} />
      <text x={12 * C} y={3.2 * C} textAnchor="middle" fontSize={13}
        fill={TH[1].fill} fontWeight="black" filter="url(#neon-blue)" opacity={0.9}>YOU</text>

      {/* Unused corners */}
      <rect x={0} y={9 * C} width={6 * C} height={6 * C} fill="#002210" rx={10} opacity={0.6} />
      <rect x={9 * C} y={9 * C} width={6 * C} height={6 * C} fill="#1a1400" rx={10} opacity={0.6} />

      {/* Center finish — gold glow */}
      <rect x={6 * C} y={6 * C} width={3 * C} height={3 * C} fill="url(#center-grad)" />
      <rect x={6 * C} y={6 * C} width={3 * C} height={3 * C} fill="none"
        stroke="#FFD700" strokeWidth={1.5} opacity={0.7} />
      <text x={7.5 * C} y={7.65 * C} textAnchor="middle" fontSize={10}
        fill="#FFD700" fontWeight="bold" filter="url(#neon-gold)">🏆</text>

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
              fill={TH[0].fill} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}
              filter="url(#neon-red)" />
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
          <g key={`p${ti}`} onClick={() => onTokenSelect(ti)}
            style={{ cursor: isValid ? "pointer" : "default" }}>
            {isValid && (
              <circle cx={cx} cy={cy} r={16} fill="none" stroke="#FFD700" strokeWidth={2.5} opacity={0.8}>
                <animate attributeName="r" values="14;20;14" dur="0.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.8;0.15;0.8" dur="0.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={cx} cy={cy} r={onBoard ? 10 : 8}
              fill={TH[1].fill}
              stroke={isValid ? "#FFD700" : "rgba(255,255,255,0.6)"}
              strokeWidth={isValid ? 2.5 : 1.5}
              filter="url(#neon-blue)" />
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize={7} fill="#fff" fontWeight="bold">B</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { onBack: () => void; initialFee?: number }

export default function LudoFastGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();
  const isFreeMode = initialFee === 0;
  const isGodMode  = !isFreeMode && initialFee >= 20;
  const botName    = useRef(BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)]);
  const scored     = useRef(false);
  const tier       = isFreeMode ? { label: "🟢 EASY", color: "#4ade80" } : botTier(initialFee);

  const [phase, setPhase] = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [pTokens, setPTokens] = useState([0, 0, 0, 0]);
  const [bTokens, setBTokens] = useState([0, 0, 0, 0]);
  const [pScore,  setPScore]  = useState(0);
  const [bScore,  setBScore]  = useState(0);
  const [pMoves,  setPMoves]  = useState(0);
  const [bMoves,  setBMoves]  = useState(0);
  const [dice,    setDice]    = useState(1);
  const [rolling, setRolling] = useState(false);
  const [turn,    setTurn]    = useState<"player" | "bot">("player");
  const [logMsgs, setLogMsgs] = useState<string[]>(["🎮 Match started! Good luck!"]);
  const [validTokens, setValidTokens] = useState<number[]>([]);
  const [pendingDice, setPendingDice] = useState(1);
  const [reactionFlash, setReactionFlash] = useState("");

  function pushLog(msg: string) {
    setLogMsgs(prev => [msg, ...prev.slice(0, 4)]);
  }

  // ── Matchmaking ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const t = setTimeout(() => setPhase("playing"), 2800);
    return () => clearTimeout(t);
  }, [phase]);

  // ── End condition ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (pMoves >= MAX_MOVES && bMoves >= MAX_MOVES && !scored.current) {
      scored.current = true;
      setPhase("result");
      const won   = pScore > bScore;
      const prize = (!isFreeMode && won) ? Math.floor(initialFee * 2 * 0.9) : 0;
      if (!isFreeMode && won) addWinning(prize);
      addMatch({
        gameId: "ludofast", gameName: isFreeMode ? "Ludo Fast (Practice)" : "Ludo Fast", gameIcon: "⚡",
        result: won ? "win" : "loss", entryFee: initialFee,
        prize, userScore: pScore, opponentScore: bScore,
        opponentName: botName.current, isGodMode,
      });
    }
  }, [pMoves, bMoves, phase]);

  // ── Player roll ─────────────────────────────────────────────────────────────
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
        pushLog(`🎲 Rolled ${val} — no moves available`);
        setPMoves(m => m + 1);
        setTurn("bot");
      } else if (valid.length === 1) {
        applyPlayerMove(val, valid[0], pTokens, bTokens);
      } else {
        setValidTokens(valid);
      }
    }, 740);
  }, [rolling, turn, pMoves, pTokens, bTokens, validTokens]);

  function applyPlayerMove(val: number, ti: number, curPTokens: number[], curBTokens: number[]) {
    setValidTokens([]);
    const newP = [...curPTokens];
    const prev = newP[ti];
    const nxt  = prev === 0 ? 1 : Math.min(prev + val, 58);
    const finalStep = nxt >= 58 ? 59 : nxt;
    let pts = finalStep === 59 ? (59 - prev) + 10 : finalStep - prev;

    const pi = 1; const bi = 0;
    let newB = [...curBTokens];
    if (finalStep >= 1 && finalStep <= 52) {
      const myPos  = gridPos(pi, finalStep);
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
        if (cut) { pts += 5; pushLog(`⚔️ You cut the bot! +${pts} pts`); }
      }
    }
    newP[ti] = finalStep;
    setPTokens(newP);
    setBTokens(newB);
    setPScore(s => s + pts);
    setPMoves(m => m + 1);
    if (finalStep === 59) pushLog(`🏠 Token home! +${pts} pts`);
    else if (!newB.some((_, i) => { const bp = gridPos(bi, newB[i]); return false; }))
      pushLog(`🔵 Rolled ${val} → moved ${pts} steps`);
    setTurn("bot");
  }

  const handleTokenSelect = useCallback((ti: number) => {
    if (!validTokens.includes(ti)) return;
    applyPlayerMove(pendingDice, ti, pTokens, bTokens);
  }, [validTokens, pendingDice, pTokens, bTokens]);

  // ── Bot turn ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES) { setTurn("player"); return; }
    const delay = 900 + Math.random() * 600;
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
          pushLog(`🔴 ${botName.current}: no valid moves`);
          setBMoves(m => m + 1);
          setTurn("player");
          return;
        }
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
        const nxt  = prev === 0 ? 1 : Math.min(prev + val, 58);
        const finalStep = nxt >= 58 ? 59 : nxt;
        let pts = finalStep === 59 ? (59 - prev) + 10 : finalStep - prev;

        let newP = [...pTokens];
        if (finalStep >= 1 && finalStep <= 52) {
          const myPos  = gridPos(bi, finalStep);
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
        if (finalStep === 59) pushLog(`🔴 Bot token home! +${pts} pts`);
        else pushLog(`🔴 Bot rolled ${val} → +${pts} pts`);
        setTurn("player");
      }, 740);
    }, delay);
    return () => clearTimeout(t);
  }, [turn, phase, bMoves]);

  const wonGame  = pScore > bScore;
  const prize    = wonGame ? Math.floor(initialFee * 2 * 0.9) : 0;
  const pMovesLeft = MAX_MOVES - pMoves;
  const bMovesLeft = MAX_MOVES - bMoves;
  const canRoll  = turn === "player" && !rolling && pMoves < MAX_MOVES && validTokens.length === 0;

  // ── Matchmaking screen ──────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-6"
        style={{ background: "linear-gradient(180deg, #08001a 0%, #14002e 60%, #08001a 100%)", maxWidth: 480, margin: "0 auto" }}>

        {/* Glowing dice icon */}
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="text-8xl"
          style={{ filter: "drop-shadow(0 0 24px rgba(255,215,0,0.8))" }}>
          🎲
        </motion.div>

        <div className="text-center">
          <h2 className="text-4xl font-black text-white tracking-tight">LUDO</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mt-2"
            style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)" }}>
            <span className="text-sm font-black" style={{ color: "#FFD700" }}>⚡ FAST MODE</span>
          </div>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.4)" }}>
            20 Moves Each · Highest Score Wins
          </p>
        </div>

        {/* Bot tier badge */}
        <div className="px-5 py-2.5 rounded-2xl flex items-center gap-2"
          style={{ background: `${tier.color}15`, border: `1px solid ${tier.color}40` }}>
          <span className="text-sm font-black" style={{ color: tier.color }}>{tier.label}</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>· ₹{initialFee}</span>
        </div>

        {/* Spinner */}
        <div className="flex flex-col items-center gap-2">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-10 h-10 rounded-full border-[3px]"
            style={{ borderColor: "#FFD700", borderTopColor: "transparent" }} />
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Finding opponent…</p>
        </div>

        {/* Player slots */}
        <div className="flex gap-3 w-full max-w-xs">
          <div className="flex-1 p-3 rounded-2xl flex items-center gap-2"
            style={{ background: "rgba(61,158,255,0.1)", border: "1px solid rgba(61,158,255,0.3)" }}>
            <div className="w-3 h-3 rounded-full" style={{ background: "#3d9eff", boxShadow: "0 0 8px #3d9eff" }} />
            <span className="text-xs font-black text-white">You</span>
          </div>
          <div className="flex-1 p-3 rounded-2xl flex items-center gap-2"
            style={{ background: "rgba(255,59,92,0.1)", border: "1px solid rgba(255,59,92,0.3)" }}>
            <motion.div className="w-3 h-3 rounded-full"
              style={{ background: "#ff3b5c" }}
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
          ? "linear-gradient(180deg, #0a0800 0%, #1a1200 60%, #0a0800 100%)"
          : "linear-gradient(180deg, #0a0008 0%, #1a0010 60%, #0a0008 100%)",
          maxWidth: 480, margin: "0 auto" }}>

        <motion.div
          initial={{ scale: 0, y: 30 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="text-8xl" style={{ filter: wonGame ? "drop-shadow(0 0 30px rgba(255,215,0,0.9))" : "drop-shadow(0 0 20px rgba(255,60,90,0.7))" }}>
          {wonGame ? "🏆" : "💀"}
        </motion.div>

        <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-5xl font-black"
          style={{ color: wonGame ? "#FFD700" : "#ff3b5c", textShadow: wonGame ? "0 0 40px rgba(255,215,0,0.8)" : "0 0 30px rgba(255,59,92,0.8)" }}>
          {wonGame ? "YOU WIN!" : "YOU LOSE!"}
        </motion.h2>

        {/* Score comparison */}
        <div className="flex gap-3 w-full max-w-sm">
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(61,158,255,0.1)", border: `2px solid ${wonGame ? "rgba(61,158,255,0.5)" : "rgba(61,158,255,0.2)"}` }}>
            <div className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: TH[1].fill }}>YOU</div>
            <div className="text-4xl font-black text-white">{pScore}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
          </div>
          <div className="flex self-center text-xl font-black" style={{ color: "rgba(255,255,255,0.2)" }}>VS</div>
          <div className="flex-1 text-center p-4 rounded-2xl"
            style={{ background: "rgba(255,59,92,0.1)", border: `2px solid ${!wonGame ? "rgba(255,59,92,0.5)" : "rgba(255,59,92,0.2)"}` }}>
            <div className="text-xs font-black uppercase tracking-wider mb-1.5" style={{ color: TH[0].fill }}>{botName.current}</div>
            <div className="text-4xl font-black text-white">{bScore}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
          </div>
        </div>

        {/* Prize */}
        {wonGame && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35 }}
            className="px-8 py-4 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,0.12)", border: "1.5px solid rgba(255,215,0,0.4)", boxShadow: "0 0 30px rgba(255,215,0,0.25)" }}>
            <div className="text-xs font-bold mb-0.5" style={{ color: "rgba(255,215,0,0.6)" }}>PRIZE WON</div>
            <div className="text-3xl font-black" style={{ color: "#FFD700" }}>+₹{prize}</div>
          </motion.div>
        )}

        {!wonGame && (
          <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
            {isGodMode ? "The God Mode bot was unbeatable this time" : "Better luck next time!"}
          </p>
        )}

        <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
          className="w-full max-w-sm py-4 rounded-2xl font-black text-lg cursor-pointer"
          style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 30px rgba(255,215,0,0.4)" }}>
          Back to Lobby
        </motion.button>
      </div>
    );
  }

  // ── Playing screen ──────────────────────────────────────────────────────────
  const sz = 15 * C;
  return (
    <div className="flex flex-col h-full"
      style={{ background: "linear-gradient(180deg, #08001a 0%, #0d0020 100%)", maxWidth: 480, margin: "0 auto" }}>

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
          <span className="font-black text-base text-white">🎲 LUDO FAST</span>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}40` }}>
            {tier.label}
          </span>
        </div>

        {/* Entry fee badge */}
        <div className="px-2.5 py-1 rounded-xl shrink-0"
          style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)" }}>
          <span className="text-xs font-black" style={{ color: "#FFD700" }}>₹{initialFee}</span>
        </div>
      </div>

      {/* ── Turn banner ── */}
      <motion.div
        key={turn}
        initial={{ opacity: 0, y: -6 }}
        animate={turn === "player" ? {
          opacity: 1, y: 0,
          boxShadow: [
            "0 0 10px rgba(61,158,255,0.15)",
            "0 0 22px rgba(61,158,255,0.35)",
            "0 0 10px rgba(61,158,255,0.15)",
          ],
        } : { opacity: 1, y: 0 }}
        transition={{ duration: 1.6, repeat: Infinity }}
        className="mx-3 mb-1 px-3 py-2 rounded-xl flex items-center justify-between shrink-0"
        style={{
          background: turn === "player" ? "rgba(61,158,255,0.1)" : "rgba(255,59,92,0.08)",
          border: `1px solid ${turn === "player" ? "rgba(61,158,255,0.3)" : "rgba(255,59,92,0.25)"}`,
        }}
      >
        <div className="flex items-center gap-2">
          <motion.div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: turn === "player" ? TH[1].fill : TH[0].fill }}
            animate={{ opacity: [1, 0.3, 1], scale: [1, 1.4, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
          <span className="text-sm font-black"
            style={{ color: turn === "player" ? TH[1].fill : TH[0].fill }}>
            {turn === "player" ? "YOUR TURN 🎯" : "BOT'S TURN ⏳"}
          </span>
        </div>
        {/* Moves left */}
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <span style={{ color: "rgba(61,158,255,0.8)" }}>You: {pMovesLeft}</span>
          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>
          <span style={{ color: "rgba(255,59,92,0.8)" }}>Bot: {bMovesLeft}</span>
        </div>
      </motion.div>

      {/* ── Score cards ── */}
      <div className="flex gap-2 px-3 mb-1 shrink-0">
        {/* Player card */}
        <div className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl"
          style={{
            background: "rgba(61,158,255,0.07)",
            border: `1.5px solid ${turn === "player" ? TH[1].fill : "rgba(61,158,255,0.18)"}`,
            boxShadow: turn === "player" ? `0 0 14px rgba(61,158,255,0.3)` : "none",
            transition: "all 0.3s",
          }}>
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(61,158,255,0.6)" }}>YOU</div>
            <div className="text-2xl font-black leading-none text-white">{pScore}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>pts</div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            {pTokens.map((s, i) => (
              <div key={i} className="w-2 h-2 rounded-full"
                style={{ background: s >= 59 ? "#FFD700" : s > 0 ? TH[1].fill : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        </div>

        {/* VS */}
        <div className="flex items-center px-1 shrink-0">
          <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.18)" }}>VS</span>
        </div>

        {/* Bot card */}
        <div className="flex-1 flex items-center gap-2 px-2.5 py-2 rounded-xl"
          style={{
            background: "rgba(255,59,92,0.07)",
            border: `1.5px solid ${turn === "bot" ? TH[0].fill : "rgba(255,59,92,0.18)"}`,
            boxShadow: turn === "bot" ? `0 0 14px rgba(255,59,92,0.3)` : "none",
            transition: "all 0.3s",
          }}>
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider" style={{ color: "rgba(255,59,92,0.7)" }}>BOT</div>
            <div className="text-2xl font-black leading-none text-white">{bScore}</div>
            <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>pts</div>
          </div>
          <div className="ml-auto flex flex-col items-end gap-0.5">
            {bTokens.map((s, i) => (
              <div key={i} className="w-2 h-2 rounded-full"
                style={{ background: s >= 59 ? "#FFD700" : s > 0 ? TH[0].fill : "rgba(255,255,255,0.15)" }} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Board ── */}
      <div className="flex-1 flex items-center justify-center px-2 min-h-0 overflow-hidden">
        <div style={{ width: "100%", maxWidth: sz, aspectRatio: "1/1" }}>
          {renderBoard(bTokens, pTokens, validTokens, handleTokenSelect)}
        </div>
      </div>

      {/* ── Match log ── */}
      <div className="mx-3 mb-1 px-3 py-1.5 rounded-xl shrink-0 min-h-[32px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <AnimatePresence mode="popLayout">
          {logMsgs.slice(0, 1).map((msg, i) => (
            <motion.p key={msg + i}
              initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="text-xs font-bold text-center truncate"
              style={{ color: "rgba(255,255,255,0.55)" }}>
              {msg}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Emoji reactions ── */}
      <div className="flex items-center justify-center gap-2 px-3 pb-1 shrink-0">
        {REACTIONS.map((e) => (
          <motion.button key={e} whileTap={{ scale: 1.5, y: -6 }}
            onClick={() => { pushLog(`You reacted ${e}`); setReactionFlash(e); setTimeout(() => setReactionFlash(""), 800); }}
            className="w-9 h-9 rounded-full flex items-center justify-center text-lg cursor-pointer"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
            {e}
          </motion.button>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-1 shrink-0">
        {/* Dice */}
        <Dice3D value={dice} rolling={rolling} size={66} />

        {/* Roll button */}
        <motion.button
          whileTap={{ scale: 0.93 }}
          onClick={handleRoll}
          disabled={!canRoll}
          className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{
            background: canRoll
              ? "linear-gradient(135deg,#FFD700,#ff8c00)"
              : "rgba(255,255,255,0.06)",
            color: canRoll ? "#000" : "rgba(255,255,255,0.2)",
            boxShadow: canRoll ? "0 0 32px rgba(255,215,0,0.55), 0 0 64px rgba(255,215,0,0.2)" : "none",
            border: canRoll ? "none" : "1px solid rgba(255,255,255,0.08)",
            transition: "all 0.25s",
          }}
          animate={canRoll ? {
            boxShadow: [
              "0 0 20px rgba(255,215,0,0.4)",
              "0 0 45px rgba(255,215,0,0.7)",
              "0 0 20px rgba(255,215,0,0.4)",
            ],
          } : {}}
          transition={{ duration: 1.4, repeat: Infinity }}
        >
          {validTokens.length > 0
            ? "← Tap token"
            : turn === "bot"
              ? "⏳ Bot rolling…"
              : pMoves >= MAX_MOVES
                ? "✓ Done"
                : "🎲 ROLL DICE"}
        </motion.button>
      </div>

      {/* Reaction flash overlay */}
      <AnimatePresence>
        {reactionFlash && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, y: 0 }}
            animate={{ scale: 2.5, opacity: 1, y: -40 }}
            exit={{ scale: 3, opacity: 0, y: -80 }}
            transition={{ duration: 0.7 }}
            className="fixed left-1/2 bottom-28 -translate-x-1/2 pointer-events-none text-5xl z-50">
            {reactionFlash}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
