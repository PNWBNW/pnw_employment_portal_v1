"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useWallet,
} from "@demox-labs/aleo-wallet-adapter-react";
import {
  DecryptPermission,
  WalletAdapterNetwork,
} from "@demox-labs/aleo-wallet-adapter-base";
import { useAleoSession } from "./useAleoSession";

type Props = {
  open: boolean;
  onClose: () => void;
};

type WalletMeta = {
  label: string;
  description: string;
  recommended?: boolean;
};

const WALLET_META: Record<string, WalletMeta> = {
  "Shield Wallet": {
    label: "Shield Wallet",
    description: "Private wallet by Provable (recommended)",
    recommended: true,
  },
  "Leo Wallet": {
    label: "Leo Wallet",
    description: "Browser extension by Provable",
  },
  "Puzzle Wallet": {
    label: "Puzzle Wallet",
    description: "WalletConnect V2 — mobile & extension",
  },
  "Fox Wallet": {
    label: "Fox Wallet",
    description: "Multi-chain extension & mobile",
  },
  "Soter Wallet": {
    label: "Soter Wallet",
    description: "Aleo digital wallet",
  },
};

/**
 * Wallet connection modal (Path A).
 *
 * Supports Shield (primary), Leo, Puzzle, Fox, and Soter wallets.
 * Shield Wallet is listed first as the recommended option.
 *
 * Connection grants: address + decrypt permission + signMessage capability.
 * Private key never leaves the wallet extension.
 */
export function ConnectWalletModal({ open, onClose }: Props) {
  const { wallets, select, connect, publicKey, connected } = useWallet();
  const { connect: sessionConnect } = useAleoSession();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // When wallet connects successfully, bridge to our session store
  useEffect(() => {
    if (connected && publicKey && connecting) {
      // Wallet adapter provides address via publicKey.
      // View key is accessed through the wallet's decrypt API on demand —
      // no need to store it separately when using wallet connection.
      // The wallet handles all signing and decryption internally.
      sessionConnect("", "", publicKey);
      setConnecting(null);
      onClose();
    }
  }, [connected, publicKey, connecting, sessionConnect, onClose]);

  const handleSelect = useCallback(
    async (walletName: string) => {
      setError(null);
      setConnecting(walletName);
      try {
        await select(walletName as never);
        await connect(
          DecryptPermission.AutoDecrypt,
          WalletAdapterNetwork.TestnetBeta,
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `Failed to connect ${walletName}`,
        );
        setConnecting(null);
      }
    },
    [select, connect],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-card-foreground">
          Connect Wallet
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Connect your Aleo wallet to the PNW Employment Portal. Your private
          key never leaves the wallet.
        </p>

        <div className="space-y-2">
          {wallets.map((wallet) => {
            const meta: WalletMeta = WALLET_META[wallet.adapter.name] ?? {
              label: wallet.adapter.name,
              description: "Aleo wallet",
            };
            const isConnecting = connecting === wallet.adapter.name;

            return (
              <button
                key={wallet.adapter.name}
                onClick={() => handleSelect(wallet.adapter.name)}
                disabled={isConnecting}
                className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm text-card-foreground hover:bg-accent disabled:opacity-50 ${
                  meta.recommended
                    ? "border-primary bg-primary/5"
                    : "border-input"
                }`}
              >
                {wallet.adapter.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={wallet.adapter.icon}
                    alt={meta.label}
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {meta.label.charAt(0)}
                  </span>
                )}
                <div className="text-left">
                  <div className="flex items-center gap-2 font-medium">
                    {meta.label}
                    {meta.recommended && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {meta.description}
                  </div>
                </div>
                {isConnecting && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Connecting...
                  </span>
                )}
              </button>
            );
          })}

          {wallets.length === 0 && (
            <div className="rounded-md border border-dashed border-muted-foreground/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No wallet extensions detected.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Install{" "}
                <a
                  href="https://shield.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Shield Wallet
                </a>{" "}
                or{" "}
                <a
                  href="https://leo.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Leo Wallet
                </a>{" "}
                to connect.
              </p>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground">
            Signing & decryption happen inside your wallet
          </p>
          <button
            onClick={onClose}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
