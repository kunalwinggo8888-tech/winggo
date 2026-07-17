/**
 * NotificationsScreen — WINGGO Player App
 * Reads broadcast notifications queued by admin via notificationQueue collection.
 * Admin writes via PageNotifications → queueNotification().
 * Firestore rule: allow read if request.auth != null (fixed in firestore.rules).
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { subscribeNotifications, AppNotification } from "@/firebase/firestore.service";

interface Props {
  onBack?: () => void;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen({ onBack }: Props) {
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeNotifications((list) => {
      setNotifs(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4 shrink-0"
        style={{
          background: "rgba(7,5,15,0.98)",
          borderBottom: "1px solid rgba(255,215,0,0.10)",
          backdropFilter: "blur(12px)",
        }}
      >
        <BackButton onBack={onBack} label="Home" />
        <div className="flex-1">
          <div className="text-white font-black text-lg leading-none">Notifications</div>
          <div className="text-xs mt-0.5" style={{ color: "#666" }}>
            {notifs.length > 0 ? `${notifs.length} messages` : "No new messages"}
          </div>
        </div>
        <span className="text-xl">🔔</span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <motion.div
              className="w-8 h-8 rounded-full border-2"
              style={{ borderColor: "#FFD700", borderTopColor: "transparent" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
            />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading…</span>
          </div>
        )}

        {!loading && notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-4 px-8 text-center">
            <span className="text-5xl">🔕</span>
            <div className="font-black text-white text-lg">No Notifications Yet</div>
            <div className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              You'll see announcements and offers from WINGGO here.
            </div>
          </div>
        )}

        <AnimatePresence>
          {!loading && notifs.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="mx-4 mt-3 p-4 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: n.type === "announcement"
                      ? "rgba(59,130,246,0.15)"
                      : "rgba(255,215,0,0.12)",
                    border: n.type === "announcement"
                      ? "1px solid rgba(59,130,246,0.3)"
                      : "1px solid rgba(255,215,0,0.25)",
                  }}
                >
                  <span className="text-lg">{n.type === "announcement" ? "📢" : "🔔"}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-black text-white truncate">{n.title}</span>
                    <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                    {n.body}
                  </p>
                  {n.imageUrl && (
                    <img
                      src={n.imageUrl}
                      alt=""
                      className="mt-2 rounded-xl w-full object-cover"
                      style={{ maxHeight: 120 }}
                    />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {!loading && notifs.length > 0 && (
          <div className="text-center py-6 text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            — End of notifications —
          </div>
        )}
      </div>
    </motion.div>
  );
}
