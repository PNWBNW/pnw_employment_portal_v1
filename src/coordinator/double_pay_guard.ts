/**
 * Double-Pay Guard (portal-side)
 *
 * Before a compiled manifest is settled, every row is checked against the
 * employer's on-chain payment history (EmployerPaystubReceipt records read
 * via the wallet's requestRecords — same source as the payroll history
 * scanner, no localStorage involved).
 *
 * Detection tiers per row:
 *
 *  - "exact_duplicate"  — a prior receipt carries the SAME payroll_inputs_hash.
 *    Since schema_v 2 the inputs hash commits to (agreement, epoch, amounts,
 *    run_kind, run_memo), so a collision means a byte-identical resubmission
 *    of an already-settled payment. Settlement is BLOCKED. An intentional
 *    second payment passes by differing in amount, run kind, or memo.
 *
 *  - "same_epoch_same_amount" — the worker was already paid this epoch with
 *    the same gross amount but a different inputs hash (different kind/memo,
 *    or a pre-v2 receipt). Strong warning; employer must confirm.
 *
 *  - "same_epoch" — the worker was already paid this epoch with a different
 *    amount. Informational warning so the employer can confirm the repeat
 *    payment is intentional.
 *
 * Receipts minted before schema_v 2 hash a different preimage, so they can
 * never collide exactly with new rows — they still surface through the
 * same-epoch tiers.
 */

import type { Address } from "@/src/lib/pnw-adapter/aleo_types";
import type { PayrollRunManifest } from "@/src/manifest/types";
import {
  scanPayrollHistory,
  type ParsedReceipt,
} from "@/src/records/payroll_history_scanner";

export type DoublePayFindingKind =
  | "exact_duplicate"
  | "same_epoch_same_amount"
  | "same_epoch";

export type DoublePayFinding = {
  row_index: number;
  agreement_id: string;
  kind: DoublePayFindingKind;
  /** Prior payment details from the matching receipt */
  prior_epoch_id: number;
  prior_gross_amount: string; // minor units
  prior_net_amount: string; // minor units
  prior_issued_height: number;
};

export type DoublePayCheckResult = {
  /** false when payment history could not be read (no wallet record access) */
  checked: boolean;
  /** true when any exact_duplicate finding exists — settlement must not proceed */
  blocked: boolean;
  findings: DoublePayFinding[];
  /** Human-readable note when checked === false */
  message?: string;
};

const normHex = (h: string): string => h.replace(/^0x/i, "").toLowerCase();

/** Pure comparison — exported for tests */
export function checkManifestAgainstReceipts(
  manifest: PayrollRunManifest,
  receipts: ParsedReceipt[],
): DoublePayCheckResult {
  const findings: DoublePayFinding[] = [];

  for (const row of manifest.rows) {
    const rowInputsHash = normHex(row.payroll_inputs_hash);
    const rowAgreement = normHex(row.agreement_id);

    for (const receipt of receipts) {
      const receiptInputsHash = normHex(receipt.payroll_inputs_hash);
      const receiptAgreement = normHex(receipt.agreement_id);

      let kind: DoublePayFindingKind;
      if (rowInputsHash && receiptInputsHash === rowInputsHash) {
        kind = "exact_duplicate";
      } else if (
        rowAgreement &&
        receiptAgreement === rowAgreement &&
        receipt.epoch_id === row.epoch_id
      ) {
        kind =
          receipt.gross_amount === row.gross_amount
            ? "same_epoch_same_amount"
            : "same_epoch";
      } else {
        continue;
      }

      findings.push({
        row_index: row.row_index,
        agreement_id: row.agreement_id,
        kind,
        prior_epoch_id: receipt.epoch_id,
        prior_gross_amount: receipt.gross_amount,
        prior_net_amount: receipt.net_amount,
        prior_issued_height: receipt.issued_height,
      });
    }
  }

  return {
    checked: true,
    blocked: findings.some((f) => f.kind === "exact_duplicate"),
    findings,
  };
}

/** Result used when history could not be scanned — never blocks, but flags */
export function uncheckedResult(message: string): DoublePayCheckResult {
  return { checked: false, blocked: false, findings: [], message };
}

/**
 * Scan the employer's wallet for paystub receipts and check the manifest
 * against them. Scan failures degrade to an unchecked (non-blocking) result
 * — the guard must never make payroll impossible when history is unavailable.
 */
export async function checkDoublePay(
  manifest: PayrollRunManifest,
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  employerAddr: Address,
): Promise<DoublePayCheckResult> {
  try {
    const runs = await scanPayrollHistory(requestRecords, employerAddr);
    const receipts = runs.flatMap((r) => r.receipts);
    return checkManifestAgainstReceipts(manifest, receipts);
  } catch (err) {
    return uncheckedResult(
      `Payment history scan failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
