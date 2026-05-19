/**
 * App.tsx — WINGGO Player App  (Performance-optimised build)
 *
 * Loading strategy
 * ──────────────────────────────────────────────────────────────
 *  EAGER  : SplashScreen, LoginScreen, Dashboard, LoginTransition
 *           → these are the critical render path; always bundled.
 *  LAZY   : every game screen + utility screen (Wallet, History…)
 *           → loaded on-demand via React.lazy(), split into their
 *             own JS chunks by Rollup.
 *
 * State strategy
 * ──────────────────────────────────────────────────────────────
 *  All entry-fee values live in a single Record<string,number>
 *  instead of 40 individual useState calls.
 */
import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import { WalletProvider } from "@/context/WalletContext";
import { MatchHistoryProvider } from "@/context/MatchHistoryContext";

// ── Critical-path (always bundled) ────────────────────────────────────────────
import WelcomeBonusModal     from "@/components/WelcomeBonusModal";
import LoginTransitionScreen from "@/components/LoginTransitionScreen";
import SplashScreen          from "@/pages/SplashScreen";
import LoginScreen           from "@/pages/LoginScreen";
import Dashboard             from "@/pages/Dashboard";
import FirebaseSetupGuide    from "@/pages/FirebaseSetupGuide";
import BottomNav, { SCREENS_WITH_NAV } from "@/components/BottomNav";
import { subscribeAppConfig, AppConfig, DEFAULT_APP_CONFIG } from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ── Lazy (split into individual chunks) ───────────────────────────────────────
const SpinWheel           = lazy(() => import("@/pages/SpinWheel"));
const LudoFastGame        = lazy(() => import("@/pages/LudoFastGame"));
const SaanpSidiGame       = lazy(() => import("@/pages/SaanpSidiGame"));
const WorldWarGame        = lazy(() => import("@/pages/WorldWarGame"));
const CarromGame          = lazy(() => import("@/pages/CarromGame"));
const BubbleGame          = lazy(() => import("@/pages/BubbleGame"));
const CandyGame           = lazy(() => import("@/pages/CandyGame"));
const ChessGame           = lazy(() => import("@/pages/ChessGame"));
const DiscFootballGame    = lazy(() => import("@/pages/DiscFootballGame"));
const RummyGame           = lazy(() => import("@/pages/RummyGame"));
const CallBreakGame       = lazy(() => import("@/pages/CallBreakGame"));
const PokerGame           = lazy(() => import("@/pages/PokerGame"));
const SolitaireGame       = lazy(() => import("@/pages/SolitaireGame"));
const Twenty1Game         = lazy(() => import("@/pages/Twenty1Game"));
const AxeMasterGame       = lazy(() => import("@/pages/AxeMasterGame"));
const MrRacerGame         = lazy(() => import("@/pages/MrRacerGame"));
const BricksBreaker3DGame = lazy(() => import("@/pages/BricksBreaker3DGame"));
const SlapFestGame        = lazy(() => import("@/pages/SlapFestGame"));
const FruitChopGame       = lazy(() => import("@/pages/FruitChopGame"));
const AlienFusionGame     = lazy(() => import("@/pages/AlienFusionGame"));
const Pool3DGame          = lazy(() => import("@/pages/Pool3DGame"));
const CricketT20Game      = lazy(() => import("@/pages/CricketT20Game"));
const SheepBattleGame     = lazy(() => import("@/pages/SheepBattleGame"));
const Hexa2048Game        = lazy(() => import("@/pages/Hexa2048Game"));
const MetroSurferGame     = lazy(() => import("@/pages/MetroSurferGame"));
const KnifeUpGame         = lazy(() => import("@/pages/KnifeUpGame"));
const AngryMonstersGame   = lazy(() => import("@/pages/AngryMonstersGame"));
const BearRunGame         = lazy(() => import("@/pages/BearRunGame"));
const ArcheryGame         = lazy(() => import("@/pages/ArcheryGame"));
const BasketballGame      = lazy(() => import("@/pages/BasketballGame"));
const PenaltyShootoutGame = lazy(() => import("@/pages/PenaltyShootoutGame"));
const StumpItGame         = lazy(() => import("@/pages/StumpItGame"));
const BikeRacingGame      = lazy(() => import("@/pages/BikeRacingGame"));
const GearUpGame          = lazy(() => import("@/pages/GearUpGame"));
const HillClimberGame     = lazy(() => import("@/pages/HillClimberGame"));
const LiquidSortGame      = lazy(() => import("@/pages/LiquidSortGame"));
const BottleShootGame     = lazy(() => import("@/pages/BottleShootGame"));
const FlyMeGame           = lazy(() => import("@/pages/FlyMeGame"));
const StreetFightGame     = lazy(() => import("@/pages/StreetFightGame"));
const ShadowFighterGame   = lazy(() => import("@/pages/ShadowFighterGame"));
const GolfMasterGame      = lazy(() => import("@/pages/GolfMasterGame"));
const ArcheryKingGame     = lazy(() => import("@/pages/ArcheryKingGame"));
const TileMatch3DGame     = lazy(() => import("@/pages/TileMatch3DGame"));
const PipeConnectGame     = lazy(() => import("@/pages/PipeConnectGame"));
const JellyShiftGame      = lazy(() => import("@/pages/JellyShiftGame"));
const GoldMinerGame       = lazy(() => import("@/pages/GoldMinerGame"));
const ReferEarn           = lazy(() => import("@/pages/ReferEarn"));
const WalletScreen        = lazy(() => import("@/pages/WalletScreen"));
const HistoryScreen       = lazy(() => import("@/pages/HistoryScreen"));
const ProfileScreen       = lazy(() => import("@/pages/ProfileScreen"));
const KYCScreen           = lazy(() => import("@/pages/KYCScreen"));
const LeaderboardScreen   = lazy(() => import("@/pages/LeaderboardScreen"));

