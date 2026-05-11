import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeAppConfig, updateAppConfig, AppConfig, DEFAULT_APP_CONFIG } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const FEATURES_DEFAULT = [
  { key: "spinWheelEnabled",  label: "Daily Spin Wheel",     field: "spinWheelEnabled"  },
  { key: "refer_earn",        label: "Refer & Earn",          field: null               },
  { key: "world_war",         label: "World War Tournaments", field: null               },
  { key: "leaderboard",       label: "Global Leaderboard",   field: null               },
  { key: "maintenanceMode",   label: "Maintenance Mode",      field: "maintenanceMode"  },
  { key: "announcementActive",label: "Announcement Banner",   field: "announcementActive" },
  { key: "chat_in_game",      label: "In-Game Chat (Beta)",   field: null               },
  { key: "vip_club",          label: "VIP Club Perks",        field: null               },
];

export default function PageUpdateAPI() {
  const [config, setConfig]     = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [features, setFeatures] = useState<Record<string, boolean>>({
    refer_earn: true, world_war: true, leaderboard: true, chat_in_game: false, vip_club: true,
  });
  const [saved, setSaved]   = useState(false);
  const [pushed, setPushed] = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsub = subscribeAppConfig((c) => {
      setConfig(c);
      setFeatures(f => ({ ...f, spinWheelEnabled: c.spinWheelEnabled, maintenanceMode: c.maintenanceMode, announcementActive: c.announcementActive }));
    });
    return unsub;
  }, []);

  async function save() {
    setSaving(true);
    const merged: Partial<AppConfig> = {
      ...config,
      spinWheelEnabled:  features["spinWheelEnabled"] ?? config.spinWheelEnabled,
      maintenanceMode:   features["maintenanceMode"]  ?? config.maintenanceMode,
      announcementActive: features["announcementActive"] ?? config.announcementActive,
    };
    await updateAppConfig(merged);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function pushNotif() {
    setPushed(true);
    setTimeout(() => setPushed(false), 2500);
  }

  function toggleFeature(key: string) {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
    const feat = FEATURES_DEFAULT.find(f => f.key === key);
    if (feat?.field && feat.field in config) {
      setConfig(prev => ({ ...prev, [feat.field as keyof AppConfig]: !prev[feat.field as keyof AppConfig] } as AppConfig));
    }
  }

  const numField = (label: string, field: keyof AppConfig, color = "#FFD700") => (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{label}</span>
      <div className="flex items-center gap-2">
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => setConfig(prev => ({ ...prev, [field]: Math.max(0, Number(prev[field]) - 1) }))}
          className="w-7 h-7 rounded-lg font-black text-sm cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>−</motion.button>
        <input type="number" value={Number(config[field])}
          onChange={e => setConfig(prev => ({ ...prev, [field]: Number(e.target.value) }))}
          className="w-20 text-center rounded-lg py-1 text-sm font-black outline-none"
          style={{ background: "rgba(255,255,255,0.06)", color, border: `1px solid ${color}30`, caretColor: color }} />
        <motion.button whileTap={{ scale: 0.9 }}
          onClick={() => setConfig(prev => ({ ...prev, [field]: Number(prev[field]) + 1 }))}
          className="w-7 h-7 rounded-lg font-black text-sm cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>+</motion.button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
          style={{ background: config.maintenanceMode ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.08)",
            color: config.maintenanceMode ? "#f87171" : "#34d399",
            border: `1px solid ${config.maintenanceMode ? "rgba(248,113,113,0.25)" : "rgba(52,211,153,0.2)"}` }}>
          <motion.div className="w-1.5 h-1.5 rounded-full"
            style={{ background: config.maintenanceMode ? "#f87171" : "#34d399" }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          {config.maintenanceMode ? "🔴 Maintenance Mode ON" : "🟢 Platform LIVE"}
        </div>
        {FIREBASE_ENABLED && (
          <div className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
            🔥 Firebase Synced
          </div>
        )}
        <div className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)" }}>
          v{config.forceUpdateVersion}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Feature flags */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-black tracking-widest uppercase mb-4" style={{ color: "rgba(255,215,0,0.6)" }}>
            🎛️ Feature Flags
          </p>
          <div className="space-y-3">
            {FEATURES_DEFAULT.map(f => {
              const on = features[f.key] ?? false;
              return (
                <div key={f.key} className="flex items-center justify-between">
                  <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.65)" }}>{f.label}</span>
                  <motion.button whileTap={{ scale: 0.92 }} onClick={() => toggleFeature(f.key)}
                    className="relative w-11 h-6 rounded-full cursor-pointer transition-all"
                    style={{ background: on ? "#22c55e" : "rgba(255,255,255,0.12)" }}>
                    <motion.div className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                      animate={{ left: on ? "calc(100% - 22px)" : "2px" }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                  </motion.button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Remote config numbers */}
        <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-xs font-black tracking-widest uppercase mb-4" style={{ color: "rgba(255,215,0,0.6)" }}>
            ⚙️ Remote Config
          </p>
          {numField("Deposit Bonus %",     "depositBonusPct",    "#3498db")}
          {numField("Referral Bonus ₹",    "referralBonusAmount","#27ae60")}
          {numField("Min Withdraw ₹",      "minWithdrawAmount",  "#f59e0b")}
          {numField("Max Withdraw/Day ₹",  "maxWithdrawPerDay",  "#e74c3c")}
          <div className="mt-3">
            <label className="text-xs font-bold mb-1 block" style={{ color: "rgba(255,255,255,0.4)" }}>Force Update Version</label>
            <input value={config.forceUpdateVersion}
              onChange={e => setConfig(prev => ({ ...prev, forceUpdateVersion: e.target.value }))}
              className="w-full rounded-xl px-3 py-2 text-white text-xs outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", caretColor: "#FFD700" }} />
          </div>
        </div>
      </div>

      {/* Announcement banner */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,215,0,0.6)" }}>
          📢 Announcement Banner
        </p>
        <textarea value={config.announcementBanner}
          onChange={e => setConfig(prev => ({ ...prev, announcementBanner: e.target.value }))}
          rows={2}
          className="w-full rounded-xl px-3 py-2.5 text-white text-xs outline-none resize-none"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", caretColor: "#FFD700" }} />
        <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
          Displayed in the app header. Toggle via "Announcement Banner" feature flag above.
        </p>
      </div>

      {/* Action row */}
      <div className="flex gap-3 flex-wrap">
        <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving}
          className="flex-1 min-w-[140px] py-3.5 rounded-2xl font-black text-sm cursor-pointer disabled:opacity-60"
          style={{ background: saved ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg, #FFD700, #ff8c00)",
            color: saved ? "#34d399" : "#000",
            boxShadow: saved ? "none" : "0 0 20px rgba(255,215,0,0.3)" }}>
          {saving ? "Saving…" : saved ? "✅ Saved to Firebase!" : "💾 Save Config"}
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }} onClick={pushNotif}
          className="flex-1 min-w-[140px] py-3.5 rounded-2xl font-black text-sm cursor-pointer"
          style={{ background: pushed ? "rgba(52,211,153,0.15)" : "rgba(99,102,241,0.15)",
            color: pushed ? "#34d399" : "#818cf8",
            border: `1px solid ${pushed ? "rgba(52,211,153,0.3)" : "rgba(99,102,241,0.3)"}` }}>
          {pushed ? "✅ Notification Pushed!" : "📲 Push Notification"}
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowJson(!showJson)}
          className="py-3.5 px-5 rounded-2xl font-black text-xs cursor-pointer"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {showJson ? "Hide JSON" : "View JSON"}
        </motion.button>
      </div>

      <AnimatePresence>
        {showJson && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <pre className="p-4 text-[10px] overflow-x-auto" style={{ color: "#34d399", background: "rgba(0,0,0,0.3)" }}>
              {JSON.stringify({ ...config, features }, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
