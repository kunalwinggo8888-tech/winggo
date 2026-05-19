import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar, { AdminPage, NavDest } from "@/components/AdminSidebar";
import AdminLogin         from "@/pages/AdminLogin";
import PageDashboard      from "@/pages/PageDashboard";
import PageUserManagement from "@/pages/PageUserManagement";
import PageWalletTxns     from "@/pages/PageWalletTxns";
import PageGameSettings   from "@/pages/PageGameSettings";
import PageMarketing      from "@/pages/PageMarketing";
import PageNotifications  from "@/pages/PageNotifications";
import PageReferral       from "@/pages/PageReferral";
import PageSecurity       from "@/pages/PageSecurity";
import PageCodeEditor     from "@/pages/PageCodeEditor";
import { hasAdminSession, clearAdminSession } from "@/firebase/config";

const PAGE_META: Record<AdminPage, { icon: string; title: string }> = {
  dashboard:     { icon: "📊", title: "Dashboard Overview"       },
  users:         { icon: "👥", title: "User Management"          },
  wallet:        { icon: "💳", title: "Wallet & Transactions"    },
  games:         { icon: "🎮", title: "Game Settings & Tournaments" },
  marketing:     { icon: "🎁", title: "Banners, Offers & Marketing" },
  notifications: { icon: "🔔", title: "Notifications & Social"   },
  referral:      { icon: "🔗", title: "Referral & Earnings"      },
  security:      { icon: "🔒", title: "Security & Logs"          },
  editor:        { icon: "💻", title: "Master Code Editor"       },
};

export default function App() {
  const [authed, setAuthed]           = useState(() => hasAdminSession());
  const [page, setPage]               = useState<AdminPage>("dashboard");
  const [pageTab, setPageTab]         = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleNav({ page: p, tab }: NavDest) {
    setPage(p);
    setPageTab(tab);
    setSidebarOpen(false);
  }

  function handleLogout() {
    clearAdminSession();
    setAuthed(false);
  }

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const meta = PAGE_META[page];

  return (
    <div className="min-h-screen flex" style={{ background: "#070b12", color: "#e2e8f0" }}>

      <AdminSidebar
        active={page}
        activeTab={pageTab}
        onNav={handleNav}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-[240px]">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{ background: "rgba(7,11,18,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
          <button className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)" }}
            onClick={() => setSidebarOpen(true)}>
            <span className="text-base" style={{ color: "#00d4ff" }}>☰</span>
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{meta.icon}</span>
            <div className="min-w-0">
              <span className="text-sm font-black text-white truncate block">{meta.title}</span>
              <span className="text-[9px] font-bold tracking-widest hidden sm:block" style={{ color: "rgba(0,212,255,0.5)" }}>
                WINGGO ADMIN CONSOLE
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#00d4ff" }}
              animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
            <span className="text-[10px] font-black" style={{ color: "#00d4ff" }}>SYSTEM ONLINE</span>
          </div>

          <motion.button whileTap={{ scale: 0.94 }} onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
            style={{ background: "rgba(255,51,102,0.08)", color: "#ff3366", border: "1px solid rgba(255,51,102,0.2)" }}>
            ⏻
          </motion.button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={page}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}
              className="h-full">
              {page === "dashboard"     && <PageDashboard />}
              {page === "users"         && <PageUserManagement jumpTab={pageTab} />}
              {page === "wallet"        && <PageWalletTxns jumpTab={pageTab} />}
              {page === "games"         && <PageGameSettings jumpTab={pageTab} />}
              {page === "marketing"     && <PageMarketing jumpTab={pageTab} />}
              {page === "notifications" && <PageNotifications jumpTab={pageTab} />}
              {page === "referral"      && <PageReferral jumpTab={pageTab} />}
              {page === "security"      && <PageSecurity jumpTab={pageTab} />}
              {page === "editor"        && <PageCodeEditor />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
