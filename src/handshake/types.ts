/**
 * Handshake Types — off-chain agreement intent exchange types.
 *
 * These types define the payloads exchanged between employer and worker
 * portals before any on-chain transaction is broadcast.
 */

import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";

// ----------------------------------------------------------------
// Offer Intent — employer → worker (off-chain)
// ----------------------------------------------------------------

export type OfferIntent = {
  /** Protocol version */
  version: 1;

  // Identity
  employer_address: Address;
  employer_name_hash: Field;
  worker_address: Address;
  worker_name_hash: Field;

  // Agreement params
  industry_code: number;
  pay_frequency_code: number;
  start_epoch: number;
  end_epoch: number; // 0 = open-ended
  review_epoch: number;

  // Terms
  terms_text: string;           // plaintext for worker review (never on-chain)
  terms_doc_hash: Bytes32;      // BLAKE3("PNW::DOC", TLV(terms_text))

  // Time
  offer_time_utc: number;       // UTC epoch seconds

  // Versioning
  schema_v: number;
  policy_v: number;

  // Proof of employer intent
  employer_signature: string;   // wallet signature over offer challenge
  signature_timestamp: number;
};

// ----------------------------------------------------------------
// Acceptance Signal — worker → employer (off-chain)
// ----------------------------------------------------------------

export type AcceptanceSignal = {
  /** Protocol version */
  version: 1;

  /** The agreement this acceptance is for */
  agreement_id: Bytes32;

  /** Worker's wallet address */
  worker_address: Address;

  /** Worker's wallet signature over acceptance challenge */
  worker_signature: string;

  /** When the signature was created */
  signature_timestamp: number;
};

// ----------------------------------------------------------------
// Computed agreement values (derived from OfferIntent)
// ----------------------------------------------------------------

export type ComputedAgreementValues = {
  agreement_id: Bytes32;
  parties_key: Bytes32;
  terms_doc_hash: Bytes32;
  terms_root: Bytes32;
  offer_time_hash: Bytes32;
};

// ----------------------------------------------------------------
// Pay frequency codes (match employer_agreement_v2.aleo)
// ----------------------------------------------------------------

export const PAY_FREQUENCY_CODES = {
  DAILY: 1,
  WEEKLY: 2,
  BIWEEKLY: 3,
  MONTHLY: 4,
  QUARTERLY: 5,
} as const;

export const PAY_FREQUENCY_LABELS: Record<number, string> = {
  1: "Daily",
  2: "Weekly",
  3: "Bi-weekly",
  4: "Monthly",
  5: "Quarterly",
};

// ----------------------------------------------------------------
// Offer status (portal-side tracking)
// ----------------------------------------------------------------

export type OfferStatus =
  | "draft"           // employer is filling the form
  | "sent"            // QR/link generated, waiting for worker
  | "accepted"        // worker signed acceptance signal
  | "broadcasting"    // on-chain create_job_offer in progress
  | "pending_accept"  // PendingAgreement minted, worker needs to accept on-chain
  | "active"          // FinalAgreement minted, agreement is live
  | "expired"         // offer timed out
  | "declined";       // worker declined off-chain

export type TrackedOffer = {
  offer: OfferIntent;
  computed: ComputedAgreementValues;
  status: OfferStatus;
  acceptance?: AcceptanceSignal;
  display_name?: string;
  created_at: number; // UTC ms
};
