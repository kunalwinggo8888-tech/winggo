import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import StatCard from "@/components/StatCard";
import { REVENUE_DATA, USER_GROWTH_DATA, GAME_STATS_DATA, NOTIFICATIONS } from "@/data/mockData";
import { subscribeLiveStats } from "@/firebase/admin.service";

const BASE_STATS = [
  { icon: "👥", label: "Total Users",     key: "totalUsers",         baseVal: "74,218",    sub: "+1,240 today",    color: "#7c3aed", glow: "rgba(124,58,237,0.12)", trend: "8.4%",  trendUp: true  },
  { icon: "🟢", label: "Online Now",      key: null,                 baseVal: "4,821",     sub: "Live sessions",   color: "#34d399", glow: "rgba(52,211,153,0.10)", trend: "12.1%", trendUp: true  },
  { icon: "💰", label: "Today Revenue",   key: null,                 baseVal: "₹1,15,600", sub: "↑ vs yesterday",  color: "#FFD700", glow: "rgba(255,215,0,0.10)",  trend: "24.3%", trendUp: true  },
  { icon: "📥", label: "Deposits Today",  key: null,                 baseVal: "₹81,000",   sub: "382 transactions",color: "#60a5fa", glow: "rgba(96,165,250,0.10)", trend: "9.7%",  trendUp: true  },
  { icon: "📤", label: "Withdrawals",     key: "pendingWithdrawals", baseVal: "₹42,000",   sub: "pending review",  color: "#f472b6", glow: undefined,               trend: "3.2%",  trendUp: false },
  { icon: "🎮", label: "Live Matches",    key: null,                 baseVal: "1,248",     sub: "Across 6 games",  color: "#fb923c", glow: undefined,               trend: "15.8%", trendUp: true  },
  { icon: "🪪", label: "KYC Pending",     key: "pendingKYC",         baseVal: "4",         sub: "Needs review",    color: "#f59e0b", glow: undefined,               trend: undefined, trendUp: undefined },
  { icon: "🎁", label: "Referrals Today", key: null,                 baseVal: "186",       sub: "₹9,300 paid",     color: "#a78bfa", glow: undefined,               trend: "5.1%",  trendUp: true  },
];

const LIVE_MATCHES = [
  { game: "🎲 Ludo",       room: "₹50 Room",  players: "4/4",  prize: "₹180",  started: "2m ago"  },
  { game: "⚔️ World War",  room: "₹100 Room", players: "2/2",  prize: "₹180",  started: "5m ago"  },
  { game: "🎲 Ludo",       room: "₹10 Room",  players: "4/4",  prize: "₹36",   started: "8m ago"  },
  { game: "🎮 Cricket",    room: "₹50 Room",  players: "2/2",  prize: "₹90",   started: "11m ago" },
  { game: "⚔️ World War",  room: "₹25 Room",  players: "2/2",  prize: "₹45",   started: "14m ago" },
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
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
  }
  return null;
};

export default function PageDashboard() {
  const [liveStats, setLiveStats] = useState<{ totalUsers: number; pendingWithdrawals: number; pendingKYC: number } | null>(null);

  useEffect(() => {
    return subscribeLiveStats(setLiveStats);
  }, []);

  const STATS = BASE_STATS.map((s) => {
    if (!liveStats || !s.key) return { ...s, value: s.baseVal };
    const raw = liveStats[s.key as keyof typeof liveStats];
    let value = s.baseVal;
    if (s.key === "totalUsers") value = Number(raw).toLocaleString("en-IN");
    else if (s.key === "pendingWithdrawals") value = String(raw) + " pending";
    else if (s.key === "pendingKYC") value = String(raw);
    return { ...s, value };
  });

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATS.map(({ key: _fbKey, baseVal: _bv, ...s }, i) => (
          <StatCard key={s.label} {...s} delay={i * 0.05} />
        ))}
      </div>

      {/* Revenue chart + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-white font-black text-sm">Revenue Overview</h3>
              <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Last 7 days · Deposits vs Withdrawals</p>
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
                tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#FFD700" strokeWidth={2} fill="url(#gDeposit)" />
              <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="#7c3aed" strokeWidth={2} fill="url(#gWithdraw)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Alerts panel */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">🔔 Alerts</h3>
          <div className="space-y-2.5">
            {NOTIFICATIONS.map((n) => (
              <div key={n.id} className="flex gap-2.5 items-start px-3 py-2.5 rounded-xl"
                style={{
                  background: n.type === "error" ? "rgba(248,113,113,0.07)" :
                              n.type === "warning" ? "rgba(245,158,11,0.07)" :
                              n.type === "success" ? "rgba(52,211,153,0.07)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${n.type === "error" ? "rgba(248,113,113,0.2)" : n.type === "warning" ? "rgba(245,158,11,0.2)" : n.type === "success" ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)"}`,
                }}>
                <span className="text-sm mt-0.5">
                  {n.type === "error" ? "🚨" : n.type === "warning" ? "⚠️" : n.type === "success" ? "✅" : "ℹ️"}
                </span>
                <div>
                  <p className="text-xs text-white leading-snug">{n.msg}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{n.time}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* User growth + Game dist + Live matches */}
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
                  {GAME_STATS_DATA.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
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

        {/* Live matches */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-3">🔴 Live Matches</h3>
          <div className="space-y-2">
            {LIVE_MATCHES.map((m, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-sm">{m.game.split(" ")[0]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{m.game.split(" ").slice(1).join(" ")} · {m.room}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{m.players} · {m.started}</p>
                </div>
                <span className="text-xs font-black" style={{ color: "#34d399" }}>{m.prize}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
