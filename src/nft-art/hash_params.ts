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

export type TerrainParams = {
  /** 8 bytes seeding the heightmap value-noise function */
  seed: number[];
  /** 8 bytes seeding the hand-drawn line jitter PRNG */
  jitterSeed: number[];
  /** Color palette (selected from credential_type, not hash) */
  palette: BlueprintPalette;
  /** Number of contour rings in the upper panel (6-12) */
  contourLevels: number;
  /** Normalized (x, y) peak location of the heightmap ridge (each in 0-1) */
  ridgeCenter: [number, number];
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
// Parameter extraction
// ---------------------------------------------------------------------------

/**
 * Derive deterministic TerrainParams from a seed + credential type.
 *
 * Byte usage (0-indexed):
 *   bytes[0..7]   → heightmap noise seed
 *   bytes[8]      → reserved for future palette variants
 *   bytes[9]      → contour ring count
 *   bytes[10..11] → ridge center (x, y) normalized
 *   bytes[12]     → slice axis y-position (0.35..0.65)
 *   bytes[13]     → profile vertical exaggeration (0.6..1.2)
 *   bytes[14]     → hatch density (20..40)
 *   bytes[15]     → hatch angle jitter (0..0.08 rad)
 *   bytes[16..23] → jitter PRNG seed
 *   bytes[24..31] → reserved
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

  // Ridge center is biased toward the middle of the panel so mountains feel
  // centered rather than clipped against edges. Byte 10/11 still drives
  // asymmetry (off-center placement), just within a tighter window.
  const ridgeCenter: [number, number] = [
    0.3 + (bytes[10]! / 255) * 0.4, // 0.30..0.70
    0.3 + (bytes[11]! / 255) * 0.4, // 0.30..0.70
  ];

  // Slice axis is always close to the ridge center y-position so the
  // cross-section actually passes through the peak and the profile looks
  // like a mountain for every credential. Byte 12 adds a small offset so
  // different credentials get slightly different slice angles.
  const sliceOffset = ((bytes[12]! / 255) - 0.5) * 0.08; // ±0.04
  const sliceAxisY = Math.max(
    0.25,
    Math.min(0.75, ridgeCenter[1] + sliceOffset),
  );

  const profileExaggeration = 0.8 + (bytes[13]! / 255) * 0.5; // 0.8..1.3
  const hatchDensity = 20 + (bytes[14]! % 21); // 20..40
  const hatchAngleJitter = (bytes[15]! / 255) * 0.08; // 0..0.08 rad

  return {
    seed: noiseSeed,
    jitterSeed,
    palette: BLUEPRINT_PALETTES[credentialType],
    contourLevels,
    ridgeCenter,
    sliceAxisY,
    profileExaggeration,
    hatchDensity,
    hatchAngleJitter,
  };
}
