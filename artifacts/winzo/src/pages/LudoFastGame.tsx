/**
 * LudoFastGame – WINGGO Fast Ludo · PREMIUM v2
 * WinZO-style score-based competitive Ludo.
 *
 * Rules:
 *  – All 4 tokens start DEPLOYED on the path (no waiting for 6)
 *  – +1 pt per step moved, +56 pts when token reaches HOME
 *  – Kill: attacker +15 pts, victim loses (victimStep-1) pts (min 0), token → step 1
 *  – Rolling 6 or making a kill grants an EXTRA TURN
 *  – 50 moves per player; highest score wins
 *  – Auto-move when only 1 valid token
 *  – Bot: Easy (fee<5) / Medium (5-19) / God Mode (fee≥20)
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";
import { getRandomBot, type BotPlayer } from "@/data/botDatabase";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const C          = 26;           // cell size px
const SZ         = 15 * C;       // board size px
const MAX_MOVES  = 50;
const HOME_SCORE = 25;
const KILL_BONUS = 15;
const EMOTES     = ["😂","👍","😤","🔥","🎉","💪","😱","🤙","👑","😎"];

// Player indices
const P = 0;   // human → Red
const B = 1;   // bot   → Blue

const OFFSETS = [0, 13];  // main-path starting offsets

const PLAYER_CFG = [
  { label: "YOU",  fill: "#ef4444", light: "#fca5a5", glow: "#ef444490", offset: 0  },
  { label: "BOT",  fill: "#3b82f6", light: "#93c5fd", glow: "#3b82f690", offset: 13 },
];

// ─── BOARD DATA ───────────────────────────────────────────────────────────────

// 52-cell main path [row, col]
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

// Home corridors per player (steps 53–58, index 0–5)
const HOME_COLS: [number, number][][] = [
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
];

// Safe path-indices in MAIN_PATH (0-indexed) — stars + start cells
const SAFE_IDX = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

// ─── PATH HELPERS ─────────────────────────────────────────────────────────────

/** Convert player-index + step → board [row, col]. null = off board. */
function gPos(pi: number, step: number): [number, number] | null {
  if (step <= 0) return null;
  if (step >= 59) return [7, 7];
  if (step >= 53) return HOME_COLS[pi][step - 53];
  return MAIN_PATH[(OFFSETS[pi] + step - 1) % 52];
}

/** True if a step is on a safe (no-kill) cell. */
function isSafe(pi: number, step: number): boolean {
  if (step >= 53 || step <= 0) return true;
  return SAFE_IDX.has((OFFSETS[pi] + step - 1) % 52);
}

/** True if this token can legally move dice steps forward. */
function canMoveTok(step: number, dice: number): boolean {
  if (step >= 59) return false;
  if (step >= 53) return step + dice <= 59;
  return true;
}

// ─── DICE COMPONENT ───────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]],
};

function Dice3D({ value, rolling, onClick, disabled }: {
  value: number; rolling: boolean; onClick: () => void; disabled: boolean;
}) {
  const sz   = 72;
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
        width: sz, height: sz,
        borderRadius: 16,
        background: "#ffffff",
        border: "2.5px solid #111111",
        boxShadow: rolling
          ? "4px 6px 18px rgba(0,0,0,0.75), -2px -2px 6px rgba(255,255,255,0.9), inset 0 2px 4px rgba(255,255,255,0.8), 0 0 50px rgba(255,215,0,1), 0 0 100px rgba(255,215,0,0.55)"
          : disabled
          ? "2px 3px 8px rgba(0,0,0,0.4)"
          : "4px 6px 14px rgba(0,0,0,0.6), -2px -2px 5px rgba(255,255,255,0.7), inset 0 2px 3px rgba(255,255,255,0.6), 0 0 22px rgba(255,215,0,0.5)",
        opacity: disabled && !rolling ? 0.48 : 1,
        transition: "box-shadow 0.22s, opacity 0.22s",
        position: "relative",
      }}>
        <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ display: "block" }}>
          {/* Top-left 3D bevel highlight */}
          <rect x={3} y={3} width={93} height={93} rx={14}
            fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2.5} />
          {/* Bottom-right shadow inset */}
          <rect x={5} y={5} width={91} height={91} rx={12}
            fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={1.5} />
          {/* Pips */}
          {dots.map(([cx, cy], i) => (
            <g key={i}>
              {/* pip drop shadow */}
              <circle cx={cx+1} cy={cy+1.5} r={8.5} fill="rgba(0,0,0,0.22)" />
              {/* pip face */}
              <circle cx={cx} cy={cy} r={8.5} fill="#111111" />
              {/* pip inner shine */}
              <circle cx={cx-2.5} cy={cy-2.5} r={2.8} fill="rgba(255,255,255,0.18)" />
            </g>
          ))}
        </svg>
      </div>
    </motion.div>
  );
}

// ─── BOARD RENDERER ───────────────────────────────────────────────────────────

