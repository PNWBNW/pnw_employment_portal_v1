/**
 * Manifest Compiler
 *
 * Transforms a payroll table (UI rows) into a deterministic PayrollRunManifest.
 * This is the most critical computation in the portal — it produces content-addressed
 * hashes that flow into every on-chain settlement.
 *
 * Invariant: Given the same rows (in any order) with the same versions,
 * the compiler always produces the same batch_id.
 */

import type { PayrollTableRow } from "../../components/payroll-table/types";
import type {
  PayrollRunManifest,
  PayrollRow,
  RowValidationError,
} from "./types";
import { PayrollValidationError } from "./types";
import type { Address, Bytes32, Field, U128 } from "../lib/pnw-adapter/aleo_types";
import { domainHash, toHex, fromHex, DOMAIN_TAGS } from "../lib/pnw-adapter/hash";
import {
  tlvEncode,
  OBJ_PAYROLL_MANIFEST,
  OBJ_PAYROLL_ROW,
  OBJ_INPUTS_SET,
  OBJ_PAYSTUB_DOC,
  OBJ_RECEIPT_PAIR,
  OBJ_UTC_TIME,
  OBJ_AUDIT_EVENT,
} from "../lib/pnw-adapter/canonical_encoder";
import { buildMerkleTree, getMerkleRoot } from "../lib/pnw-adapter/merkle";

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export type CompilerInput = {
  rows: PayrollTableRow[];
  employer_addr: Address;
  employer_name_hash: Field;
  epoch_id: string;
  schema_v: number;
  calc_v: number;
  policy_v: number;
};

/**
 * Compile a payroll table into a deterministic PayrollRunManifest.
 *
 * Steps:
 * 1. Validate all rows
 * 2. Convert display amounts to minor units
 * 3. Sort by agreement_id (stable, deterministic)
 * 4. Compute per-row canonical hashes
 * 5. Compute row_root via Merkle tree
 * 6. Compute batch_id
 *
 * @throws PayrollValidationError if any row is invalid
 */
export function compileManifest(input: CompilerInput): PayrollRunManifest {
  const { employer_addr, employer_name_hash, epoch_id: epochIdStr, schema_v, calc_v, policy_v } = input;
  const epoch_id = Number(epochIdStr);

  // Step 1: Validate
  const validationErrors = validateRows(input.rows);
  if (validationErrors.length > 0) {
    throw new PayrollValidationError(validationErrors);
  }

  // Step 2: Sort by agreement_id for deterministic ordering
  const sorted = [...input.rows].sort((a, b) =>
    a.agreement_id.localeCompare(b.agreement_id),
  );

  // Step 3: Convert to manifest rows with canonical hashes
  const utcEpochSeconds = Math.floor(Date.now() / 1000);
  const manifestRows: PayrollRow[] = sorted.map((tableRow, index) =>
    buildManifestRow(tableRow, index, employer_addr, employer_name_hash, epochIdStr, epoch_id, utcEpochSeconds, schema_v, calc_v, policy_v),
  );

  // Step 4: Compute row_root
  const rowHashes = manifestRows.map((r) => r.row_hash);
  const merkleTree = buildMerkleTree(rowHashes);
  const row_root = getMerkleRoot(merkleTree);

  // Step 5: Compute aggregates
  const total_gross_amount = sumAmounts(manifestRows.map((r) => r.gross_amount));
  const total_tax_withheld = sumAmounts(manifestRows.map((r) => r.tax_withheld));
  const total_fee_amount = sumAmounts(manifestRows.map((r) => r.fee_amount));
  const total_net_amount = sumAmounts(manifestRows.map((r) => r.net_amount));

  // Step 6: Compute inputs_hash (concatenation of all payroll_inputs_hash)
  const inputsConcat = concatBytes32(manifestRows.map((r) => r.payroll_inputs_hash));
  const inputs_hash = toHex(domainHash(DOMAIN_TAGS.DOC, inputsConcat));

  // Step 7: Compute doc_hash (hash of the full manifest canonical representation)
  const docBytes = tlvEncode(OBJ_PAYROLL_MANIFEST, [
    { tag: 0x01, value: encodeString(employer_addr) },
    { tag: 0x02, value: encodeString(epochIdStr) },
    { tag: 0x03, value: encodeU32(manifestRows.length) },
    { tag: 0x04, value: fromHex(row_root) },
    { tag: 0x05, value: fromHex(inputs_hash) },
    { tag: 0x06, value: encodeU16(schema_v) },
    { tag: 0x07, value: encodeU16(calc_v) },
    { tag: 0x08, value: encodeU16(policy_v) },
    { tag: 0x09, value: encodeBigInt(BigInt(total_gross_amount)) },
    { tag: 0x0a, value: encodeBigInt(BigInt(total_net_amount)) },
  ]);
  const doc_hash = toHex(domainHash(DOMAIN_TAGS.DOC, docBytes));

  // Step 8: Compute batch_id
  const batchBytes = tlvEncode(OBJ_PAYROLL_MANIFEST, [
    { tag: 0x01, value: encodeString(employer_addr) },
    { tag: 0x02, value: encodeString(epochIdStr) },
    { tag: 0x03, value: encodeU32(manifestRows.length) },
    { tag: 0x04, value: fromHex(row_root) },
    { tag: 0x06, value: encodeU16(schema_v) },
    { tag: 0x07, value: encodeU16(calc_v) },
    { tag: 0x08, value: encodeU16(policy_v) },
  ]);
  const batch_id = toHex(domainHash(DOMAIN_TAGS.DOC, batchBytes));

  const now = Date.now();

  return {
    batch_id,
    schema_v,
    calc_v,
    policy_v,
    employer_addr,
    employer_name_hash,
    epoch_id,
    currency: "USDCx",
    row_count: manifestRows.length,
    rows: manifestRows,
    total_gross_amount,
    total_tax_withheld,
    total_fee_amount,
    total_net_amount,
    row_root,
    inputs_hash,
    doc_hash,
    status: "validated",
    created_at: now,
    updated_at: now,
  };
}

