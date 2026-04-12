/**
 * topo_renderer.ts — Hand-drawn blueprint credential card renderer
 *
 * Draws a 400×600 vertical credential card on an HTML5 Canvas:
 *   - Upper panel: topographic contour map (hand-drawn hatched contour rings)
 *   - Lower panel: isometric profile projection (mountain silhouette + hatching)
 *   - Header strip: type badge + .pnw name
 *   - Info band: credential type label, scope, status, hash fingerprint
 *
 * No external dependencies. Pure Canvas 2D API. All randomness is seeded by
 * the TerrainParams produced from hash_params.ts, so the same input always
 * yields a pixel-identical image.
 */

import type { TerrainParams } from "./hash_params";
import type {
  CredentialType,
  CredentialStatus,
} from "@/src/stores/credential_store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CredentialCardInfo = {
  workerName: string; // e.g. "pnw_dao.pnw"
  /** Full worker Aleo address; drawn as a truncated monospace string below the .pnw name */
  workerAddr?: string;
  credentialTypeLabel: string; // e.g. "CLEARANCE"
  credentialType: CredentialType;
  scope: string; // e.g. "Diamond Security Clearance"
  status: CredentialStatus;
  /** Short display fingerprint (first 8 hex chars of credential_id, "0x..." prefix optional) */
  fingerprint: string;
};

/** Truncate an Aleo address into the "aleo1abcd…xyz6" shape used on the card */
function truncateAddr(addr: string | undefined): string | null {
  if (!addr || addr.length < 14) return null;
  return `${addr.slice(0, 10)}…${addr.slice(-6)}`;
}

// ---------------------------------------------------------------------------
// Card dimensions (locked — matches the plan)
// ---------------------------------------------------------------------------

export const CARD_WIDTH = 400;
export const CARD_HEIGHT = 600;

const HEADER_Y = 0;
const HEADER_H = 60;
const UPPER_Y = 60;
const UPPER_H = 280;
const LOWER_Y = 340;
const LOWER_H = 160;
const INFO_Y = 500;
const INFO_H = 100;

// ---------------------------------------------------------------------------
// Seeded PRNG — mulberry32
// ---------------------------------------------------------------------------

