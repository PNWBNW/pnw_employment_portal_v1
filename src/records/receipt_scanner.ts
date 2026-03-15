/**
 * Receipt Scanner
 *
 * Scans the employer's paystub receipt records from the Aleo REST API.
 * Used by the receipt reconciler to verify on-chain settlement.
 *
 * Security: only the view key is used for record scanning (read-only).
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import type { Address, Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";
import type { PaystubReceipt } from "@/src/coordinator/receipt_reconciler";

/**
 * Scan for paystub receipt records owned by the given address.
 *
 * MVP: queries the Aleo REST API for the paystub_receipts program's
 * public mappings. Full private record scanning requires WASM SDK.
 *
 * @param viewKey - Employer's view key for record decoding
 * @param address - Employer's Aleo address
 * @param batchId - Optional: filter receipts by batch_id
 * @returns Array of decoded paystub receipts
 */
export async function scanPaystubReceipts(
  _viewKey: string,
  address: Address,
  batchId?: Bytes32,
): Promise<PaystubReceipt[]> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.paystub_receipts;

  try {
    // Query the receipt mapping for this employer
    const url = `${endpoint}/program/${programId}/mapping/receipts/${address}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404) {
      return [];
    }

    if (!response.ok) {
      throw new Error(
        `Aleo API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: unknown = await response.json();
    const receipts = parseReceiptResponse(data);

    // Filter by batch_id if provided
    if (batchId) {
      return receipts.filter((r) => r.batch_id === batchId);
    }

    return receipts;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.warn("Receipt scan failed (network):", error.message);
      return [];
    }
    throw error;
  }
}

/**
 * Scan for a specific receipt by payroll_inputs_hash.
 * Returns null if not found.
 */
export async function findReceiptByInputsHash(
  viewKey: string,
  address: Address,
  payrollInputsHash: Bytes32,
): Promise<PaystubReceipt | null> {
  const receipts = await scanPaystubReceipts(viewKey, address);
  return receipts.find((r) => r.payroll_inputs_hash === payrollInputsHash) ?? null;
}

// ----------------------------------------------------------------
// Internal: parse receipt data from API response
// ----------------------------------------------------------------

type RawReceiptData = {
  tx_id?: string;
  payroll_inputs_hash?: string;
  receipt_anchor?: string;
  batch_id?: string;
  row_hash?: string;
  [key: string]: unknown;
};

function parseReceiptResponse(data: unknown): PaystubReceipt[] {
  if (!data) return [];

  // Handle array response
  if (Array.isArray(data)) {
    return data
      .map((item) => parseReceiptEntry(item as RawReceiptData))
      .filter((r): r is PaystubReceipt => r !== null);
  }

  // Handle single object response
  if (typeof data === "object") {
    const entry = parseReceiptEntry(data as RawReceiptData);
    return entry ? [entry] : [];
  }

  return [];
}

function parseReceiptEntry(raw: RawReceiptData): PaystubReceipt | null {
  if (
    !raw.payroll_inputs_hash ||
    !raw.receipt_anchor ||
    !raw.batch_id ||
    !raw.row_hash
  ) {
    return null;
  }

  return {
    tx_id: raw.tx_id ?? "unknown",
    payroll_inputs_hash: cleanField(raw.payroll_inputs_hash),
    receipt_anchor: cleanField(raw.receipt_anchor),
    batch_id: cleanField(raw.batch_id),
    row_hash: cleanField(raw.row_hash),
    raw_data: raw,
  };
}

/** Remove trailing Aleo type suffix (e.g., "field") from a value */
function cleanField(value: string): Bytes32 {
  return value.replace(/field$/i, "").trim() as Bytes32;
}
