"use client";

/**
 * Worker Timesheet — clock-in/clock-out time tracking.
 *
 * Workers use this page to track their hours. All data stays in the
 * browser (localStorage, keyed by wallet address). When the employer
 * runs payroll, total hours for the pay period flow into the payroll
 * table's Hours column.
 */

import { useEffect, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import {
  useTimesheetStore,
  type TimeEntry,
} from "@/src/stores/timesheet_store";

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatHours(hours: number): string {
  return hours.toFixed(1);
}

export default function WorkerTimesheetPage() {
  const { address } = useAleoSession();
  const {
    entries,
    isClockedIn,
    activeEntryId,
    initForWallet,
    clockIn,
    clockOut,
    deleteEntry,
    getCurrentWeekHours,
    getEntriesByDate,
  } = useTimesheetStore();

  // Tick every second while clocked in to update the running timer
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isClockedIn) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isClockedIn]);

  // Initialize for the connected wallet
  useEffect(() => {
    if (address) initForWallet(address);
  }, [address, initForWallet]);

  const weekHours = getCurrentWeekHours();
  const entriesByDate = getEntriesByDate();
  const activeEntry = entries.find((e) => e.id === activeEntryId);

  // Current shift duration
  const activeShiftMs = activeEntry
    ? now - activeEntry.clockIn
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Timesheet</h1>
        <p className="text-sm text-muted-foreground">
          Track your work hours. All data stays in your browser.
        </p>
      </div>

      {/* Clock In/Out card */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            {isClockedIn ? (
              <>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Currently clocked in
                </p>
                <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">
                  {formatDuration(activeShiftMs)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Since {activeEntry ? formatTime(activeEntry.clockIn) : "—"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted-foreground">
                  Not clocked in
                </p>
                <p className="mt-1 text-3xl font-bold text-foreground tabular-nums">
                  {formatHours(weekHours)}h
                </p>
                <p className="text-xs text-muted-foreground">
                  This week
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3">
            {isClockedIn ? (
              <button
                onClick={() => clockOut()}
                className="rounded-lg bg-red-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 transition-colors"
              >
                Clock Out
              </button>
            ) : (
              <button
                onClick={() => clockIn()}
                className="rounded-lg bg-green-600 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 transition-colors"
              >
                Clock In
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Weekly summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-foreground">
          This Week — {formatHours(weekHours)} hours
        </h2>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min((weekHours / 40) * 100, 100)}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {weekHours >= 40
            ? `${formatHours(weekHours - 40)}h overtime`
            : `${formatHours(40 - weekHours)}h remaining to 40h`}
        </p>
      </div>

      {/* Time entries by date */}
      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">
            No time entries yet.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Click &quot;Clock In&quot; to start tracking your hours.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.from(entriesByDate.entries()).map(([date, dayEntries]) => {
            const dayTotalMs = dayEntries.reduce((sum, e) => {
              if (e.durationMs) return sum + e.durationMs;
              if (e.clockOut === null) return sum + (now - e.clockIn);
              return sum;
            }, 0);

            return (
              <div key={date} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-4 py-2">
                  <span className="text-sm font-medium text-foreground">
                    {formatDate(date)}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {formatDuration(dayTotalMs)}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {dayEntries.map((entry) => (
                    <TimeEntryRow
                      key={entry.id}
                      entry={entry}
                      isActive={entry.id === activeEntryId}
                      now={now}
                      onDelete={() => deleteEntry(entry.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single time entry row
// ---------------------------------------------------------------------------

function TimeEntryRow({
  entry,
  isActive,
  now,
  onDelete,
}: {
  entry: TimeEntry;
  isActive: boolean;
  now: number;
  onDelete: () => void;
}) {
  const duration = entry.durationMs ?? (now - entry.clockIn);

  return (
    <div className="flex items-center justify-between px-4 py-2">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            isActive ? "animate-pulse bg-green-500" : "bg-muted-foreground/30"
          }`}
        />
        <div>
          <span className="text-sm text-foreground">
            {formatTime(entry.clockIn)}
            {" — "}
            {entry.clockOut ? formatTime(entry.clockOut) : (
              <span className="text-green-600 dark:text-green-400">now</span>
            )}
          </span>
          {entry.note && (
            <span className="ml-2 text-xs text-muted-foreground">
              {entry.note}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground tabular-nums">
          {formatDuration(duration)}
        </span>
        {!isActive && (
          <button
            onClick={onDelete}
            className="text-xs text-muted-foreground hover:text-destructive"
            title="Delete entry"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
