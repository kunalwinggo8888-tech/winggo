/**
 * AdminLogin — WINGGO Admin v2
 * Dark pro-hacker theme: Black + Neon Blue
 * Same auth logic: SHA-256 hash comparison with lockout after 5 failures.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { adminSignIn } from "@/firebase/config";

interface Props { onLogin: () => void; onStaffLogin?: () => void; onRecovery?: () => void; }

export default function AdminLogin({ onLogin, onStaffLogin, onRecovery }: Props) {
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

  useEffect(() => {
    if (!locked || lockTimer <= 0) return;
    intervalRef.current = setInterval(() => {
      setLockTimer((t) => {
        if (t <= 1) { setLocked(false); setAttempts(0); setErr(""); clearInterval(intervalRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [locked, lockTimer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!adminId.trim() || !password) { setErr("Enter your Admin ID and password."); return; }
    setLoading(true); setErr("");
    const result = await adminSignIn(adminId.trim(), password);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(() => onLogin(), 1100);
    } else {
      const n = attempts + 1;
      setAttempts(n);
      if (n >= 5) { setLocked(true); setLockTimer(60); setErr("Too many failed attempts. Locked for 60 seconds."); }
      else { setErr(result.error ?? `Invalid credentials. ${5 - n} attempt${5 - n !== 1 ? "s" : ""} remaining.`); }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#060a10" }}>

      {/* ── Animated background ────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(0,212,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.04) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }} />
        {/* Neon blue orb top-right */}
        <motion.div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 65%)" }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }} />
        {/* Deep blue orb bottom-left */}
        <motion.div className="absolute bottom-[-25%] left-[-25%] w-[70%] h-[70%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(0,85,255,0.15) 0%, transparent 65%)" }}
          animate={{ scale: [1, 1.07, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2 }} />
        {/* Scan line animation */}
        <motion.div className="absolute left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)" }}
          animate={{ top: ["-2%", "102%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear", repeatDelay: 2 }} />
      </div>

      {/* ── Login card ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, y: -16 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full mx-4 rounded-3xl"
            style={{
              maxWidth: 420,
              background: "rgba(8,13,24,0.88)",
              border: "1px solid rgba(0,212,255,0.22)",
              boxShadow: "0 0 60px rgba(0,212,255,0.1), 0 32px 80px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.03)",
              backdropFilter: "blur(28px)",
            }}
          >
            {/* Top shimmer line */}
            <div className="absolute top-0 left-10 right-10 h-px rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.7), transparent)" }} />

            <div className="p-8 md:p-10">

              {/* ── Logo ──────────────────────────────────────────────────────── */}
              <div className="flex flex-col items-center mb-8">
                <motion.div
                  className="mb-4 flex items-center justify-center text-4xl rounded-2xl"
                  style={{
                    width: 72, height: 72,
                    background: "linear-gradient(135deg, rgba(0,212,255,0.12) 0%, rgba(0,85,255,0.18) 100%)",
                    border: "1.5px solid rgba(0,212,255,0.35)",
                  }}
                  animate={{ boxShadow: [
                    "0 0 20px rgba(0,212,255,0.15), 0 0 0 6px rgba(0,212,255,0.03)",
                    "0 0 40px rgba(0,212,255,0.35), 0 0 0 10px rgba(0,212,255,0.06)",
                    "0 0 20px rgba(0,212,255,0.15), 0 0 0 6px rgba(0,212,255,0.03)",
                  ]}}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                >
                  ⚡
                </motion.div>

                <div className="text-3xl font-black tracking-tight">
                  <span className="text-white">WIN</span>
                  <span style={{ color: "#00d4ff" }}>GGO</span>
                </div>
                <p className="text-[11px] font-black tracking-[0.3em] mt-1" style={{ color: "rgba(0,212,255,0.5)" }}>
                  ADMIN CONSOLE
                </p>
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.14)" }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00ff88" }}
                    animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
                  <span className="text-[10px] font-black" style={{ color: "#00ff88" }}>SECURE ACCESS</span>
                </div>
              </div>

              {/* ── Form ──────────────────────────────────────────────────────── */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Admin ID */}
                {[
                  { label: "ADMIN ID", value: adminId, onChange: (v: string) => { setAdminId(v); setErr(""); },
                    type: "text", placeholder: "Enter Admin ID", autoComplete: "username" },
                ].map(({ label, value, onChange, type, placeholder, autoComplete }) => (
                  <div key={label}>
                    <label className="text-[10px] font-black tracking-[0.18em] block mb-2" style={{ color: "rgba(0,212,255,0.5)" }}>
                      {label}
                    </label>
                    <input
                      type={type} value={value} placeholder={placeholder} autoComplete={autoComplete}
                      disabled={locked || loading}
                      onChange={(e) => onChange(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none font-mono transition-all"
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: `1px solid ${value ? "rgba(0,212,255,0.35)" : "rgba(0,212,255,0.15)"}`,
                        caretColor: "#00d4ff",
                        opacity: locked ? 0.5 : 1,
                      }}
                      onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(0,212,255,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)"; }}
                      onBlur={(e) => { e.currentTarget.style.border = `1px solid ${value ? "rgba(0,212,255,0.35)" : "rgba(0,212,255,0.15)"}`; e.currentTarget.style.boxShadow = "none"; }}
                    />
                  </div>
                ))}

                {/* Password */}
                <div>
                  <label className="text-[10px] font-black tracking-[0.18em] block mb-2" style={{ color: "rgba(0,212,255,0.5)" }}>
                    PASSWORD
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={password}
                      placeholder="Enter password" autoComplete="current-password"
                      disabled={locked || loading}
                      onChange={(e) => { setPassword(e.target.value); setErr(""); }}
                      className="w-full px-4 py-3.5 pr-12 rounded-xl text-white text-sm outline-none font-mono transition-all"
                      style={{
                        background: "rgba(0,0,0,0.4)",
                        border: `1px solid ${password ? "rgba(0,212,255,0.35)" : "rgba(0,212,255,0.15)"}`,
                        caretColor: "#00d4ff",
                        opacity: locked ? 0.5 : 1,
                      }}
                      onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(0,212,255,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(0,212,255,0.08)"; }}
                      onBlur={(e) => { e.currentTarget.style.border = `1px solid ${password ? "rgba(0,212,255,0.35)" : "rgba(0,212,255,0.15)"}`; e.currentTarget.style.boxShadow = "none"; }}
                    />
                    <motion.button type="button" whileTap={{ scale: 0.85 }} tabIndex={-1}
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                      style={{ background: "rgba(0,212,255,0.07)", color: showPass ? "#00d4ff" : "rgba(226,232,240,0.3)", fontSize: 14 }}>
                      {showPass ? "🙈" : "👁"}
                    </motion.button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {err && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                      className="px-4 py-3 rounded-xl flex items-start gap-2.5"
                      style={{ background: "rgba(255,51,102,0.08)", border: "1px solid rgba(255,51,102,0.22)" }}>
                      <span className="text-base shrink-0">{locked ? "🔒" : "⚠️"}</span>
                      <div className="flex-1">
                        <p className="text-xs font-bold" style={{ color: "#ff6680" }}>{err}</p>
                        {locked && lockTimer > 0 && (
                          <p className="text-xs mt-0.5 font-mono" style={{ color: "rgba(255,102,128,0.6)" }}>
                            Try again in {lockTimer}s
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Attempt dots */}
                {attempts > 0 && !locked && (
                  <div className="flex items-center justify-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="w-2 h-2 rounded-full transition-all"
                        style={{
                          background: i <= attempts ? "#ff3366" : "rgba(0,212,255,0.15)",
                          transform: i <= attempts ? "scale(1.3)" : "scale(1)",
                          boxShadow: i <= attempts ? "0 0 6px #ff3366" : "none",
                        }} />
                    ))}
                    <span className="text-[10px] ml-1 font-black font-mono" style={{ color: "rgba(255,51,102,0.6)" }}>
                      {5 - attempts} left
                    </span>
                  </div>
                )}

                {/* Submit */}
                <motion.button type="submit" whileTap={{ scale: 0.97 }}
                  disabled={loading || locked}
                  className="relative w-full py-4 rounded-xl font-black text-sm cursor-pointer overflow-hidden mt-2"
                  style={{
                    background: locked
                      ? "rgba(255,255,255,0.04)"
                      : "linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,85,255,0.28) 100%)",
                    color:      locked ? "rgba(255,255,255,0.2)" : "#00d4ff",
                    border:     `1px solid ${locked ? "rgba(255,255,255,0.06)" : "rgba(0,212,255,0.4)"}`,
                    boxShadow:  locked ? "none" : "0 0 30px rgba(0,212,255,0.15), inset 0 1px 0 rgba(0,212,255,0.1)",
                    letterSpacing: "0.08em",
                    opacity: loading ? 0.8 : 1,
                    transition: "all 0.2s",
                  }}>
                  {!locked && !loading && (
                    <motion.div className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 40%, rgba(0,212,255,0.12) 50%, transparent 60%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }} />
                  )}
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.span key="ld" className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.75, repeat: Infinity, ease: "linear" }}>⚙️</motion.span>
                        Authenticating…
                      </motion.span>
                    ) : locked ? (
                      <motion.span key="lk" className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        🔒 LOCKED · {lockTimer}s
                      </motion.span>
                    ) : (
                      <motion.span key="id" className="flex items-center justify-center gap-2"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        ⚡ ACCESS ADMIN CONSOLE
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </form>

              {/* Footer */}
              <div className="mt-6 flex flex-col items-center gap-3">
                {onStaffLogin && (
                  <button onClick={onStaffLogin}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black cursor-pointer w-full justify-center"
                    style={{ background:"rgba(167,139,250,0.06)", color:"rgba(167,139,250,0.7)", border:"1px solid rgba(167,139,250,0.18)" }}>
                    👤 Staff Portal Login →
                  </button>
                )}
                <div className="flex items-center gap-4">
                  {["🔒 Encrypted", "🛡️ Protected", "📡 Monitored"].map((b) => (
                    <span key={b} className="text-[9px] font-bold" style={{ color: "rgba(0,212,255,0.2)" }}>{b}</span>
                  ))}
                </div>

                {/* Emergency recovery — very subtle, for owner use only */}
                {onRecovery && (
                  <button
                    type="button"
                    onClick={onRecovery}
                    className="text-[8px] font-mono cursor-pointer transition-opacity opacity-25 hover:opacity-60"
                    style={{ color: "rgba(255,80,0,0.9)", letterSpacing: "0.08em" }}
                    title="Owner emergency recovery only">
                    🔑 Emergency Owner Recovery
                  </button>
                )}

                <p className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.12)" }}>
                  WINGGO ADMIN · UNAUTHORIZED ACCESS PROHIBITED
                </p>
              </div>
            </div>
          </motion.div>

        ) : (
          /* ── Access granted animation ─────────────────────────────────────── */
          <motion.div key="success" initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5 text-center px-8">
            <motion.div className="text-6xl"
              animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
              ✅
            </motion.div>
            <div>
              <p className="text-2xl font-black text-white">ACCESS GRANTED</p>
              <p className="text-sm mt-2 font-mono" style={{ color: "rgba(0,212,255,0.6)" }}>
                Initializing admin console…
              </p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full"
                  style={{ background: "#00d4ff" }}
                  animate={{ scale: [0.5, 1.3, 0.5], opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
