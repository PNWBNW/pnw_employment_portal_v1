"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { EmployerNav } from "@/components/nav/EmployerNav";
import { TopBar } from "@/components/nav/TopBar";
import { EmployerOnboardingGate } from "@/components/employer-onboarding/EmployerOnboardingGate";
import { useEmployerIdentityStore } from "@/src/stores/employer_identity_store";

/**
 * Employer route group layout.
 * Auth guard: redirects to landing page if no active session.
 * Onboarding gate: blocks portal until employer .pnw name + profile are set up.
 */
export default function EmployerLayout({ children }: { children: ReactNode }) {
  const { isConnected, address } = useAleoSession();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const storedWalletAddress = useEmployerIdentityStore((s) => s.walletAddress);
  const resetIdentity = useEmployerIdentityStore((s) => s.reset);

  // Reset employer identity when the connected wallet changes so the new
  // wallet goes through its own onboarding. Without this, Employer B
  // inherits Employer A's completed state and skips the funnel.
  useEffect(() => {
    if (!address) return;
    if (storedWalletAddress && storedWalletAddress !== address) {
      console.log(
        "[PNW] Wallet address changed, resetting employer identity store",
        { old: storedWalletAddress, new: address },
      );
      resetIdentity();
    }
  }, [address, storedWalletAddress, resetIdentity]);

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  if (!isConnected) {
    return null;
  }

  // Dev pages bypass the onboarding gate
  const isDevRoute = pathname?.startsWith("/dev/");

  return (
    <div className="flex h-screen overflow-hidden">
      <EmployerNav
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar onMenuToggle={() => setMobileNavOpen((prev) => !prev)} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {isDevRoute ? children : (
            <EmployerOnboardingGate>{children}</EmployerOnboardingGate>
          )}
        </main>
      </div>
    </div>
  );
}
