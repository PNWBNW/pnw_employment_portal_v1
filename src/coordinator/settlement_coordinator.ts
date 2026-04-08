/**
 * Settlement Coordinator
 *
 * Drives chunk-by-chunk on-chain settlement for a compiled PayrollRunManifest.
 * Each chunk maps to one adapter execution call.
 *
 * Credentials-first flow (Sealance optimization):
 *   Before processing chunks, acquires a freeze-list Credentials record
 *   via get_credentials(). This proves the employer is not on the compliance
 *   freeze list using a single Merkle exclusion proof. Subsequent chunks
 *   then use transfer_private_with_creds instead of transfer_private,
 *   skipping per-chunk Merkle proof verification.
 *
 *   Energy savings: N workers → 1 proof instead of N proofs.
 *
 * State machine per run:
 *   validated → queued → acquiring_credentials → proving → partially_settled → settled
 *
 * State machine per chunk:
 *   pending → proving → broadcasting → settled | failed
 *
 * Retry rules:
 * - Transient failures (timeout, network): up to 3 retries with exponential backoff
 * - On-chain revert (double-pay, conflict): no retry; mark row as "conflict"
 * - Already settled chunks are skipped on retry
 *
 * Idempotency: each row has unique (agreement_id, epoch_id) on-chain guard.
 * batch_id + row_hash flow into every settlement proof.
 */

import type {
  PayrollRunManifest,
  PayrollRow,
  ChunkPlan,
  ChunkStatus,
  PayrollRunStatus,
} from "../manifest/types";
import type { BatchPayrollWorker } from "../lib/pnw-adapter/layer1_router";
import { LAYER1_TRANSITIONS } from "../lib/pnw-adapter/layer1_adapter";
import { PROGRAMS } from "../config/programs";
import {
  fetchFreezeListTree,
  buildExclusionProof,
  formatProofAsInputs,
} from "../lib/pnw-adapter/freeze_list_resolver";
import type { ExecutionResult, AdapterConfig } from "../lib/pnw-adapter/aleo_cli_adapter";
import { executeTransition } from "../lib/pnw-adapter/aleo_cli_adapter";
import type { WalletExecuteFn } from "../lib/wallet/wallet-executor";
import {
  executeAleoTransaction,
  pollTransactionStatus,
} from "../lib/wallet/wallet-executor";
import type { CredentialsRecord, ComplianceState, RosterCredentialsRecord, RosterState } from "../lib/pnw-adapter/sealance_types";
import {
  acquireCredentials,
  checkCredentialsValid,
} from "../lib/pnw-adapter/credentials_manager";
import {
  acquireRosterCredentialsFromManifest,
  checkRosterCredentialsValid,
} from "../lib/pnw-adapter/roster_credentials_manager";

// ----------------------------------------------------------------
// Configuration
// ----------------------------------------------------------------

const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 2000;
const DEFAULT_FEE = "500000"; // 0.5 credits

// ----------------------------------------------------------------
// Error classification
// ----------------------------------------------------------------

/** Errors that should NOT be retried (on-chain revert, double-pay, etc.) */
const NON_RETRYABLE_PATTERNS = [
  "already settled",
  "duplicate",
  "double pay",
  "conflict",
  "invalid state",
  "execution failed",
  "assert",
  "not equal",
  "insufficient balance",
  "record already spent",
];

function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return !NON_RETRYABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

// ----------------------------------------------------------------
// Callback types for Zustand store updates
// ----------------------------------------------------------------

export type CoordinatorCallbacks = {
  onRunStatusChange: (status: PayrollRunStatus) => void;
  onChunkUpdate: (chunks: ChunkPlan[]) => void;
  onRowUpdate: (rowIndex: number, status: PayrollRow["status"], txId?: string) => void;
  onComplete: () => void;
  onError: (message: string) => void;
  /** Called when freeze-list credentials are acquired or skipped */
  onCredentialsUpdate?: (state: ComplianceState | null) => void;
  /** Called when roster credentials are acquired or skipped */
  onRosterUpdate?: (state: RosterState | null) => void;
};

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/** Wallet-native transaction status polling function */
export type WalletStatusFn = (txId: string) => Promise<{
  status: string;
  transactionId?: string;
  error?: string;
}>;

