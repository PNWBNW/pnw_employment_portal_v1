"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { useWorkerStore } from "@/src/stores/worker_store";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import { generatePaystubPdf } from "@/components/pdf/PaystubPDF";
import { loadWorkerW4 } from "@/src/stores/w4_store";

const FILING_LABELS: Record<string, string> = {
  single: "Single",
  married_filing_jointly: "Married Filing Jointly",
  married_filing_separately: "Married Filing Separately",
  head_of_household: "Head of Household",
};

function truncate(str: string, len = 16): string {
  if (str.length <= len) return str;
  return `${str.slice(0, 8)}...${str.slice(-6)}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function WorkerDetailPage({
  params,
}: {
  params: Promise<{ worker_id: string }>;
}) {
  const { worker_id } = use(params);
  const decodedId = decodeURIComponent(worker_id);
  const workers = useWorkerStore((s) => s.workers);
  const setDisplayName = useWorkerStore((s) => s.setDisplayName);
  const history = usePayrollRunStore((s) => s.history);
  const restore = usePayrollRunStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  const worker = workers.find((w) => w.agreement_id === decodedId);

  // Collect payroll rows for this worker from run history
  const workerPayRows = history.flatMap((manifest) =>
    manifest.rows
      .filter((r) => r.agreement_id === decodedId)
      .map((row) => ({ manifest, row })),
  );

  if (!worker) {
    return (
      <div className="space-y-4">
        <Link
          href="/workers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Workers
        </Link>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Worker not found. This worker may not be loaded in the current
            session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/workers"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Workers
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            {worker.display_name ?? "Worker Detail"}
          </h1>
        </div>
        <StatusBadge status={worker.status} />
      </div>

      {/* Worker Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Worker Address
          </h2>
          <p className="mt-1 break-all font-mono text-xs text-card-foreground">
            {worker.worker_addr}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Name Hash
          </h2>
          <p className="mt-1 break-all font-mono text-xs text-card-foreground">
            {truncate(worker.worker_name_hash, 24)}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Agreement ID
          </h2>
          <p className="mt-1 break-all font-mono text-xs text-card-foreground">
            {worker.agreement_id}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-medium text-muted-foreground">
            Display Name
          </h2>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="text"
              value={worker.display_name ?? ""}
              onChange={(e) =>
                setDisplayName(worker.agreement_id, e.target.value)
              }
              placeholder="Set display name..."
              className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Session-only label. Not stored on chain.
          </p>
        </div>
      </div>

      {/* W-4 Tax Withholding */}
      <W4Section workerAddr={worker.worker_addr} />

      {/* Agreement Actions */}
      {worker.status === "active" && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-card-foreground">
            Agreement Actions
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              disabled
              className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground opacity-50"
              title="Implemented in Phase E5+"
            >
              Pause Agreement
            </button>
            <button
              disabled
              className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground opacity-50"
              title="Implemented in Phase E5+"
            >
              Terminate Agreement
            </button>
            <button
              disabled
              className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground opacity-50"
              title="Implemented in Phase E5+"
            >
              Supersede (New Terms)
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Agreement lifecycle actions will be wired in Phase E5+.
          </p>
        </div>
      )}

      {/* Pay History */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-card-foreground">
          Pay History
        </h2>
        {workerPayRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payroll history yet. Pay history will be populated from decoded
            paystub receipt records after payroll runs are executed.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-medium text-muted-foreground">Epoch</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Gross</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Net</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workerPayRows.map(({ manifest, row }) => (
                  <tr key={`${manifest.batch_id}-${row.row_index}`} className="border-b border-border last:border-0">
                    <td className="py-1.5 font-mono">{manifest.epoch_id}</td>
                    <td className="py-1.5 font-mono">
                      ${(Number(row.gross_amount) / 1_000_000).toFixed(2)}
                    </td>
                    <td className="py-1.5 font-mono">
                      ${(Number(row.net_amount) / 1_000_000).toFixed(2)}
                    </td>
                    <td className="py-1.5 capitalize">{row.status}</td>
                    <td className="py-1.5">
                      <DownloadPDFButton
                        generatePdf={() =>
                          generatePaystubPdf({
                            manifest,
                            row,
                            workerDisplayName: worker.display_name,
                          })
                        }
                        fileName={`paystub-epoch-${manifest.epoch_id}-${row.row_index}`}
                        label="Print Paystub"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Credentials */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-card-foreground">
            Credentials
          </h2>
          <Link
            href={`/credentials/issue`}
            className="text-xs text-primary hover:underline"
          >
            Issue Credential
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          View and manage credentials from the{" "}
          <Link href="/credentials" className="text-primary hover:underline">
            Credentials page
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// W-4 Section — shows the worker's tax withholding elections
// ---------------------------------------------------------------------------

function W4Section({ workerAddr }: { workerAddr: string }) {
  const w4 = loadWorkerW4(workerAddr);

  // Check for IPFS CID (stored when the worker uploaded their W-4 PDF)
  const ipfsCid =
    typeof window !== "undefined"
      ? localStorage.getItem(`pnw_w4_cid_${workerAddr}`)
      : null;

  if (!w4) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
        <h2 className="text-sm font-medium text-amber-800 dark:text-amber-200">
          W-4 Not On File
        </h2>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
          This worker has not completed their W-4 tax withholding form. Tax
          withholding will use the default filing status (Single, no dependents)
          until the worker submits their W-4 through the worker portal.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">
          W-4 Tax Withholding
        </h2>
        <div className="flex items-center gap-2">
          {ipfsCid && (
            <a
              href={`https://gateway.pinata.cloud/ipfs/${ipfsCid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-input px-2 py-1 text-xs text-primary hover:bg-accent"
            >
              View PDF
            </a>
          )}
          <span className="text-xs text-green-600 dark:text-green-400">
            On file — {new Date(w4.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Filing Status</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {FILING_LABELS[w4.filingStatus] ?? w4.filingStatus}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Dependent Credit</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            ${w4.totalDependentCredit.toLocaleString()}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {w4.qualifyingChildren} child{w4.qualifyingChildren !== 1 ? "ren" : ""} +{" "}
            {w4.otherDependents} other
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Extra Withholding</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            {w4.extraWithholding > 0
              ? `$${w4.extraWithholding.toFixed(2)}/period`
              : "None"}
          </p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">Adjustments</p>
          <p className="mt-0.5 text-sm text-foreground">
            {w4.otherIncome > 0 && (
              <span className="block text-xs">
                Other income: ${w4.otherIncome.toLocaleString()}/yr
              </span>
            )}
            {w4.extraDeductions > 0 && (
              <span className="block text-xs">
                Extra deductions: ${w4.extraDeductions.toLocaleString()}/yr
              </span>
            )}
            {w4.otherIncome === 0 && w4.extraDeductions === 0 && (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </p>
        </div>
      </div>

      {w4.multipleJobsOrSpouseWorks && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          Multiple jobs / spouse works — withholding uses higher bracket tables
        </p>
      )}
    </div>
  );
}
