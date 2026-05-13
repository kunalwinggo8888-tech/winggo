import { useState } from "react";
import { motion } from "framer-motion";

const TOP_REFERRERS = [
  { rank: 1, name: "Arjun Menon",   code: "ARJUN50",  referred: 42, earned: 2100, pending: 0,   status: "active"  },
  { rank: 2, name: "Rahul Sharma",  code: "RAHUL22",  referred: 38, earned: 1900, pending: 100,  status: "active"  },
  { rank: 3, name: "Amit Kumar",    code: "AMIT88",   referred: 31, earned: 1550, pending: 50,   status: "active"  },
  { rank: 4, name: "Vikram Singh",  code: "VIK2025",  referred: 24, earned: 1200, pending: 0,    status: "active"  },
  { rank: 5, name: "Priya Patel",   code: "PRIYA10",  referred: 18, earned: 900,  pending: 200,  status: "active"  },
  { rank: 6, name: "Meera Nair",    code: "MEERA99",  referred: 12, earned: 600,  pending: 0,    status: "suspended"},
  { rank: 7, name: "Deepika Joshi", code: "DEEP77",   referred: 9,  earned: 450,  pending: 50,   status: "active"  },
  { rank: 8, name: "Suresh Yadav",  code: "SURE01",   referred: 5,  earned: 250,  pending: 0,    status: "active"  },
];

const RECENT_REFS = [
  { referrer: "Arjun Menon",  newUser: "Kavya Reddy",   bonus: 50,  time: "5m ago",  credited: true  },
  { referrer: "Rahul Sharma", newUser: "Sanjay Gupta",  bonus: 50,  time: "18m ago", credited: true  },
  { referrer: "Amit Kumar",   newUser: "Pooja Verma",   bonus: 50,  time: "42m ago", credited: false },
  { referrer: "Priya Patel",  newUser: "Kartik Nair",   bonus: 50,  time: "1h ago",  credited: true  },
  { referrer: "Vikram Singh", newUser: "Anjali Sharma",  bonus: 50,  time: "2h ago",  credited: true  },
];

