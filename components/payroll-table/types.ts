/**
 * Payroll table row — the editable form before manifest compilation.
 * This is the UI-level row; it gets transformed into a PayrollRow
 * by the manifest compiler in E4.
 */

export type PayrollTableRow = {
  /** Client-side unique ID for React key (not on-chain) */
  id: string;
  /** Worker display name (session-only label) */
  worker_name: string;
  /** Worker Aleo address */
  worker_addr: string;
  /** Worker name hash from agreement */
  worker_name_hash: string;
  /** Agreement ID from on-chain record */
  agreement_id: string;
  /** Epoch identifier (YYYYMMDD format) */
  epoch_id: string;
  /** Gross pay in display dollars (e.g., "1234.56") */
  gross_amount: string;
  /** Tax withheld in display dollars */
  tax_withheld: string;
  /** Fee in display dollars */
  fee_amount: string;
  /** Net pay — auto-calculated: gross - tax - fee */
  net_amount: string;
};

export type RowValidationResult = {
  valid: boolean;
  errors: RowFieldError[];
};

export type RowFieldError = {
  field: keyof PayrollTableRow;
  message: string;
};

/** Create a blank row with a unique ID */
export function createEmptyRow(): PayrollTableRow {
  return {
    id: crypto.randomUUID(),
    worker_name: "",
    worker_addr: "",
    worker_name_hash: "",
    agreement_id: "",
    epoch_id: "",
    gross_amount: "",
    tax_withheld: "",
    fee_amount: "",
    net_amount: "",
  };
}

/** Parse a dollar string to a number, returning NaN on failure */
export function parseDollar(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

/** Format a number as a dollar display string */
export function formatDollar(value: number): string {
  if (isNaN(value)) return "";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