export type SettlementContext = {
  manifest: PayrollRunManifest;
  chunks: ChunkPlan[];
  adapterConfig: AdapterConfig;
  callbacks: CoordinatorCallbacks;
  /** Optional wallet executor for E10 wallet-based settlement */
  walletExecute?: WalletExecuteFn;
  /** Optional wallet-native status polling (for wallet-internal tx IDs) */
  walletTransactionStatus?: WalletStatusFn;
  /** Pre-acquired freeze-list credentials (skip acquisition step) */
  credentials?: CredentialsRecord;
  /** Pre-acquired roster credentials (skip acquisition step) */
  rosterCredentials?: RosterCredentialsRecord;
  /** Employer's view key (needed for roster tree building) */
  viewKey?: string;
  /** Skip Sealance credentials acquisition (testnet — use base transfer path) */
  skipCredentials?: boolean;
  /** Wallet requestRecords function — needed to fetch USDCx Token records */
  requestRecords?: (programId: string, all?: boolean) => Promise<unknown[]>;
};

/**
 * Execute a full settlement run.
 *
 * Flow:
 * 1. Acquire freeze-list credentials (once, via wallet)
 * 2. Upgrade chunk transitions to _with_creds variants
 * 3. Process each chunk sequentially
 *
 * @returns The updated chunks array with final statuses
 */
