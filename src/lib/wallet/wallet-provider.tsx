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
 * Mobile wallet connection works via the wallet's in-app browser:
 * the dApp opens inside the wallet app's webview, where window.shield /
 * window.leoWallet etc. get injected and the adapter detects INSTALLED.
 *
 * When a LOADABLE wallet fails to connect from a regular mobile browser,
 * this component redirects to the wallet's in-app browser URL, loading
 * our dApp inside the wallet so the normal connect flow can proceed.
 */
function WalletMobileRedirectHandler() {
  const { wallet, connected } = useWallet();
  const lastWalletRef = useRef<{
    name: string;
    url: string | undefined;
    readyState: WalletReadyState;
  } | null>(null);

  useEffect(() => {
    if (wallet && wallet.readyState === WalletReadyState.LOADABLE) {
      lastWalletRef.current = {
        name: wallet.adapter.name,
        url: wallet.adapter.url,
        readyState: wallet.readyState,
      };
    }

    // Wallet was deselected after a LOADABLE selection → connect failed
    if (!wallet && !connected && lastWalletRef.current) {
      const { name, url } = lastWalletRef.current;
      lastWalletRef.current = null;

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile) return;

      // Build the in-app browser URL so our dApp loads inside the wallet
      const dAppUrl = encodeURIComponent(window.location.href);
      const redirectUrl = getMobileWalletUrl(name, dAppUrl, url);
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    }

    if (connected) {
      lastWalletRef.current = null;
    }
  }, [wallet, connected]);

  return null;
}

/**
 * Returns the in-app browser URL for a given wallet on mobile.
 * Each wallet app has its own URL scheme to load a dApp in its webview.
 */
function getMobileWalletUrl(
  walletName: string,
  encodedDAppUrl: string,
  fallbackUrl: string | undefined,
): string | undefined {
  const name = walletName.toLowerCase();

  if (name.includes("leo")) {
    // Leo Wallet's in-app browser: opens our dApp inside the Leo webview
    // where window.leoWallet gets injected
    return `https://app.leo.app/browser?url=${encodedDAppUrl}`;
  }

  if (name.includes("fox")) {
    // FoxWallet uses the same Leo in-app browser format
    return `https://app.leo.app/browser?url=${encodedDAppUrl}`;
  }

  if (name.includes("shield")) {
    // Shield: use Android intent to open the app directly.
    // If the Shield app is installed, this deep-links into it.
    // The user can then navigate to the dApp URL in Shield's browser.
    // Fallback: open Shield website to download
    return fallbackUrl || "https://www.shield.app/";
  }

  if (name.includes("puzzle")) {
    return fallbackUrl || "https://puzzle.online/wallet";
  }

  return fallbackUrl;
}

/**
 * Aleo wallet provider — matches the official pattern from
 * aleo-dev-toolkit-react-app.vercel.app/wallet.
 *
 * Adapters: Shield, Puzzle, Leo, Fox, Soter
 * WalletModalProvider wraps children with the pre-built connect modal UI.
 *
 * On mobile, Leo and Fox adapters are configured with the dApp URL so
 * their in-app browser opens our portal (where window.leoWallet exists).
 */
export function AleoWalletProviderWrapper({
  children,
}: {
  children: ReactNode;
}) {
  const wallets = useMemo(() => {
    const isMobile =
      typeof window !== "undefined" &&
      /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const dAppUrl =
      typeof window !== "undefined" ? window.location.origin : "";

    return [
      new ShieldWalletAdapter(),
      new PuzzleWalletAdapter(),
      new LeoWalletAdapter(
        isMobile ? { isMobile: true, mobileWebviewUrl: dAppUrl } : undefined,
      ),
      new FoxWalletAdapter(
        isMobile ? { isMobile: true, mobileWebviewUrl: dAppUrl } : undefined,
      ),
      new SoterWalletAdapter(),
    ];
  }, []);

  return (
    <AleoWalletProvider
      wallets={wallets}
      autoConnect={true}
      network={Network.TESTNET}
      decryptPermission={DecryptPermission.UponRequest}
      programs={[
        "credits.aleo",
        "test_usdcx_stablecoin.aleo",
        "test_usdcx_freezelist.aleo",
        "pnw_name_registry_v2.aleo",
        "pnw_name_registrar_v2.aleo",
        "employer_license_registry.aleo",
        "employer_profiles_v2.aleo",
        "pnw_worker_profiles_v2.aleo",
        "employer_agreement_v3.aleo",
        "payroll_core.aleo",
        "paystub_receipts.aleo",
        "payroll_audit_log.aleo",
        "pnw_router_v3.aleo",
        "payroll_nfts.aleo",
        "credential_nft.aleo",
        "audit_nft.aleo",
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
