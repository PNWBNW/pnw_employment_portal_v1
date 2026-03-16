/**
 * Shield Wallet Adapter for Aleo.
 *
 * Extends the official @provablehq LeoWalletAdapter (since Shield IS Leo Wallet
 * rebranded by Provable). Overrides name, url, and icon to use Shield branding.
 *
 * Detection: window.leoWallet → window.leo (same as Leo — the underlying
 * Chrome extension is the same, just rebranded).
 *
 * When Provable ships a first-party Shield adapter, replace this file.
 */

import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";

const SHIELD_ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill="#0B1120"/>
      <path d="M32 8L12 18v14c0 12.4 8.53 24 20 28 11.47-4 20-15.6 20-28V18L32 8z" fill="#22C55E" fill-opacity="0.15" stroke="#22C55E" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M24 32l6 6 12-12" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  );

export class ShieldWalletAdapter extends LeoWalletAdapter {
  constructor() {
    super();
    // Override branding — LeoWalletAdapter types name/icon as const literals,
    // so we assign in the constructor to avoid TS nominal-type conflicts.
    (this as any).name = "Shield Wallet";
    (this as any).url = "https://www.shield.app";
    (this as any).icon = SHIELD_ICON;
  }
}