export async function executeSettlement(ctx: SettlementContext): Promise<ChunkPlan[]> {
  const { manifest, callbacks } = ctx;
  const chunks = ctx.chunks.map((c) => ({ ...c })); // defensive copy

  callbacks.onRunStatusChange("queued");
  callbacks.onChunkUpdate(chunks);

  // ---- Step 1: Acquire credentials (if wallet is available) ----
  let credentials = ctx.credentials ?? null;

  if (!credentials && ctx.walletExecute && !ctx.skipCredentials) {
    callbacks.onRunStatusChange("proving"); // reuse "proving" for credentials phase
    callbacks.onCredentialsUpdate?.({
      status: "unchecked",
      proof: null,
      credentials: null,
      currentRoot: null,
      error: null,
    });

    const complianceState = await acquireCredentials(
      manifest.employer_addr,
      ctx.walletExecute,
    );

    callbacks.onCredentialsUpdate?.(complianceState);

    if (complianceState.status === "frozen") {
      callbacks.onRunStatusChange("failed");
      callbacks.onError(
        complianceState.error ?? "Employer address is on the compliance freeze list",
      );
      return chunks;
    }

    if (complianceState.status === "credentials_valid" && complianceState.credentials) {
      credentials = complianceState.credentials;
    }
    // If credentials acquisition failed, fall back to per-transfer proofs
    // (the original transfer_private path still works)
  }

  // ---- Step 1b: Acquire roster credentials (if wallet + viewKey available) ----
  let rosterCredentials = ctx.rosterCredentials ?? null;

  if (!rosterCredentials && ctx.walletExecute && credentials && !ctx.skipCredentials) {
    const manifestAgreementIds = manifest.rows.map((r) => r.agreement_id);

    callbacks.onRosterUpdate?.({
      status: "unchecked",
      tree: null,
      credentials: null,
      error: null,
    });

    const rosterState = await acquireRosterCredentialsFromManifest(
      manifest.employer_addr,
      manifestAgreementIds,
      ctx.walletExecute,
    );

    callbacks.onRosterUpdate?.(rosterState);

    if (rosterState.status === "valid" && rosterState.credentials) {
      rosterCredentials = rosterState.credentials;
      // Store roster_root on the manifest for audit trail
      (manifest as { roster_root?: string }).roster_root = rosterState.tree?.root;
    }
    // If roster acquisition failed, fall back to freeze-list creds only
  }

  // ---- Step 2: Upgrade transitions based on available credentials ----
  if (credentials && rosterCredentials) {
    // Best path: both freeze-list + roster credentials
    for (const chunk of chunks) {
      chunk.transition = upgradeToRosterTransition(chunk.transition);
    }
    callbacks.onChunkUpdate(chunks);
  } else if (credentials) {
    // Fallback: freeze-list credentials only
    for (const chunk of chunks) {
      chunk.transition = upgradeTransition(chunk.transition);
    }
    callbacks.onChunkUpdate(chunks);
  }

  // ---- Step 3: Execute chunks ----
  let hasFailure = false;
  let settledCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;

    // Skip already settled chunks (idempotency on retry)
    if (chunk.status === "settled") {
      settledCount++;
      continue;
    }

    // Check if credentials are still valid mid-run (root rotation)
    if (credentials && i > 0 && i % 5 === 0) {
      const stillValid = await checkCredentialsValid(credentials);
      if (!stillValid) {
        // Re-acquire credentials if root rotated
        if (ctx.walletExecute) {
          const refreshed = await acquireCredentials(
            manifest.employer_addr,
            ctx.walletExecute,
          );
          if (refreshed.status === "credentials_valid" && refreshed.credentials) {
            credentials = refreshed.credentials;
            callbacks.onCredentialsUpdate?.(refreshed);
          } else {
            // Downgrade remaining chunks to base path
            credentials = null;
            rosterCredentials = null;
            for (let j = i; j < chunks.length; j++) {
              chunks[j]!.transition = downgradeTransition(chunks[j]!.transition);
            }
            callbacks.onChunkUpdate(chunks);
            callbacks.onCredentialsUpdate?.(refreshed);
            callbacks.onRosterUpdate?.({
              status: "credentials_expired",
              tree: null,
              credentials: null,
              error: "Freeze-list credentials expired — roster credentials also invalidated",
            });
          }
        }
      }

      // Also check roster credentials if we have them
      if (rosterCredentials) {
        const rosterValid = await checkRosterCredentialsValid(rosterCredentials);
        if (!rosterValid) {
          rosterCredentials = null;
          // Downgrade from _with_roster to _with_creds
          for (let j = i; j < chunks.length; j++) {
            chunks[j]!.transition = downgradeFromRosterTransition(chunks[j]!.transition);
          }
          callbacks.onChunkUpdate(chunks);
          callbacks.onRosterUpdate?.({
            status: "credentials_expired",
            tree: null,
            credentials: null,
            error: "Roster root changed — falling back to freeze-list credentials only",
          });
        }
      }
    }

    // Update run status
    const runStatus: PayrollRunStatus =
      settledCount > 0 ? "partially_settled" : "proving";
    callbacks.onRunStatusChange(runStatus);

    // Execute chunk with retries
    const result = await executeChunkWithRetry(manifest, chunk, ctx, credentials, rosterCredentials);

    chunks[i] = result;
    callbacks.onChunkUpdate(chunks);

    if (result.status === "settled") {
      settledCount++;
      // Update row statuses
      for (const rowIdx of result.row_indices) {
        callbacks.onRowUpdate(rowIdx, "settled", result.tx_id);
      }
    } else if (result.status === "failed") {
      hasFailure = true;
      // Mark rows as failed or conflict
      const rowStatus = isConflictError(result.last_error)
        ? "conflict" as const
        : "failed" as const;
      for (const rowIdx of result.row_indices) {
        callbacks.onRowUpdate(rowIdx, rowStatus);
      }
    }
  }

  // Final run status
  if (settledCount === chunks.length) {
    callbacks.onRunStatusChange("settled");
    callbacks.onComplete();
  } else if (hasFailure) {
    callbacks.onRunStatusChange(settledCount > 0 ? "needs_retry" : "failed");
    callbacks.onError(
      `Settlement incomplete: ${settledCount}/${chunks.length} chunks settled`,
    );
  }

  return chunks;
}

/**
 * Retry a single failed chunk (operator intervention).
 * Used when a run is in "needs_retry" status.
 */