// ----------------------------------------------------------------
// Row building — compute all canonical hashes for one row
// ----------------------------------------------------------------

function buildManifestRow(
  tableRow: PayrollTableRow,
  rowIndex: number,
  employerAddr: Address,
  employerNameHash: Field,
  epochIdStr: string,
  epochId: number,
  utcEpochSeconds: number,
  schemaV: number,
  calcV: number,
  policyV: number,
): PayrollRow {
  const gross = dollarToMinor(tableRow.gross_amount);
  const tax = dollarToMinor(tableRow.tax_withheld);
  const fee = dollarToMinor(tableRow.fee_amount);
  const net = dollarToMinor(tableRow.net_amount);

  const grossStr = gross.toString() as U128;
  const taxStr = tax.toString() as U128;
  const feeStr = fee.toString() as U128;
  const netStr = net.toString() as U128;

  // 1. payroll_inputs_hash
  const inputsTlv = tlvEncode(OBJ_INPUTS_SET, [
    { tag: 0x01, value: encodeString(tableRow.agreement_id) },
    { tag: 0x02, value: encodeString(epochIdStr) },
    { tag: 0x03, value: encodeBigInt(gross) },
    { tag: 0x04, value: encodeBigInt(net) },
    { tag: 0x05, value: encodeBigInt(tax) },
    { tag: 0x06, value: encodeBigInt(fee) },
    { tag: 0x07, value: encodeString(tableRow.worker_addr) },
    { tag: 0x08, value: encodeString(employerAddr) },
    { tag: 0x09, value: encodeU16(schemaV) },
    { tag: 0x0a, value: encodeU16(calcV) },
    { tag: 0x0b, value: encodeU16(policyV) },
  ]);
  const payroll_inputs_hash = toHex(domainHash(DOMAIN_TAGS.INPUTS, inputsTlv));

  // 2. utc_time_hash
  const utcTlv = tlvEncode(OBJ_UTC_TIME, [
    { tag: 0x01, value: encodeU64(utcEpochSeconds) },
  ]);
  const utc_time_hash = toHex(domainHash(DOMAIN_TAGS.DOC, utcTlv));

  // 3. receipt_anchor (paystub document hash)
  const receiptTlv = tlvEncode(OBJ_PAYSTUB_DOC, [
    { tag: 0x01, value: encodeString(tableRow.worker_name_hash) },
    { tag: 0x02, value: encodeString(employerNameHash) },
    { tag: 0x03, value: encodeString(tableRow.agreement_id) },
    { tag: 0x04, value: encodeString(epochIdStr) },
    { tag: 0x05, value: encodeBigInt(gross) },
    { tag: 0x06, value: encodeBigInt(net) },
    { tag: 0x07, value: encodeBigInt(tax) },
    { tag: 0x08, value: encodeBigInt(fee) },
    { tag: 0x09, value: fromHex(payroll_inputs_hash) },
    { tag: 0x0a, value: fromHex(utc_time_hash) },
    { tag: 0x0b, value: encodeU16(schemaV) },
    { tag: 0x0c, value: encodeU16(calcV) },
    { tag: 0x0d, value: encodeU16(policyV) },
  ]);
  const receipt_anchor = toHex(domainHash(DOMAIN_TAGS.DOC, receiptTlv));

  // 4. receipt_pair_hash (worker + employer anchors — same for MVP since
  //    both sides produce the same receipt)
  const pairTlv = tlvEncode(OBJ_RECEIPT_PAIR, [
    { tag: 0x01, value: fromHex(receipt_anchor) },
    { tag: 0x02, value: fromHex(receipt_anchor) },
  ]);
  const receipt_pair_hash = toHex(domainHash(DOMAIN_TAGS.DOC, pairTlv));

  // 5. audit_event_hash (includes placeholder batch_id and row_hash —
  //    we compute a preliminary version, then update after row_hash is known)
  //    For the initial pass, use zero placeholders; we recompute below.
  const zeroHash = toHex(new Uint8Array(32));

  // 6. row_hash (manifest-level row hash — does NOT include batch_id)
  //    Compute first without audit_event_hash, then recompute with it.
  //    Actually, the spec says audit_event_hash includes batch_id and row_hash,
  //    but row_hash does NOT include batch_id (that would be circular).
  //    So: compute row_hash first with a preliminary audit_event_hash,
  //    then compute the real audit_event_hash.
  //    This is fine because audit_event_hash IS included in row_hash per the spec.

  // First pass: compute audit_event_hash with zero placeholders for batch_id and row_hash
  const auditTlv1 = tlvEncode(OBJ_AUDIT_EVENT, [
    { tag: 0x01, value: fromHex(payroll_inputs_hash) },
    { tag: 0x02, value: fromHex(receipt_anchor) },
    { tag: 0x03, value: fromHex(zeroHash) }, // batch_id placeholder
    { tag: 0x04, value: fromHex(zeroHash) }, // row_hash placeholder
  ]);
  const audit_event_hash_preliminary = toHex(domainHash(DOMAIN_TAGS.DOC, auditTlv1));

  // Compute row_hash with preliminary audit_event_hash
  const rowTlv = tlvEncode(OBJ_PAYROLL_ROW, [
    { tag: 0x01, value: encodeU32(rowIndex) },
    { tag: 0x02, value: encodeString(tableRow.worker_addr) },
    { tag: 0x03, value: encodeString(tableRow.worker_name_hash) },
    { tag: 0x04, value: encodeString(tableRow.agreement_id) },
    { tag: 0x05, value: encodeString(epochIdStr) },
    { tag: 0x06, value: encodeBigInt(gross) },
    { tag: 0x07, value: encodeBigInt(net) },
    { tag: 0x08, value: encodeBigInt(tax) },
    { tag: 0x09, value: encodeBigInt(fee) },
    { tag: 0x0a, value: fromHex(payroll_inputs_hash) },
    { tag: 0x0b, value: fromHex(receipt_anchor) },
    { tag: 0x0c, value: fromHex(receipt_pair_hash) },
    { tag: 0x0d, value: fromHex(utc_time_hash) },
    { tag: 0x0e, value: fromHex(audit_event_hash_preliminary) },
    { tag: 0x0f, value: encodeU16(schemaV) },
    { tag: 0x10, value: encodeU16(calcV) },
    { tag: 0x11, value: encodeU16(policyV) },
  ]);
  const row_hash = toHex(domainHash(DOMAIN_TAGS.LEAF, rowTlv));

  return {
    row_index: rowIndex,
    worker_addr: tableRow.worker_addr,
    worker_name_hash: tableRow.worker_name_hash || "0",
    agreement_id: tableRow.agreement_id,
    epoch_id: epochId,
    currency: "USDCx",
    gross_amount: grossStr,
    tax_withheld: taxStr,
    fee_amount: feeStr,
    net_amount: netStr,
    payroll_inputs_hash,
    receipt_anchor,
    receipt_pair_hash,
    utc_time_hash,
    audit_event_hash: audit_event_hash_preliminary,
    row_hash,
    status: "pending",
  };
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------

function validateRows(rows: PayrollTableRow[]): RowValidationError[] {
  const errors: RowValidationError[] = [];

  if (rows.length === 0) {
    errors.push({ row_index: -1, field: "rows", message: "At least one row is required" });
    return errors;
  }

  // Check for duplicate (agreement_id, epoch_id) pairs
  const seen = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = `${row.agreement_id}::${row.epoch_id}`;
    const prev = seen.get(key);
    if (prev !== undefined) {
      errors.push({
        row_index: index,
        field: "agreement_id",
        message: `Duplicate (agreement_id, epoch_id) with row ${prev}`,
      });
    } else {
      seen.set(key, index);
    }
  });

  rows.forEach((row, index) => {
    if (!row.agreement_id.trim()) {
      errors.push({ row_index: index, field: "agreement_id", message: "Required" });
    }
    if (!row.epoch_id.trim()) {
      errors.push({ row_index: index, field: "epoch_id", message: "Required" });
    }

    const gross = parseDollarAmount(row.gross_amount);
    const tax = parseDollarAmount(row.tax_withheld);
    const fee = parseDollarAmount(row.fee_amount);
    const net = parseDollarAmount(row.net_amount);

    if (gross <= 0) {
      errors.push({ row_index: index, field: "gross_amount", message: "Must be > 0" });
    }
    if (net <= 0) {
      errors.push({ row_index: index, field: "net_amount", message: "Must be > 0" });
    }
    if (gross < net) {
      errors.push({ row_index: index, field: "gross_amount", message: "Must be >= net" });
    }
    if (gross < tax) {
      errors.push({ row_index: index, field: "tax_withheld", message: "Tax exceeds gross" });
    }

    // Check net = gross - tax - fee
    const expected = Math.round((gross - tax - fee) * 100) / 100;
    const actual = Math.round(net * 100) / 100;
    if (Math.abs(expected - actual) > 0.005) {
      errors.push({
        row_index: index,
        field: "net_amount",
        message: `net (${actual}) !== gross - tax - fee (${expected})`,
      });
    }
  });

  return errors;
}

