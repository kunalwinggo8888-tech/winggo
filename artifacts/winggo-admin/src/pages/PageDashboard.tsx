/**
 * PageDashboard — WINGGO Admin
 * All stat cards connect to real Firebase data via subscribePlatformStats.
 * Charts show historical mock data (full analytics needs a separate aggregation pipeline).
 */
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import StatCard from "@/components/StatCard";
import { REVENUE_DATA, USER_GROWTH_DATA, GAME_STATS_DATA } from "@/data/mockData";
import { subscribePlatformStats, PlatformStats, subscribeDeposits, DepositRecord } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

function fmt(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtNum(n: number): string {
  return n.toLocaleString("en-IN");
}

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
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

export default function PageDashboard() {
  const [stats, setStats]     = useState<PlatformStats | null>(null);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [tick, setTick]       = useState(0);

  // Live platform stats from Firebase
  useEffect(() => {
    return subscribePlatformStats(setStats);
  }, []);

  // Recent deposits feed
  useEffect(() => {
    return subscribeDeposits((deps) => setDeposits(deps.slice(0, 8)));
  }, []);

  // Clock tick for "last updated" display
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const s = stats;

  // Build stat card definitions from live data
  const STAT_CARDS = [
    {
      icon: "👥", label: "Total Users",
      value: s ? fmtNum(s.totalUsers) : "—",
      sub: FIREBASE_ENABLED ? "Live count" : "Demo",
      color: "#7c3aed", glow: "rgba(124,58,237,0.12)",
    },
    {
      icon: "💰", label: "Total Wallet Balance",
      value: s ? fmt(s.totalWalletBalance) : "—",
      sub: s ? `Win ₹${fmtNum(s.totalWinningBalance)} · Dep ₹${fmtNum(s.totalDepositBalance)}` : "Live",
      color: "#FFD700", glow: "rgba(255,215,0,0.10)",
    },
    {
      icon: "🎁", label: "Total Bonus Balance",
      value: s ? fmt(s.totalBonusBalance) : "—",
      sub: "Across all wallets",
      color: "#a78bfa", glow: "rgba(167,139,250,0.10)",
    },
    {
      icon: "📥", label: "Total Deposits",
      value: s ? fmt(s.totalDepositsAmount) : "—",
      sub: s ? `${fmtNum(s.totalDepositsCount)} payments · +${fmt(s.depositsTodayAmount)} today` : "—",
      color: "#34d399", glow: "rgba(52,211,153,0.10)",
    },
    {
      icon: "📤", label: "Total Withdrawals",
      value: s ? fmt(s.totalWithdrawalsAmount) : "—",
      sub: s ? `${fmtNum(s.totalWithdrawalsCount)} approved` : "—",
      color: "#f472b6",
    },
    {
      icon: "⏳", label: "Pending Withdrawals",
      value: s ? `${fmtNum(s.pendingWithdrawals)}` : "—",
      sub: s ? `${fmt(s.pendingWithdrawalsAmount)} awaiting` : "—",
      color: "#f59e0b",
    },
    {
      icon: "🪪", label: "KYC Pending",
      value: s ? fmtNum(s.pendingKYC) : "—",
      sub: "Needs review",
      color: "#fb923c",
    },
    {
      icon: "💳", label: "Today Deposits",
      value: s ? fmt(s.depositsTodayAmount) : "—",
      sub: s ? `${fmtNum(s.depositsTodayCount)} transactions` : "—",
      color: "#60a5fa", glow: "rgba(96,165,250,0.10)",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Firebase live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
          style={{ background: FIREBASE_ENABLED ? "rgba(52,211,153,0.06)" : "rgba(245,158,11,0.06)", border: `1px solid ${FIREBASE_ENABLED ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.2)"}`, color: FIREBASE_ENABLED ? "#34d399" : "#f59e0b" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full"
            style={{ background: FIREBASE_ENABLED ? "#34d399" : "#f59e0b" }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
          {FIREBASE_ENABLED ? "🔥 Live Firebase — all stats are real-time" : "⚠️ Firebase not connected — configure VITE_FIREBASE_* env vars"}
        </div>
        {s && (
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            {s.totalUsers} users registered
          </span>
        )}
      </div>

      {/* Live stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS.map((sc, i) => (
          <StatCard key={sc.label} {...sc} delay={i * 0.05} />
        ))}
      </div>

      {/* Revenue chart + Recent deposits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-black text-sm">Revenue Overview</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Deposits vs Withdrawals</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold"
              style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
              Weekly
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWithdraw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="deposits"    name="Deposits"    stroke="#FFD700" strokeWidth={2} fill="url(#gDeposit)"  />
              <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="#7c3aed" strokeWidth={2} fill="url(#gWithdraw)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Recent Razorpay deposits */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-5 flex flex-col"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-black text-sm">💳 Recent Deposits</h3>
            {FIREBASE_ENABLED && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
                LIVE
              </span>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto">
            <AnimatePresence>
              {deposits.length === 0 ? (
                <p className="text-xs text-center py-4" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {FIREBASE_ENABLED ? "No deposits yet" : "No data"}
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
      </div>

      {/* User growth + Game share + Wallet breakdown */}
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
              <Tooltip
                contentStyle={{ background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, fontSize: 11 }}
                labelStyle={{ color: "#fff" }} itemStyle={{ color: "#FFD700" }}
                formatter={(v: number) => [`${v.toLocaleString()}`, "Users"]}
              />
              <Bar dataKey="users" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Game distribution */}
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
            <div className="flex flex-col gap-1.5 flex-1">
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

        {/* Live wallet breakdown */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">💰 Live Wallet Breakdown</h3>
          <div className="space-y-3">
            {[
              { label: "Winning Balance", value: s?.totalWinningBalance ?? 0, color: "#34d399",  icon: "🏆" },
              { label: "Deposit Balance", value: s?.totalDepositBalance ?? 0, color: "#60a5fa",  icon: "💳" },
              { label: "Bonus Balance",   value: s?.totalBonusBalance   ?? 0, color: "#FFD700",  icon: "🎁" },
            ].map((row) => {
              const total = s?.totalWalletBalance || 1;
              const pct = Math.min(100, Math.round((row.value / total) * 100));
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] flex items-center gap-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {row.icon} {row.label}
                    </span>
                    <span className="text-xs font-black" style={{ color: row.color }}>{fmt(row.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: row.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.5)" }}>Total Platform Wallet</span>
              <span className="text-sm font-black" style={{ color: "#FFD700" }}>{fmt(s?.totalWalletBalance ?? 0)}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
