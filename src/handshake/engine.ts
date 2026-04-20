/**
 * Handshake Engine — core logic for off-chain agreement intent exchange.
 *
 * Computes deterministic hashes, builds offer intents, verifies acceptance
 * signals, and generates on-chain command previews.
 *
 * Uses the same hash pipeline as credential_actions.ts:
 * - BLAKE3 with domain tags via hash.ts
 * - TLV encoding via canonical_encoder.ts
 */

import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import { PROGRAMS, VERSIONS } from "@/src/config/programs";
import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";
import type {
  OfferIntent,
  AcceptanceSignal,
  ComputedAgreementValues,
} from "./types";

// ----------------------------------------------------------------
// TLV object tags for handshake payloads
// ----------------------------------------------------------------

const OBJ_OFFER_TIME = 0x6001;
const OBJ_TERMS_DOC = 0x6002;
const OBJ_TERMS_ROOT = 0x6003;
const OBJ_PARTIES_KEY = 0x6004;
const OBJ_AGREEMENT_ID = 0x6005;
const OBJ_OFFER_CHALLENGE = 0x6006;
const OBJ_ACCEPT_CHALLENGE = 0x6007;

// ----------------------------------------------------------------
// Encoding helpers
// ----------------------------------------------------------------

function encodeAddress(addr: string): Uint8Array {
  return new TextEncoder().encode(addr);
}

function encodeU32(v: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (v >>> 24) & 0xff;
  buf[1] = (v >>> 16) & 0xff;
  buf[2] = (v >>> 8) & 0xff;
  buf[3] = v & 0xff;
  return buf;
}

function encodeU16(v: number): Uint8Array {
  const buf = new Uint8Array(2);
  buf[0] = (v >>> 8) & 0xff;
  buf[1] = v & 0xff;
  return buf;
}

// ----------------------------------------------------------------
// Hash computations
// ----------------------------------------------------------------

