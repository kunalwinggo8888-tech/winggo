/**
 * PageNotifications — 3 tabs: Push Notifications · Announcements · Social Links
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeAppConfig, updateAppConfig, AppConfig } from "@/firebase/admin.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted:"rgba(226,232,240,0.4)", card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

const TABS=[
  {id:"push",     label:"🔔 Push Notifications"},
  {id:"announce", label:"📋 Announcements"     },
  {id:"social",   label:"💬 Social Links"       },
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

// ─── Push Notifications ───────────────────────────────────────────────────────

function PushTab() {
  const [title,    setTitle]    = useState("");
  const [body,     setBody]     = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [target,   setTarget]   = useState<"all"|"active"|"inactive">("all");
  const [sending,  setSending]  = useState(false);
  const [sent,     setSent]     = useState(false);

  const TARGETS = [
    {id:"all"     as const, label:"All Users",      count:"12,847"},
    {id:"active"  as const, label:"Active (30d)",   count:"8,412" },
    {id:"inactive"as const, label:"Inactive (30d)", count:"4,435" },
  ];

  async function handleSend() {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    await new Promise(r=>setTimeout(r,1500));
    setSending(false); setSent(true);
    setTimeout(()=>{ setSent(false); setTitle(""); setBody(""); setImageUrl(""); },3000);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Target audience */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Target Audience</p>
        </div>
        <div className="p-4 grid grid-cols-3 gap-2">
          {TARGETS.map((t)=>(
            <button key={t.id} onClick={()=>setTarget(t.id)}
              className="rounded-xl px-3 py-3 text-center cursor-pointer"
              style={{background:target===t.id?"rgba(0,212,255,0.1)":"rgba(255,255,255,0.03)",
                border:`1px solid ${target===t.id?"rgba(0,212,255,0.28)":"rgba(255,255,255,0.07)"}`}}>
              <p className="text-sm font-black" style={{color:target===t.id?T.blue:"rgba(226,232,240,0.7)"}}>{t.count}</p>
              <p className="text-[10px] mt-0.5" style={{color:T.muted}}>{t.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Compose */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Compose Notification</p>
        </div>
        <div className="p-4 space-y-3">
          {([
            {label:"TITLE",     val:title,    set:setTitle,    placeholder:"e.g. 🏆 Grand Tournament Tomorrow!"},
            {label:"BODY",      val:body,     set:setBody,     placeholder:"Enter notification message…"},
            {label:"IMAGE URL", val:imageUrl, set:setImageUrl, placeholder:"https://…/banner.jpg (optional)"},
          ] as const).map(({label,val,set,placeholder})=>(
            <div key={label as string}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.45)"}}>
                {label as string}
              </label>
              {label==="BODY" ? (
                <textarea value={val as string} onChange={e=>(set as (v:string)=>void)(e.target.value)} rows={3}
                  placeholder={placeholder as string} className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
                  style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
              ) : (
                <input value={val as string} onChange={e=>(set as (v:string)=>void)(e.target.value)} placeholder={placeholder as string}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                  style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
              )}
            </div>
          ))}

          {/* Preview */}
          {(title || body) && (
            <div className="rounded-xl px-4 py-3" style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(0,212,255,0.12)"}}>
              <p className="text-[9px] font-black tracking-widest mb-2" style={{color:"rgba(0,212,255,0.4)"}}>PREVIEW</p>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{background:"rgba(0,212,255,0.1)"}}>⚡</div>
                <div>
                  <p className="text-sm font-black text-white">{title||"Notification title"}</p>
                  <p className="text-xs mt-0.5" style={{color:T.muted}}>{body||"Notification body…"}</p>
                </div>
              </div>
            </div>
          )}

          <motion.button whileTap={{scale:0.97}} onClick={handleSend} disabled={sending||!title||!body}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
            style={{
              background:sent?"rgba(0,255,136,0.1)":sending?"rgba(0,212,255,0.06)":"linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,85,255,0.2))",
              color:sent?T.green:!title||!body?"rgba(226,232,240,0.3)":T.blue,
              border:`1px solid ${sent?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`,
              opacity:(!title||!body)&&!sending?0.5:1,
            }}>
            {sent?"✅ Notification Sent!":sending?"📡 Sending…":"🔔 Send Push Notification"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Announcements Tab ────────────────────────────────────────────────────────

function AnnouncementsTab() {
  const [config,  setConfig]  = useState<AppConfig|null>(null);
  const [saving,  setSaving]  = useState(false);
  const [done,    setDone]    = useState(false);

  useEffect(()=>{ return subscribeAppConfig(setConfig); },[]);

  async function save() {
    if (!config) return; setSaving(true);
    await updateAppConfig({announcementBanner:config.announcementBanner,announcementActive:config.announcementActive});
    setSaving(false); setDone(true); setTimeout(()=>setDone(false),2500);
  }

  function Toggle2({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}) {
    return (
      <button onClick={()=>onChange(!on)} className="cursor-pointer shrink-0"
        style={{width:40,height:22,borderRadius:11,position:"relative",
          background:on?"rgba(0,212,255,0.22)":"rgba(255,255,255,0.07)",
          border:`1.5px solid ${on?T.blue:"rgba(255,255,255,0.12)"}`,transition:"all 0.2s"}}>
        <motion.div animate={{x:on?18:2}} transition={{type:"spring",stiffness:420,damping:28}}
          style={{width:14,height:14,borderRadius:7,position:"absolute",top:2,
            background:on?T.blue:"rgba(255,255,255,0.3)"}} />
      </button>
    );
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
          <p className="text-sm font-black text-white">Scrolling Announcement Bar</p>
          <p className="text-[10px] mt-0.5" style={{color:T.muted}}>Shown at the top of the WINGGO app</p>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Show Announcement</span>
            <Toggle2 on={config.announcementActive} onChange={v=>setConfig(c=>c?{...c,announcementActive:v}:null)} />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.45)"}}>ANNOUNCEMENT TEXT</label>
            <textarea value={config.announcementBanner} rows={3}
              onChange={e=>setConfig(c=>c?{...c,announcementBanner:e.target.value}:null)}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none resize-none"
              style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
          </div>
          <motion.button whileTap={{scale:0.97}} onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer"
            style={{background:done?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
              color:done?T.green:T.blue,border:`1px solid ${done?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
            {saving?"Saving…":done?"✅ Saved!":"💾 Update Announcement"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Social Links Tab ─────────────────────────────────────────────────────────

const SOCIAL_DEFAULTS = [
  {key:"telegram",    label:"Telegram Group",    icon:"✈️", placeholder:"https://t.me/winggo_official"},
  {key:"whatsapp",    label:"WhatsApp Group",    icon:"💬", placeholder:"https://chat.whatsapp.com/..."},
  {key:"instagram",   label:"Instagram Page",    icon:"📸", placeholder:"https://instagram.com/winggo"},
  {key:"youtube",     label:"YouTube Channel",   icon:"▶️", placeholder:"https://youtube.com/@winggo"},
  {key:"support_chat",label:"Support Chat Link", icon:"🎧", placeholder:"https://t.me/winggo_support"},
];

function SocialLinksTab() {
  const [links, setLinks] = useState<Record<string,string>>(
    Object.fromEntries(SOCIAL_DEFAULTS.map(s=>[s.key,""]))
  );
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaved(true); setTimeout(()=>setSaved(false),2000);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Community & Support Links</p>
          <p className="text-[10px] mt-0.5" style={{color:T.muted}}>These links appear in the WINGGO app's Support section</p>
        </div>
        <div className="p-4 space-y-3">
          {SOCIAL_DEFAULTS.map((s)=>(
            <div key={s.key}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.45)"}}>
                {s.icon} {s.label.toUpperCase()}
              </label>
              <input value={links[s.key]} onChange={e=>setLinks(l=>({...l,[s.key]:e.target.value}))}
                placeholder={s.placeholder} className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
            </div>
          ))}
          <motion.button whileTap={{scale:0.97}} onClick={save}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer mt-2"
            style={{background:saved?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
              color:saved?T.green:T.blue,border:`1px solid ${saved?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
            {saved?"✅ Links Saved!":"💾 Save Social Links"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageNotifications({ jumpTab="" }:{jumpTab?:string}) {
  const [tab, setTab] = useState(jumpTab||"push");
  useEffect(()=>{ if (jumpTab) setTab(jumpTab); },[jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-4}} transition={{duration:0.15}}>
          {tab==="push"     && <PushTab />}
          {tab==="announce" && <AnnouncementsTab />}
          {tab==="social"   && <SocialLinksTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
