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
 * Transaction history:
 *  - New users start with completely EMPTY history — no fake/demo data
 *  - History is populated only by real user actions (deposit, withdraw, game win/loss, spin, bonus)
 *  - Demo mode (Firebase disabled) also starts empty and updates locally as user acts
 */
import { createContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Timestamp } from "firebase/firestore";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { useAuth } from "@/context/useAuth";
import {
  subscribeWallet, subscribeTransactions,
  firestoreDeposit, firestoreWithdraw, firestoreAddWinning,
  firestoreDeductFee, firestoreAddBonus,
  WalletBalance, FirestoreTransaction, BankDetails,
} from "@/firebase/firestore.service";

export type { BankDetails };

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
  roomId?: string;
  txId?: string;
}

export interface WalletContextType {
  wallet: WalletData;
  transactions: Transaction[];
  total: number;
  addDeposit: (amount: number, bonusPct: number) => void;
  withdraw: (amount: number, method?: "upi" | "bank", details?: { upiId?: string; bankDetails?: BankDetails }) => void;
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
    roomId:    tx.roomId,
    txId:      tx.id,
  };
}

let _txId = 100;
function nextId() { return ++_txId; }

// ─── LOCALSTORAGE WALLET CACHE ────────────────────────────────────────────────

const LS_WALLET_KEY = "winggo_wallet_cache";

function loadCachedWallet(uid: string | null): WalletData {
  if (!uid || !FIREBASE_ENABLED) return { winning: 0, deposit: 0, bonus: 0 };
  try {
    const raw = localStorage.getItem(`${LS_WALLET_KEY}_${uid}`);
    if (!raw) return { winning: 0, deposit: 0, bonus: 0 };
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

// ─── INITIAL STATE ────────────────────────────────────────────────────────────
// New users always start with empty history — no fake/demo transactions

const EMPTY_WALLET: WalletData = { winning: 0, deposit: 0, bonus: 0 };

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

export const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // Initialize from localStorage cache — no flash for returning users
  const [wallet, setWallet]     = useState<WalletData>(() => loadCachedWallet(uid));
  // Always start empty — real transactions load from Firestore or accumulate via local actions
  const [transactions, setTx]   = useState<Transaction[]>([]);
  const [isSynced, setIsSynced] = useState(false);

  // ── Firestore real-time subscriptions ────────────────────────────────────────
  useEffect(() => {
    if (!FIREBASE_ENABLED || !uid) {
      // Demo mode or not logged in — show real balance from cache, empty history
      const cached = loadCachedWallet(uid);
      setWallet(cached.winning === 0 && cached.deposit === 0 && cached.bonus === 0
        ? { winning: 0, deposit: 0, bonus: 50 }   // new demo user gets the ₹50 bonus display
        : cached
      );
      setTx([]);
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

  const withdraw = useCallback((
    amount: number,
    method: "upi" | "bank" = "upi",
    details: { upiId?: string; bankDetails?: BankDetails } = { upiId: "user@upi" }
  ) => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, winning: Math.max(0, w.winning - amount) }));
      pushLocalTx({ type: "withdraw", title: "Withdrawal — Pending Approval", rawAmount: -amount, display: `-₹${amount}`, color: "#f39c12", status: "pending" });
    } else {
      setWallet((w) => {
        const updated = { ...w, winning: Math.max(0, w.winning - amount) };
        saveWalletCache(uid, updated);
        return updated;
      });
      firestoreWithdraw(uid, amount, method, details, user?.email ?? "", user?.displayName ?? "").catch(console.error);
    }
  }, [uid, user, pushLocalTx]);

  const addWinning = useCallback((amount: number, title = "Game Win", roomId?: string) => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, winning: w.winning + amount }));
      pushLocalTx({ type: "win", title, rawAmount: amount, display: `+₹${amount}`, color: "#27ae60", status: "completed", roomId });
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
      pushLocalTx({ type: "fee", title, rawAmount: -amount, display: `-₹${amount}`, color: "#e74c3c", status: "completed", roomId });
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
