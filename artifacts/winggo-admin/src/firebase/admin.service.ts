/**
 * Admin Firebase Service — WINGGO Admin Panel
 * All Firestore admin operations — no cross-package imports.
 */
import {
  collection, collectionGroup, query, orderBy, limit, where,
  getDocs, getDoc, setDoc, updateDoc, addDoc,
  onSnapshot, serverTimestamp, increment,
  doc, writeBatch, Timestamp, DocumentData, deleteDoc,
} from "firebase/firestore";
import { adminDb, FIREBASE_ENABLED } from "./config";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid?: string;
  phone: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  kycStatus: "pending" | "submitted" | "approved" | "rejected";
  referralCode: string;
  referredBy: string | null;
  banned?: boolean;
  fcmToken?: string;
}

export interface WithdrawRequest {
  id?: string;
  uid: string;
  phone: string;
  displayName: string;
  amount: number;
  upiId: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: string;
  rejectionReason?: string;
}

export interface KYCRequest {
  uid: string;
  phone: string;
  displayName: string;
  docType: "aadhaar" | "pan" | "passport";
  docNumber: string;
  frontURL?: string;
  backURL?: string;
  selfieURL?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface AppConfig {
  maintenanceMode: boolean;
  forceUpdateVersion: string;
  depositBonusPct: number;
  maxWithdrawPerDay: number;
  referralBonusAmount: number;
  spinWheelEnabled: boolean;
  minWithdrawAmount: number;
  maxWithdrawAmount: number;
  announcementBanner: string;
  announcementActive: boolean;
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  maintenanceMode: false,
  forceUpdateVersion: "1.0.0",
  depositBonusPct: 15,
  maxWithdrawPerDay: 10000,
  referralBonusAmount: 50,
  spinWheelEnabled: true,
  minWithdrawAmount: 100,
  maxWithdrawAmount: 10000,
  announcementBanner: "🏆 Play & Win Real Cash! Grand Ludo Tournament every Sunday at 8 PM IST",
  announcementActive: true,
};

export interface GameConfig {
  id?: string;
  name: string;
  category: string;
  thumbnail: string;
  entryFees: number[];
  prizeMultiplier: number;
  maxPlayers: number;
  isActive: boolean;
  isBotEnabled: boolean;
  botJoinDelaySec: number;
  isFeatured?: boolean;
  description?: string;
}

export interface DailyStats {
  date: string;
  newUsers: number;
  activeUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  gamesPlayed: number;
  revenue: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  totalWinnings: number;
  gamesPlayed: number;
  rank?: number;
}

export interface AdminStats {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingWithdrawals: number;
  pendingKYC: number;
  activeSessions: number;
  revenueToday: number;
}

// ─── DEFAULT GAMES ────────────────────────────────────────────────────────────

export const DEFAULT_GAMES: GameConfig[] = [
  { id: "ludo",     name: "Ludo Classic",   category: "board",  thumbnail: "🎲", entryFees: [1,5,10,50], prizeMultiplier: 1.8, maxPlayers: 4, isActive: true,  isBotEnabled: true,  botJoinDelaySec: 15 },
  { id: "worldwar", name: "World War",      category: "battle", thumbnail: "⚔️", entryFees: [10,25,50],  prizeMultiplier: 1.9, maxPlayers: 10,isActive: true,  isBotEnabled: true,  botJoinDelaySec: 10 },
  { id: "carrom",   name: "Carrom",         category: "board",  thumbnail: "🎯", entryFees: [5,10,25],   prizeMultiplier: 1.8, maxPlayers: 2, isActive: false, isBotEnabled: true,  botJoinDelaySec: 15 },
  { id: "snakes",   name: "Snake & Ladder", category: "board",  thumbnail: "🐍", entryFees: [2,5,10],    prizeMultiplier: 1.8, maxPlayers: 4, isActive: false, isBotEnabled: true,  botJoinDelaySec: 12 },
  { id: "bubble",   name: "Bubble Shooter", category: "arcade", thumbnail: "🫧", entryFees: [5,10],      prizeMultiplier: 1.7, maxPlayers: 2, isActive: false, isBotEnabled: true,  botJoinDelaySec: 20 },
  { id: "cricket",  name: "Cricket Fantasy",category: "sports", thumbnail: "🏏", entryFees: [25,50,100], prizeMultiplier: 2.0, maxPlayers: 6, isActive: false, isBotEnabled: false, botJoinDelaySec: 30 },
];

// ─── WITHDRAW REQUESTS ────────────────────────────────────────────────────────

export function subscribeWithdrawRequests(
  statusFilter: "pending" | "approved" | "rejected" | "all",
  cb: (reqs: WithdrawRequest[]) => void
): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = statusFilter === "all"
    ? query(collection(adminDb, "withdrawRequests"), orderBy("requestedAt", "desc"), limit(100))
    : query(collection(adminDb, "withdrawRequests"), where("status", "==", statusFilter), orderBy("requestedAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawRequest)));
  });
}

