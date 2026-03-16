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

const WALLET_META: Record<string, { label: string; description: string }> = {
  "Leo Wallet": {
    label: "Leo Wallet",
    description: "Browser extension by Provable",
  },
  "Puzzle Wallet": {
    label: "Puzzle Wallet",
    description: "Mobile & extension wallet",
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
 * Supports Leo, Puzzle, Fox, and Soter wallets via the Aleo wallet adapter.
 * Shield Wallet can be added when its adapter ships.
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
      // View key is not directly available from wallet adapter — user can
      // provide it separately or we use the wallet's decrypt API.
      // For now, store address and mark connected. View key can be added
      // via a follow-up prompt or the wallet's requestRecords API.
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
        <p className="mb-6 text-sm text-muted-foreground">
          Select a wallet to connect to the PNW Employment Portal.
        </p>

        <div className="space-y-2">
          {wallets.map((wallet) => {
            const meta = WALLET_META[wallet.adapter.name] ?? {
              label: wallet.adapter.name,
              description: "Aleo wallet",
            };
            const isConnecting = connecting === wallet.adapter.name;

            return (
              <button
                key={wallet.adapter.name}
                onClick={() => handleSelect(wallet.adapter.name)}
                disabled={isConnecting}
                className="flex w-full items-center gap-3 rounded-md border border-input px-4 py-3 text-sm text-card-foreground hover:bg-accent disabled:opacity-50"
              >
                {wallet.adapter.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={wallet.adapter.icon}
                    alt={meta.label}
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <span className="h-6 w-6 rounded-full bg-muted" />
                )}
                <div className="text-left">
                  <div className="font-medium">{meta.label}</div>
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
            <p className="py-4 text-center text-sm text-muted-foreground">
              No wallet extensions detected. Install Leo Wallet or another Aleo
              wallet to connect.
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        )}

        <div className="mt-4 flex justify-end">
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
