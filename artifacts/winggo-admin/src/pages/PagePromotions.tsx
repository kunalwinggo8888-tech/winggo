import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_BANNERS } from "@/data/mockData";
import {
  queueNotification,
  subscribeNotificationHistory,
  NotificationQueueItem,
} from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

type Banner = typeof MOCK_BANNERS[number] & { status: string };

const STATUS_CFG = {
  active:    { label: "Active",    bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  inactive:  { label: "Inactive",  bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" },
  scheduled: { label: "Scheduled", bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
};

const NOTIF_TEMPLATES = [
  { title: "🎉 Bonus Offer", msg: "50% bonus on your next deposit today only! Limited time deal." },
  { title: "⚔️ World War", msg: "World War Tournament starts in 1 hour! Join now and win big." },
  { title: "💰 Instant Withdraw", msg: "Withdraw your winnings instantly — zero processing fees today." },
  { title: "🎲 New Rooms", msg: "New Ludo rooms open! Entry starts at just ₹1. Play and win now." },
  { title: "🎁 Refer Friends", msg: "Refer a friend and earn ₹50 instantly — no limit on referrals!" },
];

const TARGET_OPTIONS: Array<{ value: NotificationQueueItem["target"]; label: string; desc: string }> = [
  { value: "all",       label: "All Users",         desc: "Send to everyone" },
  { value: "active",    label: "Active Last 7 Days", desc: "Re-engage recent users" },
  { value: "deposited", label: "Deposited Users",    desc: "Target paying users" },
];

const NOTIF_STATUS = {
  queued:  { label: "Queued",  bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
  sent:    { label: "Sent",    bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  failed:  { label: "Failed",  bg: "rgba(248,113,113,0.12)", color: "#f87171" },
};

export default function PagePromotions() {
  const [banners, setBanners]   = useState<Banner[]>(MOCK_BANNERS as Banner[]);
  const [notifTitle, setTitle]  = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [target, setTarget]     = useState<NotificationQueueItem["target"]>("all");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [history, setHistory]   = useState<NotificationQueueItem[]>([]);

  useEffect(() => {
    const unsub = subscribeNotificationHistory(setHistory);
    return unsub;
  }, []);

  function toggleStatus(id: number) {
    setBanners(prev => prev.map(b => b.id === id
      ? { ...b, status: b.status === "active" ? "inactive" : "active" }
      : b
    ));
  }

  async function sendNotif() {
    if (!notifMsg.trim() || !notifTitle.trim()) return;
    setSending(true);
    await queueNotification({
      title: notifTitle,
      message: notifMsg,
      target,
      scheduledFor: "now",
      recipientCount: target === "all" ? 74218 : target === "active" ? 12400 : 9200,
    });
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setSending(false);
      setNotifMsg("");
      setTitle("");
    }, 2200);
  }

  return (
    <div className="space-y-5">
      {/* Banner Management */}
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

      {/* Push Notification Composer */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <div className="flex items-center justify-between">
          <h3 className="text-white font-black text-sm">🔔 Push Notification</h3>
          {FIREBASE_ENABLED && (
            <span className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "#34d399" }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              Firebase FCM
            </span>
          )}
        </div>

        {/* Target audience */}
        <div>
          <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Target Audience</p>
          <div className="grid grid-cols-3 gap-2">
            {TARGET_OPTIONS.map((t) => (
              <motion.button key={t.value} whileTap={{ scale: 0.96 }} onClick={() => setTarget(t.value)}
                className="py-2 px-2 rounded-xl text-center cursor-pointer"
                style={{
                  background: target === t.value ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${target === t.value ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <div className="text-[11px] font-black" style={{ color: target === t.value ? "#FFD700" : "rgba(255,255,255,0.5)" }}>{t.label}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{t.desc}</div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Quick templates */}
        <div>
          <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>Quick Templates</p>
          <div className="flex flex-col gap-1.5">
            {NOTIF_TEMPLATES.map((t, i) => (
              <motion.button key={i} whileTap={{ scale: 0.98 }}
                onClick={() => { setTitle(t.title); setNotifMsg(t.msg); }}
                className="text-left px-3 py-2 rounded-xl text-xs cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="font-black text-white">{t.title}</span>
                <span className="ml-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>{t.msg.slice(0, 50)}…</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Notification title */}
        <div>
          <label className="text-[10px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.4)" }}>Notification Title</label>
          <input value={notifTitle} onChange={e => setTitle(e.target.value)}
            placeholder="e.g. 🎉 Special Offer!"
            className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.2)", caretColor: "#FFD700" }}
          />
        </div>

        {/* Notification message */}
        <div>
          <label className="text-[10px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.4)" }}>Message Body</label>
          <textarea rows={3} value={notifMsg} onChange={e => setNotifMsg(e.target.value)}
            placeholder="Type your notification message…"
            className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none resize-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.2)", caretColor: "#FFD700" }}
          />
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={sendNotif}
          disabled={sending || sent}
          className="w-full py-3 rounded-xl font-black text-sm cursor-pointer disabled:opacity-60"
          style={{
            background: sent ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#FFD700,#ff8c00)",
            color: sent ? "#34d399" : "#000",
            border: sent ? "1px solid rgba(52,211,153,0.3)" : "none",
            boxShadow: sent ? "none" : "0 0 20px rgba(255,215,0,0.25)",
          }}>
          {sent ? "✅ Queued — Sending to users!" : sending ? "Queuing…" : `📤 Broadcast to ${target === "all" ? "74,218" : target === "active" ? "12,400" : "9,200"} users`}
        </motion.button>
      </div>

      {/* Notification History */}
      {history.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-3"
            style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.4)" }}>
              📋 Recent Notifications
            </span>
          </div>
          <AnimatePresence>
            {history.map((n, i) => {
              const st = NOTIF_STATUS[n.status as keyof typeof NOTIF_STATUS] ?? NOTIF_STATUS.queued;
              return (
                <motion.div key={n.id ?? i}
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 px-4 py-3"
                  style={{ borderBottom: i < history.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-white truncate">{n.title}</p>
                    <p className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "rgba(255,255,255,0.4)" }}>{n.message}</p>
                    <p className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                      Target: {n.target} · {n.recipientCount?.toLocaleString() ?? "?"} users
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Refer & Earn */}
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
