"use client";

import { create } from "zustand";
import type {
  PayrollRunManifest,
  PayrollRunStatus,
  ChunkPlan,
} from "@/src/manifest/types";

// ---------------------------------------------------------------------------
// Payroll Run Store — state machine for manifest lifecycle
// ---------------------------------------------------------------------------

type PayrollRunState = {
  /** Current active manifest, or null if no run in progress */
  manifest: PayrollRunManifest | null;
  /** History of completed manifests (kept in session) */
  history: PayrollRunManifest[];
};

type PayrollRunActions = {
  /** Set a new compiled manifest */
  setManifest: (manifest: PayrollRunManifest) => void;
  /** Update the run status */
  updateStatus: (status: PayrollRunStatus) => void;
  /** Update chunks */
  updateChunks: (chunks: ChunkPlan[]) => void;
  /** Set anchor info after batch NFT minted */
  setAnchor: (txId: string, nftId: string) => void;
  /** Complete the run and move to history */
  completeRun: () => void;
  /** Clear current manifest */
  clearManifest: () => void;
  /** Restore from sessionStorage */
  restore: () => void;
};

const STORAGE_KEY = "pnw_payroll_run";
const HISTORY_KEY = "pnw_payroll_history";

function persistManifest(manifest: PayrollRunManifest | null) {
  if (typeof window === "undefined") return;
  if (manifest) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
  } else {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

function persistHistory(history: PayrollRunManifest[]) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export const usePayrollRunStore = create<PayrollRunState & PayrollRunActions>(
  (set, get) => ({
    manifest: null,
    history: [],

    setManifest: (manifest) => {
      set({ manifest });
      persistManifest(manifest);
    },

    updateStatus: (status) => {
      const { manifest } = get();
      if (!manifest) return;
      const updated = { ...manifest, status, updated_at: Date.now() };
      set({ manifest: updated });
      persistManifest(updated);
    },

    updateChunks: (chunks) => {
      const { manifest } = get();
      if (!manifest) return;
      const updated = { ...manifest, chunks, updated_at: Date.now() };
      set({ manifest: updated });
      persistManifest(updated);
    },

    setAnchor: (txId, nftId) => {
      const { manifest } = get();
      if (!manifest) return;
      const updated: PayrollRunManifest = {
        ...manifest,
        status: "anchored",
        anchor_tx_id: txId,
        anchor_nft_id: nftId,
        updated_at: Date.now(),
      };
      set({ manifest: updated });
      persistManifest(updated);
    },

    completeRun: () => {
      const { manifest, history } = get();
      if (!manifest) return;
      const updatedHistory = [manifest, ...history];
      set({ manifest: null, history: updatedHistory });
      persistManifest(null);
      persistHistory(updatedHistory);
    },

    clearManifest: () => {
      set({ manifest: null });
      persistManifest(null);
    },

    restore: () => {
      if (typeof window === "undefined") return;
      try {
        const rawManifest = sessionStorage.getItem(STORAGE_KEY);
        const rawHistory = sessionStorage.getItem(HISTORY_KEY);
        set({
          manifest: rawManifest ? (JSON.parse(rawManifest) as PayrollRunManifest) : null,
          history: rawHistory ? (JSON.parse(rawHistory) as PayrollRunManifest[]) : [],
        });
      } catch {
        // Corrupted storage — clear it
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(HISTORY_KEY);
      }
    },
  }),
);
