"use client";

import { useEffect, useCallback, useState } from "react";
import Link from "next/link";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWorkerStore, type WorkerRecord } from "@/src/stores/worker_store";
import { scanAgreementRecords, readAgreementRecords } from "@/src/records/agreement_reader";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";

type SentOffer = {
  agreement_id: string;
  worker_pnw_name: string;
  worker_address: string;
  industry_code: number;
  pay_frequency: number;
  terms_text: string;
  tx_id: string;
  created_at: number;
  onChainStatus?: string; // "pending" | "active" | "paused" | "terminated" | "unknown"
};

const STATUS_MAP: Record<string, string> = {
  "0u8": "pending",
  "1u8": "active",
  "2u8": "paused",
  "3u8": "terminated",
  "4u8": "superseded",
};

function bytesToAleoU8Array(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return "[ " + bytes.map(b => `${b}u8`).join(", ") + " ]";
}

async function queryAgreementStatus(agreementIdHex: string): Promise<string> {
  try {
    const key = bytesToAleoU8Array(agreementIdHex);
    const url = `${ENV.ALEO_ENDPOINT}/program/${PROGRAMS.layer1.employer_agreement}/mapping/agreement_status/${encodeURIComponent(key)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return "unknown";
    const data = await resp.text();
    const clean = data.replace(/"/g, "").trim();
    return STATUS_MAP[clean] ?? "unknown";
  } catch {
    return "unknown";
  }
}

function truncate(str: string, len = 12): string {
  if (str.length <= len) return str;
  return `${str.slice(0, 6)}...${str.slice(-4)}`;
}

function StatusBadge({ status }: { status: WorkerRecord["status"] }) {
  const styles = {
    active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    terminated: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function WorkersPage() {
  const { viewKey, address } = useAleoSession();
  const { requestRecords } = useWallet();
  const { workers, isLoading, setWorkers, setLoading } = useWorkerStore();
  const [sentOffers, setSentOffers] = useState<SentOffer[]>([]);

  const loadWorkers = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      // Try wallet record scan first, fall back to localStorage
      let records = requestRecords
        ? await scanAgreementRecords(requestRecords, address)
        : [];
      if (records.length === 0 && viewKey) {
        records = await readAgreementRecords(viewKey, address);
      }
      setWorkers(records);
    } catch (err) {
      console.warn("Failed to load workers:", err);
    } finally {
      setLoading(false);
    }
  }, [viewKey, address, requestRecords, setWorkers, setLoading]);

  useEffect(() => {
    void loadWorkers();

    // Load sent offers from localStorage and check on-chain status
    if (address) {
      try {
        const raw = localStorage.getItem(`pnw_sent_offers_${address}`);
        if (raw) {
          const offers = JSON.parse(raw) as SentOffer[];
          setSentOffers(offers);

          // Query on-chain status for each offer
          Promise.all(
            offers.map(async (offer) => {
              const status = await queryAgreementStatus(offer.agreement_id);
              return { ...offer, onChainStatus: status };
            })
          ).then(updated => setSentOffers(updated));
        }
      } catch {
        // ignore
      }
    }
  }, [loadWorkers, address]);

  const activeCount = workers.filter((w) => w.status === "active").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Workers</h1>
          <p className="text-sm text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} active worker${activeCount !== 1 ? "s" : ""}`
              : "Manage your workers and agreements"}
          </p>
        </div>
        <Link
          href="/workers/onboard"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Add Worker
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Scanning agreement records...
          </p>
        </div>
      ) : workers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No workers found. Onboard your first worker to get started.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Workers appear here after agreement records are detected on testnet.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Worker
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Agreement ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Last Payroll
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => (
                <tr
                  key={worker.agreement_id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {worker.display_name ?? "Unnamed Worker"}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {truncate(worker.worker_addr)}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <code className="font-mono text-xs text-muted-foreground">
                      {truncate(worker.agreement_id)}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={worker.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {worker.last_payroll_epoch
                      ? `Epoch ${worker.last_payroll_epoch}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/workers/${encodeURIComponent(worker.agreement_id)}`}
                      className="rounded-md border border-input px-3 py-1 text-xs hover:bg-accent"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sent Offers */}
      {sentOffers.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">Sent Offers</h2>
          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Worker</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Industry</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sent</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {sentOffers.map((offer) => (
                  <tr key={offer.agreement_id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{offer.worker_pnw_name}.pnw</p>
                      <p className="font-mono text-xs text-muted-foreground">{offer.worker_address.slice(0, 12)}...</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {INDUSTRY_SUFFIXES[offer.industry_code]?.label ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(offer.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        offer.onChainStatus === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : offer.onChainStatus === "pending"
                            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : offer.onChainStatus === "terminated"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-muted text-muted-foreground"
                      }`}>
                        {offer.onChainStatus === "active" ? "Active" :
                         offer.onChainStatus === "pending" ? "Pending" :
                         offer.onChainStatus === "terminated" ? "Terminated" :
                         offer.onChainStatus === "paused" ? "Paused" :
                         "Checking..."}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <button
        onClick={() => void loadWorkers()}
        disabled={isLoading}
        className="rounded-md border border-input px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        {isLoading ? "Scanning..." : "Refresh"}
      </button>
    </div>
  );
}
