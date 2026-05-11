import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FEATURES_DEFAULT = [
  { key: "daily_spin",    label: "Daily Spin Wheel",     enabled: true  },
  { key: "refer_earn",    label: "Refer & Earn",          enabled: true  },
  { key: "world_war",     label: "World War Tournaments", enabled: true  },
  { key: "leaderboard",   label: "Global Leaderboard",   enabled: true  },
  { key: "chat_in_game",  label: "In-Game Chat",          enabled: false },
  { key: "live_support",  label: "Live Support Widget",   enabled: true  },
  { key: "crash_game",    label: "Crash Game (Beta)",     enabled: false },
  { key: "vip_club",      label: "VIP Club Perks",        enabled: true  },
];

const REMOTE_CONFIG_DEFAULT = {
  version:          "1.1.0",
  forceUpdate:      false,
  maintenance:      false,
  maintenanceMsg:   "We're improving your experience. Back in 10 mins! 🚀",
  apkUrl:           "https://winggo.app/download/winggo-v1.1.0.apk",
  updateMsg:        "🎉 New Update Available! Enjoy smoother gameplay, new games & bigger prizes.",
  referBonus:       50,
  joinBonus:        50,
  ludoFeeRoom1:     1,
  ludoFeeRoom2:     5,
  ludoFeeRoom3:     10,
  ludoFeeRoom4:     50,
  spinPrizePool:    50,
  eventBannerUrl:   "",
  minDepositAmount: 10,
  maxWithdrawDaily: 50000,
};

type RemoteConfig = typeof REMOTE_CONFIG_DEFAULT;
type Feature = { key: string; label: string; enabled: boolean };

