import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { getPendingReferral, trackReferralInstall } from "@/firebase/referral.service";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * PwaUpdater — two responsibilities:
 *
 * 1) NEW VERSION DETECTION — Works with vite-plugin-pwa (registerType: "prompt").
 *    When a fresh build is published (GitHub push + Vercel deploy) the service
 *    worker detects it, we show a "New Update Available" popup, and tapping
 *    "Update Now" downloads the new build + assets and auto-reloads — all inside
 *    the app (no redirect to GitHub/browser/store).
 *
 * 2) INSTALL PROMPT — Listens for beforeinstallprompt and shows a floating
 *    "Install App" pill. Hidden once the app is running standalone (installed).
 */
export default function PwaUpdater() {
  // NOTE: vite-plugin-pwa@1.3.0 returns needRefresh/offlineReady as tuples
  // [state, setter] (not plain booleans). Destructure the boolean values.
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const matchMedia = window.matchMedia?.("(display-mode: standalone)");
    const check = () => {
      setIsInstalled(
        Boolean(matchMedia?.matches) ||
          Boolean(window.matchMedia && window.matchMedia("(display-mode: fullscreen)").matches) ||
          Boolean((window.navigator as unknown as { standalone?: boolean }).standalone),
      );
    };
    check();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setInstallEvt(null);
      deferredRef.current = null;
      // If this install follows a referral link, count the install
      const ref = getPendingReferral();
      if (ref) trackReferralInstall(ref).catch(() => {});
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("resize", check);
    };
  }, []);

  const handleInstall = async () => {
    const evt = deferredRef.current || installEvt;
    if (!evt) return;
    evt.prompt();
    await evt.userChoice.catch(() => undefined);
    setInstallEvt(null);
    deferredRef.current = null;
  };

  const showInstall = !isInstalled && installEvt !== null;

  const handleUpdate = async () => {
    // Dismiss the popup immediately so it never lingers/re-fires on this view,
    // then activate the waiting service worker (skipWaiting -> control -> reload).
    setNeedRefresh(false);
    await updateServiceWorker();
  };

  return (
    <>
      {/* ── New Update Available popup ── */}
      <AnimatePresence>
        {needRefresh && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-end justify-center px-5 pb-6 sm:items-center sm:pb-0"
            style={{ maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0" style={{ background: "rgba(7,5,16,0.72)", backdropFilter: "blur(4px)" }} />
            <motion.div
              className="relative w-full rounded-3xl p-5"
              style={{
                background: "linear-gradient(160deg,#1a1030 0%,#0b0816 100%)",
                border: "1px solid rgba(255,215,0,0.25)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
              }}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center text-2xl"
                  style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)" }}>
                  🚀
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-white text-base">New Update Available</div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                    A new version of Winggo is ready. Update now for the latest features and fixes.
                  </p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleUpdate()}
                className="mt-4 w-full py-3.5 rounded-2xl font-black text-base cursor-pointer"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 30px rgba(255,215,0,0.4)" }}
              >
                ⬇️ Update Now
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Offline-ready toast ── */}
      <AnimatePresence>
        {offlineReady && (
          <motion.div
            className="fixed z-[70] px-4 py-2.5 rounded-2xl left-1/2 -translate-x-1/2 top-4 text-xs font-bold text-center"
            style={{ background: "rgba(39,174,96,0.15)", border: "1px solid rgba(39,174,96,0.4)", color: "#27ae60", maxWidth: "90%" }}
            initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }}
          >
            ✅ App ready to work offline
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Install App banner button ── */}
      <AnimatePresence>
        {showInstall && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleInstall}
            className="fixed z-[60] flex items-center gap-2 px-4 py-2.5 rounded-full font-black text-sm cursor-pointer"
            style={{
              left: "50%", transform: "translateX(-50%)",
              bottom: 82,
              background: "linear-gradient(135deg,#FFD700,#ff8c00)",
              color: "#000",
              boxShadow: "0 8px 30px rgba(255,215,0,0.45)",
              maxWidth: "90%",
            }}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
          >
            <span className="text-lg">📲</span> Install Winggo App
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}