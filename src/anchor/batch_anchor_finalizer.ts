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
import { LAYER2_TRANSITIONS } from "../lib/pnw-adapter/layer2_adapter";
import type { ExecutionResult, AdapterConfig } from "../lib/pnw-adapter/aleo_cli_adapter";
import { executeTransition } from "../lib/pnw-adapter/aleo_cli_adapter";
import { executeAleoTransaction } from "../lib/wallet/wallet-executor";
import type { WalletExecuteFn } from "../lib/wallet/wallet-executor";
import { domainHash, toHex } from "../lib/pnw-adapter/hash";

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

/** Convert a hex string (with or without 0x) to an Aleo [u8; 32] array literal. */
function hexToU8Array32(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  while (bytes.length < 32) bytes.push(0);
  return "[ " + bytes.slice(0, 32).map(b => `${b}u8`).join(", ") + " ]";
}

/**
 * Serialize inputs for mint_cycle_nft matching the deployed program signature:
 *   r0: nft_id [u8;32]
 *   r1: agreement_id [u8;32]  (first row's agreement — single-employer assumption)
 *   r2: period_start u32      (epoch_id)
 *   r3: period_end u32        (epoch_id for single-epoch runs)
 *   r4: doc_hash [u8;32]      (IPFS hash of PDF, or batch_id as placeholder)
 *   r5: root [u8;32]          (row_root)
 *   r6: audit_event_hash [u8;32]  (audit hash anchored in step 4 of sequential payroll)
 *   r7: schema_v u16
 *   r8: calc_v u16
 *   r9: policy_v u16
 */
export function serializeAnchorInputs(
  manifest: PayrollRunManifest,
  nftId: Bytes32,
  docHash?: Bytes32,
): string[] {
  const firstRow = manifest.rows[0];
  if (!firstRow) throw new Error("Manifest has no rows to anchor");

  return [
    hexToU8Array32(nftId),
    hexToU8Array32(firstRow.agreement_id),
    `${manifest.epoch_id}u32`,
    `${manifest.epoch_id}u32`,
    hexToU8Array32(docHash ?? manifest.batch_id),
    hexToU8Array32(manifest.row_root),
    hexToU8Array32(firstRow.audit_event_hash),
    `${manifest.schema_v ?? 1}u16`,
    `${manifest.calc_v ?? 1}u16`,
    `${manifest.policy_v ?? 1}u16`,
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
  docHash?: Bytes32,
): Promise<AnchorResult> {
  if (manifest.status !== "settled") {
    throw new Error(
      `Cannot anchor manifest in status "${manifest.status}". Must be "settled".`,
    );
  }

  const nftId = deriveNftId(manifest.batch_id);
  const inputs = serializeAnchorInputs(manifest, nftId, docHash);
  const transition = LAYER2_TRANSITIONS.mint_cycle_nft;

  const result: ExecutionResult = await executeTransition(
    config,
    transition.program,
    transition.transition,
    inputs,
    DEFAULT_FEE,
  );

  return {
    tx_id: result.tx_id,
    nft_id: nftId,
  };
}

/**
 * Mint the batch anchor via wallet signing (preferred path for Shield/Leo/Puzzle).
 * Matches how sequential payroll calls the wallet.
 */
export async function mintBatchAnchorViaWallet(
  manifest: PayrollRunManifest,
  walletExecute: WalletExecuteFn,
  docHash?: Bytes32,
): Promise<AnchorResult> {
  if (manifest.status !== "settled") {
    throw new Error(
      `Cannot anchor manifest in status "${manifest.status}". Must be "settled".`,
    );
  }

  const nftId = deriveNftId(manifest.batch_id);
  const inputs = serializeAnchorInputs(manifest, nftId, docHash);
  const transition = LAYER2_TRANSITIONS.mint_cycle_nft;

  console.log("[PNW-ANCHOR] Minting payroll anchor NFT:", {
    program: transition.program,
    function: transition.transition,
    inputs: inputs.map(i => i.slice(0, 60) + (i.length > 60 ? "..." : "")),
  });

  const txId = await executeAleoTransaction(
    walletExecute,
    transition.program,
    transition.transition,
    inputs,
    Number(DEFAULT_FEE),
  );

  return {
    tx_id: txId,
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
