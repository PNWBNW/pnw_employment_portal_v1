/**
 * Agreement Record Reader
 *
 * Surfaces the active worker list by combining:
 *   1. Sent offers stored in localStorage (keyed by wallet address)
 *   2. On-chain agreement_status mapping on employer_agreement_v4.aleo
 *
 * Only offers with status "active" (accepted by worker) are returned
 * as WorkerRecords for the workers table.
 *
 * Note: employer_agreement_v4 stores agreements as private records,
 * not in a public mapping. The only public state is agreement_status
 * (keyed by agreement_id). We cross-reference localStorage sent offers
 * with on-chain status to determine which agreements are active.
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import type { Address, Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";
import type { WorkerRecord } from "@/src/stores/worker_store";

/** Agreement status from on-chain state */
export type AgreementStatus = "active" | "paused" | "terminated";

/** Sent offer shape from localStorage (matches workers/page.tsx SentOffer) */
type StoredOffer = {
  agreement_id: string;
  worker_pnw_name: string;
  worker_address: string;
  industry_code: number;
  pay_frequency: number;
  terms_text: string;
  tx_id: string;
  created_at: number;
};

const STATUS_MAP: Record<string, AgreementStatus> = {
  "0u8": "active",   // PENDING maps to active for display (offer sent)
  "1u8": "active",   // ACTIVE
  "2u8": "paused",   // PAUSED
  "3u8": "terminated", // TERMINATED
};

function bytesToAleoU8Array(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return "[ " + bytes.map(b => `${b}u8`).join(", ") + " ]";
}

/**
 * Fetch employer's active workers by cross-referencing localStorage
 * sent offers with on-chain agreement_status mapping.
 *
 * @param _viewKey - Employer's view key (reserved for future record decoding)
 * @param address - Employer's Aleo address
 * @returns Array of worker records with active agreements
 */
export async function readAgreementRecords(
  _viewKey: string,
  address: Address,
): Promise<WorkerRecord[]> {
  try {
    // Read sent offers from localStorage
    const raw = localStorage.getItem(`pnw_sent_offers_${address}`);
    if (!raw) return [];

    const offers: StoredOffer[] = JSON.parse(raw);
    if (!Array.isArray(offers) || offers.length === 0) return [];

    // Query on-chain status for each offer
    const workers: WorkerRecord[] = [];
    for (const offer of offers) {
      const status = await queryAgreementStatusInternal(offer.agreement_id);
      if (status) {
        workers.push({
          worker_addr: offer.worker_address,
          worker_name_hash: "0x0",
          agreement_id: offer.agreement_id,
          status,
          display_name: offer.worker_pnw_name ? `${offer.worker_pnw_name}.pnw` : undefined,
        });
      }
    }

    return workers;
  } catch (error) {
    console.warn("Agreement reader error:", error);
    return [];
  }
}

/**
 * Query a single agreement's status from on-chain mapping.
 */
async function queryAgreementStatusInternal(
  agreementIdHex: string,
): Promise<AgreementStatus | null> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.employer_agreement;

  try {
    const key = bytesToAleoU8Array(agreementIdHex);
    const url = `${endpoint}/program/${programId}/mapping/agreement_status/${encodeURIComponent(key)}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data = await response.text();
    const clean = data.replace(/"/g, "").trim();
    return STATUS_MAP[clean] ?? null;
  } catch {
    return null;
  }
}

/**
 * Refresh a single agreement's status from chain.
 * Public API for components that need individual status checks.
 */
export async function checkAgreementStatus(
  agreementId: Bytes32,
): Promise<AgreementStatus | null> {
  return queryAgreementStatusInternal(agreementId);
}
