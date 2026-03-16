"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { cn } from "@/src/lib/utils";

const WORKER_NAV = [
  { href: "/worker/dashboard", label: "Dashboard" },
  { href: "/worker/offers", label: "Offers" },
  { href: "/worker/paystubs", label: "Paystubs" },
] as const;

/**
 * Worker route group layout with session guard.
 * Redirects to landing page if no active Aleo session.
 */
export default function WorkerLayout({ children }: { children: ReactNode }) {
  const { isConnected, address } = useAleoSession();
  const router = useRouter();
  const pathname = usePathname();

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
