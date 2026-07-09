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
import { adminDb, adminRtdb, FIREBASE_ENABLED } from "./config";
import type { StaffPermissions } from "./config";
import {
  ref as rtdbRef, onValue, off, DataSnapshot,
} from "firebase/database";


// ─── Cloudinary Upload Helper (replaces Firebase Storage) ────────────────────
const _CLD_NAME   = typeof import.meta !== "undefined" ? (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME    ?? "") : "";
const _CLD_PRESET = typeof import.meta !== "undefined" ? (import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "") : "";

type UploadProgressCb = (pct: number) => void;

async function _cldUpload(
  file: File,
  folder: string,
  resourceType: "image" | "raw" | "auto" = "auto",
  onProgress?: UploadProgressCb,
): Promise<string> {
  if (!_CLD_NAME || !_CLD_PRESET) {
    throw new Error("Cloudinary not configured. Set VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET.");
  }
  const url = `https://api.cloudinary.com/v1_1/${_CLD_NAME}/${resourceType}/upload`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    if (onProgress && xhr.upload) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { secure_url: string };
        resolve(data.secure_url);
      } else {
        let msg = xhr.statusText;
        try { msg = (JSON.parse(xhr.responseText) as { error?: { message?: string } }).error?.message ?? msg; } catch { /* ignore */ }
        reject(new Error(`Cloudinary upload failed (${xhr.status}): ${msg}`));
      }
    };
    xhr.onerror = () => reject(new Error("Cloudinary upload: network error"));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", _CLD_PRESET);
    fd.append("folder", folder);
    xhr.send(fd);
  });
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid?: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  lastLoginAt?: number;
  /** Firestore presence field written by the winzo app ("online" | "offline") */
  status?: string;
  kycStatus: "pending" | "submitted" | "approved" | "rejected";
  referralCode: string;
  referredBy: string | null;
  /** True when admin has banned this user */
  banned?: boolean;
  /** Alias used by some Firestore paths — treated as banned */
  isBanned?: boolean;
  fcmToken?: string;
  gamesPlayed?: number;
  totalDeposits?: number;
  totalWithdrawals?: number;
}

export interface WithdrawRequest {
  id?: string;
  uid: string;
  email: string;
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
  email: string;
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

// ─── DEPOSIT RECORDS (Razorpay real payments) ─────────────────────────────────

export interface DepositRecord {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  amount: number;
  bonusPct: number;
  bonusAmount: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  method: string;
  status: "success" | "failed" | "pending";
  createdAt: Timestamp | number;
}

/** Subscribe to all real Razorpay deposit records */
export function subscribeDeposits(cb: (deps: DepositRecord[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(
    collection(adminDb, "deposits"),
    orderBy("createdAt", "desc"),
    limit(200)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRecord)));
  }, () => cb([]));
}

/** Get deposit stats for admin summary cards */
export async function getDepositStats(): Promise<{ total: number; count: number; today: number }> {
  if (!FIREBASE_ENABLED || !adminDb) return { total: 0, count: 0, today: 0 };
  try {
    const snap = await getDocs(query(
      collection(adminDb, "deposits"),
      where("status", "==", "success"),
      limit(500)
    ));
    const todayStart = Date.now() - 86400000;
    let total = 0, today = 0;
    snap.docs.forEach((d) => {
      const dep = d.data() as DepositRecord;
      total += dep.amount;
      const ts = typeof dep.createdAt === "number"
        ? dep.createdAt
        : (dep.createdAt as Timestamp)?.seconds * 1000 ?? 0;
      if (ts > todayStart) today += dep.amount;
    });
    return { total, count: snap.size, today };
  } catch {
    return { total: 0, count: 0, today: 0 };
  }
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

// ─── WALLET DOCS ──────────────────────────────────────────────────────────────

export interface WalletDoc {
  uid: string;
  winning: number;
  deposit: number;
  bonus: number;
  updatedAt?: Timestamp;
}

/** Subscribe to every wallet document (live total balance calculations) */
export function subscribeAllWallets(cb: (wallets: WalletDoc[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  return onSnapshot(
    collection(adminDb, "wallets"),
    (snap) => cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as WalletDoc))),
    () => cb([])
  );
}

