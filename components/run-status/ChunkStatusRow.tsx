"use client";

import type { ChunkPlan } from "@/src/manifest/types";
import type { PayrollRow } from "@/src/manifest/types";

type Props = {
  chunk: ChunkPlan;
  rows: PayrollRow[];
  onRetry?: (chunkIndex: number) => void;
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

export function ChunkStatusRow({ chunk, rows, onRetry }: Props) {
  const style = CHUNK_STATUS_STYLES[chunk.status];
  const chunkRows = chunk.row_indices.map((i) => rows[i]).filter(Boolean) as PayrollRow[];
  const workerLabel =
    chunkRows.length === 1
      ? chunkRows[0]!.worker_addr.slice(0, 12) + "..."
      : `${chunkRows.length} workers`;

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
      {/* Chunk index + status dot */}
      <div className="flex items-center gap-2 min-w-0">
        <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
        <span className="font-mono text-xs text-muted-foreground">
          #{chunk.chunk_index}
        </span>
        <span className="truncate text-foreground">{workerLabel}</span>
      </div>

      {/* Amount */}
      <span className="shrink-0 font-mono text-xs">
        {formatMinorUnits(chunk.net_total)}
      </span>

      {/* Status */}
      <span className="shrink-0 text-xs text-muted-foreground w-24 text-center">
        {style.label}
      </span>

      {/* TX ID or retry */}
      <div className="flex items-center gap-2 shrink-0 w-36 justify-end">
        {chunk.tx_id && (
          <span className="font-mono text-xs text-muted-foreground" title={chunk.tx_id}>
            {truncateTxId(chunk.tx_id)}
          </span>
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
  );
}
