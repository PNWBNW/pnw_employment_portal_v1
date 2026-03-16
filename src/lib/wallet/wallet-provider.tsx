"use client";

import { type ReactNode, useMemo } from "react";
import {
  WalletProvider as AleoWalletProvider,
  useWallet,
} from "@demox-labs/aleo-wallet-adapter-react";
import { WalletAdapterNetwork } from "@demox-labs/aleo-wallet-adapter-base";
import {
  PuzzleWalletAdapter,
  FoxWalletAdapter,
  SoterWalletAdapter,
} from "aleo-adapters";
import { ShieldWalletAdapter } from "./shield-adapter";

export { useWallet };

/**
 * Aleo wallet provider.
 *
 * Configures adapters for all available wallets:
 * - Shield Wallet (primary — built by Provable, successor to Leo Wallet)
 * - Puzzle Wallet (via aleo-adapters, WalletConnect V2)
 * - Fox Wallet (via aleo-adapters)
 * - Soter Wallet (via aleo-adapters)
 *
 * Shield Wallet is the rebranded Leo Wallet by Provable. It uses the same
 * browser extension / provider interface (window.leoWallet / window.leo).
 * We no longer list Leo separately — Shield IS Leo.
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
        programIdPermissions: {
          [WalletAdapterNetwork.TestnetBeta]: [
            "payroll_core.aleo",
            "payroll_nfts.aleo",
            "credential_nfts.aleo",
            "audit_authorization.aleo",
          ],
        },
      }),
      new FoxWalletAdapter({ appName: "PNW Employment Portal" }),
      new SoterWalletAdapter({ appName: "PNW Employment Portal" }),
    ],
    [],
  );

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={WalletAdapterNetwork.TestnetBeta}
      autoConnect={false}
    >
      {children}
    </AleoWalletProvider>
  );
}
