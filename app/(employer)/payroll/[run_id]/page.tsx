"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";
import { RunStatusBanner } from "@/components/run-status/RunStatusBanner";
import { ChunkStatusList } from "@/components/run-status/ChunkStatusList";
import { RunSummary } from "@/components/run-status/RunSummary";
import { retryChunk } from "@/src/coordinator/settlement_coordinator";
import { mintBatchAnchor } from "@/src/anchor/batch_anchor_finalizer";
import { getPrivateKey } from "@/src/stores/session_store";
import { ENV } from "@/src/config/env";
import type { PayrollRunManifest } from "@/src/manifest/types";

function downloadJson(manifest: PayrollRunManifest) {
  const json = JSON.stringify(manifest, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `payroll-run-${manifest.batch_id.slice(0, 12)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RunStatusPage() {
  const params = useParams<{ run_id: string }>();
  const runId = params.run_id;

  const manifest = usePayrollRunStore((s) => s.manifest);
  const history = usePayrollRunStore((s) => s.history);
  const restore = usePayrollRunStore((s) => s.restore);
  const updateChunks = usePayrollRunStore((s) => s.updateChunks);
  const setAnchor = usePayrollRunStore((s) => s.setAnchor);

  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    restore();
  }, [restore]);

  // Find the manifest — current run or from history
  const resolvedManifest = useMemo(() => {
    if (manifest && manifest.batch_id === runId) return manifest;
    return history.find((m) => m.batch_id === runId) ?? null;
  }, [manifest, history, runId]);

  const chunks = resolvedManifest?.chunks ?? [];
  const rows = resolvedManifest?.rows ?? [];

  const settledChunks = chunks.filter((c) => c.status === "settled").length;

  const handleRetryChunk = useCallback(
    async (chunkIndex: number) => {
      if (!resolvedManifest) return;
      const privateKey = getPrivateKey();
      if (!privateKey) {
        alert("No private key in session. Please reconnect.");
        return;
      }

      const result = await retryChunk(
        {
          manifest: resolvedManifest,
          chunks,
          adapterConfig: {
            endpoint: ENV.ALEO_ENDPOINT,
            network: ENV.NETWORK,
            privateKey,
          },
          callbacks: {
            onRunStatusChange: () => {},
            onChunkUpdate: updateChunks,
            onRowUpdate: () => {},
            onComplete: () => {},
            onError: () => {},
          },
        },
        chunkIndex,
      );

      // Update the chunks array with the retried chunk
      const newChunks = chunks.map((c) =>
        c.chunk_index === result.chunk_index ? result : c,
      );
      updateChunks(newChunks);
    },
    [resolvedManifest, chunks, updateChunks],
  );

  const handleMintAnchor = useCallback(async () => {
    if (!resolvedManifest) return;
    const privateKey = getPrivateKey();
    if (!privateKey) {
      alert("No private key in session. Please reconnect.");
      return;
    }

    setAnchorLoading(true);
    setAnchorError(null);

    try {
      const result = await mintBatchAnchor(resolvedManifest, {
        endpoint: ENV.ALEO_ENDPOINT,
        network: ENV.NETWORK,
        privateKey,
      });
      setAnchor(result.tx_id, result.nft_id);
    } catch (err) {
      setAnchorError(err instanceof Error ? err.message : "Anchor minting failed");
    } finally {
      setAnchorLoading(false);
    }
  }, [resolvedManifest, setAnchor]);

  if (!resolvedManifest) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href="/payroll"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back
          </Link>
        </div>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Run not found. It may have expired from your session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Payroll Run Status
          </h1>
          <p className="text-xs font-mono text-muted-foreground">
            {resolvedManifest.batch_id.slice(0, 24)}...
          </p>
        </div>
        <Link
          href="/payroll"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to History
        </Link>
      </div>

      {/* Status banner with progress */}
      <RunStatusBanner
        status={resolvedManifest.status}
        settledChunks={settledChunks}
        totalChunks={chunks.length}
      />

      {/* Chunk list */}
      <ChunkStatusList
        chunks={chunks}
        rows={rows}
        onRetryChunk={handleRetryChunk}
      />

      {/* Run summary */}
      <RunSummary
        manifest={resolvedManifest}
        onExportJson={() => downloadJson(resolvedManifest)}
        onMintAnchor={handleMintAnchor}
        anchorLoading={anchorLoading}
        anchorError={anchorError}
      />
    </div>
  );
}
