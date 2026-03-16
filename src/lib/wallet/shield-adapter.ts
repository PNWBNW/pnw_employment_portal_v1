/**
 * Shield Wallet Adapter for Aleo.
 *
 * Shield is built by Provable (the team behind Leo Wallet). Shield IS Leo Wallet
 * rebranded — the Chrome extension injects `window.leoWallet` / `window.leo`.
 *
 * This adapter extends BaseMessageSignerWalletAdapter directly (no dependency on
 * @demox-labs/aleo-wallet-adapter-leo) so we fully control branding, download URL,
 * and provider detection.
 *
 * Detection order: window.aleo → window.leoWallet → window.leo
 *
 * When Provable ships a stable @provablehq wallet adapter package with a built-in
 * Shield adapter, replace this file with the official import.
 */

import {
  BaseMessageSignerWalletAdapter,
  scopePollingDetectionStrategy,
  WalletConnectionError,
  WalletDisconnectionError,
  WalletNotConnectedError,
  WalletNotReadyError,
  WalletReadyState,
  WalletSignTransactionError,
  WalletDecryptionNotAllowedError,
  WalletDecryptionError,
  WalletRecordsError,
  WalletTransactionError,
  DecryptPermission,
} from "@demox-labs/aleo-wallet-adapter-base";
import type { AleoTransaction, AleoDeployment, WalletName } from "@demox-labs/aleo-wallet-adapter-base";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WalletProvider = any;

export const ShieldWalletName = "Shield Wallet" as WalletName<"Shield Wallet">;

/** Resolve the injected wallet provider from the global scope. */
function getProvider(): WalletProvider | undefined {
  if (typeof window === "undefined") return undefined;
  // Shield may register under any of these globals.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.aleo ?? w.leoWallet ?? w.leo ?? undefined;
}

export class ShieldWalletAdapter extends BaseMessageSignerWalletAdapter {
  name = ShieldWalletName;
  url = "https://www.shield.app";

  // Shield logo — green shield icon (SVG as data URI)
  icon =
    "data:image/svg+xml;base64," +
    btoa(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
        <rect width="64" height="64" rx="14" fill="#0B1120"/>
        <path d="M32 8L12 18v14c0 12.4 8.53 24 20 28 11.47-4 20-15.6 20-28V18L32 8z" fill="#22C55E" fill-opacity="0.15" stroke="#22C55E" stroke-width="2.5" stroke-linejoin="round"/>
        <path d="M24 32l6 6 12-12" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`,
    );

  supportedTransactionVersions = null;

  private _connecting = false;
  private _wallet: WalletProvider | null = null;
  private _publicKey: string | null = null;
  private _decryptPermission: string = DecryptPermission.NoDecrypt;

  _readyState: WalletReadyState =
    typeof window === "undefined" || typeof document === "undefined"
      ? WalletReadyState.Unsupported
      : WalletReadyState.NotDetected;

  constructor() {
    super();

    if (this._readyState !== WalletReadyState.Unsupported) {
      scopePollingDetectionStrategy(() => {
        const provider = getProvider();
        if (provider) {
          this._readyState = WalletReadyState.Installed;
          this.emit("readyStateChange", this._readyState);
          // Wake up the service worker if available.
          if (provider.isAvailable) {
            provider.isAvailable();
          }
          return true;
        }
        return false;
      });
    }
  }

  get publicKey() {
    return this._publicKey;
  }

  get decryptPermission() {
    return this._decryptPermission;
  }

  get connecting() {
    return this._connecting;
  }

  get readyState() {
    return this._readyState;
  }

  set readyState(state: WalletReadyState) {
    this._readyState = state;
  }

  // ── Connection ────────────────────────────────────────────────

  async connect(
    decryptPermission: string,
    network: string,
    programs?: string[],
  ): Promise<void> {
    try {
      if (this.connected || this.connecting) return;
      if (this._readyState !== WalletReadyState.Installed)
        throw new WalletNotReadyError();

      this._connecting = true;
      const wallet = getProvider();
      if (!wallet) throw new WalletConnectionError("Shield extension not found");

      const isAvailable = wallet.isAvailable
        ? await wallet.isAvailable()
        : true;
      if (!isAvailable)
        throw new WalletConnectionError("The wallet is not available");

      try {
        await wallet.connect(decryptPermission, network, programs);
        if (!wallet?.publicKey) throw new WalletConnectionError();
        this._publicKey = wallet.publicKey;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletConnectionError(msg);
      }

      this._wallet = wallet;
      this._decryptPermission = decryptPermission;
      this.emit("connect", this._publicKey!);
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const wallet = this._wallet;
    if (wallet) {
      this._wallet = null;
      this._publicKey = null;
      try {
        await wallet.disconnect();
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        this.emit("error", new WalletDisconnectionError(msg));
      }
    }
    this.emit("disconnect");
  }

  // ── Signing ───────────────────────────────────────────────────

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.signMessage(message);
        return result.signature;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletSignTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  // ── Decrypt / Records ─────────────────────────────────────────

  async decrypt(
    cipherText: string,
    tpk?: string,
    programId?: string,
    functionName?: string,
    index?: number,
  ): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();

      switch (this._decryptPermission) {
        case DecryptPermission.NoDecrypt:
          throw new WalletDecryptionNotAllowedError();
        case DecryptPermission.UponRequest:
        case DecryptPermission.AutoDecrypt:
        case DecryptPermission.OnChainHistory:
          try {
            const text = await wallet.decrypt(
              cipherText,
              tpk,
              programId,
              functionName,
              index,
            );
            return text.text;
          } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            throw new WalletDecryptionError(msg);
          }
        default:
          throw new WalletDecryptionError();
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async requestRecords(program: string): Promise<any[]> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestRecords(program);
        return result.records;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletRecordsError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  // ── Transactions ──────────────────────────────────────────────

  async requestTransaction(transaction: AleoTransaction): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestTransaction(transaction);
        return result.transactionId;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async requestExecution(transaction: AleoTransaction): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestExecution(transaction);
        return result.transactionId;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async requestBulkTransactions(
    transactions: AleoTransaction[],
  ): Promise<string[]> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestBulkTransactions(transactions);
        return result.transactionIds;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async requestDeploy(deployment: AleoDeployment): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestDeploy(deployment);
        return result.transactionId;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async transactionStatus(transactionId: string): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.transactionStatus(transactionId);
        return result.status;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async transitionViewKeys(transactionId: string): Promise<string[]> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.transitionViewKeys(transactionId);
        return result.viewKeys;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async getExecution(transactionId: string): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.getExecution(transactionId);
        return result.execution;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletTransactionError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async requestRecordPlaintexts(program: string): Promise<any[]> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestRecordPlaintexts(program);
        return result.records;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletRecordsError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }

  async requestTransactionHistory(program: string): Promise<any[]> {
    try {
      const wallet = this._wallet;
      if (!wallet || !this.publicKey) throw new WalletNotConnectedError();
      try {
        const result = await wallet.requestTransactionHistory(program);
        return result.transactions;
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new WalletRecordsError(msg);
      }
    } catch (error) {
      this.emit("error", error as never);
      throw error;
    }
  }
}
