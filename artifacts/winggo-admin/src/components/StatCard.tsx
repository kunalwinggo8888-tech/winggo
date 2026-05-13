import { motion } from "framer-motion";
import { useState, useEffect } from "react";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  glow?: string;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
  /** True when data is live from Firebase */
  isLive?: boolean;
  /** Unix ms timestamp of last Firestore/RTDB emit — drives "synced X ago" */
  lastUpdated?: number;
}

// ─── HOOK: relative "X ago" label, refreshed every 5 s ────────────────────

function useSyncedAgo(ts: number | undefined): string {
  const compute = () => {
    if (!ts) return "";
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 5)    return "Just now";
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const [label, setLabel] = useState(compute);

  useEffect(() => {
    if (!ts) return;
    setLabel(compute());
    const t = setInterval(() => setLabel(compute()), 5000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ts]);

  return label;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function StatCard({
  icon, label, value, sub, color, glow,
  trend, trendUp, delay = 0,
  isLive = false, lastUpdated,
}: StatCardProps) {
  const syncedAgo = useSyncedAgo(lastUpdated);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-2xl p-4 relative overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}22`,
        boxShadow: glow ? `0 0 24px ${glow}` : undefined,
      }}
    >
      {/* Radial glow corner */}
      <div
        className="absolute top-0 right-0 w-20 h-20 rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${color}18 0%, transparent 70%)`,
          transform: "translate(30%,-30%)",
        }}
      />

      {/* Header row — icon + trend badge */}
      <div className="flex items-start justify-between mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        {trend && (
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded-full"
            style={{
              background: trendUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
              color:      trendUp ? "#34d399"               : "#f87171",
            }}
          >
            {trendUp ? "↑" : "↓"} {trend}
          </span>
        )}
      </div>

      {/* Value + label + sub */}
      <div className="flex-1">
        <div className="text-2xl font-black text-white leading-none mb-1">{value}</div>
        <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{label}</div>
        {sub && (
          <div className="text-[10px] mt-0.5 leading-tight" style={{ color: "rgba(255,255,255,0.28)" }}>
            {sub}
          </div>
        )}
      </div>

      {/* ── Sync status strip ─────────────────────────────────────────────── */}
      <div
        className="mt-3 pt-2 flex items-center gap-1.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        {isLive ? (
          <>
            <motion.div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: "#34d399" }}
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1.6, repeat: Infinity }}
            />
            <span className="text-[9px] font-black tracking-wider" style={{ color: "#34d399" }}>
              LIVE
            </span>
            {syncedAgo && (
              <span className="text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.22)" }}>
                {syncedAgo}
              </span>
            )}
          </>
        ) : (
          <>
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#f59e0b" }} />
            <span className="text-[9px] font-black tracking-wider" style={{ color: "#f59e0b" }}>
              DEMO
            </span>
            <span className="text-[9px] ml-auto" style={{ color: "rgba(255,255,255,0.2)" }}>
              Sample data
            </span>
          </>
        )}
      </div>
    </motion.div>
  );
}
