/**
 * W-4 Encryption — parties_key-based AES-256-GCM for cross-browser W-4 sharing.
 *
 * Both the employer and worker can independently derive the same parties_key
 * from their shared knowledge of each other's wallet addresses:
 *
 *   parties_key = BLAKE3("PNW::PARTIES", TLV(employer_addr, worker_addr))
 *
 * This key is used to derive an AES-256-GCM encryption key (via PBKDF2)
 * that encrypts the W-4 data before it's pinned to IPFS. Either party
 * can decrypt it because they can both compute the same parties_key.
 *
 * The encrypted W-4 on IPFS is identified by a deterministic CID lookup
 * key stored in a public mapping or the agreement metadata — the employer
 * doesn't need to be online when the worker submits their W-4.
 *
 * Flow:
 *   Worker submits W-4 → encrypt(W4Data, parties_key) → IPFS pin
 *   Employer runs payroll → fetch IPFS → decrypt(blob, parties_key) → W4Data
 */

import { computePartiesKey } from "@/src/handshake/engine";
import type { W4Data } from "@/src/stores/w4_store";
import type { Address } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// AES-256-GCM helpers (mirrors key_provider.ts pattern)
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

/** Derive AES-256-GCM key from the parties_key hex string */
async function deriveW4Key(partiesKeyHex: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(partiesKeyHex),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Domain-specific salt so W-4 keys don't collide with draft encryption
  const salt = enc.encode("PNW::W4Encryption::v1");

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------------------------------------------------------------------------
// Encrypted W-4 envelope (what gets stored on IPFS)
// ---------------------------------------------------------------------------

export type EncryptedW4Envelope = {
  /** Version tag for forward compatibility */
  version: 1;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** AES-GCM ciphertext of JSON-serialized W4Data (base64) */
  ciphertext: string;
  /** Worker address (plaintext — needed for IPFS lookup key) */
  workerAddress: string;
  /** When the W-4 was encrypted (UTC ms) */
  encryptedAt: number;
};

// ---------------------------------------------------------------------------
// Encrypt / Decrypt
// ---------------------------------------------------------------------------

/**
 * Encrypt W-4 data for IPFS storage using the shared parties_key.
 *
 * Both parties can independently compute parties_key from their
 * knowledge of each other's addresses, so both can decrypt.
 */
export async function encryptW4(
  w4: W4Data,
  employerAddress: Address,
  workerAddress: Address,
): Promise<EncryptedW4Envelope> {
  const partiesKey = computePartiesKey(employerAddress, workerAddress);
  const aesKey = await deriveW4Key(partiesKey);

  const plaintext = new TextEncoder().encode(JSON.stringify(w4));
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
    encryptedAt: Date.now(),
  };
}

/**
 * Decrypt a W-4 envelope fetched from IPFS.
 *
 * The employer calls this when loading a worker's W-4 for payroll.
 * They derive the same parties_key from the worker's address.
 */
export async function decryptW4(
  envelope: EncryptedW4Envelope,
  employerAddress: Address,
  workerAddress: Address,
): Promise<W4Data> {
  const partiesKey = computePartiesKey(employerAddress, workerAddress);
  const aesKey = await deriveW4Key(partiesKey);

  const iv = base64Decode(envelope.iv);
  const ciphertext = base64Decode(envelope.ciphertext);

  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
    aesKey,
    ciphertext as unknown as ArrayBuffer,
  );

  const json = new TextDecoder().decode(plainBuf);
  return JSON.parse(json) as W4Data;
}

// ---------------------------------------------------------------------------
// IPFS helpers
// ---------------------------------------------------------------------------

/**
 * Encrypt a W-4 and upload to IPFS via the existing Pinata proxy route.
 * Returns the IPFS CID for the encrypted envelope.
 */
export async function uploadEncryptedW4(
  w4: W4Data,
  employerAddress: Address,
  workerAddress: Address,
): Promise<string> {
  const envelope = await encryptW4(w4, employerAddress, workerAddress);
  const envelopeJson = JSON.stringify(envelope);

  const response = await fetch("/api/terms/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: envelopeJson,
      filename: `w4-${workerAddress.slice(0, 12)}.enc.json`,
    }),
  });

  if (!response.ok) {
    throw new Error(`W-4 IPFS upload failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.cid ?? data.IpfsHash ?? data.hash ?? "";
}

/**
 * Fetch and decrypt a W-4 from IPFS by its CID.
 * The employer calls this when they need the worker's W-4 for payroll.
 */
export async function fetchAndDecryptW4(
  cid: string,
  employerAddress: Address,
  workerAddress: Address,
): Promise<W4Data> {
  // Fetch from IPFS gateway
  const response = await fetch(
    `/api/terms/lookup?cid=${encodeURIComponent(cid)}`,
  );

  if (!response.ok) {
    throw new Error(`W-4 IPFS fetch failed: ${response.statusText}`);
  }

  const envelopeJson = await response.text();
  const envelope: EncryptedW4Envelope = JSON.parse(envelopeJson);

  return decryptW4(envelope, employerAddress, workerAddress);
}

/**
 * Deterministic lookup key for a worker's W-4 CID.
 * Stored in localStorage by both parties so the employer can find
 * the worker's W-4 without an on-chain lookup.
 */
export function w4CidKey(workerAddress: Address): string {
  return `pnw_w4_cid_${workerAddress}`;
}
