import { motion } from "framer-motion";

// Home sits dead-center (3rd of 5) and carries the featured big glowing
// circular button; Leaderboard is now a normal item.
const NAV_ITEMS = [
  { id: "leaderboard", label: "Leaderboard", icon: "🏆",  screen: "leaderboard" },
  { id: "history",     label: "History",     icon: "📋",  screen: "history" },
  { id: "home",        label: "Home",        icon: "🏠",  screen: "dashboard", featured: true },
  { id: "wallet",      label: "Wallet",      icon: "💰",  screen: "wallet" },
  { id: "profile",     label: "Profile",     icon: "👤",  screen: "profile" },
] as const;

interface BottomNavProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const SCREENS_WITH_NAV = ["dashboard", "history", "leaderboard", "wallet", "refer", "profile", "kyc"];

export { SCREENS_WITH_NAV };

export default function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const activeId =
    activeScreen === "dashboard"          ? "home"        :
    activeScreen === "history"            ? "history"     :
    activeScreen === "leaderboard"        ? "leaderboard" :
    activeScreen === "wallet"             ? "wallet"      :
    activeScreen === "refer"              ? "refer"       :
    activeScreen === "profile" || activeScreen === "kyc" ? "profile" : "";

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 flex items-end justify-around px-2"
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        zIndex: 9000,
        background: "rgba(8,8,12,0.97)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        paddingTop: "10px",
        paddingBottom: "env(safe-area-inset-bottom, 14px)",
      }}
    >
      {NAV_ITEMS.map((item) =>
        "featured" in item && item.featured ? (
          /* HOME — dead-center, biggest & most attractive: raised circular
             gold/orange gradient button with a soft pulsing glow (stronger
             when active, subtle golden when inactive). */
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => onNavigate(item.screen)}
            className="flex flex-col items-center -mt-7 cursor-pointer"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <motion.div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{
                background: "linear-gradient(135deg, #FFD700, #ff8c00)",
                border: "3px solid rgba(255,255,255,0.22)",
              }}
              animate={{
                boxShadow:
                  activeId === item.id
                    ? [
                        "0 0 26px rgba(255,200,0,0.85), 0 -6px 18px rgba(255,170,0,0.55)",
                        "0 0 42px rgba(255,200,0,1), 0 -6px 28px rgba(255,170,0,0.75)",
                        "0 0 26px rgba(255,200,0,0.85), 0 -6px 18px rgba(255,170,0,0.55)",
                      ]
                    : [
                        "0 0 16px rgba(255,200,0,0.5), 0 -4px 10px rgba(255,170,0,0.3)",
                        "0 0 24px rgba(255,200,0,0.7), 0 -4px 14px rgba(255,170,0,0.4)",
                        "0 0 16px rgba(255,200,0,0.5), 0 -4px 10px rgba(255,170,0,0.3)",
                      ],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              {item.icon}
            </motion.div>
            <span
              className="text-[10px] mt-1 font-bold"
              style={{
                color: activeId === item.id ? "#FFD700" : "#7a7a85",
                textShadow: activeId === item.id ? "0 0 8px rgba(255,215,0,0.8)" : "none",
              }}
            >
              {item.label}
            </span>
          </motion.button>
        ) : (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => onNavigate(item.screen)}
            className="flex flex-col items-center gap-0.5 pb-1 cursor-pointer"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <motion.span
              className="text-xl transition-none"
              animate={{
                filter:
                  activeId === item.id
                    ? [
                        "drop-shadow(0 0 4px rgba(255,215,0,0.6))",
                        "drop-shadow(0 0 10px rgba(255,215,0,1))",
                        "drop-shadow(0 0 4px rgba(255,215,0,0.6))",
                      ]
                    : "none",
                opacity: activeId === item.id ? 1 : 0.35,
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {item.icon}
            </motion.span>
            <span
              className="text-[10px] font-semibold"
              style={{ color: activeId === item.id ? "#FFD700" : "#3f3f46" }}
            >
              {item.label}
            </span>
          </motion.button>
        )
      )}
    </nav>
  );
}