export async function retryChunk(
  ctx: SettlementContext,
  chunkIndex: number,
): Promise<ChunkPlan> {
  const chunk = ctx.chunks[chunkIndex];
  if (!chunk) throw new Error(`Invalid chunk index: ${chunkIndex}`);
  if (chunk.status === "settled") return chunk;

  // Reset for retry
  const resetChunk: ChunkPlan = {
    ...chunk,
    status: "pending",
    attempts: 0,
    last_error: undefined,
  };

  return executeChunkWithRetry(ctx.manifest, resetChunk, ctx, ctx.credentials ?? null, ctx.rosterCredentials ?? null);
}

// ----------------------------------------------------------------
// Internal: transition upgrade/downgrade
// ----------------------------------------------------------------

/** Upgrade a transition to use freeze-list credentials (skips per-transfer Merkle proof) */
function upgradeTransition(
  transition: ChunkPlan["transition"],
): ChunkPlan["transition"] {
  switch (transition) {
    case "execute_payroll":
      return "execute_payroll_with_creds";
    case "execute_payroll_batch_2":
      return "execute_payroll_batch_2_with_creds";
    default:
      return transition; // already upgraded
  }
}

/** Upgrade to roster transition (both freeze-list + roster credentials) */
function upgradeToRosterTransition(
  transition: ChunkPlan["transition"],
): ChunkPlan["transition"] {
  switch (transition) {
    case "execute_payroll":
    case "execute_payroll_with_creds":
      return "execute_payroll_with_roster";
    case "execute_payroll_batch_2":
    case "execute_payroll_batch_2_with_creds":
      return "execute_payroll_batch_2_with_roster";
    default:
      return transition; // already at roster level
  }
}

/** Downgrade a transition back to raw Merkle proof path (no credentials at all) */
function downgradeTransition(
  transition: ChunkPlan["transition"],
): ChunkPlan["transition"] {
  switch (transition) {
    case "execute_payroll_with_creds":
    case "execute_payroll_with_roster":
      return "execute_payroll";
    case "execute_payroll_batch_2_with_creds":
    case "execute_payroll_batch_2_with_roster":
      return "execute_payroll_batch_2";
    default:
      return transition; // already base
  }
}

/** Downgrade from roster to freeze-list-only credentials */
function downgradeFromRosterTransition(
  transition: ChunkPlan["transition"],
): ChunkPlan["transition"] {
  switch (transition) {
    case "execute_payroll_with_roster":
      return "execute_payroll_with_creds";
    case "execute_payroll_batch_2_with_roster":
      return "execute_payroll_batch_2_with_creds";
    default:
      return transition; // not a roster transition
  }
}

// ----------------------------------------------------------------
// Internal: chunk execution with retry logic
// ----------------------------------------------------------------

async function executeChunkWithRetry(
  manifest: PayrollRunManifest,
  chunk: ChunkPlan,
  ctx: SettlementContext,
  credentials: CredentialsRecord | null,
  rosterCredentials?: RosterCredentialsRecord | null,
): Promise<ChunkPlan> {
  let current = { ...chunk };

  while (current.attempts < MAX_RETRIES) {
    current.attempts++;
    current.status = "proving";
    ctx.callbacks.onChunkUpdate(
      ctx.chunks.map((c) => (c.chunk_index === current.chunk_index ? current : c)),
    );

    try {
      // Use wallet executor if available (E10), otherwise fall back to CLI adapter
      const result = ctx.walletExecute
        ? await executeChunkViaWallet(manifest, current, ctx.walletExecute, credentials, rosterCredentials ?? null, ctx.walletTransactionStatus, ctx.requestRecords)
        : await executeChunk(manifest, current, ctx.adapterConfig, credentials, rosterCredentials ?? null);

      current.status = "settled";
      current.tx_id = result.tx_id;
      current.last_error = undefined;

      return current;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      current.last_error = message;

      if (!isTransientError(error)) {
        // Non-retryable: mark as failed immediately
        current.status = "failed";
        return current;
      }

      // Transient: backoff and retry
      if (current.attempts < MAX_RETRIES) {
        const delay = BASE_BACKOFF_MS * Math.pow(2, current.attempts - 1);
        await sleep(delay);
      }
    }
  }

  // Exhausted retries
  current.status = "failed";
  return current;
}

