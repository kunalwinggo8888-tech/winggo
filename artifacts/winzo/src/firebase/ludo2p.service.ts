/**
 * 2 Player Ludo Game — Realtime Database service (WINGGO)
 *
 * Mirrors the proven fruitninja.service.ts architecture, adapted for a
 * turn-based board game. Paths (all NEW — existing services untouched):
 *   ld2pQueue/waiting/{roomId} — matchmaking waiting entries
 *   ld2pRooms/{roomId}         — live room: players + game + result
 *   ld2pPlayer/{uid}/activeRoom— resume pointer for reconnects
 *
 * SEATS: the original game is 4-player hot-seat; the 2-player mode plays
 * P1 (blue) vs P2 (green) — the first two players of the original TURN_ORDER
 * [0,2,1,3]. Room creator = P1 (seat 0), joiner = P2 (seat 1).
 *
 * The current player's client is the authoritative writer of the `game`
 * node (turn / dice / positions — including every 200ms animation step),
 * so both screens show the same dice roll and step-by-step token movement.
 * `result` is a write-once node (first computation wins).
 */
import {
  ref, set, get, update, remove, push,
  onValue, onDisconnect, runTransaction,
  type DatabaseReference,
} from "firebase/database";
import { rtdb, FIREBASE_ENABLED } from "./config";
import { BASE_POSITIONS } from "../games/ludo2p/constants.js";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface L2PPlayerInfo {
  uid: string;
  name: string;
  photo: string;
}

export interface L2PSlot extends L2PPlayerInfo {
  /** player index in the original engine: 0 = P1 (blue), 1 = P2 (green) */
  seat: 0 | 1;
}

/** Per-player node inside a room — written ONLY by that player's client */
export interface L2PPlayerState {
  name: string;
  photo: string;
  seat: 0 | 1;
  connected: boolean;
  lastSeen: number;
}

/** Live game state — written by the current player's client only */
export interface L2PGameState {
  /** index into TURN_ORDER [0,1]: 0 → P1's turn, 1 → P2's turn */
  turn: number;
  turnPlayer: "P1" | "P2";
  /** server-corrected epoch when this turn started (turn-timeout basis) */
  turnStartedAt: number;
  diceValue: number | null;
  /** highlighted pieces for the current player (info only) */
  eligible: number[] | null;
  positions: Record<string, number[]>;
  lastWriter: string;
  seq: number;
}

export interface L2PResult {
  winnerId?: string;
  loserId?: string;
  draw?: boolean;
  reason?: "home" | "forfeit" | "opponent-left" | "turn-timeout";
  /** tokens home (0-4) per uid — history score */
  piecesHome?: Record<string, number>;
}

export interface L2PRoom {
  roomId: string;
  createdAt: number;
  status: "countdown" | "playing" | "finished";
  players: Record<string, L2PPlayerState>;
  game?: L2PGameState;
  result?: L2PResult;
}

