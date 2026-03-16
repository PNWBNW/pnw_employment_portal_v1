/**
 * Credential Signer — wallet-based challenge-response for credential issuance.
 *
 * Instead of requiring users to paste raw private keys, this module uses
 * the wallet adapter's signMessage() API to prove identity ownership.
 *
 * Flow:
 *   1. Portal generates a deterministic challenge from credential params
 *   2. User's wallet signs the challenge via signMessage(challengeBytes)
 *   3. The signature proves the wallet owner consented to the credential
 *   4. Signature is stored alongside the credential as proof of consent
 *
 * This is used for:
 *   - Credential issuance consent
 *   - Audit authorization consent
 *   - Agreement acceptance signing
 *
 * Security properties:
 *   - Private key never leaves the wallet extension
 *   - Challenge is domain-tagged to prevent replay across contexts
 *   - Timestamp binds the signature to a specific moment
 *   - Credential ID binds the signature to a specific credential
 */

import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";

// ----------------------------------------------------------------
// Challenge generation
// ----------------------------------------------------------------

const CRED_CHALLENGE_TAG = 0x7001;
const AUDIT_CHALLENGE_TAG = 0x7002;
const AGREEMENT_CHALLENGE_TAG = 0x7003;

export type ChallengeContext =
  | { type: "credential"; credential_id: string }
  | { type: "audit"; auth_id: string }
  | { type: "agreement"; agreement_id: string };

/**
 * Generate a deterministic challenge for wallet signing.
 * The challenge is domain-tagged and includes a timestamp to prevent replay.
 */
export function generateChallenge(
  context: ChallengeContext,
  signerAddress: string,
  timestamp?: number,
): { challengeBytes: Uint8Array; challengeHex: string; timestamp: number } {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();

  let tag: number;
  let id: string;
  switch (context.type) {
    case "credential":
      tag = CRED_CHALLENGE_TAG;
      id = context.credential_id;
      break;
    case "audit":
      tag = AUDIT_CHALLENGE_TAG;
      id = context.auth_id;
      break;
    case "agreement":
      tag = AGREEMENT_CHALLENGE_TAG;
      id = context.agreement_id;
      break;
  }

  const tsBytes = new Uint8Array(4);
  tsBytes[0] = (ts >>> 24) & 0xff;
  tsBytes[1] = (ts >>> 16) & 0xff;
  tsBytes[2] = (ts >>> 8) & 0xff;
  tsBytes[3] = ts & 0xff;

  const data = tlvEncode(tag, [
    { tag: 0x01, value: encoder.encode(id) },
    { tag: 0x02, value: encoder.encode(signerAddress) },
    { tag: 0x03, value: tsBytes },
    { tag: 0x04, value: encoder.encode(context.type) },
  ]);

  const challengeHash = domainHash(DOMAIN_TAGS.DOC, data);

  return {
    challengeBytes: challengeHash,
    challengeHex: toHex(challengeHash),
    timestamp: ts,
  };
}

// ----------------------------------------------------------------
// Signature result type
// ----------------------------------------------------------------

export type WalletSignatureProof = {
  /** The challenge that was signed (hex) */
  challenge: string;
  /** The wallet's signature over the challenge (hex) */
  signature: string;
  /** The signer's address (public key) */
  signer: string;
  /** Unix timestamp when the challenge was generated */
  timestamp: number;
  /** What was being signed for */
  context: ChallengeContext;
};

/**
 * Request a wallet signature over a credential/audit/agreement challenge.
 *
 * @param signMessage - The wallet adapter's signMessage function
 * @param context - What is being signed (credential, audit, or agreement)
 * @param signerAddress - The connected wallet's address
 * @returns The complete signature proof
 */
export async function requestWalletSignature(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  context: ChallengeContext,
  signerAddress: string,
): Promise<WalletSignatureProof> {
  const { challengeBytes, challengeHex, timestamp } = generateChallenge(
    context,
    signerAddress,
  );

  const signatureBytes = await signMessage(challengeBytes);
  const signature = toHex(signatureBytes);

  return {
    challenge: challengeHex,
    signature,
    signer: signerAddress,
    timestamp,
    context,
  };
}

// ----------------------------------------------------------------
// Human-readable signing message
// ----------------------------------------------------------------

/**
 * Build a human-readable message shown in the wallet signing prompt.
 * This helps the user understand what they're signing.
 */
export function buildSigningMessage(context: ChallengeContext): string {
  switch (context.type) {
    case "credential":
      return (
        `PNW Employment Portal — Credential Consent\n\n` +
        `By signing, you authorize the issuance of credential:\n` +
        `${context.credential_id}\n\n` +
        `Your private key never leaves your wallet.`
      );
    case "audit":
      return (
        `PNW Employment Portal — Audit Authorization Consent\n\n` +
        `By signing, you authorize audit access:\n` +
        `${context.auth_id}\n\n` +
        `Your private key never leaves your wallet.`
      );
    case "agreement":
      return (
        `PNW Employment Portal — Agreement Acceptance\n\n` +
        `By signing, you accept employment agreement:\n` +
        `${context.agreement_id}\n\n` +
        `Your private key never leaves your wallet.`
      );
  }
}
