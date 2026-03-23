/**
 * Batch Anchor Finalizer
 *
 * After all settlement chunks are confirmed, the employer mints a single
 * cycle NFT on Layer 2 (payroll_nfts.aleo) that anchors the batch_root
 * (Merkle root over all row hashes) for the entire payroll run.
 *
 * This NFT serves as the on-chain proof that:
 * - All workers in the batch were paid
 * - The batch_root commits to every individual row_hash
 * - The epoch, worker count, and total gross are recorded immutably
 *
 * Flow:
 *   1. Derive nft_id from batch_id via domain hash
 *   2. Build CycleNftParams from the manifest
 *   3. Serialize inputs for the Layer 2 mint_cycle_nft transition
 *   4. Call adapter to execute the on-chain mint
 *   5. Update manifest status to "anchored"
 */

import type { PayrollRunManifest } from "../manifest/types";
import type { Bytes32 } from "../lib/pnw-adapter/aleo_types";
import type { CycleNftParams } from "../lib/pnw-adapter/layer2_router";
import { LAYER2_TRANSITIONS } from "../lib/pnw-adapter/layer2_adapter";
import type { ExecutionResult, AdapterConfig } from "../lib/pnw-adapter/aleo_cli_adapter";
import { executeTransition } from "../lib/pnw-adapter/aleo_cli_adapter";
import { domainHash, toHex } from "../lib/pnw-adapter/hash";
import { pluginRegistry } from "../plugins/registry";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/** Domain tag for deriving nft_id from batch_id */
const NFT_ID_DOMAIN = "PNW::NFT_ID";

/** Default fee for Layer 2 mint (0.5 credits) */
const DEFAULT_FEE = "500000";

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export type AnchorResult = {
  tx_id: string;
  nft_id: Bytes32;
};

/**
 * Derive a deterministic nft_id from the batch_id.
 * nft_id = BLAKE3(NFT_ID_DOMAIN || batch_id_bytes)
 */
export function deriveNftId(batchId: Bytes32): Bytes32 {
  const batchBytes = hexToBytes(batchId);
  const hash = domainHash(NFT_ID_DOMAIN, batchBytes);
  return toHex(hash) as Bytes32;
}

/**
 * Build the CycleNftParams from a settled manifest.
 */
export function buildCycleNftParams(manifest: PayrollRunManifest): CycleNftParams {
  return {
    employer_addr: manifest.employer_addr,
    batch_id: manifest.batch_id,
    batch_root: manifest.row_root,
    epoch_id: manifest.epoch_id,
    worker_count: manifest.row_count,
    total_gross: manifest.total_gross_amount,
  };
}

/**
 * Serialize CycleNftParams + nft_id into Aleo input strings
 * for the mint_cycle_nft transition.
 */
export function serializeAnchorInputs(
  params: CycleNftParams,
  nftId: Bytes32,
): string[] {
  return [
    params.employer_addr,
    `${nftId}field`,
    `${String(params.batch_id)}field`,
    `${String(params.batch_root)}field`,
    `${String(params.epoch_id)}u32`,
    `${String(params.worker_count)}u32`,
    `${String(params.total_gross)}field`,
  ];
}

/**
 * Mint the batch anchor cycle NFT.
 *
 * Preconditions:
 * - Manifest status must be "settled" (all chunks done)
 * - Private key must be available in session
 *
 * @param manifest - The fully settled manifest
 * @param config - Adapter config with private key
 * @returns The anchor result with tx_id and nft_id
 */
export async function mintBatchAnchor(
  manifest: PayrollRunManifest,
  config: AdapterConfig,
): Promise<AnchorResult> {
  // Guard: only anchor a fully settled run
  if (manifest.status !== "settled") {
    throw new Error(
      `Cannot anchor manifest in status "${manifest.status}". Must be "settled".`,
    );
  }

  // Derive nft_id
  const nftId = deriveNftId(manifest.batch_id);

  // Build params and serialize
  const params = buildCycleNftParams(manifest);
  const inputs = serializeAnchorInputs(params, nftId);

  // Get Layer 2 transition info
  const transition = LAYER2_TRANSITIONS.mint_cycle_nft;

  // Emit anchor start event
  void pluginRegistry.emit("onBatchAnchorStart", {
    manifest,
    batch_root: manifest.row_root,
  });

  // Execute on-chain
  const result: ExecutionResult = await executeTransition(
    config,
    transition.program,
    transition.transition,
    inputs,
    DEFAULT_FEE,
  );

  void pluginRegistry.emit("onBatchAnchorSuccess", {
    manifest,
    batch_root: manifest.row_root,
    nft_id: nftId,
    tx_id: result.tx_id,
  });

  return {
    tx_id: result.tx_id,
    nft_id: nftId,
  };
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
