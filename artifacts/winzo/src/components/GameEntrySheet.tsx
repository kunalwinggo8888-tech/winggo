/**
 * GameEntrySheet — WINGGO
 * Premium WinZO-style game entry bottom-sheet.
 * Slides up from the bottom with neon glow, entry fee cards, and wallet info.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

// ─── CONSTANTS ────────────────────────────────────────────────

const WIN_RATIO = 0.85;

const ENTRY_TIERS = [1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 200, 500, 1000];

// Tier color theme — cycles across fees
const TIER_COLORS = [
  { bg: "rgba(99,102,241,0.14)",  border: "rgba(99,102,241,0.35)",  glow: "rgba(99,102,241,0.25)",  label: "#818cf8" },
  { bg: "rgba(168,85,247,0.14)",  border: "rgba(168,85,247,0.35)",  glow: "rgba(168,85,247,0.25)",  label: "#c084fc" },
  { bg: "rgba(59,130,246,0.14)",  border: "rgba(59,130,246,0.35)",  glow: "rgba(59,130,246,0.25)",  label: "#60a5fa" },
  { bg: "rgba(124,58,237,0.14)",  border: "rgba(124,58,237,0.35)",  glow: "rgba(124,58,237,0.25)",  label: "#a78bfa" },
  { bg: "rgba(236,72,153,0.14)",  border: "rgba(236,72,153,0.35)",  glow: "rgba(236,72,153,0.25)",  label: "#f472b6" },
];

// ─── TYPES ────────────────────────────────────────────────────

export interface SheetGame {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  players: string;
}

interface Props {
  game: SheetGame | null;
  onClose: () => void;
  onPlay: (entryFee: number) => void;
}

// ─── FLOATING COIN ────────────────────────────────────────────

function FloatingCoins() {
  const coins = Array.from({ length: 10 }, (_, i) => ({
    id: i,
    x: 8 + i * 9,
    delay: i * 0.18,
    dur: 1.4 + (i % 4) * 0.25,
    emoji: i % 3 === 0 ? "💎" : "🪙",
    size: i % 2 === 0 ? 18 : 14,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {coins.map((c) => (
        <motion.div key={c.id} className="absolute select-none"
          style={{ left: `${c.x}%`, bottom: 0, fontSize: c.size }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: [-10, -70, -50], opacity: [0, 1, 0] }}
          transition={{ delay: c.delay, duration: c.dur, repeat: Infinity, repeatDelay: 1.2 + c.id * 0.1 }}>
          {c.emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ─── ENTRY FEE CARD ──────────────────────────────────────────

function EntryCard({
  fee, win, theme, isSelected, disabled, onSelect,
}: {
  fee: number; win: number; theme: typeof TIER_COLORS[0];
  isSelected: boolean; disabled: boolean; onSelect: () => void;
}) {
  const fmtWin = win < 1 ? win.toFixed(2) : win % 1 === 0 ? win.toFixed(0) : win.toFixed(1);

  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onSelect}
      disabled={disabled}
      className="flex flex-col rounded-2xl overflow-hidden cursor-pointer relative"
      style={{
        background: isSelected ? theme.bg.replace("0.14", "0.28") : theme.bg,
        border: `1.5px solid ${isSelected ? theme.label : theme.border}`,
        boxShadow: isSelected ? `0 0 18px ${theme.glow}, 0 0 36px ${theme.glow}` : `0 0 8px ${theme.glow}`,
        opacity: disabled ? 0.45 : 1,
        transition: "box-shadow 0.2s, border-color 0.2s",
      }}>

      {/* Top shimmer line */}
      <div className="absolute top-0 left-3 right-3 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${theme.label}70, transparent)` }} />

      {/* Selected glow ring */}
      {isSelected && (
        <motion.div className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ border: `1.5px solid ${theme.label}`, opacity: 0.5 }}
          animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }} />
      )}

      <div className="px-3 pt-3 pb-2">
        {/* Entry label */}
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-black tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.35)" }}>
            ENTRY
          </span>
          {fee >= 100 && (
            <span className="text-[8px] font-black px-1.5 py-px rounded-full"
              style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.25)" }}>
              HOT
            </span>
          )}
        </div>

        {/* Entry fee */}
        <div className="text-lg font-black leading-none" style={{ color: theme.label }}>
          ₹{fee.toLocaleString("en-IN")}
        </div>

        {/* Win amount */}
        <div className="mt-2 mb-2.5">
          <div className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>WIN UP TO</div>
          <motion.div className="text-base font-black leading-tight"
            style={{ color: "#FFD700", textShadow: "0 0 8px rgba(255,215,0,0.4)" }}
            animate={isSelected ? { textShadow: ["0 0 8px rgba(255,215,0,0.3)", "0 0 18px rgba(255,215,0,0.8)", "0 0 8px rgba(255,215,0,0.3)"] } : {}}
            transition={{ duration: 1.2, repeat: Infinity }}>
            ₹{fmtWin}
          </motion.div>
        </div>
      </div>

      {/* PLAY NOW button */}
      <div className="px-2.5 pb-3">
        <motion.div
          className="w-full py-2 rounded-xl font-black text-xs text-center relative overflow-hidden"
          style={{
            background: isSelected
              ? "linear-gradient(135deg, #16a34a, #15803d)"
              : "linear-gradient(135deg, rgba(22,163,74,0.7), rgba(21,128,61,0.7))",
            color: "#fff",
            boxShadow: isSelected ? "0 0 12px rgba(22,163,74,0.6)" : "none",
            letterSpacing: "0.04em",
          }}>
          {isSelected && (
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.2) 50%, transparent 65%)" }}
              animate={{ x: ["-110%", "210%"] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }} />
          )}
          PLAY NOW
        </motion.div>
      </div>
    </motion.button>
  );
}

