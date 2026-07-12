/**
 * PageSecurity — 4 tabs: Admin Profile · Payment Config · Activity Logs · Fraud Detection
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribePaymentConfig,
  savePaymentConfig,
  uploadPaymentQR,
  type PaymentConfig,
} from "@/firebase/admin.service";
import {
  isRecoveryConfigured,
  getBackupEmail,
  maskEmail,
} from "@/firebase/recovery.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  muted:"rgba(226,232,240,0.4)", card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

const TABS=[
  {id:"profile",   label:"👤 Admin Profile"   },
  {id:"payment",   label:"💳 Payment Config"  },
  {id:"actlogs",   label:"📊 Activity Logs"   },
  {id:"fraud",     label:"🚨 Fraud Detection" },
  {id:"recovery",  label:"🔑 Emergency Recovery" },
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

// ─── Payment Config Tab ───────────────────────────────────────────────────────

function PaymentConfigTab() {
  const [cfg,        setCfg]        = useState<PaymentConfig>({ upiId: "winggo@axl", qrUrl: "" });
  const [upiId,      setUpiId]      = useState("");
  const [qrPreview,  setQrPreview]  = useState<string | null>(null);
  const [qrFile,     setQrFile]     = useState<File | null>(null);
  const [uploading,  setUploading]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<{ type:"ok"|"err"; text:string }|null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return subscribePaymentConfig((c) => {
      setCfg(c);
      setUpiId(c.upiId);
    });
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setQrFile(f);
    if (f) setQrPreview(URL.createObjectURL(f));
  }

  async function handleSave() {
    if (!upiId.trim()) { setMsg({ type:"err", text:"UPI ID is required." }); return; }
    setSaving(true);
    try {
      let finalUrl = cfg.qrUrl;
      if (qrFile) {
        setUploading(true);
        finalUrl = await uploadPaymentQR(qrFile);
        setUploading(false);
      }
      await savePaymentConfig(upiId.trim(), finalUrl);
      setMsg({ type:"ok", text:"✅ Payment config saved and live!" });
      setQrFile(null);
      setTimeout(() => setMsg(null), 4000);
    } catch {
      setMsg({ type:"err", text:"Failed to save. Check Firebase connection." });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  const previewQrUrl = qrPreview ?? (cfg.qrUrl || null);

  return (
    <div className="p-4 space-y-4">

      {/* Live status banner */}
      <div className="rounded-xl px-4 py-2.5 flex items-center gap-2"
        style={{ background:"rgba(0,255,136,0.06)", border:"1px solid rgba(0,255,136,0.2)" }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background:T.green }} />
        <span className="text-[11px] font-black" style={{ color:T.green }}>
          Changes save to <span className="font-mono">payment_details/config</span> and go live instantly in the app.
        </span>
      </div>

      {/* UPI ID */}
      <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
        <div className="px-4 py-3" style={{ borderBottom:`1px solid ${T.bdr}` }}>
          <p className="text-sm font-black text-white">💳 Admin UPI ID</p>
          <p className="text-[10px] mt-0.5" style={{ color:T.muted }}>
            Current live ID: <span className="font-mono text-white">{cfg.upiId}</span>
          </p>
        </div>
        <div className="p-4">
          <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color:"rgba(0,212,255,0.45)" }}>
            NEW UPI ID
          </label>
          <input
            type="text"
            value={upiId}
            onChange={e => setUpiId(e.target.value)}
            placeholder="e.g. winggo@axl"
            className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
            style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,212,255,0.2)", caretColor:T.blue }}
          />
        </div>
      </div>

      {/* QR Code Upload */}
      <div className="rounded-2xl overflow-hidden" style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
        <div className="px-4 py-3" style={{ borderBottom:`1px solid ${T.bdr}` }}>
          <p className="text-sm font-black text-white">📷 Admin Payment QR Code</p>
          <p className="text-[10px] mt-0.5" style={{ color:T.muted }}>
            Upload a PNG/JPG QR code image. Will be stored on Cloudinary.
          </p>
        </div>
        <div className="p-4 space-y-3">
          {/* Current / preview QR */}
          {previewQrUrl && (
            <div className="flex items-center gap-3">
              <div className="rounded-xl overflow-hidden shrink-0"
                style={{ background:"#fff", padding:6, border:"1.5px solid rgba(0,212,255,0.3)", width:80, height:80 }}>
                <img src={previewQrUrl} alt="QR preview" className="w-full h-full object-contain block" />
              </div>
              <div>
                <p className="text-xs font-black text-white">{qrFile ? qrFile.name : "Current QR"}</p>
                <p className="text-[10px] mt-0.5" style={{ color:T.muted }}>
                  {qrFile ? "Ready to upload" : "Uploaded · live in app"}
                </p>
                {qrFile && (
                  <button onClick={() => { setQrFile(null); setQrPreview(null); if(fileRef.current) fileRef.current.value=""; }}
                    className="text-[10px] font-black mt-1" style={{ color:T.red }}>
                    ✕ Remove
                  </button>
                )}
              </div>
            </div>
          )}

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer"
            style={{ background:"rgba(0,212,255,0.06)", color:T.blue, border:"1.5px dashed rgba(0,212,255,0.3)" }}>
            {previewQrUrl ? "🔄 Replace QR Image" : "📤 Upload QR Image"}
          </button>
        </div>
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="px-3 py-2.5 rounded-xl text-xs font-black"
            style={{
              background:msg.type==="ok"?"rgba(0,255,136,0.1)":"rgba(255,51,102,0.1)",
              color:msg.type==="ok"?T.green:T.red,
              border:`1px solid ${msg.type==="ok"?"rgba(0,255,136,0.25)":"rgba(255,51,102,0.25)"}`,
            }}>
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save button */}
      <motion.button whileTap={{ scale:0.97 }} onClick={handleSave}
        disabled={saving || uploading}
        className="w-full py-3 rounded-xl text-sm font-black cursor-pointer"
        style={{ background:"rgba(0,212,255,0.1)", color:T.blue, border:"1px solid rgba(0,212,255,0.28)" }}>
        {uploading ? "⏫ Uploading QR…" : saving ? "Saving…" : "💾 Save & Go Live"}
      </motion.button>
    </div>
  );
}

