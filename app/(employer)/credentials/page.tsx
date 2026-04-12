"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCredentialStore, rehydrateCredentials } from "@/src/stores/credential_store";
import type { CredentialRecord } from "@/src/stores/credential_store";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import { generateCredentialCertPdf } from "@/components/pdf/CredentialCertPDF";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { scanCredentialRecords } from "@/src/records/credential_scanner";
import { ENV } from "@/src/config/env";
import {
  CredentialCard,
  type CredentialCardHandle,
} from "@/components/credential-art/CredentialCard";
import { ExportCardButton } from "@/components/credential-art/ExportCardButton";
import { useWorkerStore } from "@/src/stores/worker_store";

function StatusBadge({ status }: { status: CredentialRecord["status"] }) {
  const styles = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function CredentialsPage() {
  const { address } = useAleoSession();
  const { requestRecords } = useWallet();
  const credentials = useCredentialStore((s) => s.credentials);
  const addCredential = useCredentialStore((s) => s.addCredential);
  const updateCredentialStatus = useCredentialStore((s) => s.updateCredentialStatus);
  const workers = useWorkerStore((s) => s.workers);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const scannedRef = useRef(false);

  // Rehydrate from session storage first (fast, shows pending mints
  // from the current tab before the on-chain scan completes)
  useEffect(() => {
    rehydrateCredentials();
  }, []);

  // Auto-scan the wallet for CredentialNFT records on first load AND
  // on a 30s interval so the list stays fresh as credentials get
  // broadcast + finalized without requiring a manual refresh. The
  // employer's wallet holds its own copy of every credential it minted
  // via the dual-record design, so the same scanner used by the worker
  // page works here too.
  useEffect(() => {
    if (!address || !requestRecords) return;
    if (!scannedRef.current) {
      scannedRef.current = true;
      void runScan();
    }
    const interval = setInterval(() => {
      void runScan();
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, requestRecords]);

  async function runScan() {
    if (!address || !requestRecords) return;
    setScanning(true);
    setScanError(null);
    try {
      const found = await scanCredentialRecords(
        requestRecords,
        address,
        ENV.ALEO_ENDPOINT,
      );
      const storeState = useCredentialStore.getState().credentials;
      const existingById = new Map(storeState.map((c) => [c.credential_id, c]));
      for (const cred of found) {
        const existing = existingById.get(cred.credential_id);
        if (!existing) {
          // New credential → add to store
          addCredential(cred);
        } else if (existing.status !== cred.status) {
          // Known credential whose on-chain status has changed (e.g.
          // pending → active after confirmation, or active → revoked
          // after the issuer flipped the public mapping). Sync the
          // store so the UI reflects the current truth.
          updateCredentialStatus(cred.credential_id, cred.status);
          console.log(
            `[PNW-CRED] Status updated: ${cred.credential_id.slice(0, 14)} ${existing.status} → ${cred.status}`,
          );
        }
      }
      setLastScanAt(Date.now());
    } catch (err) {
      setScanError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  // Only show credentials this employer actually issued (filters out any
  // stale worker-side records the wallet might also hold from a shared
  // test wallet)
  const myIssuedCredentials = address
    ? credentials.filter((c) => c.employer_addr === address)
    : credentials;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Credentials</h1>
          <p className="text-sm text-muted-foreground">
            Issue and manage employee credentials
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runScan}
            disabled={scanning}
            className="rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Refresh"}
          </button>
          <Link
            href="/credentials/issue"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
          >
            Issue Credential
          </Link>
        </div>
      </div>

      {scanError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Scan failed</p>
          <p className="mt-1 text-xs">{scanError}</p>
        </div>
      )}

      {lastScanAt !== null && !scanning && (
        <p className="text-xs text-muted-foreground">
          Last scan: {new Date(lastScanAt).toLocaleTimeString()} — {myIssuedCredentials.length}
          {" "}credential{myIssuedCredentials.length === 1 ? "" : "s"} on-chain.
        </p>
      )}

      {myIssuedCredentials.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {scanning
              ? "Scanning wallet for on-chain credentials…"
              : "No credentials issued yet."}
          </p>
          {!scanning && (
            <Link
              href="/credentials/issue"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Issue your first credential
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {myIssuedCredentials.map((cred) => {
            const workerMatch = workers.find(
              (w) => w.worker_addr === cred.worker_addr,
            );
            const workerDisplayName = workerMatch?.display_name
              ? (workerMatch.display_name.endsWith(".pnw")
                  ? workerMatch.display_name
                  : `${workerMatch.display_name}.pnw`)
              : `${cred.worker_addr.slice(0, 10)}…${cred.worker_addr.slice(-6)}`;
            return (
              <EmployerCredentialCardItem
                key={cred.credential_id}
                credential={cred}
                workerDisplayName={workerDisplayName}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single card item on the employer list — art + download + print + manage
// ---------------------------------------------------------------------------

function EmployerCredentialCardItem({
  credential,
  workerDisplayName,
}: {
  credential: CredentialRecord;
  workerDisplayName: string;
}) {
  const cardRef = useRef<CredentialCardHandle | null>(null);
  const shortId = credential.credential_id.slice(2, 14);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <CredentialCard
          ref={cardRef}
          credential={credential}
          workerName={workerDisplayName}
        />
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-foreground">
            {credential.credential_type_label}
          </span>
          <StatusBadge status={credential.status} />
        </div>

        <p className="truncate text-xs text-muted-foreground">
          Issued to{" "}
          <span className="font-medium text-foreground">
            {workerDisplayName}
          </span>
        </p>

        <div className="flex gap-2">
          <ExportCardButton
            cardRef={cardRef}
            fileName={`credential-${shortId}`}
            label="Download Image"
            className="flex-1 rounded-md border border-input px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          />
          <DownloadPDFButton
            generatePdf={() => generateCredentialCertPdf(credential)}
            fileName={`credential-cert-${shortId}`}
            label="Print Cert"
            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          />
        </div>

        <Link
          href={`/credentials/${encodeURIComponent(credential.credential_id)}`}
          className="text-center text-[11px] text-muted-foreground hover:text-foreground"
        >
          Manage / revoke →
        </Link>
      </div>
    </div>
  );
}
