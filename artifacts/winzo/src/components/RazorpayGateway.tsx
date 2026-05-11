/**
 * RazorpayGateway — WINGGO
 * Real Razorpay Checkout integration with server-side order creation + signature verification.
 *
 * Flow:
 *  1. POST /api/payment/create-order  → server creates Razorpay order, returns order_id + key_id
 *  2. Razorpay JS SDK opens native checkout (UPI / Card / NetBanking / Wallets)
 *  3. On success callback → POST /api/payment/verify (HMAC-SHA256 check on server)
 *  4. Only after server confirms → firestoreDeposit() updates wallet
 *
 * The Razorpay Key Secret NEVER touches the client.
 */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/useAuth";
import { firestoreDeposit } from "@/firebase/firestore.service";
import { useWallet } from "@/context/useWallet";

// Razorpay JS types
declare global {
  interface Window {
    Razorpay: new (opts: RazorpayOptions) => RazorpayInstance;
  }
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
}
interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayInstance {
  open(): void;
  on(event: string, cb: () => void): void;
}

interface Props {
  amount: number;
  bonusPct: number;
  onSuccess: (paymentId: string) => void;
  onClose: () => void;
}

type Phase = "idle" | "creating" | "paying" | "verifying" | "success" | "failed";

const BASE_URL = import.meta.env.BASE_URL ?? "/";

