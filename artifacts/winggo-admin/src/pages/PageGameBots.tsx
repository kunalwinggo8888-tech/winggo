import { useState } from "react";
import { motion } from "framer-motion";
import { FIREBASE_ENABLED } from "@/firebase/config";

const BOT_LEVELS = [
  { level: 1, label: "Beginner", winRate: "42%", avgScore: "₹1,000", color: "#94a3b8" },
  { level: 2, label: "Amateur", winRate: "54%", avgScore: "₹2,000", color: "#60a5fa" },
  { level: 3, label: "Skilled",  winRate: "66%", avgScore: "₹3,000", color: "#34d399" },
  { level: 4, label: "Expert",   winRate: "78%", avgScore: "₹4,000", color: "#f59e0b" },
  { level: 5, label: "Master",   winRate: "90%", avgScore: "₹5,000", color: "#ef4444" },
];

export default function PageGameBots() {
  const [botCount, setBotCount] = useState(10);
  const [selectedLevel, setSelectedLevel] = useState(3);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(0);

  async function handleCreateBots() {
    if (!FIREBASE_ENABLED) {
      alert("Firebase is not enabled. Bot creation requires Firebase.");
      return;
    }
    
    setCreating(true);
    try {
      // This would call the bot service to create bots
      // For now, simulate the creation
      await new Promise(resolve => setTimeout(resolve, 1500));
      setCreated(prev => prev + botCount);
      setCreating(false);
    } catch (error) {
      console.error("Failed to create bots:", error);
      setCreating(false);
      alert("Failed to create bots. Check console for details.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-white font-black text-xl">🤖 Game Bot System</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Create AI bot users to populate games and leaderboards
        </p>
      </div>

      {/* Bot level cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {BOT_LEVELS.map((level, i) => (
          <motion.div
            key={level.level}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => setSelectedLevel(level.level)}
            className="rounded-2xl p-4 cursor-pointer"
            style={{
              background: selectedLevel === level.level ? `${level.color}15` : "rgba(255,255,255,0.03)",
              border: `1.5px solid ${selectedLevel === level.level ? level.color : "rgba(255,255,255,0.1)"}`,
            }}
          >
            <div className="text-2xl mb-2">🎮</div>
            <div className="font-black text-sm" style={{ color: level.color }}>
              Level {level.level}
            </div>
            <div className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
              {level.label}
            </div>
            <div className="text-[9px] mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
              Win Rate: {level.winRate}
            </div>
            <div className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
              Avg Score: {level.avgScore}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Bot creation controls */}
      <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,215,0,0.5)" }}>
          CREATE BOT POOL
        </p>
        
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>
              Number of Bots
            </label>
            <input
              type="number"
              value={botCount}
              onChange={(e) => setBotCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              min="1"
              max="50"
              className="w-full px-4 py-3 rounded-xl text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="text-xs mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>
              Bot Level
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(parseInt(e.target.value))}
              className="w-full px-4 py-3 rounded-xl text-white outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              {BOT_LEVELS.map((level) => (
                <option key={level.level} value={level.level}>
                  Level {level.level} - {level.label}
                </option>
              ))}
            </select>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCreateBots}
            disabled={creating}
            className="px-6 py-3 rounded-xl font-black text-sm cursor-pointer disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #FFD700, #ff8c00)",
              color: "#000",
              boxShadow: "0 0 20px rgba(255,215,0,0.3)",
            }}
          >
            {creating ? "Creating..." : "🤖 Create Bots"}
          </motion.button>
        </div>

        {created > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 px-3 py-2 rounded-xl flex items-center gap-2"
            style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)" }}
          >
            <span className="text-lg">✅</span>
            <span className="text-xs font-bold" style={{ color: "#34d399" }}>
              {created} bot users created successfully
            </span>
          </motion.div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📊</span>
            <p className="text-sm font-black text-white">Bot Statistics</p>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Bots automatically play games based on their skill level. Higher level bots have better win rates and earn more points.
          </p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏆</span>
            <p className="text-sm font-black text-white">Leaderboard Impact</p>
          </div>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
            Bots appear in live leaderboards alongside real players, creating competitive environments and encouraging user engagement.
          </p>
        </div>
      </div>

      {!FIREBASE_ENABLED && (
        <div className="rounded-xl p-3 flex items-center gap-2"
          style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
          <span>⚠️</span>
          <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>
            Firebase is not enabled. Bot creation requires Firebase configuration.
          </p>
        </div>
      )}
    </div>
  );
}
