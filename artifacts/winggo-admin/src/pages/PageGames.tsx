import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const GAMES_INIT = [
  { id: 1, name: "Ludo Classic",    emoji: "🎲", category: "Board",   minFee: 1,  maxFee: 50,  pool: 500,  active: true,  matches: 1240, bots: 30, timer: 300,  revenue: 48200, live: 42 },
  { id: 2, name: "World War",       emoji: "⚔️", category: "Battle",  minFee: 5,  maxFee: 100, pool: 2000, active: true,  matches: 890,  bots: 25, timer: 600,  revenue: 34100, live: 18 },
  { id: 3, name: "Carrom",          emoji: "🎯", category: "Board",   minFee: 2,  maxFee: 25,  pool: 250,  active: false, matches: 340,  bots: 40, timer: 240,  revenue: 9200,  live: 0  },
  { id: 4, name: "Snake & Ladder",  emoji: "🐍", category: "Board",   minFee: 1,  maxFee: 10,  pool: 100,  active: true,  matches: 567,  bots: 50, timer: 180,  revenue: 7400,  live: 31 },
  { id: 5, name: "Cricket",         emoji: "🏏", category: "Sports",  minFee: 5,  maxFee: 50,  pool: 500,  active: true,  matches: 432,  bots: 20, timer: 900,  revenue: 18400, live: 14 },
  { id: 6, name: "Metro Surfer",    emoji: "🏃", category: "Runner",  minFee: 0,  maxFee: 50,  pool: 100,  active: true,  matches: 2100, bots: 0,  timer: 65,   revenue: 5600,  live: 87 },
  { id: 7, name: "Spin & Win",      emoji: "🎡", category: "Casual",  minFee: 0,  maxFee: 0,   pool: 50,   active: true,  matches: 3400, bots: 0,  timer: 30,   revenue: 3200,  live: 120},
  { id: 8, name: "Quiz Battle",     emoji: "🧠", category: "Quiz",    minFee: 5,  maxFee: 25,  pool: 200,  active: false, matches: 180,  bots: 60, timer: 120,  revenue: 4100,  live: 0  },
];

type Game = typeof GAMES_INIT[number];

const CATEGORY_COLORS: Record<string, string> = {
  Board: "#7c3aed", Battle: "#ef4444", Sports: "#34d399",
  Runner: "#f97316", Casual: "#60a5fa", Quiz: "#f59e0b",
};

