import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { subscribeLiveLeaderboard, RTDBLeaderEntry } from "@/firebase/rtdb.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const GAME_TABS = [
  { id: "ludo",     label: "🎲 Ludo",      color: "#a78bfa" },
  { id: "worldwar", label: "⚔️ World War", color: "#f97316" },
  { id: "carrom",   label: "🎯 Carrom",    color: "#ffd700" },
];

const DEMO_LEADERS: RTDBLeaderEntry[] = [
  { uid: "u1",  name: "Rahul_G",    score: 48200 },
  { uid: "u2",  name: "Priya_K",    score: 43100 },
  { uid: "u3",  name: "Amit_S",     score: 39800 },
  { uid: "u4",  name: "Dev_R",      score: 36400 },
  { uid: "u5",  name: "Sneha_M",    score: 31000 },
  { uid: "u6",  name: "Rohit_P",    score: 28700 },
  { uid: "u7",  name: "Kavya_L",    score: 26200 },
  { uid: "u8",  name: "Arjun_T",    score: 23400 },
  { uid: "u9",  name: "Meera_V",    score: 21100 },
  { uid: "u10", name: "Varun_D",    score: 18500 },
  { uid: "u11", name: "Pooja_N",    score: 16700 },
  { uid: "u12", name: "Kiran_B",    score: 14200 },
  { uid: "u13", name: "Ankit_J",    score: 12800 },
  { uid: "u14", name: "Divya_C",    score: 10400 },
  { uid: "u15", name: "Sanjay_F",   score: 8900  },
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

export default function LeaderboardScreen({ onBack }: { onBack?: () => void }) {
  const [tab, setTab]               = useState(GAME_TABS[0].id);
  const [leaders, setLeaders]       = useState<RTDBLeaderEntry[]>(DEMO_LEADERS);
  const [loading, setLoading]       = useState(FIREBASE_ENABLED);
  const [pulseCount, setPulseCount] = useState(0);

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

  // Random score pulse (demo activity)
  useEffect(() => {
    const t = setInterval(() => setPulseCount((c) => c + 1), 3500);
    return () => clearInterval(t);
  }, []);

  const top3  = leaders.slice(0, 3);
  const rest  = leaders.slice(3);
  const tabCfg = GAME_TABS.find((g) => g.id === tab)!;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0a0f", maxWidth: 480, margin: "0 auto" }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
        style={{ background: "rgba(10,10,15,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3 mb-3">
          <BackButton onBack={onBack} label="Home" />
          <div>
            <h1 className="text-white font-black text-lg leading-none">🏆 Leaderboard</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Top players this week · Live rankings</p>
          </div>
        </div>
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
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        {/* Podium top 3 */}
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-end justify-center gap-3">
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

        {/* Live badge */}
        {FIREBASE_ENABLED && (
          <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.18)", color: "#34d399" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
            Live rankings · Updates every match result
          </div>
        )}

        {/* Rank list 4–20 */}
        <div className="mx-4 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <AnimatePresence>
            {rest.map((entry, idx) => {
              const rank = idx + 4;
              const isPulse = !loading && pulseCount % rest.length === idx;
              return (
                <motion.div key={entry.uid} layout
                  className="flex items-center gap-3 px-4 py-3 relative"
                  style={{
                    background: isPulse ? "rgba(255,215,0,0.04)" : idx % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    borderBottom: idx < rest.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    transition: "background 0.4s",
                  }}>
                  <span className="text-xs font-black w-6 text-center shrink-0" style={{ color: "rgba(255,255,255,0.3)" }}>
                    {rank}
                  </span>
                  <Avatar name={entry.name} size={36} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-white truncate">{entry.name}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {Math.floor(entry.score / 2400)} games · {Math.floor(entry.score / 1800)} wins
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <motion.p className="text-sm font-black" style={{ color: tabCfg.color }}
                      animate={isPulse ? { scale: [1, 1.12, 1] } : {}} transition={{ duration: 0.5 }}>
                      ₹{(entry.score / 100).toFixed(0)}
                    </motion.p>
                    {isPulse && (
                      <motion.span className="text-[9px] font-black" style={{ color: "#34d399" }}
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                        +₹{Math.floor(Math.random() * 50 + 10)}
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* My rank card */}
        <div className="mx-4 mt-3 rounded-2xl px-4 py-4"
          style={{ background: `${tabCfg.color}0d`, border: `1.5px solid ${tabCfg.color}30` }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
              style={{ background: `${tabCfg.color}20`, color: tabCfg.color, border: `1px solid ${tabCfg.color}40` }}>
              #{Math.floor(Math.random() * 500 + 50)}
            </div>
            <Avatar name="A" size={38} />
            <div className="flex-1">
              <p className="text-white font-black text-sm">You</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Play more to climb the ranks!</p>
            </div>
            <div className="text-right">
              <p className="font-black text-sm" style={{ color: tabCfg.color }}>₹0</p>
              <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>This week</p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mx-4 mt-3">
          <motion.div whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-2xl text-center font-black text-sm cursor-pointer"
            style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)", color: "#000", boxShadow: "0 0 20px rgba(255,215,0,0.3)" }}>
            🎮 Play Now & Earn Your Rank
          </motion.div>
        </div>
      </div>
    </div>
  );
}