// ── Types ─────────────────────────────────────────────────────────────────────
type Screen =
  | "splash" | "login" | "transition" | "dashboard"
  | "spinwheel" | "ludo" | "saanpsidi" | "worldwar" | "carrom" | "bubble" | "candy"
  | "chess" | "discfootball" | "rummy" | "callbreak" | "poker" | "solitaire" | "twenty1"
  | "axemaster" | "mrracer" | "bricksbreaker" | "slapfest" | "fruitchop"
  | "alienfusion" | "pool3d" | "crickettd20" | "sheepbattle" | "hexa2048"
  | "metrosurfer" | "knifeup" | "angrymonsters" | "bearrun" | "archery"
  | "basketball" | "penalty" | "stumpit" | "bikeracing" | "gearup" | "hillclimber"
  | "liquidsort" | "bottleshoot" | "flyme"
  | "streetfight" | "shadowfighter" | "golfmaster" | "archeryking"
  | "tilematch3d" | "pipeconnect" | "jellyshift" | "goldminer3d"
  | "refer" | "wallet" | "history" | "profile" | "kyc" | "leaderboard";

const CORE_SCREENS: Screen[] = ["splash", "login", "transition", "dashboard"];

// ── Lightweight spinner shown while a lazy chunk is downloading ───────────────
function GameLoader() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center" style={{ background: "#0a0614" }}>
      <motion.div
        className="w-12 h-12 rounded-full"
        style={{ border: "2px solid rgba(255,215,0,0.2)", borderTopColor: "#FFD700" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.65, repeat: Infinity, ease: "linear" }}
      />
      <p className="text-[11px] font-black mt-4 tracking-widest" style={{ color: "rgba(255,215,0,0.45)" }}>
        LOADING…
      </p>
    </div>
  );
}

// ── Stable QueryClient ────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, gcTime: 300_000 } },
});

