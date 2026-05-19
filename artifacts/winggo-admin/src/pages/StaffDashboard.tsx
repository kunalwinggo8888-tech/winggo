/**
 * StaffDashboard — Restricted dashboard for staff members.
 * Shows only the modules the Super-Admin has granted access to.
 * No Code Editor, Staff Management, or Version History.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getStaffSession, clearStaffSession, type StaffPermissions } from "@/firebase/config";
import PageUserManagement from "@/pages/PageUserManagement";
import PageWalletTxns     from "@/pages/PageWalletTxns";
import PageGameSettings   from "@/pages/PageGameSettings";
import PageMarketing      from "@/pages/PageMarketing";
import PageNotifications  from "@/pages/PageNotifications";
import PageReferral       from "@/pages/PageReferral";

interface Props { onLogout: () => void; }

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  purple:"#a78bfa", muted:"rgba(226,232,240,0.38)",
};

interface NavItem {
  key:    keyof StaffPermissions | "dashboard";
  icon:   string;
  label:  string;
  perm?:  keyof StaffPermissions;
  tab?:   string;
}

const ALL_NAV: NavItem[] = [
  { key:"dashboard",     icon:"📊", label:"Overview"              },
  { key:"users",         icon:"👥", label:"User Management",  perm:"users"         },
  { key:"deposits",      icon:"⬇️", label:"Deposits",         perm:"deposits",    tab:"deposits"    },
  { key:"withdrawals",   icon:"⬆️", label:"Withdrawals",      perm:"withdrawals", tab:"withdrawals" },
  { key:"kyc",           icon:"✅", label:"KYC",              perm:"kyc",         tab:"kyc"         },
  { key:"games",         icon:"🎮", label:"Game Settings",    perm:"games"         },
  { key:"marketing",     icon:"🎁", label:"Marketing",        perm:"marketing"     },
  { key:"notifications", icon:"🔔", label:"Notifications",    perm:"notifications" },
  { key:"referral",      icon:"🔗", label:"Referral",         perm:"referral"      },
];

export default function StaffDashboard({ onLogout }: Props) {
  const session      = getStaffSession();
  const perms        = session?.permissions ?? {} as StaffPermissions;
  const username     = session?.username ?? "Staff";
  const [active, setActive]       = useState<string>("dashboard");
  const [activeTab, setActiveTab] = useState<string>("");
  const [sideOpen,  setSideOpen]  = useState(false);

  const allowedNav = ALL_NAV.filter((n) =>
    n.key === "dashboard" || (n.perm && perms[n.perm]),
  );

  function handleLogout() {
    clearStaffSession();
    onLogout();
  }

  function navTo(key: string, tab = "") {
    setActive(key);
    setActiveTab(tab);
    setSideOpen(false);
  }

  // Wallet page for deposits + withdrawals
  const walletPageKey = active === "deposits" || active === "withdrawals" ? "wallet" : null;

  function SidebarContent({ closable = false }) {
    return (
      <div className="flex flex-col h-full" style={{ background:"#080d18" }}>
        {/* Logo */}
        <div className="px-4 pt-5 pb-4 shrink-0 relative"
          style={{ borderBottom:"1px solid rgba(167,139,250,0.12)" }}>
          {closable && (
            <button onClick={() => setSideOpen(false)}
              className="absolute top-4 right-3 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer text-xs"
              style={{ background:"rgba(255,255,255,0.05)", color:T.muted }}>✕</button>
          )}
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-black"
              style={{ background:"linear-gradient(135deg,rgba(167,139,250,0.2),rgba(109,40,217,0.25))", border:"1px solid rgba(167,139,250,0.3)", color:"#a78bfa" }}>
              👤
            </div>
            <span className="text-lg font-black tracking-tight">
              <span className="text-white">WIN</span>
              <span style={{ color:"#a78bfa" }}>GGO</span>
            </span>
          </div>
          <p className="text-[9px] font-black tracking-[0.18em] ml-0.5" style={{ color:"rgba(167,139,250,0.4)" }}>STAFF PORTAL</p>
          {/* Staff chip */}
          <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.12)" }}>
            <span className="text-xs font-black font-mono" style={{ color:"#a78bfa" }}>{username}</span>
            <span className="ml-auto text-[9px] font-black px-1.5 py-0.5 rounded"
              style={{ background:"rgba(0,255,136,0.1)", color:T.green }}>STAFF</span>
          </div>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5" style={{ scrollbarWidth:"none" }}>
          {allowedNav.map((n) => {
            const isA = active === n.key;
            return (
              <motion.button key={n.key} whileTap={{ scale:0.97 }}
                onClick={() => navTo(n.key, n.tab ?? "")}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left cursor-pointer"
                style={{
                  background: isA ? "rgba(167,139,250,0.1)" : "rgba(255,255,255,0.02)",
                  border:`1px solid ${isA?"rgba(167,139,250,0.25)":"rgba(255,255,255,0.04)"}`,
                }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-base"
                  style={{ background:isA?"rgba(167,139,250,0.14)":"rgba(255,255,255,0.05)", border:`1px solid ${isA?"rgba(167,139,250,0.3)":"rgba(255,255,255,0.07)"}` }}>
                  {n.icon}
                </div>
                <span className="flex-1 text-[12px] font-black leading-tight truncate"
                  style={{ color:isA?"#a78bfa":"rgba(226,232,240,0.75)" }}>
                  {n.label}
                </span>
                {isA && <div className="w-1 h-5 rounded-full shrink-0" style={{ background:"#a78bfa", boxShadow:"0 0 8px #a78bfa" }} />}
              </motion.button>
            );
          })}
        </div>

        {/* Permissions summary */}
        <div className="mx-2.5 mb-2.5 px-3 py-2 rounded-xl shrink-0"
          style={{ background:"rgba(167,139,250,0.04)", border:"1px solid rgba(167,139,250,0.1)" }}>
          <p className="text-[8px] font-black" style={{ color:"rgba(167,139,250,0.5)" }}>YOUR ACCESS</p>
          <p className="text-[10px] mt-0.5 font-mono text-white">{allowedNav.length - 1} module{allowedNav.length - 1 !== 1 ? "s" : ""} granted</p>
        </div>

        {/* Logout */}
        <div className="px-2.5 pb-4 shrink-0" style={{ borderTop:"1px solid rgba(167,139,250,0.08)", paddingTop:10 }}>
          <motion.button whileTap={{ scale:0.96 }} onClick={handleLogout}
            className="w-full py-2.5 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-2"
            style={{ background:"rgba(255,51,102,0.07)", color:T.red, border:"1px solid rgba(255,51,102,0.18)" }}>
            <span>⏻</span><span>Logout</span>
          </motion.button>
        </div>
      </div>
    );
  }

  // Resolve the page title
  const curNav = allowedNav.find((n) => n.key === active);
  const pageTitle = curNav?.label ?? "Dashboard";
  const pageIcon  = curNav?.icon ?? "📊";

  return (
    <div className="min-h-screen flex" style={{ background:"#070b12", color:"#e2e8f0" }}>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 w-[220px]"
        style={{ borderRight:"1px solid rgba(167,139,250,0.1)" }}>
        <SidebarContent />
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {sideOpen && (
          <>
            <motion.div key="bd" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="fixed inset-0 z-40 lg:hidden" style={{ background:"rgba(0,0,0,0.8)" }}
              onClick={() => setSideOpen(false)} />
            <motion.div key="dr"
              initial={{ x:-240 }} animate={{ x:0 }} exit={{ x:-240 }}
              transition={{ type:"spring", damping:28, stiffness:300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[220px] lg:hidden flex flex-col"
              style={{ borderRight:"1px solid rgba(167,139,250,0.12)" }}>
              <SidebarContent closable />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 lg:ml-[220px]">

        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
          style={{ background:"rgba(7,11,18,0.92)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(167,139,250,0.1)" }}>
          <button className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer"
            style={{ background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.15)" }}
            onClick={() => setSideOpen(true)}>
            <span style={{ color:"#a78bfa" }}>☰</span>
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{pageIcon}</span>
            <div className="min-w-0">
              <span className="text-sm font-black text-white truncate block">{pageTitle}</span>
              <span className="text-[9px] font-bold tracking-widest hidden sm:block" style={{ color:"rgba(167,139,250,0.4)" }}>
                WINGGO STAFF CONSOLE · {username.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
            style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.15)" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:"#a78bfa" }}
              animate={{ opacity:[1,0.2,1] }} transition={{ duration:1.8, repeat:Infinity }} />
            <span className="text-[10px] font-black" style={{ color:"#a78bfa" }}>STAFF MODE</span>
          </div>
          <motion.button whileTap={{ scale:0.94 }} onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
            style={{ background:"rgba(255,51,102,0.08)", color:T.red, border:"1px solid rgba(255,51,102,0.2)" }}>
            ⏻
          </motion.button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div key={active}
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }} transition={{ duration:0.18 }}
              className="h-full">

              {active === "dashboard" && <StaffOverview username={username} perms={perms} allowedNav={allowedNav} onNavTo={navTo} />}
              {(active === "users") && <PageUserManagement jumpTab={activeTab} />}
              {(walletPageKey === "wallet") && <PageWalletTxns jumpTab={activeTab} />}
              {active === "kyc" && <PageUserManagement jumpTab="kyc" />}
              {active === "games" && <PageGameSettings jumpTab={activeTab} />}
              {active === "marketing" && <PageMarketing jumpTab={activeTab} />}
              {active === "notifications" && <PageNotifications jumpTab={activeTab} />}
              {active === "referral" && <PageReferral jumpTab={activeTab} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// ─── Staff Overview ────────────────────────────────────────────────────────────

function StaffOverview({
  username, perms, allowedNav, onNavTo,
}: {
  username:    string;
  perms:       StaffPermissions;
  allowedNav:  { key:string; icon:string; label:string; tab?:string }[];
  onNavTo:     (key:string, tab?:string) => void;
}) {
  const grantedCount = Object.values(perms).filter(Boolean).length;
  return (
    <div className="p-4 space-y-4 max-w-2xl">
      {/* Welcome */}
      <div className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.18)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
          style={{ background:"linear-gradient(135deg,rgba(167,139,250,0.15),rgba(109,40,217,0.2))", border:"1px solid rgba(167,139,250,0.3)", color:"#a78bfa" }}>
          {username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-lg font-black text-white">Welcome, {username}!</p>
          <p className="text-xs mt-0.5" style={{ color:"rgba(226,232,240,0.4)" }}>
            Staff Portal · {grantedCount} module{grantedCount !== 1 ? "s" : ""} accessible
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:"#00ff88" }}
              animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.8, repeat:Infinity }} />
            <span className="text-[10px] font-black" style={{ color:"#00ff88" }}>AUTHENTICATED · RESTRICTED ACCESS</span>
          </div>
        </div>
      </div>

      {/* Accessible modules */}
      <div>
        <p className="text-[9px] font-black tracking-widest mb-2" style={{ color:"rgba(0,212,255,0.35)" }}>YOUR ACCESSIBLE MODULES</p>
        <div className="grid grid-cols-2 gap-2">
          {allowedNav.filter((n) => n.key !== "dashboard").map((n) => (
            <motion.button key={n.key} whileTap={{ scale:0.96 }}
              onClick={() => onNavTo(n.key, n.tab)}
              className="rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left cursor-pointer"
              style={{ background:"rgba(0,212,255,0.04)", border:"1px solid rgba(0,212,255,0.1)" }}>
              <span className="text-2xl">{n.icon}</span>
              <span className="text-xs font-black text-white">{n.label}</span>
            </motion.button>
          ))}
        </div>
        {allowedNav.length <= 1 && (
          <div className="rounded-xl px-4 py-6 text-center"
            style={{ background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.08)" }}>
            <p className="text-sm font-black text-white">No modules assigned</p>
            <p className="text-xs mt-1" style={{ color:"rgba(226,232,240,0.3)" }}>
              Contact your Super-Admin to get module access.
            </p>
          </div>
        )}
      </div>

      {/* Restrictions notice */}
      <div className="rounded-xl px-4 py-3"
        style={{ background:"rgba(255,51,102,0.04)", border:"1px solid rgba(255,51,102,0.12)" }}>
        <p className="text-[11px] leading-relaxed" style={{ color:"rgba(226,232,240,0.35)" }}>
          🔒 <span className="font-black" style={{ color:"rgba(255,51,102,0.7)" }}>Restricted:</span>{" "}
          Code Editor, Staff Management, Version Control, and Security settings are not available in Staff mode.
        </p>
      </div>
    </div>
  );
}
