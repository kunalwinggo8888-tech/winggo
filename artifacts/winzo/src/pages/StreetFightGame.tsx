/**
 * Street Fight 3D — WINGGO
 * Three.js box-man fighters, 1v1 vs bot AI, health bars, hit sparks.
 * Controls: A/D move, J punch, K kick, J+K special (keyboard + on-screen)
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 500;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Fighter {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  x: number;
  vx: number;
  hp: number;
  maxHp: number;
  state: "idle" | "punch" | "kick" | "special" | "hurt" | "block";
  stateTimer: number;
  facing: 1 | -1;
  isPlayer: boolean;
  comboCount: number;
  comboTimer: number;
}

interface Spark { pos: THREE.Vector3; vel: THREE.Vector3; life: number; mesh: THREE.Mesh }

// ─── Fighter factory ───────────────────────────────────────────────────────────
function createFighter(scene: THREE.Scene, isPlayer: boolean): Fighter {
  const color = isPlayer ? 0xFFD700 : 0xff3333;
  const mat = new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.3, shininess: 80 });
  const darkMat = new THREE.MeshPhongMaterial({ color: isPlayer ? 0xa08000 : 0x8b0000, shininess: 40 });

  const group = new THREE.Group();

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), mat);
  body.position.y = 0.7;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.3), mat);
  head.position.y = 1.24;
  group.add(head);

  // Eyes
  const eyeMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
  [-0.09, 0.09].forEach((ex) => {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.05), eyeMat);
    eye.position.set(ex, 1.28, 0.16);
    group.add(eye);
  });

  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), darkMat);
  leftArm.position.set(-0.38, 0.72, 0);
  group.add(leftArm);

  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.55, 0.18), darkMat);
  rightArm.position.set(0.38, 0.72, 0);
  group.add(rightArm);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  leftLeg.position.set(-0.15, 0.1, 0);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), mat);
  rightLeg.position.set(0.15, 0.1, 0);
  group.add(rightLeg);

  scene.add(group);

  return {
    group, body, head, leftArm, rightArm, leftLeg, rightLeg,
    x: isPlayer ? -1.5 : 1.5,
    vx: 0, hp: 100, maxHp: 100,
    state: "idle", stateTimer: 0,
    facing: isPlayer ? 1 : -1,
    isPlayer, comboCount: 0, comboTimer: 0,
  };
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function StreetFightGame({ onBack, initialFee = 5 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const keysRef = useRef<Set<string>>(new Set());
  const gameRef = useRef<{
    player: Fighter | null; bot: Fighter | null;
    sparks: Spark[];
    renderer: THREE.WebGLRenderer | null;
    shakeTimer: number;
    roundTimer: number;
    botReactTimer: number;
  }>({ player: null, bot: null, sparks: [], renderer: null, shakeTimer: 0, roundTimer: 90, botReactTimer: 0 });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [playerHp, setPlayerHp] = useState(100);
  const [botHp, setBotHp] = useState(100);
  const [won, setWon] = useState(false);
  const [comboDisplay, setComboDisplay] = useState("");
  const [timeLeft, setTimeLeft] = useState(90);

  function doAttack(attacker: Fighter, defender: Fighter, type: "punch" | "kick" | "special") {
    if (attacker.state !== "idle") return;
    const dist = Math.abs(attacker.x - defender.x);
    const range = type === "kick" ? 1.4 : type === "special" ? 1.8 : 1.1;
    attacker.state = type;
    attacker.stateTimer = type === "special" ? 40 : 22;

    if (dist < range) {
      const blocked = defender.state === "block" && difficulty.winChance > 0.5;
      if (!blocked) {
        const dmg = type === "special" ? 22 : type === "kick" ? 14 : 9;
        defender.hp = Math.max(0, defender.hp - dmg);
        defender.state = "hurt";
        defender.stateTimer = 15;
        if (attacker.isPlayer) {
          attacker.comboCount++;
          attacker.comboTimer = 60;
          setComboDisplay(attacker.comboCount >= 3 ? `🔥 COMBO ×${attacker.comboCount}!` : "");
          setPlayerHp(Math.round(attacker.hp));
          setBotHp(Math.round(defender.hp));
        } else {
          setPlayerHp(Math.round(defender.hp));
          setBotHp(Math.round(attacker.hp));
        }
        // Sparks
        const g = gameRef.current;
        const sparkPos = new THREE.Vector3(defender.x, 1.0, 0);
        for (let i = 0; i < 8; i++) {
          const sm = new THREE.Mesh(
            new THREE.SphereGeometry(0.04),
            new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 1 })
          );
          sm.position.copy(sparkPos);
          const angle = (Math.PI * 2 * i) / 8;
          g.sparks.push({
            pos: sparkPos.clone(), vel: new THREE.Vector3(Math.cos(angle) * 0.08, Math.sin(angle) * 0.08 + 0.05, Math.random() * 0.06 - 0.03),
            life: 18, mesh: sm,
          });
        }
        g.shakeTimer = 10;
      }
    }
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const g = gameRef.current;
    g.roundTimer = 90;
    g.shakeTimer = 0;
    g.sparks = [];

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    g.renderer = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0010);
    scene.fog = new THREE.Fog(0x0a0010, 8, 20);

    // Camera
    const camera = new THREE.PerspectiveCamera(65, W / H, 0.1, 50);
    camera.position.set(0, 2.2, 5.5);
    camera.lookAt(0, 1, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x221133, 2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(3, 8, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const neonLeft = new THREE.PointLight(0xff00ff, 3, 8);
    neonLeft.position.set(-3, 3, 1);
    scene.add(neonLeft);
    const neonRight = new THREE.PointLight(0x00ffff, 3, 8);
    neonRight.position.set(3, 3, 1);
    scene.add(neonRight);

    // Arena floor
    const floorGeo = new THREE.PlaneGeometry(12, 8);
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x1a0030,
      emissive: 0x220044,
      emissiveIntensity: 0.4,
      shininess: 120,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Floor neon grid lines
    const gridHelper = new THREE.GridHelper(12, 12, 0xff00ff, 0x440044);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Background buildings (neon silhouettes)
    const buildMat = new THREE.MeshPhongMaterial({ color: 0x110022, emissive: 0x220033, emissiveIntensity: 0.3 });
    [[- 4, 1.5, -3], [- 2.5, 2.2, -3], [2.5, 1.8, -3], [4, 2.5, -3]].forEach(([x, h, z]) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.8, h, 0.1), buildMat);
      b.position.set(x, h / 2, z);
      scene.add(b);
    });

    // Rope/ring boundary
    const ropeMat = new THREE.MeshPhongMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.6 });
    [-3.2, 3.2].forEach((rx) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.8), ropeMat);
      post.position.set(rx, 0.9, 0);
      scene.add(post);
    });
    const ropeGeo = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(-3.2, 1.2, 0), new THREE.Vector3(3.2, 1.2, 0)]),
      20, 0.04, 4, false
    );
    scene.add(new THREE.Mesh(ropeGeo, ropeMat));

    // Fighters
    const player = createFighter(scene, true);
    const bot = createFighter(scene, false);
    g.player = player;
    g.bot = bot;

    // Input
    function onKeyDown(e: KeyboardEvent) { keysRef.current.add(e.key.toLowerCase()); }
    function onKeyUp(e: KeyboardEvent) { keysRef.current.delete(e.key.toLowerCase()); }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);

    let lastSec = 0;
    let frame = 0;

    function animateFighter(f: Fighter, dt: number) {
      // Move
      f.x = Math.max(-3, Math.min(3, f.x + f.vx));
      f.group.position.x = f.x;
      f.group.rotation.y = f.facing === 1 ? 0 : Math.PI;

      // State timer
      if (f.stateTimer > 0) {
        f.stateTimer--;
        if (f.stateTimer === 0) f.state = "idle";
      }

      // Combo timer
      if (f.comboTimer > 0) {
        f.comboTimer--;
        if (f.comboTimer === 0) { f.comboCount = 0; setComboDisplay(""); }
      }

      // Limb animations
      const t = frame * 0.1;
      if (f.state === "idle") {
        f.leftLeg.rotation.x = Math.sin(t) * 0.15;
        f.rightLeg.rotation.x = -Math.sin(t) * 0.15;
        f.leftArm.rotation.x = 0; f.rightArm.rotation.x = 0;
      } else if (f.state === "punch") {
        const progress = 1 - f.stateTimer / 22;
        f.rightArm.rotation.x = Math.sin(progress * Math.PI) * -1.4;
      } else if (f.state === "kick") {
        const progress = 1 - f.stateTimer / 22;
        f.rightLeg.rotation.x = Math.sin(progress * Math.PI) * -1.6;
      } else if (f.state === "special") {
        f.leftArm.rotation.x = -1.2; f.rightArm.rotation.x = -1.2;
        f.leftLeg.rotation.x = 0.5;
      } else if (f.state === "hurt") {
        f.group.position.x += f.isPlayer ? -0.05 : 0.05;
        f.head.rotation.z = Math.sin(frame * 0.5) * 0.3;
      } else if (f.state === "block") {
        f.leftArm.rotation.x = -1.0; f.rightArm.rotation.x = -1.0;
      }
    }

    function loop(ts: number) {
      frame++;
      const secNow = Math.floor(ts / 1000);
      if (secNow !== lastSec) {
        lastSec = secNow;
        g.roundTimer--;
        setTimeLeft(g.roundTimer);
        if (g.roundTimer <= 0) {
          // Time up — whoever has more HP wins
          const playerWins = player.hp > bot.hp;
          setWon(playerWins);
          if (playerWins) addWinning(prize, "Street Fight Win");
          setPhase("result");
          return;
        }
      }

      const p = g.player!, b = g.bot!;

      // ── Player input ──
      if (p.state === "idle" || p.state === "block") {
        const jDown = keysRef.current.has("j"), kDown = keysRef.current.has("k");
        if (jDown && kDown) { doAttack(p, b, "special"); }
        else if (jDown) { doAttack(p, b, "punch"); }
        else if (kDown) { doAttack(p, b, "kick"); }
        p.vx = keysRef.current.has("a") ? -0.05 : keysRef.current.has("d") ? 0.05 : 0;
        if (keysRef.current.has("s") && p.state === "idle") { p.state = "block"; p.stateTimer = 8; }
      }

      // ── Bot AI ──
      if (b.state === "idle") {
        const dist = Math.abs(p.x - b.x);
        g.botReactTimer--;
        const reactDelay = difficulty.level === "God Mode" ? 8 : difficulty.level === "Pro" ? 20 : 40;
        if (g.botReactTimer <= 0) {
          g.botReactTimer = reactDelay + Math.floor(Math.random() * reactDelay);
          // Move toward player
          if (dist > 0.9) {
            b.vx = p.x < b.x ? -0.055 : 0.055;
          } else {
            b.vx = 0;
            // Attack
            const roll = Math.random();
            if (difficulty.level === "God Mode") {
              // God mode: counter and combo
              if (p.state === "punch" || p.state === "kick") {
                b.state = "block"; b.stateTimer = 12;
                setTimeout(() => doAttack(b, p, "special"), 150);
              } else {
                doAttack(b, p, roll < 0.4 ? "special" : roll < 0.7 ? "kick" : "punch");
              }
            } else if (difficulty.level === "Pro") {
              if (roll < 0.15) { b.state = "block"; b.stateTimer = 12; }
              else { doAttack(b, p, roll < 0.5 ? "punch" : roll < 0.8 ? "kick" : "special"); }
            } else {
              if (roll < 0.7) doAttack(b, p, roll < 0.5 ? "punch" : "kick");
            }
          }
        }
        b.facing = p.x < b.x ? -1 : 1;
      }

      // ── Animate fighters ──
      animateFighter(p, 1);
      animateFighter(b, 1);

      // ── Sparks ──
      for (const sp of g.sparks) {
        sp.pos.add(sp.vel); sp.vel.y -= 0.004; sp.life--;
        sp.mesh.position.copy(sp.pos);
        (sp.mesh.material as THREE.MeshPhongMaterial).opacity = sp.life / 18;
        if (!scene.children.includes(sp.mesh)) scene.add(sp.mesh);
      }
      g.sparks = g.sparks.filter((sp) => { if (sp.life <= 0) { scene.remove(sp.mesh); } return sp.life > 0; });

      // ── Camera shake ──
      if (g.shakeTimer > 0) {
        g.shakeTimer--;
        camera.position.x = (Math.random() - 0.5) * 0.08;
        camera.position.y = 2.2 + (Math.random() - 0.5) * 0.05;
      } else {
        camera.position.x = 0; camera.position.y = 2.2;
      }

      // ── Check win ──
      if (p.hp <= 0 || b.hp <= 0) {
        const playerWins = b.hp <= 0;
        setWon(playerWins);
        if (playerWins) addWinning(prize, "Street Fight Win");
        setPhase("result");
        return;
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      g.player = null; g.bot = null;
    };
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  function btnPress(key: string) { keysRef.current.add(key); }
  function btnRelease(key: string) { keysRef.current.delete(key); }

  return (
    <div className="flex flex-col" style={{ background: "#050010", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🥊 Street Fight 3D</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      {/* Health Bars */}
      {phase === "playing" && (
        <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(0,0,0,0.8)" }}>
          <div className="flex-1">
            <div className="text-xs font-black text-yellow-400 mb-0.5">YOU</div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg,#22c55e,#86efac)" }} animate={{ width: `${playerHp}%` }} />
            </div>
          </div>
          <div className="text-xs font-black text-white px-2" style={{ color: timeLeft <= 10 ? "#ef4444" : "#FFD700" }}>⏱{timeLeft}</div>
          <div className="flex-1">
            <div className="text-xs font-black text-right" style={{ color: difficulty.color }}>BOT</div>
            <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
              <motion.div className="h-full rounded-full ml-auto" style={{ background: "linear-gradient(90deg,#ef4444,#fca5a5)" }} animate={{ width: `${botHp}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="relative" style={{ flex: 1 }}>
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block" }} />

        {comboDisplay && phase === "playing" && (
          <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full font-black text-sm"
            style={{ background: "rgba(255,140,0,0.9)", color: "#fff", boxShadow: "0 0 20px #ff8c00" }}>
            {comboDisplay}
          </motion.div>
        )}

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(5,0,16,0.92)" }}>
              <div className="text-7xl">🥊</div>
              <div className="text-white font-black text-3xl">Street Fight 3D</div>
              <div className="text-zinc-400 text-sm text-center px-8">Beat the bot before time runs out!</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} <b>{difficulty.level}</b> bot · 90 second round
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300 px-6">
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>⌨️ A/D — Move</div>
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>J — Punch</div>
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>K — Kick</div>
                <div className="px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>J+K — Special ⚡</div>
              </div>
              <div className="text-zinc-500 text-xs">Tap on-screen buttons on mobile</div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                FIGHT! 🥊
              </motion.button>
            </motion.div>
          )}

          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(5,0,16,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💀"}</div>
              <div className="text-white font-black text-3xl">{won ? "KNOCKOUT!" : "K.O.!"}</div>
              <div className="text-zinc-400 text-sm">{won ? "You destroyed the bot!" : "Bot wins this round."}</div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setPlayerHp(100); setBotHp(100); setTimeLeft(90); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Rematch</motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={onBack}
                  className="flex-1 py-3.5 rounded-2xl font-black text-sm"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }}>Home</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* On-screen controls */}
      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-3 gap-2" style={{ background: "rgba(0,0,0,0.85)" }}>
          <div className="flex gap-2">
            <button onPointerDown={() => btnPress("a")} onPointerUp={() => btnRelease("a")} onPointerCancel={() => btnRelease("a")}
              className="w-14 h-14 rounded-xl text-white font-black text-lg flex items-center justify-center active:scale-90 transition-transform select-none"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", touchAction: "none" }}>◀</button>
            <button onPointerDown={() => btnPress("d")} onPointerUp={() => btnRelease("d")} onPointerCancel={() => btnRelease("d")}
              className="w-14 h-14 rounded-xl text-white font-black text-lg flex items-center justify-center active:scale-90 transition-transform select-none"
              style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", touchAction: "none" }}>▶</button>
          </div>
          <div className="flex gap-2">
            <button onPointerDown={() => { btnPress("j"); btnPress("k"); }} onPointerUp={() => { btnRelease("j"); btnRelease("k"); }}
              className="w-14 h-14 rounded-xl font-black text-xs flex items-center justify-center active:scale-90 transition-transform select-none"
              style={{ background: "rgba(255,0,255,0.3)", border: "1px solid #ff00ff", color: "#ff00ff", touchAction: "none" }}>⚡SP</button>
            <button onPointerDown={() => btnPress("k")} onPointerUp={() => btnRelease("k")}
              className="w-14 h-14 rounded-xl font-black text-sm flex items-center justify-center active:scale-90 transition-transform select-none"
              style={{ background: "rgba(0,255,255,0.2)", border: "1px solid #00ffff", color: "#00ffff", touchAction: "none" }}>KICK</button>
            <button onPointerDown={() => btnPress("j")} onPointerUp={() => btnRelease("j")}
              className="w-14 h-14 rounded-xl font-black text-sm flex items-center justify-center active:scale-90 transition-transform select-none"
              style={{ background: "rgba(255,215,0,0.2)", border: "1px solid #FFD700", color: "#FFD700", touchAction: "none" }}>JAB</button>
          </div>
        </div>
      )}
    </div>
  );
}
