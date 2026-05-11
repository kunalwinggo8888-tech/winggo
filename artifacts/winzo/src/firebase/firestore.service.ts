/**
 * Firestore Service — WINGGO
 * Collections:
 *   users/{uid}                  — user profiles
 *   wallets/{uid}                — wallet balances
 *   wallets/{uid}/transactions/  — transaction history (sub-collection)
 *   withdrawRequests/{id}        — withdrawal requests (admin approval)
 *   kycRequests/{uid}            — KYC documents
 *   games/{gameId}               — game catalog (admin managed)
 *   leaderboards/{gameType}      — top players
 *   notifications/{uid}/items/   — push notification log
 */
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, increment, Timestamp,
  getDocs, where, writeBatch,
  DocumentData,
} from "firebase/firestore";
import { db, FIREBASE_ENABLED } from "./config";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface UserProfile {
  uid?: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: number;
  kycStatus: "pending" | "submitted" | "approved" | "rejected";
  referralCode: string;
  referredBy: string | null;
  deviceInfo?: string;
  lastLoginAt?: number;
  fcmToken?: string;
  banned?: boolean;
}

export interface WalletBalance {
  winning: number;
  deposit: number;
  bonus: number;
  updatedAt?: Timestamp;
}

export interface FirestoreTransaction {
  id?: string;
  type: "win" | "withdraw" | "deposit" | "bonus" | "fee";
  title: string;
  rawAmount: number;
  display: string;
  color: string;
  status?: "pending" | "completed" | "rejected";
  createdAt: Timestamp | number;
  gameId?: string;
  roomId?: string;
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
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// ─── USER PROFILE ─────────────────────────────────────────────────────────────

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (!FIREBASE_ENABLED || !db) return null;
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as UserProfile;
}

export async function createUserProfile(uid: string, data: Omit<UserProfile, "uid">): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await setDoc(doc(db, "users", uid), { ...data, lastLoginAt: Date.now() });
  await initWallet(uid);
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "users", uid), { ...data, lastLoginAt: Date.now() });
}

export async function updateFCMToken(uid: string, token: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "users", uid), { fcmToken: token });
}

/** Subscribe to user profile changes */
export function subscribeUserProfile(uid: string, cb: (p: UserProfile) => void): () => void {
  if (!FIREBASE_ENABLED || !db) return () => {};
  return onSnapshot(doc(db, "users", uid), (snap) => {
    if (snap.exists()) cb({ uid: snap.id, ...snap.data() } as UserProfile);
  });
}

// ─── WALLET ───────────────────────────────────────────────────────────────────

const INITIAL_BALANCE: WalletBalance = { winning: 0, deposit: 50, bonus: 50 };

async function initWallet(uid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await setDoc(doc(db, "wallets", uid), {
    ...INITIAL_BALANCE,
    updatedAt: serverTimestamp(),
  });
}

/** Subscribe to live wallet balance changes */
export function subscribeWallet(uid: string, cb: (w: WalletBalance) => void): () => void {
  if (!FIREBASE_ENABLED || !db) return () => {};
  return onSnapshot(doc(db, "wallets", uid), (snap) => {
    if (snap.exists()) cb(snap.data() as WalletBalance);
  });
}

/** Subscribe to transaction history */
export function subscribeTransactions(uid: string, cb: (txs: FirestoreTransaction[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) return () => {};
  const q = query(
    collection(db, "wallets", uid, "transactions"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreTransaction));
    cb(txs);
  });
}

async function pushTransaction(uid: string, tx: Omit<FirestoreTransaction, "id" | "createdAt">): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await addDoc(collection(db, "wallets", uid, "transactions"), {
    ...tx,
    createdAt: serverTimestamp(),
  });
}

