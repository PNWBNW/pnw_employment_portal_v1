"use client";

import { useEffect, useCallback } from "react";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWorkerStore, type WorkerRecord } from "@/src/stores/worker_store";
import { readAgreementRecords } from "@/src/records/agreement_reader";

function truncate(str: string, len = 12): string {
  if (str.length <= len) return str;
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

function StatusBadge({ status }: { status: WorkerRecord["status"] }) {
  const styles = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function WorkersPage() {
  const { viewKey, address } = useAleoSession();
  const { workers, isLoading, setWorkers, setLoading } = useWorkerStore();

  const loadWorkers = useCallback(async () => {
    if (!viewKey || !address) return;
    setLoading(true);
    try {
      const records = await readAgreementRecords(viewKey, address);
      setWorkers(records);
    } catch (err) {
      console.warn("Failed to load workers:", err);
    } finally {
      setLoading(false);
    }
  }, [viewKey, address, setWorkers, setLoading]);

  useEffect(() => {
    void loadWorkers();
  }, [loadWorkers]);

  const activeCount = workers.filter((w) => w.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workers</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} active worker${activeCount !== 1 ? "s" : ""}`
              : "Manage your workers and agreements"}
          </p>
        </div>
        <Link
          href="/workers/onboard"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Add Worker
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Scanning agreement records...
          </p>
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No workers found. Onboard your first worker to get started.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Workers appear here after agreement records are detected on testnet.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Worker
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Agreement ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Last Payroll
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr
                  key={worker.agreement_id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {worker.display_name ?? "Unnamed Worker"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {truncate(worker.worker_addr)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-muted-foreground">
                      {truncate(worker.agreement_id)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={worker.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {worker.last_payroll_epoch
                      ? `Epoch ${worker.last_payroll_epoch}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/workers/${encodeURIComponent(worker.agreement_id)}`}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={() => void loadWorkers()}
        disabled={isLoading}
        className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        {isLoading ? "Scanning..." : "Refresh"}
      </button>
    </div>
  );
}
