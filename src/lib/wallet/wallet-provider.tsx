"use client";

import { type ReactNode, useEffect, useMemo, useRef } from "react";
import {
  AleoWalletProvider,
  useWallet,
} from "@provablehq/aleo-wallet-adaptor-react";
import { WalletModalProvider } from "@provablehq/aleo-wallet-adaptor-react-ui";
import { WalletReadyState } from "@provablehq/aleo-wallet-standard";
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
 * On mobile, wallet adapters report LOADABLE (no browser extension available).
 * The React provider allows LOADABLE through to adapter.connect(), but the
 * adapter throws because it only handles INSTALLED (needs window.shield etc.).
 * The provider's built-in redirect (window.open(adapter.url)) only fires for
 * NOT_DETECTED, not LOADABLE — so mobile users see nothing happen.
 *
 * This component detects when a LOADABLE wallet is selected then immediately
 * deselected (the connect failure path) and redirects to the wallet's URL,
 * which triggers the mobile app's universal/deep link or shows the install page.
 */
function WalletMobileRedirectHandler() {
  const { wallet, connected } = useWallet();
  const lastWalletRef = useRef<{
    url: string | undefined;
    readyState: WalletReadyState;
  } | null>(null);

  useEffect(() => {
    if (wallet && wallet.readyState === WalletReadyState.LOADABLE) {
      lastWalletRef.current = {
        url: wallet.adapter.url,
        readyState: wallet.readyState,
      };
    }

    // Wallet was deselected after a LOADABLE selection → connect failed
    if (!wallet && !connected && lastWalletRef.current) {
      const { url } = lastWalletRef.current;
      lastWalletRef.current = null;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile && url) {
        window.open(url, "_blank");
      }
    }

    if (connected) {
      lastWalletRef.current = null;
    }
  }, [wallet, connected]);

  return null;
}

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
        <WalletMobileRedirectHandler />
        {children}
      </WalletModalProvider>
    </AleoWalletProvider>
  );
}
