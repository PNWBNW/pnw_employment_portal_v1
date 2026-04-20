/**
 * Worker resolver — maps .pnw names to worker records from the store.
 *
 * When the employer types a worker name (e.g., "alice.pnw"), this module
 * finds the matching WorkerRecord and auto-fills worker_addr, worker_name_hash,
 * and agreement_id on the payroll table row.
 */

import type { WorkerRecord } from "@/src/stores/worker_store";
import type { PayrollTableRow } from "./types";
import { formatDollar } from "./types";
import { computeNameHash } from "@/src/registry/name_registry";

/**
 * Attempt to resolve a worker name against the worker store.
 *
 * Matching strategy (in priority order):
 * 1. Exact match on display_name (case-insensitive)
 * 2. Match by computed name_hash (handles ".pnw" suffix stripping)
 *
 * Only returns active workers not already used in other rows.
 */
export function resolveWorker(
  name: string,
  workers: WorkerRecord[],
  existingRows: PayrollTableRow[],
  currentRowId: string,
): WorkerRecord | null {
  if (!name.trim()) return null;

  const activeWorkers = workers.filter((w) => w.status === "active");
  const normalizedInput = name.trim().toLowerCase();

  // Already-used agreement IDs (excluding the current row)
  const usedAgreements = new Set(
    existingRows
      .filter((r) => r.id !== currentRowId && r.agreement_id)
      .map((r) => r.agreement_id),
  );

  const available = activeWorkers.filter(
    (w) => !usedAgreements.has(w.agreement_id),
  );

  // 1. Exact display_name match (case-insensitive)
  const byDisplayName = available.find(
    (w) => w.display_name?.toLowerCase() === normalizedInput,
  );
  if (byDisplayName) return byDisplayName;

  // 2. Match with .pnw suffix stripped
  const stripped = normalizedInput.replace(/\.pnw$/, "");
  const byStripped = available.find(
    (w) => w.display_name?.toLowerCase().replace(/\.pnw$/, "") === stripped,
  );
  if (byStripped) return byStripped;

  // 3. Match by computed name hash
  const inputHash = computeNameHash(stripped);
  const byHash = available.find((w) => w.worker_name_hash === inputHash);
  if (byHash) return byHash;

  return null;
}

/**
 * Apply a resolved worker record to a payroll table row.
 * Auto-fills worker_addr, worker_name_hash, agreement_id, pay info,
 * and marks resolved. For salary workers, gross_amount is auto-filled
 * from the agreement's pay_rate. For hourly workers, gross stays empty
 * until the employer enters hours_worked.
 */
export function applyWorkerToRow(
  row: PayrollTableRow,
  worker: WorkerRecord,
): PayrollTableRow {
  const applied: PayrollTableRow = {
    ...row,
    worker_addr: worker.worker_addr,
    worker_name_hash: worker.worker_name_hash,
    agreement_id: worker.agreement_id,
    worker_name: worker.display_name ?? row.worker_name,
    pay_type: worker.pay_type,
    pay_rate: worker.pay_rate,
    resolved: true,
  };

  // Auto-fill gross for salary workers (fixed per period)
  if (worker.pay_type === "salary" && worker.pay_rate && worker.pay_rate > 0) {
    applied.gross_amount = formatDollar(worker.pay_rate);
  }

  return applied;
}

/**
 * Get autocomplete suggestions for a partial worker name input.
 */
export function getWorkerSuggestions(
  input: string,
  workers: WorkerRecord[],
  existingRows: PayrollTableRow[],
  currentRowId: string,
): WorkerRecord[] {
  if (!input.trim()) {
    // Show all available workers when input is empty
    const usedAgreements = new Set(
      existingRows
        .filter((r) => r.id !== currentRowId && r.agreement_id)
        .map((r) => r.agreement_id),
    );
    return workers
      .filter((w) => w.status === "active" && !usedAgreements.has(w.agreement_id));
  }

  const normalizedInput = input.trim().toLowerCase();
  const usedAgreements = new Set(
    existingRows
      .filter((r) => r.id !== currentRowId && r.agreement_id)
      .map((r) => r.agreement_id),
  );

  return workers.filter((w) => {
    if (w.status !== "active") return false;
    if (usedAgreements.has(w.agreement_id)) return false;
    const displayName = (w.display_name ?? "").toLowerCase();
    return displayName.includes(normalizedInput);
  });
}
