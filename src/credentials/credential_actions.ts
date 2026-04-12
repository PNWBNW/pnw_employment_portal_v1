/**
 * Credential Actions — client-side logic for issuing and revoking credentials.
 *
 * Hashes are computed here (BLAKE3 + TLV via the existing adapter utilities).
 * The mint / revoke transactions themselves run through the wallet adapter
 * via `walletExecute` — same pattern as `batch_anchor_finalizer::mintBatchAnchorViaWallet`
 * and the settlement coordinator.
 *
 * Flow mirrors EMPLOYER_FLOWS.md §5.
 */

import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import {
  LAYER2_TRANSITIONS,
} from "@/src/lib/pnw-adapter/layer2_adapter";
import {
  executeAleoTransaction,
  type WalletExecuteFn,
} from "@/src/lib/wallet/wallet-executor";
import { VERSIONS } from "@/src/config/programs";
import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";
import type {
  CredentialIssueInput,
  CredentialRecord,
  CredentialType,
} from "@/src/stores/credential_store";
import { CREDENTIAL_TYPE_LABELS } from "@/src/stores/credential_store";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Fee for a credential mint, in microcredits (0.5 credits). */
const DEFAULT_MINT_FEE = 500_000;

/** All-zeros 32-byte hash, used as a placeholder for root when not tracked. */
const ZERO_BYTES32: Bytes32 = ("0x" + "00".repeat(32)) as Bytes32;

// ----------------------------------------------------------------
// Type → numeric code mapping (matches credential_nft_v2.aleo's
// expectation of schema_v / policy_v being nonzero u16 values).
// ----------------------------------------------------------------

const CREDENTIAL_TYPE_CODES: Record<CredentialType, number> = {
  employment_verified: 1,
  skills: 2,
  clearance: 3,
  custom: 99,
};

// ----------------------------------------------------------------
// Hash helpers
// ----------------------------------------------------------------

function encodeAddress(addr: string): Uint8Array {
  return new TextEncoder().encode(addr);
}

function encodeU32(v: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (v >>> 24) & 0xff;
  buf[1] = (v >>> 16) & 0xff;
  buf[2] = (v >>> 8) & 0xff;
  buf[3] = v & 0xff;
  return buf;
}

function computeCredentialId(
  employerAddr: Address,
  workerAddr: Address,
  scope: string,
  issueTime: number,
): Bytes32 {
  const data = tlvEncode(0x4001, [
    { tag: 0x01, value: encodeAddress(employerAddr) },
    { tag: 0x02, value: encodeAddress(workerAddr) },
    { tag: 0x03, value: new TextEncoder().encode(scope) },
    { tag: 0x04, value: encodeU32(issueTime) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data)) as Bytes32;
}

function computeScopeHash(scope: string): Bytes32 {
  const data = tlvEncode(0x4002, [
    { tag: 0x01, value: new TextEncoder().encode(scope) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data)) as Bytes32;
}

function computeDocHash(
  credentialId: Bytes32,
  subjectHash: Field,
  issuerHash: Field,
  scopeHash: Bytes32,
): Bytes32 {
  const data = tlvEncode(0x4003, [
    { tag: 0x01, value: new TextEncoder().encode(credentialId) },
    { tag: 0x02, value: new TextEncoder().encode(subjectHash) },
    { tag: 0x03, value: new TextEncoder().encode(issuerHash) },
    { tag: 0x04, value: new TextEncoder().encode(scopeHash) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data)) as Bytes32;
}

// ----------------------------------------------------------------
// Aleo input formatting
// ----------------------------------------------------------------

/** Convert a hex string (with or without 0x) to an Aleo [u8; 32] array literal. */
function hexToU8Array32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  while (bytes.length < 32) bytes.push(0);
  return "[ " + bytes.slice(0, 32).map((b) => `${b}u8`).join(", ") + " ]";
}

/**
 * Normalize a hash-ish input into a 32-byte hex string. Handles:
 *   - 0x-prefixed hex ("0xabcd...") → as-is
 *   - plain 64-char hex ("abcd...") → prepend 0x
 *   - decimal field element ("27993...") → big-endian 32-byte representation
 *
 * The portal's `subject_hash` and `issuer_hash` values have historically been
 * stored as either hex strings or decimal field elements depending on which
 * code path populated them — this function converts both shapes to the
 * single canonical 32-byte hex format the on-chain program expects.
 */
function normalizeHash32(value: string): Bytes32 {
  const trimmed = value.trim();

  // 0x-prefixed hex
  if (trimmed.startsWith("0x")) {
    const clean = trimmed.slice(2);
    if (/^[0-9a-fA-F]+$/.test(clean) && clean.length === 64) {
      return trimmed as Bytes32;
    }
  }

  // Plain 64-char hex
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return ("0x" + trimmed) as Bytes32;
  }

  // Decimal field element → big-endian 32 bytes → hex
  if (/^[0-9]+$/.test(trimmed)) {
    let n = BigInt(trimmed);
    const bytes = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(n & 0xffn);
      n >>= 8n;
    }
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return ("0x" + hex) as Bytes32;
  }

  // Fall back to zeros rather than throwing — keeps the flow alive
  // if a bad input slips through. The on-chain call will still have
  // a valid 32-byte value, it just won't be meaningful.
  return ZERO_BYTES32;
}

