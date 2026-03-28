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
 * EmployerOnboardingGate — one name per wallet, simple flow.
 *
 * 1. If localStorage has completed profile for THIS wallet → dashboard
 * 2. If localStorage has name but no profile → profile step
 * 3. If no localStorage, check on-chain name count → dashboard or funnel
 */
export function EmployerOnboardingGate({ children }: Props) {
  const { address } = useAleoSession();
  const {
    step,
    walletAddress,
    employerNameHash,
    profileAnchored,
    setStep,
    setWalletAddress,
    setQueryError,
    reset,
  } = useEmployerIdentityStore();

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    // Detect wallet switch — clear stale data
    if (walletAddress && walletAddress !== address) {
      console.log("[PNW] Wallet changed, clearing stored identity");
      reset();
    }

    // Store current wallet address
    setWalletAddress(address);

    // Re-read state after potential reset
    const state = useEmployerIdentityStore.getState();

    // 1. localStorage has completed profile for this wallet → dashboard
    if (state.profileAnchored && state.employerNameHash) {
      setStep("complete");
      return;
    }

    // 2. localStorage has name but no profile → profile step
    if (state.employerNameHash && !state.profileAnchored) {
      setStep("create_profile");
      return;
    }

    // 3. No localStorage — check on-chain
    setQueryError(null);

    try {
      const count = await queryEmployerNameCount(address);

      if (count > 0) {
        // Has a name on-chain — go to dashboard
        setStep("complete");
        return;
      }

      // No names — registration funnel
      setStep("register_name");
    } catch {
      setQueryError("Failed to check on-chain identity.");
      setStep("register_name");
    }
  }, [address, walletAddress, setStep, setWalletAddress, setQueryError, reset]);

  useEffect(() => {
    if (step === "complete") return;
    if (address && step === "checking") {
      checkOnboardingStatus();
    }
  }, [address, step, checkOnboardingStatus]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <p className="text-sm text-muted-foreground">
          Connect your wallet to continue.
        </p>
      </div>
    );
  }

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

  if (step === "register_name") {
    return <RegisterEmployerNameStep />;
  }

  if (step === "create_profile") {
    return <CreateEmployerProfileStep />;
  }

  return <>{children}</>;
}
