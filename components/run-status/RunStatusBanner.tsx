"use client";

import type { PayrollRunStatus } from "@/src/manifest/types";

type Props = {
  status: PayrollRunStatus;
  settledChunks: number;
  totalChunks: number;
};

const STATUS_CONFIG: Record<
  PayrollRunStatus,
  { label: string; color: string; pulse?: boolean }
> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  validated: { label: "Validated", color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  queued: { label: "Queued", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300", pulse: true },
  proving: { label: "Proving", color: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300", pulse: true },
  partially_settled: { label: "Partially Settled", color: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", pulse: true },
  settled: { label: "Settled", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  anchored: { label: "Anchored", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  needs_retry: { label: "Needs Retry", color: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
};

export function RunStatusBanner({ status, settledChunks, totalChunks }: Props) {
  const config = STATUS_CONFIG[status];
  const progress = totalChunks > 0 ? (settledChunks / totalChunks) * 100 : 0;
  const isActive = status === "queued" || status === "proving" || status === "partially_settled";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${config.color} ${config.pulse ? "animate-pulse" : ""}`}
          >
            {config.label}
          </span>
          <span className="text-sm text-muted-foreground">
            {settledChunks} / {totalChunks} chunks settled
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {totalChunks > 0 && (
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                status === "failed" || status === "needs_retry"
                  ? "bg-red-500"
                  : status === "settled" || status === "anchored"
                    ? "bg-green-500"
                    : "bg-primary"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {isActive && (
            <p className="mt-1 text-xs text-muted-foreground">
              Settlement in progress...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
