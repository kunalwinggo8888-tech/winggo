/**
 * Fruit Ninja 2P — Realtime Database service (WINGGO)
 *
 * Real two-player realtime matches over Firebase RTDB:
 *   fnQueue/waiting/{roomId}  — matchmaking waiting entries (creator = 1 player)
 *   fnRooms/{roomId}          — live room: players, timers, result
 *   fnPlayer/{uid}/activeRoom — resume pointer so a reconnecting player
 *                               returns to their running/finished match
 *
 * SECURITY (enforced by code + provided rules fragment):
 *   each client writes ONLY fnRooms/{roomId}/players/{ownUid}/* — a player can
 *   never update the opponent's score. Timers/result nodes are write-once.
 *
 * Server-authoritative timing: the room's `timers` node holds startedAt/endAt
 * (written once). Both clients render the countdown from endAt corrected by
 * the RTDB .info/serverTimeOffset, so a client can't fake extra match time.
 */
import {
  ref, set, get, update, remove, push,
  onValue, onDisconnect, runTransaction,
  type DatabaseReference,
} from "firebase/database";
import { rtdb, FIREBASE_ENABLED } from "./config";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface FNPlayerInfo {
  uid: string;
  name: string;
  photo: string;
}

/** Per-player node inside a room — written ONLY by that player's client */
export interface FNPlayerState {
  name: string;
  photo: string;
  score: number;
  /** ms-epoch until which this player is paused (bomb penalty) — info only */
  penaltyUntil?: number;
  connected: boolean;
  lastSeen: number;
}

export interface FNTimers {
  /** ms-epoch (server-corrected) when the 3-2-1 countdown ends & play begins */
  startedAt: number;
  /** ms-epoch when the 120s match ends — authoritative for both clients */
  endAt: number;
}

export interface FNResult {
  winnerId?: string;
  loserId?: string;
  draw?: boolean;
  reason?: "score" | "forfeit" | "opponent-left";
  scores: Record<string, number>;
}

export interface FNRoom {
  roomId: string;
  createdAt: number;
  status: "countdown" | "in_progress" | "finished";
  players: Record<string, FNPlayerState>;
  timers?: FNTimers;
  result?: FNResult;
}

