/**
 * Timekeeping Types — PNW Privacy-First Punch Clock
 *
 * Defines the data model for encrypted punch records stored on IPFS
 * and weekly commitment anchors stored on-chain.
 */

import type { Address } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Punch Types
// ---------------------------------------------------------------------------

export const PUNCH_TYPE = {
  CLOCK_IN: 1,
  CLOCK_OUT: 2,
} as const;

export type PunchType = (typeof PUNCH_TYPE)[keyof typeof PUNCH_TYPE];

/** Plaintext punch data — only exists transiently in memory during signing. */
export type PunchData = {
  /** Unique punch identifier (BLAKE3 hash of worker + timestamp + type) */
  punchId: string;
  /** Worker wallet address */
  workerAddress: Address;
  /** Agreement ID linking this punch to an employment relationship */
  agreementId: string;
  /** UTC milliseconds when the punch occurred */
  timestamp: number;
  /** Clock in or clock out */
  punchType: PunchType;
  /** Date string YYYY-MM-DD (local time) for grouping */
  date: string;
  /** Optional note (e.g., "lunch break") */
  note?: string;
};

/** Encrypted envelope stored on IPFS — never contains plaintext time data. */
export type EncryptedPunchEnvelope = {
  /** Version tag for forward compatibility */
  version: 1;
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** AES-GCM ciphertext of JSON-serialized PunchData (base64) */
  ciphertext: string;
  /** Worker address (plaintext — needed for lookup) */
  workerAddress: string;
  /** BLAKE3 hash of the plaintext punch data (for integrity verification) */
  punchHash: string;
  /** Punch type (1 or 2 — not sensitive, needed for state derivation) */
  punchType: PunchType;
  /** Date YYYY-MM-DD (not sensitive — needed for grouping without decrypting) */
  date: string;
};

// ---------------------------------------------------------------------------
// Weekly Commitment (on-chain anchor)
// ---------------------------------------------------------------------------

export type WeeklyCommitmentData = {
  /** BLAKE3 hash of all punch CIDs for the week */
  commitmentId: string;
  /** Agreement ID */
  agreementId: string;
  /** Worker name hash */
  workerNameHash: string;
  /** Week start date YYYYMMDD (Monday) */
  weekStart: number;
  /** Total minutes worked */
  totalMinutes: number;
  /** Regular minutes (capped at 40 hours = 2400 minutes) */
  regularMinutes: number;
  /** Overtime minutes (beyond 40 hours) */
  overtimeMinutes: number;
  /** Number of individual punches */
  punchCount: number;
  /** BLAKE3 hash of all punch hashes */
  punchesHash: string;
};

// ---------------------------------------------------------------------------
// Amendment
// ---------------------------------------------------------------------------

export const AMENDMENT_STATUS = {
  PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
} as const;

export type AmendmentStatus =
  (typeof AMENDMENT_STATUS)[keyof typeof AMENDMENT_STATUS];

export type AmendmentData = {
  /** Unique amendment identifier */
  amendmentId: string;
  /** Hash of the original punch being corrected */
  originalPunchHash: string;
  /** CID of the original punch on IPFS */
  originalPunchCid: string;
  /** Agreement ID */
  agreementId: string;
  /** Corrected timestamp (UTC ms) */
  correctedTimestamp: number;
  /** Reason for correction */
  reason: string;
  /** Current status */
  status: AmendmentStatus;
  /** When the amendment was submitted (UTC ms) */
  submittedAt: number;
};

// ---------------------------------------------------------------------------
// Timekeeping Week
// ---------------------------------------------------------------------------

export type TimekeepingWeek = {
  /** ISO week identifier, e.g. "2026-W19" */
  weekId: string;
  /** Monday date YYYY-MM-DD */
  monday: string;
  /** Sunday date YYYY-MM-DD */
  sunday: string;
};

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------

export type PunchStatus = "saving" | "saved" | "error";

export type PendingPunch = {
  type: PunchType;
  timestamp: number;
  status: PunchStatus;
  error?: string;
};
