import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { WalletProvider } from "@/context/WalletContext";
import { MatchHistoryProvider } from "@/context/MatchHistoryContext";
import WelcomeBonusModal from "@/components/WelcomeBonusModal";
import LoginTransitionScreen from "@/components/LoginTransitionScreen";
import SplashScreen from "@/pages/SplashScreen";
import LoginScreen from "@/pages/LoginScreen";
import Dashboard from "@/pages/Dashboard";
import SpinWheel from "@/pages/SpinWheel";
import ReferEarn from "@/pages/ReferEarn";
import WalletScreen from "@/pages/WalletScreen";
import HistoryScreen from "@/pages/HistoryScreen";
import ProfileScreen from "@/pages/ProfileScreen";
import KYCScreen from "@/pages/KYCScreen";
import LeaderboardScreen from "@/pages/LeaderboardScreen";
import NotificationsScreen from "@/pages/NotificationsScreen";
import SupportScreen from "@/pages/SupportScreen";
import TermsScreen from "@/pages/TermsScreen";
import FirebaseSetupGuide from "@/pages/FirebaseSetupGuide";
import BottomNav, { SCREENS_WITH_NAV } from "@/components/BottomNav";
import { subscribeAppConfig, AppConfig, DEFAULT_APP_CONFIG, subscribeAppBanner, AppBannerConfig, DEFAULT_APP_BANNER } from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";
import AppBannerModal from "@/components/AppBannerModal";

// Lazy load game components for better performance
const LudoFastGame = lazy(() => import("@/pages/LudoFastGame"));
const SuperLudoGame = lazy(() => import("@/pages/SuperLudoGame"));
const SaanpSidiGame = lazy(() => import("@/pages/SaanpSidiGame"));
const CarromGame = lazy(() => import("@/pages/CarromGame"));
const BubbleGame = lazy(() => import("@/pages/BubbleGame"));
const CandyGame = lazy(() => import("@/pages/CandyGame"));
const ChessGame = lazy(() => import("@/pages/ChessGame"));
const DiscFootballGame = lazy(() => import("@/pages/DiscFootballGame"));
const RummyGame = lazy(() => import("@/pages/RummyGame"));
const CallBreakGame = lazy(() => import("@/pages/CallBreakGame"));
const PokerGame = lazy(() => import("@/pages/PokerGame"));
const SolitaireGame = lazy(() => import("@/pages/SolitaireGame"));
const Twenty1Game = lazy(() => import("@/pages/Twenty1Game"));
const MetroSurferGame = lazy(() => import("@/pages/MetroSurferGame"));
const KnifeUpGame = lazy(() => import("@/pages/KnifeUpGame"));
const AngryMonstersGame = lazy(() => import("@/pages/AngryMonstersGame"));
const BearRunGame = lazy(() => import("@/pages/BearRunGame"));
const ArcheryGame = lazy(() => import("@/pages/ArcheryGame"));
const BasketballGame = lazy(() => import("@/pages/BasketballGame"));
const PenaltyShootoutGame = lazy(() => import("@/pages/PenaltyShootoutGame"));
const StumpItGame = lazy(() => import("@/pages/StumpItGame"));
const BikeRacingGame = lazy(() => import("@/pages/BikeRacingGame"));
const GearUpGame = lazy(() => import("@/pages/GearUpGame"));
const HillClimberGame = lazy(() => import("@/pages/HillClimberGame"));
const LiquidSortGame = lazy(() => import("@/pages/LiquidSortGame"));
const BottleShootGame = lazy(() => import("@/pages/BottleShootGame"));
const FlyMeGame = lazy(() => import("@/pages/FlyMeGame"));
const StreetFightGame = lazy(() => import("@/pages/StreetFightGame"));
const ShadowFighterGame = lazy(() => import("@/pages/ShadowFighterGame"));
const GolfMasterGame = lazy(() => import("@/pages/GolfMasterGame"));
const ArcheryKingGame = lazy(() => import("@/pages/ArcheryKingGame"));
const TileMatch3DGame = lazy(() => import("@/pages/TileMatch3DGame"));
const PipeConnectGame = lazy(() => import("@/pages/PipeConnectGame"));
const JellyShiftGame = lazy(() => import("@/pages/JellyShiftGame"));
const GoldMinerGame = lazy(() => import("@/pages/GoldMinerGame"));
const AxeMasterGame = lazy(() => import("@/pages/AxeMasterGame"));
const MrRacerGame = lazy(() => import("@/pages/MrRacerGame"));
const BricksBreaker3DGame = lazy(() => import("@/pages/BricksBreaker3DGame"));
const SlapFestGame = lazy(() => import("@/pages/SlapFestGame"));
const FruitChopGame = lazy(() => import("@/pages/FruitChopGame"));
const AlienFusionGame = lazy(() => import("@/pages/AlienFusionGame"));
const Pool3DGame = lazy(() => import("@/pages/Pool3DGame"));
const CricketT20Game = lazy(() => import("@/pages/CricketT20Game"));
const SheepBattleGame = lazy(() => import("@/pages/SheepBattleGame"));
const Hexa2048Game = lazy(() => import("@/pages/Hexa2048Game"));

