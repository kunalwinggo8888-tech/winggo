import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SpinWheel from "@/pages/SpinWheel";
import { useWallet } from "@/context/useWallet";
import { subscribeGames, seedGamesIfEmpty, GameConfig } from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";
import GameEntrySheet, { SheetGame } from "@/components/GameEntrySheet";
import SolitaireEntrySheet from "@/components/SolitaireEntrySheet";

const CATEGORIES = ["All Games", "Casual", "Board", "Card Games", "E-Sports", "Cricket", "Sports", "Battle", "Arcade"];

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

const GAMES = [
  {
    id: 1,
    name: "Bubble Shooter",
    category: "Casual",
    players: "2.4L playing",
    prize: "₹5,000",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    icon: "🎈",
  },
  {
    id: 2,
    name: "Snakes & Ladders",
    category: "Board",
    players: "1.9L playing",
    prize: "₹8,000",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    icon: "🐍",
  },
  {
    id: 3,
    name: "Carrom",
    category: "Board",
    players: "2.9L playing",
    prize: "₹3,000",
    gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    icon: "🎯",
  },
  {
    id: 4,
    name: "Teen Patti",
    category: "Card Games",
    players: "5.6L playing",
    prize: "₹50,000",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    icon: "🃏",
  },
  {
    id: 5,
    name: "Ludo Classic",
    category: "Board",
    players: "4.2L playing",
    prize: "₹1,000",
    gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    icon: "🎲",
  },
  {
    id: 6,
    name: "8-Ball Pool",
    category: "Sports",
    players: "3.3L playing",
    prize: "₹4,500",
    gradient: "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)",
    icon: "🎱",
  },
  {
    id: 7,
    name: "World War",
    category: "E-Sports",
    players: "8.4L playing",
    prize: "₹1,00,000",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    icon: "⚔️",
  },
  {
    id: 8,
    name: "Cricket",
    category: "Cricket",
    players: "6.1L playing",
    prize: "₹25,000",
    gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
    icon: "🏏",
  },
  {
    id: 9,
    name: "Fruit Samurai",
    category: "Casual",
    players: "3.1L playing",
    prize: "₹2,500",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    icon: "🍉",
  },
  {
    id: 10,
    name: "Knife Up",
    category: "Casual",
    players: "1.8L playing",
    prize: "₹10,000",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    icon: "🗡️",
  },
  {
    id: 11,
    name: "Solitaire",
    category: "Card Games",
    players: "2.1L playing",
    prize: "₹5,000",
    gradient: "linear-gradient(135deg, #e91e8c 0%, #6a0050 100%)",
    icon: "🃏",
  },
];