function seedToUint32(seed: number[]): number {
  // Mix bytes into a 32-bit integer via FNV-1a
  let s = 0x811c9dc5; // FNV offset basis
  for (const b of seed) {
    s ^= b;
    s = Math.imul(s, 0x01000193); // FNV prime
  }
  return s >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Value-noise heightmap
// ---------------------------------------------------------------------------

const GRID_W = 40;
const GRID_H = 60;

type Heightmap = {
  cols: number;
  rows: number;
  values: Float32Array; // row-major
};

/** Sample a bilinear-interpolated value from the heightmap at normalized (u, v) */
function sampleHeightmap(h: Heightmap, u: number, v: number): number {
  const x = Math.max(0, Math.min(h.cols - 1.0001, u * (h.cols - 1)));
  const y = Math.max(0, Math.min(h.rows - 1.0001, v * (h.rows - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * h.cols + x0;
  // Float32Array indexed access is always `number` at runtime, but TS reports
  // `number | undefined` under noUncheckedIndexedAccess — bounds are clamped
  // above so these are safe.
  const v00 = h.values[i]!;
  const v10 = h.values[i + 1]!;
  const v01 = h.values[i + h.cols]!;
  const v11 = h.values[i + h.cols + 1]!;
  const a = v00 * (1 - fx) + v10 * fx;
  const b = v01 * (1 - fx) + v11 * fx;
  return a * (1 - fy) + b * fy;
}

function buildHeightmap(
  params: TerrainParams,
): Heightmap {
  const values = new Float32Array(GRID_W * GRID_H);
  const rng = mulberry32(seedToUint32(params.seed));

  // Generate three octaves of value noise at different frequencies
  // Each octave is a coarse random grid then bilinearly interpolated
  const octaves = [
    { freqX: 3, freqY: 4, amp: 1.0 },
    { freqX: 6, freqY: 8, amp: 0.5 },
    { freqX: 12, freqY: 16, amp: 0.25 },
  ];

  // Pre-generate octave grids
  const octaveGrids = octaves.map((oct) => {
    const g = new Float32Array((oct.freqX + 1) * (oct.freqY + 1));
    for (let i = 0; i < g.length; i++) g[i] = rng();
    return { ...oct, grid: g, gw: oct.freqX + 1, gh: oct.freqY + 1 };
  });

  // Compute normalized elevation at every cell using multi-peak contributions.
  // Each peak acts as an independent radial influence; we take the MAX
  // contribution at each cell (not sum) so distinct peaks stay visually
  // separated instead of merging into one blob.
  const { peaks } = params;
  let maxV = -Infinity;
  let minV = Infinity;

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const u = x / (GRID_W - 1);
      const v = y / (GRID_H - 1);

      // Sum octaves for the base noise
      let sum = 0;
      let weightSum = 0;
      for (const oct of octaveGrids) {
        const gx = u * (oct.gw - 1);
        const gy = v * (oct.gh - 1);
        const gx0 = Math.floor(gx);
        const gy0 = Math.floor(gy);
        const fx = gx - gx0;
        const fy = gy - gy0;
        const idx = gy0 * oct.gw + gx0;
        const a =
          oct.grid[idx]! * (1 - fx) + oct.grid[idx + 1]! * fx;
        const b =
          oct.grid[idx + oct.gw]! * (1 - fx) +
          oct.grid[idx + oct.gw + 1]! * fx;
        sum += (a * (1 - fy) + b * fy) * oct.amp;
        weightSum += oct.amp;
      }
      const noise = sum / weightSum;

      // Multi-peak radial influence: for each peak, compute a
      // smooth falloff based on distance. Take the max influence
      // across all peaks so they remain distinct ridges.
      let peakInfluence = 0;
      for (const peak of peaks) {
        const dx = u - peak.x;
        const dy = v - peak.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const r = peak.radius || 0.2;
        const falloff = Math.max(0, 1 - dist / r);
        const contribution = falloff * falloff * peak.height;
        if (contribution > peakInfluence) peakInfluence = contribution;
      }

      // Blend base noise with peak influence. Noise adds texture;
      // peak influence drives the macro shape.
      const v0 = noise * 0.25 + peakInfluence * 0.85;

      values[y * GRID_W + x] = v0;
      if (v0 > maxV) maxV = v0;
      if (v0 < minV) minV = v0;
    }
  }

  // Normalize to 0..1
  const range = maxV - minV || 1;
  for (let i = 0; i < values.length; i++) {
    values[i] = (values[i]! - minV) / range;
  }

  return { cols: GRID_W, rows: GRID_H, values };
}

// ---------------------------------------------------------------------------
// Jittered path drawing
// ---------------------------------------------------------------------------

type Point = [number, number];

/** Draw a jittered stroke along a polyline using a seeded PRNG */
function drawJitteredPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  rng: () => number,
  maxOffset = 0.8,
): void {
  if (points.length < 2) return;

  ctx.beginPath();
  const first = jitterVertex(points[0]!, points[1]!, rng, maxOffset);
  ctx.moveTo(first[0], first[1]);

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const jittered = jitterVertex(prev, curr, rng, maxOffset);
    ctx.lineTo(jittered[0], jittered[1]);
  }
  ctx.stroke();
}

function jitterVertex(
  a: Point,
  b: Point,
  rng: () => number,
  maxOffset: number,
): Point {
  // Perpendicular direction to the segment
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = -dy / len;
  const py = dx / len;
  const offset = (rng() - 0.5) * 2 * maxOffset;
  return [b[0] + px * offset, b[1] + py * offset];
}

// ---------------------------------------------------------------------------
// Marching squares (contour extraction)
// ---------------------------------------------------------------------------

/**
 * Extract contour line segments at a given threshold from the heightmap.
 * Returns a list of [p0, p1] segment pairs in normalized 0..1 coordinates.
 */
