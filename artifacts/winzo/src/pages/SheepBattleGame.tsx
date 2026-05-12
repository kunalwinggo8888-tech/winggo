/**
 * SheepBattleGame — WINGGO 3D Lane Strategy
 * Canvas 2D: 5 battle lanes, 3 sheep types, push physics, base attack system.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const W = 360, H = 500;
const LANES = 5;
const LANE_H = 72;
const LANE_START_Y = 60;
const PLAYER_BASE_X = 20;
const BOT_BASE_X = W - 20;
const SHEEP_TYPES = [
  { name: "Small", emoji: "🐑", color: "#a3e635", r: 14, speed: 1.4, power: 1, cost: 10, maxHP: 30 },
  { name: "Medium", emoji: "🐏", color: "#facc15", r: 20, speed: 0.9, power: 2.5, cost: 25, maxHP: 70 },
  { name: "Heavy", emoji: "🦬", color: "#f97316", r: 26, speed: 0.6, power: 5, cost: 50, maxHP: 150 },
];

interface Sheep {
  id: number; lane: number; x: number; type: number; hp: number; maxHP: number;
  side: "player" | "bot"; vx: number;
}

function MM({ fee, onStart }: { fee: number; onStart: () => void }) {
  const [cd, setCd] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 200); return 0; } return c - 1; }), 900);
    return () => clearInterval(t);
  }, [onStart]);
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-5xl"
        style={{ background: "rgba(163,230,53,0.12)", border: "2px solid rgba(163,230,53,0.45)" }}
        animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1, repeat: Infinity }}>🐑</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Sheep Battle 3D</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Push sheep into enemy base!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(163,230,53,0.07)", border: "1px solid rgba(163,230,53,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(163,230,53,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function SheepBattleGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [won, setWon] = useState(false);
  const [coins, setCoins] = useState(100);
  const [playerBaseHP, setPlayerBaseHP] = useState(100);
  const [botBaseHP, setBotBaseHP] = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("matchmaking");
  phaseRef.current = phase;
  const animRef = useRef<number>(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const gRef = useRef({
    sheep: [] as Sheep[], nextId: 0,
    coins: 100, coinTimer: 0, playerBaseHP: 100, botBaseHP: 100,
    botTimer: 0,
  });

  const startGame = useCallback(() => {
    const g = gRef.current;
    g.sheep = []; g.nextId = 0; g.coins = 100; g.coinTimer = 0;
    g.playerBaseHP = 100; g.botBaseHP = 100; g.botTimer = 120;
    setCoins(100); setPlayerBaseHP(100); setBotBaseHP(100);
    setPhase("playing");
  }, []);

  function spawnSheep(lane: number, typeIdx: number, side: "player" | "bot") {
    const g = gRef.current;
    const t = SHEEP_TYPES[typeIdx];
    const x = side === "player" ? PLAYER_BASE_X + 35 : BOT_BASE_X - 35;
    const vx = side === "player" ? t.speed : -t.speed;
    g.sheep.push({ id: g.nextId++, lane, x, type: typeIdx, hp: t.maxHP, maxHP: t.maxHP, side, vx });
  }

  function handleSpawn(lane: number, typeIdx: number) {
    if (phase !== "playing") return;
    const g = gRef.current;
    const cost = SHEEP_TYPES[typeIdx].cost;
    if (g.coins < cost) return;
    g.coins -= cost;
    setCoins(g.coins);
    spawnSheep(lane, typeIdx, "player");
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const g = gRef.current;

    let animId: number;
    function loop() {
      if (phaseRef.current !== "playing") return;

      // Coin regen
      g.coinTimer++;
      if (g.coinTimer >= 90) { g.coinTimer = 0; g.coins = Math.min(200, g.coins + 15); setCoins(g.coins); }

      // Bot AI
      g.botTimer--;
      if (g.botTimer <= 0) {
        g.botTimer = 80 + Math.floor(Math.random() * 80);
        const lane = Math.floor(Math.random() * LANES);
        const typeIdx = Math.floor(Math.random() * 3);
        spawnSheep(lane, typeIdx, "bot");
      }

      // Move sheep & collide
      for (const s of g.sheep) {
        s.x += s.vx;
        // Check base collision
        if (s.side === "player" && s.x + SHEEP_TYPES[s.type].r >= BOT_BASE_X) {
          g.botBaseHP -= SHEEP_TYPES[s.type].power * 3;
          g.botBaseHP = Math.max(0, g.botBaseHP);
          setBotBaseHP(g.botBaseHP);
          s.hp = 0;
          if (g.botBaseHP <= 0) { setWon(true); addWinning(prize, `🐑 Sheep Battle — Won ₹${prize}`); setPhase("result"); return; }
        }
        if (s.side === "bot" && s.x - SHEEP_TYPES[s.type].r <= PLAYER_BASE_X) {
          g.playerBaseHP -= SHEEP_TYPES[s.type].power * 3;
          g.playerBaseHP = Math.max(0, g.playerBaseHP);
          setPlayerBaseHP(g.playerBaseHP);
          s.hp = 0;
          if (g.playerBaseHP <= 0) { setWon(false); setPhase("result"); return; }
        }
      }

      // Sheep vs sheep collision (same lane, opposing sides)
      for (let i = 0; i < g.sheep.length; i++) {
        for (let j = i + 1; j < g.sheep.length; j++) {
          const a = g.sheep[i], b = g.sheep[j];
          if (a.lane !== b.lane || a.side === b.side || a.hp <= 0 || b.hp <= 0) continue;
          const ra = SHEEP_TYPES[a.type].r, rb = SHEEP_TYPES[b.type].r;
          const dx = Math.abs(a.x - b.x);
          if (dx < ra + rb) {
            // Heavier pushes lighter
            const aP = SHEEP_TYPES[a.type].power, bP = SHEEP_TYPES[b.type].power;
            // Damage over time
            a.hp -= bP * 0.3; b.hp -= aP * 0.3;
            // Push
            if (aP > bP) { b.vx = -SHEEP_TYPES[b.type].speed * 0.5; }
            else if (bP > aP) { a.vx = SHEEP_TYPES[a.type].speed * 0.5; }
            else { a.vx *= 0; b.vx *= 0; }
          }
        }
      }

      // Remove dead sheep
      g.sheep = g.sheep.filter(s => s.hp > 0);

      // --- DRAW ---
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a1a0a"; ctx.fillRect(0, 0, W, H);

      // Lanes
      for (let l = 0; l < LANES; l++) {
        const ly = LANE_START_Y + l * LANE_H;
        const laneColors = ["#0d200d", "#0f260f", "#0d200d", "#0f260f", "#0d200d"];
        ctx.fillStyle = laneColors[l];
        ctx.fillRect(0, ly, W, LANE_H);
        ctx.strokeStyle = "rgba(255,255,255,0.06)"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke();
        // Lane number
        ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`Lane ${l + 1}`, W / 2, ly + 12);
      }

      // Player base
      const pBG = ctx.createLinearGradient(0, LANE_START_Y, PLAYER_BASE_X + 12, LANE_START_Y + LANES * LANE_H);
      pBG.addColorStop(0, "#1a4a1a"); pBG.addColorStop(1, "#0a2a0a");
      ctx.fillStyle = pBG; ctx.fillRect(0, LANE_START_Y, PLAYER_BASE_X + 12, LANES * LANE_H);
      ctx.strokeStyle = `rgba(163,230,53,${g.playerBaseHP / 100 * 0.8 + 0.2})`; ctx.lineWidth = 2;
      ctx.strokeRect(0, LANE_START_Y, PLAYER_BASE_X + 12, LANES * LANE_H);
      // Base HP bar
      const pFrac = g.playerBaseHP / 100;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(4, LANE_START_Y - 18, W / 2 - 8, 12);
      ctx.fillStyle = `hsl(${pFrac * 120},80%,45%)`; ctx.fillRect(4, LANE_START_Y - 18, (W / 2 - 8) * pFrac, 12);
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "left"; ctx.fillText(`YOU ${Math.ceil(g.playerBaseHP)}%`, 6, LANE_START_Y - 8);

      // Bot base
      const bBG = ctx.createLinearGradient(BOT_BASE_X - 12, LANE_START_Y, W, LANE_START_Y + LANES * LANE_H);
      bBG.addColorStop(0, "#4a1a1a"); bBG.addColorStop(1, "#2a0a0a");
      ctx.fillStyle = bBG; ctx.fillRect(BOT_BASE_X - 12, LANE_START_Y, W - BOT_BASE_X + 12, LANES * LANE_H);
      ctx.strokeStyle = `rgba(239,68,68,${g.botBaseHP / 100 * 0.8 + 0.2})`; ctx.lineWidth = 2;
      ctx.strokeRect(BOT_BASE_X - 12, LANE_START_Y, W - BOT_BASE_X + 12, LANES * LANE_H);
      const bFrac = g.botBaseHP / 100;
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(W / 2 + 4, LANE_START_Y - 18, W / 2 - 8, 12);
      ctx.fillStyle = `hsl(${bFrac * 120},80%,45%)`; ctx.fillRect(W / 2 + 4, LANE_START_Y - 18, (W / 2 - 8) * bFrac, 12);
      ctx.fillStyle = "#fff"; ctx.font = "bold 8px sans-serif"; ctx.textAlign = "right"; ctx.fillText(`BOT ${Math.ceil(g.botBaseHP)}%`, W - 6, LANE_START_Y - 8);

      // Sheep
      for (const s of g.sheep) {
        const t = SHEEP_TYPES[s.type];
        const laneY = LANE_START_Y + s.lane * LANE_H + LANE_H / 2;
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(s.x, laneY + t.r, t.r * 0.9, t.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
        // Body
        ctx.shadowColor = s.side === "player" ? t.color : "#ef4444";
        ctx.shadowBlur = 6;
        ctx.fillStyle = s.side === "player" ? t.color : "#ef4444";
        ctx.beginPath(); ctx.arc(s.x, laneY, t.r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // Emoji
        ctx.font = `${t.r * 1.4}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(t.emoji, s.x, laneY);
        // HP bar
        const hpFrac = s.hp / s.maxHP;
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(s.x - t.r, laneY - t.r - 8, t.r * 2, 5);
        ctx.fillStyle = hpFrac > 0.5 ? "#22c55e" : hpFrac > 0.25 ? "#FFD700" : "#ef4444";
        ctx.fillRect(s.x - t.r, laneY - t.r - 8, t.r * 2 * hpFrac, 5);
      }

      // Coin display
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.beginPath(); ctx.roundRect(W / 2 - 50, LANE_START_Y - 22, 100, 18, 9); ctx.fill();
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`💰 ${g.coins} coins`, W / 2, LANE_START_Y - 8);

      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);
    animRef.current = animId;
    return () => cancelAnimationFrame(animId);
  }, [phase, prize, addWinning]);

  function handleRematch() { setWon(false); setCoins(100); setPlayerBaseHP(100); setBotBaseHP(100); setPhase("matchmaking"); }
  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(163,230,53,0.15)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0a1a0a", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🐑</span><span className="font-black text-white text-base">Sheep Battle 3D</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>
      {phase === "matchmaking" && <MM fee={initialFee} onStart={startGame} />}
      {phase === "playing" && (
        <div className="flex-1 flex flex-col">
          <canvas ref={canvasRef} width={W} height={H} style={{ width: "100%", maxWidth: W, touchAction: "none" }} />
          {/* Spawn controls */}
          <div className="px-3 py-2" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="text-[9px] font-bold mb-1.5 text-center" style={{ color: "rgba(255,255,255,0.4)" }}>DEPLOY SHEEP — Tap lane button</div>
            <div className="flex gap-2">
              {SHEEP_TYPES.map((t, ti) => (
                <button key={ti} onClick={() => {
                  const lane = Math.floor(Math.random() * LANES);
                  handleSpawn(lane, ti);
                }}
                  className="flex-1 py-2 rounded-xl font-black text-xs cursor-pointer active:scale-95 transition-transform"
                  style={{ background: coins >= t.cost ? `rgba(${ti === 0 ? "163,230,53" : ti === 1 ? "250,204,21" : "249,115,22"},0.15)` : "rgba(255,255,255,0.05)", border: `1px solid ${coins >= t.cost ? `rgba(${ti === 0 ? "163,230,53" : ti === 1 ? "250,204,21" : "249,115,22"},0.4)` : "rgba(255,255,255,0.1)"}`, color: coins >= t.cost ? "#fff" : "rgba(255,255,255,0.3)" }}>
                  <div>{t.emoji}</div>
                  <div style={{ fontSize: 9 }}>{t.name}</div>
                  <div style={{ color: "#FFD700", fontSize: 9 }}>{t.cost}💰</div>
                </button>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              {Array.from({ length: LANES }, (_, l) => (
                <button key={l} onClick={() => handleSpawn(l, 0)}
                  className="flex-1 py-1 rounded-lg text-[9px] font-bold cursor-pointer active:scale-95"
                  style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                  L{l + 1}
                </button>
              ))}
            </div>
            <div className="text-[9px] text-center mt-1" style={{ color: "rgba(255,215,0,0.6)" }}>First tap selects type → second tap selects lane</div>
          </div>
        </div>
      )}
      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(163,230,53,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(163,230,53,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(163,230,53,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#a3e635" : "#ef4444" }}>{won ? "Herd Champion! 🎉" : "Base Destroyed!"}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(163,230,53,0.2)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(163,230,53,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#a3e635" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black cursor-pointer"
            style={{ background: "linear-gradient(135deg,#a3e635,#4d7c0f)", color: "#000", boxShadow: "0 0 28px rgba(163,230,53,0.4)" }}>
            🐑 Battle Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
