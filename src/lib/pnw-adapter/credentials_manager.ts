/**
 * Credentials Manager
 *
 * Manages the Sealance credentials lifecycle for batched payroll:
 *
 * 1. Before a payroll run, call acquireCredentials() once.
 *    This fetches the freeze list, builds an exclusion proof for the
 *    employer address, and calls get_credentials() on-chain.
 *    → Returns a Credentials record containing the freeze_list_root.
 *
 * 2. Each settlement chunk then uses transfer_private_with_creds()
 *    instead of transfer_private(), passing the Credentials record.
 *    → Skips the expensive in-circuit Merkle proof verification.
 *
 * 3. If the freeze list root rotates mid-run, the finalize check in
 *    the stablecoin program still accepts the previous root within a
 *    block_height_window. If the window expires, call acquireCredentials()
 *    again.
 *
 * Energy savings: for a run of N workers, this avoids N-1 Merkle
 * proof verifications (the heaviest part of the transfer circuit).
 */

import { PROGRAMS } from "@/src/config/programs";
import type { Address } from "./aleo_types";
import type {
  CredentialsRecord,
  ComplianceState,
  FreezeListTree,
} from "./sealance_types";
import {
  fetchFreezeListTree,
  isAddressFrozen,
  buildExclusionProof,
  formatProofAsInputs,
} from "./freeze_list_resolver";
import type { WalletExecuteFn } from "../wallet/wallet-executor";
import {
  executeAleoTransaction,
  pollTransactionStatus,
  queryMapping,
} from "../wallet/wallet-executor";

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Acquire a Credentials record for the employer address.
 *
 * Steps:
 * 1. Fetch the current freeze list tree
 * 2. Verify employer is NOT on the freeze list
 * 3. Build exclusion proof
 * 4. Call get_credentials() on the stablecoin program
 * 5. Return the Credentials record for use in settlement
 *
 * @param employerAddr - The employer's Aleo address
 * @param walletExecute - Wallet adapter execute function
 * @returns ComplianceState with credentials if successful
 */
export async function acquireCredentials(
  employerAddr: Address,
  walletExecute: WalletExecuteFn,
): Promise<ComplianceState> {
  try {
    // Step 1: Fetch freeze list
    const tree = await fetchFreezeListTree();

    // Step 2: Check employer isn't frozen
    if (isAddressFrozen(employerAddr, tree)) {
      return {
        status: "frozen",
        proof: null,
        credentials: null,
        currentRoot: tree.root,
        error: "Employer address is on the compliance freeze list",
      };
    }

    // Step 3: Build exclusion proof
    const proof = buildExclusionProof(employerAddr, tree);

    // Step 4: Call get_credentials on the stablecoin program
    const proofInputs = formatProofAsInputs(proof);
    const usdcxProgram = PROGRAMS.external.usdcx;

    const txId = await executeAleoTransaction(
      walletExecute,
      usdcxProgram,
      "get_credentials",
      proofInputs,
      500_000, // 0.5 credits
    );

    // Step 5: Poll for confirmation
    const result = await pollTransactionStatus(txId);

    if (result.status === "rejected") {
      return {
        status: "error",
        proof,
        credentials: null,
        currentRoot: tree.root,
        error: `get_credentials rejected: ${result.error ?? "unknown"}`,
      };
    }

    if (result.status === "unknown") {
      return {
        status: "error",
        proof,
        credentials: null,
        currentRoot: tree.root,
        error: "get_credentials timed out — credentials may still be valid",
      };
    }

    // Credentials record is in the transaction outputs
    // The wallet will have the record available after confirmation
    const credentials: CredentialsRecord = {
      owner: employerAddr,
      freeze_list_root: tree.root,
      block_height: result.blockHeight ?? 0,
      nonce: txId, // placeholder — actual nonce from record decryption
    };

    return {
      status: "credentials_valid",
      proof,
      credentials,
      currentRoot: tree.root,
      error: null,
    };
  } catch (err) {
    return {
      status: "error",
      proof: null,
      credentials: null,
      currentRoot: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check if existing credentials are still valid.
 *
 * The stablecoin program accepts the previous root within a
 * block_height_window after rotation. This function checks
 * whether the current on-chain root still matches.
 */
export async function checkCredentialsValid(
  credentials: CredentialsRecord,
): Promise<boolean> {
  const usdcxProgram = PROGRAMS.external.usdcx;

  // Query current root
  const currentRoot = await queryMapping(
    usdcxProgram,
    "freeze_list_root",
    "1u8",
  );

  if (!currentRoot) return true; // No freeze list → always valid

  const cleanRoot = currentRoot.replace(/\.(private|public)$/, "").trim();

  // Root matches → valid
  if (cleanRoot === credentials.freeze_list_root) return true;

  // Root changed — check if within the block_height_window
  const windowStr = await queryMapping(
    usdcxProgram,
    "block_height_window",
    "1u8",
  );

  if (!windowStr) return false; // Can't determine window → assume expired

  const window = parseInt(windowStr.replace(/[^\d]/g, ""), 10);
  const updatedHeightStr = await queryMapping(
    usdcxProgram,
    "root_updated_height",
    "1u8",
  );

  if (!updatedHeightStr) return false;

  const updatedHeight = parseInt(updatedHeightStr.replace(/[^\d]/g, ""), 10);

  // Credentials are still valid if block_height < updatedHeight + window
  return credentials.block_height < updatedHeight + window;
}

/**
 * Build a compliance state for use without wallet (dry-run / preview).
 * Fetches the tree and checks freeze status without calling get_credentials.
 */
export async function checkComplianceStatus(
  address: Address,
): Promise<ComplianceState> {
  try {
    const tree = await fetchFreezeListTree();

    if (isAddressFrozen(address, tree)) {
      return {
        status: "frozen",
        proof: null,
        credentials: null,
        currentRoot: tree.root,
        error: "Address is on the compliance freeze list",
      };
    }

    const proof = buildExclusionProof(address, tree);

    return {
      status: "clear",
      proof,
      credentials: null,
      currentRoot: tree.root,
      error: null,
    };
  } catch (err) {
    return {
      status: "error",
      proof: null,
      credentials: null,
      currentRoot: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