export default function PageReferrals() {
  const [bonusPerRef, setBonusPerRef]   = useState(50);
  const [minDeposit, setMinDeposit]     = useState(100);
  const [maxEarnCap, setMaxEarnCap]     = useState(5000);
  const [saved, setSaved]               = useState(false);

  const totalEarned  = TOP_REFERRERS.reduce((s, r) => s + r.earned, 0);
  const totalPending = TOP_REFERRERS.reduce((s, r) => s + r.pending, 0);
  const totalRefs    = TOP_REFERRERS.reduce((s, r) => s + r.referred, 0);

  function saveSettings() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: "🔗", label: "Total Referrals",  value: totalRefs,                              color: "#60a5fa" },
          { icon: "💰", label: "Total Paid Out",   value: `₹${totalEarned.toLocaleString()}`,    color: "#34d399" },
          { icon: "⏳", label: "Pending Bonus",    value: `₹${totalPending.toLocaleString()}`,   color: "#f59e0b" },
          { icon: "👤", label: "Active Referrers", value: TOP_REFERRERS.filter(r => r.status === "active").length, color: "#a78bfa" },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}28` }}>
            <div className="text-xl mb-1">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Settings card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.10)" }}>
          <h3 className="text-white font-black text-sm mb-4">⚙️ Referral Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Bonus Per Referral (₹)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={10} max={200} step={10} value={bonusPerRef}
                  onChange={e => setBonusPerRef(Number(e.target.value))}
                  className="flex-1 accent-yellow-400 cursor-pointer" />
                <span className="text-sm font-black w-12 text-right" style={{ color: "#FFD700" }}>₹{bonusPerRef}</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Min Deposit to Unlock (₹)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={50} max={500} step={50} value={minDeposit}
                  onChange={e => setMinDeposit(Number(e.target.value))}
                  className="flex-1 accent-purple-400 cursor-pointer" />
                <span className="text-sm font-black w-12 text-right" style={{ color: "#a78bfa" }}>₹{minDeposit}</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wide mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                Max Earn Cap (₹)
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={500} max={10000} step={500} value={maxEarnCap}
                  onChange={e => setMaxEarnCap(Number(e.target.value))}
                  className="flex-1 accent-green-400 cursor-pointer" />
                <span className="text-sm font-black w-12 text-right" style={{ color: "#34d399" }}>₹{maxEarnCap}</span>
              </div>
            </div>

            <div className="pt-2 rounded-xl p-3 space-y-1.5" style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.1)" }}>
              <p className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.4)" }}>CURRENT CONFIG</p>
              <p className="text-xs text-white">Refer a friend → Both get <span style={{ color: "#FFD700" }}>₹{bonusPerRef}</span></p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Triggered on ≥ ₹{minDeposit} deposit</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Max cap per user: ₹{maxEarnCap.toLocaleString()}</p>
            </div>

            <motion.button whileTap={{ scale: 0.96 }} onClick={saveSettings}
              className="w-full py-2.5 rounded-xl text-xs font-black cursor-pointer"
              style={{ background: saved ? "rgba(52,211,153,0.2)" : "linear-gradient(135deg,#FFD700,#ff8c00)", color: saved ? "#34d399" : "#000", border: saved ? "1px solid rgba(52,211,153,0.4)" : "none" }}>
              {saved ? "✅ Saved!" : "💾 Save Settings"}
            </motion.button>
          </div>
        </motion.div>

        {/* Recent referral activity */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <h3 className="text-white font-black text-sm mb-3">⚡ Live Activity</h3>
          <div className="space-y-2.5">
            {RECENT_REFS.map((r, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                className="px-3 py-2.5 rounded-xl"
                style={{ background: r.credited ? "rgba(52,211,153,0.05)" : "rgba(245,158,11,0.05)", border: `1px solid ${r.credited ? "rgba(52,211,153,0.12)" : "rgba(245,158,11,0.12)"}` }}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-white">{r.referrer}</span>
                  <span className="text-xs font-black" style={{ color: "#34d399" }}>+₹{r.bonus}</span>
                </div>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Referred: {r.newUser}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>{r.time}</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: r.credited ? "rgba(52,211,153,0.12)" : "rgba(245,158,11,0.12)", color: r.credited ? "#34d399" : "#f59e0b" }}>
                    {r.credited ? "Credited" : "Pending"}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Cashback settings */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="rounded-2xl p-5"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(96,165,250,0.12)" }}>
          <h3 className="text-white font-black text-sm mb-4">💸 Cashback Settings</h3>
          <div className="space-y-3">
            {[
              { label: "First Deposit Bonus",     value: "50%", sub: "Up to ₹500", color: "#FFD700", on: true  },
              { label: "Daily Login Bonus",        value: "₹5",  sub: "Max 7 days", color: "#34d399", on: true  },
              { label: "Weekend Cashback",         value: "10%", sub: "On losses",   color: "#a78bfa", on: false },
              { label: "Level-Up Bonus",           value: "₹25", sub: "Per level",   color: "#60a5fa", on: true  },
            ].map((cb, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white">{cb.label}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{cb.sub}</p>
                </div>
                <span className="text-sm font-black" style={{ color: cb.color }}>{cb.value}</span>
                <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-all`}
                  style={{ background: cb.on ? "rgba(52,211,153,0.3)" : "rgba(255,255,255,0.12)", border: `1px solid ${cb.on ? "#34d399" : "rgba(255,255,255,0.2)"}` }}>
                  <div className="w-3 h-3 rounded-full absolute top-0.5 transition-all"
                    style={{ left: cb.on ? "calc(100% - 14px)" : "2px", background: cb.on ? "#34d399" : "rgba(255,255,255,0.5)" }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top referrers table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-white font-black text-sm">🏆 Top Referrers</h3>
          <motion.button whileTap={{ scale: 0.95 }}
            className="px-3 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
            style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
            📥 Export CSV
          </motion.button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Rank", "Name", "Code", "Referred", "Earned", "Pending", "Status", "Action"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-black text-[10px] uppercase tracking-wide" style={{ color: "rgba(255,255,255,0.35)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_REFERRERS.map((r, i) => (
                <motion.tr key={r.code} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="px-4 py-3 font-black" style={{ color: i < 3 ? "#FFD700" : "rgba(255,255,255,0.5)" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${r.rank}`}
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{r.name}</td>
                  <td className="px-4 py-3 font-mono" style={{ color: "#a78bfa" }}>{r.code}</td>
                  <td className="px-4 py-3 font-black" style={{ color: "#60a5fa" }}>{r.referred}</td>
                  <td className="px-4 py-3 font-black" style={{ color: "#34d399" }}>₹{r.earned.toLocaleString()}</td>
                  <td className="px-4 py-3 font-bold" style={{ color: r.pending > 0 ? "#f59e0b" : "rgba(255,255,255,0.3)" }}>
                    {r.pending > 0 ? `₹${r.pending}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black"
                      style={{ background: r.status === "active" ? "rgba(52,211,153,0.12)" : "rgba(239,68,68,0.12)", color: r.status === "active" ? "#34d399" : "#f87171" }}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <motion.button whileTap={{ scale: 0.93 }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer"
                      style={{ background: "rgba(96,165,250,0.10)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                      View
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
