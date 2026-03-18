/**
 * PayrollRunManifest — the central protocol object.
 * Deterministic, content-addressed description of a complete payroll run.
 * See PAYROLL_RUN_MANIFEST.md for full specification.
 */

import type {
  Bytes32,
  Address,
  Field,
  U32,
  U128,
  U16,
} from "../lib/pnw-adapter/aleo_types";

// ----------------------------------------------------------------
// Version tags — increment when calculation rules change
// Must match schema_v / calc_v / policy_v in deployed programs
// ----------------------------------------------------------------
export type ManifestVersions = {
  schema_v: U16;
  calc_v: U16;
  policy_v: U16;
};

// ----------------------------------------------------------------
// Row status — set by Settlement Coordinator after compilation
// ----------------------------------------------------------------
export type PayrollRowStatus =
  | "pending"
  | "proving"
  | "broadcasting"
  | "settled"
  | "conflict"
  | "failed"
  | "needs_retry";

// ----------------------------------------------------------------
// A single worker's payroll row — the atomic settlement unit
// ----------------------------------------------------------------
export type PayrollRow = {
  // Identity
  row_index: number;
  worker_addr: Address;
  worker_name_hash: Field;
  agreement_id: Bytes32;

  // Payroll period
  epoch_id: U32;
  currency: "USDCx";

  // Amounts (minor units: 1 USDCx = 1_000_000 minor units)
  gross_amount: U128;
  tax_withheld: U128;
  fee_amount: U128;
  net_amount: U128;

  // Pre-computed canonical hashes
  payroll_inputs_hash: Bytes32;
  receipt_anchor: Bytes32;
  receipt_pair_hash: Bytes32;
  utc_time_hash: Bytes32;
  audit_event_hash: Bytes32;

  // Manifest linkage (Option B — flows into WorkerPayArgs)
  row_hash: Bytes32;

  // Execution state
  status: PayrollRowStatus;
  tx_id?: string;
  chunk_id?: string;
};

// ----------------------------------------------------------------
// Chunk status
// ----------------------------------------------------------------
export type ChunkStatus =
  | "pending"
  | "proving"
  | "broadcasting"
  | "settled"
  | "failed"
  | "needs_retry";

// ----------------------------------------------------------------
// A chunk — one adapter execution covering 1 or 2 rows
// ----------------------------------------------------------------
export type ChunkPlan = {
  chunk_index: number;
  chunk_id: Bytes32;
  row_indices: number[];
  net_total: U128;
  transition:
    | "execute_payroll"
    | "execute_payroll_batch_2"
    | "execute_payroll_with_creds"
    | "execute_payroll_batch_2_with_creds";
  status: ChunkStatus;
  tx_id?: string;
  attempts: number;
  last_error?: string;
};

// ----------------------------------------------------------------
// Run status
// ----------------------------------------------------------------
export type PayrollRunStatus =
  | "draft"
  | "validated"
  | "queued"
  | "proving"
  | "partially_settled"
  | "settled"
  | "anchored"
  | "failed"
  | "needs_retry";

// ----------------------------------------------------------------
// The manifest — canonical, immutable once batch_id is assigned
// ----------------------------------------------------------------
export type PayrollRunManifest = {
  // Identity
  batch_id: Bytes32;
  schema_v: U16;
  calc_v: U16;
  policy_v: U16;

  // Parties
  employer_addr: Address;
  employer_name_hash: Field;

  // Period
  epoch_id: U32;
  currency: "USDCx";

  // Rows
  row_count: number;
  rows: PayrollRow[];

  // Aggregates
  total_gross_amount: U128;
  total_tax_withheld: U128;
  total_fee_amount: U128;
  total_net_amount: U128;

  // Merkle root over row hashes
  row_root: Bytes32;

  // Top-level commitment hashes
  inputs_hash: Bytes32;
  doc_hash: Bytes32;

  // Run state (mutable — set by coordinator)
  status: PayrollRunStatus;
  chunks?: ChunkPlan[];
  created_at: number;
  updated_at: number;

  // Final anchor (set by BatchAnchorFinalizer)
  anchor_tx_id?: string;
  anchor_nft_id?: Bytes32;
};

// ----------------------------------------------------------------
// Validation error type
// ----------------------------------------------------------------
export type RowValidationError = {
  row_index: number;
  field: string;
  message: string;
};

export class PayrollValidationError extends Error {
  public readonly errors: RowValidationError[];
  constructor(errors: RowValidationError[]) {
    super(
      `Payroll validation failed: ${errors.length} error(s)\n` +
        errors.map((e) => `  Row ${e.row_index}: ${e.field} — ${e.message}`).join("\n"),
    );
    this.name = "PayrollValidationError";
    this.errors = errors;
  }
}
