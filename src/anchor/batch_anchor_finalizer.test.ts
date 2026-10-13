import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  deriveNftId,
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
  endpoint: "https://api.explorer.provable.com/v2/testnet",
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

/** Expected Aleo [u8; 32] literal for a 0x-prefixed hex string. */
function u8Array32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  while (bytes.length < 32) bytes.push(0);
  return "[ " + bytes.slice(0, 32).map((b) => `${b}u8`).join(", ") + " ]";
}

const U8_ARRAY_32 = /^\[ (\d{1,3}u8, ){31}\d{1,3}u8 \]$/;

describe("serializeAnchorInputs", () => {
  it("produces 10 inputs matching the deployed mint_cycle_nft signature", () => {
    const manifest = makeSettledManifest(2);
    const nftId = deriveNftId(manifest.batch_id);

    const inputs = serializeAnchorInputs(manifest, nftId);

    expect(inputs).toHaveLength(10);
    // r0 nft_id
    expect(inputs[0]).toMatch(U8_ARRAY_32);
    expect(inputs[0]).toBe(u8Array32(nftId));
    // r1 agreement_id (first row)
    expect(inputs[1]).toBe(u8Array32(manifest.rows[0]!.agreement_id));
    // r2 period_start, r3 period_end (single-epoch run)
    expect(inputs[2]).toBe(`${manifest.epoch_id}u32`);
    expect(inputs[3]).toBe(`${manifest.epoch_id}u32`);
    // r4 doc_hash — batch_id placeholder when no doc hash given
    expect(inputs[4]).toBe(u8Array32(manifest.batch_id));
    // r5 root
    expect(inputs[5]).toBe(u8Array32(manifest.row_root));
    // r6 audit_event_hash (first row)
    expect(inputs[6]).toBe(u8Array32(manifest.rows[0]!.audit_event_hash));
    // r7-r9 versions
    expect(inputs.slice(7)).toEqual(["1u16", "1u16", "1u16"]);
  });

  it("uses the supplied doc_hash instead of the batch_id placeholder", () => {
    const manifest = makeSettledManifest(1);
    const nftId = deriveNftId(manifest.batch_id);
    const docHash =
      "0x3333333333333333333333333333333333333333333333333333333333333333";

    const inputs = serializeAnchorInputs(manifest, nftId, docHash);

    expect(inputs[4]).toBe(u8Array32(docHash));
  });

  it("rejects a manifest with no rows", () => {
    const manifest = { ...makeSettledManifest(1), rows: [] };
    const nftId = deriveNftId(manifest.batch_id);

    expect(() => serializeAnchorInputs(manifest, nftId)).toThrow(
      "Manifest has no rows to anchor",
    );
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
    expect(program).toBe("payroll_nfts_v2.aleo");
    expect(transition).toBe("mint_cycle_nft");
    expect(inputs).toHaveLength(10);
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
    const nftId = deriveNftId(manifest.batch_id);
    const inputs = serializeAnchorInputs(manifest, nftId);

    // r5 is the root (row_root) as [u8; 32]
    expect(inputs[5]).toBe(u8Array32(manifest.row_root));
  });
});