export interface QueueEntry {
  uid: string;
  name: string;
  photo: string;
  ts: number;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/** Get the RTDB server-time offset once (ms to add to Date.now()). */
export function getServerTimeOffset(): Promise<number> {
  return new Promise((resolve) => {
    if (!FIREBASE_ENABLED || !rtdb) { resolve(0); return; }
    const r = ref(rtdb, ".info/serverTimeOffset");
    const handler = (snap: { val: () => number }) => {
      const v = typeof snap.val() === "number" ? snap.val() : 0;
      resolve(v);
    };
    // one-shot read; the offset is stable for the connection lifetime
    import("firebase/database").then(({ onValue, off }) => {
      onValue(r, handler as Parameters<typeof onValue>[1], { onlyOnce: true });
      void off;
    }).catch(() => resolve(0));
  });
}

export const MATCH_DURATION_MS = 120_000; // exactly 2 minutes
export const COUNTDOWN_MS = 3_000;        // 3-2-1 get-ready
export const QUEUE_WAIT_MS = 10_000;      // offer practice bot after this

// ─── MATCHMAKING (transaction-based — race-safe) ──────────────────────────────

/**
 * Join matchmaking. Creates a waiting entry or joins an existing one.
 * Returns the roomId + role:
 *   isCreator=true  → I created my own entry; watch it via waitForPair().
 *   isCreator=false → I joined someone's entry (opponent info included);
 *                     call completePairing() to create the live room.
 */
export async function joinFruitQueue(
  me: FNPlayerInfo,
  offset: number,
): Promise<{ roomId: string; isCreator: boolean; opponent?: FNPlayerInfo }> {
  if (!FIREBASE_ENABLED || !rtdb) {
    return { roomId: `demo-${Date.now()}`, isCreator: true };
  }
  const db = rtdb; // capture for closures (narrowing is lost inside callbacks)
  const waitingRef = ref(db, "fnQueue/waiting");
  const now = Date.now() + offset;
  const ENTRY_KEYS = new Set(["uid", "name", "photo", "ts"]);

  const res = await runTransaction(waitingRef, (waiting: Record<string, QueueEntry> | null) => {
    const w = waiting ?? {};
    // 1. try to join an existing fresh single-occupant entry (not mine)
    for (const [roomId, entry] of Object.entries(w)) {
      if (!entry || !entry.uid || entry.uid === me.uid) continue;
      if (now - (entry.ts || 0) > 90_000) continue; // stale — skip
      const nested = Object.keys(entry).filter((k) => !ENTRY_KEYS.has(k));
      if (nested.length > 0) continue; // someone already joined it
      // add me as a nested record on the creator's entry
      return { ...w, [roomId]: { ...entry, [me.uid]: { uid: me.uid, name: me.name, photo: me.photo, ts: now } } as QueueEntry };
    }
    // 2. otherwise reuse/create my own waiting entry
    let mineKey = Object.keys(w).find((rid) => w[rid]?.uid === me.uid);
    if (!mineKey) mineKey = push(ref(db, "fnQueue/waiting")).key as string;
    return { ...w, [mineKey]: { uid: me.uid, name: me.name, photo: me.photo, ts: now } };
  });

  // scan the committed value to determine my role
  const committed = (res.snapshot.val() ?? {}) as Record<string, QueueEntry & Record<string, QueueEntry>>;
  let roomId: string | null = null;
  let isCreator = true;
  for (const [rid, entry] of Object.entries(committed)) {
    if (!entry) continue;
    if (entry.uid === me.uid) { roomId = rid; isCreator = true; break; }
    const nested = entry[me.uid] as QueueEntry | undefined;
    if (nested && nested.uid === me.uid) {
      roomId = rid; isCreator = false;
      break;
    }
  }
  if (!roomId) throw new Error("matchmaking failed");

  if (isCreator) return { roomId, isCreator: true };

  // joiner: opponent is the entry owner
  const entry = committed[roomId];
  const opponent: FNPlayerInfo = { uid: entry.uid, name: entry.name || "Player", photo: entry.photo || "" };
  return { roomId, isCreator: false, opponent };
}

/**
 * Creator-side: watch my queue entry. When a joiner adds their uid to my
 * entry, ensureRoom() creates the live room, then removes the queue entry.
 * I detect pairing by subscribing to my queue entry + the room node.
 */
export function subscribeQueueEntry(
  roomId: string,
  cb: (entry: QueueEntry | null) => void,
): () => void {
  if (!FIREBASE_ENABLED || !rtdb) { cb(null); return () => {}; }
  const r = ref(rtdb, `fnQueue/waiting/${roomId}`);
  const handler = (snap: { val: () => QueueEntry | null }) => cb(snap.val());
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => { import("firebase/database").then(({ off }) => off(r, "value", handler as Parameters<typeof onValue>[1])).catch(() => {}); };
}

/** Remove my waiting entry (cancel search / stale cleanup). */
export async function cancelFruitQueue(roomId: string, uid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const r = ref(rtdb, `fnQueue/waiting/${roomId}`);
  const snap = await get(r);
  const entry = snap.val() as QueueEntry | null;
  if (entry && entry.uid === uid) await remove(r);
}

/**
 * Pair-complete: create the live room (idempotent — both sides may call it)
 * and clear the queue entry. Returns false if room already exists.
 */
export async function ensureRoom(
  roomId: string,
  players: FNPlayerInfo[],
  offset: number,
): Promise<boolean> {
  if (!FIREBASE_ENABLED || !rtdb) return false;
  const roomRef = ref(rtdb, `fnRooms/${roomId}`);
  const now = Date.now() + offset;
  // transactional so both sides may race to create — first write wins
  const res = await runTransaction(roomRef, (cur: FNRoom | null): FNRoom | undefined => {
    if (cur && cur.roomId) return undefined; // room already exists — keep it
    return {
      roomId,
      createdAt: now,
      status: "countdown",
      players: Object.fromEntries(players.map((p) => [p.uid, {
        name: p.name, photo: p.photo, score: 0, connected: true, lastSeen: now,
      } as FNPlayerState])),
    };
  });
  if (res.committed) {
    // clear the queue entry (best-effort) — room is live now
    await remove(ref(rtdb, `fnQueue/waiting/${roomId}`)).catch(() => {});
  }
  return res.committed;
}

/**
 * Wait for a room to gain a second player (creator side).
 * Resolves when the queue entry has ≥2 uids OR the room already exists.
 * Returns the opponent info (from the queue entry / room).
 */
export async function waitForPair(
  roomId: string,
  myUid: string,
  timeoutMs = QUEUE_WAIT_MS,
): Promise<FNPlayerInfo | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // 1. did the live room already appear (joiner completed pairing)?
    const roomSnap = await get(ref(rtdb, `fnRooms/${roomId}/players`));
    if (roomSnap.exists()) {
      const players = roomSnap.val() as Record<string, FNPlayerState>;
      const other = Object.keys(players).find((u) => u !== myUid);
      if (other) {
        return { uid: other, name: players[other].name, photo: players[other].photo };
      }
    }
    // 2. did a joiner add their uid to my queue entry?
    const entrySnap = await get(ref(rtdb, `fnQueue/waiting/${roomId}`));
    const entry = entrySnap.val() as (QueueEntry & Record<string, QueueEntry>) | null;
    if (entry) {
      // joiner writes themselves at players2 child? No — joiner overwrites the
      // entry with a merged object: {uid1..., uid2: {...}}; check for a second uid
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

/**
 * Joiner-side: add my uid into the creator's queue entry (transaction so two
 * joiners can't collide), then ensureRoom() with both players.
 */
export async function completePairing(
  roomId: string,
  me: FNPlayerInfo,
  offset: number,
): Promise<{ opponent: FNPlayerInfo } | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const entryRef = ref(rtdb, `fnQueue/waiting/${roomId}`);
  const res = await runTransaction(entryRef, (entry: QueueEntry | null) => {
    if (!entry) return entry; // creator left — abort
    if (entry.uid === me.uid) return entry;
    return { ...entry, [me.uid]: { uid: me.uid, name: me.name, photo: me.photo, ts: Date.now() + offset } } as unknown as QueueEntry;
  });
  if (!res.committed) return null;
  const val = res.snapshot.val() as QueueEntry & Record<string, QueueEntry>;
  if (!val || !val.uid || val.uid === me.uid) return null;
  const opponent: FNPlayerInfo = { uid: val.uid, name: val.name, photo: val.photo || "" };
  await ensureRoom(roomId, [opponent, me], offset);
  return { opponent };
}

// ─── ROOM / SCORE / TIMERS ────────────────────────────────────────────────────

export function subscribeFruitRoom(roomId: string, cb: (room: FNRoom | null) => void): () => void {
  if (!FIREBASE_ENABLED || !rtdb) { cb(null); return () => {}; }
  const r = ref(rtdb, `fnRooms/${roomId}`);
  const handler = (snap: { val: () => FNRoom | null }) => cb(snap.val());
  onValue(r, handler as Parameters<typeof onValue>[1]);
  return () => { import("firebase/database").then(({ off }) => off(r, "value", handler as Parameters<typeof onValue>[1])).catch(() => {}); };
}

/** One-shot fresh read of a room (used at match end to get settled final scores). */
export async function getFruitRoom(roomId: string): Promise<FNRoom | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const snap = await get(ref(rtdb, `fnRooms/${roomId}`)).catch(() => null);
  return snap ? (snap.val() as FNRoom | null) : null;
}

