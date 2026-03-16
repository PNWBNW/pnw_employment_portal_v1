"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@/src/lib/wallet/wallet-provider";
import { Network } from "@provablehq/aleo-types";
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
  "Puzzle Wallet": {
    label: "Puzzle Wallet",
    description: "WalletConnect V2 — mobile & extension",
  },
};

/**
 * Wallet connection modal (Path A).
 *
 * Uses @provablehq/aleo-wallet-adaptor-react — the official Provable adapter
 * stack that Shield wallet is designed to work with.
 *
 * The connect flow is two-phase to avoid a race condition:
 *   1. handleSelect → selectWallet(name)   (async state update)
 *   2. useEffect    → connect(network)      (fires after React reconciles)
 *
 * Connection grants: address + decrypt permission + signMessage capability.
 * Private key never leaves the wallet extension.
 */
export function ConnectWalletModal({ open, onClose }: Props) {
  const { wallets, selectWallet, connect, address, connected, wallet } =
    useWallet();
  const { connect: sessionConnect } = useAleoSession();
  const [pendingWallet, setPendingWallet] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectAttempted = useRef(false);

  // Phase 2: Once the provider picks up the selected wallet, trigger connect().
  // This fires on re-render AFTER selectWallet has propagated.
  useEffect(() => {
    if (!pendingWallet || !wallet) return;
    if (wallet.adapter.name !== pendingWallet) return;
    if (connectAttempted.current) return;

    connectAttempted.current = true;

    (async () => {
      try {
        await connect(Network.TESTNET);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : `Failed to connect ${pendingWallet}`;
        setError(msg);
        setPendingWallet(null);
        connectAttempted.current = false;
      }
    })();
  }, [pendingWallet, wallet, connect]);

  // Phase 3: When connected, bridge to our session store and close.
  useEffect(() => {
    if (connected && address && pendingWallet) {
      sessionConnect("", "", address);
      setPendingWallet(null);
      connectAttempted.current = false;
      onClose();
    }
  }, [connected, address, pendingWallet, sessionConnect, onClose]);

  // Phase 1: User clicks a wallet — select it and let the effects handle connect.
  const handleSelect = useCallback(
    (walletName: string) => {
      setError(null);
      connectAttempted.current = false;
      setPendingWallet(walletName);
      selectWallet(walletName as never);
    },
    [selectWallet],
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
          {wallets.map((w) => {
            const meta: WalletMeta = WALLET_META[w.adapter.name] ?? {
              label: w.adapter.name,
              description: "Aleo wallet",
            };
            const isConnecting = pendingWallet === w.adapter.name;

            return (
              <button
                key={w.adapter.name}
                onClick={() => handleSelect(w.adapter.name)}
                disabled={!!pendingWallet}
                className={`flex w-full items-center gap-3 rounded-md border px-4 py-3 text-sm text-card-foreground hover:bg-accent disabled:opacity-50 ${
                  meta.recommended
                    ? "border-primary bg-primary/5"
                    : "border-input"
                }`}
              >
                {w.adapter.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={w.adapter.icon}
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
                  href="https://www.shield.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Shield Wallet
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
            onClick={() => {
              setPendingWallet(null);
              connectAttempted.current = false;
              setError(null);
              onClose();
            }}
            className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
