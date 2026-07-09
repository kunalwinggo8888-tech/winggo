/**
 * PageMatchHistory — WINGGO Admin Panel
 * Shows all match records saved to Firestore by both games (Ludo + Saanp Sidi).
 * Displays: players, scores, winner, bet amount, time, status.
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getMatchHistoryAdmin, type MatchHistoryRecord } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const T = {
  blue:  "#00d4ff",
  green: "#00ff88",
  red:   "#ff3366",
  gold:  "#f59e0b",
  muted: "rgba(226,232,240,0.4)",
  card:  "rgba(0,212,255,0.04)",
  bdr:   "rgba(0,212,255,0.13)",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export default function PageMatchHistory() {
  const [matches,   setMatches]   = useState<MatchHistoryRecord[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [filter,    setFilter]    = useState<"all" | "win" | "loss">("all");
  const [gameFilter, setGameFilter] = useState<"all" | "ludofast" | "saanpsidi">("all");

  useEffect(() => {
    setLoading(true);
    getMatchHistoryAdmin()
      .then((data) => {
        setMatches(data);
        setError("");
      })
      .catch(() => setError("Failed to load match history. Check Firestore connection."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = matches.filter((m) => {
    if (filter !== "all" && m.result !== filter) return false;
    if (gameFilter !== "all" && m.gameId !== gameFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.uid?.toLowerCase().includes(q) ||
        m.opponentName?.toLowerCase().includes(q) ||
        m.gameName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalWins   = matches.filter((m) => m.result === "win").length;
  const totalPrize  = matches.reduce((s, m) => s + (m.prize || 0), 0);
  const totalEntry  = matches.reduce((s, m) => s + (m.entryFee || 0), 0);

  return (
    <div className="p-4 space-y-4 max-w-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-white">📋 Match History</h1>
          <p className="text-xs mt-0.5" style={{ color: T.muted }}>
            All competitive matches saved to Firestore
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => { setLoading(true); getMatchHistoryAdmin().then(setMatches).finally(() => setLoading(false)); }}
          className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
          style={{ background: `${T.blue}14`, color: T.blue, border: `1px solid ${T.blue}30` }}>
          ↻ Refresh
        </motion.button>
      </div>

      {/* ── Firebase not configured warning ── */}
      {!FIREBASE_ENABLED && (
        <div className="rounded-xl p-4" style={{ background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.25)" }}>
          <p className="text-sm font-bold" style={{ color: "#ff3366" }}>
            ⚠️ Firebase not configured — match history requires Firestore.
            Add VITE_FIREBASE_* env vars to see live data.
          </p>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Matches",  value: matches.length,          color: T.blue,   icon: "🎮" },
          { label: "Total Wins",     value: totalWins,               color: T.green,  icon: "🏆" },
          { label: "Total Prize Out",value: `₹${totalPrize}`,        color: T.gold,   icon: "💰" },
          { label: "Total Entry",    value: `₹${totalEntry}`,        color: T.muted,  icon: "🎟️" },
        ].map(({ label, value, color, icon }) => (
          <motion.div key={label}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-3" style={{ background: T.card, border: `1px solid ${T.bdr}` }}>
            <div className="text-lg mb-1">{icon}</div>
            <div className="text-lg font-black" style={{ color }}>{value}</div>
            <div className="text-[10px] font-bold mt-0.5" style={{ color: T.muted }}>{label}</div>
          </motion.div>
        ))}
      </div>

      {/* ── Filters + Search ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by UID / opponent / game…"
          className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg text-sm text-white outline-none"
          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${T.bdr}` }}
        />
        {(["all","win","loss"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
            style={{
              background: filter === f ? (f === "win" ? `${T.green}22` : f === "loss" ? "rgba(255,51,102,0.15)" : `${T.blue}14`) : "rgba(255,255,255,0.04)",
              color: filter === f ? (f === "win" ? T.green : f === "loss" ? T.red : T.blue) : T.muted,
              border: `1px solid ${filter === f ? (f === "win" ? T.green : f === "loss" ? T.red : T.blue) : "rgba(255,255,255,0.1)"}30`,
            }}>
            {f === "all" ? "All" : f === "win" ? "🏆 Wins" : "💀 Losses"}
          </button>
        ))}
        {(["all","ludofast","saanpsidi"] as const).map((f) => (
          <button key={f} onClick={() => setGameFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
            style={{
              background: gameFilter === f ? `${T.gold}18` : "rgba(255,255,255,0.04)",
              color: gameFilter === f ? T.gold : T.muted,
              border: `1px solid ${gameFilter === f ? T.gold : "rgba(255,255,255,0.1)"}30`,
            }}>
            {f === "all" ? "All Games" : f === "ludofast" ? "🎲 Ludo" : "🐍 Saanp Sidi"}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center gap-3 py-12 justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 rounded-full border-[3px]"
            style={{ borderColor: T.blue, borderTopColor: "transparent" }} />
          <span className="text-sm font-bold" style={{ color: T.muted }}>Loading match history…</span>
        </div>
      ) : error ? (
        <div className="rounded-xl p-6 text-center" style={{ background: "rgba(255,51,102,0.07)", border: "1px solid rgba(255,51,102,0.2)" }}>
          <p className="text-sm font-bold" style={{ color: T.red }}>{error}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: T.card, border: `1px solid ${T.bdr}` }}>
          <div className="text-4xl mb-3">📭</div>
          <p className="text-sm font-bold" style={{ color: T.muted }}>
            {matches.length === 0 ? "No matches recorded yet. Matches are saved when users play Ludo or Saanp Sidi." : "No matches match the current filter."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${T.bdr}` }}>
          {/* Table header */}
          <div className="grid text-[10px] font-black uppercase tracking-widest px-3 py-2.5"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
              background: "rgba(0,212,255,0.06)",
              color: T.muted,
              borderBottom: `1px solid ${T.bdr}`,
            }}>
            <span>Player (UID)</span>
            <span>Game</span>
            <span>Score</span>
            <span>Opponent</span>
            <span>Bet</span>
            <span>Status</span>
            <span>Time</span>
          </div>

          {/* Rows */}
          {filtered.map((m, i) => (
            <motion.div key={m.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.02 }}
              className="grid items-center px-3 py-2.5 text-xs"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr 1.5fr",
                background: i % 2 === 0 ? "rgba(255,255,255,0.015)" : "transparent",
                borderBottom: i < filtered.length - 1 ? `1px solid rgba(255,255,255,0.04)` : "none",
              }}>

              {/* Player UID */}
              <div className="min-w-0">
                <span className="font-bold text-white block truncate" title={m.uid}>
                  {m.uid?.slice(0, 10)}…
                </span>
              </div>

              {/* Game */}
              <div className="flex items-center gap-1">
                <span>{m.gameIcon}</span>
                <span className="font-bold truncate" style={{ color: T.muted }}>
                  {m.gameId === "ludofast" ? "Ludo" : m.gameId === "saanpsidi" ? "Saanp" : m.gameName}
                </span>
              </div>

              {/* Scores */}
              <div>
                <span className="font-black" style={{ color: m.result === "win" ? T.green : T.red }}>
                  {m.userScore ?? "—"}
                </span>
                <span className="text-[9px] font-bold" style={{ color: T.muted }}> vs {m.opponentScore ?? "—"}</span>
              </div>

              {/* Opponent */}
              <div className="font-bold truncate" style={{ color: T.muted }} title={m.opponentName}>
                {m.opponentName?.slice(0, 10) ?? "—"}
              </div>

              {/* Bet */}
              <div className="font-black" style={{ color: T.gold }}>
                ₹{m.entryFee}
              </div>

              {/* Status (win/loss + prize) */}
              <div>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black"
                  style={{
                    background: m.result === "win" ? `${T.green}18` : "rgba(255,51,102,0.15)",
                    color: m.result === "win" ? T.green : T.red,
                  }}>
                  {m.result === "win" ? `🏆 +₹${m.prize}` : "💀 LOSS"}
                </span>
              </div>

              {/* Time */}
              <div className="text-[10px] font-bold" style={{ color: T.muted }}>
                {formatDate(m.date)}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-[10px] font-bold text-center" style={{ color: T.muted }}>
          Showing {filtered.length} of {matches.length} records
        </p>
      )}
    </div>
  );
}
