import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────
type Phase = "lobby" | "matchmaking" | "battle" | "result";
type Warrior = "karan" | "arjun";

interface FloatingNum { id: number; value: number; x: number; isPlayer: boolean }
interface LogEntry   { id: number; text: string; color: string }

const ENTRY_FEES = [1, 5, 10, 50];
const MAX_HP = 100;
const BATTLE_DURATION = 120; // seconds

const WARRIORS: Record<Warrior, { name: string; emoji: string; color: string; glow: string; title: string }> = {
  karan: {
    name: "KARAN",
    emoji: "🛡️",
    color: "#e74c3c",
    glow: "rgba(231,76,60,0.6)",
    title: "The Shield Warrior",
  },
  arjun: {
    name: "ARJUN",
    emoji: "⚔️",
    color: "#3498db",
    glow: "rgba(52,152,219,0.6)",
    title: "The Blade Master",
  },
};

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function WorldWarGame({ onBack }: { onBack?: () => void }) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [chosenWarrior, setChosenWarrior] = useState<Warrior>("karan");
  const [entryFee, setEntryFee] = useState(10);

  const opponent: Warrior = chosenWarrior === "karan" ? "arjun" : "karan";

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#09060f", maxWidth: 480, margin: "0 auto" }}
    >
      <AnimatePresence mode="wait">
        {phase === "lobby" && (
          <LobbyPhase
            key="lobby"
            chosenWarrior={chosenWarrior}
            setChosenWarrior={setChosenWarrior}
            entryFee={entryFee}
            setEntryFee={setEntryFee}
            onBack={onBack}
            onStart={() => setPhase("matchmaking")}
          />
        )}
        {phase === "matchmaking" && (
          <MatchmakingPhase
            key="matchmaking"
            chosenWarrior={chosenWarrior}
            opponent={opponent}
            entryFee={entryFee}
            onReady={() => setPhase("battle")}
          />
        )}
        {phase === "battle" && (
          <BattlePhase
            key="battle"
            chosenWarrior={chosenWarrior}
            opponent={opponent}
            entryFee={entryFee}
            onResult={() => setPhase("result")}
          />
        )}
        {phase === "result" && (
          <ResultPhase
            key="result"
            chosenWarrior={chosenWarrior}
            opponent={opponent}
            entryFee={entryFee}
            onPlayAgain={() => setPhase("lobby")}
            onBack={onBack}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LOBBY ────────────────────────────────────────────────────
function LobbyPhase({
  chosenWarrior, setChosenWarrior, entryFee, setEntryFee, onBack, onStart,
}: {
  chosenWarrior: Warrior;
  setChosenWarrior: (w: Warrior) => void;
  entryFee: number;
  setEntryFee: (f: number) => void;
  onBack?: () => void;
  onStart: () => void;
}) {
  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Hero banner */}
      <div
        className="relative flex flex-col items-center pt-10 pb-6 shrink-0"
        style={{
          background: "linear-gradient(180deg, #1a0505 0%, #09060f 100%)",
          borderBottom: "1px solid rgba(231,76,60,0.2)",
        }}
      >
        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-4 left-4 flex items-center gap-1 text-xs font-bold cursor-pointer"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          ← Back
        </button>

        {/* LIVE badge */}
        <span
          className="text-xs font-black px-3 py-1 rounded-full mb-3"
          style={{ background: "rgba(231,76,60,0.15)", border: "1px solid rgba(231,76,60,0.4)", color: "#e74c3c" }}
        >
          🔴 LIVE BATTLE
        </span>

        <h1 className="font-black text-3xl tracking-tight text-white text-center leading-tight">
          WORLD WAR
        </h1>
        <p className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "rgba(255,200,0,0.7)" }}>
          Karan vs Arjun
        </p>

        {/* VS divider row */}
        <div className="flex items-center justify-center gap-6 mt-6 w-full px-8">
          <WarriorCard warrior="karan" selected={chosenWarrior === "karan"} onSelect={() => setChosenWarrior("karan")} />
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-black text-white">VS</span>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Choose Side</span>
          </div>
          <WarriorCard warrior="arjun" selected={chosenWarrior === "arjun"} onSelect={() => setChosenWarrior("arjun")} />
        </div>
      </div>

      {/* Entry fees */}
      <div className="px-5 mt-5">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
          Select Entry Fee
        </p>
        <div className="grid grid-cols-4 gap-2">
          {ENTRY_FEES.map((fee) => (
            <motion.button
              key={fee}
              whileTap={{ scale: 0.93 }}
              onClick={() => setEntryFee(fee)}
              className="py-3 rounded-2xl text-sm font-black cursor-pointer"
              style={{
                background: entryFee === fee
                  ? "linear-gradient(135deg, #FFD700, #ff8c00)"
                  : "rgba(255,255,255,0.05)",
                border: entryFee === fee
                  ? "none"
                  : "1px solid rgba(255,255,255,0.1)",
                color: entryFee === fee ? "#000" : "rgba(255,255,255,0.6)",
                boxShadow: entryFee === fee ? "0 0 16px rgba(255,215,0,0.35)" : "none",
              }}
            >
              ₹{fee}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Features list */}
      <div className="px-5 mt-5 grid grid-cols-2 gap-2">
        {[
          ["⚡", "Fast 2 Min Battle"],
          ["🏆", "Winner Takes Reward"],
          ["🎯", "Strategy + Skill"],
          ["💸", "Instant Payout"],
          ["👥", "Real-Time Fight"],
          ["📊", "Leaderboard System"],
        ].map(([icon, text]) => (
          <div key={text} className="flex items-center gap-2 py-2 px-3 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-base">{icon}</span>
            <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.5)" }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Prize info */}
      <div className="mx-5 mt-4 p-3 rounded-2xl flex items-center justify-between"
        style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.18)" }}>
        <div>
          <div className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>Entry</div>
          <div className="text-lg font-black text-white">₹{entryFee}</div>
        </div>
        <span className="text-xl">⚔️</span>
        <div className="text-right">
          <div className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>Win Up To</div>
          <div className="text-lg font-black" style={{ color: "#FFD700" }}>₹{(entryFee * 1.9).toFixed(0)}</div>
        </div>
      </div>

      {/* Find Battle CTA */}
      <div className="px-5 mt-5 mb-8">
        <motion.button
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.02 }}
          onClick={onStart}
          className="w-full py-4 rounded-2xl font-black text-lg text-black cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
            boxShadow: "0 0 28px rgba(231,76,60,0.5), 0 4px 20px rgba(0,0,0,0.4)",
            color: "#fff",
            letterSpacing: "0.05em",
          }}
        >
          ⚔️ FIND BATTLE
        </motion.button>
      </div>
    </motion.div>
  );
}

