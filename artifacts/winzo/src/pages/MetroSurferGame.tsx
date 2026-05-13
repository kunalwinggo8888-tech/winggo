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
    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
    sky.addColorStop(0, "#04010d"); sky.addColorStop(0.65, "#110327"); sky.addColorStop(1, "#1c0540");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, CW, HORIZON_Y);

    // Ground
    const gnd = ctx.createLinearGradient(0, HORIZON_Y, 0, CH);
    gnd.addColorStop(0, "#0c0c1c"); gnd.addColorStop(1, "#050510");
    ctx.fillStyle = gnd; ctx.fillRect(0, HORIZON_Y, CW, CH - HORIZON_Y);

    // Side tunnel walls
    ctx.fillStyle = "#070012";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(HORIZON_X - 38, HORIZON_Y); ctx.lineTo(0, CH); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(CW, 0); ctx.lineTo(HORIZON_X + 38, HORIZON_Y); ctx.lineTo(CW, CH); ctx.closePath(); ctx.fill();

    // Horizon glow
    const hg = ctx.createRadialGradient(HORIZON_X, HORIZON_Y, 0, HORIZON_X, HORIZON_Y, 95);
    hg.addColorStop(0, "rgba(120,60,255,0.3)"); hg.addColorStop(1, "rgba(120,60,255,0)");
    ctx.fillStyle = hg; ctx.fillRect(HORIZON_X - 95, HORIZON_Y - 45, 190, 90);

    // Scrolling tunnel lamps
    for (let i = 0; i < 7; i++) {
      const t = ((i / 7) + frame * 0.0055) % 1;
      const s = zToS(t); const y = zToY(t); const alpha = 0.1 + t * 0.4;
      const lx = laneToX(0, t) - 34 * s;
      const rx = laneToX(2, t) + 34 * s;
      const lh = 22 * s;
      ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 14 * s;
      ctx.fillStyle = `rgba(120,60,240,${alpha})`;
      ctx.fillRect(lx - 4 * s, y - lh / 2, 3 * s, lh);
      ctx.fillRect(rx,          y - lh / 2, 3 * s, lh);
      // Ceiling glow dot
      const lg = ctx.createRadialGradient(HORIZON_X, y - lh, 0, HORIZON_X, y - lh, 15 * s);
      lg.addColorStop(0, `rgba(255,230,120,${alpha * 0.75})`); lg.addColorStop(1, "rgba(255,230,120,0)");
      ctx.fillStyle = lg; ctx.fillRect(HORIZON_X - 15 * s, y - lh - 12 * s, 30 * s, 24 * s);
    }
    ctx.shadowBlur = 0;

    // Overhead wires
    for (let wi = 0; wi < 3; wi++) {
      ctx.beginPath();
      ctx.moveTo(HORIZON_X + (wi - 1) * 3, HORIZON_Y - 4);
      ctx.quadraticCurveTo(
        HORIZON_X + (wi - 1) * 22, HORIZON_Y + (PLAYER_Y - HORIZON_Y) * 0.4 + Math.sin(frame * 0.025 + wi) * 3,
        LANE_BOT[wi], PLAYER_Y - CH * 0.24,
      );
      ctx.strokeStyle = `rgba(90,70,180,0.38)`; ctx.lineWidth = 0.9; ctx.stroke();
    }

    // Sleepers
    for (let i = 0; i < 14; i++) {
      const t  = ((i / 14) + frame * 0.012) % 1;
      const y  = zToY(t); const s = zToS(t);
      const lx = laneToX(0, t) - 54 * s;
      const rx = laneToX(2, t) + 54 * s;
      ctx.fillStyle = `rgba(22,12,42,${0.22 + t * 0.46})`; ctx.fillRect(lx, y - 2.5 * s, rx - lx, 5 * s);
    }

    // Rails between lanes
    for (const [la, lb] of [[0, 1], [1, 2]] as const) {
      for (const offset of [-7, 7]) {
        ctx.beginPath();
        ctx.moveTo((LANE_TOP[la] + LANE_TOP[lb]) / 2 + offset * 0.12, HORIZON_Y);
        ctx.lineTo((LANE_BOT[la] + LANE_BOT[lb]) / 2 + offset, PLAYER_Y + 80);
        ctx.strokeStyle = "#2e2050"; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    // Ground neon reflections
    for (let ri = 0; ri < 3; ri++) {
      const y = PLAYER_Y + 14 + ri * 14; const alpha = 0.06 - ri * 0.018;
      const lx = laneToX(0, 1) - 50; const rx = laneToX(2, 1) + 50;
      const gr = ctx.createLinearGradient(lx, y, rx, y);
      gr.addColorStop(0, `rgba(120,60,240,0)`); gr.addColorStop(0.5, `rgba(120,60,240,${alpha})`); gr.addColorStop(1, `rgba(120,60,240,0)`);
      ctx.fillStyle = gr; ctx.fillRect(lx, y, rx - lx, 10);
    }
  }

  // ── Draw game object ──────────────────────────────────────────────────────
  function drawGO(ctx: CanvasRenderingContext2D, go: GO, frame: number, magnet: boolean) {
    const { lane, z, kind, sub } = go;
    // Objects with z <= 0 are behind the horizon — skip to avoid negative scale
    if (z <= 0) return;
    const x = laneToX(lane, z); const y = zToY(z);
    const s = Math.max(0.001, zToS(z)); // always positive
    ctx.save(); ctx.translate(x, y);

    if (kind === "coin") {
      const pulse = 1 + Math.sin(frame * 0.18) * 0.08;
      ctx.shadowColor = "#FFD700"; ctx.shadowBlur = magnet ? 26 * s : 10 * s;
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.arc(0, 0, Math.max(0.5, 10 * s * pulse), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff8e0";
      ctx.beginPath(); ctx.arc(-2.5 * s, -2.5 * s, Math.max(0.5, 4 * s), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#92400e"; ctx.font = `bold ${8 * s}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText("₹", 0.5 * s, 3 * s);

    } else if (kind === "powerup") {
      ctx.shadowColor = sub === "magnet" ? "#FFD700" : "#38ef7d";
      ctx.shadowBlur = 22 * s;
      ctx.font = `${28 * s}px sans-serif`; ctx.textAlign = "center";
      ctx.fillText(sub === "magnet" ? "🧲" : "🚀", 0, 10 * s);
      ctx.fillStyle = sub === "magnet" ? "#FFD700" : "#38ef7d";
      ctx.font = `bold ${7 * s}px sans-serif`;
      ctx.fillText(sub === "magnet" ? "MAGNET" : "JETPACK", 0, 22 * s);

    } else if (kind === "obstacle") {
      if (sub === "train") {
        const w = 64 * s; const h = 90 * s;
        const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        g.addColorStop(0, "#7f1d1d"); g.addColorStop(0.45, "#dc2626"); g.addColorStop(1, "#7f1d1d");
        ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 18 * s;
        ctx.fillStyle = g; rrect(ctx, -w / 2, -h, w, h, 8 * s); ctx.fill();
        ctx.fillStyle = "rgba(255,255,180,0.65)";
        ctx.fillRect(-w * 0.38, -h * 0.72, w * 0.28, h * 0.15);
        ctx.fillRect( w * 0.1,  -h * 0.72, w * 0.28, h * 0.15);
        ctx.shadowColor = "#fef08a"; ctx.shadowBlur = 24 * s;
        ctx.fillStyle = "#fef08a"; ctx.fillRect(-w * 0.38, -h * 0.96, w * 0.76, h * 0.06);
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(-w * 0.3, -h * 0.18, w * 0.6, h * 0.18);

      } else if (sub === "barrier") {
        const w = 54 * s; const h = 58 * s;
        ctx.shadowColor = "#f97316"; ctx.shadowBlur = 12 * s; ctx.fillStyle = "#f97316";
        ctx.fillRect(-w / 2, -h, w, 5 * s);
        for (let bi = 0; bi <= 3; bi++) ctx.fillRect(-w / 2 + bi * (w / 3.2), -h, 5 * s, h);
        ctx.fillStyle = "#000";
        for (let si = 0; si < 4; si++) {
          const sx = -w / 2 + si * (w / 4);
          ctx.beginPath(); ctx.moveTo(sx, -h); ctx.lineTo(sx + 8 * s, -h); ctx.lineTo(sx, -h + 5 * s); ctx.closePath(); ctx.fill();
        }

      } else {
        const w = 58 * s; const h = 26 * s;
        const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
        g.addColorStop(0, "#1e3a5f"); g.addColorStop(0.5, "#3b82f6"); g.addColorStop(1, "#1e3a5f");
        ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = 14 * s;
        ctx.fillStyle = g; rrect(ctx, -w / 2, -h, w, h, 4 * s); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.2)";
        for (let si = 0; si < 3; si++) ctx.fillRect(-w / 2 + si * (w / 3) + 4 * s, -h + 5 * s, 10 * s, 4 * s);
        ctx.fillStyle = "#fff"; ctx.font = `bold ${7 * s}px sans-serif`; ctx.textAlign = "center";
        ctx.fillText("SLIDE!", 0, -h * 0.3);
      }
    }

    ctx.shadowBlur = 0; ctx.restore();
  }

  // ── Draw player character ─────────────────────────────────────────────────
  function drawPlayer(ctx: CanvasRenderingContext2D, gs: GS) {
    const { laneX: px, jumpY, pstate, frame, magnet, jetpack } = gs;
    ctx.save(); ctx.translate(px, PLAYER_Y - jumpY);

    if (jetpack) { ctx.shadowColor = "#38ef7d"; ctx.shadowBlur = 30; }
    else if (magnet) { ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 22; }
    else { ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 10; }

    if (pstate === "slide") {
      ctx.fillStyle = "#FFD700";
      ctx.beginPath(); ctx.ellipse(0, -6, 16, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath(); ctx.ellipse(3, -6, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#312e81";
      ctx.fillRect(-18, -3, 9, 6); ctx.fillRect(9, -3, 9, 6);
    } else {
      const swing = pstate === "jump" ? 0 : Math.sin(frame * 0.28) * 12;
      const bodyCol = jetpack ? "#38ef7d" : magnet ? "#FFD700" : "#a78bfa";

      // Ground shadow
      ctx.shadowBlur = 0; ctx.fillStyle = "rgba(0,0,0,0.26)";
      ctx.beginPath(); ctx.ellipse(0, 4, jumpY > 0 ? 7 + jumpY * 0.04 : 13, 4, 0, 0, Math.PI * 2); ctx.fill();

      // Legs
      if (jetpack) { ctx.shadowColor = "#38ef7d"; ctx.shadowBlur = 20; }
      else if (magnet) { ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 16; }
      else { ctx.shadowColor = "#7c3aed"; ctx.shadowBlur = 10; }

      ctx.fillStyle = "#1e1b4b";
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); ctx.fillRect(-7, 0, 5, 18); ctx.restore();
      ctx.save(); ctx.rotate((swing * Math.PI) / 180);  ctx.fillRect(2,  0, 5, 18); ctx.restore();
      ctx.fillStyle = "#312e81";
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); ctx.fillRect(-9, 16, 8, 5); ctx.restore();
      ctx.save(); ctx.rotate((swing * Math.PI) / 180);  ctx.fillRect(1,  16, 8, 5); ctx.restore();

      // Body
      ctx.fillStyle = bodyCol; rrect(ctx, -11, -28, 22, 28, 5); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.16)"; ctx.fillRect(-4, -24, 8, 10);

      // Arms
      ctx.fillStyle = bodyCol;
      ctx.save(); ctx.rotate((swing * Math.PI) / 180);  rrect(ctx, -18, -26, 7, 15, 3); ctx.fill(); ctx.restore();
      ctx.save(); ctx.rotate((-swing * Math.PI) / 180); rrect(ctx, 11,  -26, 7, 15, 3); ctx.fill(); ctx.restore();

      // Head
      ctx.shadowBlur = 0; ctx.fillStyle = "#f5d0a9";
      ctx.beginPath(); ctx.arc(0, -35, 10, 0, Math.PI * 2); ctx.fill();

      // Helmet & visor
      ctx.fillStyle = "#FFD700"; ctx.beginPath(); ctx.arc(0, -38, 8, Math.PI, 0); ctx.fill();
      ctx.fillStyle = "rgba(100,200,255,0.5)"; rrect(ctx, -7, -36, 14, 5, 2); ctx.fill();

      // Jetpack
      if (jetpack) {
        ctx.shadowColor = "#38ef7d"; ctx.shadowBlur = 18;
        ctx.fillStyle = "#111827"; rrect(ctx, -18, -26, 7, 16, 3); ctx.fill();
        ctx.fillStyle = "#38ef7d"; ctx.fillRect(-17, -10, 5, 4);
        for (let fi = 0; fi < 4; fi++) {
          ctx.fillStyle = `rgba(56,239,125,${0.65 - fi * 0.14})`;
          ctx.fillRect(-17 + fi, -6, 2, 4 + Math.random() * 8);
        }
      }
    }

    ctx.shadowBlur = 0; ctx.restore();
  }

  // ── Draw HUD ──────────────────────────────────────────────────────────────
  function drawHUD(ctx: CanvasRenderingContext2D, gs: GS) {
    const { score, coins, timeLeft, botScore, magnet, jetpack, pstate } = gs;

    // Top bar
    ctx.fillStyle = "rgba(5,3,14,0.84)"; ctx.fillRect(0, 0, CW, 68);
    ctx.fillStyle = "rgba(255,215,0,0.08)"; ctx.fillRect(0, 67, CW, 1);

    // Timer (center)
    const tc = timeLeft <= 10 ? "#ef4444" : timeLeft <= 25 ? "#f97316" : "#FFD700";
    if (timeLeft <= 10) { ctx.shadowColor = "#ef4444"; ctx.shadowBlur = 12; }
    ctx.fillStyle = tc; ctx.font = "bold 20px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(fmtTime(timeLeft), CW / 2, 26); ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "8px system-ui,sans-serif";
    ctx.fillText("TIME LEFT", CW / 2, 40);

    // Score (right)
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff"; ctx.font = "bold 17px system-ui,sans-serif"; ctx.fillText(score.toLocaleString(), CW - 10, 26);
    ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.font = "8px system-ui,sans-serif"; ctx.fillText("SCORE", CW - 10, 40);
    ctx.fillStyle = "#FFD700"; ctx.font = "11px system-ui,sans-serif"; ctx.fillText(`🪙 ${coins}`, CW - 10, 56);

    // Leaderboard (left)
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.font = "8px system-ui,sans-serif"; ctx.fillText("YOU  vs  BOT", 10, 14);
    const bw = 84; const mx = Math.max(score, botScore, 1);
    ctx.fillStyle = "rgba(255,255,255,0.08)"; rrect(ctx, 10, 18, bw, 7, 3); ctx.fill();
    ctx.fillStyle = "#a78bfa"; rrect(ctx, 10, 18, (score / mx) * bw, 7, 3); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)"; rrect(ctx, 10, 30, bw, 7, 3); ctx.fill();
    ctx.fillStyle = "#ef4444"; rrect(ctx, 10, 30, (botScore / mx) * bw, 7, 3); ctx.fill();
    ctx.fillStyle = "#a78bfa"; ctx.font = "8px system-ui,sans-serif"; ctx.fillText(`🏃 ${score}`, 10, 50);
    ctx.fillStyle = "#ef4444"; ctx.fillText(`🤖 ${Math.floor(botScore)}`, 10, 62);

    // Powerup banners
    let by = 80;
    if (magnet) {
      ctx.fillStyle = "rgba(255,215,0,0.11)"; rrect(ctx, CW / 2 - 66, by, 132, 16, 8); ctx.fill();
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 9px system-ui,sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🧲 MAGNET ACTIVE", CW / 2, by + 11); by += 20;
    }
    if (jetpack) {
      ctx.fillStyle = "rgba(56,239,125,0.11)"; rrect(ctx, CW / 2 - 66, by, 132, 16, 8); ctx.fill();
      ctx.fillStyle = "#38ef7d"; ctx.font = "bold 9px system-ui,sans-serif"; ctx.textAlign = "center";
      ctx.fillText("🚀 JETPACK ACTIVE", CW / 2, by + 11);
    }

    // Bottom hint
    const hc = pstate === "jump" ? "#a78bfa" : pstate === "slide" ? "#38ef7d" : "rgba(255,255,255,0.18)";
    ctx.fillStyle = hc; ctx.font = "9px system-ui,sans-serif"; ctx.textAlign = "center";
    ctx.fillText(
      pstate === "jump" ? "↑ JUMPING" : pstate === "slide" ? "↓ SLIDING" : "← Swipe to switch lane  ↑ Jump  ↓ Slide",
      CW / 2, CH - 9,
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "rgba(0,0,0,0.7)", borderBottom: "1px solid rgba(255,215,0,0.1)", flexShrink: 0 }}>
        <button onClick={onBack} style={{ color: "rgba(255,255,255,0.7)", fontSize: 22, background: "none", border: "none", cursor: "pointer", padding: 4 }}>←</button>
        <span style={{ color: "#FFD700", fontWeight: 900, fontSize: 13, letterSpacing: "0.14em" }}>🏃 METRO SURFER</span>
        <span style={{ background: "rgba(255,215,0,0.08)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
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
