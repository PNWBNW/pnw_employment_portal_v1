/**
 * Payroll table row validation.
 * All validation runs client-side before manifest compilation.
 *
 * Simplified flow: worker_name must be resolved (auto-fills worker_addr,
 * worker_name_hash, agreement_id). Gross is required. Tax/fee default to 0.
 */

import type {
  PayrollTableRow,
  RowValidationResult,
  RowFieldError,
} from "./types";
import { parseDollar } from "./types";

/** Validate a single payroll table row */
export function validateRow(row: PayrollTableRow): RowValidationResult {
  const errors: RowFieldError[] = [];

  // Worker name required
  if (!row.worker_name.trim()) {
    errors.push({ field: "worker_name", message: "Worker name is required" });
  } else if (!row.resolved) {
    errors.push({
      field: "worker_name",
      message: "Worker not resolved — select from dropdown",
    });
  }

  // Agreement ID must be auto-filled (via worker resolution)
  if (!row.agreement_id.trim()) {
    errors.push({ field: "agreement_id", message: "No agreement — select a worker" });
  }

  // Epoch ID required: must be a positive integer that fits in u32 (max ~4.29e9)
  // Accepts both legacy YYYYMMDD (8 digits) and unix-seconds (10 digits) formats.
  if (!row.epoch_id.trim()) {
    errors.push({ field: "epoch_id", message: "Epoch is required" });
  } else {
    const trimmed = row.epoch_id.trim();
    if (!/^\d+$/.test(trimmed)) {
      errors.push({
        field: "epoch_id",
        message: "Epoch must be a positive integer",
      });
    } else {
      const value = Number(trimmed);
      if (value <= 0 || value > 4_294_967_295) {
        errors.push({
          field: "epoch_id",
          message: "Epoch must be between 1 and 4294967295 (u32 range)",
        });
      }
    }
  }

  // Amount validations
  const gross = parseDollar(row.gross_amount);
  const tax = parseDollar(row.tax_withheld);
  const fee = parseDollar(row.fee_amount);
  const net = parseDollar(row.net_amount);

  if (isNaN(gross) || gross <= 0) {
    errors.push({
      field: "gross_amount",
      message: "Gross amount must be > 0",
    });
  }

  if (isNaN(tax) || tax < 0) {
    errors.push({
      field: "tax_withheld",
      message: "Tax must be >= 0",
    });
  }

  if (isNaN(fee) || fee < 0) {
    errors.push({
      field: "fee_amount",
      message: "Fee must be >= 0",
    });
  }

  if (isNaN(net) || net <= 0) {
    errors.push({
      field: "net_amount",
      message: "Net amount must be > 0",
    });
  }

  // Net = gross - tax - fee (within floating point tolerance)
  if (!isNaN(gross) && !isNaN(tax) && !isNaN(fee) && !isNaN(net)) {
    const expected = Math.round((gross - tax - fee) * 100) / 100;
    const actual = Math.round(net * 100) / 100;
    if (Math.abs(expected - actual) > 0.005) {
      errors.push({
        field: "net_amount",
        message: `Net must equal gross - tax - fee (expected ${expected.toFixed(2)})`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Check for duplicate (agreement_id, epoch_id) pairs across all rows */
export function findDuplicates(
  rows: PayrollTableRow[],
): Map<string, number[]> {
  const seen = new Map<string, number[]>();
  rows.forEach((row, index) => {
    if (!row.agreement_id.trim() || !row.epoch_id.trim()) return;
    const key = `${row.agreement_id.trim()}::${row.epoch_id.trim()}`;
    const existing = seen.get(key);
    if (existing) {
      existing.push(index);
    } else {
      seen.set(key, [index]);
    }
  });

  // Only return entries with duplicates
  const duplicates = new Map<string, number[]>();
  for (const [key, indices] of seen) {
    if (indices.length > 1) {
      duplicates.set(key, indices);
    }
  }
  return duplicates;
}

/** Validate all rows and return per-row results + duplicate info */
export function validateTable(rows: PayrollTableRow[]): {
  rowResults: RowValidationResult[];
  duplicates: Map<string, number[]>;
  allValid: boolean;
} {
  const rowResults = rows.map((row) => validateRow(row));
  const duplicates = findDuplicates(rows);

  // Add duplicate errors to affected rows
  for (const [, indices] of duplicates) {
    for (const idx of indices) {
      const result = rowResults[idx];
      if (result) {
        result.errors.push({
          field: "worker_name",
          message: "Same worker already in this payroll run for this epoch",
        });
        result.valid = false;
      }
    }
  }

  const allValid =
    rowResults.every((r) => r.valid) && duplicates.size === 0;

  return { rowResults, duplicates, allValid };
}
