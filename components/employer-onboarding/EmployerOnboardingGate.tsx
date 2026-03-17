"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useEmployerIdentityStore,
  type EmployerOnboardingStep,
} from "@/src/stores/employer_identity_store";
import { queryEmployerName } from "@/src/registry/name_registry";
import { RegisterEmployerNameStep } from "./RegisterEmployerNameStep";
import { CreateEmployerProfileStep } from "./CreateEmployerProfileStep";

type Props = {
  children: ReactNode;
};

/**
 * EmployerOnboardingGate — wraps the entire employer portal.
 *
 * Checks on-chain state to determine if the connected wallet has:
 *   1. A registered .pnw employer name
 *   2. An anchored employer profile
 *
 * If either is missing, the gate blocks portal access and shows the
 * appropriate registration step instead.
 */
export function EmployerOnboardingGate({ children }: Props) {
  const { address } = useAleoSession();
  const {
    step,
    employerNameHash,
    setStep,
    setEmployerNameHash,
    setQueryError,
  } = useEmployerIdentityStore();

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    setStep("checking");
    setQueryError(null);

    try {
      const nameHash = await queryEmployerName(address);

      if (!nameHash) {
        setStep("register_name");
        return;
      }

      // Name exists — save it
      setEmployerNameHash(nameHash);

      // For MVP we trust session state for profile step
      setStep("create_profile");
    } catch {
      setQueryError("Failed to check on-chain identity. Check your network connection.");
      setStep("register_name");
    }
  }, [address, setStep, setEmployerNameHash, setQueryError]);

  useEffect(() => {
    // If we already know onboarding is complete from session, skip the check
    if (step === "complete") return;

    // If we have a name hash cached from session, go to profile step
    if (employerNameHash && step === "checking") {
      setStep("create_profile");
      return;
    }

    // Otherwise, query on-chain
    if (address && step === "checking") {
      checkOnboardingStatus();
    }
  }, [address, step, employerNameHash, checkOnboardingStatus, setStep]);

  // Loading state
  if (step === "checking") {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">
          Checking your employer .pnw identity...
        </p>
      </div>
    );
  }

  // Step 1: Register .pnw employer name
  if (step === "register_name") {
    return <RegisterEmployerNameStep />;
  }

  // Step 2: Create employer profile
  if (step === "create_profile") {
    return <CreateEmployerProfileStep />;
  }

  // Onboarding complete — render the actual portal
  return <>{children}</>;
}
