import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";

const REFERRAL_CODE = "WINGGO50";
const USER_STATS = { earned: 650, friends: 13, pending: 150 };

const TOP_REFERRERS = [
  { rank: 1, name: "Rohit_P",  friends: 84, earned: "₹4,200" },
  { rank: 2, name: "Priya_K",  friends: 71, earned: "₹3,550" },
  { rank: 3, name: "Amit_S",   friends: 63, earned: "₹3,150" },
  { rank: 4, name: "Meera_V",  friends: 54, earned: "₹2,700" },
  { rank: 5, name: "You",      friends: USER_STATS.friends, earned: `₹${USER_STATS.earned}`, isMe: true },
];

const STEPS = [
  { num: "1", icon: "📤", title: "Share Your Code", desc: "Share your unique WINGGO referral code with friends" },
  { num: "2", icon: "👤", title: "Friend Joins", desc: "Friend signs up on WINGGO using your referral code" },
  { num: "3", icon: "🎮", title: "Friend Plays", desc: "Your friend plays any game and deposits cash" },
  { num: "4", icon: "💰", title: "You Earn!", desc: "Instant bonus credited to your wallet — unlimited!" },
];

const BENEFITS = [
  { icon: "💵", label: "Bonus Cash",        value: "₹50/refer" },
  { icon: "🪙", label: "Extra Coins",        value: "500 coins" },
  { icon: "🎁", label: "Daily Rewards",      value: "Every day" },
  { icon: "⚡", label: "Instant Cashback",   value: "On deposit" },
  { icon: "🏆", label: "Leaderboard Prize",  value: "Top 10 win" },
  { icon: "♾️", label: "No Referral Limit",  value: "Unlimited" },
];

interface Props { onBack?: () => void }

