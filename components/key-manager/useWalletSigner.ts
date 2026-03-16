"use client";

import { useCallback } from "react";
import { useWallet } from "@/src/lib/wallet/wallet-provider";
import {
  requestWalletSignature,
  type ChallengeContext,
  type WalletSignatureProof,
} from "@/src/lib/wallet/credential-signer";

/**
 * Hook for wallet-based credential/audit/agreement signing.
 *
 * Uses the connected wallet's signMessage() API to sign challenges
 * without ever exposing the private key to the portal.
 *
 * Usage:
 *   const { signForCredential, signForAudit, canSign } = useWalletSigner();
 *   const proof = await signForCredential(credentialId);
 */
export function useWalletSigner() {
  const { address, signMessage, connected } = useWallet();

  const canSign = connected && !!signMessage && !!address;

  const sign = useCallback(
    async (context: ChallengeContext): Promise<WalletSignatureProof> => {
      if (!signMessage) {
        throw new Error("Wallet does not support signMessage");
      }
      if (!address) {
        throw new Error("No wallet connected");
      }
      // Wrap signMessage to match the strict (Uint8Array) => Promise<Uint8Array> signature
      // that requestWalletSignature expects. The provider's version accepts string | Uint8Array
      // and may return undefined, but we only ever pass Uint8Array and throw on undefined.
      const sign = async (msg: Uint8Array): Promise<Uint8Array> => {
        const result = await signMessage(msg);
        if (!result) throw new Error("signMessage returned empty result");
        return result;
      };
      return requestWalletSignature(sign, context, address);
    },
    [signMessage, address],
  );

  const signForCredential = useCallback(
    (credentialId: string) =>
      sign({ type: "credential", credential_id: credentialId }),
    [sign],
  );

  const signForAudit = useCallback(
    (authId: string) => sign({ type: "audit", auth_id: authId }),
    [sign],
  );

  const signForAgreement = useCallback(
    (agreementId: string) =>
      sign({ type: "agreement", agreement_id: agreementId }),
    [sign],
  );

  return {
    canSign,
    sign,
    signForCredential,
    signForAudit,
    signForAgreement,
  };
}
