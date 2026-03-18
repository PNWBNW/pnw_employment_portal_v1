/**
 * Roster Credentials Manager
 *
 * Manages the employer roster credentials lifecycle for batched payroll.
 * Mirrors the pattern from credentials_manager.ts (freeze list) but for
 * worker authorization instead of compliance.
 *
 * Flow:
 * 1. Before a payroll run, build the roster tree from active agreements
 * 2. Call get_roster_credentials() on payroll_core to anchor the roster_root
 * 3. Each settlement chunk includes the RosterCredentials record
 * 4. payroll_core finalize checks: roster_credentials.roster_root == on-chain root
 *
 * This replaces per-chunk agreement_id mapping lookups with a single
 * roster_root field comparison, saving finalize-time compute.
 *
 * The per-worker audit trail is preserved:
 * - agreement_id still flows into row_hash → row_root → batch_id
 * - Individual inclusion proofs are stored in the manifest for audit replay
 */

import { PROGRAMS } from "@/src/config/programs";
import type { Address, Bytes32 } from "./aleo_types";
import type {
  RosterCredentialsRecord,
  RosterTree,
  RosterState,
} from "./sealance_types";
import {
  buildRosterTree,
  buildRosterTreeFromAgreements,
  buildInclusionProof,
  isInRoster,
} from "./roster_tree_builder";
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
 * Acquire roster credentials for the employer's current worker roster.
 *
 * Steps:
 * 1. Build the roster tree from active agreements
 * 2. Verify all manifest workers are in the roster
 * 3. Call get_roster_credentials() on payroll_core
 * 4. Return RosterState with credentials for settlement
 *
 * @param viewKey - Employer's view key
 * @param employerAddr - Employer's Aleo address
 * @param walletExecute - Wallet adapter execute function
 * @param manifestAgreementIds - Agreement IDs from the manifest (for validation)
 */
export async function acquireRosterCredentials(
  viewKey: string,
  employerAddr: Address,
  walletExecute: WalletExecuteFn,
  manifestAgreementIds?: Bytes32[],
): Promise<RosterState> {
  try {
    // Step 1: Build roster tree
    const tree = await buildRosterTree(viewKey, employerAddr);

    if (tree.leaves.length === 0) {
      return {
        status: "no_active_workers",
        tree: null,
        credentials: null,
        error: "No active agreements found for this employer",
      };
    }

    // Step 2: Validate all manifest workers are in the roster
    if (manifestAgreementIds) {
      for (const agreementId of manifestAgreementIds) {
        if (!isInRoster(agreementId, tree)) {
          return {
            status: "error",
            tree,
            credentials: null,
            error: `Agreement ${agreementId} is not in the active roster — worker may be paused or terminated`,
          };
        }
      }
    }

    // Step 3: Call get_roster_credentials on payroll_core
    const payrollCoreProgram = PROGRAMS.layer1.payroll_core;
    const inputs = [
      tree.root, // roster_root field
      `${tree.leaves.length}u32`, // roster_size
    ];

    const txId = await executeAleoTransaction(
      walletExecute,
      payrollCoreProgram,
      "get_roster_credentials",
      inputs,
      500_000, // 0.5 credits
    );

    // Step 4: Poll for confirmation
    const result = await pollTransactionStatus(txId);

    if (result.status === "rejected") {
      return {
        status: "error",
        tree,
        credentials: null,
        error: `get_roster_credentials rejected: ${result.error ?? "unknown"}`,
      };
    }

    if (result.status === "unknown") {
      return {
        status: "error",
        tree,
        credentials: null,
        error: "get_roster_credentials timed out — credentials may still be valid",
      };
    }

    const credentials: RosterCredentialsRecord = {
      owner: employerAddr,
      roster_root: tree.root,
      block_height: result.blockHeight ?? 0,
      nonce: txId,
    };

    return {
      status: "valid",
      tree,
      credentials,
      error: null,
    };
  } catch (err) {
    return {
      status: "error",
      tree: null,
      credentials: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Build roster credentials from a pre-fetched agreement list.
 * Used when the manifest already has the definitive worker list.
 */
export async function acquireRosterCredentialsFromManifest(
  employerAddr: Address,
  agreementIds: Bytes32[],
  walletExecute: WalletExecuteFn,
): Promise<RosterState> {
  try {
    const tree = buildRosterTreeFromAgreements(agreementIds, employerAddr);

    if (tree.leaves.length === 0) {
      return {
        status: "no_active_workers",
        tree: null,
        credentials: null,
        error: "No agreement IDs provided",
      };
    }

    const payrollCoreProgram = PROGRAMS.layer1.payroll_core;
    const inputs = [
      tree.root,
      `${tree.leaves.length}u32`,
    ];

    const txId = await executeAleoTransaction(
      walletExecute,
      payrollCoreProgram,
      "get_roster_credentials",
      inputs,
      500_000,
    );

    const result = await pollTransactionStatus(txId);

    if (result.status === "rejected") {
      return {
        status: "error",
        tree,
        credentials: null,
        error: `get_roster_credentials rejected: ${result.error ?? "unknown"}`,
      };
    }

    if (result.status === "unknown") {
      return {
        status: "error",
        tree,
        credentials: null,
        error: "get_roster_credentials timed out",
      };
    }

    const credentials: RosterCredentialsRecord = {
      owner: employerAddr,
      roster_root: tree.root,
      block_height: result.blockHeight ?? 0,
      nonce: txId,
    };

    return {
      status: "valid",
      tree,
      credentials,
      error: null,
    };
  } catch (err) {
    return {
      status: "error",
      tree: null,
      credentials: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check if existing roster credentials are still valid.
 * The on-chain roster_root must still match.
 */
export async function checkRosterCredentialsValid(
  credentials: RosterCredentialsRecord,
): Promise<boolean> {
  const payrollCoreProgram = PROGRAMS.layer1.payroll_core;

  const currentRoot = await queryMapping(
    payrollCoreProgram,
    "roster_roots",
    credentials.owner,
  );

  if (!currentRoot) return true; // No on-chain root → first use, valid

  const cleanRoot = currentRoot.replace(/\.(private|public)$/, "").trim();
  return cleanRoot === credentials.roster_root;
}

/**
 * Build inclusion proofs for all workers in a manifest.
 * Returns a map of agreement_id → RosterInclusionProof.
 */
export function buildManifestInclusionProofs(
  agreementIds: Bytes32[],
  tree: RosterTree,
): Map<Bytes32, ReturnType<typeof buildInclusionProof>> {
  const proofs = new Map<Bytes32, ReturnType<typeof buildInclusionProof>>();

  for (const agreementId of agreementIds) {
    const proof = buildInclusionProof(agreementId, tree);
    proofs.set(agreementId, proof);
  }

  return proofs;
}
