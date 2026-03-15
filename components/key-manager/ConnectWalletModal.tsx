"use client";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Wallet connection modal (Path A).
 * Placeholder for full wallet integration post-MVP.
 * Will support Shield, Puzzle, Leo Wallet, and others.
 */
export function ConnectWalletModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-card-foreground">
          Connect Wallet
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Wallet connection is coming post-MVP. For now, use &quot;Enter Keys
          Manually&quot; to connect with your testnet keys.
        </p>

        <div className="space-y-2">
          {["Shield Wallet", "Puzzle Wallet", "Leo Wallet"].map((name) => (
            <button
              key={name}
              disabled
              className="flex w-full items-center gap-3 rounded-md border border-input px-4 py-3 text-sm text-muted-foreground opacity-50"
            >
              <span className="h-6 w-6 rounded-full bg-muted" />
              {name}
              <span className="ml-auto text-xs">Coming Soon</span>
            </button>
          ))}
        </div>

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
