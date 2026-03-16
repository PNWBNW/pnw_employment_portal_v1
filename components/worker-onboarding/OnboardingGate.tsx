"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useWorkerIdentityStore,
  type OnboardingStep,
} from "@/src/stores/worker_identity_store";
import { queryWorkerName } from "@/src/registry/name_registry";
import { RegisterNameStep } from "./RegisterNameStep";
import { CreateProfileStep } from "./CreateProfileStep";

type Props = {
  children: ReactNode;
};

/**
 * OnboardingGate — wraps the entire worker portal.
 *
 * Checks on-chain state to determine if the connected wallet has:
 *   1. A registered .pnw worker name
 *   2. An anchored worker profile
 *
 * If either is missing, the gate blocks portal access and shows the
 * appropriate registration step instead.
 */
export function OnboardingGate({ children }: Props) {
  const { address } = useAleoSession();
  const {
    step,
    workerNameHash,
    setStep,
    setWorkerNameHash,
    setQueryError,
  } = useWorkerIdentityStore();

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    setStep("checking");
    setQueryError(null);

    try {
      // Step 1: Check if wallet has a .pnw worker name
      const nameHash = await queryWorkerName(address);

      if (!nameHash) {
        setStep("register_name");
        return;
      }

      // Name exists — save it
      setWorkerNameHash(nameHash);

      // For now, skip profile anchor check (profile creation is step 2)
      // In the future, we'd query worker_profiles.aleo/profile_anchor_height
      // to verify the profile is anchored. For MVP we trust the session state.
      setStep("create_profile");
    } catch {
      setQueryError("Failed to check on-chain identity. Check your network connection.");
      setStep("register_name");
    }
  }, [address, setStep, setWorkerNameHash, setQueryError]);

  useEffect(() => {
    // If we already know onboarding is complete from session, skip the check
    if (step === "complete") return;

    // If we have a name hash cached from session, go to profile step
    if (workerNameHash && step === "checking") {
      setStep("create_profile");
      return;
    }

    // Otherwise, query on-chain
    if (address && step === "checking") {
      checkOnboardingStatus();
    }
  }, [address, step, workerNameHash, checkOnboardingStatus, setStep]);

  // Loading state
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

  // Step 1: Register .pnw name
  if (step === "register_name") {
    return <RegisterNameStep />;
  }

  // Step 2: Create worker profile
  if (step === "create_profile") {
    return <CreateProfileStep />;
  }

  // Onboarding complete — render the actual portal
  return <>{children}</>;
}
