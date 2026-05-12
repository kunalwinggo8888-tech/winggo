/**
 * MrRacerGame — WINGGO 3D Highway Racing
 * Three.js: 3-lane road, traffic AI, nitro boost, speed blur, coin collection.
 */
import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { motion } from "framer-motion";
import { useWallet } from "@/context/useWallet";

const PLATFORM_PCT = 0.10;
type Phase = "matchmaking" | "playing" | "result";
const LANES = [-2.2, 0, 2.2];
const WIN_DIST = 800;

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
        style={{ background: "rgba(255,60,0,0.12)", border: "2px solid rgba(255,60,0,0.45)" }}
        animate={{ y: [0, -8, 0] }} transition={{ duration: 1, repeat: Infinity }}>🏎️</motion.div>
      <div className="text-center"><div className="text-white font-black text-xl">Highway Racing</div><div className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Survive {WIN_DIST}m to win!</div></div>
      <div className="flex gap-4 px-6 py-3 rounded-2xl" style={{ background: "rgba(255,60,0,0.07)", border: "1px solid rgba(255,60,0,0.3)" }}>
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(255,215,0,0.55)" }}>ENTRY</div><div className="text-xl font-black" style={{ color: "#FFD700" }}>₹{fee}</div></div>
        <div className="h-8 w-px self-center" style={{ background: "rgba(255,255,255,0.12)" }} />
        <div className="text-center"><div className="text-[10px] font-bold" style={{ color: "rgba(34,197,94,0.6)" }}>WIN UP TO</div><div className="text-xl font-black" style={{ color: "#22c55e" }}>₹{prize}</div></div>
      </div>
      <div className="text-xs font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>⏳ Starting in {cd}s...</div>
    </div>
  );
}

interface Props { onBack: () => void; initialFee?: number }

