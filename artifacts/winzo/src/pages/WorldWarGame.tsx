/**
 * WorldWarGame — WINGGO
 * Karan vs Arjun: Card Fate Battle
 *
 * Flow:
 *  1. Lobby     — pick an entry room, click JOIN → card selection screen
 *  2. Card Pick — two mystery cards; tap one → fate assigns your team (Karan / Arjun)
 *  3. Battle    — live auto-battle; watch scores update in real-time with a ticker
 *  4. Result    — victory / defeat screen with prize
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { useWallet } from "@/context/useWallet";

// ─── TYPES ────────────────────────────────────────────────────
type Phase = "lobby" | "card-pick" | "matchmaking" | "battle" | "result";
type Team  = "karan" | "arjun";

interface Room {
  id: string;
  label: string;
  entryFee: number;
  prizePool: number;
  players: number;
  maxPlayers: number;
  countdown: number;
  duration: number;   // battle seconds
  tag: "hot" | "live" | "fast";
}

interface Ticker { id: number; text: string; color: string }

// ─── CONSTANTS ────────────────────────────────────────────────
const TEAM: Record<Team, { name: string; color: string; bg: string; glow: string; emoji: string; flag: string }> = {
  karan: { name: "TEAM KARAN", color: "#e74c3c", bg: "rgba(231,76,60,0.18)",  glow: "rgba(231,76,60,0.7)",  emoji: "⚔️",  flag: "🔴" },
  arjun: { name: "TEAM ARJUN", color: "#3b82f6", bg: "rgba(59,130,246,0.18)", glow: "rgba(59,130,246,0.7)", emoji: "🛡️", flag: "🔵" },
};

const EVENTS_KARAN = ["Karan scores big!", "Karan's warrior strikes!", "Team Karan takes the lead!", "Karan launches a combo!", "Team Karan is on fire! 🔥"];
const EVENTS_ARJUN = ["Arjun fights back!", "Arjun's shield holds!", "Team Arjun closes the gap!", "Arjun launches a counter!", "Team Arjun surges ahead! ⚡"];
const BOT_NAMES = ["Rahul_G","Priya_K","Amit_S","Dev_R","Sneha_M","Rohit_P","Kavya_L","Ankit_J","Meera_V","Varun_D"];

function rnd(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }

const INITIAL_ROOMS: Room[] = [
  { id: "r1", label: "QUICK BATTLE",   entryFee: 10,  prizePool: 180,  players: 38, maxPlayers: 50, countdown: 42,  duration: 30,  tag: "hot"  },
  { id: "r2", label: "WAR CLASSIC",    entryFee: 25,  prizePool: 450,  players: 22, maxPlayers: 40, countdown: 118, duration: 60,  tag: "live" },
  { id: "r3", label: "MEGA BATTLE",    entryFee: 50,  prizePool: 900,  players: 15, maxPlayers: 30, countdown: 78,  duration: 90,  tag: "hot"  },
  { id: "r4", label: "GRAND WAR",      entryFee: 100, prizePool: 1800, players: 9,  maxPlayers: 20, countdown: 210, duration: 120, tag: "fast" },
  { id: "r5", label: "CHAMPION CLASH", entryFee: 200, prizePool: 3600, players: 5,  maxPlayers: 10, countdown: 340, duration: 120, tag: "fast" },
  { id: "r6", label: "QUICK BATTLE",   entryFee: 5,   prizePool: 90,   players: 44, maxPlayers: 50, countdown: 20,  duration: 30,  tag: "live" },
];

const TAG_CFG = {
  hot:  { label: "🔥 HOT",   bg: "rgba(239,68,68,0.15)",  color: "#f87171", border: "rgba(239,68,68,0.35)"  },
  live: { label: "🔴 LIVE",  bg: "rgba(231,76,60,0.15)",  color: "#e74c3c", border: "rgba(231,76,60,0.35)"  },
  fast: { label: "⚡ FAST",  bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.35)" },
};

// ─── ROOT ─────────────────────────────────────────────────────
export default function WorldWarGame({ onBack }: { onBack?: () => void }) {
  const [phase, setPhase]       = useState<Phase>("lobby");
  const [team, setTeam]         = useState<Team>("karan");
  const [room, setRoom]         = useState<Room>(INITIAL_ROOMS[0]);
  const { deductFee, addWinning } = useWallet();

  const handleJoin = useCallback((r: Room) => {
    setRoom(r);
    setPhase("card-pick");
  }, []);

  const handleCardPick = useCallback((chosenTeam: Team) => {
    setTeam(chosenTeam);
    deductFee(room.entryFee, `World War Entry ₹${room.entryFee}`);
    setPhase("matchmaking");
  }, [room, deductFee]);

  const handleBattleOver = useCallback((won: boolean) => {
    if (won) {
      const prize = Math.round(room.entryFee * 1.8);
      addWinning(prize, `World War Win ₹${prize}`, room.id);
    }
    setPhase("result");
  }, [room, addWinning]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}>
      <AnimatePresence mode="wait">
        {phase === "lobby"      && <LobbyPhase      key="lobby"      onBack={onBack} onJoin={handleJoin} />}
        {phase === "card-pick"  && <CardPickPhase   key="card-pick"  room={room} onPick={handleCardPick} onBack={() => setPhase("lobby")} />}
        {phase === "matchmaking"&& <MatchmakingPhase key="mm"        team={team} onReady={() => setPhase("battle")} />}
        {phase === "battle"     && <BattlePhase      key="battle"    team={team} room={room} onResult={handleBattleOver} />}
        {phase === "result"     && <ResultPhase      key="result"    team={team} room={room} onPlayAgain={() => setPhase("lobby")} onBack={onBack} />}
      </AnimatePresence>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────
function LobbyPhase({ onBack, onJoin }: { onBack?: () => void; onJoin: (r: Room) => void }) {
  const [rooms, setRooms]         = useState<Room[]>(INITIAL_ROOMS);
  const [totalPlayers, setTotal]  = useState(rnd(12400, 13200));

  useEffect(() => {
    const t = setInterval(() => {
      setRooms((prev) => prev.map((r) => {
        const next = r.countdown - 1;
        return next <= 0
          ? { ...r, countdown: r.duration, players: Math.max(1, r.players - rnd(0, 2)) }
          : { ...r, countdown: next, players: Math.min(r.maxPlayers, r.players + (Math.random() > 0.65 ? 1 : 0)) };
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTotal((n) => n + rnd(-12, 20)), 2500);
    return () => clearInterval(t);
  }, []);

  function fmt(s: number) {
    const m = Math.floor(s / 60), sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `0:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <motion.div className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* ── HERO BANNER ── */}
      <div className="relative shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(160deg, #1a0000 0%, #07050f 50%, #00001a 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 210 }}>

        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div className="absolute w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(231,76,60,0.22) 0%, transparent 60%)", top: "-30%", left: "-15%" }}
            animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 4, repeat: Infinity }} />
          <motion.div className="absolute w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 60%)", top: "-30%", right: "-15%" }}
            animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 3.5, repeat: Infinity, delay: 1 }} />
          {Array.from({ length: 18 }, (_, i) => (
            <motion.div key={i} className="absolute rounded-full"
              style={{ width: rnd(2, 4), height: rnd(2, 4), left: `${rnd(5, 95)}%`, top: `${rnd(10, 90)}%`,
                background: i % 2 === 0 ? "#e74c3c" : "#3b82f6",
                boxShadow: i % 2 === 0 ? "0 0 5px #e74c3c" : "0 0 5px #3b82f6" }}
              animate={{ opacity: [0, 1, 0], y: [0, -24] }}
              transition={{ duration: 1 + Math.random(), delay: Math.random() * 2.5, repeat: Infinity }} />
          ))}
        </div>

        <div className="absolute top-4 left-4 z-20">
          <BackButton onBack={onBack} label="Home" />
        </div>

        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
          <motion.div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black"
            style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
            animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            LIVE
          </motion.div>
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
            👥 {totalPlayers.toLocaleString("en-IN")} playing
          </div>
        </div>

        <div className="flex flex-col items-center pt-10 pb-3 px-4 relative z-10">
          <div className="text-[10px] font-black tracking-[0.3em] uppercase mb-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            WINGGO PRESENTS
          </div>
          <motion.h1 className="text-4xl font-black tracking-tight leading-none text-white"
            style={{ textShadow: "0 0 30px rgba(255,215,0,0.6)" }}
            animate={{ textShadow: ["0 0 20px rgba(255,215,0,0.4)", "0 0 40px rgba(255,215,0,0.9)", "0 0 20px rgba(255,215,0,0.4)"] }}
            transition={{ duration: 2, repeat: Infinity }}>
            WORLD WAR
          </motion.h1>

          {/* Teams */}
          <div className="flex items-center gap-5 mt-4">
            <motion.div className="flex flex-col items-center gap-1.5"
              animate={{ x: [0, -4, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(231,76,60,0.2)", border: "2px solid rgba(231,76,60,0.5)", boxShadow: "0 0 20px rgba(231,76,60,0.4)" }}>
                ⚔️
              </div>
              <span className="text-[11px] font-black" style={{ color: "#f87171" }}>KARAN</span>
            </motion.div>

            <div className="flex flex-col items-center">
              <motion.div className="text-xl font-black text-white"
                style={{ textShadow: "0 0 15px rgba(255,215,0,0.8)" }}
                animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>VS</motion.div>
              <motion.div className="text-2xl"
                animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.15, 0.9] }} transition={{ duration: 0.8, repeat: Infinity }}>
                🔥
              </motion.div>
            </div>

            <motion.div className="flex flex-col items-center gap-1.5"
              animate={{ x: [0, 4, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: "rgba(59,130,246,0.2)", border: "2px solid rgba(59,130,246,0.5)", boxShadow: "0 0 20px rgba(59,130,246,0.4)" }}>
                🛡️
              </div>
              <span className="text-[11px] font-black" style={{ color: "#60a5fa" }}>ARJUN</span>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── BATTLES LIST ── */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: "rgba(7,5,15,0.98)", backdropFilter: "blur(10px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-2">
          <motion.div className="w-2 h-2 rounded-full bg-red-500" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
          <span className="text-sm font-black text-white">LIVE BATTLES</span>
        </div>
        <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
          style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)" }}>
          {rooms.length} ROOMS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-3 space-y-3 pb-8">
          {rooms.map((room, idx) => {
            const tagCfg   = TAG_CFG[room.tag];
            const fillPct  = Math.round((room.players / room.maxPlayers) * 100);
            const isUrgent = room.countdown <= 15;

            return (
              <motion.div key={room.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: isUrgent ? "1px solid rgba(231,76,60,0.3)" : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: isUrgent ? "0 0 16px rgba(231,76,60,0.12)" : "none",
                }}>

                {/* Top glow line */}
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(231,76,60,0.5), rgba(59,130,246,0.5), transparent)" }} />

                <div className="flex items-center p-3 gap-2">

                  {/* Duration + countdown */}
                  <div className="flex flex-col items-center justify-center rounded-xl px-2.5 py-3 shrink-0"
                    style={{ background: "rgba(255,215,0,0.07)", border: "1.5px solid rgba(255,215,0,0.2)", minWidth: 60 }}>
                    <span className="text-xs font-black" style={{ color: "rgba(255,215,0,0.7)" }}>NEXT</span>
                    <motion.span className="text-base font-black tabular-nums mt-0.5"
                      style={{ color: isUrgent ? "#f87171" : "#FFD700" }}
                      animate={isUrgent ? { scale: [1, 1.18, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
                      {fmt(room.countdown)}
                    </motion.span>
                    <span className="text-[8px] mt-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>STARTS</span>
                  </div>

                  {/* Center */}
                  <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                    {/* Karan vs Arjun mini */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                          style={{ background: "rgba(231,76,60,0.18)", border: "1.5px solid rgba(231,76,60,0.4)" }}>⚔️</div>
                        <span className="text-[8px] font-black" style={{ color: "#f87171" }}>KARAN</span>
                      </div>
                      <motion.div className="text-xs font-black" style={{ color: "#FFD700" }}
                        animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }}>VS</motion.div>
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                          style={{ background: "rgba(59,130,246,0.18)", border: "1.5px solid rgba(59,130,246,0.4)" }}>🛡️</div>
                        <span className="text-[8px] font-black" style={{ color: "#60a5fa" }}>ARJUN</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-black tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {room.label}
                    </span>
                    <div className="w-full">
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div className="h-full rounded-full"
                          style={{ background: "linear-gradient(90deg,#e74c3c,#3b82f6)" }}
                          animate={{ width: `${fillPct}%` }} transition={{ duration: 0.6 }} />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                          👥 {room.players}/{room.maxPlayers}
                        </span>
                        <motion.span className="text-[9px] font-black px-1.5 py-px rounded-full"
                          style={{ background: tagCfg.bg, color: tagCfg.color, border: `1px solid ${tagCfg.border}` }}
                          animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.1, repeat: Infinity }}>
                          {tagCfg.label}
                        </motion.span>
                      </div>
                    </div>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    <div className="flex flex-col items-center px-2 py-1.5 rounded-xl"
                      style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                      <span className="text-[8px] font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>🏆 PRIZE</span>
                      <span className="text-sm font-black leading-tight" style={{ color: "#FFD700" }}>
                        ₹{room.prizePool >= 1000 ? `${(room.prizePool / 1000).toFixed(1)}K` : room.prizePool}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[8px]" style={{ color: "rgba(255,255,255,0.3)" }}>Entry</span>
                      <div className="text-xs font-black text-white">₹{room.entryFee}</div>
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => onJoin(room)}
                      className="px-3 py-2 rounded-xl font-black text-[11px] cursor-pointer whitespace-nowrap"
                      style={{ background: "linear-gradient(135deg,#e74c3c,#c0392b)", color: "#fff", boxShadow: "0 0 12px rgba(231,76,60,0.5)", letterSpacing: "0.02em" }}>
                      JOIN NOW
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── CARD PICK ────────────────────────────────────────────────
function CardPickPhase({ room, onPick, onBack }: { room: Room; onPick: (t: Team) => void; onBack: () => void }) {
  const [flipped, setFlipped] = useState<0 | 1 | null>(null);
  const [revealed, setRevealed] = useState<Team | null>(null);

  const handleCardClick = (cardIdx: 0 | 1) => {
    if (flipped !== null) return;
    // Fate randomly assigns team
    const assignedTeam: Team = Math.random() < 0.5 ? "karan" : "arjun";
    setFlipped(cardIdx);
    setTimeout(() => {
      setRevealed(assignedTeam);
    }, 400);
    setTimeout(() => {
      onPick(assignedTeam);
    }, 2200);
  };

  const tc = revealed ? TEAM[revealed] : null;

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-8 px-6 relative"
      style={{ background: "linear-gradient(160deg, #0f0000 0%, #07050f 50%, #00000f 100%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute w-64 h-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(231,76,60,0.15) 0%, transparent 60%)", top: "-10%", left: "-10%" }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 4, repeat: Infinity }} />
        <motion.div className="absolute w-64 h-64 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 60%)", bottom: "-10%", right: "-10%" }}
          animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 3.5, repeat: Infinity, delay: 1 }} />
      </div>

      {/* Back button */}
      <div className="absolute top-4 left-4 z-20">
        <BackButton onBack={onBack} label="Back" />
      </div>

      {/* Header */}
      <div className="text-center relative z-10">
        <div className="text-[10px] font-black tracking-[0.25em] uppercase mb-2" style={{ color: "rgba(255,215,0,0.5)" }}>
          ⚔️ WORLD WAR — ₹{room.entryFee} ENTRY
        </div>
        <h2 className="text-3xl font-black text-white" style={{ textShadow: "0 0 20px rgba(255,215,0,0.4)" }}>
          Choose Your Fate
        </h2>
        <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.35)" }}>
          {flipped === null ? "Tap a card — destiny decides your team" : "Revealing your team…"}
        </p>
      </div>

      {/* Prize pool */}
      <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl relative z-10"
        style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.25)" }}>
        <span className="text-lg">🏆</span>
        <div>
          <span className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>Prize Pool</span>
          <div className="font-black text-xl" style={{ color: "#FFD700" }}>₹{room.prizePool.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {/* THE CARDS */}
      <div className="flex gap-6 relative z-10">
        {([0, 1] as const).map((cardIdx) => {
          const isFlipped = flipped === cardIdx;
          const showTeam  = isFlipped && tc;

          return (
            <motion.div key={cardIdx}
              className="relative cursor-pointer"
              style={{ width: 140, height: 200, perspective: 1000 }}
              whileHover={flipped === null ? { y: -8 } : {}}
              onClick={() => handleCardClick(cardIdx)}>

              {/* Card body — animates flip */}
              <motion.div
                className="w-full h-full rounded-2xl relative"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}>

                {/* FRONT face (face-down design) */}
                <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
                  style={{
                    backfaceVisibility: "hidden",
                    background: "linear-gradient(145deg, #1e1a2e, #0d0d1a)",
                    border: flipped === null ? "2px solid rgba(255,215,0,0.3)" : "2px solid rgba(255,255,255,0.1)",
                    boxShadow: flipped === null ? "0 0 24px rgba(255,215,0,0.15), 0 8px 32px rgba(0,0,0,0.5)" : "0 4px 16px rgba(0,0,0,0.4)",
                  }}>

                  {/* Card pattern */}
                  <div className="absolute inset-2 rounded-xl"
                    style={{ border: "1px dashed rgba(255,215,0,0.15)", background: "repeating-linear-gradient(45deg, rgba(255,215,0,0.02) 0px, rgba(255,215,0,0.02) 2px, transparent 2px, transparent 8px)" }} />

                  {/* Card label */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <motion.div className="text-5xl"
                      animate={flipped === null ? { scale: [1, 1.06, 1] } : {}}
                      transition={{ duration: 1.4, repeat: Infinity, delay: cardIdx * 0.4 }}>
                      {cardIdx === 0 ? "⚔️" : "🛡️"}
                    </motion.div>
                    <span className="font-black text-lg" style={{ color: "rgba(255,215,0,0.8)" }}>
                      CARD {cardIdx === 0 ? "A" : "B"}
                    </span>
                    {flipped === null && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,215,0,0.12)", color: "rgba(255,215,0,0.6)", border: "1px solid rgba(255,215,0,0.2)" }}>
                        TAP TO REVEAL
                      </span>
                    )}
                  </div>

                  {/* Pulse ring when waiting */}
                  {flipped === null && (
                    <motion.div className="absolute inset-0 rounded-2xl"
                      style={{ border: "2px solid rgba(255,215,0,0.4)" }}
                      animate={{ opacity: [0.4, 1, 0.4], scale: [0.98, 1.02, 0.98] }}
                      transition={{ duration: 1.5 + cardIdx * 0.3, repeat: Infinity }} />
                  )}
                </div>

                {/* BACK face (revealed team) */}
                <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                    background: showTeam
                      ? `linear-gradient(145deg, ${tc!.color}22, #0d0d1a)`
                      : "linear-gradient(145deg, #1e1a2e, #0d0d1a)",
                    border: `2px solid ${showTeam ? tc!.color : "rgba(255,255,255,0.1)"}`,
                    boxShadow: showTeam ? `0 0 30px ${tc!.glow}` : "none",
                  }}>
                  {showTeam && (
                    <motion.div className="flex flex-col items-center gap-3"
                      initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                      <div className="text-5xl">{tc!.emoji}</div>
                      <div className="font-black text-center" style={{ color: tc!.color }}>
                        <div className="text-[10px] tracking-widest uppercase opacity-70">YOU ARE</div>
                        <div className="text-lg leading-tight">{tc!.name}</div>
                      </div>
                      <motion.div className="text-2xl" animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.4, repeat: 3 }}>
                        👑
                      </motion.div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })}
      </div>

      {/* Team reveal banner */}
      <AnimatePresence>
        {revealed && tc && (
          <motion.div className="relative z-10 w-full py-4 rounded-2xl text-center"
            style={{ background: `${tc.color}18`, border: `1.5px solid ${tc.color}55`, boxShadow: `0 0 24px ${tc.glow}` }}
            initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
            <div className="text-sm font-black" style={{ color: tc.color }}>
              You are {tc.name}! {tc.emoji}
            </div>
            <div className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Entering battle…
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fate tagline */}
      {flipped === null && (
        <p className="text-xs text-center relative z-10" style={{ color: "rgba(255,255,255,0.2)" }}>
          🎴 Fate is sealed when you tap · Prize Pool ₹{room.prizePool.toLocaleString("en-IN")}
        </p>
      )}
    </motion.div>
  );
}

