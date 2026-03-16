/**
 * Handshake Codec — encode/decode OfferIntent and AcceptanceSignal
 * for QR codes and shareable links.
 *
 * Payload format: base64url-encoded JSON.
 * URL format: {portal_origin}/worker/offers/review?offer={base64url}
 */

import type { OfferIntent, AcceptanceSignal } from "./types";

// ----------------------------------------------------------------
// Base64url encoding (URL-safe, no padding)
// ----------------------------------------------------------------

function toBase64Url(str: string): string {
  if (typeof window !== "undefined" && typeof btoa === "function") {
    return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  return Buffer.from(str, "utf-8").toString("base64url");
}

function fromBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof window !== "undefined" && typeof atob === "function") {
    return atob(padded);
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

// ----------------------------------------------------------------
// OfferIntent encoding
// ----------------------------------------------------------------

/**
 * Encode an OfferIntent into a base64url string for QR codes and links.
 */
export function encodeOfferIntent(offer: OfferIntent): string {
  return toBase64Url(JSON.stringify(offer));
}

/**
 * Decode a base64url string back into an OfferIntent.
 * Returns null if the payload is invalid.
 */
export function decodeOfferIntent(encoded: string): OfferIntent | null {
  try {
    const json = fromBase64Url(encoded);
    const parsed: unknown = JSON.parse(json);

    if (!isValidOfferIntent(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a shareable URL containing the encoded offer intent.
 */
export function buildOfferUrl(offer: OfferIntent, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const encoded = encodeOfferIntent(offer);
  return `${base}/worker/offers/review?offer=${encoded}`;
}

// ----------------------------------------------------------------
// AcceptanceSignal encoding
// ----------------------------------------------------------------

/**
 * Encode an AcceptanceSignal into a base64url string.
 */
export function encodeAcceptanceSignal(signal: AcceptanceSignal): string {
  return toBase64Url(JSON.stringify(signal));
}

/**
 * Decode a base64url string back into an AcceptanceSignal.
 * Returns null if the payload is invalid.
 */
export function decodeAcceptanceSignal(encoded: string): AcceptanceSignal | null {
  try {
    const json = fromBase64Url(encoded);
    const parsed: unknown = JSON.parse(json);

    if (!isValidAcceptanceSignal(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Build a shareable URL for the acceptance signal (employer receives this).
 */
export function buildAcceptanceUrl(signal: AcceptanceSignal, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const encoded = encodeAcceptanceSignal(signal);
  return `${base}/workers/onboard/confirm?accept=${encoded}`;
}

// ----------------------------------------------------------------
// Validation
// ----------------------------------------------------------------

function isValidOfferIntent(data: unknown): data is OfferIntent {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    obj.version === 1 &&
    typeof obj.employer_address === "string" &&
    typeof obj.employer_name_hash === "string" &&
    typeof obj.worker_address === "string" &&
    typeof obj.worker_name_hash === "string" &&
    typeof obj.industry_code === "number" &&
    typeof obj.pay_frequency_code === "number" &&
    typeof obj.start_epoch === "number" &&
    typeof obj.end_epoch === "number" &&
    typeof obj.review_epoch === "number" &&
    typeof obj.terms_text === "string" &&
    typeof obj.terms_doc_hash === "string" &&
    typeof obj.offer_time_utc === "number" &&
    typeof obj.schema_v === "number" &&
    typeof obj.policy_v === "number" &&
    typeof obj.employer_signature === "string" &&
    typeof obj.signature_timestamp === "number"
  );
}

function isValidAcceptanceSignal(data: unknown): data is AcceptanceSignal {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;

  return (
    obj.version === 1 &&
    typeof obj.agreement_id === "string" &&
    typeof obj.worker_address === "string" &&
    typeof obj.worker_signature === "string" &&
    typeof obj.signature_timestamp === "number"
  );
}