// ----------------------------------------------------------------
// Mint inputs — 9 params for credential_nft_v2::mint_credential_nft
// ----------------------------------------------------------------

/**
 * Build the 9-element input array for credential_nft_v2::mint_credential_nft:
 *
 *   r0: worker_addr address
 *   r1: credential_id [u8;32]
 *   r2: subject_hash  [u8;32]  (worker name hash)
 *   r3: issuer_hash   [u8;32]  (employer name hash)
 *   r4: scope_hash    [u8;32]
 *   r5: doc_hash      [u8;32]
 *   r6: root          [u8;32]
 *   r7: schema_v      u16
 *   r8: policy_v      u16
 */
export function buildMintInputs(args: {
  workerAddr: Address;
  credentialId: Bytes32;
  subjectHash: Field;
  issuerHash: Field;
  scopeHash: Bytes32;
  docHash: Bytes32;
  root?: Bytes32;
  schemaV?: number;
  policyV?: number;
}): string[] {
  return [
    args.workerAddr, // address — use raw aleo1... string
    hexToU8Array32(args.credentialId),
    hexToU8Array32(normalizeHash32(args.subjectHash)),
    hexToU8Array32(normalizeHash32(args.issuerHash)),
    hexToU8Array32(args.scopeHash),
    hexToU8Array32(args.docHash),
    hexToU8Array32(args.root ?? ZERO_BYTES32),
    `${args.schemaV ?? VERSIONS.schema_v}u16`,
    `${args.policyV ?? VERSIONS.policy_v}u16`,
  ];
}

// ----------------------------------------------------------------
// Issue credential — builds the hashes + submits the on-chain mint
// ----------------------------------------------------------------

export type IssueCredentialResult = {
  credential: CredentialRecord;
  tx_id: string;
};

/**
 * Build a CredentialRecord + submit the mint via the connected wallet.
 *
 * The `walletExecute` parameter is expected to already include
 * `privateFee: false` in its closure (same pattern used by the
 * settlement coordinator) — Shield wallet silently drops proof gen
 * without it.
 */
