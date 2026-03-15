import { describe, it, expect } from "vitest";
import { planChunks } from "./chunk_planner";
import { compileManifest, type CompilerInput } from "./compiler";
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

function makeManifest(rowCount: number) {
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

describe("planChunks", () => {
  it("creates one chunk per row with chunkSize=1", () => {
    const manifest = makeManifest(3);
    const chunks = planChunks(manifest, 1);
    expect(chunks).toHaveLength(3);
    chunks.forEach((c, i) => {
      expect(c.chunk_index).toBe(i);
      expect(c.row_indices).toEqual([i]);
      expect(c.transition).toBe("execute_payroll");
      expect(c.status).toBe("pending");
      expect(c.attempts).toBe(0);
    });
  });

  it("creates chunks of size 2 with remainder", () => {
    const manifest = makeManifest(5);
    const chunks = planChunks(manifest, 2);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.row_indices).toEqual([0, 1]);
    expect(chunks[1]!.row_indices).toEqual([2, 3]);
    expect(chunks[2]!.row_indices).toEqual([4]); // remainder
    expect(chunks[0]!.transition).toBe("execute_payroll_batch_2");
    expect(chunks[2]!.transition).toBe("execute_payroll"); // single row
  });

  it("chunk_id is a valid 0x hex hash", () => {
    const manifest = makeManifest(2);
    const chunks = planChunks(manifest);
    for (const c of chunks) {
      expect(c.chunk_id).toMatch(/^0x[0-9a-f]{64}$/);
    }
  });

  it("chunk_ids are unique", () => {
    const manifest = makeManifest(5);
    const chunks = planChunks(manifest);
    const ids = new Set(chunks.map((c) => c.chunk_id));
    expect(ids.size).toBe(5);
  });

  it("chunk_ids are deterministic", () => {
    const manifest = makeManifest(3);
    const c1 = planChunks(manifest);
    const c2 = planChunks(manifest);
    c1.forEach((chunk, i) => {
      expect(chunk.chunk_id).toBe(c2[i]!.chunk_id);
    });
  });

  it("net_total matches row net_amount", () => {
    const manifest = makeManifest(1);
    const chunks = planChunks(manifest);
    expect(chunks[0]!.net_total).toBe(manifest.rows[0]!.net_amount);
  });

  it("net_total sums correctly for batch_2 chunks", () => {
    const manifest = makeManifest(4);
    const chunks = planChunks(manifest, 2);
    for (const chunk of chunks) {
      const expectedTotal = chunk.row_indices.reduce(
        (sum, idx) => sum + BigInt(manifest.rows[idx]!.net_amount),
        0n,
      );
      expect(BigInt(chunk.net_total)).toBe(expectedTotal);
    }
  });

  it("single row produces single chunk", () => {
    const manifest = makeManifest(1);
    const chunks = planChunks(manifest);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.chunk_index).toBe(0);
    expect(chunks[0]!.row_indices).toEqual([0]);
  });

  it("default chunkSize is 1", () => {
    const manifest = makeManifest(3);
    const chunks = planChunks(manifest);
    expect(chunks).toHaveLength(3);
    chunks.forEach((c) => {
      expect(c.row_indices).toHaveLength(1);
    });
  });
});
