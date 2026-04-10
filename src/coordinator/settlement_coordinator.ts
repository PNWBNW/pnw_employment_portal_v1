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
import { SealanceMerkleTree } from "@provablehq/sdk";
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
  /** Called when the sequential payroll advances to a new step (for UI updates) */
  onStepChange?: (step: PayrollStep) => void;
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
        ? await executeChunkViaWallet(manifest, current, ctx.walletExecute, credentials, rosterCredentials ?? null, ctx.walletTransactionStatus, ctx.requestRecords, ctx.adapterConfig.endpoint, ctx.onStepChange)
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

/**
 * Sequential payroll step descriptors — each is one wallet signature.
 * Shield wallet can't handle execute_payroll (5 cross-program calls in one proof),
 * so we call each sub-function as its own transaction.
 */
export type PayrollStep = {
  stepNumber: number;
  totalSteps: number;
  label: string;
  program: string;
  functionName: string;
};

export const PAYROLL_STEPS: Omit<PayrollStep, "stepNumber" | "totalSteps">[] = [
  {
    label: "Verify Employment Agreement",
    program: "employer_agreement_v4.aleo",
    functionName: "assert_agreement_active",
  },
  {
    label: "Transfer USDCx to Worker",
    program: "test_usdcx_stablecoin.aleo",
    functionName: "transfer_private",
  },
  {
    label: "Mint Payroll Receipts",
    program: "paystub_receipts.aleo",
    functionName: "mint_paystub_receipts",
  },
  {
    label: "Anchor Audit Event",
    program: "payroll_audit_log.aleo",
    functionName: "anchor_event",
  },
];

