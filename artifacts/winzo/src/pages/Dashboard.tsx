import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const CATEGORIES = ["All Games", "Casual", "Action", "Card Games", "E-Sports", "Cricket"];

const BANNERS = [
  {
    id: 1,
    title: "Win ₹10 Lakhs",
    subtitle: "Daily Tournaments — Join Now",
    gradient: "linear-gradient(135deg, #ff4e00 0%, #ec9f05 100%)",
    accent: "#fff",
    tag: "MEGA EVENT",
  },
  {
    id: 2,
    title: "Refer & Earn",
    subtitle: "Get ₹50 per friend • No limit",
    gradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    accent: "#FFD700",
    tag: "TRENDING",
  },
  {
    id: 3,
    title: "100% Bonus",
    subtitle: "On your first deposit today",
    gradient: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)",
    accent: "#fff",
    tag: "NEW OFFER",
  },
  {
    id: 4,
    title: "World War Live",
    subtitle: "Battle royale starts in 2h 30m",
    gradient: "linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)",
    accent: "#fff",
    tag: "LIVE",
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
    icon: "🫧",
  },
  {
    id: 2,
    name: "Knife Up",
    category: "Action",
    players: "1.8L playing",
    prize: "₹10,000",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    icon: "🗡️",
  },
  {
    id: 3,
    name: "Fruit Samurai",
    category: "Action",
    players: "3.1L playing",
    prize: "₹2,500",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    icon: "🍉",
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
    name: "Ludo King",
    category: "Casual",
    players: "4.2L playing",
    prize: "₹1,000",
    gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    icon: "🎲",
  },
  {
    id: 6,
    name: "Carrom",
    category: "Casual",
    players: "2.9L playing",
    prize: "₹3,000",
    gradient: "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
    icon: "🎯",
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
];

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "worldwar", label: "War", icon: "⚔️", featured: true },
  { id: "wallet", label: "Wallet", icon: "💰" },
  { id: "refer", label: "Refer", icon: "🎁" },
  { id: "profile", label: "Profile", icon: "👤" },
];

interface DashboardProps {
  onSpin?: () => void;
}