// ─── ENRICHED USER (profile + wallet joined) ──────────────────────────────────

export interface EnrichedUser extends UserProfile {
  wallet: WalletDoc | null;
}

/**
 * Subscribe to users collection and wallets collection simultaneously,
 * join them by uid in memory, and emit merged list.
 * Updates whenever either collection changes.
 */
export function subscribeUsersEnriched(cb: (users: EnrichedUser[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }

  let latestUsers: UserProfile[] = [];
  let latestWallets = new Map<string, WalletDoc>();

  const emit = () =>
    cb(latestUsers.map((u) => ({ ...u, wallet: latestWallets.get(u.uid ?? "") ?? null })));

  const unsubUsers = onSnapshot(
    query(collection(adminDb, "users"), orderBy("createdAt", "desc"), limit(300)),
    (snap) => {
      latestUsers = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile));
      emit();
    },
    () => {}
  );

  const unsubWallets = onSnapshot(
    collection(adminDb, "wallets"),
    (snap) => {
      latestWallets = new Map(
        snap.docs.map((d) => [d.id, { uid: d.id, ...d.data() } as WalletDoc])
      );
      emit();
    },
    () => {}
  );

  return () => { unsubUsers(); unsubWallets(); };
}

// ─── PLATFORM STATS (real-time aggregation) ───────────────────────────────────

export interface PlatformStats {
  totalUsers: number;
  totalWalletBalance: number;
  totalWinningBalance: number;
  totalDepositBalance: number;
  totalBonusBalance: number;
  totalDepositsAmount: number;
  totalDepositsCount: number;
  depositsTodayAmount: number;
  depositsTodayCount: number;
  totalWithdrawalsAmount: number;
  totalWithdrawalsCount: number;
  withdrawalsTodayAmount: number;
  dailyProfit: number;
  pendingWithdrawals: number;
  pendingWithdrawalsAmount: number;
  pendingKYC: number;
}

const EMPTY_PLATFORM_STATS: PlatformStats = {
  totalUsers: 0, totalWalletBalance: 0, totalWinningBalance: 0,
  totalDepositBalance: 0, totalBonusBalance: 0, totalDepositsAmount: 0,
  totalDepositsCount: 0, depositsTodayAmount: 0, depositsTodayCount: 0,
  totalWithdrawalsAmount: 0, totalWithdrawalsCount: 0,
  withdrawalsTodayAmount: 0, dailyProfit: 0,
  pendingWithdrawals: 0, pendingWithdrawalsAmount: 0, pendingKYC: 0,
};

/**
 * Subscribe to multiple Firestore collections in parallel to produce
 * real-time aggregated platform stats. Emits whenever any collection updates.
 */
