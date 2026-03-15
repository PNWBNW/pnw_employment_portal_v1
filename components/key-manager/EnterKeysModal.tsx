"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useAleoSession } from "./useAleoSession";

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Direct key entry modal (Path B).
 * User pastes private key + view key. Address is derived client-side.
 *
 * Security notes:
 * - Private key goes to sessionStorage only (cleared on tab close)
 * - No network calls with the private key happen here
 * - Address derivation will use @provablehq/sdk WASM (post-MVP: for now, user provides address)
 */
export function EnterKeysModal({ open, onClose }: Props) {
  const { connect } = useAleoSession();
  const [privateKey, setPrivateKey] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      // Basic validation
      if (!privateKey.startsWith("APrivateKey1")) {
        setError("Private key must start with APrivateKey1");
        return;
      }
      if (!viewKey.startsWith("AViewKey1")) {
        setError("View key must start with AViewKey1");
        return;
      }
      if (!address.startsWith("aleo1")) {
        setError("Address must start with aleo1");
        return;
      }

      connect(privateKey, viewKey, address);

      // Clear form state (private key is already in sessionStorage)
      setPrivateKey("");
      setViewKey("");
      setAddress("");
      onClose();
    },
    [privateKey, viewKey, address, connect, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="mb-1 text-lg font-semibold text-card-foreground">
          Enter Keys
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Keys are stored in session memory only and cleared when you close this
          tab.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Private Key
            </label>
            <input
              type="password"
              value={privateKey}
              onChange={(e) => setPrivateKey(e.target.value)}
              placeholder="APrivateKey1..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">View Key</label>
            <input
              type="password"
              value={viewKey}
              onChange={(e) => setViewKey(e.target.value)}
              placeholder="AViewKey1..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="aleo1..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Post-MVP: address will be auto-derived from private key.
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              Connect
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
