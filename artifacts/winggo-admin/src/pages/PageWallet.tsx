/**
 * PageWallet — WINGGO Admin
 * Real-time wallet management:
 *  - Live platform wallet stats (from subscribePlatformStats)
 *  - Withdrawal requests with Approve / Reject actions
 *  - Full Razorpay deposit history with payment IDs
 *  - All-transactions view
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeWithdrawRequests, approveWithdraw, rejectWithdraw,
  subscribeDeposits, subscribePlatformStats,
  WithdrawRequest, DepositRecord, PlatformStats,
} from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(2)}L`;
  if (n >= 1_000)    return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function fmtTs(ts: { seconds: number } | number | undefined): string {
  if (!ts) return "—";
  const d = typeof ts === "number"
    ? new Date(ts)
    : new Date((ts as { seconds: number }).seconds * 1000);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

const STATUS_CFG = {
  pending:  { label: "Pending",  bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", border: "rgba(245,158,11,0.25)"  },
  approved: { label: "Approved", bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.25)"  },
  rejected: { label: "Rejected", bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.25)" },
};

type MainTab = "withdrawals" | "deposits" | "stats";

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function PageWallet() {
  const [tab, setTab]                 = useState<MainTab>("withdrawals");
  const [wdFilter, setWdFilter]       = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [withdrawals, setWithdrawals] = useState<WithdrawRequest[]>([]);
  const [deposits, setDeposits]       = useState<DepositRecord[]>([]);
  const [stats, setStats]             = useState<PlatformStats | null>(null);
  const [actionId, setActionId]       = useState<string | null>(null);
  const [expandedWd, setExpandedWd]   = useState<string | null>(null);
  const [rejectId, setRejectId]       = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => { return subscribePlatformStats(setStats); }, []);
  useEffect(() => { return subscribeWithdrawRequests("all", setWithdrawals); }, []);
  useEffect(() => { return subscribeDeposits(setDeposits); }, []);

  const pendingCount  = withdrawals.filter((w) => w.status === "pending").length;
  const pendingAmount = withdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + w.amount, 0);

  const filteredWD = wdFilter === "all"
    ? withdrawals
    : withdrawals.filter((w) => w.status === wdFilter);

  async function handleApprove(id: string) {
    if (!id) return;
    setActionId(id);
    await approveWithdraw(id, "admin");
    setActionId(null);
  }

  async function handleReject(id: string, reason: string) {
    if (!id) return;
    setActionId(id);
    await rejectWithdraw(id, "admin", reason || "Rejected by admin");
    setActionId(null);
    setRejectId(null);
    setRejectReason("");
  }

  return (
    <div className="space-y-4">

      {/* ── Platform Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            icon: "💰", label: "Total Wallet Balance",
            value: stats ? fmt(stats.totalWalletBalance) : "—",
            sub: "All users combined", color: "#FFD700",
          },
          {
            icon: "📥", label: "Total Deposits",
            value: stats ? fmt(stats.totalDepositsAmount) : "—",
            sub: stats ? `${stats.totalDepositsCount} payments` : "—", color: "#34d399",
          },
          {
            icon: "📤", label: "Total Withdrawals",
            value: stats ? fmt(stats.totalWithdrawalsAmount) : "—",
            sub: stats ? `${stats.totalWithdrawalsCount} approved` : "—", color: "#f472b6",
          },
          {
            icon: "⏳", label: "Pending Withdrawals",
            value: stats ? String(stats.pendingWithdrawals) : "—",
            sub: stats ? `${fmt(stats.pendingWithdrawalsAmount)} waiting` : "—",
            color: "#f59e0b",
          },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-lg font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-bold text-white">{s.label}</div>
            <div className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Wallet balance breakdown ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Winning Balance", value: stats?.totalWinningBalance ?? 0, color: "#34d399", icon: "🏆", sub: "Withdrawable" },
          { label: "Deposit Balance", value: stats?.totalDepositBalance ?? 0, color: "#60a5fa", icon: "💳", sub: "Deposited funds" },
          { label: "Bonus Balance",   value: stats?.totalBonusBalance   ?? 0, color: "#FFD700", icon: "🎁", sub: "Reward credits" },
        ].map((b) => (
          <motion.div key={b.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${b.color}22` }}>
            <div className="text-xl mb-1.5">{b.icon}</div>
            <div className="text-sm font-black" style={{ color: b.color }}>{fmt(b.value)}</div>
            <div className="text-xs font-bold text-white">{b.label}</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{b.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Live sync banner ── */}
      {FIREBASE_ENABLED && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          🔥 Real-time Firebase sync · {pendingCount} pending withdrawal{pendingCount !== 1 ? "s" : ""} ({fmt(pendingAmount)} total)
        </div>
      )}

      {/* ── Tab selector ── */}
      <div className="flex gap-2">
        {([
          { id: "withdrawals", label: `📤 Withdrawals${pendingCount > 0 ? ` (${pendingCount} pending)` : ""}` },
          { id: "deposits",    label: `📥 Deposits (${deposits.length})` },
        ] as { id: MainTab; label: string }[]).map((t) => (
          <motion.button key={t.id} whileTap={{ scale: 0.97 }} onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl font-black text-xs cursor-pointer"
            style={{
              background: tab === t.id ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
              color: tab === t.id ? "#FFD700" : "rgba(255,255,255,0.4)",
              border: `1px solid ${tab === t.id ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.08)"}`,
            }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      {/* ═══════════════ WITHDRAWALS ═══════════════ */}
      {tab === "withdrawals" && (
        <div className="space-y-3">
          {/* Status filter */}
          <div className="flex gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((f) => {
              const count = f === "all" ? withdrawals.length : withdrawals.filter((w) => w.status === f).length;
              return (
                <motion.button key={f} whileTap={{ scale: 0.95 }} onClick={() => setWdFilter(f)}
                  className="px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer capitalize"
                  style={{
                    background: wdFilter === f ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.04)",
                    color: wdFilter === f ? "#FFD700" : "rgba(255,255,255,0.4)",
                    border: `1px solid ${wdFilter === f ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  {f} ({count})
                </motion.button>
              );
            })}
          </div>

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Header */}
            <div className="grid px-4 py-3 text-[10px] font-black tracking-widest uppercase"
              style={{
                gridTemplateColumns: "0.8fr 1.6fr 0.9fr 1.2fr 0.8fr 0.7fr 1fr",
                background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}>
              <span>ID</span><span>User</span><span>Amount</span>
              <span>UPI ID</span><span>Date</span><span>Status</span><span>Action</span>
            </div>

            {filteredWD.length === 0 && (
              <div className="py-10 text-center">
                <span className="text-3xl opacity-30">📤</span>
                <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  No withdrawal requests
                </p>
              </div>
            )}

            <AnimatePresence>
              {filteredWD.map((w, i) => {
                const cfg  = STATUS_CFG[w.status] ?? STATUS_CFG.pending;
                const busy = actionId === w.id;

                return (
                  <motion.div key={w.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    style={{ borderBottom: i < filteredWD.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>

                    {/* Main row */}
                    <div className="grid items-center px-4 py-3"
                      style={{ gridTemplateColumns: "0.8fr 1.6fr 0.9fr 1.2fr 0.8fr 0.7fr 1fr" }}>
                      <span className="text-[10px] font-mono truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                        {w.id?.slice(-6)}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white truncate">{w.displayName}</p>
                        <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{w.email}</p>
                      </div>
                      <span className="text-sm font-black" style={{ color: "#f87171" }}>₹{w.amount.toLocaleString("en-IN")}</span>
                      <span className="text-[10px] truncate font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {w.upiId || "—"}
                      </span>
                      <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {fmtTs(w.requestedAt)}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full inline-block"
                        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                        {cfg.label}
                      </span>

                      {/* Action buttons */}
                      {w.status === "pending" ? (
                        <div className="flex gap-1">
                          {/* Approve */}
                          <motion.button whileTap={{ scale: 0.88 }} disabled={busy}
                            onClick={() => handleApprove(w.id ?? "")}
                            className="flex-1 py-1.5 rounded-lg font-black text-[10px] cursor-pointer disabled:opacity-40"
                            style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                            {busy && actionId === w.id ? "…" : "✓ Pay"}
                          </motion.button>
                          {/* Reject */}
                          <motion.button whileTap={{ scale: 0.88 }} disabled={busy}
                            onClick={() => { setRejectId(w.id ?? null); setRejectReason(""); }}
                            className="flex-1 py-1.5 rounded-lg font-black text-[10px] cursor-pointer disabled:opacity-40"
                            style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                            ✕
                          </motion.button>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {w.status === "approved" ? "✓ Paid" : "✕ Rejected"}
                          </span>
                          {w.processedAt && (
                            <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                              {fmtTs(w.processedAt)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Reject reason modal inline */}
                    <AnimatePresence>
                      {rejectId === w.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                          style={{ borderTop: "1px solid rgba(248,113,113,0.12)" }}>
                          <div className="px-4 pb-3 pt-2 flex gap-2">
                            <input
                              placeholder="Reason for rejection (optional)…"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              className="flex-1 rounded-xl px-3 py-2 text-xs text-white outline-none"
                              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(248,113,113,0.25)", caretColor: "#f87171" }}
                            />
                            <motion.button whileTap={{ scale: 0.93 }}
                              onClick={() => handleReject(w.id ?? "", rejectReason)}
                              className="px-4 py-2 rounded-xl text-xs font-black cursor-pointer"
                              style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                              Reject
                            </motion.button>
                            <motion.button whileTap={{ scale: 0.93 }}
                              onClick={() => setRejectId(null)}
                              className="px-3 py-2 rounded-xl text-xs font-black cursor-pointer"
                              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)" }}>
                              Cancel
                            </motion.button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ═══════════════ DEPOSITS (Razorpay) ═══════════════ */}
      {tab === "deposits" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Header */}
          <div className="grid px-4 py-3 text-[10px] font-black tracking-widest uppercase"
            style={{
              gridTemplateColumns: "1.5fr 0.8fr 1fr 1.2fr 1.5fr 0.7fr",
              background: "rgba(52,211,153,0.05)", color: "rgba(52,211,153,0.6)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}>
            <span>User</span><span>Amount</span><span>Bonus</span>
            <span>Razorpay ID</span><span>Date & Time</span><span>Status</span>
          </div>

          {deposits.length === 0 && (
            <div className="py-10 text-center">
              <span className="text-3xl opacity-30">📥</span>
              <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                {FIREBASE_ENABLED ? "No deposits yet" : "No data"}
              </p>
            </div>
          )}

          <AnimatePresence>
            {deposits.map((d, i) => (
              <motion.div key={d.id ?? i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.03 }}
                className="grid items-center px-4 py-3"
                style={{
                  gridTemplateColumns: "1.5fr 0.8fr 1fr 1.2fr 1.5fr 0.7fr",
                  background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  borderBottom: i < deposits.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                {/* User */}
                <div>
                  <p className="text-xs font-bold text-white truncate">{d.displayName}</p>
                  <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{d.email}</p>
                </div>

                {/* Amount */}
                <span className="text-sm font-black" style={{ color: "#34d399" }}>
                  ₹{d.amount.toLocaleString("en-IN")}
                </span>

                {/* Bonus */}
                <div>
                  <span className="text-xs font-black" style={{ color: "#FFD700" }}>
                    +₹{d.bonusAmount || 0}
                  </span>
                  {d.bonusPct > 0 && (
                    <span className="ml-1 text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.5)" }}>
                      ({d.bonusPct}%)
                    </span>
                  )}
                </div>

                {/* Payment ID */}
                <div>
                  <p className="text-[10px] font-mono truncate" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {d.razorpayPaymentId || "—"}
                  </p>
                  <p className="text-[9px] font-mono truncate" style={{ color: "rgba(255,255,255,0.2)" }}>
                    {d.razorpayOrderId?.slice(0, 16) || "—"}
                  </p>
                </div>

                {/* Timestamp */}
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {fmtTs(d.createdAt as { seconds: number } | number)}
                </span>

                {/* Status */}
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full inline-block"
                  style={d.status === "success"
                    ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                    : d.status === "failed"
                    ? { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }
                    : { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.2)" }}>
                  {d.status === "success" ? "✓ PAID" : d.status === "failed" ? "✕ FAILED" : "⏳ PENDING"}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
