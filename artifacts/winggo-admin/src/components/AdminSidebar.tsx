import { motion, AnimatePresence } from "framer-motion";

export type AdminPage =
  | "dashboard" | "users" | "wallet" | "games" | "worldwar"
  | "kyc" | "promotions" | "analytics" | "settings";

const NAV = [
  { id: "dashboard",  icon: "📊", label: "Dashboard"        },
  { id: "users",      icon: "👥", label: "Users"             },
  { id: "wallet",     icon: "💰", label: "Wallet"            },
  { id: "games",      icon: "🎮", label: "Games"             },
  { id: "worldwar",   icon: "⚔️", label: "World War"         },
  { id: "kyc",        icon: "🪪", label: "KYC Panel"         },
  { id: "promotions", icon: "📢", label: "Promotions"        },
  { id: "analytics",  icon: "📈", label: "Analytics"         },
  { id: "settings",   icon: "⚙️", label: "Settings"          },
] as const;

interface Props {
  active: AdminPage;
  onNav: (p: AdminPage) => void;
  onLogout: () => void;
  collapsed: boolean;
}

export default function AdminSidebar({ active, onNav, onLogout, collapsed }: Props) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.28, ease: "easeInOut" }}
      className="fixed top-0 left-0 h-screen flex flex-col overflow-hidden z-50 shrink-0"
      style={{
        background: "linear-gradient(180deg, #0d0918 0%, #080612 100%)",
        borderRight: "1px solid rgba(255,215,0,0.09)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5" style={{ minHeight: 64 }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#FFD700)" }}>
          👑
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              <div className="font-black text-sm leading-none">
                <span className="text-white">WIN</span><span style={{ color: "#FFD700" }}>GGO</span>
              </div>
              <div className="text-[9px] font-bold tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
                Admin Panel
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-px mx-3" style={{ background: "rgba(255,215,0,0.08)" }} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-0.5 px-2">
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              whileTap={{ scale: 0.96 }}
              onClick={() => onNav(item.id as AdminPage)}
              className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left cursor-pointer relative"
              style={{
                background: isActive ? "rgba(255,215,0,0.10)" : "transparent",
                border: isActive ? "1px solid rgba(255,215,0,0.20)" : "1px solid transparent",
                color: isActive ? "#FFD700" : "rgba(255,255,255,0.45)",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-full"
                  style={{ background: "#FFD700" }}
                />
              )}
              <span className="text-base shrink-0 ml-1">{item.icon}</span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                    className="text-xs font-bold truncate"
                    style={{ color: isActive ? "#FFD700" : "rgba(255,255,255,0.55)" }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      <div className="h-px mx-3" style={{ background: "rgba(255,215,0,0.08)" }} />

      {/* Logout */}
      <div className="px-2 py-3">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onLogout}
          className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 cursor-pointer"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", WebkitTapHighlightColor: "transparent" }}
        >
          <span className="text-base shrink-0 ml-1">🚪</span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs font-bold">Logout</motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
}
