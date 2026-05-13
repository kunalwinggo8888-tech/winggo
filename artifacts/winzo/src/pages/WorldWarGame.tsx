/**
 * WorldWarGame — WINGGO Premium
 * ⚔️ KARNA VS ⚡ ARJUN — Battle For Glory
 *
 * Flow:
 *  1. Lobby       — WAR games list + live scoreboard
 *  2. Card Pick   — mystery card flip with fire/lightning
 *  3. Matchmaking — team fill
 *  4. Battle      — live battle + pressure effects + scoreboard
 *  5. Result      — victory/defeat with prize
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { useWallet } from "@/context/useWallet";

// ─── TYPES ────────────────────────────────────────────────────
type Phase   = "lobby" | "card-pick" | "matchmaking" | "battle" | "result";
type Team    = "karna" | "arjun";
type WarTab  = "games" | "scoreboard";

interface Room {
  id: string; label: string; entryFee: number; prizePool: number;
  players: number; maxPlayers: number; countdown: number; duration: number;
  tag: "hot" | "live" | "fast";
}
interface Ticker  { id: number; text: string; color: string }
interface Particle { id: number; x: number; y: number; vx: number; vy: number; color: string }

// ─── CONSTANTS ────────────────────────────────────────────────
const TEAM: Record<Team, { name: string; color: string; bg: string; glow: string; emoji: string; warrior: string }> = {
  karna: { name: "TEAM KARNA", color: "#e74c3c", bg: "rgba(231,76,60,0.18)", glow: "rgba(231,76,60,0.7)",  emoji: "🔥", warrior: "⚔️" },
  arjun: { name: "TEAM ARJUN", color: "#3b82f6", bg: "rgba(59,130,246,0.18)", glow: "rgba(59,130,246,0.7)", emoji: "⚡", warrior: "🛡️" },
};

const WAR_GAMES = [
  { id: "deadkill", name: "Dead Kill",      icon: "🔫", fees: [2, 5, 10, 20],     online: "4.2K", timer: "02:30" },
  { id: "mrracer",  name: "Mr Racer",       icon: "🏎️", fees: [2, 5, 10],         online: "6.1K", timer: "01:45" },
  { id: "numslot",  name: "Number Slot",    icon: "🎰", fees: [2, 5, 10, 20, 50], online: "2.8K", timer: "00:45" },
  { id: "ludo",     name: "Ludo",           icon: "🎲", fees: [2, 5, 10, 50],     online: "18K",  timer: "08:00" },
  { id: "bubble",   name: "Bubble Shooter", icon: "🫧", fees: [2, 5, 10],         online: "3.5K", timer: "02:00" },
  { id: "pool3d",   name: "Pool 3D",        icon: "🎱", fees: [5, 10, 20, 50],    online: "1.9K", timer: "04:00" },
  { id: "carrom",   name: "Carrom",         icon: "🎯", fees: [2, 5, 10, 20],     online: "7.2K", timer: "05:00" },
  { id: "chess",    name: "Chess",          icon: "♟️", fees: [5, 10, 20, 50],    online: "3.1K", timer: "10:00" },
  { id: "snakes",   name: "Snake & Ladder", icon: "🐍", fees: [2, 5, 10],         online: "5.4K", timer: "03:00" },
];

const INITIAL_ROOMS: Room[] = [
  { id: "r1", label: "QUICK BATTLE",  entryFee: 2,  prizePool: 36,  players: 44, maxPlayers: 50, countdown: 22,  duration: 30,  tag: "live" },
  { id: "r2", label: "WAR CLASSIC",   entryFee: 5,  prizePool: 90,  players: 35, maxPlayers: 50, countdown: 52,  duration: 45,  tag: "hot"  },
  { id: "r3", label: "MEGA BATTLE",   entryFee: 10, prizePool: 180, players: 27, maxPlayers: 40, countdown: 78,  duration: 60,  tag: "hot"  },
  { id: "r4", label: "⚡ GOD WAR",    entryFee: 20, prizePool: 360, players: 19, maxPlayers: 30, countdown: 105, duration: 90,  tag: "fast" },
  { id: "r5", label: "GRAND WAR",     entryFee: 50, prizePool: 900, players: 8,  maxPlayers: 20, countdown: 195, duration: 120, tag: "fast" },
];

const TAG_CFG = {
  hot:  { label: "🔥 HOT",  bg: "rgba(239,68,68,0.15)",  color: "#f87171", border: "rgba(239,68,68,0.35)"  },
  live: { label: "🔴 LIVE", bg: "rgba(231,76,60,0.15)",  color: "#e74c3c", border: "rgba(231,76,60,0.35)"  },
  fast: { label: "⚡ FAST", bg: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "rgba(245,158,11,0.35)" },
};

const PRESSURE_MSGS = [
  "⚡ Enemy Team Taking Lead!",
  "💀 Enemy Warriors Gaining!",
  "🔥 Danger! Team Falling Behind!",
  "⚡ ARJUN Force Surging!",
  "🔥 KARNA Warriors Strike Back!",
];
const EVENTS_KARNA = ["🔥 KARNA scores big!", "⚔️ Karna's warrior strikes!", "🔥 KARNA takes the lead!", "⚔️ Karna launches a combo!", "🔥 KARNA team is on fire!"];
const EVENTS_ARJUN = ["⚡ ARJUN fights back!", "🛡️ Arjun's shield holds!", "⚡ ARJUN closes the gap!", "🛡️ Arjun launches a counter!", "⚡ ARJUN surges ahead!"];
const BOT_NAMES    = ["Rahul_G","Priya_K","Amit_S","Dev_R","Sneha_M","Rohit_P","Kavya_L","Ankit_J","Meera_V","Varun_D"];

function rnd(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }

// ─── ROOT ─────────────────────────────────────────────────────
export default function WorldWarGame({ onBack, initialFee }: { onBack?: () => void; initialFee?: number }) {
  const startRoom = initialFee ? (INITIAL_ROOMS.find((r) => r.entryFee === initialFee) ?? INITIAL_ROOMS[0]) : INITIAL_ROOMS[0];
  const [phase, setPhase] = useState<Phase>(initialFee ? "card-pick" : "lobby");
  const [team,  setTeam]  = useState<Team>("karna");
  const [room,  setRoom]  = useState<Room>(startRoom);
  const { deductFee, addWinning } = useWallet();

  const handleJoin       = (r: Room) => { setRoom(r); setPhase("card-pick"); };
  const handleCardPick   = (t: Team) => { setTeam(t); deductFee(room.entryFee, `World War Entry ₹${room.entryFee}`); setPhase("matchmaking"); };
  const handleBattleOver = (won: boolean) => {
    if (won) addWinning(Math.round(room.entryFee * 1.8), `World War Win`, room.id);
    setPhase("result");
  };

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}>
      <AnimatePresence mode="wait">
        {phase === "lobby"       && <LobbyPhase       key="lobby"   onBack={onBack} onJoin={handleJoin} />}
        {phase === "card-pick"   && <CardPickPhase    key="cp"      room={room} onPick={handleCardPick} onBack={() => setPhase("lobby")} />}
        {phase === "matchmaking" && <MatchmakingPhase key="mm"      team={team} onReady={() => setPhase("battle")} />}
        {phase === "battle"      && <BattlePhase      key="battle"  team={team} room={room} onResult={handleBattleOver} />}
        {phase === "result"      && <ResultPhase      key="result"  team={team} room={room} onPlayAgain={() => setPhase("lobby")} onBack={onBack} />}
      </AnimatePresence>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────
function LobbyPhase({ onBack, onJoin }: { onBack?: () => void; onJoin: (r: Room) => void }) {
  const [tab,          setTab]     = useState<WarTab>("games");
  const [rooms,        setRooms]   = useState<Room[]>(INITIAL_ROOMS);
  const [totalPlayers, setTotal]   = useState(rnd(14200, 15600));
  const [karnaScore,   setKarna]   = useState(rnd(82000, 95000));
  const [arjunScore,   setArjun]   = useState(rnd(78000, 92000));
  const [karnaPl,      setKarnaPl] = useState(rnd(6800, 7200));
  const [arjunPl,      setArjunPl] = useState(rnd(6400, 7000));
  const [selFees,      setSelFees] = useState<Record<string,number>>({});

  useEffect(() => {
    const t = setInterval(() => {
      setRooms((prev) => prev.map((r) => {
        const n = r.countdown - 1;
        return n <= 0
          ? { ...r, countdown: r.duration, players: Math.max(1, r.players - rnd(0,2)) }
          : { ...r, countdown: n, players: Math.min(r.maxPlayers, r.players + (Math.random()>0.65?1:0)) };
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setTotal(n  => n + rnd(-15, 25));
      setKarna(n  => n + rnd(60, 210));
      setArjun(n  => n + rnd(50, 190));
      setKarnaPl(n => n + rnd(-3, 6));
      setArjunPl(n => n + rnd(-3, 5));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  function fmt(s: number) {
    const m = Math.floor(s/60), sec = s%60;
    return `${m}:${sec.toString().padStart(2,"0")}`;
  }

  const karnaAvg = Math.round(karnaScore / karnaPl);
  const arjunAvg = Math.round(arjunScore / arjunPl);
  const tot      = karnaScore + arjunScore + 1;
  const kPct     = (karnaScore / tot) * 100;

  return (
    <motion.div className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* ── HERO ── */}
      <div className="relative shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(160deg,#1a0004 0%,#07050f 45%,#00001a 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)", minHeight: 224 }}>

        {/* Ambient orbs + particles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div className="absolute w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(231,76,60,0.28) 0%,transparent 60%)", top:"-40%",left:"-20%" }}
            animate={{ scale:[1,1.2,1], rotate:[0,12,0] }} transition={{ duration:4, repeat:Infinity }} />
          <motion.div className="absolute w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(59,130,246,0.28) 0%,transparent 60%)", top:"-40%",right:"-20%" }}
            animate={{ scale:[1,1.15,1], rotate:[0,-12,0] }} transition={{ duration:3.5, repeat:Infinity, delay:1 }} />
          {/* Lightning streaks */}
          {[...Array(5)].map((_,i) => (
            <motion.div key={i} className="absolute"
              style={{ width:1.5, height:rnd(35,80), left:`${rnd(15,85)}%`, top:`${rnd(5,55)}%`,
                background:"linear-gradient(180deg,rgba(59,130,246,0.9),transparent)", transformOrigin:"top" }}
              animate={{ opacity:[0,1,0], scaleX:[1,rnd(1,3)*0.6,1] }}
              transition={{ duration:0.12+Math.random()*0.2, delay:i*0.7+Math.random(), repeat:Infinity, repeatDelay:2.5+Math.random()*3 }} />
          ))}
          {/* Fire particles */}
          {[...Array(22)].map((_,i) => (
            <motion.div key={`fp${i}`} className="absolute rounded-full"
              style={{ width:rnd(2,5), height:rnd(2,5), left:`${rnd(5,95)}%`, bottom:`${rnd(0,25)}%`,
                background: i%3===0?"#FFD700":i%3===1?"#ff4500":"#60a5fa",
                boxShadow: i%2===0?"0 0 6px #ff4500":"0 0 6px #3b82f6" }}
              animate={{ y:[0,-rnd(20,65)], opacity:[0.9,0] }}
              transition={{ duration:0.8+Math.random()*1.5, delay:Math.random()*3, repeat:Infinity }} />
          ))}
        </div>

        <div className="absolute top-4 left-4 z-20"><BackButton onBack={onBack} label="Home" /></div>

        <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1.5">
          <motion.div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black"
            style={{ background:"rgba(239,68,68,0.18)", border:"1px solid rgba(239,68,68,0.4)", color:"#f87171" }}
            animate={{ opacity:[1,0.4,1] }} transition={{ duration:0.9, repeat:Infinity }}>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
            LIVE WAR
          </motion.div>
          <div className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.1)" }}>
            👥 {totalPlayers.toLocaleString("en-IN")} fighting
          </div>
        </div>

        <div className="flex flex-col items-center pt-11 pb-3 px-4 relative z-10">
          <div className="text-[10px] font-black tracking-[0.3em] mb-1" style={{ color:"rgba(255,215,0,0.4)" }}>WINGGO PRESENTS</div>
          <motion.h1 className="text-4xl font-black text-white"
            style={{ textShadow:"0 0 30px rgba(255,215,0,0.7)" }}
            animate={{ textShadow:["0 0 20px rgba(255,215,0,0.4)","0 0 55px rgba(255,215,0,1)","0 0 20px rgba(255,215,0,0.4)"] }}
            transition={{ duration:2, repeat:Infinity }}>
            ⚔️ WORLD WAR
          </motion.h1>
          <p className="text-[11px] mt-1 font-bold tracking-widest" style={{ color:"rgba(255,255,255,0.3)" }}>BATTLE FOR GLORY</p>

          {/* Teams */}
          <div className="flex items-center gap-6 mt-4">
            <motion.div className="flex flex-col items-center gap-1" animate={{ x:[0,-5,0] }} transition={{ duration:2.2, repeat:Infinity }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl relative"
                style={{ background:"rgba(231,76,60,0.2)", border:"2px solid rgba(231,76,60,0.65)", boxShadow:"0 0 26px rgba(231,76,60,0.55)" }}>
                ⚔️
                <motion.div className="absolute -bottom-1 -right-1 text-sm" animate={{ scale:[1,1.5,1] }} transition={{ duration:0.6, repeat:Infinity }}>🔥</motion.div>
              </div>
              <span className="text-[11px] font-black" style={{ color:"#f87171" }}>KARNA</span>
              <span className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.28)" }}>{karnaPl.toLocaleString("en-IN")} warriors</span>
            </motion.div>

            <div className="flex flex-col items-center">
              <motion.div className="text-2xl font-black text-white" style={{ textShadow:"0 0 16px rgba(255,215,0,0.9)" }}
                animate={{ scale:[1,1.28,1] }} transition={{ duration:0.8, repeat:Infinity }}>VS</motion.div>
              <motion.div className="text-xl" animate={{ rotate:[0,18,-18,0], scale:[0.85,1.25,0.85] }} transition={{ duration:0.65, repeat:Infinity }}>⚡</motion.div>
            </div>

            <motion.div className="flex flex-col items-center gap-1" animate={{ x:[0,5,0] }} transition={{ duration:2.2, repeat:Infinity }}>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-4xl relative"
                style={{ background:"rgba(59,130,246,0.2)", border:"2px solid rgba(59,130,246,0.65)", boxShadow:"0 0 26px rgba(59,130,246,0.55)" }}>
                🛡️
                <motion.div className="absolute -bottom-1 -right-1 text-sm" animate={{ scale:[1,1.5,1] }} transition={{ duration:0.6, repeat:Infinity, delay:0.3 }}>⚡</motion.div>
              </div>
              <span className="text-[11px] font-black" style={{ color:"#60a5fa" }}>ARJUN</span>
              <span className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.28)" }}>{arjunPl.toLocaleString("en-IN")} warriors</span>
            </motion.div>
          </div>

          {/* Live power bar */}
          <div className="w-full mt-4">
            <div className="flex justify-between text-[9px] font-black mb-1">
              <span style={{ color:"#f87171" }}>🔥 {karnaScore.toLocaleString("en-IN")}</span>
              <span style={{ color:"rgba(255,255,255,0.28)" }}>TEAM POWER</span>
              <span style={{ color:"#60a5fa" }}>{arjunScore.toLocaleString("en-IN")} ⚡</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
              <motion.div className="h-full rounded-l-full"
                style={{ background:"linear-gradient(90deg,#e74c3c,#ff6b35)" }}
                animate={{ width:`${kPct}%` }} transition={{ type:"spring", stiffness:40, damping:12 }} />
              <div className="h-full rounded-r-full flex-1" style={{ background:"linear-gradient(90deg,#3b82f6,#60a5fa)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="flex shrink-0" style={{ background:"rgba(7,5,15,0.99)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
        {(["games","scoreboard"] as WarTab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-3 text-xs font-black tracking-wider cursor-pointer transition-colors"
            style={{ color:tab===t?"#FFD700":"rgba(255,255,255,0.3)", borderBottom:tab===t?"2px solid #FFD700":"2px solid transparent", background:"transparent" }}>
            {t==="games"?"🎮 WAR GAMES":"📊 LIVE SCORES"}
          </button>
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto">

        {/* WAR GAMES */}
        {tab === "games" && (
          <div className="px-3 py-3 space-y-2.5 pb-8">
            {WAR_GAMES.map((g, idx) => (
              <motion.div key={g.id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:idx*0.04 }}
                className="rounded-2xl overflow-hidden relative"
                style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)" }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                  style={{ background:"linear-gradient(90deg,transparent,rgba(231,76,60,0.5),rgba(59,130,246,0.5),transparent)" }} />
                <div className="flex items-center gap-3 p-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                    style={{ background:"linear-gradient(135deg,rgba(231,76,60,0.14),rgba(59,130,246,0.14))", border:"1px solid rgba(255,255,255,0.09)" }}>
                    {g.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-black text-white">{g.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black"
                        style={{ background:"rgba(239,68,68,0.15)", color:"#f87171", border:"1px solid rgba(239,68,68,0.25)" }}>
                        ⏱ {g.timer}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {g.fees.map((fee) => (
                        <button key={fee}
                          onClick={() => setSelFees(p => ({ ...p, [g.id]: fee }))}
                          className="px-2 py-0.5 rounded-full text-[10px] font-black cursor-pointer transition-all"
                          style={{
                            background: selFees[g.id]===fee?"rgba(255,215,0,0.18)":"rgba(255,255,255,0.05)",
                            color:      selFees[g.id]===fee?"#FFD700":"rgba(255,255,255,0.4)",
                            border:     selFees[g.id]===fee?"1px solid rgba(255,215,0,0.5)":"1px solid rgba(255,255,255,0.09)",
                          }}>₹{fee}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.3)" }}>👥 {g.online}</div>
                    <motion.button whileTap={{ scale:0.88 }}
                      onClick={() => {
                        const fee = selFees[g.id] ?? g.fees[0];
                        onJoin({ id:g.id, label:g.name, entryFee:fee, prizePool:fee*18,
                          players:38, maxPlayers:50, countdown:30, duration:60, tag:"hot" });
                      }}
                      className="px-3 py-1.5 rounded-xl font-black text-[11px] cursor-pointer whitespace-nowrap"
                      style={{ background:"linear-gradient(135deg,#e74c3c,#c0392b)", color:"#fff", boxShadow:"0 0 12px rgba(231,76,60,0.4)" }}>
                      JOIN
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}

            {/* Battle rooms */}
            <div className="mt-2 pt-2">
              <div className="flex items-center gap-2 mb-3">
                <motion.div className="w-2 h-2 rounded-full bg-red-500" animate={{ opacity:[1,0.2,1] }} transition={{ duration:0.9, repeat:Infinity }} />
                <span className="text-xs font-black text-white">LIVE BATTLE ROOMS</span>
              </div>
              {rooms.map((rm, idx) => {
                const tagCfg  = TAG_CFG[rm.tag];
                const fillPct = Math.round((rm.players / rm.maxPlayers) * 100);
                const urgent  = rm.countdown <= 15;
                return (
                  <motion.div key={rm.id} initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ delay:idx*0.05 }}
                    className="rounded-2xl overflow-hidden relative mb-2.5"
                    style={{ background:"rgba(255,255,255,0.03)", border:urgent?"1px solid rgba(231,76,60,0.35)":"1px solid rgba(255,255,255,0.08)", boxShadow:urgent?"0 0 14px rgba(231,76,60,0.12)":"none" }}>
                    <div className="absolute top-0 left-0 right-0 h-px"
                      style={{ background:"linear-gradient(90deg,transparent,rgba(231,76,60,0.5),rgba(59,130,246,0.5),transparent)" }} />
                    <div className="flex items-center p-3 gap-2">
                      <div className="flex flex-col items-center justify-center rounded-xl px-2.5 py-3 shrink-0"
                        style={{ background:"rgba(255,215,0,0.07)", border:"1.5px solid rgba(255,215,0,0.2)", minWidth:54 }}>
                        <span className="text-[9px] font-black" style={{ color:"rgba(255,215,0,0.7)" }}>NEXT</span>
                        <motion.span className="text-sm font-black tabular-nums mt-0.5"
                          style={{ color:urgent?"#f87171":"#FFD700" }}
                          animate={urgent?{scale:[1,1.2,1]}:{}} transition={{ duration:0.5, repeat:Infinity }}>
                          {fmt(rm.countdown)}
                        </motion.span>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                              style={{ background:"rgba(231,76,60,0.18)", border:"1.5px solid rgba(231,76,60,0.4)" }}>⚔️</div>
                            <span className="text-[8px] font-black" style={{ color:"#f87171" }}>KARNA</span>
                          </div>
                          <motion.div className="text-[11px] font-black" style={{ color:"#FFD700" }}
                            animate={{ scale:[1,1.2,1] }} transition={{ duration:0.9, repeat:Infinity }}>VS</motion.div>
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                              style={{ background:"rgba(59,130,246,0.18)", border:"1.5px solid rgba(59,130,246,0.4)" }}>🛡️</div>
                            <span className="text-[8px] font-black" style={{ color:"#60a5fa" }}>ARJUN</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black" style={{ color:"rgba(255,255,255,0.4)" }}>{rm.label}</span>
                        <div className="w-full">
                          <div className="h-1 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.06)" }}>
                            <motion.div className="h-full rounded-full" style={{ background:"linear-gradient(90deg,#e74c3c,#3b82f6)" }}
                              animate={{ width:`${fillPct}%` }} transition={{ duration:0.6 }} />
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[9px]" style={{ color:"rgba(255,255,255,0.3)" }}>👥 {rm.players}/{rm.maxPlayers}</span>
                            <motion.span className="text-[9px] font-black px-1.5 py-px rounded-full"
                              style={{ background:tagCfg.bg, color:tagCfg.color, border:`1px solid ${tagCfg.border}` }}
                              animate={{ opacity:[1,0.5,1] }} transition={{ duration:1.1, repeat:Infinity }}>
                              {tagCfg.label}
                            </motion.span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <div className="flex flex-col items-center px-2 py-1.5 rounded-xl"
                          style={{ background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.2)" }}>
                          <span className="text-[8px] font-bold" style={{ color:"rgba(255,215,0,0.6)" }}>🏆 PRIZE</span>
                          <span className="text-sm font-black leading-tight" style={{ color:"#FFD700" }}>
                            ₹{rm.prizePool>=1000?`${(rm.prizePool/1000).toFixed(1)}K`:rm.prizePool}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px]" style={{ color:"rgba(255,255,255,0.3)" }}>Entry</span>
                          <div className="text-xs font-black text-white">₹{rm.entryFee}</div>
                        </div>
                        <motion.button whileTap={{ scale:0.9 }} onClick={() => onJoin(rm)}
                          className="px-3 py-1.5 rounded-xl font-black text-[11px] cursor-pointer whitespace-nowrap"
                          style={{ background:"linear-gradient(135deg,#e74c3c,#c0392b)", color:"#fff", boxShadow:"0 0 12px rgba(231,76,60,0.5)" }}>
                          JOIN NOW
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* LIVE SCOREBOARD */}
        {tab === "scoreboard" && (
          <div className="px-4 py-4 space-y-4 pb-8">
            {/* Team panels */}
            {([ ["karna", karnaScore, karnaAvg, karnaPl, 1], ["arjun", arjunScore, arjunAvg, arjunPl, 2] ] as [Team,number,number,number,number][]).map(([t,score,avg,players,rank]) => {
              const tc = TEAM[t];
              return (
                <motion.div key={t} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:t==="karna"?0:0.1 }}
                  className="rounded-2xl overflow-hidden"
                  style={{ background:tc.bg, border:`1.5px solid ${tc.color}44`, boxShadow:`0 0 22px ${tc.glow}20` }}>
                  <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom:`1px solid ${tc.color}22` }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl"
                      style={{ background:`${tc.color}22`, border:`2px solid ${tc.color}55` }}>{tc.warrior}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black" style={{ color:tc.color }}>{tc.name}</span>
                        <motion.span className="text-[9px] px-2 py-0.5 rounded-full font-black"
                          style={{ background:"rgba(239,68,68,0.2)", color:"#f87171", border:"1px solid rgba(239,68,68,0.3)" }}
                          animate={{ opacity:[1,0.4,1] }} transition={{ duration:0.8, repeat:Infinity }}>🔴 LIVE</motion.span>
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color:"rgba(255,255,255,0.38)" }}>
                        {tc.emoji} {players.toLocaleString("en-IN")} online warriors
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px]" style={{ color:"rgba(255,255,255,0.3)" }}>RANK</div>
                      <div className="text-xl font-black" style={{ color:rank===1?"#FFD700":"rgba(255,255,255,0.4)" }}>#{rank}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3" style={{ borderTop:`1px solid ${tc.color}15` }}>
                    {[
                      { label:"TOTAL SCORE", value:score>=1000000?`${(score/1000000).toFixed(1)}M`:`${(score/1000).toFixed(1)}K` },
                      { label:"AVG SCORE",   value:avg>=1000?`${(avg/1000).toFixed(1)}K`:avg.toLocaleString("en-IN") },
                      { label:"PLAYERS",     value:players>=1000?`${(players/1000).toFixed(1)}K`:players.toString() },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex flex-col items-center py-3 border-r last:border-r-0" style={{ borderColor:`${tc.color}18` }}>
                        <div className="text-[8px] font-bold mb-1" style={{ color:`${tc.color}99` }}>{label}</div>
                        <motion.div className="text-base font-black tabular-nums" style={{ color:tc.color }}
                          animate={{ scale:[1,1.04,1] }} transition={{ duration:1.6, repeat:Infinity }}>{value}</motion.div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}

            {/* Top warriors */}
            <div className="rounded-2xl overflow-hidden" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <div className="px-4 py-2.5 text-xs font-black" style={{ borderBottom:"1px solid rgba(255,255,255,0.06)", color:"#FFD700" }}>
                🏆 TOP WARRIORS
              </div>
              {BOT_NAMES.slice(0,8).map((name,i) => {
                const isKarna = i%2===0;
                const tc      = isKarna ? TEAM.karna : TEAM.arjun;
                return (
                  <div key={name} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[10px] font-black w-4" style={{ color:i<3?"#FFD700":"rgba(255,255,255,0.28)" }}>#{i+1}</span>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                      style={{ background:tc.color }}>{name[0]}</div>
                    <span className="flex-1 text-xs font-bold" style={{ color:"rgba(255,255,255,0.7)" }}>{name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-black shrink-0"
                      style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.color}44` }}>{tc.emoji}</span>
                    <span className="text-xs font-black tabular-nums" style={{ color:tc.color }}>{rnd(8000,25000).toLocaleString("en-IN")}</span>
                  </div>
                );
              })}
            </div>

            <motion.button whileTap={{ scale:0.97 }} onClick={() => setTab("games")}
              className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
              style={{ background:"linear-gradient(135deg,#e74c3c,#3b82f6)", color:"#fff", boxShadow:"0 0 28px rgba(231,76,60,0.4)", letterSpacing:"0.04em" }}>
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background:"linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)" }}
                animate={{ x:["-100%","200%"] }} transition={{ duration:2, repeat:Infinity, repeatDelay:1 }} />
              ⚔️ JOIN THE WAR NOW
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── CARD PICK ────────────────────────────────────────────────
function CardPickPhase({ room, onPick, onBack }: { room: Room; onPick: (t: Team) => void; onBack: () => void }) {
  const [flipped,   setFlipped]   = useState<0|1|null>(null);
  const [revealed,  setRevealed]  = useState<Team|null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [lightning, setLightning] = useState(false);
  const partRef = useRef(0);

  const handleCardClick = (cardIdx: 0|1) => {
    if (flipped !== null) return;
    const assignedTeam: Team = Math.random() < 0.5 ? "karna" : "arjun";
    setFlipped(cardIdx);
    setTimeout(() => {
      setRevealed(assignedTeam);
      setLightning(true);
      setTimeout(() => setLightning(false), 900);
      const tc = TEAM[assignedTeam];
      const cx = cardIdx === 0 ? 90 : 230;
      const newPs: Particle[] = Array.from({ length:30 }, (_,i) => ({
        id: partRef.current++,
        x: cx, y: 260,
        vx: (Math.random()-0.5)*130,
        vy: (Math.random()-0.5)*130 - 50,
        color: i%3===0?"#FFD700": i%3===1 ? tc.color : (assignedTeam==="karna"?"#ff8c00":"#38bdf8"),
      }));
      setParticles(p => [...p, ...newPs]);
      setTimeout(() => setParticles(p => p.filter(px => !newPs.find(n=>n.id===px.id))), 900);
    }, 520);
    setTimeout(() => onPick(assignedTeam), 2500);
  };

  const tc = revealed ? TEAM[revealed] : null;

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-7 px-6 relative overflow-hidden"
      style={{ background:"linear-gradient(160deg,#0f0002 0%,#07050f 50%,#00000f 100%)" }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>

      {/* Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute w-72 h-72 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(231,76,60,0.2) 0%,transparent 60%)", top:"-18%",left:"-18%" }}
          animate={{ scale:[1,1.3,1] }} transition={{ duration:3.5, repeat:Infinity }} />
        <motion.div className="absolute w-72 h-72 rounded-full"
          style={{ background:"radial-gradient(circle,rgba(59,130,246,0.2) 0%,transparent 60%)", bottom:"-18%",right:"-18%" }}
          animate={{ scale:[1,1.3,1] }} transition={{ duration:3, repeat:Infinity, delay:1.3 }} />

        {/* Lightning bolts on reveal */}
        <AnimatePresence>
          {lightning && [...Array(7)].map((_,i) => (
            <motion.div key={i} className="absolute"
              style={{ width:2, height:rnd(45,110), left:`${rnd(8,92)}%`, top:`${rnd(4,65)}%`,
                background:`linear-gradient(180deg,${revealed==="karna"?"rgba(231,76,60,0.95)":"rgba(59,130,246,0.95)"},transparent)`,
                transformOrigin:"top", zIndex:8 }}
              initial={{ opacity:0, scaleX:1 }}
              animate={{ opacity:[0,1,0], scaleX:[1,rnd(1,5)*0.5,1] }}
              exit={{ opacity:0 }}
              transition={{ duration:0.13, delay:i*0.07, repeat:5 }} />
          ))}
        </AnimatePresence>
      </div>

      {/* Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <motion.div key={p.id} className="absolute w-2 h-2 rounded-full"
            style={{ background:p.color, boxShadow:`0 0 7px ${p.color}`, left:p.x, top:p.y }}
            initial={{ x:0, y:0, opacity:1, scale:1 }}
            animate={{ x:p.vx, y:p.vy, opacity:0, scale:0 }}
            transition={{ duration:0.85, ease:"easeOut" }} />
        ))}
      </div>

      <div className="absolute top-4 left-4 z-20"><BackButton onBack={onBack} label="Back" /></div>

      <div className="text-center relative z-10">
        <div className="text-[10px] font-black tracking-[0.25em] mb-2" style={{ color:"rgba(255,215,0,0.5)" }}>
          ⚔️ WORLD WAR — ₹{room.entryFee} ENTRY
        </div>
        <h2 className="text-3xl font-black text-white" style={{ textShadow:"0 0 22px rgba(255,215,0,0.55)" }}>
          Choose Your Fate
        </h2>
        <p className="text-sm mt-2" style={{ color:"rgba(255,255,255,0.35)" }}>
          {flipped===null?"Tap a card — destiny decides your team":"Revealing your destiny…"}
        </p>
        {room.entryFee >= 20 && (
          <motion.div className="mt-2 px-3 py-1 rounded-full text-[10px] font-black inline-block"
            style={{ background:"rgba(239,68,68,0.2)", color:"#f87171", border:"1px solid rgba(239,68,68,0.4)" }}
            animate={{ opacity:[1,0.5,1] }} transition={{ duration:0.8, repeat:Infinity }}>
            ⚡ GOD MODE BOTS ACTIVE
          </motion.div>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-2.5 rounded-2xl relative z-10"
        style={{ background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.25)" }}>
        <span className="text-lg">🏆</span>
        <div>
          <div className="text-xs font-bold" style={{ color:"rgba(255,215,0,0.6)" }}>Prize Pool</div>
          <div className="font-black text-xl" style={{ color:"#FFD700" }}>₹{room.prizePool.toLocaleString("en-IN")}</div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex gap-7 relative z-10">
        {([0,1] as const).map((cardIdx) => {
          const isFlipped = flipped===cardIdx;
          const showTeam  = isFlipped && tc;
          return (
            <div key={cardIdx} className="relative cursor-pointer" style={{ width:140, height:200, perspective:1000 }}>
              <motion.div className="w-full h-full"
                whileHover={flipped===null?{ y:-10, scale:1.05 }:{}}
                onClick={() => handleCardClick(cardIdx)}>
                <motion.div className="w-full h-full rounded-2xl relative" style={{ transformStyle:"preserve-3d" }}
                  animate={{ rotateY:isFlipped?180:0 }}
                  transition={{ duration:0.72, type:"spring", stiffness:175, damping:22 }}>

                  {/* Front */}
                  <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
                    style={{ backfaceVisibility:"hidden",
                      background:"linear-gradient(145deg,#1e1a2e,#0d0d1a)",
                      border:flipped===null?"2px solid rgba(255,215,0,0.45)":"2px solid rgba(255,255,255,0.1)",
                      boxShadow:flipped===null?"0 0 30px rgba(255,215,0,0.2), 0 8px 32px rgba(0,0,0,0.6)":"none" }}>
                    <div className="absolute inset-2 rounded-xl"
                      style={{ border:"1px dashed rgba(255,215,0,0.14)", background:"repeating-linear-gradient(45deg,rgba(255,215,0,0.02) 0px,rgba(255,215,0,0.02) 2px,transparent 2px,transparent 8px)" }} />
                    <div className="relative z-10 flex flex-col items-center gap-3">
                      <motion.div className="text-5xl"
                        animate={flipped===null?{ scale:[1,1.1,1], rotate:[0,8,-8,0] }:{}}
                        transition={{ duration:1.7, repeat:Infinity, delay:cardIdx*0.4 }}>
                        {cardIdx===0?"🔥":"⚡"}
                      </motion.div>
                      <span className="font-black text-lg" style={{ color:"rgba(255,215,0,0.82)" }}>CARD {cardIdx===0?"A":"B"}</span>
                      {flipped===null && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background:"rgba(255,215,0,0.12)", color:"rgba(255,215,0,0.6)", border:"1px solid rgba(255,215,0,0.2)" }}>
                          TAP TO REVEAL
                        </span>
                      )}
                    </div>
                    {flipped===null && (
                      <motion.div className="absolute inset-0 rounded-2xl"
                        style={{ border:"2px solid rgba(255,215,0,0.55)" }}
                        animate={{ opacity:[0.25,1,0.25], scale:[0.97,1.04,0.97] }}
                        transition={{ duration:1.7+cardIdx*0.3, repeat:Infinity }} />
                    )}
                  </div>

                  {/* Back */}
                  <div className="absolute inset-0 rounded-2xl flex flex-col items-center justify-center overflow-hidden"
                    style={{ backfaceVisibility:"hidden", transform:"rotateY(180deg)",
                      background:showTeam?`linear-gradient(145deg,${tc!.color}28,#0d0d1a 72%)`:"linear-gradient(145deg,#1e1a2e,#0d0d1a)",
                      border:`2px solid ${showTeam?tc!.color:"rgba(255,255,255,0.1)"}`,
                      boxShadow:showTeam?`0 0 44px ${tc!.glow}, 0 0 90px ${tc!.glow}44`:"none" }}>
                    {showTeam && (
                      <motion.div className="flex flex-col items-center gap-3"
                        initial={{ opacity:0, scale:0.45, rotate:-15 }} animate={{ opacity:1, scale:1, rotate:0 }}
                        transition={{ type:"spring", stiffness:280, damping:18, delay:0.18 }}>
                        <motion.div className="text-5xl" animate={{ rotate:[0,14,-14,0] }} transition={{ duration:0.32, repeat:5 }}>
                          {tc!.warrior}
                        </motion.div>
                        <div className="font-black text-center px-2">
                          <div className="text-[9px] tracking-widest mb-0.5" style={{ color:`${tc!.color}88` }}>YOU ARE IN</div>
                          <div className="text-lg leading-tight" style={{ color:tc!.color }}>{tc!.name}</div>
                        </div>
                        <motion.div className="text-2xl" animate={{ scale:[1,1.5,1] }} transition={{ duration:0.38, repeat:4 }}>👑</motion.div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {revealed && tc && (
          <motion.div className="relative z-10 w-full py-4 rounded-2xl text-center overflow-hidden"
            style={{ background:`${tc.color}1a`, border:`2px solid ${tc.color}77`, boxShadow:`0 0 36px ${tc.glow}` }}
            initial={{ opacity:0, y:26, scale:0.82 }} animate={{ opacity:1, y:0, scale:1 }}
            transition={{ type:"spring", stiffness:300, damping:22 }}>
            <motion.div className="absolute inset-0"
              style={{ background:`linear-gradient(105deg,transparent 40%,${tc.color}22 50%,transparent 60%)` }}
              animate={{ x:["-100%","200%"] }} transition={{ duration:0.7, repeat:3 }} />
            <div className="text-base font-black" style={{ color:tc.color }}>{tc.emoji} You are {tc.name}!</div>
            <div className="text-xs mt-0.5" style={{ color:"rgba(255,255,255,0.33)" }}>Entering battle…</div>
          </motion.div>
        )}
      </AnimatePresence>

      {flipped===null && (
        <p className="text-xs text-center relative z-10" style={{ color:"rgba(255,255,255,0.2)" }}>
          🎴 Fate is sealed when you tap · Prize ₹{room.prizePool.toLocaleString("en-IN")}
        </p>
      )}
    </motion.div>
  );
}

// ─── MATCHMAKING ──────────────────────────────────────────────
function MatchmakingPhase({ team, onReady }: { team: Team; onReady: () => void }) {
  const [filled,    setFilled]    = useState(4);
  const [countdown, setCountdown] = useState<number|null>(null);
  const tc = TEAM[team];
  const ot = TEAM[team==="karna"?"arjun":"karna"];
  const myPl  = ["You",...BOT_NAMES.slice(0,4)];
  const oppPl = BOT_NAMES.slice(5,10);

  useEffect(() => {
    if (filled>=10){ setCountdown(3); return; }
    const t = setTimeout(() => setFilled(f=>f+rnd(1,2)), rnd(350,800));
    return () => clearTimeout(t);
  }, [filled]);

  useEffect(() => {
    if (countdown===null) return;
    if (countdown===0){ onReady(); return; }
    const t = setTimeout(() => setCountdown(c=>(c??1)-1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onReady]);

  return (
    <motion.div className="flex flex-col items-center justify-center h-full gap-5 px-5"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ background:"linear-gradient(160deg,#0f0002 0%,#07050f 50%,#00000f 100%)" }}>
      <div className="text-center">
        <motion.div className="text-3xl font-black text-white" animate={{ scale:[1,1.06,1] }} transition={{ duration:1.4, repeat:Infinity }}>
          ⚔️ WORLD WAR
        </motion.div>
        <p className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.35)" }}>Assembling warriors…</p>
        <div className="mt-2 px-4 py-1 rounded-full text-xs font-bold inline-block"
          style={{ background:tc.bg, color:tc.color, border:`1px solid ${tc.color}55` }}>
          {tc.emoji} You are {tc.name}
        </div>
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        {[{cfg:tc,players:myPl,isMe:true},{cfg:ot,players:oppPl,isMe:false}].map(({ cfg,players,isMe }) => (
          <div key={cfg.name} className="rounded-2xl overflow-hidden" style={{ border:`1.5px solid ${cfg.color}44` }}>
            <div className="text-center py-2 text-xs font-black" style={{ background:cfg.bg, color:cfg.color }}>
              {cfg.emoji} {cfg.name}
            </div>
            <div className="py-2 px-3 space-y-1.5">
              {players.slice(0, Math.min(5, Math.ceil(filled/2))).map((name,i) => (
                <motion.div key={name} initial={{ opacity:0, x:isMe?-8:8 }} animate={{ opacity:1, x:0 }} transition={{ delay:i*0.1 }}
                  className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-black text-white"
                    style={{ background:cfg.color }}>{name[0]}</div>
                  <span className="text-xs font-bold truncate" style={{ color:name==="You"?"#FFD700":"rgba(255,255,255,0.5)" }}>{name}</span>
                  {name==="You" && <span className="text-xs ml-auto" style={{ color:"#FFD700" }}>👑</span>}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center w-full">
        {countdown===null ? (
          <>
            <div className="text-sm font-bold text-white">
              Filling room<motion.span animate={{ opacity:[0,1,0] }} transition={{ duration:0.8, repeat:Infinity }}>…</motion.span>
            </div>
            <div className="mt-3 mx-auto w-52 h-2 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.08)" }}>
              <motion.div className="h-full rounded-full" style={{ background:"linear-gradient(90deg,#e74c3c,#3b82f6)" }}
                animate={{ width:`${(filled/10)*100}%` }} transition={{ type:"spring", stiffness:120, damping:18 }} />
            </div>
            <div className="text-xs mt-1.5" style={{ color:"rgba(255,255,255,0.3)" }}>{filled}/10 warriors ready</div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <motion.div className="text-xl font-black text-white" initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}>
              Battle Ready! ⚔️
            </motion.div>
            <motion.div className="text-6xl font-black"
              style={{ color:"#FFD700", textShadow:"0 0 30px rgba(255,215,0,0.85)" }}
              animate={{ scale:[1,1.22,1] }} transition={{ duration:0.45, repeat:Infinity }}>
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
  const tc         = TEAM[team];
  const isGodMode  = room.entryFee >= 20;
  const enemyBoost = isGodMode ? 1.28 : 1.0;

  const initMy  = () => rnd(90,120);
  const initOpp = () => Math.round(rnd(90,120) * enemyBoost);

  const [timer,      setTimer]      = useState(room.duration);
  const [karnaScore, setKarna]      = useState(() => team==="karna" ? initMy()  : initOpp());
  const [arjunScore, setArjun]      = useState(() => team==="arjun" ? initMy()  : initOpp());
  const [tickers,    setTickers]    = useState<Ticker[]>([]);
  const [pressure,   setPressure]   = useState<string|null>(null);
  const [dangerFlash,setDanger]     = useState(false);
  const [battleOver, setBattleOver] = useState(false);

  const tickRef  = useRef(1);
  const overRef  = useRef(false);
  const kRef     = useRef(team==="karna" ? initMy() : initOpp());
  const aRef     = useRef(team==="arjun" ? initMy() : initOpp());

  useEffect(() => {
    if (overRef.current) return;
    if (timer<=0) {
      overRef.current = true;
      setBattleOver(true);
      const won = team==="karna" ? kRef.current>=aRef.current : aRef.current>=kRef.current;
      setTimeout(() => onResult(won), 1800);
      return;
    }
    const t = setTimeout(() => setTimer(s=>s-1), 1000);
    return () => clearTimeout(t);
  }, [timer, team, onResult]);

  useEffect(() => {
    const t = setInterval(() => {
      if (overRef.current) return;
      const myGain    = rnd(4,11);
      const enemyGain = isGodMode ? rnd(8,16) : rnd(4,11);
      if (team==="karna") { kRef.current+=myGain;    aRef.current+=enemyGain; }
      else                { aRef.current+=myGain;    kRef.current+=enemyGain; }
      setKarna(kRef.current);
      setArjun(aRef.current);

      if (Math.random()>0.48) {
        const isK = Math.random()>0.5;
        const txt  = (isK?EVENTS_KARNA:EVENTS_ARJUN)[rnd(0,4)];
        const id   = tickRef.current++;
        setTickers(p=>[...p.slice(-3),{ id, text:txt, color:isK?"#f87171":"#60a5fa" }]);
        setTimeout(()=>setTickers(p=>p.filter(t=>t.id!==id)),3000);
      }

      const enemyLeading = team==="karna" ? aRef.current>kRef.current : kRef.current>aRef.current;
      if (enemyLeading && Math.random()>0.68) {
        const msg = PRESSURE_MSGS[rnd(0,PRESSURE_MSGS.length-1)];
        setPressure(msg);
        setDanger(true);
        setTimeout(()=>{ setPressure(null); setDanger(false); }, 2600);
      }
    }, 700);
    return () => clearInterval(t);
  }, [team, isGodMode]);

  const mm         = Math.floor(timer/60).toString().padStart(2,"0");
  const ss         = (timer%60).toString().padStart(2,"0");
  const timerColor = timer<=10?"#e74c3c":timer<=20?"#f39c12":"#FFD700";
  const tot        = karnaScore + arjunScore + 1;
  const kPct       = (karnaScore/tot)*100;
  const aPct       = (arjunScore/tot)*100;
  const myScore    = team==="karna"?karnaScore:arjunScore;
  const oppScore   = team==="karna"?arjunScore:karnaScore;
  const iWinning   = myScore >= oppScore;

  return (
    <motion.div className="flex flex-col h-full relative" style={{ background:"#07050f" }}
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>

      {/* Danger flash overlay */}
      <AnimatePresence>
        {dangerFlash && (
          <motion.div className="absolute inset-0 pointer-events-none z-30"
            style={{ background:"rgba(239,68,68,0.07)", border:"2px solid rgba(239,68,68,0.3)" }}
            initial={{ opacity:0 }} animate={{ opacity:[0,1,0.5,1,0] }} exit={{ opacity:0 }}
            transition={{ duration:0.6 }} />
        )}
      </AnimatePresence>

      {/* Pressure popup */}
      <AnimatePresence>
        {pressure && (
          <motion.div className="absolute top-20 left-1/2 z-50 -translate-x-1/2 px-5 py-2.5 rounded-2xl font-black text-sm whitespace-nowrap"
            style={{ background:"rgba(220,38,38,0.28)", border:"2px solid rgba(239,68,68,0.75)", color:"#fca5a5",
              boxShadow:"0 0 28px rgba(239,68,68,0.7)", backdropFilter:"blur(10px)" }}
            initial={{ opacity:0, y:-22, scale:0.78 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:-22, scale:0.78 }} transition={{ type:"spring", stiffness:300, damping:20 }}>
            {pressure}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color:"rgba(255,255,255,0.35)" }}>
          {isGodMode && <span className="mr-1 text-[10px] font-black" style={{ color:"#f87171" }}>⚡GOD </span>}₹{room.entryFee}
        </div>
        <motion.div className="font-black text-2xl tabular-nums"
          style={{ color:timerColor, textShadow:`0 0 14px ${timerColor}99` }}
          animate={timer<=10?{scale:[1,1.28,1]}:{}} transition={{ duration:0.5, repeat:Infinity }}>
          ⏱ {mm}:{ss}
        </motion.div>
        <div className="text-xs font-bold" style={{ color:iWinning?"#27ae60":"#e74c3c" }}>
          {iWinning?"✅ WINNING":"⬇️ LOSING"}
        </div>
      </div>

      {/* Scores */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="flex flex-col items-start">
            <span className="text-xs font-black" style={{ color:TEAM.karna.color }}>🔥 KARNA</span>
            <motion.span className="text-2xl font-black tabular-nums" style={{ color:TEAM.karna.color }}
              key={karnaScore} initial={{ scale:1.15 }} animate={{ scale:1 }} transition={{ duration:0.2 }}>
              {karnaScore}
            </motion.span>
          </div>
          <motion.div className="text-[10px] font-black px-3 py-1 rounded-full"
            style={{ background:"rgba(255,255,255,0.06)",
              color:karnaScore>arjunScore?"#f87171":"#60a5fa",
              border:"1px solid rgba(255,255,255,0.1)" }}
            animate={{ opacity:[0.6,1,0.6] }} transition={{ duration:1, repeat:Infinity }}>
            {karnaScore>arjunScore?"🔥 KARNA LEADS":arjunScore>karnaScore?"⚡ ARJUN LEADS":"🔥 DRAW"}
          </motion.div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-black" style={{ color:TEAM.arjun.color }}>ARJUN ⚡</span>
            <motion.span className="text-2xl font-black tabular-nums" style={{ color:TEAM.arjun.color }}
              key={arjunScore} initial={{ scale:1.15 }} animate={{ scale:1 }} transition={{ duration:0.2 }}>
              {arjunScore}
            </motion.span>
          </div>
        </div>
        <div className="flex h-5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.07)" }}>
          <motion.div className="h-full flex items-center justify-end pr-1"
            style={{ background:"linear-gradient(90deg,#e74c3c,#c0392b)" }}
            animate={{ width:`${kPct}%` }} transition={{ type:"spring", stiffness:50, damping:16 }}>
            {kPct>18&&<span className="text-[9px] font-black text-white">{Math.round(kPct)}%</span>}
          </motion.div>
          <motion.div className="h-full flex items-center justify-start pl-1"
            style={{ background:"linear-gradient(90deg,#2563eb,#60a5fa)" }}
            animate={{ width:`${aPct}%` }} transition={{ type:"spring", stiffness:50, damping:16 }}>
            {aPct>18&&<span className="text-[9px] font-black text-white">{Math.round(aPct)}%</span>}
          </motion.div>
        </div>
      </div>

      {/* Arena */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background:`radial-gradient(ellipse at 25% 50%,${TEAM.karna.bg} 0%,transparent 50%),radial-gradient(ellipse at 75% 50%,${TEAM.arjun.bg} 0%,transparent 50%)` }} />

        <div className="flex-1 flex items-center justify-center gap-8 relative z-10">
          {/* Karna warrior */}
          <motion.div className="flex flex-col items-center gap-2"
            animate={team==="karna"&&!battleOver?{y:[0,-6,0]}:{}} transition={{ duration:0.72, repeat:Infinity }}>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl relative"
              style={{ background:TEAM.karna.bg, border:`2px solid ${TEAM.karna.color}66`, boxShadow:`0 0 26px ${TEAM.karna.glow}55` }}>
              ⚔️
              {team==="karna"&&(
                <motion.div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background:"#FFD700", color:"#000" }}
                  animate={{ scale:[1,1.28,1] }} transition={{ duration:0.9, repeat:Infinity }}>👑</motion.div>
              )}
              <motion.div className="absolute -bottom-1 -left-1 text-base"
                animate={{ scale:[1,1.55,1], opacity:[0.65,1,0.65] }} transition={{ duration:0.52, repeat:Infinity }}>🔥</motion.div>
            </div>
            <span className="text-xs font-black" style={{ color:TEAM.karna.color }}>
              {team==="karna"?"← YOU":"KARNA"}
            </span>
          </motion.div>

          <div className="flex flex-col items-center gap-0.5">
            <motion.div className="text-4xl" animate={{ scale:[0.82,1.3,0.82], opacity:[0.55,1,0.55] }} transition={{ duration:0.52, repeat:Infinity }}>⚡</motion.div>
            <motion.div className="text-sm font-black" style={{ color:"#FFD700", textShadow:"0 0 14px rgba(255,215,0,0.95)" }}
              animate={{ scale:[1,1.22,1] }} transition={{ duration:0.72, repeat:Infinity }}>VS</motion.div>
            <motion.div className="text-4xl" animate={{ scale:[0.82,1.3,0.82], opacity:[0.55,1,0.55] }} transition={{ duration:0.52, repeat:Infinity, delay:0.26 }}>🔥</motion.div>
            {battleOver && (
              <motion.div className="text-xs font-black px-2 py-1 rounded-full mt-1"
                style={{ background:"rgba(231,76,60,0.2)", color:"#f87171", border:"1px solid rgba(231,76,60,0.4)" }}
                initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:"spring" }}>
                TIME'S UP
              </motion.div>
            )}
          </div>

          {/* Arjun warrior */}
          <motion.div className="flex flex-col items-center gap-2"
            animate={team==="arjun"&&!battleOver?{y:[0,-6,0]}:{}} transition={{ duration:0.72, repeat:Infinity }}>
            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl relative"
              style={{ background:TEAM.arjun.bg, border:`2px solid ${TEAM.arjun.color}66`, boxShadow:`0 0 26px ${TEAM.arjun.glow}55` }}>
              🛡️
              {team==="arjun"&&(
                <motion.div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background:"#FFD700", color:"#000" }}
                  animate={{ scale:[1,1.28,1] }} transition={{ duration:0.9, repeat:Infinity }}>👑</motion.div>
              )}
              <motion.div className="absolute -bottom-1 -right-1 text-base"
                animate={{ scale:[1,1.55,1], opacity:[0.65,1,0.65] }} transition={{ duration:0.52, repeat:Infinity, delay:0.26 }}>⚡</motion.div>
            </div>
            <span className="text-xs font-black" style={{ color:TEAM.arjun.color }}>
              {team==="arjun"?"YOU →":"ARJUN"}
            </span>
          </motion.div>
        </div>

        {/* Live ticker */}
        <div className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-1.5 pointer-events-none px-4">
          <AnimatePresence>
            {tickers.slice(-3).map((tick) => (
              <motion.div key={tick.id} className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background:"rgba(0,0,0,0.78)", border:`1px solid ${tick.color}55`, color:tick.color, backdropFilter:"blur(8px)" }}
                initial={{ opacity:0, y:14, scale:0.82 }} animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-10, scale:0.82 }} transition={{ duration:0.2 }}>
                {tick.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* My team bar */}
      <div className="px-4 py-3 shrink-0" style={{ background:tc.bg, borderTop:`1px solid ${tc.color}44` }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{tc.warrior}</span>
            <div>
              <div className="text-xs font-black" style={{ color:tc.color }}>{tc.name}</div>
              <div className="text-[10px]" style={{ color:"rgba(255,255,255,0.28)" }}>Your team</div>
            </div>
          </div>
          <div className="text-center">
            <div className="text-[9px]" style={{ color:"rgba(255,255,255,0.28)" }}>AVG</div>
            <div className="text-sm font-black" style={{ color:"rgba(255,255,255,0.55)" }}>{Math.round(myScore*0.84)}</div>
          </div>
          <div className="text-right">
            <motion.div className="text-2xl font-black tabular-nums" style={{ color:tc.color }}
              key={myScore} initial={{ scale:1.2 }} animate={{ scale:1 }} transition={{ duration:0.2 }}>
              {myScore}
            </motion.div>
            <div className="text-[10px]" style={{ color:"rgba(255,255,255,0.28)" }}>vs {oppScore} opp</div>
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
      initial={{ opacity:0, scale:0.94 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
      style={{ background:"linear-gradient(160deg,#0f0002 0%,#07050f 50%,#00000f 100%)" }}>

      <motion.div className="text-7xl"
        animate={{ scale:[1,1.2,1], rotate:won?[0,9,-9,0]:[0] }} transition={{ duration:0.58, repeat:3 }}>
        {won?"🏆":"💔"}
      </motion.div>

      <div className="text-center">
        <motion.div className="text-3xl font-black"
          style={{ color:won?"#FFD700":"#f87171", textShadow:won?"0 0 26px rgba(255,215,0,0.65)":"0 0 22px rgba(248,113,113,0.55)" }}
          animate={{ scale:[1,1.05,1] }} transition={{ duration:1.2, repeat:Infinity }}>
          {won?"VICTORY! ⚔️":"DEFEAT 💔"}
        </motion.div>
        <div className="text-sm mt-1" style={{ color:"rgba(255,255,255,0.38)" }}>
          {tc.name} {won?"won the World War!":"fought with honour"}
        </div>
      </div>

      <div className="w-full rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.03)" }}>
        <div className="py-2 text-center text-xs font-black tracking-widest"
          style={{ background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.35)", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          BATTLE SUMMARY
        </div>
        <div className="grid grid-cols-2 divide-x" style={{ borderColor:"rgba(255,255,255,0.07)" }}>
          {(["karna","arjun"] as Team[]).map((t) => {
            const cfg   = TEAM[t];
            const isMe  = t===team;
            const isWon = won ? t===team : t!==team;
            return (
              <div key={t} className="flex flex-col items-center py-4" style={{ background:isMe?cfg.bg:"transparent" }}>
                <span className="text-2xl">{cfg.warrior}</span>
                <span className="text-xs font-black mt-1" style={{ color:cfg.color }}>{cfg.name}</span>
                {isMe && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full mt-1" style={{ background:"#FFD700", color:"#000" }}>YOU</span>}
                <span className="text-2xl font-black mt-2 tabular-nums" style={{ color:"rgba(255,255,255,0.82)" }}>{rnd(340,610)}</span>
                {isWon && <span className="text-xs font-black mt-1" style={{ color:"#FFD700" }}>🏆 WINNER</span>}
              </div>
            );
          })}
        </div>
      </div>

      {won ? (
        <motion.div className="w-full py-4 rounded-2xl text-center"
          style={{ background:"rgba(255,215,0,0.1)", border:"2px solid rgba(255,215,0,0.5)", boxShadow:"0 0 34px rgba(255,215,0,0.28)" }}
          animate={{ boxShadow:["0 0 16px rgba(255,215,0,0.15)","0 0 44px rgba(255,215,0,0.55)","0 0 16px rgba(255,215,0,0.15)"] }}
          transition={{ duration:1.4, repeat:Infinity }}>
          <div className="text-xs font-bold mb-1" style={{ color:"rgba(255,215,0,0.6)" }}>💰 YOU WON</div>
          <div className="text-4xl font-black" style={{ color:"#FFD700" }}>₹{prize}</div>
          <div className="text-xs mt-1" style={{ color:"rgba(255,255,255,0.35)" }}>Added to your Winning wallet</div>
        </motion.div>
      ) : (
        <div className="w-full py-3 rounded-2xl text-center"
          style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-sm font-black" style={{ color:"rgba(255,255,255,0.4)" }}>Better luck next time!</p>
          <p className="text-xs mt-0.5" style={{ color:"rgba(255,255,255,0.2)" }}>Try again for ₹{Math.round(room.entryFee*1.8)} prize</p>
        </div>
      )}

      <div className="w-full space-y-3">
        <motion.button whileTap={{ scale:0.97 }} onClick={onPlayAgain}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
          style={{ background:"linear-gradient(135deg,#e74c3c,#3b82f6)", color:"#fff", boxShadow:"0 0 28px rgba(231,76,60,0.45)", letterSpacing:"0.04em" }}>
          <motion.div className="absolute inset-0 pointer-events-none"
            style={{ background:"linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.15) 50%,transparent 60%)" }}
            animate={{ x:["-100%","200%"] }} transition={{ duration:1.8, repeat:Infinity, repeatDelay:1 }} />
          ⚔️ PLAY AGAIN
        </motion.button>
        <motion.button whileTap={{ scale:0.97 }} onClick={onBack}
          className="w-full py-3 rounded-2xl font-black text-sm cursor-pointer"
          style={{ background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.5)", border:"1px solid rgba(255,255,255,0.1)" }}>
          Back to Home
        </motion.button>
      </div>
    </motion.div>
  );
}
