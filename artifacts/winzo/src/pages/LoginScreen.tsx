/**
 * LoginScreen — Firebase Email / Password Authentication
 * Modes: Login | Sign Up | Forgot Password
 * Premium WinZO-style dark gold UI, mobile-first 480px
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { signInWithEmail, signUpWithEmail, resetPassword, isDemoMode } from "@/firebase/auth.service";

interface LoginScreenProps {
  onLogin?: (uid: string, email: string, isNewUser?: boolean) => void;
}

type Mode = "login" | "signup" | "forgot";

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode]             = useState<Mode>("login");
  const [loading, setLoading]       = useState(false);
  const [success, setSuccess]       = useState(false);
  const [error, setError]           = useState("");
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetSent, setResetSent]   = useState(false);
  const [inDemoMode, setInDemoMode] = useState(!FIREBASE_ENABLED);

  // Login fields
  const [loginEmail, setLoginEmail]   = useState("");
  const [loginPw, setLoginPw]         = useState("");

  // Signup fields
  const [signupName, setSignupName]   = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPw, setSignupPw]       = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");

  // Forgot password
  const [forgotEmail, setForgotEmail] = useState("");

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setResetSent(false);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!loginEmail.trim()) { setError("Enter your email address."); return; }
    if (!loginPw)            { setError("Enter your password."); return; }
    setLoading(true);
    const res = await signInWithEmail(loginEmail.trim(), loginPw);
    setLoading(false);
    if (res.demo) setInDemoMode(true);
    if (res.success && res.uid) {
      setSuccess(true);
      setTimeout(() => onLogin?.(res.uid!, loginEmail.trim(), res.isNewUser), 800);
    } else {
      setError(res.error ?? "Login failed. Try again.");
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!signupName.trim())   { setError("Enter your full name."); return; }
    if (!signupEmail.trim())  { setError("Enter your email address."); return; }
    if (signupPw.length < 6)  { setError("Password must be at least 6 characters."); return; }
    if (signupPw !== signupConfirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    const res = await signUpWithEmail(signupName.trim(), signupEmail.trim(), signupPw);
    setLoading(false);
    if (res.demo) setInDemoMode(true);
    if (res.success && res.uid) {
      setSuccess(true);
      setTimeout(() => onLogin?.(res.uid!, signupEmail.trim(), true), 800);
    } else {
      setError(res.error ?? "Sign up failed. Try again.");
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!forgotEmail.trim()) { setError("Enter your email address."); return; }
    setLoading(true);
    const res = await resetPassword(forgotEmail.trim());
    setLoading(false);
    if (res.success) {
      setResetSent(true);
    } else {
      setError(res.error ?? "Failed to send reset email.");
    }
  }

  const inputBase = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "14px",
    color: "#fff",
    caretColor: "#FFD700",
  };
  const inputFocusBorder = "rgba(255,215,0,0.5)";
  const errorBorder      = "rgba(231,76,60,0.5)";

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0f0a1e 0%, #07050f 60%, #000000 100%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
    >
      {/* Ambient glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />

      {/* Feature badges */}
      <motion.div className="flex gap-2 flex-wrap justify-center mb-5 relative z-10"
        initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        {["🏆 Skill Games", "⚡ Instant Win", "🔒 100% Secure"].map((tag) => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.55)" }}>
            {tag}
          </span>
        ))}
      </motion.div>

      {/* Card */}
      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        style={{
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,215,0,0.15)",
          borderRadius: "24px",
          boxShadow: "0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
          padding: "32px 24px 28px",
        }}>

        {/* Logo */}
        <div className="text-center mb-5">
          <h1 className="font-black tracking-tighter leading-none" style={{ fontSize: "2.8rem" }}>
            <span className="text-white">WIN</span>
            <span style={{ color: "#FFD700", textShadow: "0 0 12px rgba(255,215,0,0.9), 0 0 28px rgba(255,215,0,0.4)" }}>GGO</span>
          </h1>
          <p className="text-xs font-bold tracking-[0.18em] uppercase mt-1" style={{ color: "rgba(255,215,0,0.55)" }}>
            Play Skill Games &amp; Win Rewards
          </p>
        </div>

        {/* Tab switcher (login / signup) */}
        {mode !== "forgot" && (
          <div className="flex mb-5 rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["login", "signup"] as const).map((m) => (
              <button key={m} onClick={() => switchMode(m)}
                className="flex-1 py-2.5 text-sm font-black uppercase tracking-wide transition-all cursor-pointer"
                style={{
                  background: mode === m ? "linear-gradient(135deg,#FFD700,#ff8c00)" : "transparent",
                  color:      mode === m ? "#000" : "rgba(255,255,255,0.4)",
                  borderRadius: "10px",
                }}>
                {m === "login" ? "Login" : "Sign Up"}
              </button>
            ))}
          </div>
        )}

        {/* Demo mode banner */}
        <AnimatePresence>
          {inDemoMode && !success && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 14 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="rounded-2xl overflow-hidden"
              style={{ background: "rgba(255,165,0,0.08)", border: "1px solid rgba(255,165,0,0.25)" }}>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span>🔧</span>
                  <span className="text-xs font-black" style={{ color: "#FFA500" }}>Demo Mode</span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  Firebase not connected. Use any email.{" "}
                  {mode === "login" && <span>Password: <strong style={{ color: "#FFD700" }}>demo1234</strong></span>}
                  {mode === "signup" && <span>Any password ≥ 6 chars.</span>}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ─── LOGIN ─── */}
          {mode === "login" && !success && (
            <motion.form key="login" onSubmit={handleLogin} className="space-y-3.5"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22 }}>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Email Address
                </label>
                <input
                  type="email" autoComplete="email" placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => { setLoginEmail(e.target.value); setError(""); }}
                  className="w-full h-12 px-4 text-sm outline-none placeholder:text-zinc-700"
                  style={{ ...inputBase, border: `1px solid ${error && !loginEmail ? errorBorder : "rgba(255,255,255,0.1)"}` }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"} autoComplete="current-password"
                    placeholder="Enter password"
                    value={loginPw}
                    onChange={(e) => { setLoginPw(e.target.value); setError(""); }}
                    className="w-full h-12 px-4 pr-12 text-sm outline-none placeholder:text-zinc-700"
                    style={{ ...inputBase, border: `1px solid ${error && !loginPw ? errorBorder : "rgba(255,255,255,0.1)"}` }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base cursor-pointer"
                    style={{ color: "rgba(255,255,255,0.3)" }}>
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <button type="button" onClick={() => { switchMode("forgot"); setForgotEmail(loginEmail); }}
                  className="text-xs cursor-pointer" style={{ color: "rgba(255,215,0,0.65)" }}>
                  Forgot Password?
                </button>
              </div>

              {/* Error */}
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
                  <span>⚠️</span>
                  <p className="text-xs font-semibold flex-1" style={{ color: "#e74c3c" }}>{error}</p>
                </motion.div>
              )}

              <motion.button type="submit" disabled={loading}
                className="w-full h-13 py-3.5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35), 0 4px 20px rgba(0,0,0,0.4)" }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    Logging in…
                  </span>
                ) : "LOGIN →"}
              </motion.button>

              <p className="text-center text-xs pt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
                New to WINGGO?{" "}
                <button type="button" onClick={() => switchMode("signup")}
                  className="cursor-pointer font-bold" style={{ color: "#FFD700" }}>
                  Create Account →
                </button>
              </p>
            </motion.form>
          )}

          {/* ─── SIGN UP ─── */}
          {mode === "signup" && !success && (
            <motion.form key="signup" onSubmit={handleSignup} className="space-y-3"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}>

              {[
                { label: "Full Name",        type: "text",     val: signupName,    set: setSignupName,    ph: "Rahul Sharma",        ac: "name" },
                { label: "Email Address",    type: "email",    val: signupEmail,   set: setSignupEmail,   ph: "you@example.com",     ac: "email" },
              ].map(({ label, type, val, set, ph, ac }) => (
                <div key={label}>
                  <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    {label}
                  </label>
                  <input type={type} autoComplete={ac} placeholder={ph}
                    value={val} onChange={(e) => { set(e.target.value); setError(""); }}
                    className="w-full h-12 px-4 text-sm outline-none placeholder:text-zinc-700"
                    style={inputBase}
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Password
                </label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    value={signupPw} onChange={(e) => { setSignupPw(e.target.value); setError(""); }}
                    className="w-full h-12 px-4 pr-12 text-sm outline-none placeholder:text-zinc-700"
                    style={inputBase}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base cursor-pointer"
                    style={{ color: "rgba(255,255,255,0.3)" }}>
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Confirm Password
                </label>
                <div className="relative">
                  <input type={showConfirm ? "text" : "password"} autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={signupConfirm} onChange={(e) => { setSignupConfirm(e.target.value); setError(""); }}
                    className="w-full h-12 px-4 pr-12 text-sm outline-none placeholder:text-zinc-700"
                    style={{ ...inputBase, border: `1px solid ${signupConfirm && signupConfirm !== signupPw ? errorBorder : "rgba(255,255,255,0.1)"}` }}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base cursor-pointer"
                    style={{ color: "rgba(255,255,255,0.3)" }}>
                    {showConfirm ? "🙈" : "👁️"}
                  </button>
                </div>
                {signupConfirm && signupConfirm !== signupPw && (
                  <p className="text-[11px] mt-1 ml-1" style={{ color: "#e74c3c" }}>Passwords do not match</p>
                )}
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
                  <span>⚠️</span>
                  <p className="text-xs font-semibold flex-1" style={{ color: "#e74c3c" }}>{error}</p>
                </motion.div>
              )}

              <motion.button type="submit" disabled={loading}
                className="w-full py-3.5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35)" }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    Creating Account…
                  </span>
                ) : "CREATE ACCOUNT →"}
              </motion.button>

              {/* Bonus badge */}
              <motion.div className="flex items-center gap-2 py-2.5 px-3 rounded-xl"
                style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}
                animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 2, repeat: Infinity }}>
                <span>🎁</span>
                <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
                  New User Bonus — <span style={{ color: "#27ae60" }}>Get ₹50 instantly!</span>
                </span>
              </motion.div>

              <p className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                Already have an account?{" "}
                <button type="button" onClick={() => switchMode("login")}
                  className="cursor-pointer font-bold" style={{ color: "#FFD700" }}>
                  Login →
                </button>
              </p>
            </motion.form>
          )}

          {/* ─── FORGOT PASSWORD ─── */}
          {mode === "forgot" && !success && (
            <motion.form key="forgot" onSubmit={handleForgot} className="space-y-4"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22 }}>

              <div className="text-center mb-2">
                <span className="text-3xl">🔑</span>
                <p className="font-black text-white text-base mt-2">Reset Password</p>
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Enter your email and we'll send a reset link
                </p>
              </div>

              {resetSent ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-4 text-center">
                  <span className="text-4xl">📧</span>
                  <p className="font-bold text-white">Reset link sent!</p>
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
                    Check your inbox at <strong style={{ color: "#FFD700" }}>{forgotEmail}</strong>
                  </p>
                  <button type="button" onClick={() => switchMode("login")}
                    className="mt-2 text-xs font-bold cursor-pointer" style={{ color: "#FFD700" }}>
                    ← Back to Login
                  </button>
                </motion.div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Email Address
                    </label>
                    <input type="email" placeholder="you@example.com"
                      value={forgotEmail} onChange={(e) => { setForgotEmail(e.target.value); setError(""); }}
                      className="w-full h-12 px-4 text-sm outline-none placeholder:text-zinc-700"
                      style={inputBase}
                    />
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
                      <span>⚠️</span>
                      <p className="text-xs font-semibold flex-1" style={{ color: "#e74c3c" }}>{error}</p>
                    </motion.div>
                  )}

                  <motion.button type="submit" disabled={loading}
                    className="w-full py-3.5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35)" }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    {loading ? "Sending…" : "SEND RESET LINK →"}
                  </motion.button>

                  <button type="button" onClick={() => switchMode("login")}
                    className="w-full text-center text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}>
                    ← Back to Login
                  </button>
                </>
              )}
            </motion.form>
          )}

          {/* ─── SUCCESS ─── */}
          {success && (
            <motion.div key="success" className="flex flex-col items-center gap-3 py-6"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <motion.div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(39,174,96,0.15)", border: "2px solid rgba(39,174,96,0.4)" }}
                animate={{ boxShadow: ["0 0 0px rgba(39,174,96,0)", "0 0 30px rgba(39,174,96,0.5)", "0 0 0px rgba(39,174,96,0)"] }}
                transition={{ duration: 1.2, repeat: Infinity }}>
                <motion.span className="text-4xl"
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.15 }}>
                  ✅
                </motion.span>
              </motion.div>
              <p className="font-black text-white text-xl">Welcome to WINGGO!</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading your dashboard…</p>
              {inDemoMode && (
                <p className="text-xs px-4 py-2 rounded-full"
                  style={{ background: "rgba(255,165,0,0.08)", color: "rgba(255,165,0,0.7)", border: "1px solid rgba(255,165,0,0.2)" }}>
                  Demo mode — connect Firebase for real accounts
                </p>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>

      {/* Footer */}
      <motion.div className="mt-5 flex items-center gap-3 text-xs text-zinc-700 relative z-10"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        <a href="#" className="hover:text-yellow-400 transition-colors">Terms &amp; Conditions</a>
        <span className="w-px h-3 bg-zinc-800" />
        <a href="#" className="hover:text-yellow-400 transition-colors">Privacy Policy</a>
      </motion.div>
    </motion.div>
  );
}
