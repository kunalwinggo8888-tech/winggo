import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── CONSTANTS ────────────────────────────────────────────────
type Phase = "lobby" | "matchmaking" | "battle" | "result";
type Team  = "karan" | "arjun";

interface FloatScore { id: number; value: number }
interface LeaderEntry { name: string; score: number; team: Team; isMe?: boolean }

const ENTRY_FEES = [20, 50, 100, 200];
const BATTLE_DURATION = 120;
const MAX_PRIZE_POOL = 1998;

const TEAM: Record<Team, { name: string; color: string; bg: string; glow: string; emoji: string; title: string }> = {
  karan: { name: "KARAN",  color: "#3b82f6", bg: "rgba(59,130,246,0.15)", glow: "rgba(59,130,246,0.55)", emoji: "🔵", title: "Shield of Justice" },
  arjun: { name: "ARJUN",  color: "#f97316", bg: "rgba(249,115,22,0.15)",  glow: "rgba(249,115,22,0.55)",  emoji: "🟠", title: "Blade of Fury" },
};

const FAKE_NAMES = ["Rahul_G","Priya_K","Amit_S","Dev_R","Sneha_M","Rohit_P","Kavya_L","Arjun_T","Meera_V","Varun_D","Pooja_N","Kiran_B","Ankit_J","Divya_C","Sanjay_F"];