function marchingSquares(h: Heightmap, threshold: number): Point[][] {
  const segments: Point[][] = [];
  const { cols, rows, values } = h;

  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols - 1; x++) {
      const tl = values[y * cols + x]!;
      const tr = values[y * cols + x + 1]!;
      const bl = values[(y + 1) * cols + x]!;
      const br = values[(y + 1) * cols + x + 1]!;

      let code = 0;
      if (tl >= threshold) code |= 1;
      if (tr >= threshold) code |= 2;
      if (br >= threshold) code |= 4;
      if (bl >= threshold) code |= 8;

      if (code === 0 || code === 15) continue;

      // Normalized cell coordinates
      const u0 = x / (cols - 1);
      const u1 = (x + 1) / (cols - 1);
      const v0 = y / (rows - 1);
      const v1 = (y + 1) / (rows - 1);

      // Interpolated edge crossings
      const top: Point = [
        u0 + ((threshold - tl) / (tr - tl)) * (u1 - u0),
        v0,
      ];
      const right: Point = [
        u1,
        v0 + ((threshold - tr) / (br - tr)) * (v1 - v0),
      ];
      const bottom: Point = [
        u0 + ((threshold - bl) / (br - bl)) * (u1 - u0),
        v1,
      ];
      const left: Point = [
        u0,
        v0 + ((threshold - tl) / (bl - tl)) * (v1 - v0),
      ];

      // Standard marching squares cases
      switch (code) {
        case 1:
        case 14:
          segments.push([left, top]);
          break;
        case 2:
        case 13:
          segments.push([top, right]);
          break;
        case 3:
        case 12:
          segments.push([left, right]);
          break;
        case 4:
        case 11:
          segments.push([right, bottom]);
          break;
        case 5:
          segments.push([left, top]);
          segments.push([right, bottom]);
          break;
        case 6:
        case 9:
          segments.push([top, bottom]);
          break;
        case 7:
        case 8:
          segments.push([left, bottom]);
          break;
        case 10:
          segments.push([left, bottom]);
          segments.push([top, right]);
          break;
      }
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Paper grain texture
// ---------------------------------------------------------------------------

function drawPaperGrain(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  color: string,
): void {
  // Draw tiny semi-transparent rectangles scattered across the card.
  // Cheaper than building ImageData and sufficient for a subtle "grain" feel.
  ctx.save();
  ctx.fillStyle = color;
  const density = Math.floor(CARD_WIDTH * CARD_HEIGHT * 0.02);
  for (let i = 0; i < density; i++) {
    const x = rng() * CARD_WIDTH;
    const y = rng() * CARD_HEIGHT;
    const alpha = 0.03 + rng() * 0.05;
    ctx.globalAlpha = alpha;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Type badges (hand-drawn icons)
// ---------------------------------------------------------------------------

function drawTypeBadge(
  ctx: CanvasRenderingContext2D,
  type: CredentialType,
  cx: number,
  cy: number,
  size: number,
  ink: string,
  rng: () => number,
): void {
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const half = size / 2;

  switch (type) {
    case "employment_verified": {
      // Shield outline
      const pts: Point[] = [
        [cx - half * 0.85, cy - half * 0.8],
        [cx + half * 0.85, cy - half * 0.8],
        [cx + half * 0.85, cy + half * 0.1],
        [cx, cy + half],
        [cx - half * 0.85, cy + half * 0.1],
        [cx - half * 0.85, cy - half * 0.8],
      ];
      drawJitteredPath(ctx, pts, rng);
      // Inner check mark
      const check: Point[] = [
        [cx - half * 0.35, cy],
        [cx - half * 0.05, cy + half * 0.3],
        [cx + half * 0.4, cy - half * 0.25],
      ];
      drawJitteredPath(ctx, check, rng, 0.5);
      break;
    }
    case "skills": {
      // Hexagon
      const pts: Point[] = [];
      for (let i = 0; i <= 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        pts.push([cx + Math.cos(a) * half, cy + Math.sin(a) * half]);
      }
      drawJitteredPath(ctx, pts, rng);
      break;
    }
    case "clearance": {
      // Diamond (rhombus)
      const pts: Point[] = [
        [cx, cy - half],
        [cx + half, cy],
        [cx, cy + half],
        [cx - half, cy],
        [cx, cy - half],
      ];
      drawJitteredPath(ctx, pts, rng);
      // Inner small diamond
      const inner: Point[] = [
        [cx, cy - half * 0.45],
        [cx + half * 0.45, cy],
        [cx, cy + half * 0.45],
        [cx - half * 0.45, cy],
        [cx, cy - half * 0.45],
      ];
      drawJitteredPath(ctx, inner, rng, 0.5);
      break;
    }
    case "custom": {
      // Triangle
      const pts: Point[] = [
        [cx, cy - half],
        [cx + half * 0.9, cy + half * 0.7],
        [cx - half * 0.9, cy + half * 0.7],
        [cx, cy - half],
      ];
      drawJitteredPath(ctx, pts, rng);
      break;
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Status colors
// ---------------------------------------------------------------------------

function statusColor(status: CredentialStatus): string {
  switch (status) {
    case "active":
      return "#22c55e";
    case "revoked":
      return "#ef4444";
    case "pending":
      return "#f59e0b";
  }
}

function statusLabel(status: CredentialStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export function renderTopoCard(
  canvas: HTMLCanvasElement,
  params: TerrainParams,
  info: CredentialCardInfo,
): void {
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("renderTopoCard: 2D context unavailable");

  const jitterRng = mulberry32(seedToUint32(params.jitterSeed));
  const grainRng = mulberry32(seedToUint32(params.seed.concat(params.jitterSeed)));

  // -------------------------------------------------------------------------
  // 1. Background
  // -------------------------------------------------------------------------
  ctx.fillStyle = params.palette.paper;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // -------------------------------------------------------------------------
  // 2. Paper grain
  // -------------------------------------------------------------------------
  drawPaperGrain(ctx, grainRng, params.palette.paperGrain);

  // -------------------------------------------------------------------------
  // 3. Build the shared heightmap (drives both topo and profile)
  // -------------------------------------------------------------------------
  const heightmap = buildHeightmap(params);

  // -------------------------------------------------------------------------
  // 4. Header strip
  // -------------------------------------------------------------------------
  ctx.save();
  // Type badge (top-left)
  drawTypeBadge(
    ctx,
    info.credentialType,
    30,
    30,
    22,
    params.palette.ink,
    jitterRng,
  );

  // .pnw name (top-right, bold) + truncated Aleo address (smaller, below)
  const truncatedAddr = truncateAddr(info.workerAddr);
  ctx.fillStyle = params.palette.ink;
  ctx.font = 'bold 20px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  if (truncatedAddr) {
    // Two-line header: .pnw name on top, address below
    ctx.fillText(info.workerName, CARD_WIDTH - 16, 28);
    ctx.fillStyle = params.palette.inkDim;
    ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.fillText(truncatedAddr, CARD_WIDTH - 16, 46);
  } else {
    // Fallback: just the .pnw name centered vertically in the header strip
    ctx.textBaseline = "middle";
    ctx.fillText(info.workerName, CARD_WIDTH - 16, 34);
  }
  ctx.restore();

  // Header rule
  ctx.save();
  ctx.strokeStyle = params.palette.inkFaint;
  ctx.lineWidth = 1;
  drawJitteredPath(
    ctx,
    [
      [16, HEADER_H],
      [CARD_WIDTH - 16, HEADER_H],
    ],
    jitterRng,
    0.6,
  );
  ctx.restore();

  // -------------------------------------------------------------------------
  // 5. Upper panel — topographic contour map
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, UPPER_Y, CARD_WIDTH, UPPER_H);
  ctx.clip();

  ctx.strokeStyle = params.palette.ink;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const panelPadX = 24;
  const panelPadY = 16;
  const mapX = panelPadX;
  const mapY = UPPER_Y + panelPadY;
  const mapW = CARD_WIDTH - panelPadX * 2;
  const mapH = UPPER_H - panelPadY * 2;

  for (let i = 0; i < params.contourLevels; i++) {
    // Skip the very edges (0 and 1) so we don't get full-canvas boxes
    const t = (i + 1) / (params.contourLevels + 1);
    const segments = marchingSquares(heightmap, t);

    // Inner rings (higher t) render slightly thicker and more solid
    const weight = 0.6 + t * 0.7;
    ctx.lineWidth = weight;
    ctx.globalAlpha = 0.6 + t * 0.4;

    // Batch all segments for this contour level into a single path + stroke.
    // Drawing each 2-point segment as its own stroked sub-path creates
    // visible gaps between adjacent segments (due to line caps and jitter).
    // Chaining them all inside one beginPath() lets adjacent segments
    // visually merge into continuous rings while still allowing subtle
    // per-segment jitter.
    ctx.beginPath();
    for (const seg of segments) {
      const a = seg[0]!;
      const b = seg[1]!;
      const ax = mapX + a[0] * mapW;
      const ay = mapY + a[1] * mapH;
      const bx = mapX + b[0] * mapW;
      const by = mapY + b[1] * mapH;
      // Apply tiny jitter only to the endpoint (not the start) so adjacent
      // segments sharing an endpoint still visually connect.
      const dx = bx - ax;
      const dy = by - ay;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const offset = (jitterRng() - 0.5) * 0.8;
      const jx = bx + (-dy / len) * offset;
      const jy = by + (dx / len) * offset;
      ctx.moveTo(ax, ay);
      ctx.lineTo(jx, jy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // -------------------------------------------------------------------------
  // 6. Panel divider at y=340
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.strokeStyle = params.palette.inkFaint;
  ctx.lineWidth = 1;
  drawJitteredPath(
    ctx,
    [
      [16, LOWER_Y],
      [CARD_WIDTH - 16, LOWER_Y],
    ],
    jitterRng,
    0.6,
  );
  ctx.restore();

  // -------------------------------------------------------------------------
  // 7. Lower panel — isometric profile projection
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, LOWER_Y, CARD_WIDTH, LOWER_H);
  ctx.clip();

  const profilePadX = 24;
  const profileTop = LOWER_Y + 16;
  const baselineY = LOWER_Y + LOWER_H - 12;
  const profileW = CARD_WIDTH - profilePadX * 2;
  const profileMaxH = (baselineY - profileTop) * params.profileExaggeration;

  // Sample the heightmap along the cross-section row
  const samples = 120;
  const profilePoints: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const u = i / samples;
    const elev = sampleHeightmap(heightmap, u, params.sliceAxisY);
    const px = profilePadX + u * profileW;
    const py = baselineY - elev * profileMaxH;
    profilePoints.push([px, py]);
  }

  // Silhouette stroke
  ctx.strokeStyle = params.palette.ink;
  ctx.lineWidth = 1.3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // First draw the top silhouette curve + close it to baseline for clip shape
  ctx.beginPath();
  ctx.moveTo(profilePadX, baselineY);
  for (const p of profilePoints) {
    ctx.lineTo(p[0], p[1]);
  }
  ctx.lineTo(profilePadX + profileW, baselineY);
  ctx.closePath();

  // Save a copy of this path for clipping the hatches
  ctx.save();
  ctx.clip();

  // Vertical hatches inside the silhouette
  ctx.strokeStyle = params.palette.inkDim;
  ctx.lineWidth = 0.9;
  const hatchCount = params.hatchDensity;
  const hatchGap = profileW / (hatchCount + 1);
  for (let i = 1; i <= hatchCount; i++) {
    const hx = profilePadX + i * hatchGap;
    const lean = (jitterRng() - 0.5) * 2 * params.hatchAngleJitter * profileMaxH;
    drawJitteredPath(
      ctx,
      [
        [hx + lean, profileTop],
        [hx, baselineY],
      ],
      jitterRng,
      0.5,
    );
  }
  ctx.restore();

  // Now stroke the silhouette outline on top (after the clipped hatches)
  ctx.beginPath();
  const firstProfile = profilePoints[0]!;
  ctx.moveTo(firstProfile[0], firstProfile[1]);
  for (let i = 1; i < profilePoints.length; i++) {
    const prev = profilePoints[i - 1]!;
    const curr = profilePoints[i]!;
    const jittered = jitterVertex(prev, curr, jitterRng, 0.6);
    ctx.lineTo(jittered[0], jittered[1]);
  }
  ctx.stroke();

  // Baseline at y=500 equivalent (we use baselineY inside the panel)
  ctx.beginPath();
  ctx.strokeStyle = params.palette.ink;
  ctx.lineWidth = 1;
  drawJitteredPath(
    ctx,
    [
      [profilePadX, baselineY],
      [profilePadX + profileW, baselineY],
    ],
    jitterRng,
    0.4,
  );

  ctx.restore();

  // -------------------------------------------------------------------------
  // 8. Info band
  // -------------------------------------------------------------------------
  // Top rule at y=500
  ctx.save();
  ctx.strokeStyle = params.palette.inkFaint;
  ctx.lineWidth = 1;
  drawJitteredPath(
    ctx,
    [
      [16, INFO_Y],
      [CARD_WIDTH - 16, INFO_Y],
    ],
    jitterRng,
    0.6,
  );
  ctx.restore();

  ctx.save();
  ctx.fillStyle = params.palette.ink;
  ctx.textBaseline = "alphabetic";

  // Credential type label (uppercase, bold)
  ctx.font = 'bold 16px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  ctx.textAlign = "left";
  ctx.fillText(info.credentialTypeLabel.toUpperCase(), 16, INFO_Y + 26);

  // Scope text
  ctx.fillStyle = params.palette.inkDim;
  ctx.font = '13px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(info.scope, 16, INFO_Y + 46);

  // Status dot + text (bottom-left)
  const dotX = 22;
  const dotY = INFO_Y + 76;
  ctx.beginPath();
  ctx.fillStyle = statusColor(info.status);
  ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = params.palette.ink;
  ctx.font = '12px ui-sans-serif, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(statusLabel(info.status), dotX + 10, dotY + 4);

  // Hash fingerprint (monospace, right-aligned)
  ctx.fillStyle = params.palette.inkFaint;
  ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textAlign = "right";
  ctx.fillText(info.fingerprint, CARD_WIDTH - 16, dotY + 4);
  ctx.restore();

  // -------------------------------------------------------------------------
  // 9. Card border (4px inset)
  // -------------------------------------------------------------------------
  ctx.save();
  ctx.strokeStyle = params.palette.inkFaint;
  ctx.lineWidth = 1;
  const b = 4;
  drawJitteredPath(
    ctx,
    [
      [b, b],
      [CARD_WIDTH - b, b],
      [CARD_WIDTH - b, CARD_HEIGHT - b],
      [b, CARD_HEIGHT - b],
      [b, b],
    ],
    jitterRng,
    0.5,
  );
  ctx.restore();
}
