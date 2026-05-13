/**
 * Shadow Fighter — WINGGO
 * 2D canvas silhouette side-scroller. Sword slashes, dash, double jump.
 * Beat enemy waves to reach bot score and win.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 520;
const GROUND = H - 70;
const GRAVITY = 0.55;

interface Enemy {
  x: number; y: number; vx: number; hp: number; maxHp: number;
  isBoss: boolean; slashAnim: number; attackTimer: number; dead: boolean; deathTimer: number;
}
interface SoulParticle { x: number; y: number; vx: number; vy: number; life: number; color: string }
interface SlashEffect { x: number; y: number; life: number; angle: number; size: number }

export default function ShadowFighterGame({ onBack, initialFee = 5 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const [botScore] = useState(() => getBotScore(80, difficulty));
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());

  const stateRef = useRef({
    px: 80, py: GROUND, pvx: 0, pvy: 0,
    pHp: 5, pMaxHp: 5,
    onGround: true, jumps: 0,
    isDashing: false, dashTimer: 0,
    slashing: false, slashTimer: 0, slashCooldown: 0,
    facing: 1,
    enemies: [] as Enemy[],
    particles: [] as SoulParticle[],
    slashFx: [] as SlashEffect[],
    score: 0,
    frame: 0,
    waveTimer: 80,
    wave: 0,
    bossSpawned: false,
    bgX: 0,
    hurtFlash: 0,
    running: true,
    trailPositions: [] as { x: number; y: number }[],
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [hp, setHp] = useState(5);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const s = stateRef.current;
    s.px = 80; s.py = GROUND; s.pvx = 0; s.pvy = 0;
    s.pHp = 5; s.pMaxHp = 5; s.onGround = true; s.jumps = 0;
    s.isDashing = false; s.dashTimer = 0;
    s.slashing = false; s.slashTimer = 0; s.slashCooldown = 0;
    s.facing = 1; s.enemies = []; s.particles = []; s.slashFx = [];
    s.score = 0; s.frame = 0; s.waveTimer = 80; s.wave = 0;
    s.bossSpawned = false; s.bgX = 0; s.hurtFlash = 0; s.running = true;
    s.trailPositions = [];

    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      keysRef.current.add(k);
      if ((k === " " || k === "arrowup" || k === "w") && s.jumps < 2) {
        s.pvy = -13; s.jumps++; s.onGround = false;
      }
      if (k === "z" || k === "x") {
        if (!s.isDashing && s.dashTimer <= 0) {
          s.isDashing = true; s.dashTimer = 12;
          s.pvx = s.facing * 10;
        }
      }
      if (k === "j" || k === "f") {
        if (!s.slashing && s.slashCooldown <= 0) {
          s.slashing = true; s.slashTimer = 16; s.slashCooldown = 22;
          s.slashFx.push({ x: s.px + s.facing * 40, y: s.py - 40, life: 14, angle: Math.random() * 0.5 - 0.25, size: 60 });
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.key.toLowerCase()); }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    function spawnEnemy() {
      const isBoss = s.wave > 0 && s.wave % 5 === 0 && !s.bossSpawned;
      if (isBoss) s.bossSpawned = true;
      const hp = isBoss ? 8 : 2 + Math.floor(s.wave * 0.3);
      s.enemies.push({
        x: W + 50, y: GROUND,
        vx: -(1.5 + s.wave * 0.1 + (isBoss ? 0.5 : 0)),
        hp, maxHp: hp, isBoss, slashAnim: 0, attackTimer: 60, dead: false, deathTimer: 0,
      });
    }

    function drawSilhouette(cx: CanvasRenderingContext2D, x: number, y: number, facing: number, isSlashing: boolean, isDashing: boolean, size = 1) {
      cx.save();
      cx.translate(x, y);
      cx.scale(facing * size, size);

      // Shadow trail when dashing
      if (isDashing) {
        cx.globalAlpha = 0.3;
        cx.fillStyle = "#7c3aed";
        cx.beginPath(); cx.ellipse(-10, -35, 12, 35, 0, 0, Math.PI * 2); cx.fill();
        cx.globalAlpha = 1;
      }

      // Body
      cx.fillStyle = "#000000";
      cx.beginPath();
      cx.ellipse(0, -38, 13, 28, 0, 0, Math.PI * 2); cx.fill();

      // Head
      cx.beginPath();
      cx.arc(0, -76, 16, 0, Math.PI * 2); cx.fill();

      // Neon eyes
      cx.fillStyle = isDashing ? "#a855f7" : "#00ffff";
      cx.shadowColor = isDashing ? "#a855f7" : "#00ffff";
      cx.shadowBlur = 8;
      cx.beginPath(); cx.arc(6, -80, 4, 0, Math.PI * 2); cx.fill();
      cx.shadowBlur = 0;

      // Legs
      cx.fillStyle = "#000";
      cx.beginPath(); cx.roundRect(-12, -12, 10, 28, 4); cx.fill();
      cx.beginPath(); cx.roundRect(2, -12, 10, 28, 4); cx.fill();

      // Arms
      cx.beginPath(); cx.roundRect(-22, -58, 10, 32, 4); cx.fill();
      if (isSlashing) {
        cx.save();
        cx.translate(14, -54);
        cx.rotate(-0.9);
        cx.beginPath(); cx.roundRect(0, 0, 10, 32, 4); cx.fill();
        cx.restore();
      } else {
        cx.beginPath(); cx.roundRect(14, -58, 10, 32, 4); cx.fill();
      }

      // Sword
      const swordColor = isSlashing ? "#00ffff" : "#888";
      cx.fillStyle = swordColor;
      if (isSlashing) { cx.shadowColor = swordColor; cx.shadowBlur = 20; }
      cx.save();
      cx.translate(20, -55);
      cx.rotate(isSlashing ? -1.2 : -0.1);
      cx.beginPath(); cx.roundRect(0, -50, 6, 50, 2); cx.fill();
      cx.shadowBlur = 0;
      cx.restore();

      cx.restore();
    }

    function drawEnemy(cx: CanvasRenderingContext2D, e: Enemy) {
      cx.save();
      cx.globalAlpha = e.deathTimer > 0 ? e.deathTimer / 25 : 1;
      cx.translate(e.x, e.y);
      const sz = e.isBoss ? 1.4 : 1;
      cx.scale(-sz, sz);
      cx.fillStyle = "#000";
      cx.beginPath(); cx.ellipse(0, -38, 13, 28, 0, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(0, -74, 15, 0, Math.PI * 2); cx.fill();
      // Red eyes
      cx.fillStyle = e.isBoss ? "#ff6600" : "#ff0000";
      cx.shadowColor = cx.fillStyle;
      cx.shadowBlur = 10;
      cx.beginPath(); cx.arc(5, -78, 4, 0, Math.PI * 2); cx.fill();
      cx.shadowBlur = 0;
      // Legs
      cx.fillStyle = "#000";
      cx.beginPath(); cx.roundRect(-10, -12, 9, 26, 3); cx.fill();
      cx.beginPath(); cx.roundRect(3, -12, 9, 26, 3); cx.fill();
      // Arms
      cx.beginPath(); cx.roundRect(-20, -56, 9, 30, 3); cx.fill();
      cx.beginPath(); cx.roundRect(12, -56, 9, 30, 3); cx.fill();
      // Enemy weapon
      cx.fillStyle = e.isBoss ? "#ff6600" : "#660000";
      if (e.isBoss) { cx.shadowColor = "#ff6600"; cx.shadowBlur = 14; }
      cx.save(); cx.translate(20, -52); cx.rotate(0.2);
      cx.beginPath(); cx.roundRect(0, -44, 7, 44, 2); cx.fill();
      cx.shadowBlur = 0; cx.restore();
      cx.restore();
    }

    function loop() {
      if (!s.running) return;
      s.frame++;

      // ── Player physics ──
      if (!s.onGround) { s.pvy += GRAVITY; }
      if (s.isDashing) { s.dashTimer--; if (s.dashTimer <= 0) { s.isDashing = false; s.pvx = 0; } }
      else {
        const left = keysRef.current.has("a") || keysRef.current.has("arrowleft");
        const right = keysRef.current.has("d") || keysRef.current.has("arrowright");
        s.pvx = left ? -4.5 : right ? 4.5 : 0;
        if (right) s.facing = 1;
        if (left) s.facing = -1;
      }
      s.px += s.pvx; s.py += s.pvy;
      s.px = Math.max(20, Math.min(W - 20, s.px));
      if (s.py >= GROUND) { s.py = GROUND; s.pvy = 0; s.onGround = true; s.jumps = 0; }
      if (s.slashCooldown > 0) s.slashCooldown--;
      if (s.slashTimer > 0) { s.slashTimer--; if (s.slashTimer <= 0) s.slashing = false; }
      if (s.hurtFlash > 0) s.hurtFlash--;

      // Trail
      if (s.isDashing) { s.trailPositions.push({ x: s.px, y: s.py }); }
      if (s.trailPositions.length > 6) s.trailPositions.shift();

      // ── Enemy spawns ──
      s.waveTimer--;
      if (s.waveTimer <= 0) { s.wave++; spawnEnemy(); if (s.wave % 3 === 0) spawnEnemy(); s.waveTimer = Math.max(40, 90 - s.wave * 3); s.bossSpawned = false; }

      // ── Enemy logic ──
      for (const e of s.enemies) {
        if (e.dead) { e.deathTimer--; continue; }
        e.x += e.vx;
        if (e.x < -60) { e.dead = true; e.deathTimer = 0; continue; }

        e.attackTimer--;
        const playerDist = Math.abs(e.x - s.px);

        // Enemy attacks player
        if (e.attackTimer <= 0 && playerDist < 55 && !s.isDashing) {
          e.attackTimer = 50;
          if (!s.isDashing) {
            s.pHp--;
            s.hurtFlash = 20;
            setHp(Math.max(0, s.pHp));
            if (s.pHp <= 0) {
              s.running = false;
              setWon(false);
              setPhase("result");
              return;
            }
          }
        }

        // Player slashes enemy
        if (s.slashing && playerDist < 75 && Math.abs(e.y - s.py) < 80) {
          e.hp--;
          for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            s.particles.push({ x: e.x, y: e.y - 40, vx: Math.cos(angle) * 3.5, vy: Math.sin(angle) * 3.5 - 1, life: 22, color: e.isBoss ? "#ff6600" : "#8b5cf6" });
          }
          if (e.hp <= 0) {
            e.dead = true; e.deathTimer = 25;
            s.score += e.isBoss ? 10 : 2;
            setScore(s.score);
            if (s.score >= botScore) {
              s.running = false;
              setWon(true);
              addWinning(prize, "Shadow Fighter Win");
              setPhase("result");
              return;
            }
          }
        }
      }
      s.enemies = s.enemies.filter((e) => e.deathTimer !== 0 || !e.dead);

      // ── Particles ──
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; }
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const sf of s.slashFx) sf.life--;
      s.slashFx = s.slashFx.filter((sf) => sf.life > 0);

      s.bgX = (s.bgX + 1) % W;

      // ─── DRAW ───────────────────────────────────────────────────────────
      // Background
      ctx.fillStyle = "#050010";
      ctx.fillRect(0, 0, W, H);

      // Parallax city bg
      ctx.fillStyle = "rgba(40,0,60,0.8)";
      [0, 1].forEach((offset) => {
        const bx = ((-s.bgX * 0.3 + offset * W) % W + W) % W - W;
        [[20, 80, 40], [80, 110, 60], [150, 90, 35], [220, 130, 50], [300, 100, 45], [360, 115, 55]].forEach(([x, h, w]) => {
          ctx.fillRect(bx + x, GROUND - h, w, h);
        });
      });

      // Neon window dots
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 4;
      for (let i = 0; i < 20; i++) {
        const wx = (i * 97 + s.frame) % W, wy = GROUND - 20 - (i * 47) % 100;
        ctx.fillStyle = i % 3 === 0 ? "#a855f7" : i % 3 === 1 ? "#00ffff" : "#FFD700";
        ctx.fillRect(wx, wy, 3, 3);
      }
      ctx.shadowBlur = 0;

      // Ground
      ctx.fillStyle = "#1a0030";
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = "#a855f7";
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 12;
      ctx.fillRect(0, GROUND, W, 3);
      ctx.shadowBlur = 0;

      // Slash FX
      for (const sf of s.slashFx) {
        ctx.save();
        ctx.translate(sf.x, sf.y);
        ctx.rotate(sf.angle);
        ctx.globalAlpha = sf.life / 14;
        ctx.strokeStyle = "#00ffff";
        ctx.shadowColor = "#00ffff";
        ctx.shadowBlur = 20;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-sf.size, 0); ctx.lineTo(sf.size, 0); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Particles
      for (const p of s.particles) {
        ctx.globalAlpha = p.life / 22;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Enemies
      for (const e of s.enemies) drawEnemy(ctx, e);

      // Dash trail
      s.trailPositions.forEach((tp, i) => {
        ctx.globalAlpha = (i / s.trailPositions.length) * 0.4;
        ctx.fillStyle = "#a855f7";
        ctx.beginPath(); ctx.arc(tp.x, tp.y - 50, 10, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      });

      // Player
      if (s.hurtFlash % 4 < 2) {
        drawSilhouette(ctx, s.px, s.py, s.facing, s.slashing, s.isDashing);
      }

      // HUD
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.beginPath(); ctx.roundRect(6, 6, 160, 40, 8); ctx.fill();
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`Score: ${s.score} / ${botScore}`, 14, 24);
      // HP pips
      for (let i = 0; i < s.pMaxHp; i++) {
        ctx.fillStyle = i < s.pHp ? "#22c55e" : "#333";
        ctx.shadowColor = i < s.pHp ? "#22c55e" : "transparent";
        ctx.shadowBlur = i < s.pHp ? 6 : 0;
        ctx.beginPath(); ctx.arc(14 + i * 22, 37, 7, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Hurt vignette
      if (s.hurtFlash > 0) {
        ctx.fillStyle = `rgba(220,0,0,${s.hurtFlash / 40})`;
        ctx.fillRect(0, 0, W, H);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
    };
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function btnDown(k: string) { keysRef.current.add(k); }
  function btnUp(k: string) { keysRef.current.delete(k); }

  return (
    <div className="flex flex-col" style={{ background: "#050010", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">⚔️ Shadow Fighter</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(5,0,16,0.92)" }}>
              <motion.div className="text-7xl" animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>⚔️</motion.div>
              <div className="text-white font-black text-3xl">Shadow Fighter</div>
              <div className="text-zinc-400 text-sm text-center px-8">Slash {botScore} enemy points to win. Survive the darkness!</div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 px-4">
                {[["↕ / W", "Jump (×2 mid-air)"], ["A / D", "Move"], ["J / F", "Sword Slash"], ["Z / X", "Dash"]].map(([k, v]) => (
                  <div key={k} className="px-2 py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.06)" }}>{k} — {v}</div>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>
                FIGHT! ⚔️
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(5,0,16,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💀"}</div>
              <div className="text-white font-black text-3xl">{won ? "VICTORY!" : "Defeated!"}</div>
              <div className="text-zinc-400 text-sm">Score: {score} / {botScore}</div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setHp(5); setScore(0); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-white text-base"
                  style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>Play Again</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-3 gap-2" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="flex gap-2">
            <button onPointerDown={() => btnDown("a")} onPointerUp={() => btnUp("a")} onPointerCancel={() => btnUp("a")}
              className="w-12 h-12 rounded-xl text-white font-black flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", touchAction: "none" }}>◀</button>
            <button onPointerDown={() => btnDown("d")} onPointerUp={() => btnUp("d")} onPointerCancel={() => btnUp("d")}
              className="w-12 h-12 rounded-xl text-white font-black flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", touchAction: "none" }}>▶</button>
          </div>
          <div className="flex gap-2">
            <button onPointerDown={() => { const s = stateRef.current; if (s.jumps < 2) { s.pvy = -13; s.jumps++; s.onGround = false; } }}
              className="w-12 h-12 rounded-xl font-black text-sm flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(0,255,255,0.15)", border: "1px solid #00ffff", color: "#00ffff", touchAction: "none" }}>↑×2</button>
            <button onPointerDown={() => { const s = stateRef.current; if (!s.isDashing) { s.isDashing = true; s.dashTimer = 12; s.pvx = s.facing * 10; } }}
              className="w-12 h-12 rounded-xl font-black text-sm flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(168,85,247,0.2)", border: "1px solid #a855f7", color: "#a855f7", touchAction: "none" }}>DASH</button>
            <button onPointerDown={() => { const s = stateRef.current; if (!s.slashing && s.slashCooldown <= 0) { s.slashing = true; s.slashTimer = 16; s.slashCooldown = 22; s.slashFx.push({ x: s.px + s.facing * 40, y: s.py - 40, life: 14, angle: 0, size: 60 }); } }}
              className="w-12 h-12 rounded-xl font-black text-sm flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(255,215,0,0.2)", border: "1px solid #FFD700", color: "#FFD700", touchAction: "none" }}>⚔️</button>
          </div>
        </div>
      )}
    </div>
  );
}
