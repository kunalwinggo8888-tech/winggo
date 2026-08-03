import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import BackButton from "@/components/BackButton";
import { subscribeSupportConfig, SupportConfig } from "@/firebase/firestore.service";

interface TermsScreenProps {
  onBack?: () => void;
}

export default function TermsScreen({ onBack }: TermsScreenProps) {
  const [supportConfig, setSupportConfig] = useState<SupportConfig | null>(null);

  useEffect(() => {
    const unsub = subscribeSupportConfig((config) => {
      setSupportConfig(config);
    });
    return unsub;
  }, []);

  const instagramLink = supportConfig?.instagramUrl || "https://instagram.com/winggo_official";
  const supportEmail = supportConfig?.gmail || "support@winggo.com";

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
          <div className="text-white font-black text-lg leading-none">Terms & Privacy</div>
          <div className="text-xs mt-0.5" style={{ color: "#666" }}>Legal policies</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-8 pb-8">
        <div className="space-y-6">
          {/* Terms of Service */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="text-white font-black text-base mb-3">📜 Terms of Service</h2>
            <div className="space-y-3 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              <p>By using Winggo, you agree to these terms. Winggo is a skill-based gaming platform where users can play games and win real money.</p>
              <p>Users must be 18 years or older to participate. All winnings are subject to applicable taxes and regulations.</p>
              <p>Fair play is mandatory. Any form of cheating, collusion, or unfair practices will result in account suspension.</p>
            </div>
          </div>

          {/* Privacy Policy */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="text-white font-black text-base mb-3">🔒 Privacy Policy</h2>
            <div className="space-y-3 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              <p>We collect minimal data required to provide our services. Your personal information is encrypted and stored securely.</p>
              <p>We do not sell your data to third parties. Your information is used only for account management, payments, and game statistics.</p>
              <p>You can request data deletion by contacting our support team.</p>
            </div>
          </div>

          {/* Refund Policy */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h2 className="text-white font-black text-base mb-3">💰 Refund Policy</h2>
            <div className="space-y-3 text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              <p>Deposits are non-refundable once used in games. Withdrawal requests are processed within 24-48 hours.</p>
              <p>In case of technical issues affecting gameplay, refunds may be issued at our discretion.</p>
              <p>Minimum withdrawal amount is ₹10.</p>
            </div>
          </div>

          {/* Contact & Social */}
          <div className="rounded-2xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,215,0,0.08)" }}>
            <h2 className="text-white font-black text-base mb-3">📞 Contact & Social</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: "rgba(234,67,53,0.15)", color: "#ea4335" }}>
                  📧
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Email Support</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>{supportEmail}</div>
                </div>
              </div>
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => window.open(instagramLink, "_blank")}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                  style={{ background: "rgba(225,48,108,0.15)", color: "#e1306c" }}>
                  📸
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Instagram</div>
                  <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Follow us for updates</div>
                </div>
                <span style={{ color: "rgba(255,255,255,0.25)", marginLeft: "auto" }}>→</span>
              </motion.div>
            </div>
          </div>

          {/* Last Updated */}
          <div className="text-center text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
            Last updated: August 2025
          </div>
        </div>
      </div>
    </motion.div>
  );
}