// Visual overrides per Firestore game ID — gradient, players, prize text, display category
const GAME_VISUALS: Record<string, { gradient: string; players: string; prize: string; category: string; icon: string }> = {
  ludo:     { gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", players: "4.2L playing", prize: "₹1,000",    category: "Board",     icon: "🎲" },
  worldwar: { gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", players: "8.4L playing", prize: "₹1,00,000", category: "E-Sports",  icon: "⚔️" },
  carrom:   { gradient: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)", players: "2.9L playing", prize: "₹3,000",    category: "Board",     icon: "🎯" },
  snakes:   { gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)", players: "1.9L playing", prize: "₹8,000",    category: "Board",     icon: "🐍" },
  bubble:   { gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)", players: "2.4L playing", prize: "₹5,000",    category: "Casual",    icon: "🫧" },
  cricket:   { gradient: "linear-gradient(135deg, #f6d365 0%, #fda085 100%)", players: "6.1L playing", prize: "₹25,000",  category: "Cricket",    icon: "🏏" },
  solitaire: { gradient: "linear-gradient(135deg, #e91e8c 0%, #6a0050 100%)", players: "2.1L playing", prize: "₹5,000",   category: "Card Games", icon: "🃏" },
};

const FALLBACK_GRADIENT = "linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)";

interface DashboardProps {
  onSpin?: () => void;
  onLudo?: (fee?: number) => void;
  onWorldWar?: (fee?: number) => void;
  onSnakes?: (fee?: number) => void;
  onCarrom?: (fee?: number) => void;
  onWallet?: () => void;
  onLeaderboard?: () => void;
  appConfig?: import("@/firebase/firestore.service").AppConfig;
}

// Games that have a real implementation vs coming soon
const IMPLEMENTED_GAMES = new Set(["ludo", "5", "solitaire", "11", "snakes", "2", "carrom", "3"]);

export default function Dashboard({ onSpin, onLudo, onWorldWar, onSnakes, onCarrom, onWallet, onLeaderboard, appConfig }: DashboardProps) {
  const { total } = useWallet();
  const [activeCategory, setActiveCategory] = useState("All Games");
  const [currentBanner, setCurrentBanner] = useState(0);
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [liveGames, setLiveGames] = useState<GameConfig[]>([]);
  const [pendingGame, setPendingGame] = useState<SheetGame | null>(null);
  const [showSolitaireSheet, setShowSolitaireSheet] = useState(false);
  const bannerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function openEntrySheet(game: { id: string; name: string; icon: string; gradient: string; players: string }) {
    // Solitaire uses its own premium entry sheet
    if (game.id === "solitaire" || game.id === "11") {
      setShowSolitaireSheet(true);
      return;
    }
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
    // Each game deducts its own fee internally — do NOT deduct here
    if (gameId === "worldwar" || gameId === "7") { onWorldWar?.(fee); return; }
    if (gameId === "snakes"   || gameId === "2") { onSnakes?.(fee);   return; }
    if (gameId === "carrom"   || gameId === "3") { onCarrom?.(fee);   return; }
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

  // Merge Firestore data with local visual overrides
  const allDisplayGames = liveGames
    .filter((g) => g.isActive)
    .map((g) => {
      const id = g.id ?? "";
      const v = GAME_VISUALS[id] ?? {};
      return {
        id,
        name:       g.name,
        category:   v.category ?? g.category,
        players:    v.players ?? "1L+ playing",
        prize:      v.prize ?? `₹${Math.max(...g.entryFees) * g.prizeMultiplier * 10}`,
        gradient:   v.gradient ?? FALLBACK_GRADIENT,
        icon:       v.icon ?? g.thumbnail,
        comingSoon: !IMPLEMENTED_GAMES.has(id),
      };
    });

  // Fallback to static GAMES when Firestore is loading (empty)
  const displayGames = allDisplayGames.length > 0
    ? allDisplayGames
    : GAMES.map((g) => ({ ...g, id: String(g.id), comingSoon: !IMPLEMENTED_GAMES.has(String(g.id)) && !IMPLEMENTED_GAMES.has(g.name.toLowerCase().replace(/\s+/g,"").split("classic")[0]) }));

  const filteredGames =
    activeCategory === "All Games"
      ? displayGames
      : displayGames.filter((g) => g.category.toLowerCase() === activeCategory.toLowerCase());

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
          const featured = liveGames.find((g) => g.isFeatured && g.isActive);
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

        {/* ─── CATEGORY TABS ─── */}
        <div className="mt-5 px-4">
          <h3 className="text-white font-bold text-base mb-3">Game Categories</h3>
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat}
                data-testid={`tab-category-${cat.toLowerCase().replace(/\s+/g, "-")}`}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveCategory(cat)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-all duration-200"
                style={
                  activeCategory === cat
                    ? {
                        background: "linear-gradient(135deg, #FFD700, #ff8c00)",
                        color: "#000",
                        boxShadow: "0 0 14px rgba(255,215,0,0.4)",
                      }
                    : {
                        background: "rgba(255,255,255,0.07)",
                        color: "#a1a1aa",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }
                }
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ─── GAME GRID ─── */}
        <div className="px-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-base">
              {activeCategory === "All Games" ? "All Games" : activeCategory}
            </h3>
            <span className="text-zinc-500 text-xs">{filteredGames.length} games</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <AnimatePresence>
              {filteredGames.map((game, i) => (
                <motion.div
                  key={game.id}
                  data-testid={`card-game-${game.id}`}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => openEntrySheet(game)}
                  className="rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: (game.id === "ludo" || game.id === "5")
                      ? "1.5px solid rgba(161,112,255,0.5)"
                      : (game.id === "worldwar" || game.id === "7")
                      ? "1.5px solid rgba(231,76,60,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: (game.id === "ludo" || game.id === "5")
                      ? "0 4px 20px rgba(161,112,255,0.2)"
                      : (game.id === "worldwar" || game.id === "7")
                      ? "0 4px 20px rgba(231,76,60,0.2)"
                      : "0 4px 20px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* Game art area */}
                  <div
                    className="relative flex items-center justify-center"
                    style={{
                      height: "110px",
                      background: game.gradient,
                    }}
                  >
                    <span className="text-5xl" style={{ opacity: game.comingSoon ? 0.6 : 1 }}>{game.icon}</span>

                    {/* Coming Soon overlay */}
                    {game.comingSoon && (
                      <div className="absolute inset-0 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(1px)" }}>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-black tracking-wide"
                          style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.5)", color: "#FFD700" }}>
                          🛠️ COMING SOON
                        </span>
                      </div>
                    )}

                    {/* Prize badge (only when not coming soon) */}
                    {!game.comingSoon && (
                      <span
                        className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg text-xs font-black text-black"
                        style={{ background: "#FFD700", fontSize: "10px" }}
                      >
                        {game.prize}
                      </span>
                    )}
                  </div>

                  {/* Card info */}
                  <div className="px-3 py-2.5">
                    <div className="text-white font-bold text-sm leading-tight truncate">
                      {game.name}
                    </div>
                    <div className="text-zinc-500 text-xs mt-0.5">{game.players}</div>

                    {/* Play Now / Coming Soon button */}
                    {game.comingSoon ? (
                      <div className="mt-2 w-full py-1.5 rounded-xl text-center text-xs font-bold"
                        style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.25)", color: "rgba(255,215,0,0.6)" }}>
                        Coming Soon
                      </div>
                    ) : (
                      <div
                        className="mt-2 w-full py-1.5 rounded-xl text-center text-xs font-bold text-black"
                        style={{ background: "linear-gradient(90deg, #FFD700, #ff8c00)" }}
                      >
                        Play Now
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>


      {/* ─── GAME ENTRY SHEET ─── */}
      <GameEntrySheet
        game={pendingGame}
        onClose={() => setPendingGame(null)}
        onPlay={handlePlay}
        onAddMoney={onWallet}
      />

      {/* ─── SOLITAIRE PREMIUM ENTRY SHEET ─── */}
      <SolitaireEntrySheet
        open={showSolitaireSheet}
        onClose={() => setShowSolitaireSheet(false)}
        onPlay={(fee) => { setShowSolitaireSheet(false); onLudo?.(fee); }}
        onAddMoney={() => { setShowSolitaireSheet(false); onWallet?.(); }}
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
