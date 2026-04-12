/**
 * hash_params.ts — Hash → deterministic generative art parameters
 *
 * Converts a 32-byte seed (typically a credential_id, but any 32-byte hash
 * works — this is why the preview page can also accept a raw name_hash) into
 * a TerrainParams object that drives the topographic + profile Canvas renderer.
 *
 * Determinism: same 32-byte input + same credential_type always yields the
 * same TerrainParams, which in turn always yields the same pixel-perfect
 * output from the renderer.
 */

import { fromHex } from "@/src/lib/pnw-adapter/hash";
import type { CredentialType } from "@/src/stores/credential_store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BlueprintPalette = {
  /** Background "paper" color — dark aged navy */
  paper: string;
  /** Subtle lighter tone for procedural paper grain overlay */
  paperGrain: string;
  /** Primary accent ink — the "pen" color for this credential type */
  ink: string;
  /** Dimmed ink (~50% alpha) for secondary strokes like hatching */
  inkDim: string;
  /** Faint ink (~25% alpha) for tertiary elements like rules and borders */
  inkFaint: string;
};

/**
 * A single peak in the multi-peak heightmap.
 *
 * Each credential's terrain is composed of 1-5 of these, arranged
 * horizontally along the card so the lower panel's profile silhouette
 * reads like a unique key shape (different tooth counts, heights, and
 * spacings per credential).
 */
export type Peak = {
  /** Normalized [0, 1] x-position of the peak center */
  x: number;
  /** Normalized [0, 1] y-position of the peak center */
  y: number;
  /** Height multiplier [0, 1]. The tallest peak is normalized to 1. */
  height: number;
  /** Normalized radius of influence (roughly 0.10-0.35 of card width) */
  radius: number;
};

export type TerrainParams = {
  /** 8 bytes seeding the heightmap value-noise function */
  seed: number[];
  /** 8 bytes seeding the hand-drawn line jitter PRNG */
  jitterSeed: number[];
  /** Color palette (selected from credential_type, not hash) */
  palette: BlueprintPalette;
  /** Number of contour rings in the upper panel (6-12) */
  contourLevels: number;
  /**
   * Multi-peak array. Length varies per credential so each card has
   * a unique terrain signature. Peaks are sorted by x for deterministic
   * rendering.
   */
  peaks: Peak[];
  /** Normalized y-position of the cross-section used for the profile (0.35-0.65) */
  sliceAxisY: number;
  /** Vertical scaling factor for the projected profile (0.6-1.2) */
  profileExaggeration: number;
  /** Number of vertical hatch lines inside the profile silhouette (20-40) */
  hatchDensity: number;
  /** Small per-line angle variance on hatching, in radians (0-0.08) */
  hatchAngleJitter: number;
};

// ---------------------------------------------------------------------------
// Palettes by credential type
// ---------------------------------------------------------------------------

const PAPER = "#0a1120";
const PAPER_GRAIN = "#1a2438";

/** Build a palette with a given ink color on the shared paper background */
function buildPalette(inkHex: string): BlueprintPalette {
  const { r, g, b } = hexToRgb(inkHex);
  return {
    paper: PAPER,
    paperGrain: PAPER_GRAIN,
    ink: inkHex,
    inkDim: `rgba(${r}, ${g}, ${b}, 0.5)`,
    inkFaint: `rgba(${r}, ${g}, ${b}, 0.25)`,
  };
}

export const BLUEPRINT_PALETTES: Record<CredentialType, BlueprintPalette> = {
  // Cyan ink (trust / verification)
  employment_verified: buildPalette("#00e5ff"),
  // Gold ink (growth / achievement)
  skills: buildPalette("#f6d365"),
  // Pale parchment ink (authority / prestige)
  clearance: buildPalette("#fef9e7"),
  // Forest ink (flexible / nature)
  custom: buildPalette("#81c784"),
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex;
  const n = parseInt(clean, 16);
  return {
    r: (n >> 16) & 0xff,
    g: (n >> 8) & 0xff,
    b: n & 0xff,
  };
}

// ---------------------------------------------------------------------------
// Seed normalization
// ---------------------------------------------------------------------------

/**
 * Normalize any of the accepted seed inputs into a 32-byte Uint8Array.
 *
 * Accepts:
 *  - "0x..." hex string (exactly 64 hex chars after the prefix)
 *  - plain hex string (64 hex chars)
 *  - a decimal-string BLS12-377 field element (e.g. a .pnw name hash)
 *  - a bigint
 *  - a raw Uint8Array (must be 32 bytes)
 *
 * Decimal / bigint values are serialized big-endian so the "most significant"
 * bytes end up at index 0, matching the display convention for credential_id
 * hex strings throughout the UI.
 */
export function normalizeSeed(
  input: string | bigint | Uint8Array,
): Uint8Array {
  if (input instanceof Uint8Array) {
    if (input.length !== 32) {
      throw new Error(
        `normalizeSeed: Uint8Array must be 32 bytes (got ${input.length})`,
      );
    }
    return input;
  }

  if (typeof input === "bigint") {
    return bigintToBytesBE(input, 32);
  }

  // String — decide between hex and decimal
  const trimmed = input.trim();
  const hexCandidate = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  const isHex = /^[0-9a-fA-F]+$/.test(hexCandidate) && hexCandidate.length === 64;

  if (isHex) {
    return fromHex("0x" + hexCandidate);
  }

  // Treat as decimal
  if (!/^[0-9]+$/.test(trimmed)) {
    throw new Error(
      "normalizeSeed: string must be 64-char hex, 0x-prefixed hex, or decimal",
    );
  }
  return bigintToBytesBE(BigInt(trimmed), 32);
}

