"use client";

import type { ChunkPlan } from "@/src/manifest/types";
import type { PayrollRow } from "@/src/manifest/types";

type Props = {
  chunk: ChunkPlan;
  rows: PayrollRow[];
  onRetry?: (chunkIndex: number) => void;
  /** Optional .pnw display names keyed by worker_addr */
  workerNames?: Record<string, string>;
};

const CHUNK_STATUS_STYLES: Record<
  ChunkPlan["status"],
  { label: string; dot: string }
> = {
  pending: { label: "Pending", dot: "bg-gray-400" },
  proving: { label: "Proving", dot: "bg-purple-500 animate-pulse" },
  broadcasting: { label: "Broadcasting", dot: "bg-blue-500 animate-pulse" },
  settled: { label: "Settled", dot: "bg-green-500" },
  failed: { label: "Failed", dot: "bg-red-500" },
  needs_retry: { label: "Retry", dot: "bg-amber-500" },
};

function formatMinorUnits(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  const dollars = num / 1_000_000;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function truncateTxId(txId: string): string {
  if (txId.length <= 16) return txId;
  return `${txId.slice(0, 8)}...${txId.slice(-6)}`;
}

export function ChunkStatusRow({ chunk, rows, onRetry, workerNames }: Props) {
  const style = CHUNK_STATUS_STYLES[chunk.status];
  const chunkRows = chunk.row_indices.map((i) => rows[i]).filter(Boolean) as PayrollRow[];

  // Prefer the .pnw name; fall back to full address if unavailable
  let workerDisplayName: string;
  let workerFullAddr: string | null = null;
  if (chunkRows.length === 1) {
    const row = chunkRows[0]!;
    workerFullAddr = row.worker_addr;
    workerDisplayName = workerNames?.[row.worker_addr] ?? row.worker_addr;
  } else {
    workerDisplayName = `${chunkRows.length} workers`;
  }

  // Row-level status (takes precedence over chunk status for display)
  // If all rows are settled, treat the chunk as settled even if chunk.status lags
  const rowStatus = chunkRows.length === 1 ? chunkRows[0]!.status : null;
  const effectiveStatusLabel =
    rowStatus === "settled" && chunk.status !== "settled"
      ? "Settled"
      : style.label;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="flex items-center justify-between">
        {/* Chunk index + status dot + worker name */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
          <span className="font-mono text-xs text-muted-foreground">
            #{chunk.chunk_index}
          </span>
          <span className="truncate font-medium text-foreground">
            {workerDisplayName}
          </span>
        </div>

        {/* Amount */}
        <span className="shrink-0 font-mono text-xs px-2">
          {formatMinorUnits(chunk.net_total)}
        </span>

        {/* Status */}
        <span className="shrink-0 text-xs text-muted-foreground w-24 text-center">
          {effectiveStatusLabel}
        </span>

        {/* TX ID or retry */}
        <div className="flex items-center gap-2 shrink-0 w-36 justify-end">
          {chunk.tx_id && (
            <a
              href={`https://explorer.provable.com/transaction/${chunk.tx_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
              title={chunk.tx_id}
            >
              {truncateTxId(chunk.tx_id)}
            </a>
          )}
          {(chunk.status === "failed" || chunk.status === "needs_retry") && onRetry && (
            <button
              onClick={() => onRetry(chunk.chunk_index)}
              className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:hover:bg-amber-800"
            >
              Retry
            </button>
          )}
          {chunk.status === "failed" && chunk.last_error && (
            <span
              className="text-xs text-red-500 truncate max-w-[120px]"
              title={chunk.last_error}
            >
              {chunk.last_error}
            </span>
          )}
        </div>
      </div>

      {/* Full Aleo address (monospace, tiny) */}
      {workerFullAddr && (
        <p className="font-mono text-[10px] text-muted-foreground break-all pl-6">
          {workerFullAddr}
        </p>
      )}
    </div>
  );
}
