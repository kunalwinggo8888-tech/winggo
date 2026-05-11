import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { useWallet } from "@/context/useWallet";

// ─── TYPES ────────────────────────────────────────────────────
type Phase = "lobby" | "matchmaking" | "battle" | "result";
type Team  = "virat" | "dhoni";

interface FloatScore { id: number; value: number }
interface LeaderEntry { name: string; score: number; team: Team; isMe?: boolean }

interface BattleRoom {
  id: string;
  duration: number;      // minutes
  label: string;         // "1 MIN BATTLE"
  teamA: string;
  teamB: string;
  teamAColor: string;
  teamBColor: string;
  teamAEmoji: string;
  teamBEmoji: string;
  entryFee: number;
  prizePool: number;
  players: number;
  maxPlayers: number;
  liveCountdown: number; // seconds until next round
  hotness: "hot" | "live" | "filling";
}

// ─── CONSTANTS ────────────────────────────────────────────────
const BATTLE_DURATION_SECS = 120;

const TEAM_CFG: Record<Team, { name: string; color: string; bg: string; glow: string; emoji: string; title: string }> = {
  virat: { name: "VIRAT XI", color: "#3b82f6", bg: "rgba(59,130,246,0.18)", glow: "rgba(59,130,246,0.6)", emoji: "🔵", title: "Blue Brigade" },
  dhoni: { name: "DHONI XI", color: "#f59e0b", bg: "rgba(245,158,11,0.18)",  glow: "rgba(245,158,11,0.6)",  emoji: "🟡", title: "Yellow Warriors" },
};

const FAKE_NAMES = ["Rahul_G","Priya_K","Amit_S","Dev_R","Sneha_M","Rohit_P","Kavya_L","Arjun_T","Meera_V","Varun_D","Pooja_N","Kiran_B","Ankit_J","Divya_C","Sanjay_F"];

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function buildLeaderboard(team: Team, myScore: number): LeaderEntry[] {
  const entries: LeaderEntry[] = [
    { name: "You", score: myScore, team, isMe: true },
    ...FAKE_NAMES.slice(0, 9).map((name, i) => ({
      name, score: Math.max(0, myScore + rnd(-80, 80) - i * 5),
      team: (i % 3 === 0 ? (team === "virat" ? "dhoni" : "virat") : team) as Team,
    })),
  ];
  return entries.sort((a, b) => b.score - a.score);
}

const INITIAL_ROOMS: BattleRoom[] = [
  { id: "r1", duration: 1, label: "1 MIN BATTLE",    teamA: "VIRAT XI", teamB: "DHONI XI", teamAColor: "#3b82f6", teamBColor: "#f59e0b", teamAEmoji: "🔵", teamBEmoji: "🟡", entryFee: 10,  prizePool: 180,   players: 34, maxPlayers: 50,  liveCountdown: 42,  hotness: "hot"    },
  { id: "r2", duration: 5, label: "5 MIN WORLD WAR", teamA: "VIRAT XI", teamB: "DHONI XI", teamAColor: "#3b82f6", teamBColor: "#f59e0b", teamAEmoji: "🔵", teamBEmoji: "🟡", entryFee: 50,  prizePool: 900,   players: 18, maxPlayers: 30,  liveCountdown: 118, hotness: "live"   },
  { id: "r3", duration: 1, label: "1 MIN BATTLE",    teamA: "VIRAT XI", teamB: "DHONI XI", teamAColor: "#3b82f6", teamBColor: "#f59e0b", teamAEmoji: "🔵", teamBEmoji: "🟡", entryFee: 20,  prizePool: 360,   players: 47, maxPlayers: 50,  liveCountdown: 11,  hotness: "hot"    },
  { id: "r4", duration: 10,label: "10 MIN CLASH",    teamA: "VIRAT XI", teamB: "DHONI XI", teamAColor: "#3b82f6", teamBColor: "#f59e0b", teamAEmoji: "🔵", teamBEmoji: "🟡", entryFee: 100, prizePool: 1800,  players: 12, maxPlayers: 20,  liveCountdown: 210, hotness: "filling"},
  { id: "r5", duration: 5, label: "5 MIN WORLD WAR", teamA: "VIRAT XI", teamB: "DHONI XI", teamAColor: "#3b82f6", teamBColor: "#f59e0b", teamAEmoji: "🔵", teamBEmoji: "🟡", entryFee: 200, prizePool: 3600,  players: 7,  maxPlayers: 20,  liveCountdown: 340, hotness: "filling"},
  { id: "r6", duration: 1, label: "1 MIN BATTLE",    teamA: "VIRAT XI", teamB: "DHONI XI", teamAColor: "#3b82f6", teamBColor: "#f59e0b", teamAEmoji: "🔵", teamBEmoji: "🟡", entryFee: 5,   prizePool: 90,    players: 28, maxPlayers: 50,  liveCountdown: 67,  hotness: "live"   },
];

