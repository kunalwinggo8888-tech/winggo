import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FRAUD_ALERTS = [
  { id: "WG-2041", name: "Raj Verma",      reason: "Multiple accounts detected (3 devices)",  ip: "103.21.58.14",  risk: "critical", time: "2m ago",   action: "auto-blocked" },
  { id: "WG-1897", name: "Ankit Tiwari",   reason: "Rapid win pattern — 94% win rate",          ip: "49.36.102.88",  risk: "high",     time: "18m ago",  action: "review" },
  { id: "WG-3102", name: "Priyanka Sen",   reason: "VPN/proxy usage detected",                  ip: "185.220.101.4", risk: "high",     time: "34m ago",  action: "review" },
  { id: "WG-0993", name: "Suresh Yadav",   reason: "Withdrawal attempt > deposit",               ip: "117.55.12.39",  risk: "medium",   time: "1h ago",   action: "flagged" },
  { id: "WG-2211", name: "Meena Gupta",    reason: "Shared UPI across 2 accounts",              ip: "122.172.45.8",  risk: "medium",   time: "2h ago",   action: "flagged" },
  { id: "WG-3304", name: "Farhan Khan",    reason: "Device ID matches banned account",           ip: "103.87.22.61",  risk: "critical", time: "3h ago",   action: "auto-blocked" },
];

const IP_LOGS = [
  { ip: "103.21.58.14",  country: "🇮🇳 India",    users: 3,  logins: 28, flag: true  },
  { ip: "185.220.101.4", country: "🇩🇪 Germany",   users: 1,  logins: 4,  flag: true  },
  { ip: "49.36.102.88",  country: "🇮🇳 India",    users: 1,  logins: 12, flag: false },
  { ip: "157.119.8.201", country: "🇮🇳 India",    users: 2,  logins: 9,  flag: false },
  { ip: "103.87.22.61",  country: "🇮🇳 India",    users: 2,  logins: 6,  flag: true  },
];

const ADMIN_LOG = [
  { admin: "admin@winggo.in",  action: "Approved withdrawal WD-4521",      time: "5m ago",   type: "wallet"   },
  { admin: "admin@winggo.in",  action: "Banned user WG-2041",               time: "8m ago",   type: "ban"      },
  { admin: "admin@winggo.in",  action: "KYC approved for WG-1001",          time: "22m ago",  type: "kyc"      },
  { admin: "admin@winggo.in",  action: "Game Ludo entry fee changed to ₹5", time: "1h ago",   type: "game"     },
  { admin: "admin@winggo.in",  action: "Rejected withdrawal WD-4517",       time: "2h ago",   type: "wallet"   },
  { admin: "admin@winggo.in",  action: "Login from new IP 103.21.58.14",    time: "3h ago",   type: "login"    },
];

