"use client";

import { create } from "zustand";
import type { Field, U8 } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Employer Identity Store — one .pnw name per wallet, one profile
// ---------------------------------------------------------------------------

export type EmployerOnboardingStep =
  | "checking"        // querying on-chain state
  | "register_name"   // needs to register .pnw employer name
  | "create_profile"  // name registered, needs to create profile
  | "complete";       // fully onboarded

type EmployerIdentityState = {
  step: EmployerOnboardingStep;
  /** Connected wallet address (for stale data detection) */
  walletAddress: string | null;
  /** Employer's .pnw name hash */
  employerNameHash: Field | null;
  /** The plaintext .pnw name (e.g. "acme_wa") */
  chosenName: string | null;
  /** Industry suffix code */
  suffixCode: U8 | null;
  /** Whether the profile has been anchored on-chain */
  profileAnchored: boolean;
  /** Error from last on-chain query */
  queryError: string | null;
};

type EmployerIdentityActions = {
  setStep: (step: EmployerOnboardingStep) => void;
  setWalletAddress: (address: string) => void;
  setEmployerNameHash: (hash: Field, name?: string, suffix?: U8) => void;
  setProfileAnchored: (anchored: boolean) => void;
  setQueryError: (error: string | null) => void;
  reset: () => void;
};

const STORAGE_KEY = "pnw_employer_identity";

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

function restore(): Partial<EmployerIdentityState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as Record<string, unknown>;

    const profileAnchored = typeof obj.profileAnchored === "boolean" ? obj.profileAnchored : false;

    return {
      walletAddress: typeof obj.walletAddress === "string" ? obj.walletAddress : null,
      employerNameHash: typeof obj.employerNameHash === "string" ? obj.employerNameHash : null,
      chosenName: typeof obj.chosenName === "string" ? obj.chosenName : null,
      suffixCode: typeof obj.suffixCode === "number" ? obj.suffixCode : null,
      profileAnchored,
      // Only restore step as complete if profile is anchored
      step: profileAnchored ? "complete" : "checking",
    };
  } catch {
    return {};
  }
}

export const useEmployerIdentityStore = create<EmployerIdentityState & EmployerIdentityActions>(
  (set) => {
    const restored = restore();

    return {
      step: restored.step ?? "checking",
      walletAddress: restored.walletAddress ?? null,
      employerNameHash: restored.employerNameHash ?? null,
      chosenName: restored.chosenName ?? null,
      suffixCode: restored.suffixCode ?? null,
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

      setEmployerNameHash: (hash, name, suffix) => {
        set({
          employerNameHash: hash,
          chosenName: name ?? null,
          suffixCode: suffix ?? null,
        });
        persist({
          employerNameHash: hash,
          chosenName: name ?? null,
          suffixCode: suffix ?? null,
        });
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
          employerNameHash: null,
          chosenName: null,
          suffixCode: null,
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
