/**
 * PageUsers — WINGGO Admin
 * WinZO-style live user monitoring with stat cards + enriched table.
 * Real Firebase data: users + wallets joined live, no mock data when connected.
 */
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeUsersEnriched, banUser, EnrichedUser } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const ONLINE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
const TODAY_START      = new Date().setHours(0, 0, 0, 0);

function fmtWallet(n: number) {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(ts: number | undefined): string {
  if (!ts) return "—";
  const now  = Date.now();
  const diff = now - ts;
  if (diff < 60_000)        return "Just now";
  if (diff < 3_600_000)     return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)    return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isOnline(u: EnrichedUser): boolean {
  return !!u.lastLoginAt && Date.now() - u.lastLoginAt < ONLINE_THRESHOLD;
}

function isNewToday(u: EnrichedUser): boolean {
  return u.createdAt > TODAY_START;
}

const KYC_BADGE = {
  approved:  { label: "KYC ✓",   bg: "rgba(52,211,153,0.12)",  color: "#34d399" },
  submitted: { label: "Review",  bg: "rgba(99,102,241,0.12)",   color: "#818cf8" },
  pending:   { label: "Pending", bg: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  rejected:  { label: "Rejected",bg: "rgba(248,113,113,0.12)", color: "#f87171" },
};

// ─── DEMO USERS (shown only when Firebase not configured) ─────────────────────

const DEMO: EnrichedUser[] = [
  {
    uid: "demo1", email: "rahul@example.com", displayName: "Rahul Sharma",
    photoURL: "", createdAt: TODAY_START + 3_600_000, lastLoginAt: Date.now() - 180_000,
    kycStatus: "approved", referralCode: "RAHUL", referredBy: null,
    wallet: { uid: "demo1", winning: 250, deposit: 500, bonus: 50 },
  },
  {
    uid: "demo2", email: "priya@example.com", displayName: "Priya Patel",
    photoURL: "", createdAt: Date.now() - 3_600_000 * 8, lastLoginAt: Date.now() - 900_000,
    kycStatus: "pending", referralCode: "PRIYA", referredBy: null,
    wallet: { uid: "demo2", winning: 0, deposit: 200, bonus: 50 },
  },
  {
    uid: "demo3", email: "amit@example.com", displayName: "Amit Kumar",
    photoURL: "", createdAt: Date.now() - 3_600_000 * 24, lastLoginAt: Date.now() - 2_400_000,
    kycStatus: "submitted", referralCode: "AMIT", referredBy: null,
    wallet: { uid: "demo3", winning: 90, deposit: 1000, bonus: 100 },
  },
  {
    uid: "demo4", email: "vikram@example.com", displayName: "Vikram Singh",
    photoURL: "", createdAt: Date.now() - 3_600_000 * 48, lastLoginAt: undefined,
    kycStatus: "approved", referralCode: "VIK", referredBy: null, banned: true,
    wallet: { uid: "demo4", winning: 400, deposit: 750, bonus: 75 },
  },
];

// ─── STAT CARD ────────────────────────────────────────────────────────────────

interface StatPillProps {
  icon: string;
  label: string;
  value: number | string;
  color: string;
  glow: string;
  sub?: string;
  delay?: number;
  pulse?: boolean;
}

function StatPill({ icon, label, value, color, glow, sub, delay = 0, pulse }: StatPillProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl p-4 overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1.5px solid ${color}30`,
        boxShadow: `0 0 28px ${glow}`,
      }}
    >
      {/* Corner glow */}
      <div className="absolute top-0 right-0 w-24 h-24 pointer-events-none rounded-full"
        style={{ background: `radial-gradient(circle, ${color}1a 0%, transparent 70%)`, transform: "translate(35%,-35%)" }} />

      {/* Top shimmer line */}
      <div className="absolute top-0 left-4 right-4 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

      <div className="flex items-start justify-between mb-2.5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          {icon}
        </div>
        {pulse && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
            <motion.div className="w-1.5 h-1.5 rounded-full"
              style={{ background: color }}
              animate={{ opacity: [1, 0.25, 1], scale: [1, 0.8, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }} />
            <span className="text-[9px] font-black" style={{ color }}>LIVE</span>
          </div>
        )}
      </div>

      <motion.div
        key={String(value)}
        initial={{ opacity: 0.5, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-3xl font-black leading-none"
        style={{ color }}
      >
        {value}
      </motion.div>
      <div className="text-xs font-bold mt-1.5 text-white">{label}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>{sub}</div>}
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

type FilterTab = "all" | "online" | "offline" | "new" | "banned";

export default function PageUsers() {
  const [users, setUsers]       = useState<EnrichedUser[]>(FIREBASE_ENABLED ? [] : DEMO);
  const [loading, setLoading]   = useState(FIREBASE_ENABLED);
  const [search, setSearch]     = useState("");
  const [activeTab, setTab]     = useState<FilterTab>("all");
  const [selected, setSelected] = useState<EnrichedUser | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [, forceRefresh]        = useState(0);

  // Live Firebase subscription
  useEffect(() => {
    const unsub = subscribeUsersEnriched((list) => {
      setLoading(false);
      if (list.length > 0 || FIREBASE_ENABLED) setUsers(list.length > 0 ? list : []);
    });
    return unsub;
  }, []);

  // Refresh online counts every 30 seconds (lastLoginAt doesn't change but time does)
  useEffect(() => {
    const t = setInterval(() => forceRefresh((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // ── Derived counts ──
  const totalUsers  = users.length;
  const onlineUsers = users.filter(isOnline).length;
  const offlineUsers = totalUsers - onlineUsers;
  const newToday    = users.filter(isNewToday).length;
  const bannedUsers = users.filter((u) => u.banned).length;

  // ── Filtered list ──
  const filtered = useMemo(() => {
    let list = users;
    if (activeTab === "online")  list = list.filter(isOnline);
    if (activeTab === "offline") list = list.filter((u) => !isOnline(u));
    if (activeTab === "new")     list = list.filter(isNewToday);
    if (activeTab === "banned")  list = list.filter((u) => u.banned);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((u) =>
        u.displayName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        (u.uid ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [users, activeTab, search]);

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

  // ── Filter tab config ──
  const TABS: { id: FilterTab; label: string; count: number; color: string }[] = [
    { id: "all",     label: "All",        count: totalUsers,   color: "#FFD700"  },
    { id: "online",  label: "🟢 Online",  count: onlineUsers,  color: "#34d399"  },
    { id: "offline", label: "⚫ Offline", count: offlineUsers, color: "#94a3b8"  },
    { id: "new",     label: "✨ New Today",count: newToday,     color: "#a78bfa"  },
    { id: "banned",  label: "🚫 Banned",  count: bannedUsers,  color: "#f87171"  },
  ];

  return (
    <div className="space-y-4">

      {/* ══════════════════════ STAT CARDS ══════════════════════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatPill
          icon="👥" label="Total Registered" value={totalUsers}
          color="#FFD700" glow="rgba(255,215,0,0.12)"
          sub={FIREBASE_ENABLED ? "From Firebase" : "Demo mode"}
          delay={0} pulse={FIREBASE_ENABLED}
        />
        <StatPill
          icon="🟢" label="Online Right Now" value={onlineUsers}
          color="#34d399" glow="rgba(52,211,153,0.12)"
          sub="Active ≤ 10 min ago"
          delay={0.06} pulse
        />
        <StatPill
          icon="⚫" label="Offline Users" value={offlineUsers}
          color="#94a3b8" glow="rgba(148,163,184,0.08)"
          sub="Not recently active"
          delay={0.12}
        />
        <StatPill
          icon="✨" label="New Today" value={newToday}
          color="#a78bfa" glow="rgba(167,139,250,0.12)"
          sub="Joined since midnight"
          delay={0.18}
        />
      </div>

      {/* ══════════════════════ CONTROLS ══════════════════════ */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="flex-1 min-w-[180px] relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔍</span>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, UID…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-white text-sm outline-none"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", caretColor: "#FFD700" }}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map((t) => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id)}
              className="px-3 py-2 rounded-xl text-xs font-black cursor-pointer whitespace-nowrap"
              style={{
                background: activeTab === t.id ? `${t.color}18` : "rgba(255,255,255,0.04)",
                color:      activeTab === t.id ? t.color         : "rgba(255,255,255,0.4)",
                border:     `1px solid ${activeTab === t.id ? `${t.color}35` : "rgba(255,255,255,0.07)"}`,
              }}>
              {t.label} ({t.count})
            </motion.button>
          ))}
        </div>

        {/* Live badge */}
        {FIREBASE_ENABLED && (
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs"
            style={{ background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#34d399" }}
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            🔥 Live
          </div>
        )}
      </div>

      {/* ══════════════════════ USER TABLE ══════════════════════ */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Column headers */}
        <div className="hidden lg:grid px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{
            gridTemplateColumns: "42px 2fr 1fr 1fr 1fr 1fr 0.7fr 0.9fr",
            background: "rgba(255,215,0,0.05)",
            color: "rgba(255,215,0,0.6)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
          <span></span>
          <span>User</span>
          <span>🏆 Winning</span>
          <span>💳 Deposit</span>
          <span>🎁 Bonus</span>
          <span>💰 Total</span>
          <span>KYC</span>
          <span>Action</span>
        </div>

        {/* Loading shimmer */}
        {loading && (
          <div className="space-y-0">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: 1 - i * 0.15 }}>
                <motion.div className="w-8 h-8 rounded-full shrink-0"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                  animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }} />
                <div className="flex-1 space-y-1.5">
                  <motion.div className="h-3 rounded-full w-32"
                    style={{ background: "rgba(255,255,255,0.05)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 + 0.1 }} />
                  <motion.div className="h-2 rounded-full w-48"
                    style={{ background: "rgba(255,255,255,0.04)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 + 0.2 }} />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-center gap-2 py-4">
              <motion.div className="w-2 h-2 rounded-full" style={{ background: "#FFD700" }}
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Loading live users from Firebase…</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div className="py-14 text-center">
            <div className="text-5xl mb-3 opacity-20">👥</div>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
              {search ? "No users match your search" : FIREBASE_ENABLED ? "No users registered yet" : "No results"}
            </p>
          </div>
        )}

        {/* Rows */}
        <AnimatePresence initial={false}>
          {filtered.map((u, i) => {
            const kyc    = KYC_BADGE[(u.kycStatus ?? "pending") as keyof typeof KYC_BADGE] ?? KYC_BADGE.pending;
            const online = isOnline(u);
            const busy   = actionId === u.uid;
            const w      = u.wallet;
            const total  = walletTotal(u);
            const initial = (u.displayName?.[0] ?? "?").toUpperCase();

            return (
              <motion.div
                key={u.uid}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                transition={{ delay: Math.min(i, 12) * 0.025 }}
                onClick={() => setSelected(u)}
                className="cursor-pointer hover:bg-white/[0.015] transition-colors"
                style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}
              >
                {/* ── Desktop row ── */}
                <div className="hidden lg:grid items-center px-4 py-3"
                  style={{ gridTemplateColumns: "42px 2fr 1fr 1fr 1fr 1fr 0.7fr 0.9fr" }}>

                  {/* Avatar + online indicator */}
                  <div className="relative w-8 h-8 shrink-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                      style={{
                        background: u.banned
                          ? "rgba(248,113,113,0.15)"
                          : online
                          ? "rgba(52,211,153,0.15)"
                          : "rgba(255,215,0,0.12)",
                        color: u.banned ? "#f87171" : online ? "#34d399" : "#FFD700",
                      }}>
                      {initial}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                      style={{
                        background: online ? "#34d399" : "rgba(255,255,255,0.12)",
                        borderColor: "#07050f",
                        boxShadow: online ? "0 0 6px rgba(52,211,153,0.7)" : "none",
                      }} />
                  </div>

                  {/* Name / email / UID */}
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white truncate">{u.displayName}</p>
                      {u.banned && (
                        <span className="text-[8px] font-black px-1 py-px rounded shrink-0"
                          style={{ background: "rgba(248,113,113,0.15)", color: "#f87171" }}>BAN</span>
                      )}
                      {isNewToday(u) && (
                        <span className="text-[8px] font-black px-1 py-px rounded shrink-0"
                          style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>NEW</span>
                      )}
                    </div>
                    <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{u.email}</p>
                    <p className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.18)" }}>
                      {u.uid?.slice(-10)}
                    </p>
                  </div>

                  {/* Wallet columns */}
                  <span className="text-xs font-black" style={{ color: "#34d399" }}>{fmtWallet(w?.winning ?? 0)}</span>
                  <span className="text-xs font-black" style={{ color: "#60a5fa" }}>{fmtWallet(w?.deposit ?? 0)}</span>
                  <span className="text-xs font-black" style={{ color: "#FFD700" }}>{fmtWallet(w?.bonus ?? 0)}</span>
                  <span className="text-xs font-black" style={{ color: total > 0 ? "#fff" : "rgba(255,255,255,0.25)" }}>
                    {fmtWallet(total)}
                  </span>

                  {/* KYC */}
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full inline-block"
                    style={{ background: kyc.bg, color: kyc.color }}>{kyc.label}</span>

                  {/* Ban button */}
                  <motion.button whileTap={{ scale: 0.88 }} disabled={busy}
                    onClick={(e) => { e.stopPropagation(); toggleBan(u); }}
                    className="py-1.5 px-2 rounded-xl font-black text-[10px] cursor-pointer disabled:opacity-40 w-full"
                    style={u.banned
                      ? { background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.2)" }
                      : { background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.18)" }}>
                    {busy ? "…" : u.banned ? "Unban" : "Ban"}
                  </motion.button>
                </div>

                {/* ── Mobile row ── */}
                <div className="lg:hidden flex items-center gap-3 px-4 py-3">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-base"
                      style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700" }}>
                      {initial}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                      style={{ background: online ? "#34d399" : "rgba(255,255,255,0.12)", borderColor: "#07050f", boxShadow: online ? "0 0 6px rgba(52,211,153,0.6)" : "none" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-white truncate">{u.displayName}</p>
                      {isNewToday(u) && <span className="text-[8px] font-black px-1 py-px rounded" style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>NEW</span>}
                    </div>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{u.email}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs font-black" style={{ color: "#FFD700" }}>{fmtWallet(total)}</span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: kyc.bg, color: kyc.color }}>{kyc.label}</span>
                      <span className="text-[10px]" style={{ color: online ? "#34d399" : "rgba(255,255,255,0.25)" }}>
                        {online ? "🟢 Online" : `⚫ ${fmtDate(u.lastLoginAt)}`}
                      </span>
                    </div>
                  </div>
                  <span className="text-lg" style={{ color: "rgba(255,255,255,0.2)" }}>›</span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Result count footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-2.5 flex items-center justify-between"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              Showing {filtered.length} of {totalUsers} users
            </span>
            <span className="text-[11px] font-black" style={{ color: "rgba(255,215,0,0.5)" }}>
              {onlineUsers > 0 ? `${onlineUsers} online now` : "All offline"}
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════ USER DETAIL DRAWER ══════════════════════ */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(12px)" }}
            onClick={() => setSelected(null)}>
            <motion.div
              initial={{ scale: 0.93, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.93, opacity: 0, y: 16 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-md rounded-3xl overflow-hidden"
              style={{ background: "#0f0a1e", border: "1px solid rgba(255,215,0,0.2)", boxShadow: "0 40px 120px rgba(0,0,0,0.8)" }}
              onClick={(e) => e.stopPropagation()}>

              {/* ── Header ── */}
              <div className="relative overflow-hidden px-6 pt-6 pb-5"
                style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.05) 0%, rgba(124,58,237,0.08) 100%)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black"
                      style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(124,58,237,0.2))", border: "2px solid rgba(255,215,0,0.3)" }}>
                      {(selected.displayName?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
                      style={{ background: isOnline(selected) ? "#34d399" : "rgba(255,255,255,0.18)", borderColor: "#0f0a1e", boxShadow: isOnline(selected) ? "0 0 8px rgba(52,211,153,0.7)" : "none" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-white text-lg">{selected.displayName}</h3>
                      {selected.banned && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(248,113,113,0.15)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>BANNED</span>
                      )}
                      {isNewToday(selected) && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.25)" }}>NEW TODAY</span>
                      )}
                    </div>
                    <p className="text-xs truncate mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{selected.email}</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "rgba(255,255,255,0.22)" }}>UID: {selected.uid}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="text-xl cursor-pointer shrink-0 ml-1"
                    style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
                </div>

                {/* Online status strip */}
                <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl"
                  style={{ background: isOnline(selected) ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${isOnline(selected) ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                  <motion.div className="w-2 h-2 rounded-full" style={{ background: isOnline(selected) ? "#34d399" : "rgba(255,255,255,0.2)" }}
                    animate={isOnline(selected) ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 1.2, repeat: Infinity }} />
                  <span className="text-xs font-bold" style={{ color: isOnline(selected) ? "#34d399" : "rgba(255,255,255,0.35)" }}>
                    {isOnline(selected) ? "Online right now" : `Last seen: ${fmtDate(selected.lastLoginAt)}`}
                  </span>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                {/* Wallet breakdown */}
                <div>
                  <p className="text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: "rgba(255,215,0,0.5)" }}>
                    💰 WALLET BREAKDOWN
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Winning",  val: selected.wallet?.winning ?? 0, color: "#34d399", icon: "🏆" },
                      { label: "Deposit",  val: selected.wallet?.deposit ?? 0, color: "#60a5fa", icon: "💳" },
                      { label: "Bonus",    val: selected.wallet?.bonus   ?? 0, color: "#FFD700", icon: "🎁" },
                    ].map((b) => (
                      <div key={b.label} className="rounded-xl px-3 py-2.5 text-center"
                        style={{ background: `${b.color}0e`, border: `1px solid ${b.color}22` }}>
                        <div className="text-lg">{b.icon}</div>
                        <div className="text-sm font-black mt-1" style={{ color: b.color }}>
                          {fmtWallet(b.val)}
                        </div>
                        <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{b.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)" }}>
                    <span className="text-xs font-black" style={{ color: "rgba(255,215,0,0.7)" }}>Total Balance</span>
                    <span className="text-lg font-black" style={{ color: "#FFD700" }}>{fmtWallet(walletTotal(selected))}</span>
                  </div>
                </div>

                {/* Account info */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: "rgba(255,215,0,0.5)" }}>
                    📋 ACCOUNT INFO
                  </p>
                  {[
                    { label: "KYC Status",    value: selected.kycStatus ?? "pending" },
                    { label: "Referral Code", value: selected.referralCode || "—" },
                    { label: "Joined",        value: fmtDate(selected.createdAt) },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
                      <span className="text-xs font-bold text-white">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Ban / Unban button */}
                <motion.button whileTap={{ scale: 0.97 }} disabled={actionId === selected.uid}
                  onClick={() => toggleBan(selected)}
                  className="w-full py-3.5 rounded-2xl font-black text-sm cursor-pointer"
                  style={selected.banned
                    ? { background: "rgba(52,211,153,0.10)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }
                    : { background: "rgba(248,113,113,0.10)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
                  {actionId === selected.uid ? "⚙️ Processing…" : selected.banned ? "✅ Unban User" : "🚫 Ban User"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
