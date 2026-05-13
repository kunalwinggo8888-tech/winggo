import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
const W = 390, H = 500;
const TOTAL_GEARS = 8;
const PERFECT_ZONE = 0.15;

export default function GearUpGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const stateRef = useRef({
    rpm: 0, rpmDir: 1, rpmSpeed: 0.008,
    gear: 0, totalScore: 0, botScore: 0,
    frame: 0, running: false,
    shifting: false, shiftFlash: 0,
    shiftResult: "" as "" | "perfect" | "good" | "miss",
  });
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [gear, setGear] = useState(0);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState("");
  const [won, setWon] = useState(false);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  function shiftGear() {
    const s = stateRef.current;
    if (s.shifting || !s.running) return;
    s.shifting = true;

    const rpm = s.rpm;
    let pts = 0, result: typeof s.shiftResult = "miss", label = "";
    if (rpm >= 0.8 - PERFECT_ZONE && rpm <= 0.8 + PERFECT_ZONE) {
      pts = 300; result = "perfect"; label = "🔥 PERFECT! +300";
    } else if (rpm >= 0.6 && rpm <= 0.95) {
      pts = 150; result = "good"; label = "✅ GOOD! +150";
    } else {
      pts = 0; result = "miss"; label = "❌ TOO EARLY/LATE";
    }
    s.totalScore += pts;
    s.botScore += Math.floor(Math.random() * 200 + 100);
    s.shiftResult = result;
    s.shiftFlash = 30;
    s.gear++;
    setGear(s.gear); setScore(s.totalScore); setMsg(label);
    setTimeout(() => setMsg(""), 900);

    if (s.gear >= TOTAL_GEARS) {
      s.running = false;
      const didWin = s.totalScore > s.botScore;
      setWon(didWin);
      if (didWin) addWinning(prize, "Gear Up Win");
      setTimeout(() => setPhase("result"), 600);
      return;
    }

    // Speed up RPM for next gear
    s.rpmSpeed = 0.008 + s.gear * 0.002;
    setTimeout(() => { s.shifting = false; s.rpm = 0; }, 300);
  }

  function loop() {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !s.running) return;
    const ctx = canvas.getContext("2d")!;
    s.frame++;

    if (!s.shifting) {
      s.rpm += s.rpmSpeed;
      if (s.rpm > 1) { s.rpm = 1; }
    }
    if (s.shiftFlash > 0) s.shiftFlash--;

    draw(ctx, s);
    rafRef.current = requestAnimationFrame(loop);
  }

  function draw(ctx: CanvasRenderingContext2D, s: typeof stateRef.current) {
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a0520"); bg.addColorStop(1, "#1e0a3c");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

    const cx = W / 2, cy = H / 2 - 20, r = 130;

    // Tachometer background
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.shadowColor = "#a78bfa"; ctx.shadowBlur = 30;
    ctx.beginPath(); ctx.arc(cx, cy, r + 20, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    // RPM arc zones
    const startAngle = Math.PI * 0.75;
    const endAngle = Math.PI * 2.25;
    const totalArc = endAngle - startAngle;

    // Danger zone (red)
    ctx.strokeStyle = "#ef4444"; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle + totalArc * 0.75, endAngle); ctx.stroke();
    // Perfect zone (gold)
    ctx.strokeStyle = "#FFD700"; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle + totalArc * (0.8 - PERFECT_ZONE), startAngle + totalArc * (0.8 + PERFECT_ZONE)); ctx.stroke();
    // Normal zone (green)
    ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle, startAngle + totalArc * 0.6); ctx.stroke();
    // Yellow warning
    ctx.strokeStyle = "#f59e0b"; ctx.lineWidth = 18;
    ctx.beginPath(); ctx.arc(cx, cy, r, startAngle + totalArc * 0.6, startAngle + totalArc * 0.75); ctx.stroke();

    // Tick marks
    for (let i = 0; i <= 10; i++) {
      const angle = startAngle + (i / 10) * totalArc;
      const inner = r - 22, outer = r + 22;
      ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = i % 5 === 0 ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
      ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
      ctx.stroke();
      if (i % 2 === 0) {
        ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(`${i * 10}`, cx + Math.cos(angle) * (inner - 14), cy + Math.sin(angle) * (inner - 14) + 4);
      }
    }

    // Needle
    const needleAngle = startAngle + s.rpm * totalArc;
    const flashColor = s.shiftFlash > 0
      ? (s.shiftResult === "perfect" ? "#FFD700" : s.shiftResult === "good" ? "#22c55e" : "#ef4444")
      : "#fff";
    ctx.strokeStyle = flashColor; ctx.lineWidth = 4;
    ctx.shadowColor = flashColor; ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(needleAngle) * 20, cy - Math.sin(needleAngle) * 20);
    ctx.lineTo(cx + Math.cos(needleAngle) * (r - 20), cy + Math.sin(needleAngle) * (r - 20));
    ctx.stroke(); ctx.shadowBlur = 0;

    // Center hub
    ctx.fillStyle = "#1a1a2e"; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#a78bfa"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke();

    // Gear info center
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`G${s.gear + 1}`, cx, cy + 10);

    // Speed bar at bottom
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.roundRect(40, H - 80, W - 80, 20, 10); ctx.fill();
    const spColor = s.rpm > 0.8 ? "#ef4444" : s.rpm > 0.6 ? "#FFD700" : "#22c55e";
    ctx.fillStyle = spColor;
    ctx.beginPath(); ctx.roundRect(40, H - 80, (W - 80) * s.rpm, 20, 10); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(`RPM: ${Math.round(s.rpm * 100)}% — Hit SHIFT when golden!`, W / 2, H - 65);

    // HUD
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "left";
    ctx.fillText(`Score: ${s.totalScore}`, 16, 30);
    ctx.fillStyle = "#ef4444"; ctx.fillText(`Bot: ${s.botScore}`, 16, 50);
    ctx.fillStyle = "#a78bfa"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
    ctx.fillText(`Gear ${s.gear + 1} / ${TOTAL_GEARS}`, W - 16, 30);
  }

  function startGame() {
    cancelAnimationFrame(rafRef.current);
    const s = stateRef.current;
    s.rpm = 0; s.gear = 0; s.totalScore = 0; s.botScore = 0;
    s.rpmSpeed = 0.008; s.running = true; s.frame = 0;
    s.shifting = false; s.shiftResult = "";
    setGear(0); setScore(0); setPhase("playing"); setMsg("");
    loop();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "Space") { e.preventDefault(); shiftGear(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#0a0520", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.6)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">⚙️ Gear Up</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
      </div>
      <div className="relative w-full" style={{ maxWidth: W }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        {msg && (
          <motion.div key={msg} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1.1 }}
            className="absolute font-black text-xl text-white pointer-events-none"
            style={{ top: "66%", left: "50%", transform: "translateX(-50%)" }}>
            {msg}
          </motion.div>
        )}
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.93)" }}>
              <div className="text-7xl">⚙️</div>
              <div className="text-white font-black text-3xl">Gear Up!</div>
              <div className="text-zinc-400 text-sm text-center px-8">Watch the RPM needle. Tap SHIFT when it hits the golden zone for max points!</div>
              <div className="px-3 py-2 rounded-xl text-sm text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", color: "#FFD700" }}>
                🟡 Perfect: 300pts &nbsp;|&nbsp; 🟢 Good: 150pts &nbsp;|&nbsp; ❌ Miss: 0pts
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                START ENGINE ⚙️
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              style={{ background: "rgba(10,5,32,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "⚙️"}</div>
              <div className="text-white font-black text-2xl">{won ? "GEARBOX MASTER!" : "BOT WINS!"}</div>
              <div className="flex gap-8 text-center">
                <div><div className="text-zinc-400 text-xs">Your Score</div><div className="text-white font-black text-xl">{score}</div></div>
                <div><div className="text-zinc-400 text-xs">Bot Score</div><div className="text-zinc-300 font-black text-xl">{stateRef.current.botScore}</div></div>
              </div>
              {won && <div className="text-green-400 font-black text-lg">+₹{prize} Added!</div>}
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
                  className="px-7 py-3 rounded-xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Retry</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="px-7 py-3 rounded-xl font-bold text-white"
                  style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {phase === "playing" && (
        <div className="px-6 py-4">
          <motion.button whileTap={{ scale: 0.93 }} onClick={shiftGear}
            className="w-full py-5 rounded-2xl font-black text-black text-2xl"
            style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", boxShadow: "0 0 28px rgba(255,215,0,0.5)" }}>
            ⚙️ SHIFT!
          </motion.button>
        </div>
      )}
    </div>
  );
}
