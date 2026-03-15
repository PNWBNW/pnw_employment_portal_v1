import { describe, it, expect } from "vitest";
import {
  reconcileReceipts,
  applyReconciliation,
  type PaystubReceipt,
} from "./receipt_reconciler";
import { compileManifest, type CompilerInput } from "../manifest/compiler";
import type { PayrollTableRow } from "../../components/payroll-table/types";
import { createEmptyRow } from "../../components/payroll-table/types";
import type { PayrollRunManifest } from "../manifest/types";

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function makeRow(overrides?: Partial<PayrollTableRow>): PayrollTableRow {
  return {
    ...createEmptyRow(),
    worker_name: "John",
    worker_addr: "aleo1worker1",
    worker_name_hash: "0x1111",
    agreement_id: "0xagreement1",
    epoch_id: "20260302",
    gross_amount: "1000.00",
    tax_withheld: "150.00",
    fee_amount: "20.00",
    net_amount: "830.00",
    ...overrides,
  };
}

function makeManifest(rowCount: number): PayrollRunManifest {
  const rows = Array.from({ length: rowCount }, (_, i) =>
    makeRow({ agreement_id: `0xagreement_${i}` }),
  );
  const input: CompilerInput = {
    rows,
    employer_addr: "aleo1employer",
    employer_name_hash: "0xemployerhash",
    epoch_id: "20260302",
    schema_v: 1,
    calc_v: 1,
    policy_v: 1,
  };
  return compileManifest(input);
}

function receiptFromRow(manifest: PayrollRunManifest, rowIndex: number, txId = "at1tx123"): PaystubReceipt {
  const row = manifest.rows[rowIndex]!;
  return {
    tx_id: txId,
    payroll_inputs_hash: row.payroll_inputs_hash,
    receipt_anchor: row.receipt_anchor,
    batch_id: manifest.batch_id,
    row_hash: row.row_hash,
  };
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("reconcileReceipts", () => {
  it("fully reconciles when all receipts match", () => {
    const manifest = makeManifest(3);
    const receipts = manifest.rows.map((_, i) => receiptFromRow(manifest, i));

    const result = reconcileReceipts(manifest, receipts);

    expect(result.matched).toBe(3);
    expect(result.unmatched).toBe(0);
    expect(result.orphaned).toBe(0);
    expect(result.fullyReconciled).toBe(true);
    result.rowMatches.forEach((m) => {
      expect(m.matched).toBe(true);
      expect(m.receipt).toBeDefined();
    });
  });

  it("reports unmatched rows when receipts are missing", () => {
    const manifest = makeManifest(3);
    // Only provide receipt for row 0
    const receipts = [receiptFromRow(manifest, 0)];

    const result = reconcileReceipts(manifest, receipts);

    expect(result.matched).toBe(1);
    expect(result.unmatched).toBe(2);
    expect(result.fullyReconciled).toBe(false);
  });

  it("reports orphaned receipts", () => {
    const manifest = makeManifest(1);
    const receipts = [
      receiptFromRow(manifest, 0),
      {
        tx_id: "at1orphan",
        payroll_inputs_hash: "0xorphan_hash_0000000000000000000000000000000000000000000000000000",
        receipt_anchor: "0xorphan_anchor_00000000000000000000000000000000000000000000000000",
        batch_id: manifest.batch_id,
        row_hash: "0xorphan_row_0000000000000000000000000000000000000000000000000000000",
      },
    ];

    const result = reconcileReceipts(manifest, receipts);

    expect(result.matched).toBe(1);
    expect(result.orphaned).toBe(1);
    expect(result.orphanedReceipts).toHaveLength(1);
    expect(result.orphanedReceipts[0]!.tx_id).toBe("at1orphan");
    expect(result.fullyReconciled).toBe(false);
  });

  it("detects batch_id mismatch", () => {
    const manifest = makeManifest(1);
    const receipt = receiptFromRow(manifest, 0);
    receipt.batch_id = "0xwrong_batch_id_0000000000000000000000000000000000000000000000000";

    const result = reconcileReceipts(manifest, [receipt]);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(result.rowMatches[0]!.mismatch).toContain("batch_id mismatch");
  });

  it("detects row_hash mismatch", () => {
    const manifest = makeManifest(1);
    const receipt = receiptFromRow(manifest, 0);
    receipt.row_hash = "0xwrong_row_hash_0000000000000000000000000000000000000000000000000";

    const result = reconcileReceipts(manifest, [receipt]);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(1);
    expect(result.rowMatches[0]!.mismatch).toContain("row_hash mismatch");
  });

  it("handles empty receipts", () => {
    const manifest = makeManifest(2);
    const result = reconcileReceipts(manifest, []);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(2);
    expect(result.fullyReconciled).toBe(false);
  });

  it("handles empty manifest rows", () => {
    const manifest = makeManifest(1);
    manifest.rows = [];
    const result = reconcileReceipts(manifest, []);

    expect(result.matched).toBe(0);
    expect(result.unmatched).toBe(0);
    expect(result.fullyReconciled).toBe(true);
  });
});

describe("applyReconciliation", () => {
  it("updates matched rows to settled with tx_id", () => {
    const manifest = makeManifest(2);
    const receipts = manifest.rows.map((_, i) =>
      receiptFromRow(manifest, i, `at1tx_${i}`),
    );
    const result = reconcileReceipts(manifest, receipts);

    const updated = applyReconciliation(manifest.rows, result);

    expect(updated[0]!.status).toBe("settled");
    expect(updated[0]!.tx_id).toBe("at1tx_0");
    expect(updated[1]!.status).toBe("settled");
    expect(updated[1]!.tx_id).toBe("at1tx_1");
  });

  it("marks mismatched rows as conflict", () => {
    const manifest = makeManifest(1);
    const receipt = receiptFromRow(manifest, 0);
    receipt.batch_id = "0xwrong_batch_00000000000000000000000000000000000000000000000000000";
    const result = reconcileReceipts(manifest, [receipt]);

    const updated = applyReconciliation(manifest.rows, result);

    expect(updated[0]!.status).toBe("conflict");
  });

  it("leaves unmatched rows unchanged", () => {
    const manifest = makeManifest(2);
    const receipts = [receiptFromRow(manifest, 0)];
    const result = reconcileReceipts(manifest, receipts);

    const updated = applyReconciliation(manifest.rows, result);

    expect(updated[0]!.status).toBe("settled");
    expect(updated[1]!.status).toBe("pending"); // unchanged
  });
});
