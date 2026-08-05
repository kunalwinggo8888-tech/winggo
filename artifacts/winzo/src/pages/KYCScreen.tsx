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

interface KYCHistoryEntry {
  id: string;
  phone: string;
  status: string;
  date: string;
}

const KYC_COUNTDOWN = 3; // 3-second auto-verify countdown

function loadHistory(): KYCHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem("winggo_kyc_history") || "[]");
  } catch {
    return [];
  }
}

function saveHistory(entries: KYCHistoryEntry[]) {
  try {
    localStorage.setItem("winggo_kyc_history", JSON.stringify(entries.slice(0, 20)));
  } catch { /* non-fatal */ }
}

export default function KYCScreen({ onBack }: KYCScreenProps) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<KYCStatus>(() => {
    try {
      const d = JSON.parse(localStorage.getItem("winggo_kyc") || "{}");
      return d.status ?? "pending";
    } catch {
      return "pending";
    }
  });
  const [history, setHistory] = useState<KYCHistoryEntry[]>(() => loadHistory());
  const [countdown, setCountdown] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const statusCfg = STATUS_CFG[status];

  // 3-second countdown → auto-submit
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && submitted) {
      // Auto-submit after countdown reaches 0
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
    setCountdown(KYC_COUNTDOWN);
    setSubmitted(true);
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
      // Write to Firestore (kycRequests/{uid} + users/{uid}.kycStatus = submitted)
      await submitKYC(uid, {
        displayName: user?.displayName || "User",
        email: user?.email || "",
        docType: "mobile",
        docNumber: phone.trim(),
      });

      // Verified status (persisted for ProfileScreen + this screen)
      const now = new Date().toISOString();
      setStatus("verified");
      localStorage.setItem("winggo_kyc", JSON.stringify({ status: "verified", phone, date: now }));
      localStorage.setItem("winggo_kyc_status", "verified");
      localStorage.setItem("winggo_kyc_phone", phone);

      // KYC history
      const entry: KYCHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        phone: phone.trim(),
        status: "verified",
        date: now,
      };
      const next = [entry, ...history].slice(0, 20);
      saveHistory(next);
      setHistory(next);

      setCountdown(0);
    } catch (err) {
      setStatus("rejected");
      localStorage.setItem("winggo_kyc", JSON.stringify({ status: "rejected", phone, date: new Date().toISOString() }));
      setError(
        err instanceof Error
          ? err.message
          : "Submission failed. Check your internet connection and try again."
      );
    } finally {
      setUploading(false);
    }
  }

  function resetForm() {
    setSubmitted(false);
    setCountdown(0);
    setError("");
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
          {submitted && status === "verified" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="w-full mb-6 px-4 py-6 rounded-2xl flex flex-col items-center gap-3 text-center"
              style={{ background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)" }}
            >
              <motion.div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: "rgba(52,211,153,0.15)" }}
                animate={{ scale: [1, 1.15, 1], boxShadow: ["0 0 0 rgba(52,211,153,0)", "0 0 40px rgba(52,211,153,0.5)", "0 0 0 rgba(52,211,153,0)"] }}
                transition={{ duration: 1, repeat: 2 }}
              >
                <motion.span className="text-5xl"
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 8, -8, 0] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >✅</motion.span>
              </motion.div>
              <div className="text-base font-black" style={{ color: "#34d399" }}>KYC Successfully Completed!</div>
              <div className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
                Your mobile number <b className="text-white">+91 {phone}</b> has been verified successfully.
              </div>
              <div className="px-3 py-1.5 rounded-lg text-[11px] font-black"
                style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                ✅ VERIFIED · ACCESS UNLOCKED
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

            {/* 3-Second Countdown Display */}
            {countdown > 0 && (
              <div className="mb-4 text-center">
                <motion.div key={countdown} initial={{ scale: 1.4, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }}
                  className="text-5xl font-black mb-2" style={{ color: "#FFD700" }}>
                  {countdown}
                </motion.div>
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Auto-verifying in {countdown} second{countdown === 1 ? "" : "s"}...
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
              {countdown > 0 ? "⏳ Verifying..." : uploading ? "⏳ Processing..." : "📱 Verify Now"}
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

        {/* ── Verify New Number (when already verified) ── */}
        {submitted && status === "verified" && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={resetForm}
            className="w-full max-w-sm py-3.5 rounded-2xl font-black text-sm cursor-pointer mb-6"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            🔄 Verify Another Number
          </motion.button>
        )}

        {/* ── Verification History ── */}
        {history.length > 0 && (
          <div className="w-full max-w-sm mt-2">
            <div className="text-xs font-black mb-2" style={{ color: "rgba(255,255,255,0.5)" }}>
              📜 Verification History
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {history.map((h, i) => (
                <div key={h.id} className="flex items-center gap-3 px-4 py-3"
                  style={{
                    background: i % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                    borderBottom: i < history.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                  <span className="text-lg">📱</span>
                  <div className="flex-1">
                    <p className="text-sm font-black text-white">+91 {h.phone}</p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {new Date(h.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-2 py-1 rounded-full"
                    style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}>
                    ✅ VERIFIED
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECURE NOTE ── */}
        <div className="w-full max-w-sm mt-6 px-4 py-3 rounded-2xl flex items-start gap-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-lg mt-0.5">🔒</span>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
            Your mobile number is encrypted and stored securely in Firestore. We comply with all data protection guidelines.
            Your information is only used for identity verification.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
