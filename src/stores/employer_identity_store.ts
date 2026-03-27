"use client";

import { create } from "zustand";
import type { Field, U8 } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Employer Identity Store — tracks .pnw names, profiles, and active business
// ---------------------------------------------------------------------------

export type EmployerOnboardingStep =
  | "checking"        // querying on-chain state
  | "register_name"   // needs to register .pnw employer name
  | "create_profile"  // name registered, needs to create profile
  | "complete";       // fully onboarded

/** A registered .pnw business identity with a completed profile */
export type RegisteredBusiness = {
  nameHash: Field;
  name: string;
  suffixCode: U8;
  profileAnchored: boolean;
};

type EmployerIdentityState = {
  step: EmployerOnboardingStep;
  /** All registered businesses for this wallet */
  businesses: RegisteredBusiness[];
  /** Index of the currently active business (null = none selected) */
  activeBusinessIndex: number | null;
  /** Error from last on-chain query */
  queryError: string | null;

  // --- Convenience getters (derived) ---
  /** The currently active business, or null */
  readonly activeBusiness: RegisteredBusiness | null;
  /** The active .pnw name hash */
  readonly employerNameHash: Field | null;
  /** The active plaintext name */
  readonly chosenName: string | null;
  /** The active suffix code */
  readonly suffixCode: U8 | null;
  /** Whether the active business has a profile */
  readonly profileAnchored: boolean;
};

type EmployerIdentityActions = {
  setStep: (step: EmployerOnboardingStep) => void;
  /** Register a new business name (adds to businesses list) */
  addBusiness: (hash: Field, name: string, suffix: U8) => void;
  /** Mark the active business profile as anchored */
  setProfileAnchored: (anchored: boolean) => void;
  /** Switch which business is active */
  setActiveBusiness: (index: number) => void;
  /** Legacy: set a single employer name hash (for backward compat) */
  setEmployerNameHash: (hash: Field, name?: string, suffix?: U8) => void;
  setQueryError: (error: string | null) => void;
  reset: () => void;
};

const STORAGE_KEY = "pnw_employer_identity";

function persistToSession(data: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const prev = existing ? JSON.parse(existing) : {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...data }));
  } catch {
    // localStorage unavailable
  }
}

function restoreFromSession(): {
  businesses: RegisteredBusiness[];
  activeBusinessIndex: number | null;
  step: EmployerOnboardingStep;
} {
  if (typeof window === "undefined") return { businesses: [], activeBusinessIndex: null, step: "checking" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { businesses: [], activeBusinessIndex: null, step: "checking" };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;

      // Migrate from old single-name format
      if (obj.employerNameHash && !obj.businesses) {
        const migrated: RegisteredBusiness = {
          nameHash: obj.employerNameHash as string,
          name: (obj.chosenName as string) ?? "",
          suffixCode: (obj.suffixCode as number) ?? 1,
          profileAnchored: (obj.profileAnchored as boolean) ?? false,
        };
        return {
          businesses: [migrated],
          activeBusinessIndex: 0,
          step: (obj.step as EmployerOnboardingStep) ?? "complete",
        };
      }

      const businesses = Array.isArray(obj.businesses) ? obj.businesses as RegisteredBusiness[] : [];
      const hasCompleted = businesses.some(b => b.profileAnchored);

      // If no completed businesses, always re-check on startup
      // (prevents being stuck in funnel from a stale step)
      const step = hasCompleted
        ? ((typeof obj.step === "string" ? obj.step : "complete") as EmployerOnboardingStep)
        : "checking";

      return {
        businesses,
        activeBusinessIndex: typeof obj.activeBusinessIndex === "number" ? obj.activeBusinessIndex : null,
        step,
      };
    }
  } catch {
    // ignore
  }
  return { businesses: [], activeBusinessIndex: null, step: "checking" };
}

function getActive(businesses: RegisteredBusiness[], index: number | null): RegisteredBusiness | null {
  if (index === null || index < 0 || index >= businesses.length) return null;
  return businesses[index] ?? null;
}

export const useEmployerIdentityStore = create<EmployerIdentityState & EmployerIdentityActions>(
  (set, get) => {
    const restored = restoreFromSession();

    return {
      step: restored.step,
      businesses: restored.businesses,
      activeBusinessIndex: restored.activeBusinessIndex,
      queryError: null,

      // Derived getters
      get activeBusiness() {
        const s = get();
        return getActive(s.businesses, s.activeBusinessIndex);
      },
      get employerNameHash() {
        return get().activeBusiness?.nameHash ?? null;
      },
      get chosenName() {
        return get().activeBusiness?.name ?? null;
      },
      get suffixCode() {
        return get().activeBusiness?.suffixCode ?? null;
      },
      get profileAnchored() {
        return get().activeBusiness?.profileAnchored ?? false;
      },

      setStep: (step) => {
        set({ step });
        persistToSession({ step });
      },

      addBusiness: (hash, name, suffix) => {
        const { businesses } = get();
        // Don't add duplicates
        if (businesses.some(b => b.nameHash === hash)) return;
        const newBiz: RegisteredBusiness = {
          nameHash: hash,
          name,
          suffixCode: suffix,
          profileAnchored: false,
        };
        const updated = [...businesses, newBiz];
        const newIndex = updated.length - 1;
        set({ businesses: updated, activeBusinessIndex: newIndex });
        persistToSession({ businesses: updated, activeBusinessIndex: newIndex });
      },

      setProfileAnchored: (anchored) => {
        const { businesses, activeBusinessIndex } = get();
        if (activeBusinessIndex === null) return;
        const updated = [...businesses];
        const biz = updated[activeBusinessIndex];
        if (biz) {
          updated[activeBusinessIndex] = { ...biz, profileAnchored: anchored };
          set({ businesses: updated });
          persistToSession({ businesses: updated });
        }
      },

      setActiveBusiness: (index) => {
        set({ activeBusinessIndex: index });
        persistToSession({ activeBusinessIndex: index });
      },

      // Legacy compatibility
      setEmployerNameHash: (hash, name, suffix) => {
        const { addBusiness } = get();
        addBusiness(hash, name ?? "", suffix ?? 1);
      },

      setQueryError: (error) => set({ queryError: error }),

      reset: () => {
        set({
          step: "checking",
          businesses: [],
          activeBusinessIndex: null,
          queryError: null,
        });
        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
      },
    };
  },
);
