import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── DATA ─────────────────────────────────────────────────────
const USER = { name: "Mukesh", tag: "W18", avatar: "M" };
const BALANCE = { wallet: 250, unplayed: 0, bonus: 65.97, winnings: 13.03 };

const DEPOSIT_PRESETS = [
  { amount: 100,  bonus: 10,  tag: "10% BONUS",    color: "#22c55e", hot: false },
  { amount: 500,  bonus: 15,  tag: "15% BONUS",    color: "#3b82f6", hot: true  },
  { amount: 1000, bonus: 20,  tag: "20% CASHBACK", color: "#FFD700", hot: false },
  { amount: 2000, bonus: 25,  tag: "25% CASHBACK", color: "#ef4444", hot: false },
];

const UPI_OPTIONS = [
  { id: "gpay",    label: "Google Pay", icon: "G",  color: "#4285f4" },
  { id: "phonepe", label: "PhonePe",    icon: "P",  color: "#5f259f" },
  { id: "paytm",   label: "Paytm",      icon: "Pa", color: "#00b9f1" },
  { id: "upi",     label: "UPI ID",     icon: "U",  color: "#ff6600" },
];

const TRANSACTIONS = [
  { id: 1, type: "win",      title: "Ludo Classic Win",    amount: "+₹250", time: "Today, 3:12 PM",     color: "#22c55e" },
  { id: 2, type: "withdraw", title: "Withdrawal to UPI",   amount: "-₹500", time: "Today, 11:45 AM",    color: "#ef4444" },
  { id: 3, type: "deposit",  title: "Deposit + 15% Bonus", amount: "+₹575", time: "Yesterday, 8:20 PM", color: "#3b82f6" },
  { id: 4, type: "win",      title: "World War Reward",    amount: "+₹190", time: "Yesterday, 4:05 PM", color: "#22c55e" },
  { id: 5, type: "bonus",    title: "Referral Bonus",      amount: "+₹50",  time: "2 days ago",         color: "#FFD700" },
  { id: 6, type: "win",      title: "Spin Wheel Win",      amount: "+₹25",  time: "2 days ago",         color: "#22c55e" },
  { id: 7, type: "deposit",  title: "Deposit",             amount: "+₹300", time: "3 days ago",         color: "#3b82f6" },
];

const TX_ICONS: Record<string, string> = {
  win: "🏆", withdraw: "📤", deposit: "📥", bonus: "🎁",
};

const TABS = ["WALLET", "CASUAL", "BATTLE", "BOARD", "SEA"];
const NAV_ITEMS = [
  { id: "home",   label: "Home",   icon: "🏠" },
  { id: "games",  label: "Games",  icon: "🎮" },
  { id: "wallet", label: "Wallet", icon: "💰" },
  { id: "refer",  label: "Refer",  icon: "🎁" },
  { id: "more",   label: "More",   icon: "•••" },
];

type Sheet = "none" | "addcash" | "withdraw" | "transactions";

interface Props { onBack?: () => void; onRefer?: () => void }

