/**
 * TabTransactions — Transactions & Withdrawals sub-tab
 * Approve/Reject withdrawal cashouts, view deposit history
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeWithdrawRequests, approveWithdraw, rejectWithdraw,
  subscribeDeposits,
  WithdrawRequest, DepositRecord,
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

const ADMIN_UID = "admin";

function fmtTs(ts: { seconds?: number } | undefined): string {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Reject Reason Modal ──────────────────────────────────────────────────────

function RejectModal({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(5px)" }}
        onClick={onClose} />
      <motion.div key="m" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="fixed inset-x-4 z-50 mx-auto rounded-2xl overflow-hidden"
        style={{ maxWidth: 380, top: "50%", transform: "translateY(-50%)", background: "#0a0f1a", border: "1px solid rgba(255,51,102,0.25)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,51,102,0.1)" }}>
          <p className="text-sm font-black text-white">Rejection Reason</p>
          <p className="text-[11px] mt-0.5" style={{ color: T.muted }}>This will refund the amount back to the user's wallet.</p>
        </div>
        <div className="p-5 space-y-3">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason for rejection (optional)…"
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,51,102,0.2)", caretColor: T.red }} />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", color: T.muted, border: "1px solid rgba(255,255,255,0.08)" }}>
              Cancel
            </button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => onConfirm(reason)}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{ background: "rgba(255,51,102,0.1)", color: T.red, border: "1px solid rgba(255,51,102,0.25)" }}>
              ✕ Reject & Refund
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Withdrawal Card ──────────────────────────────────────────────────────────

function WithdrawCard({ req, onApprove, onReject }: {
  req: WithdrawRequest;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusColor = req.status === "approved" ? T.green : req.status === "rejected" ? T.red : T.gold;
  const isPending   = req.status === "pending";
  return (
    <div className="rounded-xl px-4 py-3" style={{ background: T.card, border: `1px solid ${T.bdr}` }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
          style={{ background: "rgba(0,212,255,0.1)", color: T.blue, border: "1px solid rgba(0,212,255,0.2)" }}>
          ₹
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-black text-white">{req.displayName}</p>
              <p className="text-[11px]" style={{ color: T.muted }}>{req.email}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-base font-black" style={{ color: T.green }}>₹{req.amount}</p>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                style={{ background: `${statusColor}15`, color: statusColor }}>
                {req.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-3 flex-wrap text-[11px]" style={{ color: T.muted }}>
            <span>📱 UPI: <span className="font-mono text-white">{req.upiId}</span></span>
            <span>🕐 {fmtTs(req.requestedAt as unknown as { seconds?: number })}</span>
          </div>

          {req.rejectionReason && (
            <p className="mt-1 text-[11px]" style={{ color: T.red }}>Rejected: {req.rejectionReason}</p>
          )}

          {isPending && (
            <div className="flex gap-2 mt-3">
              <motion.button whileTap={{ scale: 0.95 }} onClick={onApprove}
                className="flex-1 py-2 rounded-lg text-xs font-black cursor-pointer"
                style={{ background: "rgba(0,255,136,0.08)", color: T.green, border: "1px solid rgba(0,255,136,0.22)" }}>
                ✓ Approve
              </motion.button>
              <motion.button whileTap={{ scale: 0.95 }} onClick={onReject}
                className="flex-1 py-2 rounded-lg text-xs font-black cursor-pointer"
                style={{ background: "rgba(255,51,102,0.08)", color: T.red, border: "1px solid rgba(255,51,102,0.2)" }}>
                ✕ Reject
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TabTransactions() {
  const [withdrawals, setWithdrawals]   = useState<WithdrawRequest[]>([]);
  const [deposits, setDeposits]         = useState<DepositRecord[]>([]);
  const [wFilter, setWFilter]           = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rejectTarget, setRejectTarget] = useState<WithdrawRequest | null>(null);
  const [processing, setProcessing]     = useState<string | null>(null);
  const [section, setSection]           = useState<"withdrawals" | "deposits">("withdrawals");

  useEffect(() => {
    const unsub = subscribeWithdrawRequests(wFilter, setWithdrawals);
    return unsub;
  }, [wFilter]);

  useEffect(() => {
    const unsub = subscribeDeposits(setDeposits);
    return unsub;
  }, []);

  async function handleApprove(req: WithdrawRequest) {
    if (!req.id) return;
    setProcessing(req.id);
    await approveWithdraw(req.id, ADMIN_UID);
    setProcessing(null);
  }

  async function handleReject(req: WithdrawRequest, reason: string) {
    if (!req.id) return;
    setProcessing(req.id);
    await rejectWithdraw(req.id, ADMIN_UID, reason);
    setRejectTarget(null);
    setProcessing(null);
  }

  const STATUS_TABS: { id: typeof wFilter; label: string }[] = [
    { id: "pending",  label: "Pending"  },
    { id: "approved", label: "Approved" },
    { id: "rejected", label: "Rejected" },
    { id: "all",      label: "All"      },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">

      {/* Section switcher */}
      <div className="flex gap-2">
        {[
          { id: "withdrawals", label: "💸 Withdrawals" },
          { id: "deposits",    label: "💳 Deposits"    },
        ].map((s) => {
          const isActive = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id as typeof section)}
              className="px-4 py-2 rounded-xl text-sm font-black cursor-pointer"
              style={{
                background: isActive ? "rgba(0,212,255,0.1)"  : "rgba(255,255,255,0.03)",
                color:      isActive ? T.blue                  : T.muted,
                border:     `1px solid ${isActive ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.07)"}`,
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── Withdrawals ─────────────────────────────────────────────────── */}
      {section === "withdrawals" && (
        <>
          {/* Status filter */}
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map((s) => {
              const isActive = wFilter === s.id;
              return (
                <button key={s.id} onClick={() => setWFilter(s.id)}
                  className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
                  style={{
                    background: isActive ? "rgba(0,212,255,0.09)"  : "rgba(255,255,255,0.03)",
                    color:      isActive ? T.blue                  : T.muted,
                    border:     `1px solid ${isActive ? "rgba(0,212,255,0.22)" : "rgba(255,255,255,0.06)"}`,
                  }}>
                  {s.label}
                  {s.id === "pending" && withdrawals.length > 0 && wFilter !== "pending" && (
                    <span className="ml-1.5 px-1 rounded text-[9px]" style={{ background: T.gold + "25", color: T.gold }}>
                      {withdrawals.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {withdrawals.length === 0 ? (
            <div className="rounded-2xl py-14 text-center" style={{ border: `1px dashed rgba(0,212,255,0.12)` }}>
              <p className="text-3xl mb-3 opacity-20">💸</p>
              <p className="text-sm font-bold" style={{ color: T.muted }}>No {wFilter} withdrawal requests.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {withdrawals.map((req) => (
                <div key={req.id} style={{ opacity: processing === req.id ? 0.5 : 1, transition: "opacity 0.2s" }}>
                  <WithdrawCard
                    req={req}
                    onApprove={() => handleApprove(req)}
                    onReject={() => setRejectTarget(req)}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Deposits ────────────────────────────────────────────────────── */}
      {section === "deposits" && (
        <>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-black text-white">Deposit History</h4>
            <span className="text-[10px] px-2 py-0.5 rounded font-black"
              style={{ background: "rgba(0,212,255,0.08)", color: T.blue }}>{deposits.length} records</span>
          </div>

          {deposits.length === 0 ? (
            <div className="rounded-2xl py-14 text-center" style={{ border: `1px dashed rgba(0,212,255,0.12)` }}>
              <p className="text-3xl mb-3 opacity-20">💳</p>
              <p className="text-sm font-bold" style={{ color: T.muted }}>No deposits found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deposits.map((dep, i) => {
                const statusColor = dep.status === "success" ? T.green : dep.status === "failed" ? T.red : T.gold;
                return (
                  <div key={dep.id ?? i} className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{ background: T.card, border: `1px solid ${T.bdr}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-black text-white">{dep.displayName}</p>
                          <p className="text-[11px]" style={{ color: T.muted }}>{dep.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black" style={{ color: T.green }}>₹{dep.amount}</p>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                            style={{ background: `${statusColor}15`, color: statusColor }}>
                            {dep.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-1 text-[11px] font-mono" style={{ color: T.muted }}>
                        {dep.razorpayPaymentId ? `ID: ${dep.razorpayPaymentId}` : "—"}
                        {dep.bonusAmount > 0 && ` · Bonus: ₹${dep.bonusAmount}`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Reject modal */}
      <AnimatePresence>
        {rejectTarget && (
          <RejectModal
            onConfirm={(r) => handleReject(rejectTarget, r)}
            onClose={() => setRejectTarget(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
