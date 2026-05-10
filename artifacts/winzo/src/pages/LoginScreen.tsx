import { motion } from "framer-motion";

interface LoginScreenProps {
  onLogin?: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center, #0f0a1e 0%, #07050f 60%, #000000 100%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      {/* Ambient glow blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />

      {/* Feature badges — top */}
      <motion.div
        className="flex gap-2 flex-wrap justify-center mb-6 relative z-10 px-4"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        {["🏆 Skill Games", "⚡ Instant Win", "🔒 100% Secure"].map((tag) => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>
            {tag}
          </span>
        ))}
      </motion.div>

      {/* Login Card */}
      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 28, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,215,0,0.15)",
          borderRadius: "24px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
          padding: "36px 28px 28px",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-7">
          <h1 className="font-black tracking-tighter leading-none" style={{ fontSize: "3.2rem" }}>
            <span className="text-white">WIN</span>
            <span
              style={{
                color: "#FFD700",
                textShadow: "0 0 10px rgba(255,215,0,0.9), 0 0 24px rgba(255,215,0,0.5), 0 0 48px rgba(255,215,0,0.25)",
              }}
            >
              GGO
            </span>
          </h1>
          <p className="text-xs font-bold tracking-[0.2em] uppercase mt-1.5" style={{ color: "rgba(255,215,0,0.6)" }}>
            Play Skill Games &amp; Win Rewards
          </p>
        </div>

        {/* User count bar */}
        <div className="flex items-center justify-center gap-2 mb-6 py-2 rounded-xl"
          style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.12)" }}>
          <span className="text-sm">👥</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span style={{ color: "#FFD700" }}>4.2L+</span> players online right now
          </span>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onLogin?.(); }} className="space-y-4">
          {/* Mobile input */}
          <div>
            <label className="block text-zinc-400 text-xs font-semibold mb-2 tracking-wide uppercase">
              Mobile Number
            </label>
            <div
              className="flex items-center h-14 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-center gap-2 px-4 h-full border-r shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                <span className="text-xl select-none">🇮🇳</span>
                <span className="text-white font-semibold text-sm">+91</span>
              </div>
              <input
                data-testid="input-mobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter mobile number"
                className="flex-1 h-full bg-transparent px-4 text-white text-base outline-none placeholder:text-zinc-700 font-medium"
                style={{ caretColor: "#FFD700" }}
              />
            </div>
          </div>

          {/* OTP button */}
          <motion.button
            data-testid="button-get-otp"
            type="submit"
            className="w-full h-14 font-black text-lg text-black rounded-2xl tracking-wide cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)",
              boxShadow: "0 0 24px rgba(255,215,0,0.4), 0 4px 20px rgba(0,0,0,0.4)",
              letterSpacing: "0.05em",
            }}
            whileHover={{ scale: 1.02, boxShadow: "0 0 36px rgba(255,215,0,0.65), 0 4px 20px rgba(0,0,0,0.4)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            GET OTP →
          </motion.button>
        </form>

        <p className="text-center text-zinc-700 text-xs mt-5">
          OTP will be sent to your registered mobile number
        </p>

        {/* New user bonus */}
        <motion.div
          className="mt-4 py-3 px-4 rounded-xl flex items-center gap-2"
          style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-lg">🎁</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            New User Bonus — <span style={{ color: "#27ae60" }}>Get ₹50 instantly on signup!</span>
          </span>
        </motion.div>
      </motion.div>

      {/* Bottom perks row */}
      <motion.div
        className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        {[
          { icon: "💰", label: "Instant\nWithdrawal" },
          { icon: "👥", label: "Real\nPlayers" },
          { icon: "🔒", label: "100%\nSecure" },
        ].map(({ icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-xl">{icon}</span>
            <span className="text-xs text-center leading-tight whitespace-pre-line" style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>{label}</span>
          </div>
        ))}
      </motion.div>

      {/* Footer */}
      <motion.div
        className="mt-6 flex items-center gap-3 text-xs text-zinc-700 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.65, duration: 0.5 }}
      >
        <a href="#" data-testid="link-terms" className="hover:text-yellow-400 transition-colors duration-200">Terms &amp; Conditions</a>
        <span className="w-px h-3 bg-zinc-800" />
        <a href="#" data-testid="link-privacy" className="hover:text-yellow-400 transition-colors duration-200">Privacy Policy</a>
      </motion.div>
    </motion.div>
  );
}
