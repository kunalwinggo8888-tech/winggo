/**
 * SuperLudoGame – WINGGO Super Ludo (3D)
 * 3D Ludo board (Three.js) ported from the standalone Ludo 3D build.
 * Money-match flow mirrors the app's Fast Ludo:
 *   – Entry fee is deducted by GameEntrySheet before mounting
 *   – 8s real-player wait → bot auto-joins
 *   – 2-min match timer on top; below it "Your Score" & "Opponent Score"
 *   – Player (YELLOW) & Bot (BLUE) each have their own dice
 *   – Winner gets wallet credit, match result saved to Firestore + local history
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";
import { getRandomBot, type BotPlayer } from "@/data/botDatabase";
import { saveLudoMatchResult } from "@/firebase/firestore.service";
import { useAuth } from "@/context/useAuth";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const HOME_SCORE = 25;
const KILL_BONUS = 15;
const EMOTES     = ["😂","👍","😤","🔥","🎉","💪","😱","🤙","👑","😎"];

const COLORS = {
  red: 0xea4330, redDark: 0xa32011, redLight: 0xd22915,
  green: 0x34a853, greenDark: 0x1c5a2d, greenLight: 0x288140,
  blue: 0x4285f4, blueDark: 0x0b51c5, blueLight: 0x1266f1,
  yellow: 0xfbbc05, yellowDark: 0x987102, yellowLight: 0xca9703,
  white: 0xffffff, gray: 0xaaaaaa, border: 0x666666,
};

const CELL_SIZE = 40, BOARD_TOTAL = 600, BASE_SIZE = 240;
const BOARD_THICKNESS = 8, TOKEN_RADIUS = 14, TOKEN_HEIGHT = 8;

// Player = YELLOW (bottom-right base), Bot = BLUE (bottom-left base)
const PLAYER = "yellow";
const BOT    = "blue";

// Movement paths (grid coords) — 52 cells each
const PLAYER_PATHS: Record<string, [number, number][]> = {
  yellow: [[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7]],
  blue: [[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14]],
};

const FINAL_PATHS: Record<string, [number, number][]> = {
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
  blue: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
};

const HOME_POSITIONS: Record<string, [number, number][]> = {
  yellow: [[10.5,10.5],[10.5,12.5],[12.5,10.5],[12.5,12.5]],
  blue: [[1.5,10.5],[1.5,12.5],[3.5,10.5],[3.5,12.5]],
};

const HOME_TRIANGLE_POSITIONS: Record<string, [number, number][]> = {
  yellow: [[8.2,6.5],[8.2,7.5],[7.8,6.75],[7.8,7.25]],
  blue: [[6.5,8.2],[7.5,8.2],[6.75,7.8],[7.25,7.8]],
};

const SAFE_CELLS = [0, 8, 13, 21, 26, 34, 39, 47];
const START_CELLS = { yellow: 26, blue: 39 };

const raceCellPositions: [number, number][] = [
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],
  [8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],
];
const startCells: Record<number, number> = { 1: COLORS.red, 14: COLORS.green, 27: COLORS.yellow, 40: COLORS.blue };
const safeZones = [1, 9, 14, 22, 27, 35, 40, 48];
const safeZoneColors: Record<number, number> = { 1: 0xef6d5e, 9: 0xcccccc, 14: 0x48c76a, 22: 0xcccccc, 27: 0xfcc937, 35: 0xcccccc, 40: 0x72a4f7, 48: 0xcccccc };

function gridToWorld(gx: number, gy: number) {
  const offset = BOARD_TOTAL / 2 - CELL_SIZE / 2;
  return { x: gx * CELL_SIZE - offset, z: gy * CELL_SIZE - offset };
}

// ─── SOUND ENGINE (Web Audio API) ─────────────────────────────────────────────

let _audioCtx: AudioContext | null = null;
function getACtx(): AudioContext | null {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  } catch { return null; }
}

const Sounds = {
  roll() {
    try {
      const c = getACtx(); if (!c) return;
      const len = Math.ceil(c.sampleRate * 0.25);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d   = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = c.createBufferSource(); src.buffer = buf;
      const filter = c.createBiquadFilter();
      filter.type = "bandpass"; filter.frequency.value = 900; filter.Q.value = 0.5;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.45, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.25);
      src.connect(filter); filter.connect(gain); gain.connect(c.destination);
      src.start();
    } catch {}
  },
  hop() {
    try {
      const c = getACtx(); if (!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = "sine"; osc.frequency.setValueAtTime(400, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, c.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.1);
      gain.gain.setValueAtTime(0.12, c.currentTime);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.1);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + 0.1);
    } catch {}
  },
  capture() {
    try {
      const c = getACtx(); if (!c) return;
      const osc = c.createOscillator(); const gain = c.createGain();
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(800, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, c.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, c.currentTime);
      gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.3);
      osc.connect(gain); gain.connect(c.destination);
      osc.start(); osc.stop(c.currentTime + 0.3);
    } catch {}
  },
  win() {
    try {
      const c = getACtx(); if (!c) return;
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => {
        const osc = c.createOscillator(); const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0.28, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.22);
      });
    } catch {}
  },
  lose() {
    try {
      const c = getACtx(); if (!c) return;
      [392, 349, 330, 262].forEach((f, i) => {
        const osc = c.createOscillator(); const gain = c.createGain();
        osc.type = "sine"; osc.frequency.value = f;
        const t = c.currentTime + i * 0.18;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        osc.connect(gain); gain.connect(c.destination);
        osc.start(t); osc.stop(t + 0.24);
      });
    } catch {}
  },
};

// ─── CONFETTI ──────────────────────────────────────────────────────────────────

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    id: i,
    emoji: ["🎉","🏆","⭐","✨","🎊","💛","🎈","🥇"][i % 8],
    x: 5 + Math.random() * 90,
    delay: Math.random() * 0.8,
    dur: 2.2 + Math.random() * 1.8,
    rot: Math.random() * 360,
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 60 }}>
      {pieces.map(p => (
        <motion.div key={p.id}
          style={{ position: "absolute", top: -40, left: `${p.x}%`, fontSize: 22, rotate: p.rot }}
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: "110vh", opacity: [1, 1, 0.3, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: "easeIn" }}>
          {p.emoji}
        </motion.div>
      ))}
    </div>
  );
}

// ─── DICE ─────────────────────────────────────────────────────────────────────

const PIPS: Record<number, [number, number][]> = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]],
};

function Dice3D({ value, rolling, onClick, disabled, playerColor = "#eab308" }: {
  value: number; rolling: boolean; onClick: () => void; disabled: boolean; playerColor?: string;
}) {
  const sz = 56;
  const dots = PIPS[value] ?? PIPS[1];
  return (
    <motion.div
      onClick={!disabled ? onClick : undefined}
      whileTap={!disabled ? { scale: 0.88 } : {}}
      style={{ cursor: disabled ? "not-allowed" : "pointer", userSelect: "none", flexShrink: 0 }}
      animate={rolling
        ? { rotateX: [0, 360, 720, 1080, 1440, 1800], rotateY: [0, 180, 360, 540, 720, 900], scale: [1, 1.4, 0.85, 1.3, 0.95, 1], y: [0, -25, 15, -20, 10, 0] }
        : { rotateX: 0, rotateY: 0, rotateZ: 0, scale: 1, y: 0 }}
      transition={{ duration: 1.0, ease: "easeOut" }}
    >
      <motion.div style={{
        width: sz, height: sz,
        borderRadius: 13,
        background: "#ffffff",
        border: "2.5px solid #111111",
        boxShadow: rolling
          ? `8px 10px 32px rgba(0,0,0,0.9),-4px -4px 12px rgba(255,255,255,0.98),inset 0 4px 8px rgba(255,255,255,0.95),0 0 80px ${playerColor},0 0 160px ${playerColor}cc`
          : disabled
          ? "2px 3px 8px rgba(0,0,0,0.4)"
          : `4px 6px 14px rgba(0,0,0,0.6),-2px -2px 5px rgba(255,255,255,0.7),inset 0 2px 3px rgba(255,255,255,0.6),0 0 22px ${playerColor}80`,
        opacity: disabled && !rolling ? 0.42 : 1,
        transition: "box-shadow 0.22s, opacity 0.22s",
      }}>
        <svg width={sz} height={sz} viewBox="0 0 100 100" style={{ display: "block" }}>
          <rect x={3} y={3} width={93} height={93} rx={14}
            fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={2.5} />
          {dots.map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx+1} cy={cy+1.5} r={8.5} fill="rgba(0,0,0,0.22)" />
              <circle cx={cx} cy={cy} r={8.5} fill="#111111" />
              <circle cx={cx-2.5} cy={cy-2.5} r={2.8} fill="rgba(255,255,255,0.18)" />
            </g>
          ))}
        </svg>
      </motion.div>
    </motion.div>
  );
}

// ─── 3D BOARD BUILDER ─────────────────────────────────────────────────────────

type World = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  boardGroup: THREE.Group;
  tokenMeshes: Record<string, THREE.Group[]>;
  raf: number;
};

function buildBoard(world: World) {
  const bg = world.boardGroup;

  const boardGeo = new THREE.BoxGeometry(BOARD_TOTAL, BOARD_THICKNESS, BOARD_TOTAL);
  const boardMat = new THREE.MeshStandardMaterial({ color: COLORS.white, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 });
  const board = new THREE.Mesh(boardGeo, boardMat);
  board.position.y = -BOARD_THICKNESS / 2 - 2;
  board.receiveShadow = true;
  bg.add(board);

  createBase(bg, 0, 0, COLORS.red);
  createBase(bg, 9, 0, COLORS.green);
  createBase(bg, 0, 9, COLORS.blue);
  createBase(bg, 9, 9, COLORS.yellow);

  raceCellPositions.forEach((pos, idx) => {
    const cellNum = idx + 1;
    const wp = gridToWorld(pos[0], pos[1]);
    let cellColor = COLORS.white;
    if (startCells[cellNum]) cellColor = startCells[cellNum];
    const cellGeo = new THREE.BoxGeometry(CELL_SIZE - 1, 1, CELL_SIZE - 1);
    const cellMat = new THREE.MeshStandardMaterial({ color: cellColor });
    const cell = new THREE.Mesh(cellGeo, cellMat);
    cell.position.set(wp.x, 0.6, wp.z);
    cell.receiveShadow = true;
    bg.add(cell);
    const edges = new THREE.EdgesGeometry(cellGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: COLORS.border });
    const wire = new THREE.LineSegments(edges, lineMat);
    wire.position.set(wp.x, 0.6, wp.z);
    bg.add(wire);
    if (safeZones.includes(cellNum)) createStar(bg, wp.x, wp.z, safeZoneColors[cellNum]);
  });

  const finalPaths = [
    { cells: [[1,7],[2,7],[3,7],[4,7],[5,7]] as [number,number][], color: COLORS.red },
    { cells: [[7,1],[7,2],[7,3],[7,4],[7,5]] as [number,number][], color: COLORS.green },
    { cells: [[13,7],[12,7],[11,7],[10,7],[9,7]] as [number,number][], color: COLORS.yellow },
    { cells: [[7,13],[7,12],[7,11],[7,10],[7,9]] as [number,number][], color: COLORS.blue },
  ];
  finalPaths.forEach(p => {
    p.cells.forEach(c => {
      const wp = gridToWorld(c[0], c[1]);
      const geo = new THREE.BoxGeometry(CELL_SIZE - 1, 1, CELL_SIZE - 1);
      const mat = new THREE.MeshStandardMaterial({ color: p.color });
      const cell = new THREE.Mesh(geo, mat);
      cell.position.set(wp.x, 0.6, wp.z);
      cell.receiveShadow = true;
      bg.add(cell);
      const edges = new THREE.EdgesGeometry(geo);
      const lineMat = new THREE.LineBasicMaterial({ color: COLORS.border });
      const wire = new THREE.LineSegments(edges, lineMat);
      wire.position.set(wp.x, 0.6, wp.z);
      bg.add(wire);
    });
  });

  // Center home (4 triangles)
  const centerSize = 3 * CELL_SIZE, halfSize = centerSize / 2;
  const triangles = [
    { color: COLORS.red, rotation: 0 },
    { color: COLORS.green, rotation: -Math.PI / 2 },
    { color: COLORS.yellow, rotation: Math.PI },
    { color: COLORS.blue, rotation: Math.PI / 2 },
  ];
  triangles.forEach(({ color, rotation }) => {
    const shape = new THREE.Shape();
    shape.moveTo(-halfSize, -halfSize);
    shape.lineTo(0, 0);
    shape.lineTo(-halfSize, halfSize);
    shape.lineTo(-halfSize, -halfSize);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false });
    const mat = new THREE.MeshStandardMaterial({ color });
    const tri = new THREE.Mesh(geo, mat);
    tri.rotation.x = -Math.PI / 2;
    tri.rotation.z = rotation;
    tri.position.y = 0.1;
    bg.add(tri);
  });
}

function createBase(group: THREE.Group, gx: number, gy: number, color: number) {
  const outerGeo = new THREE.BoxGeometry(BASE_SIZE, 0.5, BASE_SIZE);
  const outerMat = new THREE.MeshStandardMaterial({ color });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.position.y = 0.25;
  outer.receiveShadow = true;
  group.add(outer);

  const innerSize = BASE_SIZE - 80;
  const innerGeo = new THREE.BoxGeometry(innerSize, 0.6, innerSize);
  const innerMat = new THREE.MeshStandardMaterial({ color: COLORS.white });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.y = 0.55;
  inner.receiveShadow = true;
  group.add(inner);

  const pos = gridToWorld(gx + 2.5, gy + 2.5);
  group.position.set(pos.x, 0.1, pos.z);
}

function createStar(group: THREE.Group, x: number, z: number, color: number) {
  const shape = new THREE.Shape();
  const outerR = 12, innerR = 5, points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = Math.cos(angle) * r, py = Math.sin(angle) * r;
    i === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mat = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide });
  const star = new THREE.Mesh(geo, mat);
  star.rotation.x = -Math.PI / 2;
  star.position.set(x, 1.2, z);
  group.add(star);
}

function createToken(color: number, colorLight: number): THREE.Group {
  const group = new THREE.Group();
  const outerGeo = new THREE.CylinderGeometry(TOKEN_RADIUS, TOKEN_RADIUS, TOKEN_HEIGHT, 32);
  const outerMat = new THREE.MeshStandardMaterial({ color });
  const outer = new THREE.Mesh(outerGeo, outerMat);
  outer.castShadow = true;
  group.add(outer);
  const innerGeo = new THREE.CylinderGeometry(TOKEN_RADIUS - 3, TOKEN_RADIUS - 3, TOKEN_HEIGHT + 0.5, 32);
  const innerMat = new THREE.MeshStandardMaterial({ color: colorLight });
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.position.y = 0.25;
  inner.castShadow = true;
  group.add(inner);
  group.position.y = TOKEN_HEIGHT / 2 + 0.8;
  return group;
}

function createPlayerTokens(world: World, players: string[]) {
  const colorMap: Record<string, { dark: number; light: number }> = {
    yellow: { dark: COLORS.yellowDark, light: COLORS.yellowLight },
    blue: { dark: COLORS.blueDark, light: COLORS.blueLight },
  };
  players.forEach(player => {
    world.tokenMeshes[player] = [];
    for (let i = 0; i < 4; i++) {
      const token = createToken(colorMap[player].dark, colorMap[player].light);
      const hp = HOME_POSITIONS[player][i];
      const wp = gridToWorld(hp[0], hp[1]);
      token.position.set(wp.x, token.position.y, wp.z);
      token.userData = { player, index: i };
      world.boardGroup.add(token);
      world.tokenMeshes[player].push(token);
    }
  });
}

function getPositionForStep(player: string, tokenIndex: number, pos: number): { x: number; z: number } {
  if (pos === 56) {
    const htp = HOME_TRIANGLE_POSITIONS[player][tokenIndex];
    return gridToWorld(htp[0], htp[1]);
  } else if (pos >= 51) {
    const fp = FINAL_PATHS[player][pos - 51];
    return gridToWorld(fp[0], fp[1]);
  } else if (pos >= 0) {
    const pp = PLAYER_PATHS[player][pos];
    return gridToWorld(pp[0], pp[1]);
  } else {
    const hp = HOME_POSITIONS[player][tokenIndex];
    return gridToWorld(hp[0], hp[1]);
  }
}

function animateTokenMove(world: World, player: string, tokenIndex: number, oldPos: number, newPos: number, callback: () => void) {
  const mesh = world.tokenMeshes[player][tokenIndex];
  const stepDuration = 150, pauseDuration = 50;
  const positions: number[] = [];
  if (oldPos === -1) {
    positions.push(0);
  } else {
    for (let p = oldPos + 1; p <= newPos; p++) positions.push(p);
  }
  let currentStep = 0;

  function animateStep() {
    if (currentStep >= positions.length) { callback(); return; }
    Sounds.hop();
    const target = getPositionForStep(player, tokenIndex, positions[currentStep]);
    const startPos = mesh.position.clone();
    const endPos = new THREE.Vector3(target.x, mesh.position.y, target.z);
    const startTime = performance.now();

    function stepAnim(now: number) {
      const t = Math.min((now - startTime) / stepDuration, 1);
      const easeT = 1 - Math.pow(1 - t, 3);
      mesh.position.lerpVectors(startPos, endPos, easeT);
      const hopHeight = 8;
      const hopProgress = Math.sin(t * Math.PI);
      mesh.position.y = (TOKEN_HEIGHT / 2 + 0.8) + hopProgress * hopHeight;
      if (t < 1) {
        requestAnimationFrame(stepAnim);
      } else {
        currentStep++;
        setTimeout(animateStep, pauseDuration);
      }
    }
    requestAnimationFrame(stepAnim);
  }
  animateStep();
}

function distributeTokensOnCell(world: World, tokens: Record<string, number[]>, players: string[], pos: number, fromPlayer: string) {
  let targetGridPos: [number, number] | null = null;
  if (pos === 56) return;
  else if (pos >= 51 && pos < 56) targetGridPos = FINAL_PATHS[fromPlayer][pos - 51];
  else if (pos >= 0 && pos < 51) targetGridPos = PLAYER_PATHS[fromPlayer][pos];
  else return;
  if (!targetGridPos) return;

  const tokensOnCell: { player: string; index: number; gridPos: [number, number] }[] = [];
  players.forEach(p => {
    tokens[p].forEach((tPos, idx) => {
      if (tPos < 0) return;
      let gridPos: [number, number];
      if (tPos === 56) gridPos = [7, 7];
      else if (tPos >= 51 && tPos < 56) gridPos = FINAL_PATHS[p][tPos - 51];
      else if (tPos >= 0 && tPos < 51) gridPos = PLAYER_PATHS[p][tPos];
      else return;
      if (gridPos[0] === targetGridPos![0] && gridPos[1] === targetGridPos![1]) {
        tokensOnCell.push({ player: p, index: idx, gridPos });
      }
    });
  });

  const spacing = 12;
  const count = tokensOnCell.length;
  tokensOnCell.forEach((tok, i) => {
    const basePos = gridToWorld(tok.gridPos[0], tok.gridPos[1]);
    const mesh = world.tokenMeshes[tok.player][tok.index];
    let offsetX = 0, offsetZ = 0;
    if (count === 1) { offsetX = 0; offsetZ = 0; }
    else if (count === 2) { offsetX = (i - 0.5) * spacing; }
    else if (count === 3) {
      if (i === 0) { offsetX = -spacing * 0.7; offsetZ = -spacing * 0.4; }
      else if (i === 1) { offsetX = spacing * 0.7; offsetZ = -spacing * 0.4; }
      else { offsetZ = spacing * 0.6; }
    } else if (count >= 4) {
      offsetX = (i % 2 === 0 ? -1 : 1) * spacing * 0.5;
      offsetZ = (Math.floor(i / 2) % 2 === 0 ? -1 : 1) * spacing * 0.5;
    }
    mesh.position.x = basePos.x + offsetX;
    mesh.position.z = basePos.z + offsetZ;
  });
}

// ─── BOT AI ────────────────────────────────────────────────────────────────────

type BotTier = "easy" | "medium" | "god";

function chooseBotMove(bTokens: number[], pTokens: number[], value: number): number {
  const valid: number[] = [];
  for (let i = 0; i < 4; i++) {
    const p = bTokens[i];
    if (p === -1) { if (value === 6) valid.push(i); }
    else if (p < 51) { if (p + value <= 56) valid.push(i); }
    else if (p >= 51 && p < 56) { if (p + value <= 56) valid.push(i); }
  }
  if (valid.length === 0) return -1;

  let best = valid[0], bestScore = -1000;
  valid.forEach(i => {
    let score = 0;
    const pos = bTokens[i];
    const newPos = pos === -1 ? 0 : pos + value;
    if (newPos === 56) score += 100;
    if (newPos >= 0 && newPos < 51) {
      const gp = PLAYER_PATHS.blue[newPos];
      for (let j = 0; j < 4; j++) {
        const o = pTokens[j];
        if (o >= 0 && o < 51) {
          const og = PLAYER_PATHS.yellow[o];
          if (gp[0] === og[0] && gp[1] === og[1]) score += 50;
        }
      }
      if (SAFE_CELLS.includes(newPos)) score += 10;
    }
    score += newPos;
    if (pos === -1) score += 5;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface Props { onBack: () => void; initialFee?: number }

export default function SuperLudoGame({ onBack, initialFee = 10 }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();
  const { user }       = useAuth();

  const isFreeMode = initialFee === 0;
  const tier: BotTier = isFreeMode || initialFee < 5 ? "easy" : initialFee < 20 ? "medium" : "god";

  const botRef  = useRef<BotPlayer>(getRandomBot());
  const scored  = useRef(false);
  const sounded = useRef(false);
  const matchStartTime = useRef(Date.now());
  const playerKills = useRef(0);
  const botKills = useRef(0);
  const moveBusy = useRef(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const tokensRef = useRef<Record<string, number[]>>({
    [PLAYER]: [-1, -1, -1, -1],
    [BOT]:    [-1, -1, -1, -1],
  });
  const currentPlayerRef = useRef<string>(PLAYER);
  const lastRollRef = useRef(0);
  const highlightedRef = useRef<number[]>([]);
  const validMovesRef = useRef<number[]>([]);

  const [pTokens, setPTokens] = useState([-1, -1, -1, -1]);
  const [bTokens, setBTokens] = useState([-1, -1, -1, -1]);
  const [pScore, setPScore] = useState(0);
  const [bScore, setBScore] = useState(0);
  const [pMoves, setPMoves] = useState(0);
  const [bMoves, setBMoves] = useState(0);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);
  const [turn, setTurn] = useState<"player" | "bot">("player");
  const [validToks, setValidToks] = useState<number[]>([]);
  const [logMsgs, setLogMsgs] = useState<string[]>(["🎮 Match started! Roll to move!"]);
  const [phase, setPhase] = useState<"matchmaking" | "playing" | "result">("matchmaking");
  const [mmStage, setMmStage] = useState<"searching" | "found">("searching");
  const [emote, setEmote] = useState("");
  const [killFlash, setKillFlash] = useState(false);
  const [turnTimer, setTurnTimer] = useState(15);
  const [matchTimer, setMatchTimer] = useState(120);

  const pushLog = (msg: string) => setLogMsgs(prev => [msg, ...prev.slice(0, 5)]);
  const flashKill = () => { setKillFlash(true); setTimeout(() => setKillFlash(false), 600); };

  // ── Three.js scene setup ────────────────────────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a1628);
    const w = mount.clientWidth, h = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000);
    camera.position.set(0, 650, 550);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.minDistance = 300;
    controls.maxDistance = 1400;

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 400, 200);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const world: World = {
      scene, camera, renderer, controls,
      raycaster: new THREE.Raycaster(),
      mouse: new THREE.Vector2(),
      boardGroup,
      tokenMeshes: {},
      raf: 0,
    };
    worldRef.current = world;

    buildBoard(world);
    createPlayerTokens(world, [PLAYER, BOT]);

    const animate = () => {
      world.raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const ww = mount.clientWidth, hh = mount.clientHeight;
      if (ww === 0 || hh === 0) return;
      camera.aspect = ww / hh;
      camera.updateProjectionMatrix();
      renderer.setSize(ww, hh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(world.raf);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      worldRef.current = null;
    };
  }, []);

  // ── Board click → move selected token ───────────────────────────────────────
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const onClick = (event: MouseEvent) => {
      if (phase !== "playing" || turn !== "player" || rolling || moveBusy.current) return;
      if (highlightedRef.current.length === 0) return;
      const rect = world.renderer.domElement.getBoundingClientRect();
      world.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      world.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      world.raycaster.setFromCamera(world.mouse, world.camera);
      const meshes = world.tokenMeshes[PLAYER].filter((_, i) => highlightedRef.current.includes(i));
      const intersects = world.raycaster.intersectObjects(meshes, true);
      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent && obj.parent !== world.boardGroup) obj = obj.parent;
        const pd = obj?.userData as { player?: string; index?: number } | undefined;
        if (pd && pd.player === PLAYER && typeof pd.index === "number") {
          movePlayerToken(pd.index, lastRollRef.current);
        }
      }
    };
    world.renderer.domElement.addEventListener("click", onClick);
    return () => world.renderer.domElement.removeEventListener("click", onClick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turn, rolling, pTokens]);

  // ── Matchmaking: 8s real-player wait → bot auto-joins ──────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    matchStartTime.current = Date.now();
    const t1 = setTimeout(() => setMmStage("found"), 7500);
    const t2 = setTimeout(() => setPhase("playing"), 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase]);

  // ── 2-min match countdown ───────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => setMatchTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // ── Timer end → result ──────────────────────────────────────────────────────
  useEffect(() => {
    if (matchTimer !== 0 || phase !== "playing" || scored.current) return;
    scored.current = true;
    setPhase("result");
    finishMatch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchTimer, phase]);

  // ── Win/lose sound on result ────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "result" || sounded.current) return;
    sounded.current = true;
    const won = pScore > bScore;
    setTimeout(() => { if (won) Sounds.win(); else Sounds.lose(); }, 300);
  }, [phase, pScore, bScore]);

  // ── Turn timer (player) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    if (turn === "player") setTurnTimer(15);
  }, [turn, phase]);

  useEffect(() => {
    if (phase !== "playing" || turn !== "player" || rolling || turnTimer <= 0) return;
    const id = setInterval(() => setTurnTimer(prev => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(id);
  }, [phase, turn, rolling, turnTimer]);

  // ── Auto-act on player turn timer = 0 ───────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || turn !== "player" || turnTimer !== 0 || rolling || moveBusy.current || scored.current) return;
    if (validMovesRef.current.length > 0) {
      const best = validMovesRef.current.reduce((a, b) => (tokensRef.current[PLAYER][a] > tokensRef.current[PLAYER][b] ? a : b));
      pushLog(`⏱️ Time's up! Auto-picking token ${best + 1}…`);
      movePlayerToken(best, lastRollRef.current);
      return;
    }
    pushLog("⏱️ Auto-roll!");
    const val = Math.ceil(Math.random() * 6);
    lastRollRef.current = val;
    setDice(val);
    setRolling(true);
    Sounds.roll();
    setTimeout(() => {
      setRolling(false);
      const valid = pTokens.map((s, ti) => ({ s, ti })).filter(({ s }) => s === -1 ? val === 6 : (s < 51 ? s + val <= 56 : s >= 51 && s + val <= 56)).map(({ ti }) => ti);
      if (valid.length === 0) {
        pushLog(`Auto-roll ${val} — no valid move. Skipped!`);
        setTurn("bot");
        return;
      }
      const best = valid.reduce((a, b) => (tokensRef.current[PLAYER][a] > tokensRef.current[PLAYER][b] ? a : b));
      setTimeout(() => movePlayerToken(best, val), 200);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnTimer, phase, turn]);

  // ── Bot AI turn ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (turn !== "bot" || phase !== "playing" || rolling || moveBusy.current || scored.current) return;
    const delay = tier === "god" ? 700 : tier === "medium" ? 1000 : 1300;

    const t = setTimeout(() => {
      const val = rollDiceVal(tier === "god");
      lastRollRef.current = val;
      setDice(val);
      setRolling(true);
      Sounds.roll();

      setTimeout(() => {
        setRolling(false);
        const chosen = chooseBotMove([...tokensRef.current[BOT]], [...tokensRef.current[PLAYER]], val);

        if (chosen === -1) {
          pushLog(`🔵 ${botRef.current.name} rolled ${val} — no valid move. Skip!`);
          setBMoves(m => m + 1);
          setTurn("player");
          return;
        }
        moveBotToken(chosen, val);
      }, 700);
    }, delay);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, phase, rolling]);

  // ── Roll dice value (god mode weighted) ─────────────────────────────────────
  function rollDiceVal(godMode: boolean): number {
    if (godMode) {
      const r = Math.random();
      if (r < 0.28) return 6;
      if (r < 0.50) return 5;
      if (r < 0.70) return 4;
      if (r < 0.85) return 3;
      if (r < 0.95) return 2;
      return 1;
    }
    return Math.ceil(Math.random() * 6);
  }

  // ── Player roll ─────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (rolling || turn !== "player" || moveBusy.current || scored.current) return;
    if (validToks.length > 0) return;
    const val = rollDiceVal(false);
    lastRollRef.current = val;
    setDice(val);
    setRolling(true);
    Sounds.roll();

    setTimeout(() => {
      setRolling(false);
      const valid = pTokens.map((s, ti) => ({ s, ti })).filter(({ s }) => s === -1 ? val === 6 : (s < 51 ? s + val <= 56 : s >= 51 && s + val <= 56)).map(({ ti }) => ti);

      if (valid.length === 0) {
        pushLog(`Rolled ${val} — no valid move. Turn skipped!`);
        setPMoves(m => m + 1);
        setTurn("bot");
        return;
      }
      if (valid.length === 1) {
        setTimeout(() => movePlayerToken(valid[0], val), 200);
        return;
      }
      validMovesRef.current = valid;
      setValidToks(valid);
      pushLog(`Rolled ${val} — tap a token on the board!`);
    }, 700);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolling, turn, pTokens, validToks]);

  // ── Move player token ───────────────────────────────────────────────────────
  function movePlayerToken(ti: number, diceVal: number) {
    setValidToks([]);
    validMovesRef.current = [];
    highlightedRef.current = [];
    moveBusy.current = true;

    const oldStep = tokensRef.current[PLAYER][ti];
    let ns = oldStep === -1 ? 0 : oldStep + diceVal;
    if (ns > 56) ns = oldStep; // can't happen with <= check, safety

    tokensRef.current[PLAYER][ti] = ns;
    setPTokens(prev => { const np = [...prev]; np[ti] = ns; return np; });

    let killed = false;
    let killPts = 0;
    const nPos = ns >= 0 && ns < 51 ? PLAYER_PATHS[PLAYER][ns] : null;

    animateTokenMove(worldRef.current!, PLAYER, ti, oldStep, ns, () => {
      if (nPos) {
        const botArr = tokensRef.current[BOT];
        for (let i = 0; i < botArr.length; i++) {
          const oPos = botArr[i];
          if (oPos >= 0 && oPos < 51) {
            const og = PLAYER_PATHS[BOT][oPos];
            if (og[0] === nPos[0] && og[1] === nPos[1] && !SAFE_CELLS.includes(ns) && ns !== START_CELLS[PLAYER]) {
              killPts = oPos;
              botArr[i] = -1;
              const hp = HOME_POSITIONS[BOT][i];
              const wp = gridToWorld(hp[0], hp[1]);
              worldRef.current!.tokenMeshes[BOT][i].position.set(wp.x, worldRef.current!.tokenMeshes[BOT][i].position.y, wp.z);
              killed = true;
              playerKills.current++;
              Sounds.capture();
              flashKill();
              setEmote("💥");
              setTimeout(() => setEmote(""), 1200);
              pushLog(`💥 KILL! ${botRef.current.name}'s token sent back! +${KILL_BONUS} pts`);
              setBScore(s => Math.max(0, s - killPts));
            }
          }
        }
        setBTokens([...botArr]);
      }

      const moved = oldStep === -1 ? 6 : ns - oldStep;
      let pts = moved + (killed ? KILL_BONUS : 0);
      if (ns >= 56) {
        pts += HOME_SCORE;
        pushLog(`🏠 Token ${ti + 1} HOME! +${moved + HOME_SCORE}${killed ? `+${KILL_BONUS}` : ""} pts! 🎉`);
      } else if (!killed) {
        pushLog(`Rolled ${diceVal} → +${moved} pts${diceVal === 6 ? " 🎲 EXTRA TURN!" : ""}`);
      }

      setPScore(s => s + pts);
      setPMoves(m => m + 1);
      moveBusy.current = false;

      // redistribute stack
      if (oldStep >= 0) distributeTokensOnCell(worldRef.current!, tokensRef.current, [PLAYER, BOT], oldStep, PLAYER);
      distributeTokensOnCell(worldRef.current!, tokensRef.current, [PLAYER, BOT], ns, PLAYER);

      if (ns >= 56 && tokensRef.current[PLAYER].every(t => t === 56)) {
        setPhase("result");
        finishMatch();
        return;
      }

      const getExtra = diceVal === 6 || killed;
      if (!getExtra) setTurn("bot");
    });
  }

  // ── Move bot token ──────────────────────────────────────────────────────────
  function moveBotToken(ti: number, diceVal: number) {
    moveBusy.current = true;

    const oldStep = tokensRef.current[BOT][ti];
    let ns = oldStep === -1 ? 0 : oldStep + diceVal;
    if (ns > 56) ns = oldStep;

    tokensRef.current[BOT][ti] = ns;
    setBTokens(prev => { const nb = [...prev]; nb[ti] = ns; return nb; });

    let killed = false;
    let killPts = 0;
    const nPos = ns >= 0 && ns < 51 ? PLAYER_PATHS[BOT][ns] : null;

    animateTokenMove(worldRef.current!, BOT, ti, oldStep, ns, () => {
      if (nPos) {
        const pArr = tokensRef.current[PLAYER];
        for (let i = 0; i < pArr.length; i++) {
          const oPos = pArr[i];
          if (oPos >= 0 && oPos < 51) {
            const og = PLAYER_PATHS[PLAYER][oPos];
            if (og[0] === nPos[0] && og[1] === nPos[1] && !SAFE_CELLS.includes(ns) && ns !== START_CELLS[BOT]) {
              killPts = oPos;
              pArr[i] = -1;
              const hp = HOME_POSITIONS[PLAYER][i];
              const wp = gridToWorld(hp[0], hp[1]);
              worldRef.current!.tokenMeshes[PLAYER][i].position.set(wp.x, worldRef.current!.tokenMeshes[PLAYER][i].position.y, wp.z);
              killed = true;
              botKills.current++;
              Sounds.capture();
              flashKill();
              setEmote(EMOTES[Math.floor(Math.random() * EMOTES.length)]);
              setTimeout(() => setEmote(""), 1200);
              pushLog(`💀 ${botRef.current.name} killed your token! +${KILL_BONUS} | You -${killPts} pts`);
              setPScore(s => Math.max(0, s - killPts));
            }
          }
        }
        setPTokens([...pArr]);
      }

      const moved = oldStep === -1 ? 6 : ns - oldStep;
      let pts = moved + (killed ? KILL_BONUS : 0);
      if (ns >= 56) {
        pts += HOME_SCORE;
        pushLog(`🔵 ${botRef.current.name} token HOME! +${moved + HOME_SCORE} pts 🎉`);
      } else if (!killed) {
        pushLog(`🔵 ${botRef.current.name} rolled ${diceVal} → +${pts} pts`);
      }

      setBScore(s => s + pts + (killed ? KILL_BONUS : 0));
      setBMoves(m => m + 1);
      moveBusy.current = false;

      if (oldStep >= 0) distributeTokensOnCell(worldRef.current!, tokensRef.current, [PLAYER, BOT], oldStep, BOT);
      distributeTokensOnCell(worldRef.current!, tokensRef.current, [PLAYER, BOT], ns, BOT);

      if (ns >= 56 && tokensRef.current[BOT].every(t => t === 56)) {
        setPhase("result");
        finishMatch();
        return;
      }

      const getExtra = diceVal === 6 || killed;
      if (!getExtra) setTurn("player");
    });
  }

  // ── Finish match: credit wallet + save result + history ────────────────────
  function finishMatch() {
    const won = !scored.current ? pScore > bScore : pScore > bScore;
    const prize = (!isFreeMode && won) ? Math.floor(initialFee * 2 * 0.9) : 0;
    const duration = Math.floor((Date.now() - matchStartTime.current) / 1000);

    if (user?.uid) {
      saveLudoMatchResult({
        uid: user.uid,
        opponentName: botRef.current.name,
        opponentIsBot: true,
        playerScore: pScore,
        opponentScore: bScore,
        won,
        entryFee: initialFee,
        prizeAmount: prize,
        tier,
        duration,
        moves: pMoves,
        kills: playerKills.current,
        forfeited: false,
      }).catch(console.error);
    }

    if (!isFreeMode && won) {
      addWinning(prize, "Super Ludo Win");
    }

    addMatch({
      gameId: "superludo",
      gameName: isFreeMode ? "Super Ludo (Practice)" : "Super Ludo",
      gameIcon: "🎲",
      result: won ? "win" : "loss",
      entryFee: initialFee,
      prize,
      userScore: pScore,
      opponentScore: bScore,
      opponentName: botRef.current.name,
    });
  }

  const canRoll = turn === "player" && !rolling && !moveBusy.current && validToks.length === 0 && pMoves < 100 && phase === "playing";
  const prize = (!isFreeMode && pScore > bScore) ? Math.floor(initialFee * 2 * 0.9) : 0;

  // ─── MATCHMAKING SCREEN ─────────────────────────────────────────────────────
  if (phase === "matchmaking") {
    const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";
    const tierLabel = tier === "god" ? "⚡ GOD MODE" : tier === "medium" ? "🔶 MEDIUM" : "🟢 EASY";
    const prizeAmt = isFreeMode ? null : Math.floor(initialFee * 2 * 0.9);

    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-5"
        style={{ background: "linear-gradient(180deg,#06080f 0%,#120630 50%,#06080f 100%)", maxWidth: 480, margin: "0 auto" }}>

        <motion.div initial={{ opacity: 0, y: -18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mb-10 text-center">
          <p className="text-[10px] font-black tracking-[0.25em] mb-2.5" style={{ color: "rgba(147,51,234,0.6)" }}>
            {mmStage === "searching" ? "SUPER LUDO · SEARCHING…" : "SUPER LUDO · MATCH FOUND"}
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {!isFreeMode && (
              <span className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.28)", color: "#FFD700" }}>
                💰 Entry ₹{initialFee}
              </span>
            )}
            <span className="px-3 py-1.5 rounded-full text-xs font-black"
              style={{ background: `${tierColor}18`, border: `1px solid ${tierColor}40`, color: tierColor }}>
              {tierLabel}
            </span>
            {prizeAmt !== null && (
              <span className="px-3 py-1.5 rounded-full text-xs font-black"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}>
                🏆 Win ₹{prizeAmt}
              </span>
            )}
          </div>
        </motion.div>

        <div className="w-full flex items-center justify-center gap-3 mb-10">
          {/* YOU */}
          <motion.div initial={{ opacity: 0, x: -48 }} animate={{ opacity: 1, x: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 22, delay: 0.1 }}
            className="flex flex-col items-center gap-3 flex-1">
            <div className="relative">
              <motion.div className="absolute rounded-full pointer-events-none"
                style={{ inset: -7, border: "2.5px solid #eab308", borderRadius: "50%" }}
                animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.2, 0.75] }}
                transition={{ duration: 1.9, repeat: Infinity }} />
              <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center text-3xl"
                style={{ background: "linear-gradient(135deg,#eab308 0%,#92400e 100%)", border: "3.5px solid #eab308", boxShadow: "0 0 28px rgba(234,179,8,0.65),0 0 56px rgba(234,179,8,0.25)" }}>
                🎲
              </div>
              <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full flex items-center justify-center"
                style={{ background: "#22c55e", border: "2.5px solid #06080f" }} />
            </div>
            <div className="text-center">
              <div className="font-black text-white text-base leading-tight">YOU</div>
              <div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(234,179,8,0.85)" }}>🟡 Yellow</div>
            </div>
          </motion.div>

          {/* VS */}
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 18, delay: 0.28 }}
            className="shrink-0 flex flex-col items-center gap-1">
            <div className="w-[58px] h-[58px] rounded-full flex items-center justify-center font-black text-lg"
              style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", boxShadow: "0 0 22px rgba(168,85,247,0.65),0 0 44px rgba(168,85,247,0.25)", color: "#fff", letterSpacing: "-0.02em" }}>
              VS
            </div>
            <div className="w-px h-6" style={{ background: "linear-gradient(to bottom,rgba(168,85,247,0.5),transparent)" }} />
          </motion.div>

          {/* OPPONENT */}
          <AnimatePresence mode="wait">
            {mmStage === "searching" ? (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <motion.div className="w-[88px] h-[88px] rounded-full flex items-center justify-center"
                    style={{ background: "rgba(59,130,246,0.07)", border: "2px dashed rgba(59,130,246,0.3)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <motion.span style={{ fontSize: 34 }} animate={{ rotate: 360 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}>
                      🔍
                    </motion.span>
                  </motion.div>
                </div>
                <div className="text-center">
                  <div className="font-black text-white text-sm">Finding Players</div>
                  <motion.div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(59,130,246,0.6)" }}
                    animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity }}>
                    Bot joins in 8s if none found…
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <motion.div key="found" initial={{ opacity: 0, x: 48, scale: 0.85 }} animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }} className="flex flex-col items-center gap-3 flex-1">
                <div className="relative">
                  <motion.div className="absolute rounded-full pointer-events-none"
                    style={{ inset: -7, border: "2.5px solid #3b82f6", borderRadius: "50%" }}
                    animate={{ scale: [1, 1.14, 1], opacity: [0.75, 0.2, 0.75] }}
                    transition={{ duration: 1.9, repeat: Infinity, delay: 0.4 }} />
                  <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center overflow-hidden"
                    style={{ background: `linear-gradient(135deg,${botRef.current.avatarColor}cc 0%,#1e1b4b 100%)`, border: `3.5px solid ${botRef.current.avatarColor}`, boxShadow: `0 0 28px ${botRef.current.avatarColor}99,0 0 56px ${botRef.current.avatarColor}33` }}>
                    <span className="font-black text-white" style={{ fontSize: 38, lineHeight: 1 }}>{botRef.current.initial}</span>
                  </div>
                  <div className="absolute bottom-1 right-1 w-[18px] h-[18px] rounded-full" style={{ background: "#22c55e", border: "2.5px solid #06080f" }} />
                </div>
                <div className="text-center">
                  <div className="font-black text-white text-base leading-tight">{botRef.current.name}</div>
                  <div className="text-[11px] font-bold mt-0.5" style={{ color: "rgba(59,130,246,0.85)" }}>📍 {botRef.current.city}</div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Match stats */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
          className="w-full rounded-2xl px-4 py-3.5 mb-8 flex items-center justify-around"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
          {[
            { label: "Timer", value: "2 min" },
            { label: "Kill Bonus", value: "+15 pts" },
            { label: "Home Bonus", value: "+25 pts" },
            { label: "Winner", value: "Top Score" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col items-center gap-0.5">
              <div className="text-[9px] font-black tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.28)" }}>{label}</div>
              <div className="text-xs font-black" style={{ color: "#FFD700" }}>{value}</div>
            </div>
          ))}
        </motion.div>

        {/* Loading bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="w-full">
          <div className="h-[5px] rounded-full overflow-hidden mb-2.5" style={{ background: "rgba(255,255,255,0.07)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg,#9333ea 0%,#a855f7 50%,#3b82f6 100%)" }}
              initial={{ width: "0%" }} animate={{ width: "100%" }}
              transition={{ duration: 7.4, ease: "linear" }} />
          </div>
          <motion.p className="text-center text-[11px] font-bold" style={{ color: "rgba(255,255,255,0.3)" }}
            animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1.1, repeat: Infinity }}>
            {mmStage === "searching" ? "⏳ Waiting for a real player (8s)…" : "🤖 Bot joined! Setting up the board…"}
          </motion.p>
        </motion.div>
      </div>
    );
  }

  // ─── RESULT SCREEN ──────────────────────────────────────────────────────────
  if (phase === "result") {
    const won = pScore > bScore;
    const resultIcon = won ? "🏆" : "😔";
    const resultText = won ? "VICTORY!" : "DEFEATED";

    return (
      <div className="flex flex-col min-h-screen items-center justify-center gap-5 px-5 relative"
        style={{ background: won ? "linear-gradient(180deg,#052010,#0a3520,#052010)" : "linear-gradient(180deg,#1a0510,#2d0a18,#1a0510)", maxWidth: 480, margin: "0 auto" }}>
        {won && <Confetti />}

        <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200 }} className="text-8xl"
          style={{ filter: `drop-shadow(0 0 30px ${won ? "rgba(255,215,0,0.9)" : "rgba(239,68,68,0.7)"})` }}>
          {resultIcon}
        </motion.div>

        <div className="text-center">
          <motion.h2 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="text-4xl font-black" style={{ color: won ? "#FFD700" : "#ef4444" }}>
            {resultText}
          </motion.h2>
          {won && !isFreeMode && prize > 0 && (
            <>
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                className="mt-2 text-3xl font-black" style={{ color: "#4ade80", textShadow: "0 0 20px rgba(74,222,128,0.6)" }}>+₹{prize}</motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                className="mt-3 px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: "rgba(74,222,128,0.15)", border: "1.5px solid rgba(74,222,128,0.4)", color: "#4ade80" }}>
                ✅ Wallet Updated Successfully
              </motion.div>
            </>
          )}
          {isFreeMode && (
            <div className="mt-2 text-sm font-bold" style={{ color: "rgba(16,185,129,0.8)" }}>Practice Match</div>
          )}
          {!won && !isFreeMode && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="mt-2 text-xl font-bold" style={{ color: "#ef4444" }}>-₹{initialFee}</motion.div>
          )}
        </div>

        {/* Score breakdown */}
        <div className="w-full rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          <div className="flex">
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(234,179,8,0.1)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(234,179,8,0.75)" }}>YOU 🟡</div>
              <div className="text-3xl font-black" style={{ color: "#eab308" }}>{pScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
            </div>
            <div className="flex-1 p-4 text-center" style={{ background: "rgba(59,130,246,0.1)" }}>
              <div className="text-[10px] font-black uppercase tracking-wider mb-1" style={{ color: "rgba(59,130,246,0.7)" }}>{botRef.current.name.slice(0, 8)}</div>
              <div className="text-3xl font-black" style={{ color: "#3b82f6" }}>{bScore}</div>
              <div className="text-[9px] font-bold mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>points</div>
            </div>
          </div>
          <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: "rgba(255,255,255,0.03)" }}>
            <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Entry Fee</span>
            <span className="text-sm font-black" style={{ color: isFreeMode ? "#10b981" : "#FFD700" }}>
              {isFreeMode ? "FREE" : `₹${initialFee}`}
            </span>
          </div>
          {!isFreeMode && (
            <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>{won ? "You Won" : "You Lost"}</span>
              <span className="text-sm font-black" style={{ color: won ? "#4ade80" : "#ef4444" }}>
                {won ? `+₹${prize}` : `-₹${initialFee}`}
              </span>
            </div>
          )}
        </div>

        <motion.button whileTap={{ scale: 0.96 }} onClick={onBack}
          className="w-full py-4 rounded-2xl font-black text-base cursor-pointer relative overflow-hidden"
          style={{ background: "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", boxShadow: "0 0 24px rgba(168,85,247,0.4)" }}>
          Back to Games
        </motion.button>
      </div>
    );
  }

  // ─── PLAYING SCREEN ─────────────────────────────────────────────────────────
  const tierColor = tier === "god" ? "#ff3b5c" : tier === "medium" ? "#f97316" : "#4ade80";
  const tierLabel = tier === "god" ? "⚡ GOD" : tier === "medium" ? "🔶 MED" : "🟢 EASY";

  return (
    <div className="flex flex-col min-h-screen"
      style={{ background: "linear-gradient(180deg,#060b18 0%,#120630 100%)", maxWidth: 480, margin: "0 auto" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <button onClick={onBack} className="w-9 h-9 flex items-center justify-center rounded-xl cursor-pointer"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)", fontSize: 18 }}>
          ←
        </button>
        <div className="text-center">
          <div className="font-black text-white text-sm tracking-widest">SUPER LUDO</div>
          <div className="text-[9px] font-bold" style={{ color: "rgba(168,85,247,0.7)" }}>
            {isFreeMode ? "PRACTICE" : `₹${initialFee} · Win ₹${Math.floor(initialFee * 2 * 0.9)}`}
          </div>
        </div>
        <div className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 16 }}>
          🎲
        </div>
      </div>

      {/* ── 2-MIN TIMER (top) ── */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="rounded-2xl px-3 py-2 flex items-center justify-center relative"
          style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-[9px] font-black tracking-widest mr-2" style={{ color: "rgba(255,255,255,0.35)" }}>⏱</span>
          <motion.div
            animate={{ scale: matchTimer <= 30 ? [1, 1.08, 1] : 1 }}
            transition={{ duration: 0.4, repeat: matchTimer <= 30 ? Infinity : 0 }}
            className="text-2xl font-black tabular-nums"
            style={{
              color: matchTimer <= 30 ? "#ef4444" : matchTimer <= 60 ? "#f97316" : "#FFD700",
              textShadow: matchTimer <= 30 ? "0 0 20px rgba(239,68,68,1),0 0 40px rgba(239,68,68,0.6)" : matchTimer <= 60 ? "0 0 16px rgba(249,115,22,0.85)" : "0 0 14px rgba(255,215,0,0.8)",
              letterSpacing: 1.5,
            }}>
            {String(Math.floor(matchTimer / 60)).padStart(2, "0")}:{String(matchTimer % 60).padStart(2, "0")}
          </motion.div>
          <span className="absolute right-2 text-[9px] font-black px-2 py-0.5 rounded-full"
            style={{ background: `${tierColor}18`, color: tierColor, border: `1px solid ${tierColor}40` }}>
            {tierLabel}
          </span>
        </div>
      </div>

      {/* ── Your Score / Opponent Score (below timer) ── */}
      <div className="px-3 pb-2 flex gap-2 flex-shrink-0">
        <motion.div className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center"
          animate={{ boxShadow: turn === "player" ? "0 0 24px rgba(234,179,8,0.8),0 0 48px rgba(234,179,8,0.35)" : "none" }}
          style={{ background: turn === "player" ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.04)", border: `2px solid ${turn === "player" ? "#eab308" : "rgba(255,255,255,0.07)"}` }}>
          <span className="text-[10px] font-black tracking-wider" style={{ color: "#eab308" }}>YOUR SCORE</span>
          <motion.span key={pScore} className="text-2xl font-black leading-none" style={{ color: "#eab308", textShadow: "0 0 12px rgba(234,179,8,0.65)" }}
            initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
            {pScore}
          </motion.span>
        </motion.div>
        <motion.div className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center"
          animate={{ boxShadow: turn === "bot" ? "0 0 24px rgba(59,130,246,0.8),0 0 48px rgba(59,130,246,0.35)" : "none" }}
          style={{ background: turn === "bot" ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.04)", border: `2px solid ${turn === "bot" ? "#3b82f6" : "rgba(255,255,255,0.07)"}` }}>
          <span className="text-[10px] font-black tracking-wider truncate max-w-full" style={{ color: "#3b82f6" }}>{botRef.current.name.slice(0, 10)}</span>
          <motion.span key={bScore} className="text-2xl font-black leading-none" style={{ color: "#3b82f6", textShadow: "0 0 12px rgba(59,130,246,0.6)" }}
            initial={{ scale: 1.4 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }}>
            {bScore}
          </motion.span>
        </motion.div>
      </div>

      {/* ── Turn indicator strip ── */}
      <div className="flex items-center justify-between px-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background: "#eab308", boxShadow: turn === "player" ? "0 0 8px #eab308" : "none" }}
            animate={turn === "player" ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.7, repeat: Infinity }} />
          <span className="text-[10px] font-black" style={{ color: turn === "player" ? "#eab308" : "rgba(255,255,255,0.3)" }}>YOU 🟡</span>
          {turn === "player" && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "#eab308", color: "#000" }}>TURN</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-black" style={{ color: turn === "bot" ? "#3b82f6" : "rgba(255,255,255,0.3)" }}>{botRef.current.name}</span>
          {turn === "bot" && (
            <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full" style={{ background: "#3b82f6", color: "#fff" }}>TURN</span>
          )}
          <motion.div className="w-2.5 h-2.5 rounded-full" style={{ background: "#3b82f6", boxShadow: turn === "bot" ? "0 0 8px #3b82f6" : "none" }}
            animate={turn === "bot" ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.7, repeat: Infinity }} />
        </div>
      </div>

      {/* ── 3D Board ── */}
      <div className="flex-1 relative px-2 min-h-[340px]">
        <AnimatePresence>
          {killFlash && (
            <motion.div className="absolute inset-0 rounded-xl pointer-events-none z-10"
              initial={{ opacity: 0 }} animate={{ opacity: [0, 0.35, 0] }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ background: "radial-gradient(circle,rgba(255,59,92,0.7) 0%,transparent 70%)" }} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {emote && (
            <motion.div className="absolute top-1/2 left-1/2 z-20 pointer-events-none"
              initial={{ scale: 0, opacity: 1, x: "-50%", y: "-50%" }} animate={{ scale: 2.5, opacity: 0, y: "-120%" }}
              exit={{ opacity: 0 }} transition={{ duration: 1.0 }} style={{ fontSize: 32 }}>
              {emote}
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={mountRef} className="w-full h-full rounded-2xl overflow-hidden"
          style={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.08)", minHeight: 340, boxShadow: "0 0 40px rgba(0,0,0,0.6)" }} />
        {validToks.length > 0 && (
          <div className="absolute bottom-2 inset-x-0 z-20 flex justify-center">
            <div className="px-4 py-2 rounded-full text-xs font-black animate-pulse"
              style={{ background: "rgba(234,179,8,0.9)", color: "#000", boxShadow: "0 0 20px rgba(234,179,8,0.6)" }}>
              🎯 Tap a glowing token to move!
            </div>
          </div>
        )}
      </div>

      {/* ── Two dice (Player left, Bot right) ── */}
      <div className="flex-shrink-0 px-3 pb-4 pt-2">
        <div className="flex items-end gap-2">
          {/* YELLOW DICE (Player) */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className="text-[8px] font-black uppercase tracking-wide" style={{ color: turn === "player" ? "#eab308" : "rgba(255,255,255,0.22)" }}>
              🟡 YOU
            </span>
            <motion.div
              animate={{ boxShadow: turn === "player" ? "0 0 20px rgba(234,179,8,0.55),0 0 40px rgba(234,179,8,0.22)" : "none" }}
              style={{ borderRadius: 13, padding: 5, background: turn === "player" ? "rgba(234,179,8,0.12)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${turn === "player" ? "rgba(234,179,8,0.5)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.35s" }}>
              <Dice3D value={dice} rolling={rolling && turn === "player"} onClick={handleRoll} disabled={!canRoll} playerColor="#eab308" />
            </motion.div>
            <span className="text-[9px] font-black min-h-[13px]" style={{ color: canRoll ? "#eab308" : "rgba(255,255,255,0.22)" }}>
              {canRoll ? "TAP ROLL" : validToks.length > 0 ? "PICK TOKEN" : turn === "bot" ? "WAIT…" : ""}
            </span>
          </div>

          {/* Event log */}
          <div className="flex-1 min-w-0">
            <div className="rounded-xl px-3 py-2" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <AnimatePresence mode="popLayout">
                {logMsgs.slice(0, 2).map((msg, i) => (
                  <motion.div key={msg + i} initial={{ opacity: 0, y: -6 }} animate={{ opacity: i === 0 ? 1 : 0.4 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }} className="text-[10px] font-bold truncate"
                    style={{ color: i === 0 ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)" }}>
                    {msg}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {/* Turn timer bar */}
            {turn === "player" && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(turnTimer / 15) * 100}%`, background: turnTimer > 8 ? "#4ade80" : turnTimer > 4 ? "#f97316" : "#ef4444", transition: "width 0.9s linear" }} />
                </div>
                <span className="text-[9px] font-black flex-shrink-0" style={{ color: turnTimer > 8 ? "#4ade80" : turnTimer > 4 ? "#f97316" : "#ef4444" }}>{turnTimer}s</span>
              </div>
            )}
          </div>

          {/* BLUE DICE (Bot) */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <span className="text-[8px] font-black uppercase tracking-wide" style={{ color: turn === "bot" ? "#3b82f6" : "rgba(255,255,255,0.22)" }}>
              🔵 BOT
            </span>
            <motion.div
              animate={{ boxShadow: turn === "bot" ? "0 0 20px rgba(59,130,246,0.55),0 0 40px rgba(59,130,246,0.22)" : "none" }}
              style={{ borderRadius: 13, padding: 5, background: turn === "bot" ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)", border: `1.5px solid ${turn === "bot" ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.07)"}`, transition: "all 0.35s" }}>
              <Dice3D value={dice} rolling={rolling && turn === "bot"} onClick={() => {}} disabled={true} playerColor="#3b82f6" />
            </motion.div>
            <span className="text-[9px] font-black min-h-[13px]" style={{ color: turn === "bot" && !rolling ? "#3b82f6" : "rgba(255,255,255,0.22)" }}>
              {turn === "bot" && rolling ? "ROLLING…" : turn === "bot" ? "THINKING…" : ""}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
