import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeKYCRequests, approveKYC, rejectKYC, KYCRequest } from "@/firebase/admin.service";
import { MOCK_KYC } from "@/data/mockData";
import { FIREBASE_ENABLED } from "@/firebase/config";

const STATUS_CFG = {
  approved: { label: "Verified",  bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.25)"  },
  pending:  { label: "Pending",   bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", border: "rgba(245,158,11,0.25)"  },
  rejected: { label: "Rejected",  bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.25)" },
};

type LocalKYC = { id: string; name: string; email: string; pan?: string; docType?: string; docNumber?: string; submitted: string; risk: string; status: string; uid: string; frontURL?: string; backURL?: string };

function toLocal(r: KYCRequest): LocalKYC {
  return {
    id: r.uid,
    uid: r.uid,
    name: r.displayName,
    email: r.email,
    docType: r.docType,
    docNumber: r.docNumber,
    submitted: r.submittedAt ? new Date((r.submittedAt as { seconds: number }).seconds * 1000).toLocaleDateString("en-IN") : "—",
    risk: "low",
    status: r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "pending",
    frontURL: r.frontURL,
    backURL: r.backURL,
  };
}

function mockToLocal(m: (typeof MOCK_KYC)[number]): LocalKYC {
  return { id: m.id, uid: m.id, name: m.name, email: "", pan: m.pan, docType: "pan", docNumber: m.pan, submitted: m.submitted, risk: m.risk, status: m.status };
}

export default function PageKYC() {
  const [entries, setEntries]   = useState<LocalKYC[]>(FIREBASE_ENABLED ? [] : MOCK_KYC.map(mockToLocal));
  const [selected, setSelected] = useState<LocalKYC | null>(null);
  const [filter, setFilter]     = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    const unsub = subscribeKYCRequests((reqs) => {
      if (reqs.length > 0) setEntries(reqs.map(toLocal));
    });
    return unsub;
  }, []);

  const filtered = filter === "all" ? entries : entries.filter(e => e.status === filter);
  const counts = { all: entries.length, pending: entries.filter(e => e.status === "pending").length, approved: entries.filter(e => e.status === "approved").length, rejected: entries.filter(e => e.status === "rejected").length };

  async function handleApprove(e: LocalKYC) {
    setActionId(e.id);
    if (FIREBASE_ENABLED) {
      await approveKYC(e.uid, "admin");
    } else {
      setEntries(prev => prev.map(x => x.id === e.id ? { ...x, status: "approved" } : x));
      setSelected(prev => prev?.id === e.id ? { ...prev, status: "approved" } : prev);
    }
    setActionId(null);
    setSelected(null);
  }

  async function handleReject(e: LocalKYC) {
    if (!rejectReason.trim()) return;
    setActionId(e.id);
    if (FIREBASE_ENABLED) {
      await rejectKYC(e.uid, "admin", rejectReason);
    } else {
      setEntries(prev => prev.map(x => x.id === e.id ? { ...x, status: "rejected" } : x));
      setSelected(prev => prev?.id === e.id ? { ...prev, status: "rejected" } : prev);
    }
    setActionId(null);
    setRejectReason("");
    setSelected(null);
  }

  return (
    <div className="space-y-4">
      {/* Summary filter pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <motion.button key={f} whileTap={{ scale: 0.97 }} onClick={() => setFilter(f)}
            className="rounded-2xl p-4 text-left cursor-pointer"
            style={{
              background: filter === f ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
              border: filter === f ? "1px solid rgba(255,215,0,0.25)" : "1px solid rgba(255,255,255,0.07)",
            }}>
            <div className="text-2xl font-black mb-1"
              style={{ color: f === "all" ? "#fff" : f === "pending" ? "#f59e0b" : f === "approved" ? "#34d399" : "#f87171" }}>
              {counts[f]}
            </div>
            <div className="text-[11px] font-bold capitalize" style={{ color: "rgba(255,255,255,0.4)" }}>
              {f === "all" ? "Total KYC" : `${f} KYC`}
            </div>
          </motion.button>
        ))}
      </div>

      {FIREBASE_ENABLED && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          🔥 Live Firebase sync · Pending KYC from real users
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-7 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{ background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>User ID</span><span className="col-span-2">Name</span>
          <span>Doc</span><span>Submitted</span><span>Risk</span><span>Status</span>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No KYC submissions yet
          </div>
        )}

        {filtered.map((e, i) => {
          const cfg  = STATUS_CFG[e.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
          return (
            <motion.div key={e.id} whileTap={{ scale: 0.997 }}
              onClick={() => setSelected(e)} className="grid grid-cols-7 gap-2 items-center px-4 py-3 cursor-pointer"
              style={{
                background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}>
              <span className="text-[10px] font-bold truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{e.id.slice(-6)}</span>
              <div className="col-span-2">
                <p className="text-xs font-bold text-white truncate">{e.name}</p>
                <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{e.email}</p>
              </div>
              <span className="text-[10px] font-bold uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>{e.docType ?? "PAN"}</span>
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>{e.submitted}</span>
              <span className="text-[10px] font-bold" style={{ color: e.risk === "high" ? "#f87171" : e.risk === "medium" ? "#f59e0b" : "#34d399" }}>
                {e.risk.toUpperCase()}
              </span>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
            onClick={() => setSelected(null)}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 space-y-4"
              style={{ background: "#0f0a1e", border: "1px solid rgba(255,215,0,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <p className="font-black text-white text-base">{selected.name}</p>
                <button onClick={() => setSelected(null)} className="text-xl cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
              </div>

              {[
                { label: "Email",   value: selected.email },
                { label: "Doc Type",value: (selected.docType ?? "PAN").toUpperCase() },
                { label: "Doc No.", value: selected.docNumber ?? selected.pan ?? "—" },
                { label: "Status",  value: selected.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                  <span className="text-xs font-bold text-white">{value}</span>
                </div>
              ))}

              {selected.frontURL && (
                <img src={selected.frontURL} alt="Front doc" className="w-full rounded-xl object-cover max-h-40" />
              )}

              {selected.status === "pending" && (
                <>
                  <input value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (required to reject)"
                    className="w-full rounded-xl px-3 py-2 text-white text-xs outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", caretColor: "#FFD700" }} />
                  <div className="flex gap-3">
                    <motion.button whileTap={{ scale: 0.97 }} disabled={actionId === selected.id}
                      onClick={() => handleApprove(selected)}
                      className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer disabled:opacity-50"
                      style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                      {actionId === selected.id ? "…" : "✅ Approve"}
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.97 }} disabled={actionId === selected.id || !rejectReason.trim()}
                      onClick={() => handleReject(selected)}
                      className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer disabled:opacity-50"
                      style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                      {actionId === selected.id ? "…" : "✕ Reject"}
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
