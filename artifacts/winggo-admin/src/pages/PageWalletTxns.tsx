/**
 * PageWalletTxns — 4 tabs: Deposits · Withdrawals · Transaction Logs · Bonus & Coupons
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeWithdrawRequests, approveWithdraw, rejectWithdraw,
  subscribeDeposits,
  WithdrawRequest, DepositRecord,
} from "@/firebase/admin.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted:"rgba(226,232,240,0.4)", card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};
const ADMIN_UID = "admin";

const TABS = [
  { id:"deposits",    label:"💰 Deposits"         },
  { id:"withdrawals", label:"💸 Withdrawals"       },
  { id:"logs",        label:"📜 Logs"              },
  { id:"bonus",       label:"🎁 Bonus & Coupons"   },
];

function TabBar({ tab, setTab }: { tab:string; setTab:(t:string)=>void }) {
  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto sticky top-0 z-10"
      style={{background:"rgba(7,11,18,0.95)",backdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(0,212,255,0.1)",scrollbarWidth:"none"}}>
      {TABS.map((t) => {
        const isA = tab===t.id;
        return (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className="px-3 py-2 rounded-xl text-xs font-black cursor-pointer shrink-0"
            style={{background:isA?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.03)",
              color:isA?T.blue:"rgba(226,232,240,0.45)",
              border:`1px solid ${isA?"rgba(0,212,255,0.28)":"rgba(255,255,255,0.06)"}`}}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function fmtTs(ts:{seconds?:number}|undefined):string {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds*1000).toLocaleString("en-IN",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});
}

// ─── Reject Modal ─────────────────────────────────────────────────────────────

function RejectModal({ onConfirm, onClose }: { onConfirm:(r:string)=>void; onClose:()=>void }) {
  const [reason, setReason] = useState("");
  return (
    <>
      <motion.div key="bd" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        className="fixed inset-0 z-50" style={{background:"rgba(0,0,0,0.8)",backdropFilter:"blur(5px)"}}
        onClick={onClose} />
      <motion.div key="m" initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.9,opacity:0}}
        className="fixed inset-x-4 z-50 mx-auto rounded-2xl overflow-hidden"
        style={{maxWidth:380,top:"50%",transform:"translateY(-50%)",background:"#0a0f1a",border:"1px solid rgba(255,51,102,0.25)"}}>
        <div className="px-5 py-4" style={{borderBottom:"1px solid rgba(255,51,102,0.1)"}}>
          <p className="text-sm font-black text-white">Rejection Reason</p>
          <p className="text-[11px] mt-0.5" style={{color:T.muted}}>Amount will be refunded to the user's wallet.</p>
        </div>
        <div className="p-5 space-y-3">
          <textarea value={reason} onChange={e=>setReason(e.target.value)} rows={3}
            placeholder="Reason (optional)…" className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
            style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,51,102,0.2)",caretColor:T.red}} />
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:"rgba(255,255,255,0.04)",color:T.muted,border:"1px solid rgba(255,255,255,0.08)"}}>Cancel</button>
            <motion.button whileTap={{scale:0.96}} onClick={()=>onConfirm(reason)}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:"rgba(255,51,102,0.1)",color:T.red,border:"1px solid rgba(255,51,102,0.25)"}}>
              ✕ Reject & Refund
            </motion.button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── Deposits Tab ─────────────────────────────────────────────────────────────

function DepositsTab() {
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  useEffect(() => { return subscribeDeposits(setDeposits); }, []);

  const total = deposits.filter(d=>d.status==="success").reduce((s,d)=>s+d.amount,0);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="text-sm font-black text-white">Deposit History</h3>
          <p className="text-[11px]" style={{color:T.muted}}>{deposits.length} records · ₹{total.toLocaleString()} total successful</p>
        </div>
      </div>
      {deposits.length===0
        ? <div className="rounded-2xl py-14 text-center" style={{border:"1px dashed rgba(0,212,255,0.12)"}}>
            <p className="text-3xl mb-3 opacity-20">💳</p>
            <p className="text-sm font-bold" style={{color:T.muted}}>No deposit records found.</p>
          </div>
        : <div className="space-y-2">
            {deposits.map((dep,i) => {
              const sc = dep.status==="success"?T.green:dep.status==="failed"?T.red:T.gold;
              return (
                <div key={dep.id??i} className="rounded-xl px-4 py-3 flex items-center gap-3"
                  style={{background:T.card,border:`1px solid ${T.bdr}`}}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-black text-white">{dep.displayName}</p>
                        <p className="text-[11px] truncate" style={{color:T.muted}}>{dep.email}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-black" style={{color:T.green}}>₹{dep.amount}</p>
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                          style={{background:`${sc}15`,color:sc}}>{dep.status.toUpperCase()}</span>
                      </div>
                    </div>
                    {dep.razorpayPaymentId && (
                      <p className="text-[10px] font-mono mt-1" style={{color:T.muted}}>
                        ID: {dep.razorpayPaymentId}{dep.bonusAmount>0?` · Bonus: ₹${dep.bonusAmount}`:""}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── Withdrawals Tab ──────────────────────────────────────────────────────────

function WithdrawalsTab() {
  const [wFilter,  setWFilter]  = useState<"pending"|"approved"|"rejected"|"all">("pending");
  const [requests, setRequests] = useState<WithdrawRequest[]>([]);
  const [rejectTgt,setRejectTgt]= useState<WithdrawRequest|null>(null);
  const [acting,   setActing]   = useState<string|null>(null);

  useEffect(() => { return subscribeWithdrawRequests(wFilter, setRequests); }, [wFilter]);

  async function handleApprove(req:WithdrawRequest) {
    if (!req.id) return; setActing(req.id);
    await approveWithdraw(req.id, ADMIN_UID); setActing(null);
  }
  async function handleReject(req:WithdrawRequest, reason:string) {
    if (!req.id) return; setActing(req.id);
    await rejectWithdraw(req.id, ADMIN_UID, reason); setRejectTgt(null); setActing(null);
  }

  const filterBtns = ([
    ["pending","Pending"],["approved","Approved"],["rejected","Rejected"],["all","All"],
  ] as const);

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-black text-white mr-1">Withdrawal Requests</h3>
        {filterBtns.map(([id,label]) => {
          const isA = wFilter===id;
          return (
            <button key={id} onClick={()=>setWFilter(id)}
              className="px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer"
              style={{background:isA?"rgba(0,212,255,0.09)":"rgba(255,255,255,0.03)",
                color:isA?T.blue:T.muted,border:`1px solid ${isA?"rgba(0,212,255,0.22)":"rgba(255,255,255,0.06)"}`}}>
              {label}
            </button>
          );
        })}
      </div>

      {requests.length===0
        ? <div className="rounded-2xl py-14 text-center" style={{border:"1px dashed rgba(0,212,255,0.12)"}}>
            <p className="text-3xl mb-3 opacity-20">💸</p>
            <p className="text-sm font-bold" style={{color:T.muted}}>No {wFilter} withdrawal requests.</p>
          </div>
        : <div className="space-y-2">
            {requests.map((req) => {
              const isPending  = req.status==="pending";
              const sc = req.status==="approved"?T.green:req.status==="rejected"?T.red:T.gold;
              return (
                <div key={req.id} className="rounded-xl px-4 py-3"
                  style={{background:T.card,border:`1px solid ${T.bdr}`,opacity:acting===req.id?0.5:1,transition:"opacity 0.2s"}}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0"
                      style={{background:"rgba(0,212,255,0.1)",color:T.blue,border:"1px solid rgba(0,212,255,0.2)"}}>₹</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          <p className="text-sm font-black text-white">{req.displayName}</p>
                          <p className="text-[11px]" style={{color:T.muted}}>{req.email}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-black" style={{color:T.green}}>₹{req.amount}</p>
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                            style={{background:`${sc}15`,color:sc}}>{req.status.toUpperCase()}</span>
                        </div>
                      </div>
                      <p className="mt-1 text-[11px]" style={{color:T.muted}}>
                        UPI: <span className="font-mono text-white">{req.upiId}</span>
                        {" · "}{fmtTs(req.requestedAt as unknown as {seconds?:number})}
                      </p>
                      {req.rejectionReason && (
                        <p className="mt-1 text-[10px]" style={{color:T.red}}>Rejected: {req.rejectionReason}</p>
                      )}
                      {isPending && (
                        <div className="flex gap-2 mt-3">
                          <motion.button whileTap={{scale:0.95}} onClick={()=>handleApprove(req)}
                            className="flex-1 py-2 rounded-lg text-xs font-black cursor-pointer"
                            style={{background:"rgba(0,255,136,0.08)",color:T.green,border:"1px solid rgba(0,255,136,0.22)"}}>
                            ✓ Approve
                          </motion.button>
                          <motion.button whileTap={{scale:0.95}} onClick={()=>setRejectTgt(req)}
                            className="flex-1 py-2 rounded-lg text-xs font-black cursor-pointer"
                            style={{background:"rgba(255,51,102,0.08)",color:T.red,border:"1px solid rgba(255,51,102,0.2)"}}>
                            ✕ Reject
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      }
      <AnimatePresence>
        {rejectTgt && <RejectModal onConfirm={(r)=>handleReject(rejectTgt,r)} onClose={()=>setRejectTgt(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ─── Bonus & Coupons Tab ──────────────────────────────────────────────────────

function BonusTab() {
  const [code,    setCode]    = useState("");
  const [amount,  setAmount]  = useState("");
  const [limit,   setLimit]   = useState("1");
  const [saved,   setSaved]   = useState(false);

  const SAMPLE_CODES = [
    { code:"WINGGO50", amount:50, used:14, limit:100, active:true },
    { code:"LUDO100",  amount:100,used:7,  limit:50,  active:true },
    { code:"BONUS25",  amount:25, used:50, limit:50,  active:false},
  ];

  async function handleCreate() {
    if (!code.trim() || !amount) return;
    setSaved(true); setTimeout(()=>setSaved(false),2000);
    setCode(""); setAmount(""); setLimit("1");
  }

  return (
    <div className="p-4 space-y-4">
      {/* Create coupon */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Create Promo / Coupon Code</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {([
            {label:"CODE",           val:code,   set:setCode,  placeholder:"e.g. WINGGO50", type:"text"},
            {label:"BONUS AMOUNT ₹", val:amount, set:setAmount,placeholder:"50",            type:"number"},
            {label:"MAX USES",       val:limit,  set:setLimit, placeholder:"100",           type:"number"},
          ] as const).map(({label,val,set,placeholder,type})=>(
            <div key={label as string}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.45)"}}>
                {label as string}
              </label>
              <input type={type as string} value={val as string} onChange={e=>(set as (v:string)=>void)(e.target.value)} placeholder={placeholder as string}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <motion.button whileTap={{scale:0.97}} onClick={handleCreate}
            className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer"
            style={{background:saved?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
              color:saved?T.green:T.blue,border:`1px solid ${saved?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
            {saved?"✅ Coupon Created!":"+ Create Coupon Code"}
          </motion.button>
        </div>
      </div>

      {/* Existing codes */}
      <div>
        <p className="text-[9px] font-black tracking-widest mb-2" style={{color:"rgba(0,212,255,0.4)"}}>ACTIVE COUPONS</p>
        <div className="space-y-2">
          {SAMPLE_CODES.map((c)=>(
            <div key={c.code} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{background:T.card,border:`1px solid ${c.active?T.bdr:"rgba(255,255,255,0.06)"}`}}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-black font-mono text-white">{c.code}</p>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{background:c.active?"rgba(0,255,136,0.1)":"rgba(255,255,255,0.06)",
                      color:c.active?T.green:T.muted}}>{c.active?"ACTIVE":"EXPIRED"}</span>
                </div>
                <p className="text-[11px]" style={{color:T.muted}}>₹{c.amount} bonus · {c.used}/{c.limit} used</p>
              </div>
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.1)"}}>
                <div className="h-full rounded-full" style={{width:`${(c.used/c.limit)*100}%`,background:T.blue}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageWalletTxns({ jumpTab="" }: { jumpTab?:string }) {
  const [tab, setTab] = useState(jumpTab||"deposits");
  useEffect(() => { if (jumpTab) setTab(jumpTab); }, [jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-4}} transition={{duration:0.15}}>
          {tab==="deposits"    && <DepositsTab />}
          {tab==="withdrawals" && <WithdrawalsTab />}
          {tab==="logs"        && (
            <div className="p-4 flex flex-col items-center justify-center py-20">
              <div className="text-6xl mb-4 opacity-20">📜</div>
              <p className="text-base font-black text-white mb-1">Transaction Logs</p>
              <p className="text-sm text-center max-w-xs" style={{color:T.muted}}>
                Full audit trail of all Razorpay payments, UPI deposits, and admin wallet adjustments from Firestore.
              </p>
            </div>
          )}
          {tab==="bonus" && <BonusTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
