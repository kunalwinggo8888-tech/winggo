/**
 * WalletContext — Firebase Firestore Synced with localStorage cache
 *
 * NOTE: useWallet hook lives in ./useWallet.ts (separate file) for Vite Fast Refresh.
 *
 * Persistence strategy:
 *  1. On mount → load last-known balance from localStorage (instant, no flash)
 *  2. Subscribe to Firestore → patch in real balance when it arrives
 *  3. On every Firestore update → write back to localStorage cache
 *
 * This ensures:
 *  - Balance never flashes to ₹50 on app open (uses cached real balance)
 *  - Balance updates persist across sessions even if Firestore is slow
 *  - Wallet never resets to the signup bonus again
 */
import { createContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Timestamp } from "firebase/firestore";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { useAuth } from "@/context/useAuth";
import {
  subscribeWallet, subscribeTransactions,
  firestoreDeposit, firestoreWithdraw, firestoreAddWinning,
  firestoreDeductFee, firestoreAddBonus,
  WalletBalance, FirestoreTransaction,
} from "@/firebase/firestore.service";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface WalletData {
  winning: number;
  deposit: number;
  bonus: number;
}

export interface Transaction {
  id: string | number;
  type: "win" | "withdraw" | "deposit" | "bonus" | "fee";
  title: string;
  rawAmount: number;
  display: string;
  time: string;
  color: string;
  status?: "pending" | "completed" | "rejected";
  gameId?: string;
  txId?: string;
}

export interface WalletContextType {
  wallet: WalletData;
  transactions: Transaction[];
  total: number;
  addDeposit: (amount: number, bonusPct: number) => void;
  withdraw: (amount: number, upiId?: string) => void;
  addWinning: (amount: number, title?: string, roomId?: string) => void;
  deductFee: (amount: number, title?: string, roomId?: string) => void;
  addBonus: (amount: number, title?: string) => void;
  isSynced: boolean;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Timestamp | number | undefined): string {
  if (!ts) return new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" });
  const d = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
  return d.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" });
}

function now(): string {
  return new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" });
}

function firestoreTxToLocal(tx: FirestoreTransaction): Transaction {
  return {
    id:        tx.id ?? Math.random(),
    type:      tx.type,
    title:     tx.title,
    rawAmount: tx.rawAmount,
    display:   tx.display,
    time:      formatTimestamp(tx.createdAt),
    color:     tx.color,
    status:    tx.status,
    gameId:    tx.gameId,
    txId:      tx.id,
  };
}

let _txId = 100;
function nextId() { return ++_txId; }

// ─── LOCALSTORAGE WALLET CACHE ────────────────────────────────────────────────
// Prevents "₹50 flash" — loads last-known real balance instantly on app open

const LS_WALLET_KEY = "winggo_wallet_cache";

function loadCachedWallet(uid: string | null): WalletData {
  if (!uid || !FIREBASE_ENABLED) return { winning: 0, deposit: 0, bonus: 50 };
  try {
    const raw = localStorage.getItem(`${LS_WALLET_KEY}_${uid}`);
    if (!raw) return { winning: 0, deposit: 0, bonus: 0 }; // New user — show 0 until Firestore fires
    return JSON.parse(raw) as WalletData;
  } catch {
    return { winning: 0, deposit: 0, bonus: 0 };
  }
}

function saveWalletCache(uid: string, wallet: WalletData): void {
  try {
    localStorage.setItem(`${LS_WALLET_KEY}_${uid}`, JSON.stringify(wallet));
  } catch { /* storage full — non-fatal */ }
}

// ─── DEMO / INITIAL STATE ────────────────────────────────────────────────────

const DEMO_WALLET: WalletData = { winning: 0, deposit: 0, bonus: 50 };

