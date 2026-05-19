/**
 * TabUsers — User Management sub-tab
 * View users, block/unblock, edit wallet balance
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeUsers, banUser, setUserWallet,
  UserProfile, FIREBASE_ENABLED,
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

function avatarColor(name: string): string {
  const colors = ["#00d4ff","#0066ff","#00ff88","#f59e0b","#a855f7","#ff3366"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
  return colors[h];
}

function fmtDate(ts: number | undefined): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

// ─── Balance Edit Modal ───────────────────────────────────────────────────────

interface BalanceModalProps {
  user: UserProfile;
  onClose: () => void;
}

function BalanceModal({ user, onClose }: BalanceModalProps) {
  const [deposit, setDeposit]   = useState("");
  const [winning, setWinning]   = useState("");
  const [bonus, setBonus]       = useState("");
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);

  async function handleSave() {
    if (!user.uid) return;
    setSaving(true);
    try {
      const updates: { deposit?: number; winning?: number; bonus?: number } = {};
      if (deposit !== "") updates.deposit = parseFloat(deposit) || 0;
      if (winning !== "") updates.winning = parseFloat(winning) || 0;
      if (bonus   !== "") updates.bonus   = parseFloat(bonus)   || 0;
      await setUserWallet(user.uid, updates);
      setDone(true);
      setTimeout(onClose, 1200);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(5px)" }}
        onClick={onClose} />
      <motion.div key="modal" initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="fixed inset-x-4 z-50 mx-auto rounded-2xl overflow-hidden"
        style={{ maxWidth: 420, top: "50%", transform: "translateY(-50%)", background: "#0a0f1a", border: "1px solid rgba(0,212,255,0.25)" }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
          <div>
            <p className="text-sm font-black text-white">Edit Balance</p>
            <p className="text-[11px] mt-0.5" style={{ color: T.muted }}>{user.displayName} · {user.email}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)", color: T.muted }}>✕</button>
        </div>

        <div className="p-5 space-y-3">
          <p className="text-[10px] font-black tracking-widest" style={{ color: "rgba(0,212,255,0.4)" }}>
            LEAVE BLANK TO KEEP CURRENT VALUE
          </p>
          {[
            { label: "DEPOSIT BALANCE ₹",  val: deposit, set: setDeposit, placeholder: "e.g. 500" },
            { label: "WINNINGS BALANCE ₹",  val: winning, set: setWinning, placeholder: "e.g. 0" },
            { label: "BONUS BALANCE ₹",     val: bonus,   set: setBonus,   placeholder: "e.g. 50" },
          ].map(({ label, val, set, placeholder }) => (
            <div key={label}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color: "rgba(0,212,255,0.45)" }}>
                {label}
              </label>
              <input type="number" value={val} onChange={(e) => set(e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
            </div>
          ))}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{ background: "rgba(255,255,255,0.04)", color: T.muted, border: "1px solid rgba(255,255,255,0.08)" }}>
              Cancel
            </button>
            <motion.button whileTap={{ scale: 0.96 }} onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{
                background: done ? "rgba(0,255,136,0.12)" : "rgba(0,212,255,0.14)",
                color:      done ? T.green : T.blue,
                border:     `1px solid ${done ? "rgba(0,255,136,0.3)" : "rgba(0,212,255,0.3)"}`,
              }}>
              {done ? "✅ Saved!" : saving ? "Saving…" : "💾 Save Balance"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TabUsers() {
  const [users, setUsers]         = useState<UserProfile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [banning, setBanning]     = useState<string | null>(null);
  const [editUser, setEditUser]   = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsub = subscribeUsers((list) => { setUsers(list); setLoading(false); });
    return unsub;
  }, []);

  async function toggleBan(u: UserProfile) {
    if (!u.uid) return;
    setBanning(u.uid);
    await banUser(u.uid, !u.banned);
    setBanning(null);
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.uid?.includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div>
          <h3 className="text-sm font-black text-white">User Management</h3>
          <p className="text-[11px] mt-0.5" style={{ color: T.muted }}>
            {users.length} registered · {users.filter((u) => u.banned).length} banned
          </p>
        </div>
        <div className="flex-1 sm:max-w-xs">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search name, email, UID…"
            className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,212,255,0.18)", caretColor: T.blue }} />
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map((i) => (
            <motion.div key={i} className="rounded-xl h-16" style={{ background: T.card, border: `1px solid ${T.bdr}` }}
              animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.3, repeat: Infinity, delay: i * 0.1 }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl py-16 text-center" style={{ border: `1px dashed rgba(0,212,255,0.12)` }}>
          <p className="text-4xl mb-3 opacity-20">👥</p>
          <p className="text-sm font-bold" style={{ color: T.muted }}>
            {search ? "No users match your search." : FIREBASE_ENABLED ? "No users yet." : "Demo mode — Firebase not connected."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((u, i) => {
              const color  = avatarColor(u.displayName ?? "?");
              const initials = (u.displayName ?? "?").slice(0, 2).toUpperCase();
              const isBanned = u.banned || u.isBanned;
              return (
                <motion.div key={u.uid ?? i}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{ background: T.card, border: `1px solid ${isBanned ? "rgba(255,51,102,0.18)" : T.bdr}` }}>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={{ background: `${color}20`, color, border: `1.5px solid ${color}40` }}>
                    {initials}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-black text-white truncate">{u.displayName}</p>
                      {isBanned && (
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(255,51,102,0.12)", color: T.red }}>BANNED</span>
                      )}
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded shrink-0"
                        style={{
                          background: u.kycStatus === "approved" ? "rgba(0,255,136,0.1)" : "rgba(245,158,11,0.1)",
                          color:      u.kycStatus === "approved" ? T.green : T.gold,
                        }}>
                        KYC {u.kycStatus ?? "pending"}
                      </span>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: T.muted }}>{u.email} · Joined {fmtDate(u.createdAt)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <motion.button whileTap={{ scale: 0.93 }}
                      onClick={() => setEditUser(u)}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer hidden sm:block"
                      style={{ background: "rgba(0,212,255,0.07)", color: T.blue, border: "1px solid rgba(0,212,255,0.18)" }}>
                      ₹ Balance
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.93 }}
                      onClick={() => toggleBan(u)}
                      disabled={banning === u.uid}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                      style={{
                        background: isBanned ? "rgba(0,255,136,0.07)" : "rgba(255,51,102,0.07)",
                        color:      isBanned ? T.green : T.red,
                        border:     `1px solid ${isBanned ? "rgba(0,255,136,0.2)" : "rgba(255,51,102,0.2)"}`,
                        opacity:    banning === u.uid ? 0.5 : 1,
                      }}>
                      {banning === u.uid ? "…" : isBanned ? "Unblock" : "Block"}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Balance modal */}
      <AnimatePresence>
        {editUser && <BalanceModal user={editUser} onClose={() => setEditUser(null)} />}
      </AnimatePresence>
    </div>
  );
}
