/**
 * PageDashboard — Live platform metrics overview
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  subscribeUsers, subscribeOnlineUsers, subscribePlatformStats,
  subscribeWithdrawRequests, subscribeGames,
  subscribeLiveLudoMatches, getLudoStats,
  PlatformStats, WithdrawRequest, GameConfig, LudoMatchResult,
} from "@/firebase/admin.service";

const T = {
  blue:  "#00d4ff", green: "#00ff88", red: "#ff3366",
  gold:  "#f59e0b", purple:"#a855f7",
  muted: "rgba(226,232,240,0.4)",
  card:  "rgba(0,212,255,0.04)", bdr: "rgba(0,212,255,0.13)",
};

function StatCard({ icon, label, value, sub, color, delay }: {
  icon:string; label:string; value:string|number; sub?:string; color:string; delay:number;
}) {
  return (
    <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay }}
      className="rounded-2xl p-4" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
          style={{ background:`${color}15`, border:`1px solid ${color}30` }}>{icon}</div>
        <motion.div className="w-1.5 h-1.5 rounded-full mt-1" style={{ background:color }}
          animate={{ opacity:[1,0.3,1] }} transition={{ duration:2, repeat:Infinity }} />
      </div>
      <p className="text-2xl font-black text-white">{value}</p>
      <p className="text-[11px] font-black mt-0.5" style={{ color }}>{label}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color:T.muted }}>{sub}</p>}
    </motion.div>
  );
}

export default function PageDashboard() {
  const [userCount,   setUserCount]   = useState(0);
  const [onlineCount, setOnlineCount] = useState(0);
  const [stats,       setStats]       = useState<PlatformStats | null>(null);
  const [pendingW,    setPendingW]    = useState<WithdrawRequest[]>([]);
  const [activeGames, setActiveGames] = useState<GameConfig[]>([]);
  const [ludoMatches, setLudoMatches] = useState<LudoMatchResult[]>([]);
  const [ludoStats,   setLudoStats]   = useState<{
    totalMatches: number;
    activeMatches: number;
    realPlayers: number;
    botPlayers: number;
    totalWinnings: number;
    todayMatches: number;
  } | null>(null);

  useEffect(() => {
    const u1 = subscribeUsers((u) => setUserCount(u.length));
    const u2 = subscribeOnlineUsers(setOnlineCount);
    const u3 = subscribePlatformStats(setStats);
    const u4 = subscribeWithdrawRequests("pending", setPendingW);
    const u5 = subscribeGames((g) => setActiveGames(g.filter((x) => x.isActive)));
    const u6 = subscribeLiveLudoMatches(setLudoMatches);
    
    // Fetch Ludo stats periodically
    const fetchLudoStats = async () => {
      const stats = await getLudoStats();
      setLudoStats(stats);
    };
    fetchLudoStats();
    const ludoInterval = setInterval(fetchLudoStats, 30000); // Update every 30s
    
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); clearInterval(ludoInterval); };
  }, []);

  const totalDeposit    = stats?.totalDepositsAmount    ?? 0;
  const totalWithdrawal = stats?.totalWithdrawalsAmount ?? 0;
  const profit          = totalDeposit - totalWithdrawal;

  const CARDS = [
    { icon:"👥", label:"Total Users",      value:userCount.toLocaleString(),            sub:"Registered accounts",       color:T.blue   },
    { icon:"🟢", label:"Online Now",        value:onlineCount.toLocaleString(),          sub:"Live active users",         color:T.green  },
    { icon:"💰", label:"Total Deposits",    value:`₹${totalDeposit.toLocaleString()}`,   sub:"All time deposits",         color:T.gold   },
    { icon:"💸", label:"Total Withdrawals", value:`₹${totalWithdrawal.toLocaleString()}`,sub:"All time payouts",          color:T.purple },
    { icon: profit>=0?"📈":"📉",
      label:"Platform P&L", value:`${profit>=0?"+":""}₹${Math.abs(profit).toLocaleString()}`,
      sub: profit>=0?"Net profit":"Net loss", color: profit>=0?T.green:T.red },
    { icon:"🎮", label:"Active Games",      value:activeGames.length,                    sub:"Live & accepting players",  color:T.blue   },
    { icon:"🎲", label:"Ludo Matches",     value:ludoStats?.totalMatches ?? 0,             sub:"Total matches played",       color:T.gold   },
    { icon:"🔴", label:"Active Ludo",      value:ludoStats?.activeMatches ?? 0,            sub:"Matches in last 5 min",     color:T.red    },
    { icon:"👤", label:"Real Players",     value:ludoStats?.realPlayers ?? 0,             sub:"Vs bot matches",           color:T.green  },
    { icon:"🤖", label:"Bot Players",      value:ludoStats?.botPlayers ?? 0,              sub:"AI opponents",             color:T.purple },
    { icon:"🏆", label:"Total Winnings",   value:`₹${(ludoStats?.totalWinnings ?? 0).toLocaleString()}`, sub:"Paid to winners",          color:T.green  },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-black text-white">Platform Overview</h1>
        <p className="text-sm mt-1" style={{ color:T.muted }}>Live metrics from Firebase · auto-refreshing</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {CARDS.map((c,i) => <StatCard key={c.label} {...c} delay={i*0.07} />)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pending withdrawals */}
        <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom:`1px solid ${T.bdr}` }}>
            <span>⏳</span>
            <p className="text-sm font-black text-white">Pending Withdrawals</p>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded"
              style={{ background: pendingW.length>0?"rgba(245,158,11,0.12)":"rgba(0,212,255,0.08)",
                color: pendingW.length>0?T.gold:T.blue }}>
              {pendingW.length} pending
            </span>
          </div>
          <div className="p-3 space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
            {pendingW.length===0
              ? <p className="text-center py-6 text-sm font-bold" style={{ color:T.muted }}>✅ No pending requests</p>
              : pendingW.slice(0,8).map((w) => (
                <div key={w.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background:"rgba(0,0,0,0.2)", border:"1px solid rgba(245,158,11,0.12)" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate">{w.displayName}</p>
                    <p className="text-[10px] truncate" style={{ color:T.muted }}>{w.upiId}</p>
                  </div>
                  <p className="text-sm font-black ml-2 shrink-0" style={{ color:T.gold }}>₹{w.amount}</p>
                </div>
              ))
            }
          </div>
        </div>

        {/* Recent Ludo Matches */}
        <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom:`1px solid ${T.bdr}` }}>
            <span>🎲</span>
            <p className="text-sm font-black text-white">Recent Ludo Matches</p>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded"
              style={{ background:"rgba(245,158,11,0.12)", color:T.gold }}>{ludoMatches.length} total</span>
          </div>
          <div className="p-3 space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
            {ludoMatches.length===0
              ? <p className="text-center py-6 text-sm font-bold" style={{ color:T.muted }}>No matches yet</p>
              : ludoMatches.slice(0,8).map((m) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background:"rgba(0,0,0,0.2)", border:"1px solid rgba(245,158,11,0.12)" }}>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-white truncate">
                      {m.won ? "🏆" : "❌"} {m.opponentName} {m.opponentIsBot ? "🤖" : "👤"}
                    </p>
                    <p className="text-[10px]" style={{ color:T.muted }}>
                      {m.playerScore} vs {m.opponentScore} · {m.tier.toUpperCase()}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black" style={{ color:m.won ? T.green : T.red }}>
                      {m.won ? `+₹${m.prizeAmount}` : `-₹${m.entryFee}`}
                    </p>
                    <p className="text-[9px]" style={{ color:T.muted }}>{Math.floor(m.duration / 60)}m</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Active games */}
        <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom:`1px solid ${T.bdr}` }}>
            <span>🎮</span>
            <p className="text-sm font-black text-white">Live Games</p>
            <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded"
              style={{ background:"rgba(0,255,136,0.08)", color:T.green }}>{activeGames.length} live</span>
          </div>
          <div className="p-3 space-y-2 max-h-60 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
            {activeGames.length===0
              ? <p className="text-center py-6 text-sm font-bold" style={{ color:T.muted }}>No active games</p>
              : activeGames.map((g) => (
                <div key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                  style={{ background:"rgba(0,0,0,0.2)", border:"1px solid rgba(0,255,136,0.1)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shrink-0"
                    style={{ background:"rgba(0,212,255,0.1)" }}>
                    {g.gameIcon || "🎮"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white truncate">{g.name}</p>
                    <p className="text-[10px]" style={{ color:T.muted }}>{g.category}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black" style={{ color:T.gold }}>₹{g.entryFees[0]}-{g.entryFees[g.entryFees.length-1]}</p>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Ludo Stats Summary */}
        <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
          <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom:`1px solid ${T.bdr}` }}>
            <span>📊</span>
            <p className="text-sm font-black text-white">Ludo Statistics</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-2xl font-black text-white">{ludoStats?.todayMatches ?? 0}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color:T.muted }}>Today's Matches</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color:T.green }}>₹{(ludoStats?.totalWinnings ?? 0).toLocaleString()}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color:T.muted }}>Total Paid</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color:T.blue }}>{ludoStats?.realPlayers ?? 0}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color:T.muted }}>Real Players</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-black" style={{ color:T.purple }}>{ludoStats?.botPlayers ?? 0}</p>
              <p className="text-[10px] font-bold mt-1" style={{ color:T.muted }}>Bot Players</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
