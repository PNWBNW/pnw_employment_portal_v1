"use client";

/**
 * Worker Credentials — gallery of generative-art credential cards.
 *
 * Pulls the connected worker's on-chain CredentialNFT records via the
 * wallet adapter + `scanCredentialRecords`, then renders each one through
 * `<CredentialCard>` (the topographic blueprint art) with download and
 * PDF export actions underneath.
 *
 * The credential records come from `credential_nft_v2.aleo`, which emits
 * a worker-owned copy of each credential at mint time so the worker's
 * wallet picks them up automatically on scan. Public status (active /
 * revoked) is cross-referenced from the on-chain `credential_status`
 * mapping, so revoked credentials render in grayscale.
 */

import { useEffect, useRef, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useWorkerIdentityStore } from "@/src/stores/worker_identity_store";
import {
  useCredentialStore,
  type CredentialRecord,
} from "@/src/stores/credential_store";
import { scanCredentialRecords } from "@/src/records/credential_scanner";
import { ENV } from "@/src/config/env";
import {
  CredentialCard,
  type CredentialCardHandle,
} from "@/components/credential-art/CredentialCard";
import { ExportCardButton } from "@/components/credential-art/ExportCardButton";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import { generateCredentialCertPdf } from "@/components/pdf/CredentialCertPDF";

export default function WorkerCredentialsPage() {
  const { address } = useAleoSession();
  const { requestRecords } = useWallet();
  const chosenName = useWorkerIdentityStore((s) => s.chosenName);

  // Credentials in the worker's local store get rehydrated from the
  // on-chain scan. We also allow manual refresh via a button.
  const credentials = useCredentialStore((s) => s.credentials);
  const addCredential = useCredentialStore((s) => s.addCredential);
  const updateCredentialStatus = useCredentialStore((s) => s.updateCredentialStatus);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const scannedRef = useRef(false);

  // Derive worker display name — fall back to truncated address if no .pnw
  // name is registered yet.
  const workerName =
    chosenName && chosenName.length > 0
      ? chosenName.endsWith(".pnw")
        ? chosenName
        : `${chosenName}.pnw`
      : address
        ? `${address.slice(0, 10)}…${address.slice(-6)}`
        : "worker.pnw";

  // Filter store credentials to only the ones owned by the connected worker
  // (the store may also contain credentials the user has issued as employer
  // in another tab — those would have a different worker_addr).
  const myCredentials: CredentialRecord[] = credentials.filter(
    (c) => address && c.worker_addr === address,
  );

  // Auto-scan on first visit AND on a 30s interval so newly-minted
  // credentials show up without a manual refresh, and status changes
  // (e.g. pending → active after confirmation, active → revoked after
  // the employer revokes) propagate automatically.
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
      // Sync the store: add new credentials, update changed statuses.
      // Use getState() so we read the LATEST store contents each time
      // (the `credentials` closure captures the first render's snapshot).
      const storeState = useCredentialStore.getState().credentials;
      const existingById = new Map(storeState.map((c) => [c.credential_id, c]));
      for (const cred of found) {
        const existing = existingById.get(cred.credential_id);
        if (!existing) {
          addCredential(cred);
        } else if (existing.status !== cred.status) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Your Credentials
          </h1>
          <p className="text-sm text-muted-foreground">
            Credentials issued to {workerName}. Each card is a generative
            blueprint unique to the credential hash.
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="rounded-md border border-input px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Refresh"}
        </button>
      </div>

      {scanError && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Scan failed</p>
          <p className="mt-1 text-xs">{scanError}</p>
        </div>
      )}

      {lastScanAt !== null && !scanning && (
        <p className="text-xs text-muted-foreground">
          Last scan: {new Date(lastScanAt).toLocaleTimeString()} — found{" "}
          {myCredentials.length} credential
          {myCredentials.length === 1 ? "" : "s"}.
        </p>
      )}

      {myCredentials.length === 0 && !scanning ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No credentials issued to you yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Ask your employer to issue one via their credentials page. When
            they do, a copy of the credential will be minted directly to your
            wallet and appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {myCredentials.map((cred) => (
            <CredentialCardItem
              key={cred.credential_id}
              credential={cred}
              workerName={workerName}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single card item with its own export actions
// ---------------------------------------------------------------------------

function CredentialCardItem({
  credential,
  workerName,
}: {
  credential: CredentialRecord;
  workerName: string;
}) {
  const cardRef = useRef<CredentialCardHandle | null>(null);

  // PDF filename + short id for downloads
  const shortId = credential.credential_id.slice(2, 14);
  const imageFileName = `credential-${shortId}`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <CredentialCard
          ref={cardRef}
          credential={credential}
          workerName={workerName}
        />
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {credential.credential_type_label}
          </span>
          <span
            className={
              credential.status === "active"
                ? "text-green-600 dark:text-green-400"
                : credential.status === "revoked"
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
            }
          >
            ● {credential.status}
          </span>
        </div>

        <p className="truncate text-xs text-muted-foreground">
          {credential.scope}
        </p>

        <div className="flex gap-2">
          <ExportCardButton
            cardRef={cardRef}
            fileName={imageFileName}
            label="Download Image"
            className="flex-1 rounded-md border border-input px-3 py-1.5 text-xs text-foreground hover:bg-accent"
          />
          <DownloadPDFButton
            generatePdf={() => generateCredentialCertPdf(credential)}
            fileName={`${imageFileName}-cert`}
            label="Print Certificate"
            className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90"
          />
        </div>
      </div>
    </div>
  );
}
