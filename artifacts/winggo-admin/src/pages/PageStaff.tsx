/**
 * PageStaff — Staff Management
 * Super-admin creates/edits/deletes staff accounts with granular module permissions.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  subscribeStaffAccounts, createStaffAccount, updateStaffAccount,
  resetStaffPassword, deleteStaffAccount,
  type StaffAccount,
} from "@/firebase/admin.service";
import { ALL_PERMS, type StaffPermissions } from "@/firebase/config";

const T = {
  blue:"#00d4ff", green:"#00ff88", red:"#ff3366", gold:"#f59e0b",
  purple:"#a78bfa", muted:"rgba(226,232,240,0.38)",
  card:"rgba(0,212,255,0.04)", bdr:"rgba(0,212,255,0.13)",
};

const PERM_META: Record<keyof StaffPermissions, { icon:string; label:string }> = {
  users:         { icon:"👥", label:"User Management"    },
  deposits:      { icon:"⬇️", label:"Deposit Requests"   },
  withdrawals:   { icon:"⬆️", label:"Withdrawals"        },
  kyc:           { icon:"✅", label:"KYC Verification"   },
  games:         { icon:"🎮", label:"Game Settings"      },
  marketing:     { icon:"🎁", label:"Banners & Marketing"},
  notifications: { icon:"🔔", label:"Notifications"      },
  referral:      { icon:"🔗", label:"Referral & Earnings"},
};

const DEFAULT_PERMS: StaffPermissions = {
  users:false, deposits:false, withdrawals:false, kyc:false,
  games:false, marketing:false, notifications:false, referral:false,
};

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"2-digit" });
}

type Modal = "create" | "edit" | "delete" | "reset" | null;

export default function PageStaff() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState<Modal>(null);
  const [selected, setSelected] = useState<StaffAccount | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [newPw,    setNewPw]    = useState("");
  const [perms,    setPerms]    = useState<StaffPermissions>(DEFAULT_PERMS);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState<{ type:"ok"|"err"; text:string } | null>(null);

  useEffect(() => subscribeStaffAccounts((a) => { setAccounts(a); setLoading(false); }), []);

  function openCreate() {
    setUsername(""); setPassword(""); setPerms(DEFAULT_PERMS); setMsg(null); setModal("create");
  }
  function openEdit(a: StaffAccount) {
    setSelected(a); setPerms({ ...DEFAULT_PERMS, ...a.permissions }); setMsg(null); setModal("edit");
  }
  function openReset(a: StaffAccount)  { setSelected(a); setNewPw(""); setMsg(null); setModal("reset"); }
  function openDelete(a: StaffAccount) { setSelected(a); setModal("delete"); }
  function closeModal() { setModal(null); setSelected(null); setSaving(false); setMsg(null); }

  function togglePerm(k: keyof StaffPermissions) { setPerms((p) => ({ ...p, [k]: !p[k] })); }

  async function handleCreate() {
    if (!username.trim()) { setMsg({ type:"err", text:"Username is required." }); return; }
    if (password.length < 6) { setMsg({ type:"err", text:"Password must be at least 6 characters." }); return; }
    if (!Object.values(perms).some(Boolean)) { setMsg({ type:"err", text:"Grant at least one permission." }); return; }
    setSaving(true);
    try {
      await createStaffAccount(username.trim(), password, perms);
      setMsg({ type:"ok", text:"Staff account created!" });
      setTimeout(closeModal, 1400);
    } catch { setMsg({ type:"err", text:"Failed. Check Firebase connection." }); }
    finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!selected) return;
    setSaving(true);
    try {
      await updateStaffAccount(selected.id, { permissions: perms });
      setMsg({ type:"ok", text:"Permissions updated!" });
      setTimeout(closeModal, 1200);
    } catch { setMsg({ type:"err", text:"Update failed." }); }
    finally { setSaving(false); }
  }

  async function handleReset() {
    if (!selected) return;
    if (newPw.length < 6) { setMsg({ type:"err", text:"Password must be 6+ characters." }); return; }
    setSaving(true);
    try {
      await resetStaffPassword(selected.id, newPw);
      setMsg({ type:"ok", text:"Password reset successfully!" });
      setTimeout(closeModal, 1200);
    } catch { setMsg({ type:"err", text:"Reset failed." }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!selected) return;
    setSaving(true);
    try { await deleteStaffAccount(selected.id); closeModal(); }
    catch { setSaving(false); }
  }

  async function toggleActive(a: StaffAccount) {
    await updateStaffAccount(a.id, { active: !a.active });
  }

  const permCount = (p: StaffPermissions) => Object.values(p).filter(Boolean).length;

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-black text-white">👥 Staff Management</h2>
          <p className="text-xs mt-0.5" style={{ color:T.muted }}>
            Create team accounts with custom permissions. Staff log in via the Staff Portal link on the login page.
          </p>
        </div>
        <motion.button whileTap={{ scale:0.96 }} onClick={openCreate}
          className="px-4 py-2 rounded-xl text-sm font-black cursor-pointer flex items-center gap-2"
          style={{ background:"rgba(0,212,255,0.1)", color:T.blue, border:"1px solid rgba(0,212,255,0.28)" }}>
          ＋ Create Staff
        </motion.button>
      </div>

      {/* Portal info */}
      <div className="rounded-xl px-4 py-3 flex items-start gap-3"
        style={{ background:"rgba(167,139,250,0.05)", border:"1px solid rgba(167,139,250,0.15)" }}>
        <span className="text-lg shrink-0">🔐</span>
        <div>
          <p className="text-xs font-black text-white">How Staff Login Works</p>
          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color:T.muted }}>
            Staff members visit the same admin URL and click <span className="font-black text-white">Staff Portal</span> on the
            login page. They authenticate with their username & password and land on a restricted dashboard showing only the
            sections you've granted access to. They can never access Code Editor, Staff Management, or Version Control.
          </p>
        </div>
      </div>

      {/* Staff list */}
      {loading ? (
        <div className="flex justify-center py-14">
          <motion.div className="w-8 h-8 rounded-full border-2"
            style={{ borderColor:`${T.blue} transparent transparent transparent` }}
            animate={{ rotate:360 }} transition={{ duration:0.9, repeat:Infinity, ease:"linear" }} />
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
          style={{ background:T.card, border:`1px solid ${T.bdr}` }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background:"rgba(0,212,255,0.06)", border:"1px solid rgba(0,212,255,0.15)" }}>👤</div>
          <div>
            <p className="font-black text-white">No staff accounts yet</p>
            <p className="text-xs mt-1" style={{ color:T.muted }}>Click "Create Staff" to add your first team member.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id}
              className="rounded-2xl px-4 py-3.5 flex items-start gap-3 flex-wrap"
              style={{
                background: T.card,
                border: `1px solid ${a.active ? T.bdr : "rgba(255,255,255,0.04)"}`,
                opacity: a.active ? 1 : 0.55,
              }}>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0"
                style={{ background:"linear-gradient(135deg,rgba(0,212,255,0.12),rgba(0,85,255,0.18))", border:"1px solid rgba(0,212,255,0.25)", color:T.blue }}>
                {a.username.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white font-mono text-sm">{a.username}</p>
                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded"
                    style={{ background:a.active?"rgba(0,255,136,0.1)":"rgba(255,255,255,0.05)", color:a.active?T.green:T.muted }}>
                    {a.active ? "ACTIVE" : "DISABLED"}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap text-[10px]" style={{ color:T.muted }}>
                  <span>🔐 {permCount(a.permissions)} permission{permCount(a.permissions) !== 1 ? "s" : ""}</span>
                  <span>📅 {fmtDate(a.createdAt)}</span>
                  {a.lastLogin && <span>🕐 Last: {fmtDate(a.lastLogin)}</span>}
                </div>
                {/* Permission chips */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {ALL_PERMS.filter((k) => a.permissions[k]).map((k) => (
                    <span key={k} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background:"rgba(0,212,255,0.07)", color:T.blue, border:"1px solid rgba(0,212,255,0.12)" }}>
                      {PERM_META[k].icon} {PERM_META[k].label}
                    </span>
                  ))}
                  {permCount(a.permissions) === 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background:"rgba(255,51,102,0.08)", color:T.red }}>No permissions</span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                <button onClick={() => toggleActive(a)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                  style={{ background:a.active?"rgba(255,255,255,0.04)":"rgba(0,255,136,0.08)", color:a.active?T.muted:T.green, border:`1px solid ${a.active?"rgba(255,255,255,0.08)":"rgba(0,255,136,0.2)"}` }}>
                  {a.active ? "Disable" : "Enable"}
                </button>
                <button onClick={() => openEdit(a)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                  style={{ background:"rgba(0,212,255,0.06)", color:T.blue, border:"1px solid rgba(0,212,255,0.15)" }}>
                  Permissions
                </button>
                <button onClick={() => openReset(a)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                  style={{ background:"rgba(245,158,11,0.06)", color:T.gold, border:"1px solid rgba(245,158,11,0.15)" }}>
                  Reset PW
                </button>
                <button onClick={() => openDelete(a)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-black cursor-pointer"
                  style={{ background:"rgba(255,51,102,0.06)", color:T.red, border:"1px solid rgba(255,51,102,0.15)" }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal && (
          <motion.div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background:"rgba(0,0,0,0.9)", backdropFilter:"blur(14px)" }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => !saving && closeModal()}>
            <motion.div className="w-full rounded-3xl overflow-hidden"
              style={{ maxWidth:480, background:"linear-gradient(145deg,#0a0f1a,#080d18)", border:`1px solid ${T.bdr}`, boxShadow:"0 0 60px rgba(0,212,255,0.08)", maxHeight:"90vh", overflowY:"auto" }}
              initial={{ scale:0.9, y:16 }} animate={{ scale:1, y:0 }}
              exit={{ scale:0.9, y:16 }}
              onClick={(e) => e.stopPropagation()}>

              {/* Modal header */}
              <div className="px-5 py-4 flex items-center justify-between sticky top-0 z-10"
                style={{ background:"rgba(8,13,24,0.95)", borderBottom:`1px solid ${T.bdr}` }}>
                <p className="font-black text-white text-sm">
                  {modal === "create" ? "➕ Create Staff Account"
                    : modal === "edit"   ? `✏️ Permissions — ${selected?.username}`
                    : modal === "reset"  ? `🔑 Reset Password — ${selected?.username}`
                    : `🗑️ Delete — ${selected?.username}`}
                </p>
                <button onClick={() => !saving && closeModal()} className="cursor-pointer text-xl" style={{ color:T.muted }}>✕</button>
              </div>

              <div className="p-5 space-y-4">

                {modal === "create" && (
                  <>
                    <div>
                      <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color:"rgba(0,212,255,0.45)" }}>USERNAME</label>
                      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. rahul_support (lowercase)"
                        className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                        style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,212,255,0.2)", caretColor:T.blue }} />
                    </div>
                    <div>
                      <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color:"rgba(0,212,255,0.45)" }}>INITIAL PASSWORD (min 6 chars)</label>
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Temporary password for staff"
                        className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                        style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,212,255,0.2)", caretColor:T.blue }} />
                    </div>
                  </>
                )}

                {(modal === "create" || modal === "edit") && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[9px] font-black tracking-widest" style={{ color:"rgba(0,212,255,0.45)" }}>
                        MODULE ACCESS ({Object.values(perms).filter(Boolean).length}/{ALL_PERMS.length})
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => setPerms(Object.fromEntries(ALL_PERMS.map((k) => [k, true])) as unknown as StaffPermissions)}
                          className="text-[10px] font-black px-2 py-0.5 rounded cursor-pointer"
                          style={{ color:T.blue, background:"rgba(0,212,255,0.06)" }}>All</button>
                        <button onClick={() => setPerms(DEFAULT_PERMS)}
                          className="text-[10px] font-black px-2 py-0.5 rounded cursor-pointer"
                          style={{ color:T.muted, background:"rgba(255,255,255,0.04)" }}>None</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {ALL_PERMS.map((k) => (
                        <button key={k} onClick={() => togglePerm(k)}
                          className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left cursor-pointer"
                          style={{
                            background: perms[k] ? "rgba(0,212,255,0.1)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${perms[k] ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.07)"}`,
                          }}>
                          <div className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                            style={{ background:perms[k]?"rgba(0,212,255,0.25)":"rgba(255,255,255,0.06)", border:`1.5px solid ${perms[k]?"rgba(0,212,255,0.6)":"rgba(255,255,255,0.12)"}` }}>
                            {perms[k] && <span className="text-[10px] font-black" style={{ color:T.blue }}>✓</span>}
                          </div>
                          <div>
                            <span className="text-[10px] font-black" style={{ color:perms[k] ? T.blue : T.muted }}>
                              {PERM_META[k].icon} {PERM_META[k].label}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {modal === "reset" && (
                  <div>
                    <label className="text-[9px] font-black tracking-widest block mb-1.5" style={{ color:"rgba(0,212,255,0.45)" }}>NEW PASSWORD (min 6 chars)</label>
                    <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                      placeholder="New password"
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none font-mono"
                      style={{ background:"rgba(0,0,0,0.4)", border:"1px solid rgba(0,212,255,0.2)", caretColor:T.blue }} />
                  </div>
                )}

                {modal === "delete" && (
                  <div className="rounded-xl px-4 py-3.5"
                    style={{ background:"rgba(255,51,102,0.06)", border:"1px solid rgba(255,51,102,0.2)" }}>
                    <p className="text-sm font-black" style={{ color:T.red }}>⚠️ Permanently delete this account?</p>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color:T.muted }}>
                      <span className="font-mono text-white">{selected?.username}</span> will be removed and will no longer be able to log in. This cannot be undone.
                    </p>
                  </div>
                )}

                <AnimatePresence>
                  {msg && (
                    <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                      className="px-3 py-2.5 rounded-xl text-xs font-black"
                      style={{ background:msg.type==="ok"?"rgba(0,255,136,0.08)":"rgba(255,51,102,0.08)", color:msg.type==="ok"?T.green:T.red, border:`1px solid ${msg.type==="ok"?"rgba(0,255,136,0.2)":"rgba(255,51,102,0.2)"}` }}>
                      {msg.text}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  <button onClick={() => !saving && closeModal()} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
                    style={{ background:"rgba(255,255,255,0.04)", color:T.muted, border:"1px solid rgba(255,255,255,0.08)" }}>
                    Cancel
                  </button>
                  <motion.button whileTap={{ scale:0.97 }} disabled={saving}
                    onClick={
                      modal === "create" ? handleCreate
                        : modal === "edit"  ? handleUpdate
                        : modal === "reset" ? handleReset
                        : handleDelete
                    }
                    className="flex-1 py-2.5 rounded-xl text-sm font-black cursor-pointer"
                    style={{
                      background: modal === "delete" ? "rgba(255,51,102,0.1)" : "rgba(0,212,255,0.1)",
                      color:      modal === "delete" ? T.red : T.blue,
                      border:     `1px solid ${modal === "delete" ? "rgba(255,51,102,0.28)" : "rgba(0,212,255,0.28)"}`,
                    }}>
                    {saving ? "⏳ Saving…"
                      : modal === "create" ? "✓ Create Account"
                      : modal === "edit"   ? "✓ Save Permissions"
                      : modal === "reset"  ? "🔑 Reset Password"
                      : "🗑️ Delete Forever"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
