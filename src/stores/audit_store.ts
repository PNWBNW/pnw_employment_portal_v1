"use client";

import { create } from "zustand";
import type { Address, Bytes32, U32 } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Audit Request types
// ---------------------------------------------------------------------------

export type AuditRequestStatus =
  | "pending_worker"
  | "approved"
  | "declined"
  | "minted";

export type AuditRequest = {
  auth_id: Bytes32;
  employer_addr: Address;
  worker_addr: Address;
  auditor_addr: Address;
  auditor_display_name?: string; // session only, for PDF
  scope: string; // human-readable scope description
  scope_hash: Bytes32;
  authorization_event_hash: Bytes32;
  policy_hash: Bytes32;
  epoch_from: U32;
  epoch_to: U32;
  expires_epoch?: U32;
  status: AuditRequestStatus;
  created_at: number; // unix ms
  tx_id?: string; // NFT mint tx
  nft_id?: Bytes32;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type AuditState = {
  requests: AuditRequest[];
  isSubmitting: boolean;
  error: string | null;
};

type AuditActions = {
  addRequest: (req: AuditRequest) => void;
  updateStatus: (
    authId: Bytes32,
    status: AuditRequestStatus,
    txId?: string,
    nftId?: Bytes32,
  ) => void;
  setSubmitting: (v: boolean) => void;
  setError: (msg: string | null) => void;
  clear: () => void;
};

const STORAGE_KEY = "pnw_audit_requests";

function loadFromSession(): AuditRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditRequest[]) : [];
  } catch {
    return [];
  }
}

function saveToSession(requests: AuditRequest[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

export const useAuditStore = create<AuditState & AuditActions>((set, get) => ({
  requests: [],
  isSubmitting: false,
  error: null,

  addRequest: (req) => {
    const updated = [...get().requests, req];
    saveToSession(updated);
    set({ requests: updated });
  },

  updateStatus: (authId, status, txId, nftId) => {
    const updated = get().requests.map((r) =>
      r.auth_id === authId
        ? {
            ...r,
            status,
            ...(txId ? { tx_id: txId } : {}),
            ...(nftId ? { nft_id: nftId } : {}),
          }
        : r,
    );
    saveToSession(updated);
    set({ requests: updated });
  },

  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setError: (error) => set({ error }),

  clear: () => {
    saveToSession([]);
    set({ requests: [], isSubmitting: false, error: null });
  },
}));

/** Call on app mount to rehydrate session-stored audit requests */
export function rehydrateAuditRequests(): void {
  const reqs = loadFromSession();
  if (reqs.length > 0 && useAuditStore.getState().requests.length === 0) {
    useAuditStore.setState({ requests: reqs });
  }
}
