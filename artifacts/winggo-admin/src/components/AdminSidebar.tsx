import { motion, AnimatePresence } from "framer-motion";

export type AdminPage = "games" | "editor";

interface AdminSidebarProps {
  active: AdminPage;
  onNav: (page: AdminPage) => void;
  onLogout: () => void;
  open: boolean;
  onClose: () => void;
}

const NAV: { id: AdminPage; icon: string; label: string; sub: string }[] = [
  { id: "games",  icon: "🎮", label: "Game Settings",  sub: "Upload & Configure" },
  { id: "editor", icon: "💻", label: "Code Editor",    sub: "Deploy Live"        },
];

function SidebarContent({ active, onNav, onLogout, onClose }: Pick<AdminSidebarProps, "active" | "onNav" | "onLogout"> & { onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#080d18" }}>

      {/* Logo */}
      <div className="px-5 pt-6 pb-4 relative" style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
        {onClose && (
          <button onClick={onClose} className="absolute top-4 right-3 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(226,232,240,0.4)", fontSize: 13 }}>✕</button>
        )}
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-black"
            style={{ background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,85,255,0.25))", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff" }}>
            ⚡
          </div>
          <span className="text-lg font-black tracking-tight">
            <span className="text-white">WIN</span>
            <span style={{ color: "#00d4ff" }}>GGO</span>
          </span>
        </div>
        <p className="text-[9px] font-black tracking-[0.2em] ml-0.5" style={{ color: "rgba(0,212,255,0.4)" }}>
          ADMIN CONSOLE v2
        </p>
      </div>

      {/* Module label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[9px] font-black tracking-[0.15em]" style={{ color: "rgba(0,212,255,0.3)" }}>MODULES</p>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1.5">
        {NAV.map((item, i) => {
          const isActive = active === item.id;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07, duration: 0.3 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onNav(item.id)}
              className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left cursor-pointer"
              style={{
                background:  isActive ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)",
                border:      `1px solid ${isActive ? "rgba(0,212,255,0.25)" : "rgba(255,255,255,0.05)"}`,
                boxShadow:   isActive ? "inset 0 0 20px rgba(0,212,255,0.04), 0 0 12px rgba(0,212,255,0.06)" : "none",
                transition:  "all 0.2s ease",
              }}
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl shrink-0"
                style={{
                  background: isActive ? "rgba(0,212,255,0.12)" : "rgba(255,255,255,0.04)",
                  border:     `1px solid ${isActive ? "rgba(0,212,255,0.28)" : "rgba(255,255,255,0.06)"}`,
                }}>
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black leading-tight" style={{ color: isActive ? "#00d4ff" : "#e2e8f0" }}>
                  {item.label}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(226,232,240,0.35)" }}>
                  {item.sub}
                </p>
              </div>
              {isActive && (
                <div className="w-1 h-6 rounded-full shrink-0"
                  style={{ background: "#00d4ff", boxShadow: "0 0 8px #00d4ff" }} />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Status pill */}
      <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl"
        style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)" }}>
        <div className="flex items-center gap-2 mb-1">
          <motion.div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#00ff88" }}
            animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
          <span className="text-[9px] font-black" style={{ color: "#00ff88" }}>ALL SYSTEMS OPERATIONAL</span>
        </div>
        <p className="text-[9px]" style={{ color: "rgba(226,232,240,0.28)" }}>
          Firebase · Firestore · Storage · RTDB
        </p>
      </div>

      {/* Logout */}
      <div className="px-3 pb-5" style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 14 }}>
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={onLogout}
          className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer flex items-center justify-center gap-2"
          style={{ background: "rgba(255,51,102,0.07)", color: "#ff3366", border: "1px solid rgba(255,51,102,0.18)" }}
        >
          <span>⏻</span><span>Logout</span>
        </motion.button>
      </div>
    </div>
  );
}

export default function AdminSidebar({ active, onNav, onLogout, open, onClose }: AdminSidebarProps) {
  return (
    <>
      {/* Desktop — always visible */}
      <div className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 w-[220px]"
        style={{ borderRight: "1px solid rgba(0,212,255,0.1)" }}>
        <SidebarContent active={active} onNav={onNav} onLogout={onLogout} />
      </div>

      {/* Mobile — overlay drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.78)", backdropFilter: "blur(5px)" }}
              onClick={onClose} />
            <motion.div key="dr"
              initial={{ x: -230 }} animate={{ x: 0 }} exit={{ x: -230 }}
              transition={{ type: "spring", damping: 28, stiffness: 310 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[220px] lg:hidden flex flex-col"
              style={{ borderRight: "1px solid rgba(0,212,255,0.12)" }}>
              <SidebarContent active={active} onNav={onNav} onLogout={onLogout} onClose={onClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