export default function Dashboard({ onSpin }: DashboardProps) {
  const [activeCategory, setActiveCategory] = useState("All Games");
  const [activeNav, setActiveNav] = useState("home");
  const [currentBanner, setCurrentBanner] = useState(0);
  const bannerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bannerRef.current = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % BANNERS.length);
    }, 3000);
    return () => {
      if (bannerRef.current) clearInterval(bannerRef.current);
    };
  }, []);

  const filteredGames =
    activeCategory === "All Games"
      ? GAMES
      : GAMES.filter((g) => g.category === activeCategory);

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

        {/* WINZO Logo */}
        <h1 className="font-black text-2xl tracking-tighter leading-none">
          <span className="text-white">WIN</span>
          <span
            className="text-[#FFD700]"
            style={{
              textShadow: "0 0 8px rgba(255,215,0,0.8), 0 0 20px rgba(255,215,0,0.4)",
            }}
          >
            ZO
          </span>
        </h1>

        {/* Right: Bell + Wallet */}
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

          {/* Wallet Card */}
          <motion.button
            data-testid="button-wallet"
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,140,0,0.1))",
              border: "1px solid rgba(255,215,0,0.3)",
              boxShadow: "0 0 12px rgba(255,215,0,0.15)",
            }}
          >
            <span className="text-[#FFD700] font-bold text-sm">₹0.00</span>
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center text-black font-black text-xs"
              style={{ background: "#FFD700" }}
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

        {/* ─── SPIN & WIN PROMO CARD ─── */}
        <motion.button
          data-testid="button-spin-promo"
          onClick={onSpin}
          whileTap={{ scale: 0.97 }}
          className="mx-4 mt-4 w-[calc(100%-2rem)] rounded-2xl overflow-hidden cursor-pointer flex items-center justify-between px-5 py-4 relative"
          style={{
            background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 50%, #1a0a3e 100%)",
            border: "1.5px solid rgba(139,92,246,0.4)",
            boxShadow: "0 0 24px rgba(139,92,246,0.2)",
          }}
          animate={{
            boxShadow: [
              "0 0 20px rgba(139,92,246,0.2)",
              "0 0 36px rgba(255,215,0,0.25)",
              "0 0 20px rgba(139,92,246,0.2)",
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-1">Daily Reward</div>
            <div className="text-white font-black text-lg leading-tight">Spin &amp; Win!</div>
            <div className="text-zinc-400 text-xs mt-0.5">Win up to ₹20 Cash every day</div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-4xl">🎡</span>
            <span
              className="text-xs font-black px-2 py-0.5 rounded-full text-black"
              style={{ background: "linear-gradient(90deg, #FFD700, #ff8c00)" }}
            >
              FREE
            </span>
          </div>
        </motion.button>

        {/* ─── QUICK STATS STRIP ─── */}
        <div className="flex gap-3 mx-4 mt-4 overflow-x-auto pb-1 no-scrollbar">
          {[
            { label: "Winners Today", value: "2.4L+", icon: "🏆" },
            { label: "Prize Pool", value: "₹10L", icon: "💎" },
            { label: "Live Games", value: "48", icon: "🔴" },
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
                  className="rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
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
                    <span className="text-5xl">{game.icon}</span>

                    {/* Prize badge */}
                    <span
                      className="absolute top-2 right-2 px-1.5 py-0.5 rounded-lg text-xs font-black text-black"
                      style={{ background: "#FFD700", fontSize: "10px" }}
                    >
                      {game.prize}
                    </span>
                  </div>

                  {/* Card info */}
                  <div className="px-3 py-2.5">
                    <div className="text-white font-bold text-sm leading-tight truncate">
                      {game.name}
                    </div>
                    <div className="text-zinc-500 text-xs mt-0.5">{game.players}</div>

                    {/* Play Now */}
                    <div
                      className="mt-2 w-full py-1.5 rounded-xl text-center text-xs font-bold text-black"
                      style={{
                        background: "linear-gradient(90deg, #FFD700, #ff8c00)",
                      }}
                    >
                      Play Now
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>

      {/* ─── BOTTOM NAV ─── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-end justify-around px-2 pb-safe"
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "rgba(10,10,15,0.95)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(255,255,255,0.07)",
          paddingTop: "10px",
          paddingBottom: "14px",
        }}
      >
        {NAV_ITEMS.map((item) =>
          item.featured ? (
            /* Featured center button — elevated */
            <motion.button
              key={item.id}
              data-testid={`nav-${item.id}`}
              whileTap={{ scale: 0.9 }}
              onClick={() => setActiveNav(item.id)}
              className="flex flex-col items-center -mt-6 cursor-pointer"
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
                style={{
                  background: "linear-gradient(135deg, #ff4e00, #ec9f05)",
                  boxShadow:
                    "0 0 20px rgba(255,100,0,0.6), 0 -4px 12px rgba(255,100,0,0.3)",
                  border: "3px solid rgba(255,255,255,0.15)",
                }}
              >
                {item.icon}
              </div>
              <span
                className="text-[10px] mt-1 font-semibold"
                style={{ color: activeNav === item.id ? "#ff8c00" : "#52525b" }}
              >
                {item.label}
              </span>
            </motion.button>
          ) : (
            <motion.button
              key={item.id}
              data-testid={`nav-${item.id}`}
              whileTap={{ scale: 0.9 }}
              onClick={() => { setActiveNav(item.id); if (item.id === "refer") onSpin?.(); }}
              className="flex flex-col items-center gap-0.5 cursor-pointer"
            >
              <span
                className="text-xl transition-all duration-200"
                style={{
                  filter:
                    activeNav === item.id
                      ? "drop-shadow(0 0 6px rgba(255,215,0,0.8))"
                      : "none",
                  opacity: activeNav === item.id ? 1 : 0.4,
                }}
              >
                {item.icon}
              </span>
              <span
                className="text-[10px] font-semibold transition-colors duration-200"
                style={{ color: activeNav === item.id ? "#FFD700" : "#52525b" }}
              >
                {item.label}
              </span>
            </motion.button>
          )
        )}
      </nav>
    </div>
  );
}
