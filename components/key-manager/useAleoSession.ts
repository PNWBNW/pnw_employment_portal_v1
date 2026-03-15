"use client";

import { useCallback } from "react";
import {
  useSessionStore,
  getPrivateKey,
  setPrivateKey,
  clearPrivateKey,
} from "@/src/stores/session_store";

export type AleoSession = {
  address: string | null;
  viewKey: string | null;
  isConnected: boolean;
  connect: (privateKey: string, viewKey: string, address: string) => void;
  disconnect: () => void;
  getPrivateKey: () => string | null;
};

/**
 * Hook for managing the Aleo session.
 *
 * Usage:
 *   const { address, isConnected, connect, disconnect } = useAleoSession();
 *
 * The private key is read from sessionStorage on demand — never cached.
 */
export function useAleoSession(): AleoSession {
  const { address, viewKey, isConnected, connect: storeConnect, disconnect: storeDisconnect } =
    useSessionStore();

  const connect = useCallback(
    (privateKey: string, viewKey: string, address: string) => {
      // Store private key in sessionStorage only (never Zustand)
      setPrivateKey(privateKey);
      // Store address + view key in Zustand + sessionStorage
      storeConnect(address, viewKey);
    },
    [storeConnect],
  );

  const disconnect = useCallback(() => {
    clearPrivateKey();
    storeDisconnect();
  }, [storeDisconnect]);

  return {
    address,
    viewKey,
    isConnected,
    connect,
    disconnect,
    getPrivateKey,
  };
}
