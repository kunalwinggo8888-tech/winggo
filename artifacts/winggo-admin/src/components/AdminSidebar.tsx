import { motion, AnimatePresence } from "framer-motion";

export type AdminPage =
  | "dashboard" | "users" | "wallet" | "deposits" | "gameapi" | "updateapi"
  | "worldwar" | "kyc" | "promotions" | "analytics" | "settings" | "popupsettings"
  | "security" | "tournament" | "referrals";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "dashboard",   icon: "📊", label: "Dashboard"      },
    ],
  },
  {
    label: "Players",
    items: [
      { id: "users",       icon: "👥", label: "Users"           },
      { id: "kyc",         icon: "🪪", label: "KYC Panel"       },
      { id: "referrals",   icon: "🔗", label: "Referrals",  badge: "NEW", badgeColor: "#34d399" },
    ],
  },
  {
    label: "Payments",
    items: [
      { id: "wallet",      icon: "💰", label: "Wallet"          },
      { id: "deposits",    icon: "💳", label: "Deposits",   badge: "LIVE", badgeColor: "#34d399" },
    ],
  },
  {
    label: "Games",
    items: [
      { id: "gameapi",     icon: "🎮", label: "Games",      badge: "API",  badgeColor: "#FFD700" },
      { id: "tournament",  icon: "🏆", label: "Tournament", badge: "NEW",  badgeColor: "#f87171" },
      { id: "worldwar",    icon: "⚔️", label: "World War"       },
      { id: "popupsettings",icon: "🪄",label: "Popups"          },
    ],
  },
  {
    label: "Marketing",
    items: [
      { id: "promotions",  icon: "📢", label: "Banners"          },
      { id: "analytics",   icon: "📈", label: "Analytics"        },
    ],
  },
  {
    label: "System",
    items: [
      { id: "security",    icon: "🛡️", label: "Security",    badge: "NEW",  badgeColor: "#ef4444" },
      { id: "updateapi",   icon: "🔄", label: "Update API",  badge: "API",  badgeColor: "#FFD700" },
      { id: "settings",    icon: "⚙️", label: "Settings"         },
    ],
  },
];

interface Props {
  active: AdminPage;
  onNav: (p: AdminPage) => void;
  onLogout: () => void;
  collapsed: boolean;
}

export default function AdminSidebar({ active, onNav, onLogout, collapsed }: Props) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 228 }}
      transition={{ duration: 0.26, ease: "easeInOut" }}
      className="fixed top-0 left-0 h-screen flex flex-col overflow-hidden z-50 shrink-0"
      style={{
        background: "linear-gradient(180deg, #0d0918 0%, #07050f 100%)",
        borderRight: "1px solid rgba(255,215,0,0.08)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 shrink-0" style={{ minHeight: 60 }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#FFD700)", boxShadow: "0 0 18px rgba(255,215,0,0.25)" }}>
          👑
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.14 }}>
              <div className="font-black text-sm leading-none">
                <span className="text-white">WIN</span><span style={{ color: "#FFD700" }}>GGO</span>
              </div>
              <div className="text-[9px] font-bold tracking-widest uppercase mt-0.5" style={{ color: "rgba(255,255,255,0.28)" }}>
                Admin Panel
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-px mx-3 shrink-0" style={{ background: "rgba(255,215,0,0.07)" }} />

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-2 px-2" style={{ scrollbarWidth: "none" }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {/* Group label */}
            <AnimatePresence>
              {!collapsed && (
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="text-[9px] font-black uppercase tracking-widest px-2 pt-3 pb-1"
                  style={{ color: "rgba(255,255,255,0.2)" }}>
                  {group.label}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.id;
                const hasBadge = "badge" in item && item.badge;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onNav(item.id as AdminPage)}
                    className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 text-left cursor-pointer relative"
                    style={{
                      background: isActive ? "rgba(255,215,0,0.09)" : "transparent",
                      border: isActive ? "1px solid rgba(255,215,0,0.18)" : "1px solid transparent",
                      color: isActive ? "#FFD700" : "rgba(255,255,255,0.42)",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                        style={{ background: "#FFD700" }}
                      />
                    )}
                    <span className="text-sm shrink-0 ml-0.5">{item.icon}</span>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="text-[11px] font-bold truncate flex-1"
                          style={{ color: isActive ? "#FFD700" : "rgba(255,255,255,0.52)" }}
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {!collapsed && hasBadge && (
                      <span className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0"
                        style={{
                          background: `${(item as { badge?: string; badgeColor?: string }).badgeColor ?? "#FFD700"}20`,
                          color: (item as { badge?: string; badgeColor?: string }).badgeColor ?? "#FFD700",
                          border: `1px solid ${(item as { badge?: string; badgeColor?: string }).badgeColor ?? "#FFD700"}40`,
                        }}>
                        {(item as { badge?: string }).badge}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="h-px mx-3 shrink-0" style={{ background: "rgba(255,215,0,0.07)" }} />

      {/* Logout */}
      <div className="px-2 py-3 shrink-0">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 rounded-xl px-2 py-2 cursor-pointer"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.14)", color: "#f87171", WebkitTapHighlightColor: "transparent" }}>
          <span className="text-sm shrink-0 ml-0.5">🚪</span>
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-[11px] font-bold">Logout</motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.aside>
  );
}
