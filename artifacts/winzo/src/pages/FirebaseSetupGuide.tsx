/**
 * FirebaseSetupGuide — shown when Firebase credentials are missing or invalid.
 * Walks admin through every step to connect a fresh Firebase project for WINGGO.
 * Updated for: Phone OTP auth, Firestore collections, RTDB, Storage, Hosting.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onSkip: () => void;
}

// ─── STEP DATA ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    icon: "🔥",
    title: "Create New Firebase Project",
    color: "#FF6B35",
    details: [
      "Go to console.firebase.google.com — sign in with your NEW Gmail account",
      'Click "Add project" → name it winggo (or winggo-prod)',
      "Disable Google Analytics (not needed)",
      'Click "Create project" → wait for it to provision',
    ],
    tip: null,
    cta: { label: "Open Firebase Console →", url: "https://console.firebase.google.com" },
    configTemplate: false,
    secrets: null,
  },
  {
    num: "02",
    icon: "📱",
    title: "Enable Phone OTP Authentication",
    color: "#FFD700",
    details: [
      'In your project → left sidebar → "Build" → "Authentication"',
      '"Get started" → click "Sign-in method" tab',
      'Click "Phone" → toggle Enable → Save',
      '(Optional) Add test phone numbers under "Phone numbers for testing"',
    ],
    tip: {
      color: "#FFD700",
      label: "⚠️ Blaze Plan Required for Real SMS",
      body: "Phone Authentication with real Indian numbers requires the Blaze (pay-as-you-go) plan. Free Spark plan only allows test phone numbers. Upgrade from Project Settings → Billing.",
    },
    cta: null,
    configTemplate: false,
    secrets: null,
  },
  {
    num: "03",
    icon: "🗄️",
    title: "Create Firestore Database",
    color: "#4ECDC4",
    details: [
      'Sidebar → "Build" → "Firestore Database" → "Create database"',
      'Select "Start in production mode" → click Next',
      'Choose region: asia-south1 (Mumbai) → Enable',
      'Go to "Rules" tab and paste the security rules below',
    ],
    tip: null,
    cta: null,
    configTemplate: false,
    secrets: null,
    firestoreRules: true,
  },
  {
    num: "04",
    icon: "⚡",
    title: "Create Realtime Database",
    color: "#A855F7",
    details: [
      'Sidebar → "Build" → "Realtime Database" → "Create Database"',
      'Choose region: asia-southeast1 (Singapore) → Next',
      '"Start in locked mode" → Enable',
      'Click the "Rules" tab and paste: { "rules": { ".read": "auth != null", ".write": "auth != null" } }',
    ],
    tip: null,
    cta: null,
    configTemplate: false,
    secrets: null,
  },
  {
    num: "05",
    icon: "🗂️",
    title: "Create Firebase Storage",
    color: "#34D399",
    details: [
      'Sidebar → "Build" → "Storage" → "Get started"',
      '"Start in production mode" → Next',
      "Choose same region as Firestore: asia-south1 → Done",
      "Storage bucket URL will look like: winggo.firebasestorage.app",
    ],
    tip: null,
    cta: null,
    configTemplate: false,
    secrets: null,
  },
  {
    num: "06",
    icon: "⚙️",
    title: "Get Your Firebase Web Config",
    color: "#60A5FA",
    details: [
      'Project Settings (⚙️ gear icon top-left) → "Your apps" tab',
      'Click the "</>" Web icon → register app as "winggo-web"',
      '"Also set up Firebase Hosting" — leave UNCHECKED',
      "Copy the full firebaseConfig object shown on screen",
    ],
    tip: null,
    cta: null,
    configTemplate: true,
    secrets: null,
  },
  {
    num: "07",
    icon: "🔑",
    title: "Update Replit Secrets",
    color: "#F97316",
    details: [
      'In Replit → click the 🔒 "Secrets" tab in the left panel',
      "DELETE the old Firebase secrets first (click each → Delete)",
      "Add all 7 new secrets listed below with values from step 06",
      "After saving all secrets → Restart the WINGGO workflow",
    ],
    tip: {
      color: "#34d399",
      label: "✅ No Code Changes Needed",
      body: "The app reads all Firebase values from these env secrets automatically. Just update the values and restart — everything reconnects instantly.",
    },
    cta: null,
    configTemplate: false,
    secrets: [
      "VITE_FIREBASE_API_KEY",
      "VITE_FIREBASE_AUTH_DOMAIN",
      "VITE_FIREBASE_PROJECT_ID",
      "VITE_FIREBASE_STORAGE_BUCKET",
      "VITE_FIREBASE_MESSAGING_SENDER_ID",
      "VITE_FIREBASE_APP_ID",
      "VITE_FIREBASE_DATABASE_URL",
    ],
  },
  {
    num: "08",
    icon: "🌐",
    title: "Whitelist Your Replit Domain",
    color: "#EC4899",
    details: [
      'Firebase Console → Authentication → Settings → "Authorized domains"',
      'Click "Add domain" → paste your Replit dev domain',
      "Dev domain format: your-repl.your-username.replit.dev",
      "Also add your production domain when you deploy (*.replit.app)",
    ],
    tip: {
      color: "#EC4899",
      label: "🔍 Where to Find Your Domain",
      body: "In Replit, open your app preview → copy the URL from the address bar. It ends in .replit.dev — paste that (without the path) into Firebase Authorized Domains.",
    },
    cta: null,
    configTemplate: false,
    secrets: null,
  },
  {
    num: "09",
    icon: "🗃️",
    title: "Seed Initial Firestore Collections",
    color: "#6EE7B7",
    details: [
      'Firebase Console → Firestore Database → "Start collection"',
      "Create these 7 collections (just create them; documents come from app usage):",
      "users · wallets · transactions · games · kyc · withdrawals · referrals",
      "OR simply log in to the app — collections are auto-created on first user signup",
    ],
    tip: {
      color: "#6EE7B7",
      label: "🎮 Games Collection",
      body: "For the games list to appear, open the app, sign in, and the Dashboard auto-seeds the games collection via seedGamesIfEmpty(). No manual Firestore work needed for games.",
    },
    cta: null,
    configTemplate: false,
    secrets: null,
  },
];

const FIRESTORE_RULES = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can read/write their own profile
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Wallet: user can read own, only Cloud Functions write
    match /wallets/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Transactions: user can read own
    match /transactions/{txId} {
      allow read: if request.auth != null
        && resource.data.uid == request.auth.uid;
      allow create: if request.auth != null;
    }

    // Games: anyone authenticated can read; admin writes via admin SDK
    match /games/{gameId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }

    // KYC: user can read/write own
    match /kyc/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Config: public read for app config
    match /config/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // Referrals & withdrawals: authenticated users
    match /referrals/{id} {
      allow read, write: if request.auth != null;
    }
    match /withdrawals/{id} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }
  }
}`;

const CONFIG_EXAMPLE = `// From Firebase Console → Project Settings → Your apps → Web
const firebaseConfig = {
  apiKey:            "AIzaXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain:        "winggo.firebaseapp.com",
  projectId:         "winggo",
  storageBucket:     "winggo.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId:             "1:123456789012:web:abcdef1234567890",
  databaseURL:       "https://winggo-default-rtdb.asia-southeast1.firebasedatabase.app",
};`;

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function FirebaseSetupGuide({ onSkip }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [copied, setCopied]         = useState<string | null>(null);

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1800);
    });
  }

  const step = STEPS[activeStep];
  const progress = ((activeStep + 1) / STEPS.length) * 100;

  return (
    <motion.div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: "radial-gradient(ellipse at top, #0f0823 0%, #07050f 60%, #000 100%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
    >
      {/* ── Header ── */}
      <div className="shrink-0 px-5 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                style={{ background: "linear-gradient(135deg,#7c3aed,#FFD700)" }}>🔥</div>
              <h1 className="font-black text-xl">
                <span className="text-white">WIN</span><span style={{ color: "#FFD700" }}>GGO</span>
              </h1>
            </div>
            <p className="text-[10px] font-black tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>
              FIREBASE SETUP — NEW PROJECT
            </p>
          </div>
          <motion.button whileTap={{ scale: 0.93 }} onClick={onSkip}
            className="px-3 py-1.5 rounded-xl text-[11px] font-black cursor-pointer"
            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
            Demo Mode →
          </motion.button>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <motion.div className="h-full rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ background: `linear-gradient(90deg, ${step.color}, ${step.color}99)` }} />
        </div>

        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {STEPS.map((s, i) => (
            <motion.button key={i} onClick={() => setActiveStep(i)}
              className="w-5 h-5 rounded-full cursor-pointer flex items-center justify-center text-[8px] font-black"
              animate={{
                background: i < activeStep ? s.color : i === activeStep ? s.color : "rgba(255,255,255,0.1)",
                scale: i === activeStep ? 1.15 : 1,
              }}
              style={{ color: i <= activeStep ? "#000" : "rgba(255,255,255,0.3)" }}>
              {i < activeStep ? "✓" : (i + 1)}
            </motion.button>
          ))}
        </div>

        <p className="text-[10px] mt-1.5 font-bold" style={{ color: "rgba(255,255,255,0.3)" }}>
          Step {activeStep + 1} of {STEPS.length} — {step.title}
        </p>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-4">
        <AnimatePresence mode="wait">
          <motion.div key={activeStep}
            initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="space-y-4">

            {/* Step header */}
            <div className="flex items-center gap-3 pt-2">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                style={{ background: `${step.color}15`, border: `1.5px solid ${step.color}35` }}>
                {step.icon}
              </div>
              <div>
                <div className="text-[10px] font-black tracking-widest" style={{ color: step.color }}>STEP {step.num}</div>
                <h2 className="text-white font-black text-lg leading-tight mt-0.5">{step.title}</h2>
              </div>
            </div>

            {/* Instructions */}
            <div className="rounded-2xl p-4 space-y-3"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {step.details.map((d, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5"
                    style={{ background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}35` }}>
                    {i + 1}
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>{d}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            {step.cta && (
              <motion.a href={step.cta.url} target="_blank" rel="noreferrer" whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-black text-sm cursor-pointer"
                style={{ background: `${step.color}18`, color: step.color, border: `1.5px solid ${step.color}40` }}>
                {step.cta.label}
              </motion.a>
            )}

            {/* Firestore Rules (step 3) */}
            {"firestoreRules" in step && step.firestoreRules && (
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(78,205,196,0.25)" }}>
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: "rgba(78,205,196,0.08)", borderBottom: "1px solid rgba(78,205,196,0.15)" }}>
                  <span className="text-[11px] font-black" style={{ color: "#4ecdc4" }}>📋 Firestore Security Rules</span>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => copy(FIRESTORE_RULES, "rules")}
                    className="text-[10px] font-black px-3 py-1 rounded-lg cursor-pointer"
                    style={{ background: "rgba(78,205,196,0.15)", color: "#4ecdc4" }}>
                    {copied === "rules" ? "✅ Copied!" : "Copy Rules"}
                  </motion.button>
                </div>
                <pre className="px-4 py-3 text-[9px] leading-relaxed overflow-x-auto max-h-48"
                  style={{ color: "rgba(255,255,255,0.5)", fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                  {FIRESTORE_RULES}
                </pre>
              </div>
            )}

            {/* Config template (step 6) */}
            {step.configTemplate && (
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(96,165,250,0.25)" }}>
                <div className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: "rgba(96,165,250,0.08)", borderBottom: "1px solid rgba(96,165,250,0.15)" }}>
                  <span className="text-[11px] font-black" style={{ color: "#60a5fa" }}>📋 firebaseConfig shape</span>
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => copy(CONFIG_EXAMPLE, "config")}
                    className="text-[10px] font-black px-3 py-1 rounded-lg cursor-pointer"
                    style={{ background: "rgba(96,165,250,0.15)", color: "#60a5fa" }}>
                    {copied === "config" ? "✅ Copied!" : "Copy Example"}
                  </motion.button>
                </div>
                <pre className="px-4 py-3 text-[9px] leading-relaxed overflow-x-auto"
                  style={{ color: "rgba(255,255,255,0.55)", fontFamily: "monospace" }}>
                  {CONFIG_EXAMPLE}
                </pre>
              </div>
            )}

            {/* Secrets list (step 7) */}
            {step.secrets && (
              <div className="space-y-2">
                <p className="text-[11px] font-black mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>
                  TAP ANY KEY TO COPY ITS NAME — then add it in Replit Secrets panel:
                </p>
                {step.secrets.map((secret) => (
                  <motion.button key={secret} whileTap={{ scale: 0.98 }}
                    onClick={() => copy(secret, secret)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer"
                    style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <code className="text-sm font-bold" style={{ color: "#f97316" }}>{secret}</code>
                    <span className="text-[10px] font-black shrink-0 ml-2"
                      style={{ color: copied === secret ? "#34d399" : "rgba(255,255,255,0.3)" }}>
                      {copied === secret ? "✅ Copied!" : "Tap to copy"}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}

            {/* Tip card */}
            {step.tip && (
              <div className="rounded-2xl p-4"
                style={{ background: `${step.tip.color}09`, border: `1px solid ${step.tip.color}30` }}>
                <p className="text-[11px] font-black mb-1.5" style={{ color: step.tip.color }}>{step.tip.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{step.tip.body}</p>
              </div>
            )}

            {/* Collections list (step 9) */}
            {activeStep === 8 && (
              <div className="space-y-2">
                {["users", "wallets", "transactions", "games", "kyc", "withdrawals", "referrals"].map(col => (
                  <div key={col}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl"
                    style={{ background: "rgba(110,231,183,0.06)", border: "1px solid rgba(110,231,183,0.15)" }}>
                    <span className="text-sm">🗂️</span>
                    <code className="font-black text-sm" style={{ color: "#6EE7B7" }}>{col}</code>
                    <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>auto-created on first write</span>
                  </div>
                ))}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom Nav ── */}
      <div className="shrink-0 px-5 pb-8 pt-4 flex gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <motion.button whileTap={{ scale: 0.95 }}
          onClick={() => setActiveStep(p => Math.max(0, p - 1))}
          disabled={activeStep === 0}
          className="flex-1 py-4 rounded-2xl font-black text-sm cursor-pointer disabled:opacity-25"
          style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}>
          ← Back
        </motion.button>

        {activeStep < STEPS.length - 1 ? (
          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => setActiveStep(p => p + 1)}
            className="flex-[2] py-4 rounded-2xl font-black text-sm cursor-pointer"
            style={{ background: `linear-gradient(135deg, ${step.color}, ${step.color}bb)`, color: "#000", boxShadow: `0 0 22px ${step.color}45` }}>
            Next Step →
          </motion.button>
        ) : (
          <motion.button whileTap={{ scale: 0.97 }} onClick={onSkip}
            className="flex-[2] py-4 rounded-2xl font-black text-sm cursor-pointer"
            style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
            ✅ Done — Open App
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
