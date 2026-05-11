import { useState } from "react";
import { motion } from "framer-motion";

interface Props { onLogin: () => void; }

export default function AdminLogin({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !pass) { setErr("Enter credentials"); return; }
    setLoading(true);
    setTimeout(() => {
      if (email === "admin@winggo.com" && pass === "admin123") {
        onLogin();
      } else {
        setErr("Invalid credentials. Try admin@winggo.com / admin123");
        setLoading(false);
      }
    }, 900);
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "#07050f" }}>
      {/* Glow orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.20) 0%, transparent 70%)" }} />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,215,0,0.10) 0%, transparent 70%)" }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm mx-4 rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,215,0,0.15)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4"
            style={{ background: "linear-gradient(135deg, #7c3aed, #FFD700)", boxShadow: "0 0 32px rgba(255,215,0,0.3)" }}>
            👑
          </div>
          <div className="text-2xl font-black">
            <span className="text-white">WIN</span><span style={{ color: "#FFD700" }}>GGO</span>
          </div>
          <div className="text-xs font-bold tracking-widest uppercase mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>
            Admin Panel
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Email Address</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@winggo.com"
              className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", caretColor: "#FFD700" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.45)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            />
          </div>
          <div>
            <label className="text-xs font-bold mb-1.5 block" style={{ color: "rgba(255,255,255,0.5)" }}>Password</label>
            <input
              type="password" value={pass} onChange={e => setPass(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", caretColor: "#FFD700" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(255,215,0,0.45)"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            />
          </div>

          {err && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-xs px-3 py-2 rounded-xl"
              style={{ background: "rgba(248,113,113,0.12)", color: "#f87171", border: "1px solid rgba(248,113,113,0.25)" }}>
              {err}
            </motion.p>
          )}

          <motion.button
            type="submit" whileTap={{ scale: 0.97 }}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-black text-sm cursor-pointer mt-2"
            style={{
              background: "linear-gradient(135deg, #FFD700, #ff8c00)",
              color: "#000",
              boxShadow: "0 0 24px rgba(255,215,0,0.35)",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "🔐 Sign In to Admin"}
          </motion.button>
        </form>

        <p className="text-center text-[10px] mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
          Secure Admin Access · WINGGO Gaming Platform
        </p>
      </motion.div>
    </div>
  );
}