function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ─── ROOT ─────────────────────────────────────────────────────
export default function WorldWarGame({ onBack }: { onBack?: () => void }) {
  const [phase, setPhase]       = useState<Phase>("lobby");
  const [team, setTeam]         = useState<Team>("karan");
  const [entryFee, setEntryFee] = useState(50);
  const [playerCount, setPlayerCount] = useState(rnd(86, 98));

  // bump player count slowly
  useEffect(() => {
    const t = setInterval(() => setPlayerCount((c) => c < 148 ? c + rnd(1, 3) : c), 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#070510", maxWidth: 480, margin: "0 auto" }}>
      <AnimatePresence mode="wait">
        {phase === "lobby" && (
          <LobbyPhase key="lobby" team={team} setTeam={setTeam} entryFee={entryFee} setEntryFee={setEntryFee}
            playerCount={playerCount} onBack={onBack} onStart={() => setPhase("matchmaking")} />
        )}
        {phase === "matchmaking" && (
          <MatchmakingPhase key="matchmaking" team={team} entryFee={entryFee} playerCount={playerCount}
            onReady={() => setPhase("battle")} />
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

// ─── LOBBY ────────────────────────────────────────────────────
function LobbyPhase({ team, setTeam, entryFee, setEntryFee, playerCount, onBack, onStart }: {
  team: Team; setTeam: (t: Team) => void; entryFee: number; setEntryFee: (f: number) => void;
  playerCount: number; onBack?: () => void; onStart: () => void;
}) {
  const prizePool = Math.min(MAX_PRIZE_POOL, entryFee * Math.floor(playerCount * 0.8));
  const cashback  = Math.round(entryFee * 0.1);

  return (
    <motion.div className="flex flex-col h-full overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>

      {/* ── HERO ── */}
      <div className="relative shrink-0 overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0e0020 0%,#180a00 60%,#070510 100%)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>

        {/* animated war sparks */}
        {Array.from({ length: 10 }, (_, i) => (
          <motion.div key={i} className="absolute rounded-full pointer-events-none"
            style={{ width: rnd(3, 6), height: rnd(3, 6), left: `${rnd(5, 95)}%`, top: `${rnd(5, 80)}%`,
              background: i % 2 === 0 ? TEAM.karan.color : TEAM.arjun.color }}
            animate={{ opacity: [0, 1, 0], y: [0, -24] }}
            transition={{ duration: 1.4 + Math.random(), delay: Math.random() * 1.5, repeat: Infinity }} />
        ))}

        <button onClick={onBack} className="absolute top-4 left-4 text-xs font-bold cursor-pointer"
          style={{ color: "rgba(255,255,255,0.35)" }}>← Back</button>

        <div className="flex flex-col items-center pt-10 pb-5 px-4">
          {/* LIVE badge + player count */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-black px-3 py-1 rounded-full"
              style={{ background: "rgba(231,76,60,0.18)", border: "1px solid rgba(231,76,60,0.4)", color: "#e74c3c" }}>
              🔴 LIVE WAR
            </span>
            <motion.span className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
              animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.6, repeat: Infinity }}>
              👥 {playerCount}+ joining
            </motion.span>
          </div>

          <h1 className="text-3xl font-black text-white tracking-tight text-center leading-tight">WINGGO WORLD WAR</h1>
          <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "rgba(255,200,0,0.65)" }}>
            Karan vs Arjun · Team Battle
          </p>

          {/* Prize pool */}
          <motion.div className="mt-4 px-6 py-3 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,0.08)", border: "1.5px solid rgba(255,215,0,0.3)" }}
            animate={{ boxShadow: ["0 0 0 rgba(255,215,0,0)", "0 0 18px rgba(255,215,0,0.25)", "0 0 0 rgba(255,215,0,0)"] }}
            transition={{ duration: 2, repeat: Infinity }}>
            <div className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>💰 Prize Pool Up To</div>
            <div className="text-2xl font-black" style={{ color: "#FFD700" }}>₹{prizePool.toLocaleString("en-IN")}</div>
          </motion.div>
        </div>
      </div>

      {/* ── TEAM SELECTION ── */}
      <div className="px-4 mt-5">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          🛡️ Choose Your Team
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(["karan", "arjun"] as Team[]).map((t) => {
            const tw = TEAM[t];
            const active = team === t;
            return (
              <motion.button key={t} whileTap={{ scale: 0.94 }} onClick={() => setTeam(t)}
                className="flex flex-col items-center gap-2 py-4 rounded-2xl cursor-pointer"
                style={{
                  background: active ? tw.bg : "rgba(255,255,255,0.03)",
                  border: active ? `2px solid ${tw.color}` : "1px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? `0 0 20px ${tw.glow}` : "none",
                  transition: "all 0.2s",
                }}>
                <span className="text-4xl">{tw.emoji}</span>
                <span className="font-black text-base" style={{ color: active ? tw.color : "rgba(255,255,255,0.45)" }}>{tw.name}</span>
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{tw.title}</span>
                {active && (
                  <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: tw.color, color: "#fff" }}>✔ YOUR TEAM</span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── ENTRY FEE ── */}
      <div className="px-4 mt-5">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          💸 Entry Fee
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ENTRY_FEES.map((fee) => (
            <motion.button key={fee} whileTap={{ scale: 0.92 }} onClick={() => setEntryFee(fee)}
              className="py-3 rounded-2xl text-sm font-black cursor-pointer"
              style={{
                background: entryFee === fee ? "linear-gradient(135deg,#FFD700,#ff8c00)" : "rgba(255,255,255,0.05)",
                border: entryFee === fee ? "none" : "1px solid rgba(255,255,255,0.1)",
                color: entryFee === fee ? "#000" : "rgba(255,255,255,0.55)",
                boxShadow: entryFee === fee ? "0 0 16px rgba(255,215,0,0.35)" : "none",
              }}>
              ₹{fee}
            </motion.button>
          ))}
        </div>

        {/* cashback badge */}
        <div className="mt-3 py-2 px-4 rounded-xl flex items-center gap-2"
          style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}>
          <span>🎁</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            Bonus cashback <span style={{ color: "#27ae60" }}>₹{cashback}</span> on this entry
          </span>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div className="px-4 mt-4 grid grid-cols-2 gap-2">
        {[["⚡","Fast 2 Min Match"],["🏆","Win Big Cash"],["📊","Live Leaderboard"],["🎯","Fair Gameplay"],["💣","All Score System"],["🔥","Daily Rewards"]].map(([icon, text]) => (
          <div key={text} className="flex items-center gap-2 py-2 px-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-sm">{icon}</span>
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.45)" }}>{text}</span>
          </div>
        ))}
      </div>

      {/* ── CTA ── */}
      <div className="px-4 mt-5 mb-8">
        <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.02 }} onClick={onStart}
          className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer"
          style={{
            background: `linear-gradient(135deg, ${TEAM[team].color} 0%, ${team === "karan" ? "#1d4ed8" : "#ea580c"} 100%)`,
            color: "#fff", boxShadow: `0 0 28px ${TEAM[team].glow}`, letterSpacing: "0.05em",
          }}>
          ⚔️ JOIN BATTLE — ₹{entryFee}
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── MATCHMAKING ──────────────────────────────────────────────
function MatchmakingPhase({ team, entryFee, playerCount, onReady }: {
  team: Team; entryFee: number; playerCount: number; onReady: () => void;
}) {
  const [filled, setFilled] = useState(4);
  const [countdown, setCountdown] = useState<number | null>(null);
  const tw = TEAM[team];
  const ot = TEAM[team === "karan" ? "arjun" : "karan"];

  const karanPlayers = ["You", ...FAKE_NAMES.slice(0, 4)];
  const arjunPlayers = FAKE_NAMES.slice(5, 10);

  useEffect(() => {
    if (filled >= 10) {
      setCountdown(3);
      return;
    }
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
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* Entry badge */}
      <div className="text-xs font-bold px-4 py-1.5 rounded-full"
        style={{ background: "rgba(255,215,0,0.09)", border: "1px solid rgba(255,215,0,0.25)", color: "#FFD700" }}>
        Entry ₹{entryFee} · {playerCount}+ players in room
      </div>

      {/* Teams */}
      <div className="w-full grid grid-cols-2 gap-3">
        {/* Karan team */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${TEAM.karan.color}55` }}>
          <div className="text-center py-2 text-xs font-black" style={{ background: TEAM.karan.bg, color: TEAM.karan.color }}>
            {TEAM.karan.emoji} KARAN
          </div>
          <div className="py-2 px-3 space-y-1.5">
            {karanPlayers.slice(0, Math.min(5, Math.ceil(filled / 2))).map((name, i) => (
              <motion.div key={name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-black text-white"
                  style={{ background: TEAM.karan.color }}>
                  {name[0]}
                </div>
                <span className="text-xs font-bold" style={{ color: name === "You" ? "#FFD700" : "rgba(255,255,255,0.55)" }}>{name}</span>
                {name === "You" && <span className="text-xs ml-auto" style={{ color: TEAM.karan.color }}>👑</span>}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Arjun team */}
        <div className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${TEAM.arjun.color}55` }}>
          <div className="text-center py-2 text-xs font-black" style={{ background: TEAM.arjun.bg, color: TEAM.arjun.color }}>
            {TEAM.arjun.emoji} ARJUN
          </div>
          <div className="py-2 px-3 space-y-1.5">
            {arjunPlayers.slice(0, Math.min(5, Math.floor(filled / 2))).map((name, i) => (
              <motion.div key={name} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-black text-white"
                  style={{ background: TEAM.arjun.color }}>
                  {name[0]}
                </div>
                <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>{name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        {!showFull ? (
          <>
            <div className="text-sm font-bold text-white">Filling room
              <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>...</motion.span>
            </div>
            {/* progress bar */}
            <div className="mt-3 w-48 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.div className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg,${TEAM.karan.color},${TEAM.arjun.color})` }}
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
  const tw = TEAM[team];
  const ot = TEAM[team === "karan" ? "arjun" : "karan"];

  const [timer, setTimer]             = useState(BATTLE_DURATION);
  const [myScore, setMyScore]         = useState(0);
  const [karanScore, setKaranScore]   = useState(0);
  const [arjunScore, setArjunScore]   = useState(0);
  const [combo, setCombo]             = useState(1);
  const [comboTimer, setComboTimer]   = useState(0);
  const [floats, setFloats]           = useState<FloatScore[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>(() => buildLeaderboard(team, 0));
  const [tapping, setTapping]         = useState(false);
  const [isOver, setIsOver]           = useState(false);

  const nextId    = useRef(1);
  const myRef     = useRef(0);
  const karanRef  = useRef(0);
  const arjunRef  = useRef(0);
  const comboRef  = useRef(1);
  const comboTimeRef = useRef(0);
  const overRef   = useRef(false);

  // timer
  useEffect(() => {
    if (overRef.current) return;
    if (timer <= 0) { overRef.current = true; setIsOver(true); setTimeout(onResult, 1800); return; }
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, onResult]);

  // bot team scores
  useEffect(() => {
    const t = setInterval(() => {
      if (overRef.current) return;
      // karan bots
      const kGain = rnd(2, 6);
      karanRef.current += kGain;
      setKaranScore(karanRef.current);
      // arjun bots
      const aGain = rnd(2, 6);
      arjunRef.current += aGain;
      setArjunScore(arjunRef.current);
      // update leaderboard
      setLeaderboard(buildLeaderboard(team, myRef.current));
    }, 800);
    return () => clearInterval(t);
  }, [team]);

  // combo decay
  useEffect(() => {
    if (comboTimer <= 0) { comboRef.current = 1; setCombo(1); return; }
    const t = setTimeout(() => { comboTimeRef.current--; setComboTimer((c) => c - 1); }, 1000);
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
    myRef.current += pts;
    setMyScore(myRef.current);
    if (team === "karan") { karanRef.current += pts; setKaranScore(karanRef.current); }
    else                  { arjunRef.current += pts; setArjunScore(arjunRef.current); }
    addFloat(pts);
    setTapping(true);
    setTimeout(() => setTapping(false), 120);
    // combo
    const newCombo = Math.min(comboRef.current + 1, 5);
    comboRef.current = newCombo;
    setCombo(newCombo);
    comboTimeRef.current = 2;
    setComboTimer(2);
    setLeaderboard(buildLeaderboard(team, myRef.current));
  }, [addFloat, team]);

  const mm = Math.floor(timer / 60).toString().padStart(2, "0");
  const ss = (timer % 60).toString().padStart(2, "0");
  const timerColor = timer <= 30 ? "#e74c3c" : timer <= 60 ? "#f39c12" : "#FFD700";
  const totalScore = karanScore + arjunScore + 1;
  const karanPct   = (karanScore / totalScore) * 100;
  const arjunPct   = (arjunScore / totalScore) * 100;
  const leading    = karanScore >= arjunScore ? "karan" : "arjun";

  return (
    <motion.div className="flex flex-col h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

      {/* ── TIMER + STATS ROW ── */}
      <div className="flex items-center justify-between px-4 py-2.5 shrink-0"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>Entry ₹{entryFee}</div>
        <motion.div className="font-black text-xl tabular-nums"
          style={{ color: timerColor, textShadow: `0 0 10px ${timerColor}88` }}
          animate={timer <= 10 ? { scale: [1, 1.18, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}>
          ⏱ {mm}:{ss}
        </motion.div>
        <div className="text-xs font-bold" style={{ color: "#FFD700" }}>My: {myScore} pts</div>
      </div>

      {/* ── TEAM SCORE BAR ── */}
      <div className="px-4 pt-3 shrink-0">
        <div className="flex items-center justify-between mb-1.5 text-xs font-black">
          <span style={{ color: TEAM.karan.color }}>{TEAM.karan.emoji} {karanScore}</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
            {TEAM[leading].name} LEADING
          </span>
          <span style={{ color: TEAM.arjun.color }}>{arjunScore} {TEAM.arjun.emoji}</span>
        </div>
        <div className="flex h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
          <motion.div className="h-full" style={{ background: TEAM.karan.color }}
            animate={{ width: `${karanPct}%` }} transition={{ type: "spring", stiffness: 80, damping: 14 }} />
          <motion.div className="h-full" style={{ background: TEAM.arjun.color }}
            animate={{ width: `${arjunPct}%` }} transition={{ type: "spring", stiffness: 80, damping: 14 }} />
        </div>
      </div>

      {/* ── BATTLE ARENA ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden px-4 gap-4">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse at center, ${tw.bg} 0%, #070510 65%)` }} />

        {/* Floating score numbers */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <AnimatePresence>
            {floats.map((f) => (
              <motion.div key={f.id} className="absolute font-black text-2xl"
                style={{ color: tw.color, textShadow: `0 0 10px ${tw.color}` }}
                initial={{ y: 0, opacity: 1, scale: 1 }}
                animate={{ y: -80, opacity: 0, scale: 1.6 }}
                transition={{ duration: 0.85 }}>
                +{f.value}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Warrior display */}
        <motion.div className="relative z-10 flex flex-col items-center gap-2"
          animate={tapping ? { scale: [1, 0.93, 1] } : {}}
          transition={{ duration: 0.12 }}>
          <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
            style={{ background: tw.bg, border: `2px solid ${tw.color}`, boxShadow: `0 0 28px ${tw.glow}, 0 0 56px ${tw.glow}44` }}
            animate={{ scale: tapping ? 0.92 : 1 }} transition={{ duration: 0.1 }}>
            {tw.emoji}
          </motion.div>
          <span className="font-black text-lg" style={{ color: tw.color }}>{tw.name}</span>
        </motion.div>

        {/* Combo badge */}
        <AnimatePresence>
          {combo > 1 && (
            <motion.div className="relative z-10 px-4 py-1.5 rounded-full font-black text-sm"
              style={{ background: "rgba(255,215,0,0.15)", border: "1.5px solid rgba(255,215,0,0.5)", color: "#FFD700" }}
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}>
              🔥 ×{combo} COMBO!
            </motion.div>
          )}
        </AnimatePresence>

        {/* TAP button */}
        <motion.button
          className="relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center gap-1 cursor-pointer select-none"
          style={{
            background: `radial-gradient(circle, ${tw.color}33 0%, ${tw.color}11 100%)`,
            border: `3px solid ${tw.color}`,
            boxShadow: tapping ? `0 0 40px ${tw.glow}, 0 0 80px ${tw.glow}55` : `0 0 20px ${tw.glow}66`,
          }}
          whileTap={{ scale: 0.88 }}
          onPointerDown={handleTap}>
          <span className="text-4xl">⚔️</span>
          <span className="font-black text-white text-sm tracking-wide">TAP!</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Score Points</span>
        </motion.button>

        {/* Game over overlay */}
        <AnimatePresence>
          {isOver && (
            <motion.div className="absolute inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div className="text-4xl font-black text-white text-center"
                initial={{ scale: 0.5 }} animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ type: "spring", stiffness: 260, damping: 14 }}>
                ⏱️ TIME'S UP!
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── LIVE LEADERBOARD ── */}
      <div className="shrink-0 mx-4 mb-3 rounded-2xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-3 py-1.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-xs font-black" style={{ color: "rgba(255,255,255,0.4)" }}>📊 LIVE LEADERBOARD</span>
          <span className="text-xs font-bold" style={{ color: "#FFD700" }}>My Score: {myScore}</span>
        </div>
        {leaderboard.slice(0, 4).map((row, i) => (
          <div key={row.name} className="flex items-center gap-2 px-3 py-2"
            style={{
              background: row.isMe ? "rgba(255,215,0,0.06)" : "transparent",
              borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
            <span className="text-xs font-black w-4" style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.3)" }}>
              {i + 1}
            </span>
            <div className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ background: TEAM[row.team].color }} />
            <span className="flex-1 text-xs font-bold truncate"
              style={{ color: row.isMe ? "#FFD700" : "rgba(255,255,255,0.65)" }}>
              {row.name}
            </span>
            <span className="text-xs font-black" style={{ color: TEAM[row.team].color }}>{row.score} pts</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function buildLeaderboard(myTeam: Team, myScore: number): LeaderEntry[] {
  const names = FAKE_NAMES.slice(0, 9);
  const rows: LeaderEntry[] = names.map((name, i) => ({
    name,
    score: rnd(10, 180) + myScore * 0.4,
    team: i % 2 === 0 ? "karan" : "arjun",
  }));
  rows.push({ name: "You", score: myScore, team: myTeam, isMe: true });
  return rows.sort((a, b) => b.score - a.score).slice(0, 8);
}

// ─── RESULT ───────────────────────────────────────────────────
function ResultPhase({ team, entryFee, onPlayAgain, onBack }: {
  team: Team; entryFee: number; onPlayAgain: () => void; onBack?: () => void;
}) {
  const [myFinalScore]  = useState(() => rnd(120, 340));
  const [winningTeam]   = useState<Team>(() => Math.random() > 0.38 ? team : (team === "karan" ? "arjun" : "karan"));
  const playerWon       = winningTeam === team;
  const tw              = TEAM[winningTeam];
  const cashback        = Math.round(entryFee * 0.1);
  const prize           = playerWon ? Math.round(entryFee * 1.85) : 0;

  const leaderboard: (LeaderEntry & { prize: string })[] = [
    { name: "Rahul_G", score: rnd(380, 420), team: winningTeam, prize: `₹${Math.round(entryFee * 2.4)}` },
    { name: "Priya_K", score: rnd(320, 379), team: winningTeam, prize: `₹${Math.round(entryFee * 2.1)}` },
    { name: "Amit_S",  score: rnd(270, 319), team: winningTeam, prize: `₹${Math.round(entryFee * 1.9)}` },
    { name: "You",     score: myFinalScore,   team,             prize: playerWon ? `₹${prize}` : "—", isMe: true },
    { name: "Dev_R",   score: rnd(90, 140),   team: team === "karan" ? "arjun" : "karan", prize: "—" },
  ];

  return (
    <motion.div className="flex flex-col h-full overflow-y-auto"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>

      {/* ── HERO ── */}
      <div className="relative flex flex-col items-center pt-10 pb-6 shrink-0 overflow-hidden"
        style={{
          background: playerWon ? "linear-gradient(180deg,#0a2010 0%,#070510 100%)" : "linear-gradient(180deg,#200a0a 0%,#070510 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
        {/* confetti */}
        {playerWon && Array.from({ length: 20 }, (_, i) => (
          <motion.div key={i} className="absolute rounded-full pointer-events-none"
            style={{ width: rnd(4, 8), height: rnd(4, 8), left: `${rnd(5, 95)}%`, top: 0,
              background: ["#FFD700","#e74c3c","#27ae60","#3b82f6","#f97316"][i % 5] }}
            initial={{ y: -10, opacity: 1 }} animate={{ y: rnd(80, 200), opacity: 0 }}
            transition={{ delay: Math.random() * 0.8, duration: 1.5 + Math.random() }} />
        ))}

        <motion.div className="text-6xl mb-2"
          initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14, delay: 0.1 }}>
          {playerWon ? "🏆" : "💀"}
        </motion.div>

        <motion.h2 className="text-2xl font-black text-center" style={{ color: playerWon ? "#FFD700" : "#e74c3c" }}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          {playerWon ? "VICTORY!" : "DEFEATED!"}
        </motion.h2>

        <motion.p className="text-sm font-bold mt-1" style={{ color: "rgba(255,255,255,0.4)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          {tw.emoji} {tw.name} team wins the war
        </motion.p>

        {/* Team scores */}
        <motion.div className="mt-4 flex gap-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          {(["karan", "arjun"] as Team[]).map((t) => (
            <div key={t} className="flex flex-col items-center gap-1 px-5 py-3 rounded-2xl"
              style={{ background: TEAM[t].bg, border: `1.5px solid ${TEAM[t].color}55` }}>
              <span className="text-lg">{TEAM[t].emoji}</span>
              <span className="font-black text-sm" style={{ color: TEAM[t].color }}>{TEAM[t].name}</span>
              <span className="font-black text-xl text-white">{rnd(800, 1400)}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>team pts</span>
              {winningTeam === t && <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: TEAM[t].color, color: "#fff" }}>WINNER</span>}
            </div>
          ))}
        </motion.div>

        {/* Prize */}
        {playerWon && (
          <motion.div className="mt-4 py-3 px-8 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,0.09)", border: "1.5px solid rgba(255,215,0,0.35)" }}
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.5, type: "spring" }}>
            <div className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>Your Reward Credited</div>
            <div className="text-3xl font-black" style={{ color: "#FFD700" }}>+₹{prize}</div>
          </motion.div>
        )}
      </div>

      {/* ── CASHBACK ── */}
      <div className="mx-4 mt-4 py-3 px-4 rounded-2xl flex items-center gap-3"
        style={{ background: "rgba(39,174,96,0.07)", border: "1px solid rgba(39,174,96,0.2)" }}>
        <span className="text-xl">🎁</span>
        <div>
          <div className="text-xs font-black text-white">Bonus Cashback!</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>₹{cashback} cashback credited to your wallet</div>
        </div>
        <motion.span className="ml-auto text-xs font-black" style={{ color: "#27ae60" }}
          animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.5, repeat: Infinity }}>
          ✓ ADDED
        </motion.span>
      </div>

      {/* ── LEADERBOARD ── */}
      <div className="px-4 mt-4">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          📊 Final Leaderboard
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {leaderboard.map((row, i) => (
            <div key={row.name} className="flex items-center gap-2.5 px-4 py-3"
              style={{
                background: row.isMe ? "rgba(255,215,0,0.06)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                borderBottom: i < leaderboard.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}>
              <span className="text-sm font-black w-5 text-center"
                style={{ color: i === 0 ? "#FFD700" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.3)" }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: TEAM[row.team].color }} />
              <span className="flex-1 text-sm font-bold truncate"
                style={{ color: row.isMe ? "#FFD700" : "rgba(255,255,255,0.65)" }}>
                {row.name}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>{Math.round(row.score)} pts</span>
              <span className="text-xs font-black w-14 text-right"
                style={{ color: row.prize !== "—" ? "#27ae60" : "rgba(255,255,255,0.25)" }}>
                {row.prize}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── DAILY BONUS ── */}
      <div className="mx-4 mt-3 py-3 px-4 rounded-2xl flex items-center gap-3"
        style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)" }}>
        <span className="text-xl">🌟</span>
        <div>
          <div className="text-xs font-black text-white">Daily Rewards Available!</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Refer friends & earn unlimited bonus daily</div>
        </div>
        <span className="ml-auto text-xs font-black" style={{ color: "#FFD700" }}>CLAIM →</span>
      </div>

      {/* ── CTAs ── */}
      <div className="px-4 mt-5 mb-8 flex gap-3">
        <motion.button whileTap={{ scale: 0.97 }} onClick={onPlayAgain}
          className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{ background: `linear-gradient(135deg,${TEAM[team].color},${team === "karan" ? "#1d4ed8" : "#ea580c"})`, color: "#fff", boxShadow: `0 0 20px ${TEAM[team].glow}` }}>
          ⚔️ Play Again
        </motion.button>
        <motion.button whileTap={{ scale: 0.97 }} onClick={onBack}
          className="py-4 px-5 rounded-2xl font-black text-sm cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>
          🏠 Home
        </motion.button>
      </div>
    </motion.div>
  );
}
