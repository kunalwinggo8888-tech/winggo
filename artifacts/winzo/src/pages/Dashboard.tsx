import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SpinWheel from "@/pages/SpinWheel";
import { useWallet } from "@/context/useWallet";
import { subscribeGames, seedGamesIfEmpty, GameConfig } from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";
import GameEntrySheet, { SheetGame } from "@/components/GameEntrySheet";

const CATEGORY_SECTIONS = [
  { key: "Popular", label: "🔥 Popular Games",   accent: "#ff4e00" },
  { key: "Action",  label: "⚔️ Action Games",     accent: "#ef4444" },
  { key: "Sports",  label: "🏏 Sports Games",     accent: "#22c55e" },
  { key: "Racing",  label: "🏎️ Racing Games",     accent: "#ff8c00" },
  { key: "Arcade",  label: "🕹️ Arcade Games",     accent: "#a855f7" },
  { key: "Card",    label: "🃏 Card Games",        accent: "#3b82f6" },
  { key: "Puzzle",  label: "🧠 Puzzle Games",      accent: "#FFD700" },
];

const BANNERS = [
  {
    id: 1,
    title: "Play More Win More",
    subtitle: "100+ Games · Instant Withdrawals",
    gradient: "linear-gradient(135deg, #ff4e00 0%, #ec9f05 100%)",
    accent: "#fff",
    tag: "🔥 WINGGO",
  },
  {
    id: 2,
    title: "Refer & Earn",
    subtitle: "Earn unlimited bonus — no cap!",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    accent: "#FFD700",
    tag: "💸 TRENDING",
  },
  {
    id: 3,
    title: "New User Bonus",
    subtitle: "Get ₹50 free on first signup",
    gradient: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
    accent: "#fff",
    tag: "🎁 NEW OFFER",
  },
  {
    id: 4,
    title: "Daily Deposit Offer",
    subtitle: "100% bonus on every deposit today",
    gradient: "linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)",
    accent: "#fff",
    tag: "⚡ HOT DEAL",
  },
  {
    id: 5,
    title: "Real Players. Real Battles.",
    subtitle: "Fast matchmaking — join in seconds",
    gradient: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)",
    accent: "#FFD700",
    tag: "👥 LIVE",
  },
];

