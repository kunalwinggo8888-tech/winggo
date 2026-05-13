/**
 * PageDashboard — WINGGO Admin (Premium Upgrade)
 * Live Firebase stats + online users, active matches, daily profit, notifications,
 * live activity feed, top winners widget, animated counters.
 */
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import StatCard from "@/components/StatCard";
import { REVENUE_DATA, USER_GROWTH_DATA, GAME_STATS_DATA } from "@/data/mockData";
import { subscribePlatformStats, PlatformStats, subscribeDeposits, DepositRecord } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}
function fmtNum(n: number): string { return n.toLocaleString("en-IN"); }

// Animated counter hook
function useCounter(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (ref.current) clearInterval(ref.current);
    const steps = 40;
    const step  = target / steps;
    let cur     = 0;
    ref.current = setInterval(() => {
      cur = Math.min(cur + step, target);
      setValue(Math.round(cur));
      if (cur >= target && ref.current) clearInterval(ref.current);
    }, duration / steps);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [target, duration]);
  return value;
}

// ─── MOCK LIVE DATA ────────────────────────────────────────────────────────────

const LIVE_ACTIVITY = [
  { user: "Arjun M.",   action: "Won ₹250 in Ludo",            time: "2s",   type: "win"    },
  { user: "Priya P.",   action: "Joined Cricket ₹50 room",      time: "8s",   type: "join"   },
  { user: "Rahul S.",   action: "Deposited ₹500 via UPI",        time: "14s",  type: "deposit"},
  { user: "Amit K.",    action: "Won Tournament — ₹1,200",       time: "28s",  type: "win"    },
  { user: "Vikram S.",  action: "Withdrew ₹800 (Pending)",       time: "42s",  type: "withdraw"},
  { user: "Meera N.",   action: "KYC Submitted",                  time: "1m",   type: "kyc"    },
  { user: "Deepika J.", action: "Joined Ludo ₹10 room",          time: "1m 12s",type: "join"  },
  { user: "Suresh Y.",  action: "Flagged — Multiple accounts",   time: "2m",   type: "alert"  },
];

const NOTIFICATIONS = [
  { type: "error",   msg: "User WG-2041 flagged — 3 devices",           time: "2m"  },
  { type: "warning", msg: "5 withdrawal requests pending approval",       time: "8m"  },
  { type: "info",    msg: "7 new KYC submissions received",               time: "15m" },
  { type: "success", msg: "Tournament #12 complete — ₹25,000 paid",      time: "1h"  },
  { type: "warning", msg: "Carrom bot ratio exceeded 40%",                time: "2h"  },
];

