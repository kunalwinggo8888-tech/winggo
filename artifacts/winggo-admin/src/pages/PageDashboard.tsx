/**
 * PageDashboard — WINGGO Admin (Firebase Live Edition)
 * Online Users   → RTDB presence/{uid}  (written by player app on login)
 * Active Matches → RTDB game rooms      (ludo/worldwar/metroSurfer/cricket/snakes)
 * Daily Profit   → Firestore deposits - withdrawals (via subscribePlatformStats)
 * Most Played    → game with highest active match count from RTDB
 */
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import StatCard from "@/components/StatCard";
import { REVENUE_DATA, USER_GROWTH_DATA, GAME_STATS_DATA } from "@/data/mockData";
import {
  subscribePlatformStats, PlatformStats,
  subscribeDeposits, DepositRecord,
  subscribeOnlineUsers,
  subscribeActiveMatches, ActiveMatchInfo,
} from "@/firebase/admin.service";
import { FIREBASE_ENABLED, adminRtdb } from "@/firebase/config";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtNum(n: number): string { return n.toLocaleString("en-IN"); }

/** Animated count-up hook — re-triggers whenever target changes */
function useCounter(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (ref.current) clearInterval(ref.current);
    const steps = 36;
    const from  = value;
    let step    = 0;
    ref.current = setInterval(() => {
      step++;
      const pct = step / steps;
      const ease = 1 - Math.pow(1 - pct, 3); // cubic ease-out
      setValue(Math.round(from + (target - from) * ease));
      if (step >= steps && ref.current) { clearInterval(ref.current); setValue(target); }
    }, duration / steps);
    return () => { if (ref.current) clearInterval(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return value;
}

// ─── SKELETON SHIMMER ─────────────────────────────────────────────────────────

function Shimmer({ w = "60%", h = "h-8" }: { w?: string; h?: string }) {
  return (
    <motion.div
      className={`rounded-lg ${h}`}
      style={{ width: w, background: "linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%)", backgroundSize: "200% 100%" }}
      animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ─── FIREBASE STATUS ──────────────────────────────────────────────────────────

/** Whether RTDB is available (databaseURL was provided) */
const RTDB_ENABLED = FIREBASE_ENABLED && Boolean(adminRtdb);

type FirebaseStatus = "checking" | "live" | "partial" | "demo";

function getFirebaseStatus(): FirebaseStatus {
  if (!FIREBASE_ENABLED) return "demo";
  if (RTDB_ENABLED) return "live";
  return "partial";
}

const STATUS_CFG = {
  checking: { dot: "#f59e0b", bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.25)", text: "#f59e0b", label: "⏳ Connecting to Firebase…" },
  live:     { dot: "#34d399", bg: "rgba(52,211,153,0.06)",  border: "rgba(52,211,153,0.22)",  text: "#34d399", label: "🔥 Firebase Live — Firestore + RTDB connected" },
  partial:  { dot: "#f59e0b", bg: "rgba(245,158,11,0.06)",  border: "rgba(245,158,11,0.22)",  text: "#f59e0b", label: "⚠️ Partial — Firestore OK, RTDB URL missing (set VITE_FIREBASE_DATABASE_URL)" },
  demo:     { dot: "#ef4444", bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.22)",   text: "#ef4444", label: "🔴 Demo mode — Firebase not configured (set VITE_FIREBASE_* secrets)" },
};

// ─── MOCK LIVE DATA ────────────────────────────────────────────────────────────

const LIVE_ACTIVITY = [
  { user: "Arjun M.",   action: "Won ₹250 in Ludo",          time: "2s",    type: "win"     },
  { user: "Priya P.",   action: "Joined Cricket ₹50 room",    time: "8s",    type: "join"    },
  { user: "Rahul S.",   action: "Deposited ₹500 via UPI",     time: "14s",   type: "deposit" },
  { user: "Amit K.",    action: "Won Tournament — ₹1,200",    time: "28s",   type: "win"     },
  { user: "Vikram S.",  action: "Withdrew ₹800 (Pending)",    time: "42s",   type: "withdraw"},
  { user: "Meera N.",   action: "KYC Submitted",               time: "1m",    type: "kyc"     },
  { user: "Deepika J.", action: "Joined Ludo ₹10 room",       time: "1m 12s",type: "join"    },
  { user: "Suresh Y.",  action: "Flagged — Multiple accounts",time: "2m",    type: "alert"   },
];

const NOTIFICATIONS = [
  { type: "error",   msg: "User WG-2041 flagged — 3 devices",         time: "2m"  },
  { type: "warning", msg: "5 withdrawal requests pending approval",     time: "8m"  },
  { type: "info",    msg: "7 new KYC submissions received",             time: "15m" },
  { type: "success", msg: "Tournament #12 complete — ₹25,000 paid",   time: "1h"  },
  { type: "warning", msg: "Carrom bot ratio exceeded 40%",              time: "2h"  },
];

const TOP_WINNERS = [
  { name: "Arjun Menon",  won: 42800, games: 412, avatar: "A", color: "#FFD700" },
  { name: "Rahul Sharma", won: 28400, games: 289, avatar: "R", color: "#94a3b8" },
  { name: "Amit Kumar",   won: 19200, games: 142, avatar: "A", color: "#fb923c" },
  { name: "Vikram Singh", won: 12600, games: 98,  avatar: "V", color: "#a78bfa" },
  { name: "Priya Patel",  won: 8400,  games: 67,  avatar: "P", color: "#60a5fa" },
];

const NOTIF_CFG = {
  error:   { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   icon: "🔴" },
  warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  icon: "⚠️" },
  info:    { color: "#60a5fa", bg: "rgba(96,165,250,0.08)",  icon: "ℹ️" },
  success: { color: "#34d399", bg: "rgba(52,211,153,0.08)",  icon: "✅" },
};

const ACT_CFG = {
  win:      { color: "#FFD700", icon: "🏆" },
  join:     { color: "#34d399", icon: "🎮" },
  deposit:  { color: "#60a5fa", icon: "💳" },
  withdraw: { color: "#f59e0b", icon: "💸" },
  kyc:      { color: "#a78bfa", icon: "🪪" },
  alert:    { color: "#ef4444", icon: "🚨" },
};

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)" }}>
      <p className="text-xs font-bold text-white mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-xs" style={{ color: p.color }}>
          {p.name}: ₹{p.value?.toLocaleString("en-IN")}
        </p>
      ))}
    </div>
  );
};

