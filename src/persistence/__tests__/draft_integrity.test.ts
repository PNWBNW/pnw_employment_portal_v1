import { describe, it, expect } from "vitest";
import {
  computeDraftIntegrity,
  verifyDraftIntegrity,
} from "../draft_integrity";
import type { PayrollTableRow } from "@/components/payroll-table/types";

function makeRow(overrides: Partial<PayrollTableRow> = {}): PayrollTableRow {
  return {
    id: crypto.randomUUID(),
    worker_name: "Alice",
    worker_addr: "aleo1abc123",
    worker_name_hash: "0xdeadbeef",
    agreement_id: "agreement_001",
    epoch_id: "20260315",
    gross_amount: "5000.00",
    tax_withheld: "750.00",
    fee_amount: "50.00",
    net_amount: "4200.00",
    ...overrides,
  };
}

describe("draft_integrity", () => {
  const epochId = "20260315";
  const employer = "aleo1employer";

  it("produces a deterministic root for the same rows", () => {
    const rows = [makeRow(), makeRow({ worker_addr: "aleo1xyz789", agreement_id: "agreement_002" })];
    const root1 = computeDraftIntegrity(rows, epochId, employer);
    const root2 = computeDraftIntegrity(rows, epochId, employer);
    expect(root1).toBe(root2);
    expect(root1.startsWith("0x")).toBe(true);
  });

  it("changes root when a row amount changes", () => {
    const rows = [makeRow()];
    const root1 = computeDraftIntegrity(rows, epochId, employer);
    const modified = [makeRow({ gross_amount: "6000.00" })];
    const root2 = computeDraftIntegrity(modified, epochId, employer);
    expect(root1).not.toBe(root2);
  });

  it("changes root when employer changes", () => {
    const rows = [makeRow()];
    const root1 = computeDraftIntegrity(rows, epochId, employer);
    const root2 = computeDraftIntegrity(rows, epochId, "aleo1other");
    expect(root1).not.toBe(root2);
  });

  it("changes root when epoch changes", () => {
    const rows = [makeRow()];
    const root1 = computeDraftIntegrity(rows, epochId, employer);
    const root2 = computeDraftIntegrity(rows, "20260401", employer);
    expect(root1).not.toBe(root2);
  });

  it("handles empty row set", () => {
    const root = computeDraftIntegrity([], epochId, employer);
    expect(root.startsWith("0x")).toBe(true);
    expect(root.length).toBeGreaterThan(4);
  });

  it("verifyDraftIntegrity returns true for matching data", () => {
    const rows = [makeRow(), makeRow({ agreement_id: "agreement_002" })];
    const root = computeDraftIntegrity(rows, epochId, employer);
    expect(verifyDraftIntegrity(rows, epochId, employer, root)).toBe(true);
  });

  it("verifyDraftIntegrity returns false for tampered data", () => {
    const rows = [makeRow()];
    const root = computeDraftIntegrity(rows, epochId, employer);
    const tampered = [makeRow({ net_amount: "9999.00" })];
    expect(verifyDraftIntegrity(tampered, epochId, employer, root)).toBe(false);
  });

  it("verifyDraftIntegrity returns false for added row", () => {
    const rows = [makeRow()];
    const root = computeDraftIntegrity(rows, epochId, employer);
    const withExtra = [...rows, makeRow({ agreement_id: "agreement_003" })];
    expect(verifyDraftIntegrity(withExtra, epochId, employer, root)).toBe(false);
  });
});
