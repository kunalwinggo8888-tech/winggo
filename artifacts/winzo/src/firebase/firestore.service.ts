/**
 * Firestore Service — WINGGO
 * Collections:
 *   users/{uid}                  — user profiles
 *   wallets/{uid}                — wallet balances
 *   wallets/{uid}/transactions/  — transaction history (sub-collection)
 *   deposits/{id}                — all deposit records (razorpay payment proof)
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
import { db, storage, FIREBASE_ENABLED } from "./config";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

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
  signupBonusClaimed?: boolean;
}

export interface WalletBalance {
  winning: number;
  deposit: number;
  bonus: number;
  updatedAt?: Timestamp;
  signupBonusClaimed?: boolean;
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
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}

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

export interface BankDetails {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}

export interface WithdrawRequest {
  id?: string;
  uid: string;
  email: string;
  displayName: string;
  amount: number;
  method: "upi" | "bank";
  upiId?: string;
  bankDetails?: BankDetails;
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
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return { uid: snap.id, ...snap.data() } as UserProfile;
  } catch {
    return null;
  }
}

export async function createUserProfile(uid: string, data: Omit<UserProfile, "uid">): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  try {
    await setDoc(doc(db, "users", uid), {
      ...data,
      lastLoginAt: Date.now(),
      signupBonusClaimed: true,
    });
    await initWallet(uid);
  } catch {
    // Swallow — network may be temporarily unavailable; user can still use the app
  }
}

export async function updateUserProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  try {
    await updateDoc(doc(db, "users", uid), { ...data, lastLoginAt: Date.now() });
  } catch {
    // Non-fatal — local state already updated
  }
}

/**
 * Called on every successful login (new AND returning users).
 *
 * - If `users/{uid}` doc is MISSING → creates it with setDoc (safety net for
 *   cases where the signup fire-and-forget failed) and initialises the wallet.
 * - If doc EXISTS → updates `lastLoginAt` so the admin panel's
 *   "Online Right Now" counter reflects real user activity.
 *
 * This call is always fire-and-forget — it never blocks the dashboard.
 */