const queryClient = new QueryClient();

type Screen =
  | "splash" | "login" | "transition" | "dashboard"
  | "spinwheel" | "ludo" | "superludo" | "saanpsidi" | "carrom" | "bubble" | "candy"
  | "chess" | "discfootball" | "rummy" | "callbreak" | "poker" | "solitaire" | "twenty1"
  | "axemaster" | "mrracer" | "bricksbreaker" | "slapfest" | "fruitchop"
  | "alienfusion" | "pool3d" | "crickettd20" | "sheepbattle" | "hexa2048"
  | "metrosurfer" | "knifeup" | "angrymonsters" | "bearrun" | "archery"
  | "basketball" | "penalty" | "stumpit" | "bikeracing" | "gearup" | "hillclimber"
  | "liquidsort" | "bottleshoot" | "flyme"
  | "streetfight" | "shadowfighter" | "golfmaster" | "archeryking"
  | "tilematch3d" | "pipeconnect" | "jellyshift" | "goldminer3d"
  | "refer" | "wallet" | "history" | "profile" | "kyc" | "leaderboard" | "notifications" | "support" | "terms";

// ── Inner app — has access to AuthContext ─────────────────────────────────────
function AppInner() {
  const { user, loading, login, logout } = useAuth();

  const [screen, setScreen]           = useState<Screen>("splash");
  const [splashDone, setSplashDone]   = useState(false);
  const [appConfig, setAppConfig]     = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [showSetup, setShowSetup]     = useState(!FIREBASE_ENABLED);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showBanner,  setShowBanner]  = useState(false);
  const [bannerCfg,   setBannerCfg]  = useState<AppBannerConfig>(DEFAULT_APP_BANNER);
  const bannerShown = useRef(false);
  const [ludoFee, setLudoFee]           = useState(2);
  const [superLudoFee, setSuperLudoFee] = useState(10);
  const [saanpSidiFee, setSaanpSidiFee] = useState(2);
  const [carromFee, setCarromFee]     = useState(10);
  const [bubbleFee, setBubbleFee]         = useState(10);
  const [candyFee, setCandyFee]           = useState(10);
  const [chessFee, setChessFee]           = useState(10);
  const [discFee, setDiscFee]             = useState(10);
  const [rummyFee, setRummyFee]           = useState(10);
  const [callBreakFee, setCallBreakFee]   = useState(10);
  const [pokerFee, setPokerFee]           = useState(10);
  const [solitaireFee, setSolitaireFee]   = useState(10);
  const [twenty1Fee, setTwenty1Fee]       = useState(10);
  const [axemasterFee, setAxemasterFee]     = useState(10);
  const [mrracerFee, setMrracerFee]         = useState(10);
  const [bricksbreakFee, setBricksbreakFee] = useState(10);
  const [slapfestFee, setSlapfestFee]       = useState(10);
  const [fruitchopFee, setFruitchopFee]     = useState(10);
  const [alienfusionFee, setAlienfusionFee] = useState(10);
  const [pool3dFee, setPool3dFee]           = useState(10);
  const [crickettd20Fee, setCrickettd20Fee] = useState(10);
  const [sheepbattleFee, setSheepbattleFee] = useState(10);
  const [hexa2048Fee, setHexa2048Fee]       = useState(10);
  const [metrosurferFee, setMetrosurferFee]   = useState(10);
  const [knifeupFee, setKnifeupFee]           = useState(10);
  const [angrymonstersFee, setAngrymonstersFee] = useState(10);
  const [bearrunFee, setBearrunFee]           = useState(10);
  const [archeryFee, setArcheryFee]           = useState(10);
  const [basketballFee, setBasketballFee]     = useState(10);
  const [penaltyFee, setPenaltyFee]           = useState(10);
  const [stumpitFee, setStumpitFee]           = useState(10);
  const [bikeracingFee, setBikeracingFee]     = useState(10);
  const [gearupFee, setGearupFee]             = useState(10);
  const [hillclimberFee, setHillclimberFee]   = useState(10);
  const [liquidsortFee, setLiquidsortFee]     = useState(10);
  const [bottleshootFee, setBottleshootFee]   = useState(10);
  const [flymeFee, setFlymeFee]               = useState(10);
  const [streetfightFee, setStreetfightFee]   = useState(5);
  const [shadowfighterFee, setShadowfighterFee] = useState(5);
  const [golfmasterFee, setGolfmasterFee]     = useState(10);
  const [archerykingFee, setArcherykingFee]   = useState(10);
  const [tilematch3dFee, setTilematch3dFee]   = useState(10);
  const [pipeconnectFee, setPipeconnectFee]   = useState(10);
  const [jellyshiftFee, setJellyshiftFee]     = useState(10);
  const [goldminer3dFee, setGoldminer3dFee]   = useState(10);
  const [newUserName, setNewUserName]     = useState("");

  // Track whether the pending login was a new user signup
  const pendingIsNewUser = useRef(false);

  // Subscribe to remote app config
  useEffect(() => {
    return subscribeAppConfig(setAppConfig);
  }, []);

  // Subscribe to app-open banner config
  useEffect(() => {
    return subscribeAppBanner(setBannerCfg);
  }, []);

  // Show banner once per session when dashboard first appears
  useEffect(() => {
    if (screen !== "dashboard") return;
    if (bannerShown.current) return;
    if (!bannerCfg.enabled || !bannerCfg.imageUrl) return;
    bannerShown.current = true;
    // Small delay so Dashboard renders first
    const t = setTimeout(() => setShowBanner(true), 600);
    return () => clearTimeout(t);
  }, [screen, bannerCfg]);

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

  // Navigate from banner tap — map link string to screen
  function handleBannerNavigate(dest: string) {
    const map: Partial<Record<string, Screen>> = {
      wallet:      "wallet",
      spinwheel:   "spinwheel",
      spin:        "spinwheel",
      leaderboard: "leaderboard",
      refer:       "refer",
      history:     "history",
      profile:     "profile",
      kyc:         "kyc",
    };
    const target = map[dest.toLowerCase()];
    if (target) setScreen(target);
  }

  // Show setup guide when Firebase isn't configured
  if (showSetup) {
    return <FirebaseSetupGuide onSkip={() => setShowSetup(false)} />;
  }

  return (
    <WalletProvider>
    <MatchHistoryProvider>
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

      {/* ── App-Open Banner Modal ── */}
      {showBanner && (
        <AppBannerModal
          imageUrl={bannerCfg.imageUrl}
          link={bannerCfg.link}
          onClose={() => setShowBanner(false)}
          onNavigate={(dest) => { setShowBanner(false); handleBannerNavigate(dest); }}
        />
      )}

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
            onLudo={(fee) => { setLudoFee(fee ?? 2); setScreen("ludo"); }}
            onLudoFast={(fee) => { setLudoFee(fee ?? 2); setScreen("ludo"); }}
            onSuperLudo={(fee) => { setSuperLudoFee(fee ?? 10); setScreen("superludo"); }}
            onSaanpSidi={(fee) => { setSaanpSidiFee(fee ?? 2); setScreen("saanpsidi"); }}
            onSnakes={(fee) => { setSaanpSidiFee(fee ?? 2); setScreen("saanpsidi"); }}
            onCarrom={(fee) => { setCarromFee(fee ?? 10); setScreen("carrom"); }}
            onBubble={(fee) => { setBubbleFee(fee ?? 10); setScreen("bubble"); }}
            onCandy={(fee) => { setCandyFee(fee ?? 10); setScreen("candy"); }}
            onChess={(fee) => { setChessFee(fee ?? 10); setScreen("chess"); }}
            onDiscFootball={(fee) => { setDiscFee(fee ?? 10); setScreen("discfootball"); }}
            onRummy={(fee) => { setRummyFee(fee ?? 10); setScreen("rummy"); }}
            onCallBreak={(fee) => { setCallBreakFee(fee ?? 10); setScreen("callbreak"); }}
            onPoker={(fee) => { setPokerFee(fee ?? 10); setScreen("poker"); }}
            onSolitaire={(fee) => { setSolitaireFee(fee ?? 10); setScreen("solitaire"); }}
            onTwenty1={(fee) => { setTwenty1Fee(fee ?? 10); setScreen("twenty1"); }}
            onAxeMaster={(fee) => { setAxemasterFee(fee ?? 10); setScreen("axemaster"); }}
            onMrRacer={(fee) => { setMrracerFee(fee ?? 10); setScreen("mrracer"); }}
            onBricksBreaker={(fee) => { setBricksbreakFee(fee ?? 10); setScreen("bricksbreaker"); }}
            onSlapFest={(fee) => { setSlapfestFee(fee ?? 10); setScreen("slapfest"); }}
            onFruitChop={(fee) => { setFruitchopFee(fee ?? 10); setScreen("fruitchop"); }}
            onAlienFusion={(fee) => { setAlienfusionFee(fee ?? 10); setScreen("alienfusion"); }}
            onPool3D={(fee) => { setPool3dFee(fee ?? 10); setScreen("pool3d"); }}
            onCricketTD20={(fee) => { setCrickettd20Fee(fee ?? 10); setScreen("crickettd20"); }}
            onSheepBattle={(fee) => { setSheepbattleFee(fee ?? 10); setScreen("sheepbattle"); }}
            onHexa2048={(fee) => { setHexa2048Fee(fee ?? 10); setScreen("hexa2048"); }}
            onMetroSurfer={(fee) => { setMetrosurferFee(fee ?? 10); setScreen("metrosurfer"); }}
            onKnifeUp={(fee) => { setKnifeupFee(fee ?? 10); setScreen("knifeup"); }}
            onAngryMonsters={(fee) => { setAngrymonstersFee(fee ?? 10); setScreen("angrymonsters"); }}
            onBearRun={(fee) => { setBearrunFee(fee ?? 10); setScreen("bearrun"); }}
            onArchery={(fee) => { setArcheryFee(fee ?? 10); setScreen("archery"); }}
            onBasketball={(fee) => { setBasketballFee(fee ?? 10); setScreen("basketball"); }}
            onPenalty={(fee) => { setPenaltyFee(fee ?? 10); setScreen("penalty"); }}
            onStumpIt={(fee) => { setStumpitFee(fee ?? 10); setScreen("stumpit"); }}
            onBikeRacing={(fee) => { setBikeracingFee(fee ?? 10); setScreen("bikeracing"); }}
            onGearUp={(fee) => { setGearupFee(fee ?? 10); setScreen("gearup"); }}
            onHillClimber={(fee) => { setHillclimberFee(fee ?? 10); setScreen("hillclimber"); }}
            onLiquidSort={(fee) => { setLiquidsortFee(fee ?? 10); setScreen("liquidsort"); }}
            onBottleShoot={(fee) => { setBottleshootFee(fee ?? 10); setScreen("bottleshoot"); }}
            onFlyMe={(fee) => { setFlymeFee(fee ?? 10); setScreen("flyme"); }}
            onStreetFight={(fee) => { setStreetfightFee(fee ?? 5); setScreen("streetfight"); }}
            onShadowFighter={(fee) => { setShadowfighterFee(fee ?? 5); setScreen("shadowfighter"); }}
            onGolfMaster={(fee) => { setGolfmasterFee(fee ?? 10); setScreen("golfmaster"); }}
            onArcheryKing={(fee) => { setArcherykingFee(fee ?? 10); setScreen("archeryking"); }}
            onTileMatch3D={(fee) => { setTilematch3dFee(fee ?? 10); setScreen("tilematch3d"); }}
            onPipeConnect={(fee) => { setPipeconnectFee(fee ?? 10); setScreen("pipeconnect"); }}
            onJellyShift={(fee) => { setJellyshiftFee(fee ?? 10); setScreen("jellyshift"); }}
            onGoldMiner3D={(fee) => { setGoldminer3dFee(fee ?? 10); setScreen("goldminer3d"); }}
            onWallet={() => setScreen("wallet")}
            onHistory={() => setScreen("history")}
            onLeaderboard={() => setScreen("leaderboard")}
            onNotifications={() => setScreen("notifications")}
          />
        )}

        {screen === "spinwheel" && (
          <SpinWheel key="spinwheel" onBack={() => setScreen("dashboard")} />
        )}

        {screen === "ludo" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <LudoFastGame key="ludo" onBack={() => setScreen("dashboard")} initialFee={ludoFee} />
        </Suspense>
      )}

      {screen === "superludo" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <SuperLudoGame key="superludo" onBack={() => setScreen("dashboard")} initialFee={superLudoFee} />
        </Suspense>
      )}

      {screen === "saanpsidi" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <SaanpSidiGame key="saanpsidi" onBack={() => setScreen("dashboard")} initialFee={saanpSidiFee} />
        </Suspense>
      )}

      {screen === "carrom" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <CarromGame key="carrom" onBack={() => setScreen("dashboard")} initialFee={carromFee} />
        </Suspense>
      )}

      {screen === "bubble" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <BubbleGame key="bubble" onBack={() => setScreen("dashboard")} initialFee={bubbleFee} />
        </Suspense>
      )}

      {screen === "candy" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <CandyGame key="candy" onBack={() => setScreen("dashboard")} initialFee={candyFee} />
        </Suspense>
      )}

      {screen === "chess" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <ChessGame key="chess" onBack={() => setScreen("dashboard")} initialFee={chessFee} />
        </Suspense>
      )}

      {screen === "discfootball" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <DiscFootballGame key="discfootball" onBack={() => setScreen("dashboard")} initialFee={discFee} />
        </Suspense>
      )}

      {screen === "rummy" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <RummyGame key="rummy" onBack={() => setScreen("dashboard")} initialFee={rummyFee} />
        </Suspense>
      )}

      {screen === "callbreak" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <CallBreakGame key="callbreak" onBack={() => setScreen("dashboard")} initialFee={callBreakFee} />
        </Suspense>
      )}

      {screen === "poker" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <PokerGame key="poker" onBack={() => setScreen("dashboard")} initialFee={pokerFee} />
        </Suspense>
      )}

      {screen === "solitaire" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <SolitaireGame key="solitaire" onBack={() => setScreen("dashboard")} initialFee={solitaireFee} />
        </Suspense>
      )}

      {screen === "twenty1" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <Twenty1Game key="twenty1" onBack={() => setScreen("dashboard")} initialFee={twenty1Fee} />
        </Suspense>
      )}

      {screen === "axemaster" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <AxeMasterGame key="axemaster" onBack={() => setScreen("dashboard")} initialFee={axemasterFee} />
        </Suspense>
      )}

      {screen === "mrracer" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <MrRacerGame key="mrracer" onBack={() => setScreen("dashboard")} initialFee={mrracerFee} />
        </Suspense>
      )}

      {screen === "bricksbreaker" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <BricksBreaker3DGame key="bricksbreaker" onBack={() => setScreen("dashboard")} initialFee={bricksbreakFee} />
        </Suspense>
      )}

      {screen === "slapfest" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <SlapFestGame key="slapfest" onBack={() => setScreen("dashboard")} initialFee={slapfestFee} />
        </Suspense>
      )}

      {screen === "fruitchop" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <FruitChopGame key="fruitchop" onBack={() => setScreen("dashboard")} initialFee={fruitchopFee} />
        </Suspense>
      )}

      {screen === "alienfusion" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <AlienFusionGame key="alienfusion" onBack={() => setScreen("dashboard")} initialFee={alienfusionFee} />
        </Suspense>
      )}

      {screen === "pool3d" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <Pool3DGame key="pool3d" onBack={() => setScreen("dashboard")} initialFee={pool3dFee} />
        </Suspense>
      )}

      {screen === "crickettd20" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <CricketT20Game key="crickettd20" onBack={() => setScreen("dashboard")} initialFee={crickettd20Fee} />
        </Suspense>
      )}

      {screen === "sheepbattle" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <SheepBattleGame key="sheepbattle" onBack={() => setScreen("dashboard")} initialFee={sheepbattleFee} />
        </Suspense>
      )}

      {screen === "hexa2048" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <Hexa2048Game key="hexa2048" onBack={() => setScreen("dashboard")} initialFee={hexa2048Fee} />
        </Suspense>
      )}

      {screen === "metrosurfer" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <MetroSurferGame key="metrosurfer" onBack={() => setScreen("dashboard")} initialFee={metrosurferFee} />
        </Suspense>
      )}

      {screen === "knifeup" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <KnifeUpGame key="knifeup" onBack={() => setScreen("dashboard")} initialFee={knifeupFee} />
        </Suspense>
      )}

      {screen === "angrymonsters" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <AngryMonstersGame key="angrymonsters" onBack={() => setScreen("dashboard")} initialFee={angrymonstersFee} />
        </Suspense>
      )}

      {screen === "bearrun" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <BearRunGame key="bearrun" onBack={() => setScreen("dashboard")} initialFee={bearrunFee} />
        </Suspense>
      )}

      {screen === "archery" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <ArcheryGame key="archery" onBack={() => setScreen("dashboard")} initialFee={archeryFee} />
        </Suspense>
      )}

      {screen === "basketball" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <BasketballGame key="basketball" onBack={() => setScreen("dashboard")} initialFee={basketballFee} />
        </Suspense>
      )}

      {screen === "penalty" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <PenaltyShootoutGame key="penalty" onBack={() => setScreen("dashboard")} initialFee={penaltyFee} />
        </Suspense>
      )}

      {screen === "stumpit" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <StumpItGame key="stumpit" onBack={() => setScreen("dashboard")} initialFee={stumpitFee} />
        </Suspense>
      )}

      {screen === "bikeracing" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <BikeRacingGame key="bikeracing" onBack={() => setScreen("dashboard")} initialFee={bikeracingFee} />
        </Suspense>
      )}

      {screen === "gearup" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <GearUpGame key="gearup" onBack={() => setScreen("dashboard")} initialFee={gearupFee} />
        </Suspense>
      )}

      {screen === "hillclimber" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <HillClimberGame key="hillclimber" onBack={() => setScreen("dashboard")} initialFee={hillclimberFee} />
        </Suspense>
      )}

      {screen === "liquidsort" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <LiquidSortGame key="liquidsort" onBack={() => setScreen("dashboard")} initialFee={liquidsortFee} />
        </Suspense>
      )}

      {screen === "bottleshoot" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <BottleShootGame key="bottleshoot" onBack={() => setScreen("dashboard")} initialFee={bottleshootFee} />
        </Suspense>
      )}

      {screen === "flyme" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <FlyMeGame key="flyme" onBack={() => setScreen("dashboard")} initialFee={flymeFee} />
        </Suspense>
      )}

      {screen === "streetfight" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <StreetFightGame key="streetfight" onBack={() => setScreen("dashboard")} initialFee={streetfightFee} />
        </Suspense>
      )}

      {screen === "shadowfighter" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <ShadowFighterGame key="shadowfighter" onBack={() => setScreen("dashboard")} initialFee={shadowfighterFee} />
        </Suspense>
      )}

      {screen === "golfmaster" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <GolfMasterGame key="golfmaster" onBack={() => setScreen("dashboard")} initialFee={golfmasterFee} />
        </Suspense>
      )}

      {screen === "archeryking" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <ArcheryKingGame key="archeryking" onBack={() => setScreen("dashboard")} initialFee={archerykingFee} />
        </Suspense>
      )}

      {screen === "tilematch3d" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <TileMatch3DGame key="tilematch3d" onBack={() => setScreen("dashboard")} initialFee={tilematch3dFee} />
        </Suspense>
      )}

      {screen === "pipeconnect" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <PipeConnectGame key="pipeconnect" onBack={() => setScreen("dashboard")} initialFee={pipeconnectFee} />
        </Suspense>
      )}

      {screen === "jellyshift" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <JellyShiftGame key="jellyshift" onBack={() => setScreen("dashboard")} initialFee={jellyshiftFee} />
        </Suspense>
      )}

      {screen === "goldminer3d" && (
        <Suspense fallback={<div className="flex items-center justify-center h-screen" style={{background: "#0a0a0f"}}><span className="text-2xl">Loading...</span></div>}>
          <GoldMinerGame key="goldminer3d" onBack={() => setScreen("dashboard")} initialFee={goldminer3dFee} />
        </Suspense>
      )}

      {screen === "leaderboard" && (
        <LeaderboardScreen key="leaderboard" onBack={() => setScreen("dashboard")} />
      )}

      {screen === "notifications" && (
        <NotificationsScreen key="notifications" onBack={() => setScreen("dashboard")} />
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

        {screen === "history" && (
          <HistoryScreen
            key="history"
            onBack={() => setScreen("dashboard")}
            onWallet={() => setScreen("wallet")}
          />
        )}

        {screen === "profile" && (
          <ProfileScreen
            key="profile"
            onKYC={() => setScreen("kyc")}
            onRefer={() => setScreen("refer")}
            onWallet={() => setScreen("wallet")}
            onSupport={() => setScreen("support")}
            onTerms={() => setScreen("terms")}
            onLogout={handleLogout}
          />
        )}

        {screen === "kyc" && (
          <KYCScreen key="kyc" onBack={() => setScreen("profile")} />
        )}

        {screen === "support" && (
          <SupportScreen key="support" onBack={() => setScreen("profile")} />
        )}

        {screen === "terms" && (
          <TermsScreen key="terms" onBack={() => setScreen("profile")} />
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
    </MatchHistoryProvider>
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
