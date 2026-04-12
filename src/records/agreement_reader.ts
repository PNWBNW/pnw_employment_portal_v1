/**
 * Agreement Record Reader
 *
 * Surfaces the active worker list by scanning on-chain agreement records
 * owned by the employer's wallet.
 *
 * Primary path: wallet adapter's requestRecords() → parse FinalAgreement
 * and PendingAgreement records → return WorkerRecords.
 *
 * Fallback path: localStorage sent offers → cross-reference with on-chain
 * agreement_status mapping. Used when wallet doesn't support requestRecords.
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import type { Address, Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";
import type { WorkerRecord } from "@/src/stores/worker_store";
import { queryWorkerName, queryNamePlaintext } from "@/src/registry/name_registry";

/** Agreement status from on-chain state */
export type AgreementStatus = "active" | "paused" | "terminated";

/** Sent offer shape from localStorage */
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
 * Parse a FinalAgreement or PendingAgreement record plaintext into a WorkerRecord.
 * Returns null if the record doesn't match or is spent.
 */
function parseAgreementRecord(
  record: Record<string, unknown>,
  employerAddress: Address,
): WorkerRecord | null {
  try {
    const plaintext = typeof record.recordPlaintext === "string" ? record.recordPlaintext : null;
    const recordName = typeof record.recordName === "string" ? record.recordName : null;
    const spent = typeof record.spent === "boolean" ? record.spent : false;

    if (!plaintext) return null;
    if (spent) return null;

    // Accept both FinalAgreement (accepted) and PendingAgreement (sent, awaiting acceptance)
    const isFinal = recordName === "FinalAgreement";
    const isPending = recordName === "PendingAgreement";
    if (!isFinal && !isPending) return null;

    // Parse fields from the record plaintext
    const workerAddrMatch = plaintext.match(/worker_address:\s*(aleo1[a-z0-9]+)/);
    const empAddrMatch = plaintext.match(/employer_address:\s*(aleo1[a-z0-9]+)/);
    const wrkHashMatch = plaintext.match(/worker_name_hash:\s*(\d+)field/);

    // For employer-owned records, verify this is their agreement
    if (empAddrMatch?.[1] && empAddrMatch[1] !== employerAddress) return null;

    // Must have a worker address
    if (!workerAddrMatch?.[1]) return null;

    // Parse agreement_id bytes → hex string
    const aidSection = plaintext.match(/agreement_id:\s*\[([\s\S]*?)\]/);
    let agreementId = "";
    if (aidSection?.[1]) {
      const byteMatches = aidSection[1].match(/(\d+)u8/g);
      if (byteMatches) {
        agreementId = byteMatches.map(m => parseInt(m).toString(16).padStart(2, "0")).join("");
      }
    }
    if (!agreementId) return null;

    // Determine status: FinalAgreement = active, PendingAgreement = active (pending acceptance)
    const status: AgreementStatus = "active";

    return {
      worker_addr: workerAddrMatch[1],
      worker_name_hash: wrkHashMatch?.[1] ?? "",
      agreement_id: agreementId,
      status,
      display_name: undefined, // Will be resolved by reverse name lookup
    };
  } catch {
    return null;
  }
}

/**
 * Scan wallet for agreement records using the wallet adapter.
 * This is the primary method — reads actual on-chain records owned by the employer.
 *
 * @param requestRecords - Wallet adapter's requestRecords function
 * @param employerAddress - Employer's Aleo address
 * @returns Array of worker records from on-chain agreement records
 */
export async function scanAgreementRecords(
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  employerAddress: Address,
): Promise<WorkerRecord[]> {
  try {
    console.log("[PNW] Scanning wallet for agreement records...");
    const records = await requestRecords(PROGRAMS.layer1.employer_agreement, true);
    console.log("[PNW] Agreement records from wallet:", records?.length ?? 0);

    if (!Array.isArray(records)) return [];

    const workers: WorkerRecord[] = [];
    const seenAgreements = new Set<string>();

    for (const rec of records) {
      const worker = parseAgreementRecord(rec as Record<string, unknown>, employerAddress);
      if (worker && !seenAgreements.has(worker.agreement_id)) {
        seenAgreements.add(worker.agreement_id);
        workers.push(worker);
      }
    }

    console.log("[PNW] Parsed worker records:", workers.length);

    // Resolve .pnw names for each worker
    for (const worker of workers) {
      try {
        const nameHash = await queryWorkerName(worker.worker_addr);
        if (nameHash) {
          const cleanHash = nameHash.replace(/field$/, "").trim();
          if (!worker.worker_name_hash) worker.worker_name_hash = cleanHash;
          const plaintext = await queryNamePlaintext(cleanHash);
          if (plaintext) worker.display_name = `${plaintext}.pnw`;
        }
      } catch {
        // Name resolution is best-effort
      }
      // Fallback display: truncated address
      if (!worker.display_name) {
        worker.display_name = `${worker.worker_addr.slice(0, 12)}...${worker.worker_addr.slice(-6)}`;
      }
    }

    return workers;
  } catch (error) {
    console.warn("[PNW] Wallet record scan failed:", error);
    return [];
  }
}

