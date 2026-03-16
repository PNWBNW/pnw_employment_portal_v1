"use client";

import { type ReactNode, useMemo } from "react";
import {
  AleoWalletProvider,
  useWallet,
} from "@provablehq/aleo-wallet-adaptor-react";
import { Network } from "@provablehq/aleo-types";
import { DecryptPermission } from "@provablehq/aleo-wallet-adaptor-core";
import { PuzzleWalletAdapter } from "@provablehq/aleo-wallet-adaptor-puzzle";
import { ShieldWalletAdapter } from "./shield-adapter";

export { useWallet };

/**
 * Aleo wallet provider — uses the official @provablehq adapter stack.
 *
 * Adapters:
 * - Shield Wallet (official @provablehq/aleo-wallet-adaptor-shield)
 * - Puzzle Wallet (WalletConnect V2)
 *
 * Network and decrypt permission are configured at the provider level.
 * Individual connect() calls do not need to pass these.
 */
export function AleoWalletProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const wallets = useMemo(
    () => [
      new ShieldWalletAdapter(),
      new PuzzleWalletAdapter({
        appName: "PNW Employment Portal",
      }),
    ],
    [],
  );

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={Network.TESTNET}
      autoConnect={false}
      decryptPermission={DecryptPermission.AutoDecrypt}
      programs={[
        "payroll_core.aleo",
        "payroll_nfts.aleo",
        "credential_nfts.aleo",
        "audit_authorization.aleo",
      ]}
    >
      {children}
    </AleoWalletProvider>
  );
}
