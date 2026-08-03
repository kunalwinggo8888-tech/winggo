import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeLiveLeaderboard, LeaderboardEntry } from "@/firebase/admin.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const GAME_TABS = [
  { id: "ludo" as const, label: "🎲 Ludo", color: "#a78bfa" },
  { id: "worldwar" as const, label: "⚔️ World War", color: "#f97316" },
  { id: "carrom" as const, label: "🎯 Carrom", color: "#ffd700" },
];

const DEMO_LEADERS: LeaderboardEntry[] = [
  { uid: "u1", name: "Rahul_G", score: 48200 },
  { uid: "u2", name: "Priya_K", score: 43100 },
  { uid: "u3", name: "Amit_S", score: 39800 },
  { uid: "u4", name: "Dev_R", score: 36400 },
  { uid: "u5", name: "Sneha_M", score: 31000 },
  { uid: "u6", name: "Rohit_P", score: 28700 },
  { uid: "u7", name: "Kavya_L", score: 26200 },
  { uid: "u8", name: "Arjun_T", score: 23400 },
  { uid: "u9", name: "Meera_V", score: 21100 },
  { uid: "u10", name: "Varun_D", score: 18500 },
];

const RANK_COLORS = ["#FFD700", "#C0C0C0", "#cd7f32"];
const RANK_LABELS = ["🥇", "🥈", "🥉"];

function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const colors = ["#7c3aed","#db2777","#0891b2","#059669","#d97706","#dc2626","#2563eb"];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className="rounded-full flex items-center justify-center font-black text-white shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}88)`, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function PageLeaderboard() {
  const [tab, setTab] = useState<"ludo" | "worldwar" | "carrom">("ludo");
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>(DEMO_LEADERS);
  const [loading, setLoading] = useState(FIREBASE_ENABLED);

  useEffect(() => {
    setLoading(true);
    setLeaders(DEMO_LEADERS);
    const unsub = subscribeLiveLeaderboard(tab, (entries) => {
      if (entries.length > 0) setLeaders(entries);
      else setLeaders(DEMO_LEADERS);
      setLoading(false);
    });
    const t = setTimeout(() => setLoading(false), 2000);
    return () => { unsub(); clearTimeout(t); };
  }, [tab]);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const tabCfg = GAME_TABS.find((g) => g.id === tab)!;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-black text-xl">🏆 Live Leaderboard</h2>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Real-time rankings from active games
          </p>
        </div>
        {FIREBASE_ENABLED && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            Live
          </div>
        )}
      </div>

      {/* Game tabs */}
      <div className="flex gap-2">
        {GAME_TABS.map((g) => (
          <motion.button key={g.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(g.id)}
            className="flex-1 py-2 rounded-xl font-black text-xs cursor-pointer"
            style={{
              background: tab === g.id ? `${g.color}18` : "rgba(255,255,255,0.04)",
              color: tab === g.id ? g.color : "rgba(255,255,255,0.35)",
              border: `1px solid ${tab === g.id ? `${g.color}30` : "rgba(255,255,255,0.07)"}`,
            }}>
            {g.label}
          </motion.button>
        ))}
      </div>

      {/* Podium top 3 */}
      <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-end justify-center gap-4">
          {/* 2nd */}
          <motion.div className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Avatar name={top3[1]?.name ?? "?"} size={52} />
            <p className="text-white font-black text-xs mt-2 truncate max-w-[72px] text-center">{top3[1]?.name ?? "—"}</p>
            <p className="text-[10px] mt-0.5" style={{ color: tabCfg.color }}>₹{((top3[1]?.score ?? 0) / 100).toFixed(0)}</p>
            <div className="mt-2 w-16 rounded-t-xl flex items-center justify-center py-2"
              style={{ background: "rgba(192,192,192,0.12)", border: "1px solid rgba(192,192,192,0.2)", minHeight: 64 }}>
              <span className="text-2xl">🥈</span>
            </div>
          </motion.div>

          {/* 1st */}
          <motion.div className="flex flex-col items-center -mb-0"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <motion.div
              animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <Avatar name={top3[0]?.name ?? "?"} size={68} />
            </motion.div>
            <p className="text-white font-black text-sm mt-2 truncate max-w-[80px] text-center">{top3[0]?.name ?? "—"}</p>
            <p className="text-xs mt-0.5 font-black" style={{ color: "#FFD700" }}>₹{((top3[0]?.score ?? 0) / 100).toFixed(0)}</p>
            <motion.div className="mt-2 w-20 rounded-t-xl flex items-center justify-center py-2"
              style={{ background: "rgba(255,215,0,0.10)", border: "1.5px solid rgba(255,215,0,0.3)", minHeight: 80 }}
              animate={{ boxShadow: ["0 0 0 rgba(255,215,0,0)", "0 0 20px rgba(255,215,0,0.35)", "0 0 0 rgba(255,215,0,0)"] }}
              transition={{ duration: 2, repeat: Infinity }}>
              <span className="text-3xl">🥇</span>
            </motion.div>
          </motion.div>

          {/* 3rd */}
          <motion.div className="flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Avatar name={top3[2]?.name ?? "?"} size={48} />
            <p className="text-white font-black text-xs mt-2 truncate max-w-[64px] text-center">{top3[2]?.name ?? "—"}</p>
            <p className="text-[10px] mt-0.5" style={{ color: tabCfg.color }}>₹{((top3[2]?.score ?? 0) / 100).toFixed(0)}</p>
            <div className="mt-2 w-14 rounded-t-xl flex items-center justify-center py-2"
              style={{ background: "rgba(205,127,50,0.12)", border: "1px solid rgba(205,127,50,0.2)", minHeight: 52 }}>
              <span className="text-xl">🥉</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Rank list 4–20 */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <AnimatePresence>
          {rest.map((entry, idx) => {
            const rank = idx + 4;
            return (
              <motion.div key={entry.uid} layout
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: idx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  borderBottom: idx < rest.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                <span className="text-xs font-black w-6 text-center shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                  {rank}
                </span>
                <Avatar name={entry.name} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">{entry.name}</p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {entry.gamesPlayed ?? 0} games · ₹{entry.totalWinnings ?? 0} won
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black" style={{ color: tabCfg.color }}>
                    ₹{(entry.score / 100).toFixed(0)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {loading && (
        <div className="text-center py-4 text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          Loading live rankings...
        </div>
      )}
    </div>
  );
}
