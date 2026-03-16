"use client";

import { useCallback } from "react";
import { useWallet } from "@demox-labs/aleo-wallet-adapter-react";
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
  const { publicKey, signMessage, connected } = useWallet();

  const canSign = connected && !!signMessage && !!publicKey;

  const sign = useCallback(
    async (context: ChallengeContext): Promise<WalletSignatureProof> => {
      if (!signMessage) {
        throw new Error("Wallet does not support signMessage");
      }
      if (!publicKey) {
        throw new Error("No wallet connected");
      }
      return requestWalletSignature(signMessage, context, publicKey);
    },
    [signMessage, publicKey],
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
