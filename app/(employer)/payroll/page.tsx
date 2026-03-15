"use client";

export default function PayrollHistoryPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Payroll History
        </h1>
        <p className="text-sm text-muted-foreground">
          View past payroll runs and their statuses
        </p>
      </div>
      <div className="flex gap-2">
        <a
          href="/payroll/new"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          New Payroll Run
        </a>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Payroll history will be populated in Phase E6.
        </p>
      </div>
    </div>
  );
}
