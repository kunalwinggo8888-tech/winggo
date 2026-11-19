/**
 * WelcomeAvatarScreen — one-time first-login onboarding (new users only).
 *
 * Shown right after the login transition when a user signs up for the first
 * time (isNewUser=true). The user picks one of four gaming-style cartoon
 * avatars; the choice is saved to users/{uid}.photoURL (the app-wide avatar
 * field) together with onboardingCompleted=true. Existing provider photos
 * (Facebook/Google) are only replaced when the user actively picks an avatar
 * and presses Continue.
 *
 * Never shown to old users: their profiles don't carry the onboarding flags,
 * and the linking flow treats them as returning users (isNewUser=false).
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { updateProfile as fbUpdateProfile } from "firebase/auth";
import { auth } from "@/firebase/config";
import { useAuth } from "@/context/useAuth";

const AVATARS = [
  { id: "ninja", name: "Ninja",  src: "/avatars/avatar-ninja.svg",  glow: "rgba(139,92,246,0.55)"  },
  { id: "robot", name: "Robot",  src: "/avatars/avatar-robot.svg",  glow: "rgba(56,189,248,0.55)"  },
  { id: "panda", name: "Panda",  src: "/avatars/avatar-panda.svg",  glow: "rgba(52,211,153,0.55)"  },
  { id: "fox",   name: "Fox",    src: "/avatars/avatar-fox.svg",    glow: "rgba(249,115,22,0.55)"  },
];

type SaveState = "idle" | "saving" | "success" | "error";

export default function WelcomeAvatarScreen({ onComplete }: { onComplete: () => void }) {
  const { user, updateProfile } = useAuth();
  const [selected, setSelected]   = useState<string | null>(null);
  const [state, setState]         = useState<SaveState>("idle");

  // Mark onboarding as started so an abandoned first-login resumes here
  // instead of dropping straight to the dashboard (fire-and-forget).
  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      updateProfile({ onboardingStarted: true }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = (user?.displayName || "").trim().split(/\s+/)[0] || "Player";

  async function handleContinue() {
    const avatar = AVATARS.find(a => a.id === selected);
    if (!avatar || !user || state === "saving") return;
    setState("saving");
    try {
      // Auth-level photo so the fast-path (before Firestore hydrate) shows it
      if (auth?.currentUser) {
        await fbUpdateProfile(auth.currentUser, { photoURL: avatar.src }).catch(() => {});
      }
      // Firestore: users/{uid}.photoURL + onboardingCompleted (onSnapshot
      // refreshes the avatar everywhere: Dashboard, Profile, Leaderboard…)
      await updateProfile({ photoURL: avatar.src, onboardingCompleted: true });
      setState("success");
      setTimeout(onComplete, 900);
    } catch {
      setState("error");
    }
  }

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #0f0a1e 0%, #07050f 60%, #000000 100%)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
    >
      {/* Ambient glows (same language as LoginScreen) */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)" }} />

      <div className="w-full max-w-md relative z-10">

        {/* Heading */}
        <motion.div className="text-center mb-6"
          initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>
          <motion.div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", boxShadow: "0 0 34px rgba(255,215,0,0.45)" }}
            animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}>
            🎉
          </motion.div>
          <h1 className="font-black tracking-tight text-2xl sm:text-3xl">
            <span className="text-white">Welcome to </span>
            <span style={{ color: "#FFD700", textShadow: "0 0 14px rgba(255,215,0,0.6)" }}>Winggo!</span>
          </h1>
          <p className="text-sm mt-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span className="font-bold text-white">{firstName}</span> — Winggo परिवार में आपका हार्दिक स्वागत है। हमारे साथ जुड़ने के लिए धन्यवाद!
          </p>
        </motion.div>

        {/* Avatar picker card */}
        <motion.div
          initial={{ opacity: 0, y: 22, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,215,0,0.15)",
            borderRadius: "24px",
            boxShadow: "0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
            padding: "26px 20px 24px",
          }}>
          <p className="text-center text-sm font-black tracking-wide uppercase mb-5"
            style={{ color: "rgba(255,215,0,0.75)" }}>
            अपना Avatar चुनें
          </p>

          {/* 4 avatars — 2×2 on mobile, one row on wider screens */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-3">
            {AVATARS.map((a, i) => {
              const isSel = selected === a.id;
              return (
                <motion.button
                  key={a.id}
                  type="button"
                  onClick={() => { if (state === "idle" || state === "error") setSelected(a.id); }}
                  disabled={state === "saving" || state === "success"}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08, type: "spring", stiffness: 260, damping: 18 }}
                  whileHover={{ scale: 1.06, y: -4 }}
                  whileTap={{ scale: 0.94 }}
                  className="relative rounded-3xl cursor-pointer disabled:cursor-default outline-none"
                  style={{
                    padding: 6,
                    border: isSel ? "2.5px solid #FFD700" : "2px solid rgba(255,255,255,0.09)",
                    background: isSel ? "rgba(255,215,0,0.08)" : "rgba(255,255,255,0.03)",
                    boxShadow: isSel ? `0 0 26px ${a.glow}` : "none",
                    transition: "box-shadow .25s, background .25s",
                  }}
                  aria-pressed={isSel}
                  aria-label={`Avatar ${a.name}`}
                >
                  <img
                    src={a.src}
                    alt={a.name}
                    draggable={false}
                    className="w-full aspect-square rounded-2xl object-cover select-none pointer-events-none"
                  />
                  {/* name tag */}
                  <div className="text-center pt-1.5 pb-0.5">
                    <span className="text-[11px] font-black tracking-wider uppercase"
                      style={{ color: isSel ? "#FFD700" : "rgba(255,255,255,0.4)" }}>
                      {a.name}
                    </span>
                  </div>
                  {/* checkmark badge */}
                  <AnimatePresence>
                    {isSel && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 400, damping: 16 }}
                        className="absolute -top-1.5 -right-1.5 flex items-center justify-center rounded-full"
                        style={{ width: 26, height: 26, background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "2px solid #07050f", boxShadow: "0 0 14px rgba(34,197,94,0.6)" }}>
                        <span className="text-white text-sm font-black leading-none">✓</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>

          {/* Error state */}
          {state === "error" && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl mt-4"
              style={{ background: "rgba(231,76,60,0.08)", border: "1px solid rgba(231,76,60,0.25)" }}>
              <span>⚠️</span>
              <p className="text-xs font-semibold flex-1" style={{ color: "#e74c3c" }}>
                Avatar save नहीं हो पाया — internet check करके फिर try करें।
              </p>
            </motion.div>
          )}

          {/* Continue */}
          <motion.button
            type="button"
            onClick={handleContinue}
            disabled={!selected || state === "saving" || state === "success"}
            className="w-full py-3.5 mt-5 font-black text-base text-black rounded-2xl tracking-wide cursor-pointer disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#FFD700 0%,#ff8c00 100%)", boxShadow: "0 0 28px rgba(255,215,0,0.35), 0 4px 20px rgba(0,0,0,0.4)" }}
            whileHover={selected ? { scale: 1.02 } : {}} whileTap={selected ? { scale: 0.97 } : {}}>
            {state === "saving" ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span className="inline-block w-4 h-4 rounded-full border-2 border-black border-t-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }} />
                Saving your avatar…
              </span>
            ) : state === "success" ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 350, damping: 14 }}>
                  ✅
                </motion.span>
                Avatar saved! खेल शुरू करें…
              </span>
            ) : (
              "CONTINUE →"
            )}
          </motion.button>
        </motion.div>
      </div>
    </motion.div>
  );
}
