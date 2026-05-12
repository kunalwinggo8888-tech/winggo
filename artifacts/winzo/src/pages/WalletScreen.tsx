/**
 * WalletScreen — WINGGO (Redesigned)
 * Tabs: Add Money | Bonus | Withdrawal | History
 * Dark gold/purple theme, mobile-first 480px
 */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useAuth } from "@/context/useAuth";
import type { BankDetails } from "@/context/WalletContext";

// ─── TYPES ────────────────────────────────────────────────────────────────────

type Tab = "add" | "bonus" | "withdraw" | "history";
type WithdrawMethod = "upi" | "bank";
type HistoryFilter = "all" | "deposit" | "win" | "withdraw" | "bonus" | "fee";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const AMOUNT_PRESETS = [50, 100, 200, 500, 1000, 2000];
const MIN_WITHDRAW = 100;
const MAX_WITHDRAW = 10000;

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n % 1 === 0 ? `₹${n}` : `₹${n.toFixed(2)}`;
}
function savePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function loadPref(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

// ─── TAB BUTTON ───────────────────────────────────────────────────────────────

function TabBtn({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold relative transition-colors"
      style={{ color: active ? "#FFD700" : "rgba(255,255,255,0.4)" }}
    >
      <span className="text-base leading-none">{icon}</span>
      <span>{label}</span>
      {active && (
        <motion.div
          layoutId="wallet-tab-indicator"
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
          style={{ background: "linear-gradient(90deg,#FFD700,#ff8c00)" }}
        />
      )}
    </button>
  );
}

// ─── BALANCE CARD ─────────────────────────────────────────────────────────────

function BalanceCard({ wallet, total, isSynced }: {
  wallet: { winning: number; deposit: number; bonus: number };
  total: number;
  isSynced: boolean;
}) {
  return (
    <div
      className="mx-4 mt-4 mb-2 rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "linear-gradient(135deg,#1a1000 0%,#0d0800 60%,#07050f 100%)",
        border: "1px solid rgba(255,215,0,0.25)",
        boxShadow: "0 0 40px rgba(255,215,0,0.1)",
      }}
    >
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle,rgba(255,215,0,0.18) 0%,transparent 70%)" }} />

      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: "rgba(255,215,0,0.5)" }}>Total Balance</p>
          <div className="flex items-baseline gap-1.5">
            <span className="font-black text-3xl leading-none" style={{ color: "#FFD700" }}>
              {fmt(total)}
            </span>
            {isSynced && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                LIVE
              </span>
            )}
          </div>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.25)" }}>
          💰
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Winnings", val: wallet.winning, icon: "🏆", color: "#22c55e" },
          { label: "Deposit",  val: wallet.deposit,  icon: "💳", color: "#3b82f6" },
          { label: "Bonus",    val: wallet.bonus,    icon: "🎁", color: "#FFD700" },
        ].map(({ label, val, icon, color }) => (
          <div key={label}
            className="rounded-xl p-2.5 flex flex-col gap-0.5"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-1">
              <span className="text-xs">{icon}</span>
              <span className="text-[9px] font-bold uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
            </div>
            <span className="font-black text-sm" style={{ color }}>{fmt(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── TX ROW ───────────────────────────────────────────────────────────────────

function TxRow({ tx }: {
  tx: {
    id: string | number; type?: string; title: string;
    display: string; time: string; color: string; status?: string;
  };
}) {
  const statusColor =
    tx.status === "completed" ? "#4ade80" :
    tx.status === "rejected"  ? "#f87171" : "#f59e0b";
  const statusLabel =
    tx.status === "completed" ? "Completed" :
    tx.status === "rejected"  ? "Rejected" : "Pending";

  const emoji =
    tx.type === "win"      ? "🏆" :
    tx.type === "deposit"  ? "💳" :
    tx.type === "withdraw" ? "🏦" :
    tx.type === "bonus"    ? "🎁" :
    tx.type === "fee"      ? "🎮" : "💰";

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
        style={{ background: `${tx.color}18`, border: `1px solid ${tx.color}35` }}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{tx.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>{tx.time}</p>
          {tx.status && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30` }}>
              {statusLabel}
            </span>
          )}
        </div>
      </div>
      <span className="font-black text-sm shrink-0" style={{ color: tx.color }}>{tx.display}</span>
    </div>
  );
}

// ─── ADD MONEY CONSTANTS ──────────────────────────────────────────────────────

const OWNER_UPI  = "winggo@axl";
const OWNER_NAME = "WINGGO Gaming";

// ─── ADD MONEY TAB ────────────────────────────────────────────────────────────

type DepositStep = "info" | "upload" | "done";

function AddMoneyTab({ onSubmit }: {
  onSubmit: (amount: number, file: File | null, utrRef: string) => Promise<void>;
}) {
  const [step, setStep]               = useState<DepositStep>("info");
  const [selected, setSelected]       = useState<number>(100);
  const [custom, setCustom]           = useState("");
  const [file, setFile]               = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [utrRef, setUtrRef]           = useState("");
  const [loading, setLoading]         = useState(false);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const finalAmt = custom ? (parseInt(custom, 10) || 0) : selected;
  const bonusPct = finalAmt >= 1000 ? 20 : finalAmt >= 500 ? 15 : finalAmt >= 200 ? 10 : 0;
  const bonusAmt = Math.round(finalAmt * bonusPct / 100);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`upi://pay?pa=${OWNER_UPI}&pn=${OWNER_NAME}&cu=INR`)}&color=FFD700&bgcolor=0a0a0f`;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) setFilePreview(URL.createObjectURL(f));
  }

  async function handleSubmit() {
    if (finalAmt < 10 || !file) return;
    setLoading(true);
    try {
      await onSubmit(finalAmt, file, utrRef.trim());
      setStep("done");
    } finally {
      setLoading(false);
    }
  }

  // ── Step: Info (UPI + QR + Instructions) ─────────────────────────────────────
  if (step === "info") return (
    <div className="px-4 space-y-4">

      {/* UPI card */}
      <div className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg,#1a1200,#0a0a0f)",
          border: "1.5px solid rgba(255,215,0,0.4)",
          boxShadow: "0 0 40px rgba(255,215,0,0.12)",
        }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(255,215,0,0.12) 0%,transparent 70%)" }} />
        <p className="text-[10px] font-black uppercase tracking-widest mb-2 relative z-10"
          style={{ color: "rgba(255,215,0,0.55)" }}>📲 Pay via UPI</p>
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex-1">
            <p className="font-black text-lg text-white">{OWNER_NAME}</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-black text-base" style={{ color: "#FFD700" }}>{OWNER_UPI}</p>
              <button
                onClick={() => { navigator.clipboard?.writeText(OWNER_UPI).catch(() => {}); }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-black"
                style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700" }}>
                COPY
              </button>
            </div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {["GPay","PhonePe","Paytm","BHIM"].map((app) => (
                <span key={app} className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)" }}>
                  {app}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl overflow-hidden shrink-0" style={{ border: "2px solid rgba(255,215,0,0.5)", background: "#fff", padding: 4 }}>
            <img src={qrUrl} alt="UPI QR" width={76} height={76} className="block" />
          </div>
        </div>
      </div>

      {/* Amount presets */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2.5"
          style={{ color: "rgba(255,255,255,0.4)" }}>Select Amount</p>
        <div className="grid grid-cols-3 gap-2">
          {AMOUNT_PRESETS.map((v) => {
            const isActive = !custom && selected === v;
            const pct = v >= 1000 ? 20 : v >= 500 ? 15 : v >= 200 ? 10 : 0;
            return (
              <button key={v} onClick={() => { setSelected(v); setCustom(""); }}
                className="rounded-xl p-3 flex flex-col items-center gap-0.5 transition-all"
                style={{
                  background: isActive
                    ? "linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,140,0,0.1))"
                    : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${isActive ? "rgba(255,215,0,0.6)" : "rgba(255,255,255,0.07)"}`,
                  boxShadow: isActive ? "0 0 20px rgba(255,215,0,0.2)" : "none",
                }}>
                <span className="font-black text-base" style={{ color: isActive ? "#FFD700" : "#fff" }}>₹{v}</span>
                {pct > 0 && (
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                    +{pct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom amount */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-base" style={{ color: "#FFD700" }}>₹</span>
        <input type="number" inputMode="numeric" value={custom} placeholder="Enter custom amount"
          onChange={(e) => { setCustom(e.target.value); if (e.target.value) setSelected(0); }}
          className="w-full pl-8 pr-4 py-3 rounded-xl font-bold text-white outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1.5px solid ${custom ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.1)"}`,
            fontSize: 15,
          }}
        />
      </div>

      {/* Bonus preview */}
      <AnimatePresence>
        {finalAmt > 0 && bonusPct > 0 && (
          <motion.div key="bonus-preview"
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl px-4 py-3 flex items-center justify-between overflow-hidden"
            style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
            <div>
              <p className="text-xs font-black" style={{ color: "#4ade80" }}>🎉 Deposit Bonus Unlocked!</p>
              <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                Deposit ₹{finalAmt} → get +₹{bonusAmt} extra bonus
              </p>
            </div>
            <p className="font-black text-lg" style={{ color: "#4ade80" }}>+₹{bonusAmt}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to steps */}
      <div className="rounded-xl p-4 space-y-2"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "rgba(255,215,0,0.6)" }}>
          How to Add Money
        </p>
        {[
          ["1", "Open GPay, PhonePe, or Paytm"],
          ["2", "Scan QR code or enter UPI ID above"],
          ["3", "Send the exact amount selected"],
          ["4", "Take a screenshot of the confirmation"],
          ["5", "Click the button below to upload it"],
        ].map(([n, text]) => (
          <div key={n} className="flex items-start gap-2.5">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5"
              style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)", color: "#FFD700" }}>
              {n}
            </div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.6)" }}>{text}</p>
          </div>
        ))}
      </div>

      {/* CTA button */}
      <button
        onClick={() => { if (finalAmt >= 10) setStep("upload"); }}
        disabled={finalAmt < 10}
        className="w-full py-4 rounded-2xl font-black text-base"
        style={{
          background: finalAmt >= 10
            ? "linear-gradient(135deg,#FFD700 0%,#ff8c00 60%,#e65c00 100%)"
            : "rgba(255,255,255,0.07)",
          color: finalAmt >= 10 ? "#000" : "rgba(255,255,255,0.25)",
          boxShadow: finalAmt >= 10 ? "0 0 30px rgba(255,215,0,0.4)" : "none",
        }}>
        {finalAmt >= 10
          ? `I've Sent ₹${finalAmt} — Upload Screenshot →`
          : "Select an amount (min ₹10)"}
      </button>

      {/* Bonus tiers */}
      <div className="rounded-xl p-3"
        style={{ background: "rgba(255,215,0,0.04)", border: "1px solid rgba(255,215,0,0.1)" }}>
        <p className="text-[10px] font-black uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,215,0,0.5)" }}>Deposit Bonus Tiers</p>
        <div className="space-y-1.5">
          {[["₹200–₹499","10% Bonus"],["₹500–₹999","15% Bonus"],["₹1000+","20% Bonus"]].map(([range, bonus]) => (
            <div key={range} className="flex justify-between text-xs">
              <span style={{ color: "rgba(255,255,255,0.5)" }}>{range}</span>
              <span className="font-bold" style={{ color: "#4ade80" }}>{bonus}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Step: Upload screenshot ─────────────────────────────────────────────────
  if (step === "upload") return (
    <div className="px-4 space-y-4">

      {/* Back */}
      <button onClick={() => setStep("info")}
        className="flex items-center gap-1.5 text-sm font-bold"
        style={{ color: "rgba(255,255,255,0.4)" }}>
        ← Back
      </button>

      {/* Amount summary */}
      <div className="rounded-2xl p-4 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg,rgba(52,152,219,0.15),rgba(52,152,219,0.05))",
          border: "1.5px solid rgba(52,152,219,0.3)",
        }}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-0.5"
            style={{ color: "rgba(96,165,250,0.7)" }}>Payment Amount</p>
          <p className="font-black text-3xl" style={{ color: "#60a5fa" }}>₹{finalAmt}</p>
          {bonusPct > 0 && (
            <p className="text-xs font-bold mt-0.5" style={{ color: "#4ade80" }}>
              +₹{bonusAmt} bonus will be added on approval
            </p>
          )}
        </div>
        <div className="text-4xl">💳</div>
      </div>

      {/* Screenshot upload */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          Upload Payment Screenshot <span style={{ color: "#ef4444" }}>*</span>
        </p>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-2xl flex flex-col items-center justify-center gap-2 transition-all"
          style={{
            minHeight: filePreview ? "auto" : 140,
            background: file ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.03)",
            border: `2px dashed ${file ? "rgba(34,197,94,0.5)" : "rgba(255,255,255,0.15)"}`,
          }}>
          {filePreview ? (
            <div className="relative w-full rounded-2xl overflow-hidden" style={{ maxHeight: 200 }}>
              <img src={filePreview} alt="Payment screenshot" className="w-full object-cover" style={{ maxHeight: 200 }} />
              <div className="absolute top-2 right-2 px-2 py-1 rounded-lg text-[10px] font-black"
                style={{ background: "rgba(34,197,94,0.9)", color: "#fff" }}>
                ✓ Screenshot added
              </div>
            </div>
          ) : (
            <div className="py-8 flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                📸
              </div>
              <p className="text-sm font-bold text-white">Tap to upload screenshot</p>
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>JPG, PNG accepted · Max 5MB</p>
            </div>
          )}
        </button>
        {file && (
          <button onClick={() => { setFile(null); setFilePreview(null); }}
            className="mt-2 text-xs font-bold w-full text-center"
            style={{ color: "rgba(239,68,68,0.6)" }}>
            Remove screenshot
          </button>
        )}
      </div>

      {/* UTR Reference */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-1.5"
          style={{ color: "rgba(255,255,255,0.4)" }}>
          UTR / Transaction ID
          <span className="ml-1 font-medium" style={{ color: "rgba(255,255,255,0.25)", textTransform: "none" }}>(optional)</span>
        </p>
        <input type="text" value={utrRef} onChange={(e) => setUtrRef(e.target.value)}
          placeholder="e.g. 123456789012 (from your payment app)"
          className="w-full px-4 py-3 rounded-xl font-bold text-white outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: `1.5px solid ${utrRef ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.1)"}`,
            fontSize: 14,
          }}
        />
      </div>

      {/* Submit */}
      <button onClick={handleSubmit} disabled={!file || finalAmt < 10 || loading}
        className="w-full py-4 rounded-2xl font-black text-base"
        style={{
          background: file && !loading
            ? "linear-gradient(135deg,#FFD700 0%,#ff8c00 60%,#e65c00 100%)"
            : "rgba(255,255,255,0.07)",
          color: file && !loading ? "#000" : "rgba(255,255,255,0.25)",
          boxShadow: file && !loading ? "0 0 30px rgba(255,215,0,0.4)" : "none",
        }}>
        {loading ? "⏳ Submitting Request…" : !file ? "Upload screenshot to continue" : `Submit Deposit Request — ₹${finalAmt}`}
      </button>

      <p className="text-[10px] text-center" style={{ color: "rgba(255,255,255,0.25)" }}>
        Deposits verified within 30 minutes · Support: 9 AM – 11 PM IST
      </p>
    </div>
  );

  // ── Step: Done (success) ────────────────────────────────────────────────────
  return (
    <div className="px-4 flex flex-col items-center py-10 gap-5">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="w-24 h-24 rounded-full flex items-center justify-center text-5xl"
        style={{
          background: "radial-gradient(circle,rgba(255,215,0,0.2),rgba(255,215,0,0.04))",
          border: "2px solid rgba(255,215,0,0.4)",
          boxShadow: "0 0 60px rgba(255,215,0,0.3)",
        }}>
        ✅
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="text-center space-y-1">
        <h3 className="font-black text-2xl text-white">Request Submitted!</h3>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your ₹{finalAmt} deposit is under review
        </p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="w-full rounded-2xl p-4 space-y-2.5"
        style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)" }}>
        {([
          ["Amount Requested", `₹${finalAmt}`],
          ...(bonusPct > 0 ? [["Bonus on Approval", `+₹${bonusAmt}`]] : []),
          ["Status", "⏳ Pending Review"],
          ["Estimated Time", "Within 30 minutes"],
          ["Support Hours", "9 AM – 11 PM IST"],
        ] as [string, string][]).map(([label, val]) => (
          <div key={label} className="flex justify-between text-sm">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
            <span className="font-bold" style={{ color: label === "Status" ? "#f59e0b" : "#fff" }}>{val}</span>
          </div>
        ))}
      </motion.div>

      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        onClick={() => { setStep("info"); setFile(null); setFilePreview(null); setUtrRef(""); setCustom(""); setSelected(100); }}
        className="w-full py-3.5 rounded-2xl font-black text-sm"
        style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.35)", color: "#FFD700" }}>
        Submit Another Request
      </motion.button>
    </div>
  );
}

// ─── BONUS TAB ────────────────────────────────────────────────────────────────

function BonusTab({
  bonusBalance,
  transactions,
  onNavigate,
}: {
  bonusBalance: number;
  transactions: Array<{ id: string|number; type: string; title: string; display: string; time: string; color: string; status?: string }>;
  onNavigate?: (screen: string) => void;
}) {
  const bonusTxs = transactions.filter((t) => t.type === "bonus");

  return (
    <div className="px-4 space-y-4">

      {/* Hero bonus balance */}
      <div
        className="rounded-2xl p-5 relative overflow-hidden text-center"
        style={{
          background: "linear-gradient(135deg,#1a1000 0%,#0a0800 100%)",
          border: "1.5px solid rgba(255,215,0,0.35)",
          boxShadow: "0 0 40px rgba(255,215,0,0.15)",
        }}
      >
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(255,215,0,0.15) 0%,transparent 70%)" }} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 relative z-10"
          style={{ color: "rgba(255,215,0,0.5)" }}>🎁 Bonus Balance</p>
        <p className="font-black text-5xl relative z-10"
          style={{ color: "#FFD700", textShadow: "0 0 30px rgba(255,215,0,0.6)" }}>
          {fmt(bonusBalance)}
        </p>
        <p className="text-xs mt-2 relative z-10" style={{ color: "rgba(255,255,255,0.4)" }}>
          Use bonus to enter any game · Cannot be withdrawn
        </p>
      </div>

      {/* Earn more section */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest mb-2.5"
          style={{ color: "rgba(255,255,255,0.4)" }}>Earn More Bonus</p>
        <div className="space-y-2">
          {[
            { icon: "🎰", title: "Daily Spin Wheel", sub: "Win up to ₹500 bonus every day", action: "Spin", screen: "spinwheel" },
            { icon: "👥", title: "Refer & Earn", sub: "Get ₹50 bonus for every friend you invite", action: "Refer", screen: "refer" },
            { icon: "💳", title: "Deposit Bonus", sub: "Earn 10–20% cashback on every deposit", action: "Add Money", screen: "wallet_add" },
          ].map(({ icon, title, sub, action, screen }) => (
            <div key={title}
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)" }}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>{sub}</p>
              </div>
              <button
                onClick={() => onNavigate?.(screen)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-black"
                style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.35)", color: "#FFD700" }}>
                {action}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Bonus history */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest mb-2.5"
          style={{ color: "rgba(255,255,255,0.4)" }}>Bonus History</p>
        {bonusTxs.length === 0 ? (
          <div className="rounded-xl py-10 flex flex-col items-center gap-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="text-3xl">🎁</span>
            <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>No bonus earned yet</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Spin the wheel to earn today!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {bonusTxs.map((tx) => <TxRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── INPUT FIELD ──────────────────────────────────────────────────────────────

function InputField({ label, placeholder, value, onChange, hint, type = "text" }: {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void; hint?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-xs font-bold mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>{label}</p>
      <input
        type={type}
        inputMode={type === "tel" ? "numeric" : "text"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl font-bold text-white outline-none"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: `1.5px solid ${value ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.1)"}`,
          fontSize: 14,
        }}
      />
      {hint && <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{hint}</p>}
    </div>
  );
}

// ─── WITHDRAWAL TAB ───────────────────────────────────────────────────────────

function WithdrawalTab({
  winningBalance,
  onWithdraw,
  uid,
}: {
  winningBalance: number;
  onWithdraw: (amount: number, method: "upi" | "bank", details: { upiId?: string; bankDetails?: BankDetails }) => void;
  uid: string | null;
}) {
  const LS_UPI  = uid ? `winggo_upi_${uid}`  : "winggo_upi";
  const LS_BANK = uid ? `winggo_bank_${uid}` : "winggo_bank";

  const [method, setMethod]           = useState<WithdrawMethod>("upi");
  const [amount, setAmount]           = useState("");
  const [upiId, setUpiId]             = useState(() => loadPref(LS_UPI));
  const [saveUpi, setSaveUpi]         = useState(true);
  const [bankHolder, setBankHolder]   = useState(() => {
    try { return JSON.parse(loadPref(LS_BANK) || "{}").accountHolderName ?? ""; } catch { return ""; }
  });
  const [bankAccount, setBankAccount] = useState(() => {
    try { return JSON.parse(loadPref(LS_BANK) || "{}").accountNumber ?? ""; } catch { return ""; }
  });
  const [bankIfsc, setBankIfsc]       = useState(() => {
    try { return JSON.parse(loadPref(LS_BANK) || "{}").ifscCode ?? ""; } catch { return ""; }
  });
  const [bankName, setBankName]       = useState(() => {
    try { return JSON.parse(loadPref(LS_BANK) || "{}").bankName ?? ""; } catch { return ""; }
  });
  const [saveBank, setSaveBank]       = useState(true);
  const [submitted, setSubmitted]     = useState(false);
  const [error, setError]             = useState("");

  const amtNum      = parseInt(amount, 10) || 0;
  const canWithdraw = winningBalance >= MIN_WITHDRAW;

  function validate(): string {
    if (amtNum < MIN_WITHDRAW) return `Minimum withdrawal is ${fmt(MIN_WITHDRAW)}`;
    if (amtNum > MAX_WITHDRAW) return `Maximum withdrawal is ${fmt(MAX_WITHDRAW)}`;
    if (amtNum > winningBalance) return `Only ${fmt(winningBalance)} available in winnings`;
    if (method === "upi" && !upiId.trim()) return "Please enter your UPI ID";
    if (method === "bank") {
      if (!bankHolder.trim())  return "Enter account holder name";
      if (!bankAccount.trim()) return "Enter account number";
      if (!bankIfsc.trim())    return "Enter IFSC code";
      if (!bankName.trim())    return "Enter bank name";
    }
    return "";
  }

  function handleSubmit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError("");
    if (method === "upi"  && saveUpi)  savePref(LS_UPI, upiId.trim());
    if (method === "bank" && saveBank) {
      savePref(LS_BANK, JSON.stringify({
        accountHolderName: bankHolder.trim(),
        accountNumber:     bankAccount.trim(),
        ifscCode:          bankIfsc.trim().toUpperCase(),
        bankName:          bankName.trim(),
      }));
    }
    const details = method === "upi"
      ? { upiId: upiId.trim() }
      : {
          bankDetails: {
            accountHolderName: bankHolder.trim(),
            accountNumber:     bankAccount.trim(),
            ifscCode:          bankIfsc.trim().toUpperCase(),
            bankName:          bankName.trim(),
          },
        };
    onWithdraw(amtNum, method, details);
    setSubmitted(true);
    setTimeout(() => { setSubmitted(false); setAmount(""); }, 3500);
  }

  if (submitted) {
    return (
      <div className="px-4 py-12 flex flex-col items-center gap-4">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
          style={{ background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.4)" }}>
          ✅
        </motion.div>
        <div className="text-center">
          <p className="font-black text-xl" style={{ color: "#4ade80" }}>Withdrawal Requested!</p>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
            ₹{amtNum} will be processed within 24–48 hours
          </p>
        </div>
        <div className="rounded-xl px-5 py-3 text-center"
          style={{ background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.15)" }}>
          <p className="text-xs font-bold" style={{ color: "rgba(255,215,0,0.7)" }}>
            {method === "upi"
              ? `To UPI: ${upiId}`
              : `To Bank: ${bankName} ••••${bankAccount.slice(-4)}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">

      {/* Winning balance hero */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{
          background: "linear-gradient(135deg,rgba(34,197,94,0.1),rgba(34,197,94,0.05))",
          border: "1px solid rgba(34,197,94,0.25)",
        }}
      >
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest"
            style={{ color: "rgba(34,197,94,0.6)" }}>Available to Withdraw</p>
          <p className="font-black text-2xl" style={{ color: "#4ade80" }}>{fmt(winningBalance)}</p>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
            Winning balance only · Deposit & Bonus not withdrawable
          </p>
        </div>
        <span className="text-3xl">🏆</span>
      </div>

      {!canWithdraw && (
        <div className="rounded-xl p-3 flex items-center gap-2"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)" }}>
          <span>⚠️</span>
          <p className="text-xs font-bold" style={{ color: "#fbbf24" }}>
            Minimum {fmt(MIN_WITHDRAW)} in winnings required. Play more games to win!
          </p>
        </div>
      )}

      {/* Amount */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}>Withdraw Amount</p>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-black text-base"
            style={{ color: "#FFD700" }}>₹</span>
          <input
            type="number" inputMode="numeric"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setError(""); }}
            placeholder={`Min ₹${MIN_WITHDRAW} – Max ₹${MAX_WITHDRAW.toLocaleString()}`}
            disabled={!canWithdraw}
            className="w-full pl-8 pr-4 py-3 rounded-xl font-bold text-white outline-none"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1.5px solid ${amount ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.1)"}`,
              fontSize: 15,
              opacity: canWithdraw ? 1 : 0.5,
            }}
          />
        </div>
        {/* Quick picks */}
        <div className="flex gap-2 mt-2 flex-wrap">
          {[100, 200, 500, 1000].filter((v) => v <= winningBalance).map((v) => (
            <button key={v}
              onClick={() => { setAmount(String(v)); setError(""); }}
              className="px-3 py-1 rounded-lg text-xs font-bold"
              style={{
                background: amount === String(v) ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${amount === String(v) ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.1)"}`,
                color: amount === String(v) ? "#FFD700" : "rgba(255,255,255,0.6)",
              }}>
              ₹{v}
            </button>
          ))}
          {winningBalance >= MIN_WITHDRAW && (
            <button
              onClick={() => { setAmount(String(Math.min(winningBalance, MAX_WITHDRAW))); setError(""); }}
              className="px-3 py-1 rounded-lg text-xs font-bold"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}>
              Max
            </button>
          )}
        </div>
      </div>

      {/* Method */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}>Withdrawal Method</p>
        <div className="flex gap-2">
          {(["upi", "bank"] as WithdrawMethod[]).map((m) => (
            <button key={m}
              onClick={() => { setMethod(m); setError(""); }}
              className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: method === m
                  ? "linear-gradient(135deg,rgba(255,215,0,0.18),rgba(255,140,0,0.09))"
                  : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${method === m ? "rgba(255,215,0,0.55)" : "rgba(255,255,255,0.08)"}`,
                color: method === m ? "#FFD700" : "rgba(255,255,255,0.5)",
              }}>
              {m === "upi" ? "📱 UPI" : "🏦 Bank Account"}
            </button>
          ))}
        </div>
      </div>

      {/* Form */}
      <AnimatePresence mode="wait">
        {method === "upi" ? (
          <motion.div key="upi"
            initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 15 }}
            className="space-y-3">
            <InputField
              label="UPI ID"
              placeholder="yourname@upi"
              value={upiId}
              onChange={setUpiId}
              hint="e.g. 9876543210@paytm · name@okaxis · phone@ybl"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={saveUpi} onChange={(e) => setSaveUpi(e.target.checked)} />
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Save UPI ID for next time
              </span>
            </label>
          </motion.div>
        ) : (
          <motion.div key="bank"
            initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -15 }}
            className="space-y-3">
            <InputField label="Account Holder Name" placeholder="Full name as on passbook"    value={bankHolder}  onChange={setBankHolder} />
            <InputField label="Account Number"       placeholder="Enter account number"         value={bankAccount} onChange={setBankAccount} type="tel" />
            <InputField label="IFSC Code"            placeholder="e.g. SBIN0001234"            value={bankIfsc}    onChange={(v) => setBankIfsc(v.toUpperCase())} hint="11-character code on your cheque book" />
            <InputField label="Bank Name"            placeholder="e.g. State Bank of India"   value={bankName}    onChange={setBankName} />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={saveBank} onChange={(e) => setSaveBank(e.target.checked)} />
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.5)" }}>
                Save bank details for next time
              </span>
            </label>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div key="err"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="rounded-xl px-4 py-2.5 flex items-center gap-2"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}>
            <span className="text-sm">⚠️</span>
            <p className="text-xs font-bold" style={{ color: "#f87171" }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canWithdraw}
        className="w-full py-4 rounded-2xl font-black text-base"
        style={{
          background: canWithdraw
            ? "linear-gradient(135deg,#22c55e 0%,#16a34a 100%)"
            : "rgba(255,255,255,0.07)",
          color: canWithdraw ? "#fff" : "rgba(255,255,255,0.25)",
          boxShadow: canWithdraw ? "0 0 25px rgba(34,197,94,0.3)" : "none",
        }}
      >
        🏦 Request Withdrawal{amtNum >= MIN_WITHDRAW && amtNum <= winningBalance ? ` of ${fmt(amtNum)}` : ""}
      </button>

      <p className="text-center text-[10px] pb-2" style={{ color: "rgba(255,255,255,0.2)" }}>
        Processed within 24–48 hours after admin approval. UPI transfers are instant once approved.
      </p>
    </div>
  );
}

// ─── HISTORY TAB ─────────────────────────────────────────────────────────────

function HistoryTab({
  transactions,
}: {
  transactions: Array<{
    id: string|number; type: string; title: string; display: string;
    time: string; color: string; status?: string; rawAmount: number; roomId?: string;
  }>;
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [transactions, filter]);

  const stats = useMemo(() => ({
    won:       transactions.filter((t) => t.type === "win").reduce((s, t) => s + t.rawAmount, 0),
    deposited: transactions.filter((t) => t.type === "deposit").reduce((s, t) => s + t.rawAmount, 0),
    withdrawn: transactions.filter((t) => t.type === "withdraw").reduce((s, t) => s + Math.abs(t.rawAmount), 0),
    bonus:     transactions.filter((t) => t.type === "bonus").reduce((s, t) => s + t.rawAmount, 0),
  }), [transactions]);

  // Group game sessions by roomId
  const gameSessions = useMemo(() => {
    const map: Record<string, { fee?: typeof transactions[0]; win?: typeof transactions[0] }> = {};
    transactions.filter((t) => t.roomId).forEach((t) => {
      if (!map[t.roomId!]) map[t.roomId!] = {};
      if (t.type === "fee") map[t.roomId!].fee = t;
      if (t.type === "win") map[t.roomId!].win = t;
    });
    return Object.values(map).filter((s) => s.fee || s.win);
  }, [transactions]);

  const FILTERS: [HistoryFilter, string, string][] = [
    ["all",      "All",      ""],
    ["deposit",  "Deposits", "💳"],
    ["win",      "Winnings", "🏆"],
    ["withdraw", "Withdraw", "🏦"],
    ["bonus",    "Bonus",    "🎁"],
    ["fee",      "Games",    "🎮"],
  ];

  return (
    <div className="px-4 space-y-4">

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Total Won",    val: stats.won,       color: "#22c55e", icon: "🏆" },
          { label: "Deposited",    val: stats.deposited, color: "#3b82f6", icon: "💳" },
          { label: "Withdrawn",    val: stats.withdrawn, color: "#f59e0b", icon: "🏦" },
          { label: "Bonus Earned", val: stats.bonus,     color: "#FFD700", icon: "🎁" },
        ].map(({ label, val, color, icon }) => (
          <div key={label}
            className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs">{icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.4)" }}>{label}</span>
            </div>
            <p className="font-black text-base" style={{ color }}>{fmt(val)}</p>
          </div>
        ))}
      </div>

      {/* Game sessions */}
      {gameSessions.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest mb-2.5"
            style={{ color: "rgba(255,255,255,0.4)" }}>Recent Games</p>
          <div className="space-y-2">
            {gameSessions.slice(0, 5).map((s, i) => {
              const fee  = s.fee ? Math.abs(s.fee.rawAmount) : 0;
              const win  = s.win?.rawAmount ?? 0;
              const net  = win - fee;
              const isW  = net > 0;
              return (
                <div key={i}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                    style={{
                      background: isW ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      border: `1px solid ${isW ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                    }}>
                    {isW ? "🏆" : "🎮"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white">
                      {s.fee?.title?.replace("Entry Fee — ", "") ?? "Game"}
                    </p>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                      Entry ₹{fee} · {isW ? `Won ₹${win}` : "Lost"}
                    </p>
                  </div>
                  <span className="font-black text-sm shrink-0"
                    style={{ color: isW ? "#4ade80" : "#f87171" }}>
                    {isW ? `+₹${net.toFixed(2)}` : `-₹${fee}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {FILTERS.map(([f, label, icon]) => (
          <button key={f}
            onClick={() => setFilter(f)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              background: filter === f ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${filter === f ? "rgba(255,215,0,0.5)" : "rgba(255,255,255,0.08)"}`,
              color: filter === f ? "#FFD700" : "rgba(255,255,255,0.5)",
            }}>
            {icon} {label}
          </button>
        ))}
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl py-12 flex flex-col items-center gap-2"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-4xl">📭</span>
          <p className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.35)" }}>No transactions yet</p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>
            {filter === "all" ? "Play games and add money to get started!" : `No ${filter} transactions found`}
          </p>
        </div>
      ) : (
        <div className="space-y-2 pb-6">
          {filtered.map((tx) => <TxRow key={tx.id} tx={tx} />)}
        </div>
      )}
    </div>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

interface Props {
  onNavigate?: (screen: string) => void;
  onBack?: () => void;
}

export default function WalletScreen({ onNavigate, onBack }: Props) {
  const { wallet, transactions, total, withdraw, submitDepositRequest, isSynced } = useWallet();
  const { user } = useAuth();
  const [tab, setTab]           = useState<Tab>("add");
  const [flashMsg, setFlashMsg] = useState("");

  const showFlash = useCallback((msg: string) => {
    setFlashMsg(msg);
    setTimeout(() => setFlashMsg(""), 4000);
  }, []);

  useEffect(() => {}, []);

  async function handleSubmitDeposit(amount: number, file: File | null, utrRef: string) {
    await submitDepositRequest(amount, file, utrRef);
    showFlash("✅ Deposit request submitted! Admin will verify within 30 minutes.");
    setTimeout(() => setTab("history"), 3000);
  }

  function handleWithdraw(amount: number, method: "upi" | "bank", details: { upiId?: string; bankDetails?: BankDetails }) {
    withdraw(amount, method, details);
    showFlash(`✅ Withdrawal of ₹${amount} submitted for approval`);
  }

  function handleNavigate(screen: string) {
    if (screen === "wallet_add") { setTab("add"); return; }
    onNavigate?.(screen);
  }

  const TABS: [Tab, string, string][] = [
    ["add",      "Add Money", "➕"],
    ["bonus",    "Bonus",     "🎁"],
    ["withdraw", "Withdraw",  "🏦"],
    ["history",  "History",   "📋"],
  ];

  return (
    <div className="flex flex-col h-full"
      style={{ background: "#0a0a0f", color: "#fff", maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-2 shrink-0">
        {onBack && (
          <button onClick={onBack}
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 4l-5 5 5 5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <div className="flex-1">
          <h1 className="font-black text-xl leading-none">
            <span className="text-white">MY</span>
            <span style={{ color: "#FFD700" }}> WALLET</span>
          </h1>
          <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>Play More · Win More</p>
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
          style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.2)" }}>
          💰
        </div>
      </div>

      {/* Balance card */}
      <BalanceCard wallet={wallet} total={total} isSynced={isSynced} />

      {/* Flash message */}
      <AnimatePresence>
        {flashMsg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="mx-4 mb-1 px-4 py-2.5 rounded-xl text-sm font-bold text-center"
            style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}
          >
            {flashMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab bar */}
      <div className="mx-4 mb-2 rounded-2xl shrink-0 flex"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        {TABS.map(([t, label, icon]) => (
          <TabBtn key={t} label={label} icon={icon} active={tab === t} onClick={() => setTab(t)} />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="pb-6 pt-2"
          >
            {tab === "add" && <AddMoneyTab onSubmit={handleSubmitDeposit} />}
            {tab === "bonus" && (
              <BonusTab
                bonusBalance={wallet.bonus}
                transactions={transactions}
                onNavigate={handleNavigate}
              />
            )}
            {tab === "withdraw" && (
              <WithdrawalTab
                winningBalance={wallet.winning}
                onWithdraw={handleWithdraw}
                uid={user?.uid ?? null}
              />
            )}
            {tab === "history" && <HistoryTab transactions={transactions} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
