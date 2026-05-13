/**
 * HistoryScreen — WINGGO
 * Premium WinZO-style history & stats page.
 * Tabs: All History | Game History | World War | Deposits | Withdrawals | Bonus
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";
import type { MatchRecord } from "@/context/MatchHistoryContext";
import type { Transaction } from "@/context/WalletContext";

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  onBack: () => void;
  onWallet: () => void;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type TabKey = "all" | "game" | "worldwar" | "deposits" | "withdrawals" | "bonus";
const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "all",          label: "All",         icon: "📋" },
  { key: "game",         label: "Games",        icon: "🎮" },
  { key: "worldwar",     label: "World War",    icon: "⚔️" },
  { key: "deposits",     label: "Deposits",     icon: "💳" },
  { key: "withdrawals",  label: "Withdrawals",  icon: "🏦" },
  { key: "bonus",        label: "Bonus",        icon: "🎁" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n % 1 === 0 ? `₹${n}` : `₹${n.toFixed(2)}`;
}
function fmtDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "numeric", month: "short",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return dateStr;
  }
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: {
  label: string; value: string; icon: string; accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 min-w-0 rounded-2xl p-3 relative overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${accent}30`,
        boxShadow: `0 0 20px ${accent}12`,
      }}
    >
      <div className="absolute top-0 right-0 w-16 h-16 rounded-full opacity-10"
        style={{ background: accent, filter: "blur(20px)", transform: "translate(30%, -30%)" }} />
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5"
        style={{ color: "rgba(255,255,255,0.4)" }}>{label}</div>
      <div className="text-sm font-black" style={{ color: accent }}>{value}</div>
    </motion.div>
  );
}

// ── Transaction Card (All, Deposits, Withdrawals, Bonus) ─────────────────────
function TxCard({ tx }: { tx: Transaction }) {
  const isPositive = tx.rawAmount > 0;
  const statusColor =
    tx.status === "completed" ? "#27ae60" :
    tx.status === "pending"   ? "#f39c12" :
    tx.status === "rejected"  ? "#e74c3c" : "rgba(255,255,255,0.35)";

  const typeIcon =
    tx.type === "win"      ? "🏆" :
    tx.type === "deposit"  ? "💳" :
    tx.type === "withdraw" ? "🏦" :
    tx.type === "bonus"    ? "🎁" :
    tx.type === "fee"      ? "🎮" : "💰";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
        style={{ background: "rgba(255,255,255,0.07)" }}>
        {typeIcon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate">{tx.title}</div>
        <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{tx.time}</div>
        {tx.status && (
          <div className="text-[10px] font-bold mt-0.5 capitalize flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor }} />
            <span style={{ color: statusColor }}>{tx.status}</span>
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="shrink-0 text-right">
        <div className="text-sm font-black" style={{ color: isPositive ? "#27ae60" : "#e74c3c" }}>
          {tx.display}
        </div>
      </div>
    </motion.div>
  );
}

// ── Match Card ────────────────────────────────────────────────────────────────
function MatchCard({ match }: { match: MatchRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isWin = match.result === "win";
  const isPractice = match.entryFee === 0;

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: isPractice ? "rgba(16,185,129,0.04)" : "rgba(255,255,255,0.03)",
        border: isPractice
          ? "1px solid rgba(16,185,129,0.2)"
          : `1px solid ${isWin ? "rgba(39,174,96,0.2)" : "rgba(231,76,60,0.12)"}`,
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: isPractice ? "rgba(16,185,129,0.12)" : "rgba(255,255,255,0.07)" }}>
          {match.gameIcon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-sm font-bold text-white">{match.gameName}</div>
            {isPractice && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}>
                PRACTICE
              </span>
            )}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {fmtDate(match.date)}
          </div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{
                background: isWin ? "rgba(39,174,96,0.15)" : "rgba(231,76,60,0.12)",
                color: isWin ? "#27ae60" : "#e74c3c",
              }}>
              {isWin ? "🏆 WIN" : "❌ LOSS"}
            </span>
            {isPractice ? (
              <span className="text-[10px]" style={{ color: "rgba(16,185,129,0.6)" }}>Practice Match · FREE</span>
            ) : (
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Entry {fmt(match.entryFee)}
              </span>
            )}
            {match.opponentName && (
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                vs {match.opponentName}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {isPractice ? (
            <div className="text-sm font-black" style={{ color: "#10b981" }}>
              {isWin ? "🏆 Won" : "Practice"}
            </div>
          ) : (
            <div className="text-sm font-black"
              style={{ color: isWin ? "#27ae60" : "#e74c3c" }}>
              {isWin ? `+${fmt(match.prize)}` : `-${fmt(match.entryFee)}`}
            </div>
          )}
          <div className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            {expanded ? "▲" : "▼"}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-2.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Score comparison */}
              {(match.userScore !== undefined || match.opponentScore !== undefined) && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1 rounded-xl p-2.5 text-center"
                    style={{
                      background: "rgba(39,174,96,0.08)",
                      border: "1px solid rgba(39,174,96,0.15)",
                    }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "rgba(255,255,255,0.45)" }}>Your Score</div>
                    <div className="text-xl font-black" style={{ color: "#27ae60" }}>
                      {match.userScore ?? "—"}
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl p-2.5 text-center"
                    style={{
                      background: "rgba(231,76,60,0.08)",
                      border: "1px solid rgba(231,76,60,0.15)",
                    }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
                      style={{ color: "rgba(255,255,255,0.45)" }}>Opp Score</div>
                    <div className="text-xl font-black" style={{ color: "#e74c3c" }}>
                      {match.opponentScore ?? "—"}
                    </div>
                  </div>
                </div>
              )}

              {/* Prize / fee breakdown */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl px-3 py-2.5"
                  style={{ background: isPractice ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.04)" }}>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>Entry Fee</div>
                  <div className="text-sm font-bold mt-0.5" style={{ color: isPractice ? "#10b981" : "#fff" }}>
                    {isPractice ? "FREE" : fmt(match.entryFee)}
                  </div>
                </div>
                <div className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {isPractice ? "Result" : isWin ? "Prize Won" : "Amount Lost"}
                  </div>
                  <div className="text-sm font-bold mt-0.5"
                    style={{ color: isPractice ? "#10b981" : isWin ? "#27ae60" : "#e74c3c" }}>
                    {isPractice ? (isWin ? "Won 🏆" : "Lost") : isWin ? fmt(match.prize) : fmt(match.entryFee)}
                  </div>
                </div>
              </div>

              {/* Room ID */}
              {match.roomId && (
                <div className="text-xs rounded-xl px-3 py-2"
                  style={{ background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.3)" }}>
                  Room&nbsp;
                  <span className="font-mono font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>
                    #{match.roomId}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── World War Card ────────────────────────────────────────────────────────────
function WorldWarCard({ match }: { match: MatchRecord }) {
  const [expanded, setExpanded] = useState(false);
  const isWin = match.result === "win";
  const team = match.teamStats?.find((t) => t.isPlayer);

  return (
    <motion.div
      layout
      className="rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${isWin ? "rgba(255,215,0,0.2)" : "rgba(231,76,60,0.12)"}`,
      }}
      onClick={() => setExpanded((e) => !e)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* War icon */}
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: "linear-gradient(135deg,#ff4e00,#ec9f05)" }}>
          ⚔️
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white">
            {team ? `${team.icon} ${team.teamName}` : "World War"}
          </div>
          <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            {fmtDate(match.date)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{
                background: isWin ? "rgba(255,215,0,0.12)" : "rgba(231,76,60,0.12)",
                color: isWin ? "#FFD700" : "#e74c3c",
              }}>
              {isWin ? "🏆 VICTORY" : "💀 DEFEAT"}
            </span>
            {match.entryFee > 0 && (
              <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                Entry {fmt(match.entryFee)}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-sm font-black" style={{ color: isWin ? "#FFD700" : "#e74c3c" }}>
            {isWin ? (match.prize > 0 ? `+${fmt(match.prize)}` : "Reward") : "Defeated"}
          </div>
          <div className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.25)" }}>
            {expanded ? "▲" : "▼"}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && match.teamStats && match.teamStats.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 space-y-2.5"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Team comparison */}
              <div className="flex gap-2 mt-2">
                {match.teamStats.map((ts) => (
                  <div key={ts.teamName} className="flex-1 rounded-xl p-3 text-center"
                    style={{
                      background: `${ts.color}10`,
                      border: `1px solid ${ts.color}25`,
                    }}>
                    <div className="text-xl">{ts.icon}</div>
                    <div className="text-xs font-bold text-white mt-1">{ts.teamName}</div>
                    <div className="text-2xl font-black mt-0.5" style={{ color: ts.color }}>{ts.score}</div>
                    <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                      {ts.isPlayer ? "Your Team" : "Opponent"}
                    </div>
                  </div>
                ))}
              </div>

              {/* User contribution */}
              {match.userScore !== undefined && (
                <div className="rounded-xl px-3 py-2.5"
                  style={{ background: "rgba(255,255,255,0.04)" }}>
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Your Contribution:
                  </span>
                  <span className="text-sm font-bold text-white ml-2">{match.userScore} pts</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────
function EmptyState({ message = "No transactions yet" }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-3 px-6"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        className="text-5xl select-none"
      >
        📭
      </motion.div>
      <div className="text-base font-bold text-white text-center">{message}</div>
      <div className="text-sm text-center max-w-xs"
        style={{ color: "rgba(255,255,255,0.35)" }}>
        Play games & make transactions to see them here
      </div>
    </motion.div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center justify-between mb-2 px-1">
      <span className="text-xs font-bold uppercase tracking-wider"
        style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
        style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700" }}>{count}</span>
    </div>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function HistoryScreen({ onBack, onWallet }: Props) {
  const { wallet, transactions, total } = useWallet();
  const { matches, totalEarnings, totalMatches, wins } = useMatchHistory();

  const [activeTab, setActiveTab] = useState<TabKey>("all");

  // Derived stats
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  // Filtered data per tab
  const filteredTxAll       = useMemo(() => transactions, [transactions]);
  const filteredGameHistory = useMemo(() => matches.filter((m) => m.gameId !== "worldwar"), [matches]);
  const filteredWorldWar    = useMemo(() => matches.filter((m) => m.gameId === "worldwar"), [matches]);
  const filteredDeposits    = useMemo(() => transactions.filter((t) => t.type === "deposit"), [transactions]);
  const filteredWithdrawals = useMemo(() => transactions.filter((t) => t.type === "withdraw"), [transactions]);
  const filteredBonus       = useMemo(() => transactions.filter((t) => t.type === "bonus"), [transactions]);

  // Total deposits & withdrawals for summary
  const totalDeposits    = filteredDeposits.reduce((s, t) => s + (t.rawAmount > 0 ? t.rawAmount : 0), 0);
  const totalWithdrawals = filteredWithdrawals.reduce((s, t) => s + Math.abs(t.rawAmount), 0);

  return (
    <div
      className="min-h-screen flex flex-col relative"
      style={{ background: "#07070d", maxWidth: "480px", margin: "0 auto" }}
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3"
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "rgba(7,7,13,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onBack}
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 cursor-pointer"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <span className="text-white text-base">←</span>
        </motion.button>

        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-tight">History</h1>
          <div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.7)" }}>
            Wallet &amp; Match Records
          </div>
        </div>

        {/* Wallet shortcut */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onWallet}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer"
          style={{
            background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.08))",
            border: "1px solid rgba(255,215,0,0.3)",
          }}
        >
          <span className="text-sm">💰</span>
          <span className="text-sm font-black" style={{ color: "#FFD700" }}>
            ₹{total.toFixed(0)}
          </span>
        </motion.button>
      </header>

      {/* ── Scrollable Body ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto pt-16 pb-28">

        {/* ── Stats Grid ────────────────────────────────────────────────────── */}
        <div className="px-4 pt-4">
          {/* Top row */}
          <div className="flex gap-2 mb-2">
            <StatCard
              icon="🏆"
              label="Total Earnings"
              value={fmt(totalEarnings)}
              accent="#FFD700"
            />
            <StatCard
              icon="💰"
              label="Wallet Balance"
              value={`₹${total.toFixed(0)}`}
              accent="#27ae60"
            />
          </div>
          {/* Bottom row */}
          <div className="flex gap-2 mb-4">
            <StatCard
              icon="🎮"
              label="Total Matches"
              value={String(totalMatches)}
              accent="#a855f7"
            />
            <StatCard
              icon="🎯"
              label="Win Rate"
              value={`${winRate}%`}
              accent="#3b82f6"
            />
          </div>

          {/* Mini wallet breakdown */}
          <div className="rounded-2xl p-4 mb-4"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,215,0,0.1)",
            }}>
            <div className="text-xs font-bold uppercase tracking-wider mb-3"
              style={{ color: "rgba(255,255,255,0.4)" }}>
              Wallet Breakdown
            </div>
            <div className="flex justify-between">
              {[
                { label: "Winnings", value: wallet.winning, color: "#27ae60", icon: "🏆" },
                { label: "Deposit",  value: wallet.deposit,  color: "#3b82f6", icon: "💳" },
                { label: "Bonus",    value: wallet.bonus,    color: "#FFD700", icon: "🎁" },
              ].map((b) => (
                <div key={b.label} className="text-center flex-1">
                  <div className="text-base">{b.icon}</div>
                  <div className="text-xs font-black mt-0.5" style={{ color: b.color }}>
                    {fmt(b.value)}
                  </div>
                  <div className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {b.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Horizontal Tab Bar ──────────────────────────────────────────────── */}
        <div
          className="flex gap-2 px-4 pb-3 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <motion.button
                key={tab.key}
                whileTap={{ scale: 0.93 }}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl shrink-0 cursor-pointer relative overflow-hidden"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,140,0,0.1))"
                    : "rgba(255,255,255,0.04)",
                  border: isActive
                    ? "1px solid rgba(255,215,0,0.4)"
                    : "1px solid rgba(255,255,255,0.07)",
                  boxShadow: isActive ? "0 0 16px rgba(255,215,0,0.2)" : "none",
                }}
                animate={isActive ? {
                  boxShadow: [
                    "0 0 10px rgba(255,215,0,0.15)",
                    "0 0 22px rgba(255,215,0,0.35)",
                    "0 0 10px rgba(255,215,0,0.15)",
                  ],
                } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <span className="text-sm">{tab.icon}</span>
                <span
                  className="text-xs font-bold whitespace-nowrap"
                  style={{ color: isActive ? "#FFD700" : "rgba(255,255,255,0.45)" }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                    style={{ background: "linear-gradient(90deg, #FFD700, #ff8c00)" }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* ── Tab Content ─────────────────────────────────────────────────────── */}
        <div className="px-4 space-y-2.5">
          <AnimatePresence mode="wait">

            {/* ALL HISTORY */}
            {activeTab === "all" && (
              <motion.div
                key="all"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2.5"
              >
                {filteredTxAll.length === 0 ? (
                  <EmptyState message="No history yet" />
                ) : (
                  <>
                    <SectionLabel label="Recent Activity" count={filteredTxAll.length} />
                    {filteredTxAll.map((tx) => (
                      <TxCard key={tx.id} tx={tx} />
                    ))}
                  </>
                )}
              </motion.div>
            )}

            {/* GAME HISTORY */}
            {activeTab === "game" && (
              <motion.div
                key="game"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2.5"
              >
                {filteredGameHistory.length === 0 ? (
                  <EmptyState message="No game history yet" />
                ) : (
                  <>
                    {/* Quick stats row */}
                    <div className="flex gap-2 py-1">
                      {[
                        { label: "Played", value: filteredGameHistory.length, color: "#a855f7" },
                        { label: "Won",    value: filteredGameHistory.filter((m) => m.result === "win").length,  color: "#27ae60" },
                        { label: "Lost",   value: filteredGameHistory.filter((m) => m.result === "loss").length, color: "#e74c3c" },
                      ].map((s) => (
                        <div key={s.label} className="flex-1 rounded-xl py-2.5 text-center"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <div className="text-base font-black" style={{ color: s.color }}>{s.value}</div>
                          <div className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <SectionLabel label="Match History" count={filteredGameHistory.length} />
                    {filteredGameHistory.map((m) => (
                      <MatchCard key={m.id} match={m} />
                    ))}
                  </>
                )}
              </motion.div>
            )}

            {/* WORLD WAR */}
            {activeTab === "worldwar" && (
              <motion.div
                key="worldwar"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2.5"
              >
                {/* Team legend */}
                <div className="flex gap-2 py-1">
                  <div className="flex-1 rounded-xl p-3 flex items-center gap-2"
                    style={{ background: "rgba(255,100,0,0.08)", border: "1px solid rgba(255,100,0,0.2)" }}>
                    <span className="text-xl">🔥</span>
                    <div>
                      <div className="text-xs font-black text-white">KARNA TEAM</div>
                      <div className="text-[9px]" style={{ color: "rgba(255,150,0,0.7)" }}>Warrior Squad</div>
                    </div>
                  </div>
                  <div className="flex-1 rounded-xl p-3 flex items-center gap-2"
                    style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                    <span className="text-xl">⚡</span>
                    <div>
                      <div className="text-xs font-black text-white">ARJUN TEAM</div>
                      <div className="text-[9px]" style={{ color: "rgba(100,160,255,0.7)" }}>Hero Squad</div>
                    </div>
                  </div>
                </div>

                {filteredWorldWar.length === 0 ? (
                  <EmptyState message="No World War battles yet" />
                ) : (
                  <>
                    <SectionLabel label="Battle History" count={filteredWorldWar.length} />
                    {filteredWorldWar.map((m) => (
                      <WorldWarCard key={m.id} match={m} />
                    ))}
                  </>
                )}
              </motion.div>
            )}

            {/* DEPOSITS */}
            {activeTab === "deposits" && (
              <motion.div
                key="deposits"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2.5"
              >
                {/* Summary */}
                {filteredDeposits.length > 0 && (
                  <div className="rounded-2xl p-4 flex items-center justify-between"
                    style={{
                      background: "rgba(52,152,219,0.08)",
                      border: "1px solid rgba(52,152,219,0.2)",
                    }}>
                    <div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Total Deposited</div>
                      <div className="text-xl font-black" style={{ color: "#3b82f6" }}>{fmt(totalDeposits)}</div>
                    </div>
                    <div className="text-3xl">💳</div>
                  </div>
                )}

                {filteredDeposits.length === 0 ? (
                  <EmptyState message="No deposits yet" />
                ) : (
                  <>
                    <SectionLabel label="Deposit History" count={filteredDeposits.length} />
                    {filteredDeposits.map((tx) => <TxCard key={tx.id} tx={tx} />)}
                  </>
                )}
              </motion.div>
            )}

            {/* WITHDRAWALS */}
            {activeTab === "withdrawals" && (
              <motion.div
                key="withdrawals"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2.5"
              >
                {filteredWithdrawals.length > 0 && (
                  <div className="rounded-2xl p-4 flex items-center justify-between"
                    style={{
                      background: "rgba(243,156,18,0.08)",
                      border: "1px solid rgba(243,156,18,0.2)",
                    }}>
                    <div>
                      <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Total Withdrawn</div>
                      <div className="text-xl font-black" style={{ color: "#f39c12" }}>{fmt(totalWithdrawals)}</div>
                    </div>
                    <div className="text-3xl">🏦</div>
                  </div>
                )}

                {filteredWithdrawals.length === 0 ? (
                  <EmptyState message="No withdrawals yet" />
                ) : (
                  <>
                    <SectionLabel label="Withdrawal History" count={filteredWithdrawals.length} />
                    {filteredWithdrawals.map((tx) => <TxCard key={tx.id} tx={tx} />)}
                  </>
                )}
              </motion.div>
            )}

            {/* BONUS HISTORY */}
            {activeTab === "bonus" && (
              <motion.div
                key="bonus"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-2.5"
              >
                {/* Bonus types legend */}
                <div className="grid grid-cols-2 gap-2 py-1">
                  {[
                    { icon: "🎉", label: "Signup Bonus",   desc: "First-time reward" },
                    { icon: "👥", label: "Referral Bonus", desc: "Invite & earn" },
                    { icon: "🎡", label: "Spin Reward",    desc: "Daily spin win" },
                    { icon: "🏷️", label: "Promo Reward",   desc: "Special offers" },
                  ].map((b) => (
                    <div key={b.label} className="rounded-xl p-3 flex items-center gap-2"
                      style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.1)" }}>
                      <span className="text-lg">{b.icon}</span>
                      <div>
                        <div className="text-[10px] font-bold text-white">{b.label}</div>
                        <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>{b.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredBonus.length === 0 ? (
                  <EmptyState message="No bonuses yet" />
                ) : (
                  <>
                    <SectionLabel label="Bonus History" count={filteredBonus.length} />
                    {filteredBonus.map((tx) => <TxCard key={tx.id} tx={tx} />)}
                  </>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
