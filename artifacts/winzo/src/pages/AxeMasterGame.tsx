/**
 * AxeMasterGame — WINGGO 3D Axe Throwing
 * Three.js: rotating bullseye target, spinning axe, particle splinters, camera shake.
 */
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";

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
        style={{ background: "rgba(139,90,43,0.15)", border: "2px solid rgba(139,90,43,0.5)" }}
        animate={{ rotate: [0, -15, 15, 0], scale: [1, 1.05, 1] }} transition={{ duration: 1.6, repeat: Infinity }}>🪓</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Axe Throwing Arena</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Hit the bullseye to win!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,215,0,0.07)", border: "1px solid rgba(255,215,0,0.25)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function AxeMasterGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [score, setScore] = useState(0);
  const [throwsLeft, setThrowsLeft] = useState(5);
  const [hitMsg, setHitMsg] = useState("");
  const [won, setWon] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef(0);
  const throwsRef = useRef(5);
  const canThrowRef = useRef(true);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));
  const WIN_SCORE = 250;

  useEffect(() => {
    if (phase !== "playing" || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth || 360, H = mount.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1a0d);
    scene.fog = new THREE.Fog(0x0d1a0d, 12, 22);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 1.8, 4.5);
    camera.lookAt(0, 0.5, -6);

    // Lights
    scene.add(new THREE.AmbientLight(0x334433, 1));
    const sun = new THREE.DirectionalLight(0xfff0cc, 1.5);
    sun.position.set(3, 8, 2); sun.castShadow = true;
    scene.add(sun);
    const goldPt = new THREE.PointLight(0xFFD700, 3, 10);
    goldPt.position.set(0, 2, -5);
    scene.add(goldPt);

    // Ground
    const gnd = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x1a2e1a }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -2; gnd.receiveShadow = true;
    scene.add(gnd);

    // Trees (simple)
    const treeMat = new THREE.MeshLambertMaterial({ color: 0x1a4a1a });
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3d2b1a });
    for (let i = 0; i < 8; i++) {
      const x = (Math.random() - 0.5) * 16 + (Math.random() > 0.5 ? 5 : -5);
      const z = -Math.random() * 12 - 2;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2), trunkMat);
      trunk.position.y = -1;
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.5, 7), treeMat);
      leaves.position.y = 1.2;
      tree.add(trunk, leaves);
      tree.position.set(x, 0, z);
      scene.add(tree);
    }

    // Target pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.5), trunkMat);
    pole.position.set(0, 0.3, -9);
    scene.add(pole);

    // Target rings
    const targetGroup = new THREE.Group();
    const ringColors = [0x1a1a1a, 0x0044bb, 0xcc2200, 0xeeeeee, 0xFFD700];
    const ringRadii = [2.0, 1.55, 1.1, 0.65, 0.28];
    ringColors.forEach((c, i) => {
      const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(ringRadii[i], ringRadii[i], 0.18, 28),
        new THREE.MeshLambertMaterial({ color: c })
      );
      ring.position.z = i * 0.01;
      targetGroup.add(ring);
    });
    targetGroup.rotation.x = Math.PI / 2;
    targetGroup.position.set(0, 1.2, -9);
    scene.add(targetGroup);

    // Axe group
    const axeGroup = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, metalness: 0.95, roughness: 0.05 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.07), bladeMat);
    axeGroup.add(blade);
    const handleMat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.3), handleMat);
    handle.position.y = -0.95;
    axeGroup.add(handle);
    axeGroup.position.set(0, 1.2, 2.5);
    axeGroup.castShadow = true;
    scene.add(axeGroup);

    // Particles array
    const particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];

    function spawnParticles(color: number) {
      for (let i = 0; i < 14; i++) {
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, 0.07, 0.12),
          new THREE.MeshBasicMaterial({ color })
        );
        m.position.set(0, 1.2, -9);
        const vel = new THREE.Vector3(
          (Math.random() - 0.5) * 0.1,
          Math.random() * 0.08 + 0.02,
          (Math.random() - 0.5) * 0.06
        );
        scene.add(m);
        particles.push({ mesh: m, vel, life: 1 });
      }
    }

    // Axe physics state
    let flying = false;
    let rotDir = Math.random() > 0.5 ? 1 : -1;
    let camShake = 0;

    function throwAxe() {
      if (!canThrowRef.current || throwsRef.current <= 0) return;
      canThrowRef.current = false;
      flying = true;
      rotDir = Math.random() > 0.5 ? 1 : -1;
      axeGroup.position.set(0, 1.2, 2.5);
      axeGroup.rotation.x = 0;
    }

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);

      // Target spin
      targetGroup.rotation.z += 0.012;

      // Axe flight
      if (flying) {
        axeGroup.position.z -= 0.19;
        axeGroup.rotation.x += rotDir * 0.16;

        if (axeGroup.position.z <= -8.8) {
          flying = false;
          // Calc accuracy
          const dx = axeGroup.position.x;
          const dy = axeGroup.position.y - 1.2;
          const dist = Math.sqrt(dx * dx + dy * dy);
          let pts = 0, msg = "";
          if (dist < 0.3) { pts = 100; msg = "🎯 BULLSEYE! +100"; spawnParticles(0xFFD700); }
          else if (dist < 0.7) { pts = 70; msg = "⭐ Inner Ring! +70"; spawnParticles(0xffffff); }
          else if (dist < 1.1) { pts = 50; msg = "✅ Middle! +50"; spawnParticles(0xcc2200); }
          else if (dist < 1.6) { pts = 30; msg = "👍 Outer! +30"; spawnParticles(0x0044bb); }
          else { pts = 10; msg = "😅 Edge! +10"; spawnParticles(0x3d2b1a); }

          scoreRef.current += pts;
          setScore(scoreRef.current);
          setHitMsg(msg);
          camShake = 0.25;

          throwsRef.current -= 1;
          setThrowsLeft(throwsRef.current);

          setTimeout(() => {
            axeGroup.position.set(0, 1.2, 2.5);
            axeGroup.rotation.x = 0;
            if (throwsRef.current <= 0) {
              const w = scoreRef.current >= WIN_SCORE;
              setWon(w);
              if (w) addWinning(prize, `🪓 Axe Master — Won ₹${prize}`);
              setPhase("result");
            } else {
              canThrowRef.current = true;
            }
          }, 700);
        }
      }

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.vel);
        p.vel.y -= 0.004;
        p.life -= 0.025;
        if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
      }

      // Camera shake
      if (camShake > 0.005) {
        camera.position.x = (Math.random() - 0.5) * camShake;
        camera.position.y = 1.8 + (Math.random() - 0.5) * camShake;
        camShake *= 0.82;
      } else {
        camera.position.x = 0; camera.position.y = 1.8; camShake = 0;
      }

      renderer.render(scene, camera);
    }
    animate();

    const onClick = () => throwAxe();
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("touchstart", onClick, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      renderer.domElement.removeEventListener("click", onClick);
      renderer.domElement.removeEventListener("touchstart", onClick);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() {
    scoreRef.current = 0; throwsRef.current = 5; canThrowRef.current = true;
    setScore(0); setThrowsLeft(5); setHitMsg(""); setWon(false); setPhase("matchmaking");
  }

  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0d1a0d", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🪓</span><span className="font-black text-white text-base">Axe Master 3D</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.22)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase === "matchmaking" && <MM fee={initialFee} onStart={() => { scoreRef.current = 0; throwsRef.current = 5; canThrowRef.current = true; setScore(0); setThrowsLeft(5); setPhase("playing"); }} />}

      {phase === "playing" && (
        <div className="flex-1 flex flex-col" style={{ position: "relative" }}>
          {/* HUD */}
          <div className="flex items-center justify-between px-3 py-2" style={{ background: "rgba(0,0,0,0.6)", position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
            <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.6)" }}>SCORE</div><div className="text-lg font-black" style={{ color: "#FFD700" }}>{score}</div></div>
            <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>TARGET</div><div className="text-sm font-bold" style={{ color: score >= WIN_SCORE ? "#22c55e" : "rgba(255,255,255,0.5)" }}>{score}/{WIN_SCORE}</div></div>
            <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,165,0,0.6)" }}>AXES LEFT</div><div className="text-lg font-black text-white">{throwsLeft}</div></div>
          </div>
          {/* Hit message */}
          <AnimatePresence>
            {hitMsg && <motion.div key={hitMsg + score} initial={{ opacity: 0, y: -20, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30 }}
              className="absolute z-20 left-0 right-0 flex justify-center" style={{ top: 56 }}>
              <div className="px-4 py-1.5 rounded-xl text-sm font-black" style={{ background: "rgba(0,0,0,0.75)", color: "#FFD700" }}>{hitMsg}</div>
            </motion.div>}
          </AnimatePresence>
          {/* Three.js canvas mount */}
          <div ref={mountRef} className="flex-1" style={{ touchAction: "none" }} />
          {/* Throw instruction */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <div className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.6)" }}>🪓 Tap screen to throw axe</div>
          </div>
        </div>
      )}

      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(255,215,0,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(255,215,0,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(255,215,0,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "🪓"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? "Bullseye Champion! 🎉" : "Try Again!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Final score: {score} / {WIN_SCORE} to win</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(255,215,0,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{ background: "linear-gradient(135deg,#8B4513,#5c3d1e)", color: "#fff", boxShadow: "0 0 28px rgba(139,69,19,0.5)" }}>
            🪓 Throw Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
