import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useMatchHistory } from "@/context/useMatchHistory";

// ── Canvas virtual dimensions ─────────────────────────────────────────────────
const CW = 390;
const CH = 700;
const GAME_DURATION = 65; // 01:05

// ── Perspective constants ─────────────────────────────────────────────────────
const HORIZON_Y = CH * 0.30;
const HORIZON_X = CW / 2;
const PLAYER_Y  = CH * 0.81;

// Lane x-positions at horizon and at player level
const LANE_TOP  = [HORIZON_X - 14, HORIZON_X,     HORIZON_X + 14];
const LANE_BOT  = [CW / 2 - 92,    CW / 2,         CW / 2 + 92];

function laneToX(lane: number, z: number) { return LANE_TOP[lane] + (LANE_BOT[lane] - LANE_TOP[lane]) * z; }
function zToY   (z: number)               { return HORIZON_Y + (PLAYER_Y - HORIZON_Y) * z; }
function zToS   (z: number)               { return 0.06 + z * 0.94; }

// ── Types ─────────────────────────────────────────────────────────────────────
type ObType  = "train" | "barrier" | "block";
type PupType = "magnet" | "jetpack";
type ObjKind = "coin" | "obstacle" | "powerup";
type PState  = "run" | "jump" | "slide";

interface GO {
  id: number; lane: number; z: number;
  kind: ObjKind; sub?: ObType | PupType;
  gone: boolean;
}

interface GS {
  running: boolean; started: boolean; over: boolean;
  timeLeft: number; score: number; coins: number; dist: number;
  lane: number; targetLane: number; laneX: number;
  pstate: PState; jumpT: number; jumpY: number; slideT: number;
  speed: number; objects: GO[]; spawnT: number;
  magnet: boolean; magnetT: number;
  jetpack: boolean; jetpackT: number;
  botScore: number; frame: number; lastTs: number; nextId: number;
  crashed: boolean;
}

interface Props { onBack: () => void; initialFee: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);    ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);    ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);        ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MetroSurferGame({ onBack, initialFee }: Props) {
  const { addWinning } = useWallet();
  const { addMatch }   = useMatchHistory();
  const isFreeMode     = initialFee === 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gsRef     = useRef<GS | null>(null);
  const rafRef    = useRef(0);
  const swipeRef  = useRef<{ x: number; y: number } | null>(null);
  const loopRef   = useRef<(ts: number) => void>(() => {});

  const [ui, setUi] = useState({
    score: 0, coins: 0, timeLeft: GAME_DURATION,
    botScore: 0, over: false, started: false,
    magnet: false, jetpack: false, crashed: false,
  });

  // ── Init ──────────────────────────────────────────────────────────────────
  function mkGS(): GS {
    return {
      running: false, started: false, over: false,
      timeLeft: GAME_DURATION, score: 0, coins: 0, dist: 0,
      lane: 1, targetLane: 1, laneX: LANE_BOT[1],
      pstate: "run", jumpT: 0, jumpY: 0, slideT: 0,
      speed: 0.55, objects: [], spawnT: 0,
      magnet: false, magnetT: 0, jetpack: false, jetpackT: 0,
      botScore: 0, frame: 0, lastTs: 0, nextId: 0, crashed: false,
    };
  }

