"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useEmployerIdentityStore,
} from "@/src/stores/employer_identity_store";
import { queryEmployerNameCount } from "@/src/registry/name_registry";
import { RegisterEmployerNameStep } from "./RegisterEmployerNameStep";
import { CreateEmployerProfileStep } from "./CreateEmployerProfileStep";

type Props = {
  children: ReactNode;
};

/**
 * EmployerOnboardingGate — wraps the entire employer portal.
 *
 * Logic:
 * 1. If session has a completed business (name + profile) → show portal
 * 2. If session has a name but no profile → show profile step
 * 3. If no session data → query on-chain name count:
 *    - count > 0 but no session → show portal (user completed before)
 *    - count = 0 → show name registration step
 */
export function EmployerOnboardingGate({ children }: Props) {
  const { address } = useAleoSession();
  const {
    step,
    businesses,
    activeBusiness,
    setStep,
    setQueryError,
  } = useEmployerIdentityStore();

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    // 1. If we have a completed business in session, go straight to portal
    const hasCompleted = businesses.some(b => b.profileAnchored);
    if (hasCompleted) {
      setStep("complete");
      return;
    }

    // 2. If we have a business with no profile, go to profile step
    const hasUnfinished = businesses.some(b => !b.profileAnchored);
    if (hasUnfinished) {
      setStep("create_profile");
      return;
    }

    // 3. No session data — check on-chain
    setQueryError(null);

    try {
      const count = await queryEmployerNameCount(address);

      if (count > 0) {
        // User has names on-chain but not in session
        // They may have registered via terminal or previous session
        // Let them through to the portal — they can add business details later
        setStep("complete");
        return;
      }

      // No names at all — start registration
      setStep("register_name");
    } catch {
      setQueryError("Failed to check on-chain identity. Check your network connection.");
      setStep("register_name");
    }
  }, [address, businesses, setStep, setQueryError]);

  useEffect(() => {
    // Already complete — don't re-check
    if (step === "complete") return;

    // Run the check
    if (address && step === "checking") {
      checkOnboardingStatus();
    }
  }, [address, step, checkOnboardingStatus]);

  // Not connected
  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to continue.
        </p>
      </div>
    );
  }

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
