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

function truncate(s: string, len = 16): string {
  if (s.length <= len) return s;
  return `${s.slice(0, 10)}...${s.slice(-6)}`;
}

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

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const scannedRef = useRef(false);

  // Rehydrate from session storage first (fast, shows pending mints
  // from the current tab before the on-chain scan completes)
  useEffect(() => {
    rehydrateCredentials();
  }, []);

  // Auto-scan the wallet for CredentialNFT records on first load. The
  // employer's wallet holds its own copy of every credential it minted
  // via the dual-record design, so the same scanner used by the worker
  // page works here too.
  useEffect(() => {
    if (scannedRef.current) return;
    if (!address || !requestRecords) return;
    scannedRef.current = true;
    void runScan();
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
      const existing = new Set(
        useCredentialStore.getState().credentials.map((c) => c.credential_id),
      );
      for (const cred of found) {
        if (!existing.has(cred.credential_id)) {
          addCredential(cred);
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
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Scope</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Worker</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Issued Epoch</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {myIssuedCredentials.map((cred) => (
                <tr key={cred.credential_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{cred.credential_type_label}</td>
                  <td className="px-4 py-2 text-muted-foreground">{cred.scope}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {truncate(cred.worker_addr)}
                  </td>
                  <td className="px-4 py-2">{cred.issued_epoch}</td>
                  <td className="px-4 py-2">
                    <StatusBadge status={cred.status} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/credentials/${encodeURIComponent(cred.credential_id)}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Manage
                      </Link>
                      <DownloadPDFButton
                        generatePdf={() => generateCredentialCertPdf(cred)}
                        fileName={`credential-${cred.credential_id.slice(0, 12)}`}
                        label="Print Cert"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
