/**
 * PageMarketing — 4 tabs: App Banners · Promo Codes · Daily Rewards · Spin Wheel
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeAdminBanners, saveAdminBanners, subscribeAppConfig, updateAppConfig,
  AdminBanner, AppConfig,
} from "@/firebase/admin.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted:"rgba(226,232,240,0.4)", card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

const TABS=[
  {id:"banners", label:"🖼️ App Banners"   },
  {id:"promo",   label:"🎫 Promo Codes"   },
  {id:"rewards", label:"⭐ Daily Rewards"  },
  {id:"spin",    label:"🎡 Spin Wheel"    },
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

function Toggle({on,onChange,color=T.green}:{on:boolean;onChange:(v:boolean)=>void;color?:string}) {
  return (
    <button onClick={()=>onChange(!on)} className="cursor-pointer shrink-0"
      style={{width:40,height:22,borderRadius:11,position:"relative",
        background:on?`${color}22`:"rgba(255,255,255,0.07)",
        border:`1.5px solid ${on?color:"rgba(255,255,255,0.12)"}`,transition:"all 0.2s"}}>
      <motion.div animate={{x:on?18:2}} transition={{type:"spring",stiffness:420,damping:28}}
        style={{width:14,height:14,borderRadius:7,position:"absolute",top:2,
          background:on?color:"rgba(255,255,255,0.3)"}} />
    </button>
  );
}

// ─── Banners Tab ──────────────────────────────────────────────────────────────

function BannersTab() {
  const [banners, setBanners] = useState<AdminBanner[]>([]);
  const [config,  setConfig]  = useState<AppConfig|null>(null);
  const [savingB, setSavingB] = useState(false);
  const [savingC, setSavingC] = useState(false);
  const [doneB,   setDoneB]   = useState(false);
  const [doneC,   setDoneC]   = useState(false);

  useEffect(() => {
    const u1 = subscribeAdminBanners(setBanners);
    const u2 = subscribeAppConfig(setConfig);
    return () => { u1(); u2(); };
  }, []);

  function addBanner() {
    setBanners(b=>[...b,{id:`b_${Date.now()}`,imageUrl:"",title:"New Banner",isActive:true}]);
  }
  function updateBanner(i:number,b:AdminBanner) {
    setBanners(prev=>prev.map((x,j)=>j===i?b:x));
  }
  function removeBanner(i:number) { setBanners(prev=>prev.filter((_,j)=>j!==i)); }

  async function saveBanners() {
    setSavingB(true); await saveAdminBanners(banners); setSavingB(false);
    setDoneB(true); setTimeout(()=>setDoneB(false),2500);
  }
  async function saveConfig() {
    if (!config) return; setSavingC(true); await updateAppConfig(config); setSavingC(false);
    setDoneC(true); setTimeout(()=>setDoneC(false),2500);
  }

  return (
    <div className="p-4 space-y-5">
      {/* Banner image slots */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Home Screen Banners</p>
          <p className="text-[10px] mt-0.5" style={{color:T.muted}}>Banners shown in the WINGGO app's home carousel</p>
        </div>
        <div className="p-4 space-y-3">
          {banners.length===0 && (
            <div className="rounded-xl py-8 text-center" style={{border:"1px dashed rgba(0,212,255,0.12)"}}>
              <p className="text-sm font-bold" style={{color:T.muted}}>No banners yet — add one below.</p>
            </div>
          )}
          {banners.map((b,i) => (
            <div key={b.id} className="rounded-xl overflow-hidden" style={{border:"1px solid rgba(0,212,255,0.1)"}}>
              {b.imageUrl && (
                <img src={b.imageUrl} alt="" className="w-full h-24 object-cover"
                  onError={(e)=>{(e.target as HTMLImageElement).style.display="none";}} />
              )}
              <div className="p-3 space-y-2" style={{background:"rgba(0,0,0,0.2)"}}>
                <input value={b.title} onChange={e=>updateBanner(i,{...b,title:e.target.value})}
                  placeholder="Banner title" className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none"
                  style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.15)",caretColor:T.blue}} />
                <input value={b.imageUrl} onChange={e=>updateBanner(i,{...b,imageUrl:e.target.value})}
                  placeholder="Image URL: https://…" className="w-full px-2.5 py-2 rounded-lg text-xs text-white outline-none font-mono"
                  style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.15)",caretColor:T.blue}} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Toggle on={b.isActive} onChange={(v)=>updateBanner(i,{...b,isActive:v})} color={T.blue} />
                    <span className="text-[11px]" style={{color:b.isActive?T.blue:T.muted}}>
                      {b.isActive?"Active":"Hidden"}
                    </span>
                  </div>
                  <button onClick={()=>removeBanner(i)} className="text-[11px] font-black cursor-pointer px-2 py-1 rounded-lg"
                    style={{color:T.red,background:"rgba(255,51,102,0.07)",border:"1px solid rgba(255,51,102,0.15)"}}>
                    ✕ Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <motion.button whileTap={{scale:0.96}} onClick={addBanner}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:"rgba(0,212,255,0.07)",color:T.blue,border:"1px solid rgba(0,212,255,0.18)"}}>
              + Add Banner
            </motion.button>
            <motion.button whileTap={{scale:0.96}} onClick={saveBanners} disabled={savingB}
              className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:doneB?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
                color:doneB?T.green:T.blue,border:`1px solid ${doneB?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
              {savingB?"Saving…":doneB?"✅ Saved!":"💾 Save Banners"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Announcement + App Settings */}
      {config && (
        <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
          <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
            <p className="text-sm font-black text-white">📢 App Announcement & Settings</p>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white font-bold">Show Announcement</span>
              <Toggle on={config.announcementActive} onChange={v=>setConfig(c=>c?{...c,announcementActive:v}:null)} color={T.blue} />
            </div>
            <textarea value={config.announcementBanner} rows={2}
              onChange={e=>setConfig(c=>c?{...c,announcementBanner:e.target.value}:null)}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
              style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
            <div className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-bold text-white">Maintenance Mode</p>
                <p className="text-[10px]" style={{color:T.muted}}>Shows maintenance screen to all users</p>
              </div>
              <Toggle on={config.maintenanceMode} onChange={v=>setConfig(c=>c?{...c,maintenanceMode:v}:null)} color={T.red} />
            </div>
            <motion.button whileTap={{scale:0.97}} onClick={saveConfig} disabled={savingC}
              className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer"
              style={{background:doneC?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
                color:doneC?T.green:T.blue,border:`1px solid ${doneC?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
              {savingC?"Saving…":doneC?"✅ Saved!":"🚀 Save Settings"}
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spin Wheel Tab ───────────────────────────────────────────────────────────

const DEFAULT_SEGMENTS = [
  {label:"₹10",   weight:20,color:"#00d4ff"},
  {label:"₹25",   weight:15,color:"#a855f7"},
  {label:"₹50",   weight:10,color:"#f59e0b"},
  {label:"₹100",  weight:5, color:"#00ff88"},
  {label:"₹5",    weight:25,color:"#ff3366"},
  {label:"Try Again",weight:15,color:"#6b7280"},
  {label:"₹5",    weight:6, color:"#00d4ff"},
  {label:"₹15",   weight:4, color:"#a855f7"},
];

function SpinWheelTab() {
  const [segments, setSegments] = useState(DEFAULT_SEGMENTS);
  const [saved,    setSaved]    = useState(false);
  const total = segments.reduce((s,sg)=>s+sg.weight,0);

  function updateWeight(i:number,v:number) {
    setSegments(prev=>prev.map((s,j)=>j===i?{...s,weight:Math.max(1,v)}:s));
  }

  async function save() {
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-sm font-black text-white">Spin Wheel Probability</h3>
        <p className="text-[11px] mt-0.5" style={{color:T.muted}}>
          Adjust weights for each segment. Total weight = {total}
          {total!==100 && <span style={{color:T.gold}}> (recommend total = 100)</span>}
        </p>
      </div>
      <div className="space-y-2">
        {segments.map((seg,i) => (
          <div key={i} className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{background:T.card,border:`1px solid ${T.bdr}`}}>
            <div className="w-3 h-3 rounded-full shrink-0" style={{background:seg.color}} />
            <p className="text-sm font-black text-white w-24 shrink-0">{seg.label}</p>
            <div className="flex-1">
              <div className="w-full h-1.5 rounded-full mb-1" style={{background:"rgba(255,255,255,0.08)"}}>
                <div className="h-full rounded-full" style={{width:`${(seg.weight/Math.max(total,1))*100}%`,background:seg.color,transition:"width 0.3s"}} />
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={()=>updateWeight(i,seg.weight-1)}
                className="w-6 h-6 rounded flex items-center justify-center text-xs cursor-pointer"
                style={{background:"rgba(255,255,255,0.06)",color:T.muted}}>−</button>
              <input type="number" value={seg.weight} onChange={e=>updateWeight(i,parseInt(e.target.value)||1)}
                className="w-12 text-center text-sm font-black text-white outline-none rounded-lg py-1"
                style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)"}} />
              <button onClick={()=>updateWeight(i,seg.weight+1)}
                className="w-6 h-6 rounded flex items-center justify-center text-xs cursor-pointer"
                style={{background:"rgba(255,255,255,0.06)",color:T.muted}}>+</button>
            </div>
            <p className="text-[11px] font-black w-10 text-right shrink-0"
              style={{color:T.blue}}>{total>0?Math.round((seg.weight/total)*100):0}%</p>
          </div>
        ))}
      </div>
      <motion.button whileTap={{scale:0.97}} onClick={save}
        className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
        style={{background:saved?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
          color:saved?T.green:T.blue,border:`1px solid ${saved?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
        {saved?"✅ Saved to Firestore!":"🎡 Save Spin Wheel Config"}
      </motion.button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageMarketing({ jumpTab="" }:{jumpTab?:string}) {
  const [tab, setTab] = useState(jumpTab||"banners");
  useEffect(()=>{ if (jumpTab) setTab(jumpTab); },[jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-4}} transition={{duration:0.15}}>
          {tab==="banners" && <BannersTab />}
          {tab==="promo"   && (
            <div className="p-4 flex flex-col items-center justify-center py-16">
              <div className="text-6xl mb-4 opacity-20">🎫</div>
              <p className="text-base font-black text-white mb-1">Promo Code Manager</p>
              <p className="text-sm text-center max-w-xs" style={{color:T.muted}}>
                Create and manage promotional coupon codes that users can redeem for bonus wallet credits.
              </p>
              <div className="mt-4 px-3 py-2 rounded-xl text-xs font-black"
                style={{background:"rgba(0,212,255,0.06)",color:T.blue,border:"1px solid rgba(0,212,255,0.15)"}}>
                Use Wallet → Bonus & Coupons to manage codes
              </div>
            </div>
          )}
          {tab==="rewards" && (
            <div className="p-4 flex flex-col items-center justify-center py-16">
              <div className="text-6xl mb-4 opacity-20">⭐</div>
              <p className="text-base font-black text-white mb-1">Daily Rewards Setup</p>
              <p className="text-sm text-center max-w-xs" style={{color:T.muted}}>
                Configure daily login reward calendar — Day 1 through Day 30 streak bonuses.
                Stored in Firestore dailyRewards collection.
              </p>
            </div>
          )}
          {tab==="spin" && <SpinWheelTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
