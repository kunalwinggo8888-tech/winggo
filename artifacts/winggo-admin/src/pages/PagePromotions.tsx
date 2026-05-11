import { useState } from "react";
import { motion } from "framer-motion";
import { MOCK_BANNERS } from "@/data/mockData";

type Banner = typeof MOCK_BANNERS[number] & { status: string };

const STATUS_CFG = {
  active:    { label: "Active",    bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  inactive:  { label: "Inactive",  bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" },
  scheduled: { label: "Scheduled", bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
};

const NOTIF_TEMPLATES = [
  "🎉 Diwali Special: 50% bonus on first deposit today!",
  "⚔️ World War Tournament starts in 1 hour! Join now.",
  "💰 Withdraw your winnings instantly — 0 fees today!",
  "🎲 New Ludo rooms open — Entry starts at ₹1 only.",
  "🎁 Refer a friend and earn ₹50 instantly!",
];

export default function PagePromotions() {
  const [banners, setBanners] = useState<Banner[]>(MOCK_BANNERS as Banner[]);
  const [notifMsg, setNotifMsg] = useState("");
  const [sent, setSent] = useState(false);

  function toggleStatus(id: number) {
    setBanners(prev => prev.map(b => b.id === id
      ? { ...b, status: b.status === "active" ? "inactive" : "active" }
      : b
    ));
  }

  function sendNotif() {
    if (!notifMsg.trim()) return;
    setSent(true);
    setTimeout(() => { setSent(false); setNotifMsg(""); }, 2000);
  }

  return (
    <div className="space-y-5">
      {/* Banners */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,215,0,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(255,215,0,0.6)" }}>
            📢 Banner Management
          </span>
          <motion.button whileTap={{ scale: 0.95 }}
            className="px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
            + Add Banner
          </motion.button>
        </div>

        {banners.map((b, i) => {
          const cfg = STATUS_CFG[b.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.inactive;
          return (
            <div key={b.id} className="flex items-center gap-3 px-4 py-3"
              style={{
                background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                borderBottom: i < banners.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                {b.type === "Popup" ? "💬" : b.type === "Daily Banner" ? "🌟" : "🖼️"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white">{b.title}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {b.type} · {b.views.toLocaleString()} views · {b.clicks.toLocaleString()} clicks · CTR: {b.ctr}
                </p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>
              <motion.div whileTap={{ scale: 0.9 }} onClick={() => toggleStatus(b.id)}
                className="w-9 h-5 rounded-full relative cursor-pointer shrink-0"
                style={{ background: b.status === "active" ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)", border: `1px solid ${b.status === "active" ? "#34d399" : "rgba(255,255,255,0.15)"}` }}>
                <motion.div animate={{ x: b.status === "active" ? 16 : 2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute top-[3px] w-3 h-3 rounded-full"
                  style={{ background: b.status === "active" ? "#34d399" : "rgba(255,255,255,0.35)" }} />
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Push notification panel */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">🔔 Send Push Notification</h3>

        {/* Templates */}
        <div className="mb-3">
          <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>Quick Templates</p>
          <div className="flex flex-col gap-1.5">
            {NOTIF_TEMPLATES.map((t, i) => (
              <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => setNotifMsg(t)}
                className="text-left px-3 py-2 rounded-xl text-xs cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
                {t}
              </motion.button>
            ))}
          </div>
        </div>

        <textarea
          rows={3} value={notifMsg} onChange={e => setNotifMsg(e.target.value)}
          placeholder="Type your notification message…"
          className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none resize-none mb-3"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.2)", caretColor: "#FFD700" }}
        />

        <div className="flex gap-2">
          <motion.button whileTap={{ scale: 0.97 }} onClick={sendNotif}
            className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
            style={{
              background: sent ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#FFD700,#ff8c00)",
              color: sent ? "#34d399" : "#000",
              border: sent ? "1px solid rgba(52,211,153,0.3)" : "none",
            }}>
            {sent ? "✅ Sent to 74,218 users!" : "📤 Broadcast to All Users"}
          </motion.button>
        </div>
      </div>

      {/* Refer & Earn settings */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">🎁 Refer & Earn Settings</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Referral Bonus (Referrer)", value: "₹50" },
            { label: "Join Bonus (New User)", value: "₹50" },
            { label: "Max Referrals per User", value: "Unlimited" },
            { label: "Bonus Valid For", value: "30 days" },
          ].map(r => (
            <div key={r.label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
              <div className="text-sm font-black text-white mt-0.5">{r.value}</div>
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.97 }}
          className="mt-3 w-full py-2.5 rounded-xl font-black text-xs cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.09)" }}>
          ✏️ Edit Reward Settings
        </motion.button>
      </div>
    </div>
  );
}
