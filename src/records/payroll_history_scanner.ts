/**
 * Payroll History Scanner
 *
 * Reconstructs the employer's payroll history by scanning their wallet for
 * EmployerPaystubReceipt records. Each successful payroll run produces one
 * receipt per worker; receipts are grouped by (employer_name_hash, epoch_id)
 * into pseudo-manifests that the UI can render the same way as live runs.
 *
 * Same pattern as scanAgreementRecords() — uses the wallet's requestRecords
 * to get decrypted private records, so history works without localStorage.
 */

import { PROGRAMS } from "@/src/config/programs";
import type { Address } from "@/src/lib/pnw-adapter/aleo_types";
import type {
  PayrollRunManifest,
  PayrollRow,
  ChunkPlan,
} from "@/src/manifest/types";
import type { WorkerRecord } from "@/src/stores/worker_store";
import { domainHash, toHex, fromHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode, OBJ_AUDIT_EVENT } from "@/src/lib/pnw-adapter/canonical_encoder";

/**
 * Recompute the deterministic audit_event_hash from a receipt.
 * Mirrors the manifest compiler's first-pass computation:
 *   hash(OBJ_AUDIT_EVENT, [payroll_inputs_hash, receipt_anchor, 0, 0])
 * which is the value that was anchored via payroll_audit_log::anchor_event
 * during the sequential payroll flow.
 */
function recomputeAuditEventHash(payrollInputsHash: string, receiptAnchor: string): string {
  const zeroHash = toHex(new Uint8Array(32));
  const auditTlv = tlvEncode(OBJ_AUDIT_EVENT, [
    { tag: 0x01, value: fromHex(payrollInputsHash) },
    { tag: 0x02, value: fromHex(receiptAnchor) },
    { tag: 0x03, value: fromHex(zeroHash) }, // batch_id placeholder
    { tag: 0x04, value: fromHex(zeroHash) }, // row_hash placeholder
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, auditTlv));
}

/** A single parsed receipt record */
export type ParsedReceipt = {
  worker_name_hash: string;       // decimal field
  employer_name_hash: string;     // decimal field
  agreement_id: string;           // hex
  epoch_id: number;
  gross_amount: string;           // minor units
  net_amount: string;
  tax_withheld: string;
  fee_amount: string;
  payroll_inputs_hash: string;    // hex
  receipt_anchor: string;         // hex
  pair_hash: string;              // hex
  utc_time_hash: string;          // hex
  issued_height: number;
};

/** A reconstructed historical payroll run (derived from receipts) */
export type HistoricalPayrollRun = {
  /** Synthetic batch_id = hash(employer_name_hash || epoch_id) */
  batch_id: string;
  employer_name_hash: string;
  epoch_id: number;
  status: "settled"; // anything on-chain is at least settled
  row_count: number;
  total_gross_amount: string;
  total_net_amount: string;
  total_tax_withheld: string;
  total_fee_amount: string;
  created_at: number;            // derived from issued_height
  updated_at: number;
  receipts: ParsedReceipt[];
};

/**
 * Parse an EmployerPaystubReceipt record plaintext into structured fields.
 * Returns null if the record is not a valid receipt.
 */
