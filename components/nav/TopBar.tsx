"use client";

import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";

function truncateAddress(addr: string | null): string {
  if (!addr) return "";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

interface TopBarProps {
  /** Called when the mobile hamburger button is tapped */
  onMenuToggle?: () => void;
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { address, isConnected, disconnect } = useAleoSession();
  const { disconnect: walletDisconnect } = useWallet();

  const handleDisconnect = async () => {
    try {
      await walletDisconnect();
    } catch {
      // Wallet adapter may throw if already disconnected
    }
    disconnect();
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          onClick={onMenuToggle}
          className="md:hidden rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          aria-label="Open navigation menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <div className="text-sm text-muted-foreground">
          PNW Employment Portal
        </div>
      </div>

      {isConnected && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-success" />
            <code className="text-xs text-muted-foreground">
              {truncateAddress(address)}
            </code>
          </div>
          <button
            onClick={handleDisconnect}
            className="rounded-md border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Disconnect
          </button>
        </div>
      )}
    </header>
  );
}
