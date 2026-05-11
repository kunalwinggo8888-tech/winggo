import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Game = {
  id: number;
  name: string;
  category: string;
  image: string;
  apiUrl: string;
  entryFee: number;
  prizeAmount: number;
  matchTimer: number;
  botPercent: number;
  status: boolean;
  featured: boolean;
  trending: boolean;
  players: string;
  comingSoon: boolean;
};

const CATEGORIES = ["Board", "Battle", "Sports", "Card", "Casual", "Puzzle"];

const EMOJI_MAP: Record<string, string> = {
  Board: "🎲", Battle: "⚔️", Sports: "🏏", Card: "🃏", Casual: "🎯", Puzzle: "🧩",
};

const INITIAL_GAMES: Game[] = [
  { id: 1,  name: "Ludo Classic",      category: "Board",  image: "🎲", apiUrl: "/api/games/ludo",          entryFee: 10,  prizeAmount: 18,   matchTimer: 20, botPercent: 30, status: true,  featured: true,  trending: true,  players: "2-4", comingSoon: false },
  { id: 2,  name: "World War",         category: "Battle", image: "⚔️", apiUrl: "/api/games/worldwar",      entryFee: 20,  prizeAmount: 36,   matchTimer: 10, botPercent: 25, status: true,  featured: true,  trending: true,  players: "2",   comingSoon: false },
  { id: 3,  name: "Carrom",            category: "Board",  image: "🪀", apiUrl: "/api/games/carrom",        entryFee: 5,   prizeAmount: 9,    matchTimer: 15, botPercent: 40, status: false, featured: false, trending: false, players: "2",   comingSoon: false },
  { id: 4,  name: "Snake & Ladder",    category: "Board",  image: "🐍", apiUrl: "/api/games/snakeladder",   entryFee: 2,   prizeAmount: 3.6,  matchTimer: 12, botPercent: 50, status: true,  featured: false, trending: false, players: "2-4", comingSoon: false },
  { id: 5,  name: "Cricket",           category: "Sports", image: "🏏", apiUrl: "/api/games/cricket",       entryFee: 25,  prizeAmount: 45,   matchTimer: 8,  botPercent: 20, status: true,  featured: false, trending: true,  players: "2",   comingSoon: false },
  { id: 6,  name: "Bubble Shooter",    category: "Casual", image: "🎯", apiUrl: "/api/games/bubble",        entryFee: 5,   prizeAmount: 9,    matchTimer: 5,  botPercent: 0,  status: false, featured: false, trending: false, players: "1",   comingSoon: true  },
  { id: 7,  name: "Pool / 8-Ball",     category: "Board",  image: "🎱", apiUrl: "/api/games/pool",          entryFee: 15,  prizeAmount: 27,   matchTimer: 8,  botPercent: 30, status: false, featured: false, trending: false, players: "2",   comingSoon: true  },
  { id: 8,  name: "Teen Patti",        category: "Card",   image: "🃏", apiUrl: "/api/games/teenpatti",     entryFee: 50,  prizeAmount: 90,   matchTimer: 15, botPercent: 20, status: false, featured: false, trending: false, players: "3-6", comingSoon: true  },
];

const BLANK_GAME: Omit<Game, "id"> = {
  name: "", category: "Board", image: "🎮", apiUrl: "", entryFee: 10, prizeAmount: 18,
  matchTimer: 10, botPercent: 30, status: true, featured: false, trending: false, players: "2", comingSoon: false,
};

const EMOJI_PICKER = ["🎲","⚔️","🏏","🃏","🎯","🧩","🎱","🐍","🪀","⚽","🏀","🎮","🎰","🚀","💣","🌟"];

