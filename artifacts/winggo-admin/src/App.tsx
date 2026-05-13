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
import PagePopupSettings from "@/pages/PagePopupSettings";
import PageSecurity from "@/pages/PageSecurity";
import PageTournament from "@/pages/PageTournament";
import PageReferrals from "@/pages/PageReferrals";
import { hasAdminSession, clearAdminSession } from "@/firebase/config";

const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard:     "Dashboard",
  users:         "User Management",
  wallet:        "Wallet & Payments",
  deposits:      "Razorpay Deposits",
  gameapi:       "Game Management",
  updateapi:     "Update API System",
  worldwar:      "World War Manager",
  kyc:           "KYC Panel",
  promotions:    "Offers & Banners",
  analytics:     "Analytics",
  settings:      "Settings",
  popupsettings: "Popup Manager",
  security:      "Security Center",
  tournament:    "Tournament Manager",
  referrals:     "Referrals & Cashback",
};

const PAGE_ICONS: Record<AdminPage, string> = {
  dashboard: "📊", users: "👥", wallet: "💰", deposits: "💳",
  gameapi: "🎮", updateapi: "🔄", worldwar: "⚔️", kyc: "🪪",
  promotions: "📢", analytics: "📈", settings: "⚙️", popupsettings: "🪄",
  security: "🛡️", tournament: "🏆", referrals: "🔗",
};

export default function App() {
  const [authed, setAuthed]       = useState(() => hasAdminSession());
  const [page, setPage]           = useState<AdminPage>("dashboard");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const onResize = () => setCollapsed(window.innerWidth < 900);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function login()  { setAuthed(true); setPage("dashboard"); }
  function logout() { clearAdminSession(); setAuthed(false); }

  if (!authed) return <AdminLogin onLogin={login} />;

  const sidebarWidth = collapsed ? 64 : 228;

  const PAGE_MAP: Record<AdminPage, React.ReactNode> = {
    dashboard:     <PageDashboard />,
    users:         <PageUsers />,
    wallet:        <PageWallet />,
    deposits:      <PageDeposits />,
    gameapi:       <PageGameAPI />,
    updateapi:     <PageUpdateAPI />,
    worldwar:      <PageWorldWar />,
    kyc:           <PageKYC />,
    promotions:    <PagePromotions />,
    analytics:     <PageAnalytics />,
    settings:      <PageSettings />,
    popupsettings: <PagePopupSettings />,
    security:      <PageSecurity />,
    tournament:    <PageTournament />,
    referrals:     <PageReferrals />,
  };

  return (
    <div className="min-h-screen flex" style={{ background: "#07050f" }}>
      <AdminSidebar active={page} onNav={(p) => setPage(p)} onLogout={logout} collapsed={collapsed} />

      <div className="flex-1 flex flex-col min-h-screen min-w-0"
        style={{ marginLeft: sidebarWidth, transition: "margin-left 0.26s ease" }}>
        <AdminTopBar
          title={`${PAGE_ICONS[page]} ${PAGE_TITLES[page]}`}
          onToggleSidebar={() => setCollapsed(!collapsed)}
        />

        <main className="flex-1 overflow-y-auto p-4 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {PAGE_MAP[page]}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
