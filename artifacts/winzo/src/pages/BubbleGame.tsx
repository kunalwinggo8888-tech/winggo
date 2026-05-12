/**
 * BubbleGame — WINGGO Premium Bubble Shooter
 * WinZO-style arcade: hex-grid bubbles, wall-bounce shooting,
 * colour-match pop (3+), floating-drop, particle FX, bot AI,
 * 2-min timer, wallet integration.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { useAuth } from "@/context/useAuth";

// ─── CONSTANTS ─────────────────────────────────────────────────────────────────

const PLATFORM_PCT = 0.10;
const GAME_SECS    = 120;
const BUBBLE_SPEED = 11;   // px / frame
const BUBBLE_R     = 15;
const BUBBLE_D     = BUBBLE_R * 2;
const HEX_H        = Math.round(BUBBLE_R * Math.sqrt(3));  // ≈ 26 px
const COLS_EVEN    = 9;
const COLS_ODD     = 8;
const INIT_ROWS    = 9;
const POP_MIN      = 3;

const COLORS  = ["#EF4444","#3B82F6","#22C55E","#F59E0B","#A855F7","#EC4899"];
const DARKS   = ["#991B1B","#1E40AF","#166534","#92400E","#5B21B6","#9D174D"];
const LIGHTS  = ["#FCA5A5","#93C5FD","#86EFAC","FDE68A","#C4B5FD","#FBCFE8"];

// ─── TYPES ──────────────────────────────────────────────────────────────────────

type Cell  = string | null;
type Grid  = Cell[][];
type Phase = "matchmaking" | "playing" | "result";

interface MovBubble { x:number; y:number; dx:number; dy:number; color:string }
interface Particle  { x:number; y:number; vx:number; vy:number; r:number; color:string; a:number }
interface PopLabel  { x:number; y:number; pts:number; a:number; vy:number }

interface GS {   // mutable game state kept in ref
  grid:      Grid;
  moving:    MovBubble | null;
  next:      string;
  held:      string;
  shooting:  boolean;
  particles: Particle[];
  popLabels: PopLabel[];
  aimAngle:  number;     // radians from vertical (0 = straight up)
  playerPts: number;
  botPts:    number;
  combo:     number;
}

// ─── GRID HELPERS ──────────────────────────────────────────────────────────────

const makeCols = (r: number) => r % 2 === 0 ? COLS_EVEN : COLS_ODD;
const rndColor  = () => COLORS[Math.floor(Math.random() * COLORS.length)];

function initGrid(): Grid {
  return Array.from({ length: INIT_ROWS }, (_, r) =>
    Array.from({ length: makeCols(r) }, () => rndColor())
  );
}

function cellXY(row: number, col: number, w: number) {
  const startX = (w - COLS_EVEN * BUBBLE_D) / 2;
  const ox = row % 2 === 1 ? BUBBLE_R : 0;
  return {
    x: startX + col * BUBBLE_D + BUBBLE_R + ox,
    y: row * HEX_H + BUBBLE_R + 6,
  };
}

function neighbors(row: number, col: number, grid: Grid) {
  const even = row % 2 === 0;
  const cands = even
    ? [[row,col-1],[row,col+1],[row-1,col-1],[row-1,col],[row+1,col-1],[row+1,col]]
    : [[row,col-1],[row,col+1],[row-1,col],[row-1,col+1],[row+1,col],[row+1,col+1]];
  return (cands as [number,number][]).filter(
    ([r,c]) => r>=0 && r<grid.length && c>=0 && c<makeCols(r)
  ).map(([r,c]) => ({row:r,col:c}));
}

function floodFill(grid: Grid, r0: number, c0: number, color: string) {
  const vis = new Set<string>();
  const q   = [{row:r0,col:c0}];
  const res: {row:number;col:number}[] = [];
  vis.add(`${r0},${c0}`);
  while (q.length) {
    const {row,col} = q.shift()!;
    if (grid[row]?.[col] !== color) continue;
    res.push({row,col});
    for (const nb of neighbors(row,col,grid)) {
      const k = `${nb.row},${nb.col}`;
      if (!vis.has(k)) { vis.add(k); q.push(nb); }
    }
  }
  return res;
}

function anchored(grid: Grid): Set<string> {
  const vis = new Set<string>();
  const q: {row:number;col:number}[] = [];
  for (let c=0;c<makeCols(0);c++) {
    if (grid[0]?.[c] !== null) { vis.add(`0,${c}`); q.push({row:0,col:c}); }
  }
  while (q.length) {
    const curr = q.shift()!;
    for (const nb of neighbors(curr.row,curr.col,grid)) {
      const k = `${nb.row},${nb.col}`;
      if (!vis.has(k) && grid[nb.row]?.[nb.col] !== null) { vis.add(k); q.push(nb); }
    }
  }
  return vis;
}

function nearestEmpty(px:number,py:number,grid:Grid,w:number) {
  let best:{row:number;col:number}|null = null;
  let bestD = BUBBLE_D * 1.8;
  const rows = grid.length + 1;
  for (let r=0; r<rows; r++) {
    for (let c=0; c<makeCols(r); c++) {
      if (r < grid.length && grid[r][c] !== null) continue;
      const {x,y} = cellXY(r,c,w);
      const d = Math.hypot(px-x,py-y);
      if (d < bestD) { bestD=d; best={row:r,col:c}; }
    }
  }
  return best;
}

// ─── CANVAS DRAWING ────────────────────────────────────────────────────────────

function cidx(c:string) { return COLORS.indexOf(c); }
const cDark  = (c:string) => DARKS[cidx(c)]  ?? "#333";
const cLight = (c:string) => { const i=cidx(c); return i>=0? LIGHTS[i] : "#eee"; };

function drawBubble(
  ctx: CanvasRenderingContext2D,
  x:number, y:number, r:number, color:string, alpha=1
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(x-r*.3,y-r*.3,r*.05,x,y,r);
  g.addColorStop(0, cLight(color));
  g.addColorStop(0.45, color);
  g.addColorStop(1, cDark(color));
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle = g; ctx.fill();
  // shine
  ctx.beginPath(); ctx.arc(x-r*.26,y-r*.26,r*.3,0,Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.42)"; ctx.fill();
  // rim
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.strokeStyle = "rgba(255,255,255,0.18)"; ctx.lineWidth=1; ctx.stroke();
  ctx.restore();
}

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  sx:number, sy:number, angle:number, w:number, h:number
) {
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);   // negative y = upward
  let x=sx, y=sy, vx=dx, vy=dy;
  ctx.save();
  ctx.setLineDash([5,7]);
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x,y);
  let steps = 0;
  while (y > 30 && steps < 700) {
    x += vx * 2; y += vy * 2;
    if (x < BUBBLE_R)  { x=BUBBLE_R;   vx=-vx; }
    if (x > w-BUBBLE_R){ x=w-BUBBLE_R; vx=-vx; }
    ctx.lineTo(x,y);
    steps++;
  }
  ctx.stroke();
  ctx.restore();
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
  initialFee?: number;
}

// Bot names
const BOT_NAMES = ["Rahul B","Priya S","Amit K","Sneha R","Vikram J","Neha P"];

export default function BubbleGame({ onBack, initialFee = 10 }: Props) {
  const { total, deductFee, addWinning } = useWallet();
  const { user } = useAuth();

  const userName = user?.displayName || user?.email?.split("@")[0] || "You";
  const botName  = useRef(BOT_NAMES[Math.floor(Math.random()*BOT_NAMES.length)]).current;

  const [phase,      setPhase]      = useState<Phase>("matchmaking");
  const [countdown,  setCountdown]  = useState(3);
  const [timeLeft,   setTimeLeft]   = useState(GAME_SECS);
  const [playerPts,  setPlayerPts]  = useState(0);
  const [botPts,     setBotPts]     = useState(0);
  const [won,        setWon]        = useState(false);
  const [prize,      setPrize]      = useState(0);

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);
  const timerRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  const botRef     = useRef<ReturnType<typeof setInterval>|null>(null);

  // ─── mutable game state ───────────────────────────────────────────────────
  const gs = useRef<GS>({
    grid:      initGrid(),
    moving:    null,
    next:      rndColor(),
    held:      rndColor(),
    shooting:  false,
    particles: [],
    popLabels: [],
    aimAngle:  0,
    playerPts: 0,
    botPts:    0,
    combo:     1,
  });

  // ─── helpers ─────────────────────────────────────────────────────────────
  function cW() { return canvasRef.current?.width ?? 360; }
  function cH() { return canvasRef.current?.height ?? 560; }
  function shooterXY() { return { sx: cW()/2, sy: cH() - 55 }; }

  // pop bubbles and score
  function tryPop(row: number, col: number) {
    const g = gs.current;
    const color = g.grid[row]?.[col];
    if (!color) return;

    const group = floodFill(g.grid, row, col, color);
    if (group.length < POP_MIN) { g.combo = 1; return; }

    // Remove group
    for (const {row:r,col:c} of group) { g.grid[r][c] = null; }

    // Remove floating
    const anch = anchored(g.grid);
    const floating: {row:number;col:number}[] = [];
    for (let r=1;r<g.grid.length;r++) {
      for (let c=0;c<makeCols(r);c++) {
        if (g.grid[r][c] !== null && !anch.has(`${r},${c}`)) {
          floating.push({row:r,col:c});
          g.grid[r][c] = null;
        }
      }
    }

    const w = cW();
    const popped = group.length + floating.length;
    const pts = popped * 10 * g.combo;
    g.playerPts += pts;
    g.combo = Math.min(g.combo + 1, 6);
    setPlayerPts(g.playerPts);

    // Pop label
    const {x,y} = cellXY(row,col,w);
    g.popLabels.push({ x, y: y-10, pts, a: 1, vy: -1.2 });

    // Particles from popped cells
    for (const {row:pr,col:pc} of [...group,...floating]) {
      const {x:bx,y:by} = cellXY(pr,pc,w);
      for (let i=0;i<7;i++) {
        const spd = 1.5 + Math.random()*3;
        const ang = Math.random()*Math.PI*2;
        g.particles.push({
          x:bx, y:by,
          vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd,
          r: 2+Math.random()*4,
          color,
          a: 1,
        });
      }
    }

    // Trim completely empty rows from bottom
    while (g.grid.length > 0 && g.grid[g.grid.length-1].every(c=>c===null)) {
      g.grid.pop();
    }
  }

  // Place a new bubble at grid slot and run pop logic
  function placeBubble(row: number, col: number, color: string) {
    const g = gs.current;
    // Expand grid if needed
    while (g.grid.length <= row) {
      const nr = g.grid.length;
      g.grid.push(Array(makeCols(nr)).fill(null));
    }
    g.grid[row][col] = color;
    tryPop(row, col);

    // Cycle colors
    g.moving    = null;
    g.shooting  = false;
    g.held      = g.next;
    g.next      = rndColor();
  }

  // Shoot the held bubble
  function shoot(angle: number) {
    if (gs.current.shooting) return;
    gs.current.aimAngle = angle;
    const {sx,sy} = shooterXY();
    const clamped = Math.max(-Math.PI/2 + 0.26, Math.min(Math.PI/2 - 0.26, angle));
    gs.current.moving = {
      x: sx, y: sy,
      dx: Math.sin(clamped) * BUBBLE_SPEED,
      dy: -Math.cos(clamped) * BUBBLE_SPEED,
      color: gs.current.held,
    };
    gs.current.shooting = true;
  }

  // ─── game loop ────────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(gameLoop); return; }
    const ctx = canvas.getContext("2d");
    if (!ctx) { rafRef.current = requestAnimationFrame(gameLoop); return; }

    const g  = gs.current;
    const w  = canvas.width;
    const h  = canvas.height;
    const {sx,sy} = shooterXY();

    // ── UPDATE ──
    // Move bubble
    if (g.moving) {
      g.moving.x += g.moving.dx;
      g.moving.y += g.moving.dy;

      // Wall bounce
      if (g.moving.x < BUBBLE_R)   { g.moving.x = BUBBLE_R;   g.moving.dx = Math.abs(g.moving.dx); }
      if (g.moving.x > w-BUBBLE_R) { g.moving.x = w-BUBBLE_R; g.moving.dx = -Math.abs(g.moving.dx); }

      // Top wall
      let hit = false;
      if (g.moving.y <= BUBBLE_R + 8) {
        g.moving.y = BUBBLE_R + 8;
        hit = true;
      }

      // Grid collision
      if (!hit) {
        for (let r=0; r<g.grid.length && !hit; r++) {
          for (let c=0; c<makeCols(r) && !hit; c++) {
            if (g.grid[r][c] === null) continue;
            const {x,y} = cellXY(r,c,w);
            if (Math.hypot(g.moving.x-x, g.moving.y-y) < BUBBLE_D * 0.92) {
              hit = true;
            }
          }
        }
      }

      if (hit) {
        const slot = nearestEmpty(g.moving.x, g.moving.y, g.grid, w);
        if (slot) {
          placeBubble(slot.row, slot.col, g.moving.color);
        } else {
          g.moving   = null;
          g.shooting = false;
        }
      }
    }

    // Particles
    g.particles = g.particles
      .map(p => ({ ...p, x:p.x+p.vx, y:p.y+p.vy, vy:p.vy+0.08, r:p.r*0.96, a:p.a*0.93 }))
      .filter(p => p.a > 0.04 && p.r > 0.4);

    // Pop labels
    g.popLabels = g.popLabels
      .map(l => ({ ...l, y:l.y+l.vy, a:l.a-0.025 }))
      .filter(l => l.a > 0);

    // ── DRAW ──
    ctx.clearRect(0,0,w,h);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0,0,0,h);
    bgGrad.addColorStop(0, "#0d0121");
    bgGrad.addColorStop(1, "#030009");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0,0,w,h);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 0.5;
    for (let y=0; y<h; y+=28) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    for (let x=0; x<w; x+=28) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }

    // Trajectory line (only when not shooting)
    if (!g.moving) {
      drawTrajectory(ctx, sx, sy, g.aimAngle, w, h);
    }

    // Grid bubbles
    for (let r=0; r<g.grid.length; r++) {
      for (let c=0; c<makeCols(r); c++) {
        const color = g.grid[r][c];
        if (!color) continue;
        const {x,y} = cellXY(r,c,w);
        drawBubble(ctx, x, y, BUBBLE_R, color);
      }
    }

    // Moving bubble
    if (g.moving) {
      drawBubble(ctx, g.moving.x, g.moving.y, BUBBLE_R, g.moving.color);
    }

    // Particles
    for (const p of g.particles) {
      ctx.save();
      ctx.globalAlpha = p.a;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle = p.color; ctx.fill();
      ctx.restore();
    }

    // Shooter platform
    ctx.save();
    const platGrad = ctx.createLinearGradient(0,h-90,0,h);
    platGrad.addColorStop(0,"rgba(13,1,33,0)");
    platGrad.addColorStop(0.4,"rgba(13,1,33,0.85)");
    platGrad.addColorStop(1,"rgba(13,1,33,0.98)");
    ctx.fillStyle = platGrad;
    ctx.fillRect(0,h-90,w,90);
    ctx.restore();

    // "NEXT" bubble (small, upper right of shooter area)
    ctx.save();
    ctx.font = "bold 9px system-ui";
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "center";
    ctx.fillText("NEXT", sx+50, sy+16);
    ctx.restore();
    drawBubble(ctx, sx+50, sy+30, BUBBLE_R*0.7, g.next);

    // Held bubble (shooter)
    // Outer ring
    ctx.save();
    ctx.beginPath(); ctx.arc(sx,sy,BUBBLE_R+5,0,Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth=1.5; ctx.stroke();
    ctx.restore();
    drawBubble(ctx, sx, sy, BUBBLE_R, g.held);

    // "TAP TO SHOOT" hint (when not shooting)
    if (!g.moving) {
      ctx.save();
      ctx.font = "bold 10px system-ui";
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.textAlign = "center";
      ctx.fillText("TAP TO SHOOT", sx, h-10);
      ctx.restore();
    }

    // Pop labels
    for (const l of g.popLabels) {
      ctx.save();
      ctx.globalAlpha = l.a;
      ctx.font = "bold 16px system-ui";
      ctx.fillStyle = "#FFD700";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(255,215,0,0.8)";
      ctx.shadowBlur = 8;
      ctx.fillText(`+${l.pts}`, l.x, l.y);
      ctx.restore();
    }

    rafRef.current = requestAnimationFrame(gameLoop);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── aim / shoot input ────────────────────────────────────────────────────
  function handleCanvasInput(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const tx = clientX - rect.left;
    const ty = clientY - rect.top;
    const {sx,sy} = shooterXY();

    // Calculate angle from shooter to tap
    const dx = tx - sx;
    const dy = ty - sy;  // positive = downward in screen
    const angle = Math.atan2(dx, -dy);  // angle from upward Y-axis

    gs.current.aimAngle = angle;

    // Don't shoot downward
    if (ty >= sy - 20) return;
    shoot(angle);
  }

  // ─── resize canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const setSize = () => {
      canvas.width  = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ─── matchmaking → game ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "matchmaking") return;
    // Deduct entry fee
    deductFee(initialFee, `🫧 Bubble Shooter — Entry ₹${initialFee}`);

    // Count down 3s then start
    let cd = 3;
    setCountdown(cd);
    const t = setInterval(() => {
      cd--;
      setCountdown(cd);
      if (cd <= 0) { clearInterval(t); setPhase("playing"); }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── playing phase: RAF + timer + bot ──────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;

    // Start render loop
    rafRef.current = requestAnimationFrame(gameLoop);

    // Timer
    let secs = GAME_SECS;
    timerRef.current = setInterval(() => {
      secs--;
      setTimeLeft(secs);
      if (secs <= 0) endGame();
    }, 1000);

    // Bot AI: random score increments every 5–10s
    botRef.current = setInterval(() => {
      const inc = 20 + Math.floor(Math.random() * 50);
      gs.current.botPts += inc;
      setBotPts(gs.current.botPts);
    }, 5000 + Math.random() * 5000);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (botRef.current)   clearInterval(botRef.current);
    };
  }, [phase]);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── end game ─────────────────────────────────────────────────────────────
  function endGame() {
    cancelAnimationFrame(rafRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (botRef.current)   clearInterval(botRef.current);

    const playerScore = gs.current.playerPts;
    const botScore    = gs.current.botPts;
    const didWin      = playerScore >= botScore;
    const prizeAmt    = didWin ? Math.floor(initialFee * 2 * (1 - PLATFORM_PCT)) : 0;

    if (didWin) {
      addWinning(prizeAmt, `🫧 Bubble Shooter — Won ₹${prizeAmt}`);
    }

    setWon(didWin);
    setPrize(prizeAmt);
    setPhase("result");
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  // ── MATCHMAKING ────────────────────────────────────────────────────────────
  if (phase === "matchmaking") return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(180deg,#0d0121 0%,#020009 100%)", maxWidth:480, margin:"0 auto" }}>

      {/* Floating bubbles background */}
      {COLORS.map((col,i) => (
        <motion.div key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 30+i*8, height: 30+i*8,
            background: col, opacity: 0.15,
            left: `${10+i*15}%`, top: `${20+i*8}%`,
            filter: "blur(2px)",
          }}
          animate={{ y: [-10,10,-10], x: [-5,5,-5] }}
          transition={{ duration: 3+i*0.5, repeat: Infinity, delay: i*0.3 }}
        />
      ))}

      <motion.div
        className="text-8xl mb-6"
        animate={{ scale:[1,1.12,1], rotate:[-5,5,-5] }}
        transition={{ duration:1.8, repeat:Infinity }}
      >🫧</motion.div>

      <h2 className="text-white font-black text-2xl mb-2">Bubble Shooter</h2>
      <p className="text-sm mb-8" style={{ color:"rgba(255,255,255,0.45)" }}>Entry Fee ₹{initialFee}</p>

      {/* Matchmaking card */}
      <div className="w-72 rounded-3xl overflow-hidden"
        style={{ background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(168,85,247,0.35)", boxShadow:"0 0 40px rgba(168,85,247,0.2)" }}>
        <div className="flex items-center gap-4 p-4">
          {/* Player */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl"
              style={{ background:"linear-gradient(135deg,#a855f7,#ec4899)", boxShadow:"0 0 16px rgba(168,85,247,0.5)" }}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-white font-bold text-xs truncate max-w-[80px]">{userName}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background:"rgba(168,85,247,0.2)", color:"#c084fc" }}>YOU</span>
          </div>

          {/* VS */}
          <div className="flex flex-col items-center gap-1">
            <motion.div
              className="font-black text-xl"
              style={{ color:"#FFD700", textShadow:"0 0 12px rgba(255,215,0,0.6)" }}
              animate={{ scale:[1,1.15,1] }} transition={{ duration:0.8, repeat:Infinity }}
            >VS</motion.div>
            <div className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.3)" }}>
              {countdown > 0 ? `Starting in ${countdown}s` : "GO!"}
            </div>
          </div>

          {/* Bot */}
          <div className="flex-1 flex flex-col items-center gap-1.5">
            <motion.div
              className="w-14 h-14 rounded-full flex items-center justify-center font-black text-xl"
              style={{ background:"linear-gradient(135deg,#06b6d4,#3b82f6)", boxShadow:"0 0 16px rgba(59,130,246,0.5)" }}
              animate={{ scale:[1,1.04,1] }} transition={{ duration:1.2, repeat:Infinity }}
            >🤖</motion.div>
            <span className="text-white font-bold text-xs truncate max-w-[80px]">{botName}</span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={{ background:"rgba(59,130,246,0.2)", color:"#60a5fa" }}>BOT</span>
          </div>
        </div>

        {/* Loading bar */}
        <div className="mx-4 mb-4">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.08)" }}>
            <motion.div className="h-full rounded-full"
              style={{ background:"linear-gradient(90deg,#a855f7,#ec4899)" }}
              initial={{ width:"0%" }}
              animate={{ width:"100%" }}
              transition={{ duration:3, ease:"linear" }} />
          </div>
          <div className="mt-2 text-center text-[10px] font-bold" style={{ color:"rgba(255,255,255,0.4)" }}>
            Finding opponent · Entry ₹{initialFee} · Prize ₹{Math.floor(initialFee*2*(1-PLATFORM_PCT))}
          </div>
        </div>
      </div>
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if (phase === "result") return (
    <div className="min-h-screen flex flex-col items-center justify-center px-5 relative overflow-hidden"
      style={{ background:"linear-gradient(180deg,#0d0121 0%,#020009 100%)", maxWidth:480, margin:"0 auto" }}>

      {/* Confetti bubbles */}
      {won && COLORS.map((col,i) => (
        <motion.div key={i}
          className="absolute rounded-full pointer-events-none"
          style={{ width:12+i*4, height:12+i*4, background:col,
            left:`${Math.random()*90+5}%`, top:"-20px", opacity:0.8 }}
          animate={{ y:[0,700], x:[0,(Math.random()-0.5)*80], rotate:[0,360] }}
          transition={{ duration:2+Math.random()*1.5, delay:i*0.12, ease:"easeIn" }}
        />
      ))}

      <motion.div
        className="text-7xl mb-4"
        initial={{ scale:0 }} animate={{ scale:1 }}
        transition={{ type:"spring", stiffness:300, damping:20 }}
      >{won ? "🏆" : "😞"}</motion.div>

      <motion.h2
        className="font-black text-3xl mb-1"
        style={{ color: won ? "#FFD700" : "#ef4444",
          textShadow: won ? "0 0 20px rgba(255,215,0,0.5)" : "0 0 20px rgba(239,68,68,0.4)" }}
        initial={{ y:20, opacity:0 }} animate={{ y:0, opacity:1 }}
        transition={{ delay:0.2 }}
      >{won ? "YOU WON!" : "YOU LOST"}</motion.h2>

      <p className="text-sm mb-6" style={{ color:"rgba(255,255,255,0.45)" }}>
        {won ? `₹${prize} added to your wallet` : "Better luck next time!"}
      </p>

      {/* Score card */}
      <motion.div className="w-full max-w-xs rounded-2xl overflow-hidden mb-5"
        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)" }}
        initial={{ y:24, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.35 }}>

        <div className="flex"
          style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex-1 p-4 text-center" style={{ borderRight:"1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] font-bold mb-1" style={{ color:"rgba(168,85,247,0.7)" }}>YOUR SCORE</div>
            <div className="font-black text-2xl text-white">{playerPts}</div>
          </div>
          <div className="flex-1 p-4 text-center">
            <div className="text-[10px] font-bold mb-1" style={{ color:"rgba(59,130,246,0.7)" }}>BOT SCORE</div>
            <div className="font-black text-2xl text-white">{botPts}</div>
          </div>
        </div>

        {[
          { label:"Entry Fee", value:`₹${initialFee}`, col:"rgba(255,255,255,0.5)" },
          { label:"Platform Fee (10%)", value:`₹${Math.round(initialFee*2*PLATFORM_PCT)}`, col:"rgba(255,255,255,0.4)" },
          { label:"Prize Pool", value:`₹${Math.floor(initialFee*2*(1-PLATFORM_PCT))}`, col:"#FFD700" },
          ...(won ? [{ label:"YOU WIN 🏆", value:`+₹${prize}`, col:"#22c55e" }]
                  : [{ label:"Result",     value:"-₹0 (fee already deducted)", col:"#ef4444" }]),
        ].map(row => (
          <div key={row.label} className="flex justify-between px-4 py-2.5"
            style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
            <span className="text-xs font-bold" style={{ color:"rgba(255,255,255,0.45)" }}>{row.label}</span>
            <span className="text-xs font-black" style={{ color:row.col }}>{row.value}</span>
          </div>
        ))}
      </motion.div>

      <motion.button whileTap={{ scale:0.96 }}
        onClick={() => {
          gs.current = {
            grid:initGrid(), moving:null, next:rndColor(), held:rndColor(),
            shooting:false, particles:[], popLabels:[], aimAngle:0,
            playerPts:0, botPts:0, combo:1,
          };
          setPlayerPts(0); setBotPts(0); setTimeLeft(GAME_SECS);
          setPhase("matchmaking");
        }}
        className="w-full max-w-xs py-4 rounded-2xl font-black text-base mb-3 cursor-pointer relative overflow-hidden"
        style={{ background:"linear-gradient(135deg,#a855f7,#ec4899)", color:"#fff",
          boxShadow:"0 0 28px rgba(168,85,247,0.45)" }}
        initial={{ y:20, opacity:0 }} animate={{ y:0, opacity:1 }} transition={{ delay:0.5 }}
      >
        🔁 Play Again
      </motion.button>
      <motion.button whileTap={{ scale:0.96 }} onClick={onBack}
        className="text-sm font-bold cursor-pointer"
        style={{ color:"rgba(255,255,255,0.4)" }}
        initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.6 }}
      >← Back to Games</motion.button>
    </div>
  );

  // ── PLAYING ────────────────────────────────────────────────────────────────
  const pct    = (timeLeft / GAME_SECS) * 100;
  const urgent = timeLeft <= 30;

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background:"#0d0121", maxWidth:480, margin:"0 auto", userSelect:"none" }}>

      {/* ── TOP BAR ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 pt-3 pb-2"
        style={{ background:"rgba(13,1,33,0.95)", borderBottom:"1px solid rgba(168,85,247,0.2)" }}>
        <motion.button whileTap={{ scale:0.9 }} onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer"
          style={{ background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", color:"rgba(255,255,255,0.6)" }}>
          ←
        </motion.button>

        {/* Timer */}
        <div className="flex flex-col items-center gap-1">
          <motion.div
            className="font-black text-xl tabular-nums"
            style={{ color: urgent ? "#ef4444" : "#FFD700",
              textShadow: urgent ? "0 0 12px rgba(239,68,68,0.6)" : "0 0 8px rgba(255,215,0,0.4)" }}
            animate={urgent ? { scale:[1,1.08,1] } : {}}
            transition={{ duration:0.6, repeat:Infinity }}
          >
            {String(Math.floor(timeLeft/60)).padStart(2,"0")}:{String(timeLeft%60).padStart(2,"0")}
          </motion.div>
          <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background:"rgba(255,255,255,0.1)" }}>
            <motion.div className="h-full rounded-full"
              style={{ width:`${pct}%`, background: urgent
                ? "linear-gradient(90deg,#ef4444,#f97316)"
                : "linear-gradient(90deg,#a855f7,#FFD700)" }}
              transition={{ duration:0.5 }} />
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
          style={{ background:"rgba(255,215,0,0.08)", border:"1px solid rgba(255,215,0,0.2)" }}>
          <span className="text-base">💰</span>
          <span className="font-black text-sm" style={{ color:"#FFD700" }}>₹{Math.floor(total)}</span>
        </div>
      </div>

      {/* ── SCORE BAR ── */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2"
        style={{ background:"rgba(10,2,25,0.9)", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>

        {/* Player score */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.25)" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black"
            style={{ background:"linear-gradient(135deg,#a855f7,#ec4899)" }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.4)" }}>YOU</div>
            <motion.div
              className="font-black text-base leading-none"
              style={{ color:"#c084fc" }}
              key={playerPts}
              animate={{ scale:[1.15,1] }}
              transition={{ duration:0.2 }}
            >{playerPts}</motion.div>
          </div>
        </div>

        <div className="font-black text-xs" style={{ color:"rgba(255,215,0,0.6)" }}>VS</div>

        {/* Bot score */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.25)" }}>
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
            style={{ background:"linear-gradient(135deg,#06b6d4,#3b82f6)" }}>🤖</div>
          <div>
            <div className="text-[9px] font-bold" style={{ color:"rgba(255,255,255,0.4)" }}>BOT</div>
            <motion.div
              className="font-black text-base leading-none"
              style={{ color:"#60a5fa" }}
              key={botPts}
              animate={{ scale:[1.15,1] }}
              transition={{ duration:0.2 }}
            >{botPts}</motion.div>
          </div>
        </div>

        {/* Entry fee info */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="text-[9px] font-bold" style={{ color:"rgba(255,215,0,0.5)" }}>PRIZE</div>
          <div className="font-black text-xs" style={{ color:"#FFD700" }}>
            ₹{Math.floor(initialFee*2*(1-PLATFORM_PCT))}
          </div>
        </div>
      </div>

      {/* ── GAME CANVAS AREA ── */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          style={{ display:"block", width:"100%", height:"100%", touchAction:"none" }}
          onMouseMove={(e) => {
            const rect = canvasRef.current!.getBoundingClientRect();
            const tx = e.clientX-rect.left, ty = e.clientY-rect.top;
            const {sx,sy} = shooterXY();
            const dx=tx-sx, dy=ty-sy;
            gs.current.aimAngle = Math.atan2(dx,-dy);
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            handleCanvasInput(e.clientX, e.clientY);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            const t=e.touches[0];
            const rect = canvasRef.current!.getBoundingClientRect();
            const tx=t.clientX-rect.left, ty=t.clientY-rect.top;
            const {sx,sy} = shooterXY();
            gs.current.aimAngle = Math.atan2(tx-sx,-(ty-sy));
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            const t=e.changedTouches[0];
            handleCanvasInput(t.clientX, t.clientY);
          }}
        />

        {/* Combo badge */}
        <AnimatePresence>
          {gs.current.combo > 1 && (
            <motion.div
              className="absolute top-3 right-3 px-2.5 py-1 rounded-full font-black text-xs"
              style={{ background:"linear-gradient(135deg,#a855f7,#ec4899)", boxShadow:"0 0 16px rgba(168,85,247,0.5)" }}
              initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
            >🔥 x{gs.current.combo} COMBO</motion.div>
          )}
        </AnimatePresence>

        {/* End Game button */}
        <motion.button whileTap={{ scale:0.95 }}
          onClick={endGame}
          className="absolute top-3 left-3 px-2.5 py-1.5 rounded-xl text-[10px] font-black cursor-pointer"
          style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.35)" }}>
          End
        </motion.button>
      </div>
    </div>
  );
}
