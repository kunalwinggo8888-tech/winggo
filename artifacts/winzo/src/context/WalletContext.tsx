import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ─── TYPES ────────────────────────────────────────────────────
export interface WalletData {
  winning: number;
  deposit: number;
  bonus: number;
}

export interface Transaction {
  id: number;
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
  withdraw: (amount: number) => void;
  addWinning: (amount: number, title?: string) => void;
  deductFee: (amount: number, title?: string) => void;
  addBonus: (amount: number, title?: string) => void;
}

// ─── HELPERS ─────────────────────────────────────────────────
function now(): string {
  return new Date().toLocaleString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true,
    day: "numeric", month: "short",
  });
}

let _txId = 100;
function nextId() { return ++_txId; }

// ─── CONTEXT ─────────────────────────────────────────────────
const WalletContext = createContext<WalletContextType | null>(null);

const INITIAL_WALLET: WalletData = { winning: 1240, deposit: 300, bonus: 150 };

const INITIAL_TX: Transaction[] = [
  { id: 1, type: "win",      title: "Ludo Classic Win",    rawAmount:  250, display: "+₹250", time: "Today, 3:12 PM",     color: "#27ae60" },
  { id: 2, type: "withdraw", title: "Withdrawal to UPI",   rawAmount: -500, display: "-₹500", time: "Today, 11:45 AM",    color: "#e74c3c", status: "completed" },
  { id: 3, type: "deposit",  title: "Deposit + 15% Bonus", rawAmount:  575, display: "+₹575", time: "Yesterday, 8:20 PM", color: "#3498db" },
  { id: 4, type: "win",      title: "World War Reward",    rawAmount:  190, display: "+₹190", time: "Yesterday, 4:05 PM", color: "#27ae60" },
  { id: 5, type: "bonus",    title: "Referral Bonus",      rawAmount:   50, display: "+₹50",  time: "2 days ago",         color: "#FFD700" },
  { id: 6, type: "win",      title: "Spin Wheel Win",      rawAmount:   25, display: "+₹25",  time: "2 days ago",         color: "#27ae60" },
  { id: 7, type: "deposit",  title: "Deposit",             rawAmount:  300, display: "+₹300", time: "3 days ago",         color: "#3498db" },
];

// ─── PROVIDER ─────────────────────────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletData>(INITIAL_WALLET);
  const [transactions, setTx] = useState<Transaction[]>(INITIAL_TX);

  const pushTx = useCallback((tx: Omit<Transaction, "id" | "time">) => {
    setTx((prev) => [{ ...tx, id: nextId(), time: now() }, ...prev]);
  }, []);

  const addDeposit = useCallback((amount: number, bonusPct: number) => {
    const bonusAmt = Math.round(amount * bonusPct / 100);
    setWallet((w) => ({ ...w, deposit: w.deposit + amount, bonus: w.bonus + bonusAmt }));
    pushTx({
      type: "deposit",
      title: `Deposit + ${bonusPct}% Bonus`,
      rawAmount: amount + bonusAmt,
      display: `+₹${amount + bonusAmt}`,
      color: "#3498db",
    });
  }, [pushTx]);

  const withdraw = useCallback((amount: number) => {
    setWallet((w) => ({ ...w, winning: Math.max(0, w.winning - amount) }));
    pushTx({
      type: "withdraw",
      title: "Withdrawal Requested — Pending Approval",
      rawAmount: -amount,
      display: `-₹${amount}`,
      color: "#f39c12",
      status: "pending",
    });
  }, [pushTx]);

  const addWinning = useCallback((amount: number, title = "Game Win") => {
    setWallet((w) => ({ ...w, winning: w.winning + amount }));
    pushTx({ type: "win", title, rawAmount: amount, display: `+₹${amount}`, color: "#27ae60" });
  }, [pushTx]);

  const deductFee = useCallback((amount: number, title = "Entry Fee") => {
    setWallet((w) => ({ ...w, deposit: Math.max(0, w.deposit - amount) }));
    pushTx({ type: "fee", title, rawAmount: -amount, display: `-₹${amount}`, color: "#e74c3c" });
  }, [pushTx]);

  const addBonus = useCallback((amount: number, title = "Bonus Reward") => {
    setWallet((w) => ({ ...w, bonus: w.bonus + amount }));
    pushTx({ type: "bonus", title, rawAmount: amount, display: `+₹${amount}`, color: "#FFD700" });
  }, [pushTx]);

  const total = parseFloat((wallet.winning + wallet.deposit + wallet.bonus).toFixed(2));

  return (
    <WalletContext.Provider value={{ wallet, transactions, total, addDeposit, withdraw, addWinning, deductFee, addBonus }}>
      {children}
    </WalletContext.Provider>
  );
}

// ─── HOOK ─────────────────────────────────────────────────────
export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
