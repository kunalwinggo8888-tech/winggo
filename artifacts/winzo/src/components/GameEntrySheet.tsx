/**
 * GameEntrySheet — WINGGO Universal Premium Entry Modal
 * WinZO-style bottom-sheet for ALL games:
 *  • Game-specific accent colour, header gradient, floating emoji assets
 *  • Hexagonal honeycomb deep-purple background
 *  • Gold trophy WINNINGS card (updates per selected fee)
 *  • Horizontal circular entry-fee selector with gold selected state
 *  • Full-width PLAY NOW green button with glow + shine animation
 *  • Wallet balance guard → Add Money flow
 *  • Coming-soon state
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const PLATFORM_PCT = 0.10;  // 10% platform fee → winner gets 90% of the pot
// prize = floor(entryFee × 2 × (1 - PLATFORM_PCT))

// Honeycomb SVG as encoded background-image
const HONEYCOMB = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97'%3E%3Cpath d='M28 0 L56 16.2 L56 48.5 L28 64.7 L0 48.5 L0 16.2 Z' fill='none' stroke='rgba(255%2C255%2C255%2C0.055)' stroke-width='1'/%3E%3Cpath d='M28 64.7 L56 80.9 L56 97 L0 97 L0 80.9 Z' fill='none' stroke='rgba(255%2C255%2C255%2C0.055)' stroke-width='1'/%3E%3C/svg%3E")`;

// ─── GAME CONFIG MAP ──────────────────────────────────────────────────────────

interface GameCfg {
  accent: string;          // primary accent colour (hex)
  headerGrad: string;      // header bar gradient
  mainGrad: string;        // main body gradient
  assets: string[];        // floating emoji array (8 elements)
  defaultFees: number[];   // fallback entry fee tiers
  bigTitle: string;        // large glow text in main area
}

const GAME_MAP: Record<string, GameCfg> = {
  /* ── Ludo ── */
  ludo: {
    accent: "#9333ea", headerGrad: "linear-gradient(135deg,#3b0764,#7e22ce,#9333ea)",
    mainGrad: "linear-gradient(180deg,#120630 0%,#0e0220 100%)",
    assets: ["🎲","🔴","🟡","🟢","🔵","🎲","🔴","🟢"],
    defaultFees: [1,5,10,50,100,500], bigTitle: "LUDO",
  },
  "5": {
    accent: "#9333ea", headerGrad: "linear-gradient(135deg,#3b0764,#7e22ce,#9333ea)",
    mainGrad: "linear-gradient(180deg,#120630 0%,#0e0220 100%)",
    assets: ["🎲","🔴","🟡","🟢","🔵","🎲","🔴","🟢"],
    defaultFees: [1,5,10,50,100,500], bigTitle: "LUDO",
  },

  /* ── Carrom ── */
  carrom: {
    accent: "#f97316", headerGrad: "linear-gradient(135deg,#7c2d12,#c2410c,#f97316)",
    mainGrad: "linear-gradient(180deg,#1c0a02 0%,#120500 100%)",
    assets: ["⚪","⚫","⚪","⚫","🪙","⚫","⚪","🪙"],
    defaultFees: [5,10,20,50,100], bigTitle: "CARROM",
  },
  "3": {
    accent: "#f97316", headerGrad: "linear-gradient(135deg,#7c2d12,#c2410c,#f97316)",
    mainGrad: "linear-gradient(180deg,#1c0a02 0%,#120500 100%)",
    assets: ["⚪","⚫","⚪","⚫","🪙","⚫","⚪","🪙"],
    defaultFees: [5,10,20,50,100], bigTitle: "CARROM",
  },

  /* ── Snake & Ladder ── */
  snakes: {
    accent: "#10b981", headerGrad: "linear-gradient(135deg,#022c22,#065f46,#10b981)",
    mainGrad: "linear-gradient(180deg,#021a12 0%,#010d09 100%)",
    assets: ["🐍","🪜","🎲","🐍","🪜","🐍","🎲","🪜"],
    defaultFees: [2,5,10,50,100], bigTitle: "SAPSIDI",
  },
  "2": {
    accent: "#10b981", headerGrad: "linear-gradient(135deg,#022c22,#065f46,#10b981)",
    mainGrad: "linear-gradient(180deg,#021a12 0%,#010d09 100%)",
    assets: ["🐍","🪜","🎲","🐍","🪜","🐍","🎲","🪜"],
    defaultFees: [2,5,10,50,100], bigTitle: "SAPSIDI",
  },

  /* ── Solitaire ── */
  solitaire: {
    accent: "#ec4899", headerGrad: "linear-gradient(135deg,#500724,#9d174d,#ec4899)",
    mainGrad: "linear-gradient(180deg,#200516 0%,#10020a 100%)",
    assets: ["♠","♥","♦","♣","🃏","♠","♥","♦"],
    defaultFees: [1,2,5,10,25,50], bigTitle: "SOLITAIRE",
  },
  "11": {
    accent: "#ec4899", headerGrad: "linear-gradient(135deg,#500724,#9d174d,#ec4899)",
    mainGrad: "linear-gradient(180deg,#200516 0%,#10020a 100%)",
    assets: ["♠","♥","♦","♣","🃏","♠","♥","♦"],
    defaultFees: [1,2,5,10,25,50], bigTitle: "SOLITAIRE",
  },


  /* ── Bubble Shooter ── */
  bubble: {
    accent: "#d946ef", headerGrad: "linear-gradient(135deg,#701a75,#a21caf,#d946ef)",
    mainGrad: "linear-gradient(180deg,#1a0320 0%,#0e0112 100%)",
    assets: ["🫧","🔴","🔵","🟡","🟢","🫧","🟣","🔴"],
    defaultFees: [5,10,20,50], bigTitle: "BUBBLE",
  },
  "1": {
    accent: "#d946ef", headerGrad: "linear-gradient(135deg,#701a75,#a21caf,#d946ef)",
    mainGrad: "linear-gradient(180deg,#1a0320 0%,#0e0112 100%)",
    assets: ["🫧","🔴","🔵","🟡","🟢","🫧","🟣","🔴"],
    defaultFees: [5,10,20,50], bigTitle: "BUBBLE",
  },

  /* ── 8-Ball Pool ── */
  pool: {
    accent: "#3b82f6", headerGrad: "linear-gradient(135deg,#1e3a5f,#1e40af,#3b82f6)",
    mainGrad: "linear-gradient(180deg,#020e22 0%,#010812 100%)",
    assets: ["🎱","⚪","🔵","🟡","🔴","🎱","⚪","🔵"],
    defaultFees: [5,10,20,50], bigTitle: "8 BALL POOL",
  },
  "6": {
    accent: "#3b82f6", headerGrad: "linear-gradient(135deg,#1e3a5f,#1e40af,#3b82f6)",
    mainGrad: "linear-gradient(180deg,#020e22 0%,#010812 100%)",
    assets: ["🎱","⚪","🔵","🟡","🔴","🎱","⚪","🔵"],
    defaultFees: [5,10,20,50], bigTitle: "8 BALL POOL",
  },

  /* ── Cricket ── */
  cricket: {
    accent: "#f59e0b", headerGrad: "linear-gradient(135deg,#78350f,#b45309,#f59e0b)",
    mainGrad: "linear-gradient(180deg,#1c0e02 0%,#0e0601 100%)",
    assets: ["🏏","🎯","🏆","🏏","🎯","🏏","🎯","🏆"],
    defaultFees: [5,10,20,50], bigTitle: "CRICKET",
  },
  "8": {
    accent: "#f59e0b", headerGrad: "linear-gradient(135deg,#78350f,#b45309,#f59e0b)",
    mainGrad: "linear-gradient(180deg,#1c0e02 0%,#0e0601 100%)",
    assets: ["🏏","🎯","🏆","🏏","🎯","🏏","🎯","🏆"],
    defaultFees: [5,10,20,50], bigTitle: "CRICKET",
  },
};

