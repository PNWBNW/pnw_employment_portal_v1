// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/commitments/hash.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

import { blake3 } from "@noble/hashes/blake3.js";

// Domain tags used across the system
export const DOMAIN_TAGS = {
  INPUTS: "PNW::INPUTS",
  DOC: "PNW::DOC",
  LEAF: "PNW::LEAF",
  CHUNK: "PNW::CHUNK",
  NAME: "PNW::NAME",
  MERKLE_NODE: "PNW::MERKLE_NODE",
  ROSTER_LEAF: "PNW::ROSTER_LEAF",
} as const;

export function domainHash(domain: string, data: Uint8Array): Uint8Array {
  const domainBytes = new TextEncoder().encode(domain);
  const combined = new Uint8Array(domainBytes.length + data.length);
  combined.set(domainBytes);
  combined.set(data, domainBytes.length);
  return blake3(combined);
}

export function toHex(bytes: Uint8Array): string {
  return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
