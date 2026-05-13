import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TOURNAMENTS = [
  { id: "T001", name: "Mega Ludo War #12",    game: "🎲 Ludo",    prizePool: 25000, maxPlayers: 128, joined: 128, status: "live",      phase: "Semi-Finals",     start: "2h ago",      entryFee: 199 },
  { id: "T002", name: "Weekly Cricket Cup",   game: "🏏 Cricket",  prizePool: 10000, maxPlayers: 64,  joined: 61,  status: "live",      phase: "Quarter-Finals",  start: "45m ago",     entryFee: 99  },
  { id: "T003", name: "Daily Snake Dash #34", game: "🐍 Sn.Ladder",prizePool: 2000,  maxPlayers: 32,  joined: 32,  status: "completed", phase: "Completed",       start: "Yesterday",   entryFee: 29  },
  { id: "T004", name: "Mega Ludo War #13",    game: "🎲 Ludo",    prizePool: 25000, maxPlayers: 128, joined: 0,   status: "scheduled", phase: "Registrations",   start: "Tomorrow 6pm",entryFee: 199 },
  { id: "T005", name: "Carrom Championship",  game: "🎯 Carrom",   prizePool: 5000,  maxPlayers: 64,  joined: 18,  status: "scheduled", phase: "Registrations",   start: "In 3 days",   entryFee: 49  },
];

const LEADERBOARD = [
  { rank: 1, name: "Arjun Menon",   score: 4820, wins: 7, prize: "₹12,500", avatar: "A" },
  { rank: 2, name: "Rahul Sharma",  score: 4210, wins: 6, prize: "₹6,250",  avatar: "R" },
  { rank: 3, name: "Vikram Singh",  score: 3980, wins: 6, prize: "₹3,750",  avatar: "V" },
  { rank: 4, name: "Meera Nair",    score: 3640, wins: 5, prize: "₹2,500",  avatar: "M" },
  { rank: 5, name: "Amit Kumar",    score: 3100, wins: 4, prize: "₹1,250",  avatar: "A" },
  { rank: 6, name: "Priya Patel",   score: 2870, wins: 4, prize: "₹625",    avatar: "P" },
  { rank: 7, name: "Deepika Joshi", score: 2540, wins: 3, prize: "₹—",      avatar: "D" },
  { rank: 8, name: "Suresh Yadav",  score: 2210, wins: 3, prize: "₹—",      avatar: "S" },
];

const PRIZE_DIST = [
  { rank: "🥇 1st",  share: "50%",  amount: "₹12,500" },
  { rank: "🥈 2nd",  share: "25%",  amount: "₹6,250"  },
  { rank: "🥉 3rd",  share: "15%",  amount: "₹3,750"  },
  { rank: "4th",     share: "5%",   amount: "₹1,250"  },
  { rank: "5-6th",   share: "2.5%", amount: "₹625"    },
];

const STATUS_CFG = {
  live:      { label: "🔴 Live",      bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.3)" },
  scheduled: { label: "⏳ Scheduled", bg: "rgba(96,165,250,0.12)",  color: "#60a5fa", border: "rgba(96,165,250,0.3)"  },
  completed: { label: "✅ Done",      bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.3)"  },
};

const GAME_OPTIONS = ["🎲 Ludo", "🐍 Snake & Ladder", "🎯 Carrom", "🏏 Cricket", "🎮 Metro Surfer", "🎡 Spin & Win"];