/**
 * Write MY OWN player node (score, penalty, connection). Per security rules a
 * client may only write fnRooms/{roomId}/players/{ownUid}.
 */
export async function updateMyPlayerState(
  roomId: string,
  uid: string,
  patch: { score?: number; penaltyUntil?: number; connected?: boolean },
): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  await update(ref(rtdb, `fnRooms/${roomId}/players/${uid}`), {
    ...patch,
    lastSeen: Date.now(),
  }).catch(() => {});
}

/** Attach onDisconnect(connected=false) for my player node. Returns detach fn. */
export function attachDisconnectHandlers(roomId: string, uid: string): () => void {
  if (!FIREBASE_ENABLED || !rtdb) return () => {};
  const connRef: DatabaseReference = ref(rtdb, `fnRooms/${roomId}/players/${uid}/connected`);
  const seenRef = ref(rtdb, `fnRooms/${roomId}/players/${uid}/lastSeen`);
  const offConn = onDisconnect(connRef).set(false).catch(() => () => {});
  const offSeen = onDisconnect(seenRef).set(Date.now()).catch(() => () => {});
  return () => {
    Promise.resolve(offConn).then((f) => { if (typeof f === "function") f(); }).catch(() => {});
    Promise.resolve(offSeen).then((f) => { if (typeof f === "function") f(); }).catch(() => {});
    onDisconnect(connRef).cancel().catch(() => {});
    onDisconnect(seenRef).cancel().catch(() => {});
  };
}

