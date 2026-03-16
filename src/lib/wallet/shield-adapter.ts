/**
 * Shield Wallet Adapter for Aleo.
 *
 * Extends the official @provablehq LeoWalletAdapter (since Shield IS Leo Wallet
 * rebranded by Provable). Overrides:
 * - Branding: name, url, icon
 * - Detection: also checks window.aleo and window.shield
 * - Connect: passes network string directly (not via LEO_NETWORK_MAP which
 *   converts "testnet" → "testnetbeta", causing mismatch with newer wallets)
 *
 * When Provable ships a first-party Shield adapter, replace this file.
 */

import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { WalletReadyState, type WalletDecryptPermission } from "@provablehq/aleo-wallet-standard";
import { type Network, type Account } from "@provablehq/aleo-types";
import { WalletConnectionError, WalletNotConnectedError } from "@provablehq/aleo-wallet-adaptor-core";

const SHIELD_ICON =
  "data:image/svg+xml;base64," +
  btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" fill="#0B1120"/>
      <path d="M32 8L12 18v14c0 12.4 8.53 24 20 28 11.47-4 20-15.6 20-28V18L32 8z" fill="#22C55E" fill-opacity="0.15" stroke="#22C55E" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M24 32l6 6 12-12" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  );

/**
 * Network strings the wallet might accept.
 * Aleo graduated from "testnetbeta" to "testnet", but older extensions
 * still use "testnetbeta". We try both.
 */
const NETWORK_ALIASES: Record<string, string[]> = {
  testnet: ["testnet", "testnetbeta"],
  mainnet: ["mainnet"],
  canary: ["canary", "testnetbeta"],
};

/** Try every known global where Shield / Leo might inject. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findShieldProvider(): any | undefined {
  if (typeof window === "undefined") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;

  console.debug("[ShieldWallet] Detection check:", {
    "window.aleo": !!w.aleo,
    "window.shield": !!w.shield,
    "window.leoWallet": !!w.leoWallet,
    "window.leo": !!w.leo,
    "window.provable": !!w.provable,
    "window.aleoWallet": !!w.aleoWallet,
  });

  return w.aleo ?? w.shield ?? w.leoWallet ?? w.leo ?? w.provable ?? w.aleoWallet ?? undefined;
}

export class ShieldWalletAdapter extends LeoWalletAdapter {
  constructor() {
    super();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    self.name = "Shield Wallet";
    self.url = "https://www.shield.app";
    self.icon = SHIELD_ICON;

    // Monkey-patch _checkAvailability to also detect Shield-specific globals.
    // IMPORTANT: use `self.readyState = ...` (setter) not `self._readyState = ...`
    // so that the readyStateChange event fires and the UI updates.
    const originalCheck: () => boolean = self._checkAvailability.bind(this);
    self._checkAvailability = (): boolean => {
      if (originalCheck()) return true;

      const provider = findShieldProvider();
      if (provider) {
        self._leoWallet = provider;
        self.readyState = WalletReadyState.INSTALLED; // setter → emits event
        self._window = window;
        return true;
      }

      if (typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        self.readyState = WalletReadyState.LOADABLE; // setter → emits event
        return true;
      }

      return false;
    };

    if (typeof window !== "undefined") {
      self._checkAvailability();
    }
  }

  /**
   * Override connect to:
   * 1. Try network aliases ("testnet" then "testnetbeta") instead of just
   *    LEO_NETWORK_MAP which hardcodes "testnetbeta"
   * 2. Expose the ACTUAL error instead of always wrapping it as "network mismatch"
   */
  override async connect(
    network: Network,
    decryptPermission: WalletDecryptPermission,
    programs?: string[],
  ): Promise<Account> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    const wallet = self._leoWallet;

    if (!wallet) {
      throw new WalletConnectionError("Shield extension not found. Install from https://www.shield.app");
    }

    const aliases = NETWORK_ALIASES[network] ?? [network];
    let lastError: unknown;

    // Try each network alias until one works
    for (const netStr of aliases) {
      try {
        console.debug(`[ShieldWallet] Trying connect with network="${netStr}", decryptPermission="${decryptPermission}"`);
        await wallet.connect(decryptPermission, netStr, programs);

        const publicKey = wallet.publicKey;
        if (!publicKey) {
          throw new WalletConnectionError("No address returned from wallet");
        }

        self._publicKey = publicKey;
        self.decryptPermission = decryptPermission;
        self.network = network;

        const account: Account = { address: publicKey };
        self.account = account;
        this.emit("connect", account);

        console.debug(`[ShieldWallet] Connected! address=${publicKey}, network=${netStr}`);
        return account;
      } catch (err) {
        console.debug(`[ShieldWallet] connect failed with network="${netStr}":`, err);
        lastError = err;
        // If user explicitly rejected, don't try other aliases
        if (err instanceof Object && "name" in err && err.name === "NotGrantedAleoWalletError") {
          throw new WalletConnectionError("Connection rejected by user");
        }
      }
    }

    // All aliases failed — throw with the actual error message
    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    throw new WalletConnectionError(
      `Shield connection failed: ${msg}. ` +
      `Make sure your wallet is set to the correct network (tried: ${aliases.join(", ")}).`,
    );
  }
}
