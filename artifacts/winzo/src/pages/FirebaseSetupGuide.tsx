/**
 * FirebaseSetupGuide — shown when Firebase credentials are missing or invalid.
 * Walks the user through every step to connect a real Firebase project.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSkip: () => void; // enter demo mode anyway
}

const STEPS = [
  {
    num: "01",
    icon: "🔥",
    title: "Create Firebase Project",
    color: "#FF6B35",
    details: [
      "Open console.firebase.google.com",
      'Click "Add project" → name it winggo',
      "Disable Google Analytics (optional)",
      'Click "Create project"',
    ],
    cta: { label: "Open Firebase Console →", url: "https://console.firebase.google.com" },
  },
  {
    num: "02",
    icon: "📱",
    title: "Enable Phone Authentication",
    color: "#FFD700",
    details: [
      'In Firebase Console → "Authentication"',
      '"Get started" → "Sign-in method"',
      'Click "Phone" → Enable → Save',
      "For testing: add your number under Test phone numbers",
    ],
    cta: null,
  },
  {
    num: "03",
    icon: "🗄️",
    title: "Create Firestore Database",
    color: "#4ECDC4",
    details: [
      'Firebase Console → "Firestore Database"',
      '"Create database" → Start in Production mode',
      "Choose your nearest region (e.g. asia-south1)",
      "Copy the Firestore rules from firestore.rules in this project",
    ],
    cta: null,
  },
  {
    num: "04",
    icon: "⚡",
    title: "Create Realtime Database",
    color: "#A855F7",
    details: [
      'Firebase Console → "Realtime Database"',
      '"Create Database" → choose region → Start in Locked mode',
      "Copy rules from database.rules.json in this project",
    ],
    cta: null,
  },
  {
    num: "05",
    icon: "⚙️",
    title: "Get Your Firebase Config",
    color: "#60A5FA",
    details: [
      'Firebase Console → Project Settings (⚙️ icon)',
      '"Your apps" → click "</>" Web icon',
      'Register app with nickname "winggo-web"',
      "Copy the firebaseConfig object shown",
    ],
    cta: null,
    configTemplate: true,
  },
  {
    num: "06",
    icon: "🔑",
    title: "Add Keys to Replit Secrets",
    color: "#34D399",
    details: [
      'In Replit → click the 🔒 "Secrets" panel in the sidebar',
      "Add each key from your firebaseConfig:",
    ],
    secrets: [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_FIREBASE_DATABASE_URL",
    ],
    cta: null,
  },
  {
    num: "07",
    icon: "🌐",
    title: "Add Your Replit Domain",
    color: "#F97316",
    details: [
      'Firebase Console → Authentication → Settings → "Authorized domains"',
      'Click "Add domain" and paste your Replit dev URL',
      "Format: your-repl-name.your-username.repl.co",
      "Also add: *.replit.dev",
    ],
    cta: null,
  },
];

const CONFIG_EXAMPLE = `// Replace with your real values from Firebase Console
const firebaseConfig = {
  apiKey:            "AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef1234567890",
  databaseURL:       "https://your-project-default-rtdb.firebaseio.com",
};`;

export default function FirebaseSetupGuide({ onSkip }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [copied, setCopied]         = useState<string | null>(null);

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  const step = STEPS[activeStep];

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #0f0823 0%, #07050f 60%, #000 100%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      {/* Header */}
      <div className="shrink-0 px-5 pt-8 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-black text-2xl">
              <span className="text-white">WIN</span>
              <span style={{ color: "#FFD700" }}>GGO</span>
            </h1>
            <p className="text-xs font-bold mt-0.5" style={{ color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em" }}>
              FIREBASE SETUP REQUIRED
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.93 }} onClick={onSkip}
            className="px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
            Skip → Demo
          </motion.button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mt-4">
          {STEPS.map((s, i) => (
            <motion.button key={i} onClick={() => setActiveStep(i)}
              className="flex-1 h-1.5 rounded-full cursor-pointer transition-all"
              style={{ background: i <= activeStep ? s.color : "rgba(255,255,255,0.1)" }}
              animate={{ opacity: i <= activeStep ? 1 : 0.4 }}
            />
          ))}
        </div>
        <p className="text-[10px] mt-1.5 font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
          Step {activeStep + 1} of {STEPS.length}
        </p>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <AnimatePresence mode="wait">
          <motion.div key={activeStep}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22 }}
            className="space-y-4">

            {/* Step header */}
            <div className="flex items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: `${step.color}18`, border: `1.5px solid ${step.color}40` }}>
                {step.icon}
              </div>
              <div>
                <div className="text-xs font-black tracking-widest" style={{ color: step.color }}>STEP {step.num}</div>
                <h2 className="text-white font-black text-lg leading-tight mt-0.5">{step.title}</h2>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-2xl p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {step.details.map((d, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5"
                    style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }}>
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{d}</p>
                </div>
              ))}
            </div>

            {/* Config template (step 5) */}
            {step.configTemplate && (
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(96,165,250,0.25)" }}>
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: "rgba(96,165,250,0.08)", borderBottom: "1px solid rgba(96,165,250,0.15)" }}>
                  <span className="text-xs font-black" style={{ color: "#60a5fa" }}>📋 firebaseConfig shape</span>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => copyToClipboard(CONFIG_EXAMPLE, "config")}
                    className="text-[10px] font-black px-2 py-1 rounded-lg cursor-pointer"
                    style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                    {copied === "config" ? "✅ Copied!" : "Copy"}
                  </motion.button>
                </div>
                <pre className="px-4 py-3 text-[10px] leading-relaxed overflow-x-auto"
                  style={{ color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
                  {CONFIG_EXAMPLE}
                </pre>
              </div>
            )}

            {/* Secrets list (step 6) */}
            {"secrets" in step && step.secrets && (
              <div className="space-y-2">
                {step.secrets.map((secret) => (
                  <motion.button key={secret} whileTap={{ scale: 0.98 }}
                    onClick={() => copyToClipboard(secret, secret)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer"
                    style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                    <code className="text-sm font-bold" style={{ color: "#34d399" }}>{secret}</code>
                    <span className="text-[10px] font-black" style={{ color: copied === secret ? "#34d399" : "rgba(255,255,255,0.3)" }}>
                      {copied === secret ? "✅ Copied" : "Tap to copy"}
                    </span>
                  </motion.button>
                ))}
                <p className="text-xs text-center mt-2" style={{ color: "rgba(255,255,255,0.3)" }}>
                  Paste each secret name into Replit Secrets with the corresponding value from your Firebase config
                </p>
              </div>
            )}

            {/* CTA link */}
            {step.cta && (
              <motion.a href={step.cta.url} target="_blank" rel="noreferrer"
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-sm cursor-pointer"
                style={{ background: `linear-gradient(135deg, ${step.color}30, ${step.color}15)`, color: step.color, border: `1.5px solid ${step.color}40` }}>
                {step.cta.label}
              </motion.a>
            )}

            {/* Tip card */}
            {activeStep === 1 && (
              <div className="rounded-2xl p-4"
                style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)" }}>
                <p className="text-xs font-black mb-1" style={{ color: "#FFD700" }}>💡 Testing Tip</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Firebase Phone Auth requires the Blaze (pay-as-you-go) plan for production SMS, but you can test with up to 10 phone numbers on the free Spark plan using the "Test phone numbers" feature in the Firebase console.
                </p>
              </div>
            )}

            {activeStep === 6 && (
              <div className="rounded-2xl p-4"
                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                <p className="text-xs font-black mb-1" style={{ color: "#f97316" }}>🌐 Find Your Replit URL</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Your Replit dev domain looks like: <br />
                  <code style={{ color: "#f97316" }}>your-repl.your-username.repl.co</code><br /><br />
                  After you publish, you'll also need to add the <code style={{ color: "#f97316" }}>.replit.app</code> domain.
                </p>
              </div>
            )}

            {activeStep === 5 && (
              <div className="rounded-2xl p-4"
                style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.15)" }}>
                <p className="text-xs font-black mb-1" style={{ color: "#34d399" }}>✅ After Adding Secrets</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Restart the WINGGO workflow in Replit after adding all secrets. The app will automatically switch from demo mode to live Firebase OTP — no code changes needed.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom nav */}
      <div className="shrink-0 px-5 pb-8 pt-4 flex gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => setActiveStep((p) => Math.max(0, p - 1))}
          disabled={activeStep === 0}
          className="flex-1 py-4 rounded-2xl font-black text-sm cursor-pointer disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)" }}>
          ← Back
        </motion.button>

        {activeStep < STEPS.length - 1 ? (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => setActiveStep((p) => p + 1)}
            className="flex-[2] py-4 rounded-2xl font-black text-sm cursor-pointer text-black"
            style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}cc)`, boxShadow: `0 0 20px ${step.color}40` }}>
            Next Step →
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} onClick={onSkip}
            className="flex-[2] py-4 rounded-2xl font-black text-sm cursor-pointer"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.15)" }}>
            Continue in Demo Mode
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
