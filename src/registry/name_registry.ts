/**
 * PNW Name Registry — portal-side types and on-chain query utilities.
 *
 * Mirrors pnw_name_registry.aleo:
 * - Worker names: 1 per wallet, soulbound, 1 USDCx + fee
 * - Employer names: up to 3, license-gated, suffix-coded, tiered pricing
 *
 * All names are stored on-chain as BLAKE3 hashes (field), never plaintext.
 */

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";
import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import type { Address, Field, U8 } from "@/src/lib/pnw-adapter/aleo_types";

// ----------------------------------------------------------------
// Constants (match pnw_name_registry.aleo)
// ----------------------------------------------------------------

export const NAME_KIND_WORKER: U8 = 1;
export const NAME_KIND_EMPLOYER: U8 = 2;

/** USDCx scale factor (1 USDCx = 1_000_000 micro-units) */
export const USDCX_SCALE = 1_000_000n;

/** Worker name base price: 1 USDCx */
export const WORKER_PRICE_BASE = 1n * USDCX_SCALE;

/** Default naming fee (routed to presiding DAO treasury alongside base price) */
export const DEFAULT_NAMING_FEE = 0n; // placeholder — DAO sets this

/** Employer name tiered pricing */
export const EMPLOYER_PRICES = [
  10n * USDCX_SCALE,   // 1st name
  100n * USDCX_SCALE,  // 2nd name
  300n * USDCX_SCALE,  // 3rd name
] as const;

/** Employer sellback refund: 75% of base price (fees never refunded) */
export const SELLBACK_REFUND_PERCENT = 75;

// ----------------------------------------------------------------
// Industry suffix codes (match pnw_name_registry.aleo)
// ----------------------------------------------------------------

export const INDUSTRY_SUFFIXES: Record<number, { code: string; label: string }> = {
  1:  { code: "AGRIC", label: "Agriculture" },
  2:  { code: "FOODS", label: "Food & Beverage" },
  3:  { code: "SERVC", label: "Services" },
  4:  { code: "BUSNS", label: "Business" },
  5:  { code: "WORKS", label: "Works" },
  6:  { code: "COOPS", label: "Cooperatives" },
  7:  { code: "ORGNS", label: "Organizations" },
  8:  { code: "INCOR", label: "Incorporated" },
  9:  { code: "BUILD", label: "Building & Construction" },
  10: { code: "LANDS", label: "Landscaping" },
  11: { code: "MANUF", label: "Manufacturing" },
  12: { code: "TRANS", label: "Transportation" },
  13: { code: "UTILT", label: "Utilities" },
  14: { code: "MECHN", label: "Mechanical" },
  15: { code: "ELECT", label: "Electrical" },
  16: { code: "METAL", label: "Metalwork" },
  17: { code: "TIMBR", label: "Timber & Forestry" },
  18: { code: "TECHN", label: "Technology" },
  19: { code: "DATAS", label: "Data Services" },
  20: { code: "CYBER", label: "Cybersecurity" },
  21: { code: "MEDIA", label: "Media & Communications" },
  22: { code: "LABRD", label: "Labor & Development" },
  23: { code: "HEALT", label: "Healthcare" },
  24: { code: "CARED", label: "Caregiving" },
  25: { code: "PHARM", label: "Pharmaceutical" },
  26: { code: "THERA", label: "Therapy & Rehabilitation" },
  27: { code: "EDUCA", label: "Education" },
  28: { code: "TRAIN", label: "Training" },
  29: { code: "SKILL", label: "Skilled Trades" },
  30: { code: "RETAL", label: "Retail" },
  31: { code: "HOSTL", label: "Hospitality" },
  32: { code: "TOURS", label: "Tourism" },
  33: { code: "EVENT", label: "Events" },
  34: { code: "FINAN", label: "Finance" },
  35: { code: "LEGAL", label: "Legal" },
  36: { code: "ACCTS", label: "Accounting" },
  37: { code: "ADMIN", label: "Administration" },
  38: { code: "CIVIC", label: "Civic" },
  39: { code: "MUNIC", label: "Municipal" },
  40: { code: "STATE", label: "State Government" },
};

// ----------------------------------------------------------------
// Hash helpers
// ----------------------------------------------------------------

/** TLV object tag for name hashing */
const OBJ_NAME = 0x5001;

/**
 * Compute the name hash that would be stored on-chain.
 * This matches the portal-side computation used when calling register_worker_name
 * or register_employer_name — the actual hash input to the program.
 */