// ─── ROOT ─────────────────────────────────────────────────────
export default function WorldWarGame({ onBack }: { onBack?: () => void }) {
  const [phase, setPhase]       = useState<Phase>("lobby");
  const [team, setTeam]         = useState<Team>("virat");
  const [entryFee, setEntryFee] = useState(50);
  const { deductFee }           = useWallet();

  function joinRoom(room: BattleRoom, chosenTeam: Team) {
    setEntryFee(room.entryFee);
    setTeam(chosenTeam);
    deductFee(room.entryFee, `World War Entry ₹${room.entryFee}`);
    setPhase("matchmaking");
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}>
      <AnimatePresence mode="wait">
        {phase === "lobby" && (
          <LobbyPhase key="lobby" onBack={onBack} onJoin={joinRoom} />
        )}
        {phase === "matchmaking" && (
          <MatchmakingPhase key="matchmaking" team={team} entryFee={entryFee} onReady={() => setPhase("battle")} />
        )}
        {phase === "battle" && (
          <BattlePhase key="battle" team={team} entryFee={entryFee} onResult={() => setPhase("result")} />
        )}
        {phase === "result" && (
          <ResultPhase key="result" team={team} entryFee={entryFee} onPlayAgain={() => setPhase("lobby")} onBack={onBack} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LOBBY — premium WinZO-style battle list ──────────────────
function LobbyPhase({ onBack, onJoin }: {
  onBack?: () => void;
  onJoin: (room: BattleRoom, team: Team) => void;
}) {
  const [rooms, setRooms]         = useState<BattleRoom[]>(INITIAL_ROOMS);
  const [totalPlayers, setTotal]  = useState(rnd(9800, 10400));
  const [pickingRoom, setPickingRoom] = useState<BattleRoom | null>(null);
  const [pickedTeam, setPickedTeam]   = useState<Team>("virat");

  // Countdown all rooms every second
  useEffect(() => {
    const t = setInterval(() => {
      setRooms((prev) => prev.map((r) => {
        const next = r.liveCountdown - 1;
        return next <= 0
          ? { ...r, liveCountdown: r.duration * 60, players: Math.max(1, r.players - rnd(0, 3)) }
          : { ...r, liveCountdown: next, players: Math.min(r.maxPlayers, r.players + (Math.random() > 0.6 ? 1 : 0)) };
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Total players drift
  useEffect(() => {
    const t = setInterval(() => setTotal((n) => n + rnd(-8, 14)), 3000);
    return () => clearInterval(t);
  }, []);

  function fmtCountdown(s: number) {
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `0:${sec.toString().padStart(2, "0")}`;
  }

  const HOTNESS_CFG = {
    hot:     { label: "🔥 HOT",  bg: "rgba(239,68,68,0.15)",   color: "#f87171", border: "rgba(239,68,68,0.35)" },
    live:    { label: "🔴 LIVE", bg: "rgba(231,76,60,0.15)",   color: "#e74c3c", border: "rgba(231,76,60,0.35)" },
    filling: { label: "⚡ FAST", bg: "rgba(245,158,11,0.15)",  color: "#f59e0b", border: "rgba(245,158,11,0.35)" },
  };

  const DURATION_COLORS: Record<number, { bg: string; color: string; border: string }> = {
    1:  { bg: "rgba(239,68,68,0.20)",   color: "#f87171", border: "#f8717150" },
    5:  { bg: "rgba(99,102,241,0.20)",  color: "#818cf8", border: "#818cf850" },
    10: { bg: "rgba(245,158,11,0.20)",  color: "#f59e0b", border: "#f59e0b50" },
  };

  return (
    <motion.div className="flex flex-col h-full"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* ══════ HERO BANNER ══════ */}
      <div className="relative shrink-0 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #06001a 0%, #0a0030 40%, #1a0600 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          minHeight: 220,
        }}>

        {/* Background neon orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div className="absolute w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 65%)", top: "-20%", left: "-10%" }}
            animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 4, repeat: Infinity }} />
          <motion.div className="absolute w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(245,158,11,0.22) 0%, transparent 65%)", top: "-20%", right: "-10%" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 3.5, repeat: Infinity, delay: 0.8 }} />
          {/* Particle sparks */}
          {Array.from({ length: 14 }, (_, i) => (
            <motion.div key={i} className="absolute rounded-full"
              style={{ width: rnd(2, 5), height: rnd(2, 5), left: `${rnd(5, 95)}%`, top: `${rnd(10, 85)}%`,
                background: i % 2 === 0 ? "#3b82f6" : "#f59e0b",
                boxShadow: i % 2 === 0 ? "0 0 4px #3b82f6" : "0 0 4px #f59e0b" }}
              animate={{ opacity: [0, 1, 0], y: [0, -30] }}
              transition={{ duration: 1.2 + Math.random(), delay: Math.random() * 2, repeat: Infinity }} />
          ))}
          {/* Center lightning */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div className="text-5xl" animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 1.6, repeat: Infinity }}>⚡</motion.div>
          </div>
        </div>

        {/* Back button */}
        <div className="absolute top-4 left-4 z-20">
          <BackButton onBack={onBack} label="Home" />
        </div>

        {/* Live + players badge */}
        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
          <motion.div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black"
            style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
            animate={{ opacity: [1, 0.6, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            LIVE
          </motion.div>
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            👥 {totalPlayers.toLocaleString("en-IN")} playing
          </div>
        </div>

        {/* WORLD WAR title */}
        <div className="flex flex-col items-center pt-10 pb-2 px-4 relative z-10">
          <motion.div className="text-center"
            animate={{ textShadow: ["0 0 20px rgba(124,58,237,0.5)", "0 0 40px rgba(124,58,237,0.9)", "0 0 20px rgba(124,58,237,0.5)"] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <div className="text-[10px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              WINGGO PRESENTS
            </div>
            <h1 className="text-4xl font-black tracking-tight leading-none text-white"
              style={{ textShadow: "0 0 30px rgba(124,58,237,0.7), 0 0 60px rgba(124,58,237,0.4)" }}>
              WORLD
            </h1>
            <h1 className="text-4xl font-black tracking-tight leading-none"
              style={{ color: "#FFD700", textShadow: "0 0 30px rgba(255,215,0,0.7), 0 0 60px rgba(255,215,0,0.4)" }}>
              WAR ⚔️
            </h1>
          </motion.div>

          {/* Team vs Team banner */}
          <div className="flex items-center justify-center gap-4 mt-4 w-full">
            {/* Blue team */}
            <motion.div className="flex flex-col items-center gap-1.5"
              animate={{ x: [0, -3, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(59,130,246,0.2)", border: "2px solid rgba(59,130,246,0.5)", boxShadow: "0 0 20px rgba(59,130,246,0.4)" }}>
                🔵
              </div>
              <span className="text-[11px] font-black" style={{ color: "#60a5fa" }}>VIRAT XI</span>
            </motion.div>

            {/* VS center */}
            <div className="flex flex-col items-center">
              <motion.div className="text-xl font-black text-white"
                style={{ textShadow: "0 0 15px rgba(255,215,0,0.8)" }}
                animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                VS
              </motion.div>
              <motion.div className="text-2xl"
                animate={{ opacity: [0.6, 1, 0.6], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 0.8, repeat: Infinity }}>
                🔥
              </motion.div>
            </div>

            {/* Yellow team */}
            <motion.div className="flex flex-col items-center gap-1.5"
              animate={{ x: [0, 3, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(245,158,11,0.2)", border: "2px solid rgba(245,158,11,0.5)", boxShadow: "0 0 20px rgba(245,158,11,0.4)" }}>
                🟡
              </div>
              <span className="text-[11px] font-black" style={{ color: "#fbbf24" }}>DHONI XI</span>
            </motion.div>
          </div>

          {/* PLAY NOW CTA */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { const firstRoom = INITIAL_ROOMS[1]; setPickingRoom(firstRoom); setPickedTeam("virat"); }}
            className="mt-4 px-10 py-3 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 50%, #2563eb 100%)",
              boxShadow: "0 0 30px rgba(124,58,237,0.6), 0 0 60px rgba(124,58,237,0.3)",
              color: "#fff",
              letterSpacing: "0.06em",
            }}
            animate={{ boxShadow: [
              "0 0 20px rgba(124,58,237,0.5), 0 0 40px rgba(124,58,237,0.2)",
              "0 0 40px rgba(124,58,237,0.8), 0 0 70px rgba(124,58,237,0.4)",
              "0 0 20px rgba(124,58,237,0.5), 0 0 40px rgba(124,58,237,0.2)",
            ] }}
            transition={{ duration: 1.8, repeat: Infinity }}>
            {/* shimmer */}
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)" }}
              animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }} />
            ⚔️ PLAY NOW
          </motion.button>
        </div>
      </div>

      {/* ══════ LIVE BATTLES SECTION ══════ */}
      <div className="flex-1 overflow-y-auto">
        {/* Section header */}
        <div className="flex items-center justify-between px-4 py-3 sticky top-0 z-10"
          style={{ background: "rgba(7,5,15,0.95)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
            <span className="text-sm font-black text-white">LIVE BATTLES</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
            {rooms.length} ROOMS
          </span>
        </div>

        {/* Battle cards */}
        <div className="px-3 py-3 space-y-3 pb-8">
          {rooms.map((room, idx) => {
            const durCfg = DURATION_COLORS[room.duration] ?? DURATION_COLORS[1];
            const hotCfg = HOTNESS_CFG[room.hotness];
            const fillPct = Math.round((room.players / room.maxPlayers) * 100);
            const timeStr = fmtCountdown(room.liveCountdown);
            const isUrgent = room.liveCountdown <= 15;

            return (
              <motion.div key={room.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.06 }}
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isUrgent ? "0 0 20px rgba(239,68,68,0.15)" : "none",
                }}>

                {/* Top glow line */}
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: `linear-gradient(90deg, transparent, ${room.teamAColor}60, ${room.teamBColor}60, transparent)` }} />

                <div className="flex items-center p-3 gap-2">

                  {/* ── LEFT: Duration badge ── */}
                  <div className="flex flex-col items-center justify-center rounded-xl px-2 py-3 shrink-0"
                    style={{ background: durCfg.bg, border: `1.5px solid ${durCfg.border}`, minWidth: 64 }}>
                    <span className="text-lg font-black leading-none" style={{ color: durCfg.color }}>
                      {room.duration}
                    </span>
                    <span className="text-[9px] font-black uppercase" style={{ color: durCfg.color }}>MIN</span>
                    <div className="mt-1.5 h-px w-full" style={{ background: `${durCfg.color}50` }} />
                    {/* Countdown */}
                    <motion.span className="text-[10px] font-black mt-1.5 tabular-nums"
                      style={{ color: isUrgent ? "#f87171" : "rgba(255,255,255,0.5)" }}
                      animate={isUrgent ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 0.5, repeat: Infinity }}>
                      {timeStr}
                    </motion.span>
                    <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.25)" }}>STARTS</span>
                  </div>

                  {/* ── CENTER: Teams + VS ── */}
                  <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                    {/* Teams row */}
                    <div className="flex items-center gap-2 w-full justify-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                          style={{ background: `${room.teamAColor}22`, border: `1.5px solid ${room.teamAColor}50`, boxShadow: `0 0 10px ${room.teamAColor}30` }}>
                          {room.teamAEmoji}
                        </div>
                        <span className="text-[8px] font-black" style={{ color: room.teamAColor }}>{room.teamA}</span>
                      </div>

                      {/* VS fire */}
                      <div className="flex flex-col items-center">
                        <motion.div className="text-xs font-black"
                          style={{ color: "#FFD700", textShadow: "0 0 8px rgba(255,215,0,0.7)" }}
                          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>
                          VS
                        </motion.div>
                        <motion.div className="text-base"
                          animate={{ scale: [0.9, 1.15, 0.9], opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 0.7, repeat: Infinity }}>
                          🔥
                        </motion.div>
                      </div>

                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
                          style={{ background: `${room.teamBColor}22`, border: `1.5px solid ${room.teamBColor}50`, boxShadow: `0 0 10px ${room.teamBColor}30` }}>
                          {room.teamBEmoji}
                        </div>
                        <span className="text-[8px] font-black" style={{ color: room.teamBColor }}>{room.teamB}</span>
                      </div>
                    </div>

                    {/* Title label */}
                    <span className="text-[10px] font-black tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {room.label}
                    </span>

                    {/* Player fill bar + count */}
                    <div className="w-full">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${room.teamAColor}, ${room.teamBColor})` }}
                          animate={{ width: `${fillPct}%` }} transition={{ duration: 0.6 }} />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          👥 {room.players}/{room.maxPlayers} players
                        </span>
                        {/* Hotness badge */}
                        <motion.span className="text-[9px] font-black px-1.5 py-px rounded-full"
                          style={{ background: hotCfg.bg, color: hotCfg.color, border: `1px solid ${hotCfg.border}` }}
                          animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.1, repeat: Infinity }}>
                          {hotCfg.label}
                        </motion.span>
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT: Prize + Entry + Join ── */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    {/* Prize pool */}
                    <div className="flex flex-col items-center px-2 py-1.5 rounded-xl"
                      style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                      <span className="text-[8px] font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>🏆 PRIZE</span>
                      <span className="text-sm font-black leading-tight" style={{ color: "#FFD700" }}>
                        ₹{room.prizePool >= 1000 ? `${(room.prizePool / 1000).toFixed(1)}K` : room.prizePool}
                      </span>
                    </div>

                    {/* Entry fee */}
                    <div className="text-center">
                      <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>Entry</span>
                      <div className="text-xs font-black text-white">₹{room.entryFee}</div>
                    </div>

                    {/* JOIN NOW button */}
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => { setPickingRoom(room); setPickedTeam("virat"); }}
                      className="px-3 py-2 rounded-xl font-black text-[11px] cursor-pointer"
                      style={{
                        background: "linear-gradient(135deg, #16a34a, #15803d)",
                        color: "#fff",
                        boxShadow: "0 0 12px rgba(22,163,74,0.5)",
                        whiteSpace: "nowrap",
                        letterSpacing: "0.02em",
                      }}>
                      JOIN NOW
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ══════ TEAM PICKER SHEET ══════ */}
      <AnimatePresence>
        {pickingRoom && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPickingRoom(null)}>
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
              className="w-full rounded-t-3xl overflow-hidden"
              style={{ background: "#0f0a1e", border: "1px solid rgba(255,215,0,0.2)", maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}>

              {/* Sheet handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              </div>

              <div className="px-5 pb-6 pt-2">
                {/* Room info */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-black text-white text-lg">{pickingRoom.label}</h3>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Prize Pool <span style={{ color: "#FFD700" }}>₹{pickingRoom.prizePool.toLocaleString("en-IN")}</span> · Entry ₹{pickingRoom.entryFee}
                    </p>
                  </div>
                  <button onClick={() => setPickingRoom(null)} className="text-xl cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>✕</button>
                </div>

                <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,215,0,0.5)" }}>
                  ⚔️ Choose Your Team
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {(["virat", "dhoni"] as Team[]).map((t) => {
                    const tc = TEAM_CFG[t];
                    const active = pickedTeam === t;
                    return (
                      <motion.button key={t} whileTap={{ scale: 0.94 }} onClick={() => setPickedTeam(t)}
                        className="flex flex-col items-center gap-2 py-4 rounded-2xl cursor-pointer"
                        style={{
                          background: active ? tc.bg : "rgba(255,255,255,0.04)",
                          border: active ? `2px solid ${tc.color}` : "1px solid rgba(255,255,255,0.1)",
                          boxShadow: active ? `0 0 20px ${tc.glow}` : "none",
                          transition: "all 0.18s",
                        }}>
                        <span className="text-4xl">{tc.emoji}</span>
                        <span className="font-black text-sm" style={{ color: active ? tc.color : "rgba(255,255,255,0.5)" }}>
                          {tc.name}
                        </span>
                        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>{tc.title}</span>
                        {active && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: tc.color, color: "#000" }}>
                            ✔ SELECTED
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => { if (pickingRoom) { onJoin(pickingRoom, pickedTeam); setPickingRoom(null); } }}
                  className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${TEAM_CFG[pickedTeam].color}, ${pickedTeam === "virat" ? "#1d4ed8" : "#d97706"})`,
                    color: "#fff",
                    boxShadow: `0 0 28px ${TEAM_CFG[pickedTeam].glow}`,
                    letterSpacing: "0.06em",
                  }}>
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)" }}
                    animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }} />
                  ⚔️ JOIN BATTLE — ₹{pickingRoom?.entryFee}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── MATCHMAKING ──────────────────────────────────────────────
function MatchmakingPhase({ team, entryFee, onReady }: { team: Team; entryFee: number; onReady: () => void }) {
  const [filled, setFilled]       = useState(4);
  const [countdown, setCountdown] = useState<number | null>(null);
  const tw = TEAM_CFG[team];

  const karanPlayers = ["You", ...FAKE_NAMES.slice(0, 4)];
  const arjunPlayers = FAKE_NAMES.slice(5, 10);

  useEffect(() => {
    if (filled >= 10) { setCountdown(3); return; }
    const t = setTimeout(() => setFilled((f) => f + rnd(1, 2)), rnd(400, 900));
    return () => clearTimeout(t);
  }, [filled]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { onReady(); return; }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onReady]);

  const showFull = filled >= 10;

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-6 px-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: "linear-gradient(160deg, #06001a 0%, #07050f 100%)" }}>

      <div className="text-center">
        <motion.div className="text-3xl font-black text-white" animate={{ scale: [1, 1.03, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          ⚔️ WORLD WAR
        </motion.div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,215,0,0.6)" }}>Finding opponents…</p>
      </div>

      <div className="text-xs font-bold px-4 py-1.5 rounded-full"
        style={{ background: "rgba(255,215,0,0.09)", border: "1px solid rgba(255,215,0,0.25)", color: "#FFD700" }}>
        Entry ₹{entryFee}
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        {[
          { cfg: TEAM_CFG.virat, players: karanPlayers },
          { cfg: TEAM_CFG.dhoni, players: arjunPlayers },
        ].map(({ cfg, players }) => (
          <div key={cfg.name} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${cfg.color}55` }}>
            <div className="text-center py-2 text-xs font-black" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.emoji} {cfg.name}
            </div>
            <div className="py-2 px-3 space-y-1.5">
              {players.slice(0, Math.min(5, Math.ceil(filled / 2))).map((name, i) => (
                <motion.div key={name} initial={{ opacity: 0, x: cfg === TEAM_CFG.virat ? -10 : 10 }}
                  animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-black text-white"
                    style={{ background: cfg.color }}>{name[0]}</div>
                  <span className="text-xs font-bold" style={{ color: name === "You" ? "#FFD700" : "rgba(255,255,255,0.55)" }}>{name}</span>
                  {name === "You" && <span className="text-xs ml-auto" style={{ color: cfg.color }}>👑</span>}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        {!showFull ? (
          <>
            <div className="text-sm font-bold text-white">
              Filling room<motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>…</motion.span>
            </div>
            <div className="mt-3 w-48 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${TEAM_CFG.virat.color}, ${TEAM_CFG.dhoni.color})` }}
                animate={{ width: `${(filled / 10) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }} />
            </div>
            <div className="text-xs mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>{filled}/10 players ready</div>
          </>
        ) : (
          <>
            <motion.div className="text-xl font-black text-white" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              Room Full! 🎯
            </motion.div>
            <motion.div className="text-5xl font-black mt-2"
              style={{ color: "#FFD700", textShadow: "0 0 20px rgba(255,215,0,0.6)" }}
              animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>
              {countdown ?? 0}
            </motion.div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Battle starts in {countdown}s</div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── BATTLE ───────────────────────────────────────────────────
function BattlePhase({ team, entryFee, onResult }: { team: Team; entryFee: number; onResult: () => void }) {
  const tw = TEAM_CFG[team];
  const ot = TEAM_CFG[team === "virat" ? "dhoni" : "virat"];

  const [timer, setTimer]           = useState(BATTLE_DURATION_SECS);
  const [myScore, setMyScore]       = useState(0);
  const [karanScore, setKaranScore] = useState(0);
  const [arjunScore, setArjunScore] = useState(0);
  const [combo, setCombo]           = useState(1);
  const [comboTimer, setComboTimer] = useState(0);
  const [floats, setFloats]         = useState<FloatScore[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>(() => buildLeaderboard(team, 0));
  const [tapping, setTapping]       = useState(false);

  const nextId    = useRef(1);
  const myRef     = useRef(0);
  const karanRef  = useRef(0);
  const arjunRef  = useRef(0);
  const comboRef  = useRef(1);
  const overRef   = useRef(false);

  useEffect(() => {
    if (overRef.current) return;
    if (timer <= 0) { overRef.current = true; setTimeout(onResult, 1800); return; }
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, onResult]);

  useEffect(() => {
    const t = setInterval(() => {
      if (overRef.current) return;
      karanRef.current += rnd(2, 6); setKaranScore(karanRef.current);
      arjunRef.current += rnd(2, 6); setArjunScore(arjunRef.current);
      setLeaderboard(buildLeaderboard(team, myRef.current));
    }, 800);
    return () => clearInterval(t);
  }, [team]);

  useEffect(() => {
    if (comboTimer <= 0) { comboRef.current = 1; setCombo(1); return; }
    const t = setTimeout(() => setComboTimer((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [comboTimer]);

  const addFloat = useCallback((val: number) => {
    const id = nextId.current++;
    setFloats((prev) => [...prev, { id, value: val }]);
    setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 900);
  }, []);

  const handleTap = useCallback(() => {
    if (overRef.current) return;
    const pts = rnd(3, 7) * comboRef.current;
    myRef.current += pts; setMyScore(myRef.current);
    if (team === "virat") { karanRef.current += pts; setKaranScore(karanRef.current); }
    else                  { arjunRef.current += pts; setArjunScore(arjunRef.current); }
    addFloat(pts);
    setTapping(true);
    setTimeout(() => setTapping(false), 120);
    const newCombo = Math.min(comboRef.current + 1, 5);
    comboRef.current = newCombo; setCombo(newCombo); setComboTimer(2);
    setLeaderboard(buildLeaderboard(team, myRef.current));
  }, [addFloat, team]);

  const mm = Math.floor(timer / 60).toString().padStart(2, "0");
  const ss = (timer % 60).toString().padStart(2, "0");
  const timerColor = timer <= 30 ? "#e74c3c" : timer <= 60 ? "#f39c12" : "#FFD700";
  const total   = karanScore + arjunScore + 1;
  const kPct    = (karanScore / total) * 100;
  const aPct    = (arjunScore / total) * 100;
  const leading = karanScore >= arjunScore ? "virat" : "dhoni";

  return (
    <motion.div className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Timer row */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>Entry ₹{entryFee}</div>
        <motion.div className="font-black text-xl tabular-nums"
          style={{ color: timerColor, textShadow: `0 0 10px ${timerColor}88` }}
          animate={timer <= 10 ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
          ⏱ {mm}:{ss}
        </motion.div>
        <div className="text-xs font-bold" style={{ color: "#FFD700" }}>My: {myScore} pts</div>
      </div>

      {/* Team score bar */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex items-center justify-between mb-1.5 text-xs font-black">
          <span style={{ color: TEAM_CFG.virat.color }}>{TEAM_CFG.virat.emoji} {karanScore}</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>{TEAM_CFG[leading].name} LEADING</span>
          <span style={{ color: TEAM_CFG.dhoni.color }}>{arjunScore} {TEAM_CFG.dhoni.emoji}</span>
        </div>
        <div className="flex h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <motion.div className="h-full" style={{ background: TEAM_CFG.virat.color }}
            animate={{ width: `${kPct}%` }} transition={{ type: "spring", stiffness: 80, damping: 14 }} />
          <motion.div className="h-full" style={{ background: TEAM_CFG.dhoni.color }}
            animate={{ width: `${aPct}%` }} transition={{ type: "spring", stiffness: 80, damping: 14 }} />
        </div>
      </div>

      {/* Battle arena */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4 gap-4">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${tw.bg} 0%, #07050f 65%)` }} />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <AnimatePresence>
            {floats.map((f) => (
              <motion.div key={f.id} className="absolute font-black text-2xl"
                style={{ color: tw.color, textShadow: `0 0 10px ${tw.color}` }}
                initial={{ y: 0, opacity: 1, scale: 1 }} animate={{ y: -80, opacity: 0, scale: 1.6 }} transition={{ duration: 0.85 }}>
                +{f.value}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Warrior */}
        <motion.button className="relative z-10 flex flex-col items-center gap-2 cursor-pointer"
          animate={tapping ? { scale: [1, 0.93, 1] } : {}} transition={{ duration: 0.12 }}
          onPointerDown={handleTap}>
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
            style={{ background: tw.bg, border: `2px solid ${tw.color}`, boxShadow: `0 0 28px ${tw.glow}, 0 0 56px ${tw.glow}44` }}
            animate={{ scale: tapping ? 0.92 : 1 }} transition={{ duration: 0.1 }}>
            {tw.emoji}
          </motion.div>
          <span className="font-black text-lg" style={{ color: tw.color }}>{tw.name}</span>
        </motion.button>

        {combo > 1 && (
          <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="px-4 py-1.5 rounded-xl font-black text-sm"
            style={{ background: `${tw.color}22`, border: `1px solid ${tw.color}55`, color: tw.color }}>
            🔥 x{combo} COMBO!
          </motion.div>
        )}

        <p className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>TAP {tw.emoji} TO SCORE POINTS</p>

        {/* Leaderboard mini */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-3 py-2 text-xs font-black" style={{ background: "rgba(255,215,0,0.07)", color: "rgba(255,215,0,0.7)" }}>
            🏆 LIVE LEADERBOARD
          </div>
          {leaderboard.slice(0, 5).map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-2 px-3 py-1.5"
              style={{ background: entry.isMe ? `${tw.bg}` : i % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
              <span className="text-xs font-black w-4" style={{ color: i < 3 ? ["#FFD700","#C0C0C0","#CD7F32"][i] : "rgba(255,255,255,0.3)" }}>{i + 1}</span>
              <span className="flex-1 text-xs font-bold truncate" style={{ color: entry.isMe ? tw.color : "rgba(255,255,255,0.6)" }}>
                {entry.isMe ? "⭐ " : ""}{entry.name}
              </span>
              <span className="text-xs font-black" style={{ color: TEAM_CFG[entry.team].color }}>{entry.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Opponents row */}
      <div className="px-4 pb-4 pt-1 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: `${ot.bg}`, border: `1px solid ${ot.color}33` }}>
          <span>{ot.emoji}</span>
          <span className="text-xs font-bold flex-1" style={{ color: ot.color }}>{ot.name} Opponents</span>
          <span className="text-xs font-black text-white">{team === "virat" ? arjunScore : karanScore} pts</span>
        </div>
      </div>
    </motion.div>
  );
}

// ─── RESULT ───────────────────────────────────────────────────
function ResultPhase({ team, entryFee, onPlayAgain, onBack }: { team: Team; entryFee: number; onPlayAgain: () => void; onBack?: () => void }) {
  const won = Math.random() > 0.45;
  const prize = won ? Math.round(entryFee * 1.8) : 0;
  const tw = TEAM_CFG[team];

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-5 px-5"
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      style={{ background: "linear-gradient(160deg, #06001a 0%, #07050f 100%)" }}>

      <motion.div className="text-7xl" animate={{ scale: [1, 1.12, 1], rotate: won ? [0, 5, -5, 0] : [0] }}
        transition={{ duration: 0.6, repeat: 3 }}>
        {won ? "🏆" : "💔"}
      </motion.div>

      <div className="text-center">
        <div className="text-3xl font-black" style={{ color: won ? "#FFD700" : "#f87171" }}>
          {won ? "VICTORY!" : "DEFEAT"}
        </div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
          {tw.name} {won ? "won the battle! 🎉" : "fought bravely"}
        </div>
      </div>

      {won && (
        <motion.div className="px-8 py-4 rounded-2xl text-center"
          style={{ background: "rgba(255,215,0,0.1)", border: "2px solid rgba(255,215,0,0.4)", boxShadow: "0 0 30px rgba(255,215,0,0.25)" }}
          animate={{ boxShadow: ["0 0 20px rgba(255,215,0,0.2)", "0 0 40px rgba(255,215,0,0.5)", "0 0 20px rgba(255,215,0,0.2)"] }}
          transition={{ duration: 1.5, repeat: Infinity }}>
          <div className="text-xs font-bold mb-1" style={{ color: "rgba(255,215,0,0.6)" }}>💰 YOU WON</div>
          <div className="text-4xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Added to your wallet</div>
        </motion.div>
      )}

      <div className="w-full space-y-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{ background: `linear-gradient(135deg, ${tw.color}, ${team === "virat" ? "#1d4ed8" : "#d97706"})`, color: "#fff", boxShadow: `0 0 24px ${tw.glow}` }}>
          ⚔️ PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onBack}
          className="w-full py-3 rounded-2xl font-black text-sm cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Back to Home
        </motion.button>
      </div>
    </motion.div>
  );
}