const DEFAULT_CFG: GameCfg = {
  accent: "#7c3aed", headerGrad: "linear-gradient(135deg,#1e1b4b,#4c1d95,#7c3aed)",
  mainGrad: "linear-gradient(180deg,#0e0820 0%,#06040f 100%)",
  assets: ["🎮","💎","🎯","🎮","💎","🎯","🎮","💎"],
  defaultFees: [5,10,20,50], bigTitle: "PLAY",
};

function getCfg(id: string): GameCfg {
  return GAME_MAP[id] ?? DEFAULT_CFG;
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface SheetGame {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  players: string;
  entryFees?: number[];
  comingSoon?: boolean;
}

interface Props {
  game: SheetGame | null;
  onClose: () => void;
  onPlay: (entryFee: number) => void;
  onAddMoney?: () => void;
}

// ─── FLOATING ASSETS ──────────────────────────────────────────────────────────

function FloatingAssets({ assets, accent }: { assets: string[]; accent: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {assets.map((asset, i) => (
        <motion.div
          key={i}
          className="absolute select-none"
          style={{
            left: `${4 + i * 12}%`,
            bottom: "0px",
            fontSize: i % 2 === 0 ? 22 : 16,
            textShadow: `0 0 12px ${accent}99`,
            lineHeight: 1,
          }}
          initial={{ y: 0, opacity: 0, rotate: 0 }}
          animate={{
            y: [-8, -90, -70],
            opacity: [0, 0.85, 0],
            rotate: [0, i % 2 === 0 ? 18 : -18, 5],
          }}
          transition={{
            delay: i * 0.21,
            duration: 2.2 + (i % 3) * 0.35,
            repeat: Infinity,
            repeatDelay: 0.4 + i * 0.12,
            ease: "easeOut",
          }}
        >
          {asset}
        </motion.div>
      ))}
    </div>
  );
}

// ─── CIRCULAR FEE BUTTON ──────────────────────────────────────────────────────

function FeeButton({
  fee, isSelected, canAfford, isBest, accent, onClick,
}: {
  fee: number; isSelected: boolean; canAfford: boolean;
  isBest: boolean; accent: string; onClick: () => void;
}) {
  const label = fee >= 1000 ? `₹${fee / 1000}K` : `₹${fee}`;
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 66 }}>
      <motion.button
        whileTap={{ scale: 0.91 }}
        onClick={canAfford ? onClick : undefined}
        className="relative flex items-center justify-center rounded-full cursor-pointer"
        style={{
          width: 62, height: 62,
          background: isSelected
            ? "linear-gradient(135deg, #FFD700, #ffa500)"
            : canAfford
            ? `rgba(255,255,255,0.05)`
            : "rgba(255,255,255,0.02)",
          border: isSelected
            ? "2.5px solid #FFD700"
            : canAfford
            ? `2px solid ${accent}55`
            : "1.5px solid rgba(255,255,255,0.08)",
          boxShadow: isSelected
            ? `0 0 22px rgba(255,215,0,0.65), 0 0 44px rgba(255,215,0,0.25)`
            : canAfford
            ? `0 0 12px ${accent}22`
            : "none",
          opacity: canAfford ? 1 : 0.32,
          transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
        }}
        animate={isSelected ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 0.9, repeat: isSelected ? Infinity : 0 }}
      >
        {/* Shimmer on selected */}
        {isSelected && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none overflow-hidden"
            style={{ borderRadius: "50%" }}
          >
            <motion.div
              style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.35) 50%, transparent 70%)",
              }}
              animate={{ x: ["-120%", "220%"] }}
              transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.div>
        )}

        <span style={{
          fontSize: fee >= 1000 ? 11 : fee >= 100 ? 13 : 16,
          fontWeight: 900,
          color: isSelected ? "#000" : canAfford ? "#fff" : "rgba(255,255,255,0.25)",
          letterSpacing: "-0.02em",
        }}>
          {label}
        </span>

        {/* Checkmark overlay on selected */}
        {isSelected && (
          <motion.div
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#22c55e", border: "1.5px solid #fff", fontSize: 10, fontWeight: 900, color: "#fff" }}
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            ✓
          </motion.div>
        )}
      </motion.button>

      {/* Tag below button */}
      {isBest ? (
        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
          style={{ background: "rgba(255,215,0,0.18)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.4)", letterSpacing: "0.04em" }}>
          BEST
        </span>
      ) : !canAfford ? (
        <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.18)" }}>Low bal</span>
      ) : (
        <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.0)" }}>_</span>
      )}
    </div>
  );
}

