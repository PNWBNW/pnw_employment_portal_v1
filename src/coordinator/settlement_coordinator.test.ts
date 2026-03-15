import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  executeSettlement,
  retryChunk,
  type SettlementContext,
  type CoordinatorCallbacks,
} from "./settlement_coordinator";
import { compileManifest, type CompilerInput } from "../manifest/compiler";
import { planChunks } from "../manifest/chunk_planner";
import type { PayrollTableRow } from "../../components/payroll-table/types";
import { createEmptyRow } from "../../components/payroll-table/types";
import type { ChunkPlan, PayrollRunStatus, PayrollRow } from "../manifest/types";

// Mock the adapter so no real snarkos calls are made
vi.mock("../lib/pnw-adapter/aleo_cli_adapter", () => ({
  executeTransition: vi.fn(),
}));

import { executeTransition } from "../lib/pnw-adapter/aleo_cli_adapter";
const mockExecute = vi.mocked(executeTransition);

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

function makeManifestAndChunks(rowCount: number) {
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
  const manifest = compileManifest(input);
  const chunks = planChunks(manifest);
  return { manifest, chunks };
}

function makeCallbacks() {
  const state = {
    statusHistory: [] as PayrollRunStatus[],
    chunkUpdates: [] as ChunkPlan[][],
    rowUpdates: [] as Array<{ rowIndex: number; status: PayrollRow["status"]; txId?: string }>,
    errors: [] as string[],
    completed: false,
    onRunStatusChange: (status: PayrollRunStatus) => { state.statusHistory.push(status); },
    onChunkUpdate: (chunks: ChunkPlan[]) => { state.chunkUpdates.push(chunks.map((c) => ({ ...c }))); },
    onRowUpdate: (rowIndex: number, status: PayrollRow["status"], txId?: string) => { state.rowUpdates.push({ rowIndex, status, txId }); },
    onComplete: () => { state.completed = true; },
    onError: (msg: string) => { state.errors.push(msg); },
  };
  return state;
}

