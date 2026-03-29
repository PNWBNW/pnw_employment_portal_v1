"use client";

import { create } from "zustand";
import type { Field } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Worker Identity Store — one .pnw name per wallet, one profile
// ---------------------------------------------------------------------------

export type OnboardingStep =
  | "checking"        // querying on-chain state
  | "register_name"   // needs to register .pnw name
  | "create_profile"  // name registered, needs to create profile
  | "complete";       // fully onboarded

type WorkerIdentityState = {
  step: OnboardingStep;
  walletAddress: string | null;
  workerNameHash: Field | null;
  chosenName: string | null;
  profileAnchored: boolean;
  queryError: string | null;
};

type WorkerIdentityActions = {
  setStep: (step: OnboardingStep) => void;
  setWalletAddress: (address: string) => void;
  setWorkerNameHash: (hash: Field, name?: string) => void;
  setProfileAnchored: (anchored: boolean) => void;
  setQueryError: (error: string | null) => void;
  reset: () => void;
};

const STORAGE_KEY = "pnw_worker_identity";

function persist(data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const prev = existing ? JSON.parse(existing) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...data }));
  } catch {
    // localStorage unavailable
  }
}

function restore(): Partial<WorkerIdentityState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;

    const profileAnchored = typeof obj.profileAnchored === "boolean" ? obj.profileAnchored : false;

    return {
      walletAddress: typeof obj.walletAddress === "string" ? obj.walletAddress : null,
      workerNameHash: typeof obj.workerNameHash === "string" ? obj.workerNameHash : null,
      chosenName: typeof obj.chosenName === "string" ? obj.chosenName : null,
      profileAnchored,
      step: profileAnchored ? "complete" : "checking",
    };
  } catch {
    return {};
  }
}

export const useWorkerIdentityStore = create<WorkerIdentityState & WorkerIdentityActions>(
  (set) => {
    const restored = restore();

    return {
      step: restored.step ?? "checking",
      walletAddress: restored.walletAddress ?? null,
      workerNameHash: restored.workerNameHash ?? null,
      chosenName: restored.chosenName ?? null,
      profileAnchored: restored.profileAnchored ?? false,
      queryError: null,

      setStep: (step) => {
        set({ step });
        persist({ step });
      },

      setWalletAddress: (address) => {
        set({ walletAddress: address });
        persist({ walletAddress: address });
      },

      setWorkerNameHash: (hash, name) => {
        set({ workerNameHash: hash, chosenName: name ?? null });
        persist({ workerNameHash: hash, chosenName: name ?? null });
      },

      setProfileAnchored: (anchored) => {
        set({ profileAnchored: anchored });
        persist({ profileAnchored: anchored });
      },

      setQueryError: (error) => set({ queryError: error }),

      reset: () => {
        set({
          step: "checking",
          walletAddress: null,
          workerNameHash: null,
          chosenName: null,
          profileAnchored: false,
          queryError: null,
        });
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      },
    };
  },
);