// ── Inner app (inside AuthProvider) ──────────────────────────────────────────
function AppInner() {
  const { user, loading, login, logout } = useAuth();

  const [screen,      setScreen]      = useState<Screen>("splash");
  const [splashDone,  setSplashDone]  = useState(false);
  const [appConfig,   setAppConfig]   = useState<AppConfig>(DEFAULT_APP_CONFIG);
  const [showSetup,   setShowSetup]   = useState(!FIREBASE_ENABLED);
  const [showWelcome, setShowWelcome] = useState(false);
  const [newUserName, setNewUserName] = useState("");

  /** Single map for all entry-fee values — replaces 40+ individual useState calls */
  const [fees, setFees] = useState<Record<string, number>>({});
  const pendingIsNewUser = useRef(false);

  /** Read a fee (or fall back to default) */
  const fee = (key: string, def = 10) => fees[key] ?? def;

  /** Navigate to a game screen, optionally storing its entry fee */
  function go(s: Screen, feeKey?: string, feeVal?: number, def = 10) {
    if (feeKey !== undefined) setFees(p => ({ ...p, [feeKey]: feeVal ?? def }));
    setScreen(s);
  }

  useEffect(() => subscribeAppConfig(setAppConfig), []);

  // Splash timer — slightly reduced to 2.8 s
  useEffect(() => {
    if (screen !== "splash") return;
    const t = setTimeout(() => setSplashDone(true), 2800);
    return () => clearTimeout(t);
  }, [screen]);

  // Post-splash navigation
  useEffect(() => {
    if (!splashDone || screen !== "splash") return;
    if (FIREBASE_ENABLED && loading) return;
    setScreen(user ? "dashboard" : "login");
  }, [splashDone, loading, user, screen]);

  function handleLogin(uid: string, email: string, isNewUser?: boolean) {
    login(uid, email, isNewUser);
    pendingIsNewUser.current = !!isNewUser;
    setScreen("transition");
  }

  function handleTransitionComplete() {
    setScreen("dashboard");
    if (pendingIsNewUser.current) {
      setNewUserName(user?.displayName ?? "");
      setShowWelcome(true);
      pendingIsNewUser.current = false;
    }
  }

  async function handleLogout() {
    await logout();
    setScreen("login");
  }

  if (showSetup) return <FirebaseSetupGuide onSkip={() => setShowSetup(false)} />;

  const back = () => setScreen("dashboard");
  const isGameScreen = !CORE_SCREENS.includes(screen);

  return (
    <WalletProvider>
    <MatchHistoryProvider>

      {/* ── Maintenance overlay ────────────────────────────────── */}
      <AnimatePresence>
        {appConfig.maintenanceMode && (
          <motion.div key="maint"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-center px-6"
            style={{ background: "rgba(7,5,16,0.97)", backdropFilter: "blur(20px)", maxWidth: 480, margin: "0 auto" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <span className="text-6xl">🔧</span>
            </motion.div>
            <h2 className="text-white font-black text-2xl mt-5">Under Maintenance</h2>
            <p className="mt-2 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Upgrading the platform. Back shortly!
            </p>
            <div className="mt-6 px-5 py-3 rounded-2xl text-xs font-bold"
              style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "#FFD700" }}>
              🕐 Expected back in ~30 minutes
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Force-update overlay ───────────────────────────────── */}
      <AnimatePresence>
        {appConfig.forceUpdateVersion && appConfig.forceUpdateVersion !== "1.0.0" && !appConfig.maintenanceMode && (
          <motion.div key="update"
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
              style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", boxShadow: "0 0 30px rgba(255,215,0,0.4)" }}>
              ⬇️ Update Now
            </motion.a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Welcome bonus modal ────────────────────────────────── */}
      <WelcomeBonusModal
        visible={showWelcome}
        displayName={newUserName}
        onClose={() => setShowWelcome(false)}
      />

      {/* ─────────────────────────────────────────────────────────
          CORE screens — Splash → Login → Transition → Dashboard
          Managed by AnimatePresence for smooth page transitions.
          ───────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {screen === "splash" && <SplashScreen key="splash" />}
        {screen === "login" && <LoginScreen key="login" onLogin={handleLogin} />}
        {screen === "transition" && (
          <LoginTransitionScreen key="transition" isNewUser={pendingIsNewUser.current} onComplete={handleTransitionComplete} />
        )}
        {screen === "dashboard" && (
          <Dashboard
            key="dashboard"
            appConfig={appConfig}
            onSpin={() => setScreen("spinwheel")}
            onLudo={(f) => go("ludo",         "ludo",         f, 2)}
            onLudoFast={(f) => go("ludo",     "ludo",         f, 2)}
            onSaanpSidi={(f) => go("saanpsidi","saanpsidi",  f, 2)}
            onWorldWar={(f) => go("worldwar",  "worldwar",   f, 10)}
            onSnakes={(f) => go("saanpsidi",   "saanpsidi",  f, 2)}
            onCarrom={(f) => go("carrom",      "carrom",     f)}
            onBubble={(f) => go("bubble",      "bubble",     f)}
            onCandy={(f) => go("candy",        "candy",      f)}
            onChess={(f) => go("chess",        "chess",      f)}
            onDiscFootball={(f) => go("discfootball","discfootball",f)}
            onRummy={(f) => go("rummy",        "rummy",      f)}
            onCallBreak={(f) => go("callbreak","callbreak",  f)}
            onPoker={(f) => go("poker",        "poker",      f)}
            onSolitaire={(f) => go("solitaire","solitaire",  f)}
            onTwenty1={(f) => go("twenty1",    "twenty1",    f)}
            onAxeMaster={(f) => go("axemaster","axemaster",  f)}
            onMrRacer={(f) => go("mrracer",    "mrracer",    f)}
            onBricksBreaker={(f) => go("bricksbreaker","bricksbreaker",f)}
            onSlapFest={(f) => go("slapfest",  "slapfest",   f)}
            onFruitChop={(f) => go("fruitchop","fruitchop",  f)}
            onAlienFusion={(f) => go("alienfusion","alienfusion",f)}
            onPool3D={(f) => go("pool3d",      "pool3d",     f)}
            onCricketTD20={(f) => go("crickettd20","crickettd20",f)}
            onSheepBattle={(f) => go("sheepbattle","sheepbattle",f)}
            onHexa2048={(f) => go("hexa2048",  "hexa2048",   f)}
            onMetroSurfer={(f) => go("metrosurfer","metrosurfer",f)}
            onKnifeUp={(f) => go("knifeup",    "knifeup",    f)}
            onAngryMonsters={(f) => go("angrymonsters","angrymonsters",f)}
            onBearRun={(f) => go("bearrun",    "bearrun",    f)}
            onArchery={(f) => go("archery",    "archery",    f)}
            onBasketball={(f) => go("basketball","basketball",f)}
            onPenalty={(f) => go("penalty",    "penalty",    f)}
            onStumpIt={(f) => go("stumpit",    "stumpit",    f)}
            onBikeRacing={(f) => go("bikeracing","bikeracing",f)}
            onGearUp={(f) => go("gearup",      "gearup",     f)}
            onHillClimber={(f) => go("hillclimber","hillclimber",f)}
            onLiquidSort={(f) => go("liquidsort","liquidsort",f)}
            onBottleShoot={(f) => go("bottleshoot","bottleshoot",f)}
            onFlyMe={(f) => go("flyme",        "flyme",      f)}
            onStreetFight={(f) => go("streetfight","streetfight",f, 5)}
            onShadowFighter={(f) => go("shadowfighter","shadowfighter",f, 5)}
            onGolfMaster={(f) => go("golfmaster","golfmaster",f)}
            onArcheryKing={(f) => go("archeryking","archeryking",f)}
            onTileMatch3D={(f) => go("tilematch3d","tilematch3d",f)}
            onPipeConnect={(f) => go("pipeconnect","pipeconnect",f)}
            onJellyShift={(f) => go("jellyshift","jellyshift",f)}
            onGoldMiner3D={(f) => go("goldminer3d","goldminer3d",f)}
            onWallet={() => setScreen("wallet")}
            onHistory={() => setScreen("history")}
            onLeaderboard={() => setScreen("leaderboard")}
          />
        )}
      </AnimatePresence>

      {/* ─────────────────────────────────────────────────────────
          GAME / UTILITY screens — lazy-loaded on demand.
          Rendered above the dashboard layer (z-10).
          Each chunk downloads only when first visited.
          ───────────────────────────────────────────────────────── */}
      {isGameScreen && (
        <Suspense fallback={<GameLoader />}>
          <motion.div
            key={screen}
            className="fixed inset-0 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            {screen === "spinwheel"     && <SpinWheel key="spinwheel" onBack={back} />}
            {screen === "ludo"          && <LudoFastGame key="ludo" onBack={back} initialFee={fee("ludo",2)} />}
            {screen === "saanpsidi"     && <SaanpSidiGame key="saanpsidi" onBack={back} initialFee={fee("saanpsidi",2)} />}
            {screen === "worldwar"      && <WorldWarGame key="worldwar" onBack={back} initialFee={fee("worldwar")} />}
            {screen === "carrom"        && <CarromGame key="carrom" onBack={back} initialFee={fee("carrom")} />}
            {screen === "bubble"        && <BubbleGame key="bubble" onBack={back} initialFee={fee("bubble")} />}
            {screen === "candy"         && <CandyGame key="candy" onBack={back} initialFee={fee("candy")} />}
            {screen === "chess"         && <ChessGame key="chess" onBack={back} initialFee={fee("chess")} />}
            {screen === "discfootball"  && <DiscFootballGame key="discfootball" onBack={back} initialFee={fee("discfootball")} />}
            {screen === "rummy"         && <RummyGame key="rummy" onBack={back} initialFee={fee("rummy")} />}
            {screen === "callbreak"     && <CallBreakGame key="callbreak" onBack={back} initialFee={fee("callbreak")} />}
            {screen === "poker"         && <PokerGame key="poker" onBack={back} initialFee={fee("poker")} />}
            {screen === "solitaire"     && <SolitaireGame key="solitaire" onBack={back} initialFee={fee("solitaire")} />}
            {screen === "twenty1"       && <Twenty1Game key="twenty1" onBack={back} initialFee={fee("twenty1")} />}
            {screen === "axemaster"     && <AxeMasterGame key="axemaster" onBack={back} initialFee={fee("axemaster")} />}
            {screen === "mrracer"       && <MrRacerGame key="mrracer" onBack={back} initialFee={fee("mrracer")} />}
            {screen === "bricksbreaker" && <BricksBreaker3DGame key="bricksbreaker" onBack={back} initialFee={fee("bricksbreaker")} />}
            {screen === "slapfest"      && <SlapFestGame key="slapfest" onBack={back} initialFee={fee("slapfest")} />}
            {screen === "fruitchop"     && <FruitChopGame key="fruitchop" onBack={back} initialFee={fee("fruitchop")} />}
            {screen === "alienfusion"   && <AlienFusionGame key="alienfusion" onBack={back} initialFee={fee("alienfusion")} />}
            {screen === "pool3d"        && <Pool3DGame key="pool3d" onBack={back} initialFee={fee("pool3d")} />}
            {screen === "crickettd20"   && <CricketT20Game key="crickettd20" onBack={back} initialFee={fee("crickettd20")} />}
            {screen === "sheepbattle"   && <SheepBattleGame key="sheepbattle" onBack={back} initialFee={fee("sheepbattle")} />}
            {screen === "hexa2048"      && <Hexa2048Game key="hexa2048" onBack={back} initialFee={fee("hexa2048")} />}
            {screen === "metrosurfer"   && <MetroSurferGame key="metrosurfer" onBack={back} initialFee={fee("metrosurfer")} />}
            {screen === "knifeup"       && <KnifeUpGame key="knifeup" onBack={back} initialFee={fee("knifeup")} />}
            {screen === "angrymonsters" && <AngryMonstersGame key="angrymonsters" onBack={back} initialFee={fee("angrymonsters")} />}
            {screen === "bearrun"       && <BearRunGame key="bearrun" onBack={back} initialFee={fee("bearrun")} />}
            {screen === "archery"       && <ArcheryGame key="archery" onBack={back} initialFee={fee("archery")} />}
            {screen === "basketball"    && <BasketballGame key="basketball" onBack={back} initialFee={fee("basketball")} />}
            {screen === "penalty"       && <PenaltyShootoutGame key="penalty" onBack={back} initialFee={fee("penalty")} />}
            {screen === "stumpit"       && <StumpItGame key="stumpit" onBack={back} initialFee={fee("stumpit")} />}
            {screen === "bikeracing"    && <BikeRacingGame key="bikeracing" onBack={back} initialFee={fee("bikeracing")} />}
            {screen === "gearup"        && <GearUpGame key="gearup" onBack={back} initialFee={fee("gearup")} />}
            {screen === "hillclimber"   && <HillClimberGame key="hillclimber" onBack={back} initialFee={fee("hillclimber")} />}
            {screen === "liquidsort"    && <LiquidSortGame key="liquidsort" onBack={back} initialFee={fee("liquidsort")} />}
            {screen === "bottleshoot"   && <BottleShootGame key="bottleshoot" onBack={back} initialFee={fee("bottleshoot")} />}
            {screen === "flyme"         && <FlyMeGame key="flyme" onBack={back} initialFee={fee("flyme")} />}
            {screen === "streetfight"   && <StreetFightGame key="streetfight" onBack={back} initialFee={fee("streetfight",5)} />}
            {screen === "shadowfighter" && <ShadowFighterGame key="shadowfighter" onBack={back} initialFee={fee("shadowfighter",5)} />}
            {screen === "golfmaster"    && <GolfMasterGame key="golfmaster" onBack={back} initialFee={fee("golfmaster")} />}
            {screen === "archeryking"   && <ArcheryKingGame key="archeryking" onBack={back} initialFee={fee("archeryking")} />}
            {screen === "tilematch3d"   && <TileMatch3DGame key="tilematch3d" onBack={back} initialFee={fee("tilematch3d")} />}
            {screen === "pipeconnect"   && <PipeConnectGame key="pipeconnect" onBack={back} initialFee={fee("pipeconnect")} />}
            {screen === "jellyshift"    && <JellyShiftGame key="jellyshift" onBack={back} initialFee={fee("jellyshift")} />}
            {screen === "goldminer3d"   && <GoldMinerGame key="goldminer3d" onBack={back} initialFee={fee("goldminer3d")} />}
            {screen === "refer"         && <ReferEarn key="refer" onBack={back} />}
            {screen === "wallet"        && <WalletScreen key="wallet" onBack={back} />}
            {screen === "history"       && <HistoryScreen key="history" onBack={back} onWallet={() => setScreen("wallet")} />}
            {screen === "profile"       && <ProfileScreen key="profile" onKYC={() => setScreen("kyc")} onRefer={() => setScreen("refer")} onWallet={() => setScreen("wallet")} onLogout={handleLogout} />}
            {screen === "kyc"           && <KYCScreen key="kyc" onBack={back} />}
            {screen === "leaderboard"   && <LeaderboardScreen key="leaderboard" onBack={back} />}
          </motion.div>
        </Suspense>
      )}

      {/* ── Bottom nav ────────────────────────────────────────── */}
      {SCREENS_WITH_NAV.includes(screen) && (
        <BottomNav
          activeScreen={screen}
          onNavigate={(s) => setScreen(s as Screen)}
        />
      )}

      <Toaster />
    </MatchHistoryProvider>
    </WalletProvider>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
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
