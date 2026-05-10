import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/pages/SplashScreen";
import LoginScreen from "@/pages/LoginScreen";
import Dashboard from "@/pages/Dashboard";
import SpinWheel from "@/pages/SpinWheel";
import LudoGame from "@/pages/LudoGame";
import WorldWarGame from "@/pages/WorldWarGame";

const queryClient = new QueryClient();

type Screen = "splash" | "login" | "dashboard" | "spinwheel" | "ludo" | "worldwar";

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
        </AnimatePresence>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
