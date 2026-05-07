/**
 * Punch Encryption — parties_key-based AES-256-GCM for encrypted IPFS punch storage.
 *
 * Mirrors the W-4 encryption pattern (w4-crypto.ts) exactly:
 *   parties_key = BLAKE3("PNW::PARTIES", TLV(employer_addr, worker_addr))
 *   AES key = PBKDF2(parties_key, "PNW::TimekeepingEncryption::v1", 100k rounds)
 *
 * Both employer and worker can independently derive the same key.
 * Individual punches are encrypted and pinned to IPFS — no blockchain
 * transaction per punch. Weekly aggregation anchors the commitment on-chain.
 */

import { computePartiesKey } from "@/src/handshake/engine";
import { domainHash, toHex } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import type { Address } from "@/src/lib/pnw-adapter/aleo_types";
import type { PunchData, EncryptedPunchEnvelope } from "./types";

// ---------------------------------------------------------------------------
// TLV tags for punch hashing
// ---------------------------------------------------------------------------

const OBJ_PUNCH = 0x7001;

// ---------------------------------------------------------------------------
// Base64 helpers (same as w4-crypto.ts)
// ---------------------------------------------------------------------------

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Key derivation (same pattern as w4-crypto.ts with different salt)
// ---------------------------------------------------------------------------

async function deriveTimekeepingKey(partiesKeyHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(partiesKeyHex),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  const salt = enc.encode("PNW::TimekeepingEncryption::v1");

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Punch hashing — deterministic BLAKE3 hash of punch data
// ---------------------------------------------------------------------------

/**
 * Compute a deterministic BLAKE3 hash of punch data.
 * Used as the punch_id and for integrity verification.
 */
export function hashPunch(punch: PunchData): string {
  const enc = new TextEncoder();
  const data = tlvEncode(OBJ_PUNCH, [
    { tag: 0x01, value: enc.encode(punch.workerAddress) },
    { tag: 0x02, value: enc.encode(punch.timestamp.toString()) },
    { tag: 0x03, value: new Uint8Array([punch.punchType]) },
    { tag: 0x04, value: enc.encode(punch.agreementId) },
  ]);
  return toHex(domainHash("PNW::TIMEKEEPING", data));
}

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt punch data for IPFS storage using the shared parties_key.
 */
export async function encryptPunch(
  punch: PunchData,
  employerAddress: Address,
  workerAddress: Address,
): Promise<EncryptedPunchEnvelope> {
  const partiesKey = computePartiesKey(employerAddress, workerAddress);
  const aesKey = await deriveTimekeepingKey(partiesKey);

  const plaintext = new TextEncoder().encode(JSON.stringify(punch));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    aesKey,
    plaintext as unknown as ArrayBuffer,
  );

  return {
    version: 1,
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(cipherBuf)),
    workerAddress,
    punchHash: hashPunch(punch),
    punchType: punch.punchType,
    date: punch.date,
  };
}

/**
 * Decrypt a punch envelope fetched from IPFS.
 */
export async function decryptPunch(
  envelope: EncryptedPunchEnvelope,
  employerAddress: Address,
  workerAddress: Address,
): Promise<PunchData> {
  const partiesKey = computePartiesKey(employerAddress, workerAddress);
  const aesKey = await deriveTimekeepingKey(partiesKey);

  const iv = base64Decode(envelope.iv);
  const ciphertext = base64Decode(envelope.ciphertext);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    aesKey,
    ciphertext as unknown as ArrayBuffer,
  );

  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json) as PunchData;
}
