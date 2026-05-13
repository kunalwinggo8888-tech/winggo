/**
 * Jelly Shift 3D — WINGGO
 * Three.js auto-running jelly. Drag up/down to shift lanes.
 * Gate obstacles require correct lane. Speed increases.
 * Beat the bot score to win.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty, getBotScore } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 500;
const LANES = [-1.6, 0, 1.6];

interface Gate { mesh: THREE.Group; z: number; lane: number; passed: boolean }

export default function JellyShiftGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const [botScore] = useState(() => getBotScore(30, difficulty));
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const dragRef = useRef<{ startY: number; active: boolean }>({ startY: 0, active: false });

  const stateRef = useRef({
    lane: 1, targetLane: 1, jellyX: 0,
    jellyWobble: 0, wobbleDir: 1,
    speed: 0.18, gates: [] as Gate[],
    score: 0, frame: 0,
    gateTimer: 60, running: false,
    scene: null as THREE.Scene | null,
    jellyMesh: null as THREE.Mesh | null,
    renderer: null as THREE.WebGLRenderer | null,
    pieces: [] as THREE.Mesh[],
  });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [score, setScore] = useState(0);
  const [won, setWon] = useState(false);
  const [lane, setLane] = useState(1);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0520);
    scene.fog = new THREE.Fog(0x0a0520, 10, 25);

    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 40);
    camera.position.set(0, 3, 7);
    camera.lookAt(0, 0.5, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0x221144, 3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(3, 10, 5); dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(new THREE.PointLight(0xa855f7, 4, 15));
    const goldPL = new THREE.PointLight(0xFFD700, 2, 10);
    goldPL.position.set(0, 4, -5);
    scene.add(goldPL);

    // Road
    const roadGeo = new THREE.PlaneGeometry(8, 100);
    const roadMat = new THREE.MeshPhongMaterial({ color: 0x1a0a2e, emissive: 0x0a0518, emissiveIntensity: 0.5 });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2; road.position.y = -0.01;
    road.receiveShadow = true;
    scene.add(road);

    // Lane lines
    for (let i = -1; i <= 1; i++) {
      const laneLineMat = new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.8 });
      const laneLine = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 100), laneLineMat);
      laneLine.rotation.x = -Math.PI / 2;
      laneLine.position.set(i * 1.6 + 0.8, 0, 0);
      scene.add(laneLine);
    }

    // Side walls with neon strips
    const wallMat = new THREE.MeshPhongMaterial({ color: 0x1a0a2e, emissive: 0x220033, emissiveIntensity: 0.3 });
    [-4.5, 4.5].forEach((wx) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 100), wallMat);
      wall.position.set(wx, 1.5, 0);
      scene.add(wall);
      // Neon strip on wall
      const neonMat = new THREE.MeshPhongMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 1 });
      const neon = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 100), neonMat);
      neon.position.set(wx > 0 ? wx - 0.22 : wx + 0.22, 0.8, 0);
      scene.add(neon);
    });

    // Jelly character
    const jellyGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const jellyMat = new THREE.MeshPhongMaterial({ color: 0xa855f7, emissive: 0x6b21a8, emissiveIntensity: 0.6, shininess: 120, transparent: true, opacity: 0.92 });
    const jellyMesh = new THREE.Mesh(jellyGeo, jellyMat);
    jellyMesh.castShadow = true;
    jellyMesh.position.set(0, 0.45, 4);
    scene.add(jellyMesh);
    // Jelly eyes
    const eyeMat = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1 });
    [-0.2, 0.2].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
      eye.position.set(ex, 0.15, 0.46); jellyMesh.add(eye);
    });

    const s = stateRef.current;
    s.scene = scene; s.jellyMesh = jellyMesh; s.renderer = renderer;
    s.lane = 1; s.targetLane = 1; s.jellyX = 0;
    s.gates = []; s.score = 0; s.frame = 0; s.gateTimer = 60;
    s.speed = 0.18; s.running = true; s.pieces = [];
    setScore(0); setLane(1);

    function spawnGate() {
      const g = stateRef.current;
      const openLane = Math.floor(Math.random() * 3); // 0,1,2

      const gateGroup = new THREE.Group();
      const wallMat2 = new THREE.MeshPhongMaterial({ color: 0xff3366, emissive: 0x990022, emissiveIntensity: 0.5 });
      const openMat = new THREE.MeshPhongMaterial({ color: 0x22c55e, emissive: 0x115522, emissiveIntensity: 0.5, transparent: true, opacity: 0.3 });

      for (let li = 0; li < 3; li++) {
        const lx = LANES[li];
        if (li === openLane) {
          // Open passage marker (just outline)
          const outline = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), openMat);
          outline.position.set(lx, 1.8, 0); gateGroup.add(outline);
        } else {
          // Solid wall segment
          const wall = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.3), wallMat2);
          wall.position.set(lx, 1.1, 0);
          gateGroup.add(wall);
        }
      }
      // Horizontal top beam
      const beam = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.15, 0.3), wallMat2);
      beam.position.set(0, 2.3, 0); gateGroup.add(beam);

      gateGroup.position.z = -20;
      scene.add(gateGroup);
      g.gates.push({ mesh: gateGroup, z: -20, lane: openLane, passed: false });
    }

    // Touch/drag
    function onPointerDown(e: PointerEvent) { dragRef.current = { startY: e.clientY, active: true }; }
    function onPointerMove(e: PointerEvent) {
      if (!dragRef.current.active) return;
      const dy = dragRef.current.startY - e.clientY;
      const s2 = stateRef.current;
      if (dy > 30) { s2.targetLane = Math.max(0, s2.lane - 1); dragRef.current.startY = e.clientY; }
      else if (dy < -30) { s2.targetLane = Math.min(2, s2.lane + 1); dragRef.current.startY = e.clientY; }
    }
    function onPointerUp() { dragRef.current.active = false; }
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);

    function loop() {
      const s2 = stateRef.current;
      if (!s2.running) return;
      s2.frame++;
      s2.speed = 0.18 + Math.floor(s2.score / 5) * 0.02;

      // Smooth lane transition
      s2.lane = s2.targetLane;
      const targetX = LANES[s2.lane];
      s2.jellyX += (targetX - s2.jellyX) * 0.18;
      setLane(s2.lane);

      // Jelly wobble
      s2.jellyWobble += 0.08 * s2.wobbleDir;
      if (Math.abs(s2.jellyWobble) > 0.12) s2.wobbleDir *= -1;

      if (jellyMesh) {
        jellyMesh.position.x = s2.jellyX;
        jellyMesh.scale.x = 1 + Math.sin(s2.frame * 0.15) * 0.04;
        jellyMesh.scale.y = 1 - Math.sin(s2.frame * 0.15) * 0.04;
        jellyMesh.position.y = 0.45 + Math.abs(Math.sin(s2.frame * 0.1)) * 0.05;
      }

      // Gates
      s2.gateTimer--;
      if (s2.gateTimer <= 0) { spawnGate(); s2.gateTimer = Math.max(30, 70 - s2.score * 2); }

      for (const gate of s2.gates) {
        gate.z += s2.speed;
        gate.mesh.position.z = gate.z;

        if (!gate.passed && gate.z > 3.5 && gate.z < 5.5) {
          // Check collision
          const playerLane = s2.lane;
          if (playerLane !== gate.lane) {
            // Hit! Break jelly
            s2.running = false;
            setWon(s2.score > botScore);
            if (s2.score > botScore) addWinning(prize, "Jelly Shift Win");
            setPhase("result");
            return;
          } else {
            gate.passed = true;
            s2.score++;
            setScore(s2.score);
            if (s2.score >= botScore + 5) {
              s2.running = false;
              setWon(true);
              addWinning(prize, "Jelly Shift Win");
              setPhase("result");
              return;
            }
          }
        }
      }
      s2.gates = s2.gates.filter((g) => { if (g.z > 15) scene.remove(g.mesh); return g.z <= 15; });

      // Ambient background elements scroll
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
    };
  }, [phase, addWinning, botScore, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex flex-col" style={{ background: "#0a0520", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🟣 Jelly Shift 3D</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>
      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="text-white font-black">Score: {score}</div>
          <div className="flex gap-1">
            {[0, 1, 2].map((l) => (
              <div key={l} className="w-8 h-2 rounded-full" style={{ background: l === lane ? "#a855f7" : "rgba(255,255,255,0.1)", boxShadow: l === lane ? "0 0 8px #a855f7" : "none" }} />
            ))}
          </div>
          <div style={{ color: difficulty.color }}>Beat: {botScore}</div>
        </div>
      )}
      <div className="relative flex-1">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", touchAction: "none" }} />

        {phase === "playing" && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <button onPointerDown={() => { const s = stateRef.current; s.targetLane = Math.max(0, s.lane - 1); s.lane = s.targetLane; }}
              className="w-16 h-12 rounded-xl text-white font-black text-lg flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(168,85,247,0.3)", border: "1px solid #a855f7", touchAction: "none" }}>◀</button>
            <button onPointerDown={() => { const s = stateRef.current; s.targetLane = Math.min(2, s.lane + 1); s.lane = s.targetLane; }}
              className="w-16 h-12 rounded-xl text-white font-black text-lg flex items-center justify-center active:scale-90 select-none"
              style={{ background: "rgba(168,85,247,0.3)", border: "1px solid #a855f7", touchAction: "none" }}>▶</button>
          </div>
        )}

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(10,5,32,0.93)" }}>
              <motion.div className="text-7xl" animate={{ scaleY: [1, 1.15, 0.85, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>🟣</motion.div>
              <div className="text-white font-black text-3xl">Jelly Shift 3D</div>
              <div className="text-zinc-400 text-sm text-center px-8">Shift lanes to pass through the green gap gates. Hit a wall and it's over!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} <b>{difficulty.level}</b> · Beat {botScore} gates
              </div>
              <div className="text-zinc-400 text-xs text-center">Swipe left/right or use buttons to shift lanes</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-white text-lg"
                style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>
                SHIFT! 🟣
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(10,5,32,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💥"}</div>
              <div className="text-white font-black text-3xl">{won ? "WINNER!" : "Splat!"}</div>
              <div className="w-full rounded-2xl px-5 py-4 flex justify-between" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div><div className="text-zinc-400 text-xs">Gates Passed</div><div className="text-white font-black text-2xl">{score}</div></div>
                <div className="text-right"><div className="text-zinc-400 text-xs">Bot Target</div><div className="text-zinc-300 font-black text-2xl">{botScore}</div></div>
              </div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setScore(0); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-white"
                  style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)" }}>Play Again</motion.button>
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