export default function PageGameAPI() {
  const [games, setGames]     = useState<Game[]>(INITIAL_GAMES);
  const [editing, setEditing] = useState<Game | null>(null);
  const [isNew, setIsNew]     = useState(false);
  const [search, setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState("All");
  const [showJson, setShowJson]   = useState<number | null>(null);

  const filtered = games.filter(g =>
    (catFilter === "All" || g.category === catFilter) &&
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  function openEdit(g: Game) {
    setEditing({ ...g });
    setIsNew(false);
  }

  function openNew() {
    setEditing({ ...BLANK_GAME, id: Date.now() });
    setIsNew(true);
  }

  function saveGame() {
    if (!editing) return;
    if (isNew) {
      setGames(prev => [...prev, editing]);
    } else {
      setGames(prev => prev.map(g => g.id === editing.id ? editing : g));
    }
    setEditing(null);
  }

  function deleteGame(id: number) {
    setGames(prev => prev.filter(g => g.id !== id));
  }

  function toggleField(id: number, field: "status" | "featured" | "trending" | "comingSoon") {
    setGames(prev => prev.map(g => g.id === id ? { ...g, [field]: !g[field] } : g));
  }

  const Toggle = ({ val, onChange, color = "#34d399" }: { val: boolean; onChange: () => void; color?: string }) => (
    <motion.div whileTap={{ scale: 0.9 }} onClick={onChange}
      className="w-11 h-6 rounded-full relative cursor-pointer shrink-0"
      style={{ background: val ? `${color}28` : "rgba(255,255,255,0.08)", border: `1px solid ${val ? color : "rgba(255,255,255,0.15)"}` }}>
      <motion.div animate={{ x: val ? 20 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full"
        style={{ background: val ? color : "rgba(255,255,255,0.35)" }} />
    </motion.div>
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input placeholder="Search games…" value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }}
          />
        </div>

        {/* Category pills */}
        <div className="flex gap-1.5 flex-wrap">
          {["All", ...CATEGORIES].map(c => (
            <motion.button key={c} whileTap={{ scale: 0.95 }} onClick={() => setCatFilter(c)}
              className="px-3 py-1.5 rounded-xl font-bold text-xs cursor-pointer"
              style={{
                background: catFilter === c ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
                color: catFilter === c ? "#FFD700" : "rgba(255,255,255,0.4)",
                border: `1px solid ${catFilter === c ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.08)"}`,
              }}>
              {EMOJI_MAP[c] ?? "🎮"} {c}
            </motion.button>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.95 }} onClick={openNew}
          className="px-4 py-2.5 rounded-xl font-black text-xs cursor-pointer shrink-0"
          style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 20px rgba(255,215,0,0.25)" }}>
          + Add New Game
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Games",    value: games.length,                            color: "#7c3aed", icon: "🎮" },
          { label: "Active",         value: games.filter(g => g.status).length,      color: "#34d399", icon: "🟢" },
          { label: "Featured",       value: games.filter(g => g.featured).length,    color: "#FFD700", icon: "⭐" },
          { label: "Coming Soon",    value: games.filter(g => g.comingSoon).length,  color: "#60a5fa", icon: "🚀" },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-xl mb-1.5">{s.icon}</div>
            <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Game cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((g) => (
            <motion.div key={g.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: g.status ? "1px solid rgba(255,215,0,0.14)" : "1px solid rgba(255,255,255,0.07)",
              }}
            >
              {/* Badges */}
              <div className="absolute top-3 right-3 flex gap-1 flex-wrap justify-end">
                {g.featured && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                    style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>⭐ Featured</span>
                )}
                {g.trending && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                    style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>🔥 Trending</span>
                )}
                {g.comingSoon && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                    style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>🚀 Soon</span>
                )}
              </div>

              {/* Header */}
              <div className="flex items-start gap-3 mb-4 pr-24">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: g.status ? "rgba(255,215,0,0.10)" : "rgba(255,255,255,0.05)", border: `1px solid ${g.status ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.08)"}` }}>
                  {g.image}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white truncate">{g.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {EMOJI_MAP[g.category] ?? "🎮"} {g.category} · {g.players} players
                  </div>
                  <div className="text-[9px] mt-0.5 font-mono truncate" style={{ color: "rgba(255,255,255,0.25)" }}>{g.apiUrl}</div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Entry Fee", value: `₹${g.entryFee}` },
                  { label: "Prize",     value: `₹${g.prizeAmount}` },
                  { label: "Timer",     value: `${g.matchTimer}m` },
                ].map(r => (
                  <div key={r.label} className="rounded-xl p-2 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-xs font-black text-white">{r.value}</div>
                    <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
                  </div>
                ))}
              </div>

              {/* Toggles row */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Toggle val={g.status}   onChange={() => toggleField(g.id, "status")}   color="#34d399" />
                  <span className="text-[10px] font-bold" style={{ color: g.status ? "#34d399" : "rgba(255,255,255,0.3)" }}>
                    {g.status ? "Live" : "Off"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Toggle val={g.featured} onChange={() => toggleField(g.id, "featured")} color="#FFD700" />
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>Featured</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Toggle val={g.trending} onChange={() => toggleField(g.id, "trending")} color="#f87171" />
                  <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>Trending</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => openEdit(g)}
                  className="flex-1 py-2 rounded-xl font-black text-xs cursor-pointer"
                  style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
                  ✏️ Edit
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowJson(showJson === g.id ? null : g.id)}
                  className="py-2 px-3 rounded-xl font-black text-xs cursor-pointer"
                  style={{ background: "rgba(96,165,250,0.10)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                  {"{ }"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => deleteGame(g.id)}
                  className="py-2 px-3 rounded-xl font-black text-xs cursor-pointer"
                  style={{ background: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                  🗑
                </motion.button>
              </div>

              {/* JSON preview */}
              <AnimatePresence>
                {showJson === g.id && (
                  <motion.pre
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="text-[10px] mt-3 rounded-xl p-3 overflow-x-auto no-scrollbar"
                    style={{ background: "#08051a", color: "#34d399", fontFamily: "monospace", lineHeight: 1.6 }}>
                    {JSON.stringify({ game: g.name, entryFee: g.entryFee, prizeAmount: g.prizeAmount, status: g.status, featured: g.featured, trending: g.trending, botPercent: g.botPercent, matchTimer: g.matchTimer, apiUrl: g.apiUrl }, null, 2)}
                  </motion.pre>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Edit / Add Modal */}
      <AnimatePresence>
        {editing && (
          <>
            <motion.div className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditing(null)} />
            <motion.div
              className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg rounded-3xl p-6 overflow-y-auto"
              style={{ transform: "translate(-50%,-50%)", maxHeight: "90vh", background: "#0d0a1e", border: "1px solid rgba(255,215,0,0.22)", boxShadow: "0 24px 80px rgba(0,0,0,0.85)" }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-base">{isNew ? "➕ Add New Game" : `✏️ Edit — ${editing.name}`}</h3>
                <button onClick={() => setEditing(null)} className="cursor-pointer" style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
              </div>

              {/* Emoji picker */}
              <div className="mb-4">
                <label className="text-xs font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>Game Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_PICKER.map(e => (
                    <motion.button key={e} whileTap={{ scale: 0.85 }} onClick={() => setEditing({ ...editing, image: e })}
                      className="w-10 h-10 rounded-xl text-xl flex items-center justify-center cursor-pointer"
                      style={{
                        background: editing.image === e ? "rgba(255,215,0,0.18)" : "rgba(255,255,255,0.05)",
                        border: editing.image === e ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                      {e}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Game Name",    field: "name",        type: "text",   placeholder: "Bubble Shooter" },
                  { label: "API URL",      field: "apiUrl",      type: "text",   placeholder: "/api/games/bubble" },
                  { label: "Entry Fee (₹)",field: "entryFee",    type: "number", placeholder: "10" },
                  { label: "Prize (₹)",    field: "prizeAmount", type: "number", placeholder: "18" },
                  { label: "Timer (mins)", field: "matchTimer",  type: "number", placeholder: "10" },
                  { label: "Bot % Fill",   field: "botPercent",  type: "number", placeholder: "30" },
                  { label: "Players",      field: "players",     type: "text",   placeholder: "2-4" },
                ].map(f => (
                  <div key={f.field} className={f.field === "name" || f.field === "apiUrl" ? "col-span-2" : ""}>
                    <label className="text-[10px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.45)" }}>{f.label}</label>
                    <input
                      type={f.type} placeholder={f.placeholder}
                      value={editing[f.field as keyof Game] as string | number}
                      onChange={e => setEditing({ ...editing, [f.field]: f.type === "number" ? Number(e.target.value) : e.target.value })}
                      className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.2)", caretColor: "#FFD700" }}
                    />
                  </div>
                ))}
              </div>

              {/* Category */}
              <div className="mb-4">
                <label className="text-[10px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>Category</label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(c => (
                    <motion.button key={c} whileTap={{ scale: 0.95 }} onClick={() => setEditing({ ...editing, category: c })}
                      className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                      style={{
                        background: editing.category === c ? "rgba(255,215,0,0.14)" : "rgba(255,255,255,0.05)",
                        color: editing.category === c ? "#FFD700" : "rgba(255,255,255,0.4)",
                        border: `1px solid ${editing.category === c ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {EMOJI_MAP[c] ?? "🎮"} {c}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Toggles in modal */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { label: "Active / Live",  field: "status",      color: "#34d399" },
                  { label: "Featured",       field: "featured",    color: "#FFD700" },
                  { label: "Trending 🔥",    field: "trending",    color: "#f87171" },
                  { label: "Coming Soon 🚀", field: "comingSoon",  color: "#60a5fa" },
                ].map(t => (
                  <div key={t.field} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{t.label}</span>
                    <motion.div whileTap={{ scale: 0.9 }}
                      onClick={() => setEditing({ ...editing, [t.field]: !editing[t.field as keyof Game] })}
                      className="w-10 h-5 rounded-full relative cursor-pointer"
                      style={{
                        background: (editing[t.field as keyof Game] as boolean) ? `${t.color}28` : "rgba(255,255,255,0.08)",
                        border: `1px solid ${(editing[t.field as keyof Game] as boolean) ? t.color : "rgba(255,255,255,0.15)"}`,
                      }}>
                      <motion.div
                        animate={{ x: (editing[t.field as keyof Game] as boolean) ? 18 : 2 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="absolute top-[3px] w-3 h-3 rounded-full"
                        style={{ background: (editing[t.field as keyof Game] as boolean) ? t.color : "rgba(255,255,255,0.35)" }}
                      />
                    </motion.div>
                  </div>
                ))}
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditing(null)}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  Cancel
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={saveGame}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}>
                  {isNew ? "🚀 Add Game" : "💾 Save Changes"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
