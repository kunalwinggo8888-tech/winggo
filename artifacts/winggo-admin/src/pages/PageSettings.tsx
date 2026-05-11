import { useState } from "react";
import { motion } from "framer-motion";

export default function PageSettings() {
  const [maintenance, setMaintenance] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [appVersion, setAppVersion] = useState("2.4.1");
  const [minVersion, setMinVersion] = useState("2.2.0");
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const TOGGLES = [
    { label: "Maintenance Mode", sub: "Blocks all user access and shows maintenance screen", state: maintenance, set: setMaintenance, color: "#f87171" },
    { label: "Force Update",     sub: "Forces users to update app before playing",          state: forceUpdate, set: setForceUpdate, color: "#f59e0b" },
  ];

  return (
    <div className="space-y-4 max-w-2xl">
      {/* App version */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">📱 App Version Control</h3>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: "Current Version", value: appVersion, set: setAppVersion },
            { label: "Minimum Version (Force Update)", value: minVersion, set: setMinVersion },
          ].map(r => (
            <div key={r.label}>
              <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>{r.label}</label>
              <input value={r.value} onChange={e => r.set(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-white text-sm outline-none font-mono"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.2)", caretColor: "#FFD700" }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {TOGGLES.map((t, i) => (
          <div key={t.label} className="flex items-center gap-4 px-5 py-4"
            style={{ borderBottom: i < TOGGLES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex-1">
              <div className="text-sm font-black text-white">{t.label}</div>
              <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{t.sub}</div>
            </div>
            <motion.div whileTap={{ scale: 0.92 }} onClick={() => t.set(!t.state)}
              className="w-12 h-6 rounded-full relative cursor-pointer shrink-0"
              style={{ background: t.state ? `${t.color}30` : "rgba(255,255,255,0.08)", border: `1px solid ${t.state ? t.color : "rgba(255,255,255,0.15)"}` }}>
              <motion.div animate={{ x: t.state ? 22 : 2 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="absolute top-1 w-4 h-4 rounded-full"
                style={{ background: t.state ? t.color : "rgba(255,255,255,0.4)" }} />
            </motion.div>
          </div>
        ))}
      </div>

      {/* API settings */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">🔌 API & Integration Settings</h3>
        <div className="space-y-3">
          {[
            { label: "Payment Gateway", value: "Razorpay Live", status: "connected" },
            { label: "SMS OTP Provider", value: "MSG91", status: "connected" },
            { label: "Push Notifications", value: "Firebase FCM", status: "connected" },
            { label: "KYC Provider", value: "DigiLocker API", status: "warning" },
            { label: "Analytics SDK", value: "Mixpanel v3.2", status: "connected" },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div>
                <div className="text-xs font-black text-white">{r.label}</div>
                <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.value}</div>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: r.status === "connected" ? "#34d399" : "#f59e0b" }} />
                <span className="text-[10px] font-black" style={{ color: r.status === "connected" ? "#34d399" : "#f59e0b" }}>
                  {r.status === "connected" ? "Connected" : "Check"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Admin security */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
        <h3 className="text-white font-black text-sm mb-4">🔒 Admin Security</h3>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "JWT Expiry", value: "24 hours" },
            { label: "2FA Status", value: "Enabled ✓" },
            { label: "Last Login", value: "Today 09:15" },
            { label: "Login IP", value: "103.x.x.x" },
          ].map(r => (
            <div key={r.label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
              <div className="text-sm font-black text-white mt-0.5">{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Save */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={save}
        className="w-full py-4 rounded-2xl font-black text-sm cursor-pointer"
        style={{
          background: saved ? "rgba(52,211,153,0.15)" : "linear-gradient(135deg,#FFD700,#ff8c00)",
          color: saved ? "#34d399" : "#000",
          border: saved ? "1px solid rgba(52,211,153,0.3)" : "none",
          boxShadow: saved ? "none" : "0 0 24px rgba(255,215,0,0.25)",
        }}>
        {saved ? "✅ Settings Saved!" : "💾 Save All Settings"}
      </motion.button>
    </div>
  );
}