// ─── LIVE COUNTER CARD ────────────────────────────────────────────────────────

interface LiveCounterCardProps {
  icon: string;
  label: string;
  value: number;
  sub: string;
  color: string;
  glow: string;
  pulse?: boolean;
  suffix?: string;
  prefix?: string;
  badge?: string;
  delay?: number;
  isLive: boolean;
}

function LiveCounterCard({
  icon, label, value, sub, color, glow, pulse = true,
  prefix = "", suffix = "", badge, delay = 0, isLive,
}: LiveCounterCardProps) {
  const animated = useCounter(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${glow}, rgba(0,0,0,0))`, border: `1px solid ${color}30` }}
    >
      {/* Ambient glow */}
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl pointer-events-none"
        style={{ background: `${color}20` }} />

      <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
        style={{ background: `${color}18` }}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: `${color}b0` }}>{label}</p>
          {badge && (
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
              style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
              {badge}
            </span>
          )}
        </div>
        <motion.p className="text-3xl font-black tabular-nums" style={{ color }}>
          {prefix}{animated.toLocaleString("en-IN")}{suffix}
        </motion.p>
        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</p>
      </div>

      <div className="flex flex-col items-center gap-2 shrink-0">
        {pulse && (
          <motion.div className="w-2.5 h-2.5 rounded-full"
            style={{ background: color }}
            animate={{ scale: [1, 1.7, 1], opacity: [1, 0.4, 1] }}
            transition={{ duration: 2, repeat: Infinity }} />
        )}
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{
            background: isLive ? "rgba(52,211,153,0.10)" : "rgba(245,158,11,0.10)",
            color: isLive ? "#34d399" : "#f59e0b",
            border: `1px solid ${isLive ? "rgba(52,211,153,0.25)" : "rgba(245,158,11,0.25)"}`,
          }}>
          {isLive ? "LIVE" : "DEMO"}
        </span>
      </div>
    </motion.div>
  );
}

// ─── MOST PLAYED GAME WIDGET ──────────────────────────────────────────────────

function MostPlayedWidget({ matchInfo }: { matchInfo: ActiveMatchInfo }) {
  if (!RTDB_ENABLED) return null;

  const mp = matchInfo.mostPlayed;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.06), rgba(124,58,237,0.04))", border: "1px solid rgba(255,215,0,0.18)" }}
    >
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: "rgba(255,215,0,0.6)" }}>
          🏆 Most Played
        </span>
      </div>

      {mp && mp.count > 0 ? (
        <div className="flex items-center gap-3 flex-1">
          <motion.span
            className="text-3xl"
            animate={{ scale: [1, 1.12, 1] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            {mp.emoji}
          </motion.span>
          <div>
            <p className="text-base font-black text-white">{mp.name}</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{mp.count} active rooms</p>
          </div>
          <div className="ml-auto flex gap-1.5 flex-wrap justify-end">
            {matchInfo && Object.values(matchInfo.byGame)
              .filter(g => g.count > 0)
              .sort((a, b) => b.count - a.count)
              .map((g) => (
                <span key={g.name} className="text-[10px] font-black px-2 py-1 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {g.emoji} {g.count}
                </span>
              ))
            }
          </div>
        </div>
      ) : (
        <p className="text-xs flex-1" style={{ color: "rgba(255,255,255,0.3)" }}>
          No active game rooms right now
        </p>
      )}

      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0"
        style={{ background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
        RTDB LIVE
      </span>
    </motion.div>
  );
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function PageDashboard() {
  const [stats, setStats]               = useState<PlatformStats | null>(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState<number>(0);
  const [deposits, setDeposits]         = useState<DepositRecord[]>([]);
  const [actIdx, setActIdx]             = useState(0);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<number>>(new Set());
  const [fbStatus, setFbStatus]         = useState<FirebaseStatus>("checking");

  // Real Firebase live counters — always start at 0, animate up when Firebase responds
  const [onlineUsers, setOnlineUsers]   = useState(0);
  const [matchInfo, setMatchInfo]       = useState<ActiveMatchInfo>({ totalActive: 0, byGame: {}, mostPlayed: null });

  // Derived: daily profit comes from stats (Firestore) — 0 until first Firestore emit
  const dailyProfit = stats?.dailyProfit ?? 0;

  // Wire all Firebase subscriptions
  useEffect(() => {
    setFbStatus("checking");
    const timer = setTimeout(() => setFbStatus(getFirebaseStatus()), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const unsub = subscribePlatformStats((s) => {
      setStats(s);
      setStatsUpdatedAt(Date.now());
      if (fbStatus === "checking") setFbStatus(getFirebaseStatus());
    });
    return unsub;
  }, [fbStatus]);

  useEffect(() => {
    return subscribeDeposits((d) => setDeposits(d.slice(0, 8)));
  }, []);

  // Online users — RTDB presence
  useEffect(() => {
    const unsub = subscribeOnlineUsers((count) => setOnlineUsers(count));
    return unsub;
  }, []);

  // Active matches + most played game — RTDB game rooms
  useEffect(() => {
    const unsub = subscribeActiveMatches((info) => setMatchInfo(info));
    return unsub;
  }, []);

  // Cycle live activity feed
  useEffect(() => {
    const t = setInterval(() => setActIdx((i) => (i + 1) % LIVE_ACTIVITY.length), 2500);
    return () => clearInterval(t);
  }, []);

  const s = stats;
  const isLive = FIREBASE_ENABLED;
  const lu = statsUpdatedAt || undefined;

  const STAT_CARDS = [
    {
      icon: "👥", label: "Total Users",
      value: fmtNum(s?.totalUsers ?? 0),
      sub: `${fmtNum(s?.totalUsers ?? 0)} registered accounts`,
      color: "#7c3aed", glow: "rgba(124,58,237,0.12)",
    },
    {
      icon: "💰", label: "Total Wallet",
      value: fmt(s?.totalWalletBalance ?? 0),
      sub: `Win ${fmt(s?.totalWinningBalance ?? 0)} · Dep ${fmt(s?.totalDepositBalance ?? 0)}`,
      color: "#FFD700", glow: "rgba(255,215,0,0.10)",
    },
    {
      icon: "🎁", label: "Total Bonus",
      value: fmt(s?.totalBonusBalance ?? 0),
      sub: "Across all wallets",
      color: "#a78bfa", glow: "rgba(167,139,250,0.10)",
    },
    {
      icon: "📥", label: "Total Deposits",
      value: fmt(s?.totalDepositsAmount ?? 0),
      sub: `${fmtNum(s?.totalDepositsCount ?? 0)} successful payments`,
      color: "#34d399", glow: "rgba(52,211,153,0.10)",
    },
    {
      icon: "📤", label: "Total Withdrawals",
      value: fmt(s?.totalWithdrawalsAmount ?? 0),
      sub: `${fmtNum(s?.totalWithdrawalsCount ?? 0)} approved`,
      color: "#f472b6",
    },
    {
      icon: "⏳", label: "Pending Withdraw",
      value: fmtNum(s?.pendingWithdrawals ?? 0),
      sub: `${fmt(s?.pendingWithdrawalsAmount ?? 0)} awaiting approval`,
      color: "#f59e0b",
    },
    {
      icon: "🪪", label: "KYC Pending",
      value: fmtNum(s?.pendingKYC ?? 0),
      sub: "Documents need review",
      color: "#fb923c",
    },
    {
      icon: "💳", label: "Today Deposits",
      value: fmt(s?.depositsTodayAmount ?? 0),
      sub: `${fmtNum(s?.depositsTodayCount ?? 0)} transactions today`,
      color: "#60a5fa", glow: "rgba(96,165,250,0.10)",
    },
  ];

  const cfg = STATUS_CFG[fbStatus];

  return (
    <div className="space-y-5">

      {/* ── Firebase connection status banner ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 rounded-2xl flex-wrap"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <motion.div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: cfg.dot }}
          animate={fbStatus === "checking" || fbStatus === "live"
            ? { opacity: [1, 0.25, 1] }
            : { opacity: 1 }}
          transition={{ duration: 1.4, repeat: Infinity }}
        />
        <span className="text-xs font-bold" style={{ color: cfg.text }}>{cfg.label}</span>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {FIREBASE_ENABLED && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
              Firestore ✓
            </span>
          )}
          {RTDB_ENABLED && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: "rgba(96,165,250,0.10)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
              RTDB ✓
            </span>
          )}
          {!FIREBASE_ENABLED && (
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Set VITE_FIREBASE_* in Replit Secrets to enable live data
            </span>
          )}
        </div>
      </motion.div>

      {/* ── Three live counter cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <LiveCounterCard
          icon="🟢" label="Online Now"
          value={onlineUsers}
          sub={onlineUsers === 0 ? "No users online right now" : "Users active in real-time"}
          color="#34d399" glow="rgba(52,211,153,0.07)"
          badge="PRESENCE" delay={0.05} isLive={isLive}
        />
        <LiveCounterCard
          icon="🎮" label="Active Matches"
          value={matchInfo.totalActive}
          sub={matchInfo.totalActive === 0 ? "No games in progress" : "Live game rooms across all games"}
          color="#f87171" glow="rgba(248,113,113,0.07)"
          badge="RTDB" delay={0.1} isLive={isLive && RTDB_ENABLED}
        />
        <LiveCounterCard
          icon="💹" label="Daily Profit"
          value={dailyProfit}
          sub={`Deposits: ${fmt(s?.depositsTodayAmount ?? 0)} − Withdrawals: ${fmt(s?.withdrawalsTodayAmount ?? 0)}`}
          color="#FFD700" glow="rgba(255,215,0,0.07)"
          prefix="₹" badge="LIVE" delay={0.15} isLive={isLive}
        />
      </div>

      {/* ── Most Played Game (RTDB) ──────────────────────────────────────────── */}
      <MostPlayedWidget matchInfo={matchInfo} />

      {/* ── Platform stat cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS.map((sc, i) => (
          <StatCard
            key={sc.label}
            {...sc}
            delay={i * 0.05}
            isLive={isLive}
            lastUpdated={lu}
          />
        ))}
      </div>

      {/* ── Notifications panel ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {NOTIFICATIONS.filter((_, i) => !dismissedNotifs.has(i)).length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-black text-sm">🔔 Notifications</h3>
              <motion.button whileTap={{ scale: 0.93 }}
                onClick={() => setDismissedNotifs(new Set([0, 1, 2, 3, 4]))}
                className="text-[10px] font-black px-2.5 py-1 rounded-lg cursor-pointer"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                Clear All
              </motion.button>
            </div>
            <div className="space-y-2">
              {NOTIFICATIONS.map((n, i) => {
                if (dismissedNotifs.has(i)) return null;
                const notifCfg = NOTIF_CFG[n.type as keyof typeof NOTIF_CFG];
                return (
                  <motion.div key={i} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: notifCfg.bg, border: `1px solid ${notifCfg.color}22` }}>
                    <span className="text-base shrink-0">{notifCfg.icon}</span>
                    <p className="text-xs flex-1 text-white">{n.msg}</p>
                    <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{n.time}</span>
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => setDismissedNotifs((prev) => new Set([...prev, i]))}
                      className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer text-[10px] shrink-0"
                      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                      ✕
                    </motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Revenue chart + Live activity ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-black text-sm">Revenue Overview</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Deposits vs Withdrawals — 7 days</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold"
              style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>Weekly</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FFD700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="deposits"    name="Deposits"    stroke="#FFD700" strokeWidth={2} fill="url(#gDep)" />
              <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="#7c3aed" strokeWidth={2} fill="url(#gWit)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Live activity ticker */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 flex flex-col"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-3">
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#ef4444" }}
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <h3 className="text-white font-black text-sm">Live Activity</h3>
          </div>
          <div className="flex-1 overflow-hidden space-y-2 relative">
            <AnimatePresence mode="popLayout">
              {LIVE_ACTIVITY.slice(actIdx, actIdx + 5).concat(
                actIdx + 5 > LIVE_ACTIVITY.length
                  ? LIVE_ACTIVITY.slice(0, (actIdx + 5) % LIVE_ACTIVITY.length)
                  : []
              ).map((a, i) => {
                const actCfg = ACT_CFG[a.type as keyof typeof ACT_CFG];
                return (
                  <motion.div key={`${actIdx}-${i}`}
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-xl"
                    style={{ background: `${actCfg.color}0e`, border: `1px solid ${actCfg.color}18` }}>
                    <span className="text-base shrink-0 mt-0.5">{actCfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold" style={{ color: actCfg.color }}>{a.user}</p>
                      <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.5)" }}>{a.action}</p>
                    </div>
                    <span className="text-[9px] shrink-0 mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{a.time}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>

      {/* ── User growth + Game share + Top Winners ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">👥 User Growth</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={USER_GROWTH_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip contentStyle={{ background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, fontSize: 11 }}
                labelStyle={{ color: "#fff" }} itemStyle={{ color: "#FFD700" }}
                formatter={(v: number) => [`${v.toLocaleString()}`, "Users"]} />
              <Bar dataKey="users" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-3">🎮 Game Share</h3>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={GAME_STATS_DATA} cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={3} dataKey="value">
                  {GAME_STATS_DATA.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-2 flex-1">
              {GAME_STATS_DATA.map((g) => (
                <div key={g.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
                  <span className="text-[11px] flex-1 truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{g.name}</span>
                  <span className="text-[11px] font-black" style={{ color: g.color }}>{g.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-3">🏆 Top Winners</h3>
          <div className="space-y-2">
            {TOP_WINNERS.map((w, i) => (
              <motion.div key={w.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                className="flex items-center gap-2.5">
                <span className="text-xs font-black w-5 text-center shrink-0" style={{ color: w.color }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{ background: `${w.color}25`, color: w.color }}>
                  {w.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">{w.name}</p>
                  <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{w.games} games</p>
                </div>
                <span className="text-xs font-black shrink-0" style={{ color: "#34d399" }}>
                  ₹{(w.won / 1000).toFixed(1)}K
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── Recent deposits + Wallet breakdown ───────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="rounded-2xl p-5 flex flex-col"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-black text-sm">💳 Recent Deposits</h3>
            {FIREBASE_ENABLED && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>LIVE</span>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            <AnimatePresence>
              {deposits.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {FIREBASE_ENABLED ? "No deposits yet" : "Demo mode — connect Firebase to see deposits"}
                </p>
              ) : deposits.map((d, i) => {
                const ts = typeof d.createdAt === "number"
                  ? new Date(d.createdAt)
                  : new Date((d.createdAt as { seconds: number }).seconds * 1000);
                return (
                  <motion.div key={d.id ?? i}
                    initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(52,211,153,0.04)", border: "1px solid rgba(52,211,153,0.1)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 font-black"
                      style={{ background: "rgba(52,211,153,0.12)", color: "#34d399" }}>
                      {d.displayName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">{d.displayName || d.email}</p>
                      <p className="text-[9px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {ts.toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span className="text-xs font-black shrink-0" style={{ color: "#34d399" }}>
                      +₹{d.amount.toLocaleString("en-IN")}
                    </span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">💰 Live Wallet Breakdown</h3>
          <div className="space-y-3.5">
            {[
              { label: "Winning Balance", value: s?.totalWinningBalance ?? 0, color: "#34d399", icon: "🏆" },
              { label: "Deposit Balance", value: s?.totalDepositBalance ?? 0, color: "#60a5fa", icon: "💳" },
              { label: "Bonus Balance",   value: s?.totalBonusBalance   ?? 0, color: "#FFD700", icon: "🎁" },
            ].map((row) => {
              const total = s?.totalWalletBalance || 1;
              const pct   = Math.min(100, Math.round((row.value / total) * 100));
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {row.icon} {row.label}
                    </span>
                    <span className="text-xs font-black" style={{ color: row.color }}>{fmt(row.value)}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div className="h-full rounded-full" style={{ background: row.color }}
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.9, ease: "easeOut" }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-3 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.5)" }}>Total Platform Wallet</span>
              <span className="text-sm font-black" style={{ color: "#FFD700" }}>{fmt(s?.totalWalletBalance ?? 0)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
