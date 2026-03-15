"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  validated: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  queued: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  proving: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  partially_settled: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  settled: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  anchored: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  needs_retry: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

function formatMinorUnits(value: string): string {
  const num = Number(value);
  if (isNaN(num)) return value;
  const dollars = num / 1_000_000;
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString();
}

export default function PayrollHistoryPage() {
  const manifest = usePayrollRunStore((s) => s.manifest);
  const history = usePayrollRunStore((s) => s.history);
  const restore = usePayrollRunStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  // Active run + completed history
  const allRuns = manifest ? [manifest, ...history] : history;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Payroll History
          </h1>
          <p className="text-sm text-muted-foreground">
            View past payroll runs and their statuses
          </p>
        </div>
        <Link
          href="/payroll/new"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          New Payroll Run
        </Link>
      </div>

      {allRuns.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No payroll runs yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {allRuns.map((run) => {
            const badge = STATUS_BADGE[run.status] ?? STATUS_BADGE.draft;
            const isActive = manifest && run.batch_id === manifest.batch_id;

            return (
              <Link
                key={run.batch_id}
                href={`/payroll/${run.batch_id}`}
                className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
                      >
                        {run.status.replace("_", " ")}
                      </span>
                      {isActive && (
                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-mono text-xs text-muted-foreground truncate">
                      {run.batch_id.slice(0, 24)}...
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-mono text-sm font-medium">
                      {formatMinorUnits(run.total_net_amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.row_count} worker{run.row_count !== 1 ? "s" : ""} · Epoch {run.epoch_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(run.created_at)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
