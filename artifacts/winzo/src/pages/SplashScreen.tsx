import { motion } from "framer-motion";

export default function SplashScreen() {
  return (
    <motion.div
      className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden z-50"
      style={{
        background: "radial-gradient(ellipse at center, #0f0a1e 0%, #07050f 60%, #000000 100%)",
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
    >
      {/* Animated background rings */}
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-yellow-400/10"
          style={{ width: i * 220, height: i * 220 }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.4 + i * 0.4, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}

      {/* Particle dots */}
      {Array.from({ length: 18 }, (_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: Math.random() * 4 + 2,
            height: Math.random() * 4 + 2,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? "#FFD700" : i % 3 === 1 ? "#9b59b6" : "#fff",
          }}
          animate={{ opacity: [0, 1, 0], y: [0, -30, -60] }}
          transition={{
            duration: 2.5 + Math.random() * 2,
            delay: Math.random() * 2,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Logo glow halo */}
          <div
            className="absolute inset-0 blur-3xl -z-10 scale-110"
            style={{ background: "radial-gradient(circle, rgba(255,215,0,0.3) 0%, transparent 70%)" }}
          />

          <h1 className="font-black tracking-tighter leading-none select-none" style={{ fontSize: "clamp(72px,20vw,112px)" }}>
            <span className="text-white">WIN</span>
            <span
              style={{
                color: "#FFD700",
                textShadow:
                  "0 0 12px rgba(255,215,0,0.9), 0 0 30px rgba(255,215,0,0.6), 0 0 60px rgba(255,215,0,0.3)",
              }}
            >
              GGO
            </span>
          </h1>
        </motion.div>

        {/* Tagline */}
        <motion.p
          className="text-xs font-bold tracking-[0.3em] uppercase"
          style={{ color: "rgba(255,215,0,0.7)" }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.6 }}
        >
          Play More · Win More
        </motion.p>

        {/* Feature pills */}
        <motion.div
          className="flex gap-2 flex-wrap justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          {["⚡ Fast Matchmaking", "💰 Instant Withdrawal", "🎮 100+ Games"].map((tag) => (
            <span
              key={tag}
              className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{
                background: "rgba(255,215,0,0.1)",
                border: "1px solid rgba(255,215,0,0.25)",
                color: "rgba(255,255,255,0.7)",
              }}
            >
              {tag}
            </span>
          ))}
        </motion.div>

        {/* Loading bar */}
        <motion.div
          className="w-32 h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(255,255,255,0.08)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.4 }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: "linear-gradient(90deg,#FFD700,#ff8c00)" }}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 1.1, duration: 1.7, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      {/* India's #1 badge */}
      <motion.div
        className="absolute bottom-10 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
      >
        <div className="text-xs font-bold tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
          🇮🇳 India's Fast Growing Gaming Platform
        </div>
      </motion.div>
    </motion.div>
  );
}
