/**
 * Profile Types — portal-side types for worker_profiles.aleo and employer_profiles.aleo.
 *
 * These types mirror the private record fields from the on-chain programs.
 * All profile data is session-only — never persisted to disk or sent to any server.
 */

import type { Address, Field, U8, U16, U32 } from "@/src/lib/pnw-adapter/aleo_types";
import type { Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";

// ----------------------------------------------------------------
// Worker Profile
// ----------------------------------------------------------------

export type WorkerProfileInput = {
  worker_name_hash: Field;
  first_name: string;
  middle_name: string;
  last_name: string;
  age: U8;
  gender: U8; // 1=male, 2=female, 3=prefer_not
  residency_state_code: U16;
  country_code: U16;
  state_issue_id: string;
  industry_code: U8;
  citizenship_flag: U8;
};

export const GENDER_CODES = {
  MALE: 1,
  FEMALE: 2,
  PREFER_NOT: 3,
} as const;

export const GENDER_LABELS: Record<number, string> = {
  1: "Male",
  2: "Female",
  3: "Prefer not to say",
};

// ----------------------------------------------------------------
// Employer Profile
// ----------------------------------------------------------------

export type EmployerProfileInput = {
  employer_name_hash: Field;
  suffix_code: U8;
  legal_name: string;
  registration_id: string;
  registration_state_code: U16;
  country_code: U16;
  formation_year: U16;
  entity_type_code: U8;
  industry_code: U8; // must == suffix_code
  employer_size_code: U8;
  operating_region_code: U16;
};

export const ENTITY_TYPE_CODES: Record<number, string> = {
  1: "Sole Proprietorship",
  2: "Partnership",
  3: "LLC",
  4: "Corporation",
  5: "Cooperative",
  6: "Non-Profit",
  7: "Government",
  8: "Tribal",
};

export const EMPLOYER_SIZE_CODES: Record<number, string> = {
  1: "1-5 employees",
  2: "6-25 employees",
  3: "26-100 employees",
  4: "101-500 employees",
  5: "500+ employees",
};

// ----------------------------------------------------------------
// Profile anchor queries
// ----------------------------------------------------------------

import { ENV } from "@/src/config/env";
import { PROGRAMS } from "@/src/config/programs";

/**
 * Check if a worker profile anchor exists on-chain.
 * Queries worker_profiles.aleo/profile_anchor_height mapping.
 *
 * @returns The first-seen block height, or null if not anchored.
 */
export async function queryWorkerProfileAnchor(
  profileAnchor: Bytes32,
): Promise<U32 | null> {
  return queryProfileAnchor(PROGRAMS.layer1.worker_profiles, profileAnchor);
}

/**
 * Check if an employer profile anchor exists on-chain.
 * Queries employer_profiles.aleo/profile_anchor_height mapping.
 *
 * @returns The first-seen block height, or null if not anchored.
 */
export async function queryEmployerProfileAnchor(
  profileAnchor: Bytes32,
): Promise<U32 | null> {
  return queryProfileAnchor(PROGRAMS.layer1.employer_profiles, profileAnchor);
}

async function queryProfileAnchor(
  programId: string,
  profileAnchor: Bytes32,
): Promise<U32 | null> {
  const endpoint = ENV.ALEO_ENDPOINT;

  try {
    const url = `${endpoint}/program/${programId}/mapping/profile_anchor_height/${profileAnchor}`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return null;

    const data: unknown = await response.json();
    if (typeof data === "string") {
      const cleaned = data.replace(/u32(\.private|\.public)?$/, "").trim();
      const height = parseInt(cleaned, 10);
      if (height > 0) return height;
    }
    return null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------
// Command builders (preview mode)
// ----------------------------------------------------------------

/**
 * Encode a string into a u128 field value (up to 16 bytes, big-endian).
 * Matches the encoding used by worker_profiles.aleo and employer_profiles.aleo.
 */
export function encodeStringToU128(str: string): string {
  const bytes = new TextEncoder().encode(str.slice(0, 16));
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8n) | BigInt(bytes[i] ?? 0);
  }
  return `${value}u128`;
}

/**
 * Build snarkos command preview for creating a worker profile.
 */
export function buildCreateWorkerProfileCommand(
  input: WorkerProfileInput,
  profileAnchor: Bytes32,
): string {
  const firstName = encodeStringToU128(input.first_name);
  const middleName = encodeStringToU128(input.middle_name);
  const lastName = encodeStringToU128(input.last_name);
  const stateId = encodeStringToU128(input.state_issue_id);

  return (
    `snarkos developer execute ${PROGRAMS.layer1.worker_profiles} create_worker_profile ` +
    `${input.worker_name_hash}field ` +
    `${firstName} ${middleName} ${lastName} ` +
    `${input.age}u8 ${input.gender}u8 ` +
    `${input.residency_state_code}u16 ${input.country_code}u16 ` +
    `${stateId} ${input.industry_code}u8 ${input.citizenship_flag}u8 ` +
    `1u16 1u16 1u16 ` + // schema_v, policy_v, profile_rev
    `${profileAnchor}`
  );
}

/**
 * Build snarkos command preview for creating an employer profile.
 */
export function buildCreateEmployerProfileCommand(
  input: EmployerProfileInput,
  profileAnchor: Bytes32,
): string {
  const legalName = encodeStringToU128(input.legal_name);
  const regId = encodeStringToU128(input.registration_id);

  return (
    `snarkos developer execute ${PROGRAMS.layer1.employer_profiles} create_employer_profile ` +
    `${input.employer_name_hash}field ${input.suffix_code}u8 ` +
    `${legalName} ${regId} ` +
    `${input.registration_state_code}u16 ${input.country_code}u16 ` +
    `${input.formation_year}u16 ${input.entity_type_code}u8 ` +
    `${input.industry_code}u8 ${input.employer_size_code}u8 ` +
    `${input.operating_region_code}u16 ` +
    `1u16 1u16 1u16 ` + // schema_v, policy_v, profile_rev
    `${profileAnchor}`
  );
}