export default function MrRacerGame({ onBack, initialFee = 10 }: Props) {
  const { total, addWinning } = useWallet();
  const [phase, setPhase] = useState<Phase>("matchmaking");
  const [distNum, setDistNum] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [won, setWon] = useState(false);
  const [nearMiss, setNearMiss] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const laneRef = useRef(1);
  const distRef = useRef(0);
  const aliveRef = useRef(true);
  const phaseRef = useRef<Phase>("playing");
  phaseRef.current = phase;
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  useEffect(() => {
    if (phase !== "playing" || !mountRef.current) return;
    const mount = mountRef.current;
    const W = mount.clientWidth || 360, H = mount.clientHeight || 460;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a18);
    scene.fog = new THREE.Fog(0x0a0a18, 18, 38);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.set(0, 3.5, 8);
    camera.lookAt(0, 0, -10);

    scene.add(new THREE.AmbientLight(0x334466, 1));
    const headlight = new THREE.SpotLight(0xffffff, 2, 40, 0.4);
    headlight.position.set(0, 4, 5);
    headlight.target.position.set(0, 0, -5);
    scene.add(headlight, headlight.target);
    const neon1 = new THREE.PointLight(0xff3300, 2, 8); neon1.position.set(-3, 1, 2);
    const neon2 = new THREE.PointLight(0x0088ff, 2, 8); neon2.position.set(3, 1, 2);
    scene.add(neon1, neon2);

    // Road segments (tiles)
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x222233 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const roadTiles: THREE.Group[] = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      const road = new THREE.Mesh(new THREE.PlaneGeometry(8, 20), roadMat);
      road.rotation.x = -Math.PI / 2;
      g.add(road);
      // Lane lines
      for (let l = -1; l <= 1; l++) {
        for (let j = 0; j < 4; j++) {
          const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.5), lineMat);
          line.rotation.x = -Math.PI / 2;
          line.position.set(l * 2.2, 0.01, -6 + j * 5);
          g.add(line);
        }
      }
      g.position.z = -i * 20;
      scene.add(g);
      roadTiles.push(g);
    }

    // Player car (gold sports car)
    const carGroup = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.8), bodyMat);
    body.position.y = 0.4;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 1.5), new THREE.MeshLambertMaterial({ color: 0xcc9900 }));
    roof.position.set(0, 0.88, -0.2);
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    [[0.8, 0.2, -0.9], [-0.8, 0.2, -0.9], [0.8, 0.2, 0.9], [-0.8, 0.2, 0.9]].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(x, y, z);
      carGroup.add(w);
    });
    carGroup.add(body, roof);
    carGroup.position.set(LANES[1], 0, 4);
    scene.add(carGroup);

    // Traffic cars
    interface Traffic { mesh: THREE.Group; lane: number; z: number; speed: number }
    const traffic: Traffic[] = [];
    const trafficColors = [0xff2200, 0x0055ff, 0x00cc44, 0xff8800, 0xcc00cc];

    function spawnTraffic() {
      const lane = Math.floor(Math.random() * 3);
      const g = new THREE.Group();
      const col = trafficColors[Math.floor(Math.random() * trafficColors.length)];
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 2.5), new THREE.MeshLambertMaterial({ color: col }));
      b.position.y = 0.45;
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.38, 1.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
      r.position.set(0, 0.84, 0);
      g.add(b, r);
      g.position.set(LANES[lane], 0, -45);
      scene.add(g);
      traffic.push({ mesh: g, lane, z: -45, speed: 0.12 + Math.random() * 0.06 });
    }

    // Game state
    let gameSpeed = 0.15;
    let dist = 0;
    let alive = true;
    let spawnTimer = 0;
    let wheelAngle = 0;
    let nitro = false;
    const targetLane = { val: 1 };
    laneRef.current = 1;
    distRef.current = 0;
    aliveRef.current = true;

    let animId: number;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      if (!alive) { renderer.render(scene, camera); return; }
      const dt = Math.min(clock.getDelta(), 0.05);
      const curSpeed = nitro ? gameSpeed * 1.6 : gameSpeed;

      // Advance distance
      dist += curSpeed * 60 * dt;
      distRef.current = dist;
      setDistNum(Math.floor(dist));

      // Road scrolling
      roadTiles.forEach(t => {
        t.position.z += curSpeed * 60 * dt * 0.18;
        if (t.position.z > 30) t.position.z -= 160;
      });

      // Move player car toward target lane
      const targetX = LANES[targetLane.val];
      carGroup.position.x += (targetX - carGroup.position.x) * 0.12;

      // Wheel spin
      wheelAngle += curSpeed * 3;
      carGroup.children.forEach((c, i) => { if (i < 4) c.rotation.x = -wheelAngle; });

      // Update speed display
      setSpeed(Math.floor(curSpeed * 400));

      // Traffic
      spawnTimer += dt;
      if (spawnTimer > 0.9 - gameSpeed * 0.5) { spawnTraffic(); spawnTimer = 0; }

      let nm = false;
      for (let i = traffic.length - 1; i >= 0; i--) {
        const t = traffic[i];
        t.z += curSpeed * 60 * dt * 0.18 + t.speed;
        t.mesh.position.z = t.z;

        if (t.z > 10) { scene.remove(t.mesh); traffic.splice(i, 1); continue; }

        // Collision / near-miss
        const dx = Math.abs(carGroup.position.x - t.mesh.position.x);
        const dz = Math.abs(carGroup.position.z - t.z);
        if (dx < 1.3 && dz < 2.5) {
          alive = false; aliveRef.current = false;
          setWon(false); setPhase("result");
          return;
        }
        if (dx < 2.8 && dz < 4) nm = true;
      }
      setNearMiss(nm);

      // Speed increase
      gameSpeed = Math.min(0.5, 0.15 + dist / 3000);

      // Win check
      if (dist >= WIN_DIST) {
        alive = false; aliveRef.current = false;
        setWon(true); addWinning(prize, `🏎️ Mr. Racer — Won ₹${prize}`); setPhase("result");
      }

      // Camera wobble
      camera.position.x = carGroup.position.x * 0.2;

      renderer.render(scene, camera);
    }
    animate();

    // Controls: touch swipe / button
    const leftBtn = document.getElementById("racer-left");
    const rightBtn = document.getElementById("racer-right");
    const nitroBtn = document.getElementById("racer-nitro");

    const goLeft = () => { if (targetLane.val > 0) { targetLane.val--; laneRef.current = targetLane.val; } };
    const goRight = () => { if (targetLane.val < 2) { targetLane.val++; laneRef.current = targetLane.val; } };
    const goNitro = () => { nitro = true; setTimeout(() => { nitro = false; }, 2000); };

    leftBtn?.addEventListener("click", goLeft);
    rightBtn?.addEventListener("click", goRight);
    nitroBtn?.addEventListener("click", goNitro);

    // Swipe detection
    let touchStartX = 0;
    const onTouchStart = (e: TouchEvent) => { touchStartX = e.touches[0].clientX; };
    const onTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (dx < -40) goLeft(); else if (dx > 40) goRight();
    };
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    renderer.domElement.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      leftBtn?.removeEventListener("click", goLeft);
      rightBtn?.removeEventListener("click", goRight);
      nitroBtn?.removeEventListener("click", goNitro);
      renderer.domElement.removeEventListener("touchstart", onTouchStart);
      renderer.domElement.removeEventListener("touchend", onTouchEnd);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [phase, prize, addWinning]);

  function handleRematch() {
    distRef.current = 0; laneRef.current = 1; aliveRef.current = true;
    setDistNum(0); setSpeed(0); setWon(false); setNearMiss(false); setPhase("matchmaking");
  }

  const hdrStyle = { background: "rgba(7,6,14,0.94)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#0a0a18", maxWidth: 480, margin: "0 auto" }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3" style={hdrStyle}>
        <button onClick={onBack} className="flex items-center gap-1.5 cursor-pointer" style={{ color: "rgba(255,255,255,0.55)" }}>
          <span className="text-lg">←</span><span className="text-sm font-bold">Games</span>
        </button>
        <div className="flex items-center gap-2"><span className="text-xl">🏎️</span><span className="font-black text-white text-base">Mr. Racer 3D</span></div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,60,0,0.1)", border: "1px solid rgba(255,60,0,0.3)" }}>
          <span className="text-xs">💰</span><span className="text-sm font-black" style={{ color: "#FFD700" }}>₹{total.toFixed(0)}</span>
        </div>
      </div>

      {phase === "matchmaking" && <MM fee={initialFee} onStart={() => { distRef.current = 0; laneRef.current = 1; aliveRef.current = true; setDistNum(0); setSpeed(0); setWon(false); setPhase("playing"); }} />}

      {phase === "playing" && (
        <div className="flex-1 flex flex-col relative">
          {/* HUD */}
          <div className="flex items-center justify-between px-3 py-2 absolute top-0 left-0 right-0 z-10" style={{ background: "rgba(0,0,0,0.55)" }}>
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(255,165,0,0.7)" }}>SPEED</div><div className="text-base font-black" style={{ color: "#ff6600" }}>{speed} km/h</div></div>
            {nearMiss && <div className="text-sm font-black" style={{ color: "#FFD700", textShadow: "0 0 10px #FFD700" }}>⚡ NEAR MISS!</div>}
            <div className="text-center"><div className="text-[9px] font-bold" style={{ color: "rgba(34,197,94,0.7)" }}>DIST</div><div className="text-base font-black" style={{ color: "#22c55e" }}>{distNum}m</div></div>
          </div>
          {/* Progress bar */}
          <div className="absolute top-10 left-0 right-0 px-3 z-10">
            <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
              <div className="h-1 rounded-full" style={{ background: "linear-gradient(90deg,#ff6600,#FFD700)", width: `${Math.min(100, (distNum / WIN_DIST) * 100)}%`, transition: "width 0.3s" }} />
            </div>
          </div>
          {/* Canvas */}
          <div ref={mountRef} className="flex-1" style={{ touchAction: "none" }} />
          {/* Controls */}
          <div className="flex items-center justify-between px-4 py-3 gap-3" style={{ background: "rgba(0,0,0,0.7)" }}>
            <button id="racer-left" className="flex-1 py-4 rounded-2xl font-black text-2xl cursor-pointer active:scale-95" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}>◀</button>
            <button id="racer-nitro" className="flex-none px-6 py-4 rounded-2xl font-black text-sm cursor-pointer active:scale-95" style={{ background: "linear-gradient(135deg,#ff3300,#ff8800)", color: "#fff", boxShadow: "0 0 20px rgba(255,100,0,0.5)" }}>⚡ NITRO</button>
            <button id="racer-right" className="flex-1 py-4 rounded-2xl font-black text-2xl cursor-pointer active:scale-95" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "white" }}>▶</button>
          </div>
        </div>
      )}

      {phase === "result" && (
        <motion.div className="flex-1 flex flex-col items-center justify-center gap-5 px-5 py-8" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
          <div className="w-32 h-32 rounded-full flex items-center justify-center text-6xl"
            style={{ background: won ? "rgba(255,215,0,0.15)" : "rgba(239,68,68,0.1)", border: `3px solid ${won ? "rgba(255,215,0,0.5)" : "rgba(239,68,68,0.4)"}`, boxShadow: won ? "0 0 60px rgba(255,215,0,0.4)" : "0 0 40px rgba(239,68,68,0.3)" }}>
            {won ? "🏆" : "💥"}
          </div>
          <div className="text-center">
            <div className="font-black text-3xl" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? "Champion Driver! 🎉" : "Crashed!"}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Distance: {distNum}m / {WIN_DIST}m</div>
          </div>
          <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-4" style={{ background: won ? "rgba(255,215,0,0.06)" : "rgba(239,68,68,0.05)" }}>
              <span className="text-base font-black text-white">{won ? "Winnings" : "You Lost"}</span>
              <span className="text-xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>{won ? `+₹${prize}` : `-₹${initialFee}`}</span>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={handleRematch}
            className="w-full py-4 rounded-2xl font-black text-base cursor-pointer"
            style={{ background: "linear-gradient(135deg,#ff3300,#ff8800)", color: "#fff", boxShadow: "0 0 28px rgba(255,80,0,0.5)" }}>
            🏎️ Race Again
          </motion.button>
          <button onClick={onBack} className="text-sm font-bold cursor-pointer" style={{ color: "rgba(255,255,255,0.3)" }}>← Back to Games</button>
        </motion.div>
      )}
    </div>
  );
}
