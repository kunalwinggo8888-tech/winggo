import { motion } from "framer-motion";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { REVENUE_DATA, USER_GROWTH_DATA } from "@/data/mockData";

const HOURLY = [
  { h: "12am", active: 820  }, { h: "3am", active: 340  }, { h: "6am", active: 680  },
  { h: "9am", active: 2100 }, { h: "12pm",active: 3800 }, { h: "3pm", active: 4200 },
  { h: "6pm", active: 5600 }, { h: "9pm", active: 4821 },
];

const GAME_REVENUE = [
  { game: "Ludo",       revenue: 48200 },
  { game: "World War",  revenue: 34100 },
  { game: "Cricket",    revenue: 18400 },
  { game: "Carrom",     revenue: 9200  },
  { game: "Spin",       revenue: 5700  },
];

const TOP_WINNERS = [
  { rank: 1, name: "Arjun Menon",   won: "₹42,800", games: 412, winRate: "88%" },
  { rank: 2, name: "Rahul Sharma",  won: "₹28,400", games: 289, winRate: "81%" },
  { rank: 3, name: "Vikram Singh",  won: "₹19,200", games: 142, winRate: "72%" },
  { rank: 4, name: "Meera Nair",    won: "₹12,600", games: 98,  winRate: "65%" },
  { rank: 5, name: "Deepika Joshi", won: "₹8,400",  games: 67,  winRate: "58%" },
];

const tooltip = {
  contentStyle: { background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 12, fontSize: 11 },
  labelStyle: { color: "#fff" },
};

export default function PageAnalytics() {
  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg Session Time", value: "18m 42s", color: "#7c3aed", icon: "⏱️" },
          { label: "Retention (D7)",   value: "64%",     color: "#34d399", icon: "🔄" },
          { label: "ARPU",             value: "₹1,556",  color: "#FFD700", icon: "💎" },
          { label: "Churn Rate",       value: "3.2%",    color: "#f59e0b", icon: "📉" },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">💰 Daily Revenue</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltip} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
              <Area type="monotone" dataKey="revenue" stroke="#FFD700" strokeWidth={2} fill="url(#gRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly active */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">🟢 Active Users (Today)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={HOURLY}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="h" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltip} formatter={(v: number) => [v.toLocaleString(), "Active Users"]} />
              <Line type="monotone" dataKey="active" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Game revenue */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">🎮 Revenue by Game</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={GAME_REVENUE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="game" tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} axisLine={false} tickLine={false} width={60} />
              <Tooltip {...tooltip} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
              <Bar dataKey="revenue" fill="#7c3aed" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top winners */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">🏆 Top Winners This Month</h3>
          <div className="space-y-2">
            {TOP_WINNERS.map((w) => (
              <div key={w.rank} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: w.rank === 1 ? "rgba(255,215,0,0.07)" : "rgba(255,255,255,0.03)", border: w.rank === 1 ? "1px solid rgba(255,215,0,0.15)" : "1px solid rgba(255,255,255,0.05)" }}>
                <span className="font-black text-sm w-5 text-center"
                  style={{ color: w.rank === 1 ? "#FFD700" : w.rank === 2 ? "#aaa" : w.rank === 3 ? "#cd7f32" : "rgba(255,255,255,0.35)" }}>
                  {w.rank === 1 ? "🥇" : w.rank === 2 ? "🥈" : w.rank === 3 ? "🥉" : w.rank}
                </span>
                <span className="flex-1 text-xs font-bold text-white">{w.name}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{w.games} games · {w.winRate}</span>
                <span className="text-xs font-black" style={{ color: "#34d399" }}>{w.won}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* User growth full width */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">👥 Monthly User Growth</h3>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={USER_GROWTH_DATA}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip {...tooltip} formatter={(v: number) => [v.toLocaleString(), "Users"]} />
            <Bar dataKey="users" fill="#7c3aed" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
