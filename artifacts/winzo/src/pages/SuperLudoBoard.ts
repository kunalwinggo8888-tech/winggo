/**
 * SuperLudoBoard — Canvas renderer for the WINGGO Super Ludo board.
 *
 * The board is drawn on a 2D <canvas> in the same style as the original
 * WINGGO Ludo board (dark theme, coloured home zones, gold safe stars,
 * glowing circular gotis). All coordinates are computed in a canonical
 * 600x600 space (15x15 grid, 40px cells) so the board scales cleanly.
 *
 * Position encoding used by the game:
 *   -1      = token sitting in its home base (not launched)
 *   0–50    = main 52-square loop (positions 0–51 map to the drawn ring)
 *   51–55   = final lane (towards the centre)
 *   56      = reached home (off the board)
 */

export type PlayerId = "yellow" | "blue";

export const PLAYER = "yellow";
export const BOT = "blue";

// ─── Sizing ───────────────────────────────────────────────────────────────────

export const GRID = 15;          // board is 15x15 grid cells
export const CELL = 40;          // px per cell in the canonical 600x600 space
export const BOARD_SIZE = GRID * CELL;

// ─── Palette (canvas-friendly) ───────────────────────────────────────────────

export const C = {
  bg: "#0d1117",
  border: "rgba(255,255,255,0.14)",
  pathFill: "rgba(255,255,255,0.06)",
  safe: "#f59e0b",
  star: "#fbbf24",
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
  yellow: "#facc15",
  redDark: "#b91c1c",
  greenDark: "#15803d",
  blueDark: "#1d4ed8",
  yellowDark: "#ca9703",
  white: "#f8fafc",
};

// ─── Token colours ────────────────────────────────────────────────────────────

export const TOKEN_COLORS: Record<PlayerId, { dark: string; light: string }> = {
  yellow: { dark: C.yellowDark, light: "#fde68a" },
  blue: { dark: C.blueDark, light: "#93c5fd" },
};

// ─── Movement paths (grid coords, 0-14) ──────────────────────────────────────

export const PLAYER_PATHS: Record<PlayerId, [number, number][]> = {
  yellow: [[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8]],
  blue: [[6,13],[6,12],[6,11],[6,10],[6,9],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],[0,7],[0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14]],
};

export const FINAL_PATHS: Record<PlayerId, [number, number][]> = {
  yellow: [[13,7],[12,7],[11,7],[10,7],[9,7]],
  blue: [[7,13],[7,12],[7,11],[7,10],[7,9]],
};

export const HOME_POSITIONS: Record<PlayerId, [number, number][]> = {
  yellow: [[10.5,10.5],[10.5,12.5],[12.5,10.5],[12.5,12.5]],
  blue: [[1.5,10.5],[1.5,12.5],[3.5,10.5],[3.5,12.5]],
};

export const HOME_TRIANGLE_POSITIONS: Record<PlayerId, [number, number][]> = {
  yellow: [[8.2,6.5],[8.2,7.5],[7.8,6.75],[7.8,7.25]],
  blue: [[6.5,8.2],[7.5,8.2],[6.75,7.8],[7.25,7.8]],
};

export const SAFE_CELLS = [0, 8, 13, 21, 26, 34, 39, 47];
export const START_CELLS: Record<PlayerId, number> = { yellow: 0, blue: 0 };

// ─── Board decoration ─────────────────────────────────────────────────────────

// Corner bases (6x6 cells each) — classic Ludo layout.
const BASES: { x: number; y: number; color: string; light: string; label: string }[] = [
  { x: 0, y: 0, color: C.red, light: C.redDark, label: "RED" },
  { x: 9, y: 0, color: C.green, light: C.greenDark, label: "GREEN" },
  { x: 0, y: 9, color: C.blue, light: C.blueDark, label: "BLUE" },
  { x: 9, y: 9, color: C.yellow, light: C.yellowDark, label: "YELLOW" },
];

// Final lanes for all four colours (decorative — red/green are unused by play).
const FINAL_LANES: { cells: [number, number][]; color: string }[] = [
  { cells: [[1,7],[2,7],[3,7],[4,7],[5,7]], color: C.red },
  { cells: [[7,1],[7,2],[7,3],[7,4],[7,5]], color: C.green },
  { cells: FINAL_PATHS.yellow, color: C.yellow },
  { cells: FINAL_PATHS.blue, color: C.blue },
];

// Start cells (visual markers) derived from each colour's ring entry square.
const START_MARKERS: { cell: [number, number]; color: string }[] = [
  { cell: PLAYER_PATHS.yellow[26], color: C.red },    // red's launch square (below red base)
  { cell: PLAYER_PATHS.blue[26], color: C.green },    // green's launch square (left of green base)
  { cell: PLAYER_PATHS.yellow[START_CELLS.yellow], color: C.yellow },
  { cell: PLAYER_PATHS.blue[START_CELLS.blue], color: C.blue },
];

// Physical safe squares (mapped from the yellow path which defines the ring).
const SAFE_GRID = SAFE_CELLS.map((i) => PLAYER_PATHS.yellow[i]);

// ─── Coordinate helpers ───────────────────────────────────────────────────────

export function gridToCanvas(gx: number, gy: number): { x: number; y: number } {
  return { x: (gx + 0.5) * CELL, y: (gy + 0.5) * CELL };
}

export function getTokenCanvasPos(player: PlayerId, tokenIndex: number, pos: number): { x: number; y: number } {
  if (pos === 56) {
    const htp = HOME_TRIANGLE_POSITIONS[player][tokenIndex];
    return gridToCanvas(htp[0], htp[1]);
  }
  if (pos >= 51) {
    const fp = FINAL_PATHS[player][pos - 51];
    return gridToCanvas(fp[0], fp[1]);
  }
  if (pos >= 0) {
    const pp = PLAYER_PATHS[player][pos];
    return gridToCanvas(pp[0], pp[1]);
  }
  const hp = HOME_POSITIONS[player][tokenIndex];
  return gridToCanvas(hp[0], hp[1]);
}