const GAME_CATALOG = [
  // Popular
  { id: "ludo",         name: "Ludo",             icon: "🎲", gradient: "linear-gradient(135deg,#a18cd1,#fbc2eb)", category: "Popular", players: "4.2L playing", minFee: "₹1" },
  { id: "carrom",       name: "Carrom",            icon: "🎯", gradient: "linear-gradient(135deg,#f7971e,#ffd200)", category: "Popular", players: "2.9L playing", minFee: "₹2" },
  { id: "snakes",       name: "Snake & Ladder",    icon: "🐍", gradient: "linear-gradient(135deg,#11998e,#38ef7d)", category: "Popular", players: "1.9L playing", minFee: "₹2" },
  { id: "bubble",       name: "Bubble Shooter",    icon: "🫧", gradient: "linear-gradient(135deg,#f093fb,#f5576c)", category: "Popular", players: "2.4L playing", minFee: "₹1" },
  { id: "pool3d",       name: "8 Ball Pool",       icon: "🎱", gradient: "linear-gradient(135deg,#166534,#14532d)", category: "Popular", players: "2.5L playing", minFee: "₹5" },
  // Action
  { id: "axemaster",    name: "Axe Master 3D",     icon: "🪓", gradient: "linear-gradient(135deg,#5c3d1e,#8B4513)", category: "Action",  players: "1.1L playing", minFee: "₹5" },
  { id: "slapfest",     name: "Slap Fest",         icon: "👋", gradient: "linear-gradient(135deg,#FFD700,#ff8c00)", category: "Action",  players: "1.9L playing", minFee: "₹5" },
  { id: "sheepbattle",  name: "Sheep Battle 3D",   icon: "🐑", gradient: "linear-gradient(135deg,#a3e635,#4d7c0f)", category: "Action",  players: "1.7L playing", minFee: "₹5" },
  { id: "fruitchop",    name: "Fruit Chop 3D",     icon: "🍉", gradient: "linear-gradient(135deg,#22c55e,#15803d)", category: "Action",  players: "2.0L playing", minFee: "₹5" },
  { id: "angrymonsters",name: "Angry Monsters",    icon: "👾", gradient: "linear-gradient(135deg,#ff0099,#493240)", category: "Action",  players: "1.2L playing", minFee: "₹5" },
  // Sports
  { id: "crickettd20",  name: "Cricket T20",       icon: "🏏", gradient: "linear-gradient(135deg,#ff8c00,#FFD700)", category: "Sports",  players: "4.8L playing", minFee: "₹5" },
  { id: "pool3d",       name: "Pool 3D",           icon: "🎱", gradient: "linear-gradient(135deg,#166534,#14532d)", category: "Sports",  players: "2.5L playing", minFee: "₹5" },
  { id: "archery",      name: "Archery",           icon: "🏹", gradient: "linear-gradient(135deg,#1a1a2e,#16213e)", category: "Sports",  players: "1.3L playing", minFee: "₹5" },
  { id: "basketball",   name: "Basketball",        icon: "🏀", gradient: "linear-gradient(135deg,#ff6b35,#f7c59f)", category: "Sports",  players: "1.5L playing", minFee: "₹5" },
  { id: "penalty",      name: "Penalty Shootout",  icon: "⚽", gradient: "linear-gradient(135deg,#134e5e,#71b280)", category: "Sports",  players: "2.1L playing", minFee: "₹5" },
  { id: "stumpit",      name: "Stump It",          icon: "🏏", gradient: "linear-gradient(135deg,#FFD700,#ff4e00)", category: "Sports",  players: "1.1L playing", minFee: "₹5" },
  // Racing
  { id: "mrracer",      name: "Mr. Racer 3D",      icon: "🏎️", gradient: "linear-gradient(135deg,#ff3300,#ff8800)", category: "Racing",  players: "2.3L playing", minFee: "₹5" },
  { id: "bikeracing",   name: "Bike Racing",       icon: "🏍️", gradient: "linear-gradient(135deg,#1a1a2e,#ff6600)", category: "Racing",  players: "1.4L playing", minFee: "₹5" },
  { id: "gearup",       name: "Gear Up",           icon: "⚙️", gradient: "linear-gradient(135deg,#434343,#000000)", category: "Racing",  players: "1.0L playing", minFee: "₹5" },
  { id: "hillclimber",  name: "Hill Climber",      icon: "🚙", gradient: "linear-gradient(135deg,#56ab2f,#a8e063)", category: "Racing",  players: "1.2L playing", minFee: "₹5" },
  // Arcade
  { id: "candy",        name: "Candy Match",       icon: "🍬", gradient: "linear-gradient(135deg,#FF4081,#00E5FF)", category: "Arcade",  players: "1.6L playing", minFee: "₹5" },
  { id: "bricksbreaker",name: "Bricks Breaker 3D", icon: "🧱", gradient: "linear-gradient(135deg,#00e5ff,#0077aa)", category: "Arcade",  players: "1.5L playing", minFee: "₹5" },
  { id: "metrosurfer",  name: "Metro Surfer",      icon: "🏃", gradient: "linear-gradient(135deg,#1e3c72,#2a5298)", category: "Arcade",  players: "1.8L playing", minFee: "₹5" },
  { id: "knifeup",      name: "Knife Up",          icon: "🗡️", gradient: "linear-gradient(135deg,#4facfe,#00f2fe)", category: "Arcade",  players: "1.8L playing", minFee: "₹5" },
  { id: "flyme",        name: "Fly Me",            icon: "✈️", gradient: "linear-gradient(135deg,#a8edea,#fed6e3)", category: "Arcade",  players: "1.1L playing", minFee: "₹5" },
  { id: "bottleshoot",  name: "Bottle Shoot",      icon: "🍾", gradient: "linear-gradient(135deg,#ffd89b,#19547b)", category: "Arcade",  players: "1.3L playing", minFee: "₹5" },
  { id: "liquidsort",   name: "Liquid Sort",       icon: "🧪", gradient: "linear-gradient(135deg,#7F00FF,#E100FF)", category: "Arcade",  players: "1.2L playing", minFee: "₹5" },
  { id: "bearrun",      name: "Bear Run",          icon: "🐻", gradient: "linear-gradient(135deg,#f7971e,#ffd200)", category: "Arcade",  players: "1.0L playing", minFee: "₹5" },
  // Card
  { id: "rummy",        name: "Rummy",             icon: "🃏", gradient: "linear-gradient(135deg,#ff6b6b,#c0392b)", category: "Card",    players: "3.5L playing", minFee: "₹5" },
  { id: "poker",        name: "Poker",             icon: "♦️", gradient: "linear-gradient(135deg,#00c851,#007e33)", category: "Card",    players: "1.5L playing", minFee: "₹5" },
  { id: "solitaire",    name: "Solitaire",         icon: "🃏", gradient: "linear-gradient(135deg,#e91e8c,#6a0050)", category: "Card",    players: "2.1L playing", minFee: "₹5" },
  { id: "callbreak",    name: "Call Break",        icon: "♠️", gradient: "linear-gradient(135deg,#4169E1,#1a237e)", category: "Card",    players: "2.2L playing", minFee: "₹5" },
  { id: "twenty1",      name: "21 Card",           icon: "🃏", gradient: "linear-gradient(135deg,#FFD700,#ff8c00)", category: "Card",    players: "2.8L playing", minFee: "₹5" },
  // Puzzle
  { id: "hexa2048",     name: "2048 Hexa 3D",      icon: "🔷", gradient: "linear-gradient(135deg,#FFD700,#b8860b)", category: "Puzzle",  players: "1.4L playing", minFee: "₹5" },
  { id: "alienfusion",  name: "Alien Fusion",      icon: "👽", gradient: "linear-gradient(135deg,#a855f7,#6d28d9)", category: "Puzzle",  players: "1.3L playing", minFee: "₹5" },
  { id: "watersort",    name: "Water Sort",        icon: "💧", gradient: "linear-gradient(135deg,#2980B9,#6DD5FA)", category: "Puzzle",  players: "1.1L playing", minFee: "₹5" },
  { id: "bricksbreaker",name: "Bricks Breaker 3D", icon: "🧱", gradient: "linear-gradient(135deg,#00e5ff,#0077aa)", category: "Puzzle",  players: "1.5L playing", minFee: "₹5" },
] as const;