const DEMO_TX: Transaction[] = [
  { id: 1, type: "win",      title: "Ludo Classic Win",    rawAmount:  250, display: "+₹250", time: "Today, 3:12 PM",     color: "#27ae60", status: "completed", txId: "TX001" },
  { id: 2, type: "withdraw", title: "Withdrawal to UPI",   rawAmount: -500, display: "-₹500", time: "Today, 11:45 AM",    color: "#e74c3c", status: "completed", txId: "TX002" },
  { id: 3, type: "deposit",  title: "Deposit + 15% Bonus", rawAmount:  575, display: "+₹575", time: "Yesterday, 8:20 PM", color: "#3498db", status: "completed", txId: "TX003" },
  { id: 4, type: "win",      title: "World War Reward",    rawAmount:  190, display: "+₹190", time: "Yesterday, 4:05 PM", color: "#27ae60", status: "completed", txId: "TX004" },
  { id: 5, type: "bonus",    title: "Referral Bonus",      rawAmount:   50, display: "+₹50",  time: "2 days ago",         color: "#FFD700", status: "completed", txId: "TX005" },
  { id: 6, type: "win",      title: "Spin Wheel Win",      rawAmount:   25, display: "+₹25",  time: "2 days ago",         color: "#27ae60", status: "completed", txId: "TX006" },
  { id: 7, type: "fee",      title: "Ludo Entry Fee",      rawAmount:  -10, display: "-₹10",  time: "3 days ago",         color: "#e74c3c", status: "completed", txId: "TX007" },
  { id: 8, type: "deposit",  title: "Deposit",             rawAmount:  300, display: "+₹300", time: "3 days ago",         color: "#3498db", status: "completed", txId: "TX008" },
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

export const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // Initialize from localStorage cache — no ₹50 flash for returning users
  const [wallet, setWallet]     = useState<WalletData>(() => loadCachedWallet(uid));
  const [transactions, setTx]   = useState<Transaction[]>(FIREBASE_ENABLED ? [] : DEMO_TX);
  const [isSynced, setIsSynced] = useState(false);

  // ── Firestore real-time subscriptions ────────────────────────────────────────
  useEffect(() => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet(DEMO_WALLET);
      setTx(DEMO_TX);
      setIsSynced(false);
      return;
    }

    // Load cached balance while Firestore resolves (prevents flash)
    const cached = loadCachedWallet(uid);
    setWallet(cached);
    setIsSynced(false);

    const unsubWallet = subscribeWallet(uid, (w: WalletBalance) => {
      const realWallet = {
        winning: w.winning ?? 0,
        deposit: w.deposit ?? 0,
        bonus:   w.bonus   ?? 0,
      };
      setWallet(realWallet);
      setIsSynced(true);
      // Persist real balance to localStorage for instant load next session
      saveWalletCache(uid, realWallet);
    });

    const unsubTx = subscribeTransactions(uid, (txs: FirestoreTransaction[]) => {
      setTx(txs.map(firestoreTxToLocal));
    });

    return () => { unsubWallet(); unsubTx(); };
  }, [uid]);

  // ── Local-state helpers (optimistic + Firestore sync) ─────────────────────

  const pushLocalTx = useCallback((tx: Omit<Transaction, "id" | "time">) => {
    if (!FIREBASE_ENABLED) {
      setTx((prev) => [{ ...tx, id: nextId(), time: now() }, ...prev]);
    }
    // Firebase mode: onSnapshot handles UI update
  }, []);

  const addDeposit = useCallback((amount: number, bonusPct: number) => {
    const bonusAmt = Math.round(amount * bonusPct / 100);
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, deposit: w.deposit + amount, bonus: w.bonus + bonusAmt }));
      pushLocalTx({ type: "deposit", title: bonusPct > 0 ? `Deposit + ${bonusPct}% Bonus` : "Add Cash", rawAmount: amount + bonusAmt, display: `+₹${amount + bonusAmt}`, color: "#3498db", status: "completed" });
    } else {
      setWallet((w) => {
        const updated = { ...w, deposit: w.deposit + amount, bonus: w.bonus + bonusAmt };
        saveWalletCache(uid, updated);
        return updated;
      });
      firestoreDeposit(uid, amount, bonusPct).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const withdraw = useCallback((amount: number, upiId = "user@upi") => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, winning: Math.max(0, w.winning - amount) }));
      pushLocalTx({ type: "withdraw", title: "Withdrawal — Pending Approval", rawAmount: -amount, display: `-₹${amount}`, color: "#f39c12", status: "pending" });
    } else {
      setWallet((w) => {
        const updated = { ...w, winning: Math.max(0, w.winning - amount) };
        saveWalletCache(uid, updated);
        return updated;
      });
      firestoreWithdraw(uid, amount, upiId, user?.email ?? "", user?.displayName ?? "").catch(console.error);
    }
  }, [uid, user, pushLocalTx]);

  const addWinning = useCallback((amount: number, title = "Game Win", roomId?: string) => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, winning: w.winning + amount }));
      pushLocalTx({ type: "win", title, rawAmount: amount, display: `+₹${amount}`, color: "#27ae60", status: "completed" });
    } else {
      setWallet((w) => {
        const updated = { ...w, winning: w.winning + amount };
        saveWalletCache(uid, updated);
        return updated;
      });
      firestoreAddWinning(uid, amount, title, roomId).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const deductFee = useCallback((amount: number, title = "Entry Fee", roomId?: string) => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, deposit: Math.max(0, w.deposit - amount) }));
      pushLocalTx({ type: "fee", title, rawAmount: -amount, display: `-₹${amount}`, color: "#e74c3c", status: "completed" });
    } else {
      setWallet((w) => {
        const updated = { ...w, deposit: Math.max(0, w.deposit - amount) };
        saveWalletCache(uid, updated);
        return updated;
      });
      firestoreDeductFee(uid, amount, title, roomId).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const addBonus = useCallback((amount: number, title = "Bonus Reward") => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, bonus: w.bonus + amount }));
      pushLocalTx({ type: "bonus", title, rawAmount: amount, display: `+₹${amount}`, color: "#FFD700", status: "completed" });
    } else {
      setWallet((w) => {
        const updated = { ...w, bonus: w.bonus + amount };
        saveWalletCache(uid, updated);
        return updated;
      });
      firestoreAddBonus(uid, amount, title).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const total = parseFloat((wallet.winning + wallet.deposit + wallet.bonus).toFixed(2));

  return (
    <WalletContext.Provider value={{ wallet, transactions, total, addDeposit, withdraw, addWinning, deductFee, addBonus, isSynced }}>
      {children}
    </WalletContext.Provider>
  );
}
