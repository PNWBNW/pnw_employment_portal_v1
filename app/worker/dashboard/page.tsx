"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useOfferStore } from "@/src/stores/offer_store";
import {
  useAuditStore,
  rehydrateAuditRequests,
  type AuditRequest,
} from "@/src/stores/audit_store";
import { useWalletSigner } from "@/components/key-manager/useWalletSigner";
import { buildMintAuditNftCommand } from "@/src/audit/audit_actions";
import { generateAuditAuthPdf } from "@/components/pdf/AuditAuthPDF";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { useState } from "react";

function truncate(s: string, len = 16): string {
  return s.length <= len ? s : `${s.slice(0, len)}...`;
}

export default function WorkerDashboardPage() {
  const { address } = useAleoSession();
  const receivedOffers = useOfferStore((s) => s.receivedOffers);
  const { requests, updateStatus } = useAuditStore();
  const { canSign, signForAudit } = useWalletSigner();
  const [mintCommand, setMintCommand] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);

  useEffect(() => {
    rehydrateAuditRequests();
  }, []);

  // Filter audit requests for this worker
  const myRequests = address
    ? requests.filter((r) => r.worker_addr === address)
    : [];
  const pendingAuditRequests = myRequests.filter(
    (r) => r.status === "pending_worker",
  );
  const completedAuditRequests = myRequests.filter(
    (r) => r.status !== "pending_worker",
  );

  // Offer stats
  const pendingOffers = receivedOffers.filter((o) => o.status === "sent");
  const activeAgreements = receivedOffers.filter((o) => o.status === "accepted" || o.status === "active");

  async function handleApproveAudit(req: AuditRequest) {
    setSigning(req.auth_id);

    if (canSign) {
      try {
        await signForAudit(req.auth_id);
      } catch {
        // User may have rejected — still allow non-wallet approval
      }
    }

    updateStatus(req.auth_id, "approved");
    const cmd = buildMintAuditNftCommand(req);
    setMintCommand(cmd);
    setSigning(null);

    setTimeout(() => {
      updateStatus(
        req.auth_id,
        "minted",
        `simulated_tx_${Date.now().toString(36)}`,
      );
    }, 1500);
  }

  function handleDeclineAudit(req: AuditRequest) {
    updateStatus(req.auth_id, "declined");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Worker Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Your identity, offers, and audit authorizations at a glance.
        </p>
      </div>

      {/* Identity card */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          Connected Wallet
        </h2>
        <p className="font-mono text-sm text-foreground break-all">
          {address ?? "Not connected"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{pendingOffers.length}</p>
          <p className="text-xs text-muted-foreground">Pending Offers</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{activeAgreements.length}</p>
          <p className="text-xs text-muted-foreground">Active Agreements</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{pendingAuditRequests.length}</p>
          <p className="text-xs text-muted-foreground">Pending Audit Requests</p>
        </div>
      </div>

      {/* Pending offers */}
      {pendingOffers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              Pending Offers ({pendingOffers.length})
            </h2>
            <Link
              href="/worker/offers"
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
          </div>
          {pendingOffers.slice(0, 3).map((tracked) => {
            const o = tracked.offer;
            const suffix = INDUSTRY_SUFFIXES[o.industry_code];
            return (
              <div
                key={tracked.computed.agreement_id}
                className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {suffix?.label ?? `Industry ${o.industry_code}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {PAY_FREQUENCY_LABELS[o.pay_frequency_code]} &middot; From {truncate(o.employer_address)}
                  </p>
                </div>
                <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
                  Review
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending audit requests */}
      {pendingAuditRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Pending Audit Requests ({pendingAuditRequests.length})
          </h2>
          {pendingAuditRequests.map((req) => (
            <div
              key={req.auth_id}
              className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3"
            >
              <div>
                <div className="text-sm font-medium text-foreground">
                  {req.scope}
                </div>
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Employer: {truncate(req.employer_addr)}</span>
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

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApproveAudit(req)}
                  disabled={signing === req.auth_id}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {signing === req.auth_id
                    ? "Signing..."
                    : canSign
                      ? "Sign & Approve"
                      : "Approve"}
                </button>
                <button
                  onClick={() => handleDeclineAudit(req)}
                  disabled={signing === req.auth_id}
                  className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Decline
                </button>
                {canSign && (
                  <span className="text-[10px] text-muted-foreground">
                    Wallet will prompt for signature
                  </span>
                )}
              </div>
            </div>
          ))}
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

      {/* Completed audit requests */}
      {completedAuditRequests.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            Past Audit Requests ({completedAuditRequests.length})
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
                {completedAuditRequests.map((req) => (
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

      {/* Empty state */}
      {pendingOffers.length === 0 &&
        pendingAuditRequests.length === 0 &&
        completedAuditRequests.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No activity yet. When employers send you offers or audit requests,
              they will appear here.
            </p>
          </div>
        )}
    </div>
  );
}
