"use client";

import type { PayrollRunManifest } from "@/src/manifest/types";
import type { ChunkPlan } from "@/src/manifest/types";

type Props = {
  manifest: PayrollRunManifest;
  chunks: ChunkPlan[];
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

function truncateHash(hash: string, chars = 8): string {
  if (hash.length <= chars * 2 + 4) return hash;
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

function formatMinorUnits(value: string): string {
  const n = BigInt(value);
  const dollars = n / 1_000_000n;
  const cents = n % 1_000_000n;
  const centsStr = cents.toString().padStart(6, "0").slice(0, 2);
  return `$${dollars.toLocaleString()}.${centsStr}`;
}

export function ManifestPreview({ manifest, chunks, onConfirm, onCancel, disabled }: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Manifest Preview
        </h2>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
          {manifest.status}
        </span>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Batch ID</p>
          <p className="font-mono text-xs" title={manifest.batch_id}>
            {truncateHash(manifest.batch_id)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Epoch</p>
          <p className="font-mono text-xs">{manifest.epoch_id}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Employer</p>
          <p className="font-mono text-xs" title={manifest.employer_addr}>
            {truncateHash(manifest.employer_addr, 6)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Rows</p>
          <p className="font-mono text-xs">{manifest.row_count}</p>
        </div>
      </div>

      {/* Totals */}
      <div className="rounded-md border border-border p-3">
        <h3 className="mb-2 text-sm font-medium text-foreground">Totals</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Gross</span>
            <span className="font-mono">{formatMinorUnits(manifest.total_gross_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span className="font-mono">{formatMinorUnits(manifest.total_tax_withheld)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fees</span>
            <span className="font-mono">{formatMinorUnits(manifest.total_fee_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net</span>
            <span className="font-mono font-semibold">{formatMinorUnits(manifest.total_net_amount)}</span>
          </div>
        </div>
      </div>

      {/* Hashes */}
      <div className="rounded-md border border-border p-3">
        <h3 className="mb-2 text-sm font-medium text-foreground">Commitment Hashes</h3>
        <div className="space-y-1 text-xs">
          {([
            ["Row Root", manifest.row_root],
            ["Inputs Hash", manifest.inputs_hash],
            ["Doc Hash", manifest.doc_hash],
          ] as const).map(([label, hash]) => (
            <div key={label} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-mono" title={hash}>{truncateHash(hash)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chunks */}
      <div className="rounded-md border border-border p-3">
        <h3 className="mb-2 text-sm font-medium text-foreground">
          Settlement Plan ({chunks.length} chunk{chunks.length !== 1 ? "s" : ""})
        </h3>
        <div className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {chunks.map((chunk) => (
            <div key={chunk.chunk_index} className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
              <span className="font-mono text-muted-foreground">
                #{chunk.chunk_index}
              </span>
              <span className="text-muted-foreground">
                {chunk.row_indices.length} row{chunk.row_indices.length !== 1 ? "s" : ""}
              </span>
              <span className="font-mono">{formatMinorUnits(chunk.net_total)}</span>
              <span className="text-muted-foreground">{chunk.transition}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Versions */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>schema_v: {manifest.schema_v}</span>
        <span>calc_v: {manifest.calc_v}</span>
        <span>policy_v: {manifest.policy_v}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
        <button
          onClick={onCancel}
          disabled={disabled}
          className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          Back to Edit
        </button>
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {disabled ? "Settling..." : "Confirm & Queue Settlement"}
        </button>
      </div>
    </div>
  );
}
