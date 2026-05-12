/**
 * WalletScreen — WINGGO
 * Full WinZO-style wallet with:
 *  - Add Cash (Razorpay presets + custom)
 *  - Withdraw to UPI
 *  - Transaction History (filter: All / Deposit / Winnings / Withdraw / Games / Rewards)
 *  - Game History (real data derived from fee+win transaction pairs)
 *  - Transaction IDs + statuses + real-time balance
 *
 * NOTE: All fake/demo data has been removed. New users start with empty history.
 *       Real data comes from Firebase Firestore (or local context actions in demo mode).
 */
import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useAuth } from "@/context/useAuth";
import type { Transaction } from "@/context/WalletContext";
import BackButton from "@/components/BackButton";
import RazorpayGateway from "@/components/RazorpayGateway";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ─── STATIC DATA ──────────────────────────────────────────────────────────────

const DEPOSIT_PRESETS = [
  { amount: 10,   bonus: 0,   label: "Quick",    tag: "INSTANT",      color: "#7f8c8d" },
  { amount: 20,   bonus: 0,   label: "Mini",     tag: "INSTANT",      color: "#7f8c8d" },
  { amount: 50,   bonus: 5,   label: "Starter",  tag: "5% BONUS",     color: "#27ae60" },
  { amount: 100,  bonus: 10,  label: "Popular",  tag: "10% BONUS",    color: "#3498db", hot: true },
  { amount: 500,  bonus: 15,  label: "Mega",     tag: "15% CASHBACK", color: "#FFD700" },
  { amount: 1000, bonus: 20,  label: "Champion", tag: "20% CASHBACK", color: "#e74c3c" },
];

const UPI_OPTIONS = [
  { id: "gpay",    label: "Google Pay", icon: "G",   color: "#4285f4" },
  { id: "phonepe", label: "PhonePe",    icon: "Pe",  color: "#5f259f" },
  { id: "paytm",   label: "Paytm",      icon: "Pa",  color: "#00b9f1" },
  { id: "upi",     label: "UPI / BHIM", icon: "🇮🇳", color: "#ff6600" },
];

const OFFERS = [
  { icon: "⚡", title: "Flash Deposit",   desc: "Add ₹200 now — get extra ₹30 free!", badge: "ENDS TONIGHT", color: "#e74c3c" },
  { icon: "🎁", title: "Weekend Bonus",   desc: "Extra 5% cashback every Sat & Sun",  badge: "WEEKEND ONLY", color: "#9b59b6" },
  { icon: "🏆", title: "Daily Challenge", desc: "Play 3 games today — earn ₹20 bonus",badge: "DAILY",        color: "#f39c12" },
];

const TX_ICONS: Record<string, string> = {
  win: "🏆", withdraw: "📤", deposit: "📥", bonus: "🎁", fee: "🎮",
};

// Filter tabs — clean labels matching brand design
const TX_FILTER_TABS = [
  { id: "all",      label: "All",      icon: "📋" },
  { id: "deposit",  label: "Deposit",  icon: "📥" },
  { id: "win",      label: "Winnings", icon: "🏆" },
  { id: "withdraw", label: "Withdraw", icon: "📤" },
  { id: "fee",      label: "Games",    icon: "🎮" },
  { id: "bonus",    label: "Rewards",  icon: "🎁" },
] as const;

type TxFilterType = (typeof TX_FILTER_TABS)[number]["id"];
type MainTab = "add" | "withdraw" | "history" | "games";

