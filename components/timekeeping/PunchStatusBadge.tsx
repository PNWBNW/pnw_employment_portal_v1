"use client";

import type { PunchStatus } from "@/src/timekeeping/types";

const styles: Record<PunchStatus, { bg: string; text: string; label: string }> = {
  saving: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    label: "Saving...",
  },
  saved: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    label: "Saved",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    label: "Error",
  },
};

export function PunchStatusBadge({ status }: { status: PunchStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}
    >
      {status === "saving" && (
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-500" />
      )}
      {s.label}
    </span>
  );
}
