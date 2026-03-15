"use client";

import { useEffect, type ReactNode } from "react";
import { useSessionStore } from "@/src/stores/session_store";

/**
 * Wraps root layout. Restores session from sessionStorage on mount
 * and sets up the beforeunload warning when a payroll run is active.
 */
export function KeyManagerProvider({ children }: { children: ReactNode }) {
  const restore = useSessionStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return <>{children}</>;
}