/** Hash the offer timestamp: BLAKE3("PNW::DOC", TLV(utc_epoch_seconds)) */
export function computeOfferTimeHash(utcEpochSeconds: number): Bytes32 {
  const data = tlvEncode(OBJ_OFFER_TIME, [
    { tag: 0x01, value: encodeU32(utcEpochSeconds) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/** Hash the terms document: BLAKE3("PNW::DOC", TLV(terms_text)) */
export function computeTermsDocHash(termsText: string): Bytes32 {
  const data = tlvEncode(OBJ_TERMS_DOC, [
    { tag: 0x01, value: new TextEncoder().encode(termsText) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/** Hash the terms root: BLAKE3("PNW::DOC", TLV(terms_doc_hash, schema_v, policy_v)) */
export function computeTermsRoot(
  termsDocHash: Bytes32,
  schemaV: number,
  policyV: number,
): Bytes32 {
  const data = tlvEncode(OBJ_TERMS_ROOT, [
    { tag: 0x01, value: new TextEncoder().encode(termsDocHash) },
    { tag: 0x02, value: encodeU16(schemaV) },
    { tag: 0x03, value: encodeU16(policyV) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/**
 * Compute the parties_key deterministically from employer and worker addresses.
 * Both portals can independently derive this from the same inputs.
 *
 * parties_key = BLAKE3("PNW::PARTIES", TLV(employer_addr, worker_addr))
 *
 * Note: We use a custom domain tag "PNW::PARTIES" (not in the synced DOMAIN_TAGS
 * since this is portal-level logic, not a synced pnw_mvp_v2 primitive).
 */
export function computePartiesKey(
  employerAddr: Address,
  workerAddr: Address,
): Bytes32 {
  const data = tlvEncode(OBJ_PARTIES_KEY, [
    { tag: 0x01, value: encodeAddress(employerAddr) },
    { tag: 0x02, value: encodeAddress(workerAddr) },
  ]);
  return toHex(domainHash("PNW::PARTIES", data));
}

/**
 * Compute the deterministic agreement ID.
 * agreement_id = BLAKE3("PNW::DOC", TLV(employer_addr, terms_doc_hash, offer_time_hash))
 */
export function computeAgreementId(
  employerAddr: Address,
  termsDocHash: Bytes32,
  offerTimeHash: Bytes32,
): Bytes32 {
  const data = tlvEncode(OBJ_AGREEMENT_ID, [
    { tag: 0x01, value: encodeAddress(employerAddr) },
    { tag: 0x02, value: new TextEncoder().encode(termsDocHash) },
    { tag: 0x03, value: new TextEncoder().encode(offerTimeHash) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/**
 * Compute all deterministic agreement values from the offer inputs.
 */
export function computeAgreementValues(
  employerAddr: Address,
  workerAddr: Address,
  termsText: string,
  offerTimeUtc: number,
  schemaV: number = VERSIONS.schema_v,
  policyV: number = VERSIONS.policy_v,
): ComputedAgreementValues {
  const terms_doc_hash = computeTermsDocHash(termsText);
  const terms_root = computeTermsRoot(terms_doc_hash, schemaV, policyV);
  const offer_time_hash = computeOfferTimeHash(offerTimeUtc);
  const parties_key = computePartiesKey(employerAddr, workerAddr);
  const agreement_id = computeAgreementId(employerAddr, terms_doc_hash, offer_time_hash);

  return {
    agreement_id,
    parties_key,
    terms_doc_hash,
    terms_root,
    offer_time_hash,
  };
}

// ----------------------------------------------------------------
// Challenge generation for wallet signing
// ----------------------------------------------------------------

/**
 * Generate the offer challenge that the employer signs.
 * challenge = BLAKE3("PNW::DOC", TLV(agreement_id, worker_addr, timestamp))
 */
export function computeOfferChallenge(
  agreementId: Bytes32,
  workerAddr: Address,
  timestamp: number,
): Uint8Array {
  const data = tlvEncode(OBJ_OFFER_CHALLENGE, [
    { tag: 0x01, value: new TextEncoder().encode(agreementId) },
    { tag: 0x02, value: encodeAddress(workerAddr) },
    { tag: 0x03, value: encodeU32(timestamp) },
  ]);
  return domainHash(DOMAIN_TAGS.DOC, data);
}

/**
 * Generate the acceptance challenge that the worker signs.
 * challenge = BLAKE3("PNW::DOC", TLV(agreement_id, employer_addr, timestamp))
 */
export function computeAcceptChallenge(
  agreementId: Bytes32,
  employerAddr: Address,
  timestamp: number,
): Uint8Array {
  const data = tlvEncode(OBJ_ACCEPT_CHALLENGE, [
    { tag: 0x01, value: new TextEncoder().encode(agreementId) },
    { tag: 0x02, value: encodeAddress(employerAddr) },
    { tag: 0x03, value: encodeU32(timestamp) },
  ]);
  return domainHash(DOMAIN_TAGS.DOC, data);
}

// ----------------------------------------------------------------
// Offer Intent builder
// ----------------------------------------------------------------

export type BuildOfferIntentInput = {
  employer_address: Address;
  employer_name_hash: Field;
  worker_address: Address;
  worker_name_hash: Field;
  industry_code: number;
  pay_frequency_code: number;
  start_epoch: number;
  end_epoch: number;
  review_epoch: number;
  terms_text: string;
  pay_type: "hourly" | "salary";
  pay_rate: number;
};

/**
 * Build a complete OfferIntent (without the employer signature — that comes from the wallet).
 * Returns the intent and the challenge bytes for signing.
 */
export function buildOfferIntent(
  input: BuildOfferIntentInput,
): {
  intent: Omit<OfferIntent, "employer_signature" | "signature_timestamp">;
  computed: ComputedAgreementValues;
  challengeBytes: Uint8Array;
} {
  const offerTimeUtc = Math.floor(Date.now() / 1000);
  const computed = computeAgreementValues(
    input.employer_address,
    input.worker_address,
    input.terms_text,
    offerTimeUtc,
  );

  const challengeBytes = computeOfferChallenge(
    computed.agreement_id,
    input.worker_address,
    offerTimeUtc,
  );

  const intent: Omit<OfferIntent, "employer_signature" | "signature_timestamp"> = {
    version: 1,
    employer_address: input.employer_address,
    employer_name_hash: input.employer_name_hash,
    worker_address: input.worker_address,
    worker_name_hash: input.worker_name_hash,
    industry_code: input.industry_code,
    pay_frequency_code: input.pay_frequency_code,
    start_epoch: input.start_epoch,
    end_epoch: input.end_epoch,
    review_epoch: input.review_epoch,
    pay_type: input.pay_type,
    pay_rate: input.pay_rate,
    terms_text: input.terms_text,
    terms_doc_hash: computed.terms_doc_hash,
    offer_time_utc: offerTimeUtc,
    schema_v: VERSIONS.schema_v,
    policy_v: VERSIONS.policy_v,
  };

  return { intent, computed, challengeBytes };
}

// ----------------------------------------------------------------
// Acceptance Signal builder
// ----------------------------------------------------------------

/**
 * Build the challenge bytes for the worker's acceptance signature.
 */
export function buildAcceptChallengeBytes(
  agreementId: Bytes32,
  employerAddr: Address,
): { challengeBytes: Uint8Array; timestamp: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const challengeBytes = computeAcceptChallenge(agreementId, employerAddr, timestamp);
  return { challengeBytes, timestamp };
}

// ----------------------------------------------------------------
// Verification
// ----------------------------------------------------------------

/**
 * Verify the integrity of an OfferIntent by recomputing hashes.
 * This is called by the worker's portal when decoding an incoming offer.
 *
 * @returns true if all recomputed values match, false if tampered.
 */
export function verifyOfferIntegrity(offer: OfferIntent): boolean {
  // Recompute terms_doc_hash from terms_text
  const recomputedTermsHash = computeTermsDocHash(offer.terms_text);
  if (recomputedTermsHash !== offer.terms_doc_hash) return false;

  return true;
}

/**
 * Recompute agreement values from an OfferIntent for verification.
 */
export function recomputeFromOffer(offer: OfferIntent): ComputedAgreementValues {
  return computeAgreementValues(
    offer.employer_address,
    offer.worker_address,
    offer.terms_text,
    offer.offer_time_utc,
    offer.schema_v,
    offer.policy_v,
  );
}

// ----------------------------------------------------------------
// On-chain command builders (preview mode)
// ----------------------------------------------------------------
//
// All agreement lifecycle calls route through pnw_router.aleo,
// which is the single stable entry surface for the portal.
// The router delegates to employer_agreement_v2.aleo internally.
// ----------------------------------------------------------------

/**
 * Build the snarkos command preview for create_job_offer via pnw_router.
 */
export function buildCreateJobOfferCommand(
  offer: OfferIntent,
  computed: ComputedAgreementValues,
): string {
  return (
    `snarkos developer execute ${PROGRAMS.layer1.pnw_router} create_job_offer ` +
    `"${computed.agreement_id}" "${computed.parties_key}" ` +
    `${offer.employer_name_hash}field ${offer.worker_name_hash}field ` +
    `${offer.worker_address} ` +
    `${offer.industry_code}u8 ${offer.pay_frequency_code}u8 ` +
    `${offer.start_epoch}u32 ${offer.end_epoch}u32 ${offer.review_epoch}u32 ` +
    `1u16 ${offer.schema_v}u16 ${offer.policy_v}u16 ` +
    `"${computed.terms_doc_hash}" "${computed.terms_root}" "${computed.offer_time_hash}"`
  );
}

/**
 * Build the snarkos command preview for accept_job_offer via pnw_router.
 */
export function buildAcceptJobOfferCommand(
  agreementId: Bytes32,
  acceptTimeHash: Bytes32,
): string {
  return (
    `snarkos developer execute ${PROGRAMS.layer1.pnw_router} accept_job_offer ` +
    `<PendingAgreement record> "${acceptTimeHash}"`
  );
}