function bigintToBytesBE(value: bigint, length: number): Uint8Array {
  if (value < 0n) {
    throw new Error("bigintToBytesBE: negative values are not supported");
  }
  const out = new Uint8Array(length);
  let n = value;
  for (let i = length - 1; i >= 0; i--) {
    out[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  if (n !== 0n) {
    throw new Error(
      `bigintToBytesBE: value overflows ${length} bytes`,
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Multi-peak generation
// ---------------------------------------------------------------------------

/**
 * Simple seeded PRNG (mulberry32) for peak generation — same algorithm
 * as the renderer uses for heightmap noise, but seeded from different
 * hash bytes so peaks and noise are independently varied.
 */
function peakPrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive 1-5 peaks from hash bytes. Each credential gets a unique
 * "key shape" when viewed from the profile cross-section.
 */
function derivePeaks(bytes: Uint8Array): Peak[] {
  // Peak count from byte 24: weighted toward 2-3 peaks for visual interest
  const raw24 = bytes[24]!;
  let peakCount: number;
  if (raw24 < 38) peakCount = 1;        // ~15%
  else if (raw24 < 102) peakCount = 2;   // ~25%
  else if (raw24 < 178) peakCount = 3;   // ~30%
  else if (raw24 < 230) peakCount = 4;   // ~20%
  else peakCount = 5;                     // ~10%

  // Seed the peak PRNG from bytes 10-11 (formerly ridgeCenter)
  const peakSeed = (bytes[10]! << 8) | bytes[11]!;
  const rng = peakPrng(peakSeed);

  const peaks: Peak[] = [];
  for (let i = 0; i < peakCount; i++) {
    peaks.push({
      // Spread peaks across the horizontal axis with some randomness.
      // Base position is evenly spaced; PRNG adds jitter so peaks
      // aren't perfectly uniform.
      x: 0.15 + ((i + 0.5) / peakCount) * 0.7 + (rng() - 0.5) * 0.12,
      // Y positions cluster near the vertical center so the profile
      // slice passes through them. Small vertical jitter keeps the
      // contour map from looking like a horizontal line of dots.
      y: 0.35 + rng() * 0.3,
      // Heights vary so the tallest peak can be any position (first,
      // middle, last). One peak is always normalized to ~1.0.
      height: 0.4 + rng() * 0.6,
      // Radii vary so some peaks are sharp spires, others broad hills.
      // Smaller radii for more peaks so they don't merge into one blob.
      radius: (0.12 + rng() * 0.18) / Math.sqrt(peakCount),
    });
  }

  // Normalize: tallest peak = 1.0
  const maxH = Math.max(...peaks.map((p) => p.height));
  if (maxH > 0) {
    for (const p of peaks) p.height /= maxH;
  }

  // Sort by x for deterministic rendering
  peaks.sort((a, b) => a.x - b.x);

  return peaks;
}

// ---------------------------------------------------------------------------
// Parameter extraction
// ---------------------------------------------------------------------------

/**
 * Derive deterministic TerrainParams from a seed + credential type.
 *
 * Byte usage is intentionally not documented in detail — see project
 * policy in docs/nft_plan.md "Visual Uniqueness — what stays proprietary".
 */
export function deriveTerrainParams(
  seed: string | bigint | Uint8Array,
  credentialType: CredentialType,
): TerrainParams {
  const bytes = normalizeSeed(seed);
  // normalizeSeed guarantees bytes.length === 32, so all indices below are valid.

  const noiseSeed = Array.from(bytes.slice(0, 8));
  const jitterSeed = Array.from(bytes.slice(16, 24));

  const contourLevels = 6 + (bytes[9]! % 7); // 6..12

  // Multi-peak generation — each credential gets 1-5 peaks arranged
  // along the horizontal, so the lower panel's profile silhouette
  // reads like a unique key shape (different tooth count, heights,
  // spacings) per credential.
  const peaks = derivePeaks(bytes);

  // Slice axis y-position — deterministic per credential, biased
  // toward the vertical center where peaks cluster so the profile
  // cross-section always passes through meaningful terrain.
  const peakYMean =
    peaks.reduce((sum, p) => sum + p.y, 0) / Math.max(1, peaks.length);
  const sliceOffset = ((bytes[12]! / 255) - 0.5) * 0.08; // ±0.04
  const sliceAxisY = Math.max(0.25, Math.min(0.75, peakYMean + sliceOffset));

  const profileExaggeration = 0.8 + (bytes[13]! / 255) * 0.5; // 0.8..1.3
  const hatchDensity = 20 + (bytes[14]! % 21); // 20..40
  const hatchAngleJitter = (bytes[15]! / 255) * 0.08; // 0..0.08 rad

  return {
    seed: noiseSeed,
    jitterSeed,
    palette: BLUEPRINT_PALETTES[credentialType],
    contourLevels,
    peaks,
    sliceAxisY,
    profileExaggeration,
    hatchDensity,
    hatchAngleJitter,
  };
}
