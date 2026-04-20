"use client";

import { create } from "zustand";
import type { Address, Field, Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Worker Store — cached decoded worker records for the session
// ---------------------------------------------------------------------------

export type PayType = "hourly" | "salary";

export type WorkerRecord = {
  worker_addr: Address;
  worker_name_hash: Field;
  agreement_id: Bytes32;
  status: "active" | "paused" | "terminated";
  display_name?: string; // User-chosen label (session only, not from chain)
  last_payroll_epoch?: number;
  /** Compensation type — set during offer creation, stored in encrypted terms */
  pay_type?: PayType;
  /** Pay rate in dollars — per hour (hourly) or per pay period (salary) */
  pay_rate?: number;
};

type WorkerState = {
  workers: WorkerRecord[];
  isLoading: boolean;
};

type WorkerActions = {
  setWorkers: (workers: WorkerRecord[]) => void;
  setLoading: (loading: boolean) => void;
  updateWorkerStatus: (
    agreementId: Bytes32,
    status: WorkerRecord["status"],
  ) => void;
  setDisplayName: (agreementId: Bytes32, name: string) => void;
  clear: () => void;
};

export const useWorkerStore = create<WorkerState & WorkerActions>((set, get) => ({
  workers: [],
  isLoading: false,

  setWorkers: (workers) => set({ workers }),
  setLoading: (isLoading) => set({ isLoading }),

  updateWorkerStatus: (agreementId, status) => {
    const { workers } = get();
    set({
      workers: workers.map((w) =>
        w.agreement_id === agreementId ? { ...w, status } : w,
      ),
    });
  },

  setDisplayName: (agreementId, name) => {
    const { workers } = get();
    set({
      workers: workers.map((w) =>
        w.agreement_id === agreementId ? { ...w, display_name: name } : w,
      ),
    });
  },

  clear: () => set({ workers: [], isLoading: false }),
}));
