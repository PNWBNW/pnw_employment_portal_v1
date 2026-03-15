"use client";

import type { ChunkPlan, PayrollRow } from "@/src/manifest/types";
import { ChunkStatusRow } from "./ChunkStatusRow";

type Props = {
  chunks: ChunkPlan[];
  rows: PayrollRow[];
  onRetryChunk?: (chunkIndex: number) => void;
};

export function ChunkStatusList({ chunks, rows, onRetryChunk }: Props) {
  if (chunks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No chunks planned yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium text-foreground">
        Settlement Chunks ({chunks.length})
      </h3>

      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-1 text-xs text-muted-foreground">
        <span className="w-32">Chunk / Worker</span>
        <span>Amount</span>
        <span className="w-24 text-center">Status</span>
        <span className="w-36 text-right">TX / Action</span>
      </div>

      {/* Chunk rows */}
      <div className="max-h-[400px] space-y-1 overflow-y-auto">
        {chunks.map((chunk) => (
          <ChunkStatusRow
            key={chunk.chunk_index}
            chunk={chunk}
            rows={rows}
            onRetry={onRetryChunk}
          />
        ))}
      </div>
    </div>
  );
}
