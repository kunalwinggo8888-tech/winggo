/**
 * LoginScreen — Facebook-Only Authentication
 * Facebook login/signup in one flow (Firebase FacebookAuthProvider).
 * Premium WinZO-style dark gold UI, mobile-first 480px.
 *
 * DESIGN NOTE:
 * The visual language (background, glows, badges, card, logo, buttons, footer)
 * is kept identical to the previous login screen. The email/password form and
 * the Google button were removed — Facebook is the only way in.
 *
 * ONE-TIME ACCOUNT LINKING (edge case only):
 * If a returning user's Facebook email belongs to an existing Firebase
 * account (created earlier via Google or email/password), Firebase throws
 * auth/account-exists-with-different-credential. Instead of creating a
 * duplicate account, we show a one-time "protect your old account" screen
 * that signs the user into their EXISTING account and links Facebook to it —
 * the UID never changes, so wallet, KYC, referral and game data all survive.
 * Google/email sign-in is NEVER offered as a normal login option.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FIREBASE_ENABLED } from "@/firebase/config";
import {
  signInWithFacebook,
  linkOldAccountGoogle,
  linkOldAccountPassword,
  isDemoMode,
  AuthResult,
} from "@/firebase/auth.service";

// ── Official social-provider SVG icon ────────────────────────────────────────

function FacebookSVG() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-label="Facebook">
      <circle cx="12" cy="12" r="12" fill="#1877F2"/>
      <path d="M16.67 15.47l.44-2.85h-2.73v-1.85c0-.78.38-1.54 1.6-1.54h1.24V6.73s-1.12-.19-2.2-.19c-2.24 0-3.71 1.36-3.71 3.82v2.26H8.69v2.85h2.62V22.9a10.15 10.15 0 003.14 0v-7.43h2.22z" fill="white"/>
    </svg>
  );
}

interface LoginScreenProps {
  onLogin?: (uid: string, email: string, isNewUser?: boolean) => void;
}

type Mode = "login" | "link";

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [mode, setMode]               = useState<Mode>("login");
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [error, setError]             = useState("");
  const [inDemoMode, setInDemoMode]   = useState(!FIREBASE_ENABLED);
  const [socialLoading, setSocialLoading] = useState<"facebook" | "link" | null>(null);

  // One-time old-account linking state (edge case)
  const [linkInfo, setLinkInfo]     = useState<NonNullable<AuthResult["link"]> | null>(null);
  const [linkEmail, setLinkEmail]   = useState("");
  const [linkPw, setLinkPw]         = useState("");

  function finishLogin(res: AuthResult) {
    if (res.demo) setInDemoMode(true);
    if (res.success && res.uid) {
      setSuccess(true);
      setTimeout(() => onLogin?.(res.uid!, "", res.isNewUser), 800);
    } else if (res.error) {
      setError(res.error);
    }
  }

  async function handleFacebookLogin() {
    setSocialLoading("facebook");
    setError("");
    const res = await signInWithFacebook();
    setSocialLoading(null);
    if (res.link) {
      // Existing account with the same email — never create a duplicate.
      // Route to the one-time link flow instead.
      setLinkInfo(res.link);
      setLinkEmail(res.link.email);
      setMode("link");
      return;
    }
    finishLogin(res);
  }

  async function handleLinkGoogle() {
    if (!linkInfo) return;
    setSocialLoading("link");
    setError("");
    const res = await linkOldAccountGoogle(linkInfo.fbCred);
    setSocialLoading(null);
    finishLogin(res);
  }

  async function handleLinkPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!linkInfo) return;
    if (!linkPw) { setError("Enter your old password."); return; }
    setSocialLoading("link");
    setError("");
    const res = await linkOldAccountPassword(linkEmail.trim(), linkPw, linkInfo.fbCred);
    setSocialLoading(null);
    finishLogin(res);
  }

  const inputBase = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "14px",
    color: "#fff",
    caretColor: "#FFD700",
  };
  const errorBorder = "rgba(231,76,60,0.5)";

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
                  Firebase not connected — tapping Facebook runs a demo login.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">

          {/* ─── FACEBOOK LOGIN ─── */}
          {mode === "login" && !success && (
            <motion.div key="login" className="space-y-3.5"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22 }}>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
                  <span>⚠️</span>
                  <p className="text-xs font-semibold flex-1" style={{ color: "#e74c3c" }}>{error}</p>
                </motion.div>
              )}

              <motion.button type="button" onClick={handleFacebookLogin}
                disabled={socialLoading !== null}
                className="w-full h-13 py-3.5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35), 0 4px 20px rgba(0,0,0,0.4)" }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                {socialLoading === "facebook" ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                      animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    Connecting…
                  </span>
                ) : "LOGIN WITH FACEBOOK →"}
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

              {/* ─── Social Login ─── */}
              <div className="relative flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase whitespace-nowrap"
                  style={{ color: "rgba(255,255,255,0.22)" }}>or continue with</span>
                <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
              </div>

              <div className="flex items-center justify-center gap-6 pb-1">
                <motion.button type="button" onClick={handleFacebookLogin}
                  disabled={socialLoading !== null}
                  whileHover={{ scale: 1.09, boxShadow: "0 0 24px rgba(24,119,242,0.4)" }}
                  whileTap={{ scale: 0.92 }}
                  className="w-14 h-14 rounded-full flex items-center justify-center cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    boxShadow: socialLoading === "facebook" ? "0 0 22px rgba(24,119,242,0.5)" : "none",
                    opacity: socialLoading !== null && socialLoading !== "facebook" ? 0.45 : 1,
                  }}>
                  {socialLoading === "facebook"
                    ? <motion.span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent inline-block"
                        animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                    : <FacebookSVG />
                  }
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ─── ONE-TIME OLD-ACCOUNT LINK (edge case) ─── */}
          {mode === "link" && !success && linkInfo && (
            <motion.div key="link" className="space-y-3.5"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}>

              <div className="text-center mb-1">
                <span className="text-3xl">🔒</span>
                <p className="font-black text-white text-base mt-2">Your Old Account is Safe</p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                  <strong style={{ color: "#FFD700" }}>{linkInfo.email}</strong> already has a WINGGO
                  account with your wallet, KYC &amp; game history. Sign in once below and we'll
                  link Facebook to it — no duplicate account, nothing lost.
                </p>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
                  <span>⚠️</span>
                  <p className="text-xs font-semibold flex-1" style={{ color: "#e74c3c" }}>{error}</p>
                </motion.div>
              )}

              {linkInfo.methods.includes("google.com") && (
                <motion.button type="button" onClick={handleLinkGoogle}
                  disabled={socialLoading !== null}
                  className="w-full py-3.5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35), 0 4px 20px rgba(0,0,0,0.4)" }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  {socialLoading === "link" ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                        animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                      Linking…
                    </span>
                  ) : "VERIFY OLD ACCOUNT →"}
                </motion.button>
              )}

              {linkInfo.methods.includes("password") && (
                <form onSubmit={handleLinkPassword} className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                      Old Account Password
                    </label>
                    <input type="password" autoComplete="current-password"
                      placeholder="Enter your old password"
                      value={linkPw}
                      onChange={(e) => { setLinkPw(e.target.value); setError(""); }}
                      className="w-full h-12 px-4 pr-12 text-sm outline-none placeholder:text-zinc-700"
                      style={{ ...inputBase, border: `1px solid ${error && !linkPw ? errorBorder : "rgba(255,255,255,0.1)"}` }}
                    />
                  </div>
                  <motion.button type="submit" disabled={socialLoading !== null}
                    className="w-full py-3.5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-50"
                    style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35), 0 4px 20px rgba(0,0,0,0.4)" }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                    {socialLoading === "link" ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                          animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                        Linking…
                      </span>
                    ) : "SIGN IN & LINK FACEBOOK →"}
                  </motion.button>
                </form>
              )}

              <button type="button" onClick={() => { setMode("login"); setLinkInfo(null); setError(""); }}
                className="w-full text-center text-xs cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}>
                ← Back
              </button>
            </motion.div>
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
