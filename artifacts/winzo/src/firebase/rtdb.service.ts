/**
 * Firebase Realtime Database Service — WINGGO
 * Handles live game state, matchmaking, and leaderboards
 *
 * RTDB Structure:
 *   /matchmaking/{gameType}/{feeLevel}/rooms/{roomId}  — waiting rooms
 *   /rooms/{roomId}                                    — live game state
 *   /leaderboards/{gameType}                           — live top scores
 *   /presence/{uid}                                    — online status
 */
import {
  ref, set, get, update, remove, push, onValue, off,
  serverTimestamp as rtdbTimestamp,
  onDisconnect, DatabaseReference,
} from "firebase/database";
import { rtdb, FIREBASE_ENABLED } from "./config";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface MatchPlayer {
  uid: string;
  displayName: string;
  photoURL: string;
  isBot: boolean;
  joinedAt: number;
  score?: number;
  ready?: boolean;
}

export interface MatchRoom {
  roomId: string;
  gameType: string;
  entryFee: number;
  prizePool: number;
  maxPlayers: number;
  players: Record<string, MatchPlayer>;
  status: "waiting" | "ready" | "in_progress" | "finished";
  startedAt?: number;
  finishedAt?: number;
  winnerId?: string;
  winAmount?: number;
  createdAt: number;
}

export interface LiveGameState {
  currentTurn?: string;
  scores?: Record<string, number>;
  board?: unknown;
  phase?: string;
  lastMoveAt?: number;
  [key: string]: unknown;
}

// ─── PRESENCE ─────────────────────────────────────────────────────────────────

export function goOnline(uid: string): () => void {
  if (!FIREBASE_ENABLED || !rtdb) return () => {};
  const presenceRef = ref(rtdb, `presence/${uid}`);
  // Presence writes are best-effort — silently ignore permission or network errors
  set(presenceRef, { online: true, lastSeen: rtdbTimestamp() }).catch(() => {});
  onDisconnect(presenceRef).set({ online: false, lastSeen: rtdbTimestamp() }).catch(() => {});
  return () => {
    set(presenceRef, { online: false, lastSeen: rtdbTimestamp() }).catch(() => {});
  };
}

export function subscribeOnlinePlayers(cb: (count: number) => void): () => void {
  if (!FIREBASE_ENABLED || !rtdb) { cb(420000); return () => {}; }
  const r = ref(rtdb, "presence");
  const handler = (snap: { val: () => Record<string, { online: boolean }> | null }) => {
    const data = snap.val() ?? {};
    cb(Object.values(data).filter((p) => p.online).length);
  };
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => off(r, "value", handler as Parameters<typeof onValue>[1]);
}

// ─── MATCHMAKING ──────────────────────────────────────────────────────────────

/** Join or create a matchmaking room for a game */
export async function joinMatchmaking(
  gameType: string,
  entryFee: number,
  maxPlayers: number,
  player: MatchPlayer
): Promise<{ roomId: string; isCreator: boolean }> {
  if (!FIREBASE_ENABLED || !rtdb) {
    // Demo mode — simulate instant match
    return { roomId: `demo-room-${Date.now()}`, isCreator: true };
  }

  const queuePath = `matchmaking/${gameType}/${entryFee}`;
  const queueRef = ref(rtdb, queuePath);
  const snap = await get(queueRef);
  const rooms = snap.val() as Record<string, MatchRoom> | null;

  // Find an existing waiting room with space
  if (rooms) {
    for (const [roomId, room] of Object.entries(rooms)) {
      const playerCount = Object.keys(room.players ?? {}).length;
      if (room.status === "waiting" && playerCount < maxPlayers) {
        await update(ref(rtdb, `${queuePath}/${roomId}/players/${player.uid}`), player);
        const newCount = playerCount + 1;
        if (newCount >= maxPlayers) {
          await update(ref(rtdb, `${queuePath}/${roomId}`), { status: "ready", startedAt: Date.now() });
          await cloneRoomToActive(roomId, { ...room, players: { ...room.players, [player.uid]: player }, status: "ready" });
        }
        return { roomId, isCreator: false };
      }
    }
  }

  // Create new room
  const newRoomRef = push(ref(rtdb, queuePath));
  const roomId = newRoomRef.key!;
  const room: MatchRoom = {
    roomId,
    gameType,
    entryFee,
    prizePool: entryFee * maxPlayers * 0.9,
    maxPlayers,
    players: { [player.uid]: player },
    status: "waiting",
    createdAt: Date.now(),
  };
  await set(newRoomRef, room);
  return { roomId, isCreator: true };
}

async function cloneRoomToActive(roomId: string, room: MatchRoom): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await set(ref(rtdb, `rooms/${roomId}`), room);
}