// ─── COMPONENT ────────────────────────────────────────────────
export default function WalletScreen({ onBack, onRefer }: Props) {
  const [activeTab, setActiveTab]       = useState("WALLET");
  const [sheet, setSheet]               = useState<Sheet>("none");
  const [selectedPreset, setPreset]     = useState(1);
  const [selectedUPI, setUPI]           = useState("gpay");
  const [customAmt, setCustomAmt]       = useState("");
  const [processing, setProcessing]     = useState(false);
  const [paySuccess, setPaySuccess]     = useState(false);
  const [withdrawAmt, setWithdrawAmt]   = useState("");
  const [withdrawing, setWithdrawing]   = useState(false);
  const [withdrawDone, setWithdrawDone] = useState(false);
  const [activeNav, setActiveNav]       = useState("wallet");

  const preset   = DEPOSIT_PRESETS[selectedPreset];
  const finalAmt = customAmt ? Number(customAmt) : preset.amount;
  const bonusPct = customAmt ? 10 : preset.bonus;
  const bonusAmt = Math.round(finalAmt * bonusPct / 100);

  const handlePay = useCallback(() => {
    if (processing) return;
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false); setPaySuccess(true);
      setTimeout(() => { setPaySuccess(false); setSheet("none"); }, 2000);
    }, 1600);
  }, [processing]);

  const handleWithdraw = useCallback(() => {
    if (withdrawing || !withdrawAmt || Number(withdrawAmt) < 10) return;
    setWithdrawing(true);
    setTimeout(() => {
      setWithdrawing(false); setWithdrawDone(true);
      setTimeout(() => { setWithdrawDone(false); setSheet("none"); }, 2000);
    }, 1600);
  }, [withdrawing, withdrawAmt]);

  const totalWallet = BALANCE.wallet + BALANCE.bonus + BALANCE.winnings;

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#1a0a2e", maxWidth: 480, margin: "0 auto" }}
    >
      {/* ── PURPLE HEADER ── */}
      <div
        className="relative shrink-0"
        style={{
          background: "linear-gradient(180deg, #3d0d6b 0%, #2a0850 60%, #1a0a2e 100%)",
          paddingTop: "env(safe-area-inset-top, 0px)",
        }}
      >
        {/* top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-4">
          {/* Avatar */}
          <div className="flex items-center gap-2.5">
            <button onClick={onBack} className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base text-white"
                style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                {USER.avatar}
              </div>
              <div>
                <div className="text-white font-black text-sm leading-none">{USER.name}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>{USER.tag}</div>
              </div>
            </button>
          </div>

          {/* Balance pill + icons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "#FFD700" }}>
              <span className="font-black text-sm text-black">₹{totalWallet.toFixed(0)}</span>
              <span className="text-base">🎡</span>
            </div>
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <span className="text-base">🔔</span>
            </div>
          </div>
        </div>

        {/* Horizontal tab bar */}
        <div className="flex overflow-x-auto no-scrollbar border-b" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className="flex-shrink-0 px-5 py-2.5 text-xs font-black cursor-pointer relative"
              style={{ color: activeTab === t ? "#fff" : "rgba(255,255,255,0.4)" }}
            >
              {t}
              {activeTab === t && (
                <motion.div
                  layoutId="tabline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: "#fff" }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto">

        {activeTab === "WALLET" && (
          <motion.div
            key="wallet-tab"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pb-4"
          >
            {/* ── BALANCE CARD ── */}
            <div className="mx-3 mt-3 rounded-2xl overflow-hidden"
              style={{ background: "#120626", border: "1px solid rgba(255,255,255,0.08)" }}>

              {/* Wallet Balance row */}
              <div className="flex items-center justify-between px-4 py-3.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(124,58,237,0.2)" }}>
                    <span className="text-base">💳</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Wallet Balance</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>ⓘ</span>
                    </div>
                    <div className="font-black text-white text-base mt-0.5">₹{BALANCE.wallet.toFixed(0)}</div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSheet("transactions")}
                  className="px-3 py-2 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: "#5b21b6", color: "#fff" }}
                >
                  TRANSACTIONS &{"\n"}SUPPORT
                </motion.button>
              </div>

              {/* Unplayed row */}
              <div className="flex items-center justify-between px-4 py-3.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,0.15)" }}>
                    <span className="text-base">🎮</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Unplayed</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>ⓘ</span>
                    </div>
                    <div className="font-black text-white text-base mt-0.5">₹{BALANCE.unplayed.toFixed(0)}</div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSheet("addcash")}
                  className="px-5 py-2.5 rounded-xl text-sm font-black cursor-pointer"
                  style={{ background: "#16a34a", color: "#fff", boxShadow: "0 0 16px rgba(34,197,94,0.35)" }}
                >
                  ADD CASH
                </motion.button>
              </div>

              {/* Bonus row */}
              <div className="flex items-center justify-between px-4 py-3.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(255,215,0,0.12)" }}>
                    <span className="text-base">🎁</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Bonus</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>ⓘ</span>
                    </div>
                    <div className="font-black text-white text-base mt-0.5">₹{BALANCE.bonus.toFixed(2)}</div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  className="px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)" }}
                >
                  EARN BONUS
                </motion.button>
              </div>

              {/* Winnings row */}
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(34,197,94,0.12)" }}>
                    <span className="text-base">🏆</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Winnings</span>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>ⓘ</span>
                    </div>
                    <div className="font-black text-white text-base mt-0.5">₹{BALANCE.winnings.toFixed(2)}</div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setSheet("withdraw")}
                  className="px-5 py-2.5 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)" }}
                >
                  WITHDRAW
                </motion.button>
              </div>
            </div>

            {/* My Offers */}
            <div className="mx-3 mt-3 px-4 py-3.5 rounded-2xl flex items-center justify-between"
              style={{ background: "#120626", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(239,68,68,0.15)" }}>
                  <span className="text-base">⚡</span>
                </div>
                <div>
                  <div className="font-black text-sm text-white">My Offers</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>View All Offers</div>
                </div>
              </div>
              <span className="text-white font-bold text-lg">›</span>
            </div>

            {/* Referral Bonanza Banner */}
            <motion.div
              className="mx-3 mt-3 rounded-2xl overflow-hidden relative"
              style={{
                background: "linear-gradient(135deg, #2d0a5e 0%, #1a0a2e 50%, #2d0a5e 100%)",
                border: "1px solid rgba(255,215,0,0.2)",
                minHeight: 110,
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onRefer?.()}
            >
              {/* Gold star decorations */}
              {["top-2 left-16 text-xs", "top-4 right-20 text-base", "bottom-3 left-28 text-xs", "top-8 left-8 text-base"].map((cls, i) => (
                <motion.span key={i} className={`absolute ${cls} opacity-60`}
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.8, 0.4] }}
                  transition={{ duration: 1.8 + i * 0.4, repeat: Infinity }}>★</motion.span>
              ))}

              <div className="flex items-center h-full px-4 py-4 relative z-10">
                {/* Left content */}
                <div className="flex-1">
                  {/* Winggo logo text */}
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-black text-xs px-1.5 py-0.5 rounded"
                      style={{ background: "#FFD700", color: "#000" }}>W</span>
                    <span className="font-black text-xs text-white">inggo</span>
                  </div>
                  <div className="font-black text-xl text-white leading-tight">
                    REFERRAL
                  </div>
                  <div className="font-black text-xl leading-tight" style={{ color: "#FFD700" }}>
                    BONANZA
                  </div>
                  <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                    INVITE YOUR FRIEND AND GET UPTO
                  </div>
                  <div className="font-black text-2xl" style={{ color: "#FFD700" }}>₹100</div>
                </div>

                {/* Right: character illustration placeholder + button */}
                <div className="flex flex-col items-center gap-2">
                  {/* Character circle */}
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-4xl"
                    style={{ background: "rgba(255,215,0,0.1)", border: "2px solid rgba(255,215,0,0.2)" }}>
                    👨‍🦱
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    className="px-4 py-1.5 rounded-full text-xs font-black cursor-pointer"
                    style={{ background: "#FFD700", color: "#000" }}
                  >
                    Refer Now →
                  </motion.button>
                </div>
              </div>
            </motion.div>

            {/* Security strip */}
            <div className="flex items-center justify-center gap-4 px-4 pt-4 pb-2">
              {["🔒 Secure", "⚡ Instant", "✅ RBI Safe"].map((b) => (
                <span key={b} className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>{b}</span>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab !== "WALLET" && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 opacity-40">
            <span className="text-5xl">🎮</span>
            <span className="text-white font-black text-lg">{activeTab} Games</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Coming soon…</span>
          </div>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div
        className="shrink-0 flex items-center justify-around pt-2 pb-3"
        style={{
          background: "#0f0720",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = activeNav === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id === "refer") onRefer?.();
              }}
              className="flex flex-col items-center gap-1 cursor-pointer relative"
            >
              {active && (
                <motion.div
                  layoutId="navpill"
                  className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full"
                  style={{ background: "#5b21b6", zIndex: 0 }}
                />
              )}
              <span className="relative z-10 text-xl">{item.icon}</span>
              <span
                className="relative z-10 text-xs font-black"
                style={{ color: active ? "#fff" : "rgba(255,255,255,0.35)" }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════
          BOTTOM SHEETS
      ══════════════════════════════════════════════════ */}
      <AnimatePresence>
        {sheet !== "none" && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 cursor-pointer"
              style={{ background: "rgba(0,0,0,0.7)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSheet("none")}
            />

            {/* Sheet */}
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden flex flex-col"
              style={{
                background: "#120626",
                maxWidth: 480,
                margin: "0 auto",
                maxHeight: "88vh",
                borderTop: "1px solid rgba(255,255,255,0.1)",
              }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
            >
              {/* Sheet handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              </div>

              {/* ── ADD CASH SHEET ── */}
              {sheet === "addcash" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="px-5 pb-3 shrink-0">
                    <h2 className="font-black text-white text-lg">Add Cash</h2>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Select amount to add to your wallet
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
                    {/* Presets */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {DEPOSIT_PRESETS.map((p, i) => (
                        <motion.button
                          key={p.amount}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => { setPreset(i); setCustomAmt(""); }}
                          className="relative flex flex-col items-start p-4 rounded-2xl cursor-pointer text-left"
                          style={{
                            background: selectedPreset === i && !customAmt ? `${p.color}18` : "rgba(255,255,255,0.05)",
                            border: selectedPreset === i && !customAmt ? `2px solid ${p.color}` : "1px solid rgba(255,255,255,0.08)",
                            boxShadow: selectedPreset === i && !customAmt ? `0 0 16px ${p.color}30` : "none",
                          }}
                        >
                          {p.hot && (
                            <span className="absolute top-2 right-2 text-xs font-black px-1.5 py-0.5 rounded-lg"
                              style={{ background: "#ef4444", color: "#fff", fontSize: "8px" }}>HOT</span>
                          )}
                          <span className="font-black text-white text-xl">₹{p.amount}</span>
                          <span className="mt-1.5 text-xs font-black px-2 py-0.5 rounded-full"
                            style={{ background: `${p.color}22`, color: p.color }}>{p.tag}</span>
                        </motion.button>
                      ))}
                    </div>

                    {/* Custom */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest block mb-2"
                        style={{ color: "rgba(255,255,255,0.35)" }}>Custom Amount</label>
                      <div className="flex items-center h-13 rounded-2xl overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                        <span className="px-4 font-black text-base" style={{ color: "#FFD700" }}>₹</span>
                        <input
                          type="number" inputMode="numeric" placeholder="Enter amount"
                          value={customAmt} onChange={(e) => setCustomAmt(e.target.value)}
                          className="flex-1 h-full bg-transparent text-white text-base outline-none placeholder:text-zinc-700 font-medium pr-4"
                          style={{ caretColor: "#FFD700" }}
                        />
                      </div>
                    </div>

                    {/* Bonus preview */}
                    {finalAmt > 0 && (
                      <motion.div className="px-4 py-3 rounded-2xl"
                        style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="flex justify-between">
                          <span className="text-xs text-zinc-400">You pay</span>
                          <span className="font-black text-white">₹{finalAmt}</span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs" style={{ color: "#22c55e" }}>+ {bonusPct}% Bonus</span>
                          <span className="font-black" style={{ color: "#22c55e" }}>+₹{bonusAmt}</span>
                        </div>
                        <div className="h-px my-2" style={{ background: "rgba(255,255,255,0.06)" }} />
                        <div className="flex justify-between">
                          <span className="text-xs font-black text-white">Total Added</span>
                          <span className="font-black" style={{ color: "#FFD700" }}>₹{finalAmt + bonusAmt}</span>
                        </div>
                      </motion.div>
                    )}

                    {/* UPI */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest block mb-3"
                        style={{ color: "rgba(255,255,255,0.35)" }}>Pay Via</label>
                      <div className="grid grid-cols-4 gap-2">
                        {UPI_OPTIONS.map((u) => (
                          <motion.button key={u.id} whileTap={{ scale: 0.9 }}
                            onClick={() => setUPI(u.id)}
                            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl cursor-pointer"
                            style={{
                              background: selectedUPI === u.id ? `${u.color}18` : "rgba(255,255,255,0.05)",
                              border: selectedUPI === u.id ? `1.5px solid ${u.color}` : "1px solid rgba(255,255,255,0.08)",
                            }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                              style={{ background: u.color, color: "#fff" }}>
                              {u.icon}
                            </div>
                            <span className="text-center leading-tight font-bold"
                              style={{ color: selectedUPI === u.id ? u.color : "rgba(255,255,255,0.4)", fontSize: "9px" }}>
                              {u.label}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Pay button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }} onClick={handlePay}
                      disabled={processing || finalAmt <= 0}
                      className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
                      style={{
                        background: paySuccess ? "#16a34a" : processing ? "rgba(255,255,255,0.1)" : "#16a34a",
                        color: processing ? "rgba(255,255,255,0.5)" : "#fff",
                        boxShadow: !processing ? "0 0 24px rgba(34,197,94,0.4)" : "none",
                        opacity: finalAmt <= 0 ? 0.5 : 1,
                      }}>
                      <AnimatePresence mode="wait">
                        {paySuccess ? (
                          <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}>✅ Cash Added!</motion.span>
                        ) : processing ? (
                          <motion.span key="p" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                            Processing…
                          </motion.span>
                        ) : (
                          <span>ADD CASH {finalAmt > 0 ? `₹${finalAmt}` : ""}</span>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  </div>
                </div>
              )}

              {/* ── WITHDRAW SHEET ── */}
              {sheet === "withdraw" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="px-5 pb-3 shrink-0">
                    <h2 className="font-black text-white text-lg">Withdraw Winnings</h2>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Instant transfer to your UPI
                    </p>
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                    {/* Available */}
                    <div className="px-4 py-3.5 rounded-2xl flex justify-between items-center"
                      style={{ background: "rgba(34,197,94,0.08)", border: "1.5px solid rgba(34,197,94,0.25)" }}>
                      <div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>Available to Withdraw</div>
                        <div className="font-black text-xl" style={{ color: "#22c55e" }}>₹{BALANCE.winnings.toFixed(2)}</div>
                      </div>
                      <span className="text-3xl">🏆</span>
                    </div>

                    {/* Amount input */}
                    <div className="flex items-center h-13 rounded-2xl overflow-hidden"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                      <span className="px-4 font-black text-base" style={{ color: "#22c55e" }}>₹</span>
                      <input
                        type="number" inputMode="numeric" placeholder="Min ₹10"
                        value={withdrawAmt} onChange={(e) => setWithdrawAmt(e.target.value)}
                        className="flex-1 h-full bg-transparent text-white text-base outline-none placeholder:text-zinc-700 font-medium pr-4"
                        style={{ caretColor: "#22c55e" }}
                      />
                    </div>

                    {/* Quick chips */}
                    <div className="flex gap-2">
                      {[10, 50, 100, Math.floor(BALANCE.winnings)].map((a) => (
                        <motion.button key={a} whileTap={{ scale: 0.92 }}
                          onClick={() => setWithdrawAmt(String(a))}
                          className="flex-1 py-2 rounded-xl text-xs font-black cursor-pointer"
                          style={{
                            background: withdrawAmt === String(a) ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)",
                            border: withdrawAmt === String(a) ? "1.5px solid rgba(34,197,94,0.5)" : "1px solid rgba(255,255,255,0.08)",
                            color: withdrawAmt === String(a) ? "#22c55e" : "rgba(255,255,255,0.45)",
                          }}>₹{a}</motion.button>
                      ))}
                    </div>

                    {/* UPI */}
                    <div>
                      <label className="text-xs font-bold uppercase tracking-widest block mb-3"
                        style={{ color: "rgba(255,255,255,0.35)" }}>Withdraw To</label>
                      <div className="grid grid-cols-4 gap-2">
                        {UPI_OPTIONS.map((u) => (
                          <motion.button key={u.id} whileTap={{ scale: 0.9 }}
                            onClick={() => setUPI(u.id)}
                            className="flex flex-col items-center gap-1.5 py-3 rounded-2xl cursor-pointer"
                            style={{
                              background: selectedUPI === u.id ? `${u.color}18` : "rgba(255,255,255,0.05)",
                              border: selectedUPI === u.id ? `1.5px solid ${u.color}` : "1px solid rgba(255,255,255,0.08)",
                            }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-xs"
                              style={{ background: u.color, color: "#fff" }}>
                              {u.icon}
                            </div>
                            <span className="text-center leading-tight font-bold"
                              style={{ color: selectedUPI === u.id ? u.color : "rgba(255,255,255,0.4)", fontSize: "9px" }}>
                              {u.label}
                            </span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-3 gap-2">
                      {[["⚡", "Instant"], ["🔒", "Secure"], ["✅", "KYC Verified"]].map(([icon, l]) => (
                        <div key={l} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                          <span>{icon}</span>
                          <span className="text-xs font-black text-center text-white" style={{ fontSize: "9px" }}>{l}</span>
                        </div>
                      ))}
                    </div>

                    {/* Withdraw button */}
                    <motion.button
                      whileTap={{ scale: 0.97 }} onClick={handleWithdraw}
                      disabled={withdrawing || !withdrawAmt || Number(withdrawAmt) < 10}
                      className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
                      style={{
                        background: withdrawDone ? "rgba(34,197,94,0.3)" : withdrawing ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#16a34a,#15803d)",
                        color: withdrawing ? "rgba(255,255,255,0.4)" : "#fff",
                        boxShadow: !withdrawing && !withdrawDone ? "0 0 20px rgba(34,197,94,0.3)" : "none",
                        opacity: !withdrawAmt || Number(withdrawAmt) < 10 ? 0.5 : 1,
                      }}>
                      <AnimatePresence mode="wait">
                        {withdrawDone ? (
                          <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }}>✅ Withdrawal Initiated!</motion.span>
                        ) : withdrawing ? (
                          <motion.span key="p" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>Processing…</motion.span>
                        ) : (
                          <span>WITHDRAW {withdrawAmt ? `₹${withdrawAmt}` : ""}</span>
                        )}
                      </AnimatePresence>
                    </motion.button>

                    <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.22)" }}>
                      Min ₹10 · Processed within 24 hours
                    </p>
                  </div>
                </div>
              )}

              {/* ── TRANSACTIONS SHEET ── */}
              {sheet === "transactions" && (
                <div className="flex flex-col flex-1 overflow-hidden">
                  <div className="px-5 pb-3 shrink-0 flex items-center justify-between">
                    <div>
                      <h2 className="font-black text-white text-lg">Transactions</h2>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Your recent activity</p>
                    </div>
                    <div className="flex gap-2 text-xs font-black" style={{ color: "rgba(255,255,255,0.35)" }}>
                      <span className="px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.07)" }}>All</span>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-2 px-5 mb-4 shrink-0">
                    {[
                      { label: "Total Won",  value: "₹2,840", color: "#22c55e", icon: "🏆" },
                      { label: "Deposited",  value: "₹1,800", color: "#3b82f6", icon: "📥" },
                      { label: "Withdrawn",  value: "₹500",   color: "#ef4444", icon: "📤" },
                    ].map((s) => (
                      <div key={s.label} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <span>{s.icon}</span>
                        <span className="font-black text-sm" style={{ color: s.color }}>{s.value}</span>
                        <span className="text-center" style={{ color: "rgba(255,255,255,0.3)", fontSize: "8px" }}>{s.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto px-5 pb-6">
                    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                      {TRANSACTIONS.map((tx, i) => (
                        <motion.div
                          key={tx.id}
                          className="flex items-center gap-3 px-4 py-3.5"
                          style={{
                            background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                            borderBottom: i < TRANSACTIONS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                          }}
                          initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                        >
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0"
                            style={{ background: `${tx.color}18`, border: `1px solid ${tx.color}44` }}>
                            {TX_ICONS[tx.type]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm text-white truncate">{tx.title}</div>
                            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{tx.time}</div>
                          </div>
                          <span className="font-black text-sm shrink-0" style={{ color: tx.color }}>{tx.amount}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