// ─── MATCHMAKING ──────────────────────────────────────────────
function MatchmakingPhase({ team, onReady }: { team: Team; onReady: () => void }) {
  const [filled, setFilled]       = useState(4);
  const [countdown, setCountdown] = useState<number | null>(null);
  const tc = TEAM[team];
  const ot = TEAM[team === "karan" ? "arjun" : "karan"];

  const myPlayers  = ["You (You)", ...BOT_NAMES.slice(0, 4)];
  const oppPlayers = BOT_NAMES.slice(5, 10);

  useEffect(() => {
    if (filled >= 10) { setCountdown(3); return; }
    const t = setTimeout(() => setFilled((f) => f + rnd(1, 2)), rnd(350, 800));
    return () => clearTimeout(t);
  }, [filled]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { onReady(); return; }
    const t = setTimeout(() => setCountdown((c) => (c ?? 1) - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onReady]);

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-5 px-5"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: "linear-gradient(160deg, #0f0000 0%, #07050f 50%, #00000f 100%)" }}>

      <div className="text-center">
        <motion.div className="text-3xl font-black text-white" animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
          ⚔️ WORLD WAR
        </motion.div>
        <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Assembling warriors…</p>
        <div className="mt-2 px-4 py-1 rounded-full text-xs font-bold inline-block"
          style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.color}55` }}>
          You are {tc.name} {tc.emoji}
        </div>
      </div>

      {/* Team columns */}
      <div className="w-full grid grid-cols-2 gap-3">
        {[
          { cfg: tc, players: myPlayers, isMyTeam: true },
          { cfg: ot, players: oppPlayers, isMyTeam: false },
        ].map(({ cfg, players, isMyTeam }) => (
          <div key={cfg.name} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${cfg.color}44` }}>
            <div className="text-center py-2 text-xs font-black" style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.emoji} {cfg.name}
            </div>
            <div className="py-2 px-3 space-y-1.5">
              {players.slice(0, Math.min(5, Math.ceil(filled / 2))).map((name, i) => (
                <motion.div key={name} initial={{ opacity: 0, x: isMyTeam ? -8 : 8 }}
                  animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black text-white"
                    style={{ background: cfg.color }}>{name[0]}</div>
                  <span className="text-xs font-bold truncate" style={{ color: name.startsWith("You") ? "#FFD700" : "rgba(255,255,255,0.5)" }}>
                    {name.startsWith("You") ? "You" : name}
                  </span>
                  {name.startsWith("You") && <span className="text-xs ml-auto" style={{ color: "#FFD700" }}>👑</span>}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Status */}
      <div className="text-center w-full">
        {countdown === null ? (
          <>
            <div className="text-sm font-bold text-white">
              Filling room<motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>…</motion.span>
            </div>
            <div className="mt-3 mx-auto w-52 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg,#e74c3c,#3b82f6)" }}
                animate={{ width: `${(filled / 10) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }} />
            </div>
            <div className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.3)" }}>{filled}/10 warriors ready</div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <motion.div className="text-xl font-black text-white" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              Battle Ready! 🎯
            </motion.div>
            <motion.div className="text-6xl font-black"
              style={{ color: "#FFD700", textShadow: "0 0 24px rgba(255,215,0,0.7)" }}
              animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.45, repeat: Infinity }}>
              {countdown}
            </motion.div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── BATTLE ───────────────────────────────────────────────────
function BattlePhase({ team, room, onResult }: { team: Team; room: Room; onResult: (won: boolean) => void }) {
  const tc = TEAM[team];
  const ot = TEAM[team === "karan" ? "arjun" : "karan"];

  const [timer, setTimer]         = useState(room.duration);
  const [karanScore, setKaran]    = useState(rnd(80, 120));
  const [arjunScore, setArjun]    = useState(rnd(80, 120));
  const [tickers, setTickers]     = useState<Ticker[]>([]);
  const [battleOver, setBattleOver] = useState(false);
  const [shake, setShake]         = useState(false);

  const tickerRef = useRef(1);
  const overRef   = useRef(false);
  const karanRef  = useRef(rnd(80, 120));
  const arjunRef  = useRef(rnd(80, 120));

  // Timer countdown
  useEffect(() => {
    if (overRef.current) return;
    if (timer <= 0) {
      overRef.current = true;
      setBattleOver(true);
      const won = team === "karan" ? karanRef.current >= arjunRef.current : arjunRef.current >= karanRef.current;
      setTimeout(() => onResult(won), 2000);
      return;
    }
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, team, onResult]);

  // Auto scoring + live tickers
  useEffect(() => {
    const t = setInterval(() => {
      if (overRef.current) return;

      const karanGain = rnd(3, 9);
      const arjunGain = rnd(3, 9);
      karanRef.current += karanGain;
      arjunRef.current += arjunGain;
      setKaran(karanRef.current);
      setArjun(arjunRef.current);

      // Random event ticker
      const showTicker = Math.random() > 0.55;
      if (showTicker) {
        const isKaranEvent = Math.random() > 0.5;
        const events = isKaranEvent ? EVENTS_KARAN : EVENTS_ARJUN;
        const text   = events[Math.floor(Math.random() * events.length)];
        const color  = isKaranEvent ? "#f87171" : "#60a5fa";
        const id     = tickerRef.current++;
        setTickers((prev) => [...prev.slice(-4), { id, text, color }]);
        setTimeout(() => setTickers((prev) => prev.filter((t) => t.id !== id)), 3000);
      }

      // Shake on lead change
      const myLeading = team === "karan" ? karanRef.current > arjunRef.current : arjunRef.current > karanRef.current;
      if (!myLeading && Math.random() > 0.85) {
        setShake(true);
        setTimeout(() => setShake(false), 400);
      }
    }, 700);
    return () => clearInterval(t);
  }, [team]);

  const mm    = Math.floor(timer / 60).toString().padStart(2, "0");
  const ss    = (timer % 60).toString().padStart(2, "0");
  const timerColor = timer <= 10 ? "#e74c3c" : timer <= 20 ? "#f39c12" : "#FFD700";
  const total = karanScore + arjunScore + 1;
  const kPct  = (karanScore / total) * 100;
  const aPct  = (arjunScore / total) * 100;
  const myScore   = team === "karan" ? karanScore : arjunScore;
  const oppScore  = team === "karan" ? arjunScore : karanScore;
  const iWinning  = myScore >= oppScore;

  return (
    <motion.div className="flex flex-col h-full"
      initial={{ opacity: 0 }} animate={{ opacity: 1, x: shake ? [0, -6, 6, -4, 4, 0] : 0 }} exit={{ opacity: 0 }}>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>Entry ₹{room.entryFee}</div>
        <motion.div className="font-black text-2xl tabular-nums"
          style={{ color: timerColor, textShadow: `0 0 12px ${timerColor}88` }}
          animate={timer <= 10 ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 0.5, repeat: Infinity }}>
          ⏱ {mm}:{ss}
        </motion.div>
        <div className="text-xs font-bold" style={{ color: iWinning ? "#27ae60" : "#e74c3c" }}>
          {iWinning ? "✅ WINNING" : "⬇️ LOSING"}
        </div>
      </div>

      {/* Score header */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2 text-xs font-black">
          <div className="flex flex-col items-start">
            <span style={{ color: TEAM.karan.color }}>⚔️ KARAN</span>
            <span className="text-xl font-black tabular-nums" style={{ color: TEAM.karan.color }}>{karanScore}</span>
          </div>
          <div className="text-center">
            <motion.div className="text-xs font-black px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}
              animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1, repeat: Infinity }}>
              {karanScore > arjunScore ? "⚔️ KARAN LEADS" : arjunScore > karanScore ? "🛡️ ARJUN LEADS" : "🔥 DRAW"}
            </motion.div>
          </div>
          <div className="flex flex-col items-end">
            <span style={{ color: TEAM.arjun.color }}>ARJUN 🛡️</span>
            <span className="text-xl font-black tabular-nums" style={{ color: TEAM.arjun.color }}>{arjunScore}</span>
          </div>
        </div>
        {/* Battle progress bar */}
        <div className="flex h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <motion.div className="h-full flex items-center justify-end pr-1"
            style={{ background: "linear-gradient(90deg,#e74c3c,#c0392b)" }}
            animate={{ width: `${kPct}%` }} transition={{ type: "spring", stiffness: 60, damping: 16 }}>
            {kPct > 20 && <span className="text-[9px] font-black text-white">{Math.round(kPct)}%</span>}
          </motion.div>
          <motion.div className="h-full flex items-center justify-start pl-1"
            style={{ background: "linear-gradient(90deg,#2563eb,#3b82f6)" }}
            animate={{ width: `${aPct}%` }} transition={{ type: "spring", stiffness: 60, damping: 16 }}>
            {aPct > 20 && <span className="text-[9px] font-black text-white">{Math.round(aPct)}%</span>}
          </motion.div>
        </div>
      </div>

      {/* Battle arena */}
      <div className="flex-1 relative overflow-hidden flex flex-col">

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at 30% 50%, ${TEAM.karan.bg} 0%, transparent 50%), radial-gradient(ellipse at 70% 50%, ${TEAM.arjun.bg} 0%, transparent 50%)` }} />

        {/* Center VS warriors */}
        <div className="flex-1 flex items-center justify-center gap-8 relative z-10">

          {/* Karan warrior */}
          <motion.div className="flex flex-col items-center gap-2"
            animate={team === "karan" && !battleOver
              ? { y: [0, -5, 0] } : {}
            }
            transition={{ duration: 0.8, repeat: Infinity }}>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl relative"
              style={{ background: TEAM.karan.bg, border: `2px solid ${TEAM.karan.color}55`, boxShadow: `0 0 20px ${TEAM.karan.glow}44` }}>
              ⚔️
              {team === "karan" && (
                <motion.div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: "#FFD700", color: "#000" }}
                  animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                  👑
                </motion.div>
              )}
            </div>
            <span className="text-xs font-black" style={{ color: TEAM.karan.color }}>
              {team === "karan" ? "← YOU" : "KARAN"}
            </span>
          </motion.div>

          {/* Center fire */}
          <div className="flex flex-col items-center gap-1">
            <motion.div className="text-4xl"
              animate={{ scale: [0.9, 1.2, 0.9], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 0.6, repeat: Infinity }}>
              🔥
            </motion.div>
            <motion.div className="text-sm font-black"
              style={{ color: "#FFD700", textShadow: "0 0 10px rgba(255,215,0,0.8)" }}
              animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
              VS
            </motion.div>
            {battleOver && (
              <motion.div className="text-xs font-black px-2 py-1 rounded-full"
                style={{ background: "rgba(231,76,60,0.2)", color: "#f87171", border: "1px solid rgba(231,76,60,0.4)" }}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                TIME'S UP
              </motion.div>
            )}
          </div>

          {/* Arjun warrior */}
          <motion.div className="flex flex-col items-center gap-2"
            animate={team === "arjun" && !battleOver
              ? { y: [0, -5, 0] } : {}
            }
            transition={{ duration: 0.8, repeat: Infinity }}>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl relative"
              style={{ background: TEAM.arjun.bg, border: `2px solid ${TEAM.arjun.color}55`, boxShadow: `0 0 20px ${TEAM.arjun.glow}44` }}>
              🛡️
              {team === "arjun" && (
                <motion.div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: "#FFD700", color: "#000" }}
                  animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                  👑
                </motion.div>
              )}
            </div>
            <span className="text-xs font-black" style={{ color: TEAM.arjun.color }}>
              {team === "arjun" ? "YOU →" : "ARJUN"}
            </span>
          </motion.div>
        </div>

        {/* Live ticker feed */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1.5 pointer-events-none px-4">
          <AnimatePresence>
            {tickers.slice(-3).map((tick) => (
              <motion.div key={tick.id}
                className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(0,0,0,0.7)", border: `1px solid ${tick.color}44`, color: tick.color, backdropFilter: "blur(8px)" }}
                initial={{ opacity: 0, y: 10, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.85 }}
                transition={{ duration: 0.2 }}>
                {tick.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* My team summary bar */}
      <div className="px-4 py-3 shrink-0"
        style={{ background: tc.bg, borderTop: `1px solid ${tc.color}44` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tc.emoji}</span>
            <div>
              <div className="text-xs font-black" style={{ color: tc.color }}>{tc.name}</div>
              <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Your team</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-black tabular-nums" style={{ color: tc.color }}>{myScore}</div>
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>vs {oppScore} opp</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── RESULT ───────────────────────────────────────────────────
function ResultPhase({ team, room, onPlayAgain, onBack }: { team: Team; room: Room; onPlayAgain: () => void; onBack?: () => void }) {
  const won   = useRef(Math.random() > 0.45).current;
  const prize = won ? Math.round(room.entryFee * 1.8) : 0;
  const tc    = TEAM[team];

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-5 px-5"
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
      style={{ background: "linear-gradient(160deg, #0f0000 0%, #07050f 50%, #00000f 100%)" }}>

      {/* Result emoji */}
      <motion.div className="text-7xl"
        animate={{ scale: [1, 1.15, 1], rotate: won ? [0, 6, -6, 0] : [0] }}
        transition={{ duration: 0.6, repeat: 3 }}>
        {won ? "🏆" : "💔"}
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <motion.div className="text-3xl font-black"
          style={{ color: won ? "#FFD700" : "#f87171", textShadow: won ? "0 0 20px rgba(255,215,0,0.5)" : "0 0 20px rgba(248,113,113,0.5)" }}
          animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
          {won ? "VICTORY! ⚔️" : "DEFEAT 💔"}
        </motion.div>
        <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          {tc.name} {won ? "won the World War!" : "fought with honour"}
        </div>
      </div>

      {/* Score card */}
      <div className="w-full rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
        <div className="py-2 text-center text-xs font-black tracking-widest uppercase"
          style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          Battle Summary
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
          {[
            { team: "karan" as Team, score: rnd(340, 600) },
            { team: "arjun" as Team, score: rnd(300, 580) },
          ].map(({ team: t, score }) => {
            const cfg    = TEAM[t];
            const isMe   = t === team;
            const isWon  = won ? t === team : t !== team;
            return (
              <div key={t} className="flex flex-col items-center py-4"
                style={{ background: isMe ? cfg.bg : "transparent" }}>
                <span className="text-2xl">{cfg.emoji}</span>
                <span className="text-xs font-black mt-1" style={{ color: cfg.color }}>{cfg.name}</span>
                {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full mt-1"
                  style={{ background: "#FFD700", color: "#000" }}>YOU</span>}
                <span className="text-2xl font-black mt-2 tabular-nums" style={{ color: "rgba(255,255,255,0.8)" }}>{score}</span>
                <span className="text-[9px] mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>pts</span>
                {isWon && <span className="text-xs font-black mt-1" style={{ color: "#FFD700" }}>🏆 WINNER</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prize */}
      {won ? (
        <motion.div className="w-full py-4 rounded-2xl text-center"
          style={{ background: "rgba(255,215,0,0.1)", border: "2px solid rgba(255,215,0,0.4)", boxShadow: "0 0 28px rgba(255,215,0,0.2)" }}
          animate={{ boxShadow: ["0 0 16px rgba(255,215,0,0.15)", "0 0 36px rgba(255,215,0,0.45)", "0 0 16px rgba(255,215,0,0.15)"] }}
          transition={{ duration: 1.4, repeat: Infinity }}>
          <div className="text-xs font-bold mb-1" style={{ color: "rgba(255,215,0,0.6)" }}>💰 YOU WON</div>
          <div className="text-4xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Added to your Winning wallet</div>
        </motion.div>
      ) : (
        <div className="w-full py-3 rounded-2xl text-center"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-sm font-black" style={{ color: "rgba(255,255,255,0.4)" }}>Better luck next time!</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>Entry fee ₹{room.entryFee} · Try again for ₹{Math.round(room.entryFee * 1.8)} prize</p>
        </div>
      )}

      {/* Actions */}
      <div className="w-full space-y-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#e74c3c,#3b82f6)", color: "#fff", boxShadow: "0 0 24px rgba(231,76,60,0.4)", letterSpacing: "0.04em" }}>
          <motion.div className="absolute inset-0 pointer-events-none"
            style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)" }}
            animate={{ x: ["-100%", "200%"] }} transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }} />
          ⚔️ PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onBack}
          className="w-full py-3 rounded-2xl font-black text-sm cursor-pointer"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}>
          Back to Home
        </motion.button>
      </div>
    </motion.div>
  );
}