/** Leave matchmaking (e.g. user backs out) */
export async function leaveMatchmaking(gameType: string, entryFee: number, roomId: string, uid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await remove(ref(rtdb, `matchmaking/${gameType}/${entryFee}/${roomId}/players/${uid}`));
}

/** Subscribe to a matchmaking room to know when a match is found */
export function subscribeRoom(
  gameType: string,
  entryFee: number,
  roomId: string,
  cb: (room: MatchRoom | null) => void
): () => void {
  if (!FIREBASE_ENABLED || !rtdb) return () => {};
  const r = ref(rtdb, `matchmaking/${gameType}/${entryFee}/${roomId}`);
  const handler = (snap: { val: () => MatchRoom | null }) => cb(snap.val());
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => off(r, "value", handler as Parameters<typeof onValue>[1]);
}

/** Add a bot to an unfilled room after the delay */
export async function botJoinRoom(
  gameType: string,
  entryFee: number,
  roomId: string,
  maxPlayers: number
): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const { getRandomBot: _getRandomBot } = await import("../data/botDatabase");
  const bot_db = _getRandomBot();
  const botName = bot_db.name;
  const botUid  = `bot_${Date.now()}`;
  const bot: MatchPlayer = {
    uid: botUid,
    displayName: botName,
    photoURL: "",
    isBot: true,
    joinedAt: Date.now(),
    score: 0,
    ready: true,
  };

  const roomPath = `matchmaking/${gameType}/${entryFee}/${roomId}`;
  const snap = await get(ref(rtdb, roomPath));
  if (!snap.exists()) return;
  const room = snap.val() as MatchRoom;
  if (room.status !== "waiting") return;

  const players = { ...room.players, [botUid]: bot };
  const playerCount = Object.keys(players).length;
  const newStatus = playerCount >= maxPlayers ? "ready" : "waiting";

  await update(ref(rtdb, roomPath), {
    [`players/${botUid}`]: bot,
    status: newStatus,
    ...(newStatus === "ready" ? { startedAt: Date.now() } : {}),
  });

  if (newStatus === "ready") {
    await cloneRoomToActive(roomId, { ...room, players, status: "ready", startedAt: Date.now() });
  }
}

// ─── ACTIVE ROOM / LIVE GAME STATE ────────────────────────────────────────────

export function subscribeActiveRoom(roomId: string, cb: (room: MatchRoom | null) => void): () => void {
  if (!FIREBASE_ENABLED || !rtdb) return () => {};
  const r = ref(rtdb, `rooms/${roomId}`);
  const handler = (snap: { val: () => MatchRoom | null }) => cb(snap.val());
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => off(r, "value", handler as Parameters<typeof onValue>[1]);
}

export async function updateGameState(roomId: string, state: LiveGameState): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await update(ref(rtdb, `rooms/${roomId}/gameState`), state);
}

export async function updatePlayerScore(roomId: string, uid: string, score: number): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await update(ref(rtdb, `rooms/${roomId}`), {
    [`players/${uid}/score`]: score,
    [`gameState/scores/${uid}`]: score,
    [`gameState/lastMoveAt`]: Date.now(),
  });
}

export async function finishRoom(roomId: string, winnerId: string, winAmount: number): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await update(ref(rtdb, `rooms/${roomId}`), {
    status: "finished",
    winnerId,
    winAmount,
    finishedAt: Date.now(),
  });
  // Clean up matchmaking queue entry after a delay (keep result visible briefly)
  setTimeout(() => {
    if (!rtdb) return;
    remove(ref(rtdb, `rooms/${roomId}`)).catch(() => {});
  }, 30_000);
}

// ─── LIVE LEADERBOARD ─────────────────────────────────────────────────────────

export interface RTDBLeaderEntry {
  uid: string;
  name: string;
  score: number;
}

export function subscribeLiveLeaderboard(
  gameType: string,
  cb: (entries: RTDBLeaderEntry[]) => void
): () => void {
  if (!FIREBASE_ENABLED || !rtdb) { cb([]); return () => {}; }
  const r = ref(rtdb, `leaderboards/${gameType}`);
  const handler = (snap: { val: () => Record<string, RTDBLeaderEntry> | null }) => {
    const val = snap.val() ?? {};
    const sorted = Object.values(val).sort((a, b) => b.score - a.score).slice(0, 20);
    cb(sorted);
  };
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => off(r, "value", handler as Parameters<typeof onValue>[1]);
}

export async function postLeaderboardScore(gameType: string, uid: string, name: string, score: number): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const r = ref(rtdb, `leaderboards/${gameType}/${uid}`);
  const snap = await get(r);
  const prev = (snap.val() as RTDBLeaderEntry | null)?.score ?? 0;
  if (score > prev) await set(r, { uid, name, score });
}


// ─── RTDB REF HELPERS (exported for direct use) ────────────────────────────────

export function rtdbRef(path: string): DatabaseReference | null {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  return ref(rtdb, path);
}
