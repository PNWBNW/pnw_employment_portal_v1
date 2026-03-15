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

/** Parameters for minting a credential NFT. */
export type CredentialNftParams = {
  worker_addr: Address;
  employer_addr: Address;
  credential_type: U32;
  credential_hash: Bytes32;
  issued_at: U32;
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
  _params: CycleNftParams | CredentialNftParams | AuditAuthParams,
): Layer2CallPlan {
  // Stub: actual implementation synced from pnw_mvp_v2
  throw new Error("Layer 2 router not yet connected. Sync from pnw_mvp_v2.");
}
