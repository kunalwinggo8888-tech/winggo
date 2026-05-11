import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MOCK_USERS } from "@/data/mockData";

type User = typeof MOCK_USERS[number] & { status: string; kyc: string };

const KYC_BADGE = {
  verified: { label: "Verified",  bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  pending:  { label: "Pending",   bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  rejected: { label: "Rejected",  bg: "rgba(248,113,113,0.12)", color: "#f87171" },
};
const STATUS_BADGE = {
  active: { label: "Active", bg: "rgba(52,211,153,0.12)", color: "#34d399" },
  banned: { label: "Banned", bg: "rgba(248,113,113,0.12)", color: "#f87171" },
};

export default function PageUsers() {
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<User[]>(MOCK_USERS as User[]);
  const [selected, setSelected] = useState<User | null>(null);
  const [editBalance, setEditBalance] = useState("");

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search)
  );

  function toggleBan(id: string) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === "banned" ? "active" : "banned" } : u));
  }

  function applyBalance() {
    if (!selected || !editBalance) return;
    const amt = parseFloat(editBalance);
    if (isNaN(amt)) return;
    setUsers(prev => prev.map(u => u.id === selected.id ? { ...u, wallet: amt } : u));
    setSelected(prev => prev ? { ...prev, wallet: amt } : null);
    setEditBalance("");
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input
            placeholder="Search by name, ID or phone…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }}
          />
        </div>
        <div className="text-xs px-3 py-2.5 rounded-xl font-bold"
          style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)", whiteSpace: "nowrap" }}>
          {filtered.length} users
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Header */}
        <div className="grid grid-cols-7 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{ background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>ID</span>
          <span className="col-span-2">User</span>
          <span>Wallet</span>
          <span>KYC</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {/* Rows */}
        {filtered.map((u, i) => {
          const kyc = KYC_BADGE[u.kyc as keyof typeof KYC_BADGE] ?? KYC_BADGE.pending;
          const st  = STATUS_BADGE[u.status as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.active;
          return (
            <div key={u.id}
              className="grid grid-cols-7 gap-2 items-center px-4 py-3"
              style={{
                background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
            >
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.45)" }}>{u.id}</span>

              <div className="col-span-2">
                <p className="text-xs font-bold text-white">{u.name}</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{u.phone}</p>
              </div>

              <span className="text-xs font-black" style={{ color: "#34d399" }}>
                ₹{u.wallet.toLocaleString()}
              </span>

              <span className="text-[10px] font-black px-2 py-0.5 rounded-full inline-block"
                style={{ background: kyc.bg, color: kyc.color }}>
                {kyc.label}
              </span>

              <span className="text-[10px] font-black px-2 py-0.5 rounded-full inline-block"
                style={{ background: st.bg, color: st.color }}>
                {st.label}
              </span>

              <div className="flex items-center gap-1.5">
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelected(u)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs cursor-pointer"
                  style={{ background: "rgba(96,165,250,0.12)", border: "1px solid rgba(96,165,250,0.25)", color: "#60a5fa" }}>
                  👁
                </motion.button>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleBan(u.id)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs cursor-pointer"
                  style={{
                    background: u.status === "banned" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                    border: `1px solid ${u.status === "banned" ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
                    color: u.status === "banned" ? "#34d399" : "#f87171",
                  }}>
                  {u.status === "banned" ? "✓" : "🚫"}
                </motion.button>
              </div>
            </div>
          );
        })}
      </div>

      {/* User detail modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div className="fixed inset-0 z-50"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)} />
            <motion.div
              className="fixed top-1/2 left-1/2 z-50 w-full max-w-md rounded-3xl p-6"
              style={{ transform: "translate(-50%,-50%)", background: "#0e0b1e", border: "1px solid rgba(255,215,0,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-white font-black text-base">User Detail</h3>
                <button onClick={() => setSelected(null)} className="text-sm cursor-pointer" style={{ color: "rgba(255,255,255,0.4)" }}>✕</button>
              </div>

              <div className="flex items-center gap-4 mb-5 p-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#FFD700)" }}>
                  {selected.name[0]}
                </div>
                <div>
                  <div className="text-white font-black">{selected.name}</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{selected.phone} · {selected.id}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {[
                  { label: "Wallet Balance", value: `₹${selected.wallet.toLocaleString()}` },
                  { label: "Matches Played", value: selected.matches.toString() },
                  { label: "Win Rate",        value: selected.winRate },
                  { label: "Joined",          value: selected.joined },
                ].map(r => (
                  <div key={r.label} className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                    <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{r.label}</div>
                    <div className="text-sm font-black text-white mt-0.5">{r.value}</div>
                  </div>
                ))}
              </div>

              {/* Edit balance */}
              <div className="mb-4">
                <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Edit Wallet Balance</label>
                <div className="flex gap-2">
                  <input
                    type="number" placeholder={`Current: ₹${selected.wallet}`}
                    value={editBalance} onChange={e => setEditBalance(e.target.value)}
                    className="flex-1 rounded-xl px-3 py-2.5 text-white text-sm outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,215,0,0.3)" }}
                  />
                  <motion.button whileTap={{ scale: 0.95 }} onClick={applyBalance}
                    className="px-4 py-2.5 rounded-xl font-black text-xs cursor-pointer"
                    style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                    Update
                  </motion.button>
                </div>
              </div>

              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }}
                  onClick={() => { toggleBan(selected.id); setSelected(null); }}
                  className="flex-1 py-2.5 rounded-xl font-black text-xs cursor-pointer"
                  style={{
                    background: selected.status === "banned" ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                    color: selected.status === "banned" ? "#34d399" : "#f87171",
                    border: `1px solid ${selected.status === "banned" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
                  }}>
                  {selected.status === "banned" ? "✓ Unban User" : "🚫 Ban User"}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
