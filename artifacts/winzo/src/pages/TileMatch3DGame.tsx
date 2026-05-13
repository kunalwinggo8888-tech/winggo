/**
 * Tile Match 3D — WINGGO
 * Three.js 3D icon cubes. Click tile → moves to 7-slot tray.
 * 3 matching tiles in tray → disappear. Tray full = game over.
 * Clear all tiles before tray fills to win.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 480;
const TRAY_SLOTS = 7;

const TILE_TYPES = [
  { type: "star",    color: 0xFFD700, emissive: 0xaa8800 },
  { type: "diamond", color: 0x00e5ff, emissive: 0x007799 },
  { type: "heart",   color: 0xff3366, emissive: 0x991133 },
  { type: "clover",  color: 0x22c55e, emissive: 0x115522 },
  { type: "flame",   color: 0xff6600, emissive: 0x993300 },
];

interface Tile3D {
  mesh: THREE.Mesh; type: string; layer: number;
  row: number; col: number; active: boolean; animating: boolean;
}
interface TrayItem { type: string; color: number }

export default function TileMatch3DGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  const gameRef = useRef<{
    scene: THREE.Scene | null;
    camera: THREE.PerspectiveCamera | null;
    renderer: THREE.WebGLRenderer | null;
    tiles: Tile3D[];
    tray: TrayItem[];
    raycaster: THREE.Raycaster;
    frame: number;
    running: boolean;
    lastMatchT: number;
  }>({ scene: null, camera: null, renderer: null, tiles: [], tray: [], raycaster: new THREE.Raycaster(), frame: 0, running: false, lastMatchT: 0 });

  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [tray, setTray] = useState<TrayItem[]>([]);
  const [won, setWon] = useState(false);
  const [tilesLeft, setTilesLeft] = useState(0);
  const [lastMatch, setLastMatch] = useState("");

  function buildLevel(scene: THREE.Scene): Tile3D[] {
    const tiles: Tile3D[] = [];
    const ROWS = 5, COLS = 5, LAYERS = 2;
    const pool: string[] = [];
    const totalTiles = ROWS * COLS * LAYERS;
    const typesNeeded = Math.ceil(totalTiles / 3);
    for (let i = 0; i < typesNeeded; i++) {
      const t = TILE_TYPES[i % TILE_TYPES.length].type;
      pool.push(t, t, t);
    }
    // Shuffle
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    let idx = 0;
    for (let layer = 0; layer < LAYERS; layer++) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const tileType = TILE_TYPES.find((t) => t.type === pool[idx % pool.length])!;
          idx++;
          const geo = new THREE.BoxGeometry(0.8, 0.8, 0.25);
          const mat = new THREE.MeshPhongMaterial({
            color: tileType.color, emissive: tileType.emissive,
            emissiveIntensity: 0.5, shininess: 80,
          });
          const mesh = new THREE.Mesh(geo, mat);
          mesh.castShadow = true;
          const x = (col - 2) * 0.95;
          const y = (1 - row) * 0.95 + layer * 0.35;
          const z = -layer * 0.5;
          mesh.position.set(x, y, z);
          mesh.rotation.x = (Math.random() - 0.5) * 0.1;
          mesh.rotation.y = (Math.random() - 0.5) * 0.1;
          scene.add(mesh);
          tiles.push({ mesh, type: tileType.type, layer, row, col, active: true, animating: false });
        }
      }
    }
    return tiles;
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05040f);
    scene.fog = new THREE.Fog(0x05040f, 8, 20);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 30);
    camera.position.set(0, 0.5, 7.5);
    camera.lookAt(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0x221133, 3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(4, 8, 5); dirLight.castShadow = true;
    scene.add(dirLight);
    scene.add(new THREE.PointLight(0x9333ea, 3, 12));
    const goldLight = new THREE.PointLight(0xFFD700, 2, 10);
    goldLight.position.set(-3, 3, 3);
    scene.add(goldLight);

    const g = gameRef.current;
    g.scene = scene; g.camera = camera; g.renderer = renderer;
    g.tiles = buildLevel(scene);
    g.tray = [];
    g.frame = 0; g.running = true; g.lastMatchT = 0;
    setTray([]); setLastMatch("");
    setTilesLeft(g.tiles.filter((t) => t.active).length);

    function pickTile(e: PointerEvent) {
      if (!g.running) return;
      const rect = canvas!.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      g.raycaster.setFromCamera(new THREE.Vector2(nx, ny), camera);
      const meshes = g.tiles.filter((t) => t.active).map((t) => t.mesh);
      const intersects = g.raycaster.intersectObjects(meshes);
      if (intersects.length === 0) return;
      const hitMesh = intersects[0].object as THREE.Mesh;
      const tile = g.tiles.find((t) => t.mesh === hitMesh && t.active);
      if (!tile) return;
      if (g.tray.length >= TRAY_SLOTS) return;

      // Add to tray
      tile.active = false;
      tile.animating = true;
      (tile.mesh.material as THREE.MeshPhongMaterial).transparent = true;
      const tileTypeDef = TILE_TYPES.find((t) => t.type === tile.type)!;
      g.tray.push({ type: tile.type, color: tileTypeDef.color });
      setTray([...g.tray]);

      // Animate tile falling to tray
      let animFrame = 0;
      const targetY = -2.6, targetZ = 4;
      const startPos = { ...tile.mesh.position };
      const anim = () => {
        animFrame++;
        const progress = Math.min(animFrame / 20, 1);
        tile.mesh.position.y = startPos.y + (targetY - startPos.y) * progress;
        tile.mesh.position.z = startPos.z + (targetZ - startPos.z) * progress;
        (tile.mesh.material as THREE.MeshPhongMaterial).opacity = 1 - progress;
        if (progress < 1) requestAnimationFrame(anim);
        else { scene.remove(tile.mesh); tile.animating = false; }
      };
      requestAnimationFrame(anim);

      // Check for match of 3
      const typeCount: Record<string, number[]> = {};
      g.tray.forEach((item, idx) => {
        if (!typeCount[item.type]) typeCount[item.type] = [];
        typeCount[item.type].push(idx);
      });
      for (const [type, idxs] of Object.entries(typeCount)) {
        if (idxs.length >= 3) {
          // Remove 3 from tray
          let removed = 0;
          g.tray = g.tray.filter((_, i) => {
            if (idxs.includes(i) && removed < 3) { removed++; return false; }
            return true;
          });
          g.lastMatchT = g.frame;
          setTray([...g.tray]);
          setLastMatch(`✨ ${type.toUpperCase()} MATCH!`);
          setTimeout(() => setLastMatch(""), 1500);
          break;
        }
      }

      const remaining = g.tiles.filter((t) => t.active).length;
      setTilesLeft(remaining);

      // Check game over conditions
      if (remaining === 0) {
        g.running = false;
        setWon(true);
        addWinning(prize, "Tile Match Win");
        setTimeout(() => setPhase("result"), 800);
      } else if (g.tray.length >= TRAY_SLOTS) {
        g.running = false;
        setWon(false);
        setTimeout(() => setPhase("result"), 400);
      }
    }

    canvas.addEventListener("pointerdown", pickTile);

    function loop() {
      if (!g.scene) return;
      g.frame++;

      // Float tiles gently
      for (const tile of g.tiles) {
        if (!tile.active) continue;
        tile.mesh.position.y += Math.sin(g.frame * 0.03 + tile.col * 0.5) * 0.001;
        tile.mesh.rotation.y += 0.005;
      }

      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", pickTile);
      renderer.dispose();
    };
  }, [phase, addWinning, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const TRAY_COLORS: Record<string, string> = {
    star: "#FFD700", diamond: "#00e5ff", heart: "#ff3366", clover: "#22c55e", flame: "#ff6600",
  };
  const TRAY_EMOJIS: Record<string, string> = {
    star: "⭐", diamond: "💎", heart: "❤️", clover: "🍀", flame: "🔥",
  };

  return (
    <div className="flex flex-col" style={{ background: "#05040f", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🧩 Tile Match 3D</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>

      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-2" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="text-xs font-black text-zinc-400">Tiles left: <b className="text-white">{tilesLeft}</b></div>
          {lastMatch && (
            <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="text-xs font-black" style={{ color: "#FFD700" }}>
              {lastMatch}
            </motion.div>
          )}
          <div className="text-xs font-black text-zinc-400">Tray: <b style={{ color: tray.length >= TRAY_SLOTS - 1 ? "#ef4444" : "#22c55e" }}>{tray.length}/{TRAY_SLOTS}</b></div>
        </div>
      )}

      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", touchAction: "none" }} />

        {phase === "playing" && (
          <div className="absolute bottom-0 left-0 right-0 px-3 py-2 flex gap-1.5 justify-center"
            style={{ background: "rgba(0,0,0,0.8)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {Array.from({ length: TRAY_SLOTS }).map((_, i) => {
              const item = tray[i];
              return (
                <div key={i} className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                  style={{
                    background: item ? `${TRAY_COLORS[item.type]}22` : "rgba(255,255,255,0.04)",
                    border: item ? `1.5px solid ${TRAY_COLORS[item.type]}66` : "1px solid rgba(255,255,255,0.1)",
                    boxShadow: item ? `0 0 10px ${TRAY_COLORS[item.type]}44` : "none",
                    transition: "all 0.2s",
                  }}>
                  {item ? TRAY_EMOJIS[item.type] : ""}
                </div>
              );
            })}
          </div>
        )}

        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(5,4,15,0.93)" }}>
              <div className="text-7xl">🧩</div>
              <div className="text-white font-black text-3xl">Tile Match 3D</div>
              <div className="text-zinc-400 text-sm text-center px-8">Tap matching tiles. 3 of a kind = cleared! Tray fills up (7 slots) = Game Over.</div>
              <div className="flex gap-2 text-xl">
                {Object.values(TRAY_EMOJIS).map((e) => <span key={e}>{e}</span>)}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>
                MATCH! 🧩
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(5,4,15,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "💔"}</div>
              <div className="text-white font-black text-3xl">{won ? "ALL CLEARED!" : "Tray Full!"}</div>
              <div className="text-zinc-400 text-sm">{won ? "Perfect! You cleared all tiles!" : `${tilesLeft} tiles remained.`}</div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setTray([]); setPhase("playing"); }}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)" }}>Play Again</motion.button>
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