const TOP_WINNERS = [
  { name: "Arjun Menon",   won: 42800, games: 412, avatar: "A", color: "#FFD700" },
  { name: "Rahul Sharma",  won: 28400, games: 289, avatar: "R", color: "#94a3b8" },
  { name: "Amit Kumar",    won: 19200, games: 142, avatar: "A", color: "#fb923c" },
  { name: "Vikram Singh",  won: 12600, games: 98,  avatar: "V", color: "#a78bfa" },
  { name: "Priya Patel",   won: 8400,  games: 67,  avatar: "P", color: "#60a5fa" },
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

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function PageDashboard() {
  const [stats, setStats]       = useState<PlatformStats | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [actIdx, setActIdx]     = useState(0);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<number>>(new Set());

  // Simulated live counters
  const [onlineUsers, setOnlineUsers]     = useState(3841);
  const [activeMatches, setActiveMatches] = useState(312);
  const [dailyProfit, setDailyProfit]     = useState(28400);

  const animatedOnline  = useCounter(onlineUsers);
  const animatedMatches = useCounter(activeMatches);
  const animatedProfit  = useCounter(dailyProfit);

  useEffect(() => { return subscribePlatformStats(setStats); }, []);
  useEffect(() => { return subscribeDeposits((d) => setDeposits(d.slice(0, 8))); }, []);

  // Cycle through live activity feed
  useEffect(() => {
    const t = setInterval(() => setActIdx(i => (i + 1) % LIVE_ACTIVITY.length), 2500);
    return () => clearInterval(t);
  }, []);

  // Simulate live counter drift
  useEffect(() => {
    const t = setInterval(() => {
      setOnlineUsers(n => n + Math.floor(Math.random() * 6) - 2);
      setActiveMatches(n => n + Math.floor(Math.random() * 4) - 1);
      setDailyProfit(n => n + Math.floor(Math.random() * 200));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const s = stats;

  const STAT_CARDS = [
    { icon: "👥", label: "Total Users",         value: s ? fmtNum(s.totalUsers) : "—",           sub: "Platform accounts",                  color: "#7c3aed", glow: "rgba(124,58,237,0.12)" },
    { icon: "💰", label: "Total Wallet",         value: s ? fmt(s.totalWalletBalance) : "—",      sub: s ? `Win ${fmt(s.totalWinningBalance)} · Dep ${fmt(s.totalDepositBalance)}` : "Live", color: "#FFD700", glow: "rgba(255,215,0,0.10)" },
    { icon: "🎁", label: "Total Bonus",          value: s ? fmt(s.totalBonusBalance) : "—",       sub: "Across all wallets",                 color: "#a78bfa", glow: "rgba(167,139,250,0.10)" },
    { icon: "📥", label: "Total Deposits",       value: s ? fmt(s.totalDepositsAmount) : "—",     sub: s ? `${fmtNum(s.totalDepositsCount)} payments` : "—", color: "#34d399", glow: "rgba(52,211,153,0.10)" },
    { icon: "📤", label: "Total Withdrawals",    value: s ? fmt(s.totalWithdrawalsAmount) : "—",  sub: s ? `${fmtNum(s.totalWithdrawalsCount)} approved` : "—", color: "#f472b6" },
    { icon: "⏳", label: "Pending Withdrawals",  value: s ? fmtNum(s.pendingWithdrawals) : "—",   sub: s ? `${fmt(s.pendingWithdrawalsAmount)} awaiting` : "—", color: "#f59e0b" },
    { icon: "🪪", label: "KYC Pending",          value: s ? fmtNum(s.pendingKYC) : "—",           sub: "Needs review",                       color: "#fb923c" },
    { icon: "💳", label: "Today Deposits",       value: s ? fmt(s.depositsTodayAmount) : "—",     sub: s ? `${fmtNum(s.depositsTodayCount)} txns` : "—", color: "#60a5fa", glow: "rgba(96,165,250,0.10)" },
  ];

  return (
    <div className="space-y-5">
      {/* Firebase status */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
          style={{ background: FIREBASE_ENABLED ? "rgba(52,211,153,0.06)" : "rgba(245,158,11,0.06)", border: `1px solid ${FIREBASE_ENABLED ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.2)"}`, color: FIREBASE_ENABLED ? "#34d399" : "#f59e0b" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full"
            style={{ background: FIREBASE_ENABLED ? "#34d399" : "#f59e0b" }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
          {FIREBASE_ENABLED ? "🔥 Live Firebase — real-time data" : "⚠️ Demo mode — Firebase not configured"}
        </div>
        <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.25)" }}>
          Last updated just now
        </span>
      </div>

      {/* Live counters row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Online users */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, rgba(52,211,153,0.07), rgba(52,211,153,0.02))", border: "1px solid rgba(52,211,153,0.2)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(52,211,153,0.12)" }}>
            🟢
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(52,211,153,0.7)" }}>Online Now</p>
            <motion.p className="text-3xl font-black" style={{ color: "#34d399" }}>
              {animatedOnline.toLocaleString("en-IN")}
            </motion.p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Users active right now</p>
          </div>
          <motion.div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: "#34d399" }}
            animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        </motion.div>

        {/* Active matches */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, rgba(248,113,113,0.07), rgba(248,113,113,0.02))", border: "1px solid rgba(248,113,113,0.2)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(248,113,113,0.12)" }}>
            🎮
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(248,113,113,0.7)" }}>Active Matches</p>
            <motion.p className="text-3xl font-black" style={{ color: "#f87171" }}>
              {animatedMatches.toLocaleString("en-IN")}
            </motion.p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Games in progress</p>
          </div>
          <motion.div className="ml-auto w-2 h-2 rounded-full shrink-0" style={{ background: "#f87171" }}
            animate={{ scale: [1, 1.6, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
        </motion.div>

        {/* Daily profit */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.07), rgba(255,215,0,0.02))", border: "1px solid rgba(255,215,0,0.2)" }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: "rgba(255,215,0,0.10)" }}>
            💹
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(255,215,0,0.7)" }}>Daily Profit</p>
            <motion.p className="text-3xl font-black" style={{ color: "#FFD700" }}>
              ₹{animatedProfit.toLocaleString("en-IN")}
            </motion.p>
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Today's net revenue</p>
          </div>
          <span className="ml-auto text-xs font-black shrink-0" style={{ color: "#34d399" }}>↑ 12%</span>
        </motion.div>
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS.map((sc, i) => (
          <StatCard key={sc.label} {...sc} delay={i * 0.05} />
        ))}
      </div>

      {/* Notifications panel */}
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
                const cfg = NOTIF_CFG[n.type as keyof typeof NOTIF_CFG];
                return (
                  <motion.div key={i} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}>
                    <span className="text-base shrink-0">{cfg.icon}</span>
                    <p className="text-xs flex-1 text-white">{n.msg}</p>
                    <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{n.time}</span>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setDismissedNotifs(prev => new Set([...prev, i]))}
                      className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer text-[10px] shrink-0"
                      style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>✕</motion.button>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revenue chart + Live activity + Recent deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
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
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
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
                actIdx + 5 > LIVE_ACTIVITY.length ? LIVE_ACTIVITY.slice(0, (actIdx + 5) % LIVE_ACTIVITY.length) : []
              ).map((a, i) => {
                const cfg = ACT_CFG[a.type as keyof typeof ACT_CFG];
                return (
                  <motion.div key={`${actIdx}-${i}`}
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3, delay: i * 0.05 }}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-xl"
                    style={{ background: `${cfg.color}0e`, border: `1px solid ${cfg.color}18` }}>
                    <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold" style={{ color: cfg.color }}>{a.user}</p>
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

      {/* User growth + Game share + Top Winners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* User growth */}
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

        {/* Game share */}
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

        {/* Top winners */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-3">🏆 Top Winners</h3>
          <div className="space-y-2">
            {TOP_WINNERS.map((w, i) => (
              <motion.div key={w.name} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}
                className="flex items-center gap-2.5">
                <span className="text-xs font-black w-5 text-center shrink-0"
                  style={{ color: w.color }}>
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

      {/* Recent deposits + Wallet breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent deposits */}
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
                <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>No deposits yet</p>
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
                    <span className="text-xs font-black shrink-0" style={{ color: "#34d399" }}>+₹{d.amount.toLocaleString("en-IN")}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Wallet breakdown */}
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
                      initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: "easeOut" }} />
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
