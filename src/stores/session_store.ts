"use client";

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Session Store
// ---------------------------------------------------------------------------
// Holds the NON-SECRET parts of the Aleo session.
// The private key is NEVER stored here — it lives in sessionStorage only.
// The view key is stored here because it's needed for record decoding and is
// less sensitive than the private key (it cannot sign transactions).
// ---------------------------------------------------------------------------

type SessionState = {
  address: string | null;
  viewKey: string | null;
  isConnected: boolean;
};

type SessionActions = {
  connect: (address: string, viewKey: string) => void;
  disconnect: () => void;
  restore: () => void;
};

const SESSION_STORAGE_KEY = "pnw_session";

export const useSessionStore = create<SessionState & SessionActions>(
  (set) => ({
    address: null,
    viewKey: null,
    isConnected: false,

    connect: (address, viewKey) => {
      set({ address, viewKey, isConnected: true });
      // Persist non-secret session data for tab refresh survival
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ address, viewKey }),
        );
      }
    },

    disconnect: () => {
      set({ address: null, viewKey: null, isConnected: false });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
        sessionStorage.removeItem("pnw_private_key");
      }
    },

    restore: () => {
      if (typeof window === "undefined") return;
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "address" in parsed &&
          "viewKey" in parsed &&
          typeof (parsed as Record<string, unknown>).address === "string" &&
          typeof (parsed as Record<string, unknown>).viewKey === "string"
        ) {
          const { address, viewKey } = parsed as {
            address: string;
            viewKey: string;
          };
          set({ address, viewKey, isConnected: true });
        }
      } catch {
        sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    },
  }),
);

// ---------------------------------------------------------------------------
// Private key helpers — sessionStorage only, never in Zustand
// ---------------------------------------------------------------------------

/** Store private key in sessionStorage. Never call this from server code. */
export function setPrivateKey(key: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("pnw_private_key", key);
}

/** Read private key from sessionStorage each time — never cached in memory. */
export function getPrivateKey(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("pnw_private_key");
}

/** Clear private key from sessionStorage. */
export function clearPrivateKey(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("pnw_private_key");
}
