"use client";

import type { ReactNode } from "react";

/**
 * Worker route layout — stub.
 * Will be implemented post-E9 with proper worker session guard.
 */
export default function WorkerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-4 w-full max-w-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">
            PNW Worker Portal
          </h1>
          <p className="text-sm text-muted-foreground">Worker View</p>
        </div>
        {children}
      </div>
    </div>
  );
}
