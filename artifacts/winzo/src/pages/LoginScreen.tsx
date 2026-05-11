/**
 * LoginScreen — Firebase Phone OTP Login
 * Two-step: phone entry → OTP entry
 * Falls back to demo mode when Firebase is not configured.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FIREBASE_ENABLED } from "@/firebase/config";
import { initRecaptcha, sendOTP, verifyOTP } from "@/firebase/auth.service";

interface LoginScreenProps {
  onLogin?: (uid: string, phone: string, isNewUser?: boolean) => void;
}

type Step = "phone" | "otp" | "verifying" | "success";

const DEMO_OTP = "123456";

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [step, setStep]         = useState<Step>("phone");
  const [phone, setPhone]       = useState("");
  const [otp, setOtp]           = useState(["", "", "", "", "", ""]);
  const [error, setError]       = useState("");
  const [sending, setSending]   = useState(false);
  const [resendSec, setResendSec] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const resendTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Mount invisible recaptcha container
  useEffect(() => {
    if (FIREBASE_ENABLED) initRecaptcha("recaptcha-container");
    return () => {
      if (resendTimer.current) clearInterval(resendTimer.current);
    };
  }, []);

  function startResendTimer() {
    setResendSec(30);
    resendTimer.current = setInterval(() => {
      setResendSec((s) => {
        if (s <= 1) { clearInterval(resendTimer.current!); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function handleSendOTP(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (phone.length < 10) { setError("Enter a valid 10-digit mobile number"); return; }
    setSending(true);
    const result = await sendOTP(phone);
    setSending(false);
    if (result.success) {
      setStep("otp");
      startResendTimer();
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } else {
      setError(result.error ?? "Failed to send OTP. Try again.");
    }
  }

  function handleOTPInput(idx: number, val: string) {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[idx] = val;
    setOtp(next);
    setError("");
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) {
      handleVerify(next.join(""));
    }
  }

  function handleOTPKeyDown(idx: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
    if (e.key === "Enter" && otp.every(Boolean)) {
      handleVerify(otp.join(""));
    }
  }

  async function handleVerify(code?: string) {
    const finalOTP = code ?? otp.join("");
    if (finalOTP.length < 6) { setError("Enter the 6-digit OTP"); return; }
    if (!FIREBASE_ENABLED && finalOTP !== DEMO_OTP) {
      setError(`Demo mode — use OTP: ${DEMO_OTP}`);
      return;
    }
    setStep("verifying");
    setError("");
    const result = await verifyOTP(finalOTP);
    if (result.success) {
      setStep("success");
      setTimeout(() => onLogin?.(result.uid!, `+91${phone}`, result.isNewUser), 800);
    } else {
      setStep("otp");
      setError(result.error ?? "Invalid OTP. Try again.");
    }
  }

  async function handleResend() {
    if (resendSec > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setSending(true);
    const result = await sendOTP(phone);
    setSending(false);
    if (result.success) {
      startResendTimer();
      otpRefs.current[0]?.focus();
    } else {
      setError(result.error ?? "Failed to resend OTP.");
    }
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0f0a1e 0%, #07050f 60%, #000000 100%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7 }}
    >
      {/* Invisible recaptcha container (Firebase requirement) */}
      <div id="recaptcha-container" />

      {/* Ambient glow */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.07) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)" }} />

      {/* Feature badges */}
      <motion.div className="flex gap-2 flex-wrap justify-center mb-6 relative z-10 px-4"
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
        {["🏆 Skill Games", "⚡ Instant Win", "🔒 100% Secure"].map((tag) => (
          <span key={tag} className="text-xs px-3 py-1 rounded-full font-semibold"
            style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,255,255,0.6)" }}>
            {tag}
          </span>
        ))}
      </motion.div>

      {/* Login Card */}
      <motion.div className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 28, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        style={{
          background: "rgba(255,255,255,0.04)", backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)", border: "1px solid rgba(255,215,0,0.15)",
          borderRadius: "24px", boxShadow: "0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
          padding: "36px 28px 28px",
        }}>

        {/* Logo */}
        <div className="text-center mb-6">
          <h1 className="font-black tracking-tighter leading-none" style={{ fontSize: "3.2rem" }}>
            <span className="text-white">WIN</span>
            <span style={{ color: "#FFD700", textShadow: "0 0 10px rgba(255,215,0,0.9), 0 0 24px rgba(255,215,0,0.5)" }}>GGO</span>
          </h1>
          <p className="text-xs font-bold tracking-[0.2em] uppercase mt-1.5" style={{ color: "rgba(255,215,0,0.6)" }}>
            Play Skill Games &amp; Win Rewards
          </p>
        </div>

        {/* Online players */}
        <div className="flex items-center justify-center gap-2 mb-6 py-2 rounded-xl"
          style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.12)" }}>
          <span className="text-sm">👥</span>
          <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
            <span style={{ color: "#FFD700" }}>4.2L+</span> players online right now
          </span>
        </div>

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Phone number ── */}
          {(step === "phone") && (
            <motion.form key="phone" onSubmit={handleSendOTP} className="space-y-4"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25 }}>
              <div>
                <label className="block text-zinc-400 text-xs font-semibold mb-2 tracking-wide uppercase">
                  Mobile Number
                </label>
                <div className="flex items-center h-14 rounded-2xl overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${error ? "rgba(231,76,60,0.5)" : "rgba(255,255,255,0.1)"}` }}>
                  <div className="flex items-center gap-2 px-4 h-full border-r shrink-0"
                    style={{ borderColor: "rgba(255,255,255,0.08)" }}>
                    <span className="text-xl select-none">🇮🇳</span>
                    <span className="text-white font-semibold text-sm">+91</span>
                  </div>
                  <input
                    data-testid="input-mobile"
                    type="tel" inputMode="numeric" maxLength={10}
                    placeholder="Enter mobile number"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "")); setError(""); }}
                    className="flex-1 h-full bg-transparent px-4 text-white text-base outline-none placeholder:text-zinc-700 font-medium"
                    style={{ caretColor: "#FFD700" }}
                  />
                </div>
              </div>

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs font-semibold text-center" style={{ color: "#e74c3c" }}>
                  ⚠️ {error}
                </motion.p>
              )}

              {!FIREBASE_ENABLED && (
                <p className="text-center text-xs" style={{ color: "rgba(255,215,0,0.5)" }}>
                  🔧 Demo mode — any number works
                </p>
              )}

              <motion.button data-testid="button-get-otp" type="submit" disabled={sending}
                className="w-full h-14 font-black text-lg text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)", boxShadow: "0 0 24px rgba(255,215,0,0.4), 0 4px 20px rgba(0,0,0,0.4)" }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                {sending ? (
                  <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    Sending OTP…
                  </motion.span>
                ) : "GET OTP →"}
              </motion.button>
            </motion.form>
          )}

          {/* ── STEP 2: OTP entry ── */}
          {(step === "otp" || step === "verifying") && (
            <motion.div key="otp" className="space-y-5"
              initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}>
              <div className="text-center">
                <p className="text-white font-bold text-sm mb-0.5">OTP Sent to</p>
                <p style={{ color: "#FFD700" }} className="font-black text-base">+91 {phone}</p>
                <button onClick={() => { setStep("phone"); setOtp(["","","","","",""]); setError(""); }}
                  className="text-xs mt-1 cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}>
                  ← Change number
                </button>
              </div>

              {/* 6-digit OTP boxes */}
              <div className="flex gap-2 justify-center">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { otpRefs.current[idx] = el; }}
                    type="text" inputMode="numeric" maxLength={1}
                    value={digit}
                    onChange={(e) => handleOTPInput(idx, e.target.value)}
                    onKeyDown={(e) => handleOTPKeyDown(idx, e)}
                    onFocus={(e) => e.target.select()}
                    className="w-12 h-14 rounded-xl text-center text-xl font-black text-white outline-none transition-all"
                    style={{
                      background: digit ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.06)",
                      border: `2px solid ${digit ? "rgba(255,215,0,0.6)" : "rgba(255,255,255,0.12)"}`,
                      caretColor: "#FFD700",
                    }}
                  />
                ))}
              </div>

              {!FIREBASE_ENABLED && (
                <p className="text-center text-xs" style={{ color: "rgba(255,215,0,0.5)" }}>
                  🔧 Demo OTP: <strong style={{ color: "#FFD700" }}>123456</strong>
                </p>
              )}

              {error && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="text-xs font-semibold text-center" style={{ color: "#e74c3c" }}>
                  ⚠️ {error}
                </motion.p>
              )}

              <motion.button
                onClick={() => handleVerify()}
                disabled={step === "verifying" || !otp.every(Boolean)}
                className="w-full h-14 font-black text-lg text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-60"
                style={{ background: "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)", boxShadow: "0 0 24px rgba(255,215,0,0.4)" }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                {step === "verifying" ? (
                  <motion.span animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
                    Verifying…
                  </motion.span>
                ) : "VERIFY OTP ✓"}
              </motion.button>

              <div className="text-center">
                <button onClick={handleResend} disabled={resendSec > 0 || sending}
                  className="text-xs cursor-pointer disabled:cursor-default"
                  style={{ color: resendSec > 0 ? "rgba(255,255,255,0.25)" : "rgba(255,215,0,0.7)" }}>
                  {resendSec > 0 ? `Resend OTP in ${resendSec}s` : "Resend OTP"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Success ── */}
          {step === "success" && (
            <motion.div key="success" className="flex flex-col items-center gap-3 py-4"
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}>
              <motion.div className="text-6xl" animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5 }}>🎉</motion.div>
              <p className="font-black text-white text-xl">Welcome to WINGGO!</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>Loading your dashboard…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New user bonus (only on phone step) */}
        {step === "phone" && (
          <motion.div className="mt-5 py-3 px-4 rounded-xl flex items-center gap-2"
            style={{ background: "rgba(39,174,96,0.08)", border: "1px solid rgba(39,174,96,0.2)" }}
            animate={{ opacity: [0.8, 1, 0.8] }} transition={{ duration: 2, repeat: Infinity }}>
            <span className="text-lg">🎁</span>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
              New User Bonus — <span style={{ color: "#27ae60" }}>Get ₹50 instantly on signup!</span>
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Bottom perks */}
      {step === "phone" && (
        <motion.div className="mt-6 grid grid-cols-3 gap-3 w-full max-w-sm relative z-10"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          {[{ icon: "💰", label: "Instant\nWithdrawal" }, { icon: "👥", label: "Real\nPlayers" }, { icon: "🔒", label: "100%\nSecure" }]
            .map(({ icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1 py-3 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-xl">{icon}</span>
                <span className="text-xs text-center leading-tight whitespace-pre-line"
                  style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px" }}>{label}</span>
              </div>
            ))}
        </motion.div>
      )}

      {/* Footer */}
      <motion.div className="mt-6 flex items-center gap-3 text-xs text-zinc-700 relative z-10"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
        <a href="#" data-testid="link-terms" className="hover:text-yellow-400 transition-colors">Terms &amp; Conditions</a>
        <span className="w-px h-3 bg-zinc-800" />
        <a href="#" data-testid="link-privacy" className="hover:text-yellow-400 transition-colors">Privacy Policy</a>
      </motion.div>
    </motion.div>
  );
}
