/**
 * PageUsers — WINGGO Admin
 * Live user list with enriched wallet data (winning / deposit / bonus),
 * online/offline status, last login, KYC, and ban controls.
 * All data is real Firebase — no mock data shown when Firebase is connected.
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeUsersEnriched, banUser, EnrichedUser,
} from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDate(ts: number | undefined): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

function isOnline(lastLoginAt: number | undefined): boolean {
  if (!lastLoginAt) return false;
  return Date.now() - lastLoginAt < 10 * 60 * 1000; // active in last 10 min
}

const KYC_BADGE = {
  approved:  { label: "Verified",   bg: "rgba(52,211,153,0.12)",   color: "#34d399" },
  submitted: { label: "Submitted",  bg: "rgba(99,102,241,0.12)",    color: "#818cf8" },
  pending:   { label: "Pending",    bg: "rgba(245,158,11,0.12)",   color: "#f59e0b" },
  rejected:  { label: "Rejected",   bg: "rgba(248,113,113,0.12)",  color: "#f87171" },
};

// ─── DEMO DATA ────────────────────────────────────────────────────────────────

const DEMO_USERS: EnrichedUser[] = [
  { uid: "demo1", email: "rahul@example.com", displayName: "Rahul Sharma", photoURL: "", createdAt: Date.now() - 864e5, kycStatus: "approved",  referralCode: "RAHUL001", referredBy: null, wallet: { uid: "demo1", winning: 250, deposit: 500, bonus: 50  } },
  { uid: "demo2", email: "priya@example.com", displayName: "Priya Patel",  photoURL: "", createdAt: Date.now() - 432e5, kycStatus: "pending",   referralCode: "PRIYA002", referredBy: null, wallet: { uid: "demo2", winning: 0,   deposit: 200, bonus: 50  } },
  { uid: "demo3", email: "amit@example.com",  displayName: "Amit Kumar",   photoURL: "", createdAt: Date.now() - 172e5, kycStatus: "submitted", referralCode: "AMIT003",  referredBy: null, wallet: { uid: "demo3", winning: 90,  deposit: 1000,bonus: 100 } },
  { uid: "demo4", email: "vikram@example.com",displayName: "Vikram Singh", photoURL: "", createdAt: Date.now() - 86400, kycStatus: "approved",  referralCode: "VIK004",   referredBy: null, wallet: { uid: "demo4", winning: 400, deposit: 750, bonus: 75  }, banned: true },
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────

type FilterType = "all" | "active" | "banned" | "online";

export default function PageUsers() {
  const [users, setUsers]       = useState<EnrichedUser[]>(FIREBASE_ENABLED ? [] : DEMO_USERS);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState<FilterType>("all");
  const [selected, setSelected] = useState<EnrichedUser | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(FIREBASE_ENABLED);

  useEffect(() => {
    const unsub = subscribeUsersEnriched((enriched) => {
      setLoading(false);
      if (enriched.length > 0) setUsers(enriched);
    });
    return unsub;
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (filter === "active")  list = list.filter((u) => !u.banned);
    if (filter === "banned")  list = list.filter((u) => u.banned);
    if (filter === "online")  list = list.filter((u) => isOnline((u as EnrichedUser & { lastLoginAt?: number }).lastLoginAt));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.uid?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, search, filter]);

  const onlineCount = users.filter((u) => isOnline((u as EnrichedUser & { lastLoginAt?: number }).lastLoginAt)).length;
  const bannedCount = users.filter((u) => u.banned).length;

  async function toggleBan(u: EnrichedUser) {
    if (!u.uid) return;
    setActionId(u.uid);
    const newBanned = !u.banned;
    if (FIREBASE_ENABLED) {
      await banUser(u.uid, newBanned);
    } else {
      setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, banned: newBanned } : x));
      if (selected?.uid === u.uid) setSelected({ ...u, banned: newBanned });
    }
    setActionId(null);
  }

  const walletTotal = (u: EnrichedUser) =>
    (u.wallet?.winning ?? 0) + (u.wallet?.deposit ?? 0) + (u.wallet?.bonus ?? 0);

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-0 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
          <input
            placeholder="Search name, email, User ID…"
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }} />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {([
            { id: "all",    label: `All (${users.length})` },
            { id: "online", label: `🟢 Online (${onlineCount})` },
            { id: "active", label: "Active" },
            { id: "banned", label: `🚫 Banned (${bannedCount})` },
          ] as { id: FilterType; label: string }[]).map((f) => (
            <motion.button key={f.id} whileTap={{ scale: 0.95 }} onClick={() => setFilter(f.id)}
              className="px-3 py-2 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap"
              style={{
                background: filter === f.id ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
                color: filter === f.id ? "#FFD700" : "rgba(255,255,255,0.4)",
                border: `1px solid ${filter === f.id ? "rgba(255,215,0,0.3)" : "rgba(255,255,255,0.07)"}`,
              }}>
              {f.label}
            </motion.button>
          ))}
        </div>

        {/* Live badge */}
        {FIREBASE_ENABLED && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs"
            style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            LIVE
          </div>
        )}
      </div>

      {/* Users table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Table header */}
        <div className="hidden md:grid px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{
            gridTemplateColumns: "1.2fr 1.8fr 1fr 1fr 1fr 1fr 0.8fr 0.9fr",
            background: "rgba(255,215,0,0.05)", color: "rgba(255,215,0,0.6)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
          <span>User ID</span>
          <span>Name / Email</span>
          <span>🏆 Win</span>
          <span>💳 Deposit</span>
          <span>🎁 Bonus</span>
          <span>Total</span>
          <span>KYC</span>
          <span>Action</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10">
            <motion.div className="w-2 h-2 rounded-full" style={{ background: "#FFD700" }}
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading live users…</span>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-10 text-center">
            <span className="text-3xl opacity-30">👥</span>
            <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              {FIREBASE_ENABLED ? "No users registered yet" : "No results"}
            </p>
          </div>
        )}

        {/* Rows */}
        <AnimatePresence>
          {filtered.map((u, i) => {
            const kyc   = KYC_BADGE[(u.kycStatus ?? "pending") as keyof typeof KYC_BADGE] ?? KYC_BADGE.pending;
            const busy  = actionId === u.uid;
            const online = isOnline((u as EnrichedUser & { lastLoginAt?: number }).lastLoginAt);
            const w     = u.wallet;
            const total = walletTotal(u);

            return (
              <motion.div key={u.uid}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: Math.min(i, 10) * 0.03 }}
                onClick={() => setSelected(u)}
                className="cursor-pointer"
                style={{
                  borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}
              >
                {/* Desktop row */}
                <div className="hidden md:grid items-center px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: "1.2fr 1.8fr 1fr 1fr 1fr 1fr 0.8fr 0.9fr" }}>

                  {/* UID + online dot */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: online ? "#34d399" : "rgba(255,255,255,0.15)" }} />
                    <span className="text-[10px] font-mono truncate" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {u.uid?.slice(-8)}
                    </span>
                  </div>

                  {/* Name / email */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: u.banned ? "rgba(248,113,113,0.15)" : "rgba(255,215,0,0.12)", color: u.banned ? "#f87171" : "#FFD700" }}>
                      {u.displayName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {u.displayName}
                        {u.banned && <span className="ml-1.5 text-[9px] font-black px-1 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>BANNED</span>}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{u.email}</p>
                    </div>
                  </div>

                  {/* Wallet columns */}
                  <span className="text-xs font-black" style={{ color: "#34d399" }}>₹{fmt(w?.winning ?? 0)}</span>
                  <span className="text-xs font-black" style={{ color: "#60a5fa" }}>₹{fmt(w?.deposit ?? 0)}</span>
                  <span className="text-xs font-black" style={{ color: "#FFD700" }}>₹{fmt(w?.bonus ?? 0)}</span>
                  <span className="text-xs font-black" style={{ color: total > 0 ? "#fff" : "rgba(255,255,255,0.3)" }}>
                    ₹{fmt(total)}
                  </span>

                  {/* KYC */}
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full inline-block"
                    style={{ background: kyc.bg, color: kyc.color }}>{kyc.label}</span>

                  {/* Ban button */}
                  <motion.button whileTap={{ scale: 0.9 }} disabled={busy}
                    onClick={(e) => { e.stopPropagation(); toggleBan(u); }}
                    className="py-1 px-2 rounded-lg font-black text-[10px] cursor-pointer disabled:opacity-50"
                    style={u.banned
                      ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }
                      : { background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                    {busy ? "…" : u.banned ? "Unban" : "Ban"}
                  </motion.button>
                </div>

                {/* Mobile row */}
                <div className="md:hidden flex items-center gap-3 px-4 py-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-black"
                      style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700" }}>
                      {u.displayName?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                      style={{ background: online ? "#34d399" : "rgba(255,255,255,0.15)", borderColor: "#07050f" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{u.displayName}</p>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.35)" }}>{u.email}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-black" style={{ color: "#FFD700" }}>₹{fmt(total)}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: kyc.bg, color: kyc.color }}>{kyc.label}</span>
                    </div>
                  </div>
                  <span className="text-xl">›</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* User Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
            onClick={() => setSelected(null)}>
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 20 }}
              className="w-full max-w-md rounded-3xl overflow-hidden"
              style={{ background: "#0f0a1e", border: "1px solid rgba(255,215,0,0.2)", boxShadow: "0 40px 100px rgba(0,0,0,0.7)" }}
              onClick={(e) => e.stopPropagation()}>

              {/* Header */}
              <div className="flex items-center gap-3 px-6 pt-6 pb-4"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="relative">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black"
                    style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(124,58,237,0.2))", border: "2px solid rgba(255,215,0,0.3)" }}>
                    {selected.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-[#0f0a1e]"
                    style={{ background: isOnline((selected as EnrichedUser & { lastLoginAt?: number }).lastLoginAt) ? "#34d399" : "rgba(255,255,255,0.2)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white text-lg">{selected.displayName}</h3>
                  <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{selected.email}</p>
                  <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>UID: {selected.uid}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-xl cursor-pointer shrink-0"
                  style={{ color: "rgba(255,255,255,0.35)" }}>✕</button>
              </div>

              <div className="px-6 py-4 space-y-4">
                {/* Wallet breakdown */}
                <div>
                  <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: "rgba(255,215,0,0.5)" }}>
                    💰 Wallet Breakdown
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Winning",  value: selected.wallet?.winning ?? 0,  color: "#34d399", icon: "🏆" },
                      { label: "Deposit",  value: selected.wallet?.deposit ?? 0,  color: "#60a5fa", icon: "💳" },
                      { label: "Bonus",    value: selected.wallet?.bonus   ?? 0,  color: "#FFD700", icon: "🎁" },
                    ].map((b) => (
                      <div key={b.label} className="rounded-xl px-3 py-2.5 text-center"
                        style={{ background: `${b.color}10`, border: `1px solid ${b.color}25` }}>
                        <div className="text-base">{b.icon}</div>
                        <div className="text-sm font-black mt-1" style={{ color: b.color }}>₹{fmt(b.value)}</div>
                        <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{b.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between items-center px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.12)" }}>
                    <span className="text-xs font-black" style={{ color: "rgba(255,215,0,0.7)" }}>Total Balance</span>
                    <span className="text-base font-black" style={{ color: "#FFD700" }}>₹{fmt(walletTotal(selected))}</span>
                  </div>
                </div>

                {/* User info */}
                <div className="space-y-2">
                  {[
                    { label: "KYC Status",   value: selected.kycStatus ?? "pending" },
                    { label: "Referral Code", value: selected.referralCode || "—" },
                    { label: "Joined",        value: fmtDate(selected.createdAt) },
                    { label: "Account",       value: selected.banned ? "🚫 Banned" : "✅ Active" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-1.5"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                      <span className="text-xs font-bold" style={{ color: label === "Account" && selected.banned ? "#f87171" : "rgba(255,255,255,0.8)" }}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Ban button */}
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => toggleBan(selected)}
                  disabled={actionId === selected.uid}
                  className="w-full py-3 rounded-2xl font-black text-sm cursor-pointer"
                  style={selected.banned
                    ? { background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                    : { background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                  {actionId === selected.uid ? "Processing…" : selected.banned ? "✅ Unban User" : "🚫 Ban User"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
