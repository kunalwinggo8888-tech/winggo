/**
 * Matchmaking Service — WINGGO
 * High-level matchmaking flow with bot fallback for all games
 */
import { joinMatchmaking, botJoinRoom, subscribeRoom, leaveMatchmaking, MatchPlayer, MatchRoom } from "./rtdb.service";

export type MatchStatus =
  | "idle"
  | "joining"
  | "searching"
  | "found"
  | "timeout"
  | "error";

export interface MatchResult {
  roomId: string;
  room: MatchRoom;
}

/** Full matchmaking flow:
 *  1. Join the queue
 *  2. Wait for opponent (up to `timeoutSec`)
 *  3. If no opponent found → inject bot
 *  4. Returns final room state
 */
export function startMatchmaking(
  opts: {
    gameType: string;
    entryFee: number;
    maxPlayers: number;
    player: MatchPlayer;
    timeoutSec?: number;
    onStatus?: (s: MatchStatus) => void;
    onPlayersUpdate?: (players: MatchPlayer[]) => void;
  }
): { cancel: () => void; promise: Promise<MatchResult> } {
  const {
    gameType, entryFee, maxPlayers, player,
    timeoutSec = 15,
    onStatus = () => {},
    onPlayersUpdate = () => {},
  } = opts;

  let cancelled = false;
  let unsub: (() => void) | null = null;
  let botTimer: ReturnType<typeof setTimeout> | null = null;
  let roomId: string | null = null;

  const promise = new Promise<MatchResult>(async (resolve, reject) => {
    onStatus("joining");
    try {
      const result = await joinMatchmaking(gameType, entryFee, maxPlayers, player);
      roomId = result.roomId;
      if (cancelled) return;

      onStatus("searching");

      // Listen for room updates
      unsub = subscribeRoom(gameType, entryFee, roomId, (room) => {
        if (!room || cancelled) return;

        const players = Object.values(room.players ?? {});
        onPlayersUpdate(players);

        if (room.status === "ready" || players.length >= maxPlayers) {
          cleanup();
          onStatus("found");
          resolve({ roomId: roomId!, room });
        }
      });

      // Schedule bot join after timeout
      botTimer = setTimeout(async () => {
        if (cancelled || !roomId) return;
        onStatus("searching");
        await botJoinRoom(gameType, entryFee, roomId, maxPlayers);
      }, timeoutSec * 1_000);

    } catch (err) {
      onStatus("error");
      reject(err);
    }
  });

  function cleanup() {
    cancelled = true;
    if (unsub) { unsub(); unsub = null; }
    if (botTimer) { clearTimeout(botTimer); botTimer = null; }
  }

  return {
    promise,
    cancel: async () => {
      cleanup();
      if (roomId) {
        await leaveMatchmaking(gameType, entryFee, roomId, player.uid).catch(() => {});
      }
    },
  };
}

/** Demo mode matchmaking — resolves immediately with a fake opponent */
export function demoMatchmaking(
  opts: {
    gameType: string;
    entryFee: number;
    player: MatchPlayer;
    delaySec?: number;
    onStatus?: (s: MatchStatus) => void;
  }
): { cancel: () => void; promise: Promise<MatchResult> } {
  const { player, delaySec = 3, onStatus = () => {} } = opts;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;

  const BOT_NAMES = ["ArjunBot", "KaranBot", "RajaBot", "VijayBot"];
  const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const botUid  = `bot_${Date.now()}`;

  const roomId = `demo-room-${Date.now()}`;
  const fakeRoom: MatchRoom = {
    roomId,
    gameType: opts.gameType,
    entryFee: opts.entryFee,
    prizePool: opts.entryFee * 1.8,
    maxPlayers: 2,
    players: {
      [player.uid]: { ...player, isBot: false, joinedAt: Date.now() },
      [botUid]: { uid: botUid, displayName: botName, photoURL: "", isBot: true, joinedAt: Date.now() },
    },
    status: "ready",
    startedAt: Date.now(),
    createdAt: Date.now(),
  };

  const promise = new Promise<MatchResult>((resolve) => {
    onStatus("searching");
    timer = setTimeout(() => {
      if (!cancelled) {
        onStatus("found");
        resolve({ roomId, room: fakeRoom });
      }
    }, delaySec * 1_000);
  });

  return {
    promise,
    cancel: () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    },
  };
}
