"use client";

import { use, useRef, useState } from "react";
import Link from "next/link";
import { useCredentialStore } from "@/src/stores/credential_store";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import { generateCredentialCertPdf } from "@/components/pdf/CredentialCertPDF";
import { revokeCredentialByIssuer } from "@/src/credentials/credential_actions";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import type { WalletExecuteFn } from "@/src/lib/wallet/wallet-executor";
import {
  CredentialCard,
  type CredentialCardHandle,
} from "@/components/credential-art/CredentialCard";
import { ExportCardButton } from "@/components/credential-art/ExportCardButton";
import { useWorkerStore } from "@/src/stores/worker_store";

function truncate(s: string, len = 20): string {
  if (s.length <= len) return s;
  return `${s.slice(0, 12)}...${s.slice(-8)}`;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-sm break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export default function CredentialDetailPage({
  params,
}: {
  params: Promise<{ credential_id: string }>;
}) {
  const { credential_id } = use(params);
  const decodedId = decodeURIComponent(credential_id);

  const credentials = useCredentialStore((s) => s.credentials);
  const updateCredentialStatus = useCredentialStore((s) => s.updateCredentialStatus);
  const { executeTransaction } = useWallet();
  const workers = useWorkerStore((s) => s.workers);

  const cred = credentials.find((c) => c.credential_id === decodedId);

  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revokeCommand, setRevokeCommand] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  // Ref to the credential card canvas for PNG export
  const cardRef = useRef<CredentialCardHandle | null>(null);

  // Resolve a display name for the worker this credential was issued to.
  // Prefer the .pnw display name if the employer has it in their worker
  // store (set at onboarding); fall back to a truncated wallet address.
  const workerDisplayName = (() => {
    if (!cred) return "worker.pnw";
    const match = workers.find((w) => w.worker_addr === cred.worker_addr);
    if (match?.display_name) {
      return match.display_name.endsWith(".pnw")
        ? match.display_name
        : `${match.display_name}.pnw`;
    }
    return `${cred.worker_addr.slice(0, 10)}…${cred.worker_addr.slice(-6)}`;
  })();

  if (!cred) {
    return (
      <div className="space-y-4">
        <Link
          href="/credentials"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Credentials
        </Link>
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Credential not found. It may have expired from your session.
          </p>
        </div>
      </div>
    );
  }

  async function handleRevoke() {
    if (!cred) return;
    if (!executeTransaction) {
      setRevokeError("Wallet not connected. Connect a wallet first.");
      return;
    }
    setRevoking(true);
    setRevokeError(null);

    try {
      // Wrap wallet executeTransaction with privateFee: false (Shield quirk)
      const walletExecute: WalletExecuteFn = async (params) => {
        const result = await executeTransaction({
          program: params.program,
          function: params.function,
          inputs: params.inputs,
          fee: params.fee,
          privateFee: false,
        });
        const txId = typeof result === "string"
          ? result
          : (result as Record<string, unknown>)?.transactionId as string
            ?? (result as Record<string, unknown>)?.id as string
            ?? String(result);
        return txId;
      };

      // Call credential_nft_v2::revoke_by_issuer(credential_id)
      // This flips the public credential_status mapping to REVOKED without
      // consuming either record copy. Both wallets (employer + worker) keep
      // their CredentialNFT record but the portal renders them as revoked
      // when the scanner reads the public status.
      const { tx_id } = await revokeCredentialByIssuer(cred, walletExecute);

      setRevokeCommand(`revoke_by_issuer broadcast: ${tx_id}`);
      updateCredentialStatus(cred.credential_id, "revoked", tx_id);
      setConfirmRevoke(false);
    } catch (err) {
      setRevokeError(
        err instanceof Error ? err.message : "Revocation failed.",
      );
    } finally {
      setRevoking(false);
    }
  }

  const isActive = cred.status === "active" || cred.status === "pending";

  const statusColors = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/credentials"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Credentials
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            {cred.credential_type_label}
          </h1>
          <p className="text-sm text-muted-foreground">{cred.scope}</p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColors[cred.status]}`}
        >
          {cred.status.toUpperCase()}
        </span>
      </div>

      {/* Generative credential card + PNG export */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-foreground">
          Credential Card
        </h2>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-xl border border-border bg-card p-3 shadow-sm">
            <CredentialCard
              ref={cardRef}
              credential={cred}
              workerName={workerDisplayName}
            />
          </div>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:pt-2">
            <p>
              Generative blueprint derived deterministically from the
              credential hash. Same credential always produces the same
              image, pixel-for-pixel.
            </p>
            <p>
              This is the exact image{" "}
              <span className="font-medium text-foreground">
                {workerDisplayName}
              </span>{" "}
              will see in their worker portal under Credentials.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <ExportCardButton
                cardRef={cardRef}
                fileName={`credential-${cred.credential_id.slice(2, 14)}`}
                label="Download Image"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              />
              <DownloadPDFButton
                generatePdf={() => generateCredentialCertPdf(cred)}
                fileName={`credential-cert-${cred.credential_id.slice(0, 12)}`}
                label="Print Certificate"
                className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium text-foreground">
          Credential Details
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Credential ID"
            value={truncate(cred.credential_id, 28)}
            mono
          />
          <Field label="Credential Type" value={cred.credential_type_label} />
          <Field label="Scope" value={cred.scope} />
          <Field
            label="Valid Through"
            value={
              cred.expires_epoch ? `Epoch ${cred.expires_epoch}` : "No Expiry"
            }
          />
          <Field label="Issued Epoch" value={String(cred.issued_epoch)} />
          <Field
            label="Worker Address"
            value={truncate(cred.worker_addr, 24)}
            mono
          />
          <Field
            label="Subject Hash"
            value={truncate(cred.subject_hash, 28)}
            mono
          />
          <Field
            label="Issuer Hash"
            value={truncate(cred.issuer_hash, 28)}
            mono
          />
          <Field
            label="Scope Hash"
            value={truncate(cred.scope_hash, 28)}
            mono
          />
          <Field
            label="Doc Hash"
            value={truncate(cred.doc_hash, 28)}
            mono
          />
          {cred.tx_id && (
            <div>
              <p className="text-xs text-muted-foreground">Transaction ID</p>
              <a
                href={`https://explorer.provable.com/transaction/${cred.tx_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 block break-all font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {truncate(cred.tx_id, 28)}
              </a>
            </div>
          )}
          {cred.revoke_tx_id && (
            <div>
              <p className="text-xs text-muted-foreground">Revoke TX</p>
              <p className="mt-0.5 break-all font-mono text-sm">
                {truncate(cred.revoke_tx_id, 28)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Revoke command feedback */}
      {revokeCommand && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 dark:border-orange-900 dark:bg-orange-950">
          <p className="text-xs font-medium text-orange-800 dark:text-orange-300">
            Revocation command (pending pnw_mvp_v2 sync for live execution):
          </p>
          <p className="mt-1 break-all font-mono text-xs text-orange-700 dark:text-orange-400">
            {revokeCommand}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">Actions</h2>

        {isActive && !confirmRevoke && (
          <button
            onClick={() => setConfirmRevoke(true)}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
          >
            Revoke Credential
          </button>
        )}

        {confirmRevoke && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Revoke on testnet?
            </span>
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700 disabled:opacity-50"
            >
              {revoking ? "Revoking…" : "Confirm Revoke"}
            </button>
            <button
              onClick={() => setConfirmRevoke(false)}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        )}

        {revokeError && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {revokeError}
          </span>
        )}
      </div>
    </div>
  );
}
