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
 *   dailyWithdrawLimits/{uid}    — daily withdrawal tracking per user
 */
import {
  doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, orderBy, limit, onSnapshot,
  serverTimestamp, increment, Timestamp,
  getDocs, where, writeBatch, runTransaction,
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
  signupBonusClaimed?: boolean;
  totalReferralEarnings?: number;
  totalFriendsJoined?: number;
  pendingReferralBonus?: number;
}

export interface ReferralStats {
  totalReferralEarnings: number;
  totalFriendsJoined: number;
  pendingReferralBonus: number;
  referralCode: string;
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

export interface DailyWithdrawLimit {
  uid: string;
  date: string; // YYYY-MM-DD format
  count: number;
  limit: number;
  lastWithdrawalAt?: Timestamp | number;
  updatedAt: Timestamp | number;
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
  docType: "aadhaar" | "pan" | "passport" | "mobile";
  docNumber: string;
  frontURL?: string;
  backURL?: string;
  selfieURL?: string;
  panURL?: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface LeaderboardEntry {
  uid: string;
  username: string;
  photoURL: string;
  totalPoints: number;
  updatedAt?: number;
}

const LEADERBOARD_COLLECTION = "leaderboard";

/** Increment a user's leaderboard points after every finished match. */
export async function updateLeaderboardPoints(
  uid: string,
  username: string,
  photoURL: string,
  points: number
): Promise<void> {
  if (!FIREBASE_ENABLED || !db || !uid || points <= 0) return;
  try {
    const ref = doc(db, LEADERBOARD_COLLECTION, uid);
    await setDoc(ref, {
      uid,
      username: username || "Player",
      photoURL: photoURL || "",
      totalPoints: increment(points),
      updatedAt: Date.now(),
    }, { merge: true });
  } catch {
    /* silent — leaderboard must never break gameplay */
  }
}

/** Live top-N leaderboard (auto-refreshes on every Firestore write). */
export function subscribeLeaderboard(
  limitN: number,
  cb: (leaders: LeaderboardEntry[]) => void
): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  try {
    const q = query(
      collection(db, LEADERBOARD_COLLECTION),
      orderBy("totalPoints", "desc"),
      limit(limitN)
    );
    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => d.data() as LeaderboardEntry).filter(Boolean);
        cb(rows);
      },
      () => cb([])
    );
  } catch {
    cb([]);
    return () => {};
  }
}

export async function getLeaderboard(gameType: string = "ludo"): Promise<LeaderboardEntry[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  try {
    const snap = await getDocs(
      query(
        collection(db, LEADERBOARD_COLLECTION),
        orderBy("totalPoints", "desc"),
        limit(20)
      )
    );
    return snap.docs.map((d) => d.data() as LeaderboardEntry).filter(Boolean);
  } catch {
    return [];
  }
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

export interface LudoMatchResult {
  id?: string;
  uid: string;
  opponentName: string;
  opponentIsBot: boolean;
  playerScore: number;
  opponentScore: number;
  won: boolean;
  entryFee: number;
  prizeAmount: number;
  tier: "easy" | "medium" | "god";
  duration: number; // seconds
  moves: number;
  kills: number;
  forfeited: boolean;
  playedAt: Timestamp;
  roomId?: string;
}

// ─── LUDO MATCH RESULTS ───────────────────────────────────────────────────────

/** Save a Ludo match result to Firestore */
export async function saveLudoMatchResult(data: Omit<LudoMatchResult, "id" | "playedAt">): Promise<string> {
  if (!FIREBASE_ENABLED || !db) return "";
  const docRef = await addDoc(collection(db, "ludoMatches"), {
    ...data,
    playedAt: serverTimestamp(),
  });
  return docRef.id;
}

/** Get user's Ludo match history */
export async function getLudoMatchHistory(uid: string, limitCount = 50): Promise<LudoMatchResult[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  const snap = await getDocs(query(
    collection(db, "ludoMatches"),
    where("uid", "==", uid),
    orderBy("playedAt", "desc"),
    limit(limitCount)
  ));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as LudoMatchResult));
}