export interface QueueEntry {
  uid: string;
  name: string;
  photo: string;
  ts: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

export const COUNTDOWN_MS = 3_000;      // get-ready before the first turn
export const QUEUE_WAIT_MS = 10_000;    // offer practice bot after this
export const TURN_TIMEOUT_MS = 75_000;  // inactive turn ⇒ opponent wins
export const DISCONNECT_FORFEIT_MS = 7_000;

/** Get the RTDB server-time offset once (ms to add to Date.now()). */
export function getServerTimeOffset(): Promise<number> {
  return new Promise((resolve) => {
    if (!FIREBASE_ENABLED || !rtdb) { resolve(0); return; }
    const r = ref(rtdb, ".info/serverTimeOffset");
    const handler = (snap: { val: () => number }) => {
      const v = typeof snap.val() === "number" ? snap.val() : 0;
      resolve(v);
    };
    onValue(r, handler as Parameters<typeof onValue>[1], { onlyOnce: true });
  });
}

// ─── MATCHMAKING (transaction-based — race-safe, same as Fruit Ninja) ─────────

export async function joinLudoQueue(
  me: L2PPlayerInfo,
  offset: number,
): Promise<{ roomId: string; isCreator: boolean; opponent?: L2PPlayerInfo }> {
  if (!FIREBASE_ENABLED || !rtdb) {
    return { roomId: `demo-${Date.now()}`, isCreator: true };
  }
  const db = rtdb;
  const waitingRef = ref(db, "ld2pQueue/waiting");
  const now = Date.now() + offset;
  const ENTRY_KEYS = new Set(["uid", "name", "photo", "ts"]);

  const res = await runTransaction(waitingRef, (waiting: Record<string, QueueEntry> | null) => {
    const w = waiting ?? {};
    // 1. join an existing fresh single-occupant entry (not mine)
    for (const [roomId, entry] of Object.entries(w)) {
      if (!entry || !entry.uid || entry.uid === me.uid) continue;
      if (now - (entry.ts || 0) > 90_000) continue;
      const nested = Object.keys(entry).filter((k) => !ENTRY_KEYS.has(k));
      if (nested.length > 0) continue;
      return { ...w, [roomId]: { ...entry, [me.uid]: { uid: me.uid, name: me.name, photo: me.photo, ts: now } } as QueueEntry };
    }
    // 2. otherwise reuse/create my own waiting entry
    let mineKey = Object.keys(w).find((rid) => w[rid]?.uid === me.uid);
    if (!mineKey) mineKey = push(ref(db, "ld2pQueue/waiting")).key as string;
    return { ...w, [mineKey]: { uid: me.uid, name: me.name, photo: me.photo, ts: now } };
  });

  const committed = (res.snapshot.val() ?? {}) as Record<string, QueueEntry & Record<string, QueueEntry>>;
  let roomId: string | null = null;
  let isCreator = true;
  for (const [rid, entry] of Object.entries(committed)) {
    if (!entry) continue;
    if (entry.uid === me.uid) { roomId = rid; isCreator = true; break; }
    const nested = entry[me.uid] as QueueEntry | undefined;
    if (nested && nested.uid === me.uid) { roomId = rid; isCreator = false; break; }
  }
  if (!roomId) throw new Error("matchmaking failed");

  if (isCreator) return { roomId, isCreator: true };
  const entry = committed[roomId];
  return { roomId, isCreator: false, opponent: { uid: entry.uid, name: entry.name || "Player", photo: entry.photo || "" } };
}

export function subscribeQueueEntry(
  roomId: string,
  cb: (entry: QueueEntry | null) => void,
): () => void {
  if (!FIREBASE_ENABLED || !rtdb) { cb(null); return () => {}; }
  const r = ref(rtdb, `ld2pQueue/waiting/${roomId}`);
  const handler = (snap: { val: () => QueueEntry | null }) => cb(snap.val());
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => { import("firebase/database").then(({ off }) => off(r, "value", handler as Parameters<typeof onValue>[1])).catch(() => {}); };
}

export async function cancelLudoQueue(roomId: string, uid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const r = ref(rtdb, `ld2pQueue/waiting/${roomId}`);
  const snap = await get(r);
  const entry = snap.val() as QueueEntry | null;
  if (entry && entry.uid === uid) await remove(r);
}

function initialGame(offset: number): L2PGameState {
  return {
    turn: 0,
    turnPlayer: "P1",
    turnStartedAt: Date.now() + offset + COUNTDOWN_MS,
    diceValue: null,
    eligible: null,
    positions: JSON.parse(JSON.stringify(BASE_POSITIONS)),
    lastWriter: "",
    seq: 0,
  };
}

/** Create the live room (idempotent — both sides may race; first write wins). */
export async function ensureRoom(
  roomId: string,
  slots: L2PSlot[],           // each side passes ITS OWN seat for itself
  offset: number,
): Promise<boolean> {
  if (!FIREBASE_ENABLED || !rtdb) return false;
  const roomRef = ref(rtdb, `ld2pRooms/${roomId}`);
  const now = Date.now() + offset;
  const res = await runTransaction(roomRef, (cur: L2PRoom | null): L2PRoom | undefined => {
    if (cur && cur.roomId) return undefined;
    return {
      roomId,
      createdAt: now,
      status: "countdown",
      players: Object.fromEntries(slots.map((p) => [p.uid, {
        name: p.name, photo: p.photo, seat: p.seat, connected: true, lastSeen: now,
      } as L2PPlayerState])),
      game: initialGame(offset),
    };
  });
  if (res.committed) {
    await remove(ref(rtdb, `ld2pQueue/waiting/${roomId}`)).catch(() => {});
  }
  return res.committed;
}

export async function waitForPair(
  roomId: string,
  myUid: string,
  timeoutMs = QUEUE_WAIT_MS,
): Promise<L2PPlayerInfo | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const roomSnap = await get(ref(rtdb, `ld2pRooms/${roomId}/players`));
    if (roomSnap.exists()) {
      const players = roomSnap.val() as Record<string, L2PPlayerState>;
      const other = Object.keys(players).find((u) => u !== myUid);
      if (other) return { uid: other, name: players[other].name, photo: players[other].photo };
    }
    const entrySnap = await get(ref(rtdb, `ld2pQueue/waiting/${roomId}`));
    const entry = entrySnap.val() as (QueueEntry & Record<string, QueueEntry>) | null;
    if (entry) {
      const keys = Object.keys(entry).filter((k) => k !== "uid" && k !== "name" && k !== "photo" && k !== "ts");
      for (const k of keys) {
        const cand = (entry as unknown as Record<string, QueueEntry>)[k];
        if (cand && typeof cand === "object" && cand.uid && cand.uid !== myUid) {
          return { uid: cand.uid, name: cand.name, photo: cand.photo };
        }
      }
    }
    await new Promise((r2) => setTimeout(r2, 700));
  }
  return null;
}

