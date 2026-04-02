/**
 * Terms Vault — AES-256-GCM encryption for agreement terms.
 *
 * Encryption key is derived from agreement_id + employer_address + worker_address.
 * Both parties know these values (from the on-chain PendingAgreement record),
 * so both can independently derive the decryption key.
 *
 * Uses the Web Crypto API — zero dependencies, built into all browsers.
 *
 * Security model:
 * - The encrypted blob is stored on IPFS (public, content-addressed)
 * - The CID is stored in the agreement's terms_doc_hash (private record)
 * - Only someone who knows agreement_id + both addresses can decrypt
 * - agreement_id includes a timestamp hash — not guessable
 * - For mainnet, upgrade to ECIES with the worker's public key
 */

/**
 * Derive an AES-256 key from agreement context.
 * Both employer and worker can derive this independently.
 */
async function deriveKey(
  agreementId: string,
  employerAddress: string,
  workerAddress: string,
): Promise<CryptoKey> {
  // Normalize agreement ID — strip 0x prefix for consistent key derivation
  const cleanId = agreementId.startsWith("0x") ? agreementId.slice(2) : agreementId;
  const encoder = new TextEncoder();
  const material = encoder.encode(
    `PNW::TERMS::${cleanId}::${employerAddress}::${workerAddress}`,
  );

  // Import the material as a raw key for HKDF
  const baseKey = await crypto.subtle.importKey(
    "raw",
    material,
    "HKDF",
    false,
    ["deriveKey"],
  );

  // Derive AES-256-GCM key
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: encoder.encode("pnw-terms-vault-v1"),
      info: encoder.encode("aes-256-gcm"),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt agreement terms (text or binary).
 * Returns a Uint8Array containing: [12-byte IV] + [ciphertext] + [16-byte auth tag]
 */
export async function encryptTerms(
  plaintext: string | Uint8Array,
  agreementId: string,
  employerAddress: string,
  workerAddress: string,
): Promise<Uint8Array> {
  const key = await deriveKey(agreementId, employerAddress, workerAddress);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data =
    typeof plaintext === "string"
      ? new TextEncoder().encode(plaintext)
      : plaintext;

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data.buffer as ArrayBuffer,
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), iv.length);
  return result;
}

/**
 * Decrypt agreement terms.
 * Input must be the format from encryptTerms: [12-byte IV] + [ciphertext + tag]
 */
export async function decryptTerms(
  encrypted: Uint8Array,
  agreementId: string,
  employerAddress: string,
  workerAddress: string,
): Promise<string> {
  const key = await deriveKey(agreementId, employerAddress, workerAddress);

  const iv = encrypted.slice(0, 12);
  const ciphertext = encrypted.slice(12);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext.buffer as ArrayBuffer,
  );

  return new TextDecoder().decode(plaintext);
}
