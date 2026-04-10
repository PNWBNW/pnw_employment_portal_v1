"use client";

import { create } from "zustand";
import type {
  PayrollRunManifest,
  PayrollRunStatus,
  PayrollRow,
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
  /** Update a single row's status and tx_id */
  updateRow: (rowIndex: number, status: PayrollRow["status"], txId?: string) => void;
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

// Persist only the ACTIVE (in-progress) run to localStorage so the user can
// recover if the tab closes mid-settlement. Completed runs are reconstructed
// from on-chain EmployerPaystubReceipt records via scanPayrollHistory — we
// don't store payroll data in browser storage.
function persistManifest(manifest: PayrollRunManifest | null) {
  if (typeof window === "undefined") return;
  if (manifest && manifest.status !== "settled" && manifest.status !== "anchored") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manifest));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function persistHistory(_history: PayrollRunManifest[]) {
  // History no longer persisted — scanned from on-chain records instead.
}

export const usePayrollRunStore = create<PayrollRunState & PayrollRunActions>(
  (set, get) => ({
    manifest: null,
    history: [],

    setManifest: (manifest) => {
      const { manifest: current, history } = get();
      // If there's an existing manifest with a DIFFERENT batch_id, archive
      // it to history before overwriting. This prevents data loss when a
      // user starts a new run without explicitly completing the previous one.
      if (current && current.batch_id !== manifest.batch_id) {
        const alreadyInHistory = history.some((h) => h.batch_id === current.batch_id);
        const newHistory = alreadyInHistory ? history : [current, ...history];
        set({ manifest, history: newHistory });
        persistManifest(manifest);
        persistHistory(newHistory);
      } else {
        set({ manifest });
        persistManifest(manifest);
      }
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

    updateRow: (rowIndex, status, txId) => {
      const { manifest } = get();
      if (!manifest) return;
      const newRows = manifest.rows.map((r) =>
        r.row_index === rowIndex ? { ...r, status, ...(txId ? { tx_id: txId } : {}) } : r,
      );
      const updated = { ...manifest, rows: newRows, updated_at: Date.now() };
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
        const rawManifest = localStorage.getItem(STORAGE_KEY);
        set({
          manifest: rawManifest ? (JSON.parse(rawManifest) as PayrollRunManifest) : null,
          history: [],
        });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
  }),
);
