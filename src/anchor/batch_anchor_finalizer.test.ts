import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deriveNftId,
  buildCycleNftParams,
  serializeAnchorInputs,
  mintBatchAnchor,
} from "./batch_anchor_finalizer";
import { compileManifest, type CompilerInput } from "../manifest/compiler";
import type { PayrollTableRow } from "../../components/payroll-table/types";
import { createEmptyRow } from "../../components/payroll-table/types";
import type { PayrollRunManifest } from "../manifest/types";

// Mock the adapter
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
    worker_name: "Alice",
    worker_addr: "aleo1worker1",
    worker_name_hash: "0x1111",
    agreement_id: "0xagreement1",
    epoch_id: "20260302",
    gross_amount: "2000.00",
    tax_withheld: "300.00",
    fee_amount: "40.00",
    net_amount: "1660.00",
    ...overrides,
  };
}

function makeSettledManifest(rowCount: number): PayrollRunManifest {
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
  // Mark as settled
  return { ...manifest, status: "settled" as const };
}

const ADAPTER_CONFIG = {
  endpoint: "https://api.explorer.provable.com/v1/testnet",
  network: "testnet",
  privateKey: "APrivateKey1test",
};

// ----------------------------------------------------------------
// Tests
// ----------------------------------------------------------------

describe("deriveNftId", () => {
  it("returns a deterministic hex hash", () => {
    const batchId = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890";
    const nftId = deriveNftId(batchId);

    expect(nftId).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("returns the same result for the same batch_id", () => {
    const batchId = "0x1111111111111111111111111111111111111111111111111111111111111111";
    expect(deriveNftId(batchId)).toBe(deriveNftId(batchId));
  });

  it("returns different results for different batch_ids", () => {
    const id1 = "0x1111111111111111111111111111111111111111111111111111111111111111";
    const id2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
    expect(deriveNftId(id1)).not.toBe(deriveNftId(id2));
  });
});

describe("buildCycleNftParams", () => {
  it("extracts correct fields from manifest", () => {
    const manifest = makeSettledManifest(3);
    const params = buildCycleNftParams(manifest);

    expect(params.employer_addr).toBe("aleo1employer");
    expect(params.batch_id).toBe(manifest.batch_id);
    expect(params.batch_root).toBe(manifest.row_root);
    expect(params.epoch_id).toBe(manifest.epoch_id);
    expect(params.worker_count).toBe("3");
    expect(params.total_gross).toBe(manifest.total_gross_amount);
  });
});

describe("serializeAnchorInputs", () => {
  it("produces 7 Aleo-typed input strings", () => {
    const manifest = makeSettledManifest(2);
    const params = buildCycleNftParams(manifest);
    const nftId = deriveNftId(manifest.batch_id);

    const inputs = serializeAnchorInputs(params, nftId);

    expect(inputs).toHaveLength(7);

    // First input is the employer address (no suffix)
    expect(inputs[0]).toBe("aleo1employer");
    // nft_id as field
    expect(inputs[1]).toMatch(/^0x[0-9a-f]+field$/);
    // batch_id as field
    expect(inputs[2]).toMatch(/field$/);
    // batch_root as field
    expect(inputs[3]).toMatch(/field$/);
    // epoch_id as u32
    expect(inputs[4]).toMatch(/u32$/);
    // worker_count as u32
    expect(inputs[5]).toBe("2u32");
    // total_gross as field
    expect(inputs[6]).toMatch(/field$/);
  });
});

describe("mintBatchAnchor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls adapter with correct program and transition", async () => {
    const manifest = makeSettledManifest(3);
    mockExecute.mockResolvedValueOnce({
      tx_id: "at1anchor_tx_123",
      outputs: [],
      fee: "500000",
    });

    const result = await mintBatchAnchor(manifest, ADAPTER_CONFIG);

    expect(mockExecute).toHaveBeenCalledOnce();
    const [config, program, transition, inputs, fee] = mockExecute.mock.calls[0]!;
    expect(program).toBe("payroll_nfts.aleo");
    expect(transition).toBe("mint_cycle_nft");
    expect(inputs).toHaveLength(7);
    expect(fee).toBe("500000");
    expect(result.tx_id).toBe("at1anchor_tx_123");
    expect(result.nft_id).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("returns deterministic nft_id matching deriveNftId", async () => {
    const manifest = makeSettledManifest(2);
    mockExecute.mockResolvedValueOnce({
      tx_id: "at1tx",
      outputs: [],
      fee: "500000",
    });

    const result = await mintBatchAnchor(manifest, ADAPTER_CONFIG);
    const expectedNftId = deriveNftId(manifest.batch_id);

    expect(result.nft_id).toBe(expectedNftId);
  });

  it("rejects if manifest is not settled", async () => {
    const manifest = makeSettledManifest(1);
    const draftManifest = { ...manifest, status: "proving" as const };

    await expect(mintBatchAnchor(draftManifest, ADAPTER_CONFIG)).rejects.toThrow(
      'Cannot anchor manifest in status "proving"',
    );
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it("rejects if manifest is already anchored", async () => {
    const manifest = makeSettledManifest(1);
    const anchored = { ...manifest, status: "anchored" as const };

    await expect(mintBatchAnchor(anchored, ADAPTER_CONFIG)).rejects.toThrow(
      'Cannot anchor manifest in status "anchored"',
    );
  });

  it("propagates adapter errors", async () => {
    const manifest = makeSettledManifest(1);
    mockExecute.mockRejectedValueOnce(new Error("network timeout"));

    await expect(mintBatchAnchor(manifest, ADAPTER_CONFIG)).rejects.toThrow(
      "network timeout",
    );
  });

  it("includes batch_root in inputs (verifies NFT root field)", () => {
    const manifest = makeSettledManifest(3);
    const params = buildCycleNftParams(manifest);
    const nftId = deriveNftId(manifest.batch_id);
    const inputs = serializeAnchorInputs(params, nftId);

    // inputs[3] should be batch_root (row_root) as field
    expect(inputs[3]).toBe(`${manifest.row_root}field`);
  });
});
