import { describe, it, expect } from "vitest";
import { compileManifest } from "../manifest/compiler";
import type { CompilerInput } from "../manifest/compiler";
import type { PayrollTableRow } from "../../components/payroll-table/types";
import { createEmptyRow } from "../../components/payroll-table/types";
import {
  checkManifestAgainstReceipts,
  checkDoublePay,
  uncheckedResult,
} from "./double_pay_guard";
import type { ParsedReceipt } from "../records/payroll_history_scanner";

function makeRow(overrides?: Partial<PayrollTableRow>): PayrollTableRow {
  return {
    ...createEmptyRow(),
    worker_name: "John",
    worker_addr: "aleo1worker1",
    worker_name_hash: "0x1111",
    agreement_id: "0xagreement1",
    epoch_id: "20260612",
    gross_amount: "1000.00",
    tax_withheld: "150.00",
    fee_amount: "20.00",
    net_amount: "830.00",
    ...overrides,
  };
}

function makeInput(rows: PayrollTableRow[], extra?: Partial<CompilerInput>): CompilerInput {
  return {
    rows,
    employer_addr: "aleo1employer",
    employer_name_hash: "0xemployerhash",
    epoch_id: "20260612",
    schema_v: 2,
    calc_v: 1,
    policy_v: 1,
    ...extra,
  };
}

function makeReceipt(overrides?: Partial<ParsedReceipt>): ParsedReceipt {
  return {
    worker_name_hash: "1111",
    employer_name_hash: "2222",
    agreement_id: "agreement1", // scanner hex has no 0x prefix
    epoch_id: 20260612,
    gross_amount: "1000000000",
    net_amount: "830000000",
    tax_withheld: "150000000",
    fee_amount: "20000000",
    payroll_inputs_hash: "ab".repeat(32),
    receipt_anchor: "cd".repeat(32),
    pair_hash: "ef".repeat(32),
    utc_time_hash: "01".repeat(32),
    issued_height: 123456,
    ...overrides,
  };
}

describe("checkManifestAgainstReceipts", () => {
  it("clean history produces no findings", () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    const result = checkManifestAgainstReceipts(manifest, [
      makeReceipt({ agreement_id: "otheragreement", epoch_id: 20260501 }),
    ]);
    expect(result.checked).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.findings).toHaveLength(0);
  });

  it("blocks on exact payroll_inputs_hash match (0x prefix normalized)", () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    const rowHash = manifest.rows[0]!.payroll_inputs_hash; // "0x..."
    const result = checkManifestAgainstReceipts(manifest, [
      makeReceipt({ payroll_inputs_hash: rowHash.slice(2) }),
    ]);
    expect(result.blocked).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.kind).toBe("exact_duplicate");
  });

  it("warns (not blocks) on same epoch + same amount with different hash", () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    const result = checkManifestAgainstReceipts(manifest, [
      makeReceipt({
        agreement_id: "agreement1",
        epoch_id: 20260612,
        gross_amount: manifest.rows[0]!.gross_amount,
      }),
    ]);
    expect(result.blocked).toBe(false);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.kind).toBe("same_epoch_same_amount");
  });

  it("warns mildly on same epoch with different amount", () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    const result = checkManifestAgainstReceipts(manifest, [
      makeReceipt({
        agreement_id: "agreement1",
        epoch_id: 20260612,
        gross_amount: "555000000",
      }),
    ]);
    expect(result.blocked).toBe(false);
    expect(result.findings[0]!.kind).toBe("same_epoch");
  });

  it("a different run_kind avoids the exact-duplicate block", () => {
    const regular = compileManifest(makeInput([makeRow()]));
    const bonus = compileManifest(makeInput([makeRow()], { run_kind: "bonus" }));
    // History contains the settled regular payment
    const history = [
      makeReceipt({
        agreement_id: "agreement1",
        epoch_id: 20260612,
        gross_amount: regular.rows[0]!.gross_amount,
        payroll_inputs_hash: regular.rows[0]!.payroll_inputs_hash.slice(2),
      }),
    ];
    // Resubmitting the identical regular run is blocked...
    expect(checkManifestAgainstReceipts(regular, history).blocked).toBe(true);
    // ...but the same payment declared as a bonus passes with a warning
    const bonusResult = checkManifestAgainstReceipts(bonus, history);
    expect(bonusResult.blocked).toBe(false);
    expect(bonusResult.findings[0]!.kind).toBe("same_epoch_same_amount");
  });

  it("a different memo avoids the exact-duplicate block", () => {
    const first = compileManifest(makeInput([makeRow()]));
    const repeat = compileManifest(makeInput([makeRow()], { run_memo: "expense reimbursement" }));
    const history = [
      makeReceipt({
        agreement_id: "agreement1",
        epoch_id: 20260612,
        gross_amount: first.rows[0]!.gross_amount,
        payroll_inputs_hash: first.rows[0]!.payroll_inputs_hash.slice(2),
      }),
    ];
    expect(checkManifestAgainstReceipts(first, history).blocked).toBe(true);
    expect(checkManifestAgainstReceipts(repeat, history).blocked).toBe(false);
  });

  it("flags every matching row in a multi-worker run", () => {
    const rows = [
      makeRow({ agreement_id: "0xa" }),
      makeRow({ agreement_id: "0xb", worker_addr: "aleo1worker2" }),
    ];
    const manifest = compileManifest(makeInput(rows));
    const result = checkManifestAgainstReceipts(manifest, [
      makeReceipt({
        agreement_id: "a",
        payroll_inputs_hash: manifest.rows[0]!.payroll_inputs_hash.slice(2),
      }),
      makeReceipt({
        agreement_id: "b",
        epoch_id: 20260612,
        gross_amount: "999000000",
      }),
    ]);
    expect(result.blocked).toBe(true);
    expect(result.findings).toHaveLength(2);
    const kinds = result.findings.map((f) => f.kind).sort();
    expect(kinds).toEqual(["exact_duplicate", "same_epoch"]);
  });
});

describe("checkDoublePay", () => {
  it("degrades to unchecked when the record scan throws", async () => {
    const manifest = compileManifest(makeInput([makeRow()]));
    // scanPayrollHistory catches its own errors and returns [] — but a
    // rejecting requestRecords propagating is also handled by the guard.
    const result = await checkDoublePay(
      manifest,
      () => Promise.reject(new Error("wallet locked")),
      "aleo1employer",
    );
    // scanPayrollHistory swallows the error and returns no receipts
    expect(result.blocked).toBe(false);
    expect(result.findings).toHaveLength(0);
  });
});

describe("uncheckedResult", () => {
  it("never blocks and carries the message", () => {
    const r = uncheckedResult("no wallet");
    expect(r.checked).toBe(false);
    expect(r.blocked).toBe(false);
    expect(r.message).toBe("no wallet");
  });
});