// ─── MAIN SHEET ───────────────────────────────────────────────

export default function GameEntrySheet({ game, onClose, onPlay }: Props) {
  const { total, wallet } = useWallet();
  const bonus = wallet.bonus;
  const [selected, setSelected] = useState<number | null>(null);

  const canAfford = (fee: number) => total >= fee;

  function handlePlay(fee: number) {
    setSelected(fee);
    setTimeout(() => {
      onPlay(fee);
      setSelected(null);
    }, 320);
  }

  return (
    <AnimatePresence>
      {game && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(14px)", maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* ── Sheet panel ── */}
          <motion.div
            className="fixed bottom-0 inset-x-0 z-[90] flex flex-col overflow-hidden"
            style={{
              maxWidth: 480, margin: "0 auto",
              maxHeight: "92dvh",
              borderRadius: "28px 28px 0 0",
              background: "linear-gradient(175deg, #110330 0%, #080118 40%, #040010 100%)",
              border: "1.5px solid rgba(139,92,246,0.35)",
              borderBottom: "none",
              boxShadow: "0 -8px 60px rgba(124,58,237,0.3), 0 -2px 20px rgba(124,58,237,0.15), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}>

            {/* ── Neon top border glow ── */}
            <motion.div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, #a78bfa, #FFD700, #a78bfa, transparent)" }}
              animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />

            {/* ── Handle ── */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.18)" }} />
            </div>

            {/* ── HEADER (game info) ── */}
            <div className="relative shrink-0 px-5 pb-4 overflow-hidden">
              <FloatingCoins />

              {/* Close button */}
              <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
                className="absolute top-0 right-5 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer z-10"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" }}>
                ✕
              </motion.button>

              <div className="flex items-center gap-4">
                {/* Game icon */}
                <motion.div
                  className="relative shrink-0 w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
                  style={{
                    background: game.gradient,
                    boxShadow: "0 0 24px rgba(139,92,246,0.5), 0 0 48px rgba(139,92,246,0.2)",
                    border: "2px solid rgba(255,255,255,0.15)",
                  }}
                  animate={{ boxShadow: [
                    "0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.15)",
                    "0 0 35px rgba(255,215,0,0.4), 0 0 60px rgba(139,92,246,0.25)",
                    "0 0 20px rgba(139,92,246,0.4), 0 0 40px rgba(139,92,246,0.15)",
                  ] }}
                  transition={{ duration: 2.2, repeat: Infinity }}>
                  {game.icon}
                  {/* Glare */}
                  <div className="absolute top-1 left-2 w-8 h-3 rounded-full opacity-30"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.8), transparent)" }} />
                </motion.div>

                {/* Game name + meta */}
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-black text-white leading-tight">{game.name}</h2>
                  {/* Neon underline */}
                  <motion.div className="h-px w-24 mt-0.5 rounded-full"
                    style={{ background: "linear-gradient(90deg, #a78bfa, #FFD700)" }}
                    animate={{ width: ["60px", "96px", "60px"] }} transition={{ duration: 2, repeat: Infinity }} />
                  <p className="text-sm font-bold mt-2"
                    style={{ background: "linear-gradient(90deg, #a78bfa, #FFD700)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    ✨ Play &amp; Win Real Cash
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <motion.div className="w-1.5 h-1.5 rounded-full bg-red-500"
                      animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
                    <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                      {game.players}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Divider ── */}
            <div className="mx-5 h-px shrink-0"
              style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent)" }} />

            {/* ── Section label ── */}
            <div className="flex items-center justify-between px-5 pt-3.5 pb-2 shrink-0">
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: "rgba(167,139,250,0.7)" }}>
                ⚡ Choose Entry Fee
              </p>
              <span className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.5)" }}>
                Win up to 85%
              </span>
            </div>

            {/* ── ENTRY FEE GRID (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-4 pb-3 min-h-0">
              <div className="grid grid-cols-3 gap-2.5">
                {ENTRY_TIERS.map((fee, i) => {
                  const win = parseFloat((fee * WIN_RATIO).toFixed(2));
                  const theme = TIER_COLORS[i % TIER_COLORS.length];
                  const affordable = canAfford(fee);
                  return (
                    <EntryCard key={fee}
                      fee={fee} win={win} theme={theme}
                      isSelected={selected === fee}
                      disabled={!affordable}
                      onSelect={() => { if (affordable) handlePlay(fee); }}
                    />
                  );
                })}
              </div>

              {/* Low balance nudge */}
              {total < 1 && (
                <motion.div className="mt-3 px-4 py-3 rounded-2xl flex items-center gap-3"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                  <span className="text-xl">💳</span>
                  <div>
                    <p className="text-xs font-black" style={{ color: "#f59e0b" }}>Low Balance</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Add money to play with higher stakes</p>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ── BOTTOM BAR ── */}
            <div className="shrink-0 px-5 py-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.3)", backdropFilter: "blur(10px)" }}>
              <div className="flex items-center justify-between">

                {/* Wallet */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                    <span className="text-base">💰</span>
                    <div>
                      <div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>Balance</div>
                      <div className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</div>
                    </div>
                  </div>

                  {bonus > 0 && (
                    <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl"
                      style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <span className="text-xs">🎁</span>
                      <div>
                        <div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>Bonus</div>
                        <div className="text-xs font-black" style={{ color: "#22c55e" }}>₹{bonus.toFixed(0)} usable</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Secure badge */}
                <div className="flex flex-col items-center gap-0.5 px-2">
                  <span className="text-lg">🔒</span>
                  <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.25)" }}>Secure</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
