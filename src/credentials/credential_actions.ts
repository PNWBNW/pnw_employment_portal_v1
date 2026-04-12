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

/**
 * Encode the credential type code into a 32-byte "root" value.
 *
 * The on-chain `CredentialNFT.root` field was originally reserved for a
 * Merkle root over an attestation tree. We're not using that root yet, so
 * for v2 we repurpose its first byte to carry the credential_type code.
 * This lets the worker-side scanner recover the type (and therefore the
 * color palette) from on-chain data alone, without needing a sidecar
 * scope→type lookup or a program redeploy.
 *
 *   root[0]     = CREDENTIAL_TYPE_CODES[type]  (1/2/3/99)
 *   root[1..31] = 0x00...  (reserved)
 *
 * When we eventually add a real attestation tree, we'll move the type
 * code into a dedicated record field via a v3 deploy.
 */
function encodeTypeRoot(type: CredentialType): Bytes32 {
  const code = CREDENTIAL_TYPE_CODES[type];
  const hex = code.toString(16).padStart(2, "0") + "00".repeat(31);
  return ("0x" + hex) as Bytes32;
}

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

/**
 * Compute a unique 32-byte credential_id.
 *
 * Binds the credential to:
 *   - the employer wallet (identity of the issuer)
 *   - the worker's .pnw name hash (identity of the subject — survives even
 *     if the worker later rotates their wallet address)
 *   - the worker wallet (current recipient address, used for on-chain
 *     record ownership at mint time)
 *   - the scope string (the plaintext credential contract text)
 *   - the issue time (unix seconds — makes repeated credentials distinct)
 *
 * Because worker_name_hash is inside the TLV, two credentials minted by
 * the same employer for two different .pnw names will produce completely
 * different credential_ids and therefore completely different generative
 * art even if they happen to share a worker wallet address, scope, and
 * issue time.
 */
