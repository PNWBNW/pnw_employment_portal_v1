"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useCredentialStore, rehydrateCredentials } from "@/src/stores/credential_store";
import type { CredentialRecord } from "@/src/stores/credential_store";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import { generateCredentialCertPdf } from "@/components/pdf/CredentialCertPDF";

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
  const credentials = useCredentialStore((s) => s.credentials);

  useEffect(() => {
    rehydrateCredentials();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Credentials</h1>
          <p className="text-sm text-muted-foreground">
            Issue and manage employee credentials
          </p>
        </div>
        <Link
          href="/credentials/issue"
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Issue Credential
        </Link>
      </div>

      {credentials.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No credentials issued yet.
          </p>
          <Link
            href="/credentials/issue"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            Issue your first credential
          </Link>
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
              {credentials.map((cred) => (
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
