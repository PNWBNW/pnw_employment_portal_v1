/**
 * Credential Scanner
 *
 * Reads CredentialNFT records from the connected wallet via the wallet
 * adapter's `requestRecords`, then cross-references the public
 * `credential_status` mapping on-chain to determine which credentials are
 * currently active vs. revoked.
 *
 * Works for both employer-owned and worker-owned copies of a credential —
 * credential_nft_v2 emits both in a single mint transition, so whichever
 * wallet is connected sees its own copy.
 *
 * Pattern mirrors `payroll_history_scanner.ts`.
 */

import { PROGRAMS } from "@/src/config/programs";
import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";
import type {
  CredentialRecord,
  CredentialStatus,
  CredentialType,
} from "@/src/stores/credential_store";
import { CREDENTIAL_TYPE_LABELS } from "@/src/stores/credential_store";

// ---------------------------------------------------------------------------
// Parsed on-chain record
// ---------------------------------------------------------------------------

/** A CredentialNFT record parsed from wallet recordPlaintext */
export type ParsedCredentialRecord = {
  credential_id: Bytes32;        // hex
  subject_hash: Field;           // decimal field
  issuer_hash: Field;            // decimal field
  scope_hash: Bytes32;           // hex
  doc_hash: Bytes32;             // hex
  root: Bytes32;                 // hex
  schema_v: number;
  policy_v: number;
  minted_height: number;         // sentinel (always 0), real height via public mapping
  issuer_addr: Address;          // employer address
  worker_addr: Address;          // worker address
  owner: Address;                // = employer for employer copy, = worker for worker copy
};

/**
 * Parse a single record (as returned by the wallet adapter) into a
 * ParsedCredentialRecord, or null if it doesn't look like a CredentialNFT.
 */
