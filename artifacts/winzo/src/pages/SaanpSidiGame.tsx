/**
 * SaanpSidiGame — WINGGO · Premium 2-Token Saanp Sidi
 *
 * Scoring (updated):
 *  Score = Token1_Position + Token2_Position
 *  Home (sq.100) contributes 100 per token, max total = 200
 *  Snake bite instantly drops position → live score drops
 *  Ladder climb raises position → live score rises
 *  No step-by-step point accumulation — pure positional sum
 *  Highest score after 40 moves OR 2-min timer wins
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Constants ──────────────────────────────────────────────────────────────────
const MAX_MOVES = 40;
const BOT_NAMES = ["PriyaBot","VikramBot","NitaBot","RajBot","DevBot","AnuBot"];

// ── Board data ─────────────────────────────────────────────────────────────────
const SNAKES:  Record<number, number> = { 99:21, 92:37, 87:24, 74:53, 62:18, 48:26, 36:6  };
const LADDERS: Record<number, number> = { 4:25,  13:46, 28:76, 33:68, 51:67, 63:81, 71:91 };

// ── Sound Engine (Web Audio API — no external files needed) ───────────────────
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") { _audioCtx.resume(); }
    return _audioCtx;
  } catch { return null; }
}

const Sounds = {
  diceRoll() {
    try {
      const c = getAudioCtx(); if (!c) return;
      const len = Math.ceil(c.sampleRate * 0.18);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const env = 1 - i / len;
        d[i] = (Math.random() * 2 - 1) * env * env;
      }
      const src    = c.createBufferSource(); src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 0.6;
      const gain   = c.createGain();
      gain.gain.setValueAtTime(0.38, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      src.start();
    } catch {}
  },

  tokenMove() {
    try {
      const c = getAudioCtx(); if (!c) return;
      [880, 1100].forEach((f, i) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.045;
        gain.gain.setValueAtTime(0.18, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.1);
      });
    } catch {}
  },

  ladder() {
    try {
      const c = getAudioCtx(); if (!c) return;
      [523, 659, 784, 1047].forEach((f, i) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.2);
      });
    } catch {}
  },

  snake() {
    try {
      const c = getAudioCtx(); if (!c) return;
      [659, 523, 392, 262].forEach((f, i) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sawtooth"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.11;
        gain.gain.setValueAtTime(0.24, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.15);
      });
    } catch {}
  },

  tokenHome() {
    try {
      const c = getAudioCtx(); if (!c) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.26, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.5);
      });
    } catch {}
  },

  win() {
    try {
      const c = getAudioCtx(); if (!c) return;
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0.26, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.22);
      });
    } catch {}
  },

  lose() {
    try {
      const c = getAudioCtx(); if (!c) return;
      [392, 349, 330, 262].forEach((f, i) => {
        const osc  = c.createOscillator();
        const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.17;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.25);
      });
    } catch {}
  },
};

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
    let sc = n; // positional score
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
    let sc = n * 1.3;
    if (LADDERS[n]) sc += (LADDERS[n] - n) * 1.5 + 25;
    if (SNAKES[n])  sc -= (n - SNAKES[n]) + 35;
    if (n === 100)  sc += 80;
    return { r, sc };
  });
  rolls.sort((a, b) => b.sc - a.sc);
  return Math.random() < 0.88 ? rolls[0].r : (rolls[1] ?? rolls[0]).r;
}

// ── Bot token picker — choose better token to move ────────────────────────────
function botPickToken(
  roll: number, pos1: number, pos2: number,
  tier: "easy" | "medium" | "god",
): 1 | 2 {
  if (pos1 >= 100) return 2;
  if (pos2 >= 100) return 1;
  const r1 = applyMovePure(pos1, roll);
  const r2 = applyMovePure(pos2, roll);
  if (tier === "god") {
    const sc1 = r1.newPos
      + (r1.evt === "ladder" ? 15 : 0)
      - (r1.evt === "snake"  ? 20 : 0)
      + (r1.newPos === 100   ? 30 : 0);
    const sc2 = r2.newPos
      + (r2.evt === "ladder" ? 15 : 0)
      - (r2.evt === "snake"  ? 20 : 0)
      + (r2.newPos === 100   ? 30 : 0);
    return sc1 >= sc2 ? 1 : 2;
  }
  return r1.newPos >= r2.newPos ? 1 : 2;
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
  const sz   = 78;
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
        width: sz, height: sz, borderRadius: 14,
        background: "#ffffff",
        border: "2.5px solid #111111",
        boxShadow: rolling
          ? "5px 7px 20px rgba(0,0,0,.85),-2px -2px 8px rgba(255,255,255,.9),inset 0 2px 5px rgba(255,255,255,.85),0 0 55px rgba(255,215,0,1),0 0 110px rgba(255,215,0,.6)"
          : disabled
          ? "2px 3px 8px rgba(0,0,0,.4)"
          : "4px 7px 16px rgba(0,0,0,.65),-2px -2px 6px rgba(255,255,255,.75),inset 0 2px 4px rgba(255,255,255,.65),0 0 24px rgba(17,200,160,.5)",
        opacity: disabled && !rolling ? 0.48 : 1,
        transition: "box-shadow .22s, opacity .22s",
      }}>
        <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ display: "block" }}>
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

// ── Offsets for tokens sharing a cell (up to 4 tokens per cell) ───────────────
const CELL_OFFSETS: [number, number][] = [[-2.2,-2.2],[2.2,-2.2],[-2.2,2.2],[2.2,2.2]];

// ── Premium Board SVG — 4 animated tokens ─────────────────────────────────────
function Board({
  pPos1, pPos2, bPos1, bPos2, turn,
}: {
  pPos1: number; pPos2: number; bPos1: number; bPos2: number;
  turn: "player" | "bot";
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
          <rect x={x - 4.85} y={y - 4.85} width={9.7} height={9.7} rx={0.8}
            fill={ROW_COLORS[dRow]}
            stroke={isSnake ? "rgba(255,60,60,.85)" : isLadder ? "rgba(255,215,0,.85)" : ROW_GLOW[dRow]}
            strokeWidth={isSnake || isLadder ? 0.55 : 0.18}
          />
          <text x={x} y={y - 1.8} textAnchor="middle" fontSize="1.9"
            fill="rgba(255,255,255,.6)" fontWeight="700">{cell}</text>
          {isSnake  && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="3.1">🐍</text>}
          {isLadder && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="3.1">🪜</text>}
          {!isSnake  && snakeTails.has(cell) && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="2.3">☠️</text>}
          {!isLadder && ladderTops.has(cell)  && <text x={x} y={y + 2.8} textAnchor="middle" fontSize="2.3">⭐</text>}
        </g>
      );
    }
  }

  // ── Snake lines (red dashes) ──
  const snakeLines = Object.entries(SNAKES).map(([from, to]) => {
    const f = cellXY(Number(from)); const t = cellXY(Number(to));
    const mx = (f.x + t.x) / 2 + (t.y - f.y) * 0.15;
    const my = (f.y + t.y) / 2 - (t.x - f.x) * 0.15;
    return (
      <g key={`sl${from}`}>
        <path d={`M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`}
          fill="none" stroke="#cc2222" strokeWidth="1.2"
          strokeDasharray="2,0.8" opacity={0.7} />
        <path d={`M${f.x},${f.y} Q${mx},${my} ${t.x},${t.y}`}
          fill="none" stroke="rgba(255,80,80,.4)" strokeWidth="0.4" />
        <circle cx={f.x} cy={f.y} r="1.2" fill="#ff4444" opacity={0.8} />
        <circle cx={t.x} cy={t.y} r="0.8" fill="#882222" opacity={0.6} />
      </g>
    );
  });

  // ── Ladder lines (gold rungs) ──
  const ladderLines = Object.entries(LADDERS).map(([from, to]) => {
    const f = cellXY(Number(from)); const t = cellXY(Number(to));
    const dx = t.x - f.x; const dy = t.y - f.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = -dy / len * 0.8; const uy = dx / len * 0.8;
    return (
      <g key={`ll${from}`}>
        <line x1={f.x + ux} y1={f.y + uy} x2={t.x + ux} y2={t.y + uy}
          stroke="#c8a000" strokeWidth="0.8" opacity={0.75} />
        <line x1={f.x - ux} y1={f.y - uy} x2={t.x - ux} y2={t.y - uy}
          stroke="#c8a000" strokeWidth="0.8" opacity={0.75} />
        {[0.2, 0.4, 0.6, 0.8].map((t2, i) => (
          <line key={i}
            x1={f.x + dx * t2 + ux} y1={f.y + dy * t2 + uy}
            x2={f.x + dx * t2 - ux} y2={f.y + dy * t2 - uy}
            stroke="#FFD700" strokeWidth="0.6" opacity={0.65} />
        ))}
        <line x1={f.x} y1={f.y} x2={t.x} y2={t.y}
          stroke="rgba(255,215,0,.22)" strokeWidth="1.6" />
      </g>
    );
  });

  // ── Token layout: 4 tokens with collision offsets ──
  // Token definitions: [pos, color, textColor, label, filterId, isPlayerToken]
  const tokenDefs = [
    { pos: pPos1, color: "#22c55e", tc: "#000", lbl: "①", fid: "gp1" },
    { pos: pPos2, color: "#86efac", tc: "#000", lbl: "②", fid: "gp2" },
    { pos: bPos1, color: "#f43f5e", tc: "#fff", lbl: "❶", fid: "gb1" },
    { pos: bPos2, color: "#fb7185", tc: "#fff", lbl: "❷", fid: "gb2" },
  ];

  // Count tokens per cell for offset calculation
  const cellCount: Record<number, number> = {};
  tokenDefs.forEach(t => {
    if (t.pos > 0) cellCount[t.pos] = (cellCount[t.pos] ?? 0) + 1;
  });
  const cellIdx: Record<number, number> = {};
  const resolvedTokens = tokenDefs.map(t => {
    if (t.pos <= 0) {
      return { ...t, cx: -99, cy: -99 }; // off-screen
    }
    const base = cellXY(t.pos);
    const idx  = cellIdx[t.pos] ?? 0;
    cellIdx[t.pos] = idx + 1;
    const needsOff = cellCount[t.pos] > 1;
    const [dx, dy]  = needsOff ? (CELL_OFFSETS[idx] ?? [0, 0]) : [0, 0];
    return { ...t, cx: base.x + dx, cy: base.y + dy };
  });

  // Start-zone tokens (pos = 0): fixed corners outside board grid
  const startZone = [
    { cx: 3,  cy: 96 }, // pToken1 start
    { cx: 8,  cy: 96 }, // pToken2 start
    { cx: 92, cy: 96 }, // bToken1 start
    { cx: 97, cy: 96 }, // bToken2 start
  ];

  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%"
      style={{ display: "block", borderRadius: 12, overflow: "hidden",
        boxShadow: "0 0 50px rgba(0,0,0,.95),0 0 4px rgba(17,200,160,.3)" }}>
      <defs>
        <radialGradient id="ss3-bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#07071a" />
          <stop offset="100%" stopColor="#02020e" />
        </radialGradient>
        {tokenDefs.map(t => (
          <filter key={t.fid} id={t.fid} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        ))}
      </defs>

      <rect width="100" height="100" fill="url(#ss3-bg)" />
      {cells}
      {snakeLines}
      {ladderLines}

      {/* Grid lines overlay */}
      {[10,20,30,40,50,60,70,80,90].map(v => (
        <g key={v}>
          <line x1={v} y1={0} x2={v} y2={100} stroke="rgba(255,255,255,.04)" strokeWidth=".15" />
          <line x1={0} y1={v} x2={100} y2={v} stroke="rgba(255,255,255,.04)" strokeWidth=".15" />
        </g>
      ))}

      {/* Render 4 tokens */}
      {resolvedTokens.map((t, i) => {
        const isOnBoard = t.pos > 0;
        const cx = isOnBoard ? t.cx : startZone[i].cx;
        const cy = isOnBoard ? t.cy : startZone[i].cy;
        const isPlayerToken = i < 2;
        const isActiveTurn  = (isPlayerToken && turn === "player") || (!isPlayerToken && turn === "bot");

        return (
          <g key={t.fid}>
            {/* Pulse ring for active-turn tokens */}
            {isActiveTurn && isOnBoard && (
              <circle cx={cx} cy={cy} r="6"
                fill="none"
                stroke={isPlayerToken ? "rgba(34,197,94,.5)" : "rgba(244,63,94,.5)"}
                strokeWidth=".7">
                <animate attributeName="r" values="4;6.5;4" dur="1.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".8;0;.8" dur="1.1s" repeatCount="indefinite" />
              </circle>
            )}
            {/* Shadow */}
            <circle cx={cx + 0.5} cy={cy + 0.8} r="3.5" fill="rgba(0,0,0,.45)" />
            {/* Body */}
            <motion.circle
              cx={cx} cy={cy} r={3.5}
              fill={t.color}
              stroke="rgba(255,255,255,.92)" strokeWidth=".7"
              filter={`url(#${t.fid})`}
              animate={{ cx, cy }}
              transition={{ duration: 0.55, ease: "easeInOut" }}
            />
            {/* Shine */}
            <motion.circle
              cx={cx - 1.0} cy={cy - 1.0} r={1.1}
              fill="rgba(255,255,255,.42)"
              animate={{ cx: cx - 1.0, cy: cy - 1.0 }}
              transition={{ duration: 0.55, ease: "easeInOut" }}
            />
            {/* Label */}
            <motion.text
              x={cx} y={cy + 1.3}
              textAnchor="middle" fontSize="2.2" fill={t.tc} fontWeight="bold"
              animate={{ x: cx, y: cy + 1.3 }}
              transition={{ duration: 0.55, ease: "easeInOut" }}>
              {t.lbl}
            </motion.text>
            {/* HOME badge */}
            {t.pos === 100 && (
              <motion.text
                x={cx} y={cy - 5.2}
                textAnchor="middle" fontSize="1.8" fill="#FFD700" fontWeight="900"
                animate={{ x: cx, y: cy - 5.2 }}
                transition={{ duration: 0.55 }}>
                🏠
              </motion.text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Event type ─────────────────────────────────────────────────────────────────
type EvType = "ladder" | "snake" | "home" | "none";

// ── Pure move resolver (no score delta — score is sum of positions) ────────────
function applyMovePure(pos: number, roll: number): {
  newPos: number; msg: string; evt: EvType;
  floats: { text: string; color: string }[];
} {
  const floats: { text: string; color: string }[] = [];
  const target = pos + roll;

  if (target > 100) {
    return { newPos: pos, msg: `Rolled ${roll} — over 100, no move`, evt: "none", floats };
  }

  let newPos = target;
  let msg    = `Rolled ${roll} → sq.${target}`;
  let evt: EvType = "none";

  if (LADDERS[newPos]) {
    const top = LADDERS[newPos];
    newPos = top;
    msg   += ` 🪜 Ladder to ${top}!`;
    evt    = "ladder";
    floats.push({ text: "🪜 LADDER CLIMB!", color: "#FFD700" });
  } else if (SNAKES[newPos]) {
    const tail = SNAKES[newPos];
    const fall = newPos - tail;
    newPos     = tail;
    msg       += ` 🐍 Snake! –${fall} sq dropped`;
    evt        = "snake";
    floats.push({ text: `🐍 SNAKE BITE! –${fall}`, color: "#ff4444" });
  }

  if (newPos === 100) {
    if (evt === "none") evt = "home";
    msg += ` 🏠 TOKEN HOME! +100 pts`;
    floats.push({ text: "🏠 TOKEN HOME!", color: "#4ade80" });
  }

  return { newPos, msg, evt, floats };
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

  // ── Game state ──────────────────────────────────────────────────────────────
  const [phase,      setPhase]      = useState<"matchmaking" | "playing" | "result">("matchmaking");
  // Player tokens (2)
  const [pPos1,      setPPos1]      = useState(0);
  const [pPos2,      setPPos2]      = useState(0);
  // Bot tokens (2)
  const [bPos1,      setBPos1]      = useState(0);
  const [bPos2,      setBPos2]      = useState(0);
  // Move counters
  const [pMoves,     setPMoves]     = useState(0);
  const [bMoves,     setBMoves]     = useState(0);
  // Dice
  const [dice,       setDice]       = useState(1);
  const [rolling,    setRolling]    = useState(false);
  // After roll — waiting for player to pick which token to move
  const [pendingRoll, setPendingRoll] = useState<number | null>(null);
  // Turn
  const [turn,       setTurn]       = useState<"player" | "bot">("player");
  // UI
  const [logMsg,     setLogMsg]     = useState("🎮 Match started! Good luck!");
  const [evKey,      setEvKey]      = useState(0);
  const [evType,     setEvType]     = useState<EvType>("none");
  const [floaters,   setFloaters]   = useState<Floater[]>([]);
  const [matchTimer, setMatchTimer] = useState(120);

  // ── Derived: Score = sum of token positions (capped at 100 each) ────────────
  const pScore = pPos1 + pPos2;  // positions are already ≤ 100
  const bScore = bPos1 + bPos2;

  // ── Spawn floating text ────────────────────────────────────────────────────
  const spawnFloats = useCallback((list: { text: string; color: string }[]) => {
    list.forEach(({ text, color }) => {
      const id = ++floatId.current;
      const x  = 80 + Math.random() * 240;
      const y  = 200 + Math.random() * 160;
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

  // ── 2-minute countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setMatchTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── End match helper ───────────────────────────────────────────────────────
  const endMatch = useCallback((ps: number, bs: number) => {
    if (scored.current) return;
    scored.current = true;
    setTimeout(() => {
      setPhase("result");
      const won   = ps >= bs;
      const prize = (!isFreeMode && won) ? Math.floor(initialFee * 2 * 0.9) : 0;
      if (!isFreeMode && won) addWinning(prize);
      addMatch({
        gameId: "saanpsidi",
        gameName: isFreeMode ? "Saanp Sidi (Practice)" : "Saanp Sidi",
        gameIcon: "🐍",
        result: won ? "win" : "loss",
        entryFee: initialFee,
        prize,
        userScore: ps,
        opponentScore: bs,
        opponentName: botName.current,
        isGodMode: tier === "god",
      });
      if (won) Sounds.win(); else Sounds.lose();
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreeMode, initialFee, tier]);

  // ── Timer end ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (matchTimer !== 0 || phase !== "playing") return;
    endMatch(pScore, bScore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTimer, phase]);

  // ── Moves-based end condition ──────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (pMoves >= MAX_MOVES && bMoves >= MAX_MOVES) endMatch(pScore, bScore);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pMoves, bMoves, phase]);

  // ── Player: roll dice ─────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || pendingRoll !== null) return;
    if (pMoves >= MAX_MOVES || phase !== "playing") return;
    // Both tokens already home — skip
    if (pPos1 >= 100 && pPos2 >= 100) {
      setPMoves(m => m + 1);
      setTurn("bot");
      return;
    }
    Sounds.diceRoll();
    const val = normalDice();
    setDice(val);
    setRolling(true);
    setTimeout(() => {
      setRolling(false);
      // If only one token is movable, auto-pick it
      const t1movable = pPos1 < 100;
      const t2movable = pPos2 < 100;
      if (t1movable && !t2movable) {
        resolvePlayerMove(val, 1);
      } else if (!t1movable && t2movable) {
        resolvePlayerMove(val, 2);
      } else {
        setPendingRoll(val); // show token picker
      }
    }, 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, turn, pendingRoll, pMoves, pPos1, pPos2, phase]);

  // ── Player: pick which token to move ──────────────────────────────────────
  const resolvePlayerMove = useCallback((roll: number, token: 1 | 2) => {
    setPendingRoll(null);
    const pos = token === 1 ? pPos1 : pPos2;
    const { newPos, msg, evt, floats } = applyMovePure(pos, roll);

    if (token === 1) setPPos1(newPos);
    else             setPPos2(newPos);

    Sounds.tokenMove();
    if (evt === "ladder") Sounds.ladder();
    if (evt === "snake")  Sounds.snake();
    if (evt === "home")   Sounds.tokenHome();

    // Score popup — show new positional score
    const newPScore = token === 1 ? newPos + pPos2 : pPos1 + newPos;
    spawnFloats([...floats, { text: `Score: ${newPScore}`, color: "#11c8a0" }]);
    pushLog(`🟢 You (Token ${token}): ` + msg, evt);
    setPMoves(m => m + 1);
    setTurn("bot");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pPos1, pPos2, spawnFloats, pushLog]);

  const handlePickToken = useCallback((token: 1 | 2) => {
    if (pendingRoll === null) return;
    resolvePlayerMove(pendingRoll, token);
  }, [pendingRoll, resolvePlayerMove]);

  // ── Bot turn ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "bot") return;
    if (bMoves >= MAX_MOVES) { setTurn("player"); return; }
    // Both tokens already home — skip
    if (bPos1 >= 100 && bPos2 >= 100) {
      setBMoves(m => m + 1);
      setTurn("player");
      return;
    }
    const delay = 900 + Math.random() * 700;
    const t = setTimeout(() => {
      const refPos = Math.max(bPos1 < 100 ? bPos1 : 0, bPos2 < 100 ? bPos2 : 0);
      const val    = tier === "god" ? godDice(refPos) : tier === "medium" ? mediumDice(refPos) : normalDice();
      Sounds.diceRoll();
      setDice(val);
      setRolling(true);
      setTimeout(() => {
        setRolling(false);
        const pick = botPickToken(val, bPos1, bPos2, tier);
        const pos  = pick === 1 ? bPos1 : bPos2;
        const { newPos, msg, evt, floats } = applyMovePure(pos, val);

        if (pick === 1) setBPos1(newPos);
        else            setBPos2(newPos);

        Sounds.tokenMove();
        if (evt === "ladder") Sounds.ladder();
        if (evt === "snake")  Sounds.snake();
        if (evt === "home")   Sounds.tokenHome();

        const newBScore = pick === 1 ? newPos + bPos2 : bPos1 + newPos;
        spawnFloats([...floats, { text: `Bot: ${newBScore}`, color: "#f43f5e" }]);
        pushLog(`🔴 ${botName.current} (Token ${pick}): ` + msg, evt);
        setBMoves(m => m + 1);
        setTurn("player");
      }, 800);
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, bMoves, bPos1, bPos2, tier]);

  const canRoll   = turn === "player" && !rolling && pendingRoll === null &&
                    pMoves < MAX_MOVES && phase === "playing";
  const won       = pScore >= bScore;
  const prize     = won && !isFreeMode ? Math.floor(initialFee * 2 * 0.9) : 0;
  const isLeading = pScore >= bScore;
  const evColor   =
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
              ⚡ 2 Tokens Each · {MAX_MOVES} Moves · Score = Positions Sum
            </span>
          </div>
          <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,.38)" }}>
            Move ① or ② · Snake drops score · Ladder boosts score
          </p>
        </div>

        {/* Scoring rules */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,.08)" }}>
          {([
            ["🎯", "Score formula",       "Token①pos + Token②pos"],
            ["🪜", "Climb a ladder",      "Position jumps up ↑"],
            ["🐍", "Snake bite",          "Position drops instantly!"],
            ["🏠", "Token reaches Home",  "100 pts (max per token)"],
            ["🏆", "Max possible score",  "200 pts (both tokens home)"],
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
              <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>
                ①{pPos1} + ②{pPos2}
              </div>
            </div>
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(244,63,94,.1)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1"
                style={{ color: "rgba(244,63,94,.75)" }}>{botName.current.slice(0, 8)}</div>
              <div className="text-4xl font-black" style={{ color: "#f43f5e" }}>{bScore}</div>
              <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,.3)" }}>
                ❶{bPos1} + ❷{bPos2}
              </div>
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

      {/* ── Live Leaderboard ── */}
      <div className="px-3 mb-1 shrink-0">
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "rgba(0,0,0,.6)", border: "1px solid rgba(255,255,255,.08)",
            backdropFilter: "blur(14px)" }}>

          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b"
            style={{ borderColor: "rgba(255,255,255,.06)" }}>
            <span className="text-[9px] font-black uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,.28)" }}>LIVE SCORE</span>
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

          {/* YOU row with 2-token positions */}
          <div className="flex items-center gap-2 px-3 py-1.5"
            style={{
              background: turn === "player" ? "rgba(34,197,94,.1)" : "transparent",
              borderBottom: "1px solid rgba(255,255,255,.04)",
              transition: "background .3s",
            }}>
            {isLeading
              ? <span className="text-sm shrink-0">👑</span>
              : <span className="text-sm shrink-0" style={{ opacity: .3 }}>👤</span>}
            <div className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: "#22c55e", boxShadow: turn === "player" ? "0 0 8px #22c55e" : "none" }} />
            <span className="text-xs font-black text-white">YOU</span>
            {turn === "player" && pendingRoll === null && (
              <motion.span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "#22c55e", color: "#000" }}
                animate={{ opacity: [1, .35, 1] }} transition={{ duration: .55, repeat: Infinity }}>
                TURN
              </motion.span>
            )}
            {pendingRoll !== null && (
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "#FFD700", color: "#000" }}>
                PICK TOKEN
              </span>
            )}
            {/* Token positions */}
            <div className="flex gap-1 ml-1">
              <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: "rgba(34,197,94,.2)", color: "#86efac" }}>
                ①{pPos1 >= 100 ? "🏠" : pPos1}
              </span>
              <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: "rgba(134,239,172,.2)", color: "#86efac" }}>
                ②{pPos2 >= 100 ? "🏠" : pPos2}
              </span>
            </div>
            <span className="text-[8px] font-bold shrink-0 ml-auto" style={{ color: "rgba(255,255,255,.3)" }}>
              {pMoves}/{MAX_MOVES}
            </span>
            <motion.span className="text-xl font-black leading-none w-12 text-right shrink-0"
              key={`ps${pScore}`}
              initial={{ scale: 1.5, color: "#FFD700" }}
              animate={{ scale: 1, color: "#22c55e" }}
              transition={{ duration: .3 }}
              style={{ color: "#22c55e", textShadow: "0 0 8px rgba(34,197,94,.6)" }}>
              {pScore}
            </motion.span>
          </div>

          {/* BOT row with 2-token positions */}
          <div className="flex items-center gap-2 px-3 py-1.5"
            style={{
              background: turn === "bot" ? "rgba(244,63,94,.1)" : "transparent",
              transition: "background .3s",
            }}>
            {!isLeading
              ? <span className="text-sm shrink-0">👑</span>
              : <span className="text-sm shrink-0" style={{ opacity: .3 }}>🤖</span>}
            <div className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: "#f43f5e", boxShadow: turn === "bot" ? "0 0 8px #f43f5e" : "none" }} />
            <span className="text-xs font-black" style={{ color: "rgba(255,255,255,.8)" }}>
              {botName.current}
            </span>
            {turn === "bot" && (
              <motion.span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "#f43f5e", color: "#fff" }}
                animate={{ opacity: [1, .35, 1] }} transition={{ duration: .55, repeat: Infinity }}>
                TURN
              </motion.span>
            )}
            {/* Bot token positions */}
            <div className="flex gap-1 ml-1">
              <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: "rgba(244,63,94,.2)", color: "#fb7185" }}>
                ❶{bPos1 >= 100 ? "🏠" : bPos1}
              </span>
              <span className="text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: "rgba(251,113,133,.2)", color: "#fb7185" }}>
                ❷{bPos2 >= 100 ? "🏠" : bPos2}
              </span>
            </div>
            <span className="text-[8px] font-bold shrink-0 ml-auto" style={{ color: "rgba(255,255,255,.3)" }}>
              {bMoves}/{MAX_MOVES}
            </span>
            <motion.span className="text-xl font-black leading-none w-12 text-right shrink-0"
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
      <div className="px-2 shrink-0" style={{ width: "100%", paddingBottom: "calc(100% - 16px)", position: "relative" }}>
        <div style={{ position: "absolute", inset: "0 8px 0 8px" }}>
          <Board
            pPos1={pPos1} pPos2={pPos2} bPos1={bPos1} bPos2={bPos2}
            turn={turn}
          />
        </div>
      </div>

      {/* ── Event log ── */}
      <div className="mx-3 mb-1 shrink-0 min-h-[28px] flex items-center">
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
            <span className="text-[8px] font-bold" style={{ color: "rgba(34,197,94,.7)" }}>{pMoves}/{MAX_MOVES}</span>
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
            <span className="text-[8px] font-bold" style={{ color: "rgba(244,63,94,.7)" }}>{bMoves}/{MAX_MOVES}</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,.08)" }}>
            <motion.div className="h-full rounded-full"
              animate={{ width: `${(bMoves / MAX_MOVES) * 100}%` }}
              style={{ background: "linear-gradient(90deg,#f43f5e,#fb7185)" }}
              transition={{ duration: .35 }} />
          </div>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-col items-center gap-2 pb-5 pt-1 shrink-0">
        {/* Token picker (shown after dice rolled, before token selected) */}
        <AnimatePresence>
          {pendingRoll !== null && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: .95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: .95 }}
              transition={{ duration: .22 }}
              className="w-full px-4"
            >
              <div className="rounded-2xl overflow-hidden"
                style={{ background: "rgba(255,215,0,.08)", border: "1px solid rgba(255,215,0,.3)" }}>
                <div className="px-4 py-2 text-center border-b" style={{ borderColor: "rgba(255,215,0,.15)" }}>
                  <span className="text-sm font-black" style={{ color: "#FFD700" }}>
                    Rolled {pendingRoll} — Pick a token to move
                  </span>
                </div>
                <div className="flex gap-2 p-3">
                  {/* Token 1 button */}
                  <motion.button
                    whileTap={{ scale: .94 }}
                    disabled={pPos1 >= 100}
                    onClick={() => handlePickToken(1)}
                    className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                    style={{
                      background: pPos1 >= 100
                        ? "rgba(255,255,255,.05)"
                        : "rgba(34,197,94,.18)",
                      border: `1.5px solid ${pPos1 >= 100 ? "rgba(255,255,255,.1)" : "rgba(34,197,94,.5)"}`,
                      color: pPos1 >= 100 ? "rgba(255,255,255,.3)" : "#22c55e",
                      opacity: pPos1 >= 100 ? 0.5 : 1,
                    }}>
                    <div className="text-lg">①</div>
                    <div className="text-[10px] mt-0.5">
                      {pPos1 >= 100 ? "HOME" : `sq.${pPos1} → ${Math.min(pPos1 + pendingRoll, 100)}`}
                    </div>
                  </motion.button>
                  {/* Token 2 button */}
                  <motion.button
                    whileTap={{ scale: .94 }}
                    disabled={pPos2 >= 100}
                    onClick={() => handlePickToken(2)}
                    className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                    style={{
                      background: pPos2 >= 100
                        ? "rgba(255,255,255,.05)"
                        : "rgba(134,239,172,.18)",
                      border: `1.5px solid ${pPos2 >= 100 ? "rgba(255,255,255,.1)" : "rgba(134,239,172,.5)"}`,
                      color: pPos2 >= 100 ? "rgba(255,255,255,.3)" : "#86efac",
                      opacity: pPos2 >= 100 ? 0.5 : 1,
                    }}>
                    <div className="text-lg">②</div>
                    <div className="text-[10px] mt-0.5">
                      {pPos2 >= 100 ? "HOME" : `sq.${pPos2} → ${Math.min(pPos2 + pendingRoll, 100)}`}
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dice — hidden while token picker is active */}
        {pendingRoll === null && (
          <>
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
          </>
        )}
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
            className="fixed left-1/2 bottom-32 pointer-events-none text-5xl z-50"
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
            className="fixed left-1/2 bottom-32 pointer-events-none text-5xl z-50"
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
            className="fixed left-1/2 bottom-32 pointer-events-none text-5xl z-50"
            style={{ transform: "translateX(-50%)" }}>
            🏠
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