// ─── TROPHY WINNINGS CARD ─────────────────────────────────────────────────────

function WinningsCard({ fee, accent }: { fee: number; accent: string }) {
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <motion.div
      className="mx-5 flex items-center justify-between px-4 py-3 rounded-2xl"
      style={{
        background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,140,0,0.08))",
        border: "1.5px solid rgba(255,215,0,0.35)",
        boxShadow: "0 0 24px rgba(255,215,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
      key={fee}
      initial={{ scale: 0.97, opacity: 0.8 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3">
        <motion.span
          className="text-2xl"
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }}
        >🏆</motion.span>
        <div>
          <div className="text-[10px] font-black tracking-widest uppercase"
            style={{ color: "rgba(255,215,0,0.6)" }}>WINNINGS</div>
          <motion.div
            className="font-black text-2xl leading-tight"
            style={{ color: "#FFD700", textShadow: "0 0 16px rgba(255,215,0,0.6)" }}
            key={prize}
            initial={{ y: -6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            ₹{prize.toLocaleString("en-IN")}
          </motion.div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>Entry</div>
        <div className="text-sm font-black" style={{ color: "rgba(255,255,255,0.55)" }}>₹{fee}</div>
        <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>Platform 10%</div>
      </div>

      {/* Shine sweep */}
      <motion.div className="absolute inset-0 rounded-2xl pointer-events-none overflow-hidden">
        <motion.div
          style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.12) 50%, transparent 70%)",
          }}
          animate={{ x: ["-130%", "230%"] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
        />
      </motion.div>
    </motion.div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function GameEntrySheet({ game, onClose, onPlay, onAddMoney }: Props) {
  const { total, wallet, deductFee } = useWallet();
  const bonus = wallet.bonus;

  const cfg = useMemo(() => getCfg(game?.id ?? ""), [game?.id]);
  const tiers = useMemo(() => {
    const raw = (game?.entryFees && game.entryFees.length > 0) ? game.entryFees : cfg.defaultFees;
    return raw.slice().sort((a, b) => a - b);
  }, [game?.entryFees, cfg.defaultFees]);

  const bestIdx = Math.floor(tiers.length / 2);
  const defaultFee = tiers[bestIdx] ?? tiers[0];
  const [selected, setSelected] = useState<number>(defaultFee);

  // Reset selection when game changes
  useMemo(() => { setSelected(defaultFee); }, [defaultFee]); // eslint-disable-line react-hooks/exhaustive-deps

  const minFee = Math.min(...tiers);
  const insufficient = total < minFee;
  const isFreeMode = selected === 0;
  const canPlaySelected = isFreeMode || total >= selected;
  const difficulty = getBotDifficulty(selected === 0 ? 1 : selected);

  function handlePlay() {
    if (!game) return;
    if (isFreeMode) { onPlay(0); return; }
    if (!canPlaySelected) return;
    deductFee(selected, `${game.name} — Entry ₹${selected}`);
    onPlay(selected);
  }

  function handlePlayFree() {
    if (!game) return;
    setSelected(0);
    onPlay(0);
  }

  return (
    <AnimatePresence>
      {game && (
        <>
          {/* ── Dark backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[9990]"
            style={{ background: "rgba(0,0,0,0.86)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* ── Sheet panel ── */}
          <motion.div
            className="fixed bottom-0 inset-x-0 z-[9999] flex flex-col"
            style={{
              maxWidth: 480, margin: "0 auto",
              maxHeight: "90dvh",
              borderRadius: "28px 28px 0 0",
              background: cfg.mainGrad,
              border: `1.5px solid ${cfg.accent}35`,
              borderBottom: "none",
              boxShadow: `0 -8px 60px ${cfg.accent}30, 0 -2px 20px ${cfg.accent}18, inset 0 1px 0 rgba(255,255,255,0.06)`,
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            {/* ── Drag handle ── */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
            </div>

            {/* ── TOP HEADER BAR ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 relative overflow-hidden"
              style={{ background: cfg.headerGrad, boxShadow: `0 2px 20px ${cfg.accent}50` }}>
              {/* Glow line at bottom of header */}
              <motion.div className="absolute bottom-0 left-8 right-8 h-px rounded-full"
                style={{ background: `linear-gradient(90deg, transparent, ${cfg.accent}, #FFD700, ${cfg.accent}, transparent)` }}
                animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />

              {/* Left: icon + name */}
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
                  {game.icon}
                </div>
                <div>
                  <div className="font-black text-white text-base leading-tight">{game.name}</div>
                  <div className="flex items-center gap-1.5">
                    <motion.div className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "#22c55e" }}
                      animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
                    <span className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {game.players}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: rules + results + close */}
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 14 }}
                  title="Rules">📋</button>
                <button className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 14 }}
                  title="Results">📊</button>
                <button onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", fontSize: 14, color: "rgba(255,255,255,0.7)" }}>
                  ✕
                </button>
              </div>
            </div>

            {/* ── COMING SOON STATE ── */}
            {game.comingSoon ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 gap-5">
                <motion.div
                  className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl"
                  style={{ background: cfg.headerGrad, boxShadow: `0 0 40px ${cfg.accent}50` }}
                  animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  {game.icon}
                </motion.div>
                <div className="text-center">
                  <div className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: cfg.accent }}>Coming Soon</div>
                  <h3 className="text-2xl font-black text-white mb-2">{game.name}</h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    We're building this game. It will launch very soon with exciting prizes!
                  </p>
                </div>
                <div className="w-full px-4 py-3.5 rounded-2xl text-center font-black text-sm"
                  style={{ background: `${cfg.accent}18`, border: `1.5px dashed ${cfg.accent}50`, color: cfg.accent }}>
                  🔔 Notify Me When Live
                </div>
                <motion.button whileTap={{ scale: 0.96 }} onClick={onClose}
                  className="w-full py-3.5 rounded-2xl font-black text-base cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                  Back to Games
                </motion.button>
              </div>

            ) : insufficient ? (
              /* ── INSUFFICIENT BALANCE ── */
              <div className="flex-1 flex flex-col items-center justify-center px-6 py-6 gap-4">
                <motion.div className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                  style={{ background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.35)", boxShadow: "0 0 30px rgba(239,68,68,0.2)" }}
                  animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.8, repeat: Infinity }}>
                  💳
                </motion.div>
                <div className="text-center">
                  <div className="text-xs font-black tracking-widest uppercase mb-1.5 px-3 py-1 rounded-full inline-block"
                    style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" }}>
                    Low Balance
                  </div>
                  <h3 className="text-xl font-black text-white mb-1">Play FREE Mode</h3>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Practice for free or add money to win real cash
                  </p>
                </div>
                <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex justify-between px-4 py-3" style={{ background: "rgba(239,68,68,0.08)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Your Balance</span>
                    <span className="text-base font-black" style={{ color: "#ef4444" }}>₹{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-4 py-3" style={{ background: "rgba(255,215,0,0.05)" }}>
                    <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>Minimum Entry</span>
                    <span className="text-base font-black" style={{ color: "#FFD700" }}>₹{minFee}</span>
                  </div>
                </div>
                {/* Play FREE button */}
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={handlePlayFree}
                  className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg,#065f46,#047857,#059669)",
                    color: "#fff",
                    boxShadow: "0 0 28px rgba(16,185,129,0.55), 0 0 60px rgba(16,185,129,0.2)",
                    border: "1.5px solid rgba(16,185,129,0.5)",
                  }}>
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.22) 50%,transparent 65%)" }}
                    animate={{ x: ["-110%","210%"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }} />
                  🎮 Play FREE — Practice Mode
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => { onClose(); onAddMoney?.(); }}
                  className="w-full py-3 rounded-2xl font-black text-sm cursor-pointer relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 18px rgba(255,215,0,0.3)" }}>
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.3) 50%,transparent 65%)" }}
                    animate={{ x: ["-110%","210%"] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.8 }} />
                  💰 Add Money to Win Real Cash
                </motion.button>
                <button onClick={onClose} className="text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>Cancel</button>
              </div>

            ) : (
              /* ── NORMAL ENTRY STATE ── */
              <>
                {/* ─────────────────────────────────────────────────────
                    SCROLLABLE BODY — everything above the sticky footer
                ───────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>

                  {/* ── MAIN CONTENT AREA (honeycomb + floating assets + winnings) ── */}
                  <div className="relative overflow-hidden flex-shrink-0"
                    style={{ height: 180, backgroundImage: HONEYCOMB, backgroundSize: "56px 97px" }}>

                    <FloatingAssets assets={cfg.assets} accent={cfg.accent} />

                    {/* Large ghost game title */}
                    <div className="absolute inset-x-0 top-4 flex justify-center pointer-events-none">
                      <motion.span
                        className="font-black tracking-widest select-none"
                        style={{
                          color: "rgba(255,255,255,0.08)",
                          textShadow: `0 0 30px ${cfg.accent}60`,
                          letterSpacing: "0.18em",
                          fontSize: cfg.bigTitle.length > 8 ? "1.5rem" : "1.875rem",
                        }}
                        animate={{
                          opacity: [0.06, 0.14, 0.06],
                          textShadow: [`0 0 30px ${cfg.accent}40`, `0 0 55px ${cfg.accent}80`, `0 0 30px ${cfg.accent}40`],
                        }}
                        transition={{ duration: 2.5, repeat: Infinity }}
                      >
                        {cfg.bigTitle}
                      </motion.span>
                    </div>

                    {/* Winnings card / Practice Mode card */}
                    <div className="absolute inset-x-0 bottom-3">
                      {isFreeMode ? (
                        <motion.div
                          className="mx-5 flex items-center justify-between px-4 py-3 rounded-2xl"
                          style={{
                            background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))",
                            border: "1.5px solid rgba(16,185,129,0.45)",
                            boxShadow: "0 0 24px rgba(16,185,129,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
                          }}
                          initial={{ scale: 0.97, opacity: 0.8 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex items-center gap-3">
                            <motion.span className="text-2xl"
                              animate={{ rotate: [0, -8, 8, 0] }}
                              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1 }}>🎮</motion.span>
                            <div>
                              <div className="text-[10px] font-black tracking-widest uppercase"
                                style={{ color: "rgba(16,185,129,0.7)" }}>PRACTICE MODE</div>
                              <div className="font-black text-xl leading-tight"
                                style={{ color: "#10b981", textShadow: "0 0 16px rgba(16,185,129,0.6)" }}>
                                FREE
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>Entry Fee</div>
                            <div className="text-sm font-black" style={{ color: "#10b981" }}>₹0</div>
                            <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>No Rewards</div>
                          </div>
                        </motion.div>
                      ) : (
                        <WinningsCard fee={selected} accent={cfg.accent} />
                      )}
                    </div>
                  </div>

                  {/* ── ENTRY FEE SECTION ── */}
                  <div className="px-4 pt-4 pb-2">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black tracking-widest uppercase"
                        style={{ color: `${cfg.accent}cc` }}>⚡ Choose Entry Fee</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "rgba(34,197,94,0.8)" }}>
                        Win up to 90%
                      </span>
                    </div>

                    {/* Circular buttons — horizontal scroll */}
                    <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar justify-start pl-1">
                      {/* FREE button — always first */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 66 }}>
                        <motion.button
                          whileTap={{ scale: 0.91 }}
                          onClick={() => setSelected(0)}
                          className="relative flex flex-col items-center justify-center rounded-full cursor-pointer"
                          style={{
                            width: 62, height: 62,
                            background: selected === 0
                              ? "linear-gradient(135deg, #065f46, #059669)"
                              : "rgba(16,185,129,0.07)",
                            border: selected === 0
                              ? "2.5px solid #10b981"
                              : "2px solid rgba(16,185,129,0.35)",
                            boxShadow: selected === 0
                              ? "0 0 22px rgba(16,185,129,0.75), 0 0 44px rgba(16,185,129,0.3)"
                              : "0 0 12px rgba(16,185,129,0.15)",
                            transition: "background 0.18s, border-color 0.18s, box-shadow 0.18s",
                          }}
                          animate={selected === 0 ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                          transition={{ duration: 0.9, repeat: selected === 0 ? Infinity : 0 }}
                        >
                          {selected === 0 && (
                            <motion.div className="absolute inset-0 rounded-full pointer-events-none overflow-hidden" style={{ borderRadius: "50%" }}>
                              <motion.div
                                style={{ position: "absolute", inset: 0, background: "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)" }}
                                animate={{ x: ["-120%", "220%"] }}
                                transition={{ duration: 1.3, repeat: Infinity, repeatDelay: 1 }} />
                            </motion.div>
                          )}
                          <span style={{
                            fontSize: 13, fontWeight: 900,
                            color: selected === 0 ? "#fff" : "#10b981",
                            letterSpacing: "-0.01em",
                            textShadow: selected === 0 ? "0 0 10px rgba(16,185,129,0.8)" : "none",
                          }}>FREE</span>
                          {selected === 0 && (
                            <motion.div
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: "#22c55e", border: "1.5px solid #fff", fontSize: 10, fontWeight: 900, color: "#fff" }}
                              initial={{ scale: 0 }} animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 22 }}>
                              ✓
                            </motion.div>
                          )}
                        </motion.button>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.35)", letterSpacing: "0.04em" }}>
                          PRACTICE
                        </span>
                      </div>

                      {/* Paid fee buttons */}
                      {tiers.map((fee, i) => (
                        <FeeButton
                          key={fee}
                          fee={fee}
                          isSelected={selected === fee}
                          canAfford={total >= fee}
                          isBest={i === bestIdx}
                          accent={cfg.accent}
                          onClick={() => setSelected(fee)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ── BOT DIFFICULTY BADGE ── */}
                  <motion.div
                    key={difficulty.level}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className="mx-4 mb-3 flex items-center justify-between px-4 py-2.5 rounded-2xl"
                    style={{
                      background: `${difficulty.color}12`,
                      border: `1.5px solid ${difficulty.color}40`,
                      boxShadow: `0 0 18px ${difficulty.glowColor}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <motion.span
                        className="text-xl"
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 1.4, repeat: Infinity }}
                      >
                        {difficulty.emoji}
                      </motion.span>
                      <div>
                        <div className="font-black text-sm leading-tight" style={{ color: difficulty.color }}>
                          {difficulty.level}
                        </div>
                        <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                          Bot Difficulty
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="text-[10px] font-black" style={{ color: "rgba(255,255,255,0.7)" }}>
                        {difficulty.botName}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: `${difficulty.color}25`, color: difficulty.color }}>
                          Error {(difficulty.errorRate * 100).toFixed(0)}%
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}>
                          {difficulty.reactionTime}ms
                        </span>
                      </div>
                    </div>
                  </motion.div>

                  {/* Add money hint */}
                  {total < Math.max(...tiers) && (
                    <div className="flex items-center gap-2 mx-4 mb-3 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
                      <span className="text-base">💡</span>
                      <span className="text-[10px] font-bold flex-1" style={{ color: "rgba(245,158,11,0.75)" }}>
                        Add money to unlock higher-stakes rooms
                      </span>
                      <motion.button whileTap={{ scale: 0.95 }}
                        onClick={() => { onClose(); onAddMoney?.(); }}
                        className="px-2.5 py-1 rounded-lg font-black text-[10px] cursor-pointer flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000" }}>
                        Add
                      </motion.button>
                    </div>
                  )}
                </div>
                {/* END scrollable body */}

                {/* ─────────────────────────────────────────────────────
                    STICKY FOOTER — always visible, never scrolls away
                ───────────────────────────────────────────────────── */}
                <div
                  className="flex-shrink-0"
                  style={{
                    background: "rgba(8,4,20,0.96)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    borderTop: `1px solid ${cfg.accent}25`,
                    boxShadow: `0 -8px 32px rgba(0,0,0,0.6), 0 -1px 0 ${cfg.accent}20`,
                    paddingBottom: "env(safe-area-inset-bottom, 20px)",
                  }}
                >
                  {/* Wallet row */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                        style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                        <span className="text-base">💰</span>
                        <div>
                          <div className="text-[9px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>Balance</div>
                          <div className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</div>
                        </div>
                      </div>
                      {bonus > 0 && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                          style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                          <span className="text-xs">🎁</span>
                          <div>
                            <div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>Bonus</div>
                            <div className="text-xs font-black" style={{ color: "#22c55e" }}>₹{bonus.toFixed(0)}</div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>
                      <span>🔒</span><span className="font-bold">Secure</span>
                    </div>
                  </div>

                  {/* PLAY NOW / PLAY FREE button */}
                  <div className="px-4 pb-5">
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handlePlay}
                      disabled={!canPlaySelected}
                      className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer relative overflow-hidden"
                      style={{
                        background: isFreeMode
                          ? "linear-gradient(135deg, #065f46, #047857, #059669)"
                          : canPlaySelected
                          ? "linear-gradient(135deg, #16a34a, #15803d)"
                          : "rgba(255,255,255,0.06)",
                        color: canPlaySelected ? "#fff" : "rgba(255,255,255,0.22)",
                        boxShadow: isFreeMode
                          ? "0 0 28px rgba(16,185,129,0.6), 0 0 60px rgba(16,185,129,0.25)"
                          : canPlaySelected
                          ? "0 0 28px rgba(34,197,94,0.5), 0 0 60px rgba(34,197,94,0.2)"
                          : "none",
                        border: isFreeMode
                          ? "1.5px solid rgba(16,185,129,0.5)"
                          : canPlaySelected ? "none" : "1px solid rgba(255,255,255,0.08)",
                        letterSpacing: "0.06em",
                      }}
                      animate={canPlaySelected ? {
                        boxShadow: isFreeMode ? [
                          "0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.18)",
                          "0 0 36px rgba(16,185,129,0.75), 0 0 72px rgba(16,185,129,0.32)",
                          "0 0 20px rgba(16,185,129,0.4), 0 0 40px rgba(16,185,129,0.18)",
                        ] : [
                          "0 0 20px rgba(34,197,94,0.35), 0 0 40px rgba(34,197,94,0.15)",
                          "0 0 36px rgba(34,197,94,0.65), 0 0 72px rgba(34,197,94,0.28)",
                          "0 0 20px rgba(34,197,94,0.35), 0 0 40px rgba(34,197,94,0.15)",
                        ],
                      } : {}}
                      transition={{ duration: 1.8, repeat: Infinity }}
                    >
                      {/* Shimmer sweep */}
                      {canPlaySelected && (
                        <motion.div className="absolute inset-0 pointer-events-none"
                          style={{ background: "linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.22) 50%,transparent 70%)" }}
                          animate={{ x: ["-130%", "230%"] }}
                          transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.9 }} />
                      )}
                      {isFreeMode
                        ? "🎮  PLAY FREE — Practice Mode"
                        : canPlaySelected
                        ? `▶  PLAY NOW  —  ₹${selected}`
                        : `Need ₹${Math.ceil(selected - total)} more to play`}
                    </motion.button>
                    {isFreeMode && (
                      <p className="text-center mt-2 text-[10px] font-bold" style={{ color: "rgba(16,185,129,0.55)" }}>
                        No entry fee · No rewards · Unlimited practice
                      </p>
                    )}
                  </div>
                </div>
                {/* END sticky footer */}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
