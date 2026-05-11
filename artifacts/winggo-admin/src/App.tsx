import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar, { AdminPage } from "@/components/AdminSidebar";
import AdminTopBar from "@/components/AdminTopBar";
import AdminLogin from "@/pages/AdminLogin";
import PageDashboard from "@/pages/PageDashboard";
import PageUsers from "@/pages/PageUsers";
import PageWallet from "@/pages/PageWallet";
import PageGames from "@/pages/PageGames";
import PageGameAPI from "@/pages/PageGameAPI";
import PageUpdateAPI from "@/pages/PageUpdateAPI";
import PageWorldWar from "@/pages/PageWorldWar";
import PageKYC from "@/pages/PageKYC";
import PagePromotions from "@/pages/PagePromotions";
import PageAnalytics from "@/pages/PageAnalytics";
import PageSettings from "@/pages/PageSettings";
import PageDeposits from "@/pages/PageDeposits";
import { hasAdminSession, clearAdminSession } from "@/firebase/config";

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard:  "Dashboard",
  users:      "User Management",
  wallet:     "Wallet & Payments",
  deposits:   "Razorpay Deposits",
  gameapi:    "Game API System",
  updateapi:  "Update API System",
  worldwar:   "World War Manager",
  kyc:        "KYC Panel",
  promotions: "Promotions & Banners",
  analytics:  "Analytics",
  settings:   "Settings",
};

const PAGE_SUBTITLES: Record<AdminPage, string> = {
  dashboard:  "Live overview of all platform metrics",
  users:      "Search, manage and moderate users",
  wallet:     "Deposits, withdrawals & bonus management",
  deposits:   "Real-time Razorpay payment records with payment IDs",
  gameapi:    "Add, edit & control games dynamically — no reinstall needed",
  updateapi:  "Remote config, version control & feature flags",
  worldwar:   "Tournament creation, brackets & leaderboards",
  kyc:        "Review and approve KYC submissions",
  promotions: "Banners, push notifications & referral settings",
  analytics:  "Revenue trends, retention & engagement metrics",
  settings:   "App settings, integrations & security",
};

export default function App() {
  // Check for a valid (non-expired) session on mount
  const [authed, setAuthed]       = useState(() => hasAdminSession());
  const [page, setPage]           = useState<AdminPage>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function login() {
    // Session is already saved inside adminSignIn — just flip the UI flag
    setAuthed(true);
    setPage("dashboard");
  }

  function logout() {
    clearAdminSession();
    setAuthed(false);
  }

  if (!authed) {
    return <AdminLogin onLogin={login} />;
  }

  const sidebarWidth = collapsed ? 64 : 220;

  const PAGE_MAP: Record<AdminPage, React.ReactNode> = {
    dashboard:  <PageDashboard />,
    users:      <PageUsers />,
    wallet:     <PageWallet />,
    deposits:   <PageDeposits />,
    gameapi:    <PageGameAPI />,
    updateapi:  <PageUpdateAPI />,
    worldwar:   <PageWorldWar />,
    kyc:        <PageKYC />,
    promotions: <PagePromotions />,
    analytics:  <PageAnalytics />,
    settings:   <PageSettings />,
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#07050f" }}>
      <AdminSidebar
        active={page}
        onNav={(p) => setPage(p)}
        onLogout={logout}
        collapsed={collapsed}
      />

      {/* Main content */}
      <div
        className="flex-1 flex flex-col min-h-screen min-w-0"
        style={{ marginLeft: sidebarWidth, transition: "margin-left 0.28s ease" }}
      >
        <AdminTopBar
          title={PAGE_TITLES[page]}
          onToggleSidebar={() => setCollapsed(!collapsed)}
        />

        {/* Page subtitle strip for API pages */}
        {(page === "gameapi" || page === "updateapi") && (
          <div className="px-5 py-2.5 flex items-center gap-3"
            style={{ background: "rgba(255,215,0,0.04)", borderBottom: "1px solid rgba(255,215,0,0.07)" }}>
            <span className="text-lg">{page === "gameapi" ? "🎮" : "🔄"}</span>
            <div>
              <span className="text-xs font-black" style={{ color: "#FFD700" }}>
                {page === "gameapi" ? "Game API System" : "Update API System"}
              </span>
              <span className="text-xs ml-2" style={{ color: "rgba(255,255,255,0.35)" }}>
                — {PAGE_SUBTITLES[page]}
              </span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "#34d399" }}
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.4, repeat: Infinity }} />
              <span className="text-[10px] font-black" style={{ color: "#34d399" }}>API LIVE</span>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {PAGE_MAP[page]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
