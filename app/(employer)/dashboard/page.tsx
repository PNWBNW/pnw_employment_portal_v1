"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWorkerStore } from "@/src/stores/worker_store";
import { usePayrollRunStore } from "@/src/stores/payroll_run_store";
import { readAgreementRecords } from "@/src/records/agreement_reader";
import {
  scanUSDCxBalance,
  formatUSDCxShort,
  type USDCxBalance,
} from "@/src/records/usdcx_scanner";
import { useEmployerIdentityStore } from "@/src/stores/employer_identity_store";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";

export default function DashboardPage() {
  const { address, viewKey } = useAleoSession();
  const { businesses, activeBusinessIndex } = useEmployerIdentityStore();
  const activeBusiness = activeBusinessIndex !== null ? businesses[activeBusinessIndex] ?? null : null;
  const { workers, setWorkers, setLoading: setWorkersLoading } =
    useWorkerStore();
  const { history } = usePayrollRunStore();

  const [balance, setBalance] = useState<USDCxBalance | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const loadData = useCallback(async () => {
    if (!viewKey || !address) return;

    setIsScanning(true);
    setWorkersLoading(true);

    try {
      const [workerRecords, usdcxBalance] = await Promise.all([
        readAgreementRecords(viewKey, address),
        scanUSDCxBalance(viewKey, address),
      ]);
      setWorkers(workerRecords);
      setBalance(usdcxBalance);
    } catch (err) {
      console.warn("Dashboard data load failed:", err);
    } finally {
      setIsScanning(false);
      setWorkersLoading(false);
    }
  }, [viewKey, address, setWorkers, setWorkersLoading]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeWorkers = workers.filter((w) => w.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Employer overview</p>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={isScanning}
          className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
        >
          {isScanning ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {/* Setup banner — shown when no active business profile */}
      {!activeBusiness && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-400">
                Business Profile Required
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You have .pnw names registered on-chain, but no active business profile in this session.
                Set up your business identity to unlock payroll, agreements, and credentials.
              </p>
              <button
                onClick={() => {
                  useEmployerIdentityStore.getState().setStep("register_name");
                }}
                className="mt-3 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
              >
                Set Up Business Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          {activeBusiness ? (
            <>
              <p className="text-sm text-muted-foreground">Business Identity</p>
              <p className="mt-1 text-lg font-bold text-card-foreground">
                {activeBusiness.name}.pnw
              </p>
              <p className="text-xs text-muted-foreground">
                {INDUSTRY_SUFFIXES[activeBusiness.suffixCode]?.label ?? "Business"}
              </p>
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {address}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">Connected Address</p>
              <p className="mt-1 break-all font-mono text-xs text-card-foreground">
                {address}
              </p>
            </>
          )}
        </div>

        <Link
          href="/workers"
          className="rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/50"
        >
          <p className="text-sm text-muted-foreground">Active Workers</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">
            {isScanning ? "..." : activeWorkers.length}
          </p>
          {workers.length > activeWorkers.length && (
            <p className="text-xs text-muted-foreground">
              {workers.length} total ({workers.length - activeWorkers.length}{" "}
              inactive)
            </p>
          )}
        </Link>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">USDCx Balance</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">
            {isScanning
              ? "..."
              : balance
                ? formatUSDCxShort(balance.total)
                : "$0.00"}
          </p>
          {balance && balance.recordCount > 0 && (
            <p className="text-xs text-muted-foreground">
              {balance.recordCount} record{balance.recordCount !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-card-foreground">
          Quick Actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {activeBusiness ? (
            <Link
              href="/payroll/new"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Run Payroll
            </Link>
          ) : (
            <span className="rounded-md bg-primary/30 px-4 py-2 text-sm text-primary-foreground/50 cursor-not-allowed" title="Complete business profile first">
              Run Payroll
            </span>
          )}
          <Link
            href="/workers"
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            View Workers
          </Link>
          <Link
            href="/credentials"
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            Credentials
          </Link>
          <button
            onClick={() => {
              useEmployerIdentityStore.getState().setStep("register_name");
            }}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            + Add Business
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-card-foreground">
          Recent Activity
        </h2>
        {history.length > 0 ? (
          <div className="mt-2 space-y-2">
            {history.slice(0, 5).map((run) => (
              <div
                key={run.batch_id}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2"
              >
                <div>
                  <p className="text-sm text-foreground">
                    Payroll Run — Epoch {run.epoch_id}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {run.batch_id.slice(0, 16)}...
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      run.status === "anchored"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : run.status === "settled"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {run.status}
                  </span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {run.row_count} worker{run.row_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            No recent activity. Run your first payroll to see activity here.
          </p>
        )}
      </div>
    </div>
  );
}
