import { useState } from "react";
import { motion } from "framer-motion";
import { MOCK_GAMES } from "@/data/mockData";

type Game = typeof MOCK_GAMES[number] & { active: boolean; fee: string; pool: string; bots: number };

export default function PageGames() {
  const [games, setGames] = useState<Game[]>(MOCK_GAMES as Game[]);
  const [editing, setEditing] = useState<Game | null>(null);

  function toggleGame(id: number) {
    setGames(prev => prev.map(g => g.id === id ? { ...g, active: !g.active } : g));
  }

  function saveEdit() {
    if (!editing) return;
    setGames(prev => prev.map(g => g.id === editing.id ? editing : g));
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{games.length} games configured</p>
        <motion.button whileTap={{ scale: 0.95 }}
          className="px-4 py-2 rounded-xl font-black text-xs cursor-pointer"
          style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
          + Add New Game
        </motion.button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {games.map((g, i) => (
          <motion.div key={g.id}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: g.active ? "1px solid rgba(255,215,0,0.18)" : "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-black text-sm">{g.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "rgba(124,58,237,0.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,0.25)" }}>
                    {g.category}
                  </span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {g.players} players · {g.matches.toLocaleString()} matches played
                </p>
              </div>

              {/* Toggle switch */}
              <motion.div
                onClick={() => toggleGame(g.id)}
                className="w-11 h-6 rounded-full relative cursor-pointer shrink-0"
                style={{ background: g.active ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.10)", border: `1px solid ${g.active ? "#34d399" : "rgba(255,255,255,0.15)"}` }}
              >
                <motion.div
                  animate={{ x: g.active ? 20 : 2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute top-1 w-4 h-4 rounded-full"
                  style={{ background: g.active ? "#34d399" : "rgba(255,255,255,0.4)" }}
                />
              </motion.div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { label: "Entry Fee", value: g.fee },
                { label: "Prize Pool", value: g.pool },
                { label: "Bot %", value: `${g.bots}%` },
              ].map(r => (
                <div key={r.label} className="rounded-xl px-3 py-2 text-center"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="text-xs font-black text-white">{r.value}</div>
                  <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
                </div>
              ))}
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setEditing({ ...g })}
              className="w-full py-2 rounded-xl font-black text-xs cursor-pointer"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.09)" }}>
              ✏️ Edit Settings
            </motion.button>
          </motion.div>
        ))}
      </div>

      {/* Edit modal */}
      {editing && (
        <>
          <div className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setEditing(null)} />
          <div className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm rounded-3xl p-6"
            style={{ transform: "translate(-50%,-50%)", background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-black">{editing.name}</h3>
              <button onClick={() => setEditing(null)} style={{ color: "rgba(255,255,255,0.4)" }} className="cursor-pointer">✕</button>
            </div>

            {[
              { label: "Entry Fee Range", field: "fee" as keyof Game },
              { label: "Max Prize Pool", field: "pool" as keyof Game },
            ].map(({ label, field }) => (
              <div key={field} className="mb-4">
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</label>
                <input
                  value={editing[field] as string}
                  onChange={e => setEditing({ ...editing, [field]: e.target.value })}
                  className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.3)" }}
                />
              </div>
            ))}

            <div className="mb-5">
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Bot Percentage (%)</label>
              <input type="number" min={0} max={100}
                value={editing.bots}
                onChange={e => setEditing({ ...editing, bots: Number(e.target.value) })}
                className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.3)" }}
              />
            </div>

            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditing(null)}
                className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                Cancel
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={saveEdit}
                className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                Save Changes
              </motion.button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
