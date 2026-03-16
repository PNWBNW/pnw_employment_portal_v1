// ---------------------------------------------------------------------------
// Key Provider — abstraction over where encryption keys come from.
// MVP: derives AES-256-GCM key from the Aleo view key in session.
// Future: WalletKeyProvider (wallet adapter) or DaemonKeyProvider (DIDComm).
// ---------------------------------------------------------------------------

/**
 * Opaque encrypted blob returned by a KeyProvider.
 * iv + ciphertext are stored together; the provider knows how to decrypt.
 */
export type EncryptedBlob = {
  /** AES-GCM initialization vector (base64) */
  iv: string;
  /** AES-GCM ciphertext + auth tag (base64) */
  ciphertext: string;
};

/**
 * Interface for key material providers.
 * Implementations control where the key lives (session, wallet, hardware).
 */
export interface KeyProvider {
  /** Encrypt arbitrary bytes. */
  encrypt(plaintext: Uint8Array): Promise<EncryptedBlob>;
  /** Decrypt a blob previously produced by encrypt(). Throws on tamper. */
  decrypt(blob: EncryptedBlob): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64Decode(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Session Key Provider — derives AES key from the Aleo view key
// ---------------------------------------------------------------------------

/**
 * Derives an AES-256-GCM CryptoKey from the employer's view key using
 * PBKDF2 with a fixed application salt. The view key is already high-entropy
 * so a single PBKDF2 iteration would suffice, but we use 100k for defense
 * in depth in case a view key is weaker than expected.
 */
async function deriveAesKey(viewKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(viewKey),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  // Fixed, application-specific salt — not secret, just domain separation
  const salt = enc.encode("PNW::DraftEncryption::v1");

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, // not extractable
    ["encrypt", "decrypt"],
  );
}

export class SessionKeyProvider implements KeyProvider {
  private keyPromise: Promise<CryptoKey>;

  constructor(viewKey: string) {
    if (!viewKey) throw new Error("SessionKeyProvider requires a view key");
    this.keyPromise = deriveAesKey(viewKey);
  }

  async encrypt(plaintext: Uint8Array): Promise<EncryptedBlob> {
    const key = await this.keyPromise;
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const cipherBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
      key,
      plaintext as unknown as ArrayBuffer,
    );
    return {
      iv: base64Encode(iv),
      ciphertext: base64Encode(new Uint8Array(cipherBuf)),
    };
  }

  async decrypt(blob: EncryptedBlob): Promise<Uint8Array> {
    const key = await this.keyPromise;
    const iv = base64Decode(blob.iv);
    const ciphertext = base64Decode(blob.ciphertext);
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as unknown as ArrayBuffer },
      key,
      ciphertext as unknown as ArrayBuffer,
    );
    return new Uint8Array(plainBuf);
  }
}