export async function approveWithdraw(requestId: string, adminUid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await updateDoc(doc(adminDb, "withdrawRequests", requestId), {
    status: "approved", processedAt: serverTimestamp(), processedBy: adminUid,
  });
}

export async function rejectWithdraw(requestId: string, adminUid: string, reason: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const reqSnap = await getDoc(doc(adminDb, "withdrawRequests", requestId));
  if (!reqSnap.exists()) return;
  const req = reqSnap.data() as WithdrawRequest;
  await updateDoc(doc(adminDb, "withdrawRequests", requestId), {
    status: "rejected", processedAt: serverTimestamp(), processedBy: adminUid, rejectionReason: reason,
  });
  // Refund the amount back to wallet
  await updateDoc(doc(adminDb, "wallets", req.uid), { winning: increment(req.amount) });
}

// ─── USERS ────────────────────────────────────────────────────────────────────

export function subscribeUsers(cb: (users: UserProfile[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(collection(adminDb, "users"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
  });
}

export async function banUser(uid: string, banned: boolean): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await updateDoc(doc(adminDb, "users", uid), { banned });
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export function subscribeKYCRequests(cb: (reqs: KYCRequest[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(
    collection(adminDb, "kycRequests"),
    where("status", "==", "pending"),
    orderBy("submittedAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as KYCRequest));
  });
}

export async function approveKYC(uid: string, adminUid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const batch = writeBatch(adminDb);
  batch.update(doc(adminDb, "kycRequests", uid), {
    status: "approved", reviewedAt: serverTimestamp(), reviewedBy: adminUid,
  });
  batch.update(doc(adminDb, "users", uid), { kycStatus: "approved" });
  await batch.commit();
}

export async function rejectKYC(uid: string, adminUid: string, reason: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const batch = writeBatch(adminDb);
  batch.update(doc(adminDb, "kycRequests", uid), {
    status: "rejected", reviewedAt: serverTimestamp(), reviewedBy: adminUid, rejectionReason: reason,
  });
  batch.update(doc(adminDb, "users", uid), { kycStatus: "rejected" });
  await batch.commit();
}

// ─── APP CONFIG ───────────────────────────────────────────────────────────────

export function subscribeAppConfig(cb: (c: AppConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb(DEFAULT_APP_CONFIG); return () => {}; }
  return onSnapshot(doc(adminDb, "config", "app"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_APP_CONFIG, ...snap.data() } as AppConfig : DEFAULT_APP_CONFIG);
  });
}

export async function updateAppConfig(data: Partial<AppConfig>): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await setDoc(doc(adminDb, "config", "app"), data, { merge: true });
}

// ─── GAMES ────────────────────────────────────────────────────────────────────

/** Live subscription to games collection */
export function subscribeGames(cb: (games: GameConfig[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb(DEFAULT_GAMES); return () => {}; }
  return onSnapshot(
    collection(adminDb, "games"),
    (snap) => {
      if (snap.empty) cb(DEFAULT_GAMES);
      else cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GameConfig)));
    },
    () => cb(DEFAULT_GAMES)
  );
}

export async function getGames(): Promise<GameConfig[]> {
  if (!FIREBASE_ENABLED || !adminDb) return DEFAULT_GAMES;
  const snap = await getDocs(collection(adminDb, "games"));
  if (snap.empty) return DEFAULT_GAMES;
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GameConfig));
}

/** Seed default games into Firestore on first run */
export async function seedGamesIfEmpty(): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const snap = await getDocs(collection(adminDb, "games"));
  if (!snap.empty) return;
  const batch = writeBatch(adminDb);
  DEFAULT_GAMES.forEach((g) => {
    const ref = g.id ? doc(adminDb!, "games", g.id) : doc(collection(adminDb!, "games"));
    batch.set(ref, { ...g, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

export async function upsertGame(data: GameConfig): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  if (data.id) {
    await setDoc(doc(adminDb, "games", data.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await addDoc(collection(adminDb, "games"), { ...data, createdAt: serverTimestamp() });
  }
}

export async function removeGame(gameId: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await deleteDoc(doc(adminDb, "games", gameId));
}

/** Subscribe to all deposit transactions (across all users via collectionGroup) */
export function subscribeRecentDeposits(
  cb: (deps: Array<{ user: string; amount: number; date: string; method: string }>) => void
): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(
    collectionGroup(adminDb, "transactions"),
    where("type", "==", "deposit"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        user: d.ref.parent.parent?.id ?? "Unknown",
        amount: data.rawAmount as number,
        date: data.createdAt?.seconds
          ? new Date(data.createdAt.seconds * 1000).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
          : "—",
        method: "UPI",
      };
    }));
  }, () => cb([]));
}

