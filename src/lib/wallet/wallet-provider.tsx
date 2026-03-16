"use client";

import { type ReactNode, useMemo } from "react";
import {
  AleoWalletProvider,
  useWallet,
} from "@provablehq/aleo-wallet-adaptor-react";
import { WalletModalProvider } from "@provablehq/aleo-wallet-adaptor-react-ui";
import { Network } from "@provablehq/aleo-types";
import { DecryptPermission } from "@provablehq/aleo-wallet-adaptor-core";
import { ShieldWalletAdapter } from "@provablehq/aleo-wallet-adaptor-shield";
import { PuzzleWalletAdapter } from "@provablehq/aleo-wallet-adaptor-puzzle";
import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { FoxWalletAdapter } from "@provablehq/aleo-wallet-adaptor-fox";
import { SoterWalletAdapter } from "@provablehq/aleo-wallet-adaptor-soter";

// Official wallet adapter CSS (provides the modal, buttons, and icons)
import "@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css";

export { useWallet };

/**
 * Aleo wallet provider — matches the official pattern from
 * aleo-dev-toolkit-react-app.vercel.app/wallet.
 *
 * Adapters: Shield, Puzzle, Leo, Fox, Soter
 * WalletModalProvider wraps children with the pre-built connect modal UI.
 */
export function AleoWalletProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const wallets = useMemo(
    () => [
      new ShieldWalletAdapter(),
      new PuzzleWalletAdapter(),
      new LeoWalletAdapter(),
      new FoxWalletAdapter(),
      new SoterWalletAdapter(),
    ],
    [],
  );

  return (
    <AleoWalletProvider
      wallets={wallets}
      autoConnect={true}
      network={Network.TESTNET}
      decryptPermission={DecryptPermission.UponRequest}
      programs={[
        "credits.aleo",
        "payroll_core.aleo",
        "payroll_nfts.aleo",
        "credential_nfts.aleo",
        "audit_authorization.aleo",
      ]}
      onError={(error) => console.error("[Wallet]", error.message)}
    >
      <WalletModalProvider>
        {children}
      </WalletModalProvider>
    </AleoWalletProvider>
  );
}
