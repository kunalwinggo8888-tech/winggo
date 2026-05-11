import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/context/AuthContext";
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
import BottomNav, { SCREENS_WITH_NAV } from "@/components/BottomNav";

const queryClient = new QueryClient();

type Screen =
  | "splash" | "login" | "dashboard"
  | "spinwheel" | "ludo" | "worldwar"
  | "refer" | "wallet" | "profile" | "kyc";

// ── Inner app — has access to AuthContext ─────────────────────────────────────
function AppInner() {
  const { login } = useAuth();
  const [screen, setScreen]     = useState<Screen>("splash");
  const [splashDone, setSplash] = useState(false);

  // Splash auto-advance
  if (!splashDone && screen === "splash") {
    setTimeout(() => { setSplash(true); setScreen("login"); }, 3000);
  }

  async function handleLogin(uid: string, phone: string, isNewUser?: boolean) {
    await login(uid, phone, isNewUser);
    setScreen("dashboard");
  }

  return (
    <WalletProvider>
      <AnimatePresence mode="wait">
        {screen === "splash" && <SplashScreen key="splash" />}

        {screen === "login" && (
          <LoginScreen key="login" onLogin={handleLogin} />
        )}

        {screen === "dashboard" && (
          <Dashboard
            key="dashboard"
            onSpin={() => setScreen("spinwheel")}
            onLudo={() => setScreen("ludo")}
            onWorldWar={() => setScreen("worldwar")}
            onWallet={() => setScreen("wallet")}
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
      {SCREENS_WITH_NAV.includes(screen) && (
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
