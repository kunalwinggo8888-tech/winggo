import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

interface ProfileScreenProps {
  onKYC?: () => void;
  onRefer?: () => void;
  onWallet?: () => void;
  onLogout?: () => void;
}

const GAME_STATS = [
  { label: "Matches",  value: "247",   icon: "🎮", color: "#a78bfa" },
  { label: "Win Rate", value: "68%",   icon: "🏆", color: "#FFD700" },
  { label: "Won",      value: "₹4.2K", icon: "💰", color: "#34d399" },
  { label: "Level",    value: "Pro",   icon: "⭐", color: "#f472b6" },
];

const BADGES = ["🎯 Sharpshooter", "⚡ Speed King", "🔥 Hot Streak"];

function getKycStatus(): "pending" | "verified" | "rejected" {
  try {
    const d = JSON.parse(localStorage.getItem("winggo_kyc") || "{}");
    return d.status ?? "pending";
  } catch {
    return "pending";
  }
}

const KYC_STATUS_CONFIG = {
  pending:  { label: "KYC Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  dot: "#f59e0b", icon: "⏳" },
  verified: { label: "KYC Verified", color: "#34d399", bg: "rgba(52,211,153,0.12)",  dot: "#34d399", icon: "✅" },
  rejected: { label: "KYC Rejected", color: "#f87171", bg: "rgba(248,113,113,0.12)", dot: "#f87171", icon: "❌" },
};

const MENU_ITEMS = [
  { id: "kyc",         icon: "🪪", label: "KYC Verification",   sub: "Identity verification",    arrow: true },
  { id: "transactions",icon: "📋", label: "Transaction History", sub: "View all transactions",    arrow: true },
  { id: "refer",       icon: "🎁", label: "Refer & Earn",        sub: "Earn ₹50 per friend",      arrow: true },
  { id: "support",     icon: "🎧", label: "Support Center",      sub: "24×7 help & FAQ",          arrow: true },
  { id: "terms",       icon: "📜", label: "Terms & Privacy",     sub: "Legal policies",           arrow: true },
];

export default function ProfileScreen({ onKYC, onRefer, onWallet, onLogout }: ProfileScreenProps) {
  const { wallet, total } = useWallet();
  const kycStatus = getKycStatus();
  const kycCfg = KYC_STATUS_CONFIG[kycStatus];
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [editName, setEditName] = useState(false);
  const [username, setUsername] = useState("Rahul_Pro");
  const [tempName, setTempName] = useState(username);

  function handleMenu(id: string) {
    if (id === "kyc")          onKYC?.();
    else if (id === "refer")   onRefer?.();
    else if (id === "transactions") onWallet?.();
  }

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── HERO HEADER ── */}
        <div
          className="relative overflow-hidden pb-6"
          style={{
            background: "linear-gradient(160deg, #120025 0%, #0a0015 40%, #070510 100%)",
            borderBottom: "1px solid rgba(255,215,0,0.10)",
          }}
        >
          {/* Background glow orbs */}
          <div className="absolute top-[-40%] left-[-20%] w-[70%] h-[70%] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(120,40,255,0.18) 0%, transparent 70%)" }} />
          <div className="absolute top-[-20%] right-[-20%] w-[55%] h-[55%] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(circle, rgba(255,215,0,0.10) 0%, transparent 70%)" }} />

          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-12 pb-4">
            <span className="text-white font-black text-lg tracking-tight">My Profile</span>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => { setEditName(true); setTempName(username); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer"
              style={{
                background: "rgba(255,215,0,0.10)",
                border: "1px solid rgba(255,215,0,0.30)",
                color: "#FFD700",
              }}
            >
              ✏️ Edit Profile
            </motion.button>
          </div>

          {/* Avatar row */}
          <div className="flex flex-col items-center gap-3 px-4">
            {/* Avatar */}
            <motion.div
              className="relative"
              animate={{ boxShadow: ["0 0 20px rgba(255,215,0,0.3)", "0 0 40px rgba(255,215,0,0.6)", "0 0 20px rgba(255,215,0,0.3)"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              style={{ borderRadius: "999px" }}
            >
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-4xl"
                style={{
                  background: "linear-gradient(135deg, #7c3aed, #FFD700)",
                  border: "3px solid rgba(255,215,0,0.6)",
                }}
              >
                👑
              </div>
              {/* VIP badge */}
              <div
                className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[9px] font-black"
                style={{
                  background: "linear-gradient(135deg, #FFD700, #ff8c00)",
                  color: "#000",
                  border: "2px solid #07050f",
                }}
              >
                VIP
              </div>
            </motion.div>

            {/* Name */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-xl">{username}</span>
                {kycStatus === "verified" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-black"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    ✓ Verified
                  </span>
                )}
              </div>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>ID: #WG-4829</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Joined: May 2025</span>
            </div>

            {/* Badges */}
            <div className="flex gap-2 flex-wrap justify-center">
              {BADGES.map((b) => (
                <span key={b} className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.55)" }}>
                  {b}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── KYC STATUS STRIP ── */}
        <motion.div
          whileTap={{ scale: 0.97 }}
          onClick={onKYC}
          className="mx-4 mt-4 px-4 py-3 rounded-2xl flex items-center gap-3 cursor-pointer"
          style={{
            background: kycCfg.bg,
            border: `1px solid ${kycCfg.color}44`,
          }}
        >
          <span className="text-xl">{kycCfg.icon}</span>
          <div className="flex-1">
            <div className="text-sm font-black" style={{ color: kycCfg.color }}>{kycCfg.label}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
              {kycStatus === "pending"  ? "Complete KYC to unlock full features" :
               kycStatus === "verified" ? "Your identity has been verified" :
               "KYC was rejected — please re-submit"}
            </div>
          </div>
          <span style={{ color: kycCfg.color }}>›</span>
        </motion.div>

        {/* ── WALLET CARD ── */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={onWallet}
          className="mx-4 mt-3 rounded-2xl overflow-hidden cursor-pointer"
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.10) 0%, rgba(255,140,0,0.06) 100%)",
            border: "1px solid rgba(255,215,0,0.25)",
          }}
        >
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(255,215,0,0.6)" }}>
                💰 Wallet Balance
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700" }}>
                View All →
              </span>
            </div>
            <div className="text-3xl font-black text-white mb-3">
              ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Winnings", val: wallet.winning, color: "#34d399" },
                { label: "Deposit",  val: wallet.deposit, color: "#60a5fa" },
                { label: "Bonus",    val: wallet.bonus,   color: "#f472b6" },
              ].map((w) => (
                <div key={w.label} className="rounded-xl px-2 py-2 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-sm font-black" style={{ color: w.color }}>
                    ₹{w.val.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{w.label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── GAME STATS ── */}
        <div className="mx-4 mt-3">
          <div className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
            Game Stats
          </div>
          <div className="grid grid-cols-4 gap-2">
            {GAME_STATS.map((s) => (
              <div key={s.label} className="rounded-xl px-2 py-3 flex flex-col items-center gap-1"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="text-xl">{s.icon}</span>
                <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[9px] font-semibold" style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── MENU LIST ── */}
        <div className="mx-4 mt-4 rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {MENU_ITEMS.map((item, i) => (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.98, backgroundColor: "rgba(255,255,255,0.05)" }}
              onClick={() => handleMenu(item.id)}
              className="w-full flex items-center gap-3 px-4 py-4 text-left cursor-pointer"
              style={{
                background: "rgba(255,255,255,0.02)",
                borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
                style={{ background: "rgba(255,255,255,0.06)" }}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">{item.label}</div>
                <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{item.sub}</div>
              </div>
              {item.id === "kyc" && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: kycCfg.bg, color: kycCfg.color, border: `1px solid ${kycCfg.color}44` }}>
                  {kycStatus.toUpperCase()}
                </span>
              )}
              {item.arrow && (
                <span style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
              )}
            </motion.button>
          ))}
        </div>

        {/* ── LOGOUT ── */}
        <div className="mx-4 mt-3 mb-28">
          <AnimatePresence mode="wait">
            {!logoutConfirm ? (
              <motion.button
                key="logout-btn"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setLogoutConfirm(true)}
                className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  color: "#f87171",
                }}
              >
                🚪 Logout
              </motion.button>
            ) : (
              <motion.div
                key="logout-confirm"
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-4"
                style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.30)" }}
              >
                <p className="text-white font-bold text-sm text-center mb-3">Are you sure you want to logout?</p>
                <div className="flex gap-3">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setLogoutConfirm(false)}
                    className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                    Cancel
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={onLogout}
                    className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                    style={{ background: "rgba(239,68,68,0.85)", color: "#fff" }}>
                    Yes, Logout
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── EDIT NAME MODAL ── */}
      <AnimatePresence>
        {editName && (
          <>
            <motion.div className="fixed inset-0 z-[100]"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditName(false)} />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-[110] rounded-t-3xl p-6"
              style={{ maxWidth: 480, margin: "0 auto", background: "#10101a", border: "1px solid rgba(255,215,0,0.15)" }}
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: "rgba(255,255,255,0.15)" }} />
              <h3 className="text-white font-black text-lg mb-4">Edit Username</h3>
              <input
                className="w-full rounded-xl px-4 py-3 text-white font-bold text-sm outline-none mb-4"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,215,0,0.3)",
                  caretColor: "#FFD700",
                }}
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                maxLength={20}
                autoFocus
              />
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditName(false)}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
                  Cancel
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => { setUsername(tempName.trim() || username); setEditName(false); }}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                  Save
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