function Board({
  pTokens, bTokens, validTokens, highlightKill, onSelect,
  pScore, bScore, pMoves, bMoves, turn, botName,
}: {
  pTokens: number[]; bTokens: number[];
  validTokens: number[]; highlightKill: boolean;
  onSelect: (ti: number) => void;
  pScore: number; bScore: number;
  pMoves: number; bMoves: number;
  turn: "player" | "bot";
  botName: string;
}) {
  // Build cell → token list
  type Tok = { pi: number; ti: number; step: number };
  const cellMap = new Map<string, Tok[]>();
  const addTok = (pi: number, ti: number, step: number) => {
    const pos = gPos(pi, step);
    if (!pos) return;
    const k = `${pos[0]},${pos[1]}`;
    if (!cellMap.has(k)) cellMap.set(k, []);
    cellMap.get(k)!.push({ pi, ti, step });
  };
  pTokens.forEach((s, ti) => addTok(P, ti, s));
  bTokens.forEach((s, ti) => addTok(B, ti, s));

  const r  = C * 0.33;   // token radius
  const cx_  = (col: number) => col * C + C / 2;
  const cy_  = (row: number) => row * C + C / 2;

  return (
    <svg
      width="100%" viewBox={`0 0 ${SZ} ${SZ}`}
      style={{ display: "block", borderRadius: 10, boxShadow: "0 0 50px rgba(0,0,0,.85), 0 0 100px rgba(0,0,0,.5)" }}
    >
      {/* ── Background ── */}
      <rect width={SZ} height={SZ} fill="#0f172a" />

      {/* ── Colored corner zones ── */}
      <rect x={0}    y={0}    width={6*C} height={6*C} fill="#dc2626" />
      <rect x={9*C}  y={0}    width={6*C} height={6*C} fill="#2563eb" />
      <rect x={9*C}  y={9*C}  width={6*C} height={6*C} fill="#16a34a" />
      <rect x={0}    y={9*C}  width={6*C} height={6*C} fill="#ca8a04" />

      {/* ── Inner white home area in each zone ── */}
      <rect x={C}    y={C}    width={4*C} height={4*C} fill="white" opacity={0.92} rx={3} />
      <rect x={10*C} y={C}    width={4*C} height={4*C} fill="white" opacity={0.92} rx={3} />
      <rect x={10*C} y={10*C} width={4*C} height={4*C} fill="white" opacity={0.92} rx={3} />
      <rect x={C}    y={10*C} width={4*C} height={4*C} fill="white" opacity={0.92} rx={3} />

      {/* ── Yard dots (decorative, showing empty yard positions) ── */}
      {([[1.5,1.5],[1.5,3.5],[3.5,1.5],[3.5,3.5]] as [number,number][]).map(([rr,cc],i) => (
        <circle key={`yr-${i}`} cx={cc*C} cy={rr*C} r={C*0.28} fill="rgba(220,38,38,0.25)" stroke="#ef4444" strokeWidth={1} />
      ))}
      {([[1.5,10.5],[1.5,12.5],[3.5,10.5],[3.5,12.5]] as [number,number][]).map(([rr,cc],i) => (
        <circle key={`yb-${i}`} cx={cc*C} cy={rr*C} r={C*0.28} fill="rgba(37,99,235,0.25)" stroke="#3b82f6" strokeWidth={1} />
      ))}
      {([[10.5,10.5],[10.5,12.5],[12.5,10.5],[12.5,12.5]] as [number,number][]).map(([rr,cc],i) => (
        <circle key={`yg-${i}`} cx={cc*C} cy={rr*C} r={C*0.28} fill="rgba(22,163,74,0.25)" stroke="#22c55e" strokeWidth={1} />
      ))}
      {([[10.5,1.5],[10.5,3.5],[12.5,1.5],[12.5,3.5]] as [number,number][]).map(([rr,cc],i) => (
        <circle key={`yy-${i}`} cx={cc*C} cy={rr*C} r={C*0.28} fill="rgba(202,138,4,0.25)" stroke="#eab308" strokeWidth={1} />
      ))}

      {/* ── Main path cells ── */}
      {MAIN_PATH.map(([row, col], i) => {
        const safe    = SAFE_IDX.has(i);
        const isRedS  = i === 0;
        const isBlueS = i === 13;
        let fill = "#f8fafc";
        if (isRedS)  fill = "#fca5a5";
        if (isBlueS) fill = "#93c5fd";
        return (
          <g key={`mp-${i}`}>
            <rect x={col*C+1} y={row*C+1} width={C-2} height={C-2} fill={fill} rx={2} />
            {safe && (
              <text x={cx_(col)} y={cy_(row)+1} textAnchor="middle" dominantBaseline="middle" fontSize={C*0.52} style={{ userSelect: "none" }}>⭐</text>
            )}
          </g>
        );
      })}

      {/* ── Home corridors ── */}
      {HOME_COLS[0].map(([row,col],i) => (
        <rect key={`hc0-${i}`} x={col*C+1} y={row*C+1} width={C-2} height={C-2} fill="#fca5a5" rx={2} />
      ))}
      {HOME_COLS[1].map(([row,col],i) => (
        <rect key={`hc1-${i}`} x={col*C+1} y={row*C+1} width={C-2} height={C-2} fill="#93c5fd" rx={2} />
      ))}
      {HOME_COLS[2].map(([row,col],i) => (
        <rect key={`hc2-${i}`} x={col*C+1} y={row*C+1} width={C-2} height={C-2} fill="#86efac" rx={2} />
      ))}
      {HOME_COLS[3].map(([row,col],i) => (
        <rect key={`hc3-${i}`} x={col*C+1} y={row*C+1} width={C-2} height={C-2} fill="#fde68a" rx={2} />
      ))}

      {/* ── Center star (4 colored triangles) ── */}
      <rect x={6*C} y={6*C} width={3*C} height={3*C} fill="#0f172a" />
      <polygon points={`${6*C},${6*C} ${9*C},${6*C} ${7.5*C},${7.5*C}`}   fill="#dc2626" opacity={0.9} />
      <polygon points={`${9*C},${6*C} ${9*C},${9*C} ${7.5*C},${7.5*C}`}   fill="#2563eb" opacity={0.9} />
      <polygon points={`${9*C},${9*C} ${6*C},${9*C} ${7.5*C},${7.5*C}`}   fill="#16a34a" opacity={0.9} />
      <polygon points={`${6*C},${9*C} ${6*C},${6*C} ${7.5*C},${7.5*C}`}   fill="#ca8a04" opacity={0.9} />
      <circle cx={7.5*C} cy={7.5*C} r={C*0.4} fill="white" opacity={0.15} />

      {/* ── Column/row glow lines separating zones ── */}
      <line x1={6*C} y1={0}  x2={6*C} y2={6*C}  stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <line x1={9*C} y1={0}  x2={9*C} y2={6*C}  stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <line x1={6*C} y1={9*C} x2={6*C} y2={SZ}  stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
      <line x1={9*C} y1={9*C} x2={9*C} y2={SZ}  stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

      {/* ── Active-turn glow border on the zone ── */}
      {turn === "player" && (
        <rect x={1} y={1} width={6*C-2} height={6*C-2}
          fill="none" stroke="#ef4444" strokeWidth={3} rx={3} opacity={0.65}
          style={{ animation: "zone-pulse 0.9s ease-in-out infinite alternate" }} />
      )}
      {turn === "bot" && (
        <rect x={9*C+1} y={1} width={6*C-2} height={6*C-2}
          fill="none" stroke="#3b82f6" strokeWidth={3} rx={3} opacity={0.65}
          style={{ animation: "zone-pulse 0.9s ease-in-out infinite alternate" }} />
      )}

      {/* ── Score inside RED home base (YOU) ── */}
      {/* Overlay tinted panel */}
      <rect x={C+4} y={C+4} width={4*C-8} height={4*C-8} rx={6}
        fill="rgba(220,38,38,0.08)" />
      {/* "YOU" label */}
      <text x={3*C} y={C + 4*C*0.22}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={C*0.45} fontWeight="900" fill="#dc2626"
        letterSpacing="2" style={{ userSelect: "none" }}>YOU</text>
      {/* Score number */}
      <text x={3*C} y={C + 4*C*0.52}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={C*1.0} fontWeight="900" fill="#dc2626"
        style={{ userSelect: "none", filter: "drop-shadow(0 0 4px rgba(220,38,38,0.5))" }}>
        {pScore}
      </text>
      {/* Moves left */}
      <text x={3*C} y={C + 4*C*0.82}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={C*0.35} fontWeight="700" fill="#9f1239"
        style={{ userSelect: "none" }}>
        {MAX_MOVES - pMoves} moves
      </text>
      {/* TURN indicator badge */}
      {turn === "player" && (
        <>
          <rect x={3*C - C*0.85} y={C + 4*C*0.9} width={C*1.7} height={C*0.36} rx={4}
            fill="#dc2626" opacity={0.9}
            style={{ animation: "zone-pulse 0.7s ease-in-out infinite alternate" }} />
          <text x={3*C} y={C + 4*C*0.9 + C*0.18}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={C*0.28} fontWeight="900" fill="white" letterSpacing="1"
            style={{ userSelect: "none" }}>YOUR TURN</text>
        </>
      )}

      {/* ── Score inside BLUE home base (BOT) ── */}
      <rect x={10*C+4} y={C+4} width={4*C-8} height={4*C-8} rx={6}
        fill="rgba(37,99,235,0.08)" />
      {/* Bot name label */}
      <text x={12*C} y={C + 4*C*0.22}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={C*0.4} fontWeight="900" fill="#2563eb"
        letterSpacing="1" style={{ userSelect: "none" }}>
        {botName.slice(0, 7).toUpperCase()}
      </text>
      {/* Score number */}
      <text x={12*C} y={C + 4*C*0.52}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={C*1.0} fontWeight="900" fill="#2563eb"
        style={{ userSelect: "none", filter: "drop-shadow(0 0 4px rgba(37,99,235,0.5))" }}>
        {bScore}
      </text>
      {/* Moves left */}
      <text x={12*C} y={C + 4*C*0.82}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={C*0.35} fontWeight="700" fill="#1e40af"
        style={{ userSelect: "none" }}>
        {MAX_MOVES - bMoves} moves
      </text>
      {/* TURN indicator badge */}
      {turn === "bot" && (
        <>
          <rect x={12*C - C*0.85} y={C + 4*C*0.9} width={C*1.7} height={C*0.36} rx={4}
            fill="#2563eb" opacity={0.9}
            style={{ animation: "zone-pulse 0.7s ease-in-out infinite alternate" }} />
          <text x={12*C} y={C + 4*C*0.9 + C*0.18}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={C*0.28} fontWeight="900" fill="white" letterSpacing="1"
            style={{ userSelect: "none" }}>BOT TURN</text>
        </>
      )}

      {/* ── Tokens ── */}
      {Array.from(cellMap.entries()).map(([key, toks]) => {
        const [row, col] = key.split(",").map(Number);
        const baseCx = cx_(col);
        const baseCy = cy_(row);
        const n = toks.length;

        return toks.map((tok, idx) => {
          const isPlayer   = tok.pi === P;
          const isValid    = isPlayer && validTokens.includes(tok.ti);
          const cfg        = PLAYER_CFG[tok.pi];
          // Spread tokens in a 2×2 grid when stacked
          const offX = n > 1 ? (idx % 2 === 0 ? -C*0.22 : C*0.22) : 0;
          const offY = n > 2 ? (idx < 2 ? -C*0.22 : C*0.22) : 0;
          const tx   = baseCx + offX;
          const ty   = baseCy + offY;
          const tokR = n > 2 ? r * 0.8 : r;

          return (
            <g key={`tok-${tok.pi}-${tok.ti}`}
              onClick={isValid ? () => onSelect(tok.ti) : undefined}
              style={{ cursor: isValid ? "pointer" : "default" }}>
              {/* Selection pulse ring */}
              {isValid && (
                <circle cx={tx} cy={ty} r={tokR + 5} fill="none"
                  stroke="#FFD700" strokeWidth={2} opacity={0.85}
                  style={{ animation: "ludo-pulse 0.7s ease-in-out infinite alternate" }} />
              )}
              {/* Kill highlight ring */}
              {!isPlayer && highlightKill && (
                <circle cx={tx} cy={ty} r={tokR + 4} fill="none"
                  stroke="#ff3b5c" strokeWidth={2} opacity={0.7}
                  style={{ animation: "ludo-pulse 0.5s ease-in-out infinite alternate" }} />
              )}
              {/* Main token circle */}
              <circle cx={tx} cy={ty} r={tokR}
                fill={cfg.fill}
                stroke={isValid ? "#FFD700" : "rgba(255,255,255,0.6)"}
                strokeWidth={isValid ? 2 : 1}
                filter={isValid ? `drop-shadow(0 0 5px ${cfg.glow})` : undefined}
              />
              {/* Shine highlight */}
              <circle cx={tx - tokR*0.3} cy={ty - tokR*0.3} r={tokR*0.35} fill="rgba(255,255,255,0.45)" />
              {/* Token index number */}
              <text x={tx} y={ty+1} textAnchor="middle" dominantBaseline="middle"
                fontSize={tokR*0.9} fontWeight="900" fill="white" style={{ userSelect: "none" }}>
                {tok.ti + 1}
              </text>
            </g>
          );
        });
      })}

      <style>{`
        @keyframes ludo-pulse { from { opacity: 0.3; } to { opacity: 1; } }
        @keyframes zone-pulse { from { opacity: 0.35; } to { opacity: 0.85; } }
      `}</style>
    </svg>
  );
}