export default function PageGames() {
  const [games, setGames] = useState<Game[]>(GAMES_INIT);
  const [editing, setEditing] = useState<Game | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [saved, setSaved] = useState(false);

  const filtered = games.filter(g =>
    filter === "all" ? true : filter === "active" ? g.active : !g.active
  );

  function toggleGame(id: number) {
    setGames(prev => prev.map(g => g.id === id ? { ...g, active: !g.active } : g));
  }

  function startEdit(g: Game) {
    setEditing({ ...g });
  }

  function saveEdit() {
    if (!editing) return;
    setGames(prev => prev.map(g => g.id === editing.id ? editing : g));
    setEditing(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const totalRevenue = games.reduce((s, g) => s + g.revenue, 0);
  const totalLive    = games.reduce((s, g) => s + g.live, 0);
  const activeCount  = games.filter(g => g.active).length;

  return (
    <div className="space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: "🎮", label: "Total Games",   value: games.length,                                          color: "#a78bfa" },
          { icon: "✅", label: "Active Games",  value: activeCount,                                           color: "#34d399" },
          { icon: "🔴", label: "Live Matches",  value: totalLive,                                             color: "#f87171" },
          { icon: "💰", label: "Total Revenue", value: `₹${(totalRevenue / 1000).toFixed(0)}K`,              color: "#FFD700" },
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

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map(f => (
            <motion.button key={f} whileTap={{ scale: 0.95 }} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer capitalize"
              style={{
                background: filter === f ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
                color: filter === f ? "#FFD700" : "rgba(255,255,255,0.45)",
                border: `1px solid ${filter === f ? "rgba(255,215,0,0.28)" : "rgba(255,255,255,0.08)"}`,
              }}>
              {f}
            </motion.button>
          ))}
        </div>
        <p className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.35)" }}>{filtered.length} games</p>
        <motion.button whileTap={{ scale: 0.95 }}
          className="px-4 py-2 rounded-xl font-black text-xs cursor-pointer"
          style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
          + Add Game
        </motion.button>
      </div>

      {/* Game cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((g, i) => {
          const catColor = CATEGORY_COLORS[g.category] ?? "#a78bfa";
          return (
            <motion.div key={g.id}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.025)", border: g.active ? `1px solid ${catColor}28` : "1px solid rgba(255,255,255,0.06)" }}>

              {/* Card header */}
              <div className="px-4 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: `${catColor}18`, border: `1px solid ${catColor}30` }}>
                    {g.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-black text-sm">{g.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}30` }}>
                        {g.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {g.matches.toLocaleString()} total matches
                      </p>
                      {g.live > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-black" style={{ color: "#f87171" }}>
                          <motion.span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"
                            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                          {g.live} live
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Toggle */}
                  <motion.div onClick={() => toggleGame(g.id)} whileTap={{ scale: 0.92 }}
                    className="w-11 h-6 rounded-full relative cursor-pointer shrink-0"
                    style={{ background: g.active ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)", border: `1px solid ${g.active ? "#34d399" : "rgba(255,255,255,0.15)"}` }}>
                    <motion.div className="w-4 h-4 rounded-full absolute top-0.5"
                      animate={{ left: g.active ? "calc(100% - 18px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      style={{ background: g.active ? "#34d399" : "rgba(255,255,255,0.5)" }} />
                  </motion.div>
                </div>

                {/* Revenue + fee row */}
                <div className="flex items-center gap-4 mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div>
                    <p className="text-[9px] font-black uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Revenue</p>
                    <p className="text-sm font-black" style={{ color: "#FFD700" }}>₹{(g.revenue / 1000).toFixed(1)}K</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Entry Fee</p>
                    <p className="text-sm font-black text-white">
                      {g.minFee === 0 && g.maxFee === 0 ? "Free" : g.minFee === 0 ? `Free – ₹${g.maxFee}` : `₹${g.minFee} – ₹${g.maxFee}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Bots</p>
                    <p className="text-sm font-black" style={{ color: g.bots > 40 ? "#f59e0b" : "#a78bfa" }}>{g.bots}%</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase" style={{ color: "rgba(255,255,255,0.3)" }}>Timer</p>
                    <p className="text-sm font-black text-white">{g.timer}s</p>
                  </div>
                </div>

                {/* Bot fill bar */}
                <div className="mt-3">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <motion.div className="h-full rounded-full"
                      style={{ background: catColor }}
                      initial={{ width: 0 }} animate={{ width: `${(g.revenue / 50000) * 100}%` }}
                      transition={{ duration: 0.9 }} />
                  </div>
                </div>
              </div>

              {/* Edit controls */}
              <div className="px-4 pb-3 flex gap-2">
                <motion.button whileTap={{ scale: 0.93 }} onClick={() => startEdit(g)}
                  className="flex-1 py-2 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  ✏️ Edit Settings
                </motion.button>
                <motion.button whileTap={{ scale: 0.93 }}
                  className="flex-1 py-2 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: `${catColor}14`, color: catColor, border: `1px solid ${catColor}30` }}>
                  📊 Live Monitor
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Edit modal */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={() => setEditing(null)}>
            <motion.div initial={{ scale: 0.9, y: 24 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 24 }}
              transition={{ type: "spring", damping: 20, stiffness: 200 }}
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background: "#0f0b1e", border: "1px solid rgba(255,215,0,0.2)" }}
              onClick={e => e.stopPropagation()}>

              {/* Modal header */}
              <div className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="flex items-center gap-2">
                  <span className="text-xl">{editing.emoji}</span>
                  <div>
                    <h3 className="text-white font-black text-sm">{editing.name}</h3>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Game Settings</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.93 }} onClick={() => setEditing(null)}
                  className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-sm"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>✕</motion.button>
              </div>

              {/* Modal form */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Min Entry Fee (₹)", key: "minFee" as const },
                    { label: "Max Entry Fee (₹)", key: "maxFee" as const },
                    { label: "Prize Pool (₹)", key: "pool" as const },
                    { label: "Match Timer (s)", key: "timer" as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-black uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</label>
                      <input type="number" value={editing[key]}
                        onChange={e => setEditing(prev => prev ? { ...prev, [key]: Number(e.target.value) } : prev)}
                        className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }} />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>Bot Players %</span>
                    <span className="text-sm font-black" style={{ color: "#a78bfa" }}>{editing.bots}%</span>
                  </label>
                  <input type="range" min={0} max={80} value={editing.bots}
                    onChange={e => setEditing(prev => prev ? { ...prev, bots: Number(e.target.value) } : prev)}
                    className="w-full accent-purple-400 cursor-pointer" />
                </div>

                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div>
                    <p className="text-xs font-bold text-white">Game Status</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{editing.active ? "Game is live and accepting matches" : "Game is disabled"}</p>
                  </div>
                  <motion.div onClick={() => setEditing(prev => prev ? { ...prev, active: !prev.active } : prev)} whileTap={{ scale: 0.92 }}
                    className="w-11 h-6 rounded-full relative cursor-pointer"
                    style={{ background: editing.active ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)", border: `1px solid ${editing.active ? "#34d399" : "rgba(255,255,255,0.15)"}` }}>
                    <motion.div className="w-4 h-4 rounded-full absolute top-0.5"
                      animate={{ left: editing.active ? "calc(100% - 18px)" : "2px" }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      style={{ background: editing.active ? "#34d399" : "rgba(255,255,255,0.5)" }} />
                  </motion.div>
                </div>

                <div className="flex gap-3 pt-1">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditing(null)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-black cursor-pointer"
                    style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    Cancel
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={saveEdit}
                    className="flex-2 flex-1 py-2.5 rounded-xl text-xs font-black cursor-pointer"
                    style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                    💾 Save Changes
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save toast */}
      <AnimatePresence>
        {saved && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-black z-50"
            style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.35)" }}>
            ✅ Game settings saved!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
