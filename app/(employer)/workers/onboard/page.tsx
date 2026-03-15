"use client";

import Link from "next/link";

export default function OnboardWorkerPage() {
  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/workers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Workers
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Onboard Worker
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a job offer and generate a QR code for the worker
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Worker onboarding QR flow will be built in a future phase.
          This will generate a QR code the worker scans to accept the
          employment agreement on-chain.
        </p>
      </div>
    </div>
  );
}
