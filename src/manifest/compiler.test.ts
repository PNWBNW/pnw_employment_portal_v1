import { describe, it, expect } from "vitest";
import { compileManifest, type CompilerInput } from "./compiler";
import { PayrollValidationError } from "./types";
import type { PayrollTableRow } from "../../components/payroll-table/types";
import { createEmptyRow } from "../../components/payroll-table/types";

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

function makeInput(rows: PayrollTableRow[]): CompilerInput {
  return {
    rows,
    employer_addr: "aleo1employer",
    employer_name_hash: "0xemployerhash",
    epoch_id: "20260302",
    schema_v: 1,
    calc_v: 1,
    policy_v: 1,
  };
}

describe("compileManifest", () => {
  it("compiles a single valid row", () => {
    const manifest = compileManifest(makeInput([makeRow()]));

    expect(manifest.status).toBe("validated");
    expect(manifest.row_count).toBe(1);
    expect(manifest.rows).toHaveLength(1);
    expect(manifest.batch_id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(manifest.row_root).toMatch(/^0x[0-9a-f]{64}$/);
    expect(manifest.doc_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(manifest.inputs_hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("row amounts are in minor units", () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    const row = manifest.rows[0]!;
    expect(row.gross_amount).toBe("1000000000"); // $1000 * 1_000_000
    expect(row.tax_withheld).toBe("150000000");
    expect(row.fee_amount).toBe("20000000");
    expect(row.net_amount).toBe("830000000");
  });

  it("totals are correct", () => {
    const rows = [
      makeRow({ agreement_id: "0xa", gross_amount: "1000", tax_withheld: "100", fee_amount: "50", net_amount: "850" }),
      makeRow({ agreement_id: "0xb", gross_amount: "2000", tax_withheld: "300", fee_amount: "100", net_amount: "1600" }),
    ];
    const manifest = compileManifest(makeInput(rows));
    expect(manifest.total_gross_amount).toBe("3000000000");
    expect(manifest.total_net_amount).toBe("2450000000");
  });

  it("same rows always produce the same batch_id (determinism)", () => {
    const rows = [
      makeRow({ agreement_id: "0xa" }),
      makeRow({ agreement_id: "0xb" }),
      makeRow({ agreement_id: "0xc" }),
    ];
    const m1 = compileManifest(makeInput(rows));
    const m2 = compileManifest(makeInput(rows));
    expect(m1.batch_id).toBe(m2.batch_id);
    expect(m1.row_root).toBe(m2.row_root);
  });

  it("row order does not affect batch_id (stable sort)", () => {
    const rowA = makeRow({ agreement_id: "0xa" });
    const rowB = makeRow({ agreement_id: "0xb" });
    const rowC = makeRow({ agreement_id: "0xc" });

    const m1 = compileManifest(makeInput([rowA, rowB, rowC]));
    const m2 = compileManifest(makeInput([rowC, rowA, rowB]));
    expect(m1.batch_id).toBe(m2.batch_id);
  });

  it("adding a worker changes batch_id", () => {
    const rows2 = [
      makeRow({ agreement_id: "0xa" }),
      makeRow({ agreement_id: "0xb" }),
    ];
    const rows3 = [
      makeRow({ agreement_id: "0xa" }),
      makeRow({ agreement_id: "0xb" }),
      makeRow({ agreement_id: "0xc" }),
    ];
    const m2 = compileManifest(makeInput(rows2));
    const m3 = compileManifest(makeInput(rows3));
    expect(m2.batch_id).not.toBe(m3.batch_id);
  });

  it("changing an amount changes batch_id", () => {
    const rows1 = [makeRow({ agreement_id: "0xa", gross_amount: "1000", net_amount: "830" })];
    const rows2 = [makeRow({ agreement_id: "0xa", gross_amount: "1001", net_amount: "831" })];
    const m1 = compileManifest(makeInput(rows1));
    const m2 = compileManifest(makeInput(rows2));
    expect(m1.batch_id).not.toBe(m2.batch_id);
  });

  it("row hashes are all different", () => {
    const rows = [
      makeRow({ agreement_id: "0xa" }),
      makeRow({ agreement_id: "0xb" }),
      makeRow({ agreement_id: "0xc" }),
    ];
    const manifest = compileManifest(makeInput(rows));
    const hashes = manifest.rows.map((r) => r.row_hash);
    const unique = new Set(hashes);
    expect(unique.size).toBe(3);
  });

  it("rows are sorted by agreement_id", () => {
    const rows = [
      makeRow({ agreement_id: "0xc" }),
      makeRow({ agreement_id: "0xa" }),
      makeRow({ agreement_id: "0xb" }),
    ];
    const manifest = compileManifest(makeInput(rows));
    expect(manifest.rows[0]!.agreement_id).toBe("0xa");
    expect(manifest.rows[1]!.agreement_id).toBe("0xb");
    expect(manifest.rows[2]!.agreement_id).toBe("0xc");
  });

  it("row_index is assigned after sorting", () => {
    const rows = [
      makeRow({ agreement_id: "0xc" }),
      makeRow({ agreement_id: "0xa" }),
    ];
    const manifest = compileManifest(makeInput(rows));
    expect(manifest.rows[0]!.row_index).toBe(0);
    expect(manifest.rows[1]!.row_index).toBe(1);
  });

  it("all hash fields are valid hex", () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    const row = manifest.rows[0]!;
    const hashFields = [
      row.payroll_inputs_hash,
      row.receipt_anchor,
      row.receipt_pair_hash,
      row.utc_time_hash,
      row.audit_event_hash,
      row.row_hash,
    ];
    for (const h of hashFields) {
      expect(h).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  // Validation errors
  it("throws PayrollValidationError on empty rows", () => {
    expect(() => compileManifest(makeInput([]))).toThrow(PayrollValidationError);
  });

  it("throws PayrollValidationError on invalid net", () => {
    const rows = [makeRow({ net_amount: "999" })]; // doesn't match gross-tax-fee
    expect(() => compileManifest(makeInput(rows))).toThrow(PayrollValidationError);
  });

  it("throws PayrollValidationError on duplicate agreement+epoch", () => {
    const rows = [
      makeRow({ agreement_id: "0xsame", epoch_id: "20260302" }),
      makeRow({ agreement_id: "0xsame", epoch_id: "20260302" }),
    ];
    expect(() => compileManifest(makeInput(rows))).toThrow(PayrollValidationError);
  });

  it("PayrollValidationError includes row details", () => {
    try {
      compileManifest(makeInput([makeRow({ gross_amount: "0" })]));
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PayrollValidationError);
      const pve = e as PayrollValidationError;
      expect(pve.errors.length).toBeGreaterThan(0);
      expect(pve.errors[0]!.row_index).toBe(0);
    }
  });
});
