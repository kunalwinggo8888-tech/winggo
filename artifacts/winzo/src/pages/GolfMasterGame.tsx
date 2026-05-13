/**
 * Golf Master 3D — WINGGO
 * Three.js top-down mini golf. Drag to set direction & power. Wind system.
 * 5 holes, fewer strokes than bot = win.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 480;
const TOTAL_HOLES = 5;

interface HoleData {
  ballStart: [number, number]; holePt: [number, number];
  obstacles: { x: number; z: number; r: number; color: number }[];
  par: number;
}

const HOLES: HoleData[] = [
  { ballStart: [-3, 3], holePt: [3, -3], obstacles: [], par: 3 },
  { ballStart: [-3, 3], holePt: [3, -3], obstacles: [{ x: 0, z: 0, r: 0.5, color: 0x3b82f6 }], par: 3 },
  { ballStart: [-3.5, 3.5], holePt: [3.5, -3.5], obstacles: [{ x: 0, z: 1, r: 0.4, color: 0x3b82f6 }, { x: 1, z: -1, r: 0.35, color: 0xa855f7 }], par: 4 },
  { ballStart: [-4, 2], holePt: [4, -2], obstacles: [{ x: -1, z: 0, r: 0.5, color: 0x3b82f6 }, { x: 1.5, z: -1, r: 0.45, color: 0xa855f7 }, { x: 0, z: -2, r: 0.3, color: 0x3b82f6 }], par: 4 },
  { ballStart: [-4, 4], holePt: [4, -4], obstacles: [{ x: 0, z: 0, r: 0.6, color: 0x3b82f6 }, { x: -2, z: -2, r: 0.4, color: 0xa855f7 }, { x: 2, z: 2, r: 0.4, color: 0x3b82f6 }, { x: 0, z: -3, r: 0.35, color: 0xff6600 }], par: 5 },
];

function getBotStrokes(hole: HoleData, difficulty: ReturnType<typeof getBotDifficulty>): number {
  const base = hole.par;
  if (difficulty.level === "God Mode") return base - 1;
  if (difficulty.level === "Pro") return base;
  return base + 1 + Math.floor(Math.random() * 2);
}

export default function GolfMasterGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const sceneRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.OrthographicCamera | null;
    renderer: THREE.WebGLRenderer | null;
    ball: THREE.Mesh | null;
    holeMarker: THREE.Mesh | null;
    ballVx: number; ballVz: number;
    rolling: boolean;
    currentHole: HoleData | null;
    wind: { x: number; z: number };
    obstacles: THREE.Mesh[];
    trailMeshes: THREE.Mesh[];
  }>({ scene: null, camera: null, renderer: null, ball: null, holeMarker: null, ballVx: 0, ballVz: 0, rolling: false, currentHole: null, wind: { x: 0, z: 0 }, obstacles: [], trailMeshes: [] });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [holeIdx, setHoleIdx] = useState(0);
  const [strokes, setStrokes] = useState(0);
  const [botStrokes, setBotStrokes] = useState(0);
  const [won, setWon] = useState(false);
  const [wind, setWind] = useState({ x: 0, z: 0 });
  const [holeStrokes, setHoleStrokes] = useState(0);
  const [isRolling, setIsRolling] = useState(false);
  const [aiming, setAiming] = useState<{ startX: number; startY: number; active: boolean } | null>(null);
  const [aimVector, setAimVector] = useState<{ dx: number; dy: number } | null>(null);
  const [showHoleComplete, setShowHoleComplete] = useState(false);
  const [totalBotStrokes, setTotalBotStrokes] = useState(0);

  const buildHole = useCallback((hIdx: number, renderer: THREE.WebGLRenderer) => {
    const s = sceneRef.current;
    const hole = HOLES[hIdx];
    s.currentHole = hole;

    // Clear old
    if (s.scene) {
      s.obstacles.forEach((o) => s.scene!.remove(o));
      s.trailMeshes.forEach((t) => s.scene!.remove(t));
    }
    s.obstacles = [];
    s.trailMeshes = [];

    const scene = s.scene!;
    const w = new THREE.Vector2(Math.random() * 0.04 - 0.02, Math.random() * 0.04 - 0.02);
    s.wind = { x: w.x, z: w.y };
    setWind({ x: parseFloat(w.x.toFixed(2)), z: parseFloat(w.y.toFixed(2)) });

    // Ball
    if (s.ball) scene.remove(s.ball);
    const ballGeo = new THREE.SphereGeometry(0.22, 16, 16);
    const ballMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3, shininess: 120 });
    s.ball = new THREE.Mesh(ballGeo, ballMat);
    s.ball.position.set(hole.ballStart[0], 0.22, hole.ballStart[1]);
    s.ball.castShadow = true;
    scene.add(s.ball);
    s.ballVx = 0; s.ballVz = 0; s.rolling = false;

    // Hole marker
    if (s.holeMarker) scene.remove(s.holeMarker);
    const holeGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.05, 20);
    const holeMat = new THREE.MeshPhongMaterial({ color: 0x111111, emissive: 0x333333, emissiveIntensity: 0.5 });
    s.holeMarker = new THREE.Mesh(holeGeo, holeMat);
    s.holeMarker.position.set(hole.holePt[0], 0.01, hole.holePt[1]);
    scene.add(s.holeMarker);
    // Flag
    const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), new THREE.MeshPhongMaterial({ color: 0x888888 }));
    flagPole.position.set(hole.holePt[0], 0.62, hole.holePt[1]);
    scene.add(flagPole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35), new THREE.MeshPhongMaterial({ color: 0xff0000, side: THREE.DoubleSide }));
    flag.position.set(hole.holePt[0] + 0.28, 1.12, hole.holePt[1]);
    scene.add(flag);

    // Obstacles (water hazards)
    for (const ob of hole.obstacles) {
      const obGeo = new THREE.CylinderGeometry(ob.r, ob.r, 0.12, 20);
      const obMat = new THREE.MeshPhongMaterial({ color: ob.color, emissive: ob.color, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
      const obMesh = new THREE.Mesh(obGeo, obMat);
      obMesh.position.set(ob.x, 0.06, ob.z);
      scene.add(obMesh);
      s.obstacles.push(obMesh);
    }

    setHoleStrokes(0);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1b0a);
    scene.fog = new THREE.Fog(0x0d1b0a, 15, 30);

    const CAM_SIZE = 6;
    const camera = new THREE.OrthographicCamera(-CAM_SIZE, CAM_SIZE, CAM_SIZE * (H / W), -CAM_SIZE * (H / W), 0.1, 50);
    camera.position.set(0, 14, 0);
    camera.lookAt(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0x224422, 3));
    const sun = new THREE.DirectionalLight(0xffffff, 3);
    sun.position.set(5, 12, 8);
    sun.castShadow = true;
    scene.add(sun);
    scene.add(new THREE.PointLight(0x00ff44, 2, 12));

    // Green
    const groundGeo = new THREE.PlaneGeometry(12, 12, 20, 20);
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x1a6b1a, emissive: 0x0a3d0a, emissiveIntensity: 0.3 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Border rough
    const roughMat = new THREE.MeshPhongMaterial({ color: 0x2d5a1b });
    [[-6, 0], [6, 0], [0, -6], [0, 6]].forEach(([x, z]) => {
      const rough = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x) > 0 ? 1 : 14, 0.05, Math.abs(x) > 0 ? 14 : 1), roughMat);
      rough.position.set(x > 0 ? 6.5 : x < 0 ? -6.5 : 0, 0, z > 0 ? 6.5 : z < 0 ? -6.5 : 0);
      scene.add(rough);
    });

    sceneRef.current.scene = scene;
    sceneRef.current.camera = camera;
    sceneRef.current.renderer = renderer;

    // Total bot strokes pre-calculation
    let totalBot = 0;
    for (const h of HOLES) totalBot += getBotStrokes(h, difficulty);
    setTotalBotStrokes(totalBot);

    buildHole(0, renderer);
    setHoleIdx(0);
    setStrokes(0);
    setBotStrokes(getBotStrokes(HOLES[0], difficulty));

    let currentHoleStrokes = 0;
    let currentHoleIdx = 0;
    let totalStrokes = 0;
    let currentBotStrokes = 0;

    function loop() {
      const s = sceneRef.current;
      if (!s.scene || !s.ball) return;
      const hole = HOLES[currentHoleIdx];

      if (s.rolling) {
        // Apply wind
        s.ballVx += s.wind.x * 0.003;
        s.ballVz += s.wind.z * 0.003;

        // Apply friction
        s.ballVx *= 0.983;
        s.ballVz *= 0.983;

        s.ball.position.x += s.ballVx;
        s.ball.position.z += s.ballVz;
        s.ball.rotation.x += s.ballVz * 3;
        s.ball.rotation.z -= s.ballVx * 3;

        // Boundary bounce
        if (Math.abs(s.ball.position.x) > 5.5) { s.ballVx *= -0.6; s.ball.position.x = Math.sign(s.ball.position.x) * 5.5; }
        if (Math.abs(s.ball.position.z) > 5.5) { s.ballVz *= -0.6; s.ball.position.z = Math.sign(s.ball.position.z) * 5.5; }

        // Obstacle collision
        for (const ob of s.obstacles) {
          const dx = s.ball.position.x - ob.position.x;
          const dz = s.ball.position.z - ob.position.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const obR = (ob.geometry as THREE.CylinderGeometry).parameters.radiusTop;
          if (dist < 0.22 + obR) {
            // Bounce + penalty
            const nx = dx / dist, nz = dz / dist;
            const dot = s.ballVx * nx + s.ballVz * nz;
            s.ballVx -= 2 * dot * nx * 0.5;
            s.ballVz -= 2 * dot * nz * 0.5;
            currentHoleStrokes++;
            totalStrokes++;
            setHoleStrokes(currentHoleStrokes);
            setStrokes(totalStrokes);
          }
        }

        // Hole detection
        const hx = hole.holePt[0], hz = hole.holePt[1];
        const dist = Math.sqrt((s.ball.position.x - hx) ** 2 + (s.ball.position.z - hz) ** 2);
        if (dist < 0.38) {
          s.rolling = false; s.ballVx = 0; s.ballVz = 0;
          setIsRolling(false);

          if (currentHoleIdx + 1 < TOTAL_HOLES) {
            currentHoleIdx++;
            currentBotStrokes += getBotStrokes(HOLES[currentHoleIdx], difficulty);
            setHoleIdx(currentHoleIdx);
            setBotStrokes(getBotStrokes(HOLES[currentHoleIdx], difficulty));
            setShowHoleComplete(true);
            currentHoleStrokes = 0;
            setTimeout(() => {
              setShowHoleComplete(false);
              buildHole(currentHoleIdx, renderer);
            }, 1800);
          } else {
            // All holes complete
            const playerWins = totalStrokes <= totalBot;
            setWon(playerWins);
            if (playerWins) addWinning(prize, "Golf Master Win");
            setStrokes(totalStrokes);
            setTotalBotStrokes(totalBot);
            setTimeout(() => setPhase("result"), 800);
          }
        }

        const speed = Math.sqrt(s.ballVx ** 2 + s.ballVz ** 2);
        if (speed < 0.002) { s.rolling = false; s.ballVx = 0; s.ballVz = 0; setIsRolling(false); }
      }

      renderer.render(s.scene!, s.camera!);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); renderer.dispose(); };
  }, [phase, buildHole, addWinning, difficulty, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function onPointerDown(e: React.PointerEvent) {
    if (isRolling) return;
    setAiming({ startX: e.clientX, startY: e.clientY, active: true });
    setAimVector(null);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!aiming?.active) return;
    setAimVector({ dx: aiming.startX - e.clientX, dy: aiming.startY - e.clientY });
  }
  function onPointerUp() {
    if (!aiming || !aimVector) { setAiming(null); return; }
    const s = sceneRef.current;
    if (!s.ball) return;
    const power = Math.min(Math.sqrt(aimVector.dx ** 2 + aimVector.dy ** 2) / 80, 1);
    const len = Math.sqrt(aimVector.dx ** 2 + aimVector.dy ** 2) || 1;
    s.ballVx = (aimVector.dx / len) * power * 0.22;
    s.ballVz = (aimVector.dy / len) * power * 0.22;
    s.rolling = true;
    setIsRolling(true);

    const newStrokes = (holeStrokes ?? 0) + 1;
    setHoleStrokes(newStrokes);
    setStrokes((prev) => prev + 1);
    setAiming(null); setAimVector(null);
  }

  const aimPower = aimVector ? Math.min(Math.sqrt(aimVector.dx ** 2 + aimVector.dy ** 2) / 80, 1) : 0;

  return (
    <div className="flex flex-col" style={{ background: "#0d1b0a", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">⛳ Golf Master 3D</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="text-white font-black">Hole {holeIdx + 1}/{TOTAL_HOLES}</div>
          <div className="flex gap-3">
            <span className="text-zinc-400">Shots: <b className="text-white">{holeStrokes}</b></span>
            <span className="text-zinc-400">Total: <b className="text-green-400">{strokes}</b></span>
            <span className="text-zinc-400">Bot: <b style={{ color: difficulty.color }}>{totalBotStrokes}</b></span>
          </div>
          <div className="text-xs" style={{ color: wind.x !== 0 || wind.z !== 0 ? "#fbbf24" : "#22c55e" }}>
            🌬️ {wind.x > 0 ? "→" : wind.x < 0 ? "←" : ""}{wind.z > 0 ? "↓" : wind.z < 0 ? "↑" : ""}
            {Math.abs(wind.x) < 0.005 && Math.abs(wind.z) < 0.005 ? "Calm" : "Wind"}
          </div>
        </div>
      )}

      <div className="relative flex-1">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", touchAction: "none" }}
          onPointerDown={phase === "playing" ? onPointerDown : undefined}
          onPointerMove={phase === "playing" ? onPointerMove : undefined}
          onPointerUp={phase === "playing" ? onPointerUp : undefined}
          onPointerCancel={phase === "playing" ? onPointerUp : undefined} />

        {/* Aim indicator */}
        {aiming && aimVector && phase === "playing" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none">
            <div className="text-xs font-black text-yellow-400">Power: {Math.round(aimPower * 100)}%</div>
            <div className="h-2 rounded-full overflow-hidden" style={{ width: 120, background: "rgba(255,255,255,0.1)" }}>
              <div className="h-full rounded-full" style={{ width: `${aimPower * 100}%`, background: aimPower > 0.7 ? "#ef4444" : aimPower > 0.4 ? "#fbbf24" : "#22c55e" }} />
            </div>
          </div>
        )}

        {!isRolling && phase === "playing" && !aiming && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-zinc-400 pointer-events-none">
            Drag away from ball to aim & shoot
          </div>
        )}

        {showHoleComplete && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="text-5xl mb-3">⛳</div>
            <div className="text-white font-black text-2xl">Hole {holeIdx}!</div>
            <div className="text-green-400 text-sm mt-1">Next hole incoming…</div>
          </motion.div>
        )}

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(13,27,10,0.93)" }}>
              <div className="text-7xl">⛳</div>
              <div className="text-white font-black text-3xl">Golf Master 3D</div>
              <div className="text-zinc-400 text-sm text-center px-8">5 holes. Fewer strokes than the bot to win! Wind affects your ball.</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} Bot difficulty: <b>{difficulty.level}</b>
              </div>
              <div className="px-4 py-2 rounded-xl text-xs text-zinc-400 text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                👆 Drag away from ball to set aim · Release to shoot<br />💧 Blue/purple circles = water — bounce penalty!
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                TEE OFF! ⛳
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(13,27,10,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "😔"}</div>
              <div className="text-white font-black text-3xl">{won ? "You Win!" : "Bot Wins!"}</div>
              <div className="w-full rounded-2xl px-5 py-4 flex justify-between" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div><div className="text-zinc-400 text-xs">Your Strokes</div><div className="text-white font-black text-2xl">{strokes}</div></div>
                <div className="text-right"><div className="text-zinc-400 text-xs">Bot Strokes</div><div className="text-zinc-300 font-black text-2xl">{totalBotStrokes}</div></div>
              </div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setStrokes(0); setHoleIdx(0); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>Replay</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
