import { useState } from "react";
import { motion } from "framer-motion";

const TOURNAMENTS = [
  { id: "T001", name: "Mega War #12",    teams: "128/128", prize: "₹25,000", status: "live",      started: "2h ago",       phase: "Semi-Finals" },
  { id: "T002", name: "Weekly Clash #8", teams: "64/64",   prize: "₹10,000", status: "live",      started: "45m ago",      phase: "Quarter-Finals" },
  { id: "T003", name: "Daily Duel #34",  teams: "32/32",   prize: "₹2,000",  status: "completed", started: "Yesterday",    phase: "Completed" },
  { id: "T004", name: "Mega War #13",    teams: "0/128",   prize: "₹25,000", status: "scheduled", started: "Tomorrow 8pm", phase: "Registrations Open" },
];

const LEADERBOARD = [
  { rank: 1, team: "⚡ Karan XI", wins: 7, score: 4820, prize: "₹12,500" },
  { rank: 2, team: "🔥 Arjun Force", wins: 6, score: 4210, prize: "₹6,250" },
  { rank: 3, team: "💜 Purple Hawks", wins: 6, score: 3980, prize: "₹3,750" },
  { rank: 4, team: "⚔️ Battle Wolves", wins: 5, score: 3640, prize: "₹2,500" },
  { rank: 5, team: "🏆 Gold Eagles", wins: 4, score: 3100, prize: "₹1,250" },
];

const STATUS_CFG = {
  live:       { label: "🔴 Live",     bg: "rgba(248,113,113,0.12)", color: "#f87171" },
  scheduled:  { label: "⏳ Scheduled", bg: "rgba(96,165,250,0.12)",  color: "#60a5fa" },
  completed:  { label: "✅ Done",      bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
};

export default function PageWorldWar() {
  const [tournaments, setTournaments] = useState(TOURNAMENTS);
  const [showCreate, setShowCreate] = useState(false);
  const [newTournament, setNewTournament] = useState({ name: "", prize: "", teams: "32" });

  function createTournament() {
    if (!newTournament.name || !newTournament.prize) return;
    setTournaments(prev => [{
      id: `T00${prev.length + 1}`,
      name: newTournament.name,
      teams: `0/${newTournament.teams}`,
      prize: newTournament.prize,
      status: "scheduled",
      started: "TBD",
      phase: "Registrations Open",
    }, ...prev]);
    setShowCreate(false);
    setNewTournament({ name: "", prize: "", teams: "32" });
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Tournaments", value: "2",         color: "#f87171", icon: "⚔️" },
          { label: "Total Players",       value: "4,821",    color: "#7c3aed", icon: "👥" },
          { label: "Prize Distributed",   value: "₹3,25,000",color: "#FFD700", icon: "🏆" },
          { label: "Avg Match Time",       value: "8m 24s",  color: "#34d399", icon: "⏱️" },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tournaments list */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between px-4 py-3"
          style={{ background: "rgba(255,215,0,0.05)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(255,215,0,0.6)" }}>
            ⚔️ Tournaments
          </span>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
            className="px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
            + Create Tournament
          </motion.button>
        </div>

        {tournaments.map((t, i) => {
          const cfg = STATUS_CFG[t.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.scheduled;
          return (
            <div key={t.id} className="flex items-center gap-3 px-4 py-4"
              style={{ borderBottom: i < tournaments.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-black text-white">{t.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                </div>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {t.teams} teams · {t.phase} · {t.started}
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-black" style={{ color: "#FFD700" }}>{t.prize}</div>
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{t.id}</div>
              </div>
              {t.status === "live" && (
                <motion.button whileTap={{ scale: 0.95 }}
                  className="px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer shrink-0"
                  style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                  Control
                </motion.button>
              )}
            </div>
          );
        })}
      </div>

      {/* Live leaderboard */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,215,0,0.15)" }}>
        <div className="px-4 py-3"
          style={{ background: "linear-gradient(90deg, rgba(255,78,0,0.15), rgba(236,159,5,0.15))", borderBottom: "1px solid rgba(255,215,0,0.10)" }}>
          <span className="text-xs font-black tracking-widest uppercase" style={{ color: "#FFD700" }}>
            🏆 Live Leaderboard — Mega War #12
          </span>
        </div>
        {LEADERBOARD.map((r, i) => (
          <div key={r.rank} className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: i < LEADERBOARD.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                     background: r.rank === 1 ? "rgba(255,215,0,0.05)" : "transparent" }}>
            <span className="font-black text-sm w-6 text-center"
              style={{ color: r.rank === 1 ? "#FFD700" : r.rank === 2 ? "#aaa" : r.rank === 3 ? "#cd7f32" : "rgba(255,255,255,0.3)" }}>
              {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank}
            </span>
            <span className="flex-1 text-sm font-bold text-white">{r.team}</span>
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{r.wins}W · {r.score.toLocaleString()} pts</span>
            <span className="text-sm font-black" style={{ color: "#34d399" }}>{r.prize}</span>
          </div>
        ))}
      </div>

      {/* Create tournament modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm rounded-3xl p-6"
            style={{ transform: "translate(-50%,-50%)", background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black">Create Tournament</h3>
              <button onClick={() => setShowCreate(false)} style={{ color: "rgba(255,255,255,0.4)" }} className="cursor-pointer">✕</button>
            </div>
            {[
              { label: "Tournament Name", field: "name", placeholder: "Mega War #14" },
              { label: "Prize Pool", field: "prize", placeholder: "₹25,000" },
              { label: "Max Teams", field: "teams", placeholder: "128" },
            ].map(f => (
              <div key={f.field} className="mb-3">
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>{f.label}</label>
                <input
                  value={newTournament[f.field as keyof typeof newTournament]}
                  onChange={e => setNewTournament({ ...newTournament, [f.field]: e.target.value })}
                  placeholder={f.placeholder}
                  className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.25)", caretColor: "#FFD700" }}
                />
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(false)}
                className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                Cancel
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={createTournament}
                className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                Create
              </motion.button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
