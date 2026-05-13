/**
 * Pipe Connect — WINGGO
 * Tap to rotate pipe segments. Connect source to sink. Water flows when complete.
 * Increasing grid sizes with timer. Beat the clock to win.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/useWallet";
import { getBotDifficulty } from "@/lib/botDifficulty";

const PLATFORM_PCT = 0.10;
const W = 390, H = 480;

type PipeType = "straight" | "elbow" | "tee" | "cross" | "empty";
// Connections: [top, right, bottom, left]
const PIPE_CONNS: Record<PipeType, boolean[][]> = {
  straight: [[true, false, true, false], [false, true, false, true]],
  elbow:    [[false, true, true, false], [true, false, false, true], [true, false, false, true], [false, false, true, true], [false, true, true, false]],
  tee:      [[true, true, true, false], [true, false, true, true], [false, true, true, true], [true, true, false, true]],
  cross:    [[true, true, true, true]],
  empty:    [[false, false, false, false]],
};

interface Cell { type: PipeType; rotation: number; flowing: boolean }
interface GridState { cells: Cell[][]; size: number; sourceR: number; sourceC: number; sinkR: number; sinkC: number }

function getConns(cell: Cell): boolean[] {
  const variants = PIPE_CONNS[cell.type];
  const base = variants[cell.rotation % variants.length];
  return base;
}

function connects(from: Cell, to: Cell, dir: "top" | "right" | "bottom" | "left"): boolean {
  const dirMap: Record<string, [number, number]> = { top: [0, 2], right: [1, 3], bottom: [2, 0], left: [3, 1] };
  const [fromIdx, toIdx] = dirMap[dir];
  return getConns(from)[fromIdx] && getConns(to)[toIdx];
}

function buildGrid(size: number): GridState {
  const sourceR = 0, sourceC = 0;
  const sinkR = size - 1, sinkC = size - 1;
  const cells: Cell[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, (): Cell => {
      const types: PipeType[] = ["straight", "elbow", "tee"];
      const type = types[Math.floor(Math.random() * types.length)];
      const variants = PIPE_CONNS[type];
      return { type, rotation: Math.floor(Math.random() * variants.length), flowing: false };
    })
  );
  cells[sourceR][sourceC].type = "cross"; cells[sourceR][sourceC].rotation = 0;
  cells[sinkR][sinkC].type = "cross"; cells[sinkR][sinkC].rotation = 0;
  return { cells, size, sourceR, sourceC, sinkR, sinkC };
}

function computeFlow(grid: GridState): boolean {
  const { cells, size, sourceR, sourceC, sinkR, sinkC } = grid;
  // Reset flow
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) cells[r][c].flowing = false;

  // BFS from source
  const queue: [number, number][] = [[sourceR, sourceC]];
  cells[sourceR][sourceC].flowing = true;
  const DIRS: [string, number, number][] = [["top", -1, 0], ["right", 0, 1], ["bottom", 1, 0], ["left", 0, -1]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    for (const [dir, dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
      if (cells[nr][nc].flowing) continue;
      if (connects(cells[r][c], cells[nr][nc], dir as "top" | "right" | "bottom" | "left")) {
        cells[nr][nc].flowing = true;
        queue.push([nr, nc]);
      }
    }
  }
  return cells[sinkR][sinkC].flowing;
}

const CELL_SIZE = 52;

// Draw a pipe cell on canvas
function drawCell(ctx: CanvasRenderingContext2D, cell: Cell, cx: number, cy: number, sz: number, isSource: boolean, isSink: boolean) {
  const hs = sz / 2;
  const flowing = cell.flowing;
  const pipeColor = flowing ? "#22c55e" : "#4444aa";
  const glowColor = flowing ? "#22c55e" : "transparent";

  // Cell background
  ctx.fillStyle = flowing ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)";
  ctx.beginPath(); ctx.roundRect(cx - hs + 2, cy - hs + 2, sz - 4, sz - 4, 6); ctx.fill();
  if (flowing) { ctx.strokeStyle = "#22c55e33"; ctx.lineWidth = 1; ctx.stroke(); }

  ctx.strokeStyle = pipeColor;
  ctx.lineWidth = flowing ? 6 : 4;
  if (flowing) { ctx.shadowColor = glowColor; ctx.shadowBlur = 10; }

  const conns = getConns(cell);
  // top
  if (conns[0]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - hs); ctx.stroke(); }
  // right
  if (conns[1]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + hs, cy); ctx.stroke(); }
  // bottom
  if (conns[2]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + hs); ctx.stroke(); }
  // left
  if (conns[3]) { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx - hs, cy); ctx.stroke(); }

  ctx.shadowBlur = 0;

  // Center dot
  ctx.fillStyle = flowing ? "#22c55e" : "#6666cc";
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

  if (isSource) {
    ctx.fillStyle = "#FFD700"; ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (isSink) {
    ctx.fillStyle = "#ff3366"; ctx.shadowColor = "#ff3366"; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

export default function PipeConnectGame({ onBack, initialFee = 10 }: { onBack: () => void; initialFee?: number }) {
  const { addWinning } = useWallet();
  const difficulty = getBotDifficulty(initialFee);
  const prize = Math.floor(initialFee * 2 * (1 - PLATFORM_PCT));

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const gridRef = useRef<GridState | null>(null);
  const [phase, setPhase] = useState<"intro" | "playing" | "result">("intro");
  const [won, setWon] = useState(false);
  const [level, setLevel] = useState(1);
  const [timeLeft, setTimeLeft] = useState(60);
  const [solved, setSolved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const TIME_LIMITS = [60, 50, 40, 30, 25];
  const GRID_SIZES = [4, 5, 5, 6, difficulty.level === "God Mode" ? 10 : 7];

  const startLevel = useCallback((lvl: number) => {
    const sz = GRID_SIZES[Math.min(lvl - 1, GRID_SIZES.length - 1)];
    gridRef.current = buildGrid(sz);
    setLevel(lvl);
    setSolved(false);
    const tl = TIME_LIMITS[Math.min(lvl - 1, TIME_LIMITS.length - 1)];
    setTimeLeft(tl);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setWon(false);
          setPhase("result");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    startLevel(1);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, startLevel]);

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    function handleClick(e: PointerEvent) {
      const grid = gridRef.current;
      if (!grid || solved) return;
      const rect = canvas!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top) * (H / rect.height);
      const { size, cells } = grid;
      const totalW = size * CELL_SIZE, totalH = size * CELL_SIZE;
      const startX = (W - totalW) / 2 + CELL_SIZE / 2;
      const startY = (H - totalH) / 2 + CELL_SIZE / 2 + 20;
      const col = Math.round((mx - startX) / CELL_SIZE);
      const row = Math.round((my - startY) / CELL_SIZE);
      if (row < 0 || row >= size || col < 0 || col >= size) return;
      const cell = cells[row][col];
      const variants = PIPE_CONNS[cell.type];
      cell.rotation = (cell.rotation + 1) % variants.length;

      // Check if solved
      const isSolved = computeFlow(grid);
      if (isSolved) {
        clearInterval(timerRef.current!);
        setSolved(true);
        if (level >= 5) {
          setWon(true);
          addWinning(prize, "Pipe Connect Win");
          setTimeout(() => setPhase("result"), 1200);
        } else {
          setTimeout(() => startLevel(level + 1), 1200);
        }
      }
    }

    canvas.addEventListener("pointerdown", handleClick);

    function loop() {
      if (!gridRef.current) return;
      const grid = gridRef.current;
      const { size, cells, sourceR, sourceC, sinkR, sinkC } = grid;
      computeFlow(grid);

      // Draw
      ctx.fillStyle = "#05040f";
      ctx.fillRect(0, 0, W, H);

      // Grid bg lines
      const totalW = size * CELL_SIZE, totalH = size * CELL_SIZE;
      const startX = (W - totalW) / 2 + CELL_SIZE / 2;
      const startY = (H - totalH) / 2 + CELL_SIZE / 2 + 20;

      // Grid border
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let r = 0; r <= size; r++) {
        ctx.beginPath();
        ctx.moveTo(startX - CELL_SIZE / 2, startY - CELL_SIZE / 2 + r * CELL_SIZE);
        ctx.lineTo(startX - CELL_SIZE / 2 + totalW, startY - CELL_SIZE / 2 + r * CELL_SIZE);
        ctx.stroke();
      }
      for (let c = 0; c <= size; c++) {
        ctx.beginPath();
        ctx.moveTo(startX - CELL_SIZE / 2 + c * CELL_SIZE, startY - CELL_SIZE / 2);
        ctx.lineTo(startX - CELL_SIZE / 2 + c * CELL_SIZE, startY - CELL_SIZE / 2 + totalH);
        ctx.stroke();
      }

      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cx2 = startX + c * CELL_SIZE;
          const cy2 = startY + r * CELL_SIZE;
          drawCell(ctx, cells[r][c], cx2, cy2, CELL_SIZE, r === sourceR && c === sourceC, r === sinkR && c === sinkC);
        }
      }

      // Solved overlay
      if (solved) {
        ctx.fillStyle = "rgba(34,197,94,0.15)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#22c55e";
        ctx.shadowColor = "#22c55e";
        ctx.shadowBlur = 20;
        ctx.font = "bold 28px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(level < 5 ? `Level ${level} Complete! ✓` : "All Pipes Connected!", W / 2, H / 2);
        ctx.shadowBlur = 0;
      }

      // Legend
      ctx.fillStyle = "#FFD700"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "left";
      ctx.fillText("● Source", 12, H - 28);
      ctx.fillStyle = "#ff3366";
      ctx.fillText("● Sink", 80, H - 28);
      ctx.fillStyle = "#22c55e";
      ctx.fillText("● Water flowing", 140, H - 28);

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener("pointerdown", handleClick);
    };
  }, [phase, level, solved, startLevel, addWinning, prize]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex flex-col" style={{ background: "#05040f", maxWidth: 480, margin: "0 auto", minHeight: "100svh" }}>
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: "rgba(0,0,0,0.7)" }}>
        <button onClick={onBack} className="text-white text-xl">←</button>
        <span className="text-white font-black text-lg">🔧 Pipe Connect</span>
        <span className="ml-auto text-xs font-bold px-2 py-1 rounded-full" style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700" }}>₹{initialFee}</span>
        <span className="text-xs font-bold px-2 py-1 rounded-full ml-1" style={{ background: `${difficulty.color}22`, color: difficulty.color, border: `1px solid ${difficulty.color}40` }}>{difficulty.emoji} {difficulty.level}</span>
      </div>
      {phase === "playing" && (
        <div className="flex items-center justify-between px-4 py-2 text-xs" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="text-white font-black">Level {level}/5</div>
          <div className="font-black" style={{ color: timeLeft <= 10 ? "#ef4444" : "#22c55e" }}>⏱ {timeLeft}s</div>
          <div className="text-zinc-400">{GRID_SIZES[Math.min(level - 1, 4)]}×{GRID_SIZES[Math.min(level - 1, 4)]} grid</div>
        </div>
      )}
      <div className="relative">
        <canvas ref={canvasRef} width={W} height={H} className="w-full" style={{ display: "block", touchAction: "none" }} />
        <AnimatePresence>
          {phase === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4"
              style={{ background: "rgba(5,4,15,0.93)" }}>
              <div className="text-7xl">🔧</div>
              <div className="text-white font-black text-3xl">Pipe Connect</div>
              <div className="text-zinc-400 text-sm text-center px-8">Tap pipes to rotate them. Connect the gold source to the red sink before time runs out! 5 levels.</div>
              <div className="px-4 py-2 rounded-xl text-sm" style={{ background: `${difficulty.color}18`, border: `1px solid ${difficulty.color}44`, color: difficulty.color }}>
                {difficulty.emoji} <b>{difficulty.level}</b> · Level 5 grid: {difficulty.level === "God Mode" ? "10×10 nightmare!" : "7×7"}
              </div>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                className="px-10 py-4 rounded-2xl font-black text-black text-lg"
                style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>
                CONNECT! 🔧
              </motion.button>
            </motion.div>
          )}
          {phase === "result" && (
            <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: "rgba(5,4,15,0.95)" }}>
              <div className="text-6xl">{won ? "🏆" : "⏰"}</div>
              <div className="text-white font-black text-3xl">{won ? "All Connected!" : "Time's Up!"}</div>
              <div className="text-zinc-400 text-sm">{won ? `Completed all 5 levels!` : `Stuck on level ${level}.`}</div>
              {won && (
                <div className="px-8 py-3 rounded-2xl text-center" style={{ background: "rgba(255,215,0,0.1)", border: "1.5px solid rgba(255,215,0,0.4)" }}>
                  <div className="text-zinc-400 text-xs mb-1">Prize Won</div>
                  <div className="text-3xl font-black" style={{ color: "#FFD700" }}>₹{prize}</div>
                </div>
              )}
              <div className="flex gap-3 w-full">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPhase("playing")}
                  className="flex-1 py-3.5 rounded-2xl font-black text-black"
                  style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}>Play Again</motion.button>
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