// ─── BOT AI ───────────────────────────────────────────────────────────────────

type BotTier = "easy" | "medium" | "god";

function chooseBotToken(
  bTokens: number[], pTokens: number[], dice: number, tier: BotTier,
): number {
  const valid = bTokens
    .map((s, ti) => ({ ti, s }))
    .filter(({ s }) => canMoveTok(s, dice));
  if (valid.length === 0) return -1;
  if (valid.length === 1) return valid[0].ti;
  if (tier === "easy") return valid[Math.floor(Math.random() * valid.length)].ti;

  // Score each candidate move
  const scored = valid.map(({ ti, s }) => {
    const ns = s + dice;
    let score = ns * 0.8;                         // prefer advancement
    if (ns >= 59) score += 200;                   // home is best
    if (ns >= 53) score += 30;                    // home corridor bonus
    const nPos = gPos(B, ns);
    // Kill opportunity
    if (nPos && !isSafe(B, ns)) {
      for (const ps of pTokens) {
        const pp = gPos(P, ps);
        if (pp && pp[0] === nPos[0] && pp[1] === nPos[1]) {
          score += tier === "god" ? 90 : 55;
        }
      }
    }
    // Danger penalty (if god mode avoids it)
    if (tier === "god" && nPos && !isSafe(B, ns)) {
      for (const ps of pTokens) {
        if (ps + 1 <= 6 || ps + 2 <= 6 || ps + 3 <= 6) {
          const pp = gPos(P, ps);
          if (pp) {
            const dist = Math.abs(pp[0] - nPos[0]) + Math.abs(pp[1] - nPos[1]);
            if (dist <= 2) score -= 18;
          }
        }
      }
    }
    return { ti, score };
  });
  scored.sort((a, b) => b.score - a.score);
  if (tier === "god") return scored[0].ti;
  // Medium: pick from top 2
  const pool = scored.slice(0, Math.min(2, scored.length));
  return pool[Math.floor(Math.random() * pool.length)].ti;
}

