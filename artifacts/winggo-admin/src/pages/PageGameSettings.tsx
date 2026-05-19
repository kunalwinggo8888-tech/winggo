/**
 * PageGameSettings — WINGGO Admin
 * Module 1: Game Settings & Cloud Uploader
 * - Live game cards from Firestore with inline editing
 * - Upload new game (zip → Firebase Storage → Firestore)
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeGames, upsertGame, uploadGameZip,
  GameConfig, FIREBASE_ENABLED,
} from "@/firebase/admin.service";

// ─── THEME ────────────────────────────────────────────────────────────────────

const T = {
  card:   "rgba(0,212,255,0.04)",
  border: "rgba(0,212,255,0.14)",
  blue:   "#00d4ff",
  green:  "#00ff88",
  red:    "#ff3366",
  text:   "#e2e8f0",
  muted:  "rgba(226,232,240,0.42)",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function parseFees(s: string): number[] {
  return s.split(",").map((x) => parseFloat(x.trim())).filter((n) => !isNaN(n) && n > 0);
}

function formatFees(fees: number[]): string {
  return fees.join(", ");
}

const GAME_EMOJIS: Record<string, string> = {
  ludo: "🎲", worldwar: "⚔️", cricket: "🏏", snakes: "🐍",
  carrom: "🎯", chess: "♟️", pool: "🎱", default: "🎮",
};

function gameEmoji(name: string): string {
  const key = name.toLowerCase().replace(/\s+/g, "");
  return GAME_EMOJIS[key] ?? GAME_EMOJIS.default;
}

// ─── INLINE SWITCH ────────────────────────────────────────────────────────────

function Toggle({ on, onChange, color = T.green }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="cursor-pointer"
      style={{
        width: 40, height: 22, borderRadius: 11, position: "relative",
        background: on ? `${color}22` : "rgba(255,255,255,0.07)",
        border: `1.5px solid ${on ? color : "rgba(255,255,255,0.12)"}`,
        transition: "all 0.2s",
      }}>
      <motion.div animate={{ x: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 28 }}
        style={{ width: 14, height: 14, borderRadius: 7, position: "absolute", top: 2, background: on ? color : "rgba(255,255,255,0.3)" }} />
    </button>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────

function SectionLabel({ icon, title, sub }: { icon: string; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
        style={{ background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.2)" }}>
        {icon}
      </div>
      <div>
        <h2 className="text-base font-black text-white">{title}</h2>
        {sub && <p className="text-[11px]" style={{ color: T.muted }}>{sub}</p>}
      </div>
      <div className="flex-1 h-px ml-2" style={{ background: "linear-gradient(90deg, rgba(0,212,255,0.2), transparent)" }} />
    </div>
  );
}

// ─── GAME CARD ────────────────────────────────────────────────────────────────

function GameCard({ game, onSave }: { game: GameConfig; onSave: (g: GameConfig) => Promise<void> }) {
  const [editing, setEditing]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [draft, setDraft]           = useState(game);
  const [feesStr, setFeesStr]       = useState(formatFees(game.entryFees));

  function startEdit() {
    setDraft(game);
    setFeesStr(formatFees(game.entryFees));
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    const updated: GameConfig = { ...draft, entryFees: parseFees(feesStr) };
    await onSave(updated);
    setSaving(false);
    setEditing(false);
  }

  const isLive = game.isActive && !game.isBotEnabled; // treat bot-only as maintenance indicator
  const status = game.isActive ? "LIVE" : "MAINTENANCE";

  return (
    <motion.div layout className="rounded-2xl overflow-hidden"
      style={{ background: T.card, border: `1px solid ${T.border}` }}>

      {/* Header strip */}
      <div className="px-4 pt-4 pb-3 flex items-start gap-3"
        style={{ borderBottom: `1px solid ${T.border}` }}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: "rgba(0,212,255,0.09)", border: "1px solid rgba(0,212,255,0.18)" }}>
          {gameEmoji(game.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-white">{game.name}</p>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
              style={{ background: "rgba(0,212,255,0.1)", color: T.blue }}>{game.category}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <motion.div className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: game.isActive ? T.green : T.red }}
              animate={game.isActive ? { opacity: [1, 0.3, 1] } : {}}
              transition={{ duration: 1.6, repeat: Infinity }} />
            <span className="text-[10px] font-black"
              style={{ color: game.isActive ? T.green : T.red }}>{status}</span>
          </div>
        </div>
        {!editing && (
          <motion.button whileTap={{ scale: 0.93 }} onClick={startEdit}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer shrink-0"
            style={{ background: "rgba(0,212,255,0.08)", color: T.blue, border: "1px solid rgba(0,212,255,0.2)" }}>
            ✏️ Edit
          </motion.button>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {!editing ? (
          /* View mode */
          <div className="space-y-2.5">
            <div>
              <p className="text-[9px] font-black tracking-widest mb-1" style={{ color: "rgba(0,212,255,0.45)" }}>ENTRY FEES</p>
              <div className="flex flex-wrap gap-1.5">
                {game.entryFees.map((f) => (
                  <span key={f} className="px-2.5 py-1 rounded-lg text-xs font-black"
                    style={{ background: "rgba(0,255,136,0.08)", color: T.green, border: "1px solid rgba(0,255,136,0.18)" }}>
                    ₹{f}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.2)" }}>
                <p className="text-[9px] font-black" style={{ color: T.muted }}>PRIZE MULTI</p>
                <p className="text-sm font-black text-white mt-0.5">{game.prizeMultiplier}×</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: "rgba(0,0,0,0.2)" }}>
                <p className="text-[9px] font-black" style={{ color: T.muted }}>MAX PLAYERS</p>
                <p className="text-sm font-black text-white mt-0.5">{game.maxPlayers}</p>
              </div>
            </div>
          </div>
        ) : (
          /* Edit mode */
          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>
                ENTRY FEES (comma-separated ₹)
              </label>
              <input value={feesStr} onChange={(e) => setFeesStr(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.22)", caretColor: T.blue }}
                placeholder="1, 5, 10, 50" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>
                  PRIZE MULTI
                </label>
                <input type="number" value={draft.prizeMultiplier}
                  onChange={(e) => setDraft((d) => ({ ...d, prizeMultiplier: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                  style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.22)", caretColor: T.blue }}
                  min="1" step="0.1" />
              </div>
              <div>
                <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>
                  MAX PLAYERS
                </label>
                <input type="number" value={draft.maxPlayers}
                  onChange={(e) => setDraft((d) => ({ ...d, maxPlayers: parseInt(e.target.value) || 2 }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                  style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.22)", caretColor: T.blue }}
                  min="2" max="8" />
              </div>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-bold text-white">Game Active (Live)</span>
              <Toggle on={draft.isActive} onChange={(v) => setDraft((d) => ({ ...d, isActive: v }))} color={T.green} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-sm font-bold text-white">Bot Enabled</span>
              <Toggle on={draft.isBotEnabled} onChange={(v) => setDraft((d) => ({ ...d, isBotEnabled: v }))} color={T.blue} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setEditing(false)} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-black cursor-pointer"
                style={{ background: "rgba(255,255,255,0.04)", color: T.muted, border: "1px solid rgba(255,255,255,0.1)" }}>
                Cancel
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={save} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-black cursor-pointer"
                style={{ background: saving ? "rgba(0,212,255,0.1)" : "rgba(0,212,255,0.15)", color: T.blue, border: `1px solid rgba(0,212,255,0.3)` }}>
                {saving ? "Saving…" : "💾 Save"}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── UPLOAD NEW GAME FORM ──────────────────────────────────────────────────────

const GAME_TYPES = ["HTML5", "Unity WebGL", "Native Android", "React Native"];

interface UploadForm {
  name: string;
  category: string;
  gameType: string;
  feesStr: string;
  prizeMultiplier: string;
  maxPlayers: string;
  bannerUrl: string;
}

const EMPTY_FORM: UploadForm = {
  name: "", category: "Arcade", gameType: "HTML5",
  feesStr: "5, 10, 50", prizeMultiplier: "1.8",
  maxPlayers: "2", bannerUrl: "",
};

function UploadNewGame({ onUploaded }: { onUploaded: () => void }) {
  const [form, setForm]           = useState<UploadForm>(EMPTY_FORM);
  const [zipFile, setZipFile]     = useState<File | null>(null);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState("");
  const fileRef                   = useRef<HTMLInputElement>(null);

  function setField<K extends keyof UploadForm>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".zip")) setZipFile(f);
    else setError("Only .zip files are accepted.");
  }

  async function handleSubmit() {
    if (!form.name.trim()) { setError("Game name is required."); return; }
    setError("");
    setUploading(true);
    setProgress(0);

    try {
      const gameId = `game_${form.name.toLowerCase().replace(/\s+/g, "_")}_${Date.now()}`;
      let zipUrl = "";

      if (zipFile) {
        zipUrl = await uploadGameZip(zipFile, gameId, setProgress);
      }

      const newGame: GameConfig = {
        id:              gameId,
        name:            form.name.trim(),
        category:        form.category,
        thumbnail:       form.bannerUrl || "",
        entryFees:       parseFees(form.feesStr),
        prizeMultiplier: parseFloat(form.prizeMultiplier) || 1.8,
        maxPlayers:      parseInt(form.maxPlayers) || 2,
        isActive:        true,
        isBotEnabled:    false,
        gameType:        form.gameType,
        zipUrl,
      } as GameConfig & { gameType: string; zipUrl: string };

      await upsertGame(newGame);
      setSuccess(true);
      setForm(EMPTY_FORM);
      setZipFile(null);
      setTimeout(() => { setSuccess(false); onUploaded(); }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}` }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${T.border}`, background: "rgba(0,212,255,0.03)" }}>
        <div className="text-2xl">⬆️</div>
        <div>
          <p className="text-sm font-black text-white">Upload New Game</p>
          <p className="text-[10px]" style={{ color: T.muted }}>Publish instantly to Firebase · Supports HTML5 & Unity WebGL</p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left col */}
        <div className="space-y-3">
          {[
            { label: "GAME NAME", key: "name" as const, placeholder: "e.g. Ludo Turbo" },
            { label: "CATEGORY",  key: "category" as const, placeholder: "e.g. Board, Arcade" },
          ].map(({ label, key, placeholder }) => (
            <div key={key}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>{label}</label>
              <input value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
            </div>
          ))}

          {/* Game type dropdown */}
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>GAME TYPE</label>
            <select value={form.gameType} onChange={(e) => setField("gameType", e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none cursor-pointer"
              style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(0,212,255,0.18)", color: "#e2e8f0" }}>
              {GAME_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Entry Fees */}
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>ENTRY FEES ₹ (comma-separated)</label>
            <input value={form.feesStr} onChange={(e) => setField("feesStr", e.target.value)} placeholder="5, 10, 50, 100"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "PRIZE MULTI", key: "prizeMultiplier" as const, placeholder: "1.8" },
              { label: "MAX PLAYERS", key: "maxPlayers" as const,      placeholder: "2"   },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>{label}</label>
                <input type="number" value={form[key]} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                  style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
              </div>
            ))}
          </div>
        </div>

        {/* Right col */}
        <div className="space-y-3">
          {/* Banner URL */}
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>BANNER IMAGE URL</label>
            <input value={form.bannerUrl} onChange={(e) => setField("bannerUrl", e.target.value)} placeholder="https://…/banner.jpg"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
            {form.bannerUrl && (
              <img src={form.bannerUrl} alt="" className="mt-2 w-full h-24 object-cover rounded-xl"
                style={{ border: "1px solid rgba(0,212,255,0.15)" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
          </div>

          {/* ZIP Upload zone */}
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.5)" }}>GAME ZIP FILE (.zip)</label>
            <div
              className="relative rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer"
              style={{
                height: 130,
                border: `2px dashed ${dragging ? T.blue : "rgba(0,212,255,0.22)"}`,
                background: dragging ? "rgba(0,212,255,0.07)" : "rgba(0,0,0,0.2)",
                transition: "all 0.2s",
              }}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".zip" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setZipFile(f); }} />
              {zipFile ? (
                <div className="text-center px-3">
                  <div className="text-2xl mb-1">📦</div>
                  <p className="text-xs font-black" style={{ color: T.blue }}>{zipFile.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.muted }}>
                    {(zipFile.size / 1024 / 1024).toFixed(2)} MB — Click to replace
                  </p>
                </div>
              ) : (
                <div className="text-center px-3">
                  <div className="text-3xl mb-1 opacity-60">📂</div>
                  <p className="text-xs font-bold" style={{ color: T.muted }}>Drop .zip here or click to browse</p>
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(0,212,255,0.35)" }}>HTML5 / Unity WebGL bundles</p>
                </div>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {uploading && (
            <div className="rounded-lg overflow-hidden" style={{ height: 6, background: "rgba(0,212,255,0.1)" }}>
              <motion.div animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${T.blue}, #0066ff)`, boxShadow: `0 0 8px ${T.blue}` }} />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs font-bold px-3 py-2 rounded-lg"
              style={{ background: "rgba(255,51,102,0.09)", color: T.red, border: "1px solid rgba(255,51,102,0.2)" }}>
              ⚠️ {error}
            </p>
          )}

          {/* Success */}
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs font-black px-3 py-2.5 rounded-lg flex items-center gap-2"
                style={{ background: "rgba(0,255,136,0.08)", color: T.green, border: "1px solid rgba(0,255,136,0.22)" }}>
                ✅ Game published to Firestore & Storage!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={uploading}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer flex items-center justify-center gap-2"
            style={{
              background:  uploading ? "rgba(0,212,255,0.08)" : "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(0,85,255,0.22))",
              color:       uploading ? T.muted : T.blue,
              border:      `1px solid ${uploading ? "rgba(0,212,255,0.12)" : "rgba(0,212,255,0.3)"}`,
              boxShadow:   uploading ? "none" : "0 0 20px rgba(0,212,255,0.1)",
            }}>
            {uploading ? `⏳ Uploading… ${progress}%` : "🚀 Publish Game to Firebase"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function PageGameSettings() {
  const [games, setGames]     = useState<GameConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const unsub = subscribeGames((list) => {
      setGames(list);
      setLoading(false);
    });
    return unsub;
  }, [refresh]);

  async function handleSave(g: GameConfig) {
    await upsertGame(g);
  }

  return (
    <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto">

      {/* ── Section 1: Live Games ────────────────────────────────────────── */}
      <section>
        <SectionLabel icon="🎮" title="Live Games"
          sub={`${games.filter((g) => g.isActive).length} active · ${games.length} total — all synced from Firestore`} />

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <motion.div key={i} className="rounded-2xl h-44"
                style={{ background: T.card, border: `1px solid ${T.border}` }}
                animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="rounded-2xl py-16 text-center" style={{ border: `1px dashed rgba(0,212,255,0.15)` }}>
            <p className="text-4xl mb-3 opacity-30">🎮</p>
            <p className="text-sm font-bold" style={{ color: T.muted }}>
              {FIREBASE_ENABLED ? "No games in Firestore yet — upload one below." : "Demo mode — Firebase not connected."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {games.map((g, i) => (
                <motion.div key={g.id ?? i}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}>
                  <GameCard game={g} onSave={handleSave} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* ── Section 2: Upload New Game ───────────────────────────────────── */}
      <section>
        <SectionLabel icon="⬆️" title="Upload New Game"
          sub="Add a new game — zipped bundle uploads to Firebase Storage, metadata saves to Firestore" />
        <UploadNewGame onUploaded={() => setRefresh((r) => r + 1)} />
      </section>
    </div>
  );
}
