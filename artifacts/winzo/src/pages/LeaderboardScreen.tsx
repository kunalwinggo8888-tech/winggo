import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BackButton from "@/components/BackButton";
import { subscribeLeaderboard, LeaderboardEntry } from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { useAuth } from "@/context/useAuth";

// Weekly bonus rewards for top ranks
const BONUS = (rank: number) => (rank === 1 ? 20 : rank === 2 ? 15 : rank === 3 ? 10 : 2);
const RANK_COLORS = ["#FFD700", "#C0C0C0", "#cd7f32"];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function Avatar({ entry, size = 40 }: { entry?: LeaderboardEntry; size?: number }) {
  const colors = ["#7c3aed","#db2777","#0891b2","#059669","#d97706","#dc2626","#2563eb"];
  const name = entry?.username || "?";
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (entry?.photoURL) {
    return (
      <img src={entry.photoURL} alt="" className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, border: "2px solid rgba(255,255,255,0.15)" }} />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center font-black text-white shrink-0"
      style={{ width: size, height: size, background: `linear-gradient(135deg, ${color}, ${color}88)`, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </div>
  );
}

export default function LeaderboardScreen({ onBack }: { onBack?: () => void }) {
  const { user } = useAuth();
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeLeaderboard(20, (rows) => {
      setLeaders(rows);
      setLoading(false);
    });
    return unsub;
  }, []);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const myUid = user?.uid ?? "";
  const myRank = myUid ? leaders.findIndex((l) => l.uid === myUid) + 1 : 0;
  const myEntry = leaders.find((l) => l.uid === myUid);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(180deg,#0a0a16 0%,#180b2e 100%)", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{ background: "rgba(10,10,22,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 mb-3">
          <BackButton onBack={onBack} label="Home" />
          <div>
            <h1 className="text-white font-black text-lg leading-none">🏆 Leaderboard</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Top 20 players · Live rankings</p>
          </div>
        </div>
        {/* Rewards legend */}
        <div className="flex gap-1.5">
          {[
            { rank: "#1", amt: "₹20", c: "#FFD700" },
            { rank: "#2", amt: "₹15", c: "#C0C0C0" },
            { rank: "#3", amt: "₹10", c: "#cd7f32" },
            { rank: "4-20", amt: "₹2", c: "#a78bfa" },
          ].map((b) => (
            <div key={b.rank} className="flex-1 rounded-xl px-2 py-2 flex flex-col items-center"
              style={{ background: `${b.c}0d`, border: `1px solid ${b.c}22` }}>
              <span className="text-[10px] font-black" style={{ color: b.c }}>RANK {b.rank}</span>
              <span className="text-sm font-black text-white">{b.amt}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Live badge */}
        {FIREBASE_ENABLED && (
          <div className="mx-4 mt-4 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            Live · Updates automatically after every match
          </div>
        )}

        {/* Podium top 3 */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-end justify-center gap-3">
            {/* 2nd */}
            <motion.div className="flex flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Avatar entry={top3[1]} size={52} />
              <p className="text-white font-black text-xs mt-2 truncate max-w-[72px] text-center">{top3[1]?.username ?? "—"}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#C0C0C0" }}>{top3[1]?.totalPoints ?? 0} pts</p>
              <div className="mt-2 w-16 rounded-t-xl flex flex-col items-center justify-center py-1.5"
                style={{ background: "rgba(192,192,192,0.12)", border: "1px solid rgba(192,192,192,0.2)", minHeight: 64 }}>
                <span className="text-2xl">🥈</span>
                <span className="text-[10px] font-black text-white mt-0.5">₹15</span>
              </div>
            </motion.div>

            {/* 1st */}
            <motion.div className="flex flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
                <Avatar entry={top3[0]} size={68} />
              </motion.div>
              <p className="text-white font-black text-sm mt-2 truncate max-w-[80px] text-center">{top3[0]?.username ?? "—"}</p>
              <p className="text-xs mt-0.5 font-black" style={{ color: "#FFD700" }}>{top3[0]?.totalPoints ?? 0} pts</p>
              <motion.div className="mt-2 w-20 rounded-t-xl flex flex-col items-center justify-center py-1.5"
                style={{ background: "rgba(255,215,0,0.10)", border: "1.5px solid rgba(255,215,0,0.3)", minHeight: 80 }}
                animate={{ boxShadow: ["0 0 0 rgba(255,215,0,0)", "0 0 20px rgba(255,215,0,0.35)", "0 0 0 rgba(255,215,0,0)"] }}
                transition={{ duration: 2, repeat: Infinity }}>
                <span className="text-3xl">🥇</span>
                <span className="text-xs font-black mt-0.5" style={{ color: "#FFD700" }}>₹20</span>
              </motion.div>
            </motion.div>

            {/* 3rd */}
            <motion.div className="flex flex-col items-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Avatar entry={top3[2]} size={48} />
              <p className="text-white font-black text-xs mt-2 truncate max-w-[64px] text-center">{top3[2]?.username ?? "—"}</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#cd7f32" }}>{top3[2]?.totalPoints ?? 0} pts</p>
              <div className="mt-2 w-14 rounded-t-xl flex flex-col items-center justify-center py-1.5"
                style={{ background: "rgba(205,127,50,0.12)", border: "1px solid rgba(205,127,50,0.2)", minHeight: 52 }}>
                <span className="text-xl">🥉</span>
                <span className="text-[10px] font-black text-white mt-0.5">₹10</span>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Rank list 4–20 */}
        <div className="mx-4 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {rest.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Play matches to climb the leaderboard! 🚀
            </div>
          )}
          {rest.map((entry, idx) => {
            const rank = idx + 4;
            const isMe = entry.uid === myUid;
            return (
              <motion.div key={entry.uid} layout
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: isMe ? "rgba(167,139,250,0.14)" : idx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                  borderBottom: idx < rest.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  borderLeft: isMe ? "3px solid #a78bfa" : "3px solid transparent",
                }}>
                <span className="text-xs font-black w-6 text-center shrink-0" style={{ color: isMe ? "#a78bfa" : "rgba(255,255,255,0.3)" }}>
                  {rank}
                </span>
                <Avatar entry={entry} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate">
                    {entry.username}{isMe ? " (You)" : ""}
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {entry.totalPoints} total points
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-white">{entry.totalPoints}</p>
                  <p className="text-[10px] font-black" style={{ color: "#4ade80" }}>+₹{BONUS(rank)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* My rank card (live) */}
        <div className="mx-4 mt-3 rounded-2xl px-4 py-4"
          style={{ background: "rgba(167,139,250,0.08)", border: "1.5px solid rgba(167,139,250,0.25)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: "rgba(167,139,250,0.18)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.35)" }}>
              {myRank > 0 ? `#${myRank}` : "#—"}
            </div>
            <Avatar entry={{ username: user?.displayName || "You", photoURL: user?.photoURL || "" } as LeaderboardEntry} size={40} />
            <div className="flex-1">
              <p className="text-white font-black text-sm">{user?.displayName || "You"}</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
                {myRank > 0 ? `Rank ${myRank} · Live` : "Play a match to appear here"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-black text-sm text-white">{myEntry?.totalPoints ?? 0}</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>points</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-4 mt-3">
          <motion.button whileTap={{ scale: 0.98 }} onClick={onBack}
            className="w-full py-3.5 rounded-2xl text-center font-black text-sm cursor-pointer"
            style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)", color: "#000", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}>
            🎮 Play Now & Earn Your Rank
          </motion.button>
        </div>
      </div>
    </div>
  );
}