const RISK_CFG = {
  critical: { bg: "rgba(239,68,68,0.12)",   color: "#ef4444", border: "rgba(239,68,68,0.28)"   },
  high:     { bg: "rgba(249,115,22,0.12)",  color: "#f97316", border: "rgba(249,115,22,0.28)"  },
  medium:   { bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", border: "rgba(245,158,11,0.28)"  },
};

const ACTION_CFG: Record<string, { label: string; color: string; bg: string }> = {
  "auto-blocked": { label: "Auto Blocked",  color: "#ef4444", bg: "rgba(239,68,68,0.10)"  },
  "review":       { label: "Needs Review",  color: "#f59e0b", bg: "rgba(245,158,11,0.10)" },
  "flagged":      { label: "Flagged",       color: "#f97316", bg: "rgba(249,115,22,0.10)" },
};

const SCORE_METRICS = [
  { label: "Fraud Blocks",     value: "99.2%", color: "#34d399", icon: "🛡️" },
  { label: "Fake Accounts",    value: "12",    color: "#ef4444", icon: "👥" },
  { label: "VPN Detections",   value: "8",     color: "#f97316", icon: "🌐" },
  { label: "Alerts Today",     value: "6",     color: "#f59e0b", icon: "🚨" },
];

export default function PageSecurity() {
  const [tab, setTab] = useState<"alerts" | "ip" | "log">("alerts");
  const [alertFilter, setAlertFilter] = useState<"all" | "critical" | "high" | "medium">("all");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setScore(87), 400);
    return () => clearTimeout(t);
  }, []);

  const filtered = FRAUD_ALERTS.filter(a =>
    alertFilter === "all" ? true : a.risk === alertFilter
  ).filter(a => !resolvedIds.has(a.id));

  return (
    <div className="space-y-5">
      {/* Header metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SCORE_METRICS.map((m, i) => (
          <motion.div key={m.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.color}28` }}>
            <div className="text-2xl mb-1.5">{m.icon}</div>
            <div className="text-2xl font-black" style={{ color: m.color }}>{m.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{m.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Security score + live threat banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score gauge */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl p-5 flex flex-col items-center justify-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(52,211,153,0.15)" }}>
          <div className="relative w-28 h-28">
            <svg viewBox="0 0 100 100" className="w-full h-full rotate-[-90deg]">
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
              <motion.circle cx="50" cy="50" r="40" fill="none"
                stroke={score >= 80 ? "#34d399" : score >= 60 ? "#f59e0b" : "#ef4444"}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 40}`}
                initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - score / 100) }}
                transition={{ duration: 1.2, ease: "easeOut" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black" style={{ color: score >= 80 ? "#34d399" : "#f59e0b" }}>{score}</span>
              <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>/ 100</span>
            </div>
          </div>
          <p className="text-sm font-black text-white mt-3">Security Score</p>
          <p className="text-[11px] mt-1" style={{ color: score >= 80 ? "#34d399" : "#f59e0b" }}>
            {score >= 80 ? "🟢 Good — Platform Secure" : "🟡 Medium — Action Needed"}
          </p>
        </motion.div>

        {/* Critical alerts banner */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="md:col-span-2 rounded-2xl p-5"
          style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)" }}>
          <div className="flex items-center gap-2 mb-3">
            <motion.div className="w-2 h-2 rounded-full bg-red-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            <h3 className="text-white font-black text-sm">🚨 Active Threat Monitor</h3>
          </div>
          <div className="space-y-2">
            {FRAUD_ALERTS.filter(a => a.risk === "critical" && !resolvedIds.has(a.id)).slice(0, 3).map(a => (
              <motion.div key={a.id} layout
                className="flex items-center gap-3 px-3 py-2 rounded-xl"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <span className="text-lg shrink-0">🔴</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{a.name} <span style={{ color: "rgba(255,255,255,0.4)" }}>({a.id})</span></p>
                  <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{a.reason}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <motion.button whileTap={{ scale: 0.94 }}
                    onClick={() => setResolvedIds(prev => new Set([...prev, a.id]))}
                    className="text-[10px] font-black px-2.5 py-1 rounded-lg cursor-pointer"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    Resolve
                  </motion.button>
                </div>
              </motion.div>
            ))}
            {FRAUD_ALERTS.filter(a => a.risk === "critical" && !resolvedIds.has(a.id)).length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: "#34d399" }}>✅ All critical alerts resolved</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["alerts", "ip", "log"] as const).map(t => (
          <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-xs font-black cursor-pointer capitalize"
            style={{
              background: tab === t ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
              color: tab === t ? "#f87171" : "rgba(255,255,255,0.5)",
              border: `1px solid ${tab === t ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}>
            {t === "alerts" ? "🚨 Fraud Alerts" : t === "ip" ? "🌐 IP Tracker" : "📋 Admin Log"}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Fraud Alerts tab */}
        {tab === "alerts" && (
          <motion.div key="alerts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex gap-2 mb-3 flex-wrap">
              {(["all", "critical", "high", "medium"] as const).map(f => (
                <button key={f} onClick={() => setAlertFilter(f)}
                  className="px-3 py-1 rounded-lg text-[10px] font-black cursor-pointer capitalize"
                  style={{
                    background: alertFilter === f ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)",
                    color: alertFilter === f ? "#f87171" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${alertFilter === f ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  {f}
                </button>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      {["User", "Reason", "IP", "Risk", "Time", "Status", "Actions"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 font-black text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filtered.map((a, i) => {
                        const rc = RISK_CFG[a.risk as keyof typeof RISK_CFG];
                        const ac = ACTION_CFG[a.action];
                        return (
                          <motion.tr key={a.id} layout
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                            transition={{ delay: i * 0.04 }}
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "rgba(255,255,255,0.01)" }}>
                            <td className="px-4 py-3">
                              <p className="font-bold text-white">{a.name}</p>
                              <p style={{ color: "rgba(255,255,255,0.35)" }}>{a.id}</p>
                            </td>
                            <td className="px-4 py-3 max-w-48">
                              <p className="truncate" style={{ color: "rgba(255,255,255,0.6)" }}>{a.reason}</p>
                            </td>
                            <td className="px-4 py-3 font-mono" style={{ color: "#60a5fa" }}>{a.ip}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase"
                                style={{ background: rc.bg, color: rc.color, border: `1px solid ${rc.border}` }}>
                                {a.risk}
                              </span>
                            </td>
                            <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.4)" }}>{a.time}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold"
                                style={{ background: ac.bg, color: ac.color }}>{ac.label}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5">
                                <motion.button whileTap={{ scale: 0.93 }}
                                  onClick={() => setResolvedIds(prev => new Set([...prev, a.id]))}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer"
                                  style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                                  Resolve
                                </motion.button>
                                <motion.button whileTap={{ scale: 0.93 }}
                                  className="px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer"
                                  style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.25)" }}>
                                  Ban
                                </motion.button>
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                    {filtered.length === 0 && (
                      <tr><td colSpan={7} className="text-center py-8 text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        No alerts in this category
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* IP Tracker tab */}
        {tab === "ip" && (
          <motion.div key="ip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    {["IP Address", "Country", "Users", "Logins", "Flagged", "Action"].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-black text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {IP_LOGS.map((row, i) => (
                    <motion.tr key={row.ip} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: row.flag ? "rgba(239,68,68,0.02)" : "transparent" }}>
                      <td className="px-4 py-3 font-mono font-bold" style={{ color: row.flag ? "#f87171" : "#60a5fa" }}>{row.ip}</td>
                      <td className="px-4 py-3 text-white">{row.country}</td>
                      <td className="px-4 py-3 font-black" style={{ color: row.users > 1 ? "#f59e0b" : "#34d399" }}>{row.users}</td>
                      <td className="px-4 py-3" style={{ color: "rgba(255,255,255,0.6)" }}>{row.logins}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
                          style={{ background: row.flag ? "rgba(239,68,68,0.12)" : "rgba(52,211,153,0.10)", color: row.flag ? "#f87171" : "#34d399" }}>
                          {row.flag ? "⚠️ Yes" : "✅ No"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <motion.button whileTap={{ scale: 0.93 }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer"
                          style={{ background: "rgba(239,68,68,0.10)", color: "#f87171", border: "1px solid rgba(239,68,68,0.2)" }}>
                          Block IP
                        </motion.button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Admin log tab */}
        {tab === "log" && (
          <motion.div key="log" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="space-y-2">
            {ADMIN_LOG.map((entry, i) => {
              const typeColor: Record<string, string> = { wallet: "#34d399", ban: "#ef4444", kyc: "#a78bfa", game: "#60a5fa", login: "#f59e0b" };
              return (
                <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: typeColor[entry.type] ?? "#fff" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{entry.action}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{entry.admin}</p>
                  </div>
                  <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.35)" }}>{entry.time}</span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