/**
 * Fallback: read from localStorage sent offers + on-chain status.
 * Used when wallet doesn't support requestRecords.
 *
 * @param _viewKey - Employer's view key (reserved for future use)
 * @param address - Employer's Aleo address
 * @returns Array of worker records from localStorage offers
 */
export async function readAgreementRecords(
  _viewKey: string,
  address: Address,
): Promise<WorkerRecord[]> {
  try {
    const raw = localStorage.getItem(`pnw_sent_offers_${address}`);
    if (!raw) return [];

    const offers: StoredOffer[] = JSON.parse(raw);
    if (!Array.isArray(offers) || offers.length === 0) return [];

    const workers: WorkerRecord[] = [];
    for (const offer of offers) {
      const status = await queryAgreementStatusInternal(offer.agreement_id);
      if (status) {
        workers.push({
          worker_addr: offer.worker_address,
          worker_name_hash: "",
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
 */
export async function checkAgreementStatus(
  agreementId: Bytes32,
): Promise<AgreementStatus | null> {
  return queryAgreementStatusInternal(agreementId);
}

// ---------------------------------------------------------------------------
// Credential auth material lookup
// ---------------------------------------------------------------------------

/**
 * Authorization material extracted from an employer's FinalAgreement
 * record, passed to credential_nft_v3::mint_credential_nft to prove
 * the caller is authorized to issue credentials for a specific worker.
 */
export type CredentialAuthMaterial = {
  agreement_id: Bytes32;        // hex, "0x..." prefixed
  parties_key: Bytes32;         // hex, "0x..." prefixed
  employer_name_hash: string;   // decimal field element
  worker_name_hash: string;     // decimal field element
};

/**
 * Scan the connected employer's wallet for a FinalAgreement record
 * whose `worker_address` matches the given worker, and return the
 * four credential_nft_v3 authorization fields.
 *
 * Returns null if no matching active agreement is found.
 *
 * @param requestRecords - Wallet adapter's requestRecords function
 * @param employerAddress - Connected employer wallet
 * @param targetWorkerAddress - Worker the credential is being issued to
 */
export async function fetchCredentialAuthForWorker(
  requestRecords: (programId: string, all?: boolean) => Promise<unknown[]>,
  employerAddress: Address,
  targetWorkerAddress: Address,
): Promise<CredentialAuthMaterial | null> {
  try {
    const records = await requestRecords(
      PROGRAMS.layer1.employer_agreement,
      true,
    );
    if (!Array.isArray(records)) return null;

    for (const raw of records) {
      const rec = raw as Record<string, unknown>;
      const plaintext =
        typeof rec.recordPlaintext === "string" ? rec.recordPlaintext : null;
      const recordName =
        typeof rec.recordName === "string" ? rec.recordName : null;
      const spent = typeof rec.spent === "boolean" ? rec.spent : false;

      if (!plaintext) continue;
      if (spent) continue;
      // Only accept FinalAgreement records for issuing credentials —
      // PendingAgreement is pre-acceptance and not authorized.
      if (recordName !== "FinalAgreement") continue;

      // Match this record to the target worker
      const workerAddrMatch = plaintext.match(
        /worker_address:\s*(aleo1[a-z0-9]+)/,
      );
      if (!workerAddrMatch?.[1]) continue;
      if (workerAddrMatch[1] !== targetWorkerAddress) continue;

      // Confirm the record is owned by the expected employer
      const empAddrMatch = plaintext.match(
        /employer_address:\s*(aleo1[a-z0-9]+)/,
      );
      if (!empAddrMatch?.[1] || empAddrMatch[1] !== employerAddress) continue;

      // Extract agreement_id as hex
      const agreementIdHex = extractByteArrayHex(plaintext, "agreement_id");
      const partiesKeyHex = extractByteArrayHex(plaintext, "parties_key");
      if (!agreementIdHex || !partiesKeyHex) continue;

      // Extract the two name hashes (decimal field elements)
      const empHashMatch = plaintext.match(
        /employer_name_hash:\s*(\d+)field/,
      );
      const wrkHashMatch = plaintext.match(
        /worker_name_hash:\s*(\d+)field/,
      );
      if (!empHashMatch?.[1] || !wrkHashMatch?.[1]) continue;

      return {
        agreement_id: ("0x" + agreementIdHex) as Bytes32,
        parties_key: ("0x" + partiesKeyHex) as Bytes32,
        employer_name_hash: empHashMatch[1],
        worker_name_hash: wrkHashMatch[1],
      };
    }

    return null;
  } catch (error) {
    console.warn("[PNW] fetchCredentialAuthForWorker failed:", error);
    return null;
  }
}

/**
 * Helper — pull a `[u8; 32]` array field out of a record plaintext
 * and return it as a 64-char hex string (no prefix).
 */
function extractByteArrayHex(
  plaintext: string,
  fieldName: string,
): string | null {
  const section = plaintext.match(
    new RegExp(`${fieldName}:\\s*\\[([\\s\\S]*?)\\]`),
  );
  if (!section?.[1]) return null;
  const byteMatches = section[1].match(/(\d+)u8/g);
  if (!byteMatches || byteMatches.length === 0) return null;
  return byteMatches
    .map((m) => parseInt(m).toString(16).padStart(2, "0"))
    .join("");
}
