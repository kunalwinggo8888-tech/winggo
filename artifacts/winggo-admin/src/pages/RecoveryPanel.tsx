/**
 * RecoveryPanel — Admin Owner Emergency Recovery
 *
 * 3-step wizard (red/amber "emergency" theme to distinguish from normal login):
 *   Step 1 — Enter Master Recovery Key  (validates SHA-256 against env var)
 *   Step 2 — Verify backup Gmail        (Firebase sign-in link sent; page reloads on click)
 *   Step 3 — Set new Admin ID + pass    (written to system/admin_config in Firestore)
 *
 * On success, the parent (App) signs in with the new credentials immediately.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  validateMasterKey,
  sendRecoveryEmailLink,
  isRecoveryEmailLink,
  completeEmailVerification,
  applyNewAdminCredentials,
  getBackupEmail,
  maskEmail,
  isRecoveryConfigured,
} from "@/firebase/recovery.service";
import { adminSignIn } from "@/firebase/config";

type Step = "key" | "email_sent" | "verifying" | "set_creds" | "done" | "error";

interface Props {
  onBack:      () => void;
  onRecovered: () => void;
}

export default function RecoveryPanel({ onBack, onRecovered }: Props) {
  const [step,     setStep]     = useState<Step>("key");
  const [masterKey, setMasterKey] = useState("");
  const [newId,    setNewId]    = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [err,      setErr]      = useState("");

  const backupEmail = getBackupEmail();
  const configured  = isRecoveryConfigured();

  // ── On mount: check if this page load is the Firebase email link redirect ──
  useEffect(() => {
    if (!isRecoveryEmailLink()) return;
    setStep("verifying");
    completeEmailVerification().then(result => {
      if (result.success) setStep("set_creds");
      else { setErr(result.error ?? "Email link verification failed."); setStep("error"); }
    });
  }, []);

  // ── Step 1: Validate master key then send email link ──────────────────────
  async function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!masterKey.trim()) return;
    setLoading(true); setErr("");

    const keyResult = await validateMasterKey(masterKey);
    if (!keyResult.valid) {
      setLoading(false);
      setErr(keyResult.error ?? "Invalid master key.");
      return;
    }

    const sent = await sendRecoveryEmailLink();
    setLoading(false);
    if (!sent.sent) {
      setErr(sent.error ?? "Could not send verification email.");
      return;
    }
    setStep("email_sent");
  }

  // ── Step 3: Apply new credentials and sign in ─────────────────────────────
  async function handleCredsSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newId.trim() || !newPass) { setErr("Both fields are required."); return; }
    if (newPass.length < 8) { setErr("Password must be at least 8 characters."); return; }
    setLoading(true); setErr("");

    const result = await applyNewAdminCredentials(newId, newPass);
    if (!result.success) {
      setLoading(false);
      setErr(result.error ?? "Failed to apply credentials.");
      return;
    }

    // Immediately sign in with new credentials
    const signIn = await adminSignIn(newId, newPass);
    setLoading(false);
    if (!signIn.success) {
      setErr("Credentials saved but auto-login failed. Please log in manually.");
      setTimeout(onBack, 3000);
      return;
    }

    setStep("done");
    setTimeout(onRecovered, 2200);
  }

  // ── Strength meter for new password ──────────────────────────────────────
  const strength =
    newPass.length === 0 ? 0
    : newPass.length < 6 ? 1
    : newPass.length < 8 ? 2
    : newPass.length < 10 ? 3
    : newPass.length < 13 ? 4 : 5;
  const strengthLabel = ["", "Weak", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ff4444", "#ff7744", "#f97316", "#22c55e", "#4ade80"][strength];

  // ── Step indicators ───────────────────────────────────────────────────────
  const stepOrder: Step[] = ["key", "email_sent", "set_creds", "done"];
  const stepLabels = ["Master Key", "Email OTP", "New Login"];
  const currentIndex =
    step === "verifying" ? 1
    : step === "error"   ? 0
    : Math.max(0, stepOrder.indexOf(step));

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4"
      style={{ background: "#0a0606" }}>

      {/* ── Background ────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage:
            "linear-gradient(rgba(255,60,0,0.03) 1px, transparent 1px)," +
            "linear-gradient(90deg, rgba(255,60,0,0.03) 1px, transparent 1px)",
          backgroundSize: "52px 52px",
        }} />
        <motion.div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,60,0,0.09) 0%, transparent 65%)" }}
          animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 7, repeat: Infinity }} />
        <motion.div className="absolute bottom-[-25%] left-[-25%] w-[70%] h-[70%] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(180,0,0,0.09) 0%, transparent 65%)" }}
          animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 9, repeat: Infinity, delay: 2 }} />
        <motion.div className="absolute left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,80,0,0.25), transparent)" }}
          animate={{ top: ["-2%", "102%"] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: "linear", repeatDelay: 2.5 }} />
      </div>

      {/* ── Card ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full rounded-3xl"
        style={{
          maxWidth: 440,
          background: "rgba(14,6,6,0.92)",
          border: "1px solid rgba(255,60,0,0.22)",
          boxShadow:
            "0 0 60px rgba(255,60,0,0.08), 0 32px 80px rgba(0,0,0,0.75)," +
            "inset 0 0 0 1px rgba(255,255,255,0.02)",
          backdropFilter: "blur(28px)",
        }}>

        <div className="absolute top-0 left-10 right-10 h-px rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,80,0,0.65), transparent)" }} />

        <div className="p-8">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center mb-6">
            <motion.div className="mb-4 flex items-center justify-center text-3xl rounded-2xl"
              style={{
                width: 68, height: 68,
                background: "linear-gradient(135deg, rgba(255,60,0,0.14) 0%, rgba(200,0,0,0.22) 100%)",
                border: "1.5px solid rgba(255,60,0,0.38)",
              }}
              animate={{ boxShadow: [
                "0 0 20px rgba(255,60,0,0.12)",
                "0 0 40px rgba(255,60,0,0.3)",
                "0 0 20px rgba(255,60,0,0.12)",
              ]}}
              transition={{ duration: 2.6, repeat: Infinity }}>
              🔑
            </motion.div>
            <h1 className="text-2xl font-black text-white tracking-tight">Emergency Recovery</h1>
            <p className="text-[10px] font-black tracking-[0.22em] mt-0.5"
              style={{ color: "rgba(255,80,0,0.5)" }}>
              OWNER ACCESS RECOVERY PANEL
            </p>
            <div className="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: "rgba(255,60,0,0.07)", border: "1px solid rgba(255,60,0,0.18)" }}>
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#ff4400" }}
                animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.3, repeat: Infinity }} />
              <span className="text-[9px] font-black" style={{ color: "rgba(255,80,0,0.65)" }}>
                EMERGENCY ACCESS MODE
              </span>
            </div>
          </div>

          {/* ── Not-configured warning ───────────────────────────────────── */}
          {!configured && step !== "verifying" && (
            <div className="mb-5 px-4 py-3 rounded-xl text-xs"
              style={{ background: "rgba(255,200,0,0.06)", border: "1px solid rgba(255,200,0,0.2)" }}>
              <p className="font-black" style={{ color: "rgba(255,200,0,0.8)" }}>⚠️ Recovery Not Configured</p>
              <p className="mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Add <code className="font-mono" style={{ color: "rgba(255,200,0,0.7)" }}>VITE_ADMIN_MASTER_KEY_HASH</code> and{" "}
                <code className="font-mono" style={{ color: "rgba(255,200,0,0.7)" }}>VITE_ADMIN_BACKUP_EMAIL</code> to Replit Secrets to enable this feature.
              </p>
            </div>
          )}

          {/* ── Step indicator ───────────────────────────────────────────── */}
          {step !== "done" && step !== "error" && step !== "verifying" && (
            <div className="flex items-center justify-center gap-1 mb-6">
              {stepLabels.map((label, i) => {
                const active = i === currentIndex;
                const done   = i < currentIndex;
                return (
                  <div key={label} className="flex items-center gap-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black"
                        style={{
                          background: done ? "rgba(255,80,0,0.28)" : active ? "rgba(255,80,0,0.12)" : "rgba(255,255,255,0.04)",
                          border: `1.5px solid ${done ? "rgba(255,80,0,0.55)" : active ? "rgba(255,80,0,0.38)" : "rgba(255,255,255,0.08)"}`,
                          color:  done ? "#ff6633" : active ? "rgba(255,100,0,0.85)" : "rgba(255,255,255,0.2)",
                        }}>
                        {done ? "✓" : i + 1}
                      </div>
                      <span className="text-[8px] font-black"
                        style={{ color: active ? "rgba(255,80,0,0.65)" : "rgba(255,255,255,0.18)" }}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && (
                      <div className="w-7 h-px mb-3.5"
                        style={{ background: done ? "rgba(255,80,0,0.38)" : "rgba(255,255,255,0.06)" }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Steps ────────────────────────────────────────────────────── */}
          <AnimatePresence mode="wait">

            {/* STEP 1 — Master Key */}
            {step === "key" && (
              <motion.form key="step-key" onSubmit={handleKeySubmit}
                initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
                className="space-y-4">

                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "rgba(255,80,0,0.05)", border: "1px solid rgba(255,80,0,0.14)" }}>
                  <p className="font-bold" style={{ color: "rgba(255,140,0,0.75)" }}>
                    🛡️ Two-Factor Recovery
                  </p>
                  <p className="mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Enter your Master Recovery Key. If valid, a one-time sign-in link will be emailed to your pre-registered backup Gmail — proving you own both.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-[0.18em] block mb-2"
                    style={{ color: "rgba(255,80,0,0.5)" }}>
                    MASTER RECOVERY KEY
                  </label>
                  <input
                    type="password" value={masterKey} autoComplete="off" spellCheck={false}
                    placeholder="WINGGO-MASTER-RECOVER-XXXX-XXXX"
                    disabled={!configured || loading}
                    onChange={e => { setMasterKey(e.target.value); setErr(""); }}
                    className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none font-mono"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      border: `1px solid ${masterKey ? "rgba(255,80,0,0.35)" : "rgba(255,80,0,0.15)"}`,
                      caretColor: "#ff4400",
                      opacity: !configured || loading ? 0.45 : 1,
                    }}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,80,0,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,80,0,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = `1px solid ${masterKey ? "rgba(255,80,0,0.35)" : "rgba(255,80,0,0.15)"}`; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>

                <AnimatePresence>
                  {err && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="px-4 py-3 rounded-xl flex items-start gap-2.5"
                      style={{ background: "rgba(255,51,51,0.07)", border: "1px solid rgba(255,51,51,0.2)" }}>
                      <span className="shrink-0">⚠️</span>
                      <p className="text-xs font-bold" style={{ color: "#ff7777" }}>{err}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button type="submit" whileTap={{ scale: 0.97 }}
                  disabled={!configured || loading || !masterKey.trim()}
                  className="relative w-full py-4 rounded-xl font-black text-sm cursor-pointer overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,60,0,0.18) 0%, rgba(200,0,0,0.28) 100%)",
                    color:  "#ff6633",
                    border: "1px solid rgba(255,60,0,0.38)",
                    letterSpacing: "0.07em",
                    opacity: (!configured || loading || !masterKey.trim()) ? 0.45 : 1,
                  }}>
                  {!loading && (
                    <motion.div className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,80,0,0.1) 50%, transparent 60%)" }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: "linear", repeatDelay: 1.8 }} />
                  )}
                  {loading ? "⚙️ Validating & sending link…" : "🔑 VALIDATE KEY & SEND EMAIL LINK"}
                </motion.button>
              </motion.form>
            )}

            {/* STEP 2 — Email link sent, waiting */}
            {step === "email_sent" && (
              <motion.div key="step-email"
                initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
                className="space-y-4">
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                  <motion.div className="text-5xl"
                    animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    📧
                  </motion.div>
                  <div>
                    <p className="font-black text-white text-base">Check Your Backup Gmail</p>
                    <p className="text-sm mt-1.5" style={{ color: "rgba(255,255,255,0.38)" }}>
                      A secure sign-in link was sent to
                    </p>
                    <p className="text-sm font-black mt-0.5" style={{ color: "#ff6633" }}>
                      {maskEmail(backupEmail)}
                    </p>
                  </div>
                  <div className="px-4 py-3.5 rounded-xl text-xs w-full text-left"
                    style={{ background: "rgba(255,80,0,0.05)", border: "1px solid rgba(255,80,0,0.14)" }}>
                    <p className="font-bold mb-2" style={{ color: "rgba(255,140,0,0.75)" }}>📋 Instructions</p>
                    {["Open your backup Gmail inbox.",
                      'Find the email from "noreply@winggo…" or Firebase.',
                      "Click the Sign In link inside it.",
                      "You'll be redirected here to set new credentials.",
                    ].map((step, i) => (
                      <p key={i} className="mb-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                        {i + 1}. {step}
                      </p>
                    ))}
                  </div>
                  <div className="flex gap-1.5 mt-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full"
                        style={{ background: "rgba(255,80,0,0.5)" }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.35 }} />
                    ))}
                  </div>
                  <p className="text-[9px] font-mono" style={{ color: "rgba(255,80,0,0.3)" }}>
                    Waiting for email verification…
                  </p>
                </div>
              </motion.div>
            )}

            {/* VERIFYING — Firebase redirect processing */}
            {step === "verifying" && (
              <motion.div key="step-verifying"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4 py-10 text-center">
                <motion.span className="text-5xl inline-block"
                  animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  ⚙️
                </motion.span>
                <p className="font-black text-white text-base">Verifying email link…</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.32)" }}>
                  Confirming backup Gmail ownership
                </p>
              </motion.div>
            )}

            {/* STEP 3 — Set new credentials */}
            {step === "set_creds" && (
              <motion.form key="step-creds" onSubmit={handleCredsSubmit}
                initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }}
                className="space-y-4">

                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "rgba(0,220,120,0.04)", border: "1px solid rgba(0,220,120,0.16)" }}>
                  <p className="font-bold" style={{ color: "rgba(0,220,100,0.75)" }}>
                    ✅ Backup Gmail Verified
                  </p>
                  <p className="mt-1" style={{ color: "rgba(255,255,255,0.38)" }}>
                    Identity confirmed. Set new admin credentials — these take effect immediately and revoke any previous login.
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-[0.18em] block mb-2"
                    style={{ color: "rgba(255,80,0,0.5)" }}>NEW ADMIN ID</label>
                  <input type="text" value={newId} autoComplete="off"
                    placeholder="New admin username"
                    onChange={e => { setNewId(e.target.value); setErr(""); }}
                    className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none font-mono"
                    style={{
                      background: "rgba(0,0,0,0.5)",
                      border: `1px solid ${newId ? "rgba(255,80,0,0.35)" : "rgba(255,80,0,0.15)"}`,
                      caretColor: "#ff4400",
                    }}
                    onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,80,0,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,80,0,0.07)"; }}
                    onBlur={e => { e.currentTarget.style.border = `1px solid ${newId ? "rgba(255,80,0,0.35)" : "rgba(255,80,0,0.15)"}`; e.currentTarget.style.boxShadow = "none"; }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-[0.18em] block mb-2"
                    style={{ color: "rgba(255,80,0,0.5)" }}>NEW PASSWORD</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"} value={newPass}
                      placeholder="Min. 8 characters" autoComplete="new-password"
                      onChange={e => { setNewPass(e.target.value); setErr(""); }}
                      className="w-full px-4 py-3.5 pr-12 rounded-xl text-white text-sm outline-none font-mono"
                      style={{
                        background: "rgba(0,0,0,0.5)",
                        border: `1px solid ${newPass ? "rgba(255,80,0,0.35)" : "rgba(255,80,0,0.15)"}`,
                        caretColor: "#ff4400",
                      }}
                      onFocus={e => { e.currentTarget.style.border = "1px solid rgba(255,80,0,0.6)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(255,80,0,0.07)"; }}
                      onBlur={e => { e.currentTarget.style.border = `1px solid ${newPass ? "rgba(255,80,0,0.35)" : "rgba(255,80,0,0.15)"}`; e.currentTarget.style.boxShadow = "none"; }}
                    />
                    <button type="button" tabIndex={-1}
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                      style={{ background: "rgba(255,80,0,0.07)", color: showPass ? "#ff4400" : "rgba(226,232,240,0.3)", fontSize: 14 }}>
                      {showPass ? "🙈" : "👁"}
                    </button>
                  </div>
                  {newPass && (
                    <div className="mt-1.5 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <div key={s} className="flex-1 h-1 rounded-full transition-all"
                          style={{ background: s <= strength ? strengthColor : "rgba(255,255,255,0.06)" }} />
                      ))}
                      <span className="text-[9px] font-bold ml-1 min-w-[28px]"
                        style={{ color: strength >= 3 ? strengthColor : "rgba(255,80,0,0.5)" }}>
                        {strengthLabel}
                      </span>
                    </div>
                  )}
                </div>

                <AnimatePresence>
                  {err && (
                    <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="px-4 py-3 rounded-xl flex items-start gap-2.5"
                      style={{ background: "rgba(255,51,51,0.07)", border: "1px solid rgba(255,51,51,0.2)" }}>
                      <span className="shrink-0">⚠️</span>
                      <p className="text-xs font-bold" style={{ color: "#ff7777" }}>{err}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button type="submit" whileTap={{ scale: 0.97 }}
                  disabled={loading || !newId.trim() || newPass.length < 8}
                  className="relative w-full py-4 rounded-xl font-black text-sm cursor-pointer overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, rgba(255,60,0,0.18) 0%, rgba(200,0,0,0.28) 100%)",
                    color: "#ff6633",
                    border: "1px solid rgba(255,60,0,0.38)",
                    letterSpacing: "0.07em",
                    opacity: (loading || !newId.trim() || newPass.length < 8) ? 0.45 : 1,
                  }}>
                  {loading ? "⚙️ Applying new credentials…" : "🔒 APPLY & RESTORE ACCESS"}
                </motion.button>
              </motion.form>
            )}

            {/* DONE */}
            {step === "done" && (
              <motion.div key="step-done"
                initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 py-10 text-center">
                <motion.div className="text-6xl"
                  animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 0.75, repeat: Infinity }}>
                  ✅
                </motion.div>
                <div>
                  <p className="text-xl font-black text-white">Access Restored</p>
                  <p className="text-sm mt-2" style={{ color: "rgba(255,255,255,0.38)" }}>
                    New credentials applied. Entering admin console…
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3].map(i => (
                    <motion.div key={i} className="w-2 h-2 rounded-full"
                      style={{ background: "#ff6633" }}
                      animate={{ scale: [0.5, 1.3, 0.5], opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ERROR */}
            {step === "error" && (
              <motion.div key="step-error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-4 text-center py-4">
                <p className="text-5xl">❌</p>
                <p className="font-black text-white text-base mt-3">Verification Failed</p>
                <p className="text-sm" style={{ color: "#ff7777" }}>{err}</p>
                <button onClick={() => { setStep("key"); setErr(""); setMasterKey(""); }}
                  className="w-full py-3 rounded-xl font-black text-sm cursor-pointer mt-2"
                  style={{ background: "rgba(255,80,0,0.07)", color: "#ff6633", border: "1px solid rgba(255,80,0,0.18)" }}>
                  ← Try Again
                </button>
              </motion.div>
            )}

          </AnimatePresence>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-col items-center gap-2.5">
            {(step === "key" || step === "email_sent") && (
              <button onClick={onBack}
                className="text-xs font-bold cursor-pointer transition-colors"
                style={{ color: "rgba(255,255,255,0.18)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.18)"; }}>
                ← Back to Admin Login
              </button>
            )}
            <p className="text-[9px] font-mono text-center" style={{ color: "rgba(255,60,0,0.15)" }}>
              WINGGO EMERGENCY RECOVERY · ENCRYPTED CHANNEL · UNAUTHORIZED ACCESS PROHIBITED
            </p>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
