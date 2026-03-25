/**
 * Credential Actions — client-side logic for issuing and revoking credentials.
 *
 * Hashes are computed here (BLAKE3 + TLV via existing adapter utilities).
 * On-chain calls go through the Layer 2 adapter (stub — not yet connected to pnw_mvp_v2).
 *
 * Flow mirrors EMPLOYER_FLOWS.md §5.
 */

import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";
import type {
  CredentialIssueInput,
  CredentialRecord,
  CredentialType,
} from "@/src/stores/credential_store";
import { CREDENTIAL_TYPE_LABELS } from "@/src/stores/credential_store";

// ----------------------------------------------------------------
// Credential type → numeric code (matches credential_nft.aleo)
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
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

function computeScopeHash(scope: string): Bytes32 {
  const data = tlvEncode(0x4002, [
    { tag: 0x01, value: new TextEncoder().encode(scope) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
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
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

// ----------------------------------------------------------------
// Issue credential — builds the CredentialRecord + simulates on-chain call
// ----------------------------------------------------------------

export type IssueCredentialResult = {
  credential: CredentialRecord;
  /** The snarkos command that would be executed (for display/debugging) */
  command_preview: string;
};

export async function issueCredential(
  input: CredentialIssueInput,
  employerAddr: Address,
  employerNameHash: Field,
  currentEpoch: number,
): Promise<IssueCredentialResult> {
  const issueTime = Math.floor(Date.now() / 1000);

  // Compute all hashes
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

  const credential_type_code = CREDENTIAL_TYPE_CODES[input.credential_type];

  // Build command preview (stub — actual execution via layer2_adapter once pnw_mvp_v2 is synced)
  const command_preview =
    `snarkos developer execute credential_nft.aleo mint_credential_nft ` +
    `"${credential_id}" "${input.worker_name_hash}" "${employerNameHash}" ` +
    `"${scope_hash}" "${doc_hash}" "${credential_type_code}u32"`;

  // NOTE: actual on-chain call via buildLayer2CallPlan is not yet wired
  // because layer2_router.ts is a stub pending pnw_mvp_v2 sync.
  // The record is saved as "pending" until the tx is confirmed.

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
    status: "pending",
  };

  return { credential, command_preview };
}

// ----------------------------------------------------------------
// Revoke credential — simulates on-chain call
// ----------------------------------------------------------------

export type RevokeCredentialResult = {
  command_preview: string;
};

export function buildRevokeCommand(credential: CredentialRecord): string {
  return (
    `snarkos developer execute credential_nft.aleo revoke_credential_nft ` +
    `"${credential.credential_id}" "${credential.doc_hash}"`
  );
}