export default function PageTournament() {
  const [tab, setTab] = useState<"list" | "leaderboard" | "create">("list");
  const [tournaments, setTournaments] = useState(TOURNAMENTS);
  const [selected, setSelected] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", game: GAME_OPTIONS[0], prizePool: "", maxPlayers: "64", entryFee: "", startDate: "", startTime: "",
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const newT = {
      id: `T${String(Date.now()).slice(-3)}`, name: form.name, game: form.game,
      prizePool: Number(form.prizePool), maxPlayers: Number(form.maxPlayers),
      joined: 0, status: "scheduled" as const, phase: "Registrations",
      start: `${form.startDate} ${form.startTime}`, entryFee: Number(form.entryFee),
    };
    setTournaments(prev => [newT, ...prev]);
    setForm({ name: "", game: GAME_OPTIONS[0], prizePool: "", maxPlayers: "64", entryFee: "", startDate: "", startTime: "" });
    setTab("list");
  }

  const selT = tournaments.find(t => t.id === selected);

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: "🏆", label: "Total Tournaments", value: tournaments.length, color: "#FFD700" },
          { icon: "🔴", label: "Live Now",           value: tournaments.filter(t => t.status === "live").length,      color: "#f87171" },
          { icon: "⏳", label: "Scheduled",          value: tournaments.filter(t => t.status === "scheduled").length, color: "#60a5fa" },
          { icon: "💰", label: "Total Prize Pool",   value: `₹${tournaments.reduce((s, t) => s + t.prizePool, 0).toLocaleString("en-IN")}`, color: "#34d399" },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}28` }}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([["list", "📋 Tournaments"], ["leaderboard", "🏅 Leaderboard"], ["create", "➕ Create"]] as const).map(([t, label]) => (
          <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
            style={{
              background: tab === t ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              color: tab === t ? "#FFD700" : "rgba(255,255,255,0.5)",
              border: `1px solid ${tab === t ? "rgba(255,215,0,0.28)" : "rgba(255,255,255,0.08)"}`,
            }}>
            {label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Tournament list */}
        {tab === "list" && (
          <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-3">
            {tournaments.map((t, i) => {
              const sc = STATUS_CFG[t.status as keyof typeof STATUS_CFG];
              const fillPct = Math.round((t.joined / t.maxPlayers) * 100);
              const isSelected = selected === t.id;
              return (
                <motion.div key={t.id} layout
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${isSelected ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.07)"}`, background: "rgba(255,255,255,0.02)" }}>
                  <div className="p-4 cursor-pointer" onClick={() => setSelected(isSelected ? null : t.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white font-black text-sm">{t.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>
                            {t.game}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                            {sc.label}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                          {t.phase} · Started {t.start} · Entry ₹{t.entryFee}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-black" style={{ color: "#FFD700" }}>₹{t.prizePool.toLocaleString("en-IN")}</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Prize Pool</p>
                      </div>
                    </div>

                    {/* Fill bar */}
                    <div className="mt-3">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Players: {t.joined}/{t.maxPlayers}</span>
                        <span className="text-[10px] font-bold" style={{ color: fillPct === 100 ? "#ef4444" : "#34d399" }}>{fillPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <motion.div className="h-full rounded-full"
                          style={{ background: fillPct === 100 ? "#ef4444" : fillPct > 75 ? "#f59e0b" : "#34d399" }}
                          initial={{ width: 0 }} animate={{ width: `${fillPct}%` }} transition={{ duration: 0.8 }} />
                      </div>
                    </div>
                  </div>

                  {/* Expanded controls */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="px-4 pb-4 pt-0 flex flex-wrap gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                          <div className="pt-3 flex flex-wrap gap-2 w-full">
                            {t.status === "live" && (
                              <motion.button whileTap={{ scale: 0.93 }}
                                className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                                style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                                ⏹ Stop Tournament
                              </motion.button>
                            )}
                            {t.status === "scheduled" && (
                              <motion.button whileTap={{ scale: 0.93 }}
                                className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                                ▶ Start Now
                              </motion.button>
                            )}
                            <motion.button whileTap={{ scale: 0.93 }}
                              className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                              style={{ background: "rgba(96,165,250,0.12)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.25)" }}>
                              👁 View Details
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.93 }}
                              className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                              style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>
                              📢 Notify Players
                            </motion.button>
                          </div>

                          {/* Prize distribution */}
                          <div className="w-full mt-2 rounded-xl p-3" style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.10)" }}>
                            <p className="text-[10px] font-black mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>PRIZE DISTRIBUTION</p>
                            <div className="grid grid-cols-5 gap-1">
                              {PRIZE_DIST.map(pd => (
                                <div key={pd.rank} className="text-center">
                                  <p className="text-[9px] font-bold" style={{ color: "#FFD700" }}>{pd.rank}</p>
                                  <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.5)" }}>{pd.share}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Leaderboard */}
        {tab === "leaderboard" && (
          <motion.div key="lb" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-white font-black text-sm">
                🏅 {selT ? selT.name : "Mega Ludo War #12"} — Leaderboard
              </h3>
              <span className="text-[10px] px-2.5 py-1 rounded-full font-bold"
                style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                🔴 LIVE
              </span>
            </div>
            <div className="space-y-2">
              {LEADERBOARD.map((p, i) => (
                <motion.div key={p.name}
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: i === 0 ? "rgba(255,215,0,0.07)" : i === 1 ? "rgba(255,255,255,0.04)" : i === 2 ? "rgba(251,146,60,0.05)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${i === 0 ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  <span className="text-base font-black w-7 text-center shrink-0"
                    style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#94a3b8" : i === 2 ? "#fb923c" : "rgba(255,255,255,0.4)" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${p.rank}`}
                  </span>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: "rgba(124,58,237,0.3)", color: "#a78bfa" }}>{p.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{p.name}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{p.wins} wins · {p.score.toLocaleString()} pts</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black" style={{ color: p.prize === "₹—" ? "rgba(255,255,255,0.3)" : "#34d399" }}>{p.prize}</p>
                    <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>Prize</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Create tournament */}
        {tab === "create" && (
          <motion.div key="create" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.1)" }}>
            <h3 className="text-white font-black text-sm mb-4">➕ Create New Tournament</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Tournament Name *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required
                    placeholder="e.g. Mega Ludo War #14"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Game</label>
                  <select value={form.game} onChange={e => setForm(p => ({ ...p, game: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {GAME_OPTIONS.map(g => <option key={g} value={g} style={{ background: "#0d0918" }}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Prize Pool (₹) *</label>
                  <input value={form.prizePool} onChange={e => setForm(p => ({ ...p, prizePool: e.target.value }))} required type="number"
                    placeholder="25000"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Entry Fee (₹) *</label>
                  <input value={form.entryFee} onChange={e => setForm(p => ({ ...p, entryFee: e.target.value }))} required type="number"
                    placeholder="199"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Max Players</label>
                  <select value={form.maxPlayers} onChange={e => setForm(p => ({ ...p, maxPlayers: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {["16", "32", "64", "128", "256"].map(n => <option key={n} value={n} style={{ background: "#0d0918" }}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>Start Date</label>
                  <input value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} type="date"
                    className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", colorScheme: "dark" }} />
                </div>
              </div>

              {/* Prize distribution preview */}
              <div className="rounded-xl p-3" style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)" }}>
                <p className="text-[10px] font-black mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>AUTO PRIZE DISTRIBUTION</p>
                <div className="grid grid-cols-5 gap-2">
                  {PRIZE_DIST.map(pd => (
                    <div key={pd.rank} className="rounded-lg px-2 py-1.5 text-center" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <p className="text-[9px] font-bold" style={{ color: "#FFD700" }}>{pd.rank}</p>
                      <p className="text-[9px] font-black text-white">{form.prizePool ? `₹${Math.floor(Number(form.prizePool) * parseFloat(pd.share) / 100).toLocaleString()}` : pd.share}</p>
                    </div>
                  ))}
                </div>
              </div>

              <motion.button type="submit" whileTap={{ scale: 0.96 }}
                className="w-full py-3 rounded-xl font-black text-sm cursor-pointer"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                🏆 Create Tournament
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