export async function ensureUserProfile(
  uid: string,
  email: string,
  displayName: string,
  photoURL: string,
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  try {
    const userRef = doc(db, "users", uid);
    const snap    = await getDoc(userRef);

    if (!snap.exists()) {
      // Profile missing — recreate it (signup fire-and-forget may have failed)
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const referralCode = Array.from(
        { length: 8 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join("");

      await setDoc(userRef, {
        email,
        displayName,
        photoURL,
        createdAt:           Date.now(),
        lastLoginAt:         Date.now(),
        kycStatus:           "pending",
        referralCode,
        referredBy:          null,
        signupBonusClaimed:  false,
      });

      // Give the user a wallet so they can start playing immediately
      await initWallet(uid);
    } else {
      // Existing user — bump lastLoginAt (drives admin "Online Right Now")
      await updateDoc(userRef, { lastLoginAt: Date.now() });
    }
  } catch {
    // Non-fatal — login proceeds regardless of Firestore availability
  }
}

export async function updateFCMToken(uid: string, token: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  try {
    await updateDoc(doc(db, "users", uid), { fcmToken: token });
  } catch { /* non-fatal */ }
}

/** Subscribe to user profile changes */
export function subscribeUserProfile(uid: string, cb: (p: UserProfile) => void): () => void {
  if (!FIREBASE_ENABLED || !db) return () => {};
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => { if (snap.exists()) cb({ uid: snap.id, ...snap.data() } as UserProfile); },
    () => { /* ignore offline snapshot errors */ },
  );
}

// ─── WALLET ───────────────────────────────────────────────────────────────────

const INITIAL_BALANCE: WalletBalance = { winning: 0, deposit: 0, bonus: 50 };

/**
 * Create wallet for a brand-new user.
 * Protected: if wallet already exists (e.g. network retry), we do NOT overwrite it.
 * This guarantees the ₹50 signup bonus is given exactly once.
 */
async function initWallet(uid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const walletRef = doc(db, "wallets", uid);
  const existing = await getDoc(walletRef);
  if (existing.exists()) return;          // wallet already initialised — never overwrite
  await setDoc(walletRef, {
    ...INITIAL_BALANCE,
    signupBonusClaimed: true,
    updatedAt: serverTimestamp(),
  });
  // Record the ₹50 welcome bonus transaction so it shows in history
  await pushTransaction(uid, {
    type: "bonus",
    title: "🎁 Welcome Bonus",
    rawAmount: 50,
    display: "+₹50",
    color: "#FFD700",
    status: "completed",
  });
}

/**
 * Returns true if the signup bonus has already been given to this user.
 * Checked on login to prevent any duplicate-bonus edge-case.
 */
export async function hasSignupBonusClaimed(uid: string): Promise<boolean> {
  if (!FIREBASE_ENABLED || !db) return true;
  try {
    const snap = await getDoc(doc(db, "wallets", uid));
    if (!snap.exists()) return false;
    return snap.data()?.signupBonusClaimed === true;
  } catch {
    return true;  // safe default: assume claimed when we can't check
  }
}

/** Subscribe to live wallet balance changes */
export function subscribeWallet(uid: string, cb: (w: WalletBalance) => void): () => void {
  if (!FIREBASE_ENABLED || !db) return () => {};
  return onSnapshot(
    doc(db, "wallets", uid),
    (snap) => { if (snap.exists()) cb(snap.data() as WalletBalance); },
    () => { /* ignore offline snapshot errors */ },
  );
}

/** Subscribe to transaction history */
export function subscribeTransactions(uid: string, cb: (txs: FirestoreTransaction[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) return () => {};
  const q = query(
    collection(db, "wallets", uid, "transactions"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  return onSnapshot(
    q,
    (snap) => {
      const txs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreTransaction));
      cb(txs);
    },
    () => { /* ignore offline snapshot errors */ },
  );
}

async function pushTransaction(uid: string, tx: Omit<FirestoreTransaction, "id" | "createdAt">): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await addDoc(collection(db, "wallets", uid, "transactions"), {
    ...tx,
    createdAt: serverTimestamp(),
  });
}

/**
 * Deposit — called ONLY after server-side signature verification succeeds.
 * Adds to deposit bucket, optional bonus, saves a DepositRecord for admin.
 */
export async function firestoreDeposit(
  uid: string,
  amount: number,
  bonusPct: number,
  opts: {
    displayName?: string;
    email?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    method?: string;
  } = {}
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const bonusAmt = Math.round(amount * bonusPct / 100);
  const batch = writeBatch(db);
  batch.update(doc(db, "wallets", uid), {
    deposit: increment(amount),
    bonus:   bonusPct > 0 ? increment(bonusAmt) : increment(0),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  // Save full deposit record for admin panel
  const depositRecord: Omit<DepositRecord, "id"> = {
    uid,
    email:              opts.email ?? "",
    displayName:        opts.displayName ?? "",
    amount,
    bonusPct,
    bonusAmount:        bonusAmt,
    razorpayOrderId:    opts.razorpayOrderId ?? "",
    razorpayPaymentId:  opts.razorpayPaymentId ?? "",
    method:             opts.method ?? "Razorpay",
    status:             "success",
    createdAt:          serverTimestamp() as unknown as Timestamp,
  };
  await addDoc(collection(db, "deposits"), depositRecord);

  // Transaction in user wallet sub-collection
  await pushTransaction(uid, {
    type:   "deposit",
    title:  bonusPct > 0 ? `Deposit + ${bonusPct}% Bonus` : "Deposit",
    rawAmount: amount + bonusAmt,
    display:   `+₹${amount + bonusAmt}`,
    color:     "#3498db",
    status:    "completed",
    razorpayPaymentId: opts.razorpayPaymentId,
    razorpayOrderId:   opts.razorpayOrderId,
  });
}

/** Withdraw — deducts from winning, creates pending request */
export async function firestoreWithdraw(
  uid: string,
  amount: number,
  method: "upi" | "bank",
  paymentDetails: { upiId?: string; bankDetails?: BankDetails },
  email: string,
  displayName: string,
): Promise<string> {
  if (!FIREBASE_ENABLED || !db) return "";
  const batch = writeBatch(db);
  batch.update(doc(db, "wallets", uid), {
    winning: increment(-amount),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();

  const reqData: Omit<WithdrawRequest, "id"> = {
    uid, email, displayName, amount, method,
    status: "pending",
    requestedAt: serverTimestamp() as unknown as Timestamp,
  };
  if (method === "upi" && paymentDetails.upiId) reqData.upiId = paymentDetails.upiId;
  if (method === "bank" && paymentDetails.bankDetails) reqData.bankDetails = paymentDetails.bankDetails;

  const reqRef = await addDoc(collection(db, "withdrawRequests"), reqData);

  const methodLabel = method === "upi"
    ? `UPI: ${paymentDetails.upiId}`
    : `Bank: ${paymentDetails.bankDetails?.bankName ?? "Account"}`;

  await pushTransaction(uid, {
    type: "withdraw",
    title: `Withdrawal — ${methodLabel}`,
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

// ─── ADMIN — DEPOSIT RECORDS ──────────────────────────────────────────────────

/** Subscribe to all real Razorpay deposits (admin panel) */
export function subscribeDeposits(cb: (deps: DepositRecord[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(collection(db, "deposits"), orderBy("createdAt", "desc"), limit(200));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRecord)));
  }, () => cb([]));
}

/** Get deposit stats (total deposited, count) for admin summary */
export async function getDepositStats(): Promise<{ total: number; count: number; today: number }> {
  if (!FIREBASE_ENABLED || !db) return { total: 0, count: 0, today: 0 };
  try {
    const snap = await getDocs(query(collection(db, "deposits"), where("status", "==", "success"), limit(500)));
    const now = Date.now();
    const todayStart = now - 86400000;
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

  { id: "carrom",  name: "Carrom",            category: "board",   thumbnail: "🎯", entryFees: [5,10,25],   prizeMultiplier: 1.8, maxPlayers: 2, isActive: true,  isBotEnabled: true, botJoinDelaySec: 15 },
  { id: "snakes",  name: "Snake & Ladder",    category: "board",   thumbnail: "🐍", entryFees: [2,5,10],    prizeMultiplier: 1.8, maxPlayers: 4, isActive: true,  isBotEnabled: true, botJoinDelaySec: 12 },
  { id: "bubble",  name: "Bubble Shooter",    category: "arcade",  thumbnail: "🫧", entryFees: [5,10],      prizeMultiplier: 1.7, maxPlayers: 2, isActive: true,  isBotEnabled: true, botJoinDelaySec: 20 },
  { id: "cricket", name: "Cricket Fantasy",   category: "sports",  thumbnail: "🏏", entryFees: [25,50,100], prizeMultiplier: 2.0, maxPlayers: 6, isActive: false, isBotEnabled: false,botJoinDelaySec: 30 },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _unused(_: DocumentData) {}

// ─── DEPOSIT REQUESTS (Screenshot System) ────────────────────────────────────

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

export async function uploadDepositScreenshot(uid: string, file: File): Promise<string> {
  if (!FIREBASE_ENABLED || !storage) {
    return "https://placehold.co/400x300/0a0a0f/FFD700?text=Screenshot";
  }
  const ext = file.name.split(".").pop() ?? "jpg";
  const sRef = storageRef(storage, `depositScreenshots/${uid}/${Date.now()}.${ext}`);
  await uploadBytes(sRef, file);
  return getDownloadURL(sRef);
}

export async function submitScreenshotDeposit(
  uid: string,
  email: string,
  displayName: string,
  amount: number,
  screenshotUrl: string,
  utrRef: string,
): Promise<string> {
  if (!FIREBASE_ENABLED || !db) return `local_${Date.now()}`;
  const req: Omit<DepositRequest, "id"> = {
    uid, email, displayName, amount, screenshotUrl, utrRef,
    status: "pending",
    requestedAt: serverTimestamp() as Timestamp,
  };
  const docRef = await addDoc(collection(db, "depositRequests"), req);
  await addDoc(collection(db, `wallets/${uid}/transactions`), {
    type: "deposit",
    title: `Deposit Request — ₹${amount}`,
    rawAmount: amount,
    display: `+₹${amount}`,
    color: "#3498db",
    status: "pending",
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function subscribeUserDepositRequests(
  uid: string,
  cb: (reqs: DepositRequest[]) => void,
): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, "depositRequests"),
    where("uid", "==", uid),
    orderBy("requestedAt", "desc"),
    limit(20),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest)));
  }, () => cb([]));
}