export function computeNameHash(name: string): Field {
  const data = tlvEncode(OBJ_NAME, [
    { tag: 0x01, value: new TextEncoder().encode(name) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.NAME, data));
}

// ----------------------------------------------------------------
// On-chain queries
// ----------------------------------------------------------------

const ZERO_ADDRESS = "aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq3ljyzc";

/**
 * Check if a wallet address has a registered worker .pnw name.
 * Queries the worker_primary_name_of mapping.
 *
 * @returns The worker's name_hash (field) if registered, null if not.
 */
export async function queryWorkerName(address: Address): Promise<Field | null> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.pnw_name_registry;

  try {
    const url = `${endpoint}/program/${programId}/mapping/worker_primary_name_of/${address}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data === "string") {
      const cleaned = data.replace(/\.(private|public)$/, "").trim();
      // 0field means no name registered
      if (cleaned === "0field" || cleaned === "0") return null;
      return cleaned;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check who owns a specific name hash.
 * Queries the name_owner mapping.
 *
 * @returns The owner address if the name is registered, null if available.
 */
export async function queryNameOwner(nameHash: Field): Promise<Address | null> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.pnw_name_registry;

  try {
    const url = `${endpoint}/program/${programId}/mapping/name_owner/${nameHash}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data === "string") {
      const cleaned = data.replace(/\.(private|public)$/, "").trim();
      if (cleaned === ZERO_ADDRESS) return null;
      return cleaned;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check the kind of a name (worker or employer).
 *
 * @returns 1 for worker, 2 for employer, null if not found.
 */
export async function queryNameKind(nameHash: Field): Promise<U8 | null> {
  const endpoint = ENV.ALEO_ENDPOINT;
  const programId = PROGRAMS.layer1.pnw_name_registry;

  try {
    const url = `${endpoint}/program/${programId}/mapping/name_kind/${nameHash}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data === "string") {
      const cleaned = data.replace(/u8(\.private|\.public)?$/, "").trim();
      const code = parseInt(cleaned, 10);
      if (code === 1 || code === 2) return code;
    }
    return null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Command builders (preview mode)
// ----------------------------------------------------------------
//
// Registration requires TWO transactions:
// 1. USDCx transfer: approve or transfer (base_price + fee_amount) to
//    the locally presiding DAO treasury address.
//    → test_usdcx_stablecoin.aleo/transfer_public(dao_treasury, total_amount)
// 2. Name registration: call the register transition.
//
// The base price + naming fee are application-level payments routed to
// the DAO treasury — they are NOT network fees. Aleo execution fees are
// paid separately by the caller.
// ----------------------------------------------------------------

/**
 * Build the snarkos command preview for the USDCx transfer to DAO treasury.
 * This must be executed before the registration call.
 */
export function buildUsdcxTransferCommand(
  daoTreasury: Address,
  totalAmount: bigint,
): string {
  return (
    `snarkos developer execute test_usdcx_stablecoin.aleo transfer_public ` +
    `${daoTreasury} ${totalAmount}u128`
  );
}

/**
 * Build the snarkos command preview for registering a worker name.
 *
 * Precondition: caller must have transferred (WORKER_PRICE_BASE + fee_amount)
 * USDCx to the DAO treasury.
 */
export function buildRegisterWorkerNameCommand(
  nameHash: Field,
  feeAmount: bigint,
): string {
  return (
    `snarkos developer execute ${PROGRAMS.layer1.pnw_name_registry} register_worker_name ` +
    `${nameHash}field ${feeAmount}u128`
  );
}

/**
 * Build the snarkos command preview for registering an employer name.
 *
 * Precondition: caller must have transferred (EMPLOYER_PRICES[count-1] + fee_amount)
 * USDCx to the DAO treasury. Caller must also be verified via employer_license_registry.
 */
export function buildRegisterEmployerNameCommand(
  nameHash: Field,
  suffixCode: U8,
  count: U8,
  feeAmount: bigint,
): string {
  return (
    `snarkos developer execute ${PROGRAMS.layer1.pnw_name_registry} register_employer_name ` +
    `${nameHash}field ${suffixCode}u8 ${count}u8 ${feeAmount}u128`
  );
}

/**
 * Build the snarkos command preview for selling an employer name back to the DAO.
 * Refund = 75% of base price. Naming fees are never refunded.
 */
export function buildSellbackEmployerNameCommand(
  nameHash: Field,
): string {
  return (
    `snarkos developer execute ${PROGRAMS.layer1.pnw_name_registry} sellback_employer_name ` +
    `${nameHash}field`
  );
}
