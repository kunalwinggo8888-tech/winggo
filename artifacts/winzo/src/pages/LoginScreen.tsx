import { motion } from "framer-motion";

interface LoginScreenProps {
  onLogin?: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d0d 60%, #000000 100%)",
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {/* Ambient gold glow blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.05) 0%, transparent 70%)" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.03) 0%, transparent 60%)" }} />

      {/* Login Card — glassmorphism */}
      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 32, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
        style={{
          background: "rgba(255, 255, 255, 0.04)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 215, 0, 0.15)",
          borderRadius: "24px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          padding: "40px 32px 32px",
        }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-black tracking-tighter leading-none" style={{ fontSize: "3rem" }}>
            <span className="text-white">WIN</span>
            <span
              className="text-[#FFD700]"
              style={{
                textShadow:
                  "0 0 8px rgba(255,215,0,0.9), 0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)",
              }}
            >
              ZO
            </span>
          </h1>
          <p className="text-zinc-400 text-xs font-semibold tracking-[0.2em] uppercase mt-1">
            Enter the Arena
          </p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onLogin?.(); }} className="space-y-5">
          {/* Mobile Number label */}
          <div>
            <label className="block text-zinc-300 text-sm font-medium mb-2">
              Mobile Number
            </label>

            {/* Input row: flag + code + number */}
            <div
              className="flex items-center h-14 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                transition: "border-color 0.2s",
              }}
              onFocus={() => {}}
            >
              {/* Indian flag + code */}
              <div
                className="flex items-center gap-2 px-4 h-full border-r shrink-0"
                style={{ borderColor: "rgba(255,255,255,0.1)" }}
              >
                {/* SVG Indian flag */}
                <span className="text-xl leading-none select-none" aria-label="India flag">
                  🇮🇳
                </span>
                <span className="text-white font-semibold text-sm">+91</span>
              </div>

              {/* Phone number input */}
              <input
                data-testid="input-mobile"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="Enter mobile number"
                className="flex-1 h-full bg-transparent px-4 text-white text-base outline-none placeholder:text-zinc-600 font-medium"
                style={{ caretColor: "#FFD700" }}
              />
            </div>
          </div>

          {/* Get OTP Button */}
          <motion.button
            data-testid="button-get-otp"
            type="submit"
            className="w-full h-14 font-black text-lg text-black rounded-2xl tracking-wide cursor-pointer"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #FFC200 100%)",
              boxShadow: "0 0 20px rgba(255,215,0,0.4), 0 4px 16px rgba(0,0,0,0.4)",
              letterSpacing: "0.05em",
            }}
            whileHover={{
              scale: 1.02,
              boxShadow: "0 0 32px rgba(255,215,0,0.6), 0 4px 20px rgba(0,0,0,0.4)",
            }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            GET OTP
          </motion.button>
        </form>

        {/* Divider hint */}
        <p className="text-center text-zinc-600 text-xs mt-6">
          OTP will be sent to your registered mobile number
        </p>
      </motion.div>

      {/* Footer links */}
      <motion.div
        className="mt-8 flex items-center gap-3 text-xs text-zinc-600 relative z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
      >
        <a
          href="#"
          data-testid="link-terms"
          className="hover:text-[#FFD700] transition-colors duration-200"
        >
          Terms &amp; Conditions
        </a>
        <span className="w-px h-3 bg-zinc-700" />
        <a
          href="#"
          data-testid="link-privacy"
          className="hover:text-[#FFD700] transition-colors duration-200"
        >
          Privacy Policy
        </a>
      </motion.div>
    </motion.div>
  );
}