export function subscribePlatformStats(cb: (stats: PlatformStats) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb(EMPTY_PLATFORM_STATS); return () => {}; }

  let stats = { ...EMPTY_PLATFORM_STATS };
  const emit = () => cb({
    ...stats,
    dailyProfit: stats.depositsTodayAmount - stats.withdrawalsTodayAmount,
  });
  const todayStart = Date.now() - 86_400_000;

  // 1. Total user count
  const unsubUsers = onSnapshot(
    query(collection(adminDb, "users"), limit(1000)),
    (snap) => { stats = { ...stats, totalUsers: snap.size }; emit(); },
    () => {}
  );

  // 2. Wallet balances (sum all wallet docs)
  const unsubWallets = onSnapshot(
    collection(adminDb, "wallets"),
    (snap) => {
      let winning = 0, deposit = 0, bonus = 0;
      snap.docs.forEach((d) => {
        const w = d.data() as WalletDoc;
        winning += w.winning || 0;
        deposit += w.deposit || 0;
        bonus   += w.bonus   || 0;
      });
      stats = {
        ...stats,
        totalWinningBalance: winning,
        totalDepositBalance: deposit,
        totalBonusBalance:   bonus,
        totalWalletBalance:  winning + deposit + bonus,
      };
      emit();
    },
    () => {}
  );

  // 3. Successful deposits (Razorpay records)
  const unsubDeposits = onSnapshot(
    query(collection(adminDb, "deposits"), where("status", "==", "success"), limit(1000)),
    (snap) => {
      let total = 0, today = 0, todayCount = 0;
      snap.docs.forEach((d) => {
        const dep = d.data() as DepositRecord;
        const amt = dep.amount || 0;
        total += amt;
        const ts = typeof dep.createdAt === "number"
          ? dep.createdAt
          : ((dep.createdAt as Timestamp)?.seconds || 0) * 1000;
        if (ts > todayStart) { today += amt; todayCount++; }
      });
      stats = {
        ...stats,
        totalDepositsAmount: total, totalDepositsCount: snap.size,
        depositsTodayAmount: today, depositsTodayCount: todayCount,
      };
      emit();
    },
    () => {}
  );

  // 4. Pending withdrawals
  const unsubPendingWD = onSnapshot(
    query(collection(adminDb, "withdrawRequests"), where("status", "==", "pending")),
    (snap) => {
      let amt = 0;
      snap.docs.forEach((d) => { amt += (d.data().amount as number) || 0; });
      stats = { ...stats, pendingWithdrawals: snap.size, pendingWithdrawalsAmount: amt };
      emit();
    },
    () => {}
  );

  // 5. Approved withdrawals total + today's withdrawals
  const unsubApprovedWD = onSnapshot(
    query(collection(adminDb, "withdrawRequests"), where("status", "==", "approved"), limit(1000)),
    (snap) => {
      let total = 0, todayWD = 0;
      snap.docs.forEach((d) => {
        const amt = (d.data().amount as number) || 0;
        total += amt;
        const ts = d.data().processedAt?.seconds
          ? d.data().processedAt.seconds * 1000
          : 0;
        if (ts > todayStart) todayWD += amt;
      });
      stats = {
        ...stats,
        totalWithdrawalsAmount: total,
        totalWithdrawalsCount: snap.size,
        withdrawalsTodayAmount: todayWD,
        dailyProfit: stats.depositsTodayAmount - todayWD,
      };
      emit();
    },
    () => {}
  );

  // 6. Pending KYC
  const unsubKYC = onSnapshot(
    query(collection(adminDb, "kycRequests"), where("status", "==", "pending")),
    (snap) => { stats = { ...stats, pendingKYC: snap.size }; emit(); },
    () => {}
  );

  return () => {
    unsubUsers(); unsubWallets(); unsubDeposits();
    unsubPendingWD(); unsubApprovedWD(); unsubKYC();
  };
}

// ─── ONLINE USERS (RTDB Presence) ─────────────────────────────────────────────

/**
 * Subscribe to online user count via Firebase RTDB presence node.
 * Player app writes `presence/{uid} = { online: true, lastSeen: serverTimestamp() }`.
 * Returns the count of currently-online users (0 if none or RTDB not configured).
 */
export function subscribeOnlineUsers(cb: (count: number) => void): () => void {
  // Emit 0 immediately so the UI never stays in loading state
  cb(0);
  if (!FIREBASE_ENABLED || !adminRtdb) return () => {};
  const presenceRef = rtdbRef(adminRtdb, "presence");
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) { cb(0); return; }
    let count = 0;
    snap.forEach((child) => {
      const data = child.val() as { online?: boolean } | null;
      if (data?.online === true) count++;
    });
    cb(count);
  };
  onValue(presenceRef, handler, () => cb(0));
  return () => off(presenceRef, "value", handler);
}

// ─── ACTIVE MATCHES BY GAME (RTDB) ────────────────────────────────────────────

export interface ActiveMatchInfo {
  totalActive: number;
  byGame: Record<string, { name: string; emoji: string; count: number }>;
  mostPlayed: { id: string; name: string; emoji: string; count: number } | null;
}

const RTDB_GAMES = [
  { id: "ludo",     name: "Ludo",          emoji: "🎲", path: "ludo",        fees: [1, 5, 10, 50],   activeStatus: ["playing", "in_progress"] },
  { id: "worldwar", name: "World War",     emoji: "⚔️", path: "worldwar",    fees: [20, 50, 100, 200],activeStatus: ["in_progress"]            },
  { id: "metro",    name: "Metro Surfer",  emoji: "🏃", path: "metroSurfer", fees: null,              activeStatus: ["playing", "active"]      },
  { id: "cricket",  name: "Cricket",       emoji: "🏏", path: "cricket",     fees: [5, 10, 25, 50],  activeStatus: ["playing", "active"]      },
  { id: "snakes",   name: "Snake & Ladder",emoji: "🐍", path: "snakes",      fees: [1, 2, 5, 10],    activeStatus: ["playing", "in_progress"] },
];

