"use client";

import { useAleoSession } from "@/components/key-manager/useAleoSession";

function truncateAddress(addr: string | null): string {
  if (!addr) return "";
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-4)}`;
}

export function TopBar() {
  const { address, isConnected, disconnect } = useAleoSession();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      <div className="text-sm text-muted-foreground">
        PNW Employment Portal
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
            onClick={disconnect}
            className="rounded-md border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Disconnect
          </button>
        </div>
      )}
    </header>
  );
}
