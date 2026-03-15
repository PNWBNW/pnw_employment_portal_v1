// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/commitments/token_id.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

// NFT token ID derivation for cycle NFTs, credential NFTs, and paystub NFTs

import type { Bytes32, Field, U32 } from "./aleo_types";
import { domainHash, DOMAIN_TAGS, toHex } from "./hash";

/** Token ID categories for different NFT types. */
export const TOKEN_ID_PREFIX = {
  CYCLE: 0x01,
  CREDENTIAL: 0x02,
  PAYSTUB: 0x03,
} as const;

export type TokenIdPrefix = (typeof TOKEN_ID_PREFIX)[keyof typeof TOKEN_ID_PREFIX];

/**
 * Derive a deterministic token_id for a cycle NFT.
 * token_id = domainHash("PNW::LEAF", prefix || batch_id || epoch_id)
 */
export function deriveCycleTokenId(batchId: Bytes32, epochId: U32): Field {
  const data = new TextEncoder().encode(
    `${TOKEN_ID_PREFIX.CYCLE}:${batchId}:${epochId}`,
  );
  return toHex(domainHash(DOMAIN_TAGS.LEAF, data));
}

/**
 * Derive a deterministic token_id for a credential NFT.
 * token_id = domainHash("PNW::LEAF", prefix || credential_hash)
 */
export function deriveCredentialTokenId(credentialHash: Bytes32): Field {
  const data = new TextEncoder().encode(
    `${TOKEN_ID_PREFIX.CREDENTIAL}:${credentialHash}`,
  );
  return toHex(domainHash(DOMAIN_TAGS.LEAF, data));
}

/**
 * Derive a deterministic token_id for a paystub NFT.
 * token_id = domainHash("PNW::LEAF", prefix || row_hash)
 */
export function derivePaystubTokenId(rowHash: Bytes32): Field {
  const data = new TextEncoder().encode(
    `${TOKEN_ID_PREFIX.PAYSTUB}:${rowHash}`,
  );
  return toHex(domainHash(DOMAIN_TAGS.LEAF, data));
}
