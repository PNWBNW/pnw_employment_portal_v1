"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";

/**
 * Worker route group layout with session guard.
 * Redirects to landing page if no active Aleo session.
 */
export default function WorkerLayout({ children }: { children: ReactNode }) {
  const { isConnected, address } = useAleoSession();
  const router = useRouter();

  useEffect(() => {
    if (!isConnected) {
      router.push("/");
    }
  }, [isConnected, router]);

  if (!isConnected) {
    return null;
  }

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
          <nav className="flex gap-2">
            <a
              href="/worker/dashboard"
              className="rounded-md px-3 py-1 text-xs hover:bg-accent"
            >
              Dashboard
            </a>
            <a
              href="/worker/offers"
              className="rounded-md px-3 py-1 text-xs hover:bg-accent"
            >
              Offers
            </a>
            <a
              href="/worker/paystubs"
              className="rounded-md px-3 py-1 text-xs hover:bg-accent"
            >
              Paystubs
            </a>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">{children}</main>
    </div>
  );
}