function parseReceipt(record: Record<string, unknown>): ParsedReceipt | null {
  try {
    const plaintext = typeof record.recordPlaintext === "string" ? record.recordPlaintext : null;
    const recordName = typeof record.recordName === "string" ? record.recordName : null;
    const spent = typeof record.spent === "boolean" ? record.spent : false;

    if (!plaintext) return null;
    // We only care about the employer's copy
    if (recordName !== "EmployerPaystubReceipt") return null;
    // Receipts are technically soulbound but filter anyway in case
    if (spent) return null;

    // Parse fields from the record plaintext (looks like "{ field: value.private, ... }")
    const fieldRegex = (name: string, type: string) =>
      new RegExp(`${name}:\\s*(\\d+)${type}`);

    // Extract scalar fields
    const workerNameHash = plaintext.match(fieldRegex("worker_name_hash", "field"))?.[1];
    const employerNameHash = plaintext.match(fieldRegex("employer_name_hash", "field"))?.[1];
    const epochId = plaintext.match(fieldRegex("epoch_id", "u32"))?.[1];
    const grossAmount = plaintext.match(fieldRegex("gross_amount", "u128"))?.[1];
    const netAmount = plaintext.match(fieldRegex("net_amount", "u128"))?.[1];
    const taxWithheld = plaintext.match(fieldRegex("tax_withheld", "u128"))?.[1];
    const feeAmount = plaintext.match(fieldRegex("fee_amount", "u128"))?.[1];
    const issuedHeight = plaintext.match(fieldRegex("issued_height", "u32"))?.[1];

    if (!workerNameHash || !employerNameHash || !epochId || !grossAmount || !netAmount) {
      return null;
    }

    // Extract byte-array fields [u8; 32] → hex string
    const byteArrayToHex = (fieldName: string): string => {
      const section = plaintext.match(new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]`));
      if (!section?.[1]) return "";
      const bytes = section[1].match(/(\d+)u8/g) ?? [];
      return bytes.map((b) => parseInt(b).toString(16).padStart(2, "0")).join("");
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

/**
 * Simple deterministic batch_id derivation from a group key.
 * Uses a djb2-style hash so we have a stable identifier without WASM.
 */
function syntheticBatchId(employerNameHash: string, epochId: number): string {
  const key = `${employerNameHash}|${epochId}`;
  let hash = 5381n;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash * 33n) + BigInt(key.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  return `0x${hash.toString(16).padStart(16, "0")}${employerNameHash.slice(0, 16)}${epochId.toString(16).padStart(8, "0")}`;
}

/**
 * Scan the wallet for EmployerPaystubReceipt records and group them
 * into historical payroll runs.
 *
 * @param requestRecords - Wallet adapter's requestRecords function
 * @param _employerAddr - Employer's Aleo address (for logging)
 */
export async function scanPayrollHistory(
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  _employerAddr: Address,
): Promise<HistoricalPayrollRun[]> {
  try {
    console.log("[PNW] Scanning wallet for payroll receipt records...");
    const records = await requestRecords(PROGRAMS.layer1.paystub_receipts, true);
    console.log("[PNW] Paystub receipt records from wallet:", records?.length ?? 0);

    if (!Array.isArray(records)) return [];

    // Parse all receipts
    const parsed: ParsedReceipt[] = [];
    for (const rec of records) {
      const receipt = parseReceipt(rec as Record<string, unknown>);
      if (receipt) parsed.push(receipt);
    }
    console.log("[PNW] Parsed EmployerPaystubReceipt records:", parsed.length);

    if (parsed.length === 0) return [];

    // Group by (employer_name_hash, epoch_id) — each group is one payroll run
    const groups = new Map<string, ParsedReceipt[]>();
    for (const r of parsed) {
      const key = `${r.employer_name_hash}|${r.epoch_id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    // Build HistoricalPayrollRun objects
    const runs: HistoricalPayrollRun[] = [];
    for (const [, receipts] of groups) {
      const first = receipts[0]!;
      const totalGross = receipts.reduce((s, r) => s + BigInt(r.gross_amount), 0n);
      const totalNet = receipts.reduce((s, r) => s + BigInt(r.net_amount), 0n);
      const totalTax = receipts.reduce((s, r) => s + BigInt(r.tax_withheld), 0n);
      const totalFee = receipts.reduce((s, r) => s + BigInt(r.fee_amount), 0n);
      // Estimate created_at from the max issued_height (Aleo has ~3s blocks)
      const maxHeight = Math.max(...receipts.map((r) => r.issued_height));

      runs.push({
        batch_id: syntheticBatchId(first.employer_name_hash, first.epoch_id),
        employer_name_hash: first.employer_name_hash,
        epoch_id: first.epoch_id,
        status: "settled",
        row_count: receipts.length,
        total_gross_amount: totalGross.toString(),
        total_net_amount: totalNet.toString(),
        total_tax_withheld: totalTax.toString(),
        total_fee_amount: totalFee.toString(),
        created_at: maxHeight * 3000, // rough estimate in ms
        updated_at: maxHeight * 3000,
        receipts,
      });
    }

    // Sort newest first (by epoch_id descending)
    runs.sort((a, b) => b.epoch_id - a.epoch_id);

    console.log("[PNW] Reconstructed payroll runs:", runs.length);
    return runs;
  } catch (error) {
    console.warn("[PNW] Payroll history scan failed:", error);
    return [];
  }
}

/**
 * Convert a HistoricalPayrollRun + known workers into a full PayrollRunManifest.
 * The resulting manifest is good enough for read-only display in the run detail
 * page (status list, totals, PDF generation, anchor button).
 *
 * Worker addresses are looked up by agreement_id against the known worker list.
 * If a receipt's agreement_id doesn't match any known worker, the row shows
 * the agreement_id as a fallback "unknown-worker" placeholder.
 */
export function historicalRunToManifest(
  run: HistoricalPayrollRun,
  employerAddr: Address,
  workers: WorkerRecord[],
): PayrollRunManifest {
  // Build lookup: agreement_id → worker
  const workerByAgreement = new Map<string, WorkerRecord>();
  for (const w of workers) {
    workerByAgreement.set(w.agreement_id.toLowerCase(), w);
  }

  const rows: PayrollRow[] = run.receipts.map((r, idx) => {
    const worker = workerByAgreement.get(r.agreement_id.toLowerCase());
    // Recompute audit_event_hash deterministically from receipt fields
    // — this is the same value that was anchored via anchor_event during
    // the sequential payroll flow, so assert_event_anchored will pass.
    const auditEventHash = recomputeAuditEventHash(r.payroll_inputs_hash, r.receipt_anchor);
    return {
      row_index: idx,
      worker_addr: (worker?.worker_addr ?? "aleo1unknown") as string,
      worker_name_hash: r.worker_name_hash,
      agreement_id: r.agreement_id as `${string}`,
      epoch_id: r.epoch_id,
      currency: "USDCx" as const,
      gross_amount: r.gross_amount,
      tax_withheld: r.tax_withheld,
      fee_amount: r.fee_amount,
      net_amount: r.net_amount,
      payroll_inputs_hash: r.payroll_inputs_hash as `${string}`,
      receipt_anchor: r.receipt_anchor as `${string}`,
      receipt_pair_hash: r.pair_hash as `${string}`,
      utc_time_hash: r.utc_time_hash as `${string}`,
      audit_event_hash: auditEventHash,
      row_hash: r.payroll_inputs_hash as `${string}`,
      status: "settled" as const,
    };
  });

  // Synthetic chunks — one chunk per row, marked settled
  const chunks: ChunkPlan[] = rows.map((row, i) => ({
    chunk_index: i,
    chunk_id: row.row_hash as `${string}`,
    row_indices: [i],
    net_total: row.net_amount,
    transition: "execute_payroll" as const,
    status: "settled" as const,
    attempts: 1,
  }));

  return {
    batch_id: run.batch_id as `${string}`,
    schema_v: 1,
    calc_v: 1,
    policy_v: 1,
    employer_addr: employerAddr,
    employer_name_hash: run.employer_name_hash,
    epoch_id: run.epoch_id,
    currency: "USDCx" as const,
    row_count: run.row_count,
    rows,
    total_gross_amount: run.total_gross_amount,
    total_tax_withheld: run.total_tax_withheld,
    total_fee_amount: run.total_fee_amount,
    total_net_amount: run.total_net_amount,
    row_root: "0".repeat(64),
    inputs_hash: "0".repeat(64),
    doc_hash: "0".repeat(64),
    status: "settled" as const,
    chunks,
    created_at: run.created_at,
    updated_at: run.updated_at,
  };
}
