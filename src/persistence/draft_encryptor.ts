// ---------------------------------------------------------------------------
// Draft Encryptor — serializes payroll draft state to/from encrypted blobs.
// The KeyProvider handles actual cryptography; this module handles the
// JSON ↔ Uint8Array boundary and content hashing for tamper detection.
// ---------------------------------------------------------------------------

import type { PayrollTableRow } from "@/components/payroll-table/types";
import type { KeyProvider, EncryptedBlob } from "./key_provider";
import { computeDraftIntegrity, verifyDraftIntegrity } from "./draft_integrity";

/**
 * Plaintext draft payload — what gets encrypted and stored.
 */
export type DraftPayload = {
  rows: PayrollTableRow[];
  epochId: string;
  /** Employer address that created this draft */
  employerAddr: string;
  /** ISO timestamp of when the draft was saved */
  savedAt: string;
  /** BLAKE3 Merkle root over row hashes at save time */
  integrityRoot: string;
  /** Number of rows (redundant, for quick display without decryption) */
  rowCount: number;
};

/**
 * Stored draft envelope — the encrypted blob plus unencrypted metadata
 * needed for listing drafts without decrypting them.
 */
export type DraftEnvelope = {
  /** Unique draft ID */
  draftId: string;
  /** Employer address (for filtering — not secret, already on-chain) */
  employerAddr: string;
  /** Epoch ID (for display) */
  epochId: string;
  /** Number of rows */
  rowCount: number;
  /** ISO timestamp */
  savedAt: string;
  /** The encrypted payload */
  blob: EncryptedBlob;
};

/**
 * Encrypt a payroll draft into a storable envelope.
 */
export async function encryptDraft(
  rows: PayrollTableRow[],
  epochId: string,
  employerAddr: string,
  keyProvider: KeyProvider,
  existingDraftId?: string,
): Promise<DraftEnvelope> {
  // Compute integrity root over the row data
  const integrityRoot = computeDraftIntegrity(rows, epochId, employerAddr);

  const payload: DraftPayload = {
    rows,
    epochId,
    employerAddr,
    savedAt: new Date().toISOString(),
    integrityRoot,
    rowCount: rows.length,
  };

  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const blob = await keyProvider.encrypt(plaintext);

  return {
    draftId: existingDraftId ?? crypto.randomUUID(),
    employerAddr,
    epochId,
    rowCount: rows.length,
    savedAt: payload.savedAt,
    blob,
  };
}

/**
 * Decrypt a draft envelope back into rows + metadata.
 * Throws if decryption fails (wrong key or tampered ciphertext).
 * Throws if the Merkle integrity root doesn't match (structural tampering).
 */
export async function decryptDraft(
  envelope: DraftEnvelope,
  keyProvider: KeyProvider,
): Promise<DraftPayload> {
  const plainBytes = await keyProvider.decrypt(envelope.blob);
  const json = new TextDecoder().decode(plainBytes);

  const payload: unknown = JSON.parse(json);

  // Type guard
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("rows" in payload) ||
    !("epochId" in payload) ||
    !("integrityRoot" in payload) ||
    !("employerAddr" in payload)
  ) {
    throw new Error("Decrypted draft has invalid structure");
  }

  const draft = payload as DraftPayload;

  // Verify structural integrity — recompute Merkle root and compare
  const valid = verifyDraftIntegrity(
    draft.rows,
    draft.epochId,
    draft.employerAddr,
    draft.integrityRoot,
  );

  if (!valid) {
    throw new Error(
      "Draft integrity check failed: row data does not match saved Merkle root",
    );
  }

  return draft;
}