// ----------------------------------------------------------------
// Internal: single chunk execution via wallet (E10 path)
// ----------------------------------------------------------------

async function executeChunkViaWallet(
  manifest: PayrollRunManifest,
  chunk: ChunkPlan,
  walletExecute: WalletExecuteFn,
  credentials: CredentialsRecord | null,
  rosterCredentials: RosterCredentialsRecord | null,
  walletTransactionStatus?: WalletStatusFn,
  requestRecords?: (programId: string, all?: boolean) => Promise<unknown[]>,
): Promise<ExecutionResult> {
  const workerArgs = chunk.row_indices.map((rowIdx) => {
    const row = manifest.rows[rowIdx];
    if (!row) throw new Error(`Row index ${rowIdx} not found in manifest`);
    return buildWorkerPayArgs(manifest, row);
  });

  const transitionName = chunk.transition;
  const transition = LAYER1_TRANSITIONS[transitionName];

  // For payroll transitions, we need to build full inputs:
  // execute_payroll(employer_usdcx: Token, employer_addr, employer_name_hash, w: WorkerPayArgs, merkle_proofs)
  const isPayrollTransition = transitionName.startsWith("execute_payroll");

  let inputs: string[];

  if (isPayrollTransition && requestRecords) {
    // Fetch USDCx Token records from wallet
    const usdcxProgram = PROGRAMS.external.usdcx;
    const records = await requestRecords(usdcxProgram, true);
    const tokenRecords = (records as Array<Record<string, unknown>>).filter(
      (r) => r.recordName === "Token" && !r.spent && typeof r.recordPlaintext === "string",
    );

    if (tokenRecords.length === 0) {
      throw new Error("No unspent USDCx Token records found in wallet. Fund the employer wallet with USDCx first.");
    }

    // Find a record with sufficient balance for all workers in this chunk
    const totalNeeded = workerArgs.reduce((sum, w) => sum + BigInt(w.net_amount), 0n);
    let selectedRecord: Record<string, unknown> | null = null;

    for (const rec of tokenRecords) {
      const plaintext = rec.recordPlaintext as string;
      const amountMatch = plaintext.match(/amount:\s*(\d+)u128/);
      if (amountMatch?.[1]) {
        const amount = BigInt(amountMatch[1]);
        if (amount >= totalNeeded) {
          selectedRecord = rec;
          break;
        }
      }
    }

    if (!selectedRecord) {
      throw new Error(
        `No USDCx Token record with sufficient balance. Need ${totalNeeded} minor units. ` +
        `Found ${tokenRecords.length} record(s) but none large enough.`,
      );
    }

    const tokenRecordInput = selectedRecord.recordPlaintext as string;
    console.log("[PNW-PAYROLL] Selected USDCx record:", tokenRecordInput.slice(0, 80) + "...");
    console.log("[PNW-PAYROLL] Total needed:", totalNeeded.toString(), "minor units");

    // Build inputs matching on-chain function signature:
    // execute_payroll(employer_usdcx, employer_addr, employer_name_hash, w, merkle_proofs)
    // employer_name_hash may be stored as hex — convert to decimal field
    const empNameHash = manifest.employer_name_hash.startsWith("0x")
      ? hexToDecimalField(manifest.employer_name_hash)
      : `${manifest.employer_name_hash}field`;

    inputs = [
      tokenRecordInput,
      manifest.employer_addr,
      empNameHash,
      serializeWorkerPayArgsAsStruct(workerArgs[0]!),
    ];

    // For batch_2, add second worker
    if (transitionName.includes("batch_2") && workerArgs.length > 1) {
      inputs.push(serializeWorkerPayArgsAsStruct(workerArgs[1]!));
    }

    // Merkle proofs: [test_usdcx_stablecoin.aleo/MerkleProof; 2]
    // Build real exclusion proofs from the on-chain freeze list tree
    console.log("[PNW-PAYROLL] Fetching freeze list tree...");
    const freezeTree = await fetchFreezeListTree();
    console.log("[PNW-PAYROLL] Freeze list tree:", { root: freezeTree.root, leaves: freezeTree.leaves.length, depth: freezeTree.depth });

    const exclusionProof = buildExclusionProof(manifest.employer_addr, freezeTree);
    const proofInputs = formatProofAsInputs(exclusionProof);
    // formatProofAsInputs returns [proofLow, proofHigh] — combine into array literal
    // Pad sibling paths to exactly 16 fields (on-chain MerkleProof has [field; 16])
    inputs.push(formatMerkleProofArray(exclusionProof));

    if (transitionName.includes("batch_2")) {
      inputs.push(formatMerkleProofArray(exclusionProof));
    }
  } else {
    // Non-payroll transitions or no requestRecords — use flat serialization
    inputs = serializeWorkerPayArgs(workerArgs, credentials, rosterCredentials);
  }

  console.log("[PNW-PAYROLL] Executing via wallet:", transition.program, transition.transition);
  console.log("[PNW-PAYROLL] Input count:", inputs.length);
  console.log("[PNW-PAYROLL] Inputs preview:", inputs.map((i, idx) => `[${idx}] ${String(i).slice(0, 60)}...`));

  const walletTxId = await executeAleoTransaction(
    walletExecute,
    transition.program,
    transition.transition,
    inputs,
    500_000, // 0.5 credits
  );

  // Wallet returns an internal ID (e.g. "shield_...") — need wallet-native polling
  // to get the real Aleo tx ID and confirmation status.
  const isWalletId = !walletTxId.startsWith("at1");

  let finalTxId = walletTxId;

  console.log("[PNW-PAYROLL] Post-execute:", { walletTxId, isWalletId, hasWalletStatus: !!walletTransactionStatus });

  if (isWalletId && walletTransactionStatus) {
    // Poll via wallet adapter until accepted/rejected
    const POLL_INTERVAL = 5_000;
    const POLL_TIMEOUT = 300_000; // 5 minutes
    const startTime = Date.now();
    console.log("[PNW-PAYROLL] Starting wallet-native polling for:", walletTxId);

    let pollCount = 0;
    while (Date.now() - startTime < POLL_TIMEOUT) {
      await sleep(POLL_INTERVAL);
      pollCount++;
      console.log(`[PNW-PAYROLL] Polling attempt ${pollCount}...`);
      try {
        const statusPromise = walletTransactionStatus(walletTxId);
        // Add 15s timeout to prevent hanging
        const status = await Promise.race([
          statusPromise,
          sleep(15_000).then(() => { throw new Error("Wallet status poll timed out after 15s"); }),
        ]) as Awaited<ReturnType<typeof walletTransactionStatus>>;
        console.log("[PNW-PAYROLL] Wallet poll response:", status);
        const s = status.status?.toLowerCase();

        if (status.transactionId && status.transactionId.startsWith("at1")) {
          finalTxId = status.transactionId;
        }

        if (s === "finalized" || s === "confirmed" || s === "accepted" || s === "completed") {
          return { tx_id: finalTxId, outputs: [], fee: "500000" };
        }

        if (s === "rejected" || s === "failed") {
          throw new Error(status.error ?? "Transaction rejected by network");
        }
      } catch (err) {
        if (err instanceof Error && (err.message.includes("rejected") || err.message.includes("failed"))) {
          throw err;
        }
        // Transient poll error — keep trying
      }
    }
    throw new Error("Transaction status unknown after wallet polling timeout");
  } else {
    // Standard REST polling (for at1... IDs or when no wallet status fn)
    console.log("[PNW-PAYROLL] Using REST polling (no wallet status fn or at1 ID):", walletTxId);
    const result = await pollTransactionStatus(walletTxId);
    console.log("[PNW-PAYROLL] REST poll result:", result);

    if (result.status === "rejected") {
      throw new Error(result.error ?? "Transaction rejected");
    }
    if (result.status === "unknown") {
      throw new Error(result.error ?? "Transaction status unknown after timeout");
    }

    return { tx_id: finalTxId, outputs: [], fee: "500000" };
  }
}