/** Deposit — adds to deposit bucket and optional bonus */
export async function firestoreDeposit(uid: string, amount: number, bonusPct: number): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const bonusAmt = Math.round(amount * bonusPct / 100);
  const batch = writeBatch(db);
  batch.update(doc(db, "wallets", uid), {
    deposit: increment(amount),
    bonus: increment(bonusAmt),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  await pushTransaction(uid, {
    type: "deposit",
    title: `Deposit + ${bonusPct}% Bonus`,
    rawAmount: amount + bonusAmt,
    display: `+₹${amount + bonusAmt}`,
    color: "#3498db",
    status: "completed",
  });
}

/** Withdraw — deducts from winning, creates pending request */
export async function firestoreWithdraw(uid: string, amount: number, upiId: string, email: string, displayName: string): Promise<string> {
  if (!FIREBASE_ENABLED || !db) return "";
  const batch = writeBatch(db);
  batch.update(doc(db, "wallets", uid), {
    winning: increment(-amount),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  const reqRef = await addDoc(collection(db, "withdrawRequests"), {
    uid, email, displayName, amount, upiId,
    status: "pending",
    requestedAt: serverTimestamp() as unknown as Timestamp,
  } satisfies Omit<WithdrawRequest, "id">);

  await pushTransaction(uid, {
    type: "withdraw",
    title: "Withdrawal — Pending Approval",
    rawAmount: -amount,
    display: `-₹${amount}`,
    color: "#f39c12",
    status: "pending",
  });
  return reqRef.id;
}

/** Add winning after a game result */
export async function firestoreAddWinning(uid: string, amount: number, title: string, roomId?: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "wallets", uid), {
    winning: increment(amount),
    updatedAt: serverTimestamp(),
  });
  await pushTransaction(uid, {
    type: "win", title,
    rawAmount: amount, display: `+₹${amount}`,
    color: "#27ae60", status: "completed",
    roomId,
  });
}

/** Deduct entry fee */
export async function firestoreDeductFee(uid: string, amount: number, title: string, roomId?: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "wallets", uid), {
    deposit: increment(-amount),
    updatedAt: serverTimestamp(),
  });
  await pushTransaction(uid, {
    type: "fee", title,
    rawAmount: -amount, display: `-₹${amount}`,
    color: "#e74c3c", status: "completed",
    roomId,
  });
}

/** Add bonus (referral, cashback, spin) */
export async function firestoreAddBonus(uid: string, amount: number, title: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "wallets", uid), {
    bonus: increment(amount),
    updatedAt: serverTimestamp(),
  });
  await pushTransaction(uid, {
    type: "bonus", title,
    rawAmount: amount, display: `+₹${amount}`,
    color: "#FFD700", status: "completed",
  });
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export async function submitKYC(uid: string, data: Omit<KYCRequest, "uid" | "submittedAt" | "status">): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await setDoc(doc(db, "kycRequests", uid), {
    ...data, uid,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "users", uid), { kycStatus: "submitted" });
}

export function subscribeKYC(uid: string, cb: (k: KYCRequest | null) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb(null); return () => {}; }
  return onSnapshot(doc(db, "kycRequests", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as KYCRequest) : null);
  });
}

// ─── GAMES CATALOG ────────────────────────────────────────────────────────────

export async function getGames(): Promise<GameConfig[]> {
  if (!FIREBASE_ENABLED || !db) return DEFAULT_GAMES;
  const snap = await getDocs(query(collection(db, "games"), where("isActive", "==", true)));
  if (snap.empty) return DEFAULT_GAMES;
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GameConfig));
}

export async function upsertGame(data: GameConfig): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  if (data.id) {
    await setDoc(doc(db, "games", data.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await addDoc(collection(db, "games"), { ...data, createdAt: serverTimestamp() });
  }
}

export async function deleteGame(gameId: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await deleteDoc(doc(db, "games", gameId));
}

// ─── LEADERBOARD ──────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string;
  totalWinnings: number;
  gamesPlayed: number;
  rank?: number;
}

