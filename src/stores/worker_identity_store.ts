"use client";

import { create } from "zustand";
import type { Field } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Worker Identity Store — tracks .pnw name and profile status for the session
// ---------------------------------------------------------------------------

export type OnboardingStep =
  | "checking"        // querying on-chain state
  | "register_name"   // needs to register .pnw name
  | "create_profile"  // name registered, needs to create profile
  | "complete";       // fully onboarded

type WorkerIdentityState = {
  step: OnboardingStep;
  /** Worker's .pnw name hash (field) once registered */
  workerNameHash: Field | null;
  /** The plaintext name chosen during registration (session only) */
  chosenName: string | null;
  /** Whether the profile has been anchored on-chain */
  profileAnchored: boolean;
  /** Error from last on-chain query */
  queryError: string | null;
};

type WorkerIdentityActions = {
  setStep: (step: OnboardingStep) => void;
  setWorkerNameHash: (hash: Field, name?: string) => void;
  setProfileAnchored: (anchored: boolean) => void;
  setQueryError: (error: string | null) => void;
  reset: () => void;
};

const STORAGE_KEY = "pnw_worker_identity";

function persistToSession(state: Partial<WorkerIdentityState>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const prev = existing ? JSON.parse(existing) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...state }));
  } catch {
    // localStorage unavailable
  }
}

function restoreFromSession(): Partial<WorkerIdentityState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      const profileAnchored = typeof obj.profileAnchored === "boolean" ? obj.profileAnchored : false;
      // If profile not completed, always re-check on startup
      const step = profileAnchored
        ? ((typeof obj.step === "string" ? obj.step : "complete") as OnboardingStep)
        : "checking";

      return {
        workerNameHash: typeof obj.workerNameHash === "string" ? obj.workerNameHash : null,
        chosenName: typeof obj.chosenName === "string" ? obj.chosenName : null,
        profileAnchored,
        step,
      };
    }
  } catch {
    // ignore
  }
  return {};
}

export const useWorkerIdentityStore = create<WorkerIdentityState & WorkerIdentityActions>(
  (set) => {
    const restored = restoreFromSession();

    return {
      step: restored.step ?? "checking",
      workerNameHash: restored.workerNameHash ?? null,
      chosenName: restored.chosenName ?? null,
      profileAnchored: restored.profileAnchored ?? false,
      queryError: null,

      setStep: (step) => {
        set({ step });
        persistToSession({ step });
      },

      setWorkerNameHash: (hash, name) => {
        set({ workerNameHash: hash, chosenName: name ?? null });
        persistToSession({ workerNameHash: hash, chosenName: name ?? null });
      },

      setProfileAnchored: (anchored) => {
        set({ profileAnchored: anchored });
        persistToSession({ profileAnchored: anchored });
      },

      setQueryError: (error) => set({ queryError: error }),

      reset: () => {
        set({
          step: "checking",
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
