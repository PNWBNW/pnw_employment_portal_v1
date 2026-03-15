"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { EmployerNav } from "@/components/nav/EmployerNav";
import { TopBar } from "@/components/nav/TopBar";

/**
 * Employer route group layout.
 * Auth guard: redirects to landing page if no active session.
 */
export default function EmployerLayout({ children }: { children: ReactNode }) {
  const { isConnected } = useAleoSession();
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
    <div className="flex h-screen overflow-hidden">
      <EmployerNav />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
