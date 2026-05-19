/**
 * PageUserManagement — 5 tabs: Users · KYC · UPI · Referral History · Login History
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeUsers, banUser, setUserWallet,
  subscribeKYCRequests, approveKYC, rejectKYC,
  UserProfile, KYCRequest,
} from "@/firebase/admin.service";

const T = {
  blue:  "#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted: "rgba(226,232,240,0.4)",
  card:  "rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

const TABS = [
  { id:"list",    label:"👤 User List"         },
  { id:"kyc",     label:"✅ KYC Verification"  },
  { id:"upi",     label:"📱 UPI Details"       },
  { id:"referral",label:"🔗 Referral History"  },
  { id:"login",   label:"🕐 Login History"     },
];

function TabBar({ tab, setTab }: { tab:string; setTab:(t:string)=>void }) {
  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto sticky top-0 z-10"
      style={{ background:"rgba(7,11,18,0.95)", backdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(0,212,255,0.1)", scrollbarWidth:"none" }}>
      {TABS.map((t) => {
        const isActive = tab===t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="px-3 py-2 rounded-xl text-xs font-black cursor-pointer shrink-0"
            style={{
              background: isActive?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.03)",
              color:      isActive?T.blue:"rgba(226,232,240,0.45)",
              border:     `1px solid ${isActive?"rgba(0,212,255,0.28)":"rgba(255,255,255,0.06)"}`,
            }}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Balance Modal ────────────────────────────────────────────────────────────

function BalanceModal({ user, onClose }: { user:UserProfile; onClose:()=>void }) {
  const [deposit,  setDeposit]  = useState("");
  const [winning,  setWinning]  = useState("");
  const [bonus,    setBonus]    = useState("");
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  async function save() {
    if (!user.uid) return;
    setSaving(true);
    const updates: { deposit?:number; winning?:number; bonus?:number } = {};
    if (deposit!=="") updates.deposit = parseFloat(deposit)||0;
    if (winning!=="") updates.winning = parseFloat(winning)||0;
    if (bonus  !=="") updates.bonus   = parseFloat(bonus)  ||0;
    await setUserWallet(user.uid, updates);
    setSaving(false); setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <>
      <motion.div key="bd" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="fixed inset-0 z-50" style={{background:"rgba(0,0,0,0.78)",backdropFilter:"blur(5px)"}}
        onClick={onClose} />
      <motion.div key="m" initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
        className="fixed inset-x-4 z-50 mx-auto rounded-2xl overflow-hidden"
        style={{maxWidth:400,top:"50%",transform:"translateY(-50%)",background:"#0a0f1a",border:"1px solid rgba(0,212,255,0.25)"}}>
        <div className="px-5 py-4" style={{borderBottom:"1px solid rgba(0,212,255,0.1)"}}>
          <p className="text-sm font-black text-white">Edit Wallet Balance</p>
          <p className="text-[11px] mt-0.5" style={{color:T.muted}}>{user.displayName}</p>
        </div>
        <div className="p-5 space-y-3">
          {([["DEPOSIT ₹",deposit,setDeposit],["WINNINGS ₹",winning,setWinning],["BONUS ₹",bonus,setBonus]] as const).map(([label,val,set]) => (
            <div key={label as string}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.45)"}}>
                {label as string}
              </label>
              <input type="number" value={val as string} onChange={(e) => (set as (v:string)=>void)(e.target.value)}
                placeholder="Leave blank to keep current"
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:"rgba(255,255,255,0.04)",color:T.muted,border:"1px solid rgba(255,255,255,0.08)"}}>Cancel</button>
            <motion.button whileTap={{scale:0.96}} onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:done?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.12)",
                color:done?T.green:T.blue,border:`1px solid ${done?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.28)"}`}}>
              {done?"✅ Saved!":saving?"Saving…":"💾 Save"}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── User List Tab ────────────────────────────────────────────────────────────

function UserListTab() {
  const [users,    setUsers]    = useState<UserProfile[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [banning,  setBanning]  = useState<string|null>(null);
  const [editUser, setEditUser] = useState<UserProfile|null>(null);

  useEffect(() => {
    return subscribeUsers((list) => { setUsers(list); setLoading(false); });
  }, []);

  async function toggleBan(u:UserProfile) {
    if (!u.uid) return;
    setBanning(u.uid); await banUser(u.uid, !u.banned); setBanning(null);
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.uid?.includes(q);
  });

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div>
          <h3 className="text-sm font-black text-white">All Users</h3>
          <p className="text-[11px]" style={{color:T.muted}}>{users.length} total · {users.filter(u=>u.banned).length} banned</p>
        </div>
        <input value={search} onChange={(e)=>setSearch(e.target.value)}
          placeholder="🔍 Search name, email, UID…"
          className="flex-1 sm:max-w-xs px-3 py-2 rounded-xl text-sm text-white outline-none"
          style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i=>(
          <motion.div key={i} className="rounded-xl h-16" style={{background:T.card,border:`1px solid ${T.bdr}`}}
            animate={{opacity:[0.3,0.7,0.3]}} transition={{duration:1.3,repeat:Infinity,delay:i*0.1}} />
        ))}</div>
      ) : filtered.length===0 ? (
        <div className="rounded-2xl py-14 text-center" style={{border:"1px dashed rgba(0,212,255,0.12)"}}>
          <p className="text-sm font-bold" style={{color:T.muted}}>No users found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u,i) => {
            const isBanned = u.banned || u.isBanned;
            return (
              <motion.div key={u.uid??i} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                transition={{delay:Math.min(i*0.03,0.3)}}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{background:T.card,border:`1px solid ${isBanned?"rgba(255,51,102,0.18)":T.bdr}`}}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                  style={{background:"rgba(0,212,255,0.1)",color:T.blue,border:"1px solid rgba(0,212,255,0.2)"}}>
                  {(u.displayName??"?").slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-black text-white truncate">{u.displayName}</p>
                    {isBanned && <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                      style={{background:"rgba(255,51,102,0.12)",color:T.red}}>BANNED</span>}
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                      style={{background:u.kycStatus==="approved"?"rgba(0,255,136,0.1)":"rgba(245,158,11,0.1)",
                        color:u.kycStatus==="approved"?T.green:T.gold}}>
                      KYC {u.kycStatus??"pending"}
                    </span>
                  </div>
                  <p className="text-[11px] truncate" style={{color:T.muted}}>{u.email}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <motion.button whileTap={{scale:0.93}} onClick={()=>setEditUser(u)}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer hidden sm:block"
                    style={{background:"rgba(0,212,255,0.07)",color:T.blue,border:"1px solid rgba(0,212,255,0.18)"}}>
                    ₹ Wallet
                  </motion.button>
                  <motion.button whileTap={{scale:0.93}} onClick={()=>toggleBan(u)} disabled={banning===u.uid}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                    style={{background:isBanned?"rgba(0,255,136,0.07)":"rgba(255,51,102,0.07)",
                      color:isBanned?T.green:T.red,
                      border:`1px solid ${isBanned?"rgba(0,255,136,0.2)":"rgba(255,51,102,0.2)"}`,
                      opacity:banning===u.uid?0.5:1}}>
                    {banning===u.uid?"…":isBanned?"Unblock":"Block"}
                  </motion.button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      <AnimatePresence>
        {editUser && <BalanceModal user={editUser} onClose={()=>setEditUser(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── KYC Tab ──────────────────────────────────────────────────────────────────

function KYCTab() {
  const [requests, setRequests] = useState<KYCRequest[]>([]);
  const [acting,   setActing]   = useState<string|null>(null);
  const ADMIN_UID = "admin";

  useEffect(() => {
    return subscribeKYCRequests(setRequests);
  }, []);

  async function handleApprove(uid:string) {
    setActing(uid); await approveKYC(uid, ADMIN_UID); setActing(null);
  }
  async function handleReject(uid:string) {
    setActing(uid); await rejectKYC(uid, ADMIN_UID, "Rejected by admin"); setActing(null);
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">KYC Verification Requests</h3>
        <span className="text-[10px] font-black px-2 py-0.5 rounded"
          style={{background:"rgba(245,158,11,0.1)",color:T.gold}}>{requests.length} pending</span>
      </div>

      {requests.length===0 ? (
        <div className="rounded-2xl py-16 text-center" style={{border:"1px dashed rgba(0,212,255,0.12)"}}>
          <p className="text-3xl mb-3 opacity-20">✅</p>
          <p className="text-sm font-bold" style={{color:T.muted}}>No pending KYC requests.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.uid} className="rounded-2xl overflow-hidden"
              style={{background:T.card,border:`1px solid ${T.bdr}`}}>
              <div className="px-4 py-3 flex items-center gap-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0"
                  style={{background:"rgba(0,212,255,0.1)",color:T.blue,border:"1px solid rgba(0,212,255,0.2)"}}>
                  {req.displayName.slice(0,2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white">{req.displayName}</p>
                  <p className="text-[11px]" style={{color:T.muted}}>{req.email}</p>
                </div>
                <span className="text-[9px] font-black px-2 py-1 rounded shrink-0"
                  style={{background:"rgba(245,158,11,0.1)",color:T.gold,border:"1px solid rgba(245,158,11,0.2)"}}>
                  {req.docType.toUpperCase()}
                </span>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] mb-3" style={{color:T.muted}}>Doc: {req.docNumber}</p>
                <div className="flex gap-2">
                  {[req.frontURL, req.backURL, req.selfieURL].filter(Boolean).map((url,i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-black px-2 py-1 rounded cursor-pointer"
                      style={{background:"rgba(0,212,255,0.08)",color:T.blue,border:"1px solid rgba(0,212,255,0.18)"}}>
                      {["Front","Back","Selfie"][i]} ↗
                    </a>
                  ))}
                </div>
                <div className="flex gap-2 mt-3" style={{opacity:acting===req.uid?0.5:1}}>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>handleApprove(req.uid)}
                    className="flex-1 py-2 rounded-lg text-xs font-black cursor-pointer"
                    style={{background:"rgba(0,255,136,0.08)",color:T.green,border:"1px solid rgba(0,255,136,0.22)"}}>
                    ✓ Approve KYC
                  </motion.button>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>handleReject(req.uid)}
                    className="flex-1 py-2 rounded-lg text-xs font-black cursor-pointer"
                    style={{background:"rgba(255,51,102,0.08)",color:T.red,border:"1px solid rgba(255,51,102,0.2)"}}>
                    ✕ Reject
                  </motion.button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Placeholder tab ─────────────────────────────────────────────────────────

function PlaceholderTab({ icon, title, desc }: { icon:string; title:string; desc:string }) {
  return (
    <div className="p-4 flex flex-col items-center justify-center py-20">
      <div className="text-6xl mb-4 opacity-20">{icon}</div>
      <p className="text-base font-black text-white mb-1">{title}</p>
      <p className="text-sm text-center max-w-xs" style={{color:T.muted}}>{desc}</p>
      <div className="mt-4 px-3 py-2 rounded-xl text-xs font-black"
        style={{background:"rgba(0,212,255,0.06)",color:T.blue,border:"1px solid rgba(0,212,255,0.15)"}}>
        Connected to Firestore · configure collection path to enable
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageUserManagement({ jumpTab="" }: { jumpTab?:string }) {
  const [tab, setTab] = useState(jumpTab||"list");
  useEffect(() => { if (jumpTab) setTab(jumpTab); }, [jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-4}} transition={{duration:0.15}}>
          {tab==="list"     && <UserListTab />}
          {tab==="kyc"      && <KYCTab />}
          {tab==="upi"      && <PlaceholderTab icon="📱" title="UPI Details Management"
            desc="View and manage user UPI IDs linked to withdrawal requests. Connects to Firestore wallets collection." />}
          {tab==="referral" && <PlaceholderTab icon="🔗" title="Referral History"
            desc="View the full referral tree, commissions earned, and referred user activity. Connects to Firestore referrals collection." />}
          {tab==="login"    && <PlaceholderTab icon="🕐" title="Login History"
            desc="Track user login timestamps, devices, and IP addresses. Connects to Firestore loginHistory collection." />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
