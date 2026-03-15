/**
 * Settlement Coordinator
 *
 * Drives chunk-by-chunk on-chain settlement for a compiled PayrollRunManifest.
 * Each chunk maps to one adapter execution call (execute_payroll or
 * execute_payroll_batch_2).
 *
 * State machine per run:
 *   validated → queued → proving → partially_settled → settled
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
};

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

export type SettlementContext = {
  manifest: PayrollRunManifest;
  chunks: ChunkPlan[];
  adapterConfig: AdapterConfig;
  callbacks: CoordinatorCallbacks;
};

/**
 * Execute a full settlement run.
 *
 * Processes each chunk sequentially. Settled chunks are skipped.
 * Failed chunks are retried up to MAX_RETRIES times with exponential backoff.
 *
 * @returns The updated chunks array with final statuses
 */
export async function executeSettlement(ctx: SettlementContext): Promise<ChunkPlan[]> {
  const { manifest, callbacks } = ctx;
  const chunks = ctx.chunks.map((c) => ({ ...c })); // defensive copy

  callbacks.onRunStatusChange("queued");
  callbacks.onChunkUpdate(chunks);

  let hasFailure = false;
  let settledCount = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;

    // Skip already settled chunks (idempotency on retry)
    if (chunk.status === "settled") {
      settledCount++;
      continue;
    }

    // Update run status
    const runStatus: PayrollRunStatus =
      settledCount > 0 ? "partially_settled" : "proving";
    callbacks.onRunStatusChange(runStatus);

    // Execute chunk with retries
    const result = await executeChunkWithRetry(manifest, chunk, ctx);

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

  return executeChunkWithRetry(ctx.manifest, resetChunk, ctx);
}

// ----------------------------------------------------------------
// Internal: chunk execution with retry logic
// ----------------------------------------------------------------

async function executeChunkWithRetry(
  manifest: PayrollRunManifest,
  chunk: ChunkPlan,
  ctx: SettlementContext,
): Promise<ChunkPlan> {
  let current = { ...chunk };

  while (current.attempts < MAX_RETRIES) {
    current.attempts++;
    current.status = "proving";
    ctx.callbacks.onChunkUpdate(
      ctx.chunks.map((c) => (c.chunk_index === current.chunk_index ? current : c)),
    );

    try {
      const result = await executeChunk(manifest, current, ctx.adapterConfig);

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
// Internal: single chunk execution (no retry)
// ----------------------------------------------------------------

async function executeChunk(
  manifest: PayrollRunManifest,
  chunk: ChunkPlan,
  config: AdapterConfig,
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
  const inputs = serializeWorkerPayArgs(workerArgs);

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
 * Each field is formatted as its Aleo type representation.
 */
function serializeWorkerPayArgs(args: BatchPayrollWorker[]): string[] {
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

  return inputs;
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
