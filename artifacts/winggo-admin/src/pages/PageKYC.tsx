import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_KYC } from "@/data/mockData";

type KYCEntry = typeof MOCK_KYC[number] & { status: string };

const STATUS_CFG = {
  verified: { label: "Verified",  bg: "rgba(52,211,153,0.12)",  color: "#34d399", border: "rgba(52,211,153,0.25)"  },
  pending:  { label: "Pending",   bg: "rgba(245,158,11,0.12)",  color: "#f59e0b", border: "rgba(245,158,11,0.25)"  },
  rejected: { label: "Rejected",  bg: "rgba(248,113,113,0.12)", color: "#f87171", border: "rgba(248,113,113,0.25)" },
};
const RISK_CFG = {
  low:    { color: "#34d399" },
  medium: { color: "#f59e0b" },
  high:   { color: "#f87171" },
};

export default function PageKYC() {
  const [entries, setEntries] = useState<KYCEntry[]>(MOCK_KYC as KYCEntry[]);
  const [selected, setSelected] = useState<KYCEntry | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "verified" | "rejected">("all");

  const filtered = filter === "all" ? entries : entries.filter(e => e.status === filter);

  function setStatus(id: string, status: string) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    setSelected(prev => prev ? { ...prev, status } : null);
  }

  const counts = {
    all: entries.length,
    pending: entries.filter(e => e.status === "pending").length,
    verified: entries.filter(e => e.status === "verified").length,
    rejected: entries.filter(e => e.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(["all", "pending", "verified", "rejected"] as const).map((f) => (
          <motion.button key={f} whileTap={{ scale: 0.97 }}
            onClick={() => setFilter(f)}
            className="rounded-2xl p-4 text-left cursor-pointer"
            style={{
              background: filter === f ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
              border: filter === f ? "1px solid rgba(255,215,0,0.25)" : "1px solid rgba(255,255,255,0.07)",
            }}>
            <div className="text-2xl font-black mb-1"
              style={{ color: f === "all" ? "#fff" : f === "pending" ? "#f59e0b" : f === "verified" ? "#34d399" : "#f87171" }}>
              {counts[f]}
            </div>
            <div className="text-[11px] font-bold capitalize" style={{ color: "rgba(255,255,255,0.4)" }}>
              {f === "all" ? "Total KYC" : `${f} KYC`}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-7 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{ background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>User ID</span>
          <span className="col-span-2">Name</span>
          <span>PAN</span>
          <span>Submitted</span>
          <span>Risk</span>
          <span>Status</span>
        </div>

        {filtered.map((e, i) => {
          const cfg = STATUS_CFG[e.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.pending;
          const risk = RISK_CFG[e.risk as keyof typeof RISK_CFG] ?? RISK_CFG.low;
          return (
            <motion.div key={e.id}
              whileTap={{ scale: 0.995 }}
              onClick={() => setSelected(e)}
              className="grid grid-cols-7 gap-2 items-center px-4 py-3 cursor-pointer"
              style={{
                background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{e.id}</span>

              <div className="col-span-2">
                <p className="text-xs font-bold text-white">{e.name}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{e.aadhaar}</p>
              </div>

              <span className="text-xs font-mono font-bold text-white">{e.pan}</span>

              <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>{e.submitted}</span>

              <span className="text-xs font-black capitalize" style={{ color: risk.color }}>{e.risk}</span>

              <span className="text-[10px] font-black px-2 py-0.5 rounded-full inline-block"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
                {cfg.label}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* KYC review modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)} />
            <motion.div
              className="fixed top-1/2 left-1/2 z-50 w-full max-w-md rounded-3xl p-6"
              style={{ transform: "translate(-50%,-50%)", background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-base">KYC Review</h3>
                <button onClick={() => setSelected(null)} className="cursor-pointer" style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
              </div>

              {/* User info */}
              <div className="p-4 rounded-2xl mb-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="text-white font-black mb-1">{selected.name}</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{selected.id}</div>
              </div>

              {/* Document info */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "PAN Card",      value: selected.pan      },
                  { label: "Aadhaar (masked)", value: selected.aadhaar },
                  { label: "Submitted",     value: selected.submitted },
                  { label: "Risk Level",    value: selected.risk.toUpperCase() },
                ].map(r => (
                  <div key={r.label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
                    <div className="text-sm font-black text-white mt-0.5">{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Mock document uploads */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {["Aadhaar Front", "Aadhaar Back", "Selfie"].map(doc => (
                  <div key={doc} className="rounded-xl overflow-hidden"
                    style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)", aspectRatio: "1" }}>
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                      <span className="text-2xl">{doc === "Selfie" ? "🤳" : "🪪"}</span>
                      <span className="text-[9px] text-center" style={{ color: "rgba(255,255,255,0.35)" }}>{doc}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Approve / Reject */}
              {selected.status === "pending" && (
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStatus(selected.id, "verified")}
                    className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                    style={{ background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }}>
                    ✅ Approve KYC
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setStatus(selected.id, "rejected")}
                    className="flex-1 py-3 rounded-xl font-black text-sm cursor-pointer"
                    style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                    ❌ Reject KYC
                  </motion.button>
                </div>
              )}

              {selected.status !== "pending" && (
                <div className="py-3 rounded-xl text-center font-black text-sm"
                  style={{ background: STATUS_CFG[selected.status as keyof typeof STATUS_CFG]?.bg ?? "rgba(255,255,255,0.05)",
                           color: STATUS_CFG[selected.status as keyof typeof STATUS_CFG]?.color ?? "#fff" }}>
                  {selected.status === "verified" ? "✅ KYC Approved" : "❌ KYC Rejected"}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
