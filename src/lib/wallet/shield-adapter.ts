/**
 * Shield Wallet Adapter for Aleo.
 *
 * Extends the official @provablehq LeoWalletAdapter (since Shield IS Leo Wallet
 * rebranded by Provable). Overrides:
 * - Branding: name, url, icon
 * - Detection: also checks window.aleo and window.shield (not just window.leoWallet)
 *
 * When Provable ships a first-party Shield adapter, replace this file.
 */

import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { WalletReadyState } from "@provablehq/aleo-wallet-standard";

const SHIELD_ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill="#0B1120"/>
      <path d="M32 8L12 18v14c0 12.4 8.53 24 20 28 11.47-4 20-15.6 20-28V18L32 8z" fill="#22C55E" fill-opacity="0.15" stroke="#22C55E" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M24 32l6 6 12-12" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  );

/** Try every known global where Shield / Leo might inject. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findShieldProvider(): any | undefined {
  if (typeof window === "undefined") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.aleo ?? w.shield ?? w.leoWallet ?? w.leo ?? undefined;
}

export class ShieldWalletAdapter extends LeoWalletAdapter {
  constructor() {
    super();

    // Override branding (LeoWalletAdapter types these as const-literals,
    // so we assign in the constructor to avoid TS nominal-type conflicts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    self.name = "Shield Wallet";
    self.url = "https://www.shield.app";
    self.icon = SHIELD_ICON;

    // The parent constructor set up polling with _checkAvailability(), but
    // it only checks window.leoWallet / window.leo. Monkey-patch it to
    // also detect window.aleo and window.shield.
    const originalCheck: () => boolean = self._checkAvailability.bind(this);
    self._checkAvailability = (): boolean => {
      // Try Leo's original check first
      if (originalCheck()) return true;

      // Also check Shield-specific globals
      const provider = findShieldProvider();
      if (provider) {
        self._leoWallet = provider;
        self._readyState = WalletReadyState.INSTALLED;
        self._window = window;
        return true;
      }

      // Mobile fallback
      if (typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        self._readyState = WalletReadyState.LOADABLE;
        return true;
      }

      return false;
    };

    // Run patched check once immediately (parent may have missed Shield globals)
    if (typeof window !== "undefined") {
      self._checkAvailability();
    }
  }
}