/**
 * Subscribe to active match counts across all RTDB game rooms.
 * Returns total count, per-game breakdown, and the most played game.
 */
export function subscribeActiveMatches(cb: (info: ActiveMatchInfo) => void): () => void {
  // Emit zeros immediately so the UI never stays in loading state
  cb({ totalActive: 0, byGame: {}, mostPlayed: null });
  if (!FIREBASE_ENABLED || !adminRtdb) return () => {};

  const counts = new Map<string, number>();
  const unsubs: Array<() => void> = [];

  const emit = () => {
    let totalActive = 0;
    const byGame: Record<string, { name: string; emoji: string; count: number }> = {};

    RTDB_GAMES.forEach((g) => {
      const count = counts.get(g.id) ?? 0;
      totalActive += count;
      byGame[g.id] = { name: g.name, emoji: g.emoji, count };
    });

    // Find the most-played game without relying on forEach mutation narrowing
    const topEntry = RTDB_GAMES
      .map((g) => ({ id: g.id, name: g.name, emoji: g.emoji, count: counts.get(g.id) ?? 0 }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.count - a.count)[0];

    const mostPlayed: ActiveMatchInfo["mostPlayed"] = topEntry ?? null;
    cb({ totalActive, byGame, mostPlayed });
  };

  RTDB_GAMES.forEach((game) => {
    if (game.fees) {
      const feeCounts = new Map<number, number>();
      game.fees.forEach((fee) => {
        const feeRef = rtdbRef(adminRtdb!, `${game.path}/${fee}`);
        const handler = (snap: DataSnapshot) => {
          let count = 0;
          if (snap.exists()) {
            snap.forEach((room) => {
              const data = room.val() as { status?: string } | null;
              if (data?.status && game.activeStatus.includes(data.status)) count++;
            });
          }
          feeCounts.set(fee, count);
          counts.set(game.id, Array.from(feeCounts.values()).reduce((a, b) => a + b, 0));
          emit();
        };
        onValue(feeRef, handler, () => {});
        unsubs.push(() => off(feeRef, "value", handler));
      });
    } else {
      const gameRef = rtdbRef(adminRtdb!, game.path);
      const handler = (snap: DataSnapshot) => {
        let count = 0;
        if (snap.exists()) {
          snap.forEach((room) => {
            const data = room.val() as { status?: string } | null;
            if (data?.status && game.activeStatus.includes(data.status)) count++;
          });
        }
        counts.set(game.id, count);
        emit();
      };
      onValue(gameRef, handler, () => {});
      unsubs.push(() => off(gameRef, "value", handler));
    }
  });

  return () => unsubs.forEach((u) => u());
}

// ─── DEPOSIT REQUESTS (Screenshot Verification) ──────────────────────────────

export interface DepositRequest {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  amount: number;
  screenshotUrl: string;
  utrRef: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: Timestamp | number;
  processedAt?: Timestamp | number;
  processedBy?: string;
  rejectionReason?: string;
}

export function subscribeScreenshotDeposits(
  statusFilter: "pending" | "all",
  cb: (reqs: DepositRequest[]) => void,
): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = statusFilter === "pending"
    ? query(collection(adminDb, "depositRequests"), where("status", "==", "pending"), orderBy("requestedAt", "desc"), limit(100))
    : query(collection(adminDb, "depositRequests"), orderBy("requestedAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest)));
  }, () => cb([]));
}

