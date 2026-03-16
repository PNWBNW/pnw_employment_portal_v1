"use client";

import { useEffect, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useAuditStore,
  rehydrateAuditRequests,
  type AuditRequest,
} from "@/src/stores/audit_store";
import { buildMintAuditNftCommand } from "@/src/audit/audit_actions";
import { generateAuditAuthPdf } from "@/components/pdf/AuditAuthPDF";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";

function truncate(s: string, len = 16): string {
  return s.length <= len ? s : `${s.slice(0, len)}...`;
}

export default function WorkerDashboardPage() {
  const { address } = useAleoSession();
  const { requests, updateStatus } = useAuditStore();
  const [mintCommand, setMintCommand] = useState<string | null>(null);

  useEffect(() => {
    rehydrateAuditRequests();
  }, []);

  // Filter requests for this worker
  const myRequests = address
    ? requests.filter((r) => r.worker_addr === address)
    : [];
  const pendingRequests = myRequests.filter(
    (r) => r.status === "pending_worker",
  );
  const otherRequests = myRequests.filter(
    (r) => r.status !== "pending_worker",
  );

  function handleApprove(req: AuditRequest) {
    updateStatus(req.auth_id, "approved");
    const cmd = buildMintAuditNftCommand(req);
    setMintCommand(cmd);
    // In production, this would trigger the actual on-chain NFT mint
    // via the Layer 2 adapter after both consents are recorded.
    // For MVP, we show the command and mark as approved.
    // Simulate mint completion after approval:
    setTimeout(() => {
      updateStatus(
        req.auth_id,
        "minted",
        `simulated_tx_${Date.now().toString(36)}`,
      );
    }, 1500);
  }

  function handleDecline(req: AuditRequest) {
    updateStatus(req.auth_id, "declined");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Worker Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          View pending audit requests and manage your authorizations.
        </p>
      </div>

      {/* Pending audit requests */}
      {pendingRequests.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Pending Audit Requests ({pendingRequests.length})
          </h2>
          {pendingRequests.map((req) => (
            <div
              key={req.auth_id}
              className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {req.scope}
                </div>
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>
                    Employer: {truncate(req.employer_addr)}
                  </span>
                  <span>
                    Auditor:{" "}
                    {req.auditor_display_name || truncate(req.auditor_addr)}
                  </span>
                  <span>
                    Epochs {req.epoch_from}–{req.epoch_to}
                  </span>
                  {req.expires_epoch && (
                    <span>Expires: epoch {req.expires_epoch}</span>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-yellow-300 bg-yellow-100 p-3">
                <p className="text-xs text-yellow-800">
                  By approving, you authorize the auditor to view your payroll
                  records for the specified epoch range. An AuditAuthorizationNFT
                  will be minted on-chain as proof of dual consent.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(req)}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Approve
                </button>
                <button
                  onClick={() => handleDecline(req)}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No pending audit requests.
          </p>
        </div>
      )}

      {/* Mint command preview */}
      {mintCommand && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            NFT Mint Command
          </h3>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {mintCommand}
          </pre>
        </div>
      )}

      {/* Completed requests */}
      {otherRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Past Requests ({otherRequests.length})
          </h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Scope
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Auditor
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {otherRequests.map((req) => (
                  <tr key={req.auth_id} className="border-b last:border-0">
                    <td className="px-4 py-3">{req.scope}</td>
                    <td className="px-4 py-3">
                      {req.auditor_display_name || (
                        <span className="font-mono text-xs">
                          {truncate(req.auditor_addr)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          req.status === "minted"
                            ? "bg-green-100 text-green-800"
                            : req.status === "approved"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {req.status === "minted"
                          ? "Authorized"
                          : req.status === "approved"
                            ? "Approved"
                            : "Declined"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {req.status === "minted" && (
                        <DownloadPDFButton
                          label="Print Cert"
                          fileName={`audit-auth-${req.auth_id.slice(0, 12)}`}
                          generatePdf={() => generateAuditAuthPdf(req)}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