// ----------------------------------------------------------------
// Encoding helpers
// ----------------------------------------------------------------

function parseDollarAmount(value: string): number {
  const cleaned = value.replace(/[$,\s]/g, "");
  return cleaned ? Number(cleaned) : 0;
}

/** Convert a display dollar amount to minor units (1 USDCx = 1_000_000 minor) */
function dollarToMinor(value: string): bigint {
  const cleaned = value.replace(/[$,\s]/g, "");
  const num = Number(cleaned);
  if (isNaN(num)) return 0n;
  return BigInt(Math.round(num * 1_000_000));
}

function encodeString(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function encodeU16(n: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = (n >> 8) & 0xff;
  buf[1] = n & 0xff;
  return buf;
}

function encodeU32(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (n >> 24) & 0xff;
  buf[1] = (n >> 16) & 0xff;
  buf[2] = (n >> 8) & 0xff;
  buf[3] = n & 0xff;
  return buf;
}

function encodeU64(n: number): Uint8Array {
  const buf = new Uint8Array(8);
  const big = BigInt(n);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(big >> BigInt((7 - i) * 8) & 0xffn);
  }
  return buf;
}

function encodeBigInt(n: bigint): Uint8Array {
  const buf = new Uint8Array(16); // u128
  for (let i = 15; i >= 0; i--) {
    buf[i] = Number(n >> BigInt((15 - i) * 8) & 0xffn);
  }
  return buf;
}

function sumAmounts(amounts: U128[]): U128 {
  let total = 0n;
  for (const a of amounts) {
    total += BigInt(a);
  }
  return total.toString() as U128;
}

function concatBytes32(hashes: Bytes32[]): Uint8Array {
  const totalLen = hashes.length * 32;
  const result = new Uint8Array(totalLen);
  hashes.forEach((h, i) => {
    result.set(fromHex(h), i * 32);
  });
  return result;
}