async function loadRazorpayScript(): Promise<boolean> {
  if (window.Razorpay) return true;
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export default function RazorpayGateway({ amount, bonusPct, onSuccess, onClose }: Props) {
  const { user } = useAuth();
  const { addDeposit } = useWallet();
  const [phase, setPhase]     = useState<Phase>("idle");
  const [errMsg, setErrMsg]   = useState("");
  const [payId, setPayId]     = useState("");

  // Pre-load Razorpay SDK as soon as component mounts
  useEffect(() => { loadRazorpayScript(); }, []);

  const handlePay = useCallback(async () => {
    if (phase !== "idle") return;
    setErrMsg("");

    // ── Step 1: Create order on backend ────────────────────────────────────
    setPhase("creating");
    let orderData: { order_id: string; amount: number; currency: string; key_id: string };
    try {
      const resp = await fetch(`${BASE_URL}api/payment/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          uid:   user?.uid   ?? "guest",
          email: user?.email ?? "",
        }),
      });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error((e as { error?: string }).error ?? "Order creation failed");
      }
      orderData = await resp.json();
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : "Could not connect to payment server");
      setPhase("failed");
      return;
    }

    // ── Step 2: Load Razorpay SDK ───────────────────────────────────────────
    const loaded = await loadRazorpayScript();
    if (!loaded) {
      setErrMsg("Could not load payment gateway. Check your internet connection.");
      setPhase("failed");
      return;
    }

    // ── Step 3: Open Razorpay Checkout ─────────────────────────────────────
    setPhase("paying");
    const rzp = new window.Razorpay({
      key:         orderData.key_id,
      amount:      orderData.amount,
      currency:    orderData.currency,
      name:        "WINGGO Gaming",
      description: `Add ₹${amount} to wallet${bonusPct > 0 ? ` + ${bonusPct}% bonus` : ""}`,
      order_id:    orderData.order_id,
      prefill: {
        name:    user?.displayName ?? "",
        email:   user?.email       ?? "",
        contact: "",
      },
      theme: { color: "#FFD700" },

      handler: async (response: RazorpayResponse) => {
        // ── Step 4: Verify signature on backend ──────────────────────────
        setPhase("verifying");
        try {
          const vResp = await fetch(`${BASE_URL}api/payment/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            }),
          });
          const vData = await vResp.json() as { success: boolean; payment_id?: string; error?: string };
          if (!vResp.ok || !vData.success) {
            throw new Error(vData.error ?? "Signature verification failed");
          }

          // ── Step 5: Update Firestore wallet (only after server confirms) ─
          const pid = vData.payment_id ?? response.razorpay_payment_id;
          setPayId(pid);

          if (user) {
            await firestoreDeposit(user.uid, amount, bonusPct, {
              displayName:       user.displayName,
              email:             user.email,
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: pid,
              method:            "Razorpay",
            });
          }
          // Also update local wallet context so UI reflects instantly
          addDeposit(amount, bonusPct);

          setPhase("success");
          setTimeout(() => onSuccess(pid), 1800);
        } catch (err) {
          setErrMsg(err instanceof Error ? err.message : "Payment verification failed");
          setPhase("failed");
        }
      },

      modal: {
        ondismiss: () => {
          if (phase === "paying") {
            setPhase("idle");
          }
        },
      },
    });

    rzp.open();
  }, [phase, amount, bonusPct, user, addDeposit, onSuccess]);

  const bonusAmt = Math.round(amount * bonusPct / 100);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="w-full mx-4 rounded-3xl overflow-hidden"
        style={{ maxWidth: 380, border: "1px solid rgba(255,215,0,0.2)" }}
        initial={{ scale: 0.9, y: 30 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
      >
        {/* Header */}
        <div style={{ background: "linear-gradient(135deg, #0f0a1e, #1a0f35)", padding: "20px 20px 16px" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                <span className="font-black text-black text-base">W</span>
              </div>
              <div>
                <div className="font-black text-white text-sm">WINGGO Gaming</div>
                <div className="text-[10px] flex items-center gap-1" style={{ color: "rgba(255,215,0,0.6)" }}>
                  🔒 Secured by Razorpay
                </div>
              </div>
            </div>
            <button onClick={onClose} disabled={phase === "verifying" || phase === "creating"}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-sm disabled:opacity-30"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" }}>
              ✕
            </button>
          </div>

          {/* Amount display */}
          <div className="rounded-2xl px-4 py-3"
            style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.15)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold mb-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Add to Deposit Wallet
                </div>
                <div className="font-black text-white text-2xl">₹{amount.toLocaleString("en-IN")}</div>
              </div>
              {bonusPct > 0 && (
                <div className="rounded-xl px-3 py-2 text-center"
                  style={{ background: "rgba(39,174,96,0.12)", border: "1px solid rgba(39,174,96,0.25)" }}>
                  <div className="text-xs font-black" style={{ color: "#27ae60" }}>+{bonusPct}% Bonus</div>
                  <div className="text-sm font-black" style={{ color: "#2ecc71" }}>+₹{bonusAmt}</div>
                </div>
              )}
            </div>
            {bonusPct > 0 && (
              <div className="mt-2 pt-2 flex items-center justify-between"
                style={{ borderTop: "1px solid rgba(255,215,0,0.1)" }}>
                <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>
                  Total credited to wallet
                </span>
                <span className="text-sm font-black" style={{ color: "#FFD700" }}>
                  ₹{(amount + bonusAmt).toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ background: "#fff", padding: "20px" }}>

          <AnimatePresence mode="wait">

            {/* IDLE — show payment methods + pay button */}
            {(phase === "idle" || phase === "creating") && (
              <motion.div key="idle"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

                {/* Payment method badges */}
                <div className="mb-4">
                  <div className="text-xs font-black mb-3" style={{ color: "#aaa", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Accepted Payment Methods
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: "G", label: "Google Pay",  color: "#4285f4" },
                      { icon: "Pe", label: "PhonePe",    color: "#5f259f" },
                      { icon: "Pa", label: "Paytm",      color: "#00b9f1" },
                      { icon: "💳", label: "Cards",      color: "#e74c3c" },
                      { icon: "🏦", label: "NetBanking", color: "#27ae60" },
                      { icon: "₿",  label: "Wallets",    color: "#ff8c00" },
                    ].map((m) => (
                      <div key={m.label}
                        className="flex flex-col items-center gap-1 py-2.5 rounded-xl"
                        style={{ background: `${m.color}0d`, border: `1px solid ${m.color}22` }}>
                        <span className="font-black text-sm" style={{ color: m.color }}>{m.icon}</span>
                        <span className="text-[9px] font-bold" style={{ color: "#999" }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pay button */}
                <motion.button
                  onClick={handlePay}
                  disabled={phase === "creating"}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-4 rounded-2xl font-black text-base disabled:opacity-60"
                  style={{
                    background: phase === "creating"
                      ? "#91b4e0"
                      : "linear-gradient(135deg,#2d6dba,#1a4a8a)",
                    color: "#fff",
                    border: "none",
                    cursor: phase === "creating" ? "default" : "pointer",
                    boxShadow: "0 4px 20px rgba(45,109,186,0.35)",
                  }}>
                  {phase === "creating" ? (
                    <span className="flex items-center justify-center gap-2">
                      <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                      Creating Order…
                    </span>
                  ) : (
                    `Pay ₹${amount.toLocaleString("en-IN")} →`
                  )}
                </motion.button>

                <div className="flex items-center justify-center gap-1.5 mt-3">
                  <span className="text-xs">🔒</span>
                  <span className="text-xs" style={{ color: "#bbb" }}>256-bit SSL · PCI DSS Compliant</span>
                </div>
              </motion.div>
            )}

            {/* PAYING — Razorpay checkout is open */}
            {phase === "paying" && (
              <motion.div key="paying" className="flex flex-col items-center gap-3 py-6 text-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(45,109,186,0.08)", border: "2px solid rgba(45,109,186,0.25)" }}>
                  <motion.span className="inline-block w-6 h-6 rounded-full border-2 border-blue-400 border-t-transparent"
                    animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }} />
                </motion.div>
                <p className="font-black text-sm" style={{ color: "#333" }}>Complete payment in Razorpay</p>
                <p className="text-xs" style={{ color: "#aaa" }}>Razorpay checkout is open in a popup</p>
              </motion.div>
            )}

            {/* VERIFYING */}
            {phase === "verifying" && (
              <motion.div key="verifying" className="flex flex-col items-center gap-3 py-6 text-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="w-14 h-14 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(255,215,0,0.08)", border: "2px solid rgba(255,215,0,0.3)" }}>
                  <motion.span className="inline-block w-6 h-6 rounded-full border-2 border-t-transparent"
                    style={{ borderColor: "rgba(255,215,0,0.4)", borderTopColor: "#FFD700" }}
                    animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }} />
                </motion.div>
                <p className="font-black text-sm" style={{ color: "#333" }}>Verifying Payment…</p>
                <p className="text-xs" style={{ color: "#aaa" }}>Confirming with server</p>
              </motion.div>
            )}

            {/* SUCCESS */}
            {phase === "success" && (
              <motion.div key="success" className="flex flex-col items-center gap-3 py-6 text-center"
                initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}>
                <motion.div className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(39,174,96,0.1)", border: "2px solid rgba(39,174,96,0.35)" }}
                  animate={{ boxShadow: ["0 0 0px rgba(39,174,96,0)","0 0 28px rgba(39,174,96,0.45)","0 0 0px rgba(39,174,96,0)"] }}
                  transition={{ duration: 1.2, repeat: Infinity }}>
                  <motion.span className="text-3xl"
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.1 }}>
                    ✅
                  </motion.span>
                </motion.div>
                <p className="font-black text-lg" style={{ color: "#27ae60" }}>Payment Successful!</p>
                <p className="font-bold text-sm" style={{ color: "#333" }}>
                  ₹{(amount + bonusAmt).toLocaleString("en-IN")} added to wallet
                </p>
                {payId && (
                  <p className="text-[10px] font-mono px-3 py-1 rounded-lg"
                    style={{ background: "#f5f5f5", color: "#999" }}>
                    ID: {payId}
                  </p>
                )}
              </motion.div>
            )}

            {/* FAILED */}
            {phase === "failed" && (
              <motion.div key="failed" className="flex flex-col items-center gap-3 py-4 text-center"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <span className="text-4xl">❌</span>
                <p className="font-black text-base" style={{ color: "#e74c3c" }}>Payment Failed</p>
                <p className="text-xs px-4" style={{ color: "#aaa" }}>{errMsg || "Something went wrong. Please try again."}</p>
                <button onClick={() => { setPhase("idle"); setErrMsg(""); }}
                  className="mt-2 px-6 py-2.5 rounded-xl font-black text-sm cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#2d6dba,#1a4a8a)", color: "#fff", border: "none" }}>
                  Try Again
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 py-3"
          style={{ background: "#f8f8f8", borderTop: "1px solid #f0f0f0" }}>
          <div className="w-5 h-5 rounded flex items-center justify-center"
            style={{ background: "#2d6dba" }}>
            <svg width="11" height="11" viewBox="0 0 40 40" fill="none">
              <path d="M8 30L20 8l12 22H8z" fill="#fff" />
              <path d="M20 8l12 22H20V8z" fill="rgba(255,255,255,0.5)" />
            </svg>
          </div>
          <span className="text-xs font-black" style={{ color: "#2d6dba" }}>Powered by Razorpay</span>
          <span style={{ color: "#ddd" }}>·</span>
          <span className="text-[10px]" style={{ color: "#ccc" }}>PCI DSS Level 1</span>
        </div>
      </motion.div>
    </motion.div>
  );
}