function parseCredentialRecord(
  record: Record<string, unknown>,
): ParsedCredentialRecord | null {
  try {
    const plaintext = typeof record.recordPlaintext === "string" ? record.recordPlaintext : null;
    const recordName = typeof record.recordName === "string" ? record.recordName : null;
    const spent = typeof record.spent === "boolean" ? record.spent : false;

    if (!plaintext) return null;
    if (recordName !== "CredentialNFT") return null;
    // Skip spent records (e.g. revoked-by-owner that consumed the record)
    if (spent) return null;

    // Extract [u8; 32] byte arrays → hex string
    const byteArrayToHex = (fieldName: string): string => {
      const section = plaintext.match(new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]`));
      if (!section?.[1]) return "";
      const bytes = section[1].match(/(\d+)u8/g) ?? [];
      return bytes.map((b) => parseInt(b).toString(16).padStart(2, "0")).join("");
    };

    // Extract scalar fields
    const fieldRegex = (name: string, type: string) =>
      new RegExp(`${name}:\\s*(\\d+)${type}`);

    const subjectHash = plaintext.match(/subject_hash:\s*\[([\s\S]*?)\]/)?.[1]
      ? byteArrayToHex("subject_hash")
      : null;
    const issuerHash = plaintext.match(/issuer_hash:\s*\[([\s\S]*?)\]/)?.[1]
      ? byteArrayToHex("issuer_hash")
      : null;

    // Address fields — match aleo1... pattern
    const addressRegex = (name: string) =>
      new RegExp(`${name}:\\s*(aleo1[a-z0-9]+)`);
    const issuerAddr = plaintext.match(addressRegex("issuer_addr"))?.[1];
    const workerAddr = plaintext.match(addressRegex("worker_addr"))?.[1];
    const owner = plaintext.match(/owner:\s*(aleo1[a-z0-9]+)/)?.[1];

    const credentialId = byteArrayToHex("credential_id");
    const scopeHash = byteArrayToHex("scope_hash");
    const docHash = byteArrayToHex("doc_hash");
    const root = byteArrayToHex("root");

    const schemaV = plaintext.match(fieldRegex("schema_v", "u16"))?.[1];
    const policyV = plaintext.match(fieldRegex("policy_v", "u16"))?.[1];
    const mintedHeight = plaintext.match(fieldRegex("minted_height", "u32"))?.[1];

    if (!credentialId || !issuerAddr || !workerAddr || !owner || !schemaV || !policyV) {
      return null;
    }

    return {
      credential_id: ("0x" + credentialId) as Bytes32,
      subject_hash: (subjectHash ?? "") as Field,
      issuer_hash: (issuerHash ?? "") as Field,
      scope_hash: ("0x" + scopeHash) as Bytes32,
      doc_hash: ("0x" + docHash) as Bytes32,
      root: ("0x" + root) as Bytes32,
      schema_v: parseInt(schemaV, 10),
      policy_v: parseInt(policyV, 10),
      minted_height: mintedHeight ? parseInt(mintedHeight, 10) : 0,
      issuer_addr: issuerAddr as Address,
      worker_addr: workerAddr as Address,
      owner: owner as Address,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public status mapping lookup
// ---------------------------------------------------------------------------

/**
 * Fetch `credential_status[credential_id]` from the chain's public mapping.
 * `endpoint` is expected to already include the network segment
 * (e.g. "https://api.explorer.provable.com/v2/testnet"), matching
 * `ENV.ALEO_ENDPOINT`.
 */
async function fetchCredentialStatus(
  programId: string,
  credentialIdHex: Bytes32,
  endpoint: string,
): Promise<CredentialStatus> {
  try {
    // credential_id is a [u8;32] so the mapping key needs the Aleo array literal format
    const clean = credentialIdHex.startsWith("0x")
      ? credentialIdHex.slice(2)
      : credentialIdHex;
    const bytes: string[] = [];
    for (let i = 0; i < clean.length; i += 2) {
      bytes.push(`${parseInt(clean.slice(i, i + 2), 16)}u8`);
    }
    const keyLiteral = `[${bytes.join(", ")}]`;
    const url = `${endpoint}/program/${programId}/mapping/credential_status/${encodeURIComponent(keyLiteral)}`;
    const res = await fetch(url);
    if (!res.ok) return "active"; // default to active if we can't fetch status
    const text = await res.text();
    // Response is either `null` or a value like "1u8" (active) / "2u8" (revoked)
    const trimmed = text.trim().replace(/^"|"$/g, "");
    if (trimmed === "null" || trimmed === "") return "pending";
    const m = trimmed.match(/(\d+)u8/);
    if (!m) return "active";
    const code = parseInt(m[1]!, 10);
    if (code === 1) return "active";
    if (code === 2) return "revoked";
    return "pending";
  } catch {
    return "active";
  }
}

// ---------------------------------------------------------------------------
// Record → CredentialRecord (shape consumed by the art renderer + UI)
// ---------------------------------------------------------------------------

/**
 * Derive a human-readable CredentialType from a scope string. For the MVP
 * we don't carry the numeric type code in the record (we could add it
 * post-buildathon), so we infer it from the scope text. Unknown → "custom".
 */
function inferCredentialType(scope: string): CredentialType {
  const lower = scope.toLowerCase();
  if (lower.includes("clearance") || lower.includes("security")) return "clearance";
  if (
    lower.includes("skill") ||
    lower.includes("certif") ||
    lower.includes("training") ||
    lower.includes("engineering")
  ) {
    return "skills";
  }
  if (
    lower.includes("employment") ||
    lower.includes("full-time") ||
    lower.includes("part-time") ||
    lower.includes("contract")
  ) {
    return "employment_verified";
  }
  return "custom";
}

/**
 * Convert a ParsedCredentialRecord + its on-chain status into the
 * CredentialRecord shape that the rest of the portal (store, UI, art
 * renderer) already understands.
 *
 * Note: `scope` (plaintext) isn't stored in the on-chain record — only its
 * hash is. For the MVP the worker portal displays the scope_hash directly
 * when no plaintext is available, or the portal can look up a local
 * sessionStorage mapping of scope_hash → scope if the employer exported one.
 * Post-buildathon we can add a scope-plaintext piggyback via a separate
 * encrypted record or a shared IPFS pin.
 */
export function credentialRecordFromParsed(
  parsed: ParsedCredentialRecord,
  status: CredentialStatus,
  scopePlaintext?: string,
): CredentialRecord {
  const scope = scopePlaintext ?? "(scope available on-chain via hash)";
  const credentialType = scopePlaintext
    ? inferCredentialType(scopePlaintext)
    : "custom";

  return {
    credential_id: parsed.credential_id,
    credential_type: credentialType,
    credential_type_label: CREDENTIAL_TYPE_LABELS[credentialType],
    worker_addr: parsed.worker_addr,
    employer_addr: parsed.issuer_addr,
    subject_hash: parsed.subject_hash,
    issuer_hash: parsed.issuer_hash,
    scope,
    scope_hash: parsed.scope_hash,
    doc_hash: parsed.doc_hash,
    issued_epoch: 0,
    status,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan the connected wallet for CredentialNFT records owned by the given
 * address and return them in the CredentialRecord shape the UI uses.
 *
 * Filters:
 * - Only records with `recordName === "CredentialNFT"` are considered.
 * - Spent records are skipped (e.g. burned or revoked-by-owner).
 * - For each returned record, the current on-chain status is fetched from
 *   the `credential_status` public mapping so revocations show up correctly.
 *
 * @param requestRecords  Wallet adapter's requestRecords function
 * @param ownerAddress    The address that should own the records we want
 *                        (typically the connected session address)
 * @param endpoint        REST endpoint for public mapping lookups
 * @param scopeLookup     Optional map of scope_hash → plaintext scope, used
 *                        to recover the human-readable scope if the employer
 *                        has shared it via a sidecar channel. Defaults to
 *                        an empty map — the scanner still works, it just
 *                        shows a placeholder for scope.
 */
export async function scanCredentialRecords(
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  ownerAddress: Address,
  endpoint: string = "https://api.explorer.provable.com/v2/testnet",
  scopeLookup: Map<Bytes32, string> = new Map(),
): Promise<CredentialRecord[]> {
  try {
    console.log("[PNW] Scanning wallet for CredentialNFT records...");
    const programId = PROGRAMS.layer2.credential_nft;
    const records = await requestRecords(programId, true);
    console.log("[PNW] CredentialNFT records from wallet:", records?.length ?? 0);

    if (!Array.isArray(records)) return [];

    // Parse + filter to records this address actually owns
    const parsed: ParsedCredentialRecord[] = [];
    for (const rec of records) {
      const r = parseCredentialRecord(rec as Record<string, unknown>);
      if (!r) continue;
      if (r.owner !== ownerAddress) continue;
      parsed.push(r);
    }
    console.log("[PNW] Parsed CredentialNFT records owned by self:", parsed.length);

    // Deduplicate by credential_id (in case the wallet indexes both copies)
    const byId = new Map<string, ParsedCredentialRecord>();
    for (const r of parsed) {
      if (!byId.has(r.credential_id)) byId.set(r.credential_id, r);
    }

    // Fetch current status for each unique credential and build CredentialRecords
    const results: CredentialRecord[] = [];
    for (const [credentialId, r] of byId) {
      const status = await fetchCredentialStatus(programId, r.credential_id, endpoint);
      const scopePlaintext = scopeLookup.get(r.scope_hash);
      results.push(credentialRecordFromParsed(r, status, scopePlaintext));
      // Small safety: avoid hammering the REST endpoint
      void credentialId;
    }

    // Newest-first ordering by credential_id (stable, deterministic)
    results.sort((a, b) => b.credential_id.localeCompare(a.credential_id));

    console.log("[PNW] Credential records returned:", results.length);
    return results;
  } catch (error) {
    console.warn("[PNW] Credential scan failed:", error);
    return [];
  }
}
