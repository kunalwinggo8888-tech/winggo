import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import { WalletProvider } from "@/context/WalletContext";
import SplashScreen from "@/pages/SplashScreen";
import LoginScreen from "@/pages/LoginScreen";
import Dashboard from "@/pages/Dashboard";
import SpinWheel from "@/pages/SpinWheel";
import LudoGame from "@/pages/LudoGame";
import WorldWarGame from "@/pages/WorldWarGame";
import ReferEarn from "@/pages/ReferEarn";
import WalletScreen from "@/pages/WalletScreen";

const queryClient = new QueryClient();

type Screen = "splash" | "login" | "dashboard" | "spinwheel" | "ludo" | "worldwar" | "refer" | "wallet";

function App() {
  const [screen, setScreen] = useState<Screen>("splash");

  useEffect(() => {
    document.documentElement.classList.add("dark");
    const timer = setTimeout(() => setScreen("login"), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WalletProvider>
          <AnimatePresence mode="wait">
            {screen === "splash" && (
              <SplashScreen key="splash" />
            )}
            {screen === "login" && (
              <LoginScreen key="login" onLogin={() => setScreen("dashboard")} />
            )}
            {screen === "dashboard" && (
              <Dashboard
                key="dashboard"
                onSpin={() => setScreen("spinwheel")}
                onLudo={() => setScreen("ludo")}
                onWorldWar={() => setScreen("worldwar")}
                onRefer={() => setScreen("refer")}
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
          </AnimatePresence>
          <Toaster />
        </WalletProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
