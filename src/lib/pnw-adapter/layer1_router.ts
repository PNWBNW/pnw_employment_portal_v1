// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/router/layer1_router.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

import type { Address, Bytes32, Field, U32, U128 } from "./aleo_types";

export type BatchPayrollWorker = {
  worker_addr: Address;
  worker_name_hash: Field;
  agreement_id: Bytes32;
  epoch_id: U32;
  gross_amount: U128;
  net_amount: U128;
  tax_withheld: U128;
  fee_amount: U128;
  receipt_anchor: Bytes32;
  receipt_pair_hash: Bytes32;
  payroll_inputs_hash: Bytes32;
  utc_time_hash: Bytes32;
  audit_event_hash: Bytes32;
  batch_id: Bytes32;
  row_hash: Bytes32;
};