export async function approveScreenshotDeposit(requestId: string, adminUid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const reqRef = doc(adminDb, "depositRequests", requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) throw new Error("Request not found");
  const req = reqSnap.data() as DepositRequest;
  if (req.status !== "pending") throw new Error("Already processed");
  const batch = writeBatch(adminDb);
  batch.update(reqRef, { status: "approved", processedAt: serverTimestamp(), processedBy: adminUid });
  const walletRef = doc(adminDb, "wallets", req.uid);
  batch.update(walletRef, { deposit: increment(req.amount), updatedAt: serverTimestamp() });
  const txRef = doc(collection(adminDb, `wallets/${req.uid}/transactions`));
  batch.set(txRef, {
    type: "deposit",
    title: `Deposit Approved — ₹${req.amount}`,
    rawAmount: req.amount,
    display: `+₹${req.amount}`,
    color: "#3498db",
    status: "completed",
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function rejectScreenshotDeposit(requestId: string, adminUid: string, reason: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await updateDoc(doc(adminDb, "depositRequests", requestId), {
    status: "rejected",
    processedAt: serverTimestamp(),
    processedBy: adminUid,
    rejectionReason: reason || "Request rejected by admin",
  });
}

// ─── WALLET: Admin balance adjustment ─────────────────────────────────────────

export async function setUserWallet(
  uid: string,
  updates: { deposit?: number; winning?: number; bonus?: number },
): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await setDoc(doc(adminDb, "wallets", uid), updates, { merge: true });
}

export async function subscribeUserWallet(
  uid: string,
  cb: (w: { deposit: number; winning: number; bonus: number }) => void,
): Promise<() => void> {
  if (!FIREBASE_ENABLED || !adminDb) { cb({ deposit: 0, winning: 0, bonus: 0 }); return () => {}; }
  return onSnapshot(doc(adminDb, "wallets", uid), (snap) => {
    const d = snap.data() ?? {};
    cb({ deposit: (d.deposit as number) ?? 0, winning: (d.winning as number) ?? 0, bonus: (d.bonus as number) ?? 0 });
  });
}

// ─── ADMIN BANNERS ────────────────────────────────────────────────────────────

export interface AdminBanner {
  id:        string;
  imageUrl:  string;
  title:     string;
  isActive:  boolean;
}

export function subscribeAdminBanners(cb: (banners: AdminBanner[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) {
    cb([
      { id: "1", imageUrl: "", title: "Welcome Banner", isActive: true },
      { id: "2", imageUrl: "", title: "Tournament Banner", isActive: true },
    ]);
    return () => {};
  }
  return onSnapshot(doc(adminDb, "config", "banners"), (snap) => {
    const data = snap.data();
    cb(Array.isArray(data?.items) ? (data.items as AdminBanner[]) : []);
  });
}

export async function saveAdminBanners(banners: AdminBanner[]): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await setDoc(doc(adminDb, "config", "banners"), { items: banners, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── RE-EXPORTS ───────────────────────────────────────────────────────────────

export { FIREBASE_ENABLED };

// ─── STORAGE: Game ZIP Upload ─────────────────────────────────────────────────


/**
 * Upload a .zip game bundle to Firebase Storage at `games/{gameId}/{fileName}`.
 * Calls `onProgress(0–100)` as bytes transfer.
 * Returns the public download URL on completion.
 */
export async function uploadGameZip(
  file: File,
  gameId: string,
  onProgress?: UploadProgressCb,
): Promise<string> {
  return _cldUpload(file, `winggo/games/${gameId}`, "raw", onProgress);
}

// ─── CODE EDITOR: Virtual File System in Firestore ────────────────────────────

export interface CodeFileEntry {
  content:     string;
  savedAt:     number;
  deployedAt?: number;
}

export type CodeFilesMap = Record<string, CodeFileEntry>;

const CODE_COL = "codeEditor";
const CODE_ID  = "files";

/**
 * Load all code editor files from Firestore.
 * Returns an empty map when Firebase is not available.
 */
export async function loadCodeFiles(): Promise<CodeFilesMap> {
  if (!FIREBASE_ENABLED || !adminDb) return {};
  try {
    const snap = await getDoc(doc(adminDb, CODE_COL, CODE_ID));
    return snap.exists() ? (snap.data() as CodeFilesMap) : {};
  } catch {
    return {};
  }
}

/**
 * Save (overwrite) a single file's content to Firestore.
 * Uses merge so other files in the same doc are untouched.
 */
export async function saveCodeFile(filename: string, content: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await setDoc(
    doc(adminDb, CODE_COL, CODE_ID),
    { [filename]: { content, savedAt: Date.now() } as CodeFileEntry },
    { merge: true },
  );
}

/**
 * Deploy a file: save content + stamp deployedAt so the admin panel knows
 * when this version was last pushed live.
 */
export async function deployCodeFile(filename: string, content: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const now = Date.now();
  await setDoc(
    doc(adminDb, CODE_COL, CODE_ID),
    { [filename]: { content, savedAt: now, deployedAt: now } as CodeFileEntry },
    { merge: true },
  );
}

// ─── PAYMENT CONFIG ───────────────────────────────────────────────────────────

export interface PaymentConfig {
  upiId: string;
  qrUrl: string;
}

const PAYMENT_DOC_PATH = ["payment_details", "config"] as const;

export function subscribePaymentConfig(cb: (cfg: PaymentConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) {
    cb({ upiId: "winggo@axl", qrUrl: "" });
    return () => {};
  }
  return onSnapshot(
    doc(adminDb, PAYMENT_DOC_PATH[0], PAYMENT_DOC_PATH[1]),
    (snap) => cb(snap.exists() ? (snap.data() as PaymentConfig) : { upiId: "winggo@axl", qrUrl: "" }),
    () => {},
  );
}

export async function savePaymentConfig(upiId: string, qrUrl: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await setDoc(
    doc(adminDb, PAYMENT_DOC_PATH[0], PAYMENT_DOC_PATH[1]),
    { upiId, qrUrl, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function uploadPaymentQR(file: File): Promise<string> {
  return _cldUpload(file, "winggo/payment/qr", "image");
}

// ─── VERSION SNAPSHOTS — Viras System ────────────────────────────────────────

export interface VersionSnapshot {
  id:         string;
  label:      string;
  versionNum: number;
  files:      Record<string, string>;
  createdAt:  number;
}

const VERSIONS_COL = "admin_versions";

async function _sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveVersionSnapshot(files: Record<string, string>): Promise<string> {
  if (!FIREBASE_ENABLED || !adminDb) return "";
  const q = query(collection(adminDb, VERSIONS_COL), orderBy("versionNum", "desc"), limit(1));
  const snap = await getDocs(q);
  const lastNum = snap.empty ? 0 : ((snap.docs[0].data() as VersionSnapshot).versionNum ?? 0);
  const versionNum = lastNum + 1;
  const now  = new Date();
  const day  = now.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  const label = `v${versionNum} · ${day} ${time}`;
  const ref = await addDoc(collection(adminDb, VERSIONS_COL), {
    label, versionNum, files, createdAt: Date.now(),
  });
  return ref.id;
}

export function subscribeVersionHistory(cb: (versions: VersionSnapshot[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(collection(adminDb, VERSIONS_COL), orderBy("createdAt", "desc"), limit(50));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as VersionSnapshot)));
  }, () => cb([]));
}

export async function rollbackToVersion(version: VersionSnapshot): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const now = Date.now();
  const merged: CodeFilesMap = {};
  for (const [name, content] of Object.entries(version.files)) {
    merged[name] = { content, savedAt: now, deployedAt: now };
  }
  await setDoc(doc(adminDb, CODE_COL, CODE_ID), merged, { merge: true });
}

// ─── STAFF MANAGEMENT ─────────────────────────────────────────────────────────

export interface StaffAccount {
  id:           string;
  username:     string;
  passwordHash: string;
  permissions:  StaffPermissions;
  createdAt:    number;
  active:       boolean;
  lastLogin?:   number;
}

const STAFF_COL = "staff_accounts";

export async function createStaffAccount(
  username: string,
  password: string,
  permissions: StaffPermissions,
): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  const passwordHash = await _sha256(password);
  await addDoc(collection(adminDb, STAFF_COL), {
    username: username.trim().toLowerCase(),
    passwordHash, permissions,
    createdAt: Date.now(), active: true,
  });
}

export function subscribeStaffAccounts(cb: (accounts: StaffAccount[]) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb([]); return () => {}; }
  const q = query(collection(adminDb, STAFF_COL), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffAccount)));
  }, () => cb([]));
}