export async function getLeaderboard(gameType: string, topN = 50): Promise<LeaderboardEntry[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  const snap = await getDocs(query(
    collection(db, "leaderboards", gameType, "players"),
    orderBy("totalWinnings", "desc"),
    limit(topN)
  ));
  return snap.docs.map((d, i) => ({ ...d.data(), rank: i + 1 } as LeaderboardEntry));
}

export async function updateLeaderboard(gameType: string, uid: string, winAmount: number): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const ref = doc(db, "leaderboards", gameType, "players", uid);
  await setDoc(ref, {
    totalWinnings: increment(winAmount),
    gamesPlayed: increment(1),
  }, { merge: true });
}

// ─── ADMIN — WITHDRAW REQUESTS ───────────────────────────────────────────────

export function subscribeWithdrawRequests(
  statusFilter: "pending" | "approved" | "rejected" | "all",
  cb: (reqs: WithdrawRequest[]) => void
): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = statusFilter === "all"
    ? query(collection(db, "withdrawRequests"), orderBy("requestedAt", "desc"), limit(100))
    : query(collection(db, "withdrawRequests"),
        where("status", "==", statusFilter),
        orderBy("requestedAt", "desc"), limit(100));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawRequest)));
  });
}

export async function approveWithdraw(requestId: string, adminUid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "withdrawRequests", requestId), {
    status: "approved",
    processedAt: serverTimestamp(),
    processedBy: adminUid,
  });
  // Also update matching pending tx status in user wallet
  const reqSnap = await getDoc(doc(db, "withdrawRequests", requestId));
  if (!reqSnap.exists()) return;
  const req = reqSnap.data() as WithdrawRequest;
  const txSnap = await getDocs(query(
    collection(db, "wallets", req.uid, "transactions"),
    where("type", "==", "withdraw"),
    where("status", "==", "pending"),
    limit(1)
  ));
  if (!txSnap.empty) {
    await updateDoc(txSnap.docs[0].ref, { status: "completed" });
  }
}

export async function rejectWithdraw(requestId: string, adminUid: string, reason: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const reqSnap = await getDoc(doc(db, "withdrawRequests", requestId));
  if (!reqSnap.exists()) return;
  const req = reqSnap.data() as WithdrawRequest;

  await updateDoc(doc(db, "withdrawRequests", requestId), {
    status: "rejected",
    processedAt: serverTimestamp(),
    processedBy: adminUid,
    rejectionReason: reason,
  });
  // Refund the winning amount
  await updateDoc(doc(db, "wallets", req.uid), { winning: increment(req.amount) });
  const txSnap = await getDocs(query(
    collection(db, "wallets", req.uid, "transactions"),
    where("type", "==", "withdraw"),
    where("status", "==", "pending"),
    limit(1)
  ));
  if (!txSnap.empty) {
    await updateDoc(txSnap.docs[0].ref, { status: "rejected" });
  }
}

// ─── ADMIN — USERS ────────────────────────────────────────────────────────────

export function subscribeUsers(cb: (users: UserProfile[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ uid: d.id, ...d.data() } as UserProfile)));
  });
}

export async function banUser(uid: string, banned: boolean): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await updateDoc(doc(db, "users", uid), { banned });
}

// ─── ADMIN — KYC REQUESTS ────────────────────────────────────────────────────

export function subscribeKYCRequests(cb: (reqs: KYCRequest[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, "kycRequests"),
    where("status", "==", "pending"),
    orderBy("submittedAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => d.data() as KYCRequest));
  });
}

export async function approveKYC(uid: string, adminUid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "kycRequests", uid), {
    status: "approved", reviewedAt: serverTimestamp(), reviewedBy: adminUid,
  });
  batch.update(doc(db, "users", uid), { kycStatus: "approved" });
  await batch.commit();
}

export async function rejectKYC(uid: string, adminUid: string, reason: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const batch = writeBatch(db);
  batch.update(doc(db, "kycRequests", uid), {
    status: "rejected", reviewedAt: serverTimestamp(),
    reviewedBy: adminUid, rejectionReason: reason,
  });
  batch.update(doc(db, "users", uid), { kycStatus: "rejected" });
  await batch.commit();
}