/** Subscribe to user's Ludo match history in real-time */
export function subscribeLudoMatchHistory(uid: string, cb: (matches: LudoMatchResult[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, "ludoMatches"),
    where("uid", "==", uid),
    orderBy("playedAt", "desc"),
    limit(50)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LudoMatchResult)));
  }, () => cb([]));
}

/** Get live Ludo matches for admin dashboard */
export function subscribeLiveLudoMatches(cb: (matches: LudoMatchResult[]) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, "ludoMatches"),
    orderBy("playedAt", "desc"),
    limit(100)
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LudoMatchResult)));
  }, () => cb([]));
}

/** Get Ludo stats for admin dashboard */
export async function getLudoStats(): Promise<{
  totalMatches: number;
  activeMatches: number;
  realPlayers: number;
  botPlayers: number;
  totalWinnings: number;
  todayMatches: number;
}> {
  if (!FIREBASE_ENABLED || !db) {
    return { totalMatches: 0, activeMatches: 0, realPlayers: 0, botPlayers: 0, totalWinnings: 0, todayMatches: 0 };
  }
  try {
    const snap = await getDocs(query(collection(db, "ludoMatches"), limit(1000)));
    const now = Date.now();
    const todayStart = now - 86400000;
    let totalMatches = snap.size;
    let todayMatches = 0;
    let realPlayers = 0;
    let botPlayers = 0;
    let totalWinnings = 0;
    
    snap.docs.forEach((d) => {
      const match = d.data() as LudoMatchResult;
      const ts = typeof match.playedAt === "number"
        ? match.playedAt
        : ((match.playedAt as Timestamp | undefined)?.seconds ?? 0) * 1000;
      if (ts > todayStart) todayMatches++;
      if (match.opponentIsBot) {
        botPlayers++;
      } else {
        realPlayers++;
      }
      if (match.won) totalWinnings += match.prizeAmount;
    });
    
    // Active matches = matches played in last 5 minutes
    const activeMatches = snap.docs.filter((d) => {
      const match = d.data() as LudoMatchResult;
      const ts = typeof match.playedAt === "number"
        ? match.playedAt
        : ((match.playedAt as Timestamp | undefined)?.seconds ?? 0) * 1000;
      return now - ts < 300000; // 5 minutes
    }).length;
    
    return { totalMatches, activeMatches, realPlayers, botPlayers, totalWinnings, todayMatches };
  } catch {
    return { totalMatches: 0, activeMatches: 0, realPlayers: 0, botPlayers: 0, totalWinnings: 0, todayMatches: 0 };
  }
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

/**
 * Subscribe to a user's referral statistics in real-time.
 * Reads totalReferralEarnings, totalFriendsJoined, pendingReferralBonus
 * directly from the users/{uid} document.
 * Safely defaults all three fields to 0 when the document is new or fields are missing.
 */
export function subscribeReferralStats(
  uid: string,
  cb: (stats: ReferralStats) => void,
): () => void {
  if (!FIREBASE_ENABLED || !db) {
    cb({ totalReferralEarnings: 0, totalFriendsJoined: 0, pendingReferralBonus: 0, referralCode: "" });
    return () => {};
  }
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      const data = snap.exists() ? (snap.data() as Partial<UserProfile>) : {};
      cb({
        totalReferralEarnings: data.totalReferralEarnings ?? 0,
        totalFriendsJoined:    data.totalFriendsJoined    ?? 0,
        pendingReferralBonus:  data.pendingReferralBonus  ?? 0,
        referralCode:          data.referralCode          ?? "",
      });
    },
    () => { /* ignore offline errors — keep last known value */ },
  );
}

// ─── WALLET ───────────────────────────────────────────────────────────────────

const INITIAL_BALANCE: WalletBalance = { winning: 0, deposit: 0, bonus: 25 };

/**
 * Create wallet for a brand-new user.
 * Protected: if wallet already exists (e.g. network retry), we do NOT overwrite it.
 * This guarantees the ₹25 signup bonus is given exactly once.
 * Exported so that social-login flows (Google, Facebook) can call it directly.
 */
