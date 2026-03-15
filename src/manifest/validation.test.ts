import { describe, it, expect } from "vitest";
import {
  validateRow,
  validateTable,
  findDuplicates,
} from "../../components/payroll-table/validation";
import { createEmptyRow } from "../../components/payroll-table/types";
import type { PayrollTableRow } from "../../components/payroll-table/types";

function makeValidRow(overrides?: Partial<PayrollTableRow>): PayrollTableRow {
  return {
    ...createEmptyRow(),
    worker_name: "John",
    worker_addr: "aleo1test",
    worker_name_hash: "0x1234",
    agreement_id: "0xagreement1",
    epoch_id: "20260302",
    gross_amount: "1000.00",
    tax_withheld: "150.00",
    fee_amount: "20.00",
    net_amount: "830.00",
    ...overrides,
  };
}

describe("validateRow", () => {
  it("valid row passes", () => {
    const result = validateRow(makeValidRow());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("missing agreement_id fails", () => {
    const result = validateRow(makeValidRow({ agreement_id: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "agreement_id")).toBe(true);
  });

  it("missing epoch_id fails", () => {
    const result = validateRow(makeValidRow({ epoch_id: "" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "epoch_id")).toBe(true);
  });

  it("invalid epoch format fails", () => {
    const result = validateRow(makeValidRow({ epoch_id: "2026" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "epoch_id")).toBe(true);
  });

  it("gross_amount <= 0 fails", () => {
    const result = validateRow(makeValidRow({ gross_amount: "0" }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "gross_amount")).toBe(true);
  });

  it("net_amount <= 0 fails", () => {
    const result = validateRow(
      makeValidRow({ net_amount: "-10", gross_amount: "10", tax_withheld: "15", fee_amount: "5" }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === "net_amount")).toBe(true);
  });

  it("net !== gross - tax - fee fails", () => {
    const result = validateRow(
      makeValidRow({ gross_amount: "1000", tax_withheld: "100", fee_amount: "50", net_amount: "900" }),
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e) => e.field === "net_amount" && e.message.includes("expected"),
      ),
    ).toBe(true);
  });

  it("correct net = gross - tax - fee passes", () => {
    const result = validateRow(
      makeValidRow({ gross_amount: "1000", tax_withheld: "100", fee_amount: "50", net_amount: "850" }),
    );
    expect(result.valid).toBe(true);
  });

  it("negative tax fails", () => {
    const result = validateRow(makeValidRow({ tax_withheld: "-10" }));
    expect(result.valid).toBe(false);
  });
});

describe("findDuplicates", () => {
  it("no duplicates returns empty map", () => {
    const rows = [
      makeValidRow({ agreement_id: "a", epoch_id: "20260301" }),
      makeValidRow({ agreement_id: "b", epoch_id: "20260301" }),
    ];
    expect(findDuplicates(rows).size).toBe(0);
  });

  it("same agreement+epoch is a duplicate", () => {
    const rows = [
      makeValidRow({ agreement_id: "a", epoch_id: "20260301" }),
      makeValidRow({ agreement_id: "a", epoch_id: "20260301" }),
    ];
    const dupes = findDuplicates(rows);
    expect(dupes.size).toBe(1);
    expect(dupes.get("a::20260301")).toEqual([0, 1]);
  });

  it("same agreement different epoch is not a duplicate", () => {
    const rows = [
      makeValidRow({ agreement_id: "a", epoch_id: "20260301" }),
      makeValidRow({ agreement_id: "a", epoch_id: "20260302" }),
    ];
    expect(findDuplicates(rows).size).toBe(0);
  });
});

describe("validateTable", () => {
  it("all valid rows pass", () => {
    const rows = [makeValidRow(), makeValidRow({ agreement_id: "0xother" })];
    const { allValid } = validateTable(rows);
    expect(allValid).toBe(true);
  });

  it("one invalid row makes table invalid", () => {
    const rows = [
      makeValidRow({ agreement_id: "0xvalid" }),
      makeValidRow({ agreement_id: "0xinvalid", gross_amount: "" }),
    ];
    const { allValid, rowResults } = validateTable(rows);
    expect(allValid).toBe(false);
    expect(rowResults[0]?.valid).toBe(true);
    expect(rowResults[1]?.valid).toBe(false);
  });

  it("duplicates make table invalid", () => {
    const rows = [
      makeValidRow({ agreement_id: "x", epoch_id: "20260301" }),
      makeValidRow({ agreement_id: "x", epoch_id: "20260301" }),
    ];
    const { allValid, rowResults } = validateTable(rows);
    expect(allValid).toBe(false);
    // Both rows should have duplicate error
    expect(
      rowResults[0]?.errors.some((e) => e.message.includes("Duplicate")),
    ).toBe(true);
    expect(
      rowResults[1]?.errors.some((e) => e.message.includes("Duplicate")),
    ).toBe(true);
  });

  it("empty table is valid", () => {
    const { allValid } = validateTable([]);
    expect(allValid).toBe(true);
  });

  it("25 valid rows pass", () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      makeValidRow({ agreement_id: `0xagreement_${i}` }),
    );
    const { allValid } = validateTable(rows);
    expect(allValid).toBe(true);
  });
});
