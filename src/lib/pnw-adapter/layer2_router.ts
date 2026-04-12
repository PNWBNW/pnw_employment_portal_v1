// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/router/layer2_router.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

import type { Address, Bytes32, Field, U32 } from "./aleo_types";
import type { Layer2Transition } from "./layer2_adapter";

/** A single Layer 2 call plan produced by the router. */
export type Layer2CallPlan = {
  transition: Layer2Transition;
  inputs: string[];
  description: string;
};

/** Parameters for minting a cycle NFT that anchors the batch_root. */
export type CycleNftParams = {
  employer_addr: Address;
  batch_id: Bytes32;
  batch_root: Bytes32;
  epoch_id: U32;
  worker_count: U32;
  total_gross: Field;
};

/**
 * Parameters for minting a credential NFT (credential_nft_v3.aleo).
 *
 * Matches the on-chain signature:
 *   mint_credential_nft(
 *     // Authorization — must match the employer's FinalAgreement for
 *     // the target worker. These 4 fields are pulled from the
 *     // employer's private FinalAgreement record.
 *     agreement_id, parties_key, employer_name_hash, worker_name_hash,
 *
 *     // Credential target
 *     worker_addr,
 *
 *     // Credential content
 *     credential_id, subject_hash, issuer_hash,
 *     scope_hash, doc_hash, root, schema_v, policy_v
 *   )
 *
 * The transition verifies three on-chain assertions before minting:
 *   1) caller owns employer_name_hash (pnw_name_registry_v2)
 *   2) worker_addr owns worker_name_hash (pnw_name_registry_v2)
 *   3) caller holds the parties_key for an ACTIVE agreement with this
 *      worker (employer_agreement_v4::assert_employer_authorized)
 *
 * If any check fails, the mint reverts on-chain.
 *
 * On success, two CredentialNFT records are emitted: one owned by the
 * caller (employer, authoritative) and one owned by `worker_addr`
 * (visible in the worker's wallet on scan).
 */
export type CredentialNftParams = {
  // Authorization
  agreement_id: Bytes32;
  parties_key: Bytes32;
  employer_name_hash: Field;
  worker_name_hash: Field;

  // Credential target
  worker_addr: Address;

  // Credential content
  credential_id: Bytes32;
  subject_hash: Bytes32;
  issuer_hash: Bytes32;
  scope_hash: Bytes32;
  doc_hash: Bytes32;
  root: Bytes32;
  schema_v: U32;
  policy_v: U32;
};

/** Parameters for revoking a credential via the public issuer path. */
export type RevokeCredentialByIssuerParams = {
  credential_id: Bytes32;
};

/** Parameters for authorizing an audit. */
export type AuditAuthParams = {
  employer_addr: Address;
  auditor_addr: Address;
  scope_hash: Bytes32;
  valid_from: U32;
  valid_until: U32;
};

/** Build a Layer 2 call plan for the given transition and parameters. */
export function buildLayer2CallPlan(
  _transition: Layer2Transition,
  _params:
    | CycleNftParams
    | CredentialNftParams
    | RevokeCredentialByIssuerParams
    | AuditAuthParams,
): Layer2CallPlan {
  // Stub: actual implementation synced from pnw_mvp_v2
  throw new Error("Layer 2 router not yet connected. Sync from pnw_mvp_v2.");
}
