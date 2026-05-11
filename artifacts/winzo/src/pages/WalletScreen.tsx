import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";
import BackButton from "@/components/BackButton";

// ─── STATIC DATA ──────────────────────────────────────────────
const DEPOSIT_PRESETS = [
  { amount: 100,  bonus: 10,  label: "Starter",  tag: "10% BONUS",    color: "#27ae60" },
  { amount: 500,  bonus: 15,  label: "Popular",   tag: "15% BONUS",    color: "#3498db", hot: true },
  { amount: 1000, bonus: 20,  label: "Mega",      tag: "20% CASHBACK", color: "#FFD700" },
  { amount: 2000, bonus: 25,  label: "Champion",  tag: "25% CASHBACK", color: "#e74c3c" },
];

const UPI_OPTIONS = [
  { id: "gpay",    label: "Google Pay", icon: "🇬",  color: "#4285f4" },
  { id: "phonepe", label: "PhonePe",    icon: "💜",  color: "#5f259f" },
  { id: "paytm",   label: "Paytm",      icon: "💙",  color: "#00b9f1" },
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

type Tab = "add" | "withdraw" | "history";

interface Props { onBack?: () => void }

// ─── COMPONENT ────────────────────────────────────────────────
export default function WalletScreen({ onBack }: Props) {
  // Live wallet state from context
  const { wallet, total, transactions, addDeposit, withdraw: ctxWithdraw } = useWallet();

  const [tab, setTab]                   = useState<Tab>("add");
  const [selectedPreset, setPreset]     = useState(1);
  const [selectedUPI, setUPI]           = useState("gpay");
  const [customAmt, setCustomAmt]       = useState("");
  const [processing, setProcessing]     = useState(false);
  const [success, setSuccess]           = useState(false);
  const [withdrawAmt, setWithdrawAmt]   = useState("");
  const [withdrawing, setWithdrawing]   = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);

  const preset   = DEPOSIT_PRESETS[selectedPreset];
  const finalAmt = customAmt ? Number(customAmt) : preset.amount;
  const bonusPct = customAmt ? 10 : preset.bonus;
  const bonusAmt = Math.round(finalAmt * bonusPct / 100);

  const handlePay = useCallback(() => {
    if (processing || finalAmt <= 0) return;
    setProcessing(true);
    setTimeout(() => {
      addDeposit(finalAmt, bonusPct);
      setProcessing(false);
      setSuccess(true);
      setCustomAmt("");
      setTimeout(() => setSuccess(false), 2500);
    }, 1400);
  }, [processing, finalAmt, bonusPct, addDeposit]);

  const handleWithdraw = useCallback(() => {
    const amt = Number(withdrawAmt);
    if (withdrawing || !amt || amt < 100 || amt > wallet.winning) return;
    setWithdrawing(true);
    setTimeout(() => {
      ctxWithdraw(amt);
      setWithdrawing(false);
      setWithdrawDone(true);
      setWithdrawAmt("");
      setTimeout(() => setWithdrawDone(false), 2500);
    }, 1400);
  }, [withdrawing, withdrawAmt, wallet.winning, ctxWithdraw]);

  // Stats for history tab
  const totalWon      = transactions.filter(t => t.type === "win").reduce((s, t) => s + t.rawAmount, 0);
  const totalDeposited= transactions.filter(t => t.type === "deposit").reduce((s, t) => s + t.rawAmount, 0);
  const totalWithdrawn= transactions.filter(t => t.type === "withdraw").reduce((s, t) => s + Math.abs(t.rawAmount), 0);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {/* ── HEADER ── */}
      <div
        className="relative shrink-0 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0a0a20 0%, #05080a 60%, #07050f 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div className="absolute top-[-30%] left-[-15%] w-[55%] h-[55%] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,215,0,0.06) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[45%] h-[45%] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(52,152,219,0.07) 0%, transparent 70%)" }} />

        <div className="absolute top-4 left-4 z-10">
          <BackButton onBack={onBack} label="Home" />
        </div>

        <div className="flex flex-col items-center pt-10 pb-6 px-4 relative z-10">
          <span className="text-xs font-black px-3 py-1 rounded-full mb-3"
            style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
            💰 WINGGO WALLET
          </span>

          {/* Live total balance */}
          <div className="text-center mb-1">
            <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
              Total Balance
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={total}
                className="text-5xl font-black mt-1"
                style={{ color: "#FFD700", textShadow: "0 0 20px rgba(255,215,0,0.4)" }}
                initial={{ scale: 0.88, opacity: 0, y: -6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
              >
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Live balance breakdown */}
          <div className="flex gap-3 mt-4">
            {[
              { label: "Winning", value: wallet.winning, color: "#27ae60", icon: "🏆" },
              { label: "Deposit", value: wallet.deposit, color: "#3498db", icon: "💳" },
              { label: "Bonus",   value: wallet.bonus,   color: "#FFD700", icon: "🎁" },
            ].map((b) => (
              <motion.div
                key={b.label}
                className="flex flex-col items-center gap-1 px-4 py-2.5 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                animate={{ borderColor: [`rgba(${b.color === "#FFD700" ? "255,215,0" : b.color === "#27ae60" ? "39,174,96" : "52,152,219"},0.08)`, `rgba(${b.color === "#FFD700" ? "255,215,0" : b.color === "#27ae60" ? "39,174,96" : "52,152,219"},0.22)`, `rgba(${b.color === "#FFD700" ? "255,215,0" : b.color === "#27ae60" ? "39,174,96" : "52,152,219"},0.08)`] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <span className="text-base">{b.icon}</span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={b.value}
                    className="font-black text-sm"
                    style={{ color: b.color }}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    ₹{b.value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </motion.span>
                </AnimatePresence>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{b.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex shrink-0 px-4 pt-4 gap-2">
        {([
          { id: "add",      label: "Add Cash", icon: "📥" },
          { id: "withdraw", label: "Withdraw",  icon: "📤" },
          { id: "history",  label: "History",   icon: "📋" },
        ] as { id: Tab; label: string; icon: string }[]).map((t) => (
          <motion.button
            key={t.id}
            whileTap={{ scale: 0.93 }}
            onClick={() => setTab(t.id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-xs font-black cursor-pointer"
            style={{
              background: tab === t.id ? "linear-gradient(135deg,#FFD700,#ff8c00)" : "rgba(255,255,255,0.05)",
              color: tab === t.id ? "#000" : "rgba(255,255,255,0.45)",
              border: tab === t.id ? "none" : "1px solid rgba(255,255,255,0.08)",
              boxShadow: tab === t.id ? "0 0 14px rgba(255,215,0,0.3)" : "none",
            }}
          >
            <span>{t.icon}</span> {t.label}
          </motion.button>
        ))}
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto pb-8">
        <AnimatePresence mode="wait">

          {/* ═══ ADD CASH ═══ */}
          {tab === "add" && (
            <motion.div key="add" className="px-4 pt-4 space-y-4"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>

              {/* Daily offers strip */}
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
                <div className="grid grid-cols-2 gap-2">
                  {DEPOSIT_PRESETS.map((p, i) => (
                    <motion.button
                      key={p.amount}
                      whileTap={{ scale: 0.93 }}
                      onClick={() => { setPreset(i); setCustomAmt(""); }}
                      className="relative flex flex-col items-start p-3.5 rounded-2xl cursor-pointer text-left"
                      style={{
                        background: selectedPreset === i && !customAmt ? `${p.color}15` : "rgba(255,255,255,0.04)",
                        border: selectedPreset === i && !customAmt ? `1.5px solid ${p.color}` : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: selectedPreset === i && !customAmt ? `0 0 16px ${p.color}33` : "none",
                      }}
                    >
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
                  <input
                    type="number" inputMode="numeric" placeholder="Enter amount"
                    value={customAmt} onChange={(e) => setCustomAmt(e.target.value)}
                    className="flex-1 h-full bg-transparent text-white text-base outline-none placeholder:text-zinc-700 font-medium pr-4"
                    style={{ caretColor: "#FFD700" }}
                  />
                </div>
              </div>

              {/* Live bonus summary */}
              {finalAmt > 0 && (
                <motion.div className="py-3 px-4 rounded-2xl"
                  style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>You pay</span>
                    <span className="font-black text-white">₹{finalAmt}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold" style={{ color: "rgba(39,174,96,0.8)" }}>+ {bonusPct}% Bonus</span>
                    <span className="font-black" style={{ color: "#27ae60" }}>+₹{bonusAmt}</span>
                  </div>
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
                    <motion.button
                      key={u.id} whileTap={{ scale: 0.9 }} onClick={() => setUPI(u.id)}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl cursor-pointer"
                      style={{
                        background: selectedUPI === u.id ? `${u.color}18` : "rgba(255,255,255,0.04)",
                        border: selectedUPI === u.id ? `1.5px solid ${u.color}` : "1px solid rgba(255,255,255,0.08)",
                        boxShadow: selectedUPI === u.id ? `0 0 12px ${u.color}44` : "none",
                      }}
                    >
                      <span className="text-xl">{u.icon}</span>
                      <span className="text-xs font-bold text-center leading-tight"
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
              <motion.button
                whileTap={{ scale: 0.97 }} onClick={handlePay}
                disabled={processing || finalAmt <= 0}
                className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer relative overflow-hidden"
                style={{
                  background: processing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#FFD700,#ff8c00)",
                  color: processing ? "rgba(255,255,255,0.4)" : "#000",
                  boxShadow: processing ? "none" : "0 0 24px rgba(255,215,0,0.4)",
                  letterSpacing: "0.04em",
                  opacity: finalAmt <= 0 ? 0.5 : 1,
                }}
              >
                <AnimatePresence mode="wait">
                  {success ? (
                    <motion.span key="ok" className="flex items-center justify-center gap-2"
                      initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      ✅ ₹{finalAmt + bonusAmt} Added to Wallet!
                    </motion.span>
                  ) : processing ? (
                    <motion.span key="proc" className="flex items-center justify-center gap-2"
                      animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      ⏳ Processing…
                    </motion.span>
                  ) : (
                    <motion.span key="pay" className="flex items-center justify-center gap-2">
                      ⚡ ADD CASH {finalAmt > 0 ? `₹${finalAmt}` : ""}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </motion.div>
          )}

          {/* ═══ WITHDRAW ═══ */}
          {tab === "withdraw" && (
            <motion.div key="withdraw" className="px-4 pt-5 space-y-4"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>

              {/* Winning balance — live */}
              <div className="py-4 px-5 rounded-2xl flex items-center justify-between"
                style={{ background: "rgba(39,174,96,0.08)", border: "1.5px solid rgba(39,174,96,0.25)" }}>
                <div>
                  <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Withdrawable (Winning)</div>
                  <AnimatePresence mode="wait">
                    <motion.div key={wallet.winning} className="font-black text-2xl" style={{ color: "#27ae60" }}
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                      ₹{wallet.winning.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </motion.div>
                  </AnimatePresence>
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
                  <input
                    type="number" inputMode="numeric" placeholder="Min ₹100"
                    value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)}
                    className="flex-1 h-full bg-transparent text-white text-base outline-none placeholder:text-zinc-700 font-medium pr-4"
                    style={{ caretColor: "#27ae60" }}
                  />
                </div>
              </div>

              {/* Quick chips */}
              <div className="flex gap-2">
                {[100, 250, 500, Math.floor(wallet.winning)].map((a) => (
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
                      <span className="text-xl">{u.icon}</span>
                      <span className="text-xs font-bold text-center leading-tight"
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
              <motion.button
                whileTap={{ scale: 0.97 }} onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmt || Number(withdrawAmt) < 100 || Number(withdrawAmt) > wallet.winning}
                className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer"
                style={{
                  background: withdrawDone ? "rgba(39,174,96,0.3)" : withdrawing ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg,#27ae60,#1e8449)",
                  color: withdrawing ? "rgba(255,255,255,0.4)" : "#fff",
                  boxShadow: !withdrawing && !withdrawDone ? "0 0 24px rgba(39,174,96,0.35)" : "none",
                  opacity: !withdrawAmt || Number(withdrawAmt) < 100 ? 0.5 : 1,
                  letterSpacing: "0.04em",
                }}
              >
                <AnimatePresence mode="wait">
                  {withdrawDone ? (
                    <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}>✅ Withdrawal Initiated!</motion.span>
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

          {/* ═══ HISTORY ═══ */}
          {tab === "history" && (
            <motion.div key="history" className="px-4 pt-5"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>

              {/* Live summary */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: "Total Won",  value: totalWon,       color: "#27ae60", icon: "🏆" },
                  { label: "Deposited",  value: totalDeposited, color: "#3498db", icon: "📥" },
                  { label: "Withdrawn",  value: totalWithdrawn, color: "#e74c3c", icon: "📤" },
                ].map((s) => (
                  <motion.div key={s.label} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-lg">{s.icon}</span>
                    <AnimatePresence mode="wait">
                      <motion.span key={s.value} className="font-black text-sm" style={{ color: s.color }}
                        initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                        ₹{s.value.toLocaleString("en-IN")}
                      </motion.span>
                    </AnimatePresence>
                    <span className="text-center leading-tight" style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{s.label}</span>
                  </motion.div>
                ))}
              </div>

              <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                📋 Recent Transactions
              </p>

              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                {transactions.map((tx, i) => (
                  <motion.div
                    key={tx.id}
                    className="flex items-center gap-3 px-4 py-3.5"
                    style={{
                      background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                      borderBottom: i < transactions.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i, 6) * 0.04 }}
                  >
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                      style={{ background: `${tx.color}18`, border: `1px solid ${tx.color}44` }}>
                      {TX_ICONS[tx.type] ?? "💸"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-white truncate">{tx.title}</div>
                      <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{tx.time}</div>
                    </div>
                    <span className="font-black text-sm shrink-0" style={{ color: tx.color }}>{tx.display}</span>
                  </motion.div>
                ))}
              </div>

              {/* Cashback promo */}
              <motion.div
                className="mt-4 py-3 px-4 rounded-2xl flex items-center gap-3"
                style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.18)" }}
                animate={{ opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2.2, repeat: Infinity }}
              >
                <span className="text-xl">🎁</span>
                <div>
                  <div className="text-xs font-black text-white">Cashback Rewards Available!</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Add ₹500+ today and get extra <span style={{ color: "#FFD700" }}>₹75 bonus</span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.93 }} onClick={() => setTab("add")}
                  className="ml-auto text-xs font-black px-3 py-1.5 rounded-xl cursor-pointer"
                  style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.3)" }}
                >
                  ADD →
                </motion.button>
              </motion.div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  );
}
