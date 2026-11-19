/**
 * 2 Player Ludo Game (WINGGO)
 * ─────────────────────────────────────────────────────────────────────────────
 * Hosts the OWNER'S ORIGINAL Ludo game (source: the user's own
 * `ludo-game-using-html-css-and-javascript` project — used with permission).
 * The original code lives in `src/games/ludo2p/` with only minimal documented
 * integration hooks; the board, dice, tokens, colors, animations and rules
 * are the original ones.
 *
 * Winggo integration (free entry, NO cash wagering):
 *   - Original hot-seat 4-player board → 2-player online: P1 (blue) vs P2
 *     (green), the first two players of the original TURN_ORDER [0,2,1,3].
 *     P3 (red) / P4 (yellow) never play — their homes sit empty (tokens hidden).
 *   - Free matchmaking over RTDB (ld2p* paths) mirroring fruitninja.service.
 *   - The current player's client streams turn/dice/positions (incl. every
 *     200ms step) to RTDB; the opponent's client replays them so BOTH screens
 *     show the same 3D dice roll and step-by-step token movement.
 *   - First to bring all 4 tokens home wins (original rule). Disconnect
 *     >7s or an inactive turn >75s ⇒ win by forfeit for the other side.
 *   - Practice vs Bot: fully local, same engine, no RTDB writes.
 *   - Resume via ld2pPlayer/{uid}/activeRoom.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/useAuth";
import { useMatchHistory } from "@/context/useMatchHistory";
import {
  joinLudoQueue, cancelLudoQueue, completePairing, waitForPair,
  ensureRoom, subscribeLudoRoom, subscribeQueueEntry, getLudoRoom,
  writeLudoGame, updateMyPlayerState, attachDisconnectHandlers,
  ensureResult, scheduleRoomCleanup, setActiveRoom, getActiveRoom,
  getServerTimeOffset, QUEUE_WAIT_MS, TURN_TIMEOUT_MS,
  type L2PRoom, type L2PPlayerInfo, type L2PGameState, type L2PResult, type L2PSlot,
} from "@/firebase/ludo2p.service";
import { Ludo } from "@/games/ludo2p/Ludo.js";
import { PLAYERS, STATE, HOME_POSITIONS } from "@/games/ludo2p/constants.js";
import "@/games/ludo2p/style.css";
import "@/games/ludo2p/integration-overrides.css";

type Phase = "lobby" | "searching" | "countdown" | "playing" | "result";

interface MatchOutcome {
  outcome: "win" | "loss" | "draw";
  myScore: number;      // my tokens home (0-4)
  oppScore: number;     // opponent tokens home
  reason?: L2PResult["reason"];
}

const SEAT_PLAYERS = ["P1", "P2"] as const; // 2-player seats: blue vs green
// Composite = board (450px) + one dice gutter on each side (72px), so each
// player's dice sits OUTSIDE the board right beside its own home — green at
// the top-right corner, blue at the bottom-left corner (like the owner's
// marked screenshot). The whole composite scales as ONE unit.
const DICE_GUTTER = 80;
const COMPOSITE_W = 450 + DICE_GUTTER * 2; // 610

// original board colors (style.css): P1 blue base, P2 green base
const COLOR_P1 = "#1295e7";
const COLOR_P2 = "#049645";

function clonePositions(p: Record<string, number[]> | null | undefined): Record<string, number[]> {
  return JSON.parse(JSON.stringify(p ?? {}));
}

function piecesHomeFor(positions: Record<string, number[]> | null | undefined, seatPlayer: string): number {
  const arr = positions?.[seatPlayer] ?? [];
  const home = (HOME_POSITIONS as Record<string, number>)[seatPlayer];
  return arr.filter((p) => p === home).length;
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function Ludo2PGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const { addMatch } = useMatchHistory();

  const uid = user?.uid ?? "demo-uid";
  const me: L2PPlayerInfo = {
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
  const [opponent, setOpponent] = useState<L2PPlayerInfo | null>(null);
  const [mySeat, setMySeat] = useState<0 | 1>(0); // 0 = P1 (blue), 1 = P2 (green)
  const [turnPlayer, setTurnPlayer] = useState<string>("P1");
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null);
  const [quitConfirm, setQuitConfirm] = useState(false);
  const [countdownNum, setCountdownNum] = useState(3);
  const [scale, setScale] = useState(1);
  const [boardH, setBoardH] = useState(0);
  const [muted, setMuted] = useState(false);

  // ── refs (stable closures for engine hooks) ─────────────────────────────────
  const phaseRef = useRef<Phase>(phase); phaseRef.current = phase;
  const endedRef = useRef(false);
  const botModeRef = useRef(false); botModeRef.current = botMode;
  const roomIdRef = useRef<string | null>(null); roomIdRef.current = roomId;
  const oppRef = useRef<L2PPlayerInfo | null>(null); oppRef.current = opponent;
  const mySeatRef = useRef<0 | 1>(0); mySeatRef.current = mySeat;
  const mySeatPlayerRef = useRef<string>("P1");
  mySeatPlayerRef.current = SEAT_PLAYERS[mySeat === 0 ? 0 : 1];
  const offsetRef = useRef(0);
  const engineRef = useRef<Ludo | null>(null);
  const engineKeyRef = useRef<string>("");
  const gameRef = useRef<L2PGameState | null>(null);
  const roomRef2 = useRef<L2PRoom | null>(null);
  const turnStartedAtRef = useRef<number>(0);
  const botActingRef = useRef(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubsRef = useRef<Array<() => void>>([]);
  const boardRootRef = useRef<HTMLDivElement | null>(null);
  const scaleOuterRef = useRef<HTMLDivElement | null>(null);
  const scaleInnerRef = useRef<HTMLDivElement | null>(null);

  const mySeatPlayer = SEAT_PLAYERS[mySeat === 0 ? 0 : 1];
  const oppSeatPlayer = mySeatPlayer === "P1" ? "P2" : "P1";

  function cleanupFns() {
    unsubsRef.current.forEach((u) => { try { u(); } catch {} });
    unsubsRef.current = [];
    if (botTimerRef.current) { clearTimeout(botTimerRef.current); botTimerRef.current = null; }
  }

  // ── result handling ─────────────────────────────────────────────────────────
  const applyResultRef = useRef<(res: L2PResult, fromRoom?: boolean) => void>(() => {});

  function computePiecesHome(): { my: number; opp: number } {
    // prefer the LIVE engine state (bot mode has no RTDB game node)
    const e = engineRef.current;
    const src = e ? e.currentPositions : gameRef.current?.positions;
    const my = piecesHomeFor(src, mySeatPlayerRef.current);
    const opp = piecesHomeFor(src, mySeatPlayerRef.current === "P1" ? "P2" : "P1");
    return { my, opp };
  }

  function applyResult(res: L2PResult, fromRoom = false) {
    if (endedRef.current) return;
    endedRef.current = true;
    const isBot = botModeRef.current || !roomIdRef.current;
    const { my, opp } = computePiecesHome();
    let oc: MatchOutcome;
    if (res.draw) oc = { outcome: "draw", myScore: my, oppScore: opp, reason: res.reason };
    else if (res.winnerId === uid) oc = { outcome: "win", myScore: my, oppScore: opp, reason: res.reason };
    else oc = { outcome: "loss", myScore: my, oppScore: opp, reason: res.reason };
    setOutcome(oc);
    setPhase("result");
    void setActiveRoom(uid, null);
    if (roomIdRef.current) scheduleRoomCleanup(roomIdRef.current);
    // draw is stored as a loss with zero prize (history type supports win/loss)
    addMatch({
      gameId: "ludo2p", gameName: "2 Player Ludo Game", gameIcon: "🎲",
      result: oc.outcome === "win" ? "win" : "loss",
      entryFee: 0, prize: 0,
      userScore: my, opponentScore: opp,
      opponentName: isBot ? "Practice Bot" : (oppRef.current?.name || "Player"),
      roomId: isBot ? undefined : (roomIdRef.current ?? undefined),
    });
    void fromRoom;
  }
  applyResultRef.current = applyResult;

  // ── room subscription (game-state sync) ─────────────────────────────────────
  useEffect(() => {
    if (!roomId || botMode) return;
    const un = subscribeLudoRoom(roomId, (r) => {
      roomRef2.current = r;
      if (!r) return;
      const oppUid = Object.keys(r.players ?? {}).find((u) => u !== uid);
      if (oppUid && !oppRef.current) {
        setOpponent({ uid: oppUid, name: r.players[oppUid]?.name || "Player", photo: r.players[oppUid]?.photo || "" });
      }
      const g = r.game;
      if (g) {
        gameRef.current = g;
        turnStartedAtRef.current = g.turnStartedAt || 0;
        if (g.lastWriter && g.lastWriter !== uid) applyRemoteGame(g);
        setTurnPlayer(g.turnPlayer);
      }
      if (r.status === "finished" && r.result && !endedRef.current) {
        applyResultRef.current(r.result, true);
      }
    });
    unsubsRef.current.push(un);
    return () => { un(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, botMode]);

  /** Replay the opponent's writes so both screens match (dice + steps + turn). */
  function applyRemoteGame(g: L2PGameState) {
    const e = engineRef.current;
    if (!e) return;
    if (g.positions) e.applyExternalPositions(g.positions);
    if (g.diceValue != null && e.diceValue !== g.diceValue) {
      e.externalRoll(g.turnPlayer ?? PLAYERS[e.turn], g.diceValue);
    }
    if (PLAYERS[e.turn] !== g.turnPlayer) e.applyExternalTurn(g.turn);
  }

  // ── searching elapsed ticker ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "searching") return;
    const iv = setInterval(() => setSearchElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [phase]);

  // ── server-time offset (once, before any match starts) ──────────────────────
  const offsetReadyRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    offsetReadyRef.current = getServerTimeOffset().then((off) => { offsetRef.current = off; });
  }, []);

  // ── ENGINE INIT (once per match, after the original markup mounts) ──────────
  useEffect(() => {
    if (phase !== "countdown" && phase !== "playing") return;
    const root = boardRootRef.current;
    if (!root) return;
    const key = botMode ? "bot" : (roomId ?? "");
    if (engineKeyRef.current === key && engineRef.current) return;
    // destroy any previous engine (rematch / new search)
    if (engineRef.current) { try { engineRef.current.destroy(); } catch {} }
    engineKeyRef.current = key;

    const engine = new Ludo();
    engineRef.current = engine;

    engine.hooks = {
      canRoll: () => {
        if (endedRef.current || phaseRef.current !== "playing") return false;
        const e = engineRef.current;
        if (!e) return false;
        if (e.state !== STATE.DICE_NOT_ROLLED) return false;
        if (botModeRef.current) return e.turn === 0 || botActingRef.current; // my seat + bot scheduler
        return e.turn === mySeatRef.current;
      },
      canAct: (player: string) => {
        if (botModeRef.current) {
          // my tokens are always mine; bot tokens only via the bot scheduler
          if (player === "P1") return true;
          if (player === "P2") return botActingRef.current;
          return false;
        }
        return player === mySeatPlayerRef.current;
      },
      onPosition: (_player: string, _piece: number, _position: number) => {
        const e = engineRef.current;
        if (botModeRef.current || !roomIdRef.current || !e) return;
        void writeLudoGame(roomIdRef.current!, uid, { positions: clonePositions(e.currentPositions) });
      },
      onDiceRolled: (value: number) => {
        const e = engineRef.current;
        if (botModeRef.current || !roomIdRef.current || !e) return;
        void writeLudoGame(roomIdRef.current!, uid, {
          diceValue: value,
          eligible: e.getEligiblePieces(PLAYERS[e.turn]),
        });
      },
      onTurnChange: (playerIndex: number) => {
        const p = PLAYERS[playerIndex];
        setTurnPlayer(p);
        const e = engineRef.current;
        if (botModeRef.current || !roomIdRef.current) return;
        void writeLudoGame(roomIdRef.current!, uid, {
          turn: playerIndex,
          turnPlayer: (p === "P1" ? "P1" : "P2") as "P1" | "P2",
          turnStartedAt: Date.now() + offsetRef.current,
          diceValue: null,
          eligible: null,
          positions: e ? clonePositions(e.currentPositions) : undefined,
        });
      },
      onWin: (player: string) => {
        handleWin(player);
      },
    };

    // restore state (fresh room = base positions; resume = live positions)
    const g = gameRef.current;
    engine.resetFromState(g?.positions ?? null, g ? g.turn : 0);
    if (g?.diceValue != null) {
      engine.externalRoll(g.turnPlayer ?? PLAYERS[g.turn] ?? "P1", g.diceValue);
    }
    setTurnPlayer(PLAYERS[engine.turn]);
    // debug/test hook (also used by the repro drivers)
    (window as unknown as Record<string, unknown>).__ld2pEngine = engine;
    (window as unknown as Record<string, unknown>).__ld2pSeat = mySeatPlayerRef.current;

    return () => {
      // keep the engine alive through "result" so the final board stays visible
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, botMode, roomId]);

  // destroy the engine when leaving to lobby (rematch/cancel)
  useEffect(() => {
    if (phase !== "lobby") return;
    if (engineRef.current) { try { engineRef.current.destroy(); } catch {} engineRef.current = null; }
    engineKeyRef.current = "";
    delete (window as unknown as Record<string, unknown>).__ld2pEngine;
    delete (window as unknown as Record<string, unknown>).__ld2pSeat;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ── win: the mover's engine calls this (original rule: 4 tokens home) ───────
  function handleWin(player: string) {
    if (endedRef.current) return;
    const e = engineRef.current;
    const positions = e ? clonePositions(e.currentPositions) : undefined;
    const winnerSeatIdx = player === "P1" ? 0 : 1;
    const loserSeatPlayer = player === "P1" ? "P2" : "P1";
    const piecesHome: Record<string, number> = {
      [player]: piecesHomeFor(positions, player),
      [loserSeatPlayer]: piecesHomeFor(positions, loserSeatPlayer),
    };
    let winnerUid = uid;
    if (!botModeRef.current && roomRef2.current?.players) {
      const found = Object.entries(roomRef2.current.players).find(([, p]) => p.seat === winnerSeatIdx);
      if (found) winnerUid = found[0];
    } else if (botModeRef.current && player !== mySeatPlayerRef.current) {
      winnerUid = "bot";
    }
    const loserUid = botModeRef.current ? (winnerUid === "bot" ? uid : "bot")
      : Object.keys(roomRef2.current?.players ?? {}).find((u) => u !== uid) ?? "";
    const res: L2PResult = { winnerId: winnerUid, loserId: loserUid, reason: "home", piecesHome };
    if (!botModeRef.current && roomIdRef.current) void ensureResult(roomIdRef.current, res);
    applyResult(res);
  }

  // ── countdown clock (server-authoritative turnStartedAt) ────────────────────
  useEffect(() => {
    if (phase !== "countdown" && phase !== "playing") return;
    const iv = setInterval(() => {
      const startedAt = turnStartedAtRef.current;
      if (!startedAt) return;
      // bot mode runs entirely on the local clock — mixing in a server offset
      // that resolves LATE would bounce the phase back into "countdown"
      const serverNow = Date.now() + (botModeRef.current ? 0 : offsetRef.current);
      if (serverNow < startedAt) {
        if (phaseRef.current !== "result") setPhase((p) => (p === "result" ? p : "countdown"));
        const n = Math.max(1, Math.ceil((startedAt - serverNow) / 1000));
        setCountdownNum((prev) => (prev === n ? prev : n));
        return;
      }
      if (phaseRef.current === "countdown") setPhase("playing");
    }, 100);
    return () => clearInterval(iv);
  }, [phase]);

  // ── forfeit watcher: opponent gone >7s during play ⇒ I win ──────────────────
  useEffect(() => {
    if (phase !== "playing" || botMode || !roomId) return;
    const iv = setInterval(() => {
      const r = roomRef2.current;
      const opp = oppRef.current;
      if (!r?.players || !opp || opp.uid === "bot") return;
      const oppState = r.players[opp.uid];
      if (!oppState) return;
      const serverNow = Date.now() + offsetRef.current;
      if (oppState.connected === false && serverNow - (oppState.lastSeen || 0) > 7000) {
        void finishWithForfeit("opponent-left");
      }
    }, 1500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, botMode, roomId]);

  // ── turn-timeout watcher: inactive current turn >75s ⇒ I win ────────────────
  useEffect(() => {
    if (phase !== "playing" || botMode || !roomId) return;
    const iv = setInterval(() => {
      const g = gameRef.current;
      if (!g || !g.turnStartedAt) return;
      if (g.turnPlayer === mySeatPlayerRef.current) return; // my own turn — no claim
      const serverNow = Date.now() + offsetRef.current;
      if (serverNow - g.turnStartedAt > TURN_TIMEOUT_MS) {
        void finishWithForfeit("turn-timeout");
      }
    }, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, botMode, roomId]);

  // ── turn-started mirror for bot mode (local clock) ──────────────────────────
  useEffect(() => {
    if (!botMode) return;
    if (phaseRef.current !== "playing") return; // don't clobber the countdown clock
    turnStartedAtRef.current = Date.now();
  }, [turnPlayer, botMode]);

  async function finishWithForfeit(reason: "opponent-left" | "turn-timeout") {
    if (endedRef.current) return;
    const rid = roomIdRef.current;
    if (rid) {
      await ensureResult(rid, {
        winnerId: uid,
        loserId: oppRef.current?.uid,
        reason,
        piecesHome: {
          [mySeatPlayerRef.current]: piecesHomeFor(engineRef.current?.currentPositions ?? gameRef.current?.positions, mySeatPlayerRef.current),
          [oppSeatPlayer]: piecesHomeFor(engineRef.current?.currentPositions ?? gameRef.current?.positions, oppSeatPlayer),
        },
      });
    }
    applyResult({ winnerId: uid, reason });
  }

  // ── start online match ──────────────────────────────────────────────────────
  const startSearch = useCallback(async () => {
    setBotMode(false);
    setNoOpponent(false);
    setSearchElapsed(0);
    setOutcome(null); endedRef.current = false;
    setPhase("searching");
    try {
      if (offsetReadyRef.current) await offsetReadyRef.current; // clock must be settled before writing turnStartedAt
      const { roomId: rid, isCreator, opponent: joinedOpp } = await joinLudoQueue(me, offsetRef.current);
      if (phaseRef.current !== "searching") { await cancelLudoQueue(rid, uid); return; }
      setRoomId(rid);
      if (!isCreator && joinedOpp) {
        // JOINER — seat 1 (P2 green); finalize the pair and create the room
        setMySeat(1);
        const mySlot: L2PSlot = { ...me, seat: 1 };
        const done = await completePairing(rid, mySlot, offsetRef.current);
        if (!done) {
          await cancelLudoQueue(rid, uid);
          setRoomId(null);
          setTimeout(() => { if (phaseRef.current === "searching") void startSearch(); }, 600);
          return;
        }
        setOpponent(joinedOpp);
        attachMatchHandlers(rid);
        setPhase("countdown");
        return;
      }
      // CREATOR — seat 0 (P1 blue); watch my entry for a joiner (up to 10s)
      setMySeat(0);
      const opp = await waitForPair(rid, uid, QUEUE_WAIT_MS);
      if (phaseRef.current !== "searching") { await cancelLudoQueue(rid, uid); return; }
      if (opp) {
        setOpponent(opp);
        await ensureRoom(rid, [{ ...me, seat: 0 }, { ...opp, seat: 1 }], offsetRef.current);
        attachMatchHandlers(rid);
        setPhase("countdown");
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
    if (phaseRef.current !== "searching") { await cancelLudoQueue(roomId, uid); return; }
    if (opp) {
      setOpponent(opp);
      await ensureRoom(roomId, [{ ...me, seat: 0 }, { ...opp, seat: 1 }], offsetRef.current);
      attachMatchHandlers(roomId);
      setPhase("countdown");
    } else {
      setNoOpponent(true);
    }
  }

  async function cancelSearch() {
    cleanupFns();
    if (roomId && !botMode) await cancelLudoQueue(roomId, uid);
    setRoomId(null); setOpponent(null); setNoOpponent(false);
    setPhase("lobby");
  }

  function attachMatchHandlers(rid: string) {
    cleanupFns();
    unsubsRef.current.push(attachDisconnectHandlers(rid, uid));
    void updateMyPlayerState(rid, uid, { connected: true });
    void setActiveRoom(uid, rid);
    const hb = setInterval(() => {
      if (phaseRef.current === "playing" || phaseRef.current === "countdown") {
        void updateMyPlayerState(rid, uid, { connected: true });
      }
    }, 4000);
    unsubsRef.current.push(() => clearInterval(hb));
  }

  // ── practice vs bot (fully local — no RTDB writes) ──────────────────────────
  function startBot() {
    if (roomId) { void cancelLudoQueue(roomId, uid); setRoomId(null); }
    cleanupFns();
    setBotMode(true);
    setOpponent({ uid: "bot", name: "Practice Bot", photo: "" });
    setMySeat(0);
    setTurnPlayer("P1");
    setOutcome(null); endedRef.current = false;
    setRoomId(null);
    gameRef.current = null;
    roomRef2.current = null;
    turnStartedAtRef.current = Date.now() + 3000;
    setPhase("countdown");
  }

  // ── bot scheduler (drives P2 through the SAME original engine) ──────────────
  useEffect(() => {
    if (!botMode || (phase !== "playing" && phase !== "countdown")) return;
    const schedule = (fn: () => void, ms: number) => {
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
      botTimerRef.current = setTimeout(fn, ms);
    };
    const botStep = () => {
      const e = engineRef.current;
      if (!e || endedRef.current) return;
      if (phaseRef.current !== "playing") { schedule(botStep, 500); return; }
      if (e.turn !== 1) { schedule(botStep, 500); return; } // my turn — wait
      if (e.state === STATE.DICE_NOT_ROLLED) {
        botActingRef.current = true;
        e.onDiceClick("P2"); // bot rolls ITS OWN green dice — guard passes via botActing
        botActingRef.current = false;
        schedule(botStep, 1150);
        return;
      }
      // dice rolled — pick a random eligible piece (highlights show them)
      const elig = e.getEligiblePieces("P2");
      if (elig.length) {
        botActingRef.current = true;
        e.handlePieceClick("P2", elig[Math.floor(Math.random() * elig.length)]);
        botActingRef.current = false;
        schedule(botStep, 1500);
      } else {
        schedule(botStep, 400); // no eligible → engine advanced the turn already
      }
    };
    schedule(botStep, 1200);
    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botMode, phase]);

  // ── resume: rejoin an interrupted match on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await getActiveRoom(uid);
      if (!saved || cancelled) return;
      const un = subscribeLudoRoom(saved, (r) => {
        un();
        if (cancelled) return;
        if (!r || !r.players || !r.game) {
          void setActiveRoom(uid, null);
          return;
        }
        const oppUid = Object.keys(r.players).find((u) => u !== uid);
        if (!oppUid) { void setActiveRoom(uid, null); return; }
        const mine = r.players[uid];
        setMySeat(mine?.seat === 1 ? 1 : 0);
        setOpponent({ uid: oppUid, name: r.players[oppUid]?.name || "Player", photo: r.players[oppUid]?.photo || "" });
        gameRef.current = r.game;
        roomRef2.current = r;
        turnStartedAtRef.current = r.game.turnStartedAt || 0;
        setRoomId(saved);
        if (r.status === "finished" && r.result) {
          applyResultRef.current(r.result, true);
        } else {
          attachMatchHandlers(saved);
          setPhase("countdown");
        }
      });
      unsubsRef.current.push(un);
      setTimeout(() => { if (!roomRef2.current) void setActiveRoom(uid, null); }, 4000);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── quit mid-match ──────────────────────────────────────────────────────────
  async function quitMatch() {
    setQuitConfirm(false);
    cleanupFns();
    if (roomIdRef.current && !botMode) {
      await updateMyPlayerState(roomIdRef.current, uid, { connected: false });
      await ensureResult(roomIdRef.current, {
        winnerId: oppRef.current?.uid, loserId: uid, reason: "forfeit",
        piecesHome: {
          [mySeatPlayerRef.current]: piecesHomeFor(engineRef.current?.currentPositions ?? gameRef.current?.positions, mySeatPlayerRef.current),
          [oppSeatPlayer]: piecesHomeFor(engineRef.current?.currentPositions ?? gameRef.current?.positions, oppSeatPlayer),
        },
      });
      scheduleRoomCleanup(roomIdRef.current);
      endedRef.current = true;
    }
    void setActiveRoom(uid, null);
    const { my, opp } = computePiecesHome();
    addMatch({
      gameId: "ludo2p", gameName: "2 Player Ludo Game", gameIcon: "🎲",
      result: "loss", entryFee: 0, prize: 0,
      userScore: my, opponentScore: opp,
      opponentName: botMode ? "Practice Bot" : (oppRef.current?.name || "Player"),
      roomId: botMode ? undefined : (roomIdRef.current ?? undefined),
    });
    if (engineRef.current) { try { engineRef.current.destroy(); } catch {} engineRef.current = null; }
    onBack();
  }

  async function goHomeFromResult() {
    cleanupFns();
    if (roomIdRef.current) scheduleRoomCleanup(roomIdRef.current);
    void setActiveRoom(uid, null);
    if (engineRef.current) { try { engineRef.current.destroy(); } catch {} engineRef.current = null; }
    onBack();
  }

  function rematch() {
    cleanupFns();
    endedRef.current = false;
    setOutcome(null);
    setOpponent(null); setRoomId(null);
    gameRef.current = null; roomRef2.current = null;
    setPhase("lobby");
  }

  // ── responsive scale of the ORIGINAL fixed 450px board ──────────────────────
  useEffect(() => {
    if (!(phase === "countdown" || phase === "playing" || phase === "result")) return;
    const outer = scaleOuterRef.current;
    const inner = scaleInnerRef.current;
    if (!outer || !inner) return;
    const rootEl = inner.firstElementChild as HTMLElement | null;
    const update = () => {
      // The composite (board + dice gutters) is scaled as ONE unit; measure the
      // .ludo2p-root child (NOT inner itself): inner is a stretched flex item
      // of outer, so its offsetHeight feeds back into outer's height.
      const s = Math.min(1, outer.clientWidth / (COMPOSITE_W + 8));
      setScale(s);
      setBoardH((rootEl ? rootEl.offsetHeight : inner.offsetHeight) * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(rootEl ?? inner);
    return () => ro.disconnect();
  }, [phase, outcome]);

  const showBoard = phase === "countdown" || phase === "playing" || phase === "result";
  const myTurn = phase === "playing" && turnPlayer === mySeatPlayer;
  const myHome = piecesHomeFor(gameRef.current?.positions, mySeatPlayer);
  const oppHome = piecesHomeFor(gameRef.current?.positions, oppSeatPlayer);

  // ═══ RENDER ══════════════════════════════════════════════════════════════════
  return (
    <div className="fixed inset-0 z-40 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(180deg,#0a0f1c 0%,#101828 100%)" }}>

      {/* ── header ── */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 shrink-0">
        <button onClick={() => { if (phase === "playing" || phase === "countdown") setQuitConfirm(true); else onBack(); }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-black shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
          data-testid="ld2p-back">✕</button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white truncate">2 Player Ludo Game</div>
          <div className="text-[10px] font-bold" style={{ color: "#FFD700" }}>FREE ENTRY · ORIGINAL BOARD</div>
        </div>
        <button onClick={() => setMuted((m) => !m)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
          {muted ? "🔇" : "🔊"}
        </button>
      </div>

      {/* ── scoreboard (You vs Opponent) ── */}
      {showBoard && (
        <div className="flex items-center gap-2 px-4 pb-2 shrink-0" data-testid="ld2p-scoreboard">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#2eafff" }}>You ({mySeatPlayer})</div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black leading-none text-white" data-testid="ld2p-my-score">{myHome}</span>
              <span className="text-[10px] text-white/50 truncate max-w-[80px]">{me.name}</span>
            </div>
          </div>
          <div className="text-center shrink-0">
            <div className={"text-[10px] font-black px-2.5 py-1 rounded-full " + (myTurn ? "" : "opacity-50")}
              style={{ background: myTurn ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.06)", color: myTurn ? "#FFD700" : "#9ca3af" }}
              data-testid="ld2p-turn">
              {phase === "result" ? "ENDED" : phase === "countdown" ? "GET READY…" : myTurn ? "YOUR TURN 🎲" : "OPPONENT'S TURN"}
            </div>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-wider truncate" style={{ color: COLOR_P2 }}>
              {botMode ? "Practice Bot" : (opponent?.name || "Opponent")} ({oppSeatPlayer})
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-[10px] text-white/50 truncate max-w-[80px]">{botMode ? "Practice Bot" : (opponent?.name || "")}</span>
              <span className="text-xl font-black leading-none text-white" data-testid="ld2p-opp-score">{oppHome}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── ORIGINAL GAME (board + dice, 1:1 markup) ── */}
      {showBoard && (
        <div ref={boardRootRef} className="flex-1 min-h-0 overflow-y-auto ludo2p-scroll">
          <div ref={scaleOuterRef}
            className="ludo2p-scale-outer"
            style={{ width: "100%", display: "flex", alignItems: "flex-start", justifyContent: "center", height: boardH || undefined, overflow: "visible" }}>
            <div ref={scaleInnerRef}
              className="ludo2p-scale-inner"
              style={{ width: COMPOSITE_W, flexShrink: 0, transform: `scale(${scale})`, transformOrigin: "top center" }}>
              <div className={"ludo2p-root" + (turnPlayer === "P1" ? " turn-p1" : turnPlayer === "P2" ? " turn-p2" : "")} data-testid="ld2p-board">
                <div className="ludo-container">
                  <div className="ludo">
                    <div className="player-pieces">
                      <div className="player-piece" player-id="P1" piece="0"></div>
                      <div className="player-piece" player-id="P1" piece="1"></div>
                      <div className="player-piece" player-id="P1" piece="2"></div>
                      <div className="player-piece" player-id="P1" piece="3"></div>

                      <div className="player-piece" player-id="P2" piece="0"></div>
                      <div className="player-piece" player-id="P2" piece="1"></div>
                      <div className="player-piece" player-id="P2" piece="2"></div>
                      <div className="player-piece" player-id="P2" piece="3"></div>

                      <div className="player-piece" player-id="P3" piece="0"></div>
                      <div className="player-piece" player-id="P3" piece="1"></div>
                      <div className="player-piece" player-id="P3" piece="2"></div>
                      <div className="player-piece" player-id="P3" piece="3"></div>

                      <div className="player-piece" player-id="P4" piece="0"></div>
                      <div className="player-piece" player-id="P4" piece="1"></div>
                      <div className="player-piece" player-id="P4" piece="2"></div>
                      <div className="player-piece" player-id="P4" piece="3"></div>
                    </div>

                    <div className="player-bases">
                      <div className="player-base" player-id="P1"></div>
                      <div className="player-base" player-id="P2"></div>
                      <div className="player-base" player-id="P3"></div>
                      <div className="player-base" player-id="P4"></div>
                    </div>

                    {/* blue player's dice — OUTSIDE the board, beside the blue home (bottom-left) */}
                    <div className="ludo2p-dice-mini ludo2p-dice-blue containeer-p1">
                      <div className="ludo2p-dice-shrink">
                        <div className="dice">
                          <div className="face front"></div>
                          <div className="face back"></div>
                          <div className="face top"></div>
                          <div className="face bottom"></div>
                          <div className="face right"></div>
                          <div className="face left"></div>
                        </div>
                      </div>
                      <button className="roll" data-testid="ld2p-roll" aria-label="Roll blue dice"></button>
                      <div className="result">Result: 0</div>
                    </div>

                    {/* green player's dice — OUTSIDE the board, beside the green home (top-right) */}
                    <div className="ludo2p-dice-mini ludo2p-dice-green containeer-p2">
                      <div className="ludo2p-dice-shrink">
                        <div className="dice">
                          <div className="face front"></div>
                          <div className="face back"></div>
                          <div className="face top"></div>
                          <div className="face bottom"></div>
                          <div className="face right"></div>
                          <div className="face left"></div>
                        </div>
                      </div>
                      <button className="roll" data-testid="ld2p-roll-green" aria-label="Roll green dice"></button>
                      <div className="result">Result: 0</div>
                    </div>
                  </div>
                  <div className="footer">
                    <div className="row">
                      <button id="dice-btn" className="btn btn-dice">Roll</button>
                      <div className="dice-value"></div>
                      <button id="reset-btn" className="btn btn-reset">Reset</button>
                    </div>
                    <h2 className="active-player">Active Player: <span></span></h2>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LOBBY ── */}
      {phase === "lobby" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 overflow-y-auto">
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="text-7xl mb-1">🎲</motion.div>
          <h1 className="text-3xl font-black text-white text-center">2 Player <span style={{ color: "#FFD700" }}>Ludo</span></h1>
          <p className="text-xs text-white/50 mt-1 text-center">Original board · Real 1v1 · FREE entry</p>

          <div className="w-full max-w-xs mt-7 flex flex-col gap-3">
            <motion.button whileTap={{ scale: 0.96 }} onClick={startSearch}
              className="w-full py-3.5 rounded-2xl font-black text-base text-white"
              style={{ background: "linear-gradient(135deg,#2eafff,#049645)", boxShadow: "0 6px 24px rgba(46,175,255,0.35)" }}
              data-testid="ld2p-play-online">
              ⚡ Play Online
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={startBot}
              className="w-full py-3 rounded-2xl font-bold text-sm"
              style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}
              data-testid="ld2p-practice">
              🤖 Practice vs Bot
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
              className="w-full py-3 rounded-2xl font-bold text-sm"
              style={{ background: "transparent", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
              ← Back to Home
            </motion.button>
          </div>

          <div className="mt-6 text-[11px] text-white/40 text-center leading-relaxed max-w-xs">
            🔵 You play Blue (P1) vs 🟢 Green (P2)<br />
            🎲 Roll a 6 to bring a token out — 6 or a kill = extra turn<br />
            🏠 First to get all 4 tokens home wins!
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
            <motion.div className="h-full" style={{ background: "linear-gradient(90deg,#2eafff,#049645)" }}
              animate={{ width: `${Math.min(100, (searchElapsed / (QUEUE_WAIT_MS / 1000)) * 100)}%` }}
              transition={{ ease: "linear" }} />
          </div>

          {noOpponent ? (
            <div className="mt-7 flex flex-col gap-2.5 w-full max-w-xs">
              <div className="text-center text-xs text-white/60">No player found right now.</div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={keepSearching}
                className="w-full py-3 rounded-2xl font-black text-sm text-white"
                style={{ background: "linear-gradient(135deg,#2eafff,#049645)" }}
                data-testid="ld2p-keep-searching">
                🔄 Keep Searching
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={startBot}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}>
                🤖 Practice vs Bot instead
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={cancelSearch}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "transparent", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}>
                ← Cancel search
              </motion.button>
            </div>
          ) : (
            <motion.button whileTap={{ scale: 0.96 }} onClick={cancelSearch}
              className="mt-7 px-6 py-3 rounded-2xl font-bold text-sm"
              style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}>
              ← Cancel search
            </motion.button>
          )}
        </div>
      )}

      {/* ── COUNTDOWN overlay (3-2-1) ── */}
      <AnimatePresence>
        {phase === "countdown" && showBoard && (
          <motion.div key="cd" className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center"
            style={{ top: 96, background: "rgba(10,15,28,0.72)", zIndex: 10 }}
            exit={{ opacity: 0 }}>
            <div className="text-sm font-bold tracking-widest text-white/60 uppercase mb-2">Get Ready</div>
            <motion.div key={countdownNum}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-8xl font-black" style={{ color: "#FFD700" }}>
              {Math.max(1, countdownNum)}
            </motion.div>
            <div className="mt-3 text-xs text-white/50">Original Ludo board loading…</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── RESULT ── */}
      <AnimatePresence>
        {phase === "result" && outcome && (
          <motion.div key="result" className="absolute inset-0 z-20 flex flex-col items-center justify-center px-6"
            style={{ background: "rgba(10,15,28,0.9)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="ld2p-result">
            <motion.div initial={{ scale: 0.5, rotate: -12 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 14 }}
              className="text-7xl mb-2">{outcome.outcome === "win" ? "🏆" : outcome.outcome === "draw" ? "🤝" : "💔"}</motion.div>
            <div className="text-3xl font-black" style={{ color: outcome.outcome === "win" ? "#FFD700" : "#f87171" }}>
              {outcome.outcome === "win" ? "YOU WIN!" : outcome.outcome === "draw" ? "DRAW!" : "YOU LOSE"}
            </div>
            {(outcome.reason === "opponent-left" || outcome.reason === "forfeit" || outcome.reason === "turn-timeout") && (
              <div className="text-xs mt-1 text-white/60">
                {outcome.reason === "opponent-left" ? "Opponent disconnected — win by forfeit"
                  : outcome.reason === "turn-timeout" ? "Opponent's turn timed out"
                  : "Match ended by forfeit"}
              </div>
            )}
            <div className="mt-4 flex items-center gap-4 text-white">
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase" style={{ color: "#2eafff" }}>You</div>
                <div className="text-3xl font-black">{outcome.myScore}</div>
                <div className="text-[10px] text-white/40">tokens home</div>
              </div>
              <div className="text-white/30 font-black">vs</div>
              <div className="text-center">
                <div className="text-[10px] font-bold uppercase" style={{ color: COLOR_P2 }}>
                  {botMode ? "Bot" : (opponent?.name || "Opponent")}
                </div>
                <div className="text-3xl font-black">{outcome.oppScore}</div>
                <div className="text-[10px] text-white/40">tokens home</div>
              </div>
            </div>
            <div className="w-full max-w-xs mt-7 flex flex-col gap-3">
              <motion.button whileTap={{ scale: 0.96 }} onClick={startSearch}
                className="w-full py-3.5 rounded-2xl font-black text-base text-white"
                style={{ background: "linear-gradient(135deg,#2eafff,#049645)" }}
                data-testid="ld2p-rematch">
                🔄 Rematch
              </motion.button>
              <motion.button whileTap={{ scale: 0.96 }} onClick={goHomeFromResult}
                className="w-full py-3 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.14)" }}
                data-testid="ld2p-home">
                🏠 Back to Home
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QUIT confirm ── */}
      <AnimatePresence>
        {quitConfirm && (
          <motion.div className="absolute inset-0 z-30 flex items-center justify-center px-8"
            style={{ background: "rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="w-full max-w-xs rounded-2xl p-5 text-center"
              style={{ background: "#161d2e", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div className="text-4xl mb-2">🚪</div>
              <div className="font-black text-white mb-1">Quit the match?</div>
              <div className="text-[11px] text-white/50 mb-4">Leaving now counts as a loss (forfeit).</div>
              <div className="flex gap-2.5">
                <button onClick={() => setQuitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#e5e7eb" }}>Stay</button>
                <button onClick={quitMatch} data-testid="ld2p-quit-confirm"
                  className="flex-1 py-2.5 rounded-xl font-black text-sm text-white"
                  style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>Quit</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
