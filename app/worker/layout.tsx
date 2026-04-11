"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { OnboardingGate } from "@/components/worker-onboarding/OnboardingGate";
import { useWorkerIdentityStore } from "@/src/stores/worker_identity_store";
import { cn } from "@/src/lib/utils";

const WORKER_NAV = [
  { href: "/worker/dashboard", label: "Dashboard" },
  { href: "/worker/offers", label: "Offers" },
  { href: "/worker/credentials", label: "Credentials" },
  { href: "/worker/paystubs", label: "Paystubs" },
] as const;

/**
 * Worker route group layout with session guard + onboarding gate.
 *
 * 1. Redirects to landing if no Aleo session.
 * 2. If session exists but no .pnw name or profile, shows the onboarding funnel.
 * 3. Only renders the full portal when onboarding is complete.
 */
export default function WorkerLayout({ children }: { children: ReactNode }) {
  const { isConnected, address, disconnect } = useAleoSession();
  const { disconnect: walletDisconnect } = useWallet();
  const router = useRouter();
  const pathname = usePathname();
  const step = useWorkerIdentityStore((s) => s.step);

  const handleDisconnect = async () => {
    try {
      await walletDisconnect();
    } catch {
      // Wallet adapter may throw if already disconnected
    }
    disconnect();
    router.push("/");
  };

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  if (!isConnected) {
    return null;
  }

  // During onboarding, show a minimal shell (no nav — they can't use it yet)
  if (step !== "complete") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="flex items-center justify-between border-b border-border px-6 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">
              PNW Worker Portal
            </h1>
            <span className="text-xs text-muted-foreground">Setup</span>
          </div>
          <div className="flex items-center gap-3">
            {address && (
              <span className="font-mono text-xs text-muted-foreground">
                {address.slice(0, 12)}...{address.slice(-6)}
              </span>
            )}
            <button
              onClick={handleDisconnect}
              className="rounded-md border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            >
              Disconnect
            </button>
          </div>
        </header>
        <main className="flex-1 px-6">
          <OnboardingGate>{children}</OnboardingGate>
        </main>
      </div>
    );
  }

  // Full portal — onboarding complete
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Worker top bar */}
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-foreground">
            PNW Worker Portal
          </h1>
          <span className="text-xs text-muted-foreground">Worker View</span>
        </div>
        <div className="flex items-center gap-4">
          {address && (
            <span className="font-mono text-xs text-muted-foreground">
              {address.slice(0, 12)}...{address.slice(-6)}
            </span>
          )}
          <button
            onClick={handleDisconnect}
            className="rounded-md border border-input px-3 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Disconnect
          </button>
          <nav className="flex gap-2">
            {WORKER_NAV.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs transition-colors",
                    isActive
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
    </div>
  );
}