// Visual overrides per Firestore game ID — gradient, players, prize text, display category
const GAME_VISUALS: Record<string, { gradient: string; players: string; prize: string; category: string; icon: string }> = {
  ludo:     { gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", players: "4.2L playing", prize: "₹1,000",    category: "Board",     icon: "🎲" },
  worldwar: { gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", players: "8.4L playing", prize: "₹1,00,000", category: "E-Sports",  icon: "⚔️" },
  carrom:   { gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)", players: "2.9L playing", prize: "₹3,000",    category: "Board",     icon: "🎯" },
  snakes:   { gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", players: "1.9L playing", prize: "₹8,000",    category: "Board",     icon: "🐍" },
  bubble:   { gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", players: "2.4L playing", prize: "₹5,000",    category: "Casual",    icon: "🫧" },
  candy:    { gradient: "linear-gradient(135deg, #FF4081 0%, #00E5FF 100%)", players: "3.1L playing", prize: "₹10,000",   category: "Puzzle",    icon: "🍬" },
  cricket:      { gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", players: "6.1L playing", prize: "₹25,000",  category: "Cricket",    icon: "🏏" },
  solitaire:    { gradient: "linear-gradient(135deg, #e91e8c 0%, #6a0050 100%)", players: "2.1L playing", prize: "₹5,000",   category: "Card Games", icon: "🃏" },
  chess:        { gradient: "linear-gradient(135deg, #8a8a8a 0%, #2d2d2d 100%)", players: "1.8L playing", prize: "₹8,000",   category: "Board",      icon: "♟️" },
  discfootball: { gradient: "linear-gradient(135deg, #00ff87 0%, #007e3a 100%)", players: "1.2L playing", prize: "₹6,000",   category: "Sports",     icon: "🥏" },
  rummy:        { gradient: "linear-gradient(135deg, #ff6b6b 0%, #c0392b 100%)", players: "3.5L playing", prize: "₹15,000",  category: "Card Games", icon: "🃏" },
  callbreak:    { gradient: "linear-gradient(135deg, #4169E1 0%, #1a237e 100%)", players: "2.2L playing", prize: "₹12,000",  category: "Card Games", icon: "♠️" },
  poker:        { gradient: "linear-gradient(135deg, #00c851 0%, #007e33 100%)", players: "1.5L playing", prize: "₹20,000",  category: "Card Games", icon: "♦️" },
  twenty1:      { gradient: "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)", players: "2.8L playing", prize: "₹18,000",  category: "Card Games", icon: "🃏" },
  axemaster:    { gradient: "linear-gradient(135deg, #5c3d1e 0%, #8B4513 100%)", players: "1.1L playing", prize: "₹12,000",  category: "Arcade",     icon: "🪓" },
  mrracer:      { gradient: "linear-gradient(135deg, #ff3300 0%, #ff8800 100%)", players: "2.3L playing", prize: "₹14,000",  category: "Sports",     icon: "🏎️" },
  bricksbreaker:{ gradient: "linear-gradient(135deg, #00e5ff 0%, #0077aa 100%)", players: "1.5L playing", prize: "₹10,000",  category: "Arcade",     icon: "🧱" },
  slapfest:     { gradient: "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)", players: "1.9L playing", prize: "₹16,000",  category: "Battle",     icon: "👋" },
  fruitchop:    { gradient: "linear-gradient(135deg, #22c55e 0%, #15803d 100%)", players: "2.0L playing", prize: "₹11,000",  category: "Casual",     icon: "🍉" },
  alienfusion:  { gradient: "linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)", players: "1.3L playing", prize: "₹9,000",   category: "Puzzle",     icon: "👽" },
  pool3d:       { gradient: "linear-gradient(135deg, #166534 0%, #14532d 100%)", players: "2.5L playing", prize: "₹20,000",  category: "Sports",     icon: "🎱" },
  crickettd20:  { gradient: "linear-gradient(135deg, #ff8c00 0%, #FFD700 100%)", players: "4.8L playing", prize: "₹30,000",  category: "Cricket",    icon: "🏏" },
  sheepbattle:  { gradient: "linear-gradient(135deg, #a3e635 0%, #4d7c0f 100%)", players: "1.7L playing", prize: "₹13,000",  category: "Battle",     icon: "🐑" },
  hexa2048:     { gradient: "linear-gradient(135deg, #FFD700 0%, #b8860b 100%)", players: "1.4L playing", prize: "₹8,000",   category: "Puzzle",     icon: "🔷" },
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)";

interface DashboardProps {
  onSpin?: () => void;
  onLudo?: (fee?: number) => void;
  onWorldWar?: (fee?: number) => void;
  onSnakes?: (fee?: number) => void;
  onCarrom?: (fee?: number) => void;
  onBubble?: (fee?: number) => void;
  onCandy?: (fee?: number) => void;
  onChess?: (fee?: number) => void;
  onDiscFootball?: (fee?: number) => void;
  onRummy?: (fee?: number) => void;
  onCallBreak?: (fee?: number) => void;
  onPoker?: (fee?: number) => void;
  onSolitaire?: (fee?: number) => void;
  onTwenty1?: (fee?: number) => void;
  onAxeMaster?: (fee?: number) => void;
  onMrRacer?: (fee?: number) => void;
  onBricksBreaker?: (fee?: number) => void;
  onSlapFest?: (fee?: number) => void;
  onFruitChop?: (fee?: number) => void;
  onAlienFusion?: (fee?: number) => void;
  onPool3D?: (fee?: number) => void;
  onCricketTD20?: (fee?: number) => void;
  onSheepBattle?: (fee?: number) => void;
  onHexa2048?: (fee?: number) => void;
  onMetroSurfer?: (fee?: number) => void;
  onKnifeUp?: (fee?: number) => void;
  onAngryMonsters?: (fee?: number) => void;
  onBearRun?: (fee?: number) => void;
  onArchery?: (fee?: number) => void;
  onBasketball?: (fee?: number) => void;
  onPenalty?: (fee?: number) => void;
  onStumpIt?: (fee?: number) => void;
  onBikeRacing?: (fee?: number) => void;
  onGearUp?: (fee?: number) => void;
  onHillClimber?: (fee?: number) => void;
  onWallet?: () => void;
  onLeaderboard?: () => void;
  appConfig?: import("@/firebase/firestore.service").AppConfig;
}

// Games that have a real implementation vs coming soon
const IMPLEMENTED_GAMES = new Set(["ludo","5","solitaire","11","snakes","2","carrom","3","bubble","1","candy","9","chess","rummy","callbreak","poker","discfootball","twenty1","axemaster","mrracer","bricksbreaker","slapfest","fruitchop","alienfusion","pool3d","crickettd20","sheepbattle","hexa2048","metrosurfer","knifeup","angrymonsters","bearrun","archery","basketball","penalty","stumpit","bikeracing","gearup","hillclimber"]);

export default function Dashboard({ onSpin, onLudo, onWorldWar, onSnakes, onCarrom, onBubble, onCandy, onChess, onDiscFootball, onRummy, onCallBreak, onPoker, onSolitaire, onTwenty1, onAxeMaster, onMrRacer, onBricksBreaker, onSlapFest, onFruitChop, onAlienFusion, onPool3D, onCricketTD20, onSheepBattle, onHexa2048, onMetroSurfer, onKnifeUp, onAngryMonsters, onBearRun, onArchery, onBasketball, onPenalty, onStumpIt, onBikeRacing, onGearUp, onHillClimber, onWallet, onLeaderboard, appConfig }: DashboardProps) {
  const { total } = useWallet();
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [liveGames, setLiveGames] = useState<GameConfig[]>([]);
  const [pendingGame, setPendingGame] = useState<SheetGame | null>(null);
  const bannerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function openEntrySheet(game: { id: string; name: string; icon: string; gradient: string; players: string }) {
    const gameConfig = liveGames.find((g) => g.id === game.id);
    const entryFees = gameConfig?.entryFees;
    const comingSoon = !IMPLEMENTED_GAMES.has(game.id);
    setPendingGame({
      id: game.id, name: game.name, icon: game.icon,
      gradient: game.gradient, players: game.players,
      entryFees, comingSoon,
    });
  }

  function handlePlay(fee: number) {
    if (!pendingGame) return;
    const gameId = pendingGame.id;
    setPendingGame(null);
    // Fee is deducted by GameEntrySheet on PLAY NOW — games must NOT deduct internally
    if (gameId === "worldwar"  || gameId === "7")  { onWorldWar?.(fee); return; }
    if (gameId === "snakes"    || gameId === "2")  { onSnakes?.(fee);   return; }
    if (gameId === "carrom"    || gameId === "3")  { onCarrom?.(fee);   return; }
    if (gameId === "bubble"    || gameId === "1")  { onBubble?.(fee);   return; }
    if (gameId === "candy"       || gameId === "9")   { onCandy?.(fee);        return; }
    if (gameId === "chess")                           { onChess?.(fee);        return; }
    if (gameId === "discfootball")                    { onDiscFootball?.(fee); return; }
    if (gameId === "rummy")                           { onRummy?.(fee);        return; }
    if (gameId === "callbreak")                       { onCallBreak?.(fee);    return; }
    if (gameId === "poker")                           { onPoker?.(fee);        return; }
    if (gameId === "solitaire"   || gameId === "11")  { onSolitaire?.(fee);    return; }
    if (gameId === "twenty1")                         { onTwenty1?.(fee);      return; }
    if (gameId === "axemaster")                       { onAxeMaster?.(fee);    return; }
    if (gameId === "mrracer")                         { onMrRacer?.(fee);      return; }
    if (gameId === "bricksbreaker")                   { onBricksBreaker?.(fee);return; }
    if (gameId === "slapfest")                        { onSlapFest?.(fee);     return; }
    if (gameId === "fruitchop")                       { onFruitChop?.(fee);    return; }
    if (gameId === "alienfusion")                     { onAlienFusion?.(fee);  return; }
    if (gameId === "pool3d")                          { onPool3D?.(fee);       return; }
    if (gameId === "crickettd20")                     { onCricketTD20?.(fee);  return; }
    if (gameId === "sheepbattle")                     { onSheepBattle?.(fee);  return; }
    if (gameId === "hexa2048")                        { onHexa2048?.(fee);     return; }
    if (gameId === "metrosurfer")                     { onMetroSurfer?.(fee);  return; }
    if (gameId === "knifeup")                         { onKnifeUp?.(fee);      return; }
    if (gameId === "angrymonsters")                   { onAngryMonsters?.(fee);return; }
    if (gameId === "bearrun")                         { onBearRun?.(fee);      return; }
    if (gameId === "archery")                         { onArchery?.(fee);      return; }
    if (gameId === "basketball")                      { onBasketball?.(fee);   return; }
    if (gameId === "penalty")                         { onPenalty?.(fee);      return; }
    if (gameId === "stumpit")                         { onStumpIt?.(fee);      return; }
    if (gameId === "bikeracing")                      { onBikeRacing?.(fee);   return; }
    if (gameId === "gearup")                          { onGearUp?.(fee);       return; }
    if (gameId === "hillclimber")                     { onHillClimber?.(fee);  return; }
    // ludo + all unrecognised → ludo handler
    onLudo?.(fee);
  }

  // Auto-scroll banners
  useEffect(() => {
    bannerRef.current = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
    }, 3000);
    return () => {
      if (bannerRef.current) clearInterval(bannerRef.current);
    };
  }, []);

  // Seed + subscribe to Firestore games catalog
  useEffect(() => {
    if (FIREBASE_ENABLED) {
      seedGamesIfEmpty().catch(() => {});
    }
    return subscribeGames(setLiveGames);
  }, []);

  // Featured game for hero card (from Firestore)
  const featuredGame = liveGames.find((g) => g.isFeatured && g.isActive);

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: "#0a0a0f", maxWidth: "480px", margin: "0 auto" }}
    >
      {/* ─── HEADER ─── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3"
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "rgba(10,10,15,0.92)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* Profile Avatar */}
        <motion.button
          data-testid="button-profile-avatar"
          whileTap={{ scale: 0.93 }}
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold cursor-pointer"
          style={{
            background: "linear-gradient(135deg, #FFD700, #ff8c00)",
            boxShadow: "0 0 10px rgba(255,215,0,0.4)",
          }}
        >
          A
        </motion.button>

        {/* WINGGO Logo */}
        <h1 className="font-black text-2xl tracking-tighter leading-none">
          <span className="text-white">WIN</span>
          <span
            className="text-[#FFD700]"
            style={{
              textShadow: "0 0 8px rgba(255,215,0,0.8), 0 0 20px rgba(255,215,0,0.4)",
            }}
          >
            GGO
          </span>
        </h1>

        {/* Right: Bell + Spin + Wallet */}
        <div className="flex items-center gap-2">
          {/* Bell */}
          <motion.button
            data-testid="button-notifications"
            whileTap={{ scale: 0.9 }}
            className="relative w-8 h-8 flex items-center justify-center cursor-pointer"
          >
            <span className="text-lg">🔔</span>
            <span
              className="absolute top-0 right-0 w-2 h-2 rounded-full"
              style={{ background: "#ff4e00" }}
            />
          </motion.button>

          {/* Daily Spin Icon */}
          <motion.button
            data-testid="button-daily-spin"
            onClick={() => setShowSpinModal(true)}
            whileTap={{ scale: 0.88 }}
            className="relative w-8 h-8 flex items-center justify-center cursor-pointer rounded-full"
            style={{
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.35)",
            }}
            animate={{
              boxShadow: [
                "0 0 6px rgba(139,92,246,0.5), 0 0 12px rgba(255,215,0,0.2)",
                "0 0 12px rgba(255,215,0,0.7), 0 0 20px rgba(139,92,246,0.4)",
                "0 0 6px rgba(139,92,246,0.5), 0 0 12px rgba(255,215,0,0.2)",
              ],
            }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* SVG Fortune Wheel */}
            <motion.svg
              width="20" height="20" viewBox="0 0 20 20" fill="none"
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            >
              {/* 8 pie segments */}
              {[
                { start: 0,   end: 45,  color: "#FFD700" },
                { start: 45,  end: 90,  color: "#EF4444" },
                { start: 90,  end: 135, color: "#3B82F6" },
                { start: 135, end: 180, color: "#10B981" },
                { start: 180, end: 225, color: "#8B5CF6" },
                { start: 225, end: 270, color: "#F97316" },
                { start: 270, end: 315, color: "#EC4899" },
                { start: 315, end: 360, color: "#06B6D4" },
              ].map((seg, i) => {
                const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
                const x1 = 10 + 9 * Math.cos(toRad(seg.start));
                const y1 = 10 + 9 * Math.sin(toRad(seg.start));
                const x2 = 10 + 9 * Math.cos(toRad(seg.end));
                const y2 = 10 + 9 * Math.sin(toRad(seg.end));
                return (
                  <path
                    key={i}
                    d={`M10,10 L${x1},${y1} A9,9 0 0,1 ${x2},${y2} Z`}
                    fill={seg.color}
                    stroke="#07070d"
                    strokeWidth="0.8"
                  />
                );
              })}
              {/* Center dot */}
              <circle cx="10" cy="10" r="2.5" fill="#07070d" />
              <circle cx="10" cy="10" r="1.5" fill="#FFD700" />
            </motion.svg>

            {/* "FREE" dot badge */}
            <span
              className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full flex items-center justify-center"
              style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", fontSize: "5px", fontWeight: 900, color: "#000" }}
            >
              !
            </span>
          </motion.button>

          {/* Wallet Pill — live balance */}
          <motion.button
            data-testid="button-wallet"
            whileTap={{ scale: 0.93 }}
            onClick={() => onWallet?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer relative"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,140,0,0.12))",
              border: "1px solid rgba(255,215,0,0.35)",
              boxShadow: "0 0 14px rgba(255,215,0,0.22), 0 0 28px rgba(255,215,0,0.08)",
            }}
            animate={{
              boxShadow: [
                "0 0 10px rgba(255,215,0,0.2), 0 0 20px rgba(255,215,0,0.06)",
                "0 0 18px rgba(255,215,0,0.4), 0 0 32px rgba(255,215,0,0.15)",
                "0 0 10px rgba(255,215,0,0.2), 0 0 20px rgba(255,215,0,0.06)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="text-sm">🪙</span>
            <AnimatePresence mode="wait">
              <motion.span
                key={total}
                className="font-black text-sm"
                style={{ color: "#FFD700" }}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.22 }}
              >
                ₹{total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </motion.span>
            </AnimatePresence>
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-black font-black text-xs"
              style={{ background: "#FFD700", boxShadow: "0 0 6px rgba(255,215,0,0.6)" }}
            >
              +
            </span>
          </motion.button>
        </div>
      </header>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <main className="flex-1 overflow-y-auto pb-24 pt-16">

        {/* ─── BANNER SLIDER ─── */}
        <div className="relative mx-4 mt-4 rounded-2xl overflow-hidden" style={{ height: "180px" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentBanner}
              className="absolute inset-0 flex flex-col justify-between p-5"
              style={{ background: BANNERS[currentBanner].gradient }}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            >
              {/* Tag */}
              <span
                className="self-start px-2 py-0.5 rounded-full text-xs font-black tracking-wider"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  color: BANNERS[currentBanner].accent,
                  border: `1px solid ${BANNERS[currentBanner].accent}40`,
                }}
              >
                {BANNERS[currentBanner].tag}
              </span>

              {/* Text */}
              <div>
                <h2
                  className="text-2xl font-black leading-tight"
                  style={{ color: BANNERS[currentBanner].accent }}
                >
                  {BANNERS[currentBanner].title}
                </h2>
                <p className="text-sm mt-0.5 opacity-80" style={{ color: BANNERS[currentBanner].accent }}>
                  {BANNERS[currentBanner].subtitle}
                </p>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="mt-3 px-4 py-1.5 rounded-full text-xs font-bold cursor-pointer"
                  style={{
                    background: BANNERS[currentBanner].accent,
                    color: "#000",
                  }}
                >
                  Play Now →
                </motion.button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Dot indicators */}
          <div className="absolute bottom-3 right-4 flex gap-1.5 z-10">
            {BANNERS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentBanner(i)}
                className="rounded-full transition-all duration-300 cursor-pointer"
                style={{
                  width: i === currentBanner ? "16px" : "6px",
                  height: "6px",
                  background: i === currentBanner ? "#FFD700" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>
        </div>

        {/* ─── ANNOUNCEMENT BANNER TICKER ─── */}
        {(appConfig?.announcementActive !== false) && (
          <motion.div className="mx-4 mt-3 px-4 py-2.5 rounded-2xl flex items-center gap-3 overflow-hidden cursor-pointer"
            style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.2)" }}
            whileTap={{ scale: 0.98 }}>
            <motion.div className="w-2 h-2 rounded-full shrink-0"
              style={{ background: "#FFD700" }}
              animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }} />
            <div className="flex-1 overflow-hidden">
              <motion.p className="text-xs font-bold whitespace-nowrap"
                style={{ color: "#FFD700" }}
                animate={{ x: ["100%", "-100%"] }}
                transition={{ duration: 18, repeat: Infinity, ease: "linear" }}>
                {appConfig?.announcementBanner ?? "🏆 Play & Win Real Cash! Grand Ludo Tournament every Sunday at 8 PM IST"}
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* ─── FEATURED GAME HERO CARD ─── */}
        {(() => {
          const featured = featuredGame;
          if (!featured) return null;
          const v = GAME_VISUALS[featured.id ?? ""] ?? {};
          return (
            <motion.div
              className="mx-4 mt-3 rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: v.gradient ?? "linear-gradient(135deg, #FFD700 0%, #ff8c00 100%)", boxShadow: "0 0 30px rgba(255,215,0,0.3)" }}
              whileTap={{ scale: 0.98 }}
              onClick={() => openEntrySheet({
                id: featured.id ?? "", name: featured.name,
                icon: v.icon ?? featured.thumbnail, gradient: v.gradient ?? FALLBACK_GRADIENT,
                players: v.players ?? "1L+ playing",
              })}
              animate={{ boxShadow: ["0 0 20px rgba(255,215,0,0.2)", "0 0 40px rgba(255,215,0,0.5)", "0 0 20px rgba(255,215,0,0.2)"] }}
              transition={{ duration: 2.5, repeat: Infinity }}>
              <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(0,0,0,0.35)", color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                      ⭐ FEATURED
                    </span>
                  </div>
                  <h3 className="text-white font-black text-xl leading-tight">{featured.name}</h3>
                  <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.75)" }}>
                    Win up to ₹{(Math.max(...featured.entryFees) * featured.prizeMultiplier * 10).toFixed(0)} · Entry from ₹{Math.min(...featured.entryFees)}
                  </p>
                  <div className="mt-3 px-4 py-2 rounded-full inline-block font-black text-sm"
                    style={{ background: "#fff", color: "#000" }}>
                    Play Now →
                  </div>
                </div>
                <span className="text-7xl">{v.icon ?? featured.thumbnail}</span>
              </div>
            </motion.div>
          );
        })()}

        {/* ─── SPIN WHEEL CENTER FEATURE ─── */}
        <motion.button
          data-testid="button-spin-promo"
          onClick={() => setShowSpinModal(true)}
          whileTap={{ scale: 0.97 }}
          className="mx-4 mt-4 w-[calc(100%-2rem)] rounded-3xl overflow-hidden cursor-pointer relative"
          style={{
            background: "linear-gradient(135deg, #0f0524 0%, #1e0b4a 40%, #2d1060 70%, #1e0b4a 100%)",
            border: "1.5px solid rgba(139,92,246,0.45)",
          }}
          animate={{
            boxShadow: [
              "0 0 24px rgba(139,92,246,0.25), 0 0 48px rgba(139,92,246,0.08)",
              "0 0 40px rgba(255,215,0,0.35), 0 0 70px rgba(139,92,246,0.2)",
              "0 0 24px rgba(139,92,246,0.25), 0 0 48px rgba(139,92,246,0.08)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* Top shimmer */}
          <motion.div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, #a78bfa, #FFD700, #a78bfa, transparent)" }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />

          <div className="flex items-center justify-between px-5 py-5">
            {/* Left: text info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <motion.div className="w-2 h-2 rounded-full"
                  style={{ background: "#FFD700" }}
                  animate={{ opacity: [1, 0.2, 1], scale: [1, 1.4, 1] }}
                  transition={{ duration: 1, repeat: Infinity }} />
                <span className="text-[10px] font-black tracking-widest uppercase" style={{ color: "#a78bfa" }}>
                  Free Daily Reward
                </span>
              </div>
              <div className="text-white font-black text-2xl leading-tight mb-1">
                Spin &amp; Win!
              </div>
              <div className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
                Win up to <span className="font-black" style={{ color: "#FFD700" }}>₹20 Cash</span> every day
              </div>
              {/* Reward chips */}
              <div className="flex gap-1.5 flex-wrap">
                {["₹5", "₹10", "₹20"].map((amt) => (
                  <span key={amt} className="px-2.5 py-1 rounded-full text-xs font-black"
                    style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
                    {amt}
                  </span>
                ))}
                <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" }}>
                  Bonus
                </span>
              </div>
            </div>

            {/* Right: spinning wheel SVG */}
            <div className="shrink-0 ml-4 flex flex-col items-center gap-2">
              {/* Pointer */}
              <div className="w-3 h-3 relative">
                <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0"
                  style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "12px solid #FFD700" }} />
              </div>
              {/* Wheel */}
              <motion.svg
                width="100" height="100" viewBox="0 0 100 100"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                style={{ filter: "drop-shadow(0 0 12px rgba(139,92,246,0.6))" }}
              >
                {[
                  { start: 0,   end: 45,  color: "#FFD700", label: "₹5"  },
                  { start: 45,  end: 90,  color: "#374151", label: "🍀"  },
                  { start: 90,  end: 135, color: "#EF4444", label: "₹10" },
                  { start: 135, end: 180, color: "#3B82F6", label: "🪙"  },
                  { start: 180, end: 225, color: "#10B981", label: "₹2"  },
                  { start: 225, end: 270, color: "#8B5CF6", label: "🎁"  },
                  { start: 270, end: 315, color: "#F97316", label: "🪙"  },
                  { start: 315, end: 360, color: "#EC4899", label: "₹20" },
                ].map((seg, i) => {
                  const toRad = (d: number) => ((d - 90) * Math.PI) / 180;
                  const cx = 50, cy = 50, r = 46, ir = 12;
                  const x1 = cx + r * Math.cos(toRad(seg.start));
                  const y1 = cy + r * Math.sin(toRad(seg.start));
                  const x2 = cx + r * Math.cos(toRad(seg.end));
                  const y2 = cy + r * Math.sin(toRad(seg.end));
                  const ix1 = cx + ir * Math.cos(toRad(seg.start));
                  const iy1 = cy + ir * Math.sin(toRad(seg.start));
                  const ix2 = cx + ir * Math.cos(toRad(seg.end));
                  const iy2 = cy + ir * Math.sin(toRad(seg.end));
                  return (
                    <path key={i}
                      d={`M${ix1},${iy1} L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 0,0 ${ix1},${iy1} Z`}
                      fill={seg.color} stroke="#0f0524" strokeWidth="1.2" />
                  );
                })}
                <circle cx="50" cy="50" r="12" fill="#1a0a3e" stroke="#FFD700" strokeWidth="2" />
                <circle cx="50" cy="50" r="5" fill="#FFD700" />
              </motion.svg>

              <motion.div
                className="px-4 py-1.5 rounded-full font-black text-xs text-black"
                style={{ background: "linear-gradient(90deg, #FFD700, #ff8c00)", boxShadow: "0 0 12px rgba(255,215,0,0.5)" }}
                animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                SPIN NOW
              </motion.div>
            </div>
          </div>
        </motion.button>

        {/* ─── TOP 5 FEATURED GAMES ─── */}
        <div className="mt-5 px-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-base">🔥 Popular Games</h3>
            <span className="text-xs font-bold" style={{ color: "#FFD700" }}>5 Games Live</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {[
              { id: "ludo",    name: "Ludo",          icon: "🎲", gradient: "linear-gradient(135deg, #a18cd1, #fbc2eb)", minFee: "₹1" },
              { id: "solitaire",name: "Solitaire",      icon: "🃏", gradient: "linear-gradient(135deg, #e91e8c, #6a0050)", minFee: "₹1" },
              { id: "worldwar",name: "World War",      icon: "⚔️", gradient: "linear-gradient(135deg, #667eea, #764ba2)", minFee: "₹10" },
              { id: "snakes",  name: "Snake & Ladder", icon: "🐍", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", minFee: "₹2" },
              { id: "carrom",  name: "Carrom",         icon: "🎯", gradient: "linear-gradient(135deg, #f7971e, #ffd200)", minFee: "₹5" },
              { id: "bubble",  name: "Bubble Shooter", icon: "🫧", gradient: "linear-gradient(135deg, #f093fb, #f5576c)", minFee: "₹5" },
              { id: "candy",        name: "Candy Match",    icon: "🍬", gradient: "linear-gradient(135deg, #FF4081, #00E5FF)",   minFee: "₹5" },
              { id: "chess",        name: "Chess",          icon: "♟️", gradient: "linear-gradient(135deg, #8a8a8a, #2d2d2d)",   minFee: "₹5" },
              { id: "rummy",        name: "Rummy",          icon: "🃏", gradient: "linear-gradient(135deg, #ff6b6b, #c0392b)",   minFee: "₹5" },
              { id: "callbreak",    name: "Call Break",     icon: "♠️", gradient: "linear-gradient(135deg, #4169E1, #1a237e)",   minFee: "₹5" },
              { id: "poker",        name: "Poker",          icon: "♦️", gradient: "linear-gradient(135deg, #00c851, #007e33)",   minFee: "₹5" },
              { id: "solitaire",    name: "Solitaire",      icon: "🃏", gradient: "linear-gradient(135deg, #e91e8c, #6a0050)",   minFee: "₹5" },
              { id: "twenty1",      name: "21 Card",        icon: "🃏", gradient: "linear-gradient(135deg, #FFD700, #ff8c00)",   minFee: "₹5" },
              { id: "discfootball", name: "Disc Football",  icon: "🥏", gradient: "linear-gradient(135deg, #00ff87, #007e3a)",   minFee: "₹5" },
              { id: "axemaster",    name: "Axe Master 3D", icon: "🪓", gradient: "linear-gradient(135deg, #5c3d1e, #8B4513)",    minFee: "₹5" },
              { id: "mrracer",      name: "Mr. Racer 3D",  icon: "🏎️", gradient: "linear-gradient(135deg, #ff3300, #ff8800)",    minFee: "₹5" },
              { id: "bricksbreaker",name: "Bricks 3D",     icon: "🧱", gradient: "linear-gradient(135deg, #00e5ff, #0077aa)",    minFee: "₹5" },
              { id: "slapfest",     name: "Slap Fest",     icon: "👋", gradient: "linear-gradient(135deg, #FFD700, #ff8c00)",    minFee: "₹5" },
              { id: "fruitchop",    name: "Fruit Chop",    icon: "🍉", gradient: "linear-gradient(135deg, #22c55e, #15803d)",    minFee: "₹5" },
              { id: "alienfusion",  name: "Alien Fusion",  icon: "👽", gradient: "linear-gradient(135deg, #a855f7, #6d28d9)",    minFee: "₹5" },
              { id: "pool3d",       name: "Pool 3D",       icon: "🎱", gradient: "linear-gradient(135deg, #166534, #14532d)",    minFee: "₹5" },
              { id: "crickettd20",  name: "Cricket T20",   icon: "🏏", gradient: "linear-gradient(135deg, #ff8c00, #FFD700)",    minFee: "₹5" },
              { id: "sheepbattle",  name: "Sheep Battle",  icon: "🐑", gradient: "linear-gradient(135deg, #a3e635, #4d7c0f)",    minFee: "₹5" },
              { id: "hexa2048",     name: "2048 Hexa",     icon: "🔷", gradient: "linear-gradient(135deg, #FFD700, #b8860b)",    minFee: "₹5" },
            ].map((g) => {
              return (
                <motion.div
                  key={g.id}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => openEntrySheet({ id: g.id, name: g.name, icon: g.icon, gradient: g.gradient, players: "1L+ playing" })}
                  className="flex-shrink-0 w-28 rounded-2xl overflow-hidden cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="relative h-20 flex items-center justify-center"
                    style={{ background: g.gradient, opacity: g.id === "worldwar" ? 0.75 : 1 }}>
                    <span className="text-4xl">{g.icon}</span>
                    {g.id === "worldwar" ? (
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.4)" }}>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded-lg"
                          style={{ background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.5)", color: "#FFD700" }}>
                          SOON
                        </span>
                      </div>
                    ) : (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-lg text-black"
                        style={{ background: "#FFD700" }}>
                        {g.minFee}+
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-white font-bold text-xs leading-tight truncate">{g.name}</div>
                    {g.id === "worldwar" ? (
                      <div className="mt-1.5 w-full py-1 rounded-lg text-center text-[10px] font-black"
                        style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", color: "rgba(255,215,0,0.5)" }}>
                        Coming Soon
                      </div>
                    ) : (
                      <div className="mt-1.5 w-full py-1 rounded-lg text-center text-[10px] font-black text-black"
                        style={{ background: "linear-gradient(90deg, #FFD700, #ff8c00)" }}>
                        Play
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ─── QUICK STATS STRIP ─── */}
        <div className="flex gap-3 mx-4 mt-4 overflow-x-auto pb-1 no-scrollbar">
          {[
            { label: "Winners Today", value: "4.7L+", icon: "🏆" },
            { label: "Prize Pool", value: "₹50L", icon: "💎" },
            { label: "Live Games", value: "100+", icon: "🔴" },
            { label: "Online Players", value: "4.2L", icon: "👥" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="text-base">{stat.icon}</span>
              <div>
                <div className="text-[#FFD700] font-black text-sm leading-none">{stat.value}</div>
                <div className="text-zinc-500 text-xs mt-0.5">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ─── ALL GAME CATEGORIES ─── */}
        {CATEGORY_SECTIONS.map((section) => {
          const sectionGames = GAME_CATALOG.filter((g) => g.category === section.key);
          return (
            <div key={section.key} className="mt-7">
              {/* Section header */}
              <div className="flex items-center justify-between px-4 mb-3">
                <h3 className="text-white font-bold text-base">{section.label}</h3>
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{ background: `${section.accent}22`, color: section.accent, border: `1px solid ${section.accent}44` }}
                >
                  {sectionGames.length} Games
                </span>
              </div>

              {/* Horizontal scroll strip */}
              <div className="flex gap-3 px-4 overflow-x-auto pb-3 no-scrollbar">
                {sectionGames.map((game) => {
                  const implemented = IMPLEMENTED_GAMES.has(game.id);
                  return (
                    <motion.div
                      key={`${section.key}-${game.id}`}
                      data-testid={`card-game-${game.id}`}
                      whileTap={{ scale: 0.93 }}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => openEntrySheet({ id: game.id, name: game.name, icon: game.icon, gradient: game.gradient, players: game.players })}
                      className="flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer"
                      style={{
                        width: "120px",
                        background: "rgba(255,255,255,0.04)",
                        border: implemented
                          ? `1px solid ${section.accent}33`
                          : "1px solid rgba(255,255,255,0.07)",
                        boxShadow: implemented
                          ? `0 4px 18px ${section.accent}22`
                          : "none",
                      }}
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative flex items-center justify-center"
                        style={{ height: "90px", background: game.gradient }}
                      >
                        <span className="text-4xl" style={{ opacity: implemented ? 1 : 0.55 }}>
                          {game.icon}
                        </span>

                        {/* Coming Soon overlay */}
                        {!implemented && (
                          <div
                            className="absolute inset-0 flex items-center justify-center"
                            style={{ background: "rgba(0,0,0,0.5)" }}
                          >
                            <span
                              className="text-[8px] font-black px-1.5 py-0.5 rounded-lg"
                              style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.45)", color: "#FFD700" }}
                            >
                              SOON
                            </span>
                          </div>
                        )}

                        {/* Min fee badge */}
                        {implemented && (
                          <span
                            className="absolute top-1.5 right-1.5 rounded-md text-black font-black"
                            style={{ background: "#FFD700", fontSize: "8px", padding: "2px 5px" }}
                          >
                            {game.minFee}+
                          </span>
                        )}
                      </div>

                      {/* Card info */}
                      <div className="px-2.5 py-2">
                        <div className="text-white font-bold leading-tight truncate" style={{ fontSize: "11px" }}>
                          {game.name}
                        </div>
                        <div className="text-zinc-500 mt-0.5 truncate" style={{ fontSize: "9px" }}>
                          {game.players}
                        </div>
                        {implemented ? (
                          <div
                            className="mt-1.5 w-full rounded-lg text-center font-black text-black"
                            style={{ background: "linear-gradient(90deg,#FFD700,#ff8c00)", fontSize: "9px", padding: "4px 0" }}
                          >
                            Play Now
                          </div>
                        ) : (
                          <div
                            className="mt-1.5 w-full rounded-lg text-center font-bold"
                            style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.18)", color: "rgba(255,215,0,0.45)", fontSize: "9px", padding: "4px 0" }}
                          >
                            Soon
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="mx-4 mt-2 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
            </div>
          );
        })}
      </main>


      {/* ─── GAME ENTRY SHEET ─── */}
      <GameEntrySheet
        game={pendingGame}
        onClose={() => setPendingGame(null)}
        onPlay={handlePlay}
        onAddMoney={onWallet}
      />

      {/* ─── SPIN WHEEL OVERLAY MODAL ─── */}
      <AnimatePresence>
        {showSpinModal && (
          <>
            {/* Blurred backdrop */}
            <motion.div
              className="fixed inset-0 z-[60]"
              style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSpinModal(false)}
            />

            {/* Wheel panel — pops up from bottom */}
            <motion.div
              className="fixed inset-x-0 bottom-0 z-[70] overflow-y-auto"
              style={{ maxWidth: "480px", margin: "0 auto", maxHeight: "96vh", borderRadius: "28px 28px 0 0" }}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1" style={{ background: "#07070d", borderRadius: "28px 28px 0 0" }}>
                <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }} />
              </div>
              <SpinWheel onBack={() => setShowSpinModal(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
