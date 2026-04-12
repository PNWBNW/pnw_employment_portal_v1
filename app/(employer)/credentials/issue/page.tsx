"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWorkerStore } from "@/src/stores/worker_store";
import { useCredentialStore } from "@/src/stores/credential_store";
import { useSessionStore } from "@/src/stores/session_store";
import {
  CREDENTIAL_TYPE_LABELS,
  type CredentialType,
} from "@/src/stores/credential_store";
import { issueCredential } from "@/src/credentials/credential_actions";
import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { useWalletSigner } from "@/components/key-manager/useWalletSigner";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import type { WalletExecuteFn } from "@/src/lib/wallet/wallet-executor";
import type { CredentialStatus } from "@/src/stores/credential_store";
import { fetchCredentialAuthForWorker } from "@/src/records/agreement_reader";

const CREDENTIAL_TYPES = Object.entries(CREDENTIAL_TYPE_LABELS) as [
  CredentialType,
  string,
][];

/**
 * Poll the wallet adapter for credential mint tx status and update the
 * credential store once the real Aleo tx id + confirmation land.
 *
 * Shield returns a wallet-internal id (shield_...) immediately; the real
 * at1... id appears after ~2 minutes of local proof generation. After
 * that, we wait one more poll for the "Accepted" status. On rejection,
 * we flip the credential to "revoked" and surface the error.
 */