// ----------------------------------------------------------------
// Internal: single chunk execution (no retry)
// ----------------------------------------------------------------

async function executeChunk(
  manifest: PayrollRunManifest,
  chunk: ChunkPlan,
  config: AdapterConfig,
  credentials: CredentialsRecord | null,
  rosterCredentials: RosterCredentialsRecord | null,
): Promise<ExecutionResult> {
  // Build WorkerPayArgs for each row in the chunk
  const workerArgs = chunk.row_indices.map((rowIdx) => {
    const row = manifest.rows[rowIdx];
    if (!row) throw new Error(`Row index ${rowIdx} not found in manifest`);
    return buildWorkerPayArgs(manifest, row);
  });

  // Determine which transition to call
  const transitionName = chunk.transition;
  const transition = LAYER1_TRANSITIONS[transitionName];

  // Serialize inputs for the adapter
  const inputs = serializeWorkerPayArgs(workerArgs, credentials, rosterCredentials);

  return executeTransition(
    config,
    transition.program,
    transition.transition,
    inputs,
    DEFAULT_FEE,
  );
}

// ----------------------------------------------------------------
// Internal: build WorkerPayArgs from manifest row
// ----------------------------------------------------------------

function buildWorkerPayArgs(
  manifest: PayrollRunManifest,
  row: PayrollRow,
): BatchPayrollWorker {
  return {
    worker_addr: row.worker_addr,
    worker_name_hash: row.worker_name_hash,
    agreement_id: row.agreement_id,
    epoch_id: row.epoch_id,
    gross_amount: row.gross_amount,
    net_amount: row.net_amount,
    tax_withheld: row.tax_withheld,
    fee_amount: row.fee_amount,
    receipt_anchor: row.receipt_anchor,
    receipt_pair_hash: row.receipt_pair_hash,
    payroll_inputs_hash: row.payroll_inputs_hash,
    utc_time_hash: row.utc_time_hash,
    audit_event_hash: row.audit_event_hash,
    batch_id: manifest.batch_id,
    row_hash: row.row_hash,
  };
}

