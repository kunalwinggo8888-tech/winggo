/**
 * SolitaireEntrySheet — WINGGO
 * Premium bottom-sheet entry modal for Solitaire with:
 * - Magenta/pink top header bar
 * - Deep-purple hexagonal-pattern main area with flying cards
 * - Gold trophy winnings display
 * - Circular entry-amount selector with yellow-gold selected state
 * - Full-width green PLAY NOW button
 * - Framer-Motion slide-up + backdrop
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const WIN_RATIO = 1.7; // 70% margin for platform

const TIERS: { amount: number; tag?: string }[] = [
  { amount: 1,  tag: "Free" },
  { amount: 2 },
  { amount: 5 },
  { amount: 10 },
  { amount: 25 },
  { amount: 50 },
];

const CARD_SUITS = ["♠", "♥", "♦", "♣", "🃏", "♠", "♥", "♦"];

// Honeycomb SVG as inline background-image (path-encoded)
const HONEYCOMB_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='97'%3E%3Cpath d='M28 0 L56 16.2 L56 48.5 L28 64.7 L0 48.5 L0 16.2 Z' fill='none' stroke='rgba(255%2C255%2C255%2C0.055)' stroke-width='1'/%3E%3Cpath d='M28 64.7 L56 80.9 L56 97 L0 97 L0 80.9 Z' fill='none' stroke='rgba(255%2C255%2C255%2C0.055)' stroke-width='1'/%3E%3C/svg%3E")`;

// ─── FLOATING CARDS ────────────────────────────────────────────────────────

function FlyingCards() {
  const cards = CARD_SUITS.map((suit, i) => ({
    suit,
    x: 5 + i * 12.5,
    delay: i * 0.22,
    dur: 2.2 + (i % 3) * 0.4,
    size: i % 2 === 0 ? 20 : 15,
    color: suit === "♥" || suit === "♦" ? "#f87171" : "rgba(255,255,255,0.6)",
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {cards.map((c, i) => (
        <motion.div
          key={i}
          className="absolute select-none font-black"
          style={{ left: `${c.x}%`, bottom: "-4px", fontSize: c.size, color: c.color, textShadow: `0 0 8px ${c.color}80` }}
          initial={{ y: 0, opacity: 0, rotate: 0 }}
          animate={{ y: [-8, -90, -70], opacity: [0, 0.9, 0], rotate: [-15, 15, -8] }}
          transition={{ delay: c.delay, duration: c.dur, repeat: Infinity, repeatDelay: 1.0 + i * 0.08, ease: "easeInOut" }}
        >
          {c.suit}
        </motion.div>
      ))}
    </div>
  );
}

// ─── CIRCULAR ENTRY BUTTON ────────────────────────────────────────────────

function EntryCircle({
  amount, tag, selected, affordable, onSelect,
}: {
  amount: number; tag?: string; selected: boolean; affordable: boolean; onSelect: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onSelect}
        className="relative flex items-center justify-center font-black cursor-pointer"
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: selected
            ? "linear-gradient(135deg, #FFD700 0%, #ffaa00 100%)"
            : affordable
            ? "rgba(255,255,255,0.05)"
            : "rgba(255,255,255,0.02)",
          border: selected
            ? "2px solid #FFD700"
            : "1.5px solid rgba(255,255,255,0.13)",
          boxShadow: selected
            ? "0 0 16px rgba(255,215,0,0.65), 0 0 32px rgba(255,215,0,0.25)"
            : "none",
          color: selected ? "#000" : affordable ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.22)",
          fontSize: amount >= 10 ? "10px" : "11px",
          opacity: affordable ? 1 : 0.38,
          transition: "background 0.18s, box-shadow 0.18s, border 0.18s",
        }}
      >
        {/* Animated glow ring when selected */}
        {selected && (
          <motion.div
            className="absolute pointer-events-none"
            style={{ inset: "-4px", borderRadius: "50%", border: "2px solid rgba(255,215,0,0.5)" }}
            animate={{ opacity: [0.3, 0.9, 0.3], scale: [1, 1.08, 1] }}
            transition={{ duration: 1.1, repeat: Infinity }}
          />
        )}
        ₹{amount}
      </motion.button>

      {/* Tag label under circle */}
      {tag ? (
        <span
          className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
          style={{
            background: "rgba(34,197,94,0.18)",
            color: "#4ade80",
            border: "1px solid rgba(34,197,94,0.32)",
            letterSpacing: "0.03em",
          }}
        >
          {tag}
        </span>
      ) : (
        <span style={{ height: "16px", display: "block" }} />
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onPlay: (fee: number) => void;
  onAddMoney?: () => void;
}

export default function SolitaireEntrySheet({ open, onClose, onPlay, onAddMoney }: Props) {
  const { total } = useWallet();
  const [selectedIdx, setSelectedIdx] = useState(0);

  const tier = TIERS[selectedIdx];
  const winnings = parseFloat((tier.amount * WIN_RATIO).toFixed(2));
  const canAfford = total >= tier.amount;

  function handlePlay() {
    if (!canAfford) { onClose(); onAddMoney?.(); return; }
    onPlay(tier.amount);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Dimmed backdrop ── */}
          <motion.div
            className="fixed inset-0 z-[80]"
            style={{
              background: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(12px)",
              maxWidth: 480,
              margin: "0 auto",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* ── Bottom sheet panel ── */}
          <motion.div
            className="fixed bottom-0 inset-x-0 z-[90] flex flex-col overflow-hidden"
            style={{ maxWidth: 480, margin: "0 auto", borderRadius: "24px 24px 0 0" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 38 }}
          >
            {/* ─────────────────────────────────────────────────────────
                TOP HEADER BAR — magenta / pink
            ───────────────────────────────────────────────────────── */}
            <div
              className="relative flex items-center justify-between px-4 py-3 shrink-0"
              style={{
                background: "linear-gradient(90deg, #e91e8c 0%, #b5006a 100%)",
                boxShadow: "0 2px 20px rgba(233,30,140,0.45)",
              }}
            >
              {/* Left — logo + title */}
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{ background: "rgba(255,255,255,0.2)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3)" }}
                >
                  🃏
                </div>
                <div>
                  <div className="text-white font-black text-base tracking-widest leading-tight">SOLITAIRE</div>
                  <div className="text-white/60 text-[9px] font-bold tracking-wide">CARD GAME</div>
                </div>
              </div>

              {/* Right — Rules, Results, Close */}
              <div className="flex items-center gap-4">
                <button className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <span className="text-base leading-none">📋</span>
                  <span className="text-[9px] text-white/70 font-bold">Rules</span>
                </button>
                <button className="flex flex-col items-center gap-0.5 cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <span className="text-base leading-none">📊</span>
                  <span className="text-[9px] text-white/70 font-bold">Results</span>
                </button>
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={onClose}
                  className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer ml-1"
                  style={{ background: "rgba(255,255,255,0.22)", border: "1px solid rgba(255,255,255,0.3)" }}
                >
                  <span className="text-white text-[11px] font-black">✕</span>
                </motion.button>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────
                MAIN CONTENT AREA — deep purple + honeycomb pattern
            ───────────────────────────────────────────────────────── */}
            <div
              className="relative overflow-hidden shrink-0"
              style={{
                background: "linear-gradient(170deg, #1c0045 0%, #2e0065 45%, #180040 100%)",
                backgroundImage: HONEYCOMB_BG,
                backgroundSize: "56px 97px",
                minHeight: "190px",
              }}
            >
              {/* Flying cards */}
              <FlyingCards />

              {/* Large watermark title */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                <span
                  className="font-black text-white/[0.06] tracking-[0.3em]"
                  style={{ fontSize: "clamp(28px, 8vw, 42px)" }}
                >
                  SOLITAIRE
                </span>
              </div>

              {/* Radial purple glow in center */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  width: "200px", height: "200px",
                  background: "radial-gradient(ellipse, rgba(233,30,140,0.18) 0%, transparent 70%)",
                }}
              />

              {/* Content: icon + winnings */}
              <div className="relative z-10 flex items-center gap-5 px-5 py-6">
                {/* Game icon */}
                <motion.div
                  className="shrink-0 w-20 h-20 rounded-3xl flex items-center justify-center text-4xl"
                  style={{
                    background: "linear-gradient(135deg, rgba(233,30,140,0.35) 0%, rgba(180,0,100,0.25) 100%)",
                    border: "2px solid rgba(233,30,140,0.5)",
                    boxShadow: "0 0 30px rgba(233,30,140,0.4)",
                  }}
                  animate={{
                    boxShadow: [
                      "0 0 20px rgba(233,30,140,0.35), 0 0 40px rgba(233,30,140,0.12)",
                      "0 0 40px rgba(233,30,140,0.6), 0 0 70px rgba(233,30,140,0.2)",
                      "0 0 20px rgba(233,30,140,0.35), 0 0 40px rgba(233,30,140,0.12)",
                    ],
                  }}
                  transition={{ duration: 2.2, repeat: Infinity }}
                >
                  🃏
                  {/* Glass sheen */}
                  <div
                    className="absolute top-2 left-3 w-10 h-3 rounded-full opacity-25"
                    style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.9), transparent)" }}
                  />
                </motion.div>

                {/* Winnings block */}
                <div className="flex-1">
                  <motion.div
                    className="inline-flex items-center gap-3 px-4 py-3 rounded-2xl"
                    style={{
                      background: "rgba(255,215,0,0.07)",
                      border: "1.5px solid rgba(255,215,0,0.3)",
                      boxShadow: "0 0 20px rgba(255,215,0,0.08)",
                    }}
                    animate={{
                      boxShadow: [
                        "0 0 12px rgba(255,215,0,0.06)",
                        "0 0 24px rgba(255,215,0,0.16)",
                        "0 0 12px rgba(255,215,0,0.06)",
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span className="text-3xl">🏆</span>
                    <div>
                      <div
                        className="text-[10px] font-black tracking-[0.15em] uppercase"
                        style={{ color: "rgba(255,215,0,0.5)" }}
                      >
                        Winnings
                      </div>
                      <motion.div
                        className="text-2xl font-black leading-tight"
                        style={{ color: "#FFD700" }}
                        animate={{
                          textShadow: [
                            "0 0 8px rgba(255,215,0,0.4)",
                            "0 0 22px rgba(255,215,0,0.85)",
                            "0 0 8px rgba(255,215,0,0.4)",
                          ],
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        key={selectedIdx}
                        initial={{ scale: 0.85, opacity: 0 }}
                        whileInView={{ scale: 1, opacity: 1 }}
                      >
                        ₹{winnings.toFixed(2)}
                      </motion.div>
                    </div>
                  </motion.div>

                  {/* Player count */}
                  <div className="flex items-center gap-1.5 mt-2.5">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-pink-400"
                      animate={{ opacity: [1, 0.2, 1] }}
                      transition={{ duration: 0.9, repeat: Infinity }}
                    />
                    <span className="text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                      2.1L players online
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────
                BOTTOM SECTION — entry selector + CTA
            ───────────────────────────────────────────────────────── */}
            <div
              className="shrink-0"
              style={{
                background: "linear-gradient(180deg, #0d0022 0%, #080015 100%)",
                paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)",
              }}
            >
              {/* Divider glow */}
              <div
                className="h-px mx-4"
                style={{ background: "linear-gradient(90deg, transparent, rgba(233,30,140,0.4), transparent)" }}
              />

              {/* Entry amount label */}
              <div className="px-5 pt-4 pb-1 flex items-center justify-between">
                <span
                  className="text-[10px] font-black tracking-[0.18em] uppercase"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  Select Entry
                </span>
                <span className="text-[10px] font-bold" style={{ color: "rgba(233,30,140,0.7)" }}>
                  Win up to ₹{(Math.max(...TIERS.map((t) => t.amount)) * WIN_RATIO).toFixed(0)}
                </span>
              </div>

              {/* ── Circular amount selectors ── */}
              <div className="flex items-start gap-1.5 px-4 pt-2 pb-3">
                {TIERS.map((t, i) => (
                  <EntryCircle
                    key={t.amount}
                    amount={t.amount}
                    tag={t.tag}
                    selected={selectedIdx === i}
                    affordable={total >= t.amount}
                    onSelect={() => setSelectedIdx(i)}
                  />
                ))}
              </div>

              {/* Balance strip */}
              <div
                className="flex items-center justify-between mx-4 mb-4 px-4 py-2.5 rounded-xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">💰</span>
                  <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Wallet Balance
                  </span>
                </div>
                <span className="text-sm font-black" style={{ color: "#FFD700" }}>
                  ₹{total.toFixed(2)}
                </span>
              </div>

              {/* ── PLAY NOW / ADD MONEY button ── */}
              <div className="px-4 pb-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handlePlay}
                  className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer relative overflow-hidden"
                  style={{
                    background: canAfford
                      ? "linear-gradient(135deg, #22c55e 0%, #16a34a 50%, #15803d 100%)"
                      : "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)",
                    color: canAfford ? "#fff" : "#000",
                    boxShadow: canAfford
                      ? "0 0 28px rgba(34,197,94,0.55), 0 4px 20px rgba(22,163,74,0.35)"
                      : "0 0 24px rgba(255,215,0,0.45)",
                    letterSpacing: "0.1em",
                  }}
                >
                  {/* Shimmer sweep */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background:
                        "linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.28) 50%, transparent 70%)",
                    }}
                    animate={{ x: ["-120%", "220%"] }}
                    transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
                  />
                  {canAfford ? "▶  PLAY NOW" : "💰  ADD MONEY"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
