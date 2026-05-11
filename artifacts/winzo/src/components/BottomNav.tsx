import { motion } from "framer-motion";

const NAV_ITEMS = [
  { id: "home",     label: "Home",      icon: "🏠",  screen: "dashboard" },
  { id: "worldwar", label: "World War", icon: "⚔️",  screen: "worldwar",  featured: true },
  { id: "wallet",   label: "Wallet",    icon: "💰",  screen: "wallet" },
  { id: "refer",    label: "Refer",     icon: "🎁",  screen: "refer" },
  { id: "profile",  label: "Profile",   icon: "👤",  screen: null },
] as const;

interface BottomNavProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

const SCREENS_WITH_NAV = ["dashboard", "worldwar", "wallet", "refer"];

export { SCREENS_WITH_NAV };

export default function BottomNav({ activeScreen, onNavigate }: BottomNavProps) {
  const activeId =
    activeScreen === "dashboard" ? "home"     :
    activeScreen === "worldwar"  ? "worldwar" :
    activeScreen === "wallet"    ? "wallet"   :
    activeScreen === "refer"     ? "refer"    : "";

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
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => item.screen && onNavigate(item.screen)}
            className="flex flex-col items-center -mt-6 cursor-pointer"
            style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
          >
            <motion.div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{
                background: "linear-gradient(135deg, #ff4e00, #ec9f05)",
                border: "3px solid rgba(255,255,255,0.15)",
              }}
              animate={{
                boxShadow:
                  activeId === item.id
                    ? [
                        "0 0 20px rgba(255,100,0,0.7), 0 -4px 14px rgba(255,100,0,0.4)",
                        "0 0 32px rgba(255,100,0,0.95), 0 -4px 22px rgba(255,100,0,0.6)",
                        "0 0 20px rgba(255,100,0,0.7), 0 -4px 14px rgba(255,100,0,0.4)",
                      ]
                    : "0 0 18px rgba(255,100,0,0.5), 0 -4px 10px rgba(255,100,0,0.25)",
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            >
              {item.icon}
            </motion.div>
            <span
              className="text-[10px] mt-1 font-semibold"
              style={{ color: activeId === item.id ? "#ff8c00" : "#52525b" }}
            >
              {item.label}
            </span>
          </motion.button>
        ) : (
          <motion.button
            key={item.id}
            whileTap={{ scale: 0.88 }}
            onClick={() => item.screen && onNavigate(item.screen)}
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
