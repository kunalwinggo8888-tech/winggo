import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { REVENUE_DATA, USER_GROWTH_DATA } from "@/data/mockData";

const HOURLY = [
  { h: "12am", active: 820  }, { h: "3am", active: 340  }, { h: "6am", active: 680 },
  { h: "9am", active: 2100 }, { h: "12pm",active: 3800 }, { h: "3pm", active: 4200 },
  { h: "6pm", active: 5600 }, { h: "9pm", active: 4821 },
];

const GAME_REVENUE = [
  { game: "Ludo",         revenue: 48200, color: "#7c3aed" },
  { game: "World War",    revenue: 34100, color: "#ef4444" },
  { game: "Cricket",      revenue: 18400, color: "#34d399" },
  { game: "Metro Surfer", revenue: 9200,  color: "#f97316" },
  { game: "Carrom",       revenue: 5700,  color: "#60a5fa" },
];

const RETENTION = [
  { day: "D1", rate: 78 }, { day: "D3",  rate: 62 }, { day: "D7",  rate: 48 },
  { day: "D14",rate: 38 }, { day: "D30", rate: 28 }, { day: "D60", rate: 18 },
];

const DEVICE_DATA = [
  { name: "Android", value: 68, color: "#34d399" },
  { name: "iOS",     value: 24, color: "#60a5fa" },
  { name: "Web",     value: 8,  color: "#a78bfa" },
];

const TOP_WINNERS = [
  { rank: 1, name: "Arjun Menon",   won: "₹42,800", games: 412, winRate: "88%" },
  { rank: 2, name: "Rahul Sharma",  won: "₹28,400", games: 289, winRate: "81%" },
  { rank: 3, name: "Vikram Singh",  won: "₹19,200", games: 142, winRate: "72%" },
  { rank: 4, name: "Meera Nair",    won: "₹12,600", games: 98,  winRate: "65%" },
  { rank: 5, name: "Deepika Joshi", won: "₹8,400",  games: 67,  winRate: "58%" },
];

const TT = {
  contentStyle: { background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.18)", borderRadius: 12, fontSize: 11 },
  labelStyle: { color: "#fff" },
  itemStyle: { color: "#FFD700" },
};

export default function PageAnalytics() {
  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Avg Session Time", value: "18m 42s", change: "+4.2%",  color: "#7c3aed", icon: "⏱️", up: true  },
          { label: "Retention (D7)",   value: "48%",     change: "+2.1%",  color: "#34d399", icon: "🔄", up: true  },
          { label: "ARPU",             value: "₹1,556",  change: "+11.4%", color: "#FFD700", icon: "💎", up: true  },
          { label: "Churn Rate",       value: "3.2%",    change: "-0.8%",  color: "#f59e0b", icon: "📉", up: false },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-1.5">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</span>
              <span className="text-[10px] font-black" style={{ color: s.up ? "#34d399" : "#ef4444" }}>
                {s.up ? "↑" : "↓"} {s.change}
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Revenue + Hourly activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-black text-sm">💰 Daily Revenue</h3>
            <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
              style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>7 Days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="aDep" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FFD700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FFD700" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aWit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...TT} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} />
              <Area type="monotone" dataKey="deposits"    name="Deposits"    stroke="#FFD700" strokeWidth={2} fill="url(#aDep)" />
              <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="#7c3aed" strokeWidth={2} fill="url(#aWit)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-black text-sm mb-4">⚡ Hourly Active Users</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={HOURLY}>
              <defs>
                <linearGradient id="aHour" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="h" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} />
              <Tooltip {...TT} formatter={(v: number) => [v.toLocaleString(), "Users"]} />
              <Area type="monotone" dataKey="active" name="Active Users" stroke="#34d399" strokeWidth={2} fill="url(#aHour)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* User growth + Retention + Device split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-black text-sm mb-4">👥 User Growth</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={USER_GROWTH_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip {...TT} formatter={(v: number) => [v.toLocaleString(), "Users"]} />
              <Bar dataKey="users" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-black text-sm mb-4">🔄 Retention Curve</h3>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={RETENTION}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="day" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
              <Tooltip {...TT} formatter={(v: number) => [`${v}%`, "Retention"]} />
              <Line type="monotone" dataKey="rate" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-black text-sm mb-4">📱 Device Split</h3>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={110} height={110}>
              <PieChart>
                <Pie data={DEVICE_DATA} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value">
                  {DEVICE_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {DEVICE_DATA.map(d => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] flex items-center gap-1.5" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <span className="w-2 h-2 rounded-full inline-block" style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className="text-[11px] font-black" style={{ color: d.color }}>{d.value}%</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div className="h-full rounded-full" style={{ background: d.color }}
                      initial={{ width: 0 }} animate={{ width: `${d.value}%` }} transition={{ duration: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Game revenue + Top winners */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-black text-sm mb-4">🎮 Revenue by Game</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={GAME_REVENUE} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}K`} />
              <YAxis type="category" dataKey="game" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip {...TT} formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Revenue"]} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {GAME_REVENUE.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm mb-4">🏆 Top Winners</h3>
          <div className="space-y-2.5">
            {TOP_WINNERS.map((p, i) => (
              <motion.div key={p.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.55 + i * 0.06 }}
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: i === 0 ? "rgba(255,215,0,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${i === 0 ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                <span className="text-sm font-black w-6 text-center shrink-0"
                  style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "rgba(255,255,255,0.35)" }}>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${p.rank}`}
                </span>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{ background: "rgba(124,58,237,0.25)", color: "#a78bfa" }}>
                  {p.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{p.games} games · {p.winRate} win rate</p>
                </div>
                <span className="text-sm font-black shrink-0" style={{ color: "#34d399" }}>{p.won}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