export async function initWallet(uid: string): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const walletRef = doc(db, "wallets", uid);
  const existing = await getDoc(walletRef);
  if (existing.exists()) return;          // wallet already initialised — never overwrite
  await setDoc(walletRef, {
    ...INITIAL_BALANCE,
    signupBonusClaimed: true,
    updatedAt: serverTimestamp(),
  });
  // Record the ₹25 welcome bonus transaction so it shows in history
  await pushTransaction(uid, {
    type: "bonus",
    title: "🎁 Welcome Bonus",
    rawAmount: 25,
    display: "+₹25",
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

/** Get today's date in YYYY-MM-DD format */
function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Withdraw — deducts from winning, creates pending request (atomic batch) */
export async function firestoreWithdraw(
  uid: string,
  amount: number,
  method: "upi" | "bank",
  paymentDetails: { upiId?: string; bankDetails?: BankDetails },
  email: string,
  displayName: string,
): Promise<string> {
  if (!FIREBASE_ENABLED || !db) return "";

  const reqData: Omit<WithdrawRequest, "id"> = {
    uid, email, displayName, amount, method,
    status: "pending",
    requestedAt: serverTimestamp() as unknown as Timestamp,
  };
  if (method === "upi" && paymentDetails.upiId) reqData.upiId = paymentDetails.upiId;
  if (method === "bank" && paymentDetails.bankDetails) reqData.bankDetails = paymentDetails.bankDetails;

  // Atomic batch: wallet deduction + withdrawRequest creation in a single write.
  // Previously these were separate writes; if the addDoc failed after batch.commit()
  // the user's balance was already deducted with no record in admin panel.
  const reqRef = doc(collection(db, "withdrawRequests"));
  const batch  = writeBatch(db);
  batch.update(doc(db, "wallets", uid), {
    winning: increment(-amount),
    updatedAt: serverTimestamp(),
  });
  batch.set(reqRef, reqData);
  await batch.commit();

  // Increment daily withdrawal count
  await incrementDailyWithdrawCount(uid);

  const methodLabel = method === "upi"
    ? `UPI: ${paymentDetails.upiId}`
    : `Bank: ${paymentDetails.bankDetails?.bankName ?? "Account"}`;

  // Transaction history is non-critical; fire-and-forget is acceptable here.
  pushTransaction(uid, {
    type: "withdraw",
    title: `Withdrawal — ${methodLabel}`,
    rawAmount: -amount,
    display: `-₹${amount}`,
    color: "#f39c12",
    status: "pending",
  }).catch((err) => console.error("[Wallet] pushTransaction (withdraw) failed:", err?.code ?? err));

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

// NOTE: firestoreDeductFee (legacy deposit-only deduction) has been removed.
// Use firestoreDeductEntryFee which implements the correct 90% Real + 10% Bonus split.

/**
 * Deduct entry fee with 90% Real Cash + 10% Bonus Cash split.
 *   - Bonus part = min(bonusBalance, floor(amount × 10%))
 *   - Real part  = amount − bonusPart  (drained: deposit first → winning)
 *   - If bonus = 0 → entire amount comes from real cash only
 * Uses a Firestore transaction so the read-compute-write is atomic.
 */
export async function firestoreDeductEntryFee(
  uid: string,
  amount: number,
  title: string,
  roomId?: string,
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  const _db = db;   // capture non-null for use inside async callback

  await runTransaction(_db, async (txn) => {
    const walletRef = doc(_db, "wallets", uid);
    const snap = await txn.get(walletRef);
    const w = snap.exists()
      ? (snap.data() as WalletBalance)
      : ({ winning: 0, deposit: 0, bonus: 0 } as WalletBalance);

    // ── 90 / 10 split ────────────────────────────────────────────────────────
    const bonusCut  = Math.floor(amount * 0.10);
    const bonusPart = Math.min(w.bonus ?? 0, bonusCut);
    const realPart  = amount - bonusPart;

    // Drain real part: deposit bucket first, then winning bucket
    const realFromDeposit = Math.min(w.deposit ?? 0, realPart);
    const realFromWinning = realPart - realFromDeposit;

    const updates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (realFromDeposit > 0) updates.deposit = increment(-realFromDeposit);
    if (realFromWinning > 0) updates.winning  = increment(-realFromWinning);
    if (bonusPart       > 0) updates.bonus    = increment(-bonusPart);

    txn.update(walletRef, updates);
  });

  // Record consolidated transaction (shows in wallet history)
  await pushTransaction(uid, {
    type: "fee", title,
    rawAmount: -amount,
    display: `-₹${amount}`,
    color: "#e74c3c",
    status: "completed",
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
// ─── SPIN WHEEL CONFIG ───────────────────────────────────────────────────────────

export interface SpinWheelSegment {
  label: string;
  weight: number;
  color: string;
  cashValue?: number;
}

export interface SpinWheelConfig {
  enabled: boolean;
  dailySpinLimit: number;
  segments: SpinWheelSegment[];
  updatedAt?: Timestamp;
}

const DEFAULT_SPIN_WHEEL: SpinWheelConfig = {
  enabled: true,
  dailySpinLimit: 1,
  segments: [
    { label: "₹5 Cash", weight: 25, color: "#FFD700", cashValue: 5 },
    { label: "10 Coins", weight: 20, color: "#3B82F6", cashValue: 0 },
    { label: "Better Luck", weight: 15, color: "#374151", cashValue: 0 },
    { label: "₹10 Cash", weight: 15, color: "#EF4444", cashValue: 10 },
    { label: "2x Referral", weight: 10, color: "#8B5CF6", cashValue: 0 },
    { label: "₹2 Bonus", weight: 8, color: "#10B981", cashValue: 2 },
    { label: "50 Coins", weight: 5, color: "#F97316", cashValue: 0 },
    { label: "₹20 Cash", weight: 2, color: "#EC4899", cashValue: 20 },
  ],
};

export function subscribeSpinWheelConfig(cb: (c: SpinWheelConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb(DEFAULT_SPIN_WHEEL); return () => {}; }
  return onSnapshot(doc(db, "config", "spinWheel"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_SPIN_WHEEL, ...snap.data() } as SpinWheelConfig : DEFAULT_SPIN_WHEEL);
  });
}

export async function updateSpinWheelConfig(data: Partial<SpinWheelConfig>): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await setDoc(doc(db, "config", "spinWheel"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

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
        : ((dep.createdAt as Timestamp | undefined)?.seconds ?? 0) * 1000;
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
  forceUpdateEnabled: boolean;
  updateMessage: string;
  updateButtonText: string;
  depositBonusPct: number;
  maxWithdrawPerDay: number;
  referralBonusAmount: number;
  spinWheelEnabled: boolean;
  minWithdrawAmount: number;
  maxWithdrawAmount: number;
  announcementBanner: string;
  announcementActive: boolean;
}

export interface SupportConfig {
  gmail: string;
  instagramUrl: string;
  instagramUsername: string;
  supportText: string;
  updatedAt?: Timestamp;
}

export const DEFAULT_SUPPORT_CONFIG: SupportConfig = {
  gmail: "support@winggo.com",
  instagramUrl: "https://instagram.com/winggo",
  instagramUsername: "winggo_official",
  supportText: "For support, contact us via email or Instagram. We typically respond within 24 hours.",
};

export function subscribeSupportConfig(cb: (c: SupportConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb(DEFAULT_SUPPORT_CONFIG); return () => {}; }
  return onSnapshot(doc(db, "config", "support"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_SUPPORT_CONFIG, ...snap.data() } as SupportConfig : DEFAULT_SUPPORT_CONFIG);
  });
}

export async function updateSupportConfig(data: Partial<SupportConfig>): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  await setDoc(doc(db, "config", "support"), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export const DEFAULT_APP_CONFIG: AppConfig = {
  maintenanceMode: false,
  forceUpdateVersion: "1.0.0",
  forceUpdateEnabled: false,
  updateMessage: "",
  updateButtonText: "Update Now",
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

// ─── APP-OPEN BANNER AD ────────────────────────────────────────────────────────

export interface AppBannerConfig {
  enabled:   boolean;
  imageUrl:  string;
  link:      string;
  updatedAt: number;
}

export const DEFAULT_APP_BANNER: AppBannerConfig = {
  enabled: false, imageUrl: "", link: "", updatedAt: 0,
};

export function subscribeAppBanner(cb: (c: AppBannerConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !db) { cb(DEFAULT_APP_BANNER); return () => {}; }
  return onSnapshot(doc(db, "system", "app_banner"), (snap) => {
    cb(snap.exists() ? { ...DEFAULT_APP_BANNER, ...snap.data() } as AppBannerConfig : DEFAULT_APP_BANNER);
  }, () => cb(DEFAULT_APP_BANNER));
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
  { id: "superludo", name: "Super Ludo",     category: "board",   thumbnail: "🎲", entryFees: [2,5,10,20,50,100], prizeMultiplier: 1.8, maxPlayers: 2, isActive: true, isBotEnabled: true, botJoinDelaySec: 8 },

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
  const PLACEHOLDER = "https://placehold.co/400x300/0a0a0f/FFD700?text=Screenshot";
  const cloudName    = (typeof import.meta !== "undefined" ? import.meta.env.VITE_CLOUDINARY_CLOUD_NAME    : "") ?? "";
  const uploadPreset = (typeof import.meta !== "undefined" ? import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET : "") ?? "";
  if (!cloudName || !uploadPreset) {
    // Cloudinary not configured — return placeholder so Firestore doc is still created
    return PLACEHOLDER;
  }
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);
    formData.append("folder", `winggo/deposits/${uid}`);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) return PLACEHOLDER;
    const data = await res.json() as { secure_url: string };
    return data.secure_url ?? PLACEHOLDER;
  } catch {
    // Network error or invalid Cloudinary creds — do NOT throw.
    // The deposit request should still be submitted to Firestore.
    return PLACEHOLDER;
  }
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

// ─── PAYMENT CONFIG ───────────────────────────────────────────────────────────

export interface PaymentConfig {
  upiId: string;
  qrUrl: string;
}

export function subscribePaymentConfig(cb: (cfg: PaymentConfig) => void): () => void {
  if (!FIREBASE_ENABLED || !db) {
    cb({ upiId: "winggo@axl", qrUrl: "" });
    return () => {};
  }
  return onSnapshot(
    doc(db, "payment_details", "config"),
    (snap) => cb(snap.exists() ? (snap.data() as PaymentConfig) : { upiId: "winggo@axl", qrUrl: "" }),
    () => {},
  );
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

// ─── MATCH HISTORY (Firestore) ────────────────────────────────────────────────

export interface FirestoreMatchRecord {
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
  matchDuration?: number;
}

/**
 * Save a match result to Firestore (matches/{matchId}).
 * Non-fatal — silently skips if Firebase is not configured or write fails.
 * Used by admin panel to show match history across all users.
 */
export async function saveMatchToFirestore(
  uid: string,
  match: Omit<FirestoreMatchRecord, "uid">,
): Promise<void> {
  if (!FIREBASE_ENABLED || !db) return;
  try {
    await setDoc(doc(db, "matches", match.id), {
      ...match,
      uid,
      savedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn("[saveMatchToFirestore] non-fatal:", err);
  }
}

// ─── IN-APP NOTIFICATIONS ─────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  createdAt: number;
  type: "push" | "announcement";
}

/**
 * Subscribe to broadcast notifications written by the admin panel.
 * Reads from notificationQueue (ordered newest-first, last 20).
 * Firestore rule fix: allow read if request.auth != null.
 */
export function subscribeNotifications(
  cb: (notifs: AppNotification[]) => void,
): () => void {
  if (!FIREBASE_ENABLED || !db) { cb([]); return () => {}; }
  const q = query(
    collection(db, "notificationQueue"),
    orderBy("createdAt", "desc"),
    limit(20),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => {
      const data = d.data();
      return {
        id:        d.id,
        title:     (data.title     as string) ?? "",
        body:      (data.body      as string) ?? "",
        imageUrl:  data.imageUrl   as string | undefined,
        createdAt: (data.createdAt as number) ?? 0,
        type:      (data.type      as "push" | "announcement") ?? "push",
      };
    }));
  }, () => cb([]));
}

/**
 * Fetch all matches from Firestore for admin panel.
 * Returns latest 200 matches ordered by date descending.
 */
export async function getMatchHistoryAdmin(): Promise<FirestoreMatchRecord[]> {
  if (!FIREBASE_ENABLED || !db) return [];
  try {
    const q = query(
      collection(db, "matches"),
      orderBy("savedAt", "desc"),
      limit(200),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreMatchRecord));
  } catch {
    return [];
  }
}

// ─── DAILY WITHDRAWAL LIMIT (Firestore-based) ───────────────────────────────────

/**
 * Get daily withdrawal limit data for a user
 */
export async function getDailyWithdrawLimit(uid: string): Promise<DailyWithdrawLimit | null> {
  if (!FIREBASE_ENABLED || !db || !uid) return null;
  try {
    const today = getTodayDate();
    const docRef = doc(db, "dailyWithdrawLimits", uid);
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      return null;
    }
    
    const data = snap.data() as DailyWithdrawLimit;
    
    // Check if date is today, if not return null (will trigger reset)
    if (data.date !== today) {
      return null;
    }
    
    return data;
  } catch {
    return null;
  }
}

