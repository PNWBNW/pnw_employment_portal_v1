/**
 * Receipt Reconciler
 *
 * Maps returned Layer 1 paystub receipt records back to manifest rows.
 * Matching is done by payroll_inputs_hash — the unique content-addressed
 * identifier for each payroll computation.
 *
 * After settlement, the coordinator calls reconcileReceipts() to verify
 * that each settled row has a corresponding on-chain receipt.
 */

import type { PayrollRunManifest, PayrollRow } from "../manifest/types";
import type { Bytes32 } from "../lib/pnw-adapter/aleo_types";

// ----------------------------------------------------------------
// Receipt shape (from Layer 1 paystub_receipts program)
// ----------------------------------------------------------------

export type PaystubReceipt = {
  /** Transaction ID that created this receipt */
  tx_id: string;
  /** The payroll_inputs_hash stored in the receipt record */
  payroll_inputs_hash: Bytes32;
  /** The receipt_anchor stored in the receipt record */
  receipt_anchor: Bytes32;
  /** The batch_id stored in the receipt record */
  batch_id: Bytes32;
  /** The row_hash stored in the receipt record */
  row_hash: Bytes32;
  /** Raw record data for audit trail */
  raw_data?: Record<string, unknown>;
};

// ----------------------------------------------------------------
// Reconciliation result
// ----------------------------------------------------------------

export type ReconciliationResult = {
  /** Number of manifest rows that matched a receipt */
  matched: number;
  /** Number of manifest rows with no matching receipt */
  unmatched: number;
  /** Number of receipts with no matching manifest row (orphans) */
  orphaned: number;
  /** Per-row match details */
  rowMatches: RowMatch[];
  /** Receipts that didn't match any row */
  orphanedReceipts: PaystubReceipt[];
  /** Whether all rows are reconciled */
  fullyReconciled: boolean;
};

export type RowMatch = {
  row_index: number;
  matched: boolean;
  receipt?: PaystubReceipt;
  /** Mismatch details if receipt found but hashes don't align */
  mismatch?: string;
};

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Reconcile a set of paystub receipts against a manifest.
 *
 * Matching strategy:
 * 1. Primary: match by payroll_inputs_hash (unique per row)
 * 2. Verification: confirm batch_id and row_hash match
 *
 * @param manifest - The compiled manifest to reconcile against
 * @param receipts - Paystub receipts scanned from chain
 * @returns Detailed reconciliation result
 */
export function reconcileReceipts(
  manifest: PayrollRunManifest,
  receipts: PaystubReceipt[],
): ReconciliationResult {
  // Build lookup index: payroll_inputs_hash → receipt
  const receiptIndex = new Map<string, PaystubReceipt>();
  for (const receipt of receipts) {
    receiptIndex.set(receipt.payroll_inputs_hash, receipt);
  }

  const rowMatches: RowMatch[] = [];
  const matchedReceiptHashes = new Set<string>();
  let matched = 0;
  let unmatched = 0;

  for (const row of manifest.rows) {
    const receipt = receiptIndex.get(row.payroll_inputs_hash);

    if (!receipt) {
      rowMatches.push({ row_index: row.row_index, matched: false });
      unmatched++;
      continue;
    }

    // Verify batch_id and row_hash match
    const mismatch = verifyReceiptMatch(manifest, row, receipt);

    if (mismatch) {
      rowMatches.push({
        row_index: row.row_index,
        matched: false,
        receipt,
        mismatch,
      });
      unmatched++;
    } else {
      rowMatches.push({
        row_index: row.row_index,
        matched: true,
        receipt,
      });
      matched++;
      matchedReceiptHashes.add(receipt.payroll_inputs_hash);
    }
  }

  // Find orphaned receipts (receipts that don't match any row)
  const orphanedReceipts = receipts.filter(
    (r) => !matchedReceiptHashes.has(r.payroll_inputs_hash),
  );

  return {
    matched,
    unmatched,
    orphaned: orphanedReceipts.length,
    rowMatches,
    orphanedReceipts,
    fullyReconciled: matched === manifest.rows.length && orphanedReceipts.length === 0,
  };
}

/**
 * Update manifest row statuses based on reconciliation.
 * Returns a new rows array (does not mutate).
 */
export function applyReconciliation(
  rows: PayrollRow[],
  result: ReconciliationResult,
): PayrollRow[] {
  return rows.map((row) => {
    const match = result.rowMatches.find((m) => m.row_index === row.row_index);
    if (!match) return row;

    if (match.matched && match.receipt) {
      return {
        ...row,
        status: "settled" as const,
        tx_id: match.receipt.tx_id,
      };
    }

    if (match.mismatch) {
      return {
        ...row,
        status: "conflict" as const,
      };
    }

    return row;
  });
}

// ----------------------------------------------------------------
// Internal
// ----------------------------------------------------------------

function verifyReceiptMatch(
  manifest: PayrollRunManifest,
  row: PayrollRow,
  receipt: PaystubReceipt,
): string | undefined {
  if (receipt.batch_id !== manifest.batch_id) {
    return `batch_id mismatch: expected ${manifest.batch_id}, got ${receipt.batch_id}`;
  }

  if (receipt.row_hash !== row.row_hash) {
    return `row_hash mismatch: expected ${row.row_hash}, got ${receipt.row_hash}`;
  }

  if (receipt.receipt_anchor !== row.receipt_anchor) {
    return `receipt_anchor mismatch: expected ${row.receipt_anchor}, got ${receipt.receipt_anchor}`;
  }

  return undefined;
}
