import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeWithdrawRequests, approveWithdraw, rejectWithdraw,
  subscribeRecentDeposits, WithdrawRequest,
} from "@/firebase/admin.service";
import { MOCK_WITHDRAWALS } from "@/data/mockData";
import { FIREBASE_ENABLED } from "@/firebase/config";

const STATUS_CFG = {
  pending:  { label: "Pending",  bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", border: "rgba(245,158,11,0.25)"  },
  approved: { label: "Approved", bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.25)"  },
  rejected: { label: "Rejected", bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.25)" },
};

const SUMMARY_DEMO = [
  { label: "Total Deposited",     value: "₹24,31,500", color: "#34d399", icon: "📥" },
  { label: "Total Withdrawn",     value: "₹18,72,000", color: "#f87171", icon: "📤" },
  { label: "Pending Withdrawals", value: "₹4,700",     color: "#f59e0b", icon: "⏳" },
  { label: "Bonus Issued",        value: "₹1,24,000",  color: "#a78bfa", icon: "🎁" },
];

type LocalWD = { id: string; user: string; phone?: string; amount: number; bank?: string; upiId?: string; method?: string; date?: string; status: string };

function toLocal(r: WithdrawRequest): LocalWD {
  return {
    id: r.id ?? "",
    user: r.displayName,
    phone: r.phone,
    amount: r.amount,
    upiId: r.upiId,
    method: "UPI",
    date: r.requestedAt ? new Date((r.requestedAt as { seconds: number }).seconds * 1000).toLocaleDateString("en-IN") : "—",
    status: r.status,
  };
}

type DepositRow = { user: string; amount: number; date: string; method: string };

const MOCK_DEPOSITS: DepositRow[] = [
  { user: "Rahul Sharma",  amount: 500,  date: "Today 09:15",      method: "GPay"    },
  { user: "Amit Kumar",    amount: 2000, date: "Today 08:52",      method: "Bank"    },
  { user: "Vikram Singh",  amount: 1000, date: "Today 08:30",      method: "PhonePe" },
  { user: "Arjun Menon",   amount: 5000, date: "Yesterday 07:45",  method: "Bank"    },
  { user: "Priya Patel",   amount: 200,  date: "Yesterday 07:10",  method: "UPI"     },
];

export default function PageWallet() {
  const [withdrawals, setWithdrawals] = useState<LocalWD[]>(
    FIREBASE_ENABLED ? [] : (MOCK_WITHDRAWALS as LocalWD[])
  );
  const [deposits, setDeposits]   = useState<DepositRow[]>(FIREBASE_ENABLED ? [] : MOCK_DEPOSITS);
  const [tab, setTab]             = useState<"withdrawals" | "deposits">("withdrawals");
  const [actionId, setActionId]   = useState<string | null>(null);

  useEffect(() => {
    const unsubWD = subscribeWithdrawRequests("all", (reqs) => {
      if (reqs.length > 0) setWithdrawals(reqs.map(toLocal));
    });
    const unsubDep = subscribeRecentDeposits((deps) => {
      if (deps.length > 0) setDeposits(deps);
      else if (!FIREBASE_ENABLED) setDeposits(MOCK_DEPOSITS);
    });
    return () => { unsubWD(); unsubDep(); };
  }, []);

  async function handleApprove(id: string) {
    setActionId(id);
    if (FIREBASE_ENABLED) {
      await approveWithdraw(id, "admin");
    } else {
      setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: "approved" } : w));
    }
    setActionId(null);
  }

  async function handleReject(id: string) {
    setActionId(id);
    if (FIREBASE_ENABLED) {
      await rejectWithdraw(id, "admin", "Rejected by admin");
    } else {
      setWithdrawals(prev => prev.map(w => w.id === id ? { ...w, status: "rejected" } : w));
    }
    setActionId(null);
  }

  const pendingCount = withdrawals.filter(w => w.status === "pending").length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUMMARY_DEMO.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
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
          🔥 Live Firebase sync · {pendingCount} pending withdrawal{pendingCount !== 1 ? "s" : ""}
        </div>
      )}

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
            {t === "withdrawals" ? `📤 Withdrawal Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "📥 Deposit History"}
          </motion.button>
        ))}
      </div>

      {/* Withdrawal requests */}
      {tab === "withdrawals" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="grid grid-cols-7 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
            style={{ background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span>ID</span><span className="col-span-2">User</span><span>Amount</span>
            <span>UPI</span><span>Status</span><span>Action</span>
          </div>

          {withdrawals.length === 0 && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              No withdrawal requests yet
            </div>
          )}

          {withdrawals.map((w, i) => {
            const cfg = STATUS_CFG[w.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
            const busy = actionId === w.id;
            return (
              <AnimatePresence key={w.id}>
                <motion.div
                  className="grid grid-cols-7 gap-2 items-center px-4 py-3"
                  style={{
                    background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    borderBottom: i < withdrawals.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  }}>
                  <span className="text-xs font-bold truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {w.id.slice(-6)}
                  </span>
                  <div className="col-span-2">
                    <p className="text-xs font-bold text-white truncate">{w.user}</p>
                    <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{w.phone ?? "—"} · {w.date}</p>
                  </div>
                  <span className="text-xs font-black" style={{ color: "#f87171" }}>₹{w.amount.toLocaleString()}</span>
                  <span className="text-[10px] truncate font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {w.upiId ?? w.method ?? "UPI"}
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full inline-block"
                    style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                  {w.status === "pending" ? (
                    <div className="flex gap-1.5">
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => handleApprove(w.id)} disabled={busy}
                        className="flex-1 py-1 rounded-lg font-black text-[10px] cursor-pointer disabled:opacity-50"
                        style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                        {busy ? "…" : "✓"}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }}
                        onClick={() => handleReject(w.id)} disabled={busy}
                        className="flex-1 py-1 rounded-lg font-black text-[10px] cursor-pointer disabled:opacity-50"
                        style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                        {busy ? "…" : "✕"}
                      </motion.button>
                    </div>
                  ) : (
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Done</span>
                  )}
                </motion.div>
              </AnimatePresence>
            );
          })}
        </div>
      )}

      {/* Deposit history */}
      {tab === "deposits" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="grid grid-cols-4 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
            style={{ background: "rgba(52,211,153,0.05)", color: "rgba(52,211,153,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="col-span-2">User / UID</span><span>Amount</span><span>Date · Method</span>
          </div>

          {deposits.length === 0 && (
            <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
              {FIREBASE_ENABLED ? "No deposits yet — deposits will appear here as users add money" : "Loading demo deposits…"}
            </div>
          )}

          {deposits.map((d, i) => (
            <motion.div key={`${d.user}-${i}`}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className="grid grid-cols-4 gap-2 items-center px-4 py-3"
              style={{
                background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                borderBottom: i < deposits.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
              <div className="col-span-2">
                <p className="text-xs font-bold text-white truncate">{d.user}</p>
                <p className="text-[10px] truncate font-mono" style={{ color: "rgba(255,255,255,0.25)" }}>{d.user.length > 8 ? d.user.slice(0, 8) + "…" : d.user}</p>
              </div>
              <span className="text-sm font-black" style={{ color: "#34d399" }}>₹{d.amount.toLocaleString("en-IN")}</span>
              <div>
                <p className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>{d.date}</p>
                <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.25)" }}>{d.method}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
