import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  amount: number;
  bonusPct: number;
  onSuccess: () => void;
  onClose: () => void;
}

const UPI_APPS = [
  { id: "gpay",    label: "Google Pay",  icon: "G",  color: "#4285f4", vpa: "paybiz@okhdfcbank" },
  { id: "phonepe", label: "PhonePe",     icon: "Pe", color: "#5f259f", vpa: "merchant@ybl" },
  { id: "paytm",   label: "Paytm",       icon: "Pa", color: "#00b9f1", vpa: "paytmbiz@paytm" },
  { id: "bhim",    label: "BHIM UPI",    icon: "B",  color: "#ff6600", vpa: "merchant@upi" },
];

type PayTab = "upi" | "card" | "netbanking" | "ewallet";
type Phase  = "idle" | "processing" | "success" | "failed";

export default function RazorpayGateway({ amount, bonusPct, onSuccess, onClose }: Props) {
  const [tab, setTab]           = useState<PayTab>("upi");
  const [upiApp, setUpiApp]     = useState("gpay");
  const [customVpa, setCustomVpa] = useState("");
  const [phase, setPhase]       = useState<Phase>("idle");

  const handlePay = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("processing");
    setTimeout(() => {
      setPhase("success");
      setTimeout(() => onSuccess(), 1200);
    }, 2000);
  }, [phase, onSuccess]);

  const TABS: { id: PayTab; label: string }[] = [
    { id: "upi",       label: "UPI" },
    { id: "card",      label: "Cards" },
    { id: "netbanking",label: "NetBanking" },
    { id: "ewallet",   label: "Wallets" },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.88)", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* ── RAZORPAY HEADER ── */}
      <div style={{ background: "#2d6dba", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: "#fff", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
              <path d="M8 30L20 8l12 22H8z" fill="#2d6dba" />
              <path d="M20 8l12 22H20V8z" fill="#072654" />
            </svg>
          </div>
          <div>
            <div style={{ color: "#fff", fontWeight: 900, fontSize: 14, letterSpacing: "0.02em" }}>Razorpay</div>
            <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>🔒 Secured Payment Gateway</div>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ color: "rgba(255,255,255,0.7)", fontSize: 22, background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>
          ✕
        </button>
      </div>

      {/* ── WHITE BODY ── */}
      <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Order info */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 15, color: "#222" }}>WINGGO Gaming</div>
              <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>Add money to wallet</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 900, fontSize: 24, color: "#222" }}>₹{amount}</div>
              {bonusPct > 0 && (
                <div style={{ color: "#27ae60", fontSize: 11, fontWeight: 700 }}>+{bonusPct}% wallet bonus</div>
              )}
            </div>
          </div>
        </div>

        {/* Payment method tabs */}
        <div style={{ display: "flex", borderBottom: "1.5px solid #f0f0f0", flexShrink: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: "10px 2px", fontSize: 11, fontWeight: 700,
                border: "none", cursor: "pointer", background: "transparent",
                color: tab === t.id ? "#2d6dba" : "#aaa",
                borderBottom: tab === t.id ? "2px solid #2d6dba" : "2px solid transparent",
                marginBottom: -1.5,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─ UPI ─ */}
        {tab === "upi" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
              Choose UPI App
            </div>
            {UPI_APPS.map(app => (
              <div key={app.id} onClick={() => setUpiApp(app.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                  border: `1.5px solid ${upiApp === app.id ? app.color : "#eee"}`,
                  borderRadius: 10, marginBottom: 8, cursor: "pointer",
                  background: upiApp === app.id ? `${app.color}0d` : "#fff",
                  transition: "all 0.15s",
                }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, background: `${app.color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: app.color, fontWeight: 900, fontSize: 13, flexShrink: 0,
                }}>
                  {app.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#333" }}>{app.label}</div>
                  <div style={{ fontSize: 10, color: "#bbb", marginTop: 1, fontFamily: "monospace" }}>{app.vpa}</div>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${upiApp === app.id ? app.color : "#ddd"}`,
                  background: upiApp === app.id ? app.color : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {upiApp === app.id && <span style={{ color: "#fff", fontSize: 11, fontWeight: 900 }}>✓</span>}
                </div>
              </div>
            ))}

            <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.08em", margin: "14px 0 8px" }}>
              Or Enter UPI ID
            </div>
            <div style={{ display: "flex", border: "1.5px solid #e0e0e0", borderRadius: 8, overflow: "hidden" }}>
              <input
                type="text" placeholder="yourname@upi"
                value={customVpa}
                onChange={e => setCustomVpa(e.target.value)}
                style={{ flex: 1, padding: "10px 12px", fontSize: 14, border: "none", outline: "none", color: "#333" }}
              />
              <button style={{ padding: "0 14px", background: "#2d6dba", color: "#fff", fontWeight: 700, fontSize: 12, border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>
                Verify
              </button>
            </div>
            <div style={{ fontSize: 10, color: "#bbb", marginTop: 6 }}>E.g. mobilenumber@upi or yourname@okaxis</div>
          </div>
        )}

        {/* ─ CARD ─ */}
        {tab === "card" && (
          <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
            <div>
              <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700, marginBottom: 6 }}>CARD NUMBER</div>
              <input placeholder="0000  0000  0000  0000"
                style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box", letterSpacing: "0.08em", color: "#333" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700, marginBottom: 6 }}>EXPIRY</div>
                <input placeholder="MM / YY"
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box", color: "#333" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700, marginBottom: 6 }}>CVV</div>
                <input placeholder="•••" type="password"
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box", color: "#333" }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#bbb", fontWeight: 700, marginBottom: 6 }}>NAME ON CARD</div>
              <input placeholder="Your Name"
                style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #e0e0e0", borderRadius: 8, fontSize: 15, outline: "none", boxSizing: "border-box", color: "#333" }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              {["Visa", "Mastercard", "RuPay", "Amex"].map(n => (
                <div key={n} style={{ flex: 1, padding: "6px 4px", border: "1px solid #eee", borderRadius: 6, textAlign: "center", fontSize: 10, color: "#aaa", fontWeight: 700 }}>{n}</div>
              ))}
            </div>
          </div>
        )}

        {/* ─ NET BANKING ─ */}
        {tab === "netbanking" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", marginBottom: 10 }}>Popular Banks</div>
            {[["🏦","SBI","State Bank of India"],["🏦","HDFC Bank","HDFC Netbanking"],["🏦","ICICI Bank","ICICI iMobile"],["🏦","Axis Bank","Axis Internet Banking"],["🏦","Kotak Bank","Kotak Net Banking"],["🏦","PNB","Punjab National Bank"]].map(([icon, bank, sub]) => (
              <div key={bank as string}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #f0f0f0", borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#333", fontWeight: 700 }}>{bank}</div>
                  <div style={{ fontSize: 10, color: "#bbb" }}>{sub}</div>
                </div>
                <span style={{ color: "#ccc", fontSize: 16 }}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* ─ E-WALLETS ─ */}
        {tab === "ewallet" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#bbb", textTransform: "uppercase", marginBottom: 10 }}>Digital Wallets</div>
            {[["💙","Paytm Wallet","Pay using Paytm balance"],["💜","MobiKwik","MobiKwik wallet"],["🟢","Amazon Pay","Amazon Pay balance"],["🟡","Freecharge","Freecharge wallet"]].map(([icon, name, sub]) => (
              <div key={name as string}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid #f0f0f0", borderRadius: 8, marginBottom: 6, cursor: "pointer" }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#333", fontWeight: 700 }}>{name}</div>
                  <div style={{ fontSize: 10, color: "#bbb" }}>{sub}</div>
                </div>
                <span style={{ color: "#ccc", fontSize: 16 }}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* ── PAY BUTTON ── */}
        <div style={{ padding: "12px 16px 20px", background: "#fff", borderTop: "1px solid #f0f0f0", flexShrink: 0 }}>
          <AnimatePresence mode="wait">
            {phase === "success" ? (
              <motion.div key="ok"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px", background: "#27ae60", borderRadius: 10 }}
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 16 }}>✅ Payment Successful!</span>
              </motion.div>
            ) : phase === "failed" ? (
              <motion.div key="fail"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "#e74c3c", borderRadius: 10 }}
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 15 }}>❌ Payment Failed. Try again.</span>
              </motion.div>
            ) : (
              <motion.button key="pay"
                onClick={handlePay}
                disabled={phase === "processing"}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: "100%", padding: "16px", borderRadius: 10, border: "none",
                  cursor: phase === "processing" ? "default" : "pointer",
                  background: phase === "processing" ? "#91b4e0" : "#2d6dba",
                  color: "#fff", fontWeight: 900, fontSize: 16,
                }}>
                {phase === "processing" ? (
                  <motion.span animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.85, repeat: Infinity }}>
                    ⏳ Processing Payment…
                  </motion.span>
                ) : (
                  `Pay ₹${amount}`
                )}
              </motion.button>
            )}
          </AnimatePresence>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
            <span style={{ fontSize: 11 }}>🔒</span>
            <span style={{ fontSize: 11, color: "#ccc" }}>Secured by</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#2d6dba" }}>Razorpay</span>
            <span style={{ fontSize: 10, color: "#ddd" }}>·</span>
            <span style={{ fontSize: 10, color: "#ccc" }}>PCI DSS Compliant</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