function WarriorCard({ warrior, selected, onSelect }: { warrior: Warrior; selected: boolean; onSelect: () => void }) {
  const w = WARRIORS[warrior];
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onSelect}
      className="flex-1 flex flex-col items-center gap-2 py-4 px-2 rounded-2xl cursor-pointer"
      style={{
        background: selected ? `${w.color}18` : "rgba(255,255,255,0.04)",
        border: selected ? `2px solid ${w.color}` : "1px solid rgba(255,255,255,0.08)",
        boxShadow: selected ? `0 0 18px ${w.glow}` : "none",
        transition: "all 0.2s",
      }}
    >
      <span className="text-4xl">{w.emoji}</span>
      <span className="text-sm font-black" style={{ color: selected ? w.color : "rgba(255,255,255,0.5)" }}>{w.name}</span>
      <span className="text-xs text-center leading-tight" style={{ color: "rgba(255,255,255,0.3)", fontSize: "9px" }}>{w.title}</span>
      {selected && (
        <span className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: w.color, color: "#fff" }}>YOU</span>
      )}
    </motion.button>
  );
}

// ─── MATCHMAKING ──────────────────────────────────────────────
function MatchmakingPhase({
  chosenWarrior, opponent, entryFee, onReady,
}: { chosenWarrior: Warrior; opponent: Warrior; entryFee: number; onReady: () => void }) {
  const [dots, setDots] = useState(".");
  const [found, setFound] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const pw = WARRIORS[chosenWarrior];
  const ow = WARRIORS[opponent];

  useEffect(() => {
    const dot = setInterval(() => setDots((d) => (d.length >= 3 ? "." : d + ".")), 500);
    const find = setTimeout(() => { setFound(true); clearInterval(dot); }, 3200);
    return () => { clearInterval(dot); clearTimeout(find); };
  }, []);

  useEffect(() => {
    if (!found) return;
    if (countdown === 0) { onReady(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [found, countdown, onReady]);

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-8 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Entry fee badge */}
      <div className="text-xs font-bold px-4 py-1.5 rounded-full"
        style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)", color: "#FFD700" }}>
        Entry ₹{entryFee} · Win ₹{(entryFee * 1.9).toFixed(0)}
      </div>

      {/* Warriors row */}
      <div className="flex items-center w-full gap-4">
        {/* Player */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <motion.div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{ background: `${pw.color}22`, border: `2px solid ${pw.color}`, boxShadow: `0 0 20px ${pw.glow}` }}
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            {pw.emoji}
          </motion.div>
          <span className="font-black text-white text-sm">{pw.name}</span>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: pw.color, color: "#fff" }}>YOU</span>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center gap-1">
          <motion.span
            className="text-3xl font-black text-white"
            animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            VS
          </motion.span>
        </div>

        {/* Opponent */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <motion.div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
            style={{
              background: found ? `${ow.color}22` : "rgba(255,255,255,0.05)",
              border: found ? `2px solid ${ow.color}` : "2px solid rgba(255,255,255,0.1)",
              boxShadow: found ? `0 0 20px ${ow.glow}` : "none",
            }}
            animate={found ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 1.4, repeat: Infinity }}
          >
            {found ? ow.emoji : (
              <motion.span
                className="text-2xl"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                ⏳
              </motion.span>
            )}
          </motion.div>
          <span className="font-black text-sm" style={{ color: found ? "white" : "rgba(255,255,255,0.3)" }}>
            {found ? ow.name : "???"}
          </span>
          {found && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: ow.color, color: "#fff" }}>BOT</span>}
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        {!found ? (
          <>
            <div className="text-base font-bold text-white">Searching for opponent{dots}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Live matchmaking in progress</div>
          </>
        ) : (
          <>
            <motion.div
              className="text-xl font-black text-white"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              Opponent Found! 🎯
            </motion.div>
            <div className="text-3xl font-black mt-2" style={{ color: "#FFD700" }}>{countdown > 0 ? countdown : "GO!"}</div>
            <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>Battle starts in {countdown}s</div>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ─── BATTLE ───────────────────────────────────────────────────
function BattlePhase({
  chosenWarrior, opponent, entryFee, onResult,
}: { chosenWarrior: Warrior; opponent: Warrior; entryFee: number; onResult: () => void }) {
  const pw = WARRIORS[chosenWarrior];
  const ow = WARRIORS[opponent];

  const [playerHP, setPlayerHP] = useState(MAX_HP);
  const [botHP, setBotHP] = useState(MAX_HP);
  const [timer, setTimer] = useState(BATTLE_DURATION);
  const [floatingNums, setFloatingNums] = useState<FloatingNum[]>([]);
  const [log, setLog] = useState<LogEntry[]>([{ id: 0, text: "⚔️ Battle begins!", color: "#FFD700" }]);
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeBot, setShakeBot] = useState(false);
  const [attackCool, setAttackCool] = useState(false);
  const [shieldCool, setShieldCool] = useState(false);
  const [specialCool, setSpecialCool] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [specialCoolLeft, setSpecialCoolLeft] = useState(0);
  const [shieldCoolLeft, setShieldCoolLeft] = useState(0);
  const [winner, setWinner] = useState<"player" | "bot" | null>(null);

  const nextId = useRef(1);
  const playerHPRef = useRef(MAX_HP);
  const botHPRef = useRef(MAX_HP);
  const shieldRef = useRef(false);
  const overRef = useRef(false);

  const addLog = useCallback((text: string, color = "rgba(255,255,255,0.6)") => {
    setLog((prev) => [...prev.slice(-20), { id: nextId.current++, text, color }]);
  }, []);

  const addFloat = useCallback((value: number, isPlayer: boolean) => {
    const id = nextId.current++;
    setFloatingNums((prev) => [...prev, { id, value, x: Math.random() * 60 + 20, isPlayer }]);
    setTimeout(() => setFloatingNums((prev) => prev.filter((f) => f.id !== id)), 1200);
  }, []);

  const endGame = useCallback((w: "player" | "bot") => {
    if (overRef.current) return;
    overRef.current = true;
    setWinner(w);
    setTimeout(onResult, 2200);
  }, [onResult]);

  // Timer
  useEffect(() => {
    if (overRef.current) return;
    if (timer <= 0) {
      endGame(playerHPRef.current >= botHPRef.current ? "player" : "bot");
      return;
    }
    const t = setTimeout(() => setTimer((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, endGame]);

  // Bot attacks
  useEffect(() => {
    const attack = () => {
      if (overRef.current) return;
      const dmg = Math.floor(Math.random() * 10) + 6;
      const reduced = shieldRef.current ? Math.floor(dmg * 0.5) : dmg;
      shieldRef.current = false;
      setShieldActive(false);
      playerHPRef.current = Math.max(0, playerHPRef.current - reduced);
      setPlayerHP(playerHPRef.current);
      setShakePlayer(true);
      setTimeout(() => setShakePlayer(false), 400);
      addFloat(reduced, true);
      addLog(`🗡️ ${ow.name} attacks! −${reduced} HP${reduced < dmg ? " (blocked!)" : ""}`, ow.color);
      if (playerHPRef.current <= 0) endGame("bot");
    };
    const t = setInterval(attack, Math.random() * 1500 + 1800);
    return () => clearInterval(t);
  }, [addFloat, addLog, endGame, ow.color, ow.name]);

  const playerAttack = useCallback((type: "normal" | "shield" | "special") => {
    if (overRef.current) return;

    if (type === "normal" && !attackCool) {
      const dmg = Math.floor(Math.random() * 8) + 8;
      botHPRef.current = Math.max(0, botHPRef.current - dmg);
      setBotHP(botHPRef.current);
      setShakeBot(true);
      setTimeout(() => setShakeBot(false), 400);
      addFloat(dmg, false);
      addLog(`⚔️ You attacked! −${dmg} HP`, pw.color);
      if (botHPRef.current <= 0) endGame("player");
      setAttackCool(true);
      setTimeout(() => setAttackCool(false), 600);
    }

    if (type === "shield" && !shieldCool) {
      shieldRef.current = true;
      setShieldActive(true);
      setShieldCool(true);
      setShieldCoolLeft(8);
      addLog("🛡️ Shield activated! Next hit blocked 50%", "#27ae60");
      const interval = setInterval(() => setShieldCoolLeft((c) => { if (c <= 1) { clearInterval(interval); setShieldCool(false); } return c - 1; }), 1000);
    }

    if (type === "special" && !specialCool) {
      const dmg = Math.floor(Math.random() * 12) + 22;
      botHPRef.current = Math.max(0, botHPRef.current - dmg);
      setBotHP(botHPRef.current);
      setShakeBot(true);
      setTimeout(() => setShakeBot(false), 600);
      addFloat(dmg, false);
      addLog(`💥 SPECIAL ATTACK! −${dmg} HP`, "#FFD700");
      if (botHPRef.current <= 0) endGame("player");
      setSpecialCool(true);
      setSpecialCoolLeft(15);
      const interval = setInterval(() => setSpecialCoolLeft((c) => { if (c <= 1) { clearInterval(interval); setSpecialCool(false); } return c - 1; }), 1000);
    }
  }, [attackCool, shieldCool, specialCool, pw.color, addFloat, addLog, endGame]);

  const mm = Math.floor(timer / 60).toString().padStart(2, "0");
  const ss = (timer % 60).toString().padStart(2, "0");
  const timerColor = timer <= 30 ? "#e74c3c" : timer <= 60 ? "#f39c12" : "#FFD700";

  return (
    <motion.div
      className="flex flex-col h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Top bar — timer + entry */}
      <div
        className="flex items-center justify-between px-5 py-3 shrink-0"
        style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
          Entry ₹{entryFee}
        </span>
        <motion.div
          className="font-black text-xl tabular-nums"
          style={{ color: timerColor, textShadow: `0 0 12px ${timerColor}88` }}
          animate={timer <= 10 ? { scale: [1, 1.15, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          ⏱ {mm}:{ss}
        </motion.div>
        <span className="text-xs font-bold" style={{ color: "#FFD700" }}>
          Win ₹{(entryFee * 1.9).toFixed(0)}
        </span>
      </div>

      {/* Battle arena */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Background war texture */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(ellipse at center, #1a0505 0%, #09060f 70%)"
        }} />

        {/* HP bars */}
        <div className="relative z-10 flex gap-3 px-4 pt-4">
          {/* Player HP */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-black" style={{ color: pw.color }}>{pw.name}</span>
              <span className="text-xs font-bold text-white">{playerHP}/{MAX_HP}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${pw.color}, ${pw.color}99)`, boxShadow: `0 0 8px ${pw.glow}` }}
                animate={{ width: `${(playerHP / MAX_HP) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            </div>
          </div>
          <div className="w-px bg-white/10" />
          {/* Bot HP */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">{botHP}/{MAX_HP}</span>
              <span className="text-xs font-black" style={{ color: ow.color }}>{ow.name}</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div
                className="h-full rounded-full self-end ml-auto"
                style={{ background: `linear-gradient(270deg, ${ow.color}, ${ow.color}99)`, boxShadow: `0 0 8px ${ow.glow}`, float: "right" }}
                animate={{ width: `${(botHP / MAX_HP) * 100}%` }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              />
            </div>
          </div>
        </div>

        {/* Warriors + floating damage numbers */}
        <div className="relative z-10 flex items-center justify-around px-6 mt-4 flex-1">
          {/* Player warrior */}
          <motion.div
            className="flex flex-col items-center gap-2"
            animate={shakePlayer ? { x: [-8, 8, -6, 6, 0] } : {}}
            transition={{ duration: 0.35 }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl relative"
              style={{
                background: `${pw.color}15`,
                border: `2px solid ${pw.color}`,
                boxShadow: `0 0 24px ${pw.glow}, 0 0 48px ${pw.glow}44`,
              }}
            >
              {pw.emoji}
              {shieldActive && (
                <motion.div
                  className="absolute inset-0 rounded-full border-4"
                  style={{ borderColor: "#27ae60" }}
                  animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
            <span className="text-sm font-black" style={{ color: pw.color }}>{pw.name}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: pw.color, color: "#fff" }}>YOU</span>
          </motion.div>

          {/* Center VS + damage floaters */}
          <div className="relative flex flex-col items-center">
            <span className="text-xl font-black text-white/30">VS</span>
            {/* Floating numbers */}
            <AnimatePresence>
              {floatingNums.map((f) => (
                <motion.div
                  key={f.id}
                  className="absolute font-black text-lg pointer-events-none"
                  style={{
                    left: `${f.x}%`,
                    color: f.isPlayer ? "#e74c3c" : "#27ae60",
                    textShadow: "0 0 8px currentColor",
                  }}
                  initial={{ y: 0, opacity: 1, scale: 1 }}
                  animate={{ y: -60, opacity: 0, scale: 1.4 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.1 }}
                >
                  -{f.value}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Bot warrior */}
          <motion.div
            className="flex flex-col items-center gap-2"
            animate={shakeBot ? { x: [8, -8, 6, -6, 0] } : {}}
            transition={{ duration: 0.35 }}
          >
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              style={{
                background: `${ow.color}15`,
                border: `2px solid ${ow.color}`,
                boxShadow: `0 0 24px ${ow.glow}, 0 0 48px ${ow.glow}44`,
              }}
            >
              {ow.emoji}
            </div>
            <span className="text-sm font-black" style={{ color: ow.color }}>{ow.name}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: ow.color, color: "#fff" }}>BOT</span>
          </motion.div>
        </div>

        {/* Battle log */}
        <div
          className="relative z-10 mx-4 mb-3 p-3 rounded-2xl overflow-hidden"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", maxHeight: "80px" }}
        >
          <AnimatePresence>
            {log.slice(-3).reverse().map((entry) => (
              <motion.div
                key={entry.id}
                className="text-xs leading-relaxed truncate"
                style={{ color: entry.color }}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {entry.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Win/lose overlay */}
        <AnimatePresence>
          {winner && (
            <motion.div
              className="absolute inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="text-4xl font-black text-center"
                style={{ color: winner === "player" ? "#FFD700" : "#e74c3c" }}
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.2, 1] }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                {winner === "player" ? "🏆 YOU WIN!" : "💀 YOU LOST!"}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons */}
      <div
        className="shrink-0 px-4 py-4 grid grid-cols-3 gap-3"
        style={{ background: "rgba(10,10,15,0.95)", borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {/* Attack */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => playerAttack("normal")}
          disabled={attackCool || !!winner}
          className="flex flex-col items-center gap-1 py-3 rounded-2xl cursor-pointer"
          style={{
            background: attackCool ? "rgba(255,255,255,0.04)" : "rgba(231,76,60,0.15)",
            border: `1.5px solid ${attackCool ? "rgba(255,255,255,0.08)" : "rgba(231,76,60,0.4)"}`,
            opacity: attackCool || winner ? 0.5 : 1,
          }}
        >
          <span className="text-xl">⚔️</span>
          <span className="text-xs font-black text-white">ATTACK</span>
        </motion.button>

        {/* Shield */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => playerAttack("shield")}
          disabled={shieldCool || shieldActive || !!winner}
          className="flex flex-col items-center gap-1 py-3 rounded-2xl cursor-pointer"
          style={{
            background: shieldActive ? "rgba(39,174,96,0.2)" : shieldCool ? "rgba(255,255,255,0.04)" : "rgba(39,174,96,0.1)",
            border: `1.5px solid ${shieldActive ? "#27ae60" : shieldCool ? "rgba(255,255,255,0.08)" : "rgba(39,174,96,0.35)"}`,
            opacity: (shieldCool && !shieldActive) || winner ? 0.5 : 1,
          }}
        >
          <span className="text-xl">🛡️</span>
          <span className="text-xs font-black text-white">
            {shieldCool && !shieldActive ? `${shieldCoolLeft}s` : "SHIELD"}
          </span>
        </motion.button>

        {/* Special */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => playerAttack("special")}
          disabled={specialCool || !!winner}
          className="flex flex-col items-center gap-1 py-3 rounded-2xl cursor-pointer relative"
          style={{
            background: specialCool ? "rgba(255,255,255,0.04)" : "rgba(255,215,0,0.12)",
            border: `1.5px solid ${specialCool ? "rgba(255,255,255,0.08)" : "rgba(255,215,0,0.45)"}`,
            opacity: specialCool || winner ? 0.5 : 1,
          }}
        >
          {!specialCool && (
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{ boxShadow: ["0 0 0px rgba(255,215,0,0)", "0 0 14px rgba(255,215,0,0.4)", "0 0 0px rgba(255,215,0,0)"] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <span className="text-xl">💥</span>
          <span className="text-xs font-black text-white">
            {specialCool ? `${specialCoolLeft}s` : "SPECIAL"}
          </span>
        </motion.button>
      </div>
    </motion.div>
  );
}

// ─── RESULT ───────────────────────────────────────────────────
function ResultPhase({
  chosenWarrior, opponent, entryFee, onPlayAgain, onBack,
}: { chosenWarrior: Warrior; opponent: Warrior; entryFee: number; onPlayAgain: () => void; onBack?: () => void }) {
  const [playerWon] = useState(() => Math.random() > 0.35); // slight player advantage for fun
  const winnerWarrior = playerWon ? chosenWarrior : opponent;
  const ww = WARRIORS[winnerWarrior];
  const prize = (entryFee * 1.9).toFixed(0);

  const leaderboard = [
    { rank: 1, name: "Rahul_G", wins: 48, prize: "₹2,400" },
    { rank: 2, name: "Priya_K", wins: 41, prize: "₹2,050" },
    { rank: 3, name: "Amit_S", wins: 37, prize: "₹1,850" },
    { rank: 4, name: "YOU", wins: 1, prize: playerWon ? `₹${prize}` : "₹0", isMe: true },
  ];

  return (
    <motion.div
      className="flex flex-col h-full overflow-y-auto"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Result hero */}
      <div
        className="flex flex-col items-center pt-10 pb-6 relative shrink-0"
        style={{
          background: playerWon
            ? "linear-gradient(180deg, #1a3a0a 0%, #09060f 100%)"
            : "linear-gradient(180deg, #3a0a0a 0%, #09060f 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Confetti dots */}
        {playerWon && Array.from({ length: 16 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 6, height: 6,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 60}%`,
              background: ["#FFD700", "#e74c3c", "#27ae60", "#3498db", "#9b59b6"][i % 5],
            }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: [0, 80], opacity: [1, 0] }}
            transition={{ delay: Math.random() * 0.8, duration: 1.5 + Math.random() }}
          />
        ))}

        <motion.div
          className="text-6xl mb-3"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 250, damping: 15, delay: 0.15 }}
        >
          {playerWon ? "🏆" : "💀"}
        </motion.div>

        <motion.h2
          className="text-2xl font-black text-center"
          style={{ color: playerWon ? "#FFD700" : "#e74c3c" }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {playerWon ? "VICTORY!" : "DEFEATED!"}
        </motion.h2>

        <motion.p
          className="text-sm font-bold mt-1"
          style={{ color: "rgba(255,255,255,0.45)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {ww.emoji} {ww.name} wins the battle
        </motion.p>

        {/* Prize */}
        {playerWon && (
          <motion.div
            className="mt-5 py-3 px-8 rounded-2xl text-center"
            style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.35)" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, type: "spring" }}
          >
            <div className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>Reward Credited</div>
            <div className="text-3xl font-black" style={{ color: "#FFD700" }}>+₹{prize}</div>
          </motion.div>
        )}
      </div>

      {/* Daily bonus */}
      <div className="mx-4 mt-4 py-3 px-4 rounded-2xl flex items-center gap-3"
        style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)" }}>
        <span className="text-xl">🎁</span>
        <div>
          <div className="text-xs font-black text-white">Daily Bonus Available!</div>
          <div className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Refer friends & earn unlimited bonus</div>
        </div>
        <span className="ml-auto text-xs font-black" style={{ color: "#FFD700" }}>CLAIM →</span>
      </div>

      {/* Leaderboard */}
      <div className="px-4 mt-4">
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>
          Today's Leaderboard
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {leaderboard.map((row, i) => (
            <div
              key={row.rank}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                background: row.isMe ? "rgba(255,215,0,0.07)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                borderBottom: i < leaderboard.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <span className="text-sm font-black w-5 text-center"
                style={{ color: row.rank === 1 ? "#FFD700" : row.rank === 2 ? "#aaa" : row.rank === 3 ? "#cd7f32" : "rgba(255,255,255,0.3)" }}>
                {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
              </span>
              <span className="flex-1 text-sm font-bold"
                style={{ color: row.isMe ? "#FFD700" : "rgba(255,255,255,0.7)" }}>
                {row.name}
              </span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{row.wins} wins</span>
              <span className="text-xs font-black" style={{ color: row.isMe && playerWon ? "#27ae60" : "rgba(255,255,255,0.5)" }}>
                {row.prize}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="px-4 mt-5 mb-8 flex gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="flex-1 py-4 rounded-2xl font-black text-base cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)",
            color: "#fff",
            boxShadow: "0 0 20px rgba(231,76,60,0.4)",
          }}
        >
          ⚔️ Play Again
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onBack}
          className="py-4 px-5 rounded-2xl font-black text-sm cursor-pointer"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)" }}
        >
          🏠 Home
        </motion.button>
      </div>
    </motion.div>
  );
}
