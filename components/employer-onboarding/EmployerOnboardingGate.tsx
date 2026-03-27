"use client";

import { useEffect, useCallback, type ReactNode } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  useEmployerIdentityStore,
  type RegisteredBusiness,
} from "@/src/stores/employer_identity_store";
import { queryEmployerNameCount, INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { PROGRAMS } from "@/src/config/programs";
import { RegisterEmployerNameStep } from "./RegisterEmployerNameStep";
import { CreateEmployerProfileStep } from "./CreateEmployerProfileStep";

type Props = {
  children: ReactNode;
};

/**
 * Parse an EmployerProfile record from the wallet into a RegisteredBusiness.
 */
function parseProfileRecord(record: unknown): RegisteredBusiness | null {
  try {
    if (!record || typeof record !== "object") return null;
    const r = record as Record<string, unknown>;

    // Record data may be nested under "data" or "plaintext" or at top level
    const data = (
      r.data && typeof r.data === "object" ? r.data :
      r.plaintext && typeof r.plaintext === "object" ? r.plaintext :
      r
    ) as Record<string, unknown>;

    // Extract fields — strip .private suffix and type suffix
    const nameHashRaw = String(data.employer_name_hash ?? "")
      .replace(/\.private$/, "")
      .replace(/field$/, "")
      .trim();
    const suffixRaw = String(data.suffix_code ?? data.industry_code ?? "1")
      .replace(/\.private$/, "")
      .replace(/u8$/, "")
      .trim();

    if (!nameHashRaw || nameHashRaw === "undefined" || nameHashRaw === "null") return null;

    const suffixCode = parseInt(suffixRaw, 10) || 1;
    const suffix = INDUSTRY_SUFFIXES[suffixCode];

    return {
      nameHash: nameHashRaw,
      name: suffix?.code?.toLowerCase() ?? `biz_${suffixCode}`,
      suffixCode,
      profileAnchored: true,
    };
  } catch {
    return null;
  }
}

/**
 * EmployerOnboardingGate — wraps the entire employer portal.
 *
 * Recovery flow:
 * 1. Check localStorage for completed businesses
 * 2. If empty, ask wallet for EmployerProfile records (recovers across sessions)
 * 3. If no records, check on-chain name count
 * 4. If no names, show registration funnel
 */
export function EmployerOnboardingGate({ children }: Props) {
  const { address } = useAleoSession();
  const { requestRecords } = useWallet();
  const {
    step,
    businesses,
    setStep,
    setQueryError,
    addBusiness,
    setActiveBusiness,
    setProfileAnchored,
  } = useEmployerIdentityStore();

  const checkOnboardingStatus = useCallback(async () => {
    if (!address) return;

    // 1. localStorage has completed businesses → dashboard
    const hasCompleted = businesses.some(b => b.profileAnchored);
    if (hasCompleted) {
      setStep("complete");
      return;
    }

    // 2. localStorage has unfinished business → profile step
    const hasUnfinished = businesses.some(b => !b.profileAnchored);
    if (hasUnfinished) {
      setStep("create_profile");
      return;
    }

    // 3. No localStorage — try to recover from wallet records
    setQueryError(null);

    if (requestRecords) {
      try {
        console.log("[PNW] Requesting EmployerProfile records from wallet...");
        const records = await requestRecords(PROGRAMS.layer1.employer_profiles, true);
        console.log("[PNW] Wallet returned profile records:", records);

        if (Array.isArray(records) && records.length > 0) {
          for (const rec of records) {
            const biz = parseProfileRecord(rec);
            if (biz) {
              addBusiness(biz.nameHash, biz.name, biz.suffixCode);
            }
          }

          // Mark all recovered businesses as profile-anchored
          const store = useEmployerIdentityStore.getState();
          if (store.businesses.length > 0) {
            for (let i = 0; i < store.businesses.length; i++) {
              store.setActiveBusiness(i);
              store.setProfileAnchored(true);
            }
            store.setActiveBusiness(0);
            setStep("complete");
            return;
          }
        }
      } catch (err) {
        console.warn("[PNW] Failed to recover records from wallet:", err);
      }
    }

    // 4. No wallet records — check on-chain name count
    try {
      const count = await queryEmployerNameCount(address);

      if (count > 0) {
        // Has names but couldn't recover records
        // Go to dashboard — user can use "+ Add Business"
        setStep("complete");
        return;
      }

      // No names at all — registration funnel
      setStep("register_name");
    } catch {
      setQueryError("Failed to check on-chain identity. Check your network connection.");
      setStep("register_name");
    }
  }, [address, businesses, setStep, setQueryError, requestRecords, addBusiness, setActiveBusiness, setProfileAnchored]);

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
          Checking your employer .pnw identity...
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
