import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { WalletProvider } from "@/context/WalletContext";
import SplashScreen from "@/pages/SplashScreen";
import LoginScreen from "@/pages/LoginScreen";
import Dashboard from "@/pages/Dashboard";
import SpinWheel from "@/pages/SpinWheel";
import LudoGame from "@/pages/LudoGame";
import WorldWarGame from "@/pages/WorldWarGame";
import ReferEarn from "@/pages/ReferEarn";
import WalletScreen from "@/pages/WalletScreen";
import ProfileScreen from "@/pages/ProfileScreen";
import KYCScreen from "@/pages/KYCScreen";
import LeaderboardScreen from "@/pages/LeaderboardScreen";
import FirebaseSetupGuide from "@/pages/FirebaseSetupGuide";
import BottomNav, { SCREENS_WITH_NAV } from "@/components/BottomNav";
import { subscribeAppConfig, AppConfig, DEFAULT_APP_CONFIG } from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

const queryClient = new QueryClient();

type Screen =
  | "splash" | "login" | "dashboard"
  | "spinwheel" | "ludo" | "worldwar"
  | "refer" | "wallet" | "profile" | "kyc" | "leaderboard";

// ── Inner app — has access to AuthContext ─────────────────────────────────────
function AppInner() {
  const { login } = useAuth();
  const [screen, setScreen]         = useState<Screen>("splash");
  const [splashDone, setSplash]     = useState(false);
  const [appConfig, setAppConfig]   = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [showSetup, setShowSetup]   = useState(!FIREBASE_ENABLED);

  // Subscribe to remote app config (maintenance mode, force update, announcements)
  useEffect(() => {
    return subscribeAppConfig(setAppConfig);
  }, []);

  // Splash auto-advance
  if (!splashDone && screen === "splash") {
    setTimeout(() => { setSplash(true); setScreen("login"); }, 3000);
  }

  async function handleLogin(uid: string, phone: string, isNewUser?: boolean) {
    await login(uid, phone, isNewUser);
    setScreen("dashboard");
  }

  // Show setup guide when Firebase isn't configured (can be dismissed to demo mode)
  if (showSetup) {
    return <FirebaseSetupGuide onSkip={() => setShowSetup(false)} />;
  }

  return (
    <WalletProvider>
      {/* ── Maintenance Mode Overlay ── */}
      <AnimatePresence>
        {appConfig.maintenanceMode && (
          <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-center px-6"
            style={{ background: "rgba(7,5,16,0.97)", backdropFilter: "blur(20px)", maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <span className="text-6xl">🔧</span>
            </motion.div>
            <h2 className="text-white font-black text-2xl mt-5">Under Maintenance</h2>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              We're upgrading the platform for a better experience. Back shortly!
            </p>
            <div className="mt-6 px-5 py-3 rounded-2xl text-xs font-bold"
              style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "#FFD700" }}>
              🕐 Expected back in ~30 minutes
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Force Update Overlay ── */}
      <AnimatePresence>
        {appConfig.forceUpdateVersion && appConfig.forceUpdateVersion !== "1.0.0" && !appConfig.maintenanceMode && (
          <motion.div
            className="fixed inset-0 z-[9998] flex flex-col items-center justify-center text-center px-6"
            style={{ background: "rgba(7,5,16,0.97)", backdropFilter: "blur(20px)", maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <span className="text-6xl">🚀</span>
            <h2 className="text-white font-black text-2xl mt-5">New Version Available</h2>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Version {appConfig.forceUpdateVersion} is out with exciting new features and improvements.
            </p>
            <motion.a href="https://play.google.com/store" target="_blank" rel="noreferrer"
              whileTap={{ scale: 0.96 }}
              className="mt-6 w-full py-4 rounded-2xl font-black text-base cursor-pointer block"
              style={{ background: "linear-gradient(135deg, #FFD700, #ff8c00)", color: "#000", boxShadow: "0 0 30px rgba(255,215,0,0.4)" }}>
              ⬇️ Update Now
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {screen === "splash" && <SplashScreen key="splash" />}

        {screen === "login" && (
          <LoginScreen key="login" onLogin={handleLogin} />
        )}

        {screen === "dashboard" && (
          <Dashboard
            key="dashboard"
            appConfig={appConfig}
            onSpin={() => setScreen("spinwheel")}
            onLudo={() => setScreen("ludo")}
            onWorldWar={() => setScreen("worldwar")}
            onWallet={() => setScreen("wallet")}
            onLeaderboard={() => setScreen("leaderboard")}
          />
        )}

        {screen === "spinwheel" && (
          <SpinWheel key="spinwheel" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "ludo" && (
          <LudoGame key="ludo" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "worldwar" && (
          <WorldWarGame key="worldwar" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "leaderboard" && (
          <LeaderboardScreen key="leaderboard" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "refer" && (
          <ReferEarn key="refer" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "wallet" && (
          <WalletScreen key="wallet" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "profile" && (
          <ProfileScreen
            key="profile"
            onKYC={() => setScreen("kyc")}
            onRefer={() => setScreen("refer")}
            onWallet={() => setScreen("wallet")}
            onLogout={() => setScreen("login")}
          />
        )}

        {screen === "kyc" && (
          <KYCScreen key="kyc" onBack={() => setScreen("profile")} />
        )}
      </AnimatePresence>

      {/* Persistent bottom nav */}
      {SCREENS_WITH_NAV.includes(screen) && !appConfig.maintenanceMode && (
        <BottomNav
          activeScreen={screen}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}

      <Toaster />
    </WalletProvider>
  );
}

// ── Root — provides Auth → Wallet inherits uid ────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