// ─── Board drawing ────────────────────────────────────────────────────────────

function cellRect(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
}

function drawStarShape(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const px = cx + Math.cos(a) * rad;
    const py = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawSafeStar(ctx: CanvasRenderingContext2D, gx: number, gy: number) {
  const p = gridToCanvas(gx, gy);
  ctx.fillStyle = C.star;
  ctx.shadowColor = C.safe;
  ctx.shadowBlur = 8;
  drawStarShape(ctx, p.x, p.y, CELL * 0.26);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawBase(ctx: CanvasRenderingContext2D, b: { x: number; y: number; color: string; light: string; label: string }) {
  const x = b.x * CELL;
  const y = b.y * CELL;
  const w = 6 * CELL;

  ctx.fillStyle = b.color;
  ctx.fillRect(x, y, w, w);
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, w - 2);

  // Inner white pad holding the 4 resting circles
  const pad = 0.5;
  const ix = (b.x + pad) * CELL;
  const iy = (b.y + pad) * CELL;
  const iw = 5 * CELL;
  ctx.fillStyle = C.white;
  ctx.fillRect(ix, iy, iw, iw);
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 1;
  ctx.strokeRect(ix, iy, iw, iw);

  // 4 resting circles (2x2)
  const spots: [number, number][] = [[1.5, 1.5], [1.5, 3.5], [3.5, 1.5], [3.5, 3.5]];
  spots.forEach(([dx, dy]) => {
    const cx = (b.x + dx) * CELL;
    const cy = (b.y + dy) * CELL;
    ctx.beginPath();
    ctx.arc(cx, cy, CELL * 0.78, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // Small label in the base corner
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = `bold ${Math.round(CELL * 0.55)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(b.label, x + w / 2, y + w / 2);
}

function drawCenter(ctx: CanvasRenderingContext2D) {
  const x0 = 6 * CELL;
  const y0 = 6 * CELL;
  const x1 = 9 * CELL;
  const y1 = 9 * CELL;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const tris: { pts: [number, number][]; color: string }[] = [
    { pts: [[x0, y0], [x0, y1], [mx, my]], color: C.red },
    { pts: [[x0, y0], [x1, y0], [mx, my]], color: C.green },
    { pts: [[x1, y0], [x1, y1], [mx, my]], color: C.yellow },
    { pts: [[x1, y1], [x0, y1], [mx, my]], color: C.blue },
  ];
  tris.forEach((t) => {
    ctx.beginPath();
    ctx.moveTo(t.pts[0][0], t.pts[0][1]);
    ctx.lineTo(t.pts[1][0], t.pts[1][1]);
    ctx.lineTo(t.pts[2][0], t.pts[2][1]);
    ctx.closePath();
    ctx.fillStyle = t.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

export function drawSuperLudoBoard(ctx: CanvasRenderingContext2D, size: number) {
  const scale = size / BOARD_SIZE;
  ctx.save();
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

  // Corner bases
  BASES.forEach((b) => drawBase(ctx, b));

  // Final lanes
  FINAL_LANES.forEach((lane) => {
    lane.cells.forEach((c) => cellRect(ctx, c[0] * CELL, c[1] * CELL, CELL, lane.color));
  });

  // Main 52-square ring
  for (let i = 0; i < 52; i++) {
    const g = PLAYER_PATHS.yellow[i];
    cellRect(ctx, g[0] * CELL, g[1] * CELL, CELL, C.pathFill);
  }

  // Start-cell markers
  START_MARKERS.forEach((m) => cellRect(ctx, m.cell[0] * CELL, m.cell[1] * CELL, CELL, m.color));

  // Safe squares (gold stars)
  SAFE_GRID.forEach((g) => drawSafeStar(ctx, g[0], g[1]));

  // Centre triangles
  drawCenter(ctx);

  ctx.restore();
}

// ─── Tokens ───────────────────────────────────────────────────────────────────

export function drawSuperLudoTokens(
  ctx: CanvasRenderingContext2D,
  size: number,
  screenPos: Record<PlayerId, { x: number; y: number }[]>,
  highlight: number[],
  turn: PlayerId,
  time: number,
) {
  const scale = size / BOARD_SIZE;
  ctx.save();
  ctx.scale(scale, scale);

  const players: PlayerId[] = ["yellow", "blue"];
  players.forEach((player) => {
    const arr = screenPos[player] ?? [];
    const col = TOKEN_COLORS[player];
    arr.forEach((p, idx) => {
      if (!p) return;
      const isHighlighted = player === PLAYER && highlight.includes(idx);
      const pulse = 0.5 + 0.5 * Math.sin(time * 5 + idx);
      const r = CELL * 0.34;

      // Highlight glow ring
      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(234,179,8,0.9)";
        ctx.lineWidth = 2.5 + pulse;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 12 + pulse * 5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(234,179,8,0.25)";
        ctx.lineWidth = 5;
        ctx.stroke();
      }

      // Glow + circle
      ctx.shadowColor = col.dark;
      ctx.shadowBlur = isHighlighted ? 16 : 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r);
      grad.addColorStop(0, col.light);
      grad.addColorStop(1, col.dark);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Turn ring for the active player
      if (player === turn && !isHighlighted) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Index label
      ctx.fillStyle = "#ffffff";
      ctx.font = `bold ${Math.round(r * 1.05)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(idx + 1), p.x, p.y + 0.5);
    });
  });

  ctx.restore();
}
