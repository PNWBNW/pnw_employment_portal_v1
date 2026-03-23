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
import { pluginRegistry } from "../plugins/registry";

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

export type SettlementContext = {
  manifest: PayrollRunManifest;
  chunks: ChunkPlan[];
  adapterConfig: AdapterConfig;
  callbacks: CoordinatorCallbacks;
  /** Optional wallet executor for E10 wallet-based settlement */
  walletExecute?: WalletExecuteFn;
  /** Pre-acquired freeze-list credentials (skip acquisition step) */
  credentials?: CredentialsRecord;
  /** Pre-acquired roster credentials (skip acquisition step) */
  rosterCredentials?: RosterCredentialsRecord;
  /** Employer's view key (needed for roster tree building) */
  viewKey?: string;
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

  if (!credentials && ctx.walletExecute) {
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

  if (!rosterCredentials && ctx.walletExecute && credentials) {
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
    void pluginRegistry.emit("onRunComplete", {
      manifest,
      settled_count: settledCount,
      failed_count: chunks.length - settledCount,
    });
  } else if (hasFailure) {
    callbacks.onRunStatusChange(settledCount > 0 ? "needs_retry" : "failed");
    callbacks.onError(
      `Settlement incomplete: ${settledCount}/${chunks.length} chunks settled`,
    );
    void pluginRegistry.emit("onRunFailed", {
      manifest,
      error: `Settlement incomplete: ${settledCount}/${chunks.length} chunks settled`,
    });
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

    void pluginRegistry.emit("onChunkSettleStart", {
      manifest,
      chunk: current,
      attempt: current.attempts,
    });

    try {
      // Use wallet executor if available (E10), otherwise fall back to CLI adapter
      const result = ctx.walletExecute
        ? await executeChunkViaWallet(manifest, current, ctx.walletExecute, credentials, rosterCredentials ?? null)
        : await executeChunk(manifest, current, ctx.adapterConfig, credentials, rosterCredentials ?? null);

      current.status = "settled";
      current.tx_id = result.tx_id;
      current.last_error = undefined;

      void pluginRegistry.emit("onChunkSettleSuccess", {
        manifest,
        chunk: current,
        tx_id: result.tx_id,
      });

      return current;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      current.last_error = message;

      void pluginRegistry.emit("onChunkSettleFailure", {
        manifest,
        chunk: current,
        error: message,
        attempt: current.attempts,
        will_retry: isTransientError(error) && current.attempts < MAX_RETRIES,
      });

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
): Promise<ExecutionResult> {
  const workerArgs = chunk.row_indices.map((rowIdx) => {
    const row = manifest.rows[rowIdx];
    if (!row) throw new Error(`Row index ${rowIdx} not found in manifest`);
    return buildWorkerPayArgs(manifest, row);
  });

  const transitionName = chunk.transition;
  const transition = LAYER1_TRANSITIONS[transitionName];
  const inputs = serializeWorkerPayArgs(workerArgs, credentials, rosterCredentials);

  const txId = await executeAleoTransaction(
    walletExecute,
    transition.program,
    transition.transition,
    inputs,
    500_000, // 0.5 credits
  );

  const result = await pollTransactionStatus(txId);

  if (result.status === "rejected") {
    throw new Error(result.error ?? "Transaction rejected");
  }

  if (result.status === "unknown") {
    throw new Error(result.error ?? "Transaction status unknown after timeout");
  }

  return {
    tx_id: txId,
    outputs: [],
    fee: "500000",
  };
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

/**
 * Serialize WorkerPayArgs into Aleo input strings.
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
