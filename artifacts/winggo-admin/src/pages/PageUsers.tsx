import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeUsers, banUser, UserProfile } from "@/firebase/admin.service";
import { MOCK_USERS } from "@/data/mockData";
import { FIREBASE_ENABLED } from "@/firebase/config";

const KYC_BADGE = {
  approved: { label: "Verified",  bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  submitted:{ label: "Submitted", bg: "rgba(99,102,241,0.12)",   color: "#818cf8" },
  pending:  { label: "Pending",   bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  rejected: { label: "Rejected",  bg: "rgba(248,113,113,0.12)", color: "#f87171" },
};
const STATUS_BADGE = {
  false: { label: "Active", bg: "rgba(52,211,153,0.12)", color: "#34d399" },
  true:  { label: "Banned", bg: "rgba(248,113,113,0.12)", color: "#f87171" },
};

type LocalUser = { id: string; name: string; phone: string; wallet: number; kyc: string; status: string; banned: boolean };

function toLocal(u: UserProfile, i: number): LocalUser {
  return {
    id: u.uid ?? `USR${String(i).padStart(3, "0")}`,
    name: u.displayName,
    phone: u.phone,
    wallet: 0,
    kyc: u.kycStatus === "approved" ? "approved" : u.kycStatus === "submitted" ? "submitted" : u.kycStatus === "rejected" ? "rejected" : "pending",
    status: u.banned ? "banned" : "active",
    banned: u.banned ?? false,
  };
}

function mockToLocal(u: (typeof MOCK_USERS)[number]): LocalUser {
  return { id: u.id, name: u.name, phone: u.phone, wallet: u.wallet, kyc: u.kyc ?? "pending", status: u.status, banned: u.status === "banned" };
}

export default function PageUsers() {
  const [search, setSearch] = useState("");
  const [users, setUsers]   = useState<LocalUser[]>(FIREBASE_ENABLED ? [] : MOCK_USERS.map(mockToLocal));
  const [selected, setSelected] = useState<LocalUser | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers((profiles) => {
      if (profiles.length > 0) setUsers(profiles.map(toLocal));
    });
    return unsub;
  }, []);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.id.toLowerCase().includes(search.toLowerCase()) ||
    u.phone.includes(search)
  );

  async function toggleBan(u: LocalUser) {
    setActionId(u.id);
    const newBanned = !u.banned;
    if (FIREBASE_ENABLED) {
      await banUser(u.id, newBanned);
    } else {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, banned: newBanned, status: newBanned ? "banned" : "active" } : x));
      if (selected?.id === u.id) setSelected(prev => prev ? { ...prev, banned: newBanned, status: newBanned ? "banned" : "active" } : null);
    }
    setActionId(null);
  }

  return (
    <div className="space-y-4">
      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔍</span>
          <input placeholder="Search by name, ID or phone…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }} />
        </div>
        {FIREBASE_ENABLED && (
          <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
            style={{ background: "rgba(52,211,153,0.08)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            Live
          </div>
        )}
        <div className="text-xs px-3 py-2.5 rounded-xl font-bold"
          style={{ background: "rgba(255,215,0,0.10)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)", whiteSpace: "nowrap" }}>
          {filtered.length} users
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="grid grid-cols-7 gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{ background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span>ID</span><span className="col-span-2">User</span>
          <span>Wallet</span><span>KYC</span><span>Status</span><span>Actions</span>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {FIREBASE_ENABLED ? "No users yet" : "No results"}
          </div>
        )}

        {filtered.map((u, i) => {
          const kyc = KYC_BADGE[u.kyc as keyof typeof KYC_BADGE] ?? KYC_BADGE.pending;
          const st  = STATUS_BADGE[String(u.banned) as keyof typeof STATUS_BADGE] ?? STATUS_BADGE.false;
          const busy = actionId === u.id;
          return (
            <motion.div key={u.id} whileTap={{ scale: 0.997 }}
              className="grid grid-cols-7 gap-2 items-center px-4 py-3 cursor-pointer"
              style={{
                background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
              }}
              onClick={() => setSelected(u)}>
              <span className="text-[10px] font-bold truncate" style={{ color: "rgba(255,255,255,0.3)" }}>
                {u.id.slice(-6)}
              </span>
              <div className="col-span-2">
                <p className="text-xs font-bold text-white truncate">{u.name}</p>
                <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{u.phone}</p>
              </div>
              <span className="text-xs font-black" style={{ color: "#34d399" }}>₹{u.wallet.toLocaleString()}</span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: kyc.bg, color: kyc.color }}>{kyc.label}</span>
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: st.bg, color: st.color }}>{st.label}</span>
              <div className="flex gap-1.5">
                <motion.button whileTap={{ scale: 0.9 }} disabled={busy}
                  onClick={(e) => { e.stopPropagation(); toggleBan(u); }}
                  className="flex-1 py-1 rounded-lg font-black text-[10px] cursor-pointer disabled:opacity-50"
                  style={u.banned
                    ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                    : { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                  {busy ? "…" : u.banned ? "Unban" : "Ban"}
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* User detail drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
            onClick={() => setSelected(null)}>
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-sm rounded-3xl p-6 space-y-4"
              style={{ background: "#0f0a1e", border: "1px solid rgba(255,215,0,0.2)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black"
                  style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700" }}>
                  {selected.name[0]}
                </div>
                <div>
                  <p className="font-black text-white">{selected.name}</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{selected.phone}</p>
                </div>
                <button onClick={() => setSelected(null)} className="ml-auto text-xl cursor-pointer"
                  style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
              </div>

              {[
                { label: "User ID",   value: selected.id },
                { label: "Wallet",    value: `₹${selected.wallet.toLocaleString()}` },
                { label: "KYC",       value: selected.kyc },
                { label: "Status",    value: selected.status },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b"
                  style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                  <span className="text-xs font-bold text-white">{value}</span>
                </div>
              ))}

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => toggleBan(selected)}
                className="w-full py-3 rounded-xl font-black text-sm cursor-pointer"
                style={selected.banned
                  ? { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" }
                  : { background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                {selected.banned ? "✅ Unban User" : "🚫 Ban User"}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
