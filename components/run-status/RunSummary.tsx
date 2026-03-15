"use client";

import type { PayrollRunManifest } from "@/src/manifest/types";

type Props = {
  manifest: PayrollRunManifest;
  onExportJson?: () => void;
  onMintAnchor?: () => void;
  anchorLoading?: boolean;
  anchorError?: string | null;
};

function formatMinorUnits(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  const dollars = num / 1_000_000;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatTimestamp(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

function truncateHash(hash: string, len = 16): string {
  if (hash.length <= len) return hash;
  return `${hash.slice(0, len)}...`;
}

export function RunSummary({ manifest, onExportJson, onMintAnchor, anchorLoading, anchorError }: Props) {
  const isFullySettled = manifest.status === "settled";
  const isAnchored = manifest.status === "anchored";

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-medium text-foreground">Run Summary</h3>

      {/* Totals grid */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Total Gross</p>
          <p className="font-mono">{formatMinorUnits(manifest.total_gross_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Tax</p>
          <p className="font-mono">{formatMinorUnits(manifest.total_tax_withheld)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Fees</p>
          <p className="font-mono">{formatMinorUnits(manifest.total_fee_amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Net</p>
          <p className="font-mono font-semibold">{formatMinorUnits(manifest.total_net_amount)}</p>
        </div>
      </div>

      {/* Identifiers */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Batch ID</span>
          <span className="font-mono" title={manifest.batch_id}>
            {truncateHash(manifest.batch_id)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Row Root</span>
          <span className="font-mono" title={manifest.row_root}>
            {truncateHash(manifest.row_root)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Epoch</span>
          <span className="font-mono">{manifest.epoch_id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Workers</span>
          <span>{manifest.row_count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Created</span>
          <span>{formatTimestamp(manifest.created_at)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Last Updated</span>
          <span>{formatTimestamp(manifest.updated_at)}</span>
        </div>
        {manifest.anchor_tx_id && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Anchor TX</span>
            <a
              href={`https://explorer.provable.com/transaction/${manifest.anchor_tx_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-blue-600 dark:text-blue-400 hover:underline"
              title={manifest.anchor_tx_id}
            >
              {truncateHash(manifest.anchor_tx_id)}
            </a>
          </div>
        )}
        {manifest.anchor_nft_id && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">NFT ID</span>
            <span className="font-mono" title={manifest.anchor_nft_id}>
              {truncateHash(manifest.anchor_nft_id)}
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        {onExportJson && (
          <button
            onClick={onExportJson}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Export JSON
          </button>
        )}
        {isFullySettled && !isAnchored && onMintAnchor && (
          <button
            onClick={onMintAnchor}
            disabled={anchorLoading}
            className="rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {anchorLoading ? "Minting..." : "Mint Batch Anchor"}
          </button>
        )}
        {anchorError && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {anchorError}
          </span>
        )}
        {isAnchored && (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            Anchored on-chain
          </span>
        )}
      </div>
    </div>
  );
}