const MERKLE_TREE_DEPTH = 16; // On-chain MerkleProof has siblings: [field; 16]

const FIELD_MODULUS = 8444461749428370424248824938781546531375899335154063827935233455917409239041n;

/** Convert a hex string (with or without 0x prefix) to a decimal field string. */
function hexToDecimalField(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (!clean || clean === "0") return "0field";
  let value = 0n;
  for (let i = 0; i < clean.length; i += 2) {
    value = (value << 8n) | BigInt(parseInt(clean.slice(i, i + 2), 16));
  }
  return `${(value % FIELD_MODULUS).toString(10)}field`;
}

/** Convert a hex string to a [u8; 32] Aleo array literal. */
function hexToU8Array(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  // Pad to 32 bytes if needed
  while (bytes.length < 32) bytes.push(0);
  return "[ " + bytes.map(b => `${b}u8`).join(", ") + " ]";
}

/**
 * Format a FreezeListProof as an Aleo [MerkleProof; 2] array literal.
 * Pads sibling paths to exactly MERKLE_TREE_DEPTH (16) fields.
 */
function formatMerkleProofArray(proof: import("../lib/pnw-adapter/sealance_types").FreezeListProof): string {
  function formatSingle(p: import("../lib/pnw-adapter/sealance_types").MerkleSiblingPath): string {
    // Pad path to 16 siblings
    const padded = [...p.path];
    while (padded.length < MERKLE_TREE_DEPTH) {
      padded.push("0field");
    }
    const siblings = padded.slice(0, MERKLE_TREE_DEPTH).join(", ");
    return `{ siblings: [ ${siblings} ], leaf_index: ${p.leaf_index}u32 }`;
  }

  return `[ ${formatSingle(proof.proof_low)}, ${formatSingle(proof.proof_high)} ]`;
}

/**
 * Serialize a single WorkerPayArgs as an Aleo struct literal.
 * Used when passing the struct as a single input to the wallet adapter.
 */