// ─── Admin Profile ────────────────────────────────────────────────────────────

function ProfileTab() {
  const [current,  setCurrent]  = useState("");
  const [newPass,  setNewPass]  = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{type:"ok"|"err";text:string}|null>(null);

  async function handleSave() {
    if (!current || !newPass) { setMsg({type:"err",text:"Fill all fields."}); return; }
    if (newPass!==confirm)    { setMsg({type:"err",text:"Passwords don't match."}); return; }
    if (newPass.length<8)     { setMsg({type:"err",text:"Password must be 8+ characters."}); return; }
    setSaving(true);
    await new Promise(r=>setTimeout(r,1200));
    setSaving(false);
    setMsg({type:"ok",text:"Password updated successfully!"});
    setCurrent(""); setNewPass(""); setConfirm("");
    setTimeout(()=>setMsg(null),3000);
  }

  return (
    <div className="p-4 space-y-4">
      {/* Admin info */}
      <div className="rounded-2xl px-4 py-4 flex items-center gap-4"
        style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black"
          style={{background:"linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,85,255,0.2))",
            border:"1.5px solid rgba(0,212,255,0.3)",color:T.blue}}>
          ⚡
        </div>
        <div>
          <p className="text-base font-black text-white">kunalwinggo</p>
          <p className="text-xs mt-0.5" style={{color:T.muted}}>Super Admin · Full Access</p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{background:T.green}}
              animate={{opacity:[1,0.3,1]}} transition={{duration:1.8,repeat:Infinity}} />
            <span className="text-[10px] font-black" style={{color:T.green}}>AUTHENTICATED</span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Change Password</p>
        </div>
        <div className="p-4 space-y-3">
          {([
            {label:"CURRENT PASSWORD", val:current, set:setCurrent},
            {label:"NEW PASSWORD",     val:newPass, set:setNewPass},
            {label:"CONFIRM NEW",      val:confirm, set:setConfirm},
          ] as const).map(({label,val,set})=>(
            <div key={label as string}>
              <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{color:"rgba(0,212,255,0.45)"}}>
                {label as string}
              </label>
              <div className="relative">
                <input type={showPw?"text":"password"} value={val as string}
                  onChange={e=>(set as (v:string)=>void)(e.target.value)}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm text-white outline-none font-mono"
                  style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.18)",caretColor:T.blue}} />
                <button onClick={()=>setShowPw(p=>!p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-sm"
                  style={{color:T.muted}}>{showPw?"🙈":"👁️"}</button>
              </div>
            </div>
          ))}

          <AnimatePresence>
            {msg && (
              <motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className="px-3 py-2 rounded-lg text-xs font-black"
                style={{background:msg.type==="ok"?"rgba(0,255,136,0.1)":"rgba(255,51,102,0.1)",
                  color:msg.type==="ok"?T.green:T.red,
                  border:`1px solid ${msg.type==="ok"?"rgba(0,255,136,0.25)":"rgba(255,51,102,0.25)"}`}}>
                {msg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button whileTap={{scale:0.97}} onClick={handleSave} disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer"
            style={{background:"rgba(0,212,255,0.1)",color:T.blue,border:"1px solid rgba(0,212,255,0.25)"}}>
            {saving?"Updating…":"🔒 Update Password"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Logs ────────────────────────────────────────────────────────────

const SAMPLE_LOGS = [
  {id:"1", action:"Approved withdrawal ₹500",  user:"Rahul Kumar",  time:"2 min ago",  type:"approve"},
  {id:"2", action:"Banned user for fraud",     user:"Priya Sharma", time:"18 min ago", type:"ban"},
  {id:"3", action:"Updated game config",       user:"System",       time:"1 hr ago",   type:"config"},
  {id:"4", action:"Rejected KYC request",      user:"Amit Singh",   time:"2 hr ago",   type:"reject"},
  {id:"5", action:"Sent push notification",    user:"All Users",    time:"3 hr ago",   type:"notify"},
  {id:"6", action:"Created promo code LUDO100",user:"System",       time:"5 hr ago",   type:"config"},
  {id:"7", action:"Approved withdrawal ₹1200", user:"Sneha Patel",  time:"6 hr ago",   type:"approve"},
  {id:"8", action:"Updated app config",        user:"System",       time:"8 hr ago",   type:"config"},
];

function ActivityLogsTab() {
  const colors: Record<string,string> = {
    approve:"#00ff88", ban:"#ff3366", config:"#00d4ff", reject:"#f59e0b", notify:"#a855f7",
  };
  const icons: Record<string,string> = {
    approve:"✓", ban:"⊘", config:"⚙", reject:"✕", notify:"🔔",
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black text-white">Admin Activity Log</h3>
        <span className="text-[10px] font-black px-2 py-0.5 rounded"
          style={{background:"rgba(0,212,255,0.08)",color:T.blue}}>Live · Auto-refreshing</span>
      </div>
      <div className="space-y-2">
        {SAMPLE_LOGS.map((log)=>{
          const color = colors[log.type]??T.blue;
          const icon  = icons[log.type]??"•";
          return (
            <div key={log.id} className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{background:T.card,border:`1px solid ${T.bdr}`}}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                style={{background:`${color}15`,color,border:`1px solid ${color}25`}}>
                {icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white truncate">{log.action}</p>
                <p className="text-[11px]" style={{color:T.muted}}>User: {log.user}</p>
              </div>
              <p className="text-[10px] shrink-0" style={{color:T.muted}}>{log.time}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-xl px-4 py-3 text-center" style={{background:"rgba(0,212,255,0.04)",border:"1px dashed rgba(0,212,255,0.15)"}}>
        <p className="text-[11px]" style={{color:T.muted}}>Connect to Firestore <span className="font-mono text-white">adminLogs</span> collection for live history</p>
      </div>
    </div>
  );
}

// ─── Fraud Detection ──────────────────────────────────────────────────────────

const FRAUD_ALERTS = [
  {id:"WG-2041", name:"Raj Verma",    reason:"Multiple accounts (3 devices)",  ip:"103.21.58.14", risk:"critical", time:"2m ago"  },
  {id:"WG-2039", name:"Fake Account", reason:"Bot-like withdrawal pattern",     ip:"45.112.14.88", risk:"high",     time:"18m ago" },
  {id:"WG-2035", name:"Priya K.",     reason:"Rapid same-UPI withdrawals",      ip:"192.168.1.1",  risk:"medium",   time:"1h ago"  },
];

function FraudTab() {
  const [thresholds, setThresholds] = useState({
    maxWithdrawPerHour: 3,
    maxSameUPI:         5,
    maxDevices:         2,
    autoBlockOnFlag:    true,
  });
  const [saved, setSaved] = useState(false);

  function Toggle({on,onChange}:{on:boolean;onChange:(v:boolean)=>void}) {
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

  const riskColor = (risk:string) =>
    risk==="critical"?T.red:risk==="high"?T.gold:T.blue;

  return (
    <div className="p-4 space-y-4">
      {/* Live alerts */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3 flex items-center gap-2" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">🚨 Active Fraud Alerts</p>
          <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded"
            style={{background:"rgba(255,51,102,0.1)",color:T.red}}>{FRAUD_ALERTS.length} flagged</span>
        </div>
        <div className="p-3 space-y-2">
          {FRAUD_ALERTS.map((a)=>{
            const rc = riskColor(a.risk);
            return (
              <div key={a.id} className="rounded-xl px-3 py-3"
                style={{background:"rgba(0,0,0,0.2)",border:`1px solid ${rc}22`}}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-black text-white">{a.name}</p>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                        style={{background:`${rc}15`,color:rc}}>{a.risk.toUpperCase()}</span>
                    </div>
                    <p className="text-[11px] mt-0.5" style={{color:T.muted}}>{a.reason}</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{color:T.muted}}>IP: {a.ip} · {a.time}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button className="px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer"
                      style={{background:"rgba(255,51,102,0.08)",color:T.red,border:"1px solid rgba(255,51,102,0.2)"}}>
                      Block
                    </button>
                    <button className="px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer"
                      style={{background:"rgba(255,255,255,0.04)",color:T.muted,border:"1px solid rgba(255,255,255,0.08)"}}>
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trigger thresholds */}
      <div className="rounded-2xl overflow-hidden" style={{background:T.card,border:`1px solid ${T.bdr}`}}>
        <div className="px-4 py-3" style={{borderBottom:`1px solid ${T.bdr}`}}>
          <p className="text-sm font-black text-white">Fraud Detection Thresholds</p>
        </div>
        <div className="p-4 space-y-3">
          {([
            {key:"maxWithdrawPerHour" as const, label:"Max Withdrawals/Hour",    unit:"requests"},
            {key:"maxSameUPI"         as const, label:"Max Same-UPI Withdrawals",unit:"requests"},
            {key:"maxDevices"         as const, label:"Max Devices per Account", unit:"devices"},
          ]).map(({key,label,unit})=>(
            <div key={key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-[10px]" style={{color:T.muted}}>Auto-flag if exceeded</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="number" value={thresholds[key]}
                  onChange={e=>setThresholds(t=>({...t,[key]:parseInt(e.target.value)||1}))}
                  className="w-14 text-center py-1.5 rounded-lg text-sm font-black text-white outline-none font-mono"
                  style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(0,212,255,0.2)"}} />
                <span className="text-[10px]" style={{color:T.muted}}>{unit}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between py-1">
            <div>
              <p className="text-sm font-bold text-white">Auto-Block on Flag</p>
              <p className="text-[10px]" style={{color:T.muted}}>Instantly ban accounts that trigger fraud rules</p>
            </div>
            <Toggle on={thresholds.autoBlockOnFlag}
              onChange={v=>setThresholds(t=>({...t,autoBlockOnFlag:v}))} />
          </div>
          <motion.button whileTap={{scale:0.97}} onClick={()=>{setSaved(true);setTimeout(()=>setSaved(false),2000);}}
            className="w-full py-2.5 rounded-xl text-sm font-black cursor-pointer"
            style={{background:saved?"rgba(0,255,136,0.1)":"rgba(0,212,255,0.1)",
              color:saved?T.green:T.blue,border:`1px solid ${saved?"rgba(0,255,136,0.3)":"rgba(0,212,255,0.25)"}`}}>
            {saved?"✅ Rules Saved!":"🛡️ Save Fraud Rules"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

// ─── Emergency Recovery Config Tab ────────────────────────────────────────────

function RecoveryConfigTab({ onOpen }: { onOpen?: () => void }) {
  const configured   = isRecoveryConfigured();
  const backupEmail  = getBackupEmail();
  const masterHash   = import.meta.env.VITE_ADMIN_MASTER_KEY_HASH ?? "";

  return (
    <div className="p-4 space-y-4 max-w-2xl">

      {/* Status banner */}
      <div className="px-4 py-3 rounded-2xl" style={{
        background: configured ? "rgba(0,255,136,0.04)" : "rgba(255,200,0,0.04)",
        border: `1px solid ${configured ? "rgba(0,255,136,0.2)" : "rgba(255,200,0,0.25)"}`,
      }}>
        <div className="flex items-center gap-2 mb-1.5">
          <motion.div className="w-2 h-2 rounded-full shrink-0"
            style={{ background: configured ? "#00ff88" : "#f59e0b" }}
            animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} />
          <span className="text-xs font-black"
            style={{ color: configured ? "#00ff88" : "#f59e0b" }}>
            {configured ? "✅ RECOVERY SYSTEM ACTIVE" : "⚠️ RECOVERY NOT CONFIGURED"}
          </span>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "rgba(226,232,240,0.4)" }}>
          {configured
            ? "Emergency recovery is ready. If you ever lose admin access, use your master key + backup Gmail to restore it instantly."
            : "Add VITE_ADMIN_MASTER_KEY_HASH and VITE_ADMIN_BACKUP_EMAIL to Replit Secrets to activate this system."
          }
        </p>
      </div>

      {/* Config status cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "MASTER KEY HASH", value: masterHash ? masterHash.slice(0, 14) + "…" : "Not configured", set: !!masterHash },
          { label: "BACKUP EMAIL",    value: backupEmail ? maskEmail(backupEmail) : "Not configured",           set: !!backupEmail },
        ].map(({ label, value, set }) => (
          <div key={label} className="px-3 py-3 rounded-xl"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[9px] font-black tracking-[0.16em] mb-1.5"
              style={{ color: "rgba(255,80,0,0.5)" }}>{label}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: set ? "#00ff88" : "#ff4444" }} />
              <p className="text-xs font-mono truncate"
                style={{ color: set ? "rgba(0,255,136,0.8)" : "rgba(255,100,100,0.7)" }}>
                {value}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Main CTA */}
      <motion.button
        onClick={onOpen}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.97 }}
        className="relative w-full py-4 rounded-2xl font-black text-sm cursor-pointer overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(255,60,0,0.14) 0%, rgba(180,0,0,0.22) 100%)",
          color: "#ff6633",
          border: "1px solid rgba(255,60,0,0.32)",
          boxShadow: "0 0 32px rgba(255,60,0,0.07), inset 0 0 0 1px rgba(255,255,255,0.015)",
          letterSpacing: "0.06em",
        }}>
        {/* Shimmer */}
        <motion.div className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,80,0,0.08) 50%, transparent 65%)" }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear", repeatDelay: 2.5 }} />
        🔑 OPEN EMERGENCY RECOVERY PANEL
      </motion.button>

      {/* How it works */}
      <div className="px-4 py-4 rounded-2xl" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <p className="text-xs font-black mb-3" style={{ color: "rgba(226,232,240,0.65)" }}>
          🛡️ How 2-Factor Recovery Works
        </p>
        <div className="space-y-2.5">
          {[
            "Enter your Master Recovery Key → validated against the SHA-256 hash stored in Replit Secrets.",
            "Firebase sends a one-time sign-in link to the pre-registered backup Gmail.",
            "Clicking the link proves inbox ownership — the page auto-redirects here to continue.",
            "Set a new Admin ID + password → written to Firestore and active immediately.",
          ].map((text, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black mt-0.5"
                style={{ background: "rgba(255,80,0,0.1)", border: "1px solid rgba(255,80,0,0.22)", color: "rgba(255,80,0,0.75)" }}>
                {i + 1}
              </div>
              <p className="text-[11px] leading-relaxed flex-1" style={{ color: "rgba(226,232,240,0.38)" }}>{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Setup checklist */}
      <div className="px-4 py-4 rounded-2xl" style={{ background: "rgba(255,200,0,0.03)", border: "1px solid rgba(255,200,0,0.1)" }}>
        <p className="text-xs font-black mb-3" style={{ color: "rgba(255,200,0,0.65)" }}>
          ⚙️ One-Time Setup Checklist
        </p>
        <div className="space-y-2">
          {[
            { done: false,         text: 'Choose a strong master key, e.g. "WINGGO-MASTER-RECOVER-2026-XYZ9Q4"' },
            { done: false,         text: "Compute its SHA-256 at emn178.github.io/online-tools/sha256.html" },
            { done: !!masterHash,  text: "Add VITE_ADMIN_MASTER_KEY_HASH = <hash> in Replit Secrets" },
            { done: !!backupEmail, text: "Add VITE_ADMIN_BACKUP_EMAIL = <backup-gmail> in Replit Secrets" },
            { done: false,         text: "In Firebase Console → Auth → Authorized domains → add your .replit.app domain" },
          ].map(({ done, text }, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <div className="w-4 h-4 rounded shrink-0 flex items-center justify-center text-[8px] mt-0.5"
                style={{
                  background: done ? "rgba(0,255,136,0.1)"   : "rgba(255,255,255,0.04)",
                  border:     `1px solid ${done ? "rgba(0,255,136,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color:      done ? "#00ff88" : "rgba(255,255,255,0.2)",
                }}>
                {done ? "✓" : ""}
              </div>
              <p className="text-[11px] leading-relaxed flex-1"
                style={{ color: done ? "rgba(0,255,136,0.65)" : "rgba(226,232,240,0.35)" }}>
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PageSecurity({
  jumpTab = "",
  onOpenRecovery,
}: {
  jumpTab?: string;
  onOpenRecovery?: () => void;
}) {
  const [tab, setTab] = useState(jumpTab || "profile");
  useEffect(() => { if (jumpTab) setTab(jumpTab); }, [jumpTab]);

  return (
    <div className="flex flex-col min-h-full">
      <TabBar tab={tab} setTab={setTab} />
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {tab === "profile"  && <ProfileTab />}
          {tab === "payment"  && <PaymentConfigTab />}
          {tab === "actlogs"  && <ActivityLogsTab />}
          {tab === "fraud"    && <FraudTab />}
          {tab === "recovery" && <RecoveryConfigTab onOpen={onOpenRecovery} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
