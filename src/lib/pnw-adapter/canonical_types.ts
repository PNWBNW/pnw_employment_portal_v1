// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/commitments/canonical_types.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

import type { Bytes32 } from "./aleo_types";

export type CanonicalHashes = {
  payroll_inputs_hash: Bytes32;
  receipt_anchor: Bytes32;
  receipt_pair_hash: Bytes32;
  utc_time_hash: Bytes32;
  audit_event_hash: Bytes32;
};
