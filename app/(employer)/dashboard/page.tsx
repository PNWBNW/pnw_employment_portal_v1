"use client";

import { useAleoSession } from "@/components/key-manager/useAleoSession";

export default function DashboardPage() {
  const { address } = useAleoSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Employer overview
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Connected Address</p>
          <p className="mt-1 font-mono text-xs text-card-foreground break-all">
            {address}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Active Workers</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">--</p>
          <p className="text-xs text-muted-foreground">Populated in E2</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">USDCx Balance</p>
          <p className="mt-1 text-2xl font-bold text-card-foreground">--</p>
          <p className="text-xs text-muted-foreground">Populated in E2</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-card-foreground">
          Quick Actions
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/payroll/new"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Run Payroll
          </a>
          <a
            href="/workers"
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            View Workers
          </a>
          <a
            href="/credentials"
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            Credentials
          </a>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-card-foreground">
          Recent Activity
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          No recent activity. Run your first payroll to see activity here.
        </p>
      </div>
    </div>
  );
}
