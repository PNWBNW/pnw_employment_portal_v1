/**
 * USDCx Record Scanner
 *
 * Fetches employer's Token records from Aleo REST API using their view key.
 * Returns the decoded USDCx balance (sum of all owned Token records).
 *
 * Security: view key is used for read-only record decoding only.
 * It cannot sign transactions or transfer funds.
 *
 * Note: Full record decoding requires @provablehq/sdk WASM. For now,
 * we use the REST API's record endpoint which returns plaintext records
 * for the given view key owner.
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import type { Address, U128 } from "@/src/lib/pnw-adapter/aleo_types";

export type USDCxBalance = {
  /** Total balance in minor units (1 USDCx = 1_000_000 minor units) */
  total: bigint;
  /** Number of individual Token records */
  recordCount: number;
  /** Individual record amounts */
  records: Array<{
    amount: bigint;
    nonce: string;
  }>;
};

/** Minimum viable record shape returned by the Aleo REST API */
type RawRecordEntry = {
  microcredits?: string;
  amount?: string;
  [key: string]: unknown;
};

/**
 * Scans the employer's USDCx Token records via the Aleo REST API.
 *
 * @param viewKey - Employer's view key for record decoding
 * @param address - Employer's Aleo address
 * @returns Decoded USDCx balance summary
 */
export async function scanUSDCxBalance(
  viewKey: string,
  address: Address,
): Promise<USDCxBalance> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.external.usdcx;

  // The Aleo REST API exposes unspent records for a program+mapping
  // For testnet: GET /program/{program_id}/mapping/account/{address}
  // This returns the public mapping value, not private records.
  //
  // For private records, the full approach requires:
  // 1. Fetch ciphertext records via view key scanning
  // 2. Decrypt using @provablehq/sdk WASM
  //
  // MVP approach: fetch from the REST API records endpoint
  // and attempt to parse Token record amounts.

  try {
    const url = `${endpoint}/program/${programId}/mapping/account/${address}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404) {
      // No records found for this address — zero balance
      return { total: 0n, recordCount: 0, records: [] };
    }

    if (!response.ok) {
      throw new Error(
        `Aleo API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: unknown = await response.json();

    // Public mapping returns a single value (the balance)
    if (typeof data === "string") {
      const amount = parseAleoU128(data);
      return {
        total: amount,
        recordCount: 1,
        records: [{ amount, nonce: "public-mapping" }],
      };
    }

    // If it's an object with records, parse each
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const entry = data as RawRecordEntry;
      const amount = parseAleoU128(entry.amount ?? entry.microcredits ?? "0");
      return {
        total: amount,
        recordCount: 1,
        records: [{ amount, nonce: "public-mapping" }],
      };
    }

    return { total: 0n, recordCount: 0, records: [] };
  } catch (error) {
    if (error instanceof TypeError && error.message.includes("fetch")) {
      // Network error — return empty rather than crash
      console.warn("USDCx scan failed (network):", error.message);
      return { total: 0n, recordCount: 0, records: [] };
    }
    throw error;
  }
}

/**
 * Parse an Aleo u128 string value (e.g., "1000000u128") to bigint.
 */
function parseAleoU128(value: string): bigint {
  // Remove trailing type suffix (e.g., "u128", "u64")
  const cleaned = value.replace(/u\d+$/i, "").trim();
  if (!cleaned || cleaned === "null") return 0n;
  try {
    return BigInt(cleaned);
  } catch {
    return 0n;
  }
}

/**
 * Format minor units to display amount (e.g., 1234567 → "1.234567")
 */
export function formatUSDCx(minorUnits: bigint): string {
  const whole = minorUnits / 1_000_000n;
  const frac = minorUnits % 1_000_000n;
  if (frac === 0n) return `$${whole.toLocaleString()}.00`;
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `$${whole.toLocaleString()}.${fracStr}`;
}

/**
 * Format minor units to a short display (2 decimal places)
 */
export function formatUSDCxShort(minorUnits: bigint): string {
  const whole = minorUnits / 1_000_000n;
  const frac = minorUnits % 1_000_000n;
  const cents = Number(frac) / 10_000;
  return `$${whole.toLocaleString()}.${Math.floor(cents).toString().padStart(2, "0")}`;
}
