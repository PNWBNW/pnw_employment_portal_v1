"use client";

import { create } from "zustand";
import type { Field, U8 } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Employer Identity Store — tracks .pnw name and profile status for the session
// ---------------------------------------------------------------------------

export type EmployerOnboardingStep =
  | "checking"        // querying on-chain state
  | "register_name"   // needs to register .pnw employer name
  | "create_profile"  // name registered, needs to create profile
  | "complete";       // fully onboarded

type EmployerIdentityState = {
  step: EmployerOnboardingStep;
  /** Employer's .pnw name hash (field) once registered */
  employerNameHash: Field | null;
  /** The plaintext name chosen during registration (session only) */
  chosenName: string | null;
  /** Industry suffix code selected during registration */
  suffixCode: U8 | null;
  /** Whether the profile has been anchored on-chain */
  profileAnchored: boolean;
  /** Error from last on-chain query */
  queryError: string | null;
};

type EmployerIdentityActions = {
  setStep: (step: EmployerOnboardingStep) => void;
  setEmployerNameHash: (hash: Field, name?: string, suffix?: U8) => void;
  setProfileAnchored: (anchored: boolean) => void;
  setQueryError: (error: string | null) => void;
  reset: () => void;
};

const STORAGE_KEY = "pnw_employer_identity";

function persistToSession(state: Partial<EmployerIdentityState>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = sessionStorage.getItem(STORAGE_KEY);
    const prev = existing ? JSON.parse(existing) : {};
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...state }));
  } catch {
    // sessionStorage unavailable
  }
}

function restoreFromSession(): Partial<EmployerIdentityState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      return {
        employerNameHash: typeof obj.employerNameHash === "string" ? obj.employerNameHash : null,
        chosenName: typeof obj.chosenName === "string" ? obj.chosenName : null,
        suffixCode: typeof obj.suffixCode === "number" ? obj.suffixCode : null,
        profileAnchored: typeof obj.profileAnchored === "boolean" ? obj.profileAnchored : false,
        step: typeof obj.step === "string" ? obj.step as EmployerOnboardingStep : "checking",
      };
    }
  } catch {
    // ignore
  }
  return {};
}

export const useEmployerIdentityStore = create<EmployerIdentityState & EmployerIdentityActions>(
  (set) => {
    const restored = restoreFromSession();

    return {
      step: restored.step ?? "checking",
      employerNameHash: restored.employerNameHash ?? null,
      chosenName: restored.chosenName ?? null,
      suffixCode: restored.suffixCode ?? null,
      profileAnchored: restored.profileAnchored ?? false,
      queryError: null,

      setStep: (step) => {
        set({ step });
        persistToSession({ step });
      },

      setEmployerNameHash: (hash, name, suffix) => {
        set({ employerNameHash: hash, chosenName: name ?? null, suffixCode: suffix ?? null });
        persistToSession({ employerNameHash: hash, chosenName: name ?? null, suffixCode: suffix ?? null });
      },

      setProfileAnchored: (anchored) => {
        set({ profileAnchored: anchored });
        persistToSession({ profileAnchored: anchored });
      },

      setQueryError: (error) => set({ queryError: error }),

      reset: () => {
        set({
          step: "checking",
          employerNameHash: null,
          chosenName: null,
          suffixCode: null,
          profileAnchored: false,
          queryError: null,
        });
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      },
    };
  },
);
