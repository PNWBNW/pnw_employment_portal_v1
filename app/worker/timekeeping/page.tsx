"use client";

/**
 * Worker Timekeeping Page — privacy-first clock in / clock out.
 *
 * State-aware UI per spec:
 *   - NOT clocked in → Clock In button only
 *   - Clocked in → Clock Out button + live shift duration
 *   - Below: today's hours + weekly total
 *   - "Request Amendment" link (Phase 2)
 *
 * No localStorage, no sessionStorage, no IndexedDB.
 * All data lives on IPFS as encrypted punch records.
 * State is recovered from Pinata on mount.
 */

import { useEffect, useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useTimesheetStore } from "@/src/stores/timesheet_store";
import { useOfferStore } from "@/src/stores/offer_store";
import { PUNCH_TYPE } from "@/src/timekeeping/types";
import { PunchStatusBadge } from "@/components/timekeeping/PunchStatusBadge";

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkerTimekeepingPage() {
  const { address } = useAleoSession();
  const {
    punches,
    isClockedIn,
    currentShiftStart,
    loading,
    error,
    pendingPunches,
    initFromIPFS,
    punchIn,
    punchOut,
    getCurrentWeekHours,
    getTodayHours,
    getPunchesByDate,
  } = useTimesheetStore();

  // Find employer address from accepted offer
  const receivedOffers = useOfferStore((s) => s.receivedOffers);
  const activeOffer = receivedOffers.find(
    (o) => o.status === "accepted" || o.status === "active",
  );
  const employerAddress = activeOffer?.offer.employer_address;
  const agreementId = activeOffer?.computed.agreement_id ?? "unknown";

  // Initialize from IPFS on mount
  useEffect(() => {
    if (address && employerAddress) {
      initFromIPFS(address, employerAddress, agreementId);
    }
  }, [address, employerAddress, agreementId, initFromIPFS]);

  // Live timer tick (1s interval while clocked in)
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isClockedIn) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isClockedIn]);

  const weekHours = getCurrentWeekHours();
  const todayHours = getTodayHours();
  const punchesByDate = getPunchesByDate();
  const progressPct = Math.min(100, (weekHours / 40) * 100);
  const shiftDuration =
    isClockedIn && currentShiftStart ? now - currentShiftStart : 0;

  if (!address) return null;

  if (!employerAddress) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Timekeeping</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            No active agreement found. Accept a job offer to start tracking
            time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Timekeeping</h1>
        <p className="text-sm text-muted-foreground">
          Your punches are encrypted and stored on IPFS. No time data is stored
          in your browser.
        </p>
      </div>

      {/* Clock In / Out Card */}
      <div className="rounded-lg border border-border bg-card p-6">
        {loading ? (
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">
              Loading punches from encrypted storage...
            </p>
          </div>
        ) : isClockedIn ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Currently clocked in
              </span>
            </div>
            <div className="text-3xl font-mono font-semibold text-foreground">
              {formatDuration(shiftDuration)}
            </div>
            <button
              onClick={punchOut}
              className="rounded-md bg-red-600 px-8 py-3 text-sm font-medium text-white hover:bg-red-700 transition-colors"
            >
              Clock Out
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Not clocked in</p>
            <button
              onClick={punchIn}
              className="rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Clock In
            </button>
          </div>
        )}

        {/* Pending punch indicators */}
        {pendingPunches.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingPunches.map((p, i) => (
              <PunchStatusBadge key={i} status={p.status} />
            ))}
          </div>
        )}

        {error && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Today + Weekly Summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Today</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {todayHours.toFixed(1)}h
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">
            This Week
          </p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {weekHours.toFixed(1)}h
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              / 40h
            </span>
          </p>
          <div className="mt-2 h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full transition-all ${
                weekHours > 40 ? "bg-amber-500" : "bg-primary"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {weekHours > 40 && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {(weekHours - 40).toFixed(1)}h overtime
            </p>
          )}
          {weekHours < 40 && weekHours > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {(40 - weekHours).toFixed(1)}h remaining
            </p>
          )}
        </div>
      </div>

      {/* Daily Punch History */}
      {punchesByDate.size > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Punch History
          </h2>
          <div className="space-y-4">
            {Array.from(punchesByDate.entries()).map(([date, dayPunches]) => (
              <div key={date}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {new Date(date + "T12:00:00").toLocaleDateString(
                      undefined,
                      {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </p>
                </div>
                <div className="mt-1 space-y-1">
                  {dayPunches
                    .sort((a, b) => a.timestamp - b.timestamp)
                    .map((p) => (
                      <div
                        key={p.punchId}
                        className="flex items-center gap-2 text-xs"
                      >
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            p.punchType === PUNCH_TYPE.CLOCK_IN
                              ? "bg-green-500"
                              : "bg-red-400"
                          }`}
                        />
                        <span className="font-mono text-foreground">
                          {formatTime(p.timestamp)}
                        </span>
                        <span className="text-muted-foreground">
                          {p.punchType === PUNCH_TYPE.CLOCK_IN
                            ? "Clock In"
                            : "Clock Out"}
                        </span>
                        {p.note && (
                          <span className="text-muted-foreground">
                            — {p.note}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Your punch data is encrypted with a key shared only between you and your
        employer, then stored on IPFS. It is never stored in your browser or on
        any server in plaintext. Your employer sees only certified weekly hour
        totals at payroll time.
      </p>
    </div>
  );
}