  // ── Spawn objects ─────────────────────────────────────────────────────────
  function spawnObjs(gs: GS) {
    const prog = 1 - gs.timeLeft / GAME_DURATION;
    const r    = Math.random();

    if (r < 0.48) {
      // Coin row in a lane
      const lane = Math.floor(Math.random() * 3);
      const n    = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < n; i++)
        gs.objects.push({ id: gs.nextId++, lane, z: -(i * 0.065) - 0.04, kind: "coin", gone: false });

    } else if (r < 0.62) {
      // Powerup (occasional)
      if (Math.random() < 0.3) {
        gs.objects.push({
          id: gs.nextId++, lane: Math.floor(Math.random() * 3),
          z: -0.04, kind: "powerup",
          sub: Math.random() < 0.5 ? "magnet" : "jetpack", gone: false,
        });
        return;
      }
      // Single obstacle
      const lane   = Math.floor(Math.random() * 3);
      const subs: ObType[]  = ["train", "barrier", "block"];
      const weights = prog < 0.3 ? [0.15, 0.5, 0.5] : [0.38, 0.38, 0.38];
      let rv = Math.random(); let sub: ObType = "barrier";
      for (let i = 0; i < weights.length; i++) { rv -= weights[i]; if (rv <= 0) { sub = subs[i]; break; } }
      gs.objects.push({ id: gs.nextId++, lane, z: -0.04, kind: "obstacle", sub, gone: false });

    } else {
      // Two lanes blocked, one escape
      const free = Math.floor(Math.random() * 3);
      const sub: ObType = Math.random() < 0.5 ? "barrier" : "block";
      for (let i = 0; i < 3; i++)
        if (i !== free)
          gs.objects.push({ id: gs.nextId++, lane: i, z: -0.04, kind: "obstacle", sub, gone: false });
    }
  }

  // ── Draw environment ──────────────────────────────────────────────────────
  function drawEnv(ctx: CanvasRenderingContext2D, frame: number) {
    // 1. Bright sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    sky.addColorStop(0,   "#1565c0");
    sky.addColorStop(0.5, "#42a5f5");
    sky.addColorStop(1,   "#90caf9");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, HORIZON_Y + 8);

    // 2. Clouds (slowly drifting)
    const cloudDefs = [{ bx: 55, by: 26, r: 19 }, { bx: 205, by: 14, r: 13 }, { bx: 315, by: 30, r: 17 }];
    ctx.fillStyle = "rgba(255,255,255,0.90)";
    for (const c of cloudDefs) {
      const cx = ((c.bx + frame * 0.10) % (CW + 60)) - 30;
      ctx.beginPath(); ctx.arc(cx, c.by, c.r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx - c.r * 0.55, c.by + 5, c.r * 0.68, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + c.r * 0.55, c.by + 6, c.r * 0.72, 0, Math.PI * 2); ctx.fill();
    }

    // 3. Horizon landscape strip
    const hband = ctx.createLinearGradient(0, HORIZON_Y - 8, 0, HORIZON_Y + 28);
    hband.addColorStop(0, "#66bb6a"); hband.addColorStop(0.45, "#388e3c"); hband.addColorStop(1, "rgba(56,142,60,0)");
    ctx.fillStyle = hband; ctx.fillRect(0, HORIZON_Y - 8, CW, 36);

    // 4. Ground/track base (concrete)
    const gnd = ctx.createLinearGradient(0, HORIZON_Y, 0, CH);
    gnd.addColorStop(0, "#b0bec5"); gnd.addColorStop(0.25, "#90a4ae"); gnd.addColorStop(1, "#546e7a");
    ctx.fillStyle = gnd; ctx.fillRect(0, HORIZON_Y, CW, CH - HORIZON_Y);

    // 5. Red side walls (trapezoids converging to horizon)
    const lwTop = laneToX(0, 0.01); const lwBot = laneToX(0, 1) - 62;
    ctx.fillStyle = "#c62828";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(lwTop, HORIZON_Y); ctx.lineTo(lwBot, CH); ctx.lineTo(0, CH); ctx.closePath(); ctx.fill();
    // Left brick rows
    ctx.fillStyle = "#b71c1c";
    for (let row = 0; row < 14; row++) {
      const by = row * 15;
      for (let col = 0; col < 6; col++) {
        const bx = col * 22 - (row % 2 === 0 ? 0 : 11);
        if (bx + 18 > 0 && by + 12 < CH) ctx.fillRect(bx + 1, by + 1, 18, 12);
      }
    }
    ctx.fillStyle = "#e53935"; // highlight edge
    ctx.beginPath(); ctx.moveTo(lwTop - 1, HORIZON_Y); ctx.lineTo(lwTop + 3, HORIZON_Y); ctx.lineTo(lwBot + 4, CH); ctx.lineTo(lwBot - 1, CH); ctx.closePath(); ctx.fill();

    const rwTop = laneToX(2, 0.01); const rwBot = laneToX(2, 1) + 62;
    ctx.fillStyle = "#c62828";
    ctx.beginPath(); ctx.moveTo(CW, 0); ctx.lineTo(rwTop, HORIZON_Y); ctx.lineTo(rwBot, CH); ctx.lineTo(CW, CH); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#b71c1c";
    for (let row = 0; row < 14; row++) {
      const by = row * 15;
      for (let col = 0; col < 6; col++) {
        const bx = CW - col * 22 + (row % 2 === 0 ? 0 : 11) - 20;
        if (bx > 0 && bx + 18 < CW && by + 12 < CH) ctx.fillRect(bx, by + 1, 18, 12);
      }
    }
    ctx.fillStyle = "#e53935";
    ctx.beginPath(); ctx.moveTo(rwTop + 1, HORIZON_Y); ctx.lineTo(rwTop - 3, HORIZON_Y); ctx.lineTo(rwBot - 4, CH); ctx.lineTo(rwBot + 1, CH); ctx.closePath(); ctx.fill();

    // 6. Green grass strips along wall edges
    ctx.fillStyle = "#2e7d32";
    ctx.beginPath(); ctx.moveTo(lwTop, HORIZON_Y); ctx.lineTo(laneToX(0, 0.01), HORIZON_Y); ctx.lineTo(laneToX(0, 1) - 3, CH); ctx.lineTo(lwBot, CH); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(rwTop, HORIZON_Y); ctx.lineTo(laneToX(2, 0.01), HORIZON_Y); ctx.lineTo(laneToX(2, 1) + 3, CH); ctx.lineTo(rwBot, CH); ctx.closePath(); ctx.fill();

    // 7. Scrolling bushes on grass edges
    for (let bi = 0; bi < 7; bi++) {
      const t = ((bi / 7) + frame * 0.009) % 1;
      if (t <= 0) continue;
      const y = zToY(t); const s = Math.max(0.001, zToS(t));
      const bw = Math.max(0.5, 22 * s); const bh = Math.max(0.5, 14 * s);
      // Left bush
      const lbx = laneToX(0, t) - 48 * s;
      ctx.fillStyle = `rgba(27,94,32,${0.65 + t * 0.35})`; ctx.beginPath(); ctx.ellipse(lbx, y, bw, bh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(46,125,50,${0.7 + t * 0.3})`; ctx.beginPath(); ctx.ellipse(lbx - bw * 0.45, y - bh * 0.2, bw * 0.65, bh * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(102,187,106,${0.55 + t * 0.4})`; ctx.beginPath(); ctx.ellipse(lbx + bw * 0.3, y - bh * 0.35, bw * 0.45, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      // Right bush
      const rbx = laneToX(2, t) + 48 * s;
      ctx.fillStyle = `rgba(27,94,32,${0.65 + t * 0.35})`; ctx.beginPath(); ctx.ellipse(rbx, y, bw, bh, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(46,125,50,${0.7 + t * 0.3})`; ctx.beginPath(); ctx.ellipse(rbx + bw * 0.45, y - bh * 0.2, bw * 0.65, bh * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(102,187,106,${0.55 + t * 0.4})`; ctx.beginPath(); ctx.ellipse(rbx - bw * 0.3, y - bh * 0.35, bw * 0.45, bh * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    }

    // 8. Sleepers (wooden cross ties)
    for (let i = 0; i < 16; i++) {
      const t = ((i / 16) + frame * 0.013) % 1;
      if (t <= 0) continue;
      const y = zToY(t); const s = Math.max(0.001, zToS(t));
      const lx = laneToX(0, t) - 56 * s; const rx = laneToX(2, t) + 56 * s;
      ctx.fillStyle = `rgba(0,0,0,${0.12 + t * 0.10})`; ctx.fillRect(lx, y + 2 * s, rx - lx, 5 * s); // shadow
      const br = Math.floor(88 - t * 22);
      ctx.fillStyle = `rgb(${br + 22},${br},${Math.max(0, br - 22)})`; ctx.fillRect(lx, y - 2.5 * s, rx - lx, 5 * s);
      ctx.fillStyle = `rgba(255,255,255,${0.07 + t * 0.05})`; ctx.fillRect(lx + 2 * s, y - 2.5 * s, rx - lx - 4 * s, 1.5 * s);
    }

    // 9. Rails (metallic silver, between lanes)
    for (const [la, lb] of [[0, 1], [1, 2]] as const) {
      for (const offset of [-5, 5]) {
        const tx = (LANE_TOP[la] + LANE_TOP[lb]) / 2 + offset * 0.09;
        const bx = (LANE_BOT[la] + LANE_BOT[lb]) / 2 + offset;
        ctx.beginPath(); ctx.moveTo(tx + 1.5, HORIZON_Y); ctx.lineTo(bx + 2.5, PLAYER_Y + 100);
        ctx.strokeStyle = "rgba(0,0,0,0.2)"; ctx.lineWidth = 3.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx, HORIZON_Y); ctx.lineTo(bx, PLAYER_Y + 100);
        ctx.strokeStyle = "#78909c"; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx - 0.5, HORIZON_Y); ctx.lineTo(bx - 0.8, PLAYER_Y + 100);
        ctx.strokeStyle = "#cfd8dc"; ctx.lineWidth = 0.7; ctx.stroke();
      }
    }

    // 10. Lane dashed markings
    for (let i = 0; i < 12; i++) {
      const t = ((i / 12) + frame * 0.013) % 1;
      if (t <= 0.04) continue;
      const y = zToY(t); const s = Math.max(0.001, zToS(t));
      const m01 = (laneToX(0, t) + laneToX(1, t)) / 2;
      const m12 = (laneToX(1, t) + laneToX(2, t)) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.14 + t * 0.12})`;
      ctx.fillRect(m01 - 1.5 * s, y, 3 * s, 7 * s);
      ctx.fillRect(m12 - 1.5 * s, y, 3 * s, 7 * s);
    }

    // 11. Overhead electric wires (4 lines converging)
    for (let wi = 0; wi < 4; wi++) {
      const wx_top = HORIZON_X + (wi - 1.5) * 7;
      const wx_bot = LANE_BOT[0] + wi * (LANE_BOT[2] - LANE_BOT[0]) / 3;
      ctx.beginPath();
      ctx.moveTo(wx_top, HORIZON_Y);
      ctx.quadraticCurveTo((wx_top + wx_bot) * 0.5, HORIZON_Y + (PLAYER_Y - HORIZON_Y) * 0.38 + Math.sin(frame * 0.022 + wi) * 1.5, wx_bot, PLAYER_Y - CH * 0.21);
      ctx.strokeStyle = "rgba(38,50,56,0.7)"; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = "rgba(207,216,220,0.28)"; ctx.lineWidth = 0.4; ctx.stroke();
    }
    // Horizontal cross-bar supports
    for (let ci = 0; ci < 4; ci++) {
      const t = 0.18 + ci * 0.22; const y = zToY(t); const s = Math.max(0.001, zToS(t));
      const lw = laneToX(0, t) - 24 * s; const rw = laneToX(2, t) + 24 * s;
      ctx.beginPath(); ctx.moveTo(lw, y - 19 * s); ctx.lineTo(rw, y - 19 * s);
      ctx.strokeStyle = `rgba(38,50,56,${0.28 + t * 0.32})`; ctx.lineWidth = 1.4 * s; ctx.stroke();
    }

    // 12. Track sheen (subtle reflection)
    const sheen = ctx.createLinearGradient(0, PLAYER_Y - 28, 0, PLAYER_Y + 40);
    sheen.addColorStop(0, "rgba(255,255,255,0.09)"); sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(laneToX(0, 0.97) - 44, PLAYER_Y - 28, laneToX(2, 0.97) - laneToX(0, 0.97) + 88, 68);

    // 13. Distance fog at horizon
    const fog = ctx.createLinearGradient(0, HORIZON_Y - 10, 0, HORIZON_Y + 70);
    fog.addColorStop(0, "rgba(144,202,249,0.52)"); fog.addColorStop(0.55, "rgba(144,202,249,0.16)"); fog.addColorStop(1, "rgba(144,202,249,0)");
    ctx.fillStyle = fog; ctx.fillRect(0, HORIZON_Y - 10, CW, 80);
  }

  // ── Draw game object ──────────────────────────────────────────────────────
  function drawGO(ctx: CanvasRenderingContext2D, go: GO, frame: number, magnet: boolean) {
    const { lane, z, kind, sub } = go;
    if (z <= 0) return; // behind horizon — skip
    const x = laneToX(lane, z); const y = zToY(z);
    const s = Math.max(0.001, zToS(z));
    ctx.save(); ctx.translate(x, y);

    if (kind === "coin") {
      // Bright spinning gold coin
      const pulse = 1 + Math.sin(frame * 0.2) * 0.1;
      const r = Math.max(0.5, 11 * s * pulse);
      // Outer ring
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = magnet ? 28 * s : 12 * s;
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      // Inner gold face
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, Math.PI * 2); ctx.fill();
      // Highlight
      ctx.fillStyle = "rgba(255,255,220,0.7)";
      ctx.beginPath(); ctx.arc(-r * 0.28, -r * 0.28, Math.max(0.3, r * 0.32), 0, Math.PI * 2); ctx.fill();
      // ₹ symbol
      ctx.fillStyle = "#78350f"; ctx.font = `bold ${Math.max(4, 8 * s)}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText("₹", 0.5 * s, 3.5 * s);

    } else if (kind === "powerup") {
      // Glowing powerup with label
      const pw = sub === "magnet";
      ctx.shadowColor = pw ? "#fbbf24" : "#34d399"; ctx.shadowBlur = 24 * s;
      // Badge background
      ctx.fillStyle = pw ? "rgba(251,191,36,0.22)" : "rgba(52,211,153,0.22)";
      rrect(ctx, -18 * s, -18 * s, 36 * s, 36 * s, 8 * s); ctx.fill();
      ctx.strokeStyle = pw ? "#fbbf24" : "#34d399"; ctx.lineWidth = 1.5 * s;
      rrect(ctx, -18 * s, -18 * s, 36 * s, 36 * s, 8 * s); ctx.stroke();
      ctx.font = `${Math.max(8, 22 * s)}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText(pw ? "🧲" : "🚀", 0, 8 * s);
      ctx.shadowBlur = 0;
      ctx.fillStyle = pw ? "#fbbf24" : "#34d399";
      ctx.font = `bold ${Math.max(3, 7 * s)}px sans-serif`;
      ctx.fillText(pw ? "MAGNET" : "JETPACK", 0, 24 * s);

    } else if (kind === "obstacle") {
      if (sub === "train") {
        // Bright red/orange metro train car
        const w = 66 * s; const h = 92 * s;
        // Body gradient
        const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        g.addColorStop(0, "#b91c1c"); g.addColorStop(0.4, "#ef4444"); g.addColorStop(0.7, "#f87171"); g.addColorStop(1, "#b91c1c");
        ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 16 * s;
        ctx.fillStyle = g; rrect(ctx, -w / 2, -h, w, h, 10 * s); ctx.fill();
        // Orange accent stripe
        ctx.fillStyle = "#f97316";
        ctx.fillRect(-w / 2, -h * 0.55, w, h * 0.08);
        // Windows
        ctx.fillStyle = "rgba(186,230,253,0.75)";
        ctx.fillRect(-w * 0.36, -h * 0.76, w * 0.3, h * 0.16);
        ctx.fillRect( w * 0.06, -h * 0.76, w * 0.3, h * 0.16);
        // Window frames
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 1 * s;
        ctx.strokeRect(-w * 0.36, -h * 0.76, w * 0.3, h * 0.16);
        ctx.strokeRect( w * 0.06, -h * 0.76, w * 0.3, h * 0.16);
        // Headlight glow
        ctx.shadowColor = "#fef08a"; ctx.shadowBlur = 22 * s;
        ctx.fillStyle = "#fef08a"; ctx.fillRect(-w * 0.36, -h * 0.97, w * 0.72, h * 0.065);
        // Front grille
        ctx.shadowBlur = 0; ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(-w * 0.28, -h * 0.2, w * 0.56, h * 0.2);
        // Number plate
        ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(4, 7 * s)}px sans-serif`; ctx.textAlign = "center";
        ctx.fillText("🚆", 0, -h * 0.1);

      } else if (sub === "barrier") {
        // Yellow-black construction barrier
        const w = 56 * s; const h = 60 * s;
        ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 10 * s;
        // Top beam (yellow-black)
        const stripeW = w / 5;
        for (let si = 0; si < 5; si++) {
          ctx.fillStyle = si % 2 === 0 ? "#fbbf24" : "#111";
          ctx.fillRect(-w / 2 + si * stripeW, -h, stripeW, 6 * s);
        }
        // Vertical bars
        ctx.fillStyle = "#fbbf24";
        for (let bi = 0; bi <= 3; bi++) ctx.fillRect(-w / 2 + bi * (w / 3.2), -h + 6 * s, 5 * s, h - 6 * s);
        // Cross braces (X shape)
        ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2.5 * s;
        ctx.beginPath(); ctx.moveTo(-w / 2, -h + 6 * s); ctx.lineTo(w / 2, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(w / 2, -h + 6 * s); ctx.lineTo(-w / 2, 0); ctx.stroke();

      } else {
        // Concrete low block — slide under
        const w = 60 * s; const h = 28 * s;
        const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        g.addColorStop(0, "#374151"); g.addColorStop(0.5, "#6b7280"); g.addColorStop(1, "#374151");
        ctx.shadowColor = "#9ca3af"; ctx.shadowBlur = 10 * s;
        ctx.fillStyle = g; rrect(ctx, -w / 2, -h, w, h, 5 * s); ctx.fill();
        // Concrete grain lines
        ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 0.7 * s;
        for (let li = 1; li < 3; li++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 3 * s, -h + li * h / 3); ctx.lineTo(w / 2 - 3 * s, -h + li * h / 3); ctx.stroke(); }
        // Warning stripes
        ctx.fillStyle = "#fbbf24";
        for (let si = 0; si < 3; si++) ctx.fillRect(-w / 2 + si * (w / 3) + 4 * s, -h + 4 * s, 8 * s, 4 * s);
        // Label
        ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(4, 7 * s)}px sans-serif`; ctx.textAlign = "center";
        ctx.fillText("SLIDE!", 0, -h * 0.25);
      }
    }

    ctx.shadowBlur = 0; ctx.restore();
  }

  // ── Draw player character ─────────────────────────────────────────────────
  function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS) {
    const { laneX: px, jumpY, pstate, frame, magnet, jetpack } = gs;
    ctx.save(); ctx.translate(px, PLAYER_Y - jumpY);

    if (pstate === "slide") {
      // Sliding pose — crouched flat
      if (jetpack)      { ctx.shadowColor = "#34d399"; ctx.shadowBlur = 28; }
      else if (magnet)  { ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 20; }
      else              { ctx.shadowColor = "rgba(0,0,0,0.3)"; ctx.shadowBlur = 8; }

      // Body (red jacket, flattened)
      ctx.fillStyle = jetpack ? "#34d399" : magnet ? "#fbbf24" : "#dc2626";
      ctx.beginPath(); ctx.ellipse(0, -7, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
      // Jacket shine
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      ctx.beginPath(); ctx.ellipse(-3, -10, 8, 4, -0.3, 0, Math.PI * 2); ctx.fill();
      // Legs (blue jeans, trailing)
      ctx.fillStyle = "#1d4ed8";
      ctx.fillRect(-18, -4, 10, 7); ctx.fillRect(8, -4, 10, 7);
      // White shoes
      ctx.fillStyle = "#f1f5f9"; ctx.fillRect(-20, 2, 9, 5); ctx.fillRect(11, 2, 9, 5);
      // Head (helmet, low)
      ctx.shadowBlur = 0; ctx.fillStyle = "#fcd34d";
      ctx.beginPath(); ctx.arc(12, -9, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(147,197,253,0.6)"; rrect(ctx, 6, -11, 11, 5, 2); ctx.fill();

    } else {
      const swing = pstate === "jump" ? 0 : Math.sin(frame * 0.30) * 13;
      const jacketCol = jetpack ? "#34d399" : magnet ? "#fbbf24" : "#dc2626";

      // Ground shadow (smaller when jumping)
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.beginPath(); ctx.ellipse(0, 4, jumpY > 0 ? 6 + jumpY * 0.04 : 14, 4, 0, 0, Math.PI * 2); ctx.fill();

      // Glow
      if (jetpack)     { ctx.shadowColor = "#34d399"; ctx.shadowBlur = 24; }
      else if (magnet) { ctx.shadowColor = "#fbbf24"; ctx.shadowBlur = 18; }
      else             { ctx.shadowColor = "rgba(220,38,38,0.4)"; ctx.shadowBlur = 10; }

      // Legs (blue jeans, animated)
      ctx.fillStyle = "#1d4ed8";
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); ctx.fillRect(-7, 0, 6, 19); ctx.restore();
      ctx.save(); ctx.rotate(( swing * Math.PI) / 180); ctx.fillRect(1,  0, 6, 19); ctx.restore();
      // Shoes (white)
      ctx.fillStyle = "#e2e8f0";
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); ctx.fillRect(-9, 17, 9, 6); ctx.restore();
      ctx.save(); ctx.rotate(( swing * Math.PI) / 180); ctx.fillRect(0,  17, 9, 6); ctx.restore();

      // Jacket body (red)
      ctx.fillStyle = jacketCol; rrect(ctx, -12, -30, 24, 30, 6); ctx.fill();
      // Jacket zipper/chest stripe
      ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.fillRect(-2, -27, 4, 18);
      // Jacket side shading
      ctx.fillStyle = "rgba(0,0,0,0.12)"; ctx.fillRect(8, -30, 4, 30);

      // Arms (red jacket, swinging)
      ctx.fillStyle = jacketCol;
      ctx.save(); ctx.rotate(( swing * Math.PI) / 180); rrect(ctx, -19, -28, 8, 16, 4); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); rrect(ctx, 11,  -28, 8, 16, 4); ctx.fill(); ctx.restore();
      // Hands (skin tone)
      ctx.fillStyle = "#fcd5b4";
      ctx.save(); ctx.rotate(( swing * Math.PI) / 180); ctx.beginPath(); ctx.arc(-15, -12, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); ctx.beginPath(); ctx.arc(15,  -12, 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();

      // Head/face
      ctx.shadowBlur = 0; ctx.fillStyle = "#fcd5b4";
      ctx.beginPath(); ctx.arc(0, -37, 11, 0, Math.PI * 2); ctx.fill();
      // Eyes
      ctx.fillStyle = "#1e293b";
      ctx.beginPath(); ctx.arc(-3.5, -38, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(3.5, -38, 2, 0, Math.PI * 2); ctx.fill();

      // Helmet (gold)
      ctx.fillStyle = "#fbbf24"; ctx.beginPath(); ctx.arc(0, -40, 9, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "#f59e0b"; ctx.fillRect(-9, -40, 18, 3); // brim
      // Visor (cyan tint)
      ctx.fillStyle = "rgba(147,197,253,0.65)"; rrect(ctx, -8, -38, 16, 5, 2); ctx.fill();
      // Helmet stripe
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(-1, -49, 2.5, 10);

      // Jetpack
      if (jetpack) {
        ctx.shadowColor = "#34d399"; ctx.shadowBlur = 20;
        ctx.fillStyle = "#1e293b"; rrect(ctx, -20, -28, 8, 18, 3); ctx.fill();
        ctx.fillStyle = "#34d399"; ctx.fillRect(-19, -11, 6, 5);
        for (let fi = 0; fi < 5; fi++) {
          ctx.fillStyle = `rgba(52,211,153,${0.7 - fi * 0.13})`;
          ctx.fillRect(-19 + fi * 0.5, -6, 2.5, 5 + Math.random() * 9);
        }
      }
    }

    ctx.shadowBlur = 0; ctx.restore();
  }

  // ── Draw HUD ──────────────────────────────────────────────────────────────
  function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
    const { score, coins, timeLeft, botScore, magnet, jetpack, pstate } = gs;

    // Top bar — clean white-tinted panel
    const barGrad = ctx.createLinearGradient(0, 0, 0, 72);
    barGrad.addColorStop(0, "rgba(0,0,0,0.82)"); barGrad.addColorStop(1, "rgba(0,0,0,0.58)");
    ctx.fillStyle = barGrad; ctx.fillRect(0, 0, CW, 72);
    // Bottom border (gold accent line)
    const bl = ctx.createLinearGradient(0, 71, CW, 71);
    bl.addColorStop(0, "rgba(251,191,36,0)"); bl.addColorStop(0.5, "rgba(251,191,36,0.55)"); bl.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = bl; ctx.fillRect(0, 71, CW, 1.5);

    // ── Timer (center) ───────────────────────────────────────────────────────
    const urgent = timeLeft <= 10; const warn = timeLeft <= 25;
    const tc = urgent ? "#ef4444" : warn ? "#fb923c" : "#fff";
    if (urgent) { ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 14; }
    ctx.fillStyle = tc; ctx.font = "bold 22px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(fmtTime(timeLeft), CW / 2, 28); ctx.shadowBlur = 0;
    ctx.fillStyle = urgent ? "rgba(239,68,68,0.55)" : "rgba(255,255,255,0.28)";
    ctx.font = "7.5px system-ui,sans-serif"; ctx.fillText("TIME LEFT", CW / 2, 42);

    // ── Score & Coins (right) ────────────────────────────────────────────────
    ctx.textAlign = "right";
    ctx.shadowColor = "rgba(251,191,36,0.5)"; ctx.shadowBlur = 6;
    ctx.fillStyle = "#fbbf24"; ctx.font = "bold 18px system-ui,sans-serif"; ctx.fillText(score.toLocaleString(), CW - 12, 27);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.28)"; ctx.font = "7.5px system-ui,sans-serif"; ctx.fillText("SCORE", CW - 12, 40);
    ctx.fillStyle = "#FFD700"; ctx.font = "bold 11px system-ui,sans-serif"; ctx.fillText(`🪙 ${coins}`, CW - 12, 58);

    // ── YOU vs BOT leaderboard (left) ───────────────────────────────────────
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.38)"; ctx.font = "7.5px system-ui,sans-serif"; ctx.fillText("YOU  vs  BOT", 10, 13);
    const bw = 86; const mx = Math.max(score, botScore, 1);
    // YOU bar
    ctx.fillStyle = "rgba(255,255,255,0.08)"; rrect(ctx, 10, 17, bw, 8, 4); ctx.fill();
    ctx.fillStyle = "#22c55e"; rrect(ctx, 10, 17, Math.min(bw, (score / mx) * bw), 8, 4); ctx.fill();
    // BOT bar
    ctx.fillStyle = "rgba(255,255,255,0.08)"; rrect(ctx, 10, 30, bw, 8, 4); ctx.fill();
    ctx.fillStyle = "#ef4444"; rrect(ctx, 10, 30, Math.min(bw, (botScore / mx) * bw), 8, 4); ctx.fill();
    // Labels
    ctx.fillStyle = "#86efac"; ctx.font = "bold 7.5px system-ui,sans-serif"; ctx.fillText(`🏃 ${score}`, 10, 50);
    ctx.fillStyle = "#fca5a5"; ctx.fillText(`🤖 ${Math.floor(botScore)}`, 10, 62);

    // ── Powerup banners ──────────────────────────────────────────────────────
    let by = 80;
    if (magnet) {
      ctx.fillStyle = "rgba(251,191,36,0.18)"; rrect(ctx, CW / 2 - 68, by, 136, 18, 9); ctx.fill();
      ctx.strokeStyle = "rgba(251,191,36,0.4)"; ctx.lineWidth = 1; rrect(ctx, CW / 2 - 68, by, 136, 18, 9); ctx.stroke();
      ctx.fillStyle = "#fbbf24"; ctx.font = "bold 9px system-ui,sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🧲 MAGNET ACTIVE", CW / 2, by + 12); by += 22;
    }
    if (jetpack) {
      ctx.fillStyle = "rgba(52,211,153,0.18)"; rrect(ctx, CW / 2 - 68, by, 136, 18, 9); ctx.fill();
      ctx.strokeStyle = "rgba(52,211,153,0.4)"; ctx.lineWidth = 1; rrect(ctx, CW / 2 - 68, by, 136, 18, 9); ctx.stroke();
      ctx.fillStyle = "#34d399"; ctx.font = "bold 9px system-ui,sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🚀 JETPACK ACTIVE", CW / 2, by + 12);
    }

    // ── Bottom action hint ───────────────────────────────────────────────────
    const hintCol = pstate === "jump" ? "#86efac" : pstate === "slide" ? "#93c5fd" : "rgba(255,255,255,0.22)";
    ctx.fillStyle = hintCol; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(
      pstate === "jump" ? "↑ JUMPING" : pstate === "slide" ? "↓ SLIDING" : "← Swipe  ↑ Jump  ↓ Slide →",
      CW / 2, CH - 10,
    );
  }

  // ── Game loop (stored in ref to avoid stale closures) ─────────────────────
  loopRef.current = (ts: number) => {
    const gs  = gsRef.current; const cvs = canvasRef.current;
    if (!gs || !cvs) return;
    const ctx = cvs.getContext("2d"); if (!ctx) return;

    const dt = Math.min((ts - (gs.lastTs || ts)) / 1000, 0.05);
    gs.lastTs = ts;

    // ── Update ────────────────────────────────────────────────────────────
    if (gs.running && !gs.over) {
      gs.frame++;
      gs.timeLeft = Math.max(0, gs.timeLeft - dt);
      if (gs.timeLeft <= 0) { gs.over = true; gs.running = false; }

      const prog   = 1 - gs.timeLeft / GAME_DURATION;
      gs.speed     = 0.55 + prog * 1.6;
      gs.dist     += gs.speed * dt * 22;
      gs.score     = Math.floor(gs.dist * 1.8 + gs.coins * 8);
      gs.botScore += gs.speed * dt * 17.8 + (Math.random() < 0.04 ? 8 : 0);

      // Lane lerp
      const tx = LANE_BOT[gs.targetLane];
      gs.laneX += (tx - gs.laneX) * Math.min(1, dt * 11);
      if (Math.abs(gs.laneX - tx) < 4) { gs.lane = gs.targetLane; gs.laneX = tx; }

      // Jump arc
      if (gs.pstate === "jump") {
        gs.jumpT = Math.min(1, gs.jumpT + dt * 2.4);
        gs.jumpY = Math.sin(gs.jumpT * Math.PI) * 118;
        if (gs.jumpT >= 1) { gs.pstate = "run"; gs.jumpT = 0; gs.jumpY = 0; }
      }

      // Slide timer
      if (gs.pstate === "slide") {
        gs.slideT += dt;
        if (gs.slideT >= 0.85) { gs.pstate = "run"; gs.slideT = 0; }
      }

      // Powerup timers
      if (gs.magnet)  { gs.magnetT  -= dt; if (gs.magnetT  <= 0) gs.magnet  = false; }
      if (gs.jetpack) { gs.jetpackT -= dt; if (gs.jetpackT <= 0) gs.jetpack = false; }

      // Move objects forward
      for (const o of gs.objects) o.z += gs.speed * dt * 1.15;

      // Magnet attraction
      if (gs.magnet) {
        for (const o of gs.objects)
          if (o.kind === "coin" && !o.gone && o.z > 0.22) o.lane = gs.lane;
      }

      // Collision
      for (const o of gs.objects) {
        if (o.gone) continue;
        if (Math.abs(o.z - 0.90) > 0.13) continue;

        if (o.kind === "coin") {
          if (o.lane === gs.lane || (gs.magnet && Math.abs(o.z - 0.90) < 0.17)) {
            o.gone = true; gs.coins++;
          }
        } else if (o.kind === "powerup") {
          if (o.lane === gs.lane) {
            o.gone = true;
            if (o.sub === "magnet") { gs.magnet = true; gs.magnetT = 9; }
            else                    { gs.jetpack = true; gs.jetpackT = 7; }
          }
        } else if (o.kind === "obstacle" && o.lane === gs.lane) {
          if (gs.jetpack)                                     continue;
          if (o.sub === "barrier" && gs.pstate === "jump")    continue;
          if (o.sub === "block"   && gs.pstate === "slide")   continue;
          o.gone = true; gs.crashed = true; gs.over = true; gs.running = false;
        }
      }

      // Cull gone/passed objects
      gs.objects = gs.objects.filter(o => !o.gone && o.z < 1.08);
      if (gs.objects.length > 90) gs.objects = gs.objects.slice(-90);

      // Spawn
      gs.spawnT -= dt;
      if (gs.spawnT <= 0) {
        gs.spawnT = (0.62 - prog * 0.26) + Math.random() * 0.36;
        spawnObjs(gs);
      }
    }

    // ── Draw ─────────────────────────────────────────────────────────────
    ctx.clearRect(0, 0, CW, CH);
    drawEnv(ctx, gs.frame);
    const sorted = [...gs.objects].sort((a, b) => a.z - b.z);
    for (const o of sorted) drawGO(ctx, o, gs.frame, gs.magnet);
    drawPlayer(ctx, gs);
    drawHUD(ctx, gs);

    // Crash flash
    if (gs.crashed && gs.frame % 4 < 2) {
      ctx.fillStyle = "rgba(239,68,68,0.2)"; ctx.fillRect(0, 0, CW, CH);
    }

    // Sync React UI
    if (gs.frame % 3 === 0 || gs.over) {
      setUi({ score: gs.score, coins: gs.coins, timeLeft: gs.timeLeft,
        botScore: Math.floor(gs.botScore), over: gs.over, started: gs.started,
        magnet: gs.magnet, jetpack: gs.jetpack, crashed: gs.crashed });
    }

    if (!gs.over) {
      rafRef.current = requestAnimationFrame(ts2 => loopRef.current(ts2));
    } else {
      setUi({ score: gs.score, coins: gs.coins, timeLeft: gs.timeLeft,
        botScore: Math.floor(gs.botScore), over: true, started: true,
        magnet: false, jetpack: false, crashed: gs.crashed });
      if (!isFreeMode) {
        const won = gs.score > gs.botScore;
        if (won) addWinning(initialFee * 1.8);
        addMatch({
          gameId: "metrosurfer", gameName: "Metro Surfer", gameIcon: "🏃",
          result: won ? "win" : "loss",
          entryFee: initialFee, prize: won ? initialFee * 1.8 : 0,
          opponentName: "BOT",
        });
      }
    }
  };

  // ── Start / restart ───────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const gs = mkGS(); gs.running = true; gs.started = true;
    gsRef.current = gs;
    setUi({ score: 0, coins: 0, timeLeft: GAME_DURATION, botScore: 0,
      over: false, started: true, magnet: false, jetpack: false, crashed: false });
    rafRef.current = requestAnimationFrame(ts => loopRef.current(ts));
  }, []);

  // ── Swipe / keyboard input ────────────────────────────────────────────────
  function doSwipe(dx: number, dy: number) {
    const gs = gsRef.current; if (!gs?.running) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx < -18) gs.targetLane = Math.max(0, gs.targetLane - 1);
      if (dx >  18) gs.targetLane = Math.min(2, gs.targetLane + 1);
    } else {
      if (dy < -22 && gs.pstate === "run") { gs.pstate = "jump";  gs.jumpT = 0; gs.jumpY = 0; }
      if (dy >  22 && gs.pstate === "run") { gs.pstate = "slide"; gs.slideT = 0; }
    }
  }

  const onTouchStart = (e: React.TouchEvent) => { swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd   = (e: React.TouchEvent) => {
    if (!swipeRef.current) return;
    doSwipe(e.changedTouches[0].clientX - swipeRef.current.x, e.changedTouches[0].clientY - swipeRef.current.y);
    swipeRef.current = null;
  };
  const onMouseDown  = (e: React.MouseEvent) => { swipeRef.current = { x: e.clientX, y: e.clientY }; };
  const onMouseUp    = (e: React.MouseEvent) => {
    if (!swipeRef.current) return;
    doSwipe(e.clientX - swipeRef.current.x, e.clientY - swipeRef.current.y);
    swipeRef.current = null;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const gs = gsRef.current; if (!gs?.running) return;
      if (e.key === "ArrowLeft")  gs.targetLane = Math.max(0, gs.targetLane - 1);
      if (e.key === "ArrowRight") gs.targetLane = Math.min(2, gs.targetLane + 1);
      if (e.key === "ArrowUp"   && gs.pstate === "run") { gs.pstate = "jump";  gs.jumpT = 0; gs.jumpY = 0; }
      if (e.key === "ArrowDown" && gs.pstate === "run") { gs.pstate = "slide"; gs.slideT = 0; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Initial idle canvas draw
  useEffect(() => {
    const cvs = canvasRef.current; if (!cvs) return;
    const ctx = cvs.getContext("2d"); if (!ctx) return;
    const gs  = mkGS(); gsRef.current = gs;
    drawEnv(ctx, 0); drawPlayer(ctx, gs);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Derived UI values ─────────────────────────────────────────────────────
  const won      = ui.score > ui.botScore;
  const distance = Math.floor(gsRef.current?.dist ?? 0);

  return (
    <div style={{ background: "#0a0a0f", width: "100%", maxWidth: 480, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "linear-gradient(90deg,#b91c1c,#dc2626)", borderBottom: "2px solid #fbbf24", flexShrink: 0 }}>
        <button onClick={onBack} style={{ color: "#fff", fontSize: 22, background: "none", border: "none", cursor: "pointer", padding: 4 }}>←</button>
        <span style={{ color: "#fff", fontWeight: 900, fontSize: 13, letterSpacing: "0.14em", textShadow: "0 0 12px rgba(251,191,36,0.7)" }}>🏃 METRO SURFER</span>
        <span style={{ background: "rgba(0,0,0,0.25)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.5)", borderRadius: 10, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
          {isFreeMode ? "FREE" : `₹${initialFee}`}
        </span>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "center", overflow: "hidden" }}>
        <canvas
          ref={canvasRef} width={CW} height={CH}
          style={{ width: "100%", maxWidth: CW, height: "auto", display: "block", touchAction: "none" }}
          onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}   onMouseUp={onMouseUp}
        />

        {/* ── Start screen ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {!ui.started && (
            <motion.div key="start"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.92 }}
              style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(5,2,14,0.9)", backdropFilter: "blur(14px)" }}>

              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}
                style={{ fontSize: 68, marginBottom: 8 }}>🏃</motion.div>

              <h2 style={{ color: "#FFD700", fontWeight: 900, fontSize: 26, margin: "0 0 4px" }}>METRO SURFER</h2>
              <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, margin: "0 0 20px" }}>Dodge trains • Collect coins • Survive!</p>

              {/* Control icons */}
              <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
                {[["← →", "Switch Lane"], ["↑", "Jump"], ["↓", "Slide"]].map(([icon, label]) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#a78bfa", fontWeight: 900, fontSize: 16 }}>{icon}</div>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 9 }}>{label}</span>
                  </div>
                ))}
              </div>

              {/* Obstacles legend */}
              <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {[["🚂 Train", "Switch lanes"], ["🟧 Barrier", "Jump over"], ["🟦 Block", "Slide under"]].map(([ob, hint]) => (
                  <div key={ob} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "5px 8px", textAlign: "center" }}>
                    <div style={{ fontSize: 13, marginBottom: 2 }}>{ob}</div>
                    <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 8 }}>{hint}</div>
                  </div>
                ))}
              </div>

              {/* Powerup tips */}
              <div style={{ background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.16)", borderRadius: 14, padding: "8px 18px", marginBottom: 26, fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                🧲 Magnet auto-collects coins &nbsp;|&nbsp; 🚀 Jetpack flies over obstacles
              </div>

              <motion.button whileTap={{ scale: 0.94 }} onClick={startGame}
                style={{ background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", fontWeight: 900, fontSize: 17, padding: "16px 52px", borderRadius: 18, border: "none", cursor: "pointer", boxShadow: "0 0 36px rgba(255,215,0,0.45)" }}>
                🏃 START RUNNING
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Game Over screen ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {ui.over && (
            <motion.div key="over"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,2,14,0.92)", backdropFilter: "blur(18px)" }}>

              <motion.div
                initial={{ scale: 0.72, y: 48 }} animate={{ scale: 1, y: 0 }}
                transition={{ type: "spring", damping: 14, stiffness: 120 }}
                style={{ width: 292, borderRadius: 24, overflow: "hidden", background: "rgba(12,8,28,0.97)", border: "1px solid rgba(255,215,0,0.18)" }}>

                {/* Banner */}
                <div style={{ padding: "18px 0 14px", textAlign: "center", background: won ? "linear-gradient(135deg,#065f46,#10b981)" : "linear-gradient(135deg,#7f1d1d,#ef4444)" }}>
                  <div style={{ fontSize: 46, marginBottom: 4 }}>{won ? "🏆" : ui.crashed ? "💥" : "⏰"}</div>
                  <div style={{ color: "#fff", fontWeight: 900, fontSize: 22 }}>{won ? "YOU WIN!" : "GAME OVER"}</div>
                  <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 3 }}>
                    {won ? "You outscored the bot!" : ui.crashed ? "Crashed into obstacle!" : "Time's up — game ended!"}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                  {([["🏅 Final Score", ui.score.toLocaleString()], ["🪙 Coins Collected", ui.coins], ["📏 Distance Run", `${distance} m`], ["🤖 Bot Score", ui.botScore.toLocaleString()]] as const).map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "rgba(255,255,255,0.48)", fontSize: 12 }}>{label}</span>
                      <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 14 }}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* Winnings */}
                {!isFreeMode && (
                  <div style={{ margin: "0 20px 12px", padding: "8px", borderRadius: 12, textAlign: "center", fontSize: 12, fontWeight: 700, background: won ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.09)", color: won ? "#10b981" : "#ef4444", border: `1px solid ${won ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.2)"}` }}>
                    {won ? `+₹${(initialFee * 1.8).toFixed(0)} credited to wallet!` : `-₹${initialFee} entry fee`}
                  </div>
                )}

                {/* Buttons */}
                <div style={{ display: "flex", gap: 10, padding: "0 20px 20px" }}>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={onBack}
                    style={{ flex: 1, padding: "13px 0", borderRadius: 14, fontWeight: 700, fontSize: 13, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                    ← Back
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.93 }} onClick={startGame}
                    style={{ flex: 1, padding: "13px 0", borderRadius: 14, fontWeight: 900, fontSize: 13, background: "linear-gradient(135deg,#FFD700,#ff8c00)", color: "#000", border: "none", cursor: "pointer", boxShadow: "0 0 22px rgba(255,215,0,0.35)" }}>
                    🏃 PLAY AGAIN
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
