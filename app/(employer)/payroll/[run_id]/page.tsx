"use client";

import { useEffect, useMemo, useCallback, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";
import { RunStatusBanner } from "@/components/run-status/RunStatusBanner";
import { ChunkStatusList } from "@/components/run-status/ChunkStatusList";
import { RunSummary } from "@/components/run-status/RunSummary";
import { retryChunk } from "@/src/coordinator/settlement_coordinator";
import { mintBatchAnchor, mintBatchAnchorViaWallet } from "@/src/anchor/batch_anchor_finalizer";
import { getPrivateKey } from "@/src/stores/session_store";
import { ENV } from "@/src/config/env";
import type { PayrollRunManifest } from "@/src/manifest/types";
import type { WalletExecuteFn } from "@/src/lib/wallet/wallet-executor";
import { useWorkerStore } from "@/src/stores/worker_store";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  scanPayrollHistory,
  historicalRunToManifest,
} from "@/src/records/payroll_history_scanner";

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
  const { executeTransaction, requestRecords } = useWallet();
  const { address: employerAddr } = useAleoSession();
  const [scannedManifest, setScannedManifest] = useState<PayrollRunManifest | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  // Build wallet executor function from wallet adapter
  // CRITICAL: privateFee: false is required — Shield wallet silently fails
  // without it (tries to use a private credits record for the fee and can't
  // resolve it). Matches useTransactionExecutor.ts behavior.
  const walletExecute: WalletExecuteFn | undefined = useMemo(() => {
    if (!executeTransaction) return undefined;
    return async (params) => {
      const result = await executeTransaction({
        program: params.program,
        function: params.function,
        inputs: params.inputs,
        fee: params.fee,
        privateFee: false,
      });
      if (!result) throw new Error("Wallet returned no result");
      return result.transactionId;
    };
  }, [executeTransaction]);

  const manifest = usePayrollRunStore((s) => s.manifest);
  const history = usePayrollRunStore((s) => s.history);
  const restore = usePayrollRunStore((s) => s.restore);
  const updateChunks = usePayrollRunStore((s) => s.updateChunks);
  const setAnchor = usePayrollRunStore((s) => s.setAnchor);
  const workers = useWorkerStore((s) => s.workers);

  // Build a map of worker_addr → .pnw display name for PDF and UI
  const workerNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of workers) {
      if (w.display_name) map[w.worker_addr] = w.display_name;
    }
    return map;
  }, [workers]);

  const [anchorLoading, setAnchorLoading] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  // Restore from sessionStorage on mount
  useEffect(() => {
    restore();
  }, [restore]);

  // Find the manifest — try in-store first, then on-chain scan fallback
  const resolvedManifest = useMemo(() => {
    if (manifest && manifest.batch_id === runId) return manifest;
    const inHistory = history.find((m) => m.batch_id === runId) ?? null;
    if (inHistory) return inHistory;
    if (scannedManifest && scannedManifest.batch_id === runId) return scannedManifest;
    return null;
  }, [manifest, history, runId, scannedManifest]);

  // If we couldn't find it in-store, scan the wallet for matching receipts.
  // Use a ref guard so we only ever scan ONCE per (runId + employer) pair —
  // putting scanLoading or requestRecords in the deps caused an infinite loop
  // because both change on every render.
  const scanAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    if (resolvedManifest) return;
    if (!requestRecords || !employerAddr) return;
    const attemptKey = `${employerAddr}:${runId}`;
    if (scanAttemptedRef.current === attemptKey) return;
    scanAttemptedRef.current = attemptKey;

    setScanLoading(true);
    scanPayrollHistory(requestRecords, employerAddr)
      .then((runs) => {
        const match = runs.find((r) => r.batch_id === runId);
        if (match) {
          const fabricated = historicalRunToManifest(match, employerAddr, workers);
          setScannedManifest(fabricated);
        }
      })
      .catch((err) => console.warn("On-chain run scan failed:", err))
      .finally(() => setScanLoading(false));
  }, [resolvedManifest, requestRecords, employerAddr, runId, workers]);

  const chunks = resolvedManifest?.chunks ?? [];
  const rows = resolvedManifest?.rows ?? [];

  const settledChunks = chunks.filter((c) => c.status === "settled").length;

  const handleRetryChunk = useCallback(
    async (chunkIndex: number) => {
      if (!resolvedManifest) return;
      const privateKey = getPrivateKey();
      if (!privateKey && !walletExecute) {
        alert("No private key in session and no wallet connected. Please reconnect.");
        return;
      }

      const result = await retryChunk(
        {
          manifest: resolvedManifest,
          chunks,
          adapterConfig: {
            endpoint: ENV.ALEO_ENDPOINT,
            network: ENV.NETWORK,
            privateKey: privateKey ?? "",
          },
          callbacks: {
            onRunStatusChange: () => {},
            onChunkUpdate: updateChunks,
            onRowUpdate: () => {},
            onComplete: () => {},
            onError: () => {},
          },
          walletExecute,
        },
        chunkIndex,
      );

      // Update the chunks array with the retried chunk
      const newChunks = chunks.map((c) =>
        c.chunk_index === result.chunk_index ? result : c,
      );
      updateChunks(newChunks);
    },
    [resolvedManifest, chunks, updateChunks, walletExecute],
  );

  const handleMintAnchor = useCallback(async () => {
    if (!resolvedManifest) return;
    setAnchorLoading(true);
    setAnchorError(null);

    try {
      let result;
      if (walletExecute) {
        // Preferred path: sign via connected wallet
        result = await mintBatchAnchorViaWallet(resolvedManifest, walletExecute);
      } else {
        // Fallback: direct key entry (Path B)
        const privateKey = getPrivateKey();
        if (!privateKey) {
          throw new Error("No wallet connected and no private key in session. Please connect your wallet.");
        }
        result = await mintBatchAnchor(resolvedManifest, {
          endpoint: ENV.ALEO_ENDPOINT,
          network: ENV.NETWORK,
          privateKey,
        });
      }
      setAnchor(result.tx_id, result.nft_id);
    } catch (err) {
      setAnchorError(err instanceof Error ? err.message : "Anchor minting failed");
    } finally {
      setAnchorLoading(false);
    }
  }, [resolvedManifest, walletExecute, setAnchor]);

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
          {scanLoading ? (
            <>
              <div className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
              <p className="text-sm text-muted-foreground">
                Loading payroll run from on-chain records...
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Run not found on-chain. The receipts may not be in your connected wallet.
            </p>
          )}
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
        workerNames={workerNames}
      />

      {/* Run summary */}
      <RunSummary
        manifest={resolvedManifest}
        workerNames={workerNames}
        onExportJson={() => downloadJson(resolvedManifest)}
        onMintAnchor={handleMintAnchor}
        anchorLoading={anchorLoading}
        anchorError={anchorError}
      />
    </div>
  );
}
