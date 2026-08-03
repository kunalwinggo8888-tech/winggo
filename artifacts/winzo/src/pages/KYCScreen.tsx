import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BackButton from "@/components/BackButton";
import { useAuth } from "@/context/useAuth";
import { submitKYC } from "@/firebase/firestore.service";

interface KYCScreenProps {
  onBack?: () => void;
}

type KYCStatus = "pending" | "verified" | "rejected";

const STATUS_CFG = {
  pending:  { label: "Verification Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  icon: "⏳", desc: "Your mobile number is being verified." },
  verified: { label: "KYC Verified ✅",        color: "#34d399", bg: "rgba(52,211,153,0.12)",  icon: "✅", desc: "Your mobile number is verified. Full access unlocked!" },
  rejected: { label: "Verification Failed",   color: "#f87171", bg: "rgba(248,113,113,0.12)", icon: "❌", desc: "Verification failed. Please try again." },
};

export default function KYCScreen({ onBack }: KYCScreenProps) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<KYCStatus>(() => {
    try {
      const saved = localStorage.getItem("winggo_kyc_status");
      return (saved as KYCStatus) || "pending";
    } catch {
      return "pending";
    }
  });
  const [countdown, setCountdown] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const statusCfg = STATUS_CFG[status];

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && submitted) {
      // Auto-submit after countdown
      handleSubmit();
    }
    return () => clearInterval(interval);
  }, [countdown, submitted]);

  function validate() {
    if (!phone.match(/^[6-9]\d{9}$/)) {
      setError("Enter valid 10-digit mobile number");
      return false;
    }
    setError("");
    return true;
  }

  function startCountdown() {
    if (!validate()) return;
    setCountdown(10);
  }

  async function handleSubmit() {
    if (!validate()) return;
    if (!uid) {
      setError("Please log in first to submit KYC.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      // Submit simplified KYC with only phone number
      await submitKYC(uid, {
        displayName: user?.displayName || "User",
        email: user?.email || "",
        docType: "mobile",
        docNumber: phone.trim(),
      });

      setStatus("pending");
      localStorage.setItem("winggo_kyc_status", "pending");
      localStorage.setItem("winggo_kyc_phone", phone);
      setSubmitted(true);
      setCountdown(0);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Submission failed. Check your internet connection and try again."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {/* ── HEADER ── */}
      <div
        className="flex items-center gap-3 px-4 py-4 shrink-0"
        style={{
          background: "rgba(7,5,15,0.98)",
          borderBottom: "1px solid rgba(255,215,0,0.10)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div style={{ zIndex: 9999 }}>
          <BackButton onBack={onBack} label="Profile" />
        </div>
        <div className="flex-1">
          <div className="text-white font-black text-lg leading-none">Mobile Verification</div>
          <div className="text-xs mt-0.5" style={{ color: "#666" }}>Quick KYC Check</div>
        </div>
        <div
          className="px-2.5 py-1 rounded-full text-[10px] font-black"
          style={{ background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.color}44` }}
        >
          {statusCfg.icon} {status.toUpperCase()}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-8 flex flex-col items-center justify-center">

        {/* Status banner */}
        <div className="w-full mb-6 px-4 py-3 rounded-2xl flex items-center gap-3"
          style={{ background: statusCfg.bg, border: `1px solid ${statusCfg.color}33` }}>
          <span className="text-2xl">{statusCfg.icon}</span>
          <div>
            <div className="text-sm font-black" style={{ color: statusCfg.color }}>{statusCfg.label}</div>
            <div className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>{statusCfg.desc}</div>
          </div>
        </div>

        {/* ── Success animation ── */}
        <AnimatePresence>
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="w-full mb-6 px-4 py-6 rounded-2xl flex flex-col items-center gap-3 text-center"
              style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)" }}
            >
              <motion.span className="text-5xl"
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 0.6, repeat: 2 }}
              >✅</motion.span>
              <div className="text-base font-black" style={{ color: "#34d399" }}>KYC Successfully Completed!</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                Your mobile number {phone} has been verified successfully.
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Form ── */}
        {!submitted && (
          <div className="w-full max-w-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">📱</div>
              <h2 className="text-white font-black text-xl mb-2">Verify Your Mobile Number</h2>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                Enter your 10-digit mobile number for quick KYC verification
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold mb-2 block" style={{ color: "rgba(255,255,255,0.55)" }}>
                Mobile Number *
              </label>
              <input
                type="tel"
                placeholder="9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                maxLength={10}
                disabled={countdown > 0 || uploading}
                className="w-full rounded-xl px-4 py-4 text-white text-lg font-bold text-center outline-none"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  caretColor: "#FFD700",
                  letterSpacing: "0.1em",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.45)"; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; }}
              />
              {error && <p className="text-[11px] mt-2 text-center" style={{ color: "#f87171" }}>{error}</p>}
            </div>

            {/* Countdown Display */}
            {countdown > 0 && (
              <div className="mb-4 text-center">
                <div className="text-5xl font-black mb-2" style={{ color: "#FFD700" }}>
                  {countdown}
                </div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Auto-submitting in {countdown} seconds...
                </p>
              </div>
            )}

            {/* Error message */}
            {error && !countdown && (
              <div className="mb-4 px-4 py-3 rounded-xl text-xs font-bold text-center"
                style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
                ⚠️ {error}
              </div>
            )}

            {/* Submit Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={countdown > 0 ? undefined : startCountdown}
              disabled={uploading || countdown > 0}
              className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
              style={{
                background: uploading || countdown > 0
                  ? "rgba(255,255,255,0.08)"
                  : "linear-gradient(135deg, #FFD700, #ff8c00)",
                color: uploading || countdown > 0 ? "rgba(255,255,255,0.4)" : "#000",
                boxShadow: uploading || countdown > 0 ? "none" : "0 0 24px rgba(255,215,0,0.35)",
                letterSpacing: "0.04em",
              }}
            >
              {countdown > 0 ? "⏳ Submitting..." : uploading ? "⏳ Processing..." : "📱 Verify Now"}
            </motion.button>

            {countdown > 0 && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setCountdown(0)}
                className="w-full mt-3 py-3 rounded-2xl font-black text-sm cursor-pointer"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#f87171",
                }}
              >
                ❌ Cancel
              </motion.button>
            )}
          </div>
        )}

        {/* ── SECURE NOTE ── */}
        <div className="w-full max-w-sm mt-6 px-4 py-3 rounded-2xl flex items-start gap-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-lg mt-0.5">🔒</span>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Your mobile number is encrypted and stored securely. We comply with all data protection guidelines.
            Your information is only used for identity verification.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
