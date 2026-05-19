/**
 * TabBanners — Banner Management sub-tab
 * Manage app banner images + announcement text + app-wide settings
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeAppConfig, updateAppConfig,
  subscribeAdminBanners, saveAdminBanners,
  AppConfig, AdminBanner,
} from "@/firebase/admin.service";

const T = {
  blue:  "#00d4ff",
  green: "#00ff88",
  red:   "#ff3366",
  gold:  "#f59e0b",
  muted: "rgba(226,232,240,0.4)",
  card:  "rgba(0,212,255,0.04)",
  bdr:   "rgba(0,212,255,0.13)",
};

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ on, onChange, color = T.green }: { on: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="cursor-pointer shrink-0"
      style={{ width: 40, height: 22, borderRadius: 11, position: "relative",
        background: on ? `${color}22` : "rgba(255,255,255,0.07)",
        border: `1.5px solid ${on ? color : "rgba(255,255,255,0.12)"}`, transition: "all 0.2s" }}>
      <motion.div animate={{ x: on ? 18 : 2 }} transition={{ type: "spring", stiffness: 420, damping: 28 }}
        style={{ width: 14, height: 14, borderRadius: 7, position: "absolute", top: 2,
          background: on ? color : "rgba(255,255,255,0.3)" }} />
    </button>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, sub, children }: { icon: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.card, border: `1px solid ${T.bdr}` }}>
      <div className="px-4 py-3 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${T.bdr}`, background: "rgba(0,212,255,0.03)" }}>
        <span className="text-xl">{icon}</span>
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          {sub && <p className="text-[10px]" style={{ color: T.muted }}>{sub}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Banner Item Card ─────────────────────────────────────────────────────────

function BannerCard({
  banner, index, total,
  onUpdate, onDelete, onMove,
}: {
  banner: AdminBanner; index: number; total: number;
  onUpdate: (b: AdminBanner) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(0,212,255,0.1)" }}>
      {/* Banner preview */}
      <div className="relative w-full h-28 flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(0,0,0,0.3)" }}>
        {banner.imageUrl ? (
          <img src={banner.imageUrl} alt={banner.title} className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="flex flex-col items-center gap-1 opacity-30">
            <span className="text-3xl">🖼️</span>
            <span className="text-[10px]" style={{ color: T.muted }}>No image URL</span>
          </div>
        )}
        {/* Overlay controls */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button onClick={() => onMove(-1)} disabled={index === 0}
            className="w-6 h-6 rounded flex items-center justify-center text-xs cursor-pointer"
            style={{ background: "rgba(0,0,0,0.6)", color: index === 0 ? T.muted : "#fff", opacity: index === 0 ? 0.4 : 1 }}>↑</button>
          <button onClick={() => onMove(1)} disabled={index === total - 1}
            className="w-6 h-6 rounded flex items-center justify-center text-xs cursor-pointer"
            style={{ background: "rgba(0,0,0,0.6)", color: index === total - 1 ? T.muted : "#fff", opacity: index === total - 1 ? 0.4 : 1 }}>↓</button>
        </div>
        <div className="absolute top-2 left-2">
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
            style={{ background: "rgba(0,0,0,0.7)", color: T.muted }}>#{index + 1}</span>
        </div>
      </div>

      {/* Fields */}
      <div className="p-3 space-y-2">
        <input value={banner.title} onChange={(e) => onUpdate({ ...banner, title: e.target.value })}
          placeholder="Banner title…"
          className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.15)", caretColor: T.blue }} />
        <input value={banner.imageUrl} onChange={(e) => onUpdate({ ...banner, imageUrl: e.target.value })}
          placeholder="Image URL: https://…"
          className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none font-mono"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.15)", caretColor: T.blue }} />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Toggle on={banner.isActive} onChange={(v) => onUpdate({ ...banner, isActive: v })} color={T.blue} />
            <span className="text-[11px]" style={{ color: banner.isActive ? T.blue : T.muted }}>
              {banner.isActive ? "Active" : "Hidden"}
            </span>
          </div>
          <button onClick={onDelete} className="text-[11px] font-black cursor-pointer px-2 py-1 rounded-lg"
            style={{ color: T.red, background: "rgba(255,51,102,0.07)", border: "1px solid rgba(255,51,102,0.15)" }}>
            ✕ Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TabBanners() {
  const [config, setConfig]       = useState<AppConfig | null>(null);
  const [banners, setBanners]     = useState<AdminBanner[]>([]);
  const [savingCfg, setSavingCfg] = useState(false);
  const [savingBnr, setSavingBnr] = useState(false);
  const [cfgDone, setCfgDone]     = useState(false);
  const [bnrDone, setBnrDone]     = useState(false);

  useEffect(() => {
    const u1 = subscribeAppConfig(setConfig);
    const u2 = subscribeAdminBanners(setBanners);
    return () => { u1(); u2(); };
  }, []);

  // Config helpers
  function setCfg<K extends keyof AppConfig>(k: K, v: AppConfig[K]) {
    setConfig((c) => c ? { ...c, [k]: v } : null);
  }

  async function saveConfig() {
    if (!config) return;
    setSavingCfg(true);
    await updateAppConfig(config);
    setSavingCfg(false);
    setCfgDone(true);
    setTimeout(() => setCfgDone(false), 3000);
  }

  // Banner helpers
  function addBanner() {
    setBanners((b) => [...b, { id: `banner_${Date.now()}`, imageUrl: "", title: "New Banner", isActive: true }]);
  }

  function updateBanner(i: number, b: AdminBanner) {
    setBanners((prev) => prev.map((x, j) => j === i ? b : x));
  }

  function deleteBanner(i: number) {
    setBanners((prev) => prev.filter((_, j) => j !== i));
  }

  function moveBanner(i: number, dir: -1 | 1) {
    setBanners((prev) => {
      const next = [...prev];
      const tmp = next[i + dir];
      next[i + dir] = next[i];
      next[i] = tmp;
      return next;
    });
  }

  async function saveBanners() {
    setSavingBnr(true);
    await saveAdminBanners(banners);
    setSavingBnr(false);
    setBnrDone(true);
    setTimeout(() => setBnrDone(false), 3000);
  }

  if (!config) {
    return (
      <div className="p-6 flex items-center justify-center">
        <motion.div className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: `${T.blue} transparent transparent transparent` }}
          animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* ── 1. App Banners ────────────────────────────────────────────────── */}
      <Section icon="🖼️" title="App Banners"
        sub="These banners appear in the WINGGO app's home screen carousel">
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {banners.map((b, i) => (
              <BannerCard key={b.id} banner={b} index={i} total={banners.length}
                onUpdate={(nb) => updateBanner(i, nb)}
                onDelete={() => deleteBanner(i)}
                onMove={(dir) => moveBanner(i, dir)} />
            ))}
          </div>

          {banners.length === 0 && (
            <div className="rounded-xl py-10 text-center" style={{ border: "1px dashed rgba(0,212,255,0.12)" }}>
              <p className="text-3xl mb-2 opacity-20">🖼️</p>
              <p className="text-sm font-bold" style={{ color: T.muted }}>No banners yet — add one below.</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <motion.button whileTap={{ scale: 0.96 }} onClick={addBanner}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{ background: "rgba(0,212,255,0.07)", color: T.blue, border: "1px solid rgba(0,212,255,0.18)" }}>
              + Add Banner Slot
            </motion.button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={saveBanners} disabled={savingBnr}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{
                background: bnrDone ? "rgba(0,255,136,0.1)" : "rgba(0,212,255,0.13)",
                color:      bnrDone ? T.green : T.blue,
                border:     `1px solid ${bnrDone ? "rgba(0,255,136,0.3)" : "rgba(0,212,255,0.28)"}`,
              }}>
              {savingBnr ? "Saving…" : bnrDone ? "✅ Saved!" : "💾 Save Banners"}
            </motion.button>
          </div>
        </div>
      </Section>

      {/* ── 2. Announcement Banner ────────────────────────────────────────── */}
      <Section icon="📢" title="In-App Announcement"
        sub="Scrolling text banner shown at the top of the WINGGO app">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white font-bold">Show Announcement</span>
            <Toggle on={config.announcementActive} onChange={(v) => setCfg("announcementActive", v)} color={T.blue} />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.45)" }}>
              ANNOUNCEMENT TEXT
            </label>
            <textarea value={config.announcementBanner}
              onChange={(e) => setCfg("announcementBanner", e.target.value)}
              rows={2} placeholder="e.g. 🏆 Grand Tournament every Sunday at 8PM!"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
          </div>
        </div>
      </Section>

      {/* ── 3. App Settings ───────────────────────────────────────────────── */}
      <Section icon="⚙️" title="App Settings" sub="Global controls that affect all users in real-time">
        <div className="space-y-4">
          {/* Toggle settings */}
          <div className="space-y-3">
            {[
              { key: "maintenanceMode" as const,  label: "Maintenance Mode",  sub: "App shows maintenance screen to all users", color: T.red   },
              { key: "spinWheelEnabled" as const,  label: "Spin Wheel",        sub: "Daily spin wheel reward feature",            color: T.blue  },
            ].map(({ key, label, sub, color }) => (
              <div key={key} className="flex items-center justify-between py-2 rounded-xl px-3"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(0,212,255,0.08)" }}>
                <div>
                  <p className="text-sm font-black text-white">{label}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: T.muted }}>{sub}</p>
                </div>
                <Toggle on={config[key] as boolean} onChange={(v) => setCfg(key, v)} color={color} />
              </div>
            ))}
          </div>

          {/* Numeric settings */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "depositBonusPct"    as const, label: "Deposit Bonus %",       suffix: "%" },
              { key: "referralBonusAmount" as const, label: "Referral Bonus ₹",     suffix: "₹" },
              { key: "minWithdrawAmount"  as const, label: "Min Withdraw ₹",        suffix: "₹" },
              { key: "maxWithdrawAmount"  as const, label: "Max Withdraw ₹",        suffix: "₹" },
              { key: "maxWithdrawPerDay"  as const, label: "Max Withdraw/Day ₹",    suffix: "₹" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.45)" }}>
                  {label.toUpperCase()}
                </label>
                <input type="number" value={config[key] as number}
                  onChange={(e) => setCfg(key, parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none font-mono"
                  style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
              </div>
            ))}
            <div>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.45)" }}>
                FORCE UPDATE VERSION
              </label>
              <input type="text" value={config.forceUpdateVersion}
                onChange={(e) => setCfg("forceUpdateVersion", e.target.value)}
                placeholder="1.0.0"
                className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none font-mono"
                style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
            </div>
          </div>

          {/* Save */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={saveConfig} disabled={savingCfg}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
            style={{
              background: cfgDone ? "rgba(0,255,136,0.1)"  : "linear-gradient(135deg, rgba(0,212,255,0.14), rgba(0,85,255,0.18))",
              color:      cfgDone ? T.green                 : T.blue,
              border:     `1px solid ${cfgDone ? "rgba(0,255,136,0.3)" : "rgba(0,212,255,0.28)"}`,
              boxShadow:  cfgDone ? "0 0 20px rgba(0,255,136,0.1)" : "0 0 20px rgba(0,212,255,0.08)",
            }}>
            {savingCfg ? "⏳ Saving to Firebase…" : cfgDone ? "✅ Config Saved!" : "🚀 Save All Settings"}
          </motion.button>
        </div>
      </Section>

    </div>
  );
}