function computeCredentialId(
  employerAddr: Address,
  workerNameHash: Field,
  workerAddr: Address,
  scope: string,
  issueTime: number,
): Bytes32 {
  const data = tlvEncode(0x4001, [
    { tag: 0x01, value: encodeAddress(employerAddr) },
    { tag: 0x02, value: encodeField(workerNameHash) },
    { tag: 0x03, value: encodeAddress(workerAddr) },
    { tag: 0x04, value: new TextEncoder().encode(scope) },
    { tag: 0x05, value: encodeU32(issueTime) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data)) as Bytes32;
}

/**
 * Serialize a Field (decimal field element or hex string) to a 32-byte
 * big-endian representation for TLV encoding. Matches the normalizeHash32
 * convention used elsewhere in this file.
 */
function encodeField(value: Field | string): Uint8Array {
  const s = String(value).trim();
  if (s.startsWith("0x") && s.length === 66) {
    // Already a 32-byte hex string
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(s.slice(2 + i * 2, 2 + i * 2 + 2), 16);
    }
    return bytes;
  }
  if (/^[0-9]+$/.test(s)) {
    // Decimal field element → 32-byte big-endian
    let n = BigInt(s);
    const bytes = new Uint8Array(32);
    for (let i = 31; i >= 0; i--) {
      bytes[i] = Number(n & 0xffn);
      n >>= 8n;
    }
    return bytes;
  }
  // Fall back to TextEncoder — preserves legacy behavior for unknown shapes
  return new TextEncoder().encode(s);
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
// Mint inputs — 13 params for credential_nft_v3::mint_credential_nft
// ----------------------------------------------------------------

/**
 * Build the 13-element input array for credential_nft_v3::mint_credential_nft:
 *
 *   Authorization (prove the caller is the employer of an active
 *   FinalAgreement for this worker):
 *     r0: agreement_id       [u8;32]  (from the employer's FinalAgreement)
 *     r1: parties_key        [u8;32]  (private field from the same record)
 *     r2: employer_name_hash field
 *     r3: worker_name_hash   field
 *
 *   Credential target:
 *     r4: worker_addr        address
 *
 *   Credential content:
 *     r5: credential_id      [u8;32]
 *     r6: subject_hash       [u8;32]
 *     r7: issuer_hash        [u8;32]
 *     r8: scope_hash         [u8;32]
 *     r9: doc_hash           [u8;32]
 *     r10: root              [u8;32]
 *     r11: schema_v          u16
 *     r12: policy_v          u16
 */
export function buildMintInputs(args: {
  // Authorization — pulled from the employer's FinalAgreement record
  agreementId: Bytes32;
  partiesKey: Bytes32;
  employerNameHash: Field;
  workerNameHash: Field;

  // Credential target
  workerAddr: Address;

  // Credential content
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
    // Authorization
    hexToU8Array32(args.agreementId),
    hexToU8Array32(args.partiesKey),
    // Field literals use `<decimal>field` suffix
    `${fieldToDecimal(args.employerNameHash)}field`,
    `${fieldToDecimal(args.workerNameHash)}field`,

    // Credential target
    args.workerAddr, // raw aleo1... string

    // Credential content
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

/**
 * Normalize a field value (either a decimal string or a hex string)
 * to its decimal string form so it can be serialized as `Nfield` in
 * the Aleo input literal.
 */
function fieldToDecimal(value: Field | string): string {
  const s = String(value).trim();
  if (/^[0-9]+$/.test(s)) return s;
  if (s.startsWith("0x")) {
    // hex → bigint → decimal
    return BigInt(s).toString();
  }
  if (/^[0-9a-fA-F]{64}$/.test(s)) {
    return BigInt("0x" + s).toString();
  }
  // Fall back to zero
  return "0";
}

// ----------------------------------------------------------------
// Issue credential — builds the hashes + submits the on-chain mint
// ----------------------------------------------------------------

export type IssueCredentialResult = {
  credential: CredentialRecord;
  tx_id: string;
};

/**
 * The authorization material the portal extracts from the employer's
 * FinalAgreement record for the target worker. These four values are
 * consumed by the on-chain `employer_agreement_v4::assert_employer_authorized`
 * cross-program call during the mint.
 *
 * Typically pulled from a `FinalAgreement` record via the wallet's
 * `requestRecords` on the issue page — see
 * `app/(employer)/credentials/issue/page.tsx`.
 */
export type CredentialAuthInput = {
  agreement_id: Bytes32;
  parties_key: Bytes32;
  employer_name_hash: Field;
  worker_name_hash: Field;
};

/**
 * Build a CredentialRecord + submit the mint via the connected wallet.
 *
 * The `walletExecute` parameter is expected to already include
 * `privateFee: false` in its closure (same pattern used by the
 * settlement coordinator) — Shield wallet silently drops proof gen
 * without it.
 *
 * The `auth` parameter carries the four authorization fields the v3
 * contract requires. If they don't match an active agreement, the
 * on-chain mint reverts and the tx is rejected.
 */
export async function issueCredential(
  input: CredentialIssueInput,
  employerAddr: Address,
  employerNameHash: Field,
  currentEpoch: number,
  auth: CredentialAuthInput,
  walletExecute: WalletExecuteFn,
): Promise<IssueCredentialResult> {
  const issueTime = Math.floor(Date.now() / 1000);

  // Compute all hashes client-side. credential_id now binds the worker's
  // .pnw name hash into its input TLV so the identity is permanent —
  // every credential ever issued to the same .pnw name will share that
  // component even as other fields (scope, issue time, etc.) vary.
  const credential_id = computeCredentialId(
    employerAddr,
    input.worker_name_hash,
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

  // Encode credential_type into root[0] so the worker-side scanner can
  // recover the color palette from on-chain data alone.
  const typeEncodedRoot = encodeTypeRoot(input.credential_type);

  // Build the 13-element input array for the v3 on-chain mint
  const mintInputs = buildMintInputs({
    // Authorization from the employer's FinalAgreement record
    agreementId: auth.agreement_id,
    partiesKey: auth.parties_key,
    employerNameHash: auth.employer_name_hash,
    workerNameHash: auth.worker_name_hash,

    // Credential target
    workerAddr: input.worker_addr,

    // Credential content
    credentialId: credential_id,
    subjectHash: input.worker_name_hash,
    issuerHash: employerNameHash,
    scopeHash: scope_hash,
    docHash: doc_hash,
    root: typeEncodedRoot,
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