/**
 * Check if user can make a withdrawal (count < limit)
 */
export async function canUserWithdraw(uid: string, limit: number = 2): Promise<{ canWithdraw: boolean; count: number; remaining: number }> {
  if (!FIREBASE_ENABLED || !db || !uid) {
    return { canWithdraw: true, count: 0, remaining: limit };
  }
  
  try {
    const limitData = await getDailyWithdrawLimit(uid);
    
    if (!limitData) {
      // No record for today, user can withdraw
      return { canWithdraw: true, count: 0, remaining: limit };
    }
    
    const count = limitData.count;
    const remaining = Math.max(0, limit - count);
    
    return {
      canWithdraw: count < limit,
      count,
      remaining,
    };
  } catch {
    return { canWithdraw: true, count: 0, remaining: limit };
  }
}

/**
 * Increment daily withdrawal count for a user
 * Creates new record if doesn't exist for today
 */
export async function incrementDailyWithdrawCount(uid: string, limit: number = 2): Promise<void> {
  if (!FIREBASE_ENABLED || !db || !uid) return;
  
  const today = getTodayDate();
  const docRef = doc(db, "dailyWithdrawLimits", uid);
  
  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      
      if (!snap.exists()) {
        // Create new record for today
        const newLimit: DailyWithdrawLimit = {
          uid,
          date: today,
          count: 1,
          limit,
          lastWithdrawalAt: Date.now(),
          updatedAt: Date.now(),
        };
        transaction.set(docRef, newLimit);
      } else {
        const data = snap.data() as DailyWithdrawLimit;
        
        // Check if date is today, if not reset
        if (data.date !== today) {
          const resetLimit: DailyWithdrawLimit = {
            uid,
            date: today,
            count: 1,
            limit,
            lastWithdrawalAt: Date.now(),
            updatedAt: Date.now(),
          };
          transaction.set(docRef, resetLimit);
        } else {
          // Increment count
          transaction.update(docRef, {
            count: increment(1),
            lastWithdrawalAt: Date.now(),
            updatedAt: Date.now(),
          });
        }
      }
    });
  } catch (error) {
    console.error("Failed to increment daily withdraw count:", error);
  }
}

/**
 * Subscribe to daily withdrawal limit for a user (live updates)
 */
export function subscribeDailyWithdrawLimit(
  uid: string,
  cb: (limit: DailyWithdrawLimit | null) => void
): () => void {
  if (!FIREBASE_ENABLED || !db || !uid) {
    cb(null);
    return () => {};
  }
  
  const docRef = doc(db, "dailyWithdrawLimits", uid);
  const today = getTodayDate();
  
  return onSnapshot(docRef, (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    
    const data = snap.data() as DailyWithdrawLimit;
    
    // Only return data if it's for today
    if (data.date === today) {
      cb(data);
    } else {
      cb(null);
    }
  }, () => cb(null));
}