export default function ReferEarn({ onBack }: Props) {
  const [copied, setCopied] = useState(false);
  const [shareFlash, setShareFlash] = useState(false);

  const handleCopy = useCallback(() => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(REFERRAL_CODE).catch(() => {});
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleShare = useCallback(() => {
    setShareFlash(true);
    setTimeout(() => setShareFlash(false), 600);
    if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: object) => Promise<void> }).share) {
      (navigator as Navigator & { share: (d: object) => Promise<void> }).share({
        title: "WINGGO — Play More Win More",
        text: `Join WINGGO with my code ${REFERRAL_CODE} and get ₹50 free! India's #1 gaming platform. 🎮`,
        url: "https://winggo.app",
      }).catch(() => {});
    }
  }, []);

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      {/* ── HEADER ── */}
      <div
        className="relative shrink-0 flex flex-col items-center pt-10 pb-6 overflow-hidden"
        style={{
          background: "linear-gradient(160deg, #0e0020 0%, #05100a 60%, #07050f 100%)",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* sparkle particles */}
        {Array.from({ length: 12 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 3 + (i % 3),
              height: 3 + (i % 3),
              left: `${8 + i * 7.5}%`,
              top: `${15 + (i % 4) * 18}%`,
              background: i % 3 === 0 ? "#FFD700" : i % 3 === 1 ? "#27ae60" : "#9b59b6",
            }}
            animate={{ opacity: [0, 1, 0], y: [0, -20] }}
            transition={{ duration: 1.8 + (i % 3) * 0.4, delay: i * 0.15, repeat: Infinity }}
          />
        ))}

        <div className="absolute top-4 left-4 z-50">
          <BackButton onBack={onBack} label="Home" />
        </div>

        {/* Badge */}
        <span
          className="text-xs font-black px-3 py-1 rounded-full mb-3"
          style={{ background: "rgba(39,174,96,0.15)", border: "1px solid rgba(39,174,96,0.4)", color: "#27ae60" }}
        >
          🎁 REFER &amp; EARN
        </span>

        <h1 className="font-black text-3xl text-white tracking-tight text-center leading-tight">
          Invite Friends<br />
          <span style={{ color: "#FFD700" }}>Earn Unlimited</span>
        </h1>
        <p className="text-xs font-bold mt-2 tracking-wide" style={{ color: "rgba(255,255,255,0.4)" }}>
          Get instant rewards on every referral · No limit
        </p>

        {/* Stat strip */}
        <div className="flex gap-4 mt-5">
          {[
            { label: "Total Earned",   value: `₹${USER_STATS.earned}`, color: "#FFD700" },
            { label: "Friends Joined", value: `${USER_STATS.friends}`,  color: "#27ae60" },
            { label: "Pending",        value: `₹${USER_STATS.pending}`, color: "#f39c12" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5">
              <span className="font-black text-xl" style={{ color: s.color }}>{s.value}</span>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── SCROLLABLE BODY ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── REFERRAL CODE CARD ── */}
        <div className="px-4 mt-5">
          <div
            className="rounded-2xl p-4"
            style={{
              background: "rgba(255,215,0,0.06)",
              border: "1.5px solid rgba(255,215,0,0.25)",
              boxShadow: "0 0 24px rgba(255,215,0,0.08)",
            }}
          >
            <div className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "rgba(255,215,0,0.55)" }}>
              Your Referral Code
            </div>

            {/* Code row */}
            <div className="flex items-center gap-3">
              <div
                className="flex-1 flex items-center justify-center py-3 rounded-xl"
                style={{ background: "rgba(255,215,0,0.08)", border: "1px dashed rgba(255,215,0,0.35)" }}
              >
                <span className="font-black text-2xl tracking-[0.25em]" style={{ color: "#FFD700" }}>
                  {REFERRAL_CODE}
                </span>
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleCopy}
                className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl cursor-pointer"
                style={{
                  background: copied ? "rgba(39,174,96,0.2)" : "rgba(255,215,0,0.12)",
                  border: `1.5px solid ${copied ? "rgba(39,174,96,0.5)" : "rgba(255,215,0,0.4)"}`,
                  minWidth: 64,
                }}
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.span key="check" className="text-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>✅</motion.span>
                  ) : (
                    <motion.span key="copy" className="text-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>📋</motion.span>
                  )}
                </AnimatePresence>
                <span className="text-xs font-black" style={{ color: copied ? "#27ae60" : "#FFD700" }}>
                  {copied ? "Copied!" : "Copy"}
                </span>
              </motion.button>
            </div>

            {/* Reward info */}
            <div className="mt-3 flex gap-2">
              <div className="flex-1 py-2 px-3 rounded-xl text-center" style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}>
                <div className="font-black text-sm" style={{ color: "#27ae60" }}>₹50</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>You get</div>
              </div>
              <div className="flex-1 py-2 px-3 rounded-xl text-center" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)" }}>
                <div className="font-black text-sm" style={{ color: "#FFD700" }}>₹50</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>Friend gets</div>
              </div>
              <div className="flex-1 py-2 px-3 rounded-xl text-center" style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)" }}>
                <div className="font-black text-sm" style={{ color: "#9b59b6" }}>∞</div>
                <div className="text-xs" style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>No limit</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SHARE BUTTONS ── */}
        <div className="px-4 mt-4 grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleShare}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #25d366, #128c7e)",
              color: "#fff",
              boxShadow: shareFlash ? "0 0 24px rgba(37,211,102,0.6)" : "0 0 12px rgba(37,211,102,0.25)",
            }}
          >
            <span className="text-lg">📱</span> Share on WhatsApp
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #FFD700, #ff8c00)",
              color: "#000",
              boxShadow: "0 0 12px rgba(255,215,0,0.3)",
            }}
          >
            <span className="text-lg">🔗</span> Copy Link
          </motion.button>
        </div>

        {/* ── HOW IT WORKS ── */}
        <div className="px-4 mt-6">
          <p className="text-xs font-black tracking-widest uppercase mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
            🎯 How It Works
          </p>

          <div className="relative">
            {/* connector line */}
            <div className="absolute left-[22px] top-6 bottom-6 w-px" style={{ background: "rgba(255,215,0,0.12)" }} />

            <div className="space-y-4">
              {STEPS.map((step, i) => (
                <motion.div
                  key={step.num}
                  className="flex items-start gap-4"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  {/* Step circle */}
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-xl shrink-0 relative z-10"
                    style={{
                      background: "rgba(255,215,0,0.1)",
                      border: "1.5px solid rgba(255,215,0,0.3)",
                      boxShadow: "0 0 12px rgba(255,215,0,0.1)",
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Step content */}
                  <div
                    className="flex-1 py-3 px-4 rounded-2xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="text-xs font-black px-1.5 py-0.5 rounded-md"
                        style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}
                      >
                        STEP {step.num}
                      </span>
                      <span className="text-sm font-black text-white">{step.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.38)" }}>
                      {step.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ── BENEFITS GRID ── */}
        <div className="px-4 mt-6">
          <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            🎁 Referral Benefits
          </p>
          <div className="grid grid-cols-3 gap-2">
            {BENEFITS.map((b, i) => (
              <motion.div
                key={b.label}
                className="flex flex-col items-center gap-1.5 py-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
              >
                <span className="text-2xl">{b.icon}</span>
                <span className="text-xs font-black text-white text-center leading-tight">{b.label}</span>
                <span
                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,215,0,0.1)", color: "#FFD700", fontSize: "9px" }}
                >
                  {b.value}
                </span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* ── TOP REFERRERS LEADERBOARD ── */}
        <div className="px-4 mt-6">
          <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
            🏆 Top Referrers This Week
          </p>

          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {TOP_REFERRERS.map((row, i) => (
              <motion.div
                key={row.name}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  background: row.isMe ? "rgba(255,215,0,0.07)" : i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                  borderBottom: i < TOP_REFERRERS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                }}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07 }}
              >
                {/* Rank */}
                <span
                  className="text-sm font-black w-6 text-center"
                  style={{
                    color: i === 0 ? "#FFD700" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "rgba(255,255,255,0.25)",
                  }}
                >
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : row.rank}
                </span>

                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                  style={{
                    background: row.isMe
                      ? "linear-gradient(135deg,#FFD700,#ff8c00)"
                      : "linear-gradient(135deg,#9b59b6,#3498db)",
                  }}
                >
                  {row.name[0]}
                </div>

                {/* Name */}
                <span
                  className="flex-1 text-sm font-bold"
                  style={{ color: row.isMe ? "#FFD700" : "rgba(255,255,255,0.65)" }}
                >
                  {row.name}
                </span>

                {/* Friends */}
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                  👥 {row.friends}
                </span>

                {/* Earned */}
                <span
                  className="text-xs font-black w-16 text-right"
                  style={{ color: row.isMe ? "#27ae60" : "rgba(255,255,255,0.5)" }}
                >
                  {row.earned}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Motivational nudge */}
          <motion.div
            className="mt-3 py-3 px-4 rounded-2xl flex items-center gap-3"
            style={{ background: "rgba(139,92,246,0.07)", border: "1px solid rgba(139,92,246,0.2)" }}
            animate={{ opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2.2, repeat: Infinity }}
          >
            <span className="text-xl">🚀</span>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
              Refer <span style={{ color: "#9b59b6" }}>3 more friends</span> to enter the top 3 and win{" "}
              <span style={{ color: "#FFD700" }}>₹500 bonus prize!</span>
            </span>
          </motion.div>
        </div>

        {/* ── UNLIMITED BADGE ── */}
        <div className="mx-4 mt-4 mb-2">
          <motion.div
            className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(39,174,96,0.08) 100%)",
              border: "1px solid rgba(255,215,0,0.2)",
            }}
            animate={{ boxShadow: ["0 0 0 rgba(255,215,0,0)", "0 0 20px rgba(255,215,0,0.15)", "0 0 0 rgba(255,215,0,0)"] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <span className="text-2xl">♾️</span>
            <div>
              <div className="font-black text-white text-sm">Unlimited Referral Earnings</div>
              <div className="text-xs" style={{ color: "rgba(255,255,255,0.38)" }}>No cap. No expiry. Earn forever.</div>
            </div>
          </motion.div>
        </div>

        {/* ── SHARE CTA ── */}
        <div className="px-4 mt-3 mb-10">
          <motion.button
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.02 }}
            onClick={handleShare}
            className="w-full py-4 rounded-2xl font-black text-lg cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #27ae60 0%, #1e8449 100%)",
              color: "#fff",
              boxShadow: "0 0 28px rgba(39,174,96,0.4), 0 4px 20px rgba(0,0,0,0.4)",
              letterSpacing: "0.04em",
            }}
          >
            📲 REFER NOW &amp; EARN BIG 💰
          </motion.button>
        </div>
      </div>
      {/* bottom nav clearance */}
      <div style={{ height: 90 }} />
    </motion.div>
  );
}