export async function completePairing(
  roomId: string,
  me: L2PSlot,               // joiner passes own slot (seat 1)
  offset: number,
): Promise<{ opponent: L2PPlayerInfo } | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const entryRef = ref(rtdb, `ld2pQueue/waiting/${roomId}`);
  const res = await runTransaction(entryRef, (entry: QueueEntry | null) => {
    if (!entry) return entry;
    if (entry.uid === me.uid) return entry;
    return { ...entry, [me.uid]: { uid: me.uid, name: me.name, photo: me.photo, ts: Date.now() + offset } } as unknown as QueueEntry;
  });
  if (!res.committed) return null;
  const val = res.snapshot.val() as QueueEntry & Record<string, QueueEntry>;
  if (!val || !val.uid || val.uid === me.uid) return null;
  const opponent: L2PPlayerInfo = { uid: val.uid, name: val.name, photo: val.photo || "" };
  // creator is always seat 0 (P1); joiner seat 1 (P2)
  await ensureRoom(roomId, [{ ...opponent, seat: 0 }, me], offset);
  return { opponent };
}

// ─── ROOM / GAME / RESULT ─────────────────────────────────────────────────────

export function subscribeLudoRoom(roomId: string, cb: (room: L2PRoom | null) => void): () => void {
  if (!FIREBASE_ENABLED || !rtdb) { cb(null); return () => {}; }
  const r = ref(rtdb, `ld2pRooms/${roomId}`);
  const handler = (snap: { val: () => L2PRoom | null }) => cb(snap.val());
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => { import("firebase/database").then(({ off }) => off(r, "value", handler as Parameters<typeof onValue>[1])).catch(() => {}); };
}

export async function getLudoRoom(roomId: string): Promise<L2PRoom | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const snap = await get(ref(rtdb, `ld2pRooms/${roomId}`)).catch(() => null);
  return snap ? (snap.val() as L2PRoom | null) : null;
}

/**
 * Write the game node (turn/dice/positions). Only the current player's client
 * calls this; the transaction bumps seq so writes never clobber each other.
 */
export async function writeLudoGame(
  roomId: string,
  uid: string,
  patch: Partial<Omit<L2PGameState, "lastWriter" | "seq">>,
): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const gameRef = ref(rtdb, `ld2pRooms/${roomId}/game`);
  await runTransaction(gameRef, (cur: L2PGameState | null) => {
    if (!cur || !cur.positions) return cur; // room gone — abort
    return { ...cur, ...patch, lastWriter: uid, seq: (cur.seq ?? 0) + 1 } as L2PGameState;
  }).catch(() => {});
}

export async function updateMyPlayerState(
  roomId: string,
  uid: string,
  patch: { connected?: boolean },
): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await update(ref(rtdb, `ld2pRooms/${roomId}/players/${uid}`), {
    ...patch,
    lastSeen: Date.now(),
  }).catch(() => {});
}

export function attachDisconnectHandlers(roomId: string, uid: string): () => void {
  if (!FIREBASE_ENABLED || !rtdb) return () => {};
  const connRef: DatabaseReference = ref(rtdb, `ld2pRooms/${roomId}/players/${uid}/connected`);
  const seenRef = ref(rtdb, `ld2pRooms/${roomId}/players/${uid}/lastSeen`);
  const offConn = onDisconnect(connRef).set(false).catch(() => () => {});
  const offSeen = onDisconnect(seenRef).set(Date.now()).catch(() => () => {});
  return () => {
    Promise.resolve(offConn).then((f) => { if (typeof f === "function") f(); }).catch(() => {});
    Promise.resolve(offSeen).then((f) => { if (typeof f === "function") f(); }).catch(() => {});
    onDisconnect(connRef).cancel().catch(() => {});
    onDisconnect(seenRef).cancel().catch(() => {});
  };
}

/** Write-once result node. */
export async function ensureResult(roomId: string, result: L2PResult): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const resultRef = ref(rtdb, `ld2pRooms/${roomId}/result`);
  await runTransaction(resultRef, (cur: L2PResult | null) => {
    if (cur && (cur.winnerId || cur.draw)) return cur;
    return result;
  });
  await update(ref(rtdb, `ld2pRooms/${roomId}`), { status: "finished" }).catch(() => {});
}

export function scheduleRoomCleanup(roomId: string, delayMs = 45_000): void {
  if (!FIREBASE_ENABLED || !rtdb) return;
  setTimeout(() => {
    if (!rtdb) return;
    remove(ref(rtdb, `ld2pRooms/${roomId}`)).catch(() => {});
  }, delayMs);
}

// ─── RESUME POINTER ───────────────────────────────────────────────────────────

export async function setActiveRoom(uid: string, roomId: string | null): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  if (roomId) await set(ref(rtdb, `ld2pPlayer/${uid}/activeRoom`), roomId).catch(() => {});
  else await remove(ref(rtdb, `ld2pPlayer/${uid}/activeRoom`)).catch(() => {});
}

export async function getActiveRoom(uid: string): Promise<string | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const snap = await get(ref(rtdb, `ld2pPlayer/${uid}/activeRoom`));
  const v = snap.val();
  return typeof v === "string" ? v : null;
}
