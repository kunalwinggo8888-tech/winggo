import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar, { AdminPage } from "@/components/AdminSidebar";
import AdminTopBar from "@/components/AdminTopBar";
import AdminLogin from "@/pages/AdminLogin";
import PageDashboard from "@/pages/PageDashboard";
import PageUsers from "@/pages/PageUsers";
import PageWallet from "@/pages/PageWallet";
import PageGames from "@/pages/PageGames";
import PageWorldWar from "@/pages/PageWorldWar";
import PageKYC from "@/pages/PageKYC";
import PagePromotions from "@/pages/PagePromotions";
import PageAnalytics from "@/pages/PageAnalytics";
import PageSettings from "@/pages/PageSettings";

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard:  "Dashboard",
  users:      "User Management",
  wallet:     "Wallet & Payments",
  games:      "Game Configuration",
  worldwar:   "World War Manager",
  kyc:        "KYC Panel",
  promotions: "Promotions & Banners",
  analytics:  "Analytics",
  settings:   "Settings",
};

const STORAGE_KEY = "winggo_admin_auth";

export default function App() {
  const [authed, setAuthed]       = useState(() => localStorage.getItem(STORAGE_KEY) === "1");
  const [page, setPage]           = useState<AdminPage>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 768);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function login() {
    localStorage.setItem(STORAGE_KEY, "1");
    setAuthed(true);
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY);
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
    games:      <PageGames />,
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
