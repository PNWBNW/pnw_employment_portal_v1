"use client";

import { useEffect, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";

type PaystubRecord = {
  tx_id: string;
  epoch: number;
  gross_amount: number;
  tax_amount: number;
  fee_amount: number;
  net_amount: number;
  employer_addr: string;
  batch_id: string;
};

function formatUsd(minorUnits: number): string {
  const dollars = minorUnits / 1_000_000;
  return `$${dollars.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function truncate(s: string, len = 16): string {
  return s.length <= len ? s : `${s.slice(0, len)}...`;
}

export default function WorkerPaystubsPage() {
  const { address, viewKey } = useAleoSession();
  const [paystubs, setPaystubs] = useState<PaystubRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !viewKey) return;

    async function loadPaystubs() {
      setIsLoading(true);
      setError(null);
      try {
        // In production, this calls the receipt_scanner to decode
        // paystub_receipts.aleo records via the Aleo REST API using
        // the worker's view key. For MVP, we attempt to load from
        // session storage (records cached during payroll runs).
        const cached = sessionStorage.getItem("pnw_worker_paystubs");
        if (cached) {
          setPaystubs(JSON.parse(cached) as PaystubRecord[]);
        }
        // TODO: Wire receipt_scanner.scanPaystubRecords(address, viewKey)
        // once the scanner is connected to the Aleo REST API.
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load paystubs",
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadPaystubs();
  }, [address, viewKey]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Paystubs</h1>
        <p className="text-sm text-muted-foreground">
          Payroll receipts decoded from on-chain records using your view key.
        </p>
      </div>

      {!viewKey && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            View key required to decode paystub records. Re-enter your keys to
            view paystubs.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Scanning paystub records...
          </p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!isLoading && paystubs.length === 0 && viewKey && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No paystub records found. Paystubs will appear here after your
            employer runs payroll and the settlement is confirmed on-chain.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Records are decoded client-side using your view key. No data leaves
            your browser.
          </p>
        </div>
      )}

      {paystubs.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  Epoch
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
                  TX ID
                </th>
              </tr>
            </thead>
            <tbody>
              {paystubs.map((ps) => (
                <tr key={ps.tx_id} className="border-b last:border-0">
                  <td className="px-4 py-3">{ps.epoch}</td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {truncate(ps.employer_addr)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatUsd(ps.gross_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatUsd(ps.tax_amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatUsd(ps.fee_amount)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatUsd(ps.net_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://explorer.provable.com/transaction/${ps.tx_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {truncate(ps.tx_id, 12)}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* YTD summary */}
      {paystubs.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-medium text-foreground">YTD Summary</h3>
          <div className="mt-3 grid grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Total Gross</div>
              <div className="text-sm font-medium">
                {formatUsd(paystubs.reduce((s, p) => s + p.gross_amount, 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Tax</div>
              <div className="text-sm font-medium">
                {formatUsd(paystubs.reduce((s, p) => s + p.tax_amount, 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Fees</div>
              <div className="text-sm font-medium">
                {formatUsd(paystubs.reduce((s, p) => s + p.fee_amount, 0))}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total Net</div>
              <div className="text-lg font-semibold text-green-700">
                {formatUsd(paystubs.reduce((s, p) => s + p.net_amount, 0))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
