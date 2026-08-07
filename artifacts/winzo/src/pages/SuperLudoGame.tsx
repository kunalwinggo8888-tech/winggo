/**
 * SuperLudoGame – WINGGO Super Ludo
 * 2D canvas Ludo board (ported from the original WINGGO canvas Ludo board)
 * with the app's money-match flow:
 *   – Entry fee is deducted by GameEntrySheet before mounting
 *   – 8s real-player wait → bot auto-joins
 *   – 2-min match timer on top; below it "Your Score" & "Opponent Score"
 *   – Player (BLUE) & Bot (GREEN) each have their own dice near their home base
 *   – All 4 gotis start on the board; any dice 1–6 moves a goti
 *   – Winner gets wallet credit, match result saved to Firestore + local history
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";
import { getRandomBot, type BotPlayer } from "@/data/botDatabase";
import { saveLudoMatchResult } from "@/firebase/firestore.service";
import { useAuth } from "@/context/useAuth";
import {
  PLAYER, BOT, PLAYER_PATHS, FINAL_PATHS, SAFE_CELLS, START_CELLS,
  CELL, BOARD_SIZE, gridToCanvas, getTokenCanvasPos, drawSuperLudoBoard, drawSuperLudoTokens,
} from "./SuperLudoBoard";
import type { PlayerId } from "./SuperLudoBoard";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const HOME_SCORE = 25;
const KILL_BONUS = 15;
const EMOTES     = ["😂","👍","😤","🔥","🎉","💪","😱","🤙","👑","😎"];

// Pink/purple gradient backdrop (replaces the dark background)
const GRAD_BG = "linear-gradient(160deg,#3b0764 0%,#6d28d9 45%,#be185d 100%)";
const PLAYER_COLOR = "#3b82f6";   // blue
const BOT_COLOR    = "#22c55e";   // green

// ─── SOUND ENGINE (Web Audio API) ─────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
function getACtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  } catch { return null; }
}

const Sounds = {
  roll() {
    try {
      const c = getACtx(); if (!c) return;
      const len = Math.ceil(c.sampleRate * 0.25);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = c.createBufferSource(); src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 0.5;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.45, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      src.start();
    } catch {}
  },
  hop() {
    try {
      const c = getACtx(); if (!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(400, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.1);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + 0.1);
    } catch {}
  },
  capture() {
    try {
      const c = getACtx(); if (!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(800, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, c.currentTime);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + 0.3);
    } catch {}
  },
  win() {
    try {
      const c = getACtx(); if (!c) return;
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
        const osc = c.createOscillator(); const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.22);
      });
    } catch {}
  },
  lose() {
    try {
      const c = getACtx(); if (!c) return;
      [392, 349, 330, 262].forEach((f, i) => {
        const osc = c.createOscillator(); const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.24);
      });
    } catch {}
  },
};

// ─── CONFETTI ──────────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    emoji: ["🎉","🏆","⭐","✨","🎊","💛","🎈","🥇"][i % 8],
    x: 5 + Math.random() * 90,
    delay: Math.random() * 0.8,
    dur: 2.2 + Math.random() * 1.8,
    rot: Math.random() * 360,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 60 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          style={{ position: "absolute", top: -40, left: `${p.x}%`, fontSize: 22, rotate: p.rot }}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: "110vh", opacity: [1, 1, 0.3, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}>
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ─── DICE ─────────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]],
};

function Dice3D({ value, rolling, onClick, disabled, playerColor = "#eab308", size = 56 }: {
  value: number; rolling: boolean; onClick: () => void; disabled: boolean; playerColor?: string; size?: number;
}) {
  const sz = size;
  const dots = PIPS[value] ?? PIPS[1];
  return (
    <motion.div
      onClick={!disabled ? onClick : undefined}
      whileTap={!disabled ? { scale: 0.85, rotateZ: 5 } : {}}
      style={{ cursor: disabled ? "not-allowed" : "pointer", userSelect: "none", flexShrink: 0 }}
      animate={rolling
        ? {
            rotateX: [0, 180, 360, 540, 720, 900, 1080, 1260, 1440],
            rotateY: [0, 90, -90, 180, -180, 270, -270, 360, 360],
            rotateZ: [0, 18, -14, 24, -18, 12, -8, 4, 0],
            scale: [1, 1.32, 0.92, 1.26, 0.95, 1.18, 0.98, 1.06, 1],
            y: [0, -22, 14, -18, 10, -12, 6, -3, 0],
          }
        : { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, y: 0 }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        animate={rolling || !disabled ? { opacity: 1 } : { opacity: 0.45 }}
        transition={{ duration: 0.25 }}
        style={{
          width: sz, height: sz,
          borderRadius: Math.max(10, sz * 0.22),
          background: "linear-gradient(145deg, #ffffff 0%, #eef2f7 48%, #ffffff 100%)",
          border: "2.5px solid rgba(15,23,42,0.92)",
          boxShadow: rolling
            ? "0 20px 42px rgba(0,0,0,0.55), inset 0 -6px 12px rgba(203,213,225,0.6), inset 0 6px 10px #ffffff, 0 0 26px rgba(255,255,255,0.4)"
            : disabled
            ? "0 4px 10px rgba(0,0,0,0.28), inset 0 -3px 6px rgba(203,213,225,0.5), inset 0 3px 6px #ffffff"
            : "0 8px 18px rgba(0,0,0,0.35), inset 0 -5px 9px rgba(203,213,225,0.55), inset 0 5px 8px #ffffff",
          transition: "box-shadow 0.25s",
        }}
      >
        <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ display: "block" }}>
          <rect x={4} y={4} width={92} height={92} rx={16}
            fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
          {dots.map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx + 1.5} cy={cy + 2} r={9} fill="rgba(15,23,42,0.25)" />
              <circle cx={cx} cy={cy} r={9} fill="#0f172a" />
              <circle cx={cx - 3} cy={cy - 3} r={3} fill="rgba(255,255,255,0.4)" />
            </g>
          ))}
        </svg>
      </motion.div>
    </motion.div>
  );
}

// ─── BOT AI ────────────────────────────────────────────────────────────────────

type BotTier = "easy" | "medium" | "god";

function chooseBotMove(bTokens: number[], pTokens: number[], value: number): number {
  const valid: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = bTokens[i];
    if (p < 51) { if (p + value <= 56) valid.push(i); }
    else if (p >= 51 && p < 56) { if (p + value <= 56) valid.push(i); }
  }
  if (valid.length === 0) return -1;

  let best = valid[0], bestScore = -1000;
  valid.forEach(i => {
    let score = 0;
    const pos = bTokens[i];
    const newPos = pos + value;
    if (newPos === 56) score += 100;
    if (newPos >= 0 && newPos < 51) {
      const gp = PLAYER_PATHS[BOT][newPos];
      for (let j = 0; j < 4; j++) {
        const o = pTokens[j];
        if (o >= 0 && o < 51) {
          const og = PLAYER_PATHS[PLAYER][o];
          if (gp[0] === og[0] && gp[1] === og[1]) score += 50;
        }
      }
      if (SAFE_CELLS.includes(newPos)) score += 10;
    }
    score += newPos;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

type Phase = "matchmaking" | "playing" | "result";

interface Props { onBack: () => void; initialFee?: number }

export default function SuperLudoGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();
  const { user }       = useAuth();

  const isFreeMode = initialFee === 0;
  const tier: BotTier = isFreeMode || initialFee < 5 ? "easy" : initialFee < 20 ? "medium" : "god";

  const botRef  = useRef<BotPlayer>(getRandomBot());
  const scored  = useRef(false);
  const sounded = useRef(false);
  const matchStartTime = useRef(Date.now());
  const playerKills = useRef(0);
  const botKills = useRef(0);
  const moveBusy = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const tokensRef = useRef<Record<PlayerId, number[]>>({
    [PLAYER]: [0, 0, 0, 0],
    [BOT]:    [0, 0, 0, 0],
  });
  const screenPosRef = useRef<Record<PlayerId, { x: number; y: number }[]>>({
    [PLAYER]: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
    [BOT]:    [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }],
  });
  const currentPlayerRef = useRef<PlayerId>(PLAYER);
  const lastRollRef = useRef(0);
  const highlightedRef = useRef<number[]>([]);
  const validMovesRef = useRef<number[]>([]);
  const renderStateRef = useRef({
    phase: "matchmaking" as Phase,
    turn: "player" as "player" | "bot",
    rolling: false,
    validToks: [] as number[],
    pTokens: [0, 0, 0, 0] as number[],
    bTokens: [0, 0, 0, 0] as number[],
    emote: "",
    matchTimer: 120,
  });

  const [pTokens, setPTokens] = useState([0, 0, 0, 0]);
  const [bTokens, setBTokens] = useState([0, 0, 0, 0]);
  const [pScore, setPScore] = useState(0);
  const [bScore, setBScore] = useState(0);
  const [pMoves, setPMoves] = useState(0);
  const [bMoves, setBMoves] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState<"player" | "bot">("player");
  const [validToks, setValidToks] = useState<number[]>([]);
  const [logMsgs, setLogMsgs] = useState<string[]>(["🎮 Match started! Roll to move!"]);
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [mmStage, setMmStage] = useState<"searching" | "found">("searching");
  const [emote, setEmote] = useState("");
  const [killFlash, setKillFlash] = useState(false);
  const [turnTimer, setTurnTimer] = useState(15);
  const [matchTimer, setMatchTimer] = useState(120);
  const forfeitedRef = useRef(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeitCountdown, setForfeitCountdown] = useState(0);

  // ── Board geometry (for dice/profile overlays anchored to the home bases) ──
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const [boardBox, setBoardBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (phase !== "playing") return;
    const el = boardWrapRef.current;
    if (!el) return;
    const update = () => setBoardBox({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [phase]);

  const pushLog = (msg: string) => setLogMsgs(prev => [msg, ...prev.slice(0, 5)]);
  const flashKill = () => { setKillFlash(true); setTimeout(() => setKillFlash(false), 600); };

  // ── Canvas board: setup, render loop, and click-to-move ────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    // Seed token screen positions from the current game state
    ([PLAYER, BOT] as PlayerId[]).forEach(player => {
      const arr = tokensRef.current[player] ?? [0, 0, 0, 0];
      screenPosRef.current[player] = arr.map((pos, idx) => getTokenCanvasPos(player, idx, pos));
    });
    // Spread the 4 starting gotis around each start square
    distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], 0, PLAYER);
    distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], 0, BOT);

    const parent = canvas.parentElement as HTMLElement | null;
    const measure = () => {
      const W = Math.max(parent?.clientWidth || 320, 280);
      const H = Math.max(parent?.clientHeight || 360, 300);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { W, H };
    };

    let size = measure();
    let raf = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const st = renderStateRef.current;
      ctx.clearRect(0, 0, size.W, size.H);
      // Fill the empty space around the board with the purple/pink gradient
      // (no dark/black background anywhere on the playing screen).
      const grad = ctx.createLinearGradient(0, 0, size.W, size.H);
      grad.addColorStop(0, "#3b0764");
      grad.addColorStop(0.5, "#6d28d9");
      grad.addColorStop(1, "#be185d");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size.W, size.H);
      const boardSize = Math.min(size.W, size.H);
      const offX = (size.W - boardSize) / 2;
      const offY = (size.H - boardSize) / 2;
      ctx.save();
      ctx.translate(offX, offY);
      drawSuperLudoBoard(ctx, boardSize);
      drawSuperLudoTokens(
        ctx,
        boardSize,
        screenPosRef.current,
        st.validToks,
        st.turn === "player" ? PLAYER : BOT,
        now / 1000,
      );
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);

    const onClick = (ev: { clientX: number; clientY: number }) => {
      const st = renderStateRef.current;
      if (st.phase !== "playing" || st.turn !== "player" || st.rolling || moveBusy.current) return;
      if (!st.validToks || st.validToks.length === 0) return;
      const rect = canvas.getBoundingClientRect();
      const boardSize = Math.min(rect.width, rect.height);
      if (boardSize <= 0) return;
      const offX = (rect.width - boardSize) / 2;
      const offY = (rect.height - boardSize) / 2;
      const px = (ev.clientX - rect.left - offX) * (BOARD_SIZE / boardSize);
      const py = (ev.clientY - rect.top - offY) * (BOARD_SIZE / boardSize);
      const arr = screenPosRef.current[PLAYER];
      for (const i of st.validToks) {
        const p = arr[i];
        if (p && Math.hypot(px - p.x, py - p.y) <= CELL * 0.6) {
          movePlayerToken(i, lastRollRef.current);
          return;
        }
      }
    };
    const onTouch = (ev: TouchEvent) => {
      if (ev.touches.length === 0) return;
      const t = ev.touches[0];
      onClick({ clientX: t.clientX, clientY: t.clientY });
    };

    const onResize = () => { size = measure(); };
    window.addEventListener("resize", onResize);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("touchend", onTouch, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("touchend", onTouch);
      ctxRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── Matchmaking: 8s real-player wait → bot auto-joins ──────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    matchStartTime.current = Date.now();
    const t1 = setTimeout(() => setMmStage("found"), 7500);
    const t2 = setTimeout(() => setPhase("playing"), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── 2-min match countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setMatchTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Timer end → result ──────────────────────────────────────────────────────
  useEffect(() => {
    if (matchTimer !== 0 || phase !== "playing" || scored.current || forfeitedRef.current) return;
    scored.current = true;
    setPhase("result");
    finishMatch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTimer, phase]);

  // ── Forfeit: 10s countdown → auto-loser (exit guard) ───────────────────────
  useEffect(() => {
    if (!forfeitOpen || forfeitedRef.current) return;
    if (forfeitCountdown <= 0) { confirmForfeit(); return; }
    const t = setTimeout(() => setForfeitCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forfeitOpen, forfeitCountdown]);

  // ── Win/lose sound on result ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "result" || sounded.current) return;
    sounded.current = true;
    const won = pScore > bScore;
    setTimeout(() => { if (won) Sounds.win(); else Sounds.lose(); }, 300);
  }, [phase, pScore, bScore]);

  // ── Turn timer (player) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (turn === "player") setTurnTimer(15);
  }, [turn, phase]);

  useEffect(() => {
    if (phase !== "playing" || turn !== "player" || rolling || turnTimer <= 0) return;
    const id = setInterval(() => setTurnTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, turn, rolling, turnTimer]);

  // ── Auto-act on player turn timer = 0 ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "player" || turnTimer !== 0 || rolling || moveBusy.current || scored.current) return;
    if (validMovesRef.current.length > 0) {
      const best = validMovesRef.current.reduce((a, b) => (tokensRef.current[PLAYER][a] > tokensRef.current[PLAYER][b] ? a : b));
      pushLog(`⏱️ Time's up! Auto-picking token ${best + 1}…`);
      movePlayerToken(best, lastRollRef.current);
      return;
    }
    pushLog("⏱️ Auto-roll!");
    const val = Math.ceil(Math.random() * 6);
    lastRollRef.current = val;
    setDice(val);
    setRolling(true);
    Sounds.roll();
    setTimeout(() => {
      setRolling(false);
      const valid = pTokens.map((s, ti) => ({ s, ti })).filter(({ s }) => (s < 51 ? s + val <= 56 : s >= 51 && s + val <= 56)).map(({ ti }) => ti);
      if (valid.length === 0) {
        pushLog(`Auto-roll ${val} — no valid move. Skipped!`);
        setTurn("bot");
        return;
      }
      const best = valid.reduce((a, b) => (tokensRef.current[PLAYER][a] > tokensRef.current[PLAYER][b] ? a : b));
      setTimeout(() => movePlayerToken(best, val), 200);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimer, phase, turn]);

  // ── Bot AI turn ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (turn !== "bot" || phase !== "playing" || rolling || moveBusy.current || scored.current) return;
    const delay = tier === "god" ? 700 : tier === "medium" ? 1000 : 1300;

    const t = setTimeout(() => {
      const val = rollDiceVal(tier === "god");
      lastRollRef.current = val;
      setDice(val);
      setRolling(true);
      Sounds.roll();

      setTimeout(() => {
        setRolling(false);
        const chosen = chooseBotMove([...tokensRef.current[BOT]], [...tokensRef.current[PLAYER]], val);

        if (chosen === -1) {
          pushLog(`🔵 ${botRef.current.name} rolled ${val} — no valid move. Skip!`);
          setBMoves(m => m + 1);
          setTurn("player");
          return;
        }
        moveBotToken(chosen, val);
      }, 700);
    }, delay);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, rolling]);

  // ── Roll dice value (god mode weighted) ─────────────────────────────────────
  function rollDiceVal(godMode: boolean): number {
    if (godMode) {
      const r = Math.random();
      if (r < 0.28) return 6;
      if (r < 0.50) return 5;
      if (r < 0.70) return 4;
      if (r < 0.85) return 3;
      if (r < 0.95) return 2;
      return 1;
    }
    return Math.ceil(Math.random() * 6);
  }

  // ── Player roll ─────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || moveBusy.current || scored.current) return;
    if (validToks.length > 0) return;
    const val = rollDiceVal(false);
    lastRollRef.current = val;
    setDice(val);
    setRolling(true);
    Sounds.roll();

    setTimeout(() => {
      setRolling(false);
      const valid = pTokens.map((s, ti) => ({ s, ti })).filter(({ s }) => (s < 51 ? s + val <= 56 : s >= 51 && s + val <= 56)).map(({ ti }) => ti);

      if (valid.length === 0) {
        pushLog(`Rolled ${val} — no valid move. Turn skipped!`);
        setPMoves(m => m + 1);
        setTurn("bot");
        return;
      }
      if (valid.length === 1) {
        setTimeout(() => movePlayerToken(valid[0], val), 200);
        return;
      }
      validMovesRef.current = valid;
      setValidToks(valid);
      pushLog(`Rolled ${val} — tap a token on the board!`);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, turn, pTokens, validToks]);

  // ── Canvas token helpers ────────────────────────────────────────────────────

  function animateTokenMove(player: PlayerId, ti: number, oldStep: number, newStep: number, cb: () => void) {
    const steps: number[] = [];
    if (oldStep === -1) steps.push(0);
    else for (let p = oldStep + 1; p <= newStep; p++) steps.push(p);
    const dur = 150, pause = 50;
    let i = 0;

    const next = () => {
      if (i >= steps.length) { cb(); return; }
      Sounds.hop();
      const from = { ...screenPosRef.current[player][ti] };
      const to = getTokenCanvasPos(player, ti, steps[i]);
      const t0 = performance.now();
      const hop = (now: number) => {
        const t = Math.min((now - t0) / dur, 1);
        const e = 1 - Math.pow(1 - t, 3);
        screenPosRef.current[player][ti] = {
          x: from.x + (to.x - from.x) * e,
          y: from.y + (to.y - from.y) * e,
        };
        if (t < 1) requestAnimationFrame(hop);
        else { i++; setTimeout(next, pause); }
      };
      requestAnimationFrame(hop);
    };
    next();
  }

  function distributeTokensCanvas(tokens: Record<PlayerId, number[]>, players: PlayerId[], pos: number, fromPlayer: PlayerId) {
    let targetGrid: [number, number] | null = null;
    if (pos === 56) return;
    if (pos >= 51 && pos < 56) targetGrid = FINAL_PATHS[fromPlayer][pos - 51];
    else if (pos >= 0 && pos < 51) targetGrid = PLAYER_PATHS[fromPlayer][pos];
    else return;
    if (!targetGrid) return;

    const onCell: { player: PlayerId; index: number; gridPos: [number, number] }[] = [];
    players.forEach(p => {
      tokens[p].forEach((tPos, idx) => {
        if (tPos < 0) return;
        let gp: [number, number] | null = null;
        if (tPos === 56) gp = [7, 7];
        else if (tPos >= 51 && tPos < 56) gp = FINAL_PATHS[p][tPos - 51];
        else if (tPos >= 0 && tPos < 51) gp = PLAYER_PATHS[p][tPos];
        else return;
        if (gp && gp[0] === targetGrid![0] && gp[1] === targetGrid![1]) onCell.push({ player: p, index: idx, gridPos: gp });
      });
    });

    const spacing = 12;
    const count = onCell.length;
    onCell.forEach((tok, i) => {
      const base = gridToCanvas(tok.gridPos[0], tok.gridPos[1]);
      let ox = 0, oy = 0;
      if (count === 1) { /* centered */ }
      else if (count === 2) ox = (i - 0.5) * spacing;
      else if (count === 3) {
        if (i === 0) { ox = -spacing * 0.7; oy = -spacing * 0.4; }
        else if (i === 1) { ox = spacing * 0.7; oy = -spacing * 0.4; }
        else { oy = spacing * 0.6; }
      } else if (count >= 4) {
        ox = (i % 2 === 0 ? -1 : 1) * spacing * 0.5;
        oy = (Math.floor(i / 2) % 2 === 0 ? -1 : 1) * spacing * 0.5;
      }
      screenPosRef.current[tok.player][tok.index] = { x: base.x + ox, y: base.y + oy };
    });
  }

  // ── Move player token ───────────────────────────────────────────────────────
  function movePlayerToken(ti: number, diceVal: number) {
    setValidToks([]);
    validMovesRef.current = [];
    highlightedRef.current = [];
    moveBusy.current = true;

    const oldStep = tokensRef.current[PLAYER][ti];
    let ns = oldStep === -1 ? 0 : oldStep + diceVal;
    if (ns > 56) ns = oldStep; // can't happen with <= check, safety

    tokensRef.current[PLAYER][ti] = ns;
    setPTokens(prev => { const np = [...prev]; np[ti] = ns; return np; });

    let killed = false;
    let killPts = 0;
    const nPos = ns >= 0 && ns < 51 ? PLAYER_PATHS[PLAYER][ns] : null;

    animateTokenMove(PLAYER, ti, oldStep, ns, () => {
      if (nPos) {
        const botArr = tokensRef.current[BOT];
        for (let i = 0; i < botArr.length; i++) {
          const oPos = botArr[i];
          if (oPos >= 0 && oPos < 51) {
            const og = PLAYER_PATHS[BOT][oPos];
            if (og[0] === nPos[0] && og[1] === nPos[1] && !SAFE_CELLS.includes(ns) && ns !== START_CELLS[PLAYER]) {
              killPts = oPos;
              botArr[i] = 0;
              const sg = PLAYER_PATHS[BOT][0];
              screenPosRef.current[BOT][i] = gridToCanvas(sg[0], sg[1]);
              killed = true;
              playerKills.current++;
              Sounds.capture();
              flashKill();
              setEmote("💥");
              setTimeout(() => setEmote(""), 1200);
              pushLog(`💥 KILL! ${botRef.current.name}'s goti sent back to start! +${KILL_BONUS} pts`);
              setBScore(s => Math.max(0, s - killPts));
            }
          }
        }
        setBTokens([...botArr]);
      }

      const moved = oldStep === -1 ? 6 : ns - oldStep;
      let pts = moved + (killed ? KILL_BONUS : 0);
      if (ns >= 56) {
        pts += HOME_SCORE;
        pushLog(`🏠 Goti ${ti + 1} HOME! +${moved + HOME_SCORE}${killed ? `+${KILL_BONUS}` : ""} pts! 🎉`);
      } else if (!killed) {
        pushLog(`Rolled ${diceVal} → +${moved} pts${diceVal === 6 ? " 🎲 EXTRA TURN!" : ""}`);
      }

      setPScore(s => s + pts);
      setPMoves(m => m + 1);
      moveBusy.current = false;

      // redistribute stack
      if (oldStep >= 0) distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], oldStep, PLAYER);
      distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], ns, PLAYER);
      if (killed) distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], 0, BOT);

      if (ns >= 56 && tokensRef.current[PLAYER].every(t => t === 56)) {
        setPhase("result");
        finishMatch();
        return;
      }

      const getExtra = diceVal === 6 || killed;
      if (!getExtra) setTurn("bot");
    });
  }

  // ── Move bot token ──────────────────────────────────────────────────────────
  function moveBotToken(ti: number, diceVal: number) {
    moveBusy.current = true;

    const oldStep = tokensRef.current[BOT][ti];
    let ns = oldStep === -1 ? 0 : oldStep + diceVal;
    if (ns > 56) ns = oldStep;

    tokensRef.current[BOT][ti] = ns;
    setBTokens(prev => { const nb = [...prev]; nb[ti] = ns; return nb; });

    let killed = false;
    let killPts = 0;
    const nPos = ns >= 0 && ns < 51 ? PLAYER_PATHS[BOT][ns] : null;

    animateTokenMove(BOT, ti, oldStep, ns, () => {
      if (nPos) {
        const pArr = tokensRef.current[PLAYER];
        for (let i = 0; i < pArr.length; i++) {
          const oPos = pArr[i];
          if (oPos >= 0 && oPos < 51) {
            const og = PLAYER_PATHS[PLAYER][oPos];
            if (og[0] === nPos[0] && og[1] === nPos[1] && !SAFE_CELLS.includes(ns) && ns !== START_CELLS[BOT]) {
              killPts = oPos;
              pArr[i] = 0;
              const sg = PLAYER_PATHS[PLAYER][0];
              screenPosRef.current[PLAYER][i] = gridToCanvas(sg[0], sg[1]);
              killed = true;
              botKills.current++;
              Sounds.capture();
              flashKill();
              setEmote(EMOTES[Math.floor(Math.random() * EMOTES.length)]);
              setTimeout(() => setEmote(""), 1200);
              pushLog(`💀 ${botRef.current.name} killed your goti! Sent back to start! +${KILL_BONUS} | You -${killPts} pts`);
              setPScore(s => Math.max(0, s - killPts));
            }
          }
        }
        setPTokens([...pArr]);
      }

      const moved = oldStep === -1 ? 6 : ns - oldStep;
      let pts = moved + (killed ? KILL_BONUS : 0);
      if (ns >= 56) {
        pts += HOME_SCORE;
        pushLog(`🔵 ${botRef.current.name} goti HOME! +${moved + HOME_SCORE} pts 🎉`);
      } else if (!killed) {
        pushLog(`🔵 ${botRef.current.name} rolled ${diceVal} → +${pts} pts`);
      }

      setBScore(s => s + pts);
      setBMoves(m => m + 1);
      moveBusy.current = false;

      if (oldStep >= 0) distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], oldStep, BOT);
      distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], ns, BOT);
      if (killed) distributeTokensCanvas(tokensRef.current, [PLAYER, BOT], 0, PLAYER);

      if (ns >= 56 && tokensRef.current[BOT].every(t => t === 56)) {
        setPhase("result");
        finishMatch();
        return;
      }

      const getExtra = diceVal === 6 || killed;
      if (!getExtra) setTurn("player");
    });
  }

  // ── Finish match: credit wallet + save result + history ────────────────────
  function finishMatch() {
    if (forfeitedRef.current) return;
    const won = pScore > bScore;
    const prize = (!isFreeMode && won) ? Math.floor(initialFee * 2 * 0.9) : 0;
    const duration = Math.floor((Date.now() - matchStartTime.current) / 1000);

    if (user?.uid) {
      saveLudoMatchResult({
        uid: user.uid,
        opponentName: botRef.current.name,
        opponentIsBot: true,
        playerScore: pScore,
        opponentScore: bScore,
        won,
        entryFee: initialFee,
        prizeAmount: prize,
        tier,
        duration,
        moves: pMoves,
        kills: playerKills.current,
        forfeited: false,
      }).catch(console.error);
    }

    if (!isFreeMode && won) {
      addWinning(prize, "Super Ludo Win");
    }

    addMatch({
      gameId: "superludo",
      gameName: isFreeMode ? "Super Ludo (Practice)" : "Super Ludo",
      gameIcon: "🎲",
      result: won ? "win" : "loss",
      entryFee: initialFee,
      prize,
      userScore: pScore,
      opponentScore: bScore,
      opponentName: botRef.current.name,
    });
  }

  const canRoll = turn === "player" && !rolling && !moveBusy.current && validToks.length === 0 && pMoves < 100 && phase === "playing";

  // ── Forfeit / exit: 10s countdown → auto-loser ──────────────────────────────
  function openForfeit() {
    if (phase !== "playing" || forfeitedRef.current) return;
    setForfeitCountdown(10);
    setForfeitOpen(true);
  }

  function cancelForfeit() {
    setForfeitOpen(false);
    setForfeitCountdown(0);
  }

  function confirmForfeit() {
    if (forfeitedRef.current) return;
    forfeitedRef.current = true;
    setForfeitOpen(false);
    setForfeitCountdown(0);

    const duration = Math.floor((Date.now() - matchStartTime.current) / 1000);

    // Record the forfeited loss in Firestore (auto-loser)
    if (user?.uid) {
      saveLudoMatchResult({
        uid: user.uid,
        opponentName: botRef.current.name,
        opponentIsBot: true,
        playerScore: pScore,
        opponentScore: bScore,
        won: false,
        entryFee: initialFee,
        prizeAmount: 0,
        tier,
        duration,
        moves: pMoves,
        kills: playerKills.current,
        forfeited: true,
      }).catch(console.error);
    }

    // Entry fee is lost — no wallet credit on forfeit
    addMatch({
      gameId: "superludo",
      gameName: isFreeMode ? "Super Ludo (Practice)" : "Super Ludo",
      gameIcon: "🎲",
      result: "loss",
      entryFee: initialFee,
      prize: 0,
      userScore: pScore,
      opponentScore: bScore,
      opponentName: botRef.current.name,
    });

    pushLog("🚪 You forfeited the match.");
    setPhase("result");
  }

  const prize = (!isFreeMode && pScore > bScore) ? Math.floor(initialFee * 2 * 0.9) : 0;

  // Keep the render loop up-to-date with the latest React state
  renderStateRef.current = { phase, turn, rolling, validToks, pTokens, bTokens, emote, matchTimer };

  // ─── MATCHMAKING SCREEN ─────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";
    const tierLabel = tier === "god" ? "⚡ GOD MODE" : tier === "medium" ? "🔶 MEDIUM" : "🟢 EASY";
    const prizeAmt = isFreeMode ? null : Math.floor(initialFee * 2 * 0.9);

    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-5"
        style={{ background: GRAD_BG, maxWidth: 480, margin: "0 auto" }}>

        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-10 text-center">
          <p className="text-[10px] font-black tracking-[0.25em] mb-2.5" style={{ color: "rgba(147,51,234,0.6)" }}>
            {mmStage === "searching" ? "SUPER LUDO · SEARCHING…" : "SUPER LUDO · MATCH FOUND"}
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
            {prizeAmt !== null && (
              <span className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
                🏆 Win ₹{prizeAmt}
              </span>
            )}
          </div>
        </motion.div>

        <div className="w-full flex items-center justify-center gap-3 mb-10">
          {/* YOU */}
          <motion.div initial={{ opacity: 0, x: -48 }} animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.1 }}
            className="flex flex-col items-center gap-3 flex-1">
            <div className="relative">
              <motion.div className="absolute rounded-full pointer-events-none"
                style={{ inset: -7, border: `2.5px solid ${PLAYER_COLOR}`, borderRadius: "50%" }}
                animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.2, 0.75] }}
                transition={{ duration: 1.9, repeat: Infinity }} />
              <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-3xl"
                style={{ background: `linear-gradient(135deg,${PLAYER_COLOR} 0%,#1e3a8a 100%)`, border: `3.5px solid ${PLAYER_COLOR}`, boxShadow: `0 0 28px ${PLAYER_COLOR}88,0 0 56px ${PLAYER_COLOR}33` }}>
                🎲
              </div>
              <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: "#22c55e", border: "2.5px solid #1e1038" }} />
            </div>
            <div className="text-center">
              <div className="font-black text-white text-base leading-tight">YOU</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: `${PLAYER_COLOR}e0` }}>🔵 Blue</div>
            </div>
          </motion.div>

          {/* VS */}
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.28 }}
            className="shrink-0 flex flex-col items-center gap-1">
            <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center font-black text-lg"
              style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", boxShadow: "0 0 22px rgba(168,85,247,0.65),0 0 44px rgba(168,85,247,0.25)", color: "#fff", letterSpacing: "-0.02em" }}>
              VS
            </div>
            <div className="w-px h-6" style={{ background: "linear-gradient(to bottom,rgba(168,85,247,0.5),transparent)" }} />
          </motion.div>

          {/* OPPONENT */}
          <AnimatePresence mode="wait">
            {mmStage === "searching" ? (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <motion.div className="w-[88px] h-[88px] rounded-full flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,0.07)", border: "2px dashed rgba(59,130,246,0.3)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <motion.span style={{ fontSize: 34 }} animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}>
                      🔍
                    </motion.span>
                  </motion.div>
                </div>
                <div className="text-center">
                  <div className="font-black text-white text-sm">Finding Players</div>
                  <motion.div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(59,130,246,0.6)" }}
                    animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity }}>
                    Bot joins in 8s if none found…
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="found" initial={{ opacity: 0, x: 48, scale: 0.85 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }} className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <motion.div className="absolute rounded-full pointer-events-none"
                    style={{ inset: -7, border: "2.5px solid #3b82f6", borderRadius: "50%" }}
                    animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.2, 0.75] }}
                    transition={{ duration: 1.9, repeat: Infinity, delay: 0.4 }} />
                  <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden"
                    style={{ background: `linear-gradient(135deg,${botRef.current.avatarColor}cc 0%,#1e1b4b 100%)`, border: `3.5px solid ${botRef.current.avatarColor}`, boxShadow: `0 0 28px ${botRef.current.avatarColor}99,0 0 56px ${botRef.current.avatarColor}33` }}>
                    <span className="font-black text-white" style={{ fontSize: 38, lineHeight: 1 }}>{botRef.current.initial}</span>
                  </div>
                  <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full" style={{ background: "#22c55e", border: "2.5px solid #1e1038" }} />
                </div>
                <div className="text-center">
                  <div className="font-black text-white text-base leading-tight">{botRef.current.name}</div>
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(59,130,246,0.85)" }}>📍 {botRef.current.city}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Match stats */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="w-full rounded-2xl px-4 py-3.5 mb-8 flex items-center justify-around"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {[
            { label: "Timer", value: "2 min" },
            { label: "Kill Bonus", value: "+15 pts" },
            { label: "Home Bonus", value: "+25 pts" },
            { label: "Winner", value: "Top Score" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</div>
              <div className="text-xs font-black" style={{ color: "#FFD700" }}>{value}</div>
            </div>
          ))}
        </motion.div>

        {/* Loading bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full">
          <div className="h-[5px] rounded-full overflow-hidden mb-2.5" style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#9333ea 0%,#a855f7 50%,#3b82f6 100%)" }}
              initial={{ width: "0%" }} animate={{ width: "100%" }}
              transition={{ duration: 7.4, ease: "linear" }} />
          </div>
          <motion.p className="text-center text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}
            animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.1, repeat: Infinity }}>
            {mmStage === "searching" ? "⏳ Waiting for a real player (8s)…" : "🤖 Bot joined! Setting up the board…"}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ─── RESULT SCREEN ──────────────────────────────────────────────────────────
  if (phase === "result") {
    const forfeited = forfeitedRef.current;
    const won = forfeited ? false : pScore > bScore;
    const resultIcon = forfeited ? "🚪" : won ? "🏆" : "😔";
    const resultText = forfeited ? "FORFEITED" : won ? "VICTORY!" : "DEFEATED";
    const resultColor = forfeited ? "#f97316" : won ? "#FFD700" : "#ef4444";
    const resultGlow = forfeited ? "rgba(249,115,22,0.7)" : won ? "rgba(255,215,0,0.9)" : "rgba(239,68,68,0.7)";

    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-5 relative"
        style={{ background: won ? "linear-gradient(180deg,#052010,#0a3520,#052010)" : "linear-gradient(180deg,#1a0510,#2d0a18,#1a0510)", maxWidth: 480, margin: "0 auto" }}>
        {won && <Confetti />}

        <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }} className="text-8xl"
          style={{ filter: `drop-shadow(0 0 30px ${resultGlow})` }}>
          {resultIcon}
        </motion.div>

        <div className="text-center">
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl font-black" style={{ color: resultColor }}>
            {resultText}
          </motion.h2>
          {forfeited && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="mt-2 text-sm font-bold px-4 py-2 rounded-xl"
              style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.35)", color: "#f97316" }}>
              🚪 You left the match — counted as a loss
            </motion.div>
          )}
          {won && !isFreeMode && prize > 0 && (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                className="mt-2 text-3xl font-black" style={{ color: "#4ade80", textShadow: "0 0 20px rgba(74,222,128,0.6)" }}>+₹{prize}</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(74,222,128,0.15)", border: "1.5px solid rgba(74,222,128,0.4)", color: "#4ade80" }}>
                ✅ Wallet Updated Successfully
              </motion.div>
            </>
          )}
          {isFreeMode && (
            <div className="mt-2 text-sm font-bold" style={{ color: "rgba(16,185,129,0.8)" }}>Practice Match</div>
          )}
          {!won && !isFreeMode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mt-2 text-xl font-bold" style={{ color: "#ef4444" }}>-₹{initialFee}</motion.div>
          )}
        </div>

        {/* Score breakdown */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex">
            <div className="flex-1 p-4 text-center" style={{ background: `${PLAYER_COLOR}1a`, borderRight: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: `${PLAYER_COLOR}e0` }}>YOU 🔵</div>
              <div className="text-3xl font-black" style={{ color: PLAYER_COLOR }}>{pScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
            </div>
            <div className="flex-1 p-4 text-center" style={{ background: `${BOT_COLOR}1a` }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: `${BOT_COLOR}e0` }}>{botRef.current.name.slice(0, 8)}</div>
              <div className="text-3xl font-black" style={{ color: BOT_COLOR }}>{bScore}</div>
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
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{won ? "You Won" : forfeited ? "You Forfeited" : "You Lost"}</span>
              <span className="text-sm font-black" style={{ color: won ? "#4ade80" : "#ef4444" }}>
                {won ? `+₹${prize}` : `-₹${initialFee}`}
              </span>
            </div>
          )}
        </div>

        <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", boxShadow: "0 0 24px rgba(168,85,247,0.4)" }}>
          Back to Games
        </motion.button>
      </div>
    );
  }

  // ─── PLAYING SCREEN ─────────────────────────────────────────────────────────
  const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";
  const tierLabel = tier === "god" ? "⚡ GOD" : tier === "medium" ? "🔶 MED" : "🟢 EASY";

  // Board square geometry drives the side-dice size. Dice + profile photos live
  // OUTSIDE the board (left = player, right = bot) so the board stays centred.
  const bs = Math.min(boardBox.w, boardBox.h);
  const dsz = Math.max(40, Math.min(60, Math.round(bs * 0.11)));

  const playerPhoto = user?.photoURL || "";
  const playerInitial = (user?.displayName || "YOU").charAt(0).toUpperCase();

  return (
    <div className="flex flex-col min-h-screen"
      style={{ background: GRAD_BG, maxWidth: 480, margin: "0 auto" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <button onClick={openForfeit} className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 18 }}>
          ←
        </button>
        <div className="text-center">
          <div className="font-black text-white text-sm tracking-widest">SUPER LUDO</div>
          <div className="text-[9px] font-bold" style={{ color: "rgba(168,85,247,0.7)" }}>
            {isFreeMode ? "PRACTICE" : `₹${initialFee} · Win ₹${Math.floor(initialFee * 2 * 0.9)}`}
          </div>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 16 }}>
          🎲
        </div>
      </div>

      {/* ── 2-MIN TIMER (top) ── */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="rounded-2xl px-3 py-2 flex items-center justify-center relative"
          style={{ background: "rgba(76,29,149,0.45)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <span className="text-[9px] font-black tracking-widest mr-2" style={{ color: "rgba(255,255,255,0.35)" }}>⏱</span>
          <motion.div
            animate={{ scale: matchTimer <= 30 ? [1, 1.08, 1] : 1 }}
            transition={{ duration: 0.4, repeat: matchTimer <= 30 ? Infinity : 0 }}
            className="text-2xl font-black tabular-nums"
            style={{
              color: matchTimer <= 30 ? "#ef4444" : matchTimer <= 60 ? "#f97316" : "#FFD700",
              textShadow: matchTimer <= 30 ? "0 0 20px rgba(239,68,68,1),0 0 40px rgba(239,68,68,0.6)" : matchTimer <= 60 ? "0 0 16px rgba(249,115,22,0.85)" : "0 0 14px rgba(255,215,0,0.8)",
              letterSpacing: 1.5,
            }}>
            {String(Math.floor(matchTimer / 60)).padStart(2, "0")}:{String(matchTimer % 60).padStart(2, "0")}
          </motion.div>
          <span className="absolute right-2 text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40` }}>
            {tierLabel}
          </span>
        </div>
      </div>

      {/* ── Your Score / Opponent Score (below timer) ── */}
      <div className="px-3 pb-2 flex gap-2 flex-shrink-0">
        <motion.div className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center"
          animate={{ boxShadow: turn === "player" ? `0 0 24px ${PLAYER_COLOR},0 0 48px ${PLAYER_COLOR}59` : "none" }}
          style={{ background: turn === "player" ? `${PLAYER_COLOR}33` : "rgba(255,255,255,0.07)", border: `2px solid ${turn === "player" ? PLAYER_COLOR : "rgba(255,255,255,0.12)"}` }}>
          <span className="text-[10px] font-black tracking-wider" style={{ color: PLAYER_COLOR }}>YOUR SCORE</span>
          <motion.span key={pScore} className="text-2xl font-black leading-none" style={{ color: PLAYER_COLOR, textShadow: `0 0 12px ${PLAYER_COLOR}` }}
            initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
            {pScore}
          </motion.span>
        </motion.div>
        <motion.div className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center"
          animate={{ boxShadow: turn === "bot" ? `0 0 24px ${BOT_COLOR},0 0 48px ${BOT_COLOR}59` : "none" }}
          style={{ background: turn === "bot" ? `${BOT_COLOR}33` : "rgba(255,255,255,0.07)", border: `2px solid ${turn === "bot" ? BOT_COLOR : "rgba(255,255,255,0.12)"}` }}>
          <span className="text-[10px] font-black tracking-wider truncate max-w-full" style={{ color: BOT_COLOR }}>{botRef.current.name.slice(0, 10)}</span>
          <motion.span key={bScore} className="text-2xl font-black leading-none" style={{ color: BOT_COLOR, textShadow: `0 0 12px ${BOT_COLOR}` }}
            initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
            {bScore}
          </motion.span>
        </motion.div>
      </div>

      {/* ── Turn indicator strip ── */}
      <div className="flex items-center justify-between px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background: PLAYER_COLOR, boxShadow: turn === "player" ? `0 0 8px ${PLAYER_COLOR}` : "none" }}
            animate={turn === "player" ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.7, repeat: Infinity }} />
          <span className="text-[10px] font-black" style={{ color: turn === "player" ? PLAYER_COLOR : "rgba(255,255,255,0.4)" }}>YOU 🔵</span>
          {turn === "player" && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: PLAYER_COLOR, color: "#fff" }}>TURN</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black" style={{ color: turn === "bot" ? BOT_COLOR : "rgba(255,255,255,0.4)" }}>{botRef.current.name}</span>
          {turn === "bot" && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: BOT_COLOR, color: "#fff" }}>TURN</span>
          )}
          <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background: BOT_COLOR, boxShadow: turn === "bot" ? `0 0 8px ${BOT_COLOR}` : "none" }}
            animate={turn === "bot" ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.7, repeat: Infinity }} />
        </div>
      </div>

      {/* ── BOARD + SIDE PANELS: player (left) · board (center) · bot (right) ── */}
      <div className="flex-1 min-h-[300px] flex items-center gap-1.5 px-2">

        {/* ── LEFT: White panel — player profile photo (top) + white dice ── */}
        <div className="flex flex-col items-center justify-center shrink-0 rounded-2xl px-2 py-4"
          style={{ width: "clamp(74px, 18vw, 92px)", background: "linear-gradient(180deg,#ffffff 0%,#eef2f7 100%)", border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 18px 40px rgba(0,0,0,0.28), inset 0 1px 0 #ffffff" }}>
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 240, damping: 20 }}
            className="flex flex-col items-center gap-1.5">
            <div className="relative" style={{ width: 62, height: 62 }}>
              <motion.div className="absolute rounded-full pointer-events-none"
                style={{ inset: -4, background: `conic-gradient(from 0deg, ${PLAYER_COLOR}, #ec4899, #a855f7, ${PLAYER_COLOR})`, outline: "1px solid rgba(15,23,42,0.10)" }}
                animate={turn === "player"
                  ? { boxShadow: [`0 0 10px ${PLAYER_COLOR}66`, `0 0 26px ${PLAYER_COLOR}bb`, `0 0 10px ${PLAYER_COLOR}66`] }
                  : { boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
                transition={{ duration: 1.4, repeat: turn === "player" ? Infinity : 0 }} />
              <div className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
                style={{ border: "3px solid #ffffff", boxShadow: "0 0 0 1px rgba(15,23,42,0.15)", background: `linear-gradient(135deg,${PLAYER_COLOR},#1e3a8a)` }}>
                {playerPhoto
                  ? <img src={playerPhoto} alt="" className="w-full h-full object-cover" />
                  : <span className="font-black text-white" style={{ fontSize: 22 }}>{playerInitial}</span>}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black"
                style={{ background: "#22c55e", border: "2px solid #ffffff", color: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}>✓</span>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full truncate max-w-[78px]"
              style={{ background: turn === "player" ? `${PLAYER_COLOR}1a` : "rgba(15,23,42,0.05)", color: turn === "player" ? PLAYER_COLOR : "#64748b", border: `1px solid ${turn === "player" ? PLAYER_COLOR + "66" : "rgba(15,23,42,0.10)"}` }}>
              YOU 🔵
            </span>
            <motion.div
              animate={turn === "player" && !rolling ? { scale: [1, 1.07, 1] } : { scale: 1 }}
              transition={{ duration: 1.2, repeat: turn === "player" && !rolling ? Infinity : 0 }}>
              <Dice3D value={dice} rolling={rolling && turn === "player"} onClick={handleRoll} disabled={!canRoll} size={dsz} />
            </motion.div>
            <span className="text-[9px] font-black min-h-[12px]" style={{ color: canRoll ? PLAYER_COLOR : "#94a3b8" }}>
              {canRoll ? "TAP TO ROLL" : validToks.length > 0 ? "PICK TOKEN" : turn === "bot" ? "WAIT…" : ""}
            </span>
          </motion.div>
        </div>

        {/* ── CENTER: Canvas Ludo Board (kept square + centred) ── */}
        <div ref={boardWrapRef} className="relative flex-1 min-w-0" style={{ aspectRatio: "1 / 1" }}>
          <AnimatePresence>
            {killFlash && (
              <motion.div className="absolute inset-0 rounded-xl pointer-events-none z-10"
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.35, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                style={{ background: "radial-gradient(circle,rgba(255,59,92,0.7) 0%,transparent 70%)" }} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {emote && (
              <motion.div className="absolute top-1/2 left-1/2 z-20 pointer-events-none"
                initial={{ scale: 0, opacity: 1, x: "-50%", y: "-50%" }} animate={{ scale: 2.5, opacity: 0, y: "-120%" }}
                exit={{ opacity: 0 }} transition={{ duration: 1.0 }} style={{ fontSize: 32 }}>
                {emote}
              </motion.div>
            )}
          </AnimatePresence>
          <canvas ref={canvasRef} className="w-full h-full rounded-2xl"
            style={{ display: "block", touchAction: "none", background: "transparent" }} />

          {validToks.length > 0 && (
            <div className="absolute bottom-2 inset-x-0 z-20 flex justify-center pointer-events-none">
              <div className="px-4 py-2 rounded-full text-xs font-black animate-pulse"
                style={{ background: `${PLAYER_COLOR}e6`, color: "#fff", boxShadow: `0 0 20px ${PLAYER_COLOR}` }}>
                🎯 Tap a glowing token to move!
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: White panel — bot profile photo (top) + white dice ── */}
        <div className="flex flex-col items-center justify-center shrink-0 rounded-2xl px-2 py-4"
          style={{ width: "clamp(74px, 18vw, 92px)", background: "linear-gradient(180deg,#ffffff 0%,#eef2f7 100%)", border: "1px solid rgba(15,23,42,0.08)", boxShadow: "0 18px 40px rgba(0,0,0,0.28), inset 0 1px 0 #ffffff" }}>
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 240, damping: 20 }}
            className="flex flex-col items-center gap-1.5">
            <div className="relative" style={{ width: 62, height: 62 }}>
              <motion.div className="absolute rounded-full pointer-events-none"
                style={{ inset: -4, background: `conic-gradient(from 0deg, ${BOT_COLOR}, #f472b6, #a855f7, ${BOT_COLOR})`, outline: "1px solid rgba(15,23,42,0.10)" }}
                animate={turn === "bot"
                  ? { boxShadow: [`0 0 10px ${BOT_COLOR}66`, `0 0 26px ${BOT_COLOR}bb`, `0 0 10px ${BOT_COLOR}66`] }
                  : { boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}
                transition={{ duration: 1.4, repeat: turn === "bot" ? Infinity : 0 }} />
              <div className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center"
                style={{ border: "3px solid #ffffff", boxShadow: "0 0 0 1px rgba(15,23,42,0.15)", background: `linear-gradient(135deg,${botRef.current.avatarColor},#14532d)` }}>
                <span className="font-black text-white" style={{ fontSize: 22 }}>{botRef.current.initial}</span>
              </div>
            </div>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full truncate max-w-[78px]"
              style={{ background: turn === "bot" ? `${BOT_COLOR}1a` : "rgba(15,23,42,0.05)", color: turn === "bot" ? BOT_COLOR : "#64748b", border: `1px solid ${turn === "bot" ? BOT_COLOR + "66" : "rgba(15,23,42,0.10)"}` }}>
              🟢 {botRef.current.name}
            </span>
            <motion.div
              animate={turn === "bot" && !rolling ? { scale: [1, 1.07, 1] } : { scale: 1 }}
              transition={{ duration: 1.2, repeat: turn === "bot" && !rolling ? Infinity : 0 }}>
              <Dice3D value={dice} rolling={rolling && turn === "bot"} onClick={() => {}} disabled={true} size={dsz} />
            </motion.div>
            <span className="text-[9px] font-black min-h-[12px]" style={{ color: turn === "bot" && !rolling ? BOT_COLOR : "#94a3b8" }}>
              {turn === "bot" && rolling ? "ROLLING…" : turn === "bot" ? "THINKING…" : ""}
            </span>
          </motion.div>
        </div>
      </div>

      {/* ── Event log + turn timer (bottom) ── */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2">
        <div className="rounded-xl px-3 py-2" style={{ background: "rgba(76,29,149,0.45)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(6px)" }}>
          <AnimatePresence mode="popLayout">
            {logMsgs.slice(0, 2).map((msg, i) => (
              <motion.div key={msg + i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: i === 0 ? 1 : 0.4 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }} className="text-[10px] font-bold truncate"
                style={{ color: i === 0 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.35)" }}>
                {msg}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        {turn === "player" && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full" style={{ width: `${(turnTimer / 15) * 100}%`, background: turnTimer > 8 ? "#4ade80" : turnTimer > 4 ? "#f97316" : "#ef4444", transition: "width 0.9s linear" }} />
            </div>
            <span className="text-[9px] font-black flex-shrink-0" style={{ color: turnTimer > 8 ? "#4ade80" : turnTimer > 4 ? "#f97316" : "#ef4444" }}>{turnTimer}s</span>
          </div>
        )}
      </div>

      {/* ── Forfeit confirmation modal (10s auto-loser) ── */}
      <AnimatePresence>
        {forfeitOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-6"
            style={{ background: "rgba(30,10,60,0.92)", backdropFilter: "blur(6px)", maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ scale: 0.85, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
              transition={{ type: "spring", stiffness: 260, damping: 22 }}
              className="w-full rounded-3xl px-6 py-7 text-center"
              style={{ background: "linear-gradient(180deg,#3b0764,#6d28d9 55%,#be185d)", border: "1px solid rgba(255,255,255,0.18)" }}>
              <motion.div
                className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl font-black mb-4"
                animate={{ scale: [1, 1.08, 1], boxShadow: ["0 0 0 rgba(249,115,22,0)", "0 0 30px rgba(249,115,22,0.45)", "0 0 0 rgba(249,115,22,0)"] }}
                transition={{ duration: 1, repeat: Infinity }}
                style={{ background: "rgba(249,115,22,0.12)", border: "2px solid rgba(249,115,22,0.45)", color: "#f97316" }}>
                {forfeitCountdown}
              </motion.div>
              <h3 className="text-white font-black text-lg mb-1">Leaving the match?</h3>
              <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.45)" }}>
                Forfeiting counts as a <b style={{ color: "#f87171" }}>LOSS</b> — your entry fee {isFreeMode ? "" : <b style={{ color: "#f87171" }}>₹{initialFee}</b>} will not be refunded.
              </p>
              <div className="h-1.5 rounded-full overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#f97316,#ef4444)" }}
                  animate={{ width: `${(forfeitCountdown / 10) * 100}%` }} transition={{ ease: "linear", duration: 1 }} />
              </div>
              <div className="flex gap-2.5">
                <motion.button whileTap={{ scale: 0.97 }} onClick={cancelForfeit}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm cursor-pointer"
                  style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.35)", color: "#34d399" }}>
                  ▶ KEEP PLAYING
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => confirmForfeit()}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)", border: "1px solid rgba(239,68,68,0.5)", color: "#fff", boxShadow: "0 0 18px rgba(239,68,68,0.35)" }}>
                  🚪 FORFEIT
                </motion.button>
              </div>
              <p className="text-[10px] mt-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                Auto-forfeit in {forfeitCountdown}s if you don't act
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