function serializeWorkerPayArgsAsStruct(arg: BatchPayrollWorker): string {
  // worker_name_hash is a field — may be stored as hex or decimal
  const nameHash = arg.worker_name_hash.startsWith("0x")
    ? hexToDecimalField(arg.worker_name_hash)
    : `${arg.worker_name_hash}field`;

  return `{ worker_addr: ${arg.worker_addr}, worker_name_hash: ${nameHash}, agreement_id: ${hexToU8Array(arg.agreement_id)}, epoch_id: ${arg.epoch_id}u32, gross_amount: ${arg.gross_amount}u128, net_amount: ${arg.net_amount}u128, tax_withheld: ${arg.tax_withheld}u128, fee_amount: ${arg.fee_amount}u128, receipt_anchor: ${hexToU8Array(arg.receipt_anchor)}, receipt_pair_hash: ${hexToU8Array(arg.receipt_pair_hash)}, payroll_inputs_hash: ${hexToU8Array(arg.payroll_inputs_hash)}, utc_time_hash: ${hexToU8Array(arg.utc_time_hash)}, audit_event_hash: ${hexToU8Array(arg.audit_event_hash)}, batch_id: ${hexToU8Array(arg.batch_id)}, row_hash: ${hexToU8Array(arg.row_hash)} }`;
}

/**
 * Serialize WorkerPayArgs into Aleo input strings (flat, for CLI adapter).
 *
 * Credential stacking order (for _with_roster transitions):
 * 1. Worker pay args (per-worker fields)
 * 2. Freeze-list Credentials record (compliance)
 * 3. Roster Credentials record (authorization)
 *
 * For _with_creds transitions, only freeze-list credentials are appended.
 */
function serializeWorkerPayArgs(
  args: BatchPayrollWorker[],
  credentials: CredentialsRecord | null,
  rosterCredentials?: RosterCredentialsRecord | null,
): string[] {
  const inputs: string[] = [];

  for (const arg of args) {
    // Addresses and field elements pass through as-is
    inputs.push(arg.worker_addr);
    inputs.push(`${arg.worker_name_hash}field`);
    inputs.push(`${arg.agreement_id}field`);
    inputs.push(`${arg.epoch_id}u32`);
    inputs.push(`${arg.gross_amount}u128`);
    inputs.push(`${arg.net_amount}u128`);
    inputs.push(`${arg.tax_withheld}u128`);
    inputs.push(`${arg.fee_amount}u128`);
    inputs.push(`${arg.receipt_anchor}field`);
    inputs.push(`${arg.receipt_pair_hash}field`);
    inputs.push(`${arg.payroll_inputs_hash}field`);
    inputs.push(`${arg.utc_time_hash}field`);
    inputs.push(`${arg.audit_event_hash}field`);
    inputs.push(`${arg.batch_id}field`);
    inputs.push(`${arg.row_hash}field`);
  }

  // Append freeze-list credentials for _with_creds and _with_roster transitions
  if (credentials) {
    inputs.push(serializeCredentials(credentials));
  }

  // Append roster credentials for _with_roster transitions
  if (rosterCredentials) {
    inputs.push(serializeRosterCredentials(rosterCredentials));
  }

  return inputs;
}

/**
 * Serialize a Credentials record as an Aleo record input string.
 * The wallet provides the record ciphertext; we pass it through.
 */
function serializeCredentials(credentials: CredentialsRecord): string {
  // If we have the raw record ciphertext from the wallet, use it directly
  if (credentials._record_ciphertext) {
    return credentials._record_ciphertext;
  }

  // Otherwise, construct the record literal
  return `{ owner: ${credentials.owner}, freeze_list_root: ${credentials.freeze_list_root}field }`;
}

/**
 * Serialize a RosterCredentials record as an Aleo record input string.
 */
function serializeRosterCredentials(rosterCredentials: RosterCredentialsRecord): string {
  if (rosterCredentials._record_ciphertext) {
    return rosterCredentials._record_ciphertext;
  }

  return `{ owner: ${rosterCredentials.owner}, roster_root: ${rosterCredentials.roster_root}field }`;
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function isConflictError(message?: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return NON_RETRYABLE_PATTERNS.some((p) => lower.includes(p));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
