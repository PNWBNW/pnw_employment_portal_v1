/**
 * Shield Wallet Adapter for Aleo.
 *
 * Shield is built by Provable (the team that acquired Leo Wallet).
 * Under the hood, Shield uses the same provider interface as Leo Wallet.
 * This adapter wraps LeoWalletAdapter and re-brands it as "Shield Wallet"
 * so the UI displays correctly.
 *
 * When Provable ships a dedicated Shield adapter package, replace this
 * file with the official import. The public API is identical.
 *
 * Architecture:
 *   window.leoWallet → LeoWalletAdapter → ShieldWalletAdapter (name override)
 *
 * The adapter detects whether the installed extension identifies as
 * "Shield" or "Leo" and works with either.
 */

import { LeoWalletAdapter } from "@demox-labs/aleo-wallet-adapter-leo";

export class ShieldWalletAdapter extends LeoWalletAdapter {
  constructor(config: { appName: string }) {
    super(config);
    // Override the name property to display "Shield Wallet" in the UI.
    // LeoWalletAdapter sets name as a class field, so we override it
    // after construction via Object.defineProperty.
    Object.defineProperty(this, "name", {
      value: "Shield Wallet",
      writable: false,
      configurable: true,
    });
  }
}
