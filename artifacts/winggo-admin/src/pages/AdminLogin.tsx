/**
 * AdminLogin — WINGGO Admin Panel
 * Premium WinZO-style dark gold login page.
 * Uses Username + Password (not email) with SHA-256 hash comparison.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminSignIn } from "@/firebase/config";

interface Props { onLogin: () => void; }

export default function AdminLogin({ onLogin }: Props) {
  const [adminId, setAdminId]     = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState("");
  const [attempts, setAttempts]   = useState(0);
  const [locked, setLocked]       = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [success, setSuccess]     = useState(false);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lockout countdown timer
  useEffect(() => {
    if (!locked || lockTimer <= 0) return;
    intervalRef.current = setInterval(() => {
      setLockTimer((t) => {
        if (t <= 1) {
          setLocked(false);
          setAttempts(0);
          setErr("");
          clearInterval(intervalRef.current!);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [locked, lockTimer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!adminId.trim() || !password) {
      setErr("Please enter your Admin ID and password.");
      return;
    }

    setLoading(true);
    setErr("");

    const result = await adminSignIn(adminId.trim(), password);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
      // Brief success animation before redirect
      setTimeout(() => onLogin(), 900);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // Lock out after 5 failed attempts for 60 seconds
      if (newAttempts >= 5) {
        setLocked(true);
        setLockTimer(60);
        setErr("Too many failed attempts. Locked for 60 seconds.");
      } else {
        setErr(
          result.error ??
          `Invalid credentials. ${5 - newAttempts} attempt${5 - newAttempts !== 1 ? "s" : ""} remaining.`
        );
      }
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#07050f" }}
    >
      {/* ── Animated background ── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gold orb top-right */}
        <motion.div
          className="absolute top-[-15%] right-[-15%] w-[55%] h-[55%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,215,0,0.12) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Purple orb bottom-left */}
        <motion.div
          className="absolute bottom-[-20%] left-[-20%] w-[65%] h-[65%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Subtle grid overlay */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: "linear-gradient(rgba(255,215,0,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.02) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }} />
      </div>

      {/* ── Login Card ── */}
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 28, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.03, y: -12 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full mx-4 rounded-3xl"
            style={{
              maxWidth: 420,
              background: "rgba(10, 8, 20, 0.85)",
              border: "1px solid rgba(255,215,0,0.18)",
              boxShadow: "0 32px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset",
              backdropFilter: "blur(30px)",
            }}
          >
            {/* Top gold shimmer line */}
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,215,0,0.6), transparent)" }} />

            <div className="p-8 md:p-10">
              {/* ── Logo ── */}
              <div className="flex flex-col items-center mb-8">
                <motion.div
                  className="w-18 h-18 rounded-2xl flex items-center justify-center text-4xl mb-4"
                  style={{
                    width: 72, height: 72,
                    background: "linear-gradient(135deg, #1a0a3a 0%, #2a1060 50%, #1a0030 100%)",
                    border: "1.5px solid rgba(255,215,0,0.35)",
                    boxShadow: "0 0 40px rgba(255,215,0,0.25), 0 0 0 8px rgba(255,215,0,0.04)",
                  }}
                  animate={{ boxShadow: [
                    "0 0 30px rgba(255,215,0,0.2), 0 0 0 8px rgba(255,215,0,0.03)",
                    "0 0 50px rgba(255,215,0,0.35), 0 0 0 12px rgba(255,215,0,0.06)",
                    "0 0 30px rgba(255,215,0,0.2), 0 0 0 8px rgba(255,215,0,0.03)",
                  ]}}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  👑
                </motion.div>

                <div className="text-3xl font-black tracking-tight">
                  <span className="text-white">WIN</span>
                  <span style={{ color: "#FFD700" }}>GGO</span>
                </div>
                <div className="text-xs font-black tracking-[0.25em] uppercase mt-1.5"
                  style={{ color: "rgba(255,215,0,0.5)" }}>
                  Super Admin Panel
                </div>
                <div className="mt-2 flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.12)" }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }}
                    animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
                  <span className="text-[10px] font-black" style={{ color: "#34d399" }}>SECURE ACCESS</span>
                </div>
              </div>

              {/* ── Form ── */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Admin ID field */}
                <div>
                  <label className="text-xs font-black tracking-widest uppercase block mb-2"
                    style={{ color: "rgba(255,255,255,0.4)" }}>
                    👤 Admin ID
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={adminId}
                      onChange={(e) => { setAdminId(e.target.value); setErr(""); }}
                      placeholder="Enter your Admin ID"
                      autoComplete="username"
                      disabled={locked || loading}
                      className="w-full rounded-2xl px-4 py-3.5 text-white text-sm outline-none font-medium transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${adminId ? "rgba(255,215,0,0.35)" : "rgba(255,255,255,0.1)"}`,
                        caretColor: "#FFD700",
                        opacity: locked ? 0.5 : 1,
                      }}
                      onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,215,0,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.08)"; }}
                      onBlur={(e)  => { e.currentTarget.style.border = `1px solid ${adminId ? "rgba(255,215,0,0.35)" : "rgba(255,255,255,0.1)"}`; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                </div>

                {/* Password field */}
                <div>
                  <label className="text-xs font-black tracking-widest uppercase block mb-2"
                    style={{ color: "rgba(255,255,255,0.4)" }}>
                    🔑 Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setErr(""); }}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      disabled={locked || loading}
                      className="w-full rounded-2xl px-4 py-3.5 pr-12 text-white text-sm outline-none font-medium transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: `1px solid ${password ? "rgba(255,215,0,0.35)" : "rgba(255,255,255,0.1)"}`,
                        caretColor: "#FFD700",
                        opacity: locked ? 0.5 : 1,
                      }}
                      onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(255,215,0,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,215,0,0.08)"; }}
                      onBlur={(e)  => { e.currentTarget.style.border = `1px solid ${password ? "rgba(255,215,0,0.35)" : "rgba(255,255,255,0.1)"}`; e.currentTarget.style.boxShadow = "none"; }}
                    />
                    {/* Show/hide toggle */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        color: showPass ? "#FFD700" : "rgba(255,255,255,0.3)",
                        fontSize: "14px",
                      }}
                      tabIndex={-1}
                    >
                      {showPass ? "🙈" : "👁"}
                    </motion.button>
                  </div>
                </div>

                {/* Error / lockout message */}
                <AnimatePresence>
                  {err && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="px-4 py-3 rounded-2xl flex items-start gap-2.5"
                      style={{
                        background: locked ? "rgba(239,68,68,0.10)" : "rgba(248,113,113,0.10)",
                        border: locked ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(248,113,113,0.25)",
                      }}
                    >
                      <span className="text-base mt-0.5 shrink-0">{locked ? "🔒" : "⚠️"}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold" style={{ color: "#f87171" }}>{err}</p>
                        {locked && lockTimer > 0 && (
                          <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.6)" }}>
                            Try again in {lockTimer}s
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attempt indicator dots */}
                {attempts > 0 && !locked && (
                  <div className="flex items-center justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full transition-all"
                        style={{
                          background: i <= attempts ? "#f87171" : "rgba(255,255,255,0.1)",
                          transform: i <= attempts ? "scale(1.2)" : "scale(1)",
                        }} />
                    ))}
                    <span className="text-[10px] ml-1 font-bold" style={{ color: "rgba(248,113,113,0.6)" }}>
                      {5 - attempts} attempt{5 - attempts !== 1 ? "s" : ""} left
                    </span>
                  </div>
                )}

                {/* Submit button */}
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.97 }}
                  disabled={loading || locked}
                  className="relative w-full py-4 rounded-2xl font-black text-sm cursor-pointer overflow-hidden mt-2"
                  style={{
                    background: locked
                      ? "rgba(255,255,255,0.05)"
                      : "linear-gradient(135deg, #FFD700 0%, #ff9500 60%, #ff6b00 100%)",
                    color: locked ? "rgba(255,255,255,0.3)" : "#000",
                    boxShadow: locked ? "none" : "0 0 30px rgba(255,165,0,0.4), 0 4px 20px rgba(255,100,0,0.3)",
                    letterSpacing: "0.06em",
                    opacity: loading ? 0.85 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Shimmer overlay on hover */}
                  {!locked && !loading && (
                    <motion.div
                      className="absolute inset-0 rounded-2xl pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
                    />
                  )}

                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.span key="loading" className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}>
                          ⚙️
                        </motion.span>
                        Authenticating…
                      </motion.span>
                    ) : locked ? (
                      <motion.span key="locked" className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        🔒 Locked · {lockTimer}s
                      </motion.span>
                    ) : (
                      <motion.span key="idle" className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        🔐 Sign In to Admin Panel
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </form>

              {/* Footer */}
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex items-center gap-3">
                  {["🔒 Encrypted", "🛡️ Protected", "👁️ Monitored"].map((b) => (
                    <span key={b} className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>{b}</span>
                  ))}
                </div>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.15)" }}>
                  WINGGO Super Admin · Unauthorized access is prohibited
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Success state ── */
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <motion.div
              className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
              style={{ background: "linear-gradient(135deg, rgba(39,174,96,0.2), rgba(39,174,96,0.1))", border: "2px solid rgba(39,174,96,0.4)" }}
              animate={{ scale: [1, 1.1, 1], boxShadow: ["0 0 30px rgba(39,174,96,0.3)", "0 0 60px rgba(39,174,96,0.5)", "0 0 30px rgba(39,174,96,0.3)"] }}
              transition={{ duration: 1, repeat: Infinity }}
            >
              ✅
            </motion.div>
            <div className="text-center">
              <div className="text-xl font-black text-white">Welcome back!</div>
              <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Redirecting to Admin Panel…
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
