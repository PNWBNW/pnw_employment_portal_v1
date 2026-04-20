/**
 * Payroll table row — the editable form before manifest compilation.
 * This is the UI-level row; it gets transformed into a PayrollRow
 * by the manifest compiler in E4.
 *
 * Simplified UX: employer enters worker .pnw name + gross amount.
 * Everything else is auto-resolved from the worker store or defaulted.
 */

export type PayType = "hourly" | "salary";

export type PayrollTableRow = {
  /** Client-side unique ID for React key (not on-chain) */
  id: string;
  /** Worker .pnw name (e.g., "alice.pnw") — the only identity the employer enters */
  worker_name: string;
  /** Worker Aleo address — auto-resolved from worker store via .pnw name */
  worker_addr: string;
  /** Worker name hash — auto-resolved from worker store */
  worker_name_hash: string;
  /** Agreement ID — auto-resolved from worker store */
  agreement_id: string;
  /** Epoch identifier (YYYYMMDD format) — set globally via toolbar */
  epoch_id: string;
  /** Compensation type from the agreement — "hourly" or "salary" */
  pay_type?: PayType;
  /** Pay rate from the agreement — $/hr (hourly) or $/period (salary) */
  pay_rate?: number;
  /** Hours worked — entered by employer for hourly workers. Ignored for salary. */
  hours_worked: string;
  /** Gross pay in display dollars (e.g., "1234.56") — auto-calculated for hourly (rate × hours), fixed for salary */
  gross_amount: string;
  /** Tax withheld in display dollars — defaults to "0.00", editable in detail view */
  tax_withheld: string;
  /** Fee in display dollars — defaults to "0.00", editable in detail view */
  fee_amount: string;
  /** Net pay — auto-calculated: gross - tax - fee */
  net_amount: string;
  /** Whether the worker was resolved from the store */
  resolved: boolean;
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
    pay_type: undefined,
    pay_rate: undefined,
    hours_worked: "",
    gross_amount: "",
    tax_withheld: "0.00",
    fee_amount: "0.00",
    net_amount: "",
    resolved: false,
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
