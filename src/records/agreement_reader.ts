/**
 * Agreement Record Reader
 *
 * Decodes employer's FinalAgreementRecord records from Aleo to surface
 * the active worker list with agreement statuses.
 *
 * Security: uses view key for read-only record decoding.
 * Agreement records are private Aleo records owned by the employer.
 *
 * Note: Full private record decoding requires @provablehq/sdk WASM.
 * MVP uses the REST API mapping endpoint for public agreement state.
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";
import type { WorkerRecord } from "@/src/stores/worker_store";

/** Agreement status from on-chain state */
export type AgreementStatus = "active" | "paused" | "terminated";

/** Raw agreement data decoded from chain */
export type DecodedAgreement = {
  agreement_id: Bytes32;
  employer_addr: Address;
  worker_addr: Address;
  worker_name_hash: Field;
  status: AgreementStatus;
  pay_frequency_code: number;
  start_epoch: number;
  end_epoch: number;
  agreement_rev: number;
};

/**
 * Fetch and decode employer's agreement records.
 *
 * Uses the public mapping on employer_agreement_v2.aleo to check
 * agreement status. For full private record decoding, @provablehq/sdk
 * WASM will be integrated post-MVP.
 *
 * @param viewKey - Employer's view key
 * @param address - Employer's Aleo address
 * @returns Array of decoded worker records
 */
export async function readAgreementRecords(
  viewKey: string,
  address: Address,
): Promise<WorkerRecord[]> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.employer_agreement_v2;

  try {
    // Query the public agreements mapping for this employer
    // The mapping key is typically the employer address or agreement_id
    const url = `${endpoint}/program/${programId}/mapping/agreements/${address}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404) {
      // No agreements found
      return [];
    }

    if (!response.ok) {
      // Non-critical: return empty rather than crash the UI
      console.warn(
        `Agreement reader: API returned ${response.status}`,
      );
      return [];
    }

    const data: unknown = await response.json();
    return parseAgreementResponse(data, address);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.warn("Agreement scan failed (network):", error.message);
      return [];
    }
    // For any other error, log but don't crash
    console.warn("Agreement reader error:", error);
    return [];
  }
}

/**
 * Parse the REST API response into WorkerRecord array.
 * Handles various response formats from the Aleo REST API.
 */
function parseAgreementResponse(
  data: unknown,
  _employerAddr: Address,
): WorkerRecord[] {
  if (!data) return [];

  // If response is an array of records
  if (Array.isArray(data)) {
    return data
      .map((entry) => parseAgreementEntry(entry))
      .filter((r): r is WorkerRecord => r !== null);
  }

  // If response is a single record object
  if (typeof data === "object" && data !== null) {
    const record = parseAgreementEntry(data);
    return record ? [record] : [];
  }

  return [];
}

/**
 * Parse a single agreement entry from chain data.
 */
function parseAgreementEntry(entry: unknown): WorkerRecord | null {
  if (typeof entry !== "object" || entry === null) return null;

  const record = entry as Record<string, unknown>;

  // Extract fields with safe defaults
  const workerAddr = extractStringField(record, "worker_addr", "worker_address", "worker");
  const workerNameHash = extractStringField(record, "worker_name_hash", "name_hash");
  const agreementId = extractStringField(record, "agreement_id", "id");
  const statusField = extractStringField(record, "status", "agreement_status");

  if (!workerAddr || !agreementId) return null;

  return {
    worker_addr: workerAddr,
    worker_name_hash: workerNameHash ?? "0x0",
    agreement_id: agreementId,
    status: parseStatus(statusField),
  };
}

/**
 * Extract a string field from a record, trying multiple possible field names.
 */
function extractStringField(
  record: Record<string, unknown>,
  ...fieldNames: string[]
): string | null {
  for (const name of fieldNames) {
    const value = record[name];
    if (typeof value === "string" && value.length > 0) {
      // Strip Aleo type suffixes (e.g., "aleo1...address")
      return value.replace(/\.(private|public)$/, "");
    }
  }
  return null;
}

/**
 * Parse agreement status from chain representation.
 */
function parseStatus(statusStr: string | null): AgreementStatus {
  if (!statusStr) return "active";
  const normalized = statusStr
    .toLowerCase()
    .replace(/u\d+$/i, "")
    .replace(/\.(private|public)$/, "")
    .trim();

  switch (normalized) {
    case "0":
    case "active":
      return "active";
    case "1":
    case "paused":
      return "paused";
    case "2":
    case "terminated":
      return "terminated";
    default:
      return "active";
  }
}

/**
 * Refresh a single agreement's status from chain.
 */
export async function checkAgreementStatus(
  agreementId: Bytes32,
): Promise<AgreementStatus | null> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.employer_agreement_v2;

  try {
    const url = `${endpoint}/program/${programId}/mapping/agreement_status/${agreementId}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data === "string") {
      return parseStatus(data);
    }
    return null;
  } catch {
    return null;
  }
}
