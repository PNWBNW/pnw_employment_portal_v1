"use client";

import { useEffect } from "react";
import Link from "next/link";
import {
  useAuditStore,
  rehydrateAuditRequests,
} from "@/src/stores/audit_store";

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending_worker: {
    label: "Pending Worker",
    className: "bg-yellow-100 text-yellow-800",
  },
  approved: {
    label: "Approved",
    className: "bg-blue-100 text-blue-800",
  },
  declined: {
    label: "Declined",
    className: "bg-red-100 text-red-800",
  },
  minted: {
    label: "Authorized",
    className: "bg-green-100 text-green-800",
  },
};

function truncate(s: string, len = 16): string {
  return s.length <= len ? s : `${s.slice(0, len)}...`;
}

export default function AuditPage() {
  const requests = useAuditStore((s) => s.requests);

  useEffect(() => {
    rehydrateAuditRequests();
  }, []);

  const pending = requests.filter((r) => r.status === "pending_worker");
  const completed = requests.filter((r) => r.status !== "pending_worker");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Audit Authorization
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage audit requests and authorizations
          </p>
        </div>
        <Link
          href="/audit/request"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Audit Request
        </Link>
      </div>

      {/* Pending requests */}
      {pending.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Pending Worker Consent ({pending.length})
          </h2>
          <div className="space-y-2">
            {pending.map((req) => (
              <div
                key={req.auth_id}
                className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 p-4"
              >
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    {req.scope}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Worker: {truncate(req.worker_addr)}</span>
                    <span>Auditor: {req.auditor_display_name || truncate(req.auditor_addr)}</span>
                    <span>
                      Epochs {req.epoch_from}–{req.epoch_to}
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                  Awaiting Worker
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed / all requests table */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          All Requests ({requests.length})
        </h2>
        {requests.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No audit requests yet.{" "}
              <Link
                href="/audit/request"
                className="text-primary hover:underline"
              >
                Create your first request
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Scope
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Worker
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Auditor
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Epochs
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">
                    TX
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const badge = STATUS_BADGES[req.status] ?? {
                    label: req.status,
                    className: "bg-gray-100 text-gray-800",
                  };
                  return (
                    <tr key={req.auth_id} className="border-b last:border-0">
                      <td className="px-4 py-3">{req.scope}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {truncate(req.worker_addr)}
                      </td>
                      <td className="px-4 py-3">
                        {req.auditor_display_name || (
                          <span className="font-mono text-xs">
                            {truncate(req.auditor_addr)}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {req.epoch_from}–{req.epoch_to}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {req.tx_id ? truncate(req.tx_id, 12) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Disclosure key section */}
      {completed.some((r) => r.status === "minted") && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">
            Share Disclosure Key
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            For authorized audits, provide your scoped view key to the auditor.
            The view key allows the auditor to decode payroll records within the
            authorized epoch range only.
          </p>
          <button
            onClick={() => {
              const viewKey = sessionStorage.getItem("pnw_session");
              if (viewKey) {
                try {
                  const parsed = JSON.parse(viewKey);
                  if (parsed.viewKey) {
                    navigator.clipboard.writeText(parsed.viewKey);
                  }
                } catch { /* ignore */ }
              }
            }}
            className="mt-3 rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
          >
            Copy View Key to Clipboard
          </button>
        </div>
      )}
    </div>
  );
}
