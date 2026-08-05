/**
 * SuperLudoGame — WINGGO Super Ludo (3D Edition)
 * ──────────────────────────────────────────────
 * • Three.js 3D board  (Red = User, Green = Bot)
 * • Per-player 3D CSS dice  with smooth animation
 * • 2-minute match timer
 * • 8-second real-player search → Smart Bot auto-joins
 * • Wallet deduct on start, credit on win
 * • Saves match via saveLudoMatchResult
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { useWallet } from "@/context/useWallet";
import { useAuth } from "@/context/useAuth";
import { useMatchHistory } from "@/context/useMatchHistory";
import { getRandomBot, type BotPlayer } from "@/data/botDatabase";
import {
  saveLudoMatchResult,
  firestoreAddWinning,
  firestoreDeductEntryFee,
} from "@/firebase/firestore.service";
import { FIREBASE_ENABLED } from "@/firebase/config";

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════
const CELL = 40;
const BOARD = 600;
const T_RAD = 13, T_H = 7;

const PLAYER_PATHS: Record<string, number[][]> = {
  red: [
    [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
    [7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],
    [13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],
    [8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],
    [6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],
  ],
  green: [
    [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
    [14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],
    [8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],
    [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],
    [4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],
  ],
};
const FINAL_PATHS: Record<string, number[][]> = {
  red:   [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  green: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
};
const HOME_POS: Record<string, number[][]> = {
  red:   [[1.5,1.5],[1.5,3.5],[3.5,1.5],[3.5,3.5]],
  green: [[10.5,1.5],[10.5,3.5],[12.5,1.5],[12.5,3.5]],
};
const HOME_TRI_POS: Record<string, number[][]> = {
  red:   [[5.8,6.5],[5.8,7.5],[6.2,6.75],[6.2,7.25]],
  green: [[7.1,5.8],[7.9,5.8],[7.4,6.2],[7.6,6.2]],
};
const SAFE_IDX = [0,8,13,21,26,34,39,47];
const START_COLORS: Record<number,number> = { 1: 0xef6d5e, 14: 0x48c76a };
const RACE_CELLS: number[][] = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
];
const SAFE_CELLS_RACE = [1,9,14,22,27,35,40,48];

function gw(gx: number, gy: number) {
  const off = BOARD / 2 - CELL / 2;
  return { x: gx * CELL - off, z: gy * CELL - off };
}

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface Props { onBack: () => void; initialFee?: number }

interface GMut {
  scene: THREE.Scene | null;
  cam: THREE.PerspectiveCamera | null;
  ren: THREE.WebGLRenderer | null;
  ctrl: OrbitControls | null;
  bg: THREE.Group | null;
  meshes: Record<string, THREE.Group[]>;
  tokens: Record<string, number[]>;
  ray: THREE.Raycaster;
  mouse: THREE.Vector2;
  hl: THREE.Group[];
  hlId: number | null;
  afId: number | null;
  live: boolean;
}

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════
export default function SuperLudoGame({ onBack, initialFee = 2 }: Props) {
  const { addWinning, deductFee } = useWallet();
  const { user } = useAuth();
  const { addMatch } = useMatchHistory();
  const botRef = useRef<BotPlayer>(getRandomBot());

  // ── Phase ──────────────────────────────────────────────
  const [phase, setPhase] = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [mmTimer, setMmTimer] = useState(8);

  // ── Game UI ────────────────────────────────────────────
  const [timer, setTimer] = useState(120);
  const [userScore, setUserScore] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const [turn, setTurn] = useState<"user" | "opp">("user");
  const [msg, setMsg] = useState("🎲 Dice Roll करें!");
  const [rolling, setRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState(0);
  const [uDice, setUDice] = useState({ x: 0, y: 0 });
  const [oDice, setODice] = useState({ x: 0, y: 0 });
  const [dVal, setDVal] = useState({ u: 1, o: 1 });

  // ── Result ─────────────────────────────────────────────
  const [won, setWon] = useState(false);
  const [prize, setPrize] = useState(0);
  const [finUs, setFinUs] = useState(0);
  const [finOs, setFinOs] = useState(0);

  // ── Refs ───────────────────────────────────────────────
  const boardRef = useRef<HTMLDivElement>(null);
  const g = useRef<GMut>({
    scene: null, cam: null, ren: null, ctrl: null, bg: null,
    meshes: { red: [], green: [] }, tokens: { red: [-1,-1,-1,-1], green: [-1,-1,-1,-1] },
    ray: new THREE.Raycaster(), mouse: new THREE.Vector2(),
    hl: [], hlId: null, afId: null, live: false,
  });
  const lastRollRef = useRef(0);
  const turnRef = useRef<"user" | "opp">("user");
  const rollingRef = useRef(false);
  const doneRef = useRef(false);
  const startTime = useRef(Date.now());
  const isFree = initialFee === 0;

  // ── Matchmaking ────────────────────────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    if (mmTimer <= 0) { setPhase("playing"); return; }
    const t = setTimeout(() => setMmTimer(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, mmTimer]);

  // ── Entry fee deduct on game start ─────────────────────
  useEffect(() => {
    if (phase !== "playing" || isFree) return;
    deductFee(initialFee, "Super Ludo Entry");
    if (FIREBASE_ENABLED && user?.uid) {
      firestoreDeductEntryFee(user.uid, initialFee, "Super Ludo Entry").catch(console.error);
    }
  }, [phase]);

  // ── Game Timer ─────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const t = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(t); if (!doneRef.current) finishGame(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // ── Scores ─────────────────────────────────────────────
  function calcScores() {
    const us = g.current.tokens.red.filter(t => t === 56).length;
    const os = g.current.tokens.green.filter(t => t === 56).length;
    setUserScore(us); setOppScore(os);
    return { us, os };
  }

  // ── Finish Game ────────────────────────────────────────
  async function finishGame(forceWinner?: "red" | "green") {
    if (doneRef.current) return;
    doneRef.current = true;
    g.current.live = false;
    const { us, os } = calcScores();
    setFinUs(us); setFinOs(os);
    const w = forceWinner ? forceWinner === "red" : us > os || (us === os && Math.random() > 0.5);
    const p = (!isFree && w) ? Math.floor(initialFee * 2 * 0.9) : 0;
    setWon(w); setPrize(p);

    if (w && !isFree) {
      addWinning(p, "Super Ludo Win");
      if (FIREBASE_ENABLED && user?.uid) {
        firestoreAddWinning(user.uid, p, "Super Ludo Win").catch(console.error);
      }
    }

    const dur = Math.floor((Date.now() - startTime.current) / 1000);
    const tier: "easy" | "medium" | "god" = initialFee < 5 ? "easy" : initialFee < 20 ? "medium" : "god";

    addMatch({
      game: "Super Ludo 3D", opponent: botRef.current.name,
      result: w ? "win" : "loss", fee: initialFee, prize: p,
    } as any);

    if (FIREBASE_ENABLED && user?.uid) {
      saveLudoMatchResult({
        uid: user.uid,
        opponentName: botRef.current.name,
        opponentIsBot: true,
        playerScore: us, opponentScore: os,
        won: w, entryFee: initialFee, prizeAmount: p,
        tier, duration: dur, moves: 0, kills: 0, forfeited: false,
      }).catch(console.error);
    }

    setPhase("result");
  }

  // ══════════════════════════════════════════════════════
  // DICE
  // ══════════════════════════════════════════════════════
  function rollDice(who: "user" | "opp", cb: (v: number) => void) {
    const xT = 4 + Math.floor(Math.random() * 8);
    const yT = 4 + Math.floor(Math.random() * 8);
    if (who === "user") setUDice(d => ({ x: d.x + 90 * xT, y: d.y + 90 * yT }));
    else setODice(d => ({ x: d.x + 90 * xT, y: d.y + 90 * yT }));
    setTimeout(() => {
      const v = Math.floor(Math.random() * 6) + 1;
      if (who === "user") setDVal(d => ({ ...d, u: v }));
      else setDVal(d => ({ ...d, o: v }));
      cb(v);
    }, Math.max(xT, yT) * 200 + 150);
  }

  // ══════════════════════════════════════════════════════
  // TOKEN LOGIC
  // ══════════════════════════════════════════════════════
  function validMoves(player: string, val: number) {
    return g.current.tokens[player].reduce<number[]>((acc, pos, i) => {
      if (pos === -1 && val === 6) acc.push(i);
      else if (pos >= 0 && pos < 56 && pos + val <= 56) acc.push(i);
      return acc;
    }, []);
  }

  function getWorldPos(player: string, idx: number, pos: number) {
    if (pos === 56) return gw(HOME_TRI_POS[player][idx][0], HOME_TRI_POS[player][idx][1]);
    if (pos >= 51) return gw(FINAL_PATHS[player][pos - 51][0], FINAL_PATHS[player][pos - 51][1]);
    if (pos >= 0) return gw(PLAYER_PATHS[player][pos][0], PLAYER_PATHS[player][pos][1]);
    return gw(HOME_POS[player][idx][0], HOME_POS[player][idx][1]);
  }

  function animStep(mesh: THREE.Group, tx: number, tz: number, ms: number, done: () => void) {
    const sx = mesh.position.x, sz = mesh.position.z, t0 = Date.now();
    function fr() {
      const el = Date.now() - t0, t = Math.min(el / ms, 1), e = 1 - Math.pow(1 - t, 3);
      mesh.position.x = sx + (tx - sx) * e;
      mesh.position.z = sz + (tz - sz) * e;
      mesh.position.y = T_H / 2 + 0.8 + Math.sin(t * Math.PI) * 8;
      t < 1 ? requestAnimationFrame(fr) : (mesh.position.y = T_H / 2 + 0.8, done());
    }
    fr();
  }

  function doCapture(player: string, pos: number) {
    if (pos < 0 || pos >= 51 || SAFE_IDX.includes(pos)) return;
    const gp = PLAYER_PATHS[player][pos];
    ["red", "green"].forEach(other => {
      if (other === player) return;
      g.current.tokens[other].forEach((op, i) => {
        if (op >= 0 && op < 51) {
          const og = PLAYER_PATHS[other][op];
          if (og[0] === gp[0] && og[1] === gp[1]) {
            g.current.tokens[other][i] = -1;
            const hp = HOME_POS[other][i], wp = gw(hp[0], hp[1]);
            g.current.meshes[other][i].position.set(wp.x, T_H / 2 + 0.8, wp.z);
            setMsg(`${player === "red" ? "आपने" : "Bot ने"} token capture किया! 🎯`);
          }
        }
      });
    });
  }

  function moveToken(player: string, idx: number, steps: number, done: () => void) {
    const oldPos = g.current.tokens[player][idx];
    const newPos = oldPos === -1 ? 0 : Math.min(oldPos + steps, 56);
    g.current.tokens[player][idx] = newPos;
    const steps_arr: number[] = oldPos === -1 ? [0] : Array.from({ length: newPos - oldPos }, (_, k) => oldPos + k + 1);
    let si = 0;
    const mesh = g.current.meshes[player][idx];
    function next() {
      if (si >= steps_arr.length) {
        doCapture(player, newPos); calcScores(); done(); return;
      }
      const wp = getWorldPos(player, idx, steps_arr[si]);
      animStep(mesh, wp.x, wp.z, 150, () => { si++; setTimeout(next, 50); });
    }
    next();
  }

  function chooseBest(player: string, val: number, moves: number[]) {
    let best = moves[0], bestScore = -999;
    moves.forEach(i => {
      let score = 0;
      const pos = g.current.tokens[player][i], newPos = pos === -1 ? 0 : pos + val;
      if (newPos === 56) score += 100;
      if (newPos >= 0 && newPos < 51) {
        const gp = PLAYER_PATHS[player][newPos];
        ["red", "green"].forEach(other => {
          if (other === player) return;
          g.current.tokens[other].forEach(op => {
            if (op >= 0 && op < 51 && PLAYER_PATHS[other][op][0] === gp[0] && PLAYER_PATHS[other][op][1] === gp[1]) score += 50;
          });
        });
        if (SAFE_IDX.includes(newPos)) score += 10;
      }
      score += newPos; if (pos === -1) score += 5;
      if (score > bestScore) { bestScore = score; best = i; }
    });
    return best;
  }

  // ══════════════════════════════════════════════════════
  // TURNS
  // ══════════════════════════════════════════════════════
  const handleRoll = useCallback(() => {
    if (rollingRef.current || doneRef.current || turnRef.current !== "user") return;
    rollingRef.current = true; setRolling(true);
    rollDice("user", val => {
      lastRollRef.current = val; setLastRoll(val);
      setMsg(`आपने ${val} roll किया!`);
      const vm = validMoves("red", val);
      if (!vm.length) {
        setMsg(`${val} आया, no valid move`);
        setTimeout(() => nextTurn("opp"), 1500);
      } else if (vm.length === 1) {
        setTimeout(() => moveToken("red", vm[0], val, () => {
          rollingRef.current = false; setRolling(false);
          if (g.current.tokens.red.every(t => t === 56)) { finishGame("red"); return; }
          val === 6 ? (setMsg("6 आया! फिर roll करें! 🎲"), turnRef.current = "user", setTurn("user"))
                    : nextTurn("opp");
        }), 400);
      } else {
        setMsg(`${val} आया — token tap करें`);
        hlTokens("red", vm);
        rollingRef.current = false; setRolling(false);
      }
    });
  }, []);

  function nextTurn(who: "user" | "opp") {
    rollingRef.current = false; setRolling(false); clearHL();
    lastRollRef.current = 0; setLastRoll(0);
    turnRef.current = who; setTurn(who);
    if (who === "opp") { setMsg("Bot सोच रहा है..."); setTimeout(botTurn, 900); }
    else setMsg("🎲 Dice Roll करें!");
  }

  function botTurn() {
    if (doneRef.current) return;
    rollingRef.current = true; setRolling(true);
    rollDice("opp", val => {
      lastRollRef.current = val; setLastRoll(val); setMsg(`Bot ने ${val} roll किया`);
      const vm = validMoves("green", val);
      if (!vm.length) { setMsg(`Bot: ${val}, no move`); setTimeout(() => nextTurn("user"), 1500); }
      else {
        const best = chooseBest("green", val, vm);
        setTimeout(() => moveToken("green", best, val, () => {
          rollingRef.current = false; setRolling(false);
          if (g.current.tokens.green.every(t => t === 56)) { finishGame("green"); return; }
          val === 6 ? setTimeout(botTurn, 800) : nextTurn("user");
        }), 600);
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // HIGHLIGHTS
  // ══════════════════════════════════════════════════════
  function hlTokens(player: string, moves: number[]) {
    clearHL();
    moves.forEach(i => {
      const mesh = g.current.meshes[player][i];
      mesh.userData.hl = true; g.current.hl.push(mesh);
      const ring = new THREE.Mesh(new THREE.RingGeometry(T_RAD + 3, T_RAD + 7, 32), new THREE.MeshBasicMaterial({ color: 0xff6b6b, side: THREE.DoubleSide, transparent: true, opacity: 1 }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 1; ring.name = "hRing";
      mesh.add(ring);
    });
    let t2 = 0;
    function blink() {
      t2 += 0.05;
      const op = (Math.sin(t2 * 2) + 1) / 2;
      g.current.hl.forEach(m => { const r = m.getObjectByName("hRing") as THREE.Mesh | undefined; if (r) (r.material as THREE.MeshBasicMaterial).opacity = 0.3 + op * 0.7; });
      if (g.current.hl.length) g.current.hlId = requestAnimationFrame(blink);
    }
    blink();
  }

  function clearHL() {
    if (g.current.hlId) { cancelAnimationFrame(g.current.hlId); g.current.hlId = null; }
    ["red", "green"].forEach(p => g.current.meshes[p].forEach(m => {
      m.userData.hl = false;
      const r = m.getObjectByName("hRing"); if (r) { m.remove(r); (r as THREE.Mesh).geometry.dispose(); }
    }));
    g.current.hl = [];
  }

  function onBoardClick(e: MouseEvent) {
    if (!g.current.ren || !g.current.cam) return;
    const rect = g.current.ren.domElement.getBoundingClientRect();
    g.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    g.current.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    g.current.ray.setFromCamera(g.current.mouse, g.current.cam);
    const highlighted = g.current.meshes.red.filter(m => m.userData.hl);
    const hits = g.current.ray.intersectObjects(highlighted, true);
    if (!hits.length) return;
    let obj: THREE.Object3D = hits[0].object;
    while (obj.parent && !obj.userData.player) obj = obj.parent;
    if ((obj as THREE.Group).userData.player === "red") {
      clearHL();
      const idx = (obj as THREE.Group).userData.index;
      const val = lastRollRef.current;
      rollingRef.current = true; setRolling(true);
      moveToken("red", idx, val, () => {
        rollingRef.current = false; setRolling(false);
        if (g.current.tokens.red.every(t => t === 56)) { finishGame("red"); return; }
        val === 6 ? (setMsg("6 आया! फिर roll करें!"), turnRef.current = "user", setTurn("user"))
                  : nextTurn("opp");
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // THREE.JS BOARD
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    if (phase !== "playing" || !boardRef.current) return;
    const el = boardRef.current;
    const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0a1628);
    const cam = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 1, 2000);
    cam.position.set(0, 600, 520); cam.lookAt(0, 0, 0);
    const ren = new THREE.WebGLRenderer({ antialias: true });
    ren.setSize(el.clientWidth, el.clientHeight);
    ren.setPixelRatio(window.devicePixelRatio);
    ren.shadowMap.enabled = true;
    el.appendChild(ren.domElement);
    const ctrl = new OrbitControls(cam, ren.domElement);
    ctrl.enableDamping = true; ctrl.dampingFactor = 0.05;
    ctrl.maxPolarAngle = Math.PI / 2.2; ctrl.minDistance = 300; ctrl.maxDistance = 1400;
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(200, 400, 200); dl.castShadow = true; scene.add(dl);
    const bg = new THREE.Group(); scene.add(bg);
    Object.assign(g.current, { scene, cam, ren, ctrl, bg, live: true });

    buildBoard(bg);
    buildTokens(bg);

    function loop() {
      if (!g.current.live) return;
      g.current.afId = requestAnimationFrame(loop);
      ctrl.update(); ren.render(scene, cam);
    }
    loop();

    function resize() { cam.aspect = el.clientWidth / el.clientHeight; cam.updateProjectionMatrix(); ren.setSize(el.clientWidth, el.clientHeight); }
    window.addEventListener("resize", resize);
    ren.domElement.addEventListener("click", onBoardClick);

    return () => {
      g.current.live = false;
      if (g.current.afId) cancelAnimationFrame(g.current.afId);
      if (g.current.hlId) cancelAnimationFrame(g.current.hlId);
      window.removeEventListener("resize", resize);
      ren.domElement.removeEventListener("click", onBoardClick);
      ren.dispose();
      if (el.contains(ren.domElement)) el.removeChild(ren.domElement);
    };
  }, [phase]);

  // ── Board Builder ──────────────────────────────────────
  function buildBoard(bg: THREE.Group) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(BOARD, 6, BOARD), new THREE.MeshStandardMaterial({ color: 0x1a2a4a }));
    base.receiveShadow = true; bg.add(base);

    [[0,0,0xfcdad7],[9,0,0xd8f5dd],[9,9,0xfde9c7],[0,9,0xcfe3fc]].forEach(([gx,gy,col]) => {
      const hw = CELL * 6 - 1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(hw, 2, hw), new THREE.MeshStandardMaterial({ color: col }));
      const wp = gw(+gx + 2.5, +gy + 2.5); m.position.set(wp.x, 1, wp.z); bg.add(m);
    });

    const cg = new THREE.CylinderGeometry(70, 70, 3, 32), cm = new THREE.MeshStandardMaterial({ color: 0xffffff });
    [[3,3],[11,3],[11,11],[3,11]].forEach(([cx, cy]) => { const c = new THREE.Mesh(cg, cm); const wp = gw(cx, cy); c.position.set(wp.x, 2, wp.z); bg.add(c); });

    RACE_CELLS.forEach((pos, idx) => {
      const wp = gw(pos[0], pos[1]);
      const color = START_COLORS[idx + 1] ?? 0xffffff;
      const geo = new THREE.BoxGeometry(CELL - 1, 1.5, CELL - 1);
      const cell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color }));
      cell.position.set(wp.x, 0.8, wp.z); bg.add(cell);
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x555555 }));
      wire.position.set(wp.x, 0.8, wp.z); bg.add(wire);
      if (SAFE_CELLS_RACE.includes(idx + 1)) addStar(bg, wp.x, wp.z);
    });

    [
      { cells: [[1,7],[2,7],[3,7],[4,7],[5,7]], color: 0xea4330 },
      { cells: [[7,1],[7,2],[7,3],[7,4],[7,5]], color: 0x34a853 },
      { cells: [[13,7],[12,7],[11,7],[10,7],[9,7]], color: 0xfbbc05 },
      { cells: [[7,13],[7,12],[7,11],[7,10],[7,9]], color: 0x4285f4 },
    ].forEach(({ cells, color }) => cells.forEach(c => {
      const wp = gw(c[0], c[1]);
      const geo = new THREE.BoxGeometry(CELL - 1, 1.5, CELL - 1);
      bg.add(Object.assign(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color })), { position: { x: wp.x, y: 0.8, z: wp.z } }));
      const cell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color })); cell.position.set(wp.x, 0.8, wp.z); bg.add(cell);
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x555555 })); wire.position.set(wp.x, 0.8, wp.z); bg.add(wire);
    }));

    const half = 3 * CELL / 2;
    [{ color: 0xea4330, r: 0 }, { color: 0x34a853, r: -Math.PI / 2 }, { color: 0xfbbc05, r: Math.PI }, { color: 0x4285f4, r: Math.PI / 2 }]
      .forEach(({ color, r }) => {
        const shape = new THREE.Shape(); shape.moveTo(-half, -half); shape.lineTo(0, 0); shape.lineTo(-half, half); shape.closePath();
        const tri = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color }));
        tri.rotation.x = -Math.PI / 2; tri.rotation.z = r; tri.position.y = 0.2; bg.add(tri);
      });
  }

  function addStar(bg: THREE.Group, x: number, z: number) {
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 11 : 5, a = (i * Math.PI) / 5 - Math.PI / 2;
      i === 0 ? shape.moveTo(Math.cos(a) * r, Math.sin(a) * r) : shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    const star = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, side: THREE.DoubleSide }));
    star.rotation.x = -Math.PI / 2; star.position.set(x, 1.5, z); bg.add(star);
  }

  function buildTokens(bg: THREE.Group) {
    const CM: Record<string, [number, number]> = { red: [0xa32011, 0xd22915], green: [0x1c5a2d, 0x288140] };
    ["red", "green"].forEach(player => {
      g.current.meshes[player] = [];
      for (let i = 0; i < 4; i++) {
        const grp = new THREE.Group();
        const outer = new THREE.Mesh(new THREE.CylinderGeometry(T_RAD, T_RAD, T_H, 32), new THREE.MeshStandardMaterial({ color: CM[player][0] }));
        outer.castShadow = true; grp.add(outer);
        const inner = new THREE.Mesh(new THREE.CylinderGeometry(T_RAD - 3, T_RAD - 3, T_H + 0.5, 32), new THREE.MeshStandardMaterial({ color: CM[player][1] }));
        inner.position.y = 0.25; inner.castShadow = true; grp.add(inner);
        grp.userData = { player, index: i }; outer.userData = { player, index: i }; inner.userData = { player, index: i };
        const hp = HOME_POS[player][i], wp = gw(hp[0], hp[1]);
        grp.position.set(wp.x, T_H / 2 + 0.8, wp.z);
        bg.add(grp); g.current.meshes[player].push(grp);
      }
    });
  }

  // ══════════════════════════════════════════════════════
  // DICE FACES
  // ══════════════════════════════════════════════════════
  function Dots({ v }: { v: number }) {
    const layout: [string, string][] = [];
    if ([1,3,5].includes(v)) layout.push(["mid","cen"]);
    if ([2,3,4,5,6].includes(v)) { layout.push(["top","rgt"]); layout.push(["bot","lft"]); }
    if ([4,5,6].includes(v)) { layout.push(["top","lft"]); layout.push(["bot","rgt"]); }
    if (v === 6) { layout.push(["mid","lft"]); layout.push(["mid","rgt"]); }
    return <>{layout.map((d, i) => <span key={i} className={`slDot ${d[0]} ${d[1]}`} />)}</>;
  }

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  const canRoll = turn === "user" && !rolling && !doneRef.current && phase === "playing";
  const bot = botRef.current;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0a1628", fontFamily: "'Poppins',sans-serif", color: "#fff", overflow: "hidden" }}>

      {/* ── MATCHMAKING ─────────────────────────────────── */}
      <AnimatePresence>
        {phase === "matchmaking" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", zIndex: 50, background: "#0a1628" }}>

            {/* Back */}
            <button onClick={onBack} style={{ position: "absolute", top: "1rem", left: "1rem", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", padding: "0.5rem 0.8rem", color: "#a0aec0", cursor: "pointer", fontSize: "0.9rem" }}>← Back</button>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 800, background: "linear-gradient(135deg,#ea4330,#4285f4,#34a853,#fbbc05)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>🎮 Super Ludo 3D</div>
              <div style={{ color: "#a0aec0", fontSize: "0.85rem", marginTop: "0.3rem" }}>1v1 Real Money · ₹{initialFee} Entry</div>
            </div>

            {/* Spinner */}
            <div style={{ position: "relative", width: 120, height: 120 }}>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid rgba(66,133,244,0.2)", borderTop: "3px solid #4285f4", animation: "slSpin 1.5s linear infinite" }} />
              <div style={{ position: "absolute", inset: 15, borderRadius: "50%", border: "3px solid rgba(245,158,11,0.2)", borderBottom: "3px solid #f59e0b", animation: "slSpin 2s linear infinite reverse" }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🎲</div>
            </div>

            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Real Player ढूंढ रहे हैं...</div>
              <div style={{ color: "#a0aec0", fontSize: "0.85rem", marginTop: "0.3rem" }}>{mmTimer}s में Bot join करेगा</div>
            </div>

            {/* Countdown ring */}
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `conic-gradient(#4285f4 ${(8 - mmTimer) / 8 * 360}deg, rgba(66,133,244,0.2) 0deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "1.1rem", color: "#4285f4" }}>{mmTimer}</div>
            </div>

            <div style={{ background: "rgba(66,133,244,0.08)", border: "1px solid rgba(66,133,244,0.15)", borderRadius: 12, padding: "0.7rem 1.5rem", fontSize: "0.85rem", color: "#a0aec0", textAlign: "center" }}>
              Entry: <strong style={{ color: "#f59e0b" }}>₹{initialFee}</strong> &nbsp;|&nbsp; Prize: <strong style={{ color: "#4ade80" }}>₹{Math.floor(initialFee * 2 * 0.9)}</strong>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GAME SCREEN ─────────────────────────────────── */}
      {phase === "playing" && (
        <>
          {/* 3D Board */}
          <div ref={boardRef} style={{ position: "absolute", inset: 0 }} />

          {/* TOP HUD */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, padding: "0.6rem 1rem", background: "linear-gradient(to bottom, rgba(10,22,40,0.97), transparent)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem", pointerEvents: "none" }}>
            {/* Timer */}
            <div style={{ background: "rgba(10,22,40,0.85)", border: `2px solid ${timer > 60 ? "#4ade80" : timer > 30 ? "#fbbf24" : "#f87171"}`, borderRadius: 50, padding: "0.25rem 1.1rem", fontSize: "1.3rem", fontWeight: 800, color: timer > 60 ? "#4ade80" : timer > 30 ? "#fbbf24" : "#f87171", letterSpacing: 2 }}>
              ⏱ {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
            </div>
            {/* Scores */}
            <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
              <div style={{ background: "rgba(234,67,53,0.15)", border: "1px solid rgba(234,67,53,0.35)", borderRadius: 10, padding: "0.2rem 0.7rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ea4330", display: "inline-block" }} />
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>आप</span>
                <span style={{ color: "#fbbf24", fontWeight: 800 }}>{userScore}/4</span>
              </div>
              <span style={{ color: "#4a5568", fontWeight: 700 }}>VS</span>
              <div style={{ background: "rgba(52,168,83,0.15)", border: "1px solid rgba(52,168,83,0.35)", borderRadius: 10, padding: "0.2rem 0.7rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#34a853", display: "inline-block" }} />
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>{bot.name}</span>
                <span style={{ color: "#fbbf24", fontWeight: 800 }}>{oppScore}/4</span>
              </div>
            </div>
          </div>

          {/* Message bubble */}
          <div style={{ position: "absolute", top: "44%", left: "50%", transform: "translate(-50%,-50%)", background: "rgba(10,22,40,0.88)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 50, padding: "0.35rem 1.1rem", color: "#a0aec0", fontSize: "0.82rem", whiteSpace: "nowrap", pointerEvents: "none", backdropFilter: "blur(6px)" }}>{msg}</div>

          {/* BOTTOM DICE */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(10,22,40,0.98) 60%, transparent)", padding: "0.6rem 1rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>

            {/* User Dice */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#ea4330", fontWeight: 700 }}>आप (Red)</div>
              <div style={{ perspective: 200, width: 54, height: 54, cursor: canRoll ? "pointer" : "default" }} onClick={canRoll ? handleRoll : undefined}>
                <div className="slDice" style={{ transform: `rotateX(${uDice.x}deg) rotateY(${uDice.y}deg)`, transition: rolling && turn === "user" ? "transform 1.2s ease-in-out" : "none" }}>
                  {[1,2,6,5,3,4].map((v, fi) => <div key={fi} className={`slFace slF${fi + 1}`}><Dots v={v} /></div>)}
                </div>
              </div>
              <button onClick={canRoll ? handleRoll : undefined} disabled={!canRoll}
                style={{ padding: "0.35rem 0.8rem", border: "none", borderRadius: 8, background: canRoll ? "linear-gradient(135deg,#ea4330,#b22020)" : "rgba(234,67,53,0.3)", color: "#fff", fontSize: "0.75rem", fontWeight: 700, cursor: canRoll ? "pointer" : "not-allowed" }}>
                {turn === "user" && !rolling ? "🎲 Roll" : rolling && turn === "user" ? "..." : "⌛ Wait"}
              </button>
            </div>

            {/* Center info */}
            <div style={{ textAlign: "center", flex: 1 }}>
              <div style={{ background: turn === "user" ? "rgba(234,67,53,0.15)" : "rgba(52,168,83,0.15)", border: `1px solid ${turn === "user" ? "rgba(234,67,53,0.3)" : "rgba(52,168,83,0.3)"}`, borderRadius: 10, padding: "0.35rem 0.6rem", fontSize: "0.75rem", color: turn === "user" ? "#fca5a5" : "#86efac", fontWeight: 600 }}>
                {turn === "user" ? "🔴 आपकी बारी" : "🟢 Bot की बारी"}
              </div>
              <div style={{ color: "#4a5568", fontSize: "0.6rem", marginTop: "0.25rem" }}>Entry ₹{initialFee} · Win ₹{Math.floor(initialFee * 2 * 0.9)}</div>
            </div>

            {/* Bot Dice */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.35rem" }}>
              <div style={{ fontSize: "0.7rem", color: "#34a853", fontWeight: 700 }}>{bot.name}</div>
              <div style={{ perspective: 200, width: 54, height: 54 }}>
                <div className="slDice slDiceG" style={{ transform: `rotateX(${oDice.x}deg) rotateY(${oDice.y}deg)`, transition: rolling && turn === "opp" ? "transform 1.2s ease-in-out" : "none" }}>
                  {[1,2,6,5,3,4].map((v, fi) => <div key={fi} className={`slFace slF${fi + 1}`}><Dots v={v} /></div>)}
                </div>
              </div>
              <div style={{ padding: "0.35rem 0.8rem", borderRadius: 8, background: turn === "opp" ? "rgba(52,168,83,0.3)" : "rgba(52,168,83,0.1)", color: "#86efac", fontSize: "0.75rem", fontWeight: 700 }}>
                {turn === "opp" && rolling ? "🎲 Rolling" : "🤖 Bot"}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── RESULT ──────────────────────────────────────── */}
      <AnimatePresence>
        {phase === "result" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
            <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 18 }}
              style={{ background: "linear-gradient(135deg,#1a2a4a,#0a1628)", borderRadius: 24, padding: "2.5rem", maxWidth: 340, width: "90%", border: `2px solid ${won ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`, textAlign: "center", boxShadow: "0 25px 60px rgba(0,0,0,0.6)" }}>
              <div style={{ fontSize: "4rem", marginBottom: "0.4rem" }}>{won ? "🏆" : "😞"}</div>
              <div style={{ fontSize: "1.9rem", fontWeight: 800, color: won ? "#4ade80" : "#f87171", marginBottom: "0.3rem" }}>{won ? "आप जीते!" : "हार गए!"}</div>
              <div style={{ color: "#a0aec0", fontSize: "0.9rem", marginBottom: "1.3rem" }}>
                {won ? `₹${prize} wallet में add हुए! 🎉` : `₹${initialFee} deduct हुए`}
              </div>
              <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginBottom: "1.5rem", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "0.7rem" }}>
                <div><div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b" }}>{finUs}</div><div style={{ fontSize: "0.7rem", color: "#ea4330" }}>आपका Score</div></div>
                <div style={{ color: "#4a5568", fontWeight: 700, display: "flex", alignItems: "center" }}>—</div>
                <div><div style={{ fontSize: "1.5rem", fontWeight: 800, color: "#f59e0b" }}>{finOs}</div><div style={{ fontSize: "0.7rem", color: "#34a853" }}>{bot.name}</div></div>
              </div>
              <button onClick={onBack} style={{ width: "100%", padding: "0.9rem", border: "none", borderRadius: 14, background: "linear-gradient(135deg,#4285f4,#1266f1)", color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer" }}>🏠 Dashboard</button>
              <button onClick={() => { doneRef.current = false; g.current.tokens = { red: [-1,-1,-1,-1], green: [-1,-1,-1,-1] }; setTimer(120); setUserScore(0); setOppScore(0); setTurn("user"); turnRef.current = "user"; setMsg("🎲 Dice Roll करें!"); setPhase("matchmaking"); setMmTimer(8); }}
                style={{ width: "100%", padding: "0.75rem", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, background: "transparent", color: "#a0aec0", fontSize: "0.9rem", cursor: "pointer", marginTop: "0.5rem" }}>🎲 फिर खेलें</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap');
        @keyframes slSpin { to { transform: rotate(360deg); } }
        .slDice { position:relative; width:54px; height:54px; transform-style:preserve-3d; transform-origin:27px 27px -27px; }
        .slDiceG .slFace { background:radial-gradient(circle at 35% 35%,#c8f7c5,#a8e8a5); }
        .slFace { position:absolute; width:54px; height:54px; background:radial-gradient(circle at 35% 35%,#fff,#ddd); border-radius:7px; box-shadow:inset 0 0 10px rgba(0,0,0,.12); transform-origin:27px 27px -27px; }
        .slF1{transform:rotateY(0deg)} .slF2{transform:rotateY(90deg)} .slF3{transform:rotateY(180deg)} .slF4{transform:rotateY(270deg)} .slF5{transform:rotateX(90deg)} .slF6{transform:rotateX(270deg)}
        .slDot { position:absolute; width:11px; height:11px; border-radius:50%; background:#1a1a2e; box-shadow:inset 2px 0 4px rgba(0,0,0,.4); }
        .top{top:9px} .mid{top:22px} .bot{bottom:9px} .lft{left:9px} .cen{left:22px} .rgt{right:9px}
      `}</style>
    </div>
  );
}
