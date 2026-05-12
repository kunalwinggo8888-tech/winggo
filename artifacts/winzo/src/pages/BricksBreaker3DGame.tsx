/**
 * BricksBreaker3DGame — WINGGO Neon 3D Brick Breaker
 * Three.js: glowing neon bricks, metallic paddle, ball reflection physics, particle explosions.
 */
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const COLS = 8, ROWS = 5;
const BW = 1.6, BH = 0.55, BZ = 0.45;

function MM({ fee, onStart }: { fee: number; onStart: () => void }) {
  const [cd, setCd] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCd(c => { if (c <= 1) { clearInterval(t); setTimeout(onStart, 200); return 0; } return c - 1; }), 900);
    return () => clearInterval(t);
  }, [onStart]);
  const prize = Math.floor(fee * 2 * (1 - PLATFORM_PCT));
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-5">
      <motion.div className="w-28 h-28 rounded-full flex items-center justify-center text-6xl"
        style={{ background: "rgba(0,229,255,0.12)", border: "2px solid rgba(0,229,255,0.45)" }}
        animate={{ scale: [1, 1.06, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>🧱</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Neon Brick Breaker</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Break all bricks to win!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(0,229,255,0.07)", border: "1px solid rgba(0,229,255,0.25)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(0,229,255,0.8)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function BricksBreaker3DGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [won, setWon] = useState(false);
  const [bricksLeft, setBricksLeft] = useState(COLS * ROWS);
  const mountRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const paddleXRef = useRef(0);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
  const NEON_COLORS = [0xff00ff, 0x00e5ff, 0xff6600, 0x00ff87, 0xFFD700];

  useEffect(() => {
    if (phase !== "playing" || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth || 360, H = mount.clientHeight || 440;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04000e);

    // Orthographic camera looking at the play field
    const aspect = W / H;
    const viewH = 14, viewW = viewH * aspect;
    const camera = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 100);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);

    // Ambient + point lights
    scene.add(new THREE.AmbientLight(0x111133, 1));
    const pl1 = new THREE.PointLight(0x00e5ff, 2, 20); pl1.position.set(-5, 5, 5);
    const pl2 = new THREE.PointLight(0xff00ff, 2, 20); pl2.position.set(5, -3, 5);
    scene.add(pl1, pl2);

    // Bricks
    const brickMeshes: (THREE.Mesh | null)[] = [];
    const brickParticles: { m: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
    const startX = -(COLS * BW) / 2 + BW / 2;
    const startY = viewH / 2 - 1.5;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const col = NEON_COLORS[r % NEON_COLORS.length];
        const mat = new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: 0.5,
          metalness: 0.6, roughness: 0.2,
        });
        const geo = new THREE.BoxGeometry(BW - 0.12, BH - 0.08, BZ);
        const m = new THREE.Mesh(geo, mat);
        m.position.set(startX + c * BW, startY - r * (BH + 0.1), 0);
        scene.add(m);
        brickMeshes.push(m);
      }
    }

    // Paddle
    const paddleMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.05, emissive: 0x334444, emissiveIntensity: 0.4 });
    const paddle = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.38, 0.5), paddleMat);
    paddle.position.set(0, -viewH / 2 + 0.8, 0);
    scene.add(paddle);

    // Ball
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.8, metalness: 0.5, roughness: 0.1 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), ballMat);
    ball.position.set(0, -viewH / 2 + 1.8, 0);
    scene.add(ball);

    const ballLight = new THREE.PointLight(0x00e5ff, 1.5, 4);
    scene.add(ballLight);

    // Ball velocity
    let bvx = 0.09, bvy = 0.14;
    let ballStarted = false;
    let bricksRemaining = COLS * ROWS;
    let alive = true;

    function spawnExplosion(x: number, y: number, color: number) {
      for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), new THREE.MeshBasicMaterial({ color }));
        m.position.set(x, y, 0);
        const vel = new THREE.Vector3((Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.05);
        scene.add(m);
        brickParticles.push({ m, vel, life: 1 });
      }
    }

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      if (!alive) { renderer.render(scene, camera); return; }

      // Move paddle
      const targetPX = paddleXRef.current;
      paddle.position.x += (targetPX - paddle.position.x) * 0.18;
      paddle.position.x = Math.max(-viewW / 2 + 1.3, Math.min(viewW / 2 - 1.3, paddle.position.x));

      if (!ballStarted) {
        ball.position.x = paddle.position.x;
        ballLight.position.copy(ball.position);
        renderer.render(scene, camera); return;
      }

      // Move ball
      ball.position.x += bvx;
      ball.position.y += bvy;
      ballLight.position.copy(ball.position);

      // Wall bounces
      if (ball.position.x <= -viewW / 2 + 0.3) { bvx = Math.abs(bvx); }
      if (ball.position.x >= viewW / 2 - 0.3) { bvx = -Math.abs(bvx); }
      if (ball.position.y >= viewH / 2 - 0.3) { bvy = -Math.abs(bvy); }

      // Paddle bounce
      const px = paddle.position.x, py = paddle.position.y;
      if (ball.position.y >= py - 0.35 && ball.position.y <= py + 0.35 && Math.abs(ball.position.x - px) <= 1.4) {
        bvy = Math.abs(bvy);
        bvx += (ball.position.x - px) * 0.04;
      }

      // Bottom = lose life
      if (ball.position.y < -viewH / 2 - 0.5) {
        livesRef.current--;
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          alive = false; setWon(false); setPhase("result"); return;
        }
        ball.position.set(paddle.position.x, -viewH / 2 + 1.8, 0);
        bvx = 0.09; bvy = 0.14; ballStarted = false;
      }

      // Brick collision
      for (let i = 0; i < brickMeshes.length; i++) {
        const b = brickMeshes[i];
        if (!b) continue;
        const dx = Math.abs(ball.position.x - b.position.x);
        const dy = Math.abs(ball.position.y - b.position.y);
        if (dx < BW / 2 + 0.3 && dy < BH / 2 + 0.3) {
          spawnExplosion(b.position.x, b.position.y, (b.material as THREE.MeshStandardMaterial).color.getHex());
          scene.remove(b); brickMeshes[i] = null;
          if (dy > dx) bvy = -bvy; else bvx = -bvx;
          scoreRef.current += 10;
          setScore(scoreRef.current);
          bricksRemaining--;
          setBricksLeft(bricksRemaining);
          if (bricksRemaining <= 0) {
            alive = false; setWon(true); addWinning(prize, `🧱 Bricks Breaker — Won ₹${prize}`); setPhase("result");
            return;
          }
        }
      }

      // Particles
      for (let i = brickParticles.length - 1; i >= 0; i--) {
        const p = brickParticles[i];
        p.m.position.add(p.vel);
        p.life -= 0.03;
        if (p.life <= 0) { scene.remove(p.m); brickParticles.splice(i, 1); }
      }

      renderer.render(scene, camera);
    }
    animate();

    // Pointer tracking
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const relX = (clientX - rect.left) / rect.width;
      paddleXRef.current = (relX - 0.5) * viewW;
    };
    const onTap = () => { ballStarted = true; };

    renderer.domElement.addEventListener("mousemove", onPointerMove as (e: Event) => void);
    renderer.domElement.addEventListener("touchmove", onPointerMove as (e: Event) => void, { passive: true });
    renderer.domElement.addEventListener("click", onTap);
    renderer.domElement.addEventListener("touchstart", onTap, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("mousemove", onPointerMove as (e: Event) => void);
      renderer.domElement.removeEventListener("touchmove", onPointerMove as (e: Event) => void);
      renderer.domElement.removeEventListener("click", onTap);
      renderer.domElement.removeEventListener("touchstart", onTap);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() {
    scoreRef.current = 0; livesRef.current = 3; paddleXRef.current = 0;
    setScore(0); setLives(3); setWon(false); setBricksLeft(COLS * ROWS); setPhase("matchmaking");
  }

  const hdrStyle = { background: "rgba(4,0,14,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(0,229,255,0.15)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#04000e", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🧱</span><span className="font-black text-white text-base">Bricks Breaker 3D</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.25)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase === "matchmaking" && <MM fee={initialFee} onStart={() => { scoreRef.current = 0; livesRef.current = 3; paddleXRef.current = 0; setScore(0); setLives(3); setWon(false); setBricksLeft(COLS * ROWS); setPhase("playing"); }} />}

      {phase === "playing" && (
        <div className="flex-1 flex flex-col relative">
          <div className="flex items-center justify-between px-3 py-2 absolute top-0 left-0 right-0 z-10" style={{ background: "rgba(4,0,14,0.75)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(0,229,255,0.7)" }}>SCORE</div><div className="text-base font-black" style={{ color: "#00e5ff" }}>{score}</div></div>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,0,255,0.7)" }}>BRICKS</div><div className="text-base font-black" style={{ color: "#ff00ff" }}>{bricksLeft}</div></div>
            <div className="flex gap-1">{Array.from({ length: 3 }, (_, i) => <span key={i} style={{ opacity: i < lives ? 1 : 0.2, fontSize: 14 }}>❤️</span>)}</div>
          </div>
          <div ref={mountRef} className="flex-1" style={{ touchAction: "none" }} />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
            <div className="px-4 py-1.5 rounded-xl text-xs font-bold" style={{ background: "rgba(4,0,14,0.8)", color: "rgba(0,229,255,0.6)" }}>Move mouse/finger to control paddle · Tap to launch</div>
          </div>
        </div>
      )}

      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(0,229,255,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(0,229,255,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(0,229,255,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💔"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#00e5ff" : "#ef4444" }}>{won ? "All Bricks Cleared! 🎉" : "Game Over!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Score: {score}</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(0,229,255,0.2)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(0,229,255,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#00e5ff" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{ background: "linear-gradient(135deg,#00e5ff,#0077aa)", color: "#000", boxShadow: "0 0 28px rgba(0,229,255,0.5)" }}>
            🧱 Play Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