export async function updateStaffAccount(
  id: string,
  data: Partial<Omit<StaffAccount, "id" | "createdAt">>,
): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  if (typeof data.username === "string") data.username = data.username.trim().toLowerCase();
  await updateDoc(doc(adminDb, STAFF_COL, id), data as DocumentData);
}

export async function resetStaffPassword(id: string, newPassword: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await updateDoc(doc(adminDb, STAFF_COL, id), { passwordHash: await _sha256(newPassword) });
}

export async function deleteStaffAccount(id: string): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await deleteDoc(doc(adminDb, STAFF_COL, id));
}

export async function staffSignIn(
  username: string,
  password: string,
): Promise<{ success: boolean; account?: StaffAccount; error?: string }> {
  if (!FIREBASE_ENABLED || !adminDb) {
    if (username === "staff" && password === "staff123") {
      return {
        success: true,
        account: {
          id: "demo", username: "staff", passwordHash: "",
          permissions: { users:true, deposits:true, withdrawals:false, kyc:false, games:false, marketing:false, notifications:false, referral:false },
          createdAt: Date.now(), active: true,
        },
      };
    }
    return { success: false, error: "Invalid credentials." };
  }
  try {
    const q = query(
      collection(adminDb, STAFF_COL),
      where("username", "==", username.trim().toLowerCase()),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return { success: false, error: "Invalid credentials." };
    const account = { id: snap.docs[0].id, ...snap.docs[0].data() } as StaffAccount;
    if (!account.active) return { success: false, error: "This staff account has been disabled." };
    if (await _sha256(password) !== account.passwordHash) return { success: false, error: "Invalid credentials." };
    await updateDoc(doc(adminDb, STAFF_COL, account.id), { lastLogin: Date.now() });
    return { success: true, account };
  } catch {
    return { success: false, error: "Authentication error. Please try again." };
  }
}

// suppress unused import warning
function _noop(_: DocumentData) {}
void _noop;

// ─── APP-OPEN BANNER AD ────────────────────────────────────────────────────────

export interface AppBannerConfig {
  enabled:   boolean;
  imageUrl:  string;
  link:      string;
  updatedAt: number;
}

const DEFAULT_BANNER: AppBannerConfig = { enabled: false, imageUrl: "", link: "", updatedAt: 0 };

export function subscribeAppBanner(cb: (c: AppBannerConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !adminDb) { cb(DEFAULT_BANNER); return () => {}; }
  return onSnapshot(doc(adminDb, "system", "app_banner"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_BANNER, ...snap.data() } as AppBannerConfig : DEFAULT_BANNER);
  }, () => cb(DEFAULT_BANNER));
}

