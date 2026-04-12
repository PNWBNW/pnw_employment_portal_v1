/**
 * Worker Paystub Scanner
 *
 * Reads WorkerPaystubReceipt records from the connected worker's wallet
 * via the wallet adapter's `requestRecords`. Each successful payroll run
 * produces one WorkerPaystubReceipt per worker — these are the worker's
 * private proof of payment.
 *
 * Same parsing logic as payroll_history_scanner (which reads
 * EmployerPaystubReceipt), just filtered to the worker-side record name.
 */

import { PROGRAMS } from "@/src/config/programs";
import type { Address } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Parsed paystub record
// ---------------------------------------------------------------------------

export type WorkerPaystub = {
  worker_name_hash: string;       // decimal field
  employer_name_hash: string;     // decimal field
  agreement_id: string;           // hex
  epoch_id: number;
  gross_amount: string;           // minor units (USDCx)
  net_amount: string;
  tax_withheld: string;
  fee_amount: string;
  payroll_inputs_hash: string;    // hex
  receipt_anchor: string;         // hex
  pair_hash: string;              // hex
  utc_time_hash: string;          // hex
  issued_height: number;
};

// ---------------------------------------------------------------------------
// Record parser
// ---------------------------------------------------------------------------

function parseWorkerReceipt(
  record: Record<string, unknown>,
): WorkerPaystub | null {
  try {
    const plaintext =
      typeof record.recordPlaintext === "string"
        ? record.recordPlaintext
        : null;
    const recordName =
      typeof record.recordName === "string" ? record.recordName : null;
    const spent = typeof record.spent === "boolean" ? record.spent : false;

    if (!plaintext) return null;
    // Worker-side records only
    if (recordName !== "WorkerPaystubReceipt") return null;
    if (spent) return null;

    const fieldRegex = (name: string, type: string) =>
      new RegExp(`${name}:\\s*(\\d+)${type}`);

    const workerNameHash = plaintext.match(
      fieldRegex("worker_name_hash", "field"),
    )?.[1];
    const employerNameHash = plaintext.match(
      fieldRegex("employer_name_hash", "field"),
    )?.[1];
    const epochId = plaintext.match(fieldRegex("epoch_id", "u32"))?.[1];
    const grossAmount = plaintext.match(
      fieldRegex("gross_amount", "u128"),
    )?.[1];
    const netAmount = plaintext.match(fieldRegex("net_amount", "u128"))?.[1];
    const taxWithheld = plaintext.match(
      fieldRegex("tax_withheld", "u128"),
    )?.[1];
    const feeAmount = plaintext.match(fieldRegex("fee_amount", "u128"))?.[1];
    const issuedHeight = plaintext.match(
      fieldRegex("issued_height", "u32"),
    )?.[1];

    if (
      !workerNameHash ||
      !employerNameHash ||
      !epochId ||
      !grossAmount ||
      !netAmount
    ) {
      return null;
    }

    const byteArrayToHex = (fieldName: string): string => {
      const section = plaintext.match(
        new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]`),
      );
      if (!section?.[1]) return "";
      const bytes = section[1].match(/(\d+)u8/g) ?? [];
      return bytes
        .map((b) => parseInt(b).toString(16).padStart(2, "0"))
        .join("");
    };

    return {
      worker_name_hash: workerNameHash,
      employer_name_hash: employerNameHash,
      agreement_id: byteArrayToHex("agreement_id"),
      epoch_id: parseInt(epochId, 10),
      gross_amount: grossAmount,
      net_amount: netAmount,
      tax_withheld: taxWithheld ?? "0",
      fee_amount: feeAmount ?? "0",
      payroll_inputs_hash: byteArrayToHex("payroll_inputs_hash"),
      receipt_anchor: byteArrayToHex("receipt_anchor"),
      pair_hash: byteArrayToHex("pair_hash"),
      utc_time_hash: byteArrayToHex("utc_time_hash"),
      issued_height: issuedHeight ? parseInt(issuedHeight, 10) : 0,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scan the connected worker's wallet for WorkerPaystubReceipt records.
 *
 * @param requestRecords - Wallet adapter's requestRecords function
 * @param _workerAddr - Connected worker address (for logging)
 * @returns Array of parsed paystubs, newest first (by epoch_id)
 */
export async function scanWorkerPaystubs(
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  _workerAddr: Address,
): Promise<WorkerPaystub[]> {
  try {
    console.log("[PNW] Scanning wallet for worker paystub receipts...");
    const records = await requestRecords(
      PROGRAMS.layer1.paystub_receipts,
      true,
    );
    console.log(
      "[PNW] Paystub receipt records from wallet:",
      records?.length ?? 0,
    );

    if (!Array.isArray(records)) return [];

    const paystubs: WorkerPaystub[] = [];
    for (const rec of records) {
      const ps = parseWorkerReceipt(rec as Record<string, unknown>);
      if (ps) paystubs.push(ps);
    }

    console.log("[PNW] Parsed WorkerPaystubReceipt records:", paystubs.length);

    // Newest first by epoch_id
    paystubs.sort((a, b) => b.epoch_id - a.epoch_id);

    return paystubs;
  } catch (error) {
    console.warn("[PNW] Worker paystub scan failed:", error);
    return [];
  }
}
