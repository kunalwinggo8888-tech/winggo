import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BackButton from "@/components/BackButton";
import { subscribeSupportConfig, SupportConfig } from "@/firebase/firestore.service";

interface SupportScreenProps {
  onBack?: () => void;
}

export default function SupportScreen({ onBack }: SupportScreenProps) {
  const [supportConfig, setSupportConfig] = useState<SupportConfig | null>(null);

  useEffect(() => {
    // Subscribe to support settings from Firestore
    const unsub = subscribeSupportConfig((config) => {
      setSupportConfig(config);
    });

    return () => {
      unsub();
    };
  }, []);

  const supportEmail = supportConfig?.gmail || "support@winggo.com";
  const instagramLink = supportConfig?.instagramUrl || "https://instagram.com/winggo_official";
  const instagramUsername = supportConfig?.instagramUsername || "winggo_official";
  const supportText = supportConfig?.supportText || "For support, contact us via email or Instagram. We typically respond within 24 hours.";

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "#07050f", maxWidth: 480, margin: "0 auto" }}
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
    >
      {/* Header */}
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
          <div className="text-white font-black text-lg leading-none">Support Center</div>
          <div className="text-xs mt-0.5" style={{ color: "#666" }}>24×7 Help & FAQ</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🎧</div>
          <h2 className="text-white font-black text-2xl mb-2">Need Help?</h2>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            We're here to assist you 24×7
          </p>
        </div>

        {/* Contact Options */}
        <div className="space-y-4">
          {/* Gmail */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl p-5 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,215,0,0.10)",
            }}
            onClick={() => window.location.href = `mailto:${supportEmail}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(234,67,53,0.15)", color: "#ea4335" }}>
                📧
              </div>
              <div className="flex-1">
                <div className="text-white font-black text-base">Email Support</div>
                <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {supportEmail}
                </div>
              </div>
              <span style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
            </div>
          </motion.div>

          {/* Instagram */}
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="rounded-2xl p-5 cursor-pointer"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,215,0,0.10)",
            }}
            onClick={() => window.open(instagramLink, "_blank")}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ background: "rgba(225,48,108,0.15)", color: "#e1306c" }}>
                📸
              </div>
              <div className="flex-1">
                <div className="text-white font-black text-base">Instagram</div>
                <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>
                  @{instagramUsername}
                </div>
              </div>
              <span style={{ color: "rgba(255,255,255,0.25)" }}>›</span>
            </div>
          </motion.div>
        </div>

        {/* FAQ Section */}
        <div className="mt-8">
          <h3 className="text-white font-black text-lg mb-4">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {[
              { q: "How do I withdraw my winnings?", a: "Go to Wallet → Withdrawal tab and enter your UPI ID or bank details." },
              { q: "What is the minimum withdrawal?", a: "The minimum withdrawal amount is ₹10." },
              { q: "How long does withdrawal take?", a: "Withdrawals are usually processed within 24-48 hours." },
              { q: "Is my data secure?", a: "Yes, we use encryption and follow all data protection guidelines." },
            ].map((faq, i) => (
              <motion.div
                key={i}
                className="rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="text-sm font-bold text-white mb-2">{faq.q}</div>
                <div className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                  {faq.a}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Contact Note */}
        <div className="mt-8 px-4 py-4 rounded-2xl text-center"
          style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>
          <div className="text-sm font-bold" style={{ color: "#34d399" }}>
            💬 Quick Response Guaranteed
          </div>
          <div className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            We typically respond within 2-4 hours
          </div>
        </div>
      </div>
    </motion.div>
  );
}
