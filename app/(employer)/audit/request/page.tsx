"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWorkerStore, type WorkerRecord } from "@/src/stores/worker_store";
import { useAuditStore } from "@/src/stores/audit_store";
import {
  createAuditRequest,
  buildMintAuditNftCommand,
  type AuditRequestInput,
} from "@/src/audit/audit_actions";

function truncate(s: string, len = 20): string {
  return s.length <= len ? s : `${s.slice(0, len)}...`;
}

export default function AuditRequestPage() {
  const { address } = useAleoSession();
  const workers = useWorkerStore((s) => s.workers);
  const { addRequest, setSubmitting, setError, isSubmitting, error } =
    useAuditStore();
  const router = useRouter();

  // Form state
  const [workerAddr, setWorkerAddr] = useState("");
  const [auditorAddr, setAuditorAddr] = useState("");
  const [auditorName, setAuditorName] = useState("");
  const [scope, setScope] = useState("");
  const [epochFrom, setEpochFrom] = useState("");
  const [epochTo, setEpochTo] = useState("");
  const [expiresEpoch, setExpiresEpoch] = useState("");
  const [commandPreview, setCommandPreview] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Auto-generate scope from epoch range
  useEffect(() => {
    if (epochFrom && epochTo && !scope) {
      setScope(`Payroll epochs ${epochFrom}–${epochTo}`);
    }
  }, [epochFrom, epochTo, scope]);

  const activeWorkers = workers.filter((w) => w.status === "active");

  function validate(): string | null {
    if (!workerAddr) return "Worker is required";
    if (!auditorAddr) return "Auditor address is required";
    if (!auditorAddr.startsWith("aleo1"))
      return "Auditor address must start with aleo1";
    if (!scope) return "Scope description is required";
    if (!epochFrom) return "Start epoch is required";
    if (!epochTo) return "End epoch is required";
    const from = Number(epochFrom);
    const to = Number(epochTo);
    if (isNaN(from) || isNaN(to)) return "Epochs must be numbers";
    if (from >= to) return "Start epoch must be before end epoch";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!address) {
      setError("No active session");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const input: AuditRequestInput = {
        worker_addr: workerAddr,
        auditor_addr: auditorAddr,
        auditor_display_name: auditorName || undefined,
        scope,
        epoch_from: Number(epochFrom),
        epoch_to: Number(epochTo),
        expires_epoch: expiresEpoch ? Number(expiresEpoch) : undefined,
      };

      const { request, command_preview } = createAuditRequest(input, address);
      addRequest(request);
      setCommandPreview(command_preview);
      setSubmitted(true);

      // Redirect after a brief delay
      setTimeout(() => {
        router.push("/audit");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create request");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted && commandPreview) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Audit Request Created
          </h1>
          <p className="text-sm text-muted-foreground">
            The request is pending worker consent. Share the request details with
            the worker.
          </p>
        </div>

        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Request saved. Waiting for worker approval.
          </p>
          <p className="mt-1 text-xs text-green-700">
            Redirecting to audit log...
          </p>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Command Preview (after worker consent)
          </h3>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {commandPreview}
          </pre>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            Mint Command (after dual consent)
          </h3>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {commandPreview}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Request Audit Authorization
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a dual-consent audit request. The worker must approve before the
          AuditAuthorizationNFT can be minted.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
        {/* Worker selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Worker</label>
          {activeWorkers.length > 0 ? (
            <select
              value={workerAddr}
              onChange={(e) => setWorkerAddr(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Select worker...</option>
              {activeWorkers.map((w) => (
                <option key={w.agreement_id} value={w.worker_addr}>
                  {w.display_name || truncate(w.worker_addr)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              placeholder="aleo1..."
              value={workerAddr}
              onChange={(e) => setWorkerAddr(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            />
          )}
        </div>

        {/* Auditor address */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Auditor Address
          </label>
          <input
            type="text"
            placeholder="aleo1..."
            value={auditorAddr}
            onChange={(e) => setAuditorAddr(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
        </div>

        {/* Auditor display name (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Auditor Display Name{" "}
            <span className="text-muted-foreground">(optional, for PDF)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Smith & Associates CPA"
            value={auditorName}
            onChange={(e) => setAuditorName(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Epoch range */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Start Epoch
            </label>
            <input
              type="text"
              placeholder="20260101"
              value={epochFrom}
              onChange={(e) => setEpochFrom(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              End Epoch
            </label>
            <input
              type="text"
              placeholder="20260301"
              value={epochTo}
              onChange={(e) => setEpochTo(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Scope */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Scope Description
          </label>
          <input
            type="text"
            placeholder="e.g. Payroll epochs 20260101–20260301"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Expiry (optional) */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">
            Expiry Epoch{" "}
            <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="Block height (leave empty for no expiry)"
            value={expiresEpoch}
            onChange={(e) => setExpiresEpoch(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/audit")}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? "Creating..." : "Create Audit Request"}
          </button>
        </div>
      </form>
    </div>
  );
}
