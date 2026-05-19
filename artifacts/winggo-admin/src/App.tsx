import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AdminSidebar, { AdminPage } from "@/components/AdminSidebar";
import AdminLogin from "@/pages/AdminLogin";
import PageGameSettings from "@/pages/PageGameSettings";
import PageCodeEditor from "@/pages/PageCodeEditor";
import { hasAdminSession, clearAdminSession } from "@/firebase/config";

const PAGE_META: Record<AdminPage, { icon: string; title: string }> = {
  games:  { icon: "🎮", title: "Game Settings & Cloud Uploader" },
  editor: { icon: "💻", title: "Master Code Editor" },
};

export default function App() {
  const [authed, setAuthed]           = useState(() => hasAdminSession());
  const [page, setPage]               = useState<AdminPage>("games");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function handleLogout() {
    clearAdminSession();
    setAuthed(false);
  }

  if (!authed) return <AdminLogin onLogin={() => setAuthed(true)} />;

  const meta = PAGE_META[page];

  return (
    <div className="min-h-screen flex" style={{ background: "#070b12", color: "#e2e8f0" }}>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <AdminSidebar
        active={page}
        onNav={(p) => { setPage(p); setSidebarOpen(false); }}
        onLogout={handleLogout}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ── Main panel ───────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-[220px]">

        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{
            background: "rgba(7,11,18,0.9)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(0,212,255,0.1)",
          }}
        >
          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.15)" }}
            onClick={() => setSidebarOpen(true)}
          >
            <span className="text-base" style={{ color: "#00d4ff" }}>☰</span>
          </button>

          {/* Page title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{meta.icon}</span>
            <div className="min-w-0">
              <span className="text-sm font-black text-white truncate block">{meta.title}</span>
              <span className="text-[9px] font-bold tracking-widest hidden sm:block" style={{ color: "rgba(0,212,255,0.5)" }}>
                WINGGO ADMIN CONSOLE
              </span>
            </div>
          </div>

          {/* Status pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.15)" }}>
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#00d4ff" }}
              animate={{ opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span className="text-[10px] font-black" style={{ color: "#00d4ff" }}>SYSTEM ONLINE</span>
          </div>

          {/* Logout */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
            style={{ background: "rgba(255,51,102,0.08)", color: "#ff3366", border: "1px solid rgba(255,51,102,0.2)" }}
          >
            ⏻
          </motion.button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
              className="h-full"
            >
              {page === "games"  && <PageGameSettings />}
              {page === "editor" && <PageCodeEditor />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