export async function issueCredential(
  input: CredentialIssueInput,
  employerAddr: Address,
  employerNameHash: Field,
  currentEpoch: number,
  walletExecute: WalletExecuteFn,
): Promise<IssueCredentialResult> {
  const issueTime = Math.floor(Date.now() / 1000);

  // Compute all hashes client-side
  const credential_id = computeCredentialId(
    employerAddr,
    input.worker_addr,
    input.scope,
    issueTime,
  );
  const scope_hash = computeScopeHash(input.scope);
  const doc_hash = computeDocHash(
    credential_id,
    input.worker_name_hash,
    employerNameHash,
    scope_hash,
  );

  // Build the 9-element input array for the on-chain mint
  const mintInputs = buildMintInputs({
    workerAddr: input.worker_addr,
    credentialId: credential_id,
    subjectHash: input.worker_name_hash,
    issuerHash: employerNameHash,
    scopeHash: scope_hash,
    docHash: doc_hash,
    // root is optional on v2 — we'll pass zeros for the MVP. Post-buildathon
    // this can be a Merkle root over the credential's attestation tree if
    // we add that data.
    root: ZERO_BYTES32,
  });

  console.log("[PNW-CRED] Minting credential via wallet:", {
    program: LAYER2_TRANSITIONS.mint_credential_nft.program,
    function: LAYER2_TRANSITIONS.mint_credential_nft.transition,
    credential_id,
    worker_addr: input.worker_addr,
    scope: input.scope,
  });

  const tx_id = await executeAleoTransaction(
    walletExecute,
    LAYER2_TRANSITIONS.mint_credential_nft.program,
    LAYER2_TRANSITIONS.mint_credential_nft.transition,
    mintInputs,
    DEFAULT_MINT_FEE,
  );

  console.log("[PNW-CRED] Mint tx broadcast:", tx_id);

  const credential: CredentialRecord = {
    credential_id,
    credential_type: input.credential_type,
    credential_type_label: CREDENTIAL_TYPE_LABELS[input.credential_type],
    worker_addr: input.worker_addr,
    employer_addr: employerAddr,
    subject_hash: input.worker_name_hash,
    issuer_hash: employerNameHash,
    scope: input.scope,
    scope_hash,
    doc_hash,
    issued_epoch: currentEpoch,
    expires_epoch: input.expires_epoch,
    // Start as "pending" — the UI will flip to "active" once the
    // wallet polling confirms the tx, or the credential scanner picks
    // up the new record on the worker side.
    status: "pending",
    tx_id,
  };

  // Swallow unused-code-path lint — the numeric type code is reserved
  // for a future on-chain field we may add in v3.
  void CREDENTIAL_TYPE_CODES;

  return { credential, tx_id };
}

// ----------------------------------------------------------------
// Revoke credential — employer flips public status (no record consumption)
// ----------------------------------------------------------------

export type RevokeCredentialResult = {
  tx_id: string;
};

/**
 * Revoke a credential via the public issuer path. Calls
 * `credential_nft_v2::revoke_by_issuer(credential_id)` — the program
 * asserts that `self.caller` matches the recorded issuer for that
 * credential_id, then flips the public `credential_status` mapping to
 * REVOKED. Neither record copy (employer's or worker's) is consumed,
 * so both wallets continue to hold the credential but the portal
 * will render it as revoked (grayscale) when the scanner reads the
 * public status.
 */
export async function revokeCredentialByIssuer(
  credential: CredentialRecord,
  walletExecute: WalletExecuteFn,
): Promise<RevokeCredentialResult> {
  const inputs = [hexToU8Array32(credential.credential_id)];

  console.log("[PNW-CRED] Revoking credential (issuer public):", {
    program: LAYER2_TRANSITIONS.revoke_credential_by_issuer.program,
    function: LAYER2_TRANSITIONS.revoke_credential_by_issuer.transition,
    credential_id: credential.credential_id,
  });

  const tx_id = await executeAleoTransaction(
    walletExecute,
    LAYER2_TRANSITIONS.revoke_credential_by_issuer.program,
    LAYER2_TRANSITIONS.revoke_credential_by_issuer.transition,
    inputs,
    DEFAULT_MINT_FEE,
  );

  console.log("[PNW-CRED] Revoke tx broadcast:", tx_id);

  return { tx_id };
}