// ─── REMOTE CONFIG (via Firestore doc) ───────────────────────────────────────

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

export function subscribeAppConfig(cb: (c: AppConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb(DEFAULT_APP_CONFIG); return () => {}; }
  return onSnapshot(doc(db, "config", "app"), (snap) => {
    if (snap.exists()) cb({ ...DEFAULT_APP_CONFIG, ...snap.data() } as AppConfig);
    else cb(DEFAULT_APP_CONFIG);
  });
}

export async function updateAppConfig(data: Partial<AppConfig>): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await setDoc(doc(db, "config", "app"), data, { merge: true });
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

export interface DailyStats {
  date: string;
  newUsers: number;
  activeUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  gamesPlayed: number;
  revenue: number;
}

export async function getDailyStats(days = 7): Promise<DailyStats[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  const snap = await getDocs(query(
    collection(db, "analytics", "daily", "stats"),
    orderBy("date", "desc"),
    limit(days)
  ));
  return snap.docs.map((d) => d.data() as DailyStats).reverse();
}

// ─── GAMES (admin-managed, read by player app) ───────────────────────────────

/** Subscribe to live game catalog — admin can toggle games on/off */
export function subscribeGames(cb: (games: GameConfig[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb(DEFAULT_GAMES); return () => {}; }
  return onSnapshot(
    query(collection(db, "games"), orderBy("name")),
    (snap) => {
      if (snap.empty) {
        cb(DEFAULT_GAMES);
      } else {
        cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as GameConfig)));
      }
    },
    () => cb(DEFAULT_GAMES)
  );
}

/** Write game catalog seed to Firestore if empty */
export async function seedGamesIfEmpty(): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const snap = await getDocs(collection(db, "games"));
  if (!snap.empty) return;
  const batch = writeBatch(db);
  DEFAULT_GAMES.forEach((g) => {
    const ref = g.id ? doc(db!, "games", g.id) : doc(collection(db!, "games"));
    batch.set(ref, { ...g, createdAt: serverTimestamp() });
  });
  await batch.commit();
}

// ─── DEFAULT GAMES (fallback when Firestore not configured) ──────────────────

export const DEFAULT_GAMES: GameConfig[] = [
  { id: "ludo",    name: "Ludo Classic",     category: "board",   thumbnail: "🎲", entryFees: [1,5,10,50], prizeMultiplier: 1.8, maxPlayers: 4, isActive: true,  isBotEnabled: true, botJoinDelaySec: 15 },
  { id: "worldwar",name: "World War",         category: "battle",  thumbnail: "⚔️", entryFees: [10,25,50],  prizeMultiplier: 1.9, maxPlayers: 10,isActive: true,  isBotEnabled: true, botJoinDelaySec: 10 },
  { id: "carrom",  name: "Carrom",            category: "board",   thumbnail: "🎯", entryFees: [5,10,25],   prizeMultiplier: 1.8, maxPlayers: 2, isActive: false, isBotEnabled: true, botJoinDelaySec: 15 },
  { id: "snakes",  name: "Snake & Ladder",    category: "board",   thumbnail: "🐍", entryFees: [2,5,10],    prizeMultiplier: 1.8, maxPlayers: 4, isActive: false, isBotEnabled: true, botJoinDelaySec: 12 },
  { id: "bubble",  name: "Bubble Shooter",    category: "arcade",  thumbnail: "🫧", entryFees: [5,10],      prizeMultiplier: 1.7, maxPlayers: 2, isActive: false, isBotEnabled: true, botJoinDelaySec: 20 },
  { id: "cricket", name: "Cricket Fantasy",   category: "sports",  thumbnail: "🏏", entryFees: [25,50,100], prizeMultiplier: 2.0, maxPlayers: 6, isActive: false, isBotEnabled: false,botJoinDelaySec: 30 },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unused(_: DocumentData) {}
