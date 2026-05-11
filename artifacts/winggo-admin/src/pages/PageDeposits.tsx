/**
 * PageDeposits — Admin panel: Real Razorpay deposit history
 * Shows all deposits with Razorpay payment IDs, amounts, users, timestamps.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { subscribeDeposits, getDepositStats, DepositRecord } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const MOCK_DEPOSITS: DepositRecord[] = [
  { id: "pay_mock1", uid: "user1", email: "rahul@example.com", displayName: "Rahul Sharma",  amount: 500,  bonusPct: 15, bonusAmount: 75,  razorpayOrderId: "order_mock1", razorpayPaymentId: "pay_Nxmock001", method: "UPI/GPay",    status: "success", createdAt: Date.now() - 60000 },
  { id: "pay_mock2", uid: "user2", email: "priya@example.com", displayName: "Priya Patel",   amount: 1000, bonusPct: 15, bonusAmount: 150, razorpayOrderId: "order_mock2", razorpayPaymentId: "pay_Nxmock002", method: "Card",        status: "success", createdAt: Date.now() - 300000 },
  { id: "pay_mock3", uid: "user3", email: "amit@example.com",  displayName: "Amit Kumar",    amount: 2000, bonusPct: 15, bonusAmount: 300, razorpayOrderId: "order_mock3", razorpayPaymentId: "pay_Nxmock003", method: "NetBanking",  status: "success", createdAt: Date.now() - 900000 },
  { id: "pay_mock4", uid: "user4", email: "vikram@example.com",displayName: "Vikram Singh",  amount: 50,   bonusPct: 0,  bonusAmount: 0,   razorpayOrderId: "order_mock4", razorpayPaymentId: "pay_Nxmock004", method: "UPI/PhonePe", status: "success", createdAt: Date.now() - 3600000 },
  { id: "pay_mock5", uid: "user5", email: "arjun@example.com", displayName: "Arjun Menon",   amount: 5000, bonusPct: 15, bonusAmount: 750, razorpayOrderId: "order_mock5", razorpayPaymentId: "pay_Nxmock005", method: "UPI/Paytm",  status: "success", createdAt: Date.now() - 86400000 },
];

function fmt(ts: number | { seconds: number } | unknown): string {
  const ms = typeof ts === "number" ? ts : typeof (ts as { seconds: number }).seconds === "number" ? (ts as { seconds: number }).seconds * 1000 : 0;
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function PageDeposits() {
  const [deposits, setDeposits] = useState<DepositRecord[]>(FIREBASE_ENABLED ? [] : MOCK_DEPOSITS);
  const [stats, setStats]       = useState({ total: 0, count: 0, today: 0 });
  const [search, setSearch]     = useState("");

  useEffect(() => {
    const unsub = subscribeDeposits((deps) => {
      setDeposits(deps.length > 0 ? deps : (FIREBASE_ENABLED ? [] : MOCK_DEPOSITS));
    });
    if (FIREBASE_ENABLED) {
      getDepositStats().then(setStats);
    } else {
      setStats({ total: 8550, count: 5, today: 3500 });
    }
    return unsub;
  }, []);

  const filtered = deposits.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.displayName.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      d.razorpayPaymentId.toLowerCase().includes(q) ||
      d.method.toLowerCase().includes(q)
    );
  });

  const totalAll   = deposits.reduce((s, d) => s + d.amount, 0);
  const totalToday = (() => {
    const cutoff = Date.now() - 86400000;
    return deposits
      .filter((d) => {
        const ts = typeof d.createdAt === "number" ? d.createdAt : (d.createdAt as { seconds: number })?.seconds * 1000 ?? 0;
        return ts > cutoff;
      })
      .reduce((s, d) => s + d.amount, 0);
  })();

  const SUMMARY = [
    { label: "Total Deposits",       value: `₹${(FIREBASE_ENABLED ? stats.total : totalAll).toLocaleString("en-IN")}`, color: "#34d399", icon: "💰" },
    { label: "Total Transactions",   value: (FIREBASE_ENABLED ? stats.count : deposits.length).toString(),              color: "#60a5fa", icon: "🧾" },
    { label: "Today's Deposits",     value: `₹${(FIREBASE_ENABLED ? stats.today : totalToday).toLocaleString("en-IN")}`,color: "#fbbf24", icon: "📅" },
    { label: "Avg Deposit",          value: deposits.length > 0 ? `₹${Math.round(totalAll / deposits.length).toLocaleString("en-IN")}` : "—", color: "#a78bfa", icon: "📊" },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SUMMARY.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${s.color}22` }}>
            <div className="text-2xl mb-2">{s.icon}</div>
            <div className="text-xl font-black" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h2 className="font-black text-white text-base">💳 Razorpay Deposits</h2>
          {FIREBASE_ENABLED && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              Live
            </div>
          )}
        </div>
        <input
          placeholder="Search user / email / payment ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs text-white outline-none w-64"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Column headers */}
        <div className="grid gap-2 px-4 py-3 text-[10px] font-black tracking-widest uppercase"
          style={{
            gridTemplateColumns: "1fr 2fr 1fr 1fr 2fr 1fr",
            background: "rgba(52,211,153,0.05)",
            color: "rgba(52,211,153,0.6)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
          <span>Date</span>
          <span>User</span>
          <span>Amount</span>
          <span>Bonus</span>
          <span>Razorpay ID</span>
          <span>Method</span>
        </div>

        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {FIREBASE_ENABLED
              ? search ? "No results found" : "No deposits yet — real payments will appear here instantly"
              : "No deposits found"}
          </div>
        )}

        {filtered.map((d, i) => (
          <motion.div
            key={d.id ?? i}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            className="grid gap-2 items-center px-4 py-3"
            style={{
              gridTemplateColumns: "1fr 2fr 1fr 1fr 2fr 1fr",
              background: i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
              borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
              {fmt(d.createdAt)}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{d.displayName}</p>
              <p className="text-[10px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{d.email}</p>
            </div>
            <span className="text-sm font-black" style={{ color: "#34d399" }}>
              ₹{d.amount.toLocaleString("en-IN")}
            </span>
            <span className="text-xs font-bold" style={{ color: d.bonusAmount > 0 ? "#fbbf24" : "rgba(255,255,255,0.2)" }}>
              {d.bonusAmount > 0 ? `+₹${d.bonusAmount}` : "—"}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-mono truncate" style={{ color: "rgba(255,215,0,0.7)" }}>
                {d.razorpayPaymentId}
              </p>
              <p className="text-[9px] font-mono truncate" style={{ color: "rgba(255,255,255,0.2)" }}>
                {d.razorpayOrderId}
              </p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)", whiteSpace: "nowrap" }}>
              {d.method}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
