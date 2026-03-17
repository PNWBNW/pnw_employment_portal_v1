"use client";

import { useState, useEffect } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { queryEmployerVerified } from "@/src/registry/name_registry";
import { PROGRAMS } from "@/src/config/programs";
import { ENV } from "@/src/config/env";

/**
 * Dev-only page for testnet employer license verification.
 *
 * The on-chain contracts require employer_license_registry.aleo/assert_verified(caller)
 * for all employer actions. This page shows:
 *   - Current verification status
 *   - The set_verified command for the AUTHORITY to run
 *
 * No license upload, no forms — just a status check and a command to copy.
 */
export default function VerifyEmployerPage() {
  const { address } = useAleoSession();
  const [verified, setVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    setLoading(true);
    queryEmployerVerified(address)
      .then(setVerified)
      .finally(() => setLoading(false));
  }, [address]);

  if (ENV.NETWORK !== "testnet") {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">This page is only available on testnet.</p>
      </div>
    );
  }

  const authorityAddress = "aleo1s8t86aza932zah3mv5knclvnn5zy4gedpl5a4wn5h2yrt08mxqzsw5amdd";

  // Build the snarkos command the AUTHORITY needs to run
  const setVerifiedCmd = address
    ? `snarkos developer execute ${PROGRAMS.layer1.employer_license_registry} set_verified ` +
      `${address} 0field true`
    : "Connect wallet first";

  return (
    <div className="mx-auto max-w-xl space-y-6 py-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Employer License Verification (Dev)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Testnet tool — check and manage your employer verification status.
        </p>
      </div>

      {/* Status */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Verification Status
        </h3>

        {loading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm text-muted-foreground">Checking...</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {verified ? (
              <>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20 text-green-400 text-sm">
                  &#10003;
                </span>
                <span className="text-sm font-medium text-green-400">Verified</span>
              </>
            ) : (
              <>
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500/20 text-red-400 text-sm">
                  &#10007;
                </span>
                <span className="text-sm font-medium text-red-400">Not Verified</span>
              </>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground font-mono break-all">
          Wallet: {address ?? "not connected"}
        </div>
      </div>

      {/* Command for AUTHORITY */}
      {!verified && address && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            AUTHORITY Verification Command
          </h3>
          <p className="text-xs text-muted-foreground">
            The PNW AUTHORITY must run this command to verify your wallet. Copy and send to the
            testnet operator, or run it yourself if you have access to the AUTHORITY private key.
          </p>

          <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
            {setVerifiedCmd}
          </pre>

          <button
            onClick={() => navigator.clipboard.writeText(setVerifiedCmd)}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
          >
            Copy Command
          </button>

          <div className="mt-2 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-blue-300">
              AUTHORITY address: <span className="font-mono">{authorityAddress.slice(0, 20)}...{authorityAddress.slice(-8)}</span>
            </p>
            <p className="text-xs text-blue-300 mt-1">
              Program: {PROGRAMS.layer1.employer_license_registry}
            </p>
          </div>
        </div>
      )}

      {/* Already verified */}
      {verified && (
        <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
          <p className="text-xs text-green-400">
            Your wallet is verified. You can register employer .pnw names and create profiles.
          </p>
        </div>
      )}
    </div>
  );
}
