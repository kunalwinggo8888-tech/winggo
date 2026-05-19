/**
 * AdminSidebar — WINGGO Admin v2
 * Collapsible nav groups with Lucide icons, 9 modules + Code Editor
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Wallet, Gamepad2, Megaphone,
  Bell, GitBranch, Shield, Code2, User, CheckSquare,
  CreditCard, History, Link2, ArrowDownToLine,
  ArrowUpFromLine, ScrollText, Gift, Image, Tag,
  Star, RotateCcw, BellRing, Newspaper, MessageSquare,
  Percent, Trophy, UploadCloud, UserCog, Activity,
  AlertTriangle, ChevronDown, KeyRound, MonitorPlay,
  type LucideIcon,
} from "lucide-react";

export type AdminPage =
  | "dashboard"
  | "users"
  | "wallet"
  | "games"
  | "marketing"
  | "notifications"
  | "referral"
  | "security"
  | "editor"
  | "versions"
  | "staff";

export interface NavDest { page: AdminPage; tab: string }

interface AdminSidebarProps {
  active: AdminPage;
  activeTab: string;
  onNav:    (dest: NavDest) => void;
  onLogout: () => void;
  open:     boolean;
  onClose:  () => void;
}

interface SubItem { tab: string; icon: LucideIcon; label: string }
interface NavGroup {
  id:      AdminPage;
  icon:    LucideIcon;
  label:   string;
  badge?:  string;
  items?:  SubItem[];
}

const NAV: NavGroup[] = [
  { id: "dashboard",     icon: LayoutDashboard, label: "Dashboard",             badge: "LIVE" },
  { id: "users",         icon: Users,           label: "User Management",       items: [
      { tab: "list",     icon: User,            label: "User List"           },
      { tab: "kyc",      icon: CheckSquare,     label: "KYC Verification"    },
      { tab: "upi",      icon: CreditCard,      label: "UPI Details"         },
      { tab: "referral", icon: GitBranch,       label: "Referral History"    },
      { tab: "login",    icon: History,         label: "Login History"       },
    ],
  },
  { id: "wallet",        icon: Wallet,          label: "Wallet & Transactions", items: [
      { tab: "deposits",     icon: ArrowDownToLine, label: "Deposit Requests"    },
      { tab: "withdrawals",  icon: ArrowUpFromLine, label: "Withdrawal Requests" },
      { tab: "logs",         icon: ScrollText,      label: "Transaction Logs"    },
      { tab: "bonus",        icon: Gift,            label: "Bonus & Coupons"     },
    ],
  },
  { id: "games",         icon: Gamepad2,        label: "Game Settings",         items: [
      { tab: "config",      icon: Gamepad2,     label: "Game Config"         },
      { tab: "uploader",    icon: UploadCloud,  label: "Cloud Uploader"      },
      { tab: "tournaments", icon: Trophy,       label: "Tournaments"         },
    ],
  },
  { id: "marketing",     icon: Megaphone,       label: "Banners & Marketing",   items: [
      { tab: "banners",  icon: Image,           label: "App Banners"         },
      { tab: "popup",    icon: MonitorPlay,     label: "App-Open Banner Ad"  },
      { tab: "promo",    icon: Tag,             label: "Promo Codes"         },
      { tab: "rewards",  icon: Star,            label: "Daily Rewards"       },
      { tab: "spin",     icon: RotateCcw,       label: "Spin Wheel"          },
    ],
  },
  { id: "notifications", icon: Bell,            label: "Notifications",         items: [
      { tab: "push",     icon: BellRing,        label: "Push Notifications"  },
      { tab: "announce", icon: Newspaper,       label: "Announcements"       },
      { tab: "social",   icon: MessageSquare,   label: "Social Links"        },
    ],
  },
  { id: "referral",      icon: Link2,           label: "Referral & Earnings",   items: [
      { tab: "commission", icon: Percent,       label: "Commission Rules"    },
      { tab: "level",      icon: GitBranch,     label: "Level Income"        },
      { tab: "invite",     icon: Gift,          label: "Invite Rewards"      },
    ],
  },
  { id: "security",      icon: Shield,          label: "Security & Logs",       items: [
      { tab: "profile",   icon: UserCog,        label: "Admin Profile"              },
      { tab: "actlogs",   icon: Activity,       label: "Activity Logs"              },
      { tab: "fraud",     icon: AlertTriangle,  label: "Fraud Detection"            },
      { tab: "recovery",  icon: KeyRound,       label: "Emergency Recovery Config"  },
    ],
  },
  { id: "editor",        icon: Code2,           label: "Master Code Editor",    badge: "LIVE" },
  { id: "versions",      icon: History,         label: "Version Control",       badge: "VIRAS" },
  { id: "staff",         icon: UserCog,         label: "Staff Management"                      },
];

// ─── SidebarContent ───────────────────────────────────────────────────────────

function SidebarContent({
  active, activeTab, onNav, onLogout, onClose,
}: Pick<AdminSidebarProps, "active" | "activeTab" | "onNav" | "onLogout"> & { onClose?: () => void }) {
  const [expanded, setExpanded] = useState<Set<AdminPage>>(
    () => new Set([active])
  );

  function toggle(id: AdminPage) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGroup(group: NavGroup) {
    if (!group.items) {
      onNav({ page: group.id, tab: "" });
      return;
    }
    toggle(group.id);
    if (!expanded.has(group.id)) {
      // navigating into the group — go to first sub-item
      onNav({ page: group.id, tab: group.items[0].tab });
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#080d18" }}>

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 shrink-0 relative" style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}>
        {onClose && (
          <button onClick={onClose}
            className="absolute top-4 right-3 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer text-xs"
            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(226,232,240,0.4)" }}>✕</button>
        )}
        <div className="flex items-center gap-2 mb-0.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-black shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,85,255,0.25))", border: "1px solid rgba(0,212,255,0.3)", color: "#00d4ff" }}>
            ⚡
          </div>
          <span className="text-lg font-black tracking-tight">
            <span className="text-white">WIN</span>
            <span style={{ color: "#00d4ff" }}>GGO</span>
          </span>
        </div>
        <p className="text-[9px] font-black tracking-[0.18em] ml-0.5" style={{ color: "rgba(0,212,255,0.4)" }}>ADMIN CONSOLE v2</p>
      </div>

      {/* Nav scroll area */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5"
        style={{ scrollbarWidth: "none" }}>
        {NAV.map((group) => {
          const isActivePage  = active === group.id;
          const isExpanded    = expanded.has(group.id);
          const GroupIcon     = group.icon;

          return (
            <div key={group.id}>
              {/* Group header */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleGroup(group)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left cursor-pointer"
                style={{
                  background: isActivePage ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.02)",
                  border:     `1px solid ${isActivePage ? "rgba(0,212,255,0.22)" : "rgba(255,255,255,0.04)"}`,
                  transition: "all 0.18s ease",
                }}
              >
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: isActivePage ? "rgba(0,212,255,0.14)" : "rgba(255,255,255,0.05)",
                    border:     `1px solid ${isActivePage ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  <GroupIcon size={14} color={isActivePage ? "#00d4ff" : "rgba(226,232,240,0.5)"} />
                </div>
                <span className="flex-1 text-[12px] font-black leading-tight truncate"
                  style={{ color: isActivePage ? "#00d4ff" : "rgba(226,232,240,0.75)" }}>
                  {group.label}
                </span>
                {group.badge && (
                  <span className="text-[8px] font-black px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff" }}>
                    {group.badge}
                  </span>
                )}
                {group.items && (
                  <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="shrink-0">
                    <ChevronDown size={12} color="rgba(226,232,240,0.35)" />
                  </motion.div>
                )}
                {isActivePage && !group.items && (
                  <div className="w-1 h-5 rounded-full shrink-0"
                    style={{ background: "#00d4ff", boxShadow: "0 0 8px #00d4ff" }} />
                )}
              </motion.button>

              {/* Sub-items */}
              <AnimatePresence initial={false}>
                {group.items && isExpanded && (
                  <motion.div
                    key="sub"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    style={{ overflow: "hidden" }}
                  >
                    <div className="pl-3 pr-1 pt-0.5 pb-1 space-y-0.5">
                      {group.items.map((item) => {
                        const isActive = isActivePage && activeTab === item.tab;
                        const ItemIcon = item.icon;
                        return (
                          <motion.button
                            key={item.tab}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => onNav({ page: group.id, tab: item.tab })}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left cursor-pointer"
                            style={{
                              background: isActive ? "rgba(0,212,255,0.07)" : "transparent",
                              border:     `1px solid ${isActive ? "rgba(0,212,255,0.18)" : "transparent"}`,
                            }}
                          >
                            <ItemIcon size={12} color={isActive ? "#00d4ff" : "rgba(226,232,240,0.4)"} />
                            <span className="text-[11px] font-bold truncate"
                              style={{ color: isActive ? "#00d4ff" : "rgba(226,232,240,0.55)" }}>
                              {item.label}
                            </span>
                            {isActive && (
                              <div className="ml-auto w-1 h-4 rounded-full shrink-0"
                                style={{ background: "#00d4ff", boxShadow: "0 0 6px #00d4ff" }} />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Status */}
      <div className="mx-2.5 mb-2.5 px-3 py-2 rounded-xl shrink-0"
        style={{ background: "rgba(0,212,255,0.04)", border: "1px solid rgba(0,212,255,0.1)" }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <motion.div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "#00ff88" }}
            animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
          <span className="text-[8px] font-black" style={{ color: "#00ff88" }}>ALL SYSTEMS OPERATIONAL</span>
        </div>
        <p className="text-[8px]" style={{ color: "rgba(226,232,240,0.25)" }}>Firebase · Firestore · Storage · RTDB</p>
      </div>

      {/* Logout */}
      <div className="px-2.5 pb-4 shrink-0" style={{ borderTop: "1px solid rgba(0,212,255,0.08)", paddingTop: 10 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onLogout}
          className="w-full py-2.5 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-2"
          style={{ background: "rgba(255,51,102,0.07)", color: "#ff3366", border: "1px solid rgba(255,51,102,0.18)" }}>
          <span>⏻</span><span>Logout</span>
        </motion.button>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function AdminSidebar(props: AdminSidebarProps) {
  const { open, onClose } = props;
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-40 w-[240px]"
        style={{ borderRight: "1px solid rgba(0,212,255,0.1)" }}>
        <SidebarContent {...props} />
      </div>

      {/* Mobile overlay drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)" }}
              onClick={onClose} />
            <motion.div key="dr"
              initial={{ x: -250 }} animate={{ x: 0 }} exit={{ x: -250 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[240px] lg:hidden flex flex-col"
              style={{ borderRight: "1px solid rgba(0,212,255,0.12)" }}>
              <SidebarContent {...props} onClose={onClose} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
