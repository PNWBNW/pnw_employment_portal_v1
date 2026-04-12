"use client";

/**
 * Worker Paystubs — payment receipts from on-chain records.
 *
 * Scans the connected worker's wallet for WorkerPaystubReceipt records
 * via the wallet adapter's requestRecords. No view key required — the
 * wallet decrypts the records automatically since they're owned by the
 * connected address.
 *
 * Each paystub shows gross, tax, fee, net amounts in USDCx minor units
 * converted to dollars, plus the epoch, employer address, and a link to
 * the on-chain transaction.
 */

import { useEffect, useRef, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useWorkerIdentityStore } from "@/src/stores/worker_identity_store";
import {
  scanWorkerPaystubs,
  type WorkerPaystub,
} from "@/src/records/worker_paystub_scanner";
import { DownloadPDFButton } from "@/components/pdf/DownloadPDFButton";
import {
  generatePaystubPdf,
  type PaystubPdfInput,
} from "@/components/pdf/PaystubPDF";
import type {
  PayrollRunManifest,
  PayrollRow,
} from "@/src/manifest/types";

function formatUsd(minorUnits: string | number): string {
  const raw = typeof minorUnits === "string" ? parseInt(minorUnits, 10) : minorUnits;
  if (isNaN(raw)) return "$0.00";
  const dollars = raw / 1_000_000;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function truncate(s: string, len = 16): string {
  return s.length <= len ? s : `${s.slice(0, 10)}…${s.slice(-6)}`;
}

function formatEpoch(epoch: number): string {
  // If epoch looks like unix seconds (> 1_000_000_000), show a date
  if (epoch > 1_000_000_000) {
    return new Date(epoch * 1000).toLocaleDateString();
  }
  // Legacy YYYYMMDD format
  if (epoch > 19700101 && epoch < 99999999) {
    const y = Math.floor(epoch / 10000);
    const m = Math.floor((epoch % 10000) / 100);
    const d = epoch % 100;
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return String(epoch);
}

export default function WorkerPaystubsPage() {
  const { address } = useAleoSession();
  const { requestRecords } = useWallet();
  const chosenName = useWorkerIdentityStore((s) => s.chosenName);

  const [paystubs, setPaystubs] = useState<WorkerPaystub[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const lastScannedAddrRef = useRef<string | null>(null);

  const workerName =
    chosenName && chosenName.length > 0
      ? chosenName.endsWith(".pnw")
        ? chosenName
        : `${chosenName}.pnw`
      : address
        ? truncate(address)
        : "worker";

  // Auto-scan on first visit + 30s interval.
  // Reset and re-scan immediately when the connected address changes
  // so we never show stale paystubs from a previous wallet session.
  useEffect(() => {
    if (!address || !requestRecords) return;

    // Address changed — clear previous wallet's data and force re-scan
    if (lastScannedAddrRef.current !== address) {
      lastScannedAddrRef.current = address;
      setPaystubs([]);
      setLastScanAt(null);
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
    setError(null);
    try {
      const found = await scanWorkerPaystubs(requestRecords, address);
      setPaystubs(found);
      setLastScanAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setScanning(false);
    }
  }

  // YTD totals
  const totalGross = paystubs.reduce(
    (s, p) => s + BigInt(p.gross_amount),
    0n,
  );
  const totalTax = paystubs.reduce(
    (s, p) => s + BigInt(p.tax_withheld),
    0n,
  );
  const totalFee = paystubs.reduce(
    (s, p) => s + BigInt(p.fee_amount),
    0n,
  );
  const totalNet = paystubs.reduce(
    (s, p) => s + BigInt(p.net_amount),
    0n,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            My Paystubs
          </h1>
          <p className="text-sm text-muted-foreground">
            Payment receipts for {workerName} — scanned from your wallet.
            No view key required.
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

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">Scan failed</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}

      {lastScanAt !== null && !scanning && (
        <p className="text-xs text-muted-foreground">
          Last scan: {new Date(lastScanAt).toLocaleTimeString()} —{" "}
          {paystubs.length} paystub{paystubs.length === 1 ? "" : "s"} found.
        </p>
      )}

      {!scanning && paystubs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No paystub records found.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Paystubs appear here automatically after your employer runs
            payroll and the settlement is confirmed on-chain. Each payroll
            run mints a private WorkerPaystubReceipt record directly to
            your wallet.
          </p>
        </div>
      ) : paystubs.length > 0 && (
        <>
          {/* Paystub table */}
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Employer
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                    Gross
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                    Tax
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                    Fee
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">
                    Net
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {paystubs.map((ps, idx) => (
                  <tr
                    key={`${ps.receipt_anchor}-${idx}`}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 text-xs">
                      {formatEpoch(ps.epoch_id)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {truncate(ps.employer_name_hash, 12)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatUsd(ps.gross_amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatUsd(ps.tax_withheld)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatUsd(ps.fee_amount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-green-700 dark:text-green-400">
                      {formatUsd(ps.net_amount)}
                    </td>
                    <td className="px-4 py-3">
                      <DownloadPDFButton
                        generatePdf={() => {
                          // Build minimal manifest + row shapes from
                          // the scanned paystub data so the existing PDF
                          // generator works unchanged.
                          const row: PayrollRow = {
                            row_index: 0,
                            worker_addr: address ?? "",
                            worker_name_hash: ps.worker_name_hash,
                            agreement_id: ps.agreement_id as `${string}`,
                            epoch_id: ps.epoch_id,
                            currency: "USDCx" as const,
                            gross_amount: ps.gross_amount,
                            tax_withheld: ps.tax_withheld,
                            fee_amount: ps.fee_amount,
                            net_amount: ps.net_amount,
                            payroll_inputs_hash: ps.payroll_inputs_hash as `${string}`,
                            receipt_anchor: ps.receipt_anchor as `${string}`,
                            receipt_pair_hash: ps.pair_hash as `${string}`,
                            utc_time_hash: ps.utc_time_hash as `${string}`,
                            audit_event_hash: "",
                            row_hash: ps.payroll_inputs_hash as `${string}`,
                            status: "settled" as const,
                          };
                          const manifest: PayrollRunManifest = {
                            batch_id: ps.receipt_anchor as `${string}`,
                            schema_v: 1,
                            calc_v: 1,
                            policy_v: 1,
                            employer_addr: "",
                            employer_name_hash: ps.employer_name_hash,
                            epoch_id: ps.epoch_id,
                            currency: "USDCx" as const,
                            row_count: 1,
                            rows: [row],
                            total_gross_amount: ps.gross_amount,
                            total_tax_withheld: ps.tax_withheld,
                            total_fee_amount: ps.fee_amount,
                            total_net_amount: ps.net_amount,
                            row_root: "",
                            inputs_hash: "",
                            doc_hash: "",
                            status: "settled" as const,
                            chunks: [],
                            created_at: 0,
                            updated_at: 0,
                          };
                          return generatePaystubPdf({
                            manifest,
                            row,
                            workerDisplayName: workerName,
                          });
                        }}
                        fileName={`paystub-${ps.epoch_id}-${ps.receipt_anchor.slice(0, 8)}`}
                        label="Print"
                        className="rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* YTD summary */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-medium text-foreground">
              YTD Summary ({paystubs.length} paystub
              {paystubs.length === 1 ? "" : "s"})
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">Total Gross</div>
                <div className="text-sm font-medium">
                  {formatUsd(totalGross.toString())}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Tax</div>
                <div className="text-sm font-medium">
                  {formatUsd(totalTax.toString())}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Fees</div>
                <div className="text-sm font-medium">
                  {formatUsd(totalFee.toString())}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total Net</div>
                <div className="text-lg font-semibold text-green-700 dark:text-green-400">
                  {formatUsd(totalNet.toString())}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
