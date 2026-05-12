import { useState, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { WalletProvider } from "@/context/WalletContext";
import WelcomeBonusModal from "@/components/WelcomeBonusModal";
import LoginTransitionScreen from "@/components/LoginTransitionScreen";
import SplashScreen from "@/pages/SplashScreen";
import LoginScreen from "@/pages/LoginScreen";
import Dashboard from "@/pages/Dashboard";
import SpinWheel from "@/pages/SpinWheel";
import LudoGame from "@/pages/LudoGame";
import WorldWarGame from "@/pages/WorldWarGame";
import SnakesGame from "@/pages/SnakesGame";
import CarromGame from "@/pages/CarromGame";
import BubbleGame from "@/pages/BubbleGame";
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
  | "splash" | "login" | "transition" | "dashboard"
  | "spinwheel" | "ludo" | "worldwar" | "snakes" | "carrom" | "bubble"
  | "refer" | "wallet" | "profile" | "kyc" | "leaderboard";

// ── Inner app — has access to AuthContext ─────────────────────────────────────
function AppInner() {
  const { user, loading, login, logout } = useAuth();

  const [screen, setScreen]           = useState<Screen>("splash");
  const [splashDone, setSplashDone]   = useState(false);
  const [appConfig, setAppConfig]     = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [showSetup, setShowSetup]     = useState(!FIREBASE_ENABLED);
  const [showWelcome, setShowWelcome] = useState(false);
  const [ludoFee, setLudoFee]         = useState(50);
  const [worldWarFee, setWorldWarFee] = useState<number | undefined>(undefined);
  const [snakesFee, setSnakesFee]     = useState(10);
  const [carromFee, setCarromFee]     = useState(10);
  const [bubbleFee, setBubbleFee]     = useState(10);
  const [newUserName, setNewUserName] = useState("");

  // Track whether the pending login was a new user signup
  const pendingIsNewUser = useRef(false);

  // Subscribe to remote app config
  useEffect(() => {
    return subscribeAppConfig(setAppConfig);
  }, []);

  // Splash auto-advance (3s)
  useEffect(() => {
    if (screen !== "splash") return;
    const t = setTimeout(() => {
      setSplashDone(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [screen]);

  /**
   * After splash finishes AND Firebase auth check resolves:
   * - Already logged in → go straight to dashboard (no login screen!)
   * - Not logged in     → show login screen
   *
   * Firebase Auth persists sessions in IndexedDB automatically — users
   * only see the login screen if they have never logged in or after logout.
   */
  useEffect(() => {
    if (!splashDone) return;      // still showing splash
    if (screen !== "splash") return; // already navigated

    if (FIREBASE_ENABLED && loading) return; // still resolving Firebase auth state

    if (user) {
      // User already authenticated — skip login entirely
      setScreen("dashboard");
    } else {
      setScreen("login");
    }
  }, [splashDone, loading, user, screen]);

  // Called by LoginScreen when Firebase Auth succeeds
  function handleLogin(uid: string, email: string, isNewUser?: boolean) {
    login(uid, email, isNewUser);
    pendingIsNewUser.current = !!isNewUser;
    setScreen("transition");
  }

  // Called by LoginTransitionScreen when its animation finishes
  function handleTransitionComplete() {
    setScreen("dashboard");
    if (pendingIsNewUser.current) {
      // Capture display name at transition time so popup can greet by name
      const name = user?.displayName ?? "";
      setNewUserName(name);
      setShowWelcome(true);
      pendingIsNewUser.current = false;
    }
  }

  // Logout — clear auth, go back to login
  async function handleLogout() {
    await logout();
    setScreen("login");
  }

  // Show setup guide when Firebase isn't configured
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
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
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
              Version {appConfig.forceUpdateVersion} is out with exciting new features.
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

        {/* Premium loading transition — shown between login success and dashboard */}
        {screen === "transition" && (
          <LoginTransitionScreen
            key="transition"
            isNewUser={pendingIsNewUser.current}
            onComplete={handleTransitionComplete}
          />
        )}

        {screen === "dashboard" && (
          <Dashboard
            key="dashboard"
            appConfig={appConfig}
            onSpin={() => setScreen("spinwheel")}
            onLudo={(fee) => { setLudoFee(fee ?? 50); setScreen("ludo"); }}
            onWorldWar={(fee) => { setWorldWarFee(fee); setScreen("worldwar"); }}
            onSnakes={(fee) => { setSnakesFee(fee ?? 10); setScreen("snakes"); }}
            onCarrom={(fee) => { setCarromFee(fee ?? 10); setScreen("carrom"); }}
            onBubble={(fee) => { setBubbleFee(fee ?? 10); setScreen("bubble"); }}
            onWallet={() => setScreen("wallet")}
            onLeaderboard={() => setScreen("leaderboard")}
          />
        )}

        {screen === "spinwheel" && (
          <SpinWheel key="spinwheel" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "ludo" && (
          <LudoGame key="ludo" onBack={() => setScreen("dashboard")} initialFee={ludoFee} />
        )}

        {screen === "worldwar" && (
          <WorldWarGame key="worldwar" onBack={() => setScreen("dashboard")} initialFee={worldWarFee} />
        )}

        {screen === "snakes" && (
          <SnakesGame key="snakes" onBack={() => setScreen("dashboard")} initialFee={snakesFee} />
        )}

        {screen === "carrom" && (
          <CarromGame key="carrom" onBack={() => setScreen("dashboard")} initialFee={carromFee} />
        )}

        {screen === "bubble" && (
          <BubbleGame key="bubble" onBack={() => setScreen("dashboard")} initialFee={bubbleFee} />
        )}

        {screen === "leaderboard" && (
          <LeaderboardScreen key="leaderboard" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "refer" && (
          <ReferEarn key="refer" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "wallet" && (
          <WalletScreen
            key="wallet"
            onBack={() => setScreen("dashboard")}
            onNavigate={(s) => setScreen(s as Screen)}
          />
        )}

        {screen === "profile" && (
          <ProfileScreen
            key="profile"
            onKYC={() => setScreen("kyc")}
            onRefer={() => setScreen("refer")}
            onWallet={() => setScreen("wallet")}
            onLogout={handleLogout}
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

      {/* Welcome bonus popup — shown once after new user signup */}
      <WelcomeBonusModal
        visible={showWelcome}
        onClose={() => { setShowWelcome(false); setNewUserName(""); }}
        displayName={newUserName}
      />

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
