import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface EntryFee {
  id: number;
  fee: number;
  win: number;
  status: "on" | "off";
  tag?: "HOT" | "LIVE" | "NEW" | "BONUS" | "";
  bonus?: number;
  limited?: boolean;
  limitedEnds?: string;
}

type AnimType = "slide" | "bounce" | "zoom" | "flip" | "glow";
type BgColor  = "#1a0533" | "#0a0f2e" | "#0d1f0a" | "#1a0a00" | "#001a1a";
type BtnColor = "#7c3aed" | "#FFD700" | "#22d3ee" | "#34d399" | "#f97316";

interface GamePopup {
  enabled:    boolean;
  bannerImg:  string;
  bannerText: string;
  animation:  AnimType;
  bgColor:    BgColor;
  btnColor:   BtnColor;
  glowColor:  string;
  showGlow:   boolean;
  scheduleEnabled: boolean;
  scheduleStart:   string;
  scheduleEnd:     string;
  tiers:      EntryFee[];
}

interface Game {
  id:    string;
  name:  string;
  icon:  string;
  color: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const WIN_RATIO = 0.85;

const GAMES: Game[] = [
  { id: "ludo",    name: "Ludo",    icon: "🎲", color: "#7c3aed" },
  { id: "carrom",  name: "Carrom",  icon: "🎯", color: "#FFD700" },
  { id: "cricket", name: "Cricket", icon: "🏏", color: "#22d3ee" },
  { id: "snake",   name: "Snake",   icon: "🐍", color: "#34d399" },
  { id: "subway",  name: "Subway",  icon: "🚇", color: "#f97316" },
  { id: "quiz",    name: "Quiz",    icon: "🧠", color: "#ec4899" },
];

const ANIM_OPTIONS: { id: AnimType; label: string; icon: string }[] = [
  { id: "slide",  label: "Slide Up",  icon: "⬆️" },
  { id: "bounce", label: "Bounce",    icon: "🔄" },
  { id: "zoom",   label: "Zoom In",   icon: "🔍" },
  { id: "flip",   label: "Flip",      icon: "🔃" },
  { id: "glow",   label: "Neon Glow", icon: "✨" },
];

const BG_COLORS: { val: BgColor; label: string }[] = [
  { val: "#1a0533", label: "Deep Purple" },
  { val: "#0a0f2e", label: "Navy Dark"   },
  { val: "#0d1f0a", label: "Dark Green"  },
  { val: "#1a0a00", label: "Dark Ember"  },
  { val: "#001a1a", label: "Dark Teal"   },
];

const BTN_COLORS: { val: BtnColor; label: string }[] = [
  { val: "#7c3aed", label: "Purple" },
  { val: "#FFD700", label: "Gold"   },
  { val: "#22d3ee", label: "Cyan"   },
  { val: "#34d399", label: "Green"  },
  { val: "#f97316", label: "Orange" },
];

const TAGS = ["", "HOT", "LIVE", "NEW", "BONUS"] as const;

const DEFAULT_TIERS = (base = 1): EntryFee[] =>
  [1, 5, 10, 20, 50, 100].map((fee, i) => ({
    id: base + i,
    fee,
    win: Math.round(fee * WIN_RATIO * 100) / 100,
    status: "on",
    tag: fee === 50 ? "HOT" : fee === 10 ? "LIVE" : "",
  }));

const makeDefaultPopup = (): GamePopup => ({
  enabled:        true,
  bannerImg:      "",
  bannerText:     "WIN REAL CASH",
  animation:      "slide",
  bgColor:        "#1a0533",
  btnColor:       "#7c3aed",
  glowColor:      "#7c3aed",
  showGlow:       true,
  scheduleEnabled:false,
  scheduleStart:  "00:00",
  scheduleEnd:    "23:59",
  tiers:          DEFAULT_TIERS(),
});

const GAME_POPUPS_INIT: Record<string, GamePopup> = Object.fromEntries(
  GAMES.map(g => [g.id, makeDefaultPopup()])
);

// ─── LIVE PREVIEW ─────────────────────────────────────────────────────────────

function LivePreview({ game, popup }: { game: Game; popup: GamePopup }) {
  const shownTiers = popup.tiers.filter(t => t.status === "on").slice(0, 6);

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-2 mb-3">
        <motion.div className="w-2 h-2 rounded-full" style={{ background: "#34d399" }}
          animate={{ opacity: [1,0.3,1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        <span className="text-xs font-black" style={{ color: "#34d399" }}>LIVE PREVIEW</span>
      </div>

      <div
        className="rounded-3xl overflow-hidden relative"
        style={{
          width: 240,
          background: popup.bgColor,
          border: popup.showGlow ? `1.5px solid ${popup.glowColor}50` : "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: popup.showGlow ? `0 0 28px ${popup.glowColor}40, 0 0 60px ${popup.glowColor}18` : "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        {/* Floating orbs */}
        {popup.showGlow && (
          <>
            <div className="absolute w-16 h-16 rounded-full top-[-12px] right-[-8px] pointer-events-none"
              style={{ background: `radial-gradient(circle,${popup.glowColor}30,transparent)`, filter: "blur(12px)" }} />
            <div className="absolute w-20 h-20 rounded-full bottom-4 left-[-10px] pointer-events-none"
              style={{ background: `radial-gradient(circle,${popup.btnColor}25,transparent)`, filter: "blur(16px)" }} />
          </>
        )}

        {/* Banner */}
        <div className="px-4 pt-4 pb-3 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${game.color}22`, border: `1.5px solid ${game.color}50` }}>
            {game.icon}
          </div>
          <div>
            <div className="font-black text-white text-sm">{game.name}</div>
            <div className="text-[10px] font-bold" style={{ color: `${game.color}` }}>{popup.bannerText}</div>
          </div>
        </div>

        {/* Tier grid */}
        <div className="px-3 pb-3 grid grid-cols-3 gap-1.5">
          {shownTiers.map(t => (
            <div key={t.id} className="rounded-xl p-2 text-center relative"
              style={{ background: "rgba(255,255,255,0.06)", border: `1px solid rgba(255,255,255,0.09)` }}>
              {t.tag && (
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black px-1.5 py-0.5 rounded-full"
                  style={{
                    background: t.tag === "HOT" ? "#ef4444" : t.tag === "LIVE" ? "#7c3aed" : t.tag === "NEW" ? "#22d3ee" : t.tag === "BONUS" ? "#FFD700" : "#fff",
                    color: t.tag === "BONUS" ? "#000" : "#fff",
                  }}>{t.tag}</div>
              )}
              <div className="text-[10px] font-black text-white mt-1">₹{t.fee}</div>
              <div className="text-[8px]" style={{ color: "#34d399" }}>WIN ₹{t.win}</div>
              <div className="mt-1 rounded-lg py-0.5 text-[8px] font-black"
                style={{ background: popup.btnColor, color: popup.btnColor === "#FFD700" ? "#000" : "#fff" }}>
                PLAY
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 pb-3 flex justify-between items-center">
          <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>🔒 Safe &amp; Secure</span>
          <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>85% Win Ratio</span>
        </div>
      </div>

      {popup.scheduleEnabled && (
        <div className="mt-3 px-3 py-2 rounded-xl text-center"
          style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.15)" }}>
          <div className="text-[9px] font-black" style={{ color: "#FFD700" }}>⏰ SCHEDULED</div>
          <div className="text-[10px] text-white mt-0.5">{popup.scheduleStart} → {popup.scheduleEnd}</div>
        </div>
      )}
    </div>
  );
}

// ─── FEE ROW ──────────────────────────────────────────────────────────────────

function FeeRow({
  tier, onEdit, onDelete, onToggle,
}: { tier: EntryFee; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const TAG_COLORS: Record<string, { bg: string; color: string }> = {
    HOT:   { bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
    LIVE:  { bg: "rgba(124,58,237,0.15)",  color: "#a78bfa" },
    NEW:   { bg: "rgba(34,211,238,0.15)",  color: "#22d3ee" },
    BONUS: { bg: "rgba(255,215,0,0.15)",   color: "#FFD700" },
  };
  const tc = tier.tag ? TAG_COLORS[tier.tag] : null;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="border-b"
      style={{ borderColor: "rgba(255,255,255,0.04)" }}
    >
      <td className="py-3 px-4 text-sm font-black text-white">
        ₹{tier.fee}
        {tc && (
          <span className="ml-2 text-[9px] font-black px-1.5 py-0.5 rounded-full"
            style={{ background: tc.bg, color: tc.color }}>{tier.tag}</span>
        )}
      </td>
      <td className="py-3 px-4 text-sm font-bold" style={{ color: "#34d399" }}>₹{tier.win}</td>
      <td className="py-3 px-4">
        <motion.div
          whileTap={{ scale: 0.93 }}
          onClick={onToggle}
          className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-1 rounded-full text-[10px] font-black"
          style={{
            background: tier.status === "on" ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.10)",
            border: `1px solid ${tier.status === "on" ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.25)"}`,
            color: tier.status === "on" ? "#34d399" : "#f87171",
          }}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${tier.status === "on" ? "bg-green-400" : "bg-red-400"}`} />
          {tier.status === "on" ? "LIVE" : "OFF"}
        </motion.div>
      </td>
      <td className="py-3 px-4">
        {tier.limited && tier.limitedEnds && (
          <span className="text-[10px] font-bold" style={{ color: "#FFD700" }}>⏰ Until {tier.limitedEnds}</span>
        )}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <motion.button whileTap={{ scale: 0.9 }} onClick={onEdit}
            className="px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa" }}>
            ✏️ Edit
          </motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onDelete}
            className="px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
            style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            🗑
          </motion.button>
        </div>
      </td>
    </motion.tr>
  );
}

// ─── EDIT TIER MODAL ──────────────────────────────────────────────────────────

function EditTierModal({
  tier, onSave, onClose,
}: { tier: EntryFee | null; onSave: (t: EntryFee) => void; onClose: () => void }) {
  const isNew = !tier;
  const [form, setForm] = useState<EntryFee>(
    tier ?? { id: Date.now(), fee: 25, win: 21.25, status: "on", tag: "", limited: false, limitedEnds: "" }
  );

  function setFee(v: number) {
    setForm(f => ({ ...f, fee: v, win: Math.round(v * WIN_RATIO * 100) / 100 }));
  }

  return (
    <motion.div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.88, y: 30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={e => e.stopPropagation()}
        className="rounded-3xl p-6 w-full max-w-sm"
        style={{ background: "#110c22", border: "1px solid rgba(124,58,237,0.35)", boxShadow: "0 0 60px rgba(124,58,237,0.25)" }}>

        <div className="flex items-center justify-between mb-5">
          <h3 className="font-black text-white text-base">{isNew ? "➕ Add Entry Tier" : "✏️ Edit Entry Tier"}</h3>
          <button onClick={onClose} className="text-xl cursor-pointer" style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
        </div>

        <div className="space-y-4">
          {/* Entry Fee */}
          <div>
            <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>ENTRY FEE (₹)</label>
            <input
              type="number" value={form.fee}
              onChange={e => setFee(Number(e.target.value))}
              className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(124,58,237,0.3)" }}
            />
          </div>

          {/* Win Amount */}
          <div>
            <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>WIN AMOUNT (₹) — auto-calculated at 85%</label>
            <input
              type="number" value={form.win}
              onChange={e => setForm(f => ({ ...f, win: Number(e.target.value) }))}
              className="w-full rounded-xl px-4 py-2.5 font-bold text-sm outline-none"
              style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.25)", color: "#34d399" }}
            />
          </div>

          {/* Tag */}
          <div>
            <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>TAG</label>
            <div className="flex gap-2 flex-wrap">
              {TAGS.map(tag => (
                <button key={tag} onClick={() => setForm(f => ({ ...f, tag }))}
                  className="px-3 py-1 rounded-full text-[10px] font-black cursor-pointer transition-all"
                  style={{
                    background: form.tag === tag
                      ? tag === "HOT" ? "#ef4444" : tag === "LIVE" ? "#7c3aed" : tag === "NEW" ? "#22d3ee" : tag === "BONUS" ? "#FFD700" : "rgba(255,255,255,0.15)"
                      : "rgba(255,255,255,0.06)",
                    color: form.tag === tag ? (tag === "BONUS" ? "#000" : "#fff") : "rgba(255,255,255,0.45)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}>
                  {tag || "None"}
                </button>
              ))}
            </div>
          </div>

          {/* Bonus */}
          <div>
            <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>BONUS LABEL (₹ extra — optional)</label>
            <input
              type="number" value={form.bonus ?? ""}
              placeholder="e.g. 5"
              onChange={e => setForm(f => ({ ...f, bonus: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,215,0,0.2)" }}
            />
          </div>

          {/* Limited Offer */}
          <div className="flex items-center gap-3">
            <motion.div
              onClick={() => setForm(f => ({ ...f, limited: !f.limited }))}
              className="w-10 h-5.5 rounded-full relative cursor-pointer"
              style={{ background: form.limited ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)", border: `1px solid ${form.limited ? "#FFD700" : "rgba(255,255,255,0.15)"}` }}>
              <motion.div animate={{ x: form.limited ? 20 : 2 }}
                className="absolute top-0.5 w-4 h-4 rounded-full"
                style={{ background: form.limited ? "#FFD700" : "rgba(255,255,255,0.35)" }} />
            </motion.div>
            <span className="text-xs text-white font-bold">Limited Offer</span>
          </div>

          {form.limited && (
            <div>
              <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>ENDS AT</label>
              <input
                type="datetime-local" value={form.limitedEnds}
                onChange={e => setForm(f => ({ ...f, limitedEnds: e.target.value }))}
                className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,215,0,0.25)", colorScheme: "dark" }}
              />
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3">
            <motion.div
              onClick={() => setForm(f => ({ ...f, status: f.status === "on" ? "off" : "on" }))}
              className="w-10 rounded-full relative cursor-pointer"
              style={{ height: 22, background: form.status === "on" ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.08)", border: `1px solid ${form.status === "on" ? "#34d399" : "rgba(255,255,255,0.15)"}` }}>
              <motion.div animate={{ x: form.status === "on" ? 20 : 2 }}
                className="absolute top-0.5 w-4 h-4 rounded-full"
                style={{ background: form.status === "on" ? "#34d399" : "rgba(255,255,255,0.35)" }} />
            </motion.div>
            <span className="text-xs font-bold" style={{ color: form.status === "on" ? "#34d399" : "rgba(255,255,255,0.45)" }}>
              {form.status === "on" ? "Live" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 py-3 rounded-2xl text-xs font-black cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
            CANCEL
          </button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => onSave(form)}
            className="flex-1 py-3 rounded-2xl text-xs font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", boxShadow: "0 0 20px rgba(124,58,237,0.4)" }}>
            {isNew ? "ADD TIER" : "SAVE CHANGES"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function PagePopupSettings() {
  const [activeGame, setActiveGame]   = useState<string>("ludo");
  const [popups, setPopups]           = useState<Record<string, GamePopup>>(GAME_POPUPS_INIT);
  const [editTier, setEditTier]       = useState<EntryFee | "new" | null>(null);
  const [saved, setSaved]             = useState(false);
  const [publishing, setPublishing]   = useState(false);
  const [published, setPublished]     = useState(false);
  const bannerInputRef                = useRef<HTMLInputElement>(null);

  const game   = GAMES.find(g => g.id === activeGame)!;
  const popup  = popups[activeGame];

  function setPopup(patch: Partial<GamePopup>) {
    setPopups(p => ({ ...p, [activeGame]: { ...p[activeGame], ...patch } }));
    setSaved(false);
  }

  function setTiers(tiers: EntryFee[]) {
    setPopup({ tiers });
  }

  function toggleTier(id: number) {
    setTiers(popup.tiers.map(t => t.id === id ? { ...t, status: t.status === "on" ? "off" : "on" } : t));
  }

  function deleteTier(id: number) {
    setTiers(popup.tiers.filter(t => t.id !== id));
  }

  function saveTier(tier: EntryFee) {
    const exists = popup.tiers.find(t => t.id === tier.id);
    setTiers(exists ? popup.tiers.map(t => t.id === tier.id ? tier : t) : [...popup.tiers, tier]);
    setEditTier(null);
  }

  function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPopup({ bannerImg: reader.result as string });
    reader.readAsDataURL(file);
  }

  function publish() {
    setPublishing(true);
    setTimeout(() => { setPublishing(false); setPublished(true); setSaved(true); setTimeout(() => setPublished(false), 2500); }, 1800);
  }

  return (
    <div className="space-y-5 pb-6">

      {/* ─── Header strip ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-white text-lg">Game Popup Control Panel</h2>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Manage entry fees, popup design &amp; animations — changes auto-sync to app
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Global enable/disable */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <motion.div
              onClick={() => setPopup({ enabled: !popup.enabled })}
              className="w-10 rounded-full relative cursor-pointer shrink-0"
              style={{ height: 20, background: popup.enabled ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.2)", border: `1px solid ${popup.enabled ? "#34d399" : "#f87171"}` }}>
              <motion.div animate={{ x: popup.enabled ? 20 : 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 26 }}
                className="absolute top-0.5 w-4 h-4 rounded-full shrink-0"
                style={{ background: popup.enabled ? "#34d399" : "#f87171" }} />
            </motion.div>
            <span className="text-xs font-black" style={{ color: popup.enabled ? "#34d399" : "#f87171" }}>
              {popup.enabled ? "Game LIVE" : "Game OFF"}
            </span>
          </div>

          {/* Publish */}
          <motion.button whileTap={{ scale: 0.95 }} onClick={publish} disabled={publishing}
            className="px-5 py-2 rounded-xl font-black text-xs cursor-pointer relative overflow-hidden"
            style={{
              background: published ? "linear-gradient(135deg,#34d399,#059669)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
              color: "#fff",
              boxShadow: published ? "0 0 20px rgba(52,211,153,0.4)" : "0 0 20px rgba(124,58,237,0.4)",
            }}>
            {publishing ? (
              <span className="flex items-center gap-2">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} className="block">⚙️</motion.span>
                Syncing…
              </span>
            ) : published ? "✅ Published!" : "🚀 Publish Changes"}
          </motion.button>
        </div>
      </div>

      {/* ─── Game Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {GAMES.map(g => {
          const isActive = g.id === activeGame;
          const gPopup = popups[g.id];
          return (
            <motion.button key={g.id} whileTap={{ scale: 0.95 }}
              onClick={() => setActiveGame(g.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black cursor-pointer relative"
              style={{
                background: isActive ? `${g.color}22` : "rgba(255,255,255,0.04)",
                border: isActive ? `1.5px solid ${g.color}55` : "1.5px solid rgba(255,255,255,0.07)",
                color: isActive ? g.color : "rgba(255,255,255,0.45)",
                boxShadow: isActive ? `0 0 16px ${g.color}30` : "none",
              }}>
              <span>{g.icon}</span>
              {g.name}
              <span className="ml-1 w-1.5 h-1.5 rounded-full"
                style={{ background: gPopup.enabled ? "#34d399" : "#f87171" }} />
            </motion.button>
          );
        })}
      </div>

      {/* ─── Main 3-column layout ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ══ LEFT: Entry Fees ═══════════════════════════════════════════ */}
        <div className="xl:col-span-2 space-y-4">

          {/* Entry fee table */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(124,58,237,0.18)" }}>

            {/* Table header */}
            <div className="flex items-center justify-between px-4 py-3"
              style={{ background: "rgba(124,58,237,0.08)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{game.icon}</span>
                <div>
                  <span className="font-black text-white text-sm">{game.name}</span>
                  <span className="ml-2 text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {popup.tiers.filter(t => t.status === "on").length}/{popup.tiers.length} tiers active
                  </span>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => setEditTier("new")}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[11px] font-black cursor-pointer"
                style={{ background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "#fff", boxShadow: "0 0 14px rgba(124,58,237,0.35)" }}>
                + Add Tier
              </motion.button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    {["Entry Fee", "Win Amount", "Status", "Offer", "Actions"].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 text-[10px] font-black tracking-wider"
                        style={{ color: "rgba(255,255,255,0.3)" }}>{h.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {[...popup.tiers].sort((a,b) => a.fee - b.fee).map(tier => (
                      <FeeRow
                        key={tier.id}
                        tier={tier}
                        onEdit={() => setEditTier(tier)}
                        onDelete={() => deleteTier(tier.id)}
                        onToggle={() => toggleTier(tier.id)}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {popup.tiers.length === 0 && (
                <div className="py-10 text-center">
                  <div className="text-3xl mb-2">🪣</div>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>No entry tiers yet. Add one above.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Popup Customization ─────────────────────────────────────── */}
          <div className="rounded-2xl p-5 space-y-5"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(124,58,237,0.15)" }}>

            <h3 className="font-black text-white text-sm flex items-center gap-2">
              🎨 Popup Customization
            </h3>

            {/* Banner text */}
            <div>
              <label className="text-[11px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>POPUP BANNER TEXT</label>
              <input
                value={popup.bannerText}
                onChange={e => setPopup({ bannerText: e.target.value })}
                className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(124,58,237,0.25)" }}
                placeholder="e.g. WIN REAL CASH"
              />
            </div>

            {/* Banner image upload */}
            <div>
              <label className="text-[11px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>POPUP BANNER IMAGE</label>
              <input type="file" accept="image/*" className="hidden" ref={bannerInputRef} onChange={handleBannerUpload} />
              <div className="flex items-center gap-3">
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => bannerInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px dashed rgba(124,58,237,0.4)", color: "#a78bfa" }}>
                  📤 Upload Image
                </motion.button>
                {popup.bannerImg && (
                  <div className="flex items-center gap-2">
                    <img src={popup.bannerImg} alt="banner" className="w-10 h-10 rounded-lg object-cover"
                      style={{ border: "1px solid rgba(124,58,237,0.4)" }} />
                    <button onClick={() => setPopup({ bannerImg: "" })}
                      className="text-xs cursor-pointer" style={{ color: "#f87171" }}>✕ Remove</button>
                  </div>
                )}
              </div>
            </div>

            {/* Two-column: animation + bg */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Animation */}
              <div>
                <label className="text-[11px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>ANIMATION EFFECT</label>
                <div className="flex flex-wrap gap-2">
                  {ANIM_OPTIONS.map(a => (
                    <motion.button key={a.id} whileTap={{ scale: 0.93 }}
                      onClick={() => setPopup({ animation: a.id })}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
                      style={{
                        background: popup.animation === a.id ? "rgba(124,58,237,0.25)" : "rgba(255,255,255,0.04)",
                        border: popup.animation === a.id ? "1.5px solid #7c3aed" : "1px solid rgba(255,255,255,0.08)",
                        color: popup.animation === a.id ? "#a78bfa" : "rgba(255,255,255,0.4)",
                      }}>
                      <span>{a.icon}</span>{a.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Background */}
              <div>
                <label className="text-[11px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>POPUP BACKGROUND</label>
                <div className="flex flex-wrap gap-2">
                  {BG_COLORS.map(b => (
                    <motion.button key={b.val} whileTap={{ scale: 0.9 }}
                      onClick={() => setPopup({ bgColor: b.val })}
                      title={b.label}
                      className="w-8 h-8 rounded-xl cursor-pointer"
                      style={{
                        background: b.val,
                        border: popup.bgColor === b.val ? "2px solid #a78bfa" : "1.5px solid rgba(255,255,255,0.12)",
                        boxShadow: popup.bgColor === b.val ? "0 0 12px rgba(124,58,237,0.5)" : "none",
                      }} />
                  ))}
                </div>
              </div>
            </div>

            {/* Two-column: button color + glow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Button color */}
              <div>
                <label className="text-[11px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>PLAY BUTTON COLOR</label>
                <div className="flex flex-wrap gap-2">
                  {BTN_COLORS.map(b => (
                    <motion.button key={b.val} whileTap={{ scale: 0.9 }}
                      onClick={() => setPopup({ btnColor: b.val, glowColor: b.val })}
                      title={b.label}
                      className="w-8 h-8 rounded-xl cursor-pointer"
                      style={{
                        background: b.val,
                        border: popup.btnColor === b.val ? "2px solid #fff" : "1.5px solid rgba(255,255,255,0.1)",
                        boxShadow: popup.btnColor === b.val ? `0 0 12px ${b.val}80` : "none",
                      }} />
                  ))}
                </div>
              </div>

              {/* Glow effects toggle */}
              <div>
                <label className="text-[11px] font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.45)" }}>NEON GLOW EFFECTS</label>
                <div className="flex items-center gap-3">
                  <motion.div
                    onClick={() => setPopup({ showGlow: !popup.showGlow })}
                    className="w-10 rounded-full relative cursor-pointer"
                    style={{ height: 20, background: popup.showGlow ? "rgba(124,58,237,0.35)" : "rgba(255,255,255,0.08)", border: `1px solid ${popup.showGlow ? "#7c3aed" : "rgba(255,255,255,0.15)"}` }}>
                    <motion.div animate={{ x: popup.showGlow ? 20 : 2 }}
                      transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      className="absolute top-0.5 w-4 h-4 rounded-full"
                      style={{ background: popup.showGlow ? "#a78bfa" : "rgba(255,255,255,0.3)" }} />
                  </motion.div>
                  <span className="text-xs font-bold" style={{ color: popup.showGlow ? "#a78bfa" : "rgba(255,255,255,0.35)" }}>
                    {popup.showGlow ? "Glow ON ✨" : "Glow OFF"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Schedule ────────────────────────────────────────────────── */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,215,0,0.12)" }}>

            <div className="flex items-center justify-between">
              <h3 className="font-black text-white text-sm flex items-center gap-2">⏰ Schedule Popup Timing</h3>
              <div className="flex items-center gap-2">
                <motion.div
                  onClick={() => setPopup({ scheduleEnabled: !popup.scheduleEnabled })}
                  className="w-10 rounded-full relative cursor-pointer"
                  style={{ height: 20, background: popup.scheduleEnabled ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.08)", border: `1px solid ${popup.scheduleEnabled ? "#FFD700" : "rgba(255,255,255,0.15)"}` }}>
                  <motion.div animate={{ x: popup.scheduleEnabled ? 20 : 2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 26 }}
                    className="absolute top-0.5 w-4 h-4 rounded-full"
                    style={{ background: popup.scheduleEnabled ? "#FFD700" : "rgba(255,255,255,0.3)" }} />
                </motion.div>
                <span className="text-xs font-bold" style={{ color: popup.scheduleEnabled ? "#FFD700" : "rgba(255,255,255,0.35)" }}>
                  {popup.scheduleEnabled ? "Active" : "Off"}
                </span>
              </div>
            </div>

            {popup.scheduleEnabled && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.4)" }}>START TIME</label>
                  <input type="time" value={popup.scheduleStart}
                    onChange={e => setPopup({ scheduleStart: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.25)", colorScheme: "dark" }}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.4)" }}>END TIME</label>
                  <input type="time" value={popup.scheduleEnd}
                    onChange={e => setPopup({ scheduleEnd: e.target.value })}
                    className="w-full rounded-xl px-4 py-2.5 text-white font-bold text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.25)", colorScheme: "dark" }}
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ══ RIGHT: Live Preview ════════════════════════════════════════ */}
        <div className="space-y-4">

          {/* Preview card */}
          <div className="rounded-2xl p-5 sticky top-4"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(124,58,237,0.18)" }}>
            <LivePreview game={game} popup={popup} />

            {/* Quick stats */}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl py-2.5" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="font-black text-white text-sm">{popup.tiers.length}</div>
                <div className="text-[9px] font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>TIERS</div>
              </div>
              <div className="rounded-xl py-2.5" style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.12)" }}>
                <div className="font-black text-sm" style={{ color: "#34d399" }}>{popup.tiers.filter(t=>t.status==="on").length}</div>
                <div className="text-[9px] font-bold mt-0.5" style={{ color: "#34d399" }}>LIVE</div>
              </div>
              <div className="rounded-xl py-2.5" style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.12)" }}>
                <div className="font-black text-sm" style={{ color: "#FFD700" }}>85%</div>
                <div className="text-[9px] font-bold mt-0.5" style={{ color: "#FFD700" }}>WIN</div>
              </div>
            </div>

            {/* Animation badge */}
            <div className="mt-3 flex items-center justify-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(124,58,237,0.10)", border: "1px solid rgba(124,58,237,0.2)" }}>
              <span className="text-sm">{ANIM_OPTIONS.find(a => a.id === popup.animation)?.icon}</span>
              <span className="text-[11px] font-black" style={{ color: "#a78bfa" }}>
                {ANIM_OPTIONS.find(a => a.id === popup.animation)?.label} Animation
              </span>
            </div>

            {/* Sync status */}
            <div className="mt-3 flex items-center gap-2 justify-center">
              <motion.div className="w-1.5 h-1.5 rounded-full"
                style={{ background: saved ? "#34d399" : "#FFD700" }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }} />
              <span className="text-[10px] font-black" style={{ color: saved ? "#34d399" : "#FFD700" }}>
                {saved ? "Synced to App" : "Unsaved Changes"}
              </span>
            </div>

            {/* Publish bottom */}
            <motion.button whileTap={{ scale: 0.96 }} onClick={publish} disabled={publishing}
              className="w-full mt-4 py-3 rounded-2xl text-sm font-black cursor-pointer"
              style={{
                background: published
                  ? "linear-gradient(135deg,#34d399,#059669)"
                  : "linear-gradient(135deg,#7c3aed,#a855f7)",
                color: "#fff",
                boxShadow: "0 0 24px rgba(124,58,237,0.35)",
              }}>
              {publishing ? "🔄 Publishing…" : published ? "✅ Live!" : "🚀 Publish to App"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* ─── Edit / Add Tier Modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {editTier !== null && (
          <EditTierModal
            tier={editTier === "new" ? null : editTier}
            onSave={saveTier}
            onClose={() => setEditTier(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