export default function PageUpdateAPI() {
  const [config, setConfig]     = useState<RemoteConfig>(REMOTE_CONFIG_DEFAULT);
  const [features, setFeatures] = useState<Feature[]>(FEATURES_DEFAULT);
  const [saved, setSaved]       = useState(false);
  const [pushed, setPushed]     = useState(false);
  const [showJson, setShowJson] = useState(false);
  const [prevVersion, setPrevVersion] = useState("1.0.0");

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function pushNotif() {
    setPushed(true);
    setTimeout(() => setPushed(false), 2500);
  }

  function toggleFeature(key: string) {
    setFeatures(prev => prev.map(f => f.key === key ? { ...f, enabled: !f.enabled } : f));
  }

  function handleVersionChange(v: string) {
    setPrevVersion(config.version);
    setConfig(c => ({ ...c, version: v }));
  }

  const liveJson = JSON.stringify(
    {
      version: config.version,
      forceUpdate: config.forceUpdate,
      maintenance: config.maintenance,
      maintenanceMsg: config.maintenanceMsg,
      apkUrl: config.apkUrl,
      updateMsg: config.updateMsg,
      remoteConfig: {
        referBonus: config.referBonus,
        joinBonus: config.joinBonus,
        ludo: { rooms: [config.ludoFeeRoom1, config.ludoFeeRoom2, config.ludoFeeRoom3, config.ludoFeeRoom4] },
        spinPrizePool: config.spinPrizePool,
        minDeposit: config.minDepositAmount,
        maxWithdrawDaily: config.maxWithdrawDaily,
      },
      features: Object.fromEntries(features.map(f => [f.key, f.enabled])),
    },
    null, 2
  );

  const Toggle = ({ val, onChange, color = "#34d399" }: { val: boolean; onChange: () => void; color?: string }) => (
    <motion.div whileTap={{ scale: 0.9 }} onClick={onChange}
      className="w-12 h-6 rounded-full relative cursor-pointer shrink-0"
      style={{ background: val ? `${color}28` : "rgba(255,255,255,0.08)", border: `1px solid ${val ? color : "rgba(255,255,255,0.15)"}` }}>
      <motion.div animate={{ x: val ? 22 : 2 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full"
        style={{ background: val ? color : "rgba(255,255,255,0.35)" }} />
    </motion.div>
  );

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Version control banner */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.25) 0%, rgba(255,215,0,0.12) 100%)", border: "1px solid rgba(255,215,0,0.25)" }}>
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, rgba(255,215,0,0.12), transparent 70%)", transform: "translate(20%,-20%)" }} />
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: "rgba(255,255,255,0.45)" }}>Previous Version</p>
            <div className="text-2xl font-black text-white font-mono">{prevVersion}</div>
          </div>
          <div className="text-3xl" style={{ color: "rgba(255,255,255,0.3)" }}>→</div>
          <div>
            <p className="text-xs font-bold mb-1" style={{ color: "rgba(255,215,0,0.7)" }}>Current Version</p>
            <div className="text-2xl font-black font-mono" style={{ color: "#FFD700" }}>{config.version}</div>
          </div>
          <div className="ml-auto flex gap-2 items-center">
            <span className={`text-xs font-black px-3 py-1.5 rounded-full`}
              style={{
                background: config.forceUpdate ? "rgba(248,113,113,0.15)" : "rgba(52,211,153,0.12)",
                color: config.forceUpdate ? "#f87171" : "#34d399",
                border: `1px solid ${config.forceUpdate ? "rgba(248,113,113,0.3)" : "rgba(52,211,153,0.3)"}`,
              }}>
              {config.forceUpdate ? "🔒 Force Update ON" : "✅ Optional Update"}
            </span>
            {config.maintenance && (
              <span className="text-xs font-black px-3 py-1.5 rounded-full"
                style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }}>
                🚧 Maintenance
              </span>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Version & Update Controls */}
        <div className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
          <h3 className="text-white font-black text-sm">📱 Version Control</h3>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Latest App Version</label>
            <input value={config.version}
              onChange={e => handleVersionChange(e.target.value)}
              placeholder="1.1.0"
              className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none font-mono"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.25)", caretColor: "#FFD700" }}
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>APK Download URL</label>
            <input value={config.apkUrl}
              onChange={e => setConfig(c => ({ ...c, apkUrl: e.target.value }))}
              placeholder="https://winggo.app/download/winggo.apk"
              className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }}
            />
          </div>

          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Update Message (shown to users)</label>
            <textarea rows={2} value={config.updateMsg}
              onChange={e => setConfig(c => ({ ...c, updateMsg: e.target.value }))}
              className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none resize-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }}
            />
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            {[
              { label: "Force Update",     sub: "User must update before entering app", key: "forceUpdate",  color: "#f87171" },
              { label: "Maintenance Mode", sub: "Block all access, show maintenance screen", key: "maintenance", color: "#f59e0b" },
            ].map(t => (
              <div key={t.key} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div>
                  <div className="text-xs font-black text-white">{t.label}</div>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{t.sub}</div>
                </div>
                <Toggle val={config[t.key as keyof RemoteConfig] as boolean}
                  onChange={() => setConfig(c => ({ ...c, [t.key]: !c[t.key as keyof RemoteConfig] }))}
                  color={t.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Maintenance & Notification */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
            <h3 className="text-white font-black text-sm mb-4">🚧 Maintenance Message</h3>
            <textarea rows={3} value={config.maintenanceMsg}
              onChange={e => setConfig(c => ({ ...c, maintenanceMsg: e.target.value }))}
              className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none resize-none mb-3"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(245,158,11,0.2)", caretColor: "#FFD700" }}
            />
            {/* Popup preview */}
            <div className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(10,8,20,0.95)", border: "1px solid rgba(255,215,0,0.25)" }}>
              <p className="text-[10px] font-bold mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>📱 POPUP PREVIEW</p>
              <div className="text-lg mb-1">🆕</div>
              <div className="text-sm font-black text-white mb-2">
                {config.maintenance ? "🚧 Under Maintenance" : "New Update Available!"}
              </div>
              <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>
                {config.maintenance ? config.maintenanceMsg : config.updateMsg}
              </p>
              <div className="flex gap-2">
                <div className="flex-1 py-2 rounded-xl text-xs font-black cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                  {config.maintenance ? "OK" : "Update Now"}
                </div>
                {!config.maintenance && !config.forceUpdate && (
                  <div className="flex-1 py-2 rounded-xl text-xs font-black"
                    style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                    Later
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Push notification */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
            <h3 className="text-white font-black text-sm mb-3">🔔 Push Update Notification</h3>
            <motion.button whileTap={{ scale: 0.97 }} onClick={pushNotif}
              className="w-full py-3 rounded-xl font-black text-sm cursor-pointer"
              style={{
                background: pushed ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#7c3aed,#FFD700)",
                color: pushed ? "#34d399" : "#fff",
                border: pushed ? "1px solid rgba(52,211,153,0.3)" : "none",
                boxShadow: pushed ? "none" : "0 0 24px rgba(124,58,237,0.35)",
              }}>
              {pushed ? "✅ Update notification sent to 74,218 users!" : "📤 Send Update Notification to All Users"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Remote Config — Bonuses & Fees */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">⚙️ Live Remote Config — Bonuses & Fees</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Refer Bonus (₹)", key: "referBonus" },
            { label: "Join Bonus (₹)",  key: "joinBonus"  },
            { label: "Spin Prize Pool", key: "spinPrizePool" },
            { label: "Min Deposit (₹)", key: "minDepositAmount" },
            { label: "Max Withdraw/Day (₹)", key: "maxWithdrawDaily" },
            { label: "Ludo Room 1 Fee (₹)", key: "ludoFeeRoom1" },
            { label: "Ludo Room 2 Fee (₹)", key: "ludoFeeRoom2" },
            { label: "Ludo Room 3 Fee (₹)", key: "ludoFeeRoom3" },
          ].map(r => (
            <div key={r.key}>
              <label className="text-[10px] font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.45)" }}>{r.label}</label>
              <input type="number"
                value={config[r.key as keyof RemoteConfig] as number}
                onChange={e => setConfig(c => ({ ...c, [r.key]: Number(e.target.value) }))}
                className="w-full rounded-xl px-3 py-2.5 text-white text-sm outline-none font-mono font-black"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.15)", caretColor: "#FFD700" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">🚀 Feature Enable / Disable</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {features.map(f => (
            <div key={f.key} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${f.enabled ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.06)"}` }}>
              <div>
                <div className="text-xs font-black text-white">{f.label}</div>
                <div className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.3)" }}>{f.key}</div>
              </div>
              <Toggle val={f.enabled} onChange={() => toggleFeature(f.key)} />
            </div>
          ))}
        </div>
      </div>

      {/* Live JSON Config Viewer */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,215,0,0.12)" }}>
        <div className="flex items-center justify-between px-5 py-3 cursor-pointer"
          style={{ background: "rgba(255,215,0,0.06)", borderBottom: showJson ? "1px solid rgba(255,215,0,0.10)" : "none" }}
          onClick={() => setShowJson(!showJson)}>
          <span className="text-xs font-black" style={{ color: "#FFD700" }}>🔌 Live API Response Preview (JSON)</span>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{showJson ? "▲ Hide" : "▼ Show"}</span>
        </div>
        <AnimatePresence>
          {showJson && (
            <motion.pre
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="text-xs overflow-x-auto p-5 no-scrollbar"
              style={{ background: "#080515", color: "#34d399", fontFamily: "monospace", lineHeight: 1.7 }}>
              {liveJson}
            </motion.pre>
          )}
        </AnimatePresence>
      </div>

      {/* Save */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={save}
        className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
        style={{
          background: saved ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#FFD700,#ff8c00)",
          color: saved ? "#34d399" : "#000",
          border: saved ? "1px solid rgba(52,211,153,0.3)" : "none",
          boxShadow: saved ? "none" : "0 0 32px rgba(255,215,0,0.25)",
        }}>
        {saved ? "✅ Config Saved & Pushed to API!" : "💾 Save & Publish Config to API"}
      </motion.button>
    </div>
  );
}
