/**
 * PageReferral — 3 tabs: Commission Rules · Level Income · Invite Rewards
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeAppConfig, updateAppConfig, AppConfig } from "@/firebase/admin.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted:"rgba(226,232,240,0.4)", card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

const TABS=[
  {id:"commission",label:"% Commission Rules"},
  {id:"level",     label:"🌳 Level Income"   },
  {id:"invite",    label:"🎁 Invite Rewards"  },
];

function TabBar({tab,setTab}:{tab:string;setTab:(t:string)=>void}) {
  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto sticky top-0 z-10"
      style={{background:"rgba(7,11,18,0.95)",backdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(0,212,255,0.1)",scrollbarWidth:"none"}}>
      {TABS.map((t) => {
        const isA=tab===t.id;
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

// ─── Commission Rules ─────────────────────────────────────────────────────────

function CommissionTab() {
  const [config, setConfig] = useState<AppConfig|null>(null);
  const [saving, setSaving] = useState(false);
  const [done,   setDone]   = useState(false);

  useEffect(()=>{ return subscribeAppConfig(setConfig); },[]);

  async function save() {
    if (!config) return; setSaving(true);
    await updateAppConfig({
      referralBonusAmount: config.referralBonusAmount,
      depositBonusPct:     config.depositBonusPct,
    });
    setSaving(false); setDone(true); setTimeout(()=>setDone(false),2500);
  }

  if (!config) return (
    <div className="p-4 flex items-center justify-center py-16">
      <motion.div className="w-7 h-7 rounded-full border-2"
        style={{borderColor:`${T.blue} transparent transparent transparent`}}
        animate={{rotate:360}} transition={{duration:0.9,repeat:Infinity,ease:"linear"}} />
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Referral Commission Settings</p>
          <p className="text-[10px] mt-0.5" style={{color:T.muted}}>Applied when a referred user makes their first deposit</p>
        </div>
        <div className="p-4 space-y-4">
          {([
            {key:"referralBonusAmount" as const, label:"REFERRAL BONUS ₹", sub:"Bonus credited to referrer on invite join", suffix:"₹", type:"number"},
            {key:"depositBonusPct"     as const, label:"DEPOSIT BONUS %",  sub:"Extra bonus on each deposit (applied to referred users)", suffix:"%", type:"number"},
          ]).map(({key,label,sub,suffix,type})=>(
            <div key={key} className="rounded-xl p-4" style={{background:"rgba(0,0,0,0.2)",border:"1px solid rgba(0,212,255,0.08)"}}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-black text-white">{label}</p>
                  <p className="text-[10px] mt-0.5" style={{color:T.muted}}>{sub}</p>
                </div>
                <span className="text-2xl font-black" style={{color:T.blue}}>
                  {suffix}{config[key]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input type={type} value={config[key] as number}
                  onChange={e=>setConfig(c=>c?{...c,[key]:parseFloat(e.target.value)||0}:null)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm text-white outline-none font-mono"
                  style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.2)",caretColor:T.blue}} />
                <span className="text-sm font-black" style={{color:T.muted}}>{suffix}</span>
              </div>
            </div>
          ))}
          <motion.button whileTap={{scale:0.97}} onClick={save} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
            style={{background:done?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
              color:done?T.green:T.blue,border:`1px solid ${done?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
            {saving?"Saving…":done?"✅ Saved to Firebase!":"🚀 Save Commission Rules"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Level Income ─────────────────────────────────────────────────────────────

const DEFAULT_LEVELS = [
  {level:1, commission:10, minReferrals:0,  color:"#00d4ff"},
  {level:2, commission:5,  minReferrals:5,  color:"#a855f7"},
  {level:3, commission:3,  minReferrals:15, color:"#f59e0b"},
  {level:4, commission:2,  minReferrals:30, color:"#00ff88"},
  {level:5, commission:1,  minReferrals:75, color:"#ff3366"},
];

function LevelIncomeTab() {
  const [levels,  setLevels]  = useState(DEFAULT_LEVELS);
  const [saved,   setSaved]   = useState(false);

  async function save() { setSaved(true); setTimeout(()=>setSaved(false),2000); }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-black text-white">Multi-Level Referral Income</h3>
        <p className="text-[11px] mt-0.5" style={{color:T.muted}}>Commission earned from referred users' deposits, by level depth</p>
      </div>
      <div className="space-y-2">
        {levels.map((lv,i)=>(
          <div key={lv.level} className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{background:T.card,border:`1px solid ${T.bdr}`}}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0"
              style={{background:`${lv.color}15`,color:lv.color,border:`1px solid ${lv.color}30`}}>
              L{lv.level}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-white">Level {lv.level}</p>
              <p className="text-[10px]" style={{color:T.muted}}>Min {lv.minReferrals} referrals to unlock</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" value={lv.commission}
                onChange={e=>setLevels(prev=>prev.map((x,j)=>j===i?{...x,commission:parseInt(e.target.value)||0}:x))}
                className="w-14 text-center py-1.5 rounded-lg text-sm font-black text-white outline-none font-mono"
                style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)"}} />
              <span className="text-xs font-black" style={{color:lv.color}}>%</span>
            </div>
          </div>
        ))}
      </div>
      <motion.button whileTap={{scale:0.97}} onClick={save}
        className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
        style={{background:saved?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
          color:saved?T.green:T.blue,border:`1px solid ${saved?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
        {saved?"✅ Saved!":"💾 Save Level Income Rules"}
      </motion.button>
    </div>
  );
}

// ─── Invite Rewards ───────────────────────────────────────────────────────────

function InviteRewardsTab() {
  const [config, setConfig]    = useState<AppConfig|null>(null);
  const [milestones, setMs]    = useState([
    {invites:1,  reward:50,  label:"First invite"},
    {invites:5,  reward:200, label:"5 invites"},
    {invites:10, reward:500, label:"10 invites"},
    {invites:25, reward:1500,label:"25 invites"},
    {invites:50, reward:3000,label:"50 invites"},
  ]);
  const [saved, setSaved] = useState(false);

  useEffect(()=>{ return subscribeAppConfig(setConfig); },[]);
  async function save() { setSaved(true); setTimeout(()=>setSaved(false),2000); }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Invite Milestone Rewards</p>
          <p className="text-[10px] mt-0.5" style={{color:T.muted}}>Bonus credited when user hits invite milestones</p>
        </div>
        <div className="p-4 space-y-2">
          {milestones.map((m,i)=>(
            <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
              style={{background:"rgba(0,0,0,0.2)",border:"1px solid rgba(0,212,255,0.08)"}}>
              <div className="flex-1">
                <p className="text-xs font-black text-white">{m.label}</p>
                <p className="text-[10px]" style={{color:T.muted}}>{m.invites} successful referrals</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-black" style={{color:T.gold}}>₹</span>
                <input type="number" value={m.reward}
                  onChange={e=>setMs(prev=>prev.map((x,j)=>j===i?{...x,reward:parseInt(e.target.value)||0}:x))}
                  className="w-16 text-center py-1.5 rounded-lg text-sm font-black text-white outline-none font-mono"
                  style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(245,158,11,0.25)"}} />
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 pb-4">
          <motion.button whileTap={{scale:0.97}} onClick={save}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
            style={{background:saved?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
              color:saved?T.green:T.blue,border:`1px solid ${saved?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
            {saved?"✅ Saved!":"💾 Save Invite Rewards"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageReferral({ jumpTab="" }:{jumpTab?:string}) {
  const [tab, setTab] = useState(jumpTab||"commission");
  useEffect(()=>{ if (jumpTab) setTab(jumpTab); },[jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-4}} transition={{duration:0.15}}>
          {tab==="commission" && <CommissionTab />}
          {tab==="level"      && <LevelIncomeTab />}
          {tab==="invite"     && <InviteRewardsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