function makeContext(rowCount: number) {
  const { manifest, chunks } = makeManifestAndChunks(rowCount);
  const cbs = makeCallbacks();
  return {
    manifest,
    chunks,
    adapterConfig: {
      endpoint: "https://api.explorer.provable.com/v1/testnet",
      network: "testnet",
      privateKey: "APrivateKey1test",
    },
    callbacks: cbs,
    cbs,
  };
}

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("Settlement Coordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes all chunks successfully", async () => {
    const ctx = makeContext(3);
    mockExecute.mockResolvedValue({
      tx_id: "at1txhash123",
      outputs: [],
      fee: "500000",
    });

    const result = await executeSettlement(ctx);

    expect(result).toHaveLength(3);
    result.forEach((chunk) => {
      expect(chunk.status).toBe("settled");
      expect(chunk.tx_id).toBe("at1txhash123");
    });

    // Run status should end at "settled"
    expect(ctx.cbs.statusHistory.at(-1)).toBe("settled");
    expect(ctx.cbs.completed).toBe(true);
    expect(ctx.cbs.errors).toHaveLength(0);

    // All rows should be settled
    expect(ctx.cbs.rowUpdates).toHaveLength(3);
    ctx.cbs.rowUpdates.forEach((u) => {
      expect(u.status).toBe("settled");
      expect(u.txId).toBe("at1txhash123");
    });
  });

  it("retries transient failures with backoff", async () => {
    const ctx = makeContext(1);

    // Fail twice, then succeed
    mockExecute
      .mockRejectedValueOnce(new Error("timeout"))
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce({
        tx_id: "at1retry_success",
        outputs: [],
        fee: "500000",
      });

    const result = await executeSettlement(ctx);

    expect(result[0]!.status).toBe("settled");
    expect(result[0]!.attempts).toBe(3);
    expect(result[0]!.tx_id).toBe("at1retry_success");
    expect(mockExecute).toHaveBeenCalledTimes(3);
  }, 30000);

  it("marks non-retryable errors as failed immediately", async () => {
    const ctx = makeContext(1);

    mockExecute.mockRejectedValue(new Error("duplicate: already settled"));

    const result = await executeSettlement(ctx);

    expect(result[0]!.status).toBe("failed");
    expect(result[0]!.attempts).toBe(1); // no retry
    expect(ctx.cbs.statusHistory.at(-1)).toBe("failed");

    // Row should be marked as conflict
    expect(ctx.cbs.rowUpdates[0]!.status).toBe("conflict");
  });

  it("marks run as needs_retry when some chunks settle and some fail", async () => {
    const ctx = makeContext(3);

    mockExecute
      .mockResolvedValueOnce({ tx_id: "tx1", outputs: [], fee: "500000" })
      .mockRejectedValue(new Error("duplicate: already settled"));

    const result = await executeSettlement(ctx);

    const settled = result.filter((c) => c.status === "settled");
    const failed = result.filter((c) => c.status === "failed");
    expect(settled).toHaveLength(1);
    expect(failed).toHaveLength(2);

    expect(ctx.cbs.statusHistory.at(-1)).toBe("needs_retry");
  });

  it("skips already settled chunks on retry", async () => {
    const ctx = makeContext(2);

    // Pre-settle the first chunk
    ctx.chunks[0] = { ...ctx.chunks[0]!, status: "settled", tx_id: "tx_already" };

    mockExecute.mockResolvedValueOnce({
      tx_id: "tx_new",
      outputs: [],
      fee: "500000",
    });

    const result = await executeSettlement(ctx);

    // Only one call to adapter (second chunk)
    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(result[0]!.status).toBe("settled");
    expect(result[0]!.tx_id).toBe("tx_already");
    expect(result[1]!.status).toBe("settled");
    expect(result[1]!.tx_id).toBe("tx_new");
  });

  it("exhausts retries and marks as failed", async () => {
    const ctx = makeContext(1);

    mockExecute.mockRejectedValue(new Error("timeout"));

    const result = await executeSettlement(ctx);

    expect(result[0]!.status).toBe("failed");
    expect(result[0]!.attempts).toBe(3);
    expect(mockExecute).toHaveBeenCalledTimes(3);
  }, 30000);

  it("retryChunk resets and retries a failed chunk", async () => {
    const ctx = makeContext(2);
    ctx.chunks[1] = {
      ...ctx.chunks[1]!,
      status: "failed",
      attempts: 3,
      last_error: "timeout",
    };

    mockExecute.mockResolvedValueOnce({
      tx_id: "tx_retry",
      outputs: [],
      fee: "500000",
    });

    const result = await retryChunk(ctx, 1);

    expect(result.status).toBe("settled");
    expect(result.tx_id).toBe("tx_retry");
    expect(result.attempts).toBe(1);
  });

  it("retryChunk returns settled chunk unchanged", async () => {
    const ctx = makeContext(1);
    ctx.chunks[0] = { ...ctx.chunks[0]!, status: "settled", tx_id: "tx_done" };

    const result = await retryChunk(ctx, 0);

    expect(result.status).toBe("settled");
    expect(result.tx_id).toBe("tx_done");
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("passes correct WorkerPayArgs to adapter", async () => {
    const ctx = makeContext(1);
    mockExecute.mockResolvedValueOnce({
      tx_id: "tx1",
      outputs: [],
      fee: "500000",
    });

    await executeSettlement(ctx);

    const [config, program, transition, inputs] = mockExecute.mock.calls[0]!;
    expect(program).toBe("payroll_core.aleo");
    expect(transition).toBe("execute_payroll");
    expect(inputs).toBeInstanceOf(Array);
    expect(inputs.length).toBe(15); // 15 fields in WorkerPayArgs

    // Check that batch_id and row_hash are included
    const batchIdInput = inputs.find((i: string) => i.startsWith(ctx.manifest.batch_id));
    expect(batchIdInput).toBeDefined();
  });
});