export async function saveAppBanner(cfg: Partial<AppBannerConfig>): Promise<void> {
  if (!FIREBASE_ENABLED || !adminDb) return;
  await setDoc(doc(adminDb, "system", "app_banner"), { ...cfg, updatedAt: Date.now() }, { merge: true });
}

export async function uploadBannerImage(file: File): Promise<string> {
  return _cldUpload(file, "winggo/banners", "image");
}


// ─── MATCH HISTORY ────────────────────────────────────────────────────────────

export interface MatchHistoryRecord {
  id: string;
  uid: string;
  gameId: string;
  gameName: string;
  gameIcon: string;
  date: string;
  result: "win" | "loss";
  entryFee: number;
  prize: number;
  userScore?: number;
  opponentScore?: number;
  opponentName?: string;
  savedAt?: import("firebase/firestore").Timestamp;
}

/**
 * Fetch all match records from Firestore for admin panel display.
 * Returns up to 200 most recent matches.
 */
export async function getMatchHistoryAdmin(): Promise<MatchHistoryRecord[]> {
  if (!FIREBASE_ENABLED || !adminDb) return [];
  try {
    const { getDocs, query, collection, orderBy, limit } = await import("firebase/firestore");
    const q = query(
      collection(adminDb, "matches"),
      orderBy("savedAt", "desc"),
      limit(200),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MatchHistoryRecord));
  } catch (err) {
    console.warn("[getMatchHistoryAdmin]", err);
    return [];
  }
}