/** Subscribe to live platform stats (user count, pending withdrawals, KYC) */
export function subscribeLiveStats(
  cb: (stats: { totalUsers: number; pendingWithdrawals: number; pendingKYC: number }) => void
): () => void {
  if (!FIREBASE_ENABLED || !adminDb) {
    cb({ totalUsers: 74218, pendingWithdrawals: 6, pendingKYC: 4 });
    return () => {};
  }
  let users = 0, pendingWD = 0, pendingKYC = 0;
  const emit = () => cb({ totalUsers: users, pendingWithdrawals: pendingWD, pendingKYC });

  const unsubUsers = onSnapshot(
    query(collection(adminDb, "users"), limit(1)),
    (snap) => { users = snap.size; emit(); },
    () => {}
  );
  const unsubWD = onSnapshot(
    query(collection(adminDb, "withdrawRequests"), where("status", "==", "pending")),
    (snap) => { pendingWD = snap.size; emit(); },
    () => {}
  );
  const unsubKYC = onSnapshot(
    query(collection(adminDb, "kycRequests"), where("status", "==", "pending")),
    (snap) => { pendingKYC = snap.size; emit(); },
    () => {}
  );
  return () => { unsubUsers(); unsubWD(); unsubKYC(); };
}

// ─── PUSH NOTIFICATIONS ───────────────────────────────────────────────────────

export interface NotificationQueueItem {
  id?: string;
  message: string;
  title: string;
  target: "all" | "active" | "deposited";
  scheduledFor: "now" | string;
  status: "queued" | "sent" | "failed";
  sentAt?: number;
  recipientCount?: number;
  createdAt: number;
  createdBy?: string;
}

export async function queueNotification(
  item: Omit<NotificationQueueItem, "id" | "status" | "createdAt">
): Promise<string> {
  if (!FIREBASE_ENABLED || !adminDb) {
    return `demo-notif-${Date.now()}`;
  }
  const ref = await addDoc(collection(adminDb, "notificationQueue"), {
    ...item,
    status: "queued",
    createdAt: Date.now(),
  });
  return ref.id;
}

export function subscribeNotificationHistory(
  cb: (items: NotificationQueueItem[]) => void
): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(
    collection(adminDb, "notificationQueue"),
    orderBy("createdAt", "desc"),
    limit(20)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationQueueItem)));
  }, () => cb([]));
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

export async function getDailyStats(days = 7): Promise<DailyStats[]> {
  if (!FIREBASE_ENABLED || !adminDb) return [];
  const snap = await getDocs(query(
    collection(adminDb, "analytics", "daily", "stats"),
    orderBy("date", "desc"),
    limit(days)
  ));
  return snap.docs.map((d) => d.data() as DailyStats).reverse();
}

export async function getLeaderboard(gameType: string, topN = 50): Promise<LeaderboardEntry[]> {
  if (!FIREBASE_ENABLED || !adminDb) return [];
  const snap = await getDocs(query(
    collection(adminDb, "leaderboards", gameType, "players"),
    orderBy("totalWinnings", "desc"),
    limit(topN)
  ));
  return snap.docs.map((d, i) => ({ ...d.data(), rank: i + 1 } as LeaderboardEntry));
}

export async function getAdminStats(): Promise<AdminStats> {
  if (!FIREBASE_ENABLED || !adminDb) {
    return {
      totalUsers: 4218, totalDeposits: 2431500, totalWithdrawals: 1872000,
      pendingWithdrawals: 12, pendingKYC: 7, activeSessions: 420000, revenueToday: 18750,
    };
  }
  return {
    totalUsers: 0, totalDeposits: 0, totalWithdrawals: 0,
    pendingWithdrawals: 0, pendingKYC: 0, activeSessions: 0, revenueToday: 0,
  };
}

// suppress unused import warning
function _noop(_: DocumentData) {}
void _noop;
