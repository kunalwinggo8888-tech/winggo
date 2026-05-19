/**
 * PageGameSettings — 3 tabs: Game Config · Cloud Uploader · Tournaments
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeGames, upsertGame, uploadGameZip,
  GameConfig, FIREBASE_ENABLED,
} from "@/firebase/admin.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted:"rgba(226,232,240,0.4)", card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.14)",
};

const TABS=[
  {id:"config",      label:"🎮 Game Config"    },
  {id:"uploader",    label:"⬆️ Cloud Uploader"  },
  {id:"tournaments", label:"🏆 Tournaments"     },
];

function TabBar({tab,setTab}:{tab:string;setTab:(t:string)=>void}) {
  return (
    <div className="flex gap-1 px-4 py-2 overflow-x-auto sticky top-0 z-10"
      style={{background:"rgba(7,11,18,0.95)",backdropFilter:"blur(10px)",
        borderBottom:"1px solid rgba(0,212,255,0.1)",scrollbarWidth:"none"}}>
      {TABS.map((t)=>{
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
    <button onClick={()=>onChange(!on)} className="cursor-pointer"
      style={{width:40,height:22,borderRadius:11,position:"relative",
        background:on?`${color}22`:"rgba(255,255,255,0.07)",
        border:`1.5px solid ${on?color:"rgba(255,255,255,0.12)"}`,transition:"all 0.2s"}}>
      <motion.div animate={{x:on?18:2}} transition={{type:"spring",stiffness:400,damping:28}}
        style={{width:14,height:14,borderRadius:7,position:"absolute",top:2,
          background:on?color:"rgba(255,255,255,0.3)"}} />
    </button>
  );
}

// ─── Game Card ────────────────────────────────────────────────────────────────

const GAME_EMOJIS:Record<string,string>={ludo:"🎲",worldwar:"⚔️",cricket:"🏏",snakes:"🐍",carrom:"🎯",chess:"♟️",default:"🎮"};
function gameEmoji(name:string):string {
  const k=name.toLowerCase().replace(/\s+/g,"");
  return GAME_EMOJIS[k]??GAME_EMOJIS.default;
}
function parseFees(s:string):number[]{return s.split(",").map(x=>parseFloat(x.trim())).filter(n=>!isNaN(n)&&n>0);}

function GameCard({game,onSave}:{game:GameConfig;onSave:(g:GameConfig)=>Promise<void>}) {
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [draft,   setDraft]   = useState(game);
  const [feesStr, setFeesStr] = useState(game.entryFees.join(", "));

  function startEdit(){setDraft(game);setFeesStr(game.entryFees.join(", "));setEditing(true);}

  async function save(){
    setSaving(true); await onSave({...draft,entryFees:parseFees(feesStr)});
    setSaving(false); setEditing(false);
  }

  return (
    <motion.div layout className="rounded-2xl overflow-hidden"
      style={{background:T.card,border:`1px solid ${T.bdr}`}}>
      <div className="px-4 pt-4 pb-3 flex items-start gap-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{background:"rgba(0,212,255,0.09)",border:"1px solid rgba(0,212,255,0.18)"}}>
          {gameEmoji(game.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-black text-white">{game.name}</p>
            <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
              style={{background:"rgba(0,212,255,0.1)",color:T.blue}}>{game.category}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <motion.div className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{background:game.isActive?T.green:T.red}}
              animate={game.isActive?{opacity:[1,0.3,1]}:{}} transition={{duration:1.6,repeat:Infinity}} />
            <span className="text-[10px] font-black" style={{color:game.isActive?T.green:T.red}}>
              {game.isActive?"LIVE":"OFFLINE"}
            </span>
          </div>
        </div>
        {!editing && (
          <motion.button whileTap={{scale:0.93}} onClick={startEdit}
            className="px-3 py-1.5 rounded-lg text-[11px] font-black cursor-pointer shrink-0"
            style={{background:"rgba(0,212,255,0.08)",color:T.blue,border:"1px solid rgba(0,212,255,0.2)"}}>
            ✏️ Edit
          </motion.button>
        )}
      </div>

      <div className="px-4 py-3">
        {!editing ? (
          <div className="space-y-2.5">
            <div>
              <p className="text-[9px] font-black tracking-widest mb-1" style={{color:"rgba(0,212,255,0.45)"}}>ENTRY FEES</p>
              <div className="flex flex-wrap gap-1.5">
                {game.entryFees.map(f=>(
                  <span key={f} className="px-2.5 py-1 rounded-lg text-xs font-black"
                    style={{background:"rgba(0,255,136,0.08)",color:T.green,border:"1px solid rgba(0,255,136,0.18)"}}>₹{f}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2" style={{background:"rgba(0,0,0,0.2)"}}>
                <p className="text-[9px] font-black" style={{color:T.muted}}>PRIZE MULTI</p>
                <p className="text-sm font-black text-white mt-0.5">{game.prizeMultiplier}×</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{background:"rgba(0,0,0,0.2)"}}>
                <p className="text-[9px] font-black" style={{color:T.muted}}>MAX PLAYERS</p>
                <p className="text-sm font-black text-white mt-0.5">{game.maxPlayers}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>ENTRY FEES ₹</label>
              <input value={feesStr} onChange={e=>setFeesStr(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.22)",caretColor:T.blue}} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                {label:"PRIZE MULTI",key:"prizeMultiplier" as const,step:"0.1"},
                {label:"MAX PLAYERS",key:"maxPlayers"      as const,step:"1"  },
              ]).map(({label,key,step})=>(
                <div key={key}>
                  <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>{label}</label>
                  <input type="number" step={step} value={draft[key] as number}
                    onChange={e=>setDraft(d=>({...d,[key]:parseFloat(e.target.value)||0}))}
                    className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                    style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.22)",caretColor:T.blue}} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">Game Live</span>
              <Toggle on={draft.isActive} onChange={v=>setDraft(d=>({...d,isActive:v}))} color={T.green} /></div>
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-white">Bot Enabled</span>
              <Toggle on={draft.isBotEnabled} onChange={v=>setDraft(d=>({...d,isBotEnabled:v}))} color={T.blue} /></div>
            <div className="flex gap-2 pt-1">
              <motion.button whileTap={{scale:0.95}} onClick={()=>setEditing(false)}
                className="flex-1 py-2 rounded-lg text-sm font-black cursor-pointer"
                style={{background:"rgba(255,255,255,0.04)",color:T.muted,border:"1px solid rgba(255,255,255,0.1)"}}>Cancel</motion.button>
              <motion.button whileTap={{scale:0.95}} onClick={save} disabled={saving}
                className="flex-1 py-2 rounded-lg text-sm font-black cursor-pointer"
                style={{background:"rgba(0,212,255,0.15)",color:T.blue,border:"1px solid rgba(0,212,255,0.3)"}}>
                {saving?"Saving…":"💾 Save"}
              </motion.button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Game Config Tab ──────────────────────────────────────────────────────────

function GameConfigTab() {
  const [games,   setGames]   = useState<GameConfig[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ return subscribeGames((list)=>{setGames(list);setLoading(false);}); },[]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-black text-white">Live Game Configuration</h2>
          <p className="text-[11px]" style={{color:T.muted}}>
            {games.filter(g=>g.isActive).length} active · {games.length} total · synced from Firestore
          </p>
        </div>
      </div>
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i=>(
            <motion.div key={i} className="rounded-2xl h-44"
              style={{background:T.card,border:`1px solid ${T.bdr}`}}
              animate={{opacity:[0.4,0.8,0.4]}} transition={{duration:1.4,repeat:Infinity,delay:i*0.15}} />
          ))}
        </div>
      ) : games.length===0 ? (
        <div className="rounded-2xl py-16 text-center" style={{border:"1px dashed rgba(0,212,255,0.15)"}}>
          <p className="text-4xl mb-3 opacity-30">🎮</p>
          <p className="text-sm font-bold" style={{color:T.muted}}>
            {FIREBASE_ENABLED?"No games in Firestore yet.":"Demo mode — Firebase not connected."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {games.map((g,i)=>(
            <motion.div key={g.id??i} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:i*0.05}}>
              <GameCard game={g} onSave={async(upd)=>{await upsertGame(upd);}} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Cloud Uploader Tab ───────────────────────────────────────────────────────

const GAME_TYPES=["HTML5","Unity WebGL","Native Android","React Native"];
interface UpForm{name:string;category:string;gameType:string;feesStr:string;prizeMultiplier:string;maxPlayers:string;bannerUrl:string;}
const EMPTY:UpForm={name:"",category:"Arcade",gameType:"HTML5",feesStr:"5,10,50",prizeMultiplier:"1.8",maxPlayers:"2",bannerUrl:""};

function CloudUploaderTab() {
  const [form,     setForm]     = useState<UpForm>(EMPTY);
  const [zipFile,  setZipFile]  = useState<File|null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading,setUploading]= useState(false);
  const [progress, setProgress] = useState(0);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function sf<K extends keyof UpForm>(k:K,v:string){setForm(f=>({...f,[k]:v}));}

  async function submit() {
    if (!form.name.trim()){setError("Game name required.");return;}
    setError(""); setUploading(true); setProgress(0);
    try {
      const gid=`game_${form.name.toLowerCase().replace(/\s+/g,"_")}_${Date.now()}`;
      let zipUrl="";
      if (zipFile) zipUrl=await uploadGameZip(zipFile,gid,setProgress);
      const g={id:gid,name:form.name.trim(),category:form.category,thumbnail:form.bannerUrl||"",
        entryFees:parseFees(form.feesStr),prizeMultiplier:parseFloat(form.prizeMultiplier)||1.8,
        maxPlayers:parseInt(form.maxPlayers)||2,isActive:true,isBotEnabled:false,
        botJoinDelaySec:15,gameType:form.gameType,zipUrl} as GameConfig&{gameType:string;zipUrl:string};
      await upsertGame(g);
      setSuccess(true); setForm(EMPTY); setZipFile(null);
      setTimeout(()=>setSuccess(false),2500);
    } catch(e){ setError(e instanceof Error?e.message:"Upload failed."); }
    finally { setUploading(false); }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4">
        <h2 className="text-base font-black text-white">Upload New Game</h2>
        <p className="text-[11px] mt-0.5" style={{color:T.muted}}>ZIP → Firebase Storage → Firestore games collection · goes live instantly</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-2xl p-4 md:p-5"
        style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        {/* Left column */}
        <div className="space-y-3">
          {([
            {label:"GAME NAME",k:"name"     as const,ph:"e.g. Ludo Turbo"},
            {label:"CATEGORY", k:"category" as const,ph:"Board, Arcade, Sports…"},
          ]).map(({label,k,ph})=>(
            <div key={k}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>{label}</label>
              <input value={form[k]} onChange={e=>sf(k,e.target.value)} placeholder={ph}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
                style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
            </div>
          ))}
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>GAME TYPE</label>
            <select value={form.gameType} onChange={e=>sf("gameType",e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(0,212,255,0.18)",color:"#e2e8f0"}}>
              {GAME_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>ENTRY FEES ₹</label>
            <input value={form.feesStr} onChange={e=>sf("feesStr",e.target.value)} placeholder="5, 10, 50, 100"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              {label:"PRIZE MULTI",k:"prizeMultiplier" as const,ph:"1.8"},
              {label:"MAX PLAYERS",k:"maxPlayers"      as const,ph:"2"  },
            ]).map(({label,k,ph})=>(
              <div key={k}>
                <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>{label}</label>
                <input type="number" value={form[k]} onChange={e=>sf(k,e.target.value)} placeholder={ph}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                  style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
              </div>
            ))}
          </div>
        </div>
        {/* Right column */}
        <div className="space-y-3">
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>BANNER IMAGE URL</label>
            <input value={form.bannerUrl} onChange={e=>sf("bannerUrl",e.target.value)} placeholder="https://…"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{background:"rgba(0,0,0,0.35)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
            {form.bannerUrl && (
              <img src={form.bannerUrl} alt="" className="mt-2 w-full h-20 object-cover rounded-lg"
                style={{border:"1px solid rgba(0,212,255,0.15)"}}
                onError={e=>{(e.target as HTMLImageElement).style.display="none";}} />
            )}
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>GAME ZIP FILE (.zip)</label>
            <div className="rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer"
              style={{height:110,border:`2px dashed ${dragging?T.blue:"rgba(0,212,255,0.22)"}`,
                background:dragging?"rgba(0,212,255,0.07)":"rgba(0,0,0,0.2)",transition:"all 0.2s"}}
              onDragOver={e=>{e.preventDefault();setDragging(true);}}
              onDragLeave={()=>setDragging(false)}
              onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f?.name.endsWith(".zip"))setZipFile(f);}}
              onClick={()=>fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept=".zip" className="hidden"
                onChange={e=>{const f=e.target.files?.[0];if(f)setZipFile(f);}} />
              {zipFile ? (
                <div className="text-center px-3">
                  <div className="text-xl mb-1">📦</div>
                  <p className="text-xs font-black" style={{color:T.blue}}>{zipFile.name}</p>
                  <p className="text-[10px]" style={{color:T.muted}}>{(zipFile.size/1024/1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="text-center px-3">
                  <div className="text-2xl mb-1 opacity-40">📂</div>
                  <p className="text-xs font-bold" style={{color:T.muted}}>Drop .zip or click to browse</p>
                </div>
              )}
            </div>
          </div>
          {uploading && (
            <div className="rounded-full overflow-hidden h-1.5" style={{background:"rgba(0,212,255,0.1)"}}>
              <motion.div animate={{width:`${progress}%`}} style={{height:"100%",background:`linear-gradient(90deg,${T.blue},#0066ff)`}} />
            </div>
          )}
          {error && <p className="text-xs font-bold px-3 py-2 rounded-lg"
            style={{background:"rgba(255,51,102,0.09)",color:T.red,border:"1px solid rgba(255,51,102,0.2)"}}>⚠️ {error}</p>}
          <AnimatePresence>
            {success && (
              <motion.div initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="text-xs font-black px-3 py-2.5 rounded-lg flex items-center gap-2"
                style={{background:"rgba(0,255,136,0.08)",color:T.green,border:"1px solid rgba(0,255,136,0.22)"}}>
                ✅ Game published to Firebase!
              </motion.div>
            )}
          </AnimatePresence>
          <motion.button whileTap={{scale:0.97}} onClick={submit} disabled={uploading}
            className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
            style={{background:uploading?"rgba(0,212,255,0.07)":"linear-gradient(135deg,rgba(0,212,255,0.18),rgba(0,85,255,0.22))",
              color:uploading?T.muted:T.blue,border:`1px solid ${uploading?"rgba(0,212,255,0.12)":"rgba(0,212,255,0.3)"}`}}>
            {uploading?`⏳ Uploading… ${progress}%`:"🚀 Publish Game to Firebase"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Tournaments Tab ──────────────────────────────────────────────────────────

const SAMPLE_TOURNAMENTS = [
  {id:"t1",name:"Sunday Ludo Grand",game:"Ludo",startTime:"Sun 8PM",entryFee:50,prizePool:5000,slots:100,filled:67,status:"upcoming"},
  {id:"t2",name:"World War Blitz",  game:"World War",startTime:"Sat 6PM",entryFee:25,prizePool:2000,slots:80, filled:80,status:"live"},
];

function TournamentsTab() {
  const [name,      setName]      = useState("");
  const [game,      setGame]      = useState("Ludo");
  const [fee,       setFee]       = useState("50");
  const [prize,     setPrize]     = useState("5000");
  const [slots,     setSlots]     = useState("100");
  const [startTime, setStartTime] = useState("");
  const [autoWin,   setAutoWin]   = useState(true);
  const [created,   setCreated]   = useState(false);

  async function handleCreate() {
    if (!name.trim() || !startTime) return;
    setCreated(true); setTimeout(()=>{setCreated(false);setName("");setStartTime("");},2500);
  }

  return (
    <div className="p-4 space-y-5">
      {/* Create tournament */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Create Tournament</p>
          <p className="text-[10px] mt-0.5" style={{color:T.muted}}>Configure and schedule a new tournament with prize pool</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>TOURNAMENT NAME</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sunday Grand Tournament"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>GAME</label>
            <select value={game} onChange={e=>setGame(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{background:"rgba(0,0,0,0.5)",border:"1px solid rgba(0,212,255,0.18)",color:"#e2e8f0"}}>
              {["Ludo","World War","Carrom","Snake & Ladder","Cricket Fantasy"].map(g=><option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>START TIME</label>
            <input type="datetime-local" value={startTime} onChange={e=>setStartTime(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none"
              style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",colorScheme:"dark"}} />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>ENTRY FEE ₹</label>
            <input type="number" value={fee} onChange={e=>setFee(e.target.value)} placeholder="50"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>PRIZE POOL ₹</label>
            <input type="number" value={prize} onChange={e=>setPrize(e.target.value)} placeholder="5000"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
          </div>
          <div>
            <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.5)"}}>TOTAL SLOTS</label>
            <input type="number" value={slots} onChange={e=>setSlots(e.target.value)} placeholder="100"
              className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
              style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
          </div>
          <div className="sm:col-span-2 flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-bold text-white">Auto Winner Distribution</p>
              <p className="text-[10px]" style={{color:T.muted}}>Automatically credit winners after tournament ends</p>
            </div>
            <Toggle on={autoWin} onChange={setAutoWin} color={T.green} />
          </div>
          <div className="sm:col-span-2">
            <motion.button whileTap={{scale:0.97}} onClick={handleCreate}
              className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
              style={{background:created?"rgba(0,255,136,0.1)":"linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,85,255,0.2))",
                color:created?T.green:T.blue,border:`1px solid ${created?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.28)"}`}}>
              {created?"🏆 Tournament Created!":"🚀 Create Tournament"}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Active tournaments */}
      <div>
        <p className="text-[9px] font-black tracking-widest mb-2" style={{color:"rgba(0,212,255,0.4)"}}>ACTIVE TOURNAMENTS</p>
        <div className="space-y-2">
          {SAMPLE_TOURNAMENTS.map((t)=>{
            const fillPct=(t.filled/t.slots)*100;
            const sc=t.status==="live"?T.green:T.blue;
            return (
              <div key={t.id} className="rounded-xl px-4 py-3"
                style={{background:T.card,border:`1px solid ${sc}22`}}>
                <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-white">{t.name}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{background:`${sc}15`,color:sc}}>{t.status.toUpperCase()}</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{color:T.muted}}>{t.game} · Entry ₹{t.entryFee} · {t.startTime}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black" style={{color:T.gold}}>₹{t.prizePool.toLocaleString()}</p>
                    <p className="text-[10px]" style={{color:T.muted}}>Prize Pool</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:"rgba(255,255,255,0.08)"}}>
                    <div className="h-full rounded-full" style={{width:`${fillPct}%`,background:sc,transition:"width 0.3s"}} />
                  </div>
                  <span className="text-[11px] font-black shrink-0" style={{color:T.muted}}>{t.filled}/{t.slots} joined</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageGameSettings({ jumpTab="" }:{jumpTab?:string}) {
  const [tab, setTab] = useState(jumpTab||"config");
  useEffect(()=>{ if (jumpTab) setTab(jumpTab); },[jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
          exit={{opacity:0,y:-4}} transition={{duration:0.15}}>
          {tab==="config"      && <GameConfigTab />}
          {tab==="uploader"    && <CloudUploaderTab />}
          {tab==="tournaments" && <TournamentsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
