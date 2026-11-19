/**
 * Fruit Ninja 2P — real-time two-player fruit slicing (WINGGO)
 * ─────────────────────────────────────────────────────────────────────────────
 * Clean-room implementation of the classic fruit-slicing *mechanics* (the
 * reference repo has no license, so no code/assets were copied): swipe-trail
 * slicing, gravity arcs, bomb penalty. Rendering is Winggo's own canvas +
 * emoji engine; sounds are WebAudio synth.
 *
 * Flow: lobby → searching (10s) → 3-2-1 countdown → 120s match → result
 *
 * Real-time (free entry, NO cash wagering):
 *   - Both scores sync live over RTDB (each client writes ONLY its own node).
 *   - One server-authoritative timers node (startedAt/endAt, write-once) drives
 *     both countdowns via .info/serverTimeOffset — clients cannot fake time.
 *   - Bomb hit ⇒ the HITTER's own gameplay pauses 3s (overlay 3-2-1, no
 *     scoring); the main 2-min timer keeps running; opponent is unaffected.
 *   - 00:00 ⇒ gameplay stops, final scores compared, Winner/Loser/Draw screen.
 *   - Disconnect ⇒ onDisconnect(connected:false); opponent wins by forfeit
 *     after ~6s; reconnecting resumes via fnPlayer/{uid}/activeRoom.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/useAuth";
import { useMatchHistory } from "@/context/useMatchHistory";
import {
  joinFruitQueue, cancelFruitQueue, completePairing, waitForPair,
  ensureRoom, subscribeFruitRoom, subscribeQueueEntry, getFruitRoom, updateMyPlayerState, attachDisconnectHandlers,
  ensureTimers, ensureResult, scheduleRoomCleanup, setActiveRoom, getActiveRoom,
  getServerTimeOffset, MATCH_DURATION_MS, QUEUE_WAIT_MS,
  type FNRoom, type FNPlayerInfo, type FNResult,
} from "@/firebase/fruitninja.service";

type Phase = "lobby" | "searching" | "countdown" | "playing" | "result";

interface MatchOutcome {
  outcome: "win" | "loss" | "draw";
  myScore: number;
  oppScore: number;
  reason?: "score" | "forfeit" | "opponent-left";
}

// ─── CLEAN-ROOM CANVAS ENGINE (refs, no re-render churn) ──────────────────────

type Kind = "apple" | "banana" | "peach" | "strawberry" | "watermelon" | "orange" | "grapes" | "bomb";

const FRUITS: { kind: Exclude<Kind, "bomb">; emoji: string; color: string }[] = [
  { kind: "apple",      emoji: "🍎", color: "#ef4444" },
  { kind: "banana",     emoji: "🍌", color: "#facc15" },
  { kind: "peach",      emoji: "🍑", color: "#fb923c" },
  { kind: "strawberry", emoji: "🍓", color: "#f43f5e" },
  { kind: "watermelon", emoji: "🍉", color: "#22c55e" },
  { kind: "orange",     emoji: "🍊", color: "#f97316" },
  { kind: "grapes",     emoji: "🍇", color: "#a855f7" },
];

interface Piece {
  kind: Kind;
  emoji: string;
  color: string;
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  rot: number; rotV: number;
  side?: -1 | 1; // for split halves
}

interface Particle { x: number; y: number; vx: number; vy: number; r: number; color: string; life: number; }

interface TrailPt { x: number; y: number; t: number; }

interface Engine {
  w: number; h: number;
  fruits: Piece[];
  halves: Piece[];
  parts: Particle[];
  trail: TrailPt[];
  spawnAcc: number;
  running: boolean;
  frozen: boolean;        // bomb penalty freeze (own gameplay only)
  elapsed: number;        // ms since play began (for spawn-rate ramp)
  score: number;
}

function newEngine(w: number, h: number): Engine {
  return { w, h, fruits: [], halves: [], parts: [], trail: [], spawnAcc: 0, running: false, frozen: false, elapsed: 0, score: 0 };
}

// ─── WEB AUDIO SYNTH (no copied sound assets) ─────────────────────────────────

let audioCtx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch { return null; }
}
function sfxSlice(muted: boolean) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(700 + Math.random() * 300, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.09);
  g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.11);
}
function sfxBomb(muted: boolean) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.5);
  g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.6);
}
function sfxTick(muted: boolean, hi = false) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(hi ? 950 : 620, t);
  g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.13);
}
function sfxEnd(muted: boolean, win: boolean) {
  if (muted) return;
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  const seq = win ? [523, 659, 784, 1047] : [400, 330, 262];
  seq.forEach((f, i) => {
    const o = c.createOscillator(); const g = c.createGain();
    o.type = "triangle"; o.frequency.setValueAtTime(f, t + i * 0.14);
    g.gain.setValueAtTime(0.14, t + i * 0.14); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.14 + 0.22);
    o.connect(g).connect(c.destination); o.start(t + i * 0.14); o.stop(t + i * 0.14 + 0.24);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

// distance from point p to segment a→b
function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax, aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

const BOMB_PENALTY_MS = 3000;

// ═══════════════════════════════════════════════════════════════════════════════

export default function FruitNinja2P({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { addMatch } = useMatchHistory();

  const uid = user?.uid ?? "demo-uid";
  const me: FNPlayerInfo = {
    uid,
    name: user?.displayName || `Player${uid.slice(-4).toUpperCase()}`,
    photo: user?.photoURL || "",
  };

  // ── phase / match state ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>("lobby");
  const [botMode, setBotMode] = useState(false);
  const [searchElapsed, setSearchElapsed] = useState(0);
  const [noOpponent, setNoOpponent] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [room, setRoom] = useState<FNRoom | null>(null);
  const [opponent, setOpponent] = useState<FNPlayerInfo | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [remainingMs, setRemainingMs] = useState(MATCH_DURATION_MS);
  const [countdownNum, setCountdownNum] = useState(3);
  const [penaltyLeft, setPenaltyLeft] = useState(0); // secs left of MY bomb pause
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [muted, setMuted] = useState(false);
  const [oppPaused, setOppPaused] = useState(false);
  const [quitConfirm, setQuitConfirm] = useState(false);

  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const offsetRef = useRef(0);
  const timersRef = useRef<{ startedAt: number; endAt: number } | null>(null);
  const engineRef = useRef<Engine>(newEngine(0, 0));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pausedUntilRef = useRef(0);
  const lastWriteRef = useRef(0);
  const pendingWriteRef = useRef(false);
  const scoreRef = useRef(0);
  const roomRef2 = useRef<FNRoom | null>(null);
  roomRef2.current = room;
  const oppRef = useRef<FNPlayerInfo | null>(null);
  oppRef.current = opponent;
  const botScoreRef = useRef(0);
  const botTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endedRef = useRef(false);
  const unsubsRef = useRef<Array<() => void>>([]);
  const tickCountRef = useRef(3);

  const cleanupFns = useCallback(() => {
    unsubsRef.current.forEach((u) => { try { u(); } catch {} });
    unsubsRef.current = [];
    if (botTimerRef.current) { clearInterval(botTimerRef.current); botTimerRef.current = null; }
  }, []);

  // ── RTDB room subscription (score sync) ─────────────────────────────────────
  useEffect(() => {
    if (!roomId || botMode) return;
    const un = subscribeFruitRoom(roomId, (r) => {
      setRoom(r);
      if (!r || !r.players) return;
      const oppUid = Object.keys(r.players).find((u) => u !== uid);
      if (oppUid) {
        setOppScore(r.players[oppUid]?.score ?? 0);
        setOppPaused(!!(r.players[oppUid]?.penaltyUntil && r.players[oppUid].penaltyUntil > Date.now() + offsetRef.current));
        if (!oppRef.current) {
          setOpponent({ uid: oppUid, name: r.players[oppUid]?.name || "Player", photo: r.players[oppUid]?.photo || "" });
        }
      }
    });
    unsubsRef.current.push(un);
    return () => { un(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, botMode]);

  // ── searching elapsed ticker ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "searching") return;
    setSearchElapsed(0);
    const iv = setInterval(() => setSearchElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ── background watcher: while "No player found" is shown, someone may still
  // join our queue entry — pair automatically when that happens ────────────────
  useEffect(() => {
    if (phase !== "searching" || !noOpponent || !roomId || botMode) return;
    const un = subscribeQueueEntry(roomId, (entry) => {
      if (!entry || phaseRef.current !== "searching") return;
      const ENTRY_KEYS = ["uid", "name", "photo", "ts"];
      const joiner = Object.keys(entry)
        .filter((k) => !ENTRY_KEYS.includes(k))
        .map((k) => (entry as unknown as Record<string, FNPlayerInfo>)[k])
        .find((c) => c && c.uid && c.uid !== uid);
      if (joiner) {
        setNoOpponent(false);
        setOpponent({ uid: joiner.uid, name: joiner.name || "Player", photo: joiner.photo || "" });
        ensureRoom(roomId, [me, joiner], offsetRef.current).then(() => beginCountdown(roomId));
      }
    });
    unsubsRef.current.push(un);
    return () => { un(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, noOpponent, roomId, botMode]);

  // ── server-time offset ──────────────────────────────────────────────────────
  useEffect(() => {
    getServerTimeOffset().then((o) => { offsetRef.current = o; });
  }, []);

  // ── resume: rejoin an interrupted match on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getActiveRoom(uid);
      if (!saved || cancelled) return;
      const un = subscribeFruitRoom(saved, (r) => {
        un();
        if (cancelled) return;
        if (!r || !r.players || !r.timers) {
          void setActiveRoom(uid, null);
          return; // room gone → lobby
        }
        const oppUid = Object.keys(r.players).find((u) => u !== uid);
        if (!oppUid) { void setActiveRoom(uid, null); return; }
        setOpponent({ uid: oppUid, name: r.players[oppUid]?.name || "Player", photo: r.players[oppUid]?.photo || "" });
        setMyScore(r.players[uid]?.score ?? 0);
        scoreRef.current = r.players[uid]?.score ?? 0;
        setOppScore(r.players[oppUid]?.score ?? 0);
        timersRef.current = r.timers;
        setRoomId(saved);
        if (r.status === "finished" && r.result) {
          applyResult(r.result);
        } else {
          const serverNow = Date.now() + offsetRef.current;
          setPhase(serverNow < r.timers.startedAt ? "countdown" : "playing");
          attachMatchHandlers(saved);
        }
      });
      unsubsRef.current.push(un);
      // safety: if no snapshot arrives in 4s, drop the pointer
      setTimeout(() => { if (!roomRef2.current) { void setActiveRoom(uid, null); } }, 4000);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attachMatchHandlers(rid: string) {
    cleanupFns();
    unsubsRef.current.push(attachDisconnectHandlers(rid, uid));
    void updateMyPlayerState(rid, uid, { connected: true });
    void setActiveRoom(uid, rid);
    // heartbeat keeps lastSeen fresh for forfeit detection
    const hb = setInterval(() => {
      if (phaseRef.current === "playing" || phaseRef.current === "countdown") {
        void updateMyPlayerState(rid, uid, { connected: true });
      }
    }, 4000);
    unsubsRef.current.push(() => clearInterval(hb));
  }

  function applyResult(res: FNResult) {
    if (endedRef.current) return;
    endedRef.current = true;
    const isBot = botMode || !roomId; // bot matches are local-only
    const myFinal = res.scores?.[uid] ?? scoreRef.current;
    const oppFinal = res.scores?.[oppRef.current?.uid ?? ""] ?? (() => {
      const r = roomRef2.current;
      const oppUid = r?.players ? Object.keys(r.players).find((u) => u !== uid) : null;
      return (oppUid && r?.players[oppUid]?.score) || 0;
    })();
    let oc: MatchOutcome;
    if (res.draw) oc = { outcome: "draw", myScore: myFinal, oppScore: oppFinal, reason: res.reason };
    else if (res.winnerId === uid) oc = { outcome: "win", myScore: myFinal, oppScore: oppFinal, reason: res.reason };
    else oc = { outcome: "loss", myScore: myFinal, oppScore: oppFinal, reason: res.reason };
    setOutcome(oc);
    setPhase("result");
    void setActiveRoom(uid, null);
    sfxEnd(mutedRef.current, oc.outcome === "win");
    // draw is stored as a loss with zero prize (history type supports win/loss)
    addMatch({
      gameId: "fruitninja2p", gameName: "Fruit Ninja 2P", gameIcon: "🍉",
      result: oc.outcome === "win" ? "win" : "loss",
      entryFee: 0, prize: 0,
      userScore: myFinal, opponentScore: oppFinal,
      opponentName: isBot ? "Practice Bot" : (oppRef.current?.name || "Player"),
      roomId: isBot ? undefined : roomId ?? undefined,
    });
  }

  // ── start online match ──────────────────────────────────────────────────────
  const startSearch = useCallback(async () => {
    setBotMode(false);
    setNoOpponent(false);
    setSearchElapsed(0);
    setMyScore(0); scoreRef.current = 0;
    setOppScore(0);
    setOutcome(null); endedRef.current = false;
    setPhase("searching");
    ac(); // unlock audio on user gesture
    try {
      const { roomId: rid, isCreator, opponent: joinedOpp } = await joinFruitQueue(me, offsetRef.current);
      if (phaseRef.current !== "searching") { await cancelFruitQueue(rid, uid); return; }
      setRoomId(rid);
      if (!isCreator && joinedOpp) {
        // JOINER — transactionally finalize the pair and create the room
        const done = await completePairing(rid, me, offsetRef.current);
        if (!done) { // creator vanished — retry
          await cancelFruitQueue(rid, uid);
          setRoomId(null);
          setTimeout(() => { if (phaseRef.current === "searching") void startSearch(); }, 600);
          return;
        }
        setOpponent(joinedOpp);
        beginCountdown(rid);
        return;
      }
      // CREATOR — watch my entry for a joiner (up to 10s)
      const opp = await waitForPair(rid, uid, QUEUE_WAIT_MS);
      if (phaseRef.current !== "searching") { await cancelFruitQueue(rid, uid); return; }
      if (opp) {
        setOpponent(opp);
        await ensureRoom(rid, [me, opp], offsetRef.current);
        beginCountdown(rid);
      } else {
        setNoOpponent(true);
      }
    } catch {
      if (phaseRef.current === "searching") setNoOpponent(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  async function keepSearching() {
    if (!roomId) return;
    setNoOpponent(false);
    setSearchElapsed(0);
    const opp = await waitForPair(roomId, uid, QUEUE_WAIT_MS);
    if (phaseRef.current !== "searching") { await cancelFruitQueue(roomId, uid); return; }
    if (opp) {
      setOpponent(opp);
      await ensureRoom(roomId, [me, opp], offsetRef.current);
      beginCountdown(roomId);
    } else {
      setNoOpponent(true);
    }
  }

  async function cancelSearch() {
    cleanupFns();
    if (roomId && !botMode) await cancelFruitQueue(roomId, uid);
    setRoomId(null); setOpponent(null); setNoOpponent(false);
    setPhase("lobby");
  }

  function beginCountdown(rid: string) {
    cleanupFns();
    engineRef.current = newEngine(0, 0);
    void ensureTimers(rid, offsetRef.current).then(() => {
      // read the authoritative timers (whoever created them)
      const un = subscribeFruitRoom(rid, (r) => {
        if (r?.timers) {
          timersRef.current = r.timers;
          un();
          attachMatchHandlers(rid);
          setPhase("countdown");
        }
      });
      unsubsRef.current.push(un);
      setTimeout(() => {
        if (!timersRef.current) {
          // fallback: local timers (offline demo / rules not yet deployed)
          const now = Date.now() + offsetRef.current;
          timersRef.current = { startedAt: now + 3000, endAt: now + 3000 + MATCH_DURATION_MS };
          attachMatchHandlers(rid);
          setPhase("countdown");
        }
      }, 2500);
    });
  }

  // ── practice vs bot (fully local — no RTDB writes) ──────────────────────────
  function startBot() {
    // leave matchmaking (if any) — bot matches write nothing to RTDB
    if (roomId) { void cancelFruitQueue(roomId, uid); setRoomId(null); }
    setBotMode(true);
    setOpponent({ uid: "bot", name: "Practice Bot", photo: "" });
    setMyScore(0); scoreRef.current = 0;
    setOppScore(0); botScoreRef.current = 0;
    setOutcome(null); endedRef.current = false;
    setRoomId(null);
    engineRef.current = newEngine(0, 0);
    const now = Date.now();
    timersRef.current = { startedAt: now + 3000, endAt: now + 3000 + MATCH_DURATION_MS };
    ac();
    setPhase("countdown");
    // bot scoring cadence (~0.65 slices/sec while "playing")
    botTimerRef.current = setInterval(() => {
      if (phaseRef.current !== "playing") return;
      if (Math.random() < 0.72) {
        botScoreRef.current += 1;
        setOppScore(botScoreRef.current);
      }
    }, 1000);
  }

  // ── countdown / match clock (server-authoritative) ──────────────────────────
  useEffect(() => {
    if (phase !== "countdown" && phase !== "playing") return;
    tickCountRef.current = 3;
    const iv = setInterval(() => {
      const t = timersRef.current;
      if (!t) return;
      const serverNow = Date.now() + offsetRef.current;
      if (serverNow < t.startedAt) {
        setPhase((p) => (p === "result" ? p : "countdown"));
        const n = Math.ceil((t.startedAt - serverNow) / 1000);
        if (n !== tickCountRef.current) {
          tickCountRef.current = n;
          setCountdownNum(n);
          sfxTick(mutedRef.current, n <= 1);
        }
        setRemainingMs(MATCH_DURATION_MS);
        return;
      }
      const rem = t.endAt - serverNow;
      if (phaseRef.current === "countdown") {
        setPhase("playing");
        engineRef.current.running = true;
        sfxTick(mutedRef.current, true);
      }
      setRemainingMs(rem);
      if (rem <= 0 && phaseRef.current === "playing" && !endedRef.current) {
        endMatch();
      }
    }, 100);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── penalty ticker (my bomb pause) ──────────────────────────────────────────
  useEffect(() => {
    if (penaltyLeft <= 0) return;
    const iv = setInterval(() => {
      const left = pausedUntilRef.current - Date.now();
      if (left <= 0) {
        setPenaltyLeft(0);
        pausedUntilRef.current = 0;
        engineRef.current.frozen = false;
      } else {
        setPenaltyLeft(Math.ceil(left / 1000));
      }
    }, 100);
    return () => clearInterval(iv);
  }, [penaltyLeft]);

  // ── forfeit watcher: opponent gone >6s during play ⇒ I win ──────────────────
  useEffect(() => {
    if (phase !== "playing" || botMode || !roomId) return;
    const iv = setInterval(() => {
      const r = roomRef2.current;
      const opp = oppRef.current;
      if (!r?.players || !opp || opp.uid === "bot") return;
      const oppState = r.players[opp.uid];
      if (!oppState) return;
      const serverNow = Date.now() + offsetRef.current;
      if (oppState.connected === false && serverNow - (oppState.lastSeen || 0) > 6000) {
        void finishWithForfeit("opponent-left");
      }
    }, 1500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, botMode, roomId]);

  // ── match end + result (write-once result node) ─────────────────────────────
  function endMatch() {
    if (endedRef.current) return;
    const rid = roomId;
    engineRef.current.running = false;
    // final score flush
    if (rid && !botMode) void updateMyPlayerState(rid, uid, { score: scoreRef.current, connected: true });
    // give the opponent's final score flush time to settle in RTDB, then
    // compare from a FRESH read (not the possibly-stale live snapshot)
    setTimeout(async () => {
      if (botMode) {
        applyResult(finalLocalResult());
        return;
      }
      if (!rid) return;
      const fresh = await getFruitRoom(rid);
      const myFinal = scoreRef.current;
      const oppUid = oppRef.current?.uid ?? "";
      const oppFinal = fresh?.players?.[oppUid]?.score ?? oppScore;
      const res: FNResult =
        myFinal > oppFinal ? { winnerId: uid, loserId: oppUid, reason: "score", scores: { [uid]: myFinal, [oppUid]: oppFinal } }
        : myFinal < oppFinal ? { winnerId: oppUid, loserId: uid, reason: "score", scores: { [uid]: myFinal, [oppUid]: oppFinal } }
        : { draw: true, reason: "score", scores: { [uid]: myFinal, [oppUid]: oppFinal } };
      await ensureResult(rid, res);
      applyResult(fresh?.result ?? res);
      scheduleRoomCleanup(rid);
    }, 2000);
    // if the opponent computed the result first, their result node arrives via
    // the room subscription — watch for it
    if (roomId && !botMode) {
      const waitIv = setInterval(() => {
        const res = roomRef2.current?.result;
        if (res && !endedRef.current) { clearInterval(waitIv); applyResult(res); }
        if (endedRef.current) clearInterval(waitIv);
      }, 300);
      setTimeout(() => clearInterval(waitIv), 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }

  function finalLocalResult(): FNResult {
    const myFinal = scoreRef.current;
    const oppFinal = botScoreRef.current;
    setOppScore(oppFinal);
    return myFinal > oppFinal
      ? { winnerId: uid, reason: "score", scores: { [uid]: myFinal } }
      : myFinal < oppFinal
        ? { winnerId: "bot", reason: "score", scores: { [uid]: myFinal } }
        : { draw: true, reason: "score", scores: { [uid]: myFinal } };
  }

  async function finishWithForfeit(reason: "opponent-left" | "forfeit") {
    if (endedRef.current) return;
    const rid = roomId;
    if (rid) {
      await updateMyPlayerState(rid, uid, { score: scoreRef.current, connected: true });
      await ensureResult(rid, {
        winnerId: uid, loserId: oppRef.current?.uid, reason,
        scores: { [uid]: scoreRef.current, [oppRef.current?.uid ?? "opp"]: oppScore },
      });
      scheduleRoomCleanup(rid);
    }
    applyResult({ winnerId: uid, reason, scores: {} });
  }

  // ── quit mid-match ──────────────────────────────────────────────────────────
  async function quitMatch() {
    setQuitConfirm(false);
    cleanupFns();
    engineRef.current.running = false;
    if (roomId && !botMode) {
      await updateMyPlayerState(roomId, uid, { connected: false });
      await ensureResult(roomId, {
        winnerId: oppRef.current?.uid, loserId: uid, reason: "forfeit",
        scores: { [uid]: scoreRef.current, [oppRef.current?.uid ?? "opp"]: oppScore },
      });
      scheduleRoomCleanup(roomId);
      endedRef.current = true;
    }
    void setActiveRoom(uid, null);
    addMatch({
      gameId: "fruitninja2p", gameName: "Fruit Ninja 2P", gameIcon: "🍉",
      result: "loss", entryFee: 0, prize: 0,
      userScore: scoreRef.current, opponentScore: oppScore,
      opponentName: botMode ? "Practice Bot" : (oppRef.current?.name || "Player"),
    });
    onBack();
  }

  async function goHomeFromResult() {
    cleanupFns();
    if (roomId) scheduleRoomCleanup(roomId);
    void setActiveRoom(uid, null);
    onBack();
  }

  async function rematch() {
    cleanupFns();
    endedRef.current = false;
    setOutcome(null); setRoom(null);
    setMyScore(0); scoreRef.current = 0;
    setOppScore(0); botScoreRef.current = 0;
    setOpponent(null); setRoomId(null);
    setPhase("lobby");
  }

  // ═══ ENGINE LOOP ═══════════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== "countdown" && phase !== "playing") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // responsive sizing (DPR-aware)
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const e = engineRef.current;
      const scale = rect.width > 0 ? rect.height / Math.max(1, e.h || rect.height) : 1;
      if (e.w === 0) { e.w = rect.width; e.h = rect.height; }
      else if (Math.abs(e.w - rect.width) > 2 || Math.abs(e.h - rect.height) > 2) {
        // reposition pieces proportionally on resize
        const sx = rect.width / e.w, sy = rect.height / e.h;
        e.w = rect.width; e.h = rect.height;
        e.fruits.forEach((f) => { f.x *= sx; f.y *= sy; f.r *= scale; });
        e.halves.forEach((f) => { f.x *= sx; f.y *= sy; });
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();

    function spawn() {
      const e = engineRef.current;
      const r = Math.max(20, Math.min(40, e.h * 0.055));
      const isBomb = Math.random() < 0.14;
      const pick = FRUITS[Math.floor(Math.random() * FRUITS.length)];
      const x = r + Math.random() * (e.w - 2 * r);
      const y = e.h + r;
      // arc reaches ~75-85% of the screen height (apex physics: A = v²/2g)
      const vy = -(e.h * (0.027 + Math.random() * 0.008));
      const vx = ((e.w / 2 - x) / e.w) * (1.6 + Math.random() * 1.4) + (Math.random() - 0.5) * 1.2;
      e.fruits.push({
        kind: isBomb ? "bomb" : pick.kind,
        emoji: isBomb ? "💣" : pick.emoji,
        color: isBomb ? "#ef4444" : pick.color,
        x, y, vx, vy, r,
        rot: Math.random() * Math.PI * 2,
        rotV: (Math.random() - 0.5) * 0.003,
      });
    }

    function slice(f: Piece, idx: number) {
      const e = engineRef.current;
      if (e.frozen) return; // paused — no scoring at all
      e.fruits.splice(idx, 1);
      if (f.kind === "bomb") {
        // BOMB HIT — freeze MY gameplay for 3s; main timer keeps running
        pausedUntilRef.current = Date.now() + BOMB_PENALTY_MS;
        engineRef.current.frozen = true;
        setPenaltyLeft(3);
        sfxBomb(mutedRef.current);
        if (roomId && !botMode) void updateMyPlayerState(roomId, uid, { penaltyUntil: pausedUntilRef.current });
        return;
      }
      e.score += 1;
      scoreRef.current = e.score;
      setMyScore(e.score);
      sfxSlice(mutedRef.current);
      // split halves + juice
      for (const side of [-1, 1] as const) {
        e.halves.push({
          kind: f.kind, emoji: f.emoji, color: f.color,
          x: f.x, y: f.y,
          vx: f.vx * 0.6 + side * (0.9 + Math.random() * 0.7),
          vy: f.vy * 0.55 - 1.2,
          r: f.r, rot: f.rot, rotV: f.rotV + side * 0.004,
          side,
        });
      }
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        e.parts.push({ x: f.x, y: f.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, r: 2 + Math.random() * 4, color: f.color, life: 1 });
      }
      // throttled score write (~250ms)
      const now = Date.now();
      if (roomId && !botMode) {
        if (now - lastWriteRef.current >= 250) {
          lastWriteRef.current = now;
          void updateMyPlayerState(roomId, uid, { score: scoreRef.current });
        } else if (!pendingWriteRef.current) {
          pendingWriteRef.current = true;
          setTimeout(() => {
            pendingWriteRef.current = false;
            lastWriteRef.current = Date.now();
            if (roomId) void updateMyPlayerState(roomId, uid, { score: scoreRef.current });
          }, 250);
        }
      }
    }

    function checkSwipeSlices() {
      const e = engineRef.current;
      if (e.frozen) return;
      const tr = e.trail;
      if (tr.length < 2) return;
      for (let i = tr.length - 1; i > Math.max(0, tr.length - 9); i--) {
        if (e.frozen) break; // bomb hit mid-swipe ⇒ instant pause, no further scoring
        const b = tr[i], a = tr[i - 1];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 6) continue; // real swipes only
        for (let j = e.fruits.length - 1; j >= 0; j--) {
          if (e.frozen) break;
          const f = e.fruits[j];
          if (segDist(f.x, f.y, a.x, a.y, b.x, b.y) < f.r * 0.95) slice(f, j);
        }
      }
    }

    function drawFruit(c: CanvasRenderingContext2D, f: Piece) {
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.rot);
      if (f.side) {
        // sliced half — clip half-plane
        c.beginPath();
        if (f.side === -1) c.rect(-f.r * 1.2, -f.r * 1.2, f.r * 1.2, f.r * 2.4);
        else c.rect(0, -f.r * 1.2, f.r * 1.2, f.r * 2.4);
        c.clip();
      }
      c.font = `${f.r * 2}px "Segoe UI Emoji", "Noto Color Emoji", serif`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(f.emoji, 0, 0);
      c.restore();
    }

    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last);
      last = now;
      const e = engineRef.current;
      const c = ctx!;
      const k = dt / 16.667; // physics normalization

      // ── update ──
      if (e.running && !e.frozen) {
        e.elapsed += dt;
        // spawn rate ramps 650ms → 450ms across the 2 minutes
        const interval = Math.max(450, 650 - (e.elapsed / MATCH_DURATION_MS) * 200);
        e.spawnAcc += dt;
        while (e.spawnAcc >= interval) { e.spawnAcc -= interval; spawn(); }
      }
      if (!e.frozen) {
        const G = e.h * 0.00062;
        for (let i = e.fruits.length - 1; i >= 0; i--) {
          const f = e.fruits[i];
          f.vy += G * k;
          f.x += f.vx * k; f.y += f.vy * k; f.rot += f.rotV * k;
          if (f.y > e.h + f.r * 2 || f.x < -f.r * 3 || f.x > e.w + f.r * 3) e.fruits.splice(i, 1);
        }
        for (let i = e.halves.length - 1; i >= 0; i--) {
          const f = e.halves[i];
          f.vy += G * 1.4 * k;
          f.x += f.vx * k; f.y += f.vy * k; f.rot += f.rotV * k;
          if (f.y > e.h + f.r * 3) e.halves.splice(i, 1);
        }
        for (let i = e.parts.length - 1; i >= 0; i--) {
          const p = e.parts[i];
          p.vy += G * 0.9 * k;
          p.x += p.vx * k; p.y += p.vy * k; p.life -= 0.02 * k;
          if (p.life <= 0) e.parts.splice(i, 1);
        }
        checkSwipeSlices();
      }
      // trail always ages
      const cut = now - 120;
      while (e.trail.length && e.trail[0].t < cut) e.trail.shift();

      // ── draw ──
      c.clearRect(0, 0, e.w, e.h);
      const bg = c.createLinearGradient(0, 0, 0, e.h);
      bg.addColorStop(0, "#101828");
      bg.addColorStop(1, "#0a0f1c");
      c.fillStyle = bg;
      c.fillRect(0, 0, e.w, e.h);

      e.parts.forEach((p) => {
        c.globalAlpha = Math.max(0, p.life);
        c.fillStyle = p.color;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;
      e.halves.forEach((f) => drawFruit(c, f));
      e.fruits.forEach((f) => drawFruit(c, f));

      // blade trail
      if (e.trail.length > 1) {
        c.save();
        c.lineCap = "round";
        c.lineJoin = "round";
        for (let i = 1; i < e.trail.length; i++) {
          const a = e.trail[i - 1], b = e.trail[i];
          const w = 1 + (i / e.trail.length) * 9;
          c.strokeStyle = "rgba(255,255,255,0.85)";
          c.shadowColor = "#7dd3fc";
          c.shadowBlur = 12;
          c.lineWidth = w;
          c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
        }
        c.restore();
      }
    }
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── pointer handling (slice trail + bomb touch) ─────────────────────────────
  function canvasPos(ev: React.PointerEvent): { x: number; y: number } {
    const rect = (ev.target as HTMLCanvasElement).getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }
  function onPointerDown(ev: React.PointerEvent) {
    if (phase !== "playing" || penaltyLeft > 0) return;
    (ev.target as HTMLCanvasElement).setPointerCapture?.(ev.pointerId);
    const p = canvasPos(ev);
    const e = engineRef.current;
    e.trail.push({ ...p, t: Date.now() });
    // bomb TOUCH (tap) also triggers the penalty
    if (!e.frozen) {
      for (let i = e.fruits.length - 1; i >= 0; i--) {
        const f = e.fruits[i];
        if (f.kind === "bomb" && Math.hypot(f.x - p.x, f.y - p.y) < f.r) {
          pausedUntilRef.current = Date.now() + BOMB_PENALTY_MS;
          e.frozen = true;
          e.fruits.splice(i, 1);
          setPenaltyLeft(3);
          sfxBomb(mutedRef.current);
          if (roomId && !botMode) void updateMyPlayerState(roomId, uid, { penaltyUntil: pausedUntilRef.current });
          break;
        }
      }
    }
  }
  function onPointerMove(ev: React.PointerEvent) {
    if (phase !== "playing" || penaltyLeft > 0) return;
    if (ev.buttons === 0 && ev.pointerType === "mouse") return;
    const p = canvasPos(ev);
    engineRef.current.trail.push({ ...p, t: Date.now() });
  }
  function onPointerUp() {
    // trail ages out naturally
  }

  // ═══ RENDER ════════════════════════════════════════════════════════════════

  const oppName = opponent?.name || "Opponent";

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#0a0f1c", touchAction: "none" }}>
      {/* ── FIXED SCOREBOARD — always visible during match ── */}
      {(phase === "countdown" || phase === "playing" || phase === "result") && (
        <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2 shrink-0"
          style={{ background: "linear-gradient(180deg,#111827 0%, #0a0f1c 100%)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          {/* My score */}
          <div className="flex-1 min-w-0" data-testid="fn2p-me">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7dd3fc" }}>You</div>
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black leading-none" style={{ color: "#fff" }} data-testid="fn2p-my-score">{myScore}</span>
              <span className="text-[10px] text-white/50 truncate max-w-[70px]">{me.name}</span>
            </div>
            {oppPaused && phase === "playing" && (
              <div className="text-[9px] font-bold mt-0.5" style={{ color: "#fbbf24" }}>⏸ opponent paused</div>
            )}
          </div>
          {/* Timer */}
          <div className="flex flex-col items-center px-3 py-1 rounded-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Time</span>
            <span className="text-xl font-black leading-none tabular-nums"
              style={{ color: remainingMs <= 10_000 ? "#f87171" : "#FFD700" }} data-testid="fn2p-timer">
              {fmtTime(remainingMs)}
            </span>
          </div>
          {/* Opponent score */}
          <div className="flex-1 min-w-0 text-right" data-testid="fn2p-opp">
            <div className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: "#f9a8d4" }}>{oppName}</div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] text-white/50 truncate max-w-[70px]">{oppName}</span>
              <span className="text-2xl font-black leading-none" style={{ color: "#fff" }} data-testid="fn2p-opp-score">{oppScore}</span>
            </div>
          </div>
          {/* mute + quit */}
          <div className="flex flex-col gap-1 ml-1 shrink-0">
            <button onClick={() => setMuted((m) => !m)} className="text-sm px-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.08)" }}>{muted ? "🔇" : "🔊"}</button>
            {(phase === "countdown" || phase === "playing") && (
              <button onClick={() => setQuitConfirm(true)} className="text-sm px-1 rounded-lg"
                style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.35)" }}>✕</button>
            )}
          </div>
        </div>
      )}

      {/* ── GAME AREA ── */}
      <div ref={wrapRef} className="relative flex-1 min-h-0">
        {(phase === "countdown" || phase === "playing") && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: "none" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        )}

        {/* countdown overlay (3-2-1) */}
        <AnimatePresence>
          {phase === "countdown" && (
            <motion.div key="cd" className="absolute inset-0 flex flex-col items-center justify-center z-10"
              style={{ background: "rgba(10,15,28,0.72)" }}
              exit={{ opacity: 0 }}>
              <div className="text-sm font-bold tracking-widest text-white/60 uppercase mb-2">Get Ready</div>
              <motion.div key={countdownNum}
                initial={{ scale: 2.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-8xl font-black" style={{ color: "#FFD700" }}>
                {Math.max(1, countdownNum)}
              </motion.div>
              <div className="mt-3 text-xs text-white/50">Slicing starts in a moment…</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BOMB HIT overlay — only the hitting player sees this */}
        <AnimatePresence>
          {penaltyLeft > 0 && phase === "playing" && (
            <motion.div key="bomb" className="absolute inset-0 flex flex-col items-center justify-center z-20"
              style={{ background: "rgba(60,10,10,0.78)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 0.6 }}
                className="text-7xl mb-2">💣</motion.div>
              <div className="text-2xl font-black text-center px-4" style={{ color: "#fca5a5" }}>BOMB HIT!</div>
              <div className="text-lg font-black text-white mt-1">WAIT 3 SECONDS</div>
              <motion.div key={penaltyLeft} initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="text-7xl font-black mt-2" style={{ color: "#f87171" }}>
                {penaltyLeft}
              </motion.div>
              <div className="text-[11px] text-white/50 mt-2">Match timer keeps running ⏱</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 overflow-y-auto">
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-7xl mb-1">🍉</motion.div>
            <h1 className="text-3xl font-black text-white">Fruit Ninja <span style={{ color: "#FFD700" }}>2P</span></h1>
            <p className="text-xs text-white/50 mt-1 text-center">Real-time 1v1 · 2-minute match · FREE entry</p>

            <div className="w-full max-w-xs mt-7 flex flex-col gap-3">
              <motion.button whileTap={{ scale: 0.96 }} onClick={startSearch}
                className="w-full py-3.5 rounded-2xl font-black text-base text-white"
                style={{ background: "linear-gradient(135deg,#f97316,#ef4444)", boxShadow: "0 6px 24px rgba(239,68,68,0.35)" }}>
                ⚡ Play Online (2 min)
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={startBot}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}>
                🤖 Practice vs Bot
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "transparent", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                ← Back to Home
              </motion.button>
            </div>

            <div className="mt-6 text-[11px] text-white/40 text-center leading-relaxed max-w-xs">
              🍎 Slice fruits with a swipe — each is +1 point<br />
              💣 Bomb hit = your game pauses 3 seconds!<br />
              ⏱ Highest score at 00:00 wins
            </div>
          </div>
        )}

        {/* ── SEARCHING ── */}
        {phase === "searching" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <motion.div animate={{ rotate: [0, 12, -12, 0], scale: [1, 1.08, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }} className="text-6xl mb-4">🔎</motion.div>
            <div className="text-lg font-black text-white">Finding an opponent…</div>
            <div className="text-xs text-white/40 mt-1">{searchElapsed}s elapsed · FREE entry</div>
            <div className="mt-5 w-48 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div className="h-full" style={{ background: "linear-gradient(90deg,#f97316,#ef4444)" }}
                animate={{ width: `${Math.min(100, (searchElapsed / (QUEUE_WAIT_MS / 1000)) * 100)}%` }}
                transition={{ ease: "linear" }} />
            </div>

            {noOpponent ? (
              <div className="mt-7 flex flex-col gap-2.5 w-full max-w-xs">
                <div className="text-center text-xs text-white/60">No player found right now.</div>
                <motion.button whileTap={{ scale: 0.96 }} onClick={keepSearching}
                  className="w-full py-3 rounded-2xl font-black text-sm text-white"
                  style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}>
                  🔄 Keep Searching
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={startBot}
                  className="w-full py-3 rounded-2xl font-bold text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}>
                  🤖 Practice vs Bot instead
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={cancelSearch}
                  className="w-full py-2.5 rounded-2xl font-bold text-xs"
                  style={{ color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                  Cancel
                </motion.button>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.96 }} onClick={cancelSearch}
                className="mt-8 px-6 py-2.5 rounded-2xl font-bold text-xs"
                style={{ color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                Cancel search
              </motion.button>
            )}
          </div>
        )}

        {/* ── RESULT ── */}
        {phase === "result" && outcome && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center px-6 z-30"
            style={{ background: "rgba(10,15,28,0.92)" }}>
            <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 14 }} className="text-7xl mb-2">
              {outcome.outcome === "win" ? "🏆" : outcome.outcome === "draw" ? "🤝" : "💥"}
            </motion.div>
            <div className="text-3xl font-black"
              style={{ color: outcome.outcome === "win" ? "#FFD700" : outcome.outcome === "draw" ? "#e5e7eb" : "#f87171" }}>
              {outcome.outcome === "win" ? "YOU WIN!" : outcome.outcome === "draw" ? "DRAW!" : "YOU LOSE"}
            </div>
            {(outcome.reason === "opponent-left" || outcome.reason === "forfeit") && (
              <div className="text-[11px] text-white/50 mt-1">
                {outcome.reason === "opponent-left" ? "Opponent disconnected — win by forfeit" : "Match ended by forfeit"}
              </div>
            )}

            <div className="flex items-center gap-6 mt-6 px-8 py-4 rounded-3xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-white/50 mb-1">You</div>
                <div className="text-4xl font-black" style={{ color: "#7dd3fc" }}>{outcome.myScore}</div>
              </div>
              <div className="text-white/25 font-black text-lg">vs</div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase text-white/50 mb-1 truncate max-w-[90px]">{oppName}</div>
                <div className="text-4xl font-black" style={{ color: "#f9a8d4" }}>{outcome.oppScore}</div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-2.5 w-full max-w-xs">
              <motion.button whileTap={{ scale: 0.96 }} onClick={rematch}
                className="w-full py-3.5 rounded-2xl font-black text-sm text-white"
                style={{ background: "linear-gradient(135deg,#f97316,#ef4444)" }}>
                🔄 Rematch
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={goHomeFromResult}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}>
                🏠 Back to Home
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* quit confirm */}
        <AnimatePresence>
          {quitConfirm && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 flex items-center justify-center px-8"
              style={{ background: "rgba(0,0,0,0.7)" }}>
              <div className="w-full max-w-xs rounded-3xl p-5 text-center"
                style={{ background: "#141b2d", border: "1px solid rgba(255,255,255,0.12)" }}>
                <div className="text-2xl mb-2">🚪</div>
                <div className="font-black text-white mb-1">Quit the match?</div>
                <div className="text-[11px] text-white/50 mb-4">Leaving now counts as a loss (forfeit).</div>
                <div className="flex gap-2">
                  <button onClick={() => setQuitConfirm(false)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb" }}>Stay</button>
                  <button onClick={quitMatch}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm text-white"
                    style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>Quit</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