/**
 * Write-once timers node (server-authoritative). Either client may create it;
 * first write wins. startedAt = now + countdown, endAt = startedAt + 120s.
 */
export async function ensureTimers(roomId: string, offset: number): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const timersRef = ref(rtdb, `fnRooms/${roomId}/timers`);
  await runTransaction(timersRef, (cur: FNTimers | null) => {
    if (cur && cur.endAt) return cur; // someone already set them
    const now = Date.now() + offset;
    const startedAt = now + COUNTDOWN_MS;
    return { startedAt, endAt: startedAt + MATCH_DURATION_MS };
  });
}

/**
 * Write-once result node. Both clients compute the same result from the final
 * RTDB scores; the transaction makes it idempotent (first write wins).
 */
export async function ensureResult(
  roomId: string,
  result: FNResult,
): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  const resultRef = ref(rtdb, `fnRooms/${roomId}/result`);
  await runTransaction(resultRef, (cur: FNResult | null) => {
    if (cur && (cur.winnerId || cur.draw)) return cur;
    return result;
  });
  await update(ref(rtdb, `fnRooms/${roomId}`), { status: "finished" }).catch(() => {});
}

/** Best-effort room cleanup after the result was shown. */
export function scheduleRoomCleanup(roomId: string, delayMs = 45_000): void {
  if (!FIREBASE_ENABLED || !rtdb) return;
  setTimeout(() => {
    if (!rtdb) return;
    remove(ref(rtdb, `fnRooms/${roomId}`)).catch(() => {});
  }, delayMs);
}

// ─── RESUME POINTER ───────────────────────────────────────────────────────────

export async function setActiveRoom(uid: string, roomId: string | null): Promise<void> {
  if (!FIREBASE_ENABLED || !rtdb) return;
  if (roomId) await set(ref(rtdb, `fnPlayer/${uid}/activeRoom`), roomId).catch(() => {});
  else await remove(ref(rtdb, `fnPlayer/${uid}/activeRoom`)).catch(() => {});
}

export async function getActiveRoom(uid: string): Promise<string | null> {
  if (!FIREBASE_ENABLED || !rtdb) return null;
  const snap = await get(ref(rtdb, `fnPlayer/${uid}/activeRoom`));
  const v = snap.val();
  return typeof v === "string" ? v : null;
}