// ─── SCORE HEADER ─────────────────────────────────────────────────────────────

function ScoreHeader({
  pScore, bScore, pMoves, bMoves, turn, tier, botName,
}: {
  pScore: number; bScore: number; pMoves: number; bMoves: number;
  turn: "player" | "bot"; tier: BotTier; botName: string;
}) {
  const pLeft = MAX_MOVES - pMoves;
  const bLeft = MAX_MOVES - bMoves;
  const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";
  const tierLabel = tier === "god" ? "⚡ GOD" : tier === "medium" ? "🔶 MED" : "🟢 EASY";

  return (
    <div className="flex gap-2 px-3 py-2 rounded-2xl items-center"
      style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(10px)" }}>

      {/* Player card */}
      <motion.div className="flex-1 rounded-xl px-2.5 py-2 flex flex-col items-center gap-0.5"
        animate={{ boxShadow: turn === "player" ? "0 0 16px rgba(239,68,68,0.6), 0 0 32px rgba(239,68,68,0.25)" : "none" }}
        style={{
          background: turn === "player" ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${turn === "player" ? "#ef4444" : "rgba(255,255,255,0.07)"}`,
          transition: "all 0.3s",
        }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
          <span className="text-[10px] font-black tracking-wider" style={{ color: turn === "player" ? "#ef4444" : "rgba(255,255,255,0.5)" }}>YOU</span>
          {turn === "player" && <motion.span className="text-[8px] font-black px-1 py-0.5 rounded-full"
            style={{ background: "#ef4444", color: "#fff" }}
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>TURN</motion.span>}
        </div>
        <motion.div className="text-2xl font-black leading-none"
          style={{ color: "#ef4444", textShadow: "0 0 12px rgba(239,68,68,0.6)" }}
          key={pScore} initial={{ scale: 1.4, color: "#FFD700" }} animate={{ scale: 1, color: "#ef4444" }}
          transition={{ duration: 0.3 }}>
          {pScore}
        </motion.div>
        <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>{pLeft} moves left</div>
      </motion.div>

      {/* Center — VS + moves */}
      <div className="flex flex-col items-center gap-1 px-1">
        <div className="text-[10px] font-black tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>VS</div>
        <div className="text-[9px] font-bold text-center" style={{ color: "rgba(255,255,255,0.2)" }}>50 moves</div>
        <div className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40` }}>
          {tierLabel}
        </div>
      </div>

      {/* Bot card */}
      <motion.div className="flex-1 rounded-xl px-2.5 py-2 flex flex-col items-center gap-0.5"
        animate={{ boxShadow: turn === "bot" ? "0 0 16px rgba(59,130,246,0.6), 0 0 32px rgba(59,130,246,0.25)" : "none" }}
        style={{
          background: turn === "bot" ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${turn === "bot" ? "#3b82f6" : "rgba(255,255,255,0.07)"}`,
          transition: "all 0.3s",
        }}>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: "#3b82f6", boxShadow: "0 0 6px #3b82f6" }} />
          <span className="text-[10px] font-black tracking-wider" style={{ color: turn === "bot" ? "#3b82f6" : "rgba(255,255,255,0.5)" }}>{botName.slice(0,8)}</span>
          {turn === "bot" && <motion.span className="text-[8px] font-black px-1 py-0.5 rounded-full"
            style={{ background: "#3b82f6", color: "#fff" }}
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>TURN</motion.span>}
        </div>
        <motion.div className="text-2xl font-black leading-none"
          style={{ color: "#3b82f6", textShadow: "0 0 12px rgba(59,130,246,0.6)" }}
          key={bScore} initial={{ scale: 1.4, color: "#FFD700" }} animate={{ scale: 1, color: "#3b82f6" }}
          transition={{ duration: 0.3 }}>
          {bScore}
        </motion.div>
        <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>{bLeft} moves left</div>
      </motion.div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface Props { onBack: () => void; initialFee?: number }

export default function LudoFastGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();

  const isFreeMode = initialFee === 0;
  const tier: BotTier = isFreeMode || initialFee < 5 ? "easy" : initialFee < 20 ? "medium" : "god";

  const botRef  = useRef<BotPlayer>(getRandomBot());
  const scored  = useRef(false);

  // All 4 tokens start at step 1 (deployed on board, no yard wait)
  const [pTokens,    setPTokens]    = useState([1, 1, 1, 1]);
  const [bTokens,    setBTokens]    = useState([1, 1, 1, 1]);
  const [pScore,     setPScore]     = useState(0);
  const [bScore,     setBScore]     = useState(0);
  const [pMoves,     setPMoves]     = useState(0);
  const [bMoves,     setBMoves]     = useState(0);
  const [dice,       setDice]       = useState(1);
  const [rolling,    setRolling]    = useState(false);
  const [turn,       setTurn]       = useState<"player" | "bot">("player");
  const [extraTurn,  setExtraTurn]  = useState(false);
  const [validToks,  setValidToks]  = useState<number[]>([]);
  const [logMsgs,    setLogMsgs]    = useState<string[]>(["🎮 Match started! All tokens deployed. Roll to move!"]);
  const [phase,      setPhase]      = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [mmStage,    setMmStage]    = useState<"searching" | "found">("searching");
  const [emote,      setEmote]      = useState("");
  const [killFlash,  setKillFlash]  = useState(false);

  const pushLog = (msg: string) => setLogMsgs(prev => [msg, ...prev.slice(0, 5)]);
  const flashKill = () => { setKillFlash(true); setTimeout(() => setKillFlash(false), 600); };

  // ── Matchmaking — 4-second flow: 3.5s searching → 0.5s "found" → playing ───
  useEffect(() => {
    if (phase !== "matchmaking") return;
    const t1 = setTimeout(() => setMmStage("found"),   3500);
    const t2 = setTimeout(() => setPhase("playing"),   4000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── End condition ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || pMoves < MAX_MOVES || bMoves < MAX_MOVES || scored.current) return;
    scored.current = true;
    setPhase("result");
    const won   = pScore > bScore;
    const prize = (!isFreeMode && won) ? Math.floor(initialFee * 2 * 0.9) : 0;
    if (!isFreeMode && won) addWinning(prize);
    addMatch({
      gameId: "ludofast", gameName: isFreeMode ? "Ludo Fast (Practice)" : "Ludo Fast", gameIcon: "🎲",
      result: won ? "win" : "loss", entryFee: initialFee,
      prize, userScore: pScore, opponentScore: bScore,
      opponentName: botRef.current.name,
    });
  }, [pMoves, bMoves, phase, pScore, bScore]);

  // ── Bot AI turn ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (turn !== "bot" || phase !== "playing" || bMoves >= MAX_MOVES || rolling) return;

    const delay = tier === "god" ? 600 : tier === "medium" ? 900 : 1200;

    const t = setTimeout(() => {
      const val = rollDiceVal(tier === "god" && !isFreeMode);
      setDice(val);
      setRolling(true);

      setTimeout(() => {
        setRolling(false);
        const chosen = chooseBotToken([...bTokens], [...pTokens], val, tier);

        if (chosen === -1) {
          pushLog(`🔵 Bot rolled ${val} — no valid move. Skip!`);
          setBMoves(m => m + 1);
          setTurn("player");
          setExtraTurn(false);
          return;
        }

        setBTokens(prev => {
          const nb = [...prev];
          const oldStep = nb[chosen];
          let ns = Math.min(oldStep + val, oldStep >= 53 ? 59 : oldStep + val);
          if (oldStep >= 53) ns = Math.min(oldStep + val, 59);

          // Check kill on player tokens
          let killed = false;
          const np = gPos(B, ns);
          const newP = [...pTokens];
          let killPts = 0;
          if (np && !isSafe(B, ns) && ns < 53) {
            for (let i = 0; i < newP.length; i++) {
              const pp = gPos(P, newP[i]);
              if (pp && pp[0] === np[0] && pp[1] === np[1] && newP[i] < 53) {
                killPts = newP[i] - 1;
                newP[i] = 1;
                killed = true;
                flashKill();
                setEmote(EMOTES[Math.floor(Math.random() * EMOTES.length)]);
                setTimeout(() => setEmote(""), 1200);
                pushLog(`💀 Bot killed your token! +${KILL_BONUS} | You -${killPts} pts`);
                setPTokens(newP);
                setPScore(s => Math.max(0, s - killPts));
              }
            }
          }

          const moved = ns - oldStep;
          nb[chosen] = ns;
          let pts = moved;
          if (ns >= 59) { pts += HOME_SCORE; pushLog(`🔵 Bot token HOME! +${moved + HOME_SCORE} pts 🎉`); }
          else if (killed) { /* logged above */ }
          else pushLog(`🔵 Bot rolled ${val} → +${pts} pts`);

          setBScore(s => s + pts + (killed ? KILL_BONUS : 0));
          setBMoves(m => m + 1);

          if (val === 6 || killed) {
            pushLog("🔵 Bot gets EXTRA TURN!");
            // bot keeps turn (don't switch)
          } else {
            setTurn("player");
          }
          return nb;
        });
      }, 700);
    }, delay);

    return () => clearTimeout(t);
  }, [turn, phase, bMoves, rolling]);

  // ── Roll dice value ───────────────────────────────────────────────────────────
  function rollDiceVal(godMode: boolean): number {
    if (godMode) {
      const r = Math.random();
      if (r < 0.35) return 6;
      if (r < 0.62) return 5;
      return Math.ceil(Math.random() * 4);
    }
    return Math.ceil(Math.random() * 6);
  }

  // ── Player roll ───────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || pMoves >= MAX_MOVES || validToks.length > 0) return;
    const val = rollDiceVal(false);
    setDice(val);
    setRolling(true);

    setTimeout(() => {
      setRolling(false);
      const valid = pTokens.map((s, ti) => ({ s, ti })).filter(({ s }) => canMoveTok(s, val)).map(({ ti }) => ti);

      if (valid.length === 0) {
        pushLog(`Rolled ${val} — no valid move. Turn skipped!`);
        setPMoves(m => m + 1);
        setExtraTurn(false);
        setTurn("bot");
        return;
      }
      if (valid.length === 1) {
        // Auto-move
        setTimeout(() => movePlayerToken(valid[0], val), 200);
        return;
      }
      setValidToks(valid);
      pushLog(`Rolled ${val} — tap a token to move!`);
    }, 700);
  }, [rolling, turn, pMoves, validToks, pTokens]);

  // ── Move player token ─────────────────────────────────────────────────────────
  function movePlayerToken(ti: number, diceVal: number) {
    setValidToks([]);
    setPTokens(prev => {
      const np = [...prev];
      const oldStep = np[ti];
      let ns = oldStep + diceVal;
      if (oldStep >= 53) ns = Math.min(ns, 59);

      // Check kill on bot tokens
      let killed = false;
      let killPts = 0;
      const nPos = gPos(P, ns);
      if (nPos && !isSafe(P, ns) && ns < 53) {
        setBTokens(prevB => {
          const nb = [...prevB];
          for (let i = 0; i < nb.length; i++) {
            const bp = gPos(B, nb[i]);
            if (bp && bp[0] === nPos[0] && bp[1] === nPos[1] && nb[i] < 53) {
              killPts = nb[i] - 1;
              nb[i] = 1;
              killed = true;
              flashKill();
              setEmote("💥");
              setTimeout(() => setEmote(""), 1200);
              pushLog(`💥 KILL! Token #${i+1} sent back! +${KILL_BONUS + killPts} pts!`);
              setBScore(s => Math.max(0, s - killPts));
            }
          }
          return nb;
        });
      }

      const moved = ns - oldStep;
      np[ti] = ns;
      let pts = moved + (killed ? KILL_BONUS : 0);
      if (ns >= 59) {
        pts += HOME_SCORE;
        pushLog(`🏠 Token ${ti+1} HOME! +${moved + HOME_SCORE}${killed ? `+${KILL_BONUS}` : ""} pts! 🎉`);
      } else if (!killed) {
        pushLog(`Rolled ${diceVal} → +${moved} pts${diceVal === 6 ? " 🎲 EXTRA TURN!" : ""}`);
      }

      setPScore(s => s + pts);
      setPMoves(m => m + 1);

      const getExtra = diceVal === 6 || killed;
      setExtraTurn(getExtra);
      if (!getExtra) setTurn("bot");
      return np;
    });
  }

  const handleTokenSelect = (ti: number) => {
    if (!validToks.includes(ti)) return;
    movePlayerToken(ti, dice);
  };

  // ─── Derived state ────────────────────────────────────────────────────────────
  const canRoll = turn === "player" && !rolling && pMoves < MAX_MOVES && validToks.length === 0;
  const prize   = (!isFreeMode && pScore > bScore) ? Math.floor(initialFee * 2 * 0.9) : 0;

  // ─── MATCHMAKING SCREEN ───────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";
    const tierLabel = tier === "god" ? "⚡ GOD MODE" : tier === "medium" ? "🔶 MEDIUM" : "🟢 EASY";
    const prize     = isFreeMode ? null : Math.floor(initialFee * 2 * 0.9);

    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-5"
        style={{ background: "linear-gradient(180deg,#06080f 0%,#0c1220 50%,#06080f 100%)", maxWidth: 480, margin: "0 auto" }}>

        {/* ── HEADER ── */}
        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-10 text-center">
          <p className="text-[10px] font-black tracking-[0.25em] mb-2.5"
            style={{ color: "rgba(255,215,0,0.45)" }}>
            {mmStage === "searching" ? "FAST LUDO · SEARCHING…" : "FAST LUDO · MATCH FOUND"}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {!isFreeMode && (
              <span className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.28)", color: "#FFD700" }}>
                💰 Entry ₹{initialFee}
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full text-xs font-black"
              style={{ background: `${tierColor}18`, border: `1px solid ${tierColor}40`, color: tierColor }}>
              {tierLabel}
            </span>
            {prize !== null && (
              <span className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
                🏆 Win ₹{prize}
              </span>
            )}
          </div>
        </motion.div>

        {/* ── PLAYER  VS  OPPONENT ── */}
        <div className="w-full flex items-center justify-center gap-3 mb-10">

          {/* ── YOU ── */}
          <motion.div
            initial={{ opacity: 0, x: -48 }} animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.1 }}
            className="flex flex-col items-center gap-3 flex-1">

            <div className="relative">
              {/* Pulse ring */}
              <motion.div className="absolute rounded-full pointer-events-none"
                style={{ inset: -7, border: "2.5px solid #ef4444", borderRadius: "50%" }}
                animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.2, 0.75] }}
                transition={{ duration: 1.9, repeat: Infinity }} />

              {/* Avatar */}
              <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-3xl"
                style={{
                  background: "linear-gradient(135deg,#ef4444 0%,#7f1d1d 100%)",
                  border: "3.5px solid #ef4444",
                  boxShadow: "0 0 28px rgba(239,68,68,0.6), 0 0 56px rgba(239,68,68,0.2)",
                }}>
                🎮
              </div>

              {/* Online badge */}
              <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: "#22c55e", border: "2.5px solid #06080f" }} />
            </div>

            <div className="text-center">
              <div className="font-black text-white text-base leading-tight">YOU</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(239,68,68,0.85)" }}>🔴 Red</div>
            </div>
          </motion.div>

          {/* ── VS BADGE ── */}
          <motion.div
            initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.28 }}
            className="shrink-0 flex flex-col items-center gap-1">
            <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center font-black text-lg"
              style={{
                background: "linear-gradient(135deg,#FFD700,#ff8c00)",
                boxShadow: "0 0 22px rgba(255,215,0,0.65), 0 0 44px rgba(255,215,0,0.25)",
                color: "#000",
                letterSpacing: "-0.02em",
              }}>
              VS
            </div>
            <div className="w-px h-6" style={{ background: "linear-gradient(to bottom,rgba(255,215,0,0.5),transparent)" }} />
          </motion.div>

          {/* ── OPPONENT ── */}
          <AnimatePresence mode="wait">
            {mmStage === "searching" ? (
              /* ── Searching placeholder ── */
              <motion.div key="searching"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <motion.div
                    className="w-[88px] h-[88px] rounded-full flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,0.07)", border: "2px dashed rgba(59,130,246,0.3)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.2, repeat: Infinity }}>
                    <motion.span style={{ fontSize: 34 }}
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}>
                      🔍
                    </motion.span>
                  </motion.div>
                </div>
                <div className="text-center">
                  <div className="font-black text-white text-sm">Finding Players</div>
                  <motion.div className="text-[11px] font-bold mt-0.5"
                    style={{ color: "rgba(59,130,246,0.6)" }}
                    animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity }}>
                    Scanning 7,000+ online…
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              /* ── Bot card (match found) ── */
              <motion.div key="found"
                initial={{ opacity: 0, x: 48, scale: 0.85 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <motion.div className="absolute rounded-full pointer-events-none"
                    style={{ inset: -7, border: "2.5px solid #3b82f6", borderRadius: "50%" }}
                    animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.2, 0.75] }}
                    transition={{ duration: 1.9, repeat: Infinity, delay: 0.4 }} />
                  <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      background: `linear-gradient(135deg,${botRef.current.avatarColor}cc 0%,#1e1b4b 100%)`,
                      border: `3.5px solid ${botRef.current.avatarColor}`,
                      boxShadow: `0 0 28px ${botRef.current.avatarColor}99, 0 0 56px ${botRef.current.avatarColor}33`,
                    }}>
                    <span className="font-black text-white" style={{ fontSize: 38, lineHeight: 1 }}>
                      {botRef.current.initial}
                    </span>
                  </div>
                  <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full"
                    style={{ background: "#22c55e", border: "2.5px solid #06080f" }} />
                </div>
                <div className="text-center">
                  <div className="font-black text-white text-base leading-tight">{botRef.current.name}</div>
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(59,130,246,0.85)" }}>
                    📍 {botRef.current.city}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* ── MATCH STATS STRIP ── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="w-full rounded-2xl px-4 py-3.5 mb-8 flex items-center justify-around"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {[
            { label: "Moves", value: "50 Each" },
            { label: "Kill Bonus", value: "+15 pts" },
            { label: "Home Bonus", value: "+25 pts" },
            { label: "Winner", value: "Top Score" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className="text-[9px] font-black tracking-widest uppercase"
                style={{ color: "rgba(255,255,255,0.28)" }}>{label}</div>
              <div className="text-xs font-black" style={{ color: "#FFD700" }}>{value}</div>
            </div>
          ))}
        </motion.div>

        {/* ── LOADING BAR ── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
          className="w-full">
          <div className="h-[5px] rounded-full overflow-hidden mb-2.5"
            style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#ef4444 0%,#FFD700 50%,#3b82f6 100%)" }}
              initial={{ width: "0%" }} animate={{ width: "100%" }}
              transition={{ duration: 2.8, ease: "linear" }} />
          </div>
          <motion.p className="text-center text-[11px] font-bold"
            style={{ color: "rgba(255,255,255,0.3)" }}
            animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.1, repeat: Infinity }}>
            {mmStage === "searching" ? "⏳ Scanning real players…" : "🎮 Setting up the board…"}
          </motion.p>
        </motion.div>

      </div>
    );
  }

  // ─── RESULT SCREEN ────────────────────────────────────────────────────────────
  if (phase === "result") {
    const won = pScore > bScore;
    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-5"
        style={{ background: won ? "linear-gradient(180deg,#052010,#0a3520,#052010)" : "linear-gradient(180deg,#1a0510,#2d0a18,#1a0510)", maxWidth: 480, margin: "0 auto" }}>

        <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }} className="text-8xl"
          style={{ filter: `drop-shadow(0 0 30px ${won ? "rgba(255,215,0,0.9)" : "rgba(239,68,68,0.7)"})` }}>
          {won ? "🏆" : "😔"}
        </motion.div>

        <div className="text-center">
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>
            {won ? "VICTORY!" : "DEFEATED"}
          </motion.h2>
          {won && !isFreeMode && prize > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
              className="mt-2 text-2xl font-black" style={{ color: "#4ade80" }}>+₹{prize}</motion.div>
          )}
          {isFreeMode && (
            <div className="mt-2 text-sm font-bold" style={{ color: "rgba(16,185,129,0.8)" }}>Practice Match</div>
          )}
        </div>

        {/* Score breakdown */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex">
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(239,68,68,0.1)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(239,68,68,0.7)" }}>YOU</div>
              <div className="text-3xl font-black" style={{ color: "#ef4444" }}>{pScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
            </div>
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(59,130,246,0.1)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(59,130,246,0.7)" }}>{botRef.current.name.slice(0,8)}</div>
              <div className="text-3xl font-black" style={{ color: "#3b82f6" }}>{bScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
            </div>
          </div>
          <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Entry Fee</span>
            <span className="text-sm font-black" style={{ color: isFreeMode ? "#10b981" : "#FFD700" }}>
              {isFreeMode ? "FREE" : `₹${initialFee}`}
            </span>
          </div>
          {!isFreeMode && (
            <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{won ? "You Won" : "You Lost"}</span>
              <span className="text-sm font-black" style={{ color: won ? "#4ade80" : "#ef4444" }}>
                {won ? `+₹${prize}` : `-₹${initialFee}`}
              </span>
            </div>
          )}
        </div>

        <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 24px rgba(255,215,0,0.4)" }}>
          Back to Games
        </motion.button>
      </div>
    );
  }

  // ─── PLAYING SCREEN ───────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen"
      style={{ background: "linear-gradient(180deg,#060b18 0%,#0d1526 100%)", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 18 }}>
          ←
        </button>
        <div className="text-center">
          <div className="font-black text-white text-sm tracking-widest">FAST LUDO</div>
          <div className="text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>
            {isFreeMode ? "PRACTICE" : `₹${initialFee} · Win ₹${Math.floor(initialFee * 2 * 0.9)}`}
          </div>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 16 }}>
          🎲
        </div>
      </div>

      {/* ── Compact turn / fee strip ── */}
      <div className="flex items-center justify-between px-3 pb-1 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <motion.div className="w-2.5 h-2.5 rounded-full"
            style={{ background: "#ef4444", boxShadow: turn === "player" ? "0 0 8px #ef4444" : "none" }}
            animate={turn === "player" ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.7, repeat: Infinity }} />
          <span className="text-[10px] font-black" style={{ color: turn === "player" ? "#ef4444" : "rgba(255,255,255,0.3)" }}>YOU</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Tier badge */}
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: tier === "god" ? "rgba(255,59,92,0.15)" : tier === "medium" ? "rgba(249,115,22,0.15)" : "rgba(74,222,128,0.12)",
              color: tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80",
              border: `1px solid ${tier === "god" ? "rgba(255,59,92,0.4)" : tier === "medium" ? "rgba(249,115,22,0.4)" : "rgba(74,222,128,0.35)"}`,
            }}>
            {tier === "god" ? "⚡ GOD" : tier === "medium" ? "🔶 MED" : "🟢 EASY"}
          </span>
          <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
          <span className="text-[10px] font-black" style={{ color: "rgba(255,215,0,0.7)" }}>
            {isFreeMode ? "FREE" : `₹${initialFee}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black" style={{ color: turn === "bot" ? "#3b82f6" : "rgba(255,255,255,0.3)" }}>BOT</span>
          <motion.div className="w-2.5 h-2.5 rounded-full"
            style={{ background: "#3b82f6", boxShadow: turn === "bot" ? "0 0 8px #3b82f6" : "none" }}
            animate={turn === "bot" ? { scale: [1, 1.35, 1] } : { scale: 1 }}
            transition={{ duration: 0.7, repeat: Infinity }} />
        </div>
      </div>

      {/* ── Extra turn banner ── */}
      <AnimatePresence>
        {extraTurn && turn === "player" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-3 mb-2 px-4 py-2 rounded-xl text-center font-black text-sm flex-shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,140,0,0.12))", border: "1.5px solid rgba(255,215,0,0.5)", color: "#FFD700" }}>
            🎉 EXTRA TURN! Roll again!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Board ── */}
      <div className="flex-1 flex items-center justify-center px-2 relative">
        {/* Kill flash overlay */}
        <AnimatePresence>
          {killFlash && (
            <motion.div className="absolute inset-0 rounded-xl pointer-events-none z-10"
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.35, 0] }} exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              style={{ background: "radial-gradient(circle, rgba(255,59,92,0.7) 0%, transparent 70%)" }} />
          )}
        </AnimatePresence>
        {/* Emote flash */}
        <AnimatePresence>
          {emote && (
            <motion.div className="absolute top-1/2 left-1/2 z-20 pointer-events-none"
              initial={{ scale: 0, opacity: 1, x: "-50%", y: "-50%" }}
              animate={{ scale: 2.5, opacity: 0, y: "-120%" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.0 }}
              style={{ fontSize: 32, transform: "translate(-50%,-50%)" }}>
              {emote}
            </motion.div>
          )}
        </AnimatePresence>

        <Board pTokens={pTokens} bTokens={bTokens} validTokens={validToks}
          highlightKill={killFlash} onSelect={handleTokenSelect}
          pScore={pScore} bScore={bScore} pMoves={pMoves} bMoves={bMoves}
          turn={turn} botName={botRef.current.name} />
      </div>

      {/* ── Bottom controls ── */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2">
        <div className="flex items-center gap-3">
          {/* Event log */}
          <div className="flex-1 rounded-xl px-3 py-2 min-w-0" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <AnimatePresence mode="popLayout">
              {logMsgs.slice(0, 2).map((msg, i) => (
                <motion.div key={msg + i}
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: i === 0 ? 1 : 0.4 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-[10px] font-bold truncate"
                  style={{ color: i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>
                  {msg}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Dice */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <Dice3D value={dice} rolling={rolling} onClick={handleRoll} disabled={!canRoll} />
            {canRoll ? (
              <span className="text-[9px] font-black" style={{ color: "#FFD700" }}>TAP TO ROLL</span>
            ) : turn === "bot" ? (
              <span className="text-[9px] font-black" style={{ color: "rgba(59,130,246,0.7)" }}>BOT THINKING…</span>
            ) : validToks.length > 0 ? (
              <span className="text-[9px] font-black" style={{ color: "rgba(255,215,0,0.8)" }}>PICK TOKEN</span>
            ) : pMoves >= MAX_MOVES ? (
              <span className="text-[9px] font-black" style={{ color: "rgba(255,255,255,0.3)" }}>DONE</span>
            ) : (
              <span className="text-[9px] font-black" style={{ color: "rgba(255,255,255,0.3)" }}>WAIT…</span>
            )}
          </div>
        </div>

        {/* Progress bars */}
        <div className="flex gap-3 mt-2">
          <div className="flex-1">
            <div className="flex justify-between mb-0.5">
              <span className="text-[8px] font-bold" style={{ color: "rgba(239,68,68,0.7)" }}>YOU</span>
              <span className="text-[8px] font-bold" style={{ color: "rgba(239,68,68,0.7)" }}>{pMoves}/{MAX_MOVES}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div className="h-full rounded-full"
                animate={{ width: `${(pMoves / MAX_MOVES) * 100}%` }}
                style={{ background: "linear-gradient(90deg,#ef4444,#f87171)" }}
                transition={{ duration: 0.3 }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between mb-0.5">
              <span className="text-[8px] font-bold" style={{ color: "rgba(59,130,246,0.7)" }}>BOT</span>
              <span className="text-[8px] font-bold" style={{ color: "rgba(59,130,246,0.7)" }}>{bMoves}/{MAX_MOVES}</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div className="h-full rounded-full"
                animate={{ width: `${(bMoves / MAX_MOVES) * 100}%` }}
                style={{ background: "linear-gradient(90deg,#3b82f6,#60a5fa)" }}
                transition={{ duration: 0.3 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
