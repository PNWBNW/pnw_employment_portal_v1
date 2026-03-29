"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useWorkerIdentityStore,
} from "@/src/stores/worker_identity_store";
import { queryWorkerName, queryEmployerNameCount } from "@/src/registry/name_registry";
import { RegisterNameStep } from "./RegisterNameStep";
import { CreateProfileStep } from "./CreateProfileStep";

type Props = {
  children: ReactNode;
};

/**
 * Worker OnboardingGate — one name per wallet, simple flow.
 *
 * 1. If localStorage has completed profile for THIS wallet → portal
 * 2. If localStorage has name but no profile → profile step
 * 3. If no localStorage, check on-chain worker_primary_name_of → portal or funnel
 */
export function OnboardingGate({ children }: Props) {
  const { address } = useAleoSession();
  const {
    step,
    workerNameHash,
    profileAnchored,
    queryError,
    setStep,
    setWorkerNameHash,
    setQueryError,
    reset,
  } = useWorkerIdentityStore();

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    // Detect wallet switch — check stored address
    const ADDR_KEY = "pnw_worker_address";
    const storedAddr = typeof window !== "undefined" ? localStorage.getItem(ADDR_KEY) : null;
    if (storedAddr && storedAddr !== address) {
      console.log("[PNW] Worker wallet changed, clearing stored identity");
      reset();
    }
    if (typeof window !== "undefined") {
      localStorage.setItem(ADDR_KEY, address);
    }

    // Re-read state after potential reset
    const state = useWorkerIdentityStore.getState();

    // 1. localStorage has completed profile → portal
    if (state.profileAnchored && state.workerNameHash) {
      setStep("complete");
      return;
    }

    // 2. localStorage has name but no profile → profile step
    if (state.workerNameHash && !state.profileAnchored) {
      setStep("create_profile");
      return;
    }

    // 3. No localStorage — check on-chain
    setQueryError(null);

    try {
      // Check if wallet already has an EMPLOYER name — can't have both
      const employerCount = await queryEmployerNameCount(address);
      if (employerCount > 0) {
        setQueryError("EMPLOYER_NAME_EXISTS");
        setStep("register_name"); // will show blocked message
        return;
      }

      const nameHash = await queryWorkerName(address);

      if (nameHash) {
        // Has worker name on-chain — go to dashboard
        setStep("complete");
        return;
      }

      // No name — registration funnel
      setStep("register_name");
    } catch {
      setQueryError("Failed to check on-chain identity.");
      setStep("register_name");
    }
  }, [address, setStep, setWorkerNameHash, setQueryError, reset]);

  useEffect(() => {
    if (step === "complete") return;
    if (address && step === "checking") {
      checkOnboardingStatus();
    }
  }, [address, step, checkOnboardingStatus]);

  if (step === "checking") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Checking your .pnw identity...
        </p>
      </div>
    );
  }

  // Blocked: wallet already has an employer .pnw name
  if (step === "register_name" && queryError === "EMPLOYER_NAME_EXISTS") {
    return (
      <div className="mx-auto w-full max-w-lg py-24 space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            Wallet Already Registered
          </h1>
          <p className="text-sm text-muted-foreground">
            This wallet already has an <strong>employer</strong> .pnw name registered.
            Each wallet can only have one .pnw identity — either worker or employer, not both.
          </p>
          <p className="text-sm text-muted-foreground">
            To register as a worker, please use a different wallet.
          </p>
        </div>
      </div>
    );
  }

  if (step === "register_name") {
    return <RegisterNameStep />;
  }

  if (step === "create_profile") {
    return <CreateProfileStep />;
  }

  return <>{children}</>;
}