async function executeChunkViaWallet(
  manifest: PayrollRunManifest,
  chunk: ChunkPlan,
  walletExecute: WalletExecuteFn,
  credentials: CredentialsRecord | null,
  rosterCredentials: RosterCredentialsRecord | null,
  walletTransactionStatus?: WalletStatusFn,
  requestRecords?: (programId: string, all?: boolean) => Promise<unknown[]>,
  endpoint?: string,
  onStepChange?: (step: PayrollStep) => void,
): Promise<ExecutionResult> {
  const workerArgs = chunk.row_indices.map((rowIdx) => {
    const row = manifest.rows[rowIdx];
    if (!row) throw new Error(`Row index ${rowIdx} not found in manifest`);
    return buildWorkerPayArgs(manifest, row);
  });

  const transitionName = chunk.transition;
  const transition = LAYER1_TRANSITIONS[transitionName];

  // Sequential payroll: Shield can't handle execute_payroll's 4 cross-program
  // calls in one proof. Split into individual transactions that Shield has
  // proven capable of (e.g. transfer_private alone works).
  const isPayrollTransition = transitionName.startsWith("execute_payroll");

  if (isPayrollTransition && requestRecords && workerArgs.length > 0) {
    console.log("[PNW-PAYROLL] ===== Starting SEQUENTIAL payroll execution =====");
    return executeSequentialPayroll(
      manifest,
      workerArgs[0]!,
      walletExecute,
      walletTransactionStatus,
      requestRecords,
      endpoint,
      onStepChange,
    );
  }

  let inputs: string[];

  if (isPayrollTransition && requestRecords) {
    // Monolithic execute_payroll path: fetch USDCx Token record + build full inputs
    const usdcxProgram = PROGRAMS.external.usdcx;
    const records = await requestRecords(usdcxProgram, true);
    const tokenRecords = (records as Array<Record<string, unknown>>).filter(
      (r) => r.recordName === "Token" && !r.spent && typeof r.recordPlaintext === "string",
    );

    if (tokenRecords.length === 0) {
      throw new Error("No unspent USDCx Token records found in wallet.");
    }

    const totalNeeded = workerArgs.reduce((sum, w) => sum + BigInt(w.net_amount), 0n);
    let selectedRecord: Record<string, unknown> | null = null;
    for (const rec of tokenRecords) {
      const plaintext = rec.recordPlaintext as string;
      const amountMatch = plaintext.match(/amount:\s*(\d+)u128/);
      if (amountMatch?.[1] && BigInt(amountMatch[1]) >= totalNeeded) {
        selectedRecord = rec;
        break;
      }
    }
    if (!selectedRecord) {
      throw new Error(`No USDCx Token record with sufficient balance (need ${totalNeeded} minor units)`);
    }

    const tokenRecordInput = selectedRecord.recordPlaintext as string;
    console.log("[PNW-PAYROLL] Selected USDCx record:", tokenRecordInput.slice(0, 80) + "...");
    console.log("[PNW-PAYROLL] Total needed:", totalNeeded.toString(), "minor units");

    const empNameHash = manifest.employer_name_hash.startsWith("0x")
      ? hexToDecimalField(manifest.employer_name_hash)
      : `${manifest.employer_name_hash}field`;

    inputs = [
      tokenRecordInput,
      manifest.employer_addr,
      empNameHash,
      serializeWorkerPayArgsAsStruct(workerArgs[0]!),
    ];
    if (transitionName.includes("batch_2") && workerArgs.length > 1) {
      inputs.push(serializeWorkerPayArgsAsStruct(workerArgs[1]!));
    }

    // Generate Sealance Merkle exclusion proof
    console.log("[PNW-PAYROLL] Generating Sealance Merkle exclusion proof...");
    const sealance = new SealanceMerkleTree();
    const frozenAddresses = await fetchFreezeListAddresses(endpoint ?? "https://api.explorer.provable.com/v2/testnet");
    const TREE_DEPTH = 15;
    const leaves = sealance.generateLeaves(frozenAddresses, TREE_DEPTH);
    const tree = sealance.buildTree(leaves);
    const [leftIdx, rightIdx] = sealance.getLeafIndices(tree, manifest.employer_addr);
    const proofLeft = sealance.getSiblingPath(tree, leftIdx, TREE_DEPTH);
    const proofRight = sealance.getSiblingPath(tree, rightIdx, TREE_DEPTH);
    const formattedProof = sealance.formatMerkleProof([proofLeft, proofRight]);
    inputs.push(formattedProof);
    if (transitionName.includes("batch_2")) {
      inputs.push(formattedProof);
    }
  } else {
    // Non-payroll transitions use flat serialization
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
    // Adaptive polling intervals:
    // - First 30s: poll every 1s (catch fast state transitions)
    // - 30s-2min: poll every 3s
    // - 2min+: poll every 5s
    const POLL_TIMEOUT = 900_000; // 15 minutes
    const startTime = Date.now();
    console.log("[PNW-PAYROLL] Starting wallet-native polling for:", walletTxId);

    let pollCount = 0;
    let lastStatusSnapshot = "";
    while (Date.now() - startTime < POLL_TIMEOUT) {
      const elapsed = Date.now() - startTime;
      const interval = elapsed < 30_000 ? 1_000 : elapsed < 120_000 ? 3_000 : 5_000;
      await sleep(interval);
      pollCount++;

      try {
        const statusPromise = walletTransactionStatus(walletTxId);
        const status = await Promise.race([
          statusPromise,
          sleep(20_000).then(() => { throw new Error("Wallet status poll timed out after 20s"); }),
        ]) as Awaited<ReturnType<typeof walletTransactionStatus>>;

        // Log the FULL raw response (stringified) to catch any extra fields
        const snapshot = JSON.stringify(status);
        if (snapshot !== lastStatusSnapshot) {
          console.log(`[PNW-PAYROLL] Poll ${pollCount} (${Math.round(elapsed / 1000)}s) NEW STATUS:`, status);
          console.log(`[PNW-PAYROLL] Full response keys:`, Object.keys(status || {}));
          lastStatusSnapshot = snapshot;
        } else if (pollCount === 1 || pollCount % 20 === 0) {
          console.log(`[PNW-PAYROLL] Poll ${pollCount} (${Math.round(elapsed / 1000)}s) unchanged:`, status);
        }

        const s = status.status?.toLowerCase();

        if (status.transactionId && status.transactionId.startsWith("at1")) {
          finalTxId = status.transactionId;
          console.log("[PNW-PAYROLL] Got real Aleo tx ID:", finalTxId);
        }

        if (s === "finalized" || s === "confirmed" || s === "accepted" || s === "completed") {
          return { tx_id: finalTxId, outputs: [], fee: "500000" };
        }

        if (s === "rejected" || s === "failed") {
          throw new Error(status.error ?? "Transaction rejected by network");
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const shouldLog = pollCount <= 3 || pollCount % 30 === 0;
        const isNotFound = errMsg.toLowerCase().includes("not found");

        if (shouldLog) {
          console.log(`[PNW-PAYROLL] Poll ${pollCount} (${Math.round((Date.now() - startTime) / 1000)}s) error: ${errMsg}`);
          if (err instanceof Error && err.stack && pollCount <= 3) {
            console.log(`[PNW-PAYROLL] Error stack:`, err.stack.slice(0, 300));
          }
        }

        if (!isNotFound && !shouldLog) {
          console.warn(`[PNW-PAYROLL] Poll attempt ${pollCount} error:`, errMsg);
        } else if (pollCount <= 3 || pollCount % 10 === 0) {
          console.log(`[PNW-PAYROLL] Poll ${pollCount}: proof still building (this can take 2-5 min)...`);
        }
        if (err instanceof Error && (errMsg.includes("rejected") || errMsg.includes("failed"))) {
          throw err;
        }
      }

      // Every 10 polls, also check the REST API to see if ANY new payroll tx
      // landed on-chain (Shield's transactionStatus may not report it).
      // This is a fallback in case the wallet ID polling is broken.
      if (pollCount % 10 === 0 && endpoint) {
        try {
          // Check the paid_epoch mapping — if our epoch appears, we're done
          const row = manifest.rows[chunk.row_indices[0]!];
          if (row) {
            const epochKey = `{ agreement_id: ${hexToU8Array(row.agreement_id)}, epoch_id: ${row.epoch_id}u32 }`;
            const encodedKey = encodeURIComponent(epochKey);
            const paidUrl = `${endpoint}/program/payroll_core_v2.aleo/mapping/paid_epoch/${encodedKey}`;
            const paidResp = await fetch(paidUrl, {
              headers: { Accept: "application/json" },
              signal: AbortSignal.timeout(5_000),
            });
            if (paidResp.ok) {
              const paidData = await paidResp.text();
              console.log(`[PNW-PAYROLL] REST check paid_epoch: ${paidData}`);
              if (paidData.includes("true")) {
                console.log("[PNW-PAYROLL] Payroll confirmed on-chain via REST check!");
                return { tx_id: finalTxId, outputs: [], fee: "500000" };
              }
            }
          }
        } catch (restErr) {
          // REST check is best-effort, don't fail the run
          if (pollCount <= 10) {
            console.log(`[PNW-PAYROLL] REST fallback check error:`, restErr instanceof Error ? restErr.message : restErr);
          }
        }
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
// Sequential payroll execution (4 wallet signatures, one per step)
// ----------------------------------------------------------------

async function executeSequentialPayroll(
  manifest: PayrollRunManifest,
  worker: BatchPayrollWorker,
  walletExecute: WalletExecuteFn,
  walletTransactionStatus: WalletStatusFn | undefined,
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  endpoint: string | undefined,
  onStepChange: ((step: PayrollStep) => void) | undefined,
): Promise<ExecutionResult> {
  const TOTAL = PAYROLL_STEPS.length;
  const results: string[] = [];

  // Pre-fetch the USDCx Token record (needed for step 2)
  console.log("[PNW-PAYROLL] Fetching USDCx Token records...");
  const records = await requestRecords(PROGRAMS.external.usdcx, true);
  const tokenRecords = (records as Array<Record<string, unknown>>).filter(
    (r) => r.recordName === "Token" && !r.spent && typeof r.recordPlaintext === "string",
  );
  if (tokenRecords.length === 0) {
    throw new Error("No unspent USDCx Token records found in wallet. Fund the employer wallet with USDCx first.");
  }

  const needed = BigInt(worker.net_amount);
  let selectedRecord: Record<string, unknown> | null = null;
  for (const rec of tokenRecords) {
    const plaintext = rec.recordPlaintext as string;
    const amountMatch = plaintext.match(/amount:\s*(\d+)u128/);
    if (amountMatch?.[1] && BigInt(amountMatch[1]) >= needed) {
      selectedRecord = rec;
      break;
    }
  }
  if (!selectedRecord) {
    throw new Error(`No USDCx Token record with sufficient balance for ${needed} minor units`);
  }
  const tokenRecordInput = selectedRecord.recordPlaintext as string;

  // Pre-generate Merkle proof (needed for step 2)
  console.log("[PNW-PAYROLL] Generating Sealance Merkle exclusion proof...");
  const sealance = new SealanceMerkleTree();
  const frozenAddresses = await fetchFreezeListAddresses(
    endpoint ?? "https://api.explorer.provable.com/v2/testnet",
  );
  const TREE_DEPTH = 15;
  const leaves = sealance.generateLeaves(frozenAddresses, TREE_DEPTH);
  const tree = sealance.buildTree(leaves);
  const [leftIdx, rightIdx] = sealance.getLeafIndices(tree, manifest.employer_addr);
  const proofLeft = sealance.getSiblingPath(tree, leftIdx, TREE_DEPTH);
  const proofRight = sealance.getSiblingPath(tree, rightIdx, TREE_DEPTH);
  const formattedProof = sealance.formatMerkleProof([proofLeft, proofRight]);

  const employerNameHashField = manifest.employer_name_hash.startsWith("0x")
    ? hexToDecimalField(manifest.employer_name_hash)
    : `${manifest.employer_name_hash}field`;
  const workerNameHashField = worker.worker_name_hash.startsWith("0x")
    ? hexToDecimalField(worker.worker_name_hash)
    : `${worker.worker_name_hash}field`;

  // ----- Step 1: Verify Employment Agreement -----
  const step1: PayrollStep = { ...PAYROLL_STEPS[0]!, stepNumber: 1, totalSteps: TOTAL };
  onStepChange?.(step1);
  console.log(`[PNW-PAYROLL] === Step 1/${TOTAL}: ${step1.label} ===`);
  const tx1 = await executeSingleStep(
    walletExecute,
    walletTransactionStatus,
    step1.program,
    step1.functionName,
    [hexToU8Array(worker.agreement_id)],
    500_000,
    step1.label,
  );
  results.push(tx1);

  // ----- Step 2: Transfer USDCx to Worker -----
  const step2: PayrollStep = { ...PAYROLL_STEPS[1]!, stepNumber: 2, totalSteps: TOTAL };
  onStepChange?.(step2);
  console.log(`[PNW-PAYROLL] === Step 2/${TOTAL}: ${step2.label} ===`);
  const tx2 = await executeSingleStep(
    walletExecute,
    walletTransactionStatus,
    step2.program,
    step2.functionName,
    [
      worker.worker_addr,
      `${worker.net_amount}u128`,
      tokenRecordInput,
      formattedProof,
    ],
    500_000,
    step2.label,
  );
  results.push(tx2);

  // ----- Step 3: Mint Paystub Receipts -----
  const step3: PayrollStep = { ...PAYROLL_STEPS[2]!, stepNumber: 3, totalSteps: TOTAL };
  onStepChange?.(step3);
  console.log(`[PNW-PAYROLL] === Step 3/${TOTAL}: ${step3.label} ===`);
  const tx3 = await executeSingleStep(
    walletExecute,
    walletTransactionStatus,
    step3.program,
    step3.functionName,
    [
      worker.worker_addr,                        // r0: worker address
      manifest.employer_addr,                    // r1: employer address
      workerNameHashField,                       // r2: worker_name_hash field
      employerNameHashField,                     // r3: employer_name_hash field
      hexToU8Array(worker.agreement_id),         // r4: agreement_id
      `${worker.epoch_id}u32`,                   // r5: epoch_id
      `${worker.gross_amount}u128`,              // r6: gross
      `${worker.net_amount}u128`,                // r7: net
      `${worker.tax_withheld}u128`,              // r8: tax
      `${worker.fee_amount}u128`,                // r9: fee
      hexToU8Array(worker.payroll_inputs_hash),  // r10: payroll_inputs_hash
      hexToU8Array(worker.receipt_anchor),       // r11: receipt_anchor
      hexToU8Array(worker.receipt_pair_hash),    // r12: receipt_pair_hash
      hexToU8Array(worker.utc_time_hash),        // r13: utc_time_hash
    ],
    500_000,
    step3.label,
  );
  results.push(tx3);

  // ----- Step 4: Anchor Audit Event -----
  const step4: PayrollStep = { ...PAYROLL_STEPS[3]!, stepNumber: 4, totalSteps: TOTAL };
  onStepChange?.(step4);
  console.log(`[PNW-PAYROLL] === Step 4/${TOTAL}: ${step4.label} ===`);
  const tx4 = await executeSingleStep(
    walletExecute,
    walletTransactionStatus,
    step4.program,
    step4.functionName,
    [hexToU8Array(worker.audit_event_hash)],
    500_000,
    step4.label,
  );
  results.push(tx4);

  console.log("[PNW-PAYROLL] ===== Sequential payroll COMPLETE =====");
  console.log("[PNW-PAYROLL] All 4 transaction IDs:", results);

  return {
    tx_id: results[results.length - 1]!, // return last tx id as the chunk's canonical id
    outputs: [],
    fee: "2000000", // 0.5 credits × 4 steps
  };
}

/**
 * Execute a single Aleo transition and wait for it to confirm.
 * Shared polling logic used by each step of executeSequentialPayroll.
 */
async function executeSingleStep(
  walletExecute: WalletExecuteFn,
  walletTransactionStatus: WalletStatusFn | undefined,
  programId: string,
  functionName: string,
  inputs: string[],
  fee: number,
  label: string,
): Promise<string> {
  console.log(`[PNW-STEP] ${label}: submitting to wallet...`);
  const walletTxId = await executeAleoTransaction(walletExecute, programId, functionName, inputs, fee);
  console.log(`[PNW-STEP] ${label}: wallet returned ${walletTxId}`);

  if (!walletTxId.startsWith("at1") && walletTransactionStatus) {
    const POLL_TIMEOUT = 600_000; // 10 minutes per step
    const startTime = Date.now();
    let pollCount = 0;
    let finalTxId = walletTxId;

    while (Date.now() - startTime < POLL_TIMEOUT) {
      const elapsed = Date.now() - startTime;
      const interval = elapsed < 30_000 ? 2_000 : 5_000;
      await sleep(interval);
      pollCount++;

      try {
        const status = await Promise.race([
          walletTransactionStatus(walletTxId),
          sleep(20_000).then(() => { throw new Error("poll timeout 20s"); }),
        ]) as Awaited<ReturnType<WalletStatusFn>>;

        if (status.transactionId?.startsWith("at1")) {
          finalTxId = status.transactionId;
        }
        const s = status.status?.toLowerCase();
        if (s === "finalized" || s === "confirmed" || s === "accepted" || s === "completed") {
          console.log(`[PNW-STEP] ${label}: CONFIRMED ${finalTxId}`);
          return finalTxId;
        }
        if (s === "rejected" || s === "failed") {
          throw new Error(`${label} rejected: ${status.error ?? "unknown"}`);
        }
        if (pollCount === 1 || pollCount % 10 === 0) {
          console.log(`[PNW-STEP] ${label}: poll ${pollCount} (${Math.round(elapsed / 1000)}s) status:`, status);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.includes("rejected") || errMsg.includes("failed")) {
          throw err;
        }
        if (pollCount === 1 || pollCount % 30 === 0) {
          console.log(`[PNW-STEP] ${label}: poll ${pollCount} (${Math.round(elapsed / 1000)}s) error: ${errMsg}`);
        }
      }
    }
    throw new Error(`${label}: timed out waiting for confirmation`);
  }
  return walletTxId;
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
 * Fetch frozen addresses from the on-chain freeze list program.
 * Returns an empty array if the freeze list has no entries.
 */
async function fetchFreezeListAddresses(endpoint: string): Promise<string[]> {
  const freezelistProgram = PROGRAMS.external.usdcx_freezelist;

  try {
    // Fetch leaf count
    const countResp = await fetch(
      `${endpoint}/program/${freezelistProgram}/mapping/freeze_list_count/1u8`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) },
    );
    if (!countResp.ok) return [];
    const countRaw = await countResp.text();
    const count = parseInt(countRaw.replace(/"/g, "").replace(/u\d+$/, ""), 10);
    if (!count || isNaN(count) || count === 0) return [];

    // Fetch each frozen address
    const addresses: string[] = [];
    for (let i = 0; i < count; i++) {
      const resp = await fetch(
        `${endpoint}/program/${freezelistProgram}/mapping/freeze_list/${i}u32`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) },
      );
      if (resp.ok) {
        const addr = (await resp.text()).replace(/"/g, "").trim();
        if (addr && addr.startsWith("aleo1")) addresses.push(addr);
      }
    }
    return addresses;
  } catch {
    return [];
  }
}

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