async function pollCredentialStatus(
  walletTxId: string,
  walletTransactionStatus: (txId: string) => Promise<{
    status: string;
    transactionId?: string;
    error?: string;
  }>,
  credentialId: string,
  updateStatus: (
    id: string,
    status: CredentialStatus,
    revokeTxId?: string,
  ) => void,
): Promise<void> {
  const MAX_ATTEMPTS = 120; // ~6 minutes at 3s intervals
  const INTERVAL_MS = 3000;
  let realTxId: string | undefined;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await walletTransactionStatus(walletTxId);
      if (res?.transactionId?.startsWith("at1")) {
        realTxId = res.transactionId;
      }
      if (res?.status === "Accepted") {
        console.log(
          `[PNW-CRED] Mint confirmed after ${attempt} polls`,
          realTxId ? { tx: realTxId } : {},
        );
        updateStatus(credentialId, "active");
        return;
      }
      if (res?.status === "Rejected") {
        console.warn(
          `[PNW-CRED] Mint rejected after ${attempt} polls`,
          res.error,
        );
        // Leave in pending state — employer can retry
        return;
      }
    } catch (err) {
      console.warn("[PNW-CRED] Poll error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
  console.warn(
    `[PNW-CRED] Mint polling timed out after ${MAX_ATTEMPTS} attempts`,
  );
}

export default function IssueCredentialPage() {
  const router = useRouter();
  const workers = useWorkerStore((s) => s.workers);
  const employerAddr = useSessionStore((s) => s.address);
  const addCredential = useCredentialStore((s) => s.addCredential);
  const isIssuing = useCredentialStore((s) => s.isIssuing);
  const setIssuing = useCredentialStore((s) => s.setIssuing);
  const issueError = useCredentialStore((s) => s.issueError);
  const setIssueError = useCredentialStore((s) => s.setIssueError);
  const { canSign, signForCredential } = useWalletSigner();
  const {
    executeTransaction,
    transactionStatus: walletTransactionStatus,
    requestRecords,
  } = useWallet();
  const updateCredentialStatus = useCredentialStore((s) => s.updateCredentialStatus);

  const activeWorkers = workers.filter((w) => w.status === "active");

  const [workerAgreementId, setWorkerAgreementId] = useState("");
  const [credentialType, setCredentialType] =
    useState<CredentialType>("employment_verified");
  const [scope, setScope] = useState("");
  const [expiresEpoch, setExpiresEpoch] = useState("");
  const [commandPreview, setCommandPreview] = useState<string | null>(null);
  const [signatureProof, setSignatureProof] = useState<string | null>(null);

  const selectedWorker = workers.find((w) => w.agreement_id === workerAgreementId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIssueError(null);
    setCommandPreview(null);

    if (!selectedWorker) {
      setIssueError("Select a worker.");
      return;
    }
    if (!scope.trim()) {
      setIssueError("Scope is required.");
      return;
    }
    if (!employerAddr) {
      setIssueError("No active session. Please connect your wallet.");
      return;
    }
    if (!executeTransaction) {
      setIssueError("Wallet not connected. Connect a wallet first.");
      return;
    }
    if (!requestRecords) {
      setIssueError(
        "Wallet doesn't expose requestRecords — cannot fetch the FinalAgreement needed to authorize this mint.",
      );
      return;
    }

    setIssuing(true);
    try {
      const currentEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // rough epoch

      // Derive employer_name_hash from address (same domain tag as onboarding)
      const employerNameHash = toHex(
        domainHash(DOMAIN_TAGS.NAME, new TextEncoder().encode(employerAddr)),
      );

      // Fetch the authorization material from the employer's wallet —
      // credential_nft_v3::mint_credential_nft requires the four fields
      // that prove the caller holds an active FinalAgreement with this
      // worker. If no matching record is found, the mint would fail
      // on-chain, so bail out early with a clean error.
      const auth = await fetchCredentialAuthForWorker(
        requestRecords,
        employerAddr,
        selectedWorker.worker_addr,
      );
      if (!auth) {
        setIssueError(
          "No active FinalAgreement record found in your wallet for this worker. Credentials can only be issued after the worker accepts an agreement and it reaches the ACTIVE state.",
        );
        setIssuing(false);
        return;
      }

      // Wrap the wallet adapter's executeTransaction so it passes
      // `privateFee: false` — same pattern as the settlement coordinator.
      // Without this Shield silently drops proof generation.
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

      const { credential, tx_id } = await issueCredential(
        {
          worker_addr: selectedWorker.worker_addr,
          worker_name_hash: selectedWorker.worker_name_hash,
          credential_type: credentialType,
          scope: scope.trim(),
          expires_epoch: expiresEpoch ? Number(expiresEpoch) : undefined,
        },
        employerAddr,
        employerNameHash,
        currentEpoch,
        auth,
        walletExecute,
      );

      // If wallet signing is available, get an off-chain signature proof
      // (stored alongside the credential for the PDF cert's integrity band)
      if (canSign) {
        try {
          const proof = await signForCredential(credential.credential_id);
          credential.signature_proof = proof.signature;
          setSignatureProof(proof.signature);
        } catch {
          // Wallet signing is optional — continue without it
        }
      }

      addCredential(credential);
      setCommandPreview(
        `Mint tx broadcast: ${tx_id}\nCredential ID: ${credential.credential_id}`,
      );

      // Fire-and-forget wallet status polling. Shield returns an internal
      // id (shield_...) from executeTransaction; the real Aleo at1... id
      // arrives ~2 minutes later once proof gen finishes. We poll the
      // wallet adapter for status transitions and flip the credential
      // from "pending" to "active" (or "revoked" if the tx is explicitly
      // rejected) as soon as the network confirms.
      if (walletTransactionStatus && !tx_id.startsWith("at1")) {
        void pollCredentialStatus(
          tx_id,
          walletTransactionStatus,
          credential.credential_id,
          updateCredentialStatus,
        );
      } else if (tx_id.startsWith("at1")) {
        // Wallet already gave us a real id; optimistically mark active
        updateCredentialStatus(credential.credential_id, "active", tx_id);
      }

      // Navigate to detail page after a short delay so user sees the tx id
      setTimeout(() => {
        router.push(
          `/credentials/${encodeURIComponent(credential.credential_id)}`,
        );
      }, 2500);
    } catch (err) {
      setIssueError(
        err instanceof Error ? err.message : "Failed to issue credential.",
      );
    } finally {
      setIssuing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/credentials"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Back to Credentials
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-foreground">
            Issue Credential
          </h1>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Worker selector */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Worker
            </label>
            {activeWorkers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active workers.{" "}
                <Link href="/workers" className="text-primary hover:underline">
                  Onboard workers first.
                </Link>
              </p>
            ) : (
              <select
                value={workerAgreementId}
                onChange={(e) => setWorkerAgreementId(e.target.value)}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a worker…</option>
                {activeWorkers.map((w) => (
                  <option key={w.agreement_id} value={w.agreement_id}>
                    {w.display_name ?? w.worker_addr.slice(0, 18) + "…"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Credential type */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Credential Type
            </label>
            <select
              value={credentialType}
              onChange={(e) =>
                setCredentialType(e.target.value as CredentialType)
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {CREDENTIAL_TYPES.map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Scope */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Scope
            </label>
            <input
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder="e.g. Full-time, WA State"
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Expiry epoch (optional) */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">
              Valid Through Epoch{" "}
              <span className="text-muted-foreground font-normal">
                (optional — leave blank for no expiry)
              </span>
            </label>
            <input
              type="number"
              value={expiresEpoch}
              onChange={(e) => setExpiresEpoch(e.target.value)}
              placeholder="Block height / epoch number"
              min={0}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {/* Error */}
          {issueError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {issueError}
            </p>
          )}

          {/* Command preview */}
          {commandPreview && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950">
              <p className="text-xs font-medium text-green-800 dark:text-green-300">
                Credential created{signatureProof ? " (wallet-signed)" : ""} — redirecting to detail page…
              </p>
              {signatureProof && (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                  Signed by wallet — private key never exposed
                </p>
              )}
              <p className="mt-1 break-all font-mono text-xs text-green-700 dark:text-green-400">
                {commandPreview}
              </p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isIssuing || activeWorkers.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isIssuing ? "Issuing…" : "Issue Credential"}
            </button>
            <Link
              href="/credentials"
              className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      {/* Privacy note */}
      <p className="text-xs text-muted-foreground">
        Credential hashes are computed client-side. No private data is
        transmitted. The on-chain transaction contains only commitment hashes.
      </p>
    </div>
  );
}
