"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useEmployerIdentityStore,
} from "@/src/stores/employer_identity_store";
import { queryEmployerNameCount, queryWorkerName } from "@/src/registry/name_registry";
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
    queryError,
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
      // Check if wallet already has a WORKER name — can't have both
      const workerName = await queryWorkerName(address);
      if (workerName) {
        setQueryError("WORKER_NAME_EXISTS");
        setStep("register_name"); // will show blocked message
        return;
      }

      const count = await queryEmployerNameCount(address);

      if (count > 0) {
        // Has an employer name on-chain — go to dashboard
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

  // Blocked: wallet already has a worker .pnw name
  if (step === "register_name" && queryError === "WORKER_NAME_EXISTS") {
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
            This wallet already has a <strong>worker</strong> .pnw name registered.
            Each wallet can only have one .pnw identity — either worker or employer, not both.
          </p>
          <p className="text-sm text-muted-foreground">
            To register as an employer, please use a different wallet.
          </p>
        </div>
        <div className="rounded-md bg-muted/30 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Connected wallet:{" "}
            <span className="font-mono text-foreground">
              {address ? `${address.slice(0, 14)}...${address.slice(-8)}` : ""}
            </span>
          </p>
        </div>
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
