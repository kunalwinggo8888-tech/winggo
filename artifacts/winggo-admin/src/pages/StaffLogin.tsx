/**
 * StaffLogin — WINGGO Staff Portal
 * Same aesthetic as AdminLogin but branded for staff access.
 */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { staffSignIn } from "@/firebase/admin.service";
import { saveStaffSession } from "@/firebase/config";

interface Props {
  onLogin:     () => void;
  onAdminMode: () => void;
}

export default function StaffLogin({ onLogin, onAdminMode }: Props) {
  const [username,   setUsername]   = useState("");
  const [password,   setPassword]   = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");
  const [attempts,   setAttempts]   = useState(0);
  const [locked,     setLocked]     = useState(false);
  const [lockTimer,  setLockTimer]  = useState(0);
  const [success,    setSuccess]    = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!locked || lockTimer <= 0) return;
    intervalRef.current = setInterval(() => {
      setLockTimer((t) => {
        if (t <= 1) { setLocked(false); setAttempts(0); setErr(""); clearInterval(intervalRef.current!); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [locked, lockTimer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (locked) return;
    if (!username.trim() || !password) { setErr("Enter your username and password."); return; }
    setLoading(true); setErr("");
    const result = await staffSignIn(username.trim(), password);
    setLoading(false);
    if (result.success && result.account) {
      saveStaffSession(result.account.id, result.account.username, result.account.permissions);
      setSuccess(true);
      setTimeout(() => onLogin(), 1000);
    } else {
      const n = attempts + 1;
      setAttempts(n);
      if (n >= 5) { setLocked(true); setLockTimer(60); setErr("Too many attempts. Locked for 60s."); }
      else { setErr(result.error ?? `Invalid credentials. ${5 - n} attempt${5 - n !== 1 ? "s" : ""} remaining.`); }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#060a10" }}>

      {/* Animated grid + orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(167,139,250,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,0.04) 1px,transparent 1px)",
          backgroundSize: "52px 52px",
        }} />
        <motion.div className="absolute top-[-20%] right-[-15%] w-[55%] h-[55%] rounded-full"
          style={{ background:"radial-gradient(circle,rgba(167,139,250,0.1) 0%,transparent 65%)" }}
          animate={{ scale:[1,1.1,1], opacity:[0.5,0.9,0.5] }}
          transition={{ duration:5, repeat:Infinity, ease:"easeInOut" }} />
        <motion.div className="absolute bottom-[-25%] left-[-25%] w-[65%] h-[65%] rounded-full"
          style={{ background:"radial-gradient(circle,rgba(0,212,255,0.07) 0%,transparent 65%)" }}
          animate={{ scale:[1,1.07,1] }}
          transition={{ duration:7, repeat:Infinity, ease:"easeInOut", delay:2 }} />
        <motion.div className="absolute left-0 right-0 h-px"
          style={{ background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.25),transparent)" }}
          animate={{ top:["-2%","102%"] }}
          transition={{ duration:4.5, repeat:Infinity, ease:"linear", repeatDelay:2.5 }} />
      </div>

      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div key="form"
            initial={{ opacity:0, y:28, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, scale:1.03, y:-14 }}
            transition={{ duration:0.4, ease:[0.22,1,0.36,1] }}
            className="relative w-full mx-4 rounded-3xl"
            style={{
              maxWidth:420,
              background:"rgba(8,13,24,0.88)",
              border:"1px solid rgba(167,139,250,0.25)",
              boxShadow:"0 0 60px rgba(167,139,250,0.1),0 32px 80px rgba(0,0,0,0.7),inset 0 0 0 1px rgba(255,255,255,0.03)",
              backdropFilter:"blur(28px)",
            }}>
            {/* Top shimmer */}
            <div className="absolute top-0 left-10 right-10 h-px rounded-full"
              style={{ background:"linear-gradient(90deg,transparent,rgba(167,139,250,0.7),transparent)" }} />

            <div className="p-8 md:p-10">

              {/* Logo */}
              <div className="flex flex-col items-center mb-8">
                <motion.div className="mb-4 flex items-center justify-center text-3xl rounded-2xl"
                  style={{ width:72, height:72,
                    background:"linear-gradient(135deg,rgba(167,139,250,0.12),rgba(109,40,217,0.18))",
                    border:"1.5px solid rgba(167,139,250,0.35)" }}
                  animate={{ boxShadow:[
                    "0 0 20px rgba(167,139,250,0.15)",
                    "0 0 40px rgba(167,139,250,0.35)",
                    "0 0 20px rgba(167,139,250,0.15)",
                  ]}}
                  transition={{ duration:2.4, repeat:Infinity }}>
                  👤
                </motion.div>
                <div className="text-3xl font-black tracking-tight">
                  <span className="text-white">WIN</span>
                  <span style={{ color:"#a78bfa" }}>GGO</span>
                </div>
                <p className="text-[11px] font-black tracking-[0.28em] mt-1" style={{ color:"rgba(167,139,250,0.5)" }}>
                  STAFF PORTAL
                </p>
                <div className="mt-3 flex items-center gap-1.5 px-3 py-1 rounded-full"
                  style={{ background:"rgba(167,139,250,0.06)", border:"1px solid rgba(167,139,250,0.14)" }}>
                  <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:"#00ff88" }}
                    animate={{ opacity:[1,0.25,1] }} transition={{ duration:1.4, repeat:Infinity }} />
                  <span className="text-[10px] font-black" style={{ color:"#00ff88" }}>RESTRICTED ACCESS</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">

                <div>
                  <label className="text-[10px] font-black tracking-[0.18em] block mb-2" style={{ color:"rgba(167,139,250,0.5)" }}>
                    USERNAME
                  </label>
                  <input type="text" value={username} placeholder="Your staff username"
                    disabled={locked || loading}
                    onChange={(e) => { setUsername(e.target.value); setErr(""); }}
                    className="w-full px-4 py-3.5 rounded-xl text-white text-sm outline-none font-mono"
                    style={{ background:"rgba(0,0,0,0.4)", border:`1px solid ${username?"rgba(167,139,250,0.35)":"rgba(167,139,250,0.15)"}`, caretColor:"#a78bfa", opacity:locked?0.5:1 }}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black tracking-[0.18em] block mb-2" style={{ color:"rgba(167,139,250,0.5)" }}>
                    PASSWORD
                  </label>
                  <div className="relative">
                    <input type={showPass?"text":"password"} value={password}
                      placeholder="Your password" disabled={locked || loading}
                      onChange={(e) => { setPassword(e.target.value); setErr(""); }}
                      className="w-full px-4 py-3.5 pr-12 rounded-xl text-white text-sm outline-none font-mono"
                      style={{ background:"rgba(0,0,0,0.4)", border:`1px solid ${password?"rgba(167,139,250,0.35)":"rgba(167,139,250,0.15)"}`, caretColor:"#a78bfa", opacity:locked?0.5:1 }}
                    />
                    <motion.button type="button" whileTap={{ scale:0.85 }} tabIndex={-1}
                      onClick={() => setShowPass((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer"
                      style={{ background:"rgba(167,139,250,0.07)", color:showPass?"#a78bfa":"rgba(226,232,240,0.3)", fontSize:14 }}>
                      {showPass ? "🙈" : "👁"}
                    </motion.button>
                  </div>
                </div>

                <AnimatePresence>
                  {err && (
                    <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                      className="px-4 py-3 rounded-xl flex items-start gap-2.5"
                      style={{ background:"rgba(255,51,102,0.08)", border:"1px solid rgba(255,51,102,0.22)" }}>
                      <span className="text-base shrink-0">{locked?"🔒":"⚠️"}</span>
                      <div>
                        <p className="text-xs font-bold" style={{ color:"#ff6680" }}>{err}</p>
                        {locked && lockTimer > 0 && (
                          <p className="text-xs mt-0.5 font-mono" style={{ color:"rgba(255,102,128,0.6)" }}>Try again in {lockTimer}s</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button type="submit" whileTap={{ scale:0.97 }}
                  disabled={loading || locked}
                  className="relative w-full py-4 rounded-xl font-black text-sm cursor-pointer overflow-hidden mt-2"
                  style={{
                    background: locked ? "rgba(255,255,255,0.04)" : "linear-gradient(135deg,rgba(167,139,250,0.2),rgba(109,40,217,0.28))",
                    color:      locked ? "rgba(255,255,255,0.2)" : "#a78bfa",
                    border:     `1px solid ${locked?"rgba(255,255,255,0.06)":"rgba(167,139,250,0.4)"}`,
                    letterSpacing:"0.08em",
                    opacity: loading ? 0.8 : 1,
                  }}>
                  <AnimatePresence mode="wait">
                    {loading ? (
                      <motion.span key="ld" className="flex items-center justify-center gap-2"
                        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                        <motion.span animate={{ rotate:360 }} transition={{ duration:0.75, repeat:Infinity, ease:"linear" }}>⚙️</motion.span>
                        Authenticating…
                      </motion.span>
                    ) : locked ? (
                      <motion.span key="lk" className="flex items-center justify-center gap-2"
                        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                        🔒 LOCKED · {lockTimer}s
                      </motion.span>
                    ) : (
                      <motion.span key="id" className="flex items-center justify-center gap-2"
                        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
                        👤 ACCESS STAFF PORTAL
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </form>

              {/* Footer */}
              <div className="mt-6 flex flex-col items-center gap-3">
                <button onClick={onAdminMode}
                  className="text-xs font-black cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ color:"rgba(0,212,255,0.5)" }}>
                  ⚡ Super-Admin Login →
                </button>
                <p className="text-[9px] font-mono" style={{ color:"rgba(255,255,255,0.1)" }}>
                  WINGGO STAFF PORTAL · RESTRICTED ACCESS
                </p>
              </div>
            </div>
          </motion.div>

        ) : (
          <motion.div key="success" initial={{ opacity:0, scale:0.88 }} animate={{ opacity:1, scale:1 }}
            className="flex flex-col items-center gap-5 text-center px-8">
            <motion.div className="text-6xl"
              animate={{ scale:[1,1.15,1] }} transition={{ duration:0.6, repeat:2 }}>
              ✅
            </motion.div>
            <div>
              <p className="text-2xl font-black text-white">ACCESS GRANTED</p>
              <p className="text-sm mt-2 font-mono" style={{ color:"rgba(167,139,250,0.6)" }}>Loading your dashboard…</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
