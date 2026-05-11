import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeGames, upsertGame, removeGame, seedGamesIfEmpty,
  GameConfig, DEFAULT_GAMES,
} from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const CATEGORIES = ["board", "battle", "sports", "card", "arcade", "puzzle"];

const EMOJI_MAP: Record<string, string> = {
  board: "🎲", battle: "⚔️", sports: "🏏", card: "🃏", arcade: "🎯", puzzle: "🧩",
};
const EMOJI_PICKER = ["🎲","⚔️","🏏","🃏","🎯","🧩","🎱","🐍","🪀","⚽","🏀","🎮","🎰","🚀","💣","🌟","🫧","🃏"];

const BLANK: Omit<GameConfig, "id"> = {
  name: "", category: "board", thumbnail: "🎮",
  entryFees: [10, 25, 50], prizeMultiplier: 1.8,
  maxPlayers: 2, isActive: true, isBotEnabled: true, botJoinDelaySec: 15,
  description: "",
};

const Toggle = ({ val, onChange, color = "#34d399" }: { val: boolean; onChange: () => void; color?: string }) => (
  <motion.div whileTap={{ scale: 0.9 }} onClick={onChange}
    className="w-11 h-6 rounded-full relative cursor-pointer shrink-0"
    style={{ background: val ? `${color}28` : "rgba(255,255,255,0.08)", border: `1px solid ${val ? color : "rgba(255,255,255,0.15)"}` }}>
    <motion.div animate={{ x: val ? 20 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute top-1 w-4 h-4 rounded-full"
      style={{ background: val ? color : "rgba(255,255,255,0.35)" }} />
  </motion.div>
);

export default function PageGameAPI() {
  const [games, setGames]       = useState<GameConfig[]>(DEFAULT_GAMES);
  const [editing, setEditing]   = useState<GameConfig | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [search, setSearch]     = useState("");
  const [catFilter, setCat]     = useState("All");
  const [showJson, setShowJson] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seeded, setSeeded]     = useState(false);

  // Seed on first load, then subscribe live
  useEffect(() => {
    if (FIREBASE_ENABLED && !seeded) {
      setSeeded(true);
      seedGamesIfEmpty().catch(console.error);
    }
    const unsub = subscribeGames(setGames);
    return unsub;
  }, [seeded]);

  const filtered = games.filter((g) =>
    (catFilter === "All" || g.category === catFilter) &&
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  function openNew() { setEditing({ ...BLANK, id: "" }); setIsNew(true); }
  function openEdit(g: GameConfig) { setEditing({ ...g }); setIsNew(false); }

  async function saveGame() {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    const data = { ...editing };
    if (!data.id) delete data.id;
    if (FIREBASE_ENABLED) {
      await upsertGame(data).catch(console.error);
    } else {
      setGames((prev) =>
        isNew
          ? [...prev, { ...data, id: String(Date.now()) }]
          : prev.map((g) => g.id === data.id ? data : g)
      );
    }
    setSaving(false);
    setEditing(null);
  }

  async function handleDelete(id?: string) {
    if (!id) return;
    setDeleting(id);
    if (FIREBASE_ENABLED) {
      await removeGame(id).catch(console.error);
    } else {
      setGames((prev) => prev.filter((g) => g.id !== id));
    }
    setDeleting(null);
  }

  async function toggleActive(g: GameConfig) {
    const updated = { ...g, isActive: !g.isActive };
    if (FIREBASE_ENABLED) {
      await upsertGame(updated).catch(console.error);
    } else {
      setGames((prev) => prev.map((x) => x.id === g.id ? updated : x));
    }
  }

  function updateEntryFees(raw: string) {
    if (!editing) return;
    const fees = raw.split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
    setEditing({ ...editing, entryFees: fees });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input placeholder="Search games…" value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["All", ...CATEGORIES].map((c) => (
            <motion.button key={c} whileTap={{ scale: 0.95 }} onClick={() => setCat(c)}
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
          + Add Game
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Games", value: games.length,                          color: "#7c3aed", icon: "🎮" },
          { label: "Active",      value: games.filter((g) => g.isActive).length,color: "#34d399", icon: "🟢" },
          { label: "With Bots",   value: games.filter((g) => g.isBotEnabled).length, color: "#FFD700", icon: "🤖" },
          { label: "Firebase",    value: FIREBASE_ENABLED ? "Live" : "Demo",    color: "#60a5fa", icon: "🔥" },
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

      {/* Firebase live badge */}
      {FIREBASE_ENABLED && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          🔥 Live Firebase sync — game changes propagate to players instantly
        </div>
      )}

      {/* Game cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence>
          {filtered.map((g) => (
            <motion.div key={g.id ?? g.name} layout
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="rounded-2xl p-4 relative overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: g.isActive ? "1px solid rgba(255,215,0,0.14)" : "1px solid rgba(255,255,255,0.07)",
              }}>

              <div className="flex items-start gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: g.isActive ? "rgba(255,215,0,0.10)" : "rgba(255,255,255,0.05)", border: `1px solid ${g.isActive ? "rgba(255,215,0,0.2)" : "rgba(255,255,255,0.08)"}` }}>
                  {g.thumbnail}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-white truncate">{g.name}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {EMOJI_MAP[g.category] ?? "🎮"} {g.category} · {g.maxPlayers}P
                  </div>
                  <div className="text-[9px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Entry: ₹{g.entryFees.join(" / ₹")}
                  </div>
                </div>
                {/* Live toggle */}
                <Toggle val={g.isActive} onChange={() => toggleActive(g)} color="#34d399" />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Min Entry",   value: `₹${Math.min(...g.entryFees)}` },
                  { label: "Prize ×",    value: `${g.prizeMultiplier}×` },
                  { label: "Bot Delay",  value: `${g.botJoinDelaySec}s` },
                ].map((r) => (
                  <div key={r.label} className="rounded-xl p-2 text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-xs font-black text-white">{r.value}</div>
                    <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 mb-3">
                {g.isBotEnabled && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-black"
                    style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>🤖 Bot Fill</span>
                )}
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${g.isActive ? "" : ""}`}
                  style={{ background: g.isActive ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.07)", color: g.isActive ? "#34d399" : "rgba(255,255,255,0.35)" }}>
                  {g.isActive ? "🟢 Live" : "⚫ Off"}
                </span>
              </div>

              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => openEdit(g)}
                  className="flex-1 py-2 rounded-xl font-black text-xs cursor-pointer"
                  style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
                  ✏️ Edit
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => setShowJson(showJson === (g.id ?? "") ? null : (g.id ?? ""))}
                  className="py-2 px-3 rounded-xl font-black text-xs cursor-pointer"
                  style={{ background: "rgba(96,165,250,0.10)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                  {"{ }"}
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => handleDelete(g.id)}
                  disabled={deleting === g.id}
                  className="py-2 px-3 rounded-xl font-black text-xs cursor-pointer disabled:opacity-40"
                  style={{ background: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                  {deleting === g.id ? "…" : "🗑"}
                </motion.button>
              </div>

              <AnimatePresence>
                {showJson === (g.id ?? "") && (
                  <motion.pre
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="text-[10px] mt-3 rounded-xl p-3 overflow-x-auto"
                    style={{ background: "#08051a", color: "#34d399", fontFamily: "monospace", lineHeight: 1.6 }}>
                    {JSON.stringify({ id: g.id, name: g.name, entryFees: g.entryFees, prizeMultiplier: g.prizeMultiplier, isActive: g.isActive, isBotEnabled: g.isBotEnabled, botJoinDelaySec: g.botJoinDelaySec }, null, 2)}
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
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>

              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-base">{isNew ? "➕ Add New Game" : `✏️ Edit — ${editing.name}`}</h3>
                <button onClick={() => setEditing(null)} className="cursor-pointer" style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
              </div>

              {/* Emoji picker */}
              <div className="mb-4">
                <label className="text-xs font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.5)" }}>Game Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {EMOJI_PICKER.map((e) => (
                    <motion.button key={e} whileTap={{ scale: 0.85 }} onClick={() => setEditing({ ...editing, thumbnail: e })}
                      className="w-10 h-10 rounded-xl text-xl flex items-center justify-center cursor-pointer"
                      style={{
                        background: editing.thumbnail === e ? "rgba(255,215,0,0.18)" : "rgba(255,255,255,0.05)",
                        border: editing.thumbnail === e ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      }}>
                      {e}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Game Name",           key: "name",            type: "text",   placeholder: "Bubble Shooter", full: true },
                  { label: "Description",          key: "description",     type: "text",   placeholder: "2-player skill game", full: true },
                  { label: "Entry Fees (₹, CSV)", key: "entryFeesRaw",   type: "text",   placeholder: "5, 10, 25, 50", full: true },
                  { label: "Prize Multiplier",     key: "prizeMultiplier", type: "number", placeholder: "1.8" },
                  { label: "Max Players",          key: "maxPlayers",      type: "number", placeholder: "2" },
                  { label: "Bot Join Delay (s)",   key: "botJoinDelaySec", type: "number", placeholder: "15" },
                ].map((f) => (
                  <div key={f.key} className={f.full ? "col-span-2" : ""}>
                    <label className="text-[10px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.45)" }}>{f.label}</label>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={
                        f.key === "entryFeesRaw"
                          ? editing.entryFees.join(", ")
                          : String((editing as unknown as Record<string, unknown>)[f.key] ?? "")
                      }
                      onChange={(e) => {
                        if (f.key === "entryFeesRaw") {
                          updateEntryFees(e.target.value);
                        } else {
                          setEditing({ ...editing, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value });
                        }
                      }}
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
                  {CATEGORIES.map((c) => (
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

              {/* Toggles */}
              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { label: "Active / Live",    key: "isActive",      color: "#34d399" },
                  { label: "Bot Auto-Fill 🤖", key: "isBotEnabled",  color: "#60a5fa" },
                ].map((t) => (
                  <div key={t.key} className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{t.label}</span>
                    <Toggle
                      val={!!editing[t.key as keyof GameConfig]}
                      onChange={() => setEditing({ ...editing, [t.key]: !editing[t.key as keyof GameConfig] })}
                      color={t.color}
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditing(null)}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)" }}>
                  Cancel
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={saveGame} disabled={saving}
                  className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}>
                  {saving ? "Saving…" : isNew ? "🚀 Add Game" : "💾 Save Changes"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
