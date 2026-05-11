/**
 * WalletContext — Firebase Firestore Synced
 * -------------------------------------------
 * • When Firebase is configured: syncs live with Firestore (onSnapshot)
 * • When not configured: runs purely in local state (demo mode)
 * All wallet mutation functions write to Firestore AND update local state
 * optimistically, so the UI is always instant.
 */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { Timestamp } from "firebase/firestore";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { useAuth } from "@/context/AuthContext";
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
}

interface WalletContextType {
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
  };
}

let _txId = 100;
function nextId() { return ++_txId; }

// ─── DEMO / INITIAL STATE ────────────────────────────────────────────────────

const DEMO_WALLET: WalletData = { winning: 1240, deposit: 300, bonus: 150 };

const DEMO_TX: Transaction[] = [
  { id: 1, type: "win",      title: "Ludo Classic Win",    rawAmount:  250, display: "+₹250", time: "Today, 3:12 PM",     color: "#27ae60" },
  { id: 2, type: "withdraw", title: "Withdrawal to UPI",   rawAmount: -500, display: "-₹500", time: "Today, 11:45 AM",    color: "#e74c3c", status: "completed" },
  { id: 3, type: "deposit",  title: "Deposit + 15% Bonus", rawAmount:  575, display: "+₹575", time: "Yesterday, 8:20 PM", color: "#3498db" },
  { id: 4, type: "win",      title: "World War Reward",    rawAmount:  190, display: "+₹190", time: "Yesterday, 4:05 PM", color: "#27ae60" },
  { id: 5, type: "bonus",    title: "Referral Bonus",      rawAmount:   50, display: "+₹50",  time: "2 days ago",         color: "#FFD700" },
  { id: 6, type: "win",      title: "Spin Wheel Win",      rawAmount:   25, display: "+₹25",  time: "2 days ago",         color: "#27ae60" },
  { id: 7, type: "deposit",  title: "Deposit",             rawAmount:  300, display: "+₹300", time: "3 days ago",         color: "#3498db" },
];

// ─── CONTEXT ──────────────────────────────────────────────────────────────────

const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [wallet, setWallet]     = useState<WalletData>(DEMO_WALLET);
  const [transactions, setTx]   = useState<Transaction[]>(DEMO_TX);
  const [isSynced, setIsSynced] = useState(false);

  // ── Firestore real-time subscriptions ────────────────────────────────────────
  useEffect(() => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet(DEMO_WALLET);
      setTx(DEMO_TX);
      setIsSynced(false);
      return;
    }

    setIsSynced(false);

    const unsubWallet = subscribeWallet(uid, (w: WalletBalance) => {
      setWallet({ winning: w.winning ?? 0, deposit: w.deposit ?? 0, bonus: w.bonus ?? 0 });
      setIsSynced(true);
    });

    const unsubTx = subscribeTransactions(uid, (txs: FirestoreTransaction[]) => {
      setTx(txs.map(firestoreTxToLocal));
    });

    return () => { unsubWallet(); unsubTx(); };
  }, [uid]);

  // ── Local-state helpers (optimistic, also sync to Firestore) ─────────────────

  const pushLocalTx = useCallback((tx: Omit<Transaction, "id" | "time">) => {
    if (!FIREBASE_ENABLED) {
      setTx((prev) => [{ ...tx, id: nextId(), time: now() }, ...prev]);
    }
    // When Firebase is enabled, the onSnapshot will handle UI update
  }, []);

  const addDeposit = useCallback((amount: number, bonusPct: number) => {
    const bonusAmt = Math.round(amount * bonusPct / 100);
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, deposit: w.deposit + amount, bonus: w.bonus + bonusAmt }));
      pushLocalTx({ type: "deposit", title: `Deposit + ${bonusPct}% Bonus`, rawAmount: amount + bonusAmt, display: `+₹${amount + bonusAmt}`, color: "#3498db", status: "completed" });
    } else {
      // Optimistic update
      setWallet((w) => ({ ...w, deposit: w.deposit + amount, bonus: w.bonus + bonusAmt }));
      firestoreDeposit(uid, amount, bonusPct).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const withdraw = useCallback((amount: number, upiId = "user@upi") => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, winning: Math.max(0, w.winning - amount) }));
      pushLocalTx({ type: "withdraw", title: "Withdrawal Requested — Pending Approval", rawAmount: -amount, display: `-₹${amount}`, color: "#f39c12", status: "pending" });
    } else {
      setWallet((w) => ({ ...w, winning: Math.max(0, w.winning - amount) }));
      firestoreWithdraw(uid, amount, upiId, user?.phone ?? "", user?.displayName ?? "").catch(console.error);
    }
  }, [uid, user, pushLocalTx]);

  const addWinning = useCallback((amount: number, title = "Game Win", roomId?: string) => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, winning: w.winning + amount }));
      pushLocalTx({ type: "win", title, rawAmount: amount, display: `+₹${amount}`, color: "#27ae60", status: "completed" });
    } else {
      setWallet((w) => ({ ...w, winning: w.winning + amount }));
      firestoreAddWinning(uid, amount, title, roomId).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const deductFee = useCallback((amount: number, title = "Entry Fee", roomId?: string) => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, deposit: Math.max(0, w.deposit - amount) }));
      pushLocalTx({ type: "fee", title, rawAmount: -amount, display: `-₹${amount}`, color: "#e74c3c", status: "completed" });
    } else {
      setWallet((w) => ({ ...w, deposit: Math.max(0, w.deposit - amount) }));
      firestoreDeductFee(uid, amount, title, roomId).catch(console.error);
    }
  }, [uid, pushLocalTx]);

  const addBonus = useCallback((amount: number, title = "Bonus Reward") => {
    if (!FIREBASE_ENABLED || !uid) {
      setWallet((w) => ({ ...w, bonus: w.bonus + amount }));
      pushLocalTx({ type: "bonus", title, rawAmount: amount, display: `+₹${amount}`, color: "#FFD700", status: "completed" });
    } else {
      setWallet((w) => ({ ...w, bonus: w.bonus + amount }));
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

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
