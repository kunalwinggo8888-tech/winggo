/**
 * PageDeposits — Admin panel: Screenshot Deposit Verification
 * Admin can view, approve, or reject user screenshot deposit requests.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeScreenshotDeposits,
  approveScreenshotDeposit,
  rejectScreenshotDeposit,
  DepositRequest,
} from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const NOW = Date.now();
const MOCK_REQUESTS: DepositRequest[] = [
  {
    id: "req_mock1",
    uid: "user1",
    email: "rahul@example.com",
    displayName: "Rahul Sharma",
    amount: 500,
    screenshotUrl: "https://placehold.co/400x300/1a1200/FFD700?text=Screenshot",
    utrRef: "UPI123456789",
    status: "pending",
    requestedAt: NOW - 5 * 60000,
  },
  {
    id: "req_mock2",
    uid: "user2",
    email: "priya@example.com",
    displayName: "Priya Patel",
    amount: 1000,
    screenshotUrl: "https://placehold.co/400x300/1a1200/FFD700?text=Screenshot",
    utrRef: "PHONEPE9876543",
    status: "pending",
    requestedAt: NOW - 18 * 60000,
  },
  {
    id: "req_mock3",
    uid: "user3",
    email: "amit@example.com",
    displayName: "Amit Kumar",
    amount: 200,
    screenshotUrl: "https://placehold.co/400x300/1a1200/4ade80?text=Approved",
    utrRef: "",
    status: "approved",
    requestedAt: NOW - 3600000,
    processedAt: NOW - 3000000,
  },
  {
    id: "req_mock4",
    uid: "user4",
    email: "vikram@example.com",
    displayName: "Vikram Singh",
    amount: 2000,
    screenshotUrl: "https://placehold.co/400x300/1a1200/f87171?text=Rejected",
    utrRef: "GPAY555444333",
    status: "rejected",
    requestedAt: NOW - 7200000,
    processedAt: NOW - 6000000,
    rejectionReason: "Screenshot not clear",
  },
];

function fmtTime(ts: number | { seconds: number } | unknown): string {
  const ms =
    typeof ts === "number"
      ? ts
      : typeof (ts as { seconds: number }).seconds === "number"
        ? (ts as { seconds: number }).seconds * 1000
        : 0;
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(ms).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatusBadge({ status }: { status: DepositRequest["status"] }) {
  const map = {
    pending:  { bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)",  color: "#f59e0b", label: "⏳ Pending"  },
    approved: { bg: "rgba(34,197,94,0.1)",    border: "rgba(34,197,94,0.3)",   color: "#4ade80", label: "✅ Approved" },
    rejected: { bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.3)",   color: "#f87171", label: "❌ Rejected" },
  };
  const s = map[status];
  return (
    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function PageDeposits() {
  const [requests, setRequests]     = useState<DepositRequest[]>(FIREBASE_ENABLED ? [] : MOCK_REQUESTS);
  const [filter, setFilter]         = useState<"pending" | "all">("pending");
  const [search, setSearch]         = useState("");
  const [preview, setPreview]       = useState<DepositRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<DepositRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [toast, setToast]           = useState("");

  useEffect(() => {
    console.log("[PageDeposits] mounted | FIREBASE_ENABLED=", FIREBASE_ENABLED, "| filter=", filter);
    const unsub = subscribeScreenshotDeposits(filter, (reqs) => {
      console.log("[PageDeposits] callback received | reqs.length=", reqs.length, "| filter=", filter);
      setRequests(reqs.length > 0 ? reqs : (FIREBASE_ENABLED ? [] : MOCK_REQUESTS.filter((r) => filter === "all" || r.status === "pending")));
    });
    return unsub;
  }, [filter]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleApprove(req: DepositRequest) {
    if (!req.id) return;
    setProcessing(req.id);
    try {
      await approveScreenshotDeposit(req.id, "admin");
      showToast(`✅ Approved ₹${req.amount} for ${req.displayName}`);
      if (!FIREBASE_ENABLED) {
        setRequests((prev) => prev.map((r) => r.id === req.id ? { ...r, status: "approved" } : r));
      }
    } catch (e) {
      showToast(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject() {
    if (!rejectTarget?.id) return;
    setProcessing(rejectTarget.id);
    try {
      await rejectScreenshotDeposit(rejectTarget.id, "admin", rejectReason);
      showToast(`Rejected request from ${rejectTarget.displayName}`);
      if (!FIREBASE_ENABLED) {
        setRequests((prev) => prev.map((r) => r.id === rejectTarget.id ? { ...r, status: "rejected", rejectionReason: rejectReason } : r));
      }
      setRejectTarget(null);
      setRejectReason("");
    } catch (e) {
      showToast(`❌ Error: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setProcessing(null);
    }
  }

  const filtered = requests.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.displayName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.utrRef.toLowerCase().includes(q);
  });

  const pending  = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const totalAmt = requests.filter((r) => r.status === "approved").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-4">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", backdropFilter: "blur(8px)" }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pending Review",  value: pending.toString(),                               color: "#f59e0b", icon: "⏳" },
          { label: "Approved Today",  value: approved.toString(),                              color: "#4ade80", icon: "✅" },
          { label: "Total Approved",  value: `₹${totalAmt.toLocaleString("en-IN")}`,           color: "#34d399", icon: "💰" },
          { label: "Total Requests",  value: requests.length.toString(),                       color: "#60a5fa", icon: "📋" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Header + filters */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="font-black text-white text-base">📸 Screenshot Deposits</h2>
          {FIREBASE_ENABLED && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              Live
            </div>
          )}
          <div className="flex gap-1.5">
            {(["pending", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className="px-3 py-1 rounded-lg text-xs font-bold"
                style={{
                  background: filter === f ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${filter === f ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: filter === f ? "#FFD700" : "rgba(255,255,255,0.4)",
                }}>
                {f === "pending" ? `Pending (${pending})` : "All"}
              </button>
            ))}
          </div>
        </div>
        <input
          placeholder="Search name / email / UTR…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs text-white outline-none w-56"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* Requests list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-2xl py-12 flex flex-col items-center gap-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-4xl">📭</span>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
              {filter === "pending" ? "No pending deposit requests" : "No deposit requests yet"}
            </p>
          </div>
        )}

        {filtered.map((req, i) => (
          <motion.div key={req.id ?? i}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)" }}>

            <div className="flex gap-4 p-4">
              {/* Screenshot thumbnail */}
              <div
                className="w-20 h-20 rounded-xl overflow-hidden shrink-0 cursor-pointer relative"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                onClick={() => req.screenshotUrl && setPreview(req)}>
                {req.screenshotUrl ? (
                  <>
                    <img src={req.screenshotUrl} alt="Payment screenshot"
                      className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                      style={{ background: "rgba(0,0,0,0.5)" }}>
                      <span className="text-white text-xs font-bold">View</span>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl"
                    style={{ background: "rgba(255,255,255,0.04)" }}>📸</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <p className="font-black text-white text-sm">{req.displayName}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{req.email}</p>
                  </div>
                  <StatusBadge status={req.status} />
                </div>

                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="font-black text-xl" style={{ color: "#34d399" }}>₹{req.amount.toLocaleString("en-IN")}</span>
                  {req.utrRef && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,215,0,0.7)" }}>
                      UTR: {req.utrRef}
                    </span>
                  )}
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {fmtTime(req.requestedAt)}
                  </span>
                </div>

                {req.rejectionReason && (
                  <p className="text-[10px] mt-1.5 px-2 py-1 rounded-lg"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
                    Reason: {req.rejectionReason}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons (pending only) */}
            {req.status === "pending" && (
              <div className="flex gap-2 px-4 pb-4">
                <button
                  onClick={() => handleApprove(req)}
                  disabled={processing === req.id}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all"
                  style={{
                    background: processing === req.id ? "rgba(255,255,255,0.04)" : "rgba(34,197,94,0.12)",
                    border: "1.5px solid rgba(34,197,94,0.4)",
                    color: processing === req.id ? "rgba(255,255,255,0.3)" : "#4ade80",
                  }}>
                  {processing === req.id ? "Processing…" : `✅ Approve — Add ₹${req.amount}`}
                </button>
                <button
                  onClick={() => { setRejectTarget(req); setRejectReason(""); }}
                  disabled={processing === req.id}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all"
                  style={{
                    background: "rgba(239,68,68,0.08)",
                    border: "1.5px solid rgba(239,68,68,0.3)",
                    color: "#f87171",
                  }}>
                  ❌ Reject
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Screenshot preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setPreview(null)}>
            <motion.div
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              className="rounded-2xl overflow-hidden max-w-lg w-full"
              style={{ border: "1.5px solid rgba(255,215,0,0.3)" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="p-3 flex items-center justify-between"
                style={{ background: "rgba(26,18,0,0.95)", borderBottom: "1px solid rgba(255,215,0,0.15)" }}>
                <div>
                  <p className="font-black text-white text-sm">{preview.displayName}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,215,0,0.6)" }}>₹{preview.amount} · {fmtTime(preview.requestedAt)}</p>
                </div>
                <button onClick={() => setPreview(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
                  ✕
                </button>
              </div>
              <img src={preview.screenshotUrl} alt="Payment screenshot" className="w-full" style={{ maxHeight: 480, objectFit: "contain", background: "#000" }} />
              {preview.status === "pending" && (
                <div className="p-3 flex gap-2" style={{ background: "rgba(10,10,15,0.97)" }}>
                  <button onClick={() => { handleApprove(preview); setPreview(null); }}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1.5px solid rgba(34,197,94,0.4)", color: "#4ade80" }}>
                    ✅ Approve ₹{preview.amount}
                  </button>
                  <button onClick={() => { setRejectTarget(preview); setPreview(null); setRejectReason(""); }}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                    ❌ Reject
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject reason modal */}
      <AnimatePresence>
        {rejectTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
            onClick={() => setRejectTarget(null)}>
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="rounded-2xl p-5 w-full max-w-sm space-y-4"
              style={{ background: "#0f0f17", border: "1.5px solid rgba(239,68,68,0.3)" }}
              onClick={(e) => e.stopPropagation()}>
              <div>
                <h3 className="font-black text-white text-base mb-0.5">Reject Deposit Request</h3>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {rejectTarget.displayName} · ₹{rejectTarget.amount}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>Rejection Reason (optional)</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. Screenshot not clear, Amount mismatch, Invalid UTR…"
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 13 }}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setRejectTarget(null)}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>
                  Cancel
                </button>
                <button onClick={handleReject} disabled={!!processing}
                  className="flex-1 py-2.5 rounded-xl font-black text-sm"
                  style={{ background: "rgba(239,68,68,0.15)", border: "1.5px solid rgba(239,68,68,0.4)", color: "#f87171" }}>
                  {processing ? "Rejecting…" : "Confirm Reject"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
