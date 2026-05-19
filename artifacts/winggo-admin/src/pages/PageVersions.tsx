/**
 * PageVersions — Viras Version Control Window
 * Crash-safe: no Monaco dependency, pure React + Firestore.
 * Lists every deploy snapshot from admin_versions and allows one-click rollback.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeVersionHistory, rollbackToVersion,
  type VersionSnapshot,
} from "@/firebase/admin.service";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  purple:"#a78bfa", muted:"rgba(226,232,240,0.38)",
  card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

function fmtAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff <  5)     return "just now";
  if (diff < 60)     return `${diff}s ago`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function PageVersions() {
  const [versions, setVersions] = useState<VersionSnapshot[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [confirm,  setConfirm]  = useState<VersionSnapshot | null>(null);
  const [rolling,  setRolling]  = useState(false);
  const [done,     setDone]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeVersionHistory((v) => { setVersions(v); setLoading(false); });
    return unsub;
  }, []);

  async function handleRollback(v: VersionSnapshot) {
    setRolling(true);
    try {
      await rollbackToVersion(v);
      setDone(v.label);
      setConfirm(null);
      setTimeout(() => setDone(null), 6000);
    } finally {
      setRolling(false);
    }
  }

  return (
    <div className="p-4 space-y-4 max-w-3xl">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            ⏱️ Viras Version Control
          </h2>
          <p className="text-xs mt-0.5" style={{ color: T.muted }}>
            Auto-snapshot on every Deploy. Roll back instantly if a deploy breaks the app.
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
          style={{ background:"rgba(0,255,136,0.06)", border:"1px solid rgba(0,255,136,0.2)" }}>
          <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:T.green }}
            animate={{ opacity:[1,0.3,1] }} transition={{ duration:1.8, repeat:Infinity }} />
          <span className="text-[11px] font-black" style={{ color:T.green }}>
            {versions.length} snapshot{versions.length !== 1 ? "s" : ""} saved
          </span>
        </div>
      </div>

      {/* Info box */}
      <div className="rounded-xl px-4 py-3"
        style={{ background:"rgba(167,139,250,0.05)", border:"1px solid rgba(167,139,250,0.15)" }}>
        <div className="flex items-start gap-3">
          <span className="text-xl shrink-0">🛡️</span>
          <div>
            <p className="text-xs font-black text-white mb-1">Self-Healing Rollback System</p>
            <p className="text-[11px] leading-relaxed" style={{ color:T.muted }}>
              Every time you click <span className="font-black" style={{ color:T.blue }}>Deploy Live</span> in the Code
              Editor, <span className="font-black text-white">all file contents</span> are captured here as a timestamped
              snapshot. If a bad deploy crashes the app, click <span className="font-black" style={{ color:T.red }}>↩ Rollback</span> on
              any previous version to instantly restore it. This panel stays safe and accessible even if the Code Editor itself breaks.
            </p>
          </div>
        </div>
      </div>

      {/* Success banner */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="rounded-xl px-4 py-3 flex items-center gap-3"
            style={{ background:"rgba(0,255,136,0.08)", border:"1px solid rgba(0,255,136,0.3)" }}>
            <span className="text-2xl">✅</span>
            <div>
              <p className="text-sm font-black" style={{ color:T.green }}>Rollback successful!</p>
              <p className="text-xs mt-0.5" style={{ color:T.muted }}>
                Restored to <span className="font-mono text-white">{done}</span>. Open the Code Editor to verify.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <motion.div className="w-8 h-8 rounded-full border-2"
            style={{ borderColor:`${T.blue} transparent transparent transparent` }}
            animate={{ rotate:360 }} transition={{ duration:0.9, repeat:Infinity, ease:"linear" }} />
          <p className="text-xs font-bold" style={{ color:T.muted }}>Loading version history from Firebase…</p>
        </div>
      ) : versions.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
          style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background:"rgba(0,212,255,0.06)", border:"1px solid rgba(0,212,255,0.15)" }}>
            📭
          </div>
          <div>
            <p className="font-black text-white">No versions saved yet</p>
            <p className="text-xs mt-1" style={{ color:T.muted }}>
              Click <span className="font-black" style={{ color:T.blue }}>Deploy Live</span> in the Code Editor to create your first snapshot.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {versions.map((v, i) => {
            const fileList  = Object.keys(v.files ?? {});
            const isLatest  = i === 0;
            const isExpand  = expanded === v.id;
            return (
              <div key={v.id}>
                <motion.div
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay: i * 0.04, duration: 0.2 }}
                  className="rounded-2xl px-4 py-3.5 flex items-center gap-3 flex-wrap cursor-pointer"
                  style={{
                    background: isLatest ? "rgba(0,255,136,0.05)" : T.card,
                    border:`1px solid ${isLatest ? "rgba(0,255,136,0.2)" : T.bdr}`,
                  }}
                  onClick={() => setExpanded(isExpand ? null : v.id)}>

                  {/* Version badge */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-black text-sm shrink-0"
                    style={{
                      background: isLatest ? "rgba(0,255,136,0.1)" : "rgba(0,212,255,0.06)",
                      border:`1px solid ${isLatest ? "rgba(0,255,136,0.3)" : "rgba(0,212,255,0.15)"}`,
                      color: isLatest ? T.green : T.blue,
                    }}>
                    {isLatest ? "★" : `v${v.versionNum ?? "?"}`}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-white text-sm">{v.label}</p>
                      {isLatest && (
                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full"
                          style={{ background:"rgba(0,255,136,0.12)", color:T.green, border:"1px solid rgba(0,255,136,0.25)" }}>
                          LATEST
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[11px]" style={{ color:T.muted }}>🕐 {fmtAgo(v.createdAt)}</span>
                      <span className="text-[11px]" style={{ color:T.muted }}>📄 {fileList.length} file{fileList.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>

                  {/* File pills (desktop) */}
                  <div className="hidden sm:flex flex-wrap gap-1">
                    {fileList.slice(0, 5).map((f) => (
                      <span key={f} className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background:"rgba(255,255,255,0.05)", color:T.muted, border:"1px solid rgba(255,255,255,0.07)" }}>
                        {f}
                      </span>
                    ))}
                    {fileList.length > 5 && (
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background:"rgba(255,255,255,0.05)", color:T.muted }}>+{fileList.length - 5}</span>
                    )}
                  </div>

                  {/* Action */}
                  {isLatest ? (
                    <span className="shrink-0 text-[10px] font-black px-3 py-1.5 rounded-xl"
                      style={{ background:"rgba(0,255,136,0.06)", color:"rgba(0,255,136,0.5)", border:"1px solid rgba(0,255,136,0.12)" }}>
                      ✓ Current
                    </span>
                  ) : (
                    <motion.button whileTap={{ scale:0.95 }}
                      onClick={(e) => { e.stopPropagation(); setConfirm(v); }}
                      className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer"
                      style={{ background:"rgba(255,51,102,0.08)", color:T.red, border:"1px solid rgba(255,51,102,0.22)" }}>
                      ↩ Rollback
                    </motion.button>
                  )}
                </motion.div>

                {/* Expand: show file content preview */}
                <AnimatePresence>
                  {isExpand && (
                    <motion.div
                      initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                      exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
                      className="overflow-hidden">
                      <div className="rounded-b-2xl px-4 py-3 -mt-2 space-y-2"
                        style={{ background:"rgba(0,0,0,0.25)", border:`1px solid ${T.bdr}`, borderTop:"none" }}>
                        <p className="text-[9px] font-black tracking-widest" style={{ color:"rgba(0,212,255,0.35)" }}>FILE CONTENTS</p>
                        {fileList.map((f) => (
                          <div key={f} className="rounded-xl overflow-hidden"
                            style={{ border:"1px solid rgba(255,255,255,0.06)" }}>
                            <div className="px-3 py-1.5 flex items-center gap-2"
                              style={{ background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                              <span className="text-[10px] font-mono font-black text-white">{f}</span>
                              <span className="text-[9px]" style={{ color:T.muted }}>
                                {(v.files[f]?.length ?? 0).toLocaleString()} chars
                              </span>
                            </div>
                            <pre className="px-3 py-2 text-[10px] font-mono overflow-x-auto max-h-24"
                              style={{ color:T.muted, lineHeight:"1.4" }}>
                              {(v.files[f] ?? "").slice(0, 300)}{(v.files[f]?.length ?? 0) > 300 ? "\n…" : ""}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Confirm Rollback Modal ── */}
      <AnimatePresence>
        {confirm && (
          <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
            style={{ background:"rgba(0,0,0,0.9)", backdropFilter:"blur(14px)" }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => !rolling && setConfirm(null)}>
            <motion.div className="relative rounded-3xl p-6 w-full"
              style={{ maxWidth:420, background:"linear-gradient(145deg,#0a0f1a,#080d18)", border:`2px solid rgba(255,51,102,0.35)`, boxShadow:"0 0 48px rgba(255,51,102,0.12)" }}
              initial={{ scale:0.88, y:20 }} animate={{ scale:1, y:0 }}
              exit={{ scale:0.88, y:20 }}
              onClick={(e) => e.stopPropagation()}>

              <button onClick={() => setConfirm(null)} disabled={rolling}
                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-xs cursor-pointer"
                style={{ background:"rgba(255,255,255,0.07)", color:T.muted }}>✕</button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background:"rgba(255,51,102,0.1)", border:"1px solid rgba(255,51,102,0.25)" }}>⚠️</div>
                <div>
                  <p className="font-black text-white text-base">Confirm Rollback</p>
                  <p className="text-[11px] mt-0.5" style={{ color:T.muted }}>This will overwrite the current live code</p>
                </div>
              </div>

              <div className="rounded-xl px-4 py-3 mb-4"
                style={{ background:"rgba(0,0,0,0.3)", border:`1px solid ${T.bdr}` }}>
                <p className="text-sm font-black text-white">{confirm.label}</p>
                <p className="text-[10px] mt-1" style={{ color:T.muted }}>
                  {Object.keys(confirm.files ?? {}).length} files · saved {fmtAgo(confirm.createdAt)}
                </p>
              </div>

              <p className="text-xs mb-5 leading-relaxed" style={{ color:T.muted }}>
                All current code file contents will be replaced. Any unsaved work after the last snapshot will be lost.
              </p>

              <div className="flex gap-2">
                <button onClick={() => setConfirm(null)} disabled={rolling}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
                  style={{ background:"rgba(255,255,255,0.04)", color:T.muted, border:"1px solid rgba(255,255,255,0.08)" }}>
                  Cancel
                </button>
                <motion.button whileTap={{ scale:0.97 }} onClick={() => handleRollback(confirm)} disabled={rolling}
                  className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer flex items-center justify-center gap-2"
                  style={{ background:"rgba(255,51,102,0.12)", color:T.red, border:"1px solid rgba(255,51,102,0.3)" }}>
                  {rolling ? (
                    <>
                      <motion.span animate={{ rotate:360 }} transition={{ duration:0.7, repeat:Infinity, ease:"linear" }}>⚙️</motion.span>
                      Rolling back…
                    </>
                  ) : "↩ Confirm Rollback"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