interface Props { onBack?: () => void }

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function WalletScreen({ onBack }: Props) {
  const { wallet, total, transactions, addDeposit, withdraw: ctxWithdraw, isSynced } = useWallet();
  const { user } = useAuth();

  const [tab, setTab]                   = useState<MainTab>("add");
  const [txFilter, setTxFilter]         = useState<TxFilterType>("all");
  const [selectedPreset, setPreset]     = useState(3);
  const [selectedUPI, setUPI]           = useState("gpay");
  const [customAmt, setCustomAmt]       = useState("");
  const [showRazorpay, setShowRazorpay] = useState(false);
  const [withdrawAmt, setWithdrawAmt]   = useState("");
  const [withdrawing, setWithdrawing]   = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [expandedTx, setExpandedTx]     = useState<string | number | null>(null);

  const preset   = DEPOSIT_PRESETS[selectedPreset];
  const finalAmt = customAmt ? Number(customAmt) : preset.amount;
  const bonusPct = customAmt ? 10 : preset.bonus;
  const bonusAmt = Math.round(finalAmt * bonusPct / 100);

  // ── Filtered transactions ─────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    if (txFilter === "all") return transactions as Transaction[];
    return (transactions as Transaction[]).filter((t) => t.type === txFilter);
  }, [transactions, txFilter]);

  // ── Summary stats from real transactions ─────────────────────────────────
  const totalWon       = useMemo(() => (transactions as Transaction[]).filter(t => t.type === "win").reduce((s, t) => s + t.rawAmount, 0), [transactions]);
  const totalDeposited = useMemo(() => (transactions as Transaction[]).filter(t => t.type === "deposit").reduce((s, t) => s + t.rawAmount, 0), [transactions]);
  const totalWithdrawn = useMemo(() => (transactions as Transaction[]).filter(t => t.type === "withdraw").reduce((s, t) => s + Math.abs(t.rawAmount), 0), [transactions]);

  // ── Game history derived from real fee+win transaction pairs ───────────────
  const gameHistory = useMemo(() => {
    const feeTxs  = (transactions as Transaction[]).filter(t => t.type === "fee");
    const winTxs  = (transactions as Transaction[]).filter(t => t.type === "win");

    // Build a lookup by roomId for fast matching
    const winByRoom = new Map<string, Transaction>();
    winTxs.forEach(t => { if (t.roomId) winByRoom.set(t.roomId, t); });

    return feeTxs.map(fee => {
      const winTx   = fee.roomId ? winByRoom.get(fee.roomId) : undefined;
      // Parse game name from title: "Ludo Entry Fee ₹10" → "Ludo"
      const gameName = fee.title
        .replace(/\s*entry\s*(fee)?\s*₹?\d+.*/i, "")
        .trim() || "Game";
      return {
        id:     fee.id,
        game:   gameName,
        result: winTx ? "win" as const : "loss" as const,
        entry:  Math.abs(fee.rawAmount),
        prize:  winTx ? winTx.rawAmount : 0,
        date:   fee.time,
      };
    });
  }, [transactions]);

  const gamesWon  = gameHistory.filter(g => g.result === "win").length;
  const gamesLost = gameHistory.filter(g => g.result === "loss").length;
  const winRate   = gameHistory.length > 0 ? Math.round(gamesWon / gameHistory.length * 100) : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handlePay = useCallback(() => {
    if (finalAmt <= 0) return;
    setShowRazorpay(true);
  }, [finalAmt]);

  const handleRazorpaySuccess = useCallback(() => {
    setShowRazorpay(false);
  }, []);

  const handleWithdraw = useCallback(() => {
    const amt = Number(withdrawAmt);
    if (withdrawing || !amt || amt < 100 || amt > wallet.winning) return;
    setWithdrawing(true);
    setTimeout(() => {
      ctxWithdraw(amt);
      setWithdrawing(false);
      setWithdrawDone(true);
      setWithdrawAmt("");
      setTimeout(() => setWithdrawDone(false), 3000);
    }, 1400);
  }, [withdrawing, withdrawAmt, wallet.winning, ctxWithdraw]);

  // Suppress unused warning — user is available for display
  void user;

  return (
    <>
      <motion.div
        className="fixed inset-0 flex flex-col overflow-hidden"
        style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -40 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        {/* ── HEADER ── */}
        <div className="relative shrink-0 overflow-hidden"
          style={{ background: "linear-gradient(160deg, #0a0a20 0%, #05080a 60%, #07050f 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="absolute top-[-30%] left-[-15%] w-[55%] h-[55%] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 70%)" }} />
          <div className="absolute bottom-[-20%] right-[-10%] w-[45%] h-[45%] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(52,152,219,0.07) 0%, transparent 70%)" }} />

          <div className="absolute top-4 left-4 z-50">
            <BackButton onBack={onBack} label="Home" />
          </div>

          {/* Firebase live indicator */}
          {FIREBASE_ENABLED && (
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full"
              style={{ background: isSynced ? "rgba(39,174,96,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${isSynced ? "rgba(39,174,96,0.25)" : "rgba(255,255,255,0.1)"}` }}>
              <motion.div className="w-1.5 h-1.5 rounded-full"
                style={{ background: isSynced ? "#27ae60" : "#f39c12" }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span className="text-[9px] font-black" style={{ color: isSynced ? "#27ae60" : "#f39c12" }}>
                {isSynced ? "LIVE" : "SYNCING"}
              </span>
            </div>
          )}

          <div className="flex flex-col items-center pt-10 pb-5 px-4 relative z-10">
            <span className="text-xs font-black px-3 py-1 rounded-full mb-3"
              style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
              💰 WINGGO WALLET
            </span>

            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
              Total Balance
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={total}
                className="text-5xl font-black mt-1"
                style={{ color: "#FFD700", textShadow: "0 0 20px rgba(255,215,0,0.4)" }}
                initial={{ scale: 0.88, opacity: 0, y: -6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}>
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.div>
            </AnimatePresence>

            <div className="flex gap-3 mt-4">
              {[
                { label: "Winning", value: wallet.winning, color: "#27ae60", icon: "🏆" },
                { label: "Deposit", value: wallet.deposit, color: "#3498db", icon: "💳" },
                { label: "Bonus",   value: wallet.bonus,   color: "#FFD700", icon: "🎁" },
              ].map((b) => (
                <div key={b.label}
                  className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="text-base">{b.icon}</span>
                  <AnimatePresence mode="wait">
                    <motion.span key={b.value} className="font-black text-sm" style={{ color: b.color }}
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                      ₹{b.value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </motion.span>
                  </AnimatePresence>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{b.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── MAIN TABS ── */}
        <div className="flex shrink-0 px-4 pt-3 gap-1.5">
          {([
            { id: "add",      label: "Add Cash", icon: "📥" },
            { id: "withdraw", label: "Withdraw",  icon: "📤" },
            { id: "history",  label: "History",   icon: "📋" },
            { id: "games",    label: "Games",     icon: "🎮" },
          ] as { id: MainTab; label: string; icon: string }[]).map((t) => (
            <motion.button key={t.id} whileTap={{ scale: 0.93 }} onClick={() => setTab(t.id)}
              className="flex-1 flex items-center justify-center gap-1 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
              style={{
                background: tab === t.id ? "linear-gradient(135deg,#FFD700,#ff8c00)" : "rgba(255,255,255,0.05)",
                color: tab === t.id ? "#000" : "rgba(255,255,255,0.45)",
                border: tab === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
                boxShadow: tab === t.id ? "0 0 14px rgba(255,215,0,0.3)" : "none",
                fontSize: "10px",
              }}>
              {t.icon} {t.label}
            </motion.button>
          ))}
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="flex-1 overflow-y-auto pb-28">
          <AnimatePresence mode="wait">

            {/* ═══════════════ ADD CASH ═══════════════ */}
            {tab === "add" && (
              <motion.div key="add" className="px-4 pt-4 space-y-4"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>

                {/* Offers strip */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {OFFERS.map((o) => (
                    <div key={o.title} className="flex-shrink-0 flex items-start gap-2.5 p-3 rounded-2xl w-56"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${o.color}33` }}>
                      <span className="text-xl mt-0.5">{o.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                          <span className="text-xs font-black text-white">{o.title}</span>
                          <span className="text-xs font-black px-1.5 py-0.5 rounded-md"
                            style={{ background: `${o.color}22`, color: o.color, fontSize: "8px" }}>{o.badge}</span>
                        </div>
                        <p className="text-xs leading-snug" style={{ color: "rgba(255,255,255,0.38)", fontSize: "10px" }}>{o.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Preset amounts */}
                <div>
                  <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    💸 Select Amount
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {DEPOSIT_PRESETS.map((p, i) => (
                      <motion.button key={p.amount} whileTap={{ scale: 0.93 }}
                        onClick={() => { setPreset(i); setCustomAmt(""); }}
                        className="relative flex flex-col items-start p-3.5 rounded-2xl cursor-pointer text-left"
                        style={{
                          background: selectedPreset === i && !customAmt ? `${p.color}15` : "rgba(255,255,255,0.04)",
                          border: selectedPreset === i && !customAmt ? `1.5px solid ${p.color}` : "1px solid rgba(255,255,255,0.08)",
                          boxShadow: selectedPreset === i && !customAmt ? `0 0 16px ${p.color}33` : "none",
                        }}>
                        {p.hot && (
                          <span className="absolute top-2 right-2 text-xs font-black px-1.5 py-0.5 rounded-md"
                            style={{ background: "#e74c3c", color: "#fff", fontSize: "8px" }}>HOT</span>
                        )}
                        <span className="font-black text-xl text-white">₹{p.amount}</span>
                        <span className="text-xs font-semibold mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{p.label}</span>
                        <span className="mt-2 text-xs font-black px-2 py-0.5 rounded-full"
                          style={{ background: `${p.color}22`, color: p.color }}>{p.tag}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Custom amount */}
                <div>
                  <label className="text-xs font-bold tracking-widest uppercase block mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Or Enter Custom Amount
                  </label>
                  <div className="flex items-center h-14 rounded-2xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <span className="px-4 font-black text-lg" style={{ color: "rgba(255,215,0,0.7)" }}>₹</span>
                    <input type="number" inputMode="numeric" placeholder="Enter amount"
                      value={customAmt} onChange={(e) => setCustomAmt(e.target.value)}
                      className="flex-1 h-full bg-transparent text-white text-base outline-none placeholder:text-zinc-700 font-medium pr-4"
                      style={{ caretColor: "#FFD700" }} />
                  </div>
                </div>

                {/* Bonus summary */}
                {finalAmt > 0 && (
                  <motion.div className="py-3 px-4 rounded-2xl"
                    style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>You pay</span>
                      <span className="font-black text-white">₹{finalAmt}</span>
                    </div>
                    {bonusPct > 0 && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold" style={{ color: "rgba(39,174,96,0.8)" }}>+ {bonusPct}% Bonus</span>
                        <span className="font-black" style={{ color: "#27ae60" }}>+₹{bonusAmt}</span>
                      </div>
                    )}
                    <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-white">Total Added to Wallet</span>
                      <span className="font-black text-lg" style={{ color: "#FFD700" }}>₹{finalAmt + bonusAmt}</span>
                    </div>
                  </motion.div>
                )}

                {/* UPI options */}
                <div>
                  <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    💳 Pay Via
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {UPI_OPTIONS.map((u) => (
                      <motion.button key={u.id} whileTap={{ scale: 0.9 }} onClick={() => setUPI(u.id)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl cursor-pointer"
                        style={{
                          background: selectedUPI === u.id ? `${u.color}18` : "rgba(255,255,255,0.04)",
                          border: selectedUPI === u.id ? `1.5px solid ${u.color}` : "1px solid rgba(255,255,255,0.08)",
                          boxShadow: selectedUPI === u.id ? `0 0 12px ${u.color}44` : "none",
                        }}>
                        <span className="font-black text-sm" style={{ color: u.color }}>{u.icon}</span>
                        <span className="text-center leading-tight font-bold"
                          style={{ color: selectedUPI === u.id ? u.color : "rgba(255,255,255,0.4)", fontSize: "9px" }}>
                          {u.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Security badges */}
                <div className="flex gap-2">
                  {["🔒 100% Secure", "⚡ Instant Credit", "✅ RBI Compliant"].map((b) => (
                    <div key={b} className="flex-1 text-center py-2 px-1 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)", fontSize: "9px" }}>{b}</span>
                    </div>
                  ))}
                </div>

                {/* Pay button */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={handlePay}
                  disabled={finalAmt <= 0}
                  className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer"
                  style={{
                    background: "linear-gradient(135deg,#FFD700,#ff8c00)",
                    color: "#000",
                    boxShadow: "0 0 24px rgba(255,215,0,0.4)",
                    letterSpacing: "0.04em",
                    opacity: finalAmt <= 0 ? 0.5 : 1,
                  }}>
                  ⚡ PROCEED TO PAY {finalAmt > 0 ? `₹${finalAmt}` : ""}
                </motion.button>
              </motion.div>
            )}

            {/* ═══════════════ WITHDRAW ═══════════════ */}
            {tab === "withdraw" && (
              <motion.div key="withdraw" className="px-4 pt-5 space-y-4"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>

                {/* Winning balance */}
                <div className="py-4 px-5 rounded-2xl flex items-center justify-between"
                  style={{ background: "rgba(39,174,96,0.08)", border: "1.5px solid rgba(39,174,96,0.25)" }}>
                  <div>
                    <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Withdrawable (Winning Balance)</div>
                    <AnimatePresence mode="wait">
                      <motion.div key={wallet.winning} className="font-black text-2xl" style={{ color: "#27ae60" }}
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                        ₹{wallet.winning.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </motion.div>
                    </AnimatePresence>
                    <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                      Only winnings can be withdrawn. Min ₹100.
                    </div>
                  </div>
                  <span className="text-3xl">🏆</span>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-xs font-black tracking-widest uppercase block mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Enter Withdraw Amount
                  </label>
                  <div className="flex items-center h-14 rounded-2xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    <span className="px-4 font-black text-lg" style={{ color: "rgba(39,174,96,0.8)" }}>₹</span>
                    <input type="number" inputMode="numeric" placeholder="Min ₹100"
                      value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)}
                      className="flex-1 h-full bg-transparent text-white text-base outline-none placeholder:text-zinc-700 font-medium pr-4"
                      style={{ caretColor: "#27ae60" }} />
                  </div>
                </div>

                {/* Quick chips */}
                <div className="flex gap-2">
                  {[100, 250, 500, Math.floor(wallet.winning)].filter((v, i, a) => a.indexOf(v) === i && v >= 100).slice(0, 4).map((a) => (
                    <motion.button key={a} whileTap={{ scale: 0.92 }}
                      onClick={() => setWithdrawAmt(String(a))}
                      className="flex-1 py-2 rounded-xl text-xs font-black cursor-pointer"
                      style={{
                        background: withdrawAmt === String(a) ? "rgba(39,174,96,0.2)" : "rgba(255,255,255,0.05)",
                        border: withdrawAmt === String(a) ? "1.5px solid rgba(39,174,96,0.5)" : "1px solid rgba(255,255,255,0.08)",
                        color: withdrawAmt === String(a) ? "#27ae60" : "rgba(255,255,255,0.45)",
                      }}>₹{a}</motion.button>
                  ))}
                </div>

                {/* UPI destination */}
                <div>
                  <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Withdraw To
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {UPI_OPTIONS.map((u) => (
                      <motion.button key={u.id} whileTap={{ scale: 0.9 }} onClick={() => setUPI(u.id)}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-2xl cursor-pointer"
                        style={{
                          background: selectedUPI === u.id ? `${u.color}18` : "rgba(255,255,255,0.04)",
                          border: selectedUPI === u.id ? `1.5px solid ${u.color}` : "1px solid rgba(255,255,255,0.08)",
                        }}>
                        <span className="font-black text-sm" style={{ color: u.color }}>{u.icon}</span>
                        <span className="text-center leading-tight font-bold"
                          style={{ color: selectedUPI === u.id ? u.color : "rgba(255,255,255,0.4)", fontSize: "9px" }}>
                          {u.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Info tiles */}
                <div className="grid grid-cols-3 gap-2">
                  {[["⚡", "Instant", "Transfer"], ["🔒", "Secure", "& Safe"], ["✅", "KYC", "Verified"]].map(([icon, l1, l2]) => (
                    <div key={l1} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-lg">{icon}</span>
                      <span className="text-xs font-black text-white">{l1}</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{l2}</span>
                    </div>
                  ))}
                </div>

                {/* Withdraw button */}
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmt || Number(withdrawAmt) < 100 || Number(withdrawAmt) > wallet.winning}
                  className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer"
                  style={{
                    background: withdrawDone ? "rgba(39,174,96,0.3)" : withdrawing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#27ae60,#1e8449)",
                    color: withdrawing ? "rgba(255,255,255,0.4)" : "#fff",
                    boxShadow: !withdrawing && !withdrawDone ? "0 0 24px rgba(39,174,96,0.35)" : "none",
                    opacity: !withdrawAmt || Number(withdrawAmt) < 100 ? 0.5 : 1,
                    letterSpacing: "0.04em",
                  }}>
                  <AnimatePresence mode="wait">
                    {withdrawDone ? (
                      <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        ✅ Withdrawal Requested! Pending Admin Approval
                      </motion.span>
                    ) : withdrawing ? (
                      <motion.span key="proc" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                        ⏳ Processing…
                      </motion.span>
                    ) : (
                      <span>📤 WITHDRAW {withdrawAmt ? `₹${withdrawAmt}` : ""}</span>
                    )}
                  </AnimatePresence>
                </motion.button>

                <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Minimum withdrawal ₹100 · Processed within 24 hours
                </p>
              </motion.div>
            )}

            {/* ═══════════════ TRANSACTION HISTORY ═══════════════ */}
            {tab === "history" && (
              <motion.div key="history" className="px-4 pt-4"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>

                {/* Summary stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "Total Won",  value: totalWon,       color: "#27ae60", icon: "🏆" },
                    { label: "Deposited",  value: totalDeposited, color: "#3498db", icon: "📥" },
                    { label: "Withdrawn",  value: totalWithdrawn, color: "#e74c3c", icon: "📤" },
                  ].map((s) => (
                    <div key={s.label} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <span className="text-lg">{s.icon}</span>
                      <AnimatePresence mode="wait">
                        <motion.span key={s.value} className="font-black text-sm" style={{ color: s.color }}
                          initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                          ₹{s.value.toLocaleString("en-IN")}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-center leading-tight" style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{s.label}</span>
                    </div>
                  ))}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 no-scrollbar mb-3">
                  {TX_FILTER_TABS.map((f) => (
                    <motion.button key={f.id} whileTap={{ scale: 0.92 }}
                      onClick={() => setTxFilter(f.id)}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black cursor-pointer"
                      style={{
                        background: txFilter === f.id ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                        border: txFilter === f.id ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                        color: txFilter === f.id ? "#FFD700" : "rgba(255,255,255,0.45)",
                      }}>
                      {f.icon} {f.label}
                      {txFilter === f.id && filteredTx.length > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 rounded-full text-black font-black"
                          style={{ background: "#FFD700", fontSize: "8px" }}>
                          {filteredTx.length}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Transactions list */}
                {filteredTx.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-14">
                    <motion.span className="text-5xl opacity-30"
                      animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      📋
                    </motion.span>
                    <p className="text-sm font-black" style={{ color: "rgba(255,255,255,0.25)" }}>
                      No transactions yet
                    </p>
                    <p className="text-xs text-center px-8" style={{ color: "rgba(255,255,255,0.15)" }}>
                      {txFilter === "all"
                        ? "Deposit cash or play a game to see your history here"
                        : `No ${TX_FILTER_TABS.find(f => f.id === txFilter)?.label.toLowerCase()} transactions yet`}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                    {filteredTx.map((tx, i) => {
                      const isExpanded = expandedTx === tx.id;
                      const statusColor = tx.status === "completed" ? "#27ae60" : tx.status === "rejected" ? "#e74c3c" : "#f39c12";
                      const statusLabel = tx.status === "completed" ? "COMPLETED" : tx.status === "rejected" ? "REJECTED" : "PENDING";

                      return (
                        <motion.div key={tx.id}
                          style={{
                            background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                            borderBottom: i < filteredTx.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          }}>
                          {/* Main row */}
                          <motion.button
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
                            style={{ WebkitTapHighlightColor: "transparent" }}
                            onClick={() => setExpandedTx(isExpanded ? null : tx.id)}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: Math.min(i, 8) * 0.04 }}>
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-base shrink-0"
                              style={{ background: `${tx.color}18`, border: `1px solid ${tx.color}44` }}>
                              {TX_ICONS[tx.type] ?? "💸"}
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-sm text-white truncate">{tx.title}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{tx.time}</span>
                                {tx.status && (
                                  <span className="text-xs font-black px-1.5 py-0.5 rounded-md"
                                    style={{ background: `${statusColor}18`, color: statusColor, fontSize: "8px" }}>
                                    {statusLabel}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="font-black text-sm" style={{ color: tx.color }}>{tx.display}</span>
                              <span style={{ color: "rgba(255,255,255,0.25)", fontSize: "10px" }}>
                                {isExpanded ? "▲" : "▼"}
                              </span>
                            </div>
                          </motion.button>

                          {/* Expanded details */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden">
                                <div className="px-4 pb-3 pt-1 space-y-2"
                                  style={{ background: "rgba(255,215,0,0.03)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                                  {tx.txId && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Transaction ID</span>
                                      <span className="text-xs font-mono font-bold"
                                        style={{ color: "rgba(255,215,0,0.7)" }}>
                                        {typeof tx.txId === "string" ? tx.txId.slice(0, 20) : `TX${tx.txId}`}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Type</span>
                                    <span className="text-xs font-black capitalize" style={{ color: tx.color }}>
                                      {TX_ICONS[tx.type]} {tx.type}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Status</span>
                                    <span className="text-xs font-black" style={{ color: statusColor }}>
                                      {statusLabel}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Date & Time</span>
                                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>
                                      {tx.time}
                                    </span>
                                  </div>
                                  {tx.roomId && (
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Room ID</span>
                                      <span className="text-xs font-mono font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>
                                        {tx.roomId}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════════ GAME HISTORY ═══════════════ */}
            {tab === "games" && (
              <motion.div key="games" className="px-4 pt-4 space-y-4"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>

                {/* Game stats summary */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Played",   value: gameHistory.length.toString(), color: "#a78bfa", icon: "🎮" },
                    { label: "Won",      value: gamesWon.toString(),           color: "#27ae60", icon: "🏆" },
                    { label: "Lost",     value: gamesLost.toString(),          color: "#e74c3c", icon: "💀" },
                    { label: "Win Rate", value: `${winRate}%`,                 color: "#FFD700", icon: "📊" },
                  ].map((s) => (
                    <motion.div key={s.label}
                      className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
                      <span className="text-base">{s.icon}</span>
                      <span className="font-black text-sm" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-center leading-tight" style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{s.label}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Game history list or empty state */}
                {gameHistory.length === 0 ? (
                  <div className="flex flex-col items-center gap-4 py-14">
                    <motion.span className="text-5xl"
                      animate={{ rotate: [-5, 5, -5], scale: [1, 1.08, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}>
                      🎮
                    </motion.span>
                    <div className="text-center">
                      <p className="text-sm font-black mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                        No games played yet
                      </p>
                      <p className="text-xs px-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.15)" }}>
                        Play Ludo or other games to see your match history here
                      </p>
                    </div>
                    <div className="px-4 py-3 rounded-2xl text-center"
                      style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.12)" }}>
                      <p className="text-xs font-black" style={{ color: "rgba(255,215,0,0.6)" }}>
                        🏆 Win games to earn real cash!
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>
                      🎮 Match History
                    </p>
                    <div className="space-y-2">
                      {gameHistory.map((g, i) => (
                        <motion.div key={g.id}
                          className="rounded-2xl overflow-hidden"
                          style={{
                            background: g.result === "win" ? "rgba(39,174,96,0.06)" : "rgba(231,76,60,0.05)",
                            border: g.result === "win" ? "1px solid rgba(39,174,96,0.2)" : "1px solid rgba(231,76,60,0.15)",
                          }}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}>

                          {/* Header row */}
                          <div className="flex items-center justify-between px-4 pt-3 pb-2"
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <div className="flex items-center gap-2">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                                style={{ background: "rgba(255,255,255,0.06)" }}>
                                {g.game.toLowerCase().includes("ludo") ? "🎲" : g.game.toLowerCase().includes("war") ? "⚔️" : "🎮"}
                              </div>
                              <div>
                                <span className="text-sm font-black text-white">{g.game}</span>
                                <div className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{g.date}</div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-xs font-black px-2 py-0.5 rounded-full"
                                style={{
                                  background: g.result === "win" ? "rgba(39,174,96,0.2)" : "rgba(231,76,60,0.2)",
                                  color: g.result === "win" ? "#27ae60" : "#e74c3c",
                                  border: `1px solid ${g.result === "win" ? "rgba(39,174,96,0.4)" : "rgba(231,76,60,0.3)"}`,
                                }}>
                                {g.result === "win" ? "🏆 WON" : "💀 LOST"}
                              </span>
                            </div>
                          </div>

                          {/* Details row */}
                          <div className="grid grid-cols-3 gap-2 px-4 py-3">
                            <div className="flex flex-col items-center">
                              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }} className="text-xs uppercase">Entry</span>
                              <span className="text-sm font-black" style={{ color: "#e74c3c" }}>-₹{g.entry}</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }} className="text-xs uppercase">Prize</span>
                              <span className="text-sm font-black"
                                style={{ color: g.result === "win" ? "#27ae60" : "rgba(255,255,255,0.3)" }}>
                                {g.result === "win" ? `+₹${g.prize}` : "₹0"}
                              </span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }} className="text-xs uppercase">Net</span>
                              <span className="text-sm font-black"
                                style={{ color: g.result === "win" ? "#27ae60" : "#e74c3c" }}>
                                {g.result === "win"
                                  ? `+₹${(g.prize - g.entry).toFixed(1)}`
                                  : `-₹${g.entry}`}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── RAZORPAY MODAL (rendered outside main scroll) ── */}
      <AnimatePresence>
        {showRazorpay && (
          <RazorpayGateway
            amount={finalAmt}
            bonusPct={bonusPct}
            onSuccess={handleRazorpaySuccess}
            onClose={() => setShowRazorpay(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
