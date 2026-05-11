import { useState } from "react";
import { motion } from "framer-motion";
import { MOCK_WITHDRAWALS } from "@/data/mockData";

type WD = typeof MOCK_WITHDRAWALS[number] & { status: string };

const STATUS_CFG = {
  pending:  { label: "Pending",  bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", border: "rgba(245,158,11,0.25)"  },
  approved: { label: "Approved", bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.25)"  },
  rejected: { label: "Rejected", bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.25)" },
};

const SUMMARY = [
  { label: "Total Deposited",  value: "₹24,31,500", color: "#34d399",  icon: "📥" },
  { label: "Total Withdrawn",  value: "₹18,72,000", color: "#f87171",  icon: "📤" },
  { label: "Pending Withdrawals", value: "₹4,700",  color: "#f59e0b",  icon: "⏳" },
  { label: "Bonus Issued",     value: "₹1,24,000",  color: "#a78bfa",  icon: "🎁" },
];

export default function PageWallet() {
  const [withdrawals, setWithdrawals] = useState<WD[]>(MOCK_WITHDRAWALS as WD[]);
  const [tab, setTab] = useState<"withdrawals" | "deposits">("withdrawals");

  function setStatus(id: string, status: string) {
    setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUMMARY.map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["withdrawals", "deposits"] as const).map(t => (
          <motion.button key={t} whileTap={{ scale: 0.97 }} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl font-black text-xs cursor-pointer capitalize"
            style={{
              background: tab === t ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              color: tab === t ? "#FFD700" : "rgba(255,255,255,0.4)",
              border: `1px solid ${tab === t ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.08)"}`,
            }}>
            {t === "withdrawals" ? "📤 Withdrawal Requests" : "📥 Deposit History"}
          </motion.button>
        ))}
      </div>

      {/* Withdrawal requests */}
      {tab === "withdrawals" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="grid grid-cols-7 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
            style={{ background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span>ID</span>
            <span className="col-span-2">User</span>
            <span>Amount</span>
            <span>Method</span>
            <span>Status</span>
            <span>Action</span>
          </div>

          {withdrawals.map((w, i) => {
            const cfg = STATUS_CFG[w.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
            return (
              <div key={w.id}
                className="grid grid-cols-7 gap-2 items-center px-4 py-3"
                style={{
                  background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  borderBottom: i < withdrawals.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>{w.id}</span>

                <div className="col-span-2">
                  <p className="text-xs font-bold text-white">{w.user}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{w.bank} · {w.date}</p>
                </div>

                <span className="text-xs font-black" style={{ color: "#f87171" }}>₹{w.amount.toLocaleString()}</span>

                <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{w.method}</span>

                <span className="text-[10px] font-black px-2 py-0.5 rounded-full inline-block"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                  {cfg.label}
                </span>

                {w.status === "pending" ? (
                  <div className="flex gap-1.5">
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStatus(w.id, "approved")}
                      className="flex-1 py-1 rounded-lg font-black text-[10px] cursor-pointer"
                      style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                      ✓
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setStatus(w.id, "rejected")}
                      className="flex-1 py-1 rounded-lg font-black text-[10px] cursor-pointer"
                      style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                      ✕
                    </motion.button>
                  </div>
                ) : (
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Done</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Deposit history placeholder */}
      {tab === "deposits" && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="text-4xl mb-3">📥</div>
          <p className="text-white font-black text-sm mb-1">Deposit History</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>All 382 deposits from today are logged here</p>
          <div className="mt-4 space-y-2">
            {["Rahul Sharma — ₹500 via GPay — 09:15", "Amit Kumar — ₹2,000 via Bank — 08:52", "Vikram Singh — ₹1,000 via PhonePe — 08:30",
              "Arjun Menon — ₹5,000 via Bank — 07:45", "Priya Patel — ₹200 via UPI — 07:10"].map((d, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl text-xs"
                style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.12)" }}>
                <span style={{ color: "rgba(255,255,255,0.65)" }}>{d.split(" — ")[0]}</span>
                <span className="font-black" style={{ color: "#34d399" }}>{d.split(" — ")[1]}</span>
                <span style={{ color: "rgba(255,255,255,0.3)" }}>{d.split(" — ")[2]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
