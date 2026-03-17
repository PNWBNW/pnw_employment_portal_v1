/**
 * Wallet Execution Bridge — submits real transactions via the wallet adapter
 * and polls for confirmation on the Aleo network.
 *
 * This is the primary E10 execution path. It replaces the stub in
 * aleo_cli_adapter.ts for all wallet-connected flows.
 *
 * Pattern: pure functions that accept wallet methods as params (same as
 * credential-signer.ts). No React imports — see useTransactionExecutor.ts
 * for the React hook wrapper.
 */

import { ENV } from "@/src/config/env";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export type TransactionStatus =
  | "pending"     // submitted, not yet confirmed
  | "confirmed"   // included in a block
  | "rejected"    // explicitly rejected by the network
  | "unknown";    // status check failed / ambiguous

export type TransactionResult = {
  txId: string;
  status: TransactionStatus;
  blockHeight?: number;
  error?: string;
};

/** Error that should be retried (network timeout, etc.) */
export class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransientError";
  }
}

/** Error that should NOT be retried (on-chain revert, invalid input, etc.) */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}

// ----------------------------------------------------------------
// Non-retryable error patterns
// ----------------------------------------------------------------

const PERMANENT_PATTERNS = [
  "already settled",
  "duplicate",
  "double pay",
  "conflict",
  "invalid state",
  "insufficient balance",
  "record already spent",
  "rejected",
  "user rejected",
  "user denied",
  "cancelled",
];

function classifyError(error: unknown): TransientError | PermanentError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (PERMANENT_PATTERNS.some((p) => lower.includes(p))) {
    return new PermanentError(message);
  }
  return new TransientError(message);
}

// ----------------------------------------------------------------
// Transaction execution
// ----------------------------------------------------------------

/**
 * The wallet adapter's executeTransaction interface.
 * Matches @provablehq/aleo-types TransactionOptions.
 */
export type WalletExecuteFn = (params: {
  program: string;
  function: string;
  inputs: string[];
  fee: number;
}) => Promise<string>; // returns transaction ID

/**
 * Execute an Aleo transaction via the connected wallet.
 *
 * @param execute - The wallet adapter's execute function
 * @param programId - e.g. "pnw_name_registry.aleo"
 * @param functionName - e.g. "register_worker_name"
 * @param inputs - Aleo-formatted input strings
 * @param fee - Fee in microcredits (e.g. 500_000 = 0.5 credits)
 * @returns Transaction ID string
 */
export async function executeAleoTransaction(
  execute: WalletExecuteFn,
  programId: string,
  functionName: string,
  inputs: string[],
  fee: number = 500_000,
): Promise<string> {
  try {
    const txId = await execute({
      program: programId,
      function: functionName,
      inputs,
      fee,
    });
    return txId;
  } catch (error) {
    throw classifyError(error);
  }
}

// ----------------------------------------------------------------
// Transaction status polling
// ----------------------------------------------------------------

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_DURATION_MS = 120_000; // 2 minutes

/**
 * Poll the Aleo REST API for transaction confirmation.
 * Uses exponential backoff starting at 3s, capped at 15s intervals.
 *
 * @param txId - The transaction ID to poll
 * @param onStatusChange - Optional callback for status updates
 * @returns Final transaction result
 */
export async function pollTransactionStatus(
  txId: string,
  onStatusChange?: (status: TransactionStatus) => void,
): Promise<TransactionResult> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const startTime = Date.now();
  let interval = POLL_INTERVAL_MS;

  onStatusChange?.("pending");

  while (Date.now() - startTime < MAX_POLL_DURATION_MS) {
    await sleep(interval);

    try {
      const url = `${endpoint}/transaction/${txId}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        const data: unknown = await response.json();
        if (data && typeof data === "object") {
          const tx = data as Record<string, unknown>;

          // Transaction found in a block → confirmed
          if (tx.status === "accepted" || tx.type || tx.id) {
            const blockHeight =
              typeof tx.block_height === "number"
                ? tx.block_height
                : undefined;

            onStatusChange?.("confirmed");
            return {
              txId,
              status: "confirmed",
              blockHeight: blockHeight ?? undefined,
            };
          }

          // Explicitly rejected
          if (tx.status === "rejected") {
            onStatusChange?.("rejected");
            return {
              txId,
              status: "rejected",
              error: typeof tx.error === "string" ? tx.error : "Transaction rejected",
            };
          }
        }
      }

      // 404 = not yet indexed, keep polling
      if (response.status === 404) {
        // Still pending
      }
    } catch (pollError) {
      // Network error during poll — log it but keep trying
      console.warn(
        `[wallet-executor] Poll error for tx ${txId}:`,
        pollError instanceof Error ? pollError.message : String(pollError),
      );
    }

    // Exponential backoff capped at 15s
    interval = Math.min(interval * 1.5, 15_000);
  }

  // Timed out
  onStatusChange?.("unknown");
  return {
    txId,
    status: "unknown",
    error: "Transaction status check timed out after 2 minutes",
  };
}

// ----------------------------------------------------------------
// Convenience: execute + poll
// ----------------------------------------------------------------

/**
 * Execute a transaction and wait for confirmation.
 * Returns the full result with status.
 */
export async function executeAndConfirm(
  execute: WalletExecuteFn,
  programId: string,
  functionName: string,
  inputs: string[],
  fee?: number,
  onStatusChange?: (status: TransactionStatus) => void,
): Promise<TransactionResult> {
  const txId = await executeAleoTransaction(
    execute,
    programId,
    functionName,
    inputs,
    fee,
  );

  return pollTransactionStatus(txId, onStatusChange);
}

// ----------------------------------------------------------------
// Mapping query helper
// ----------------------------------------------------------------

/**
 * Query an on-chain mapping value.
 * Reusable utility for checking verification status, name ownership, etc.
 */
export async function queryMapping(
  programId: string,
  mappingName: string,
  key: string,
): Promise<string | null> {
  const endpoint = ENV.ALEO_ENDPOINT;

  try {
    const url = `${endpoint}/program/${programId}/mapping/${mappingName}/${key}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data === "string") {
      return data.replace(/\.(private|public)$/, "").trim();
    }
    return null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
