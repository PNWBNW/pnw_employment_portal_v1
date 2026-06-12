"use client";

/**
 * Timekeeping Store — privacy-first clock-in/clock-out with IPFS persistence.
 *
 * NO localStorage, NO sessionStorage, NO IndexedDB. All punch data lives
 * on IPFS as encrypted records. State is reconstructed on mount by querying
 * Pinata for the worker's current week punches.
 *
 * Individual punches are:
 *   1. Signed by the worker's wallet (authenticity)
 *   2. Encrypted with parties_key (privacy)
 *   3. Pinned to IPFS via Pinata (persistence)
 *   4. Tagged with metadata (worker addr + week ID) for queryability
 *
 * At payroll time, the employer aggregates all weekly punches into a single
 * on-chain WeeklyCommitment transaction — the employer pays the fee.
 */

import { create } from "zustand";
import type { Address } from "@/src/lib/pnw-adapter/aleo_types";
import type { PunchData, PunchType, PunchStatus } from "@/src/timekeeping/types";
import { PUNCH_TYPE } from "@/src/timekeeping/types";
import { hashPunch } from "@/src/timekeeping/punch_crypto";
import { uploadPunch, fetchWeekPunches } from "@/src/timekeeping/punch_ipfs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateString(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayString(): string {
  return toDateString(Date.now());
}

// ---------------------------------------------------------------------------
// Types (exported for consumers)
// ---------------------------------------------------------------------------

/** Backward-compat type alias — consumers that imported TimeEntry can use PunchData */
export type TimeEntry = PunchData;

export type TimesheetState = {
  /** Current wallet address */
  walletAddress: string | null;
  /** Employer address (needed for encryption key derivation) */
  employerAddress: string | null;
  /** Agreement ID for punch records */
  agreementId: string | null;
  /** Decrypted punches for the current week */
  punches: PunchData[];
  /** Whether a shift is currently in progress */
  isClockedIn: boolean;
  /** Timestamp of current shift start (null if not clocked in) */
  currentShiftStart: number | null;
  /** Whether initial IPFS fetch is in progress */
  loading: boolean;
  /** Error message from last operation */
  error: string | null;
  /** Pending punches being uploaded to IPFS */
  pendingPunches: { type: PunchType; timestamp: number; status: PunchStatus }[];
};

type TimesheetActions = {
  /** Initialize from IPFS — fetches and decrypts current week's punches */
  initFromIPFS: (
    workerAddress: Address,
    employerAddress: Address,
    agreementId: string,
  ) => Promise<void>;
  /** Clock in — encrypts and pins to IPFS */
  punchIn: () => Promise<void>;
  /** Clock out — encrypts and pins to IPFS */
  punchOut: () => Promise<void>;
  /** Get total hours for the current week */
  getCurrentWeekHours: () => number;
  /** Get punches grouped by date */
  getPunchesByDate: () => Map<string, PunchData[]>;
  /** Get today's total hours */
  getTodayHours: () => number;
};

// ---------------------------------------------------------------------------
// Compute hours from punch pairs
// ---------------------------------------------------------------------------

function computeHoursFromPunches(punches: PunchData[]): number {
  let totalMs = 0;
  const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);

  let lastClockIn: number | null = null;

  for (const p of sorted) {
    if (p.punchType === PUNCH_TYPE.CLOCK_IN) {
      lastClockIn = p.timestamp;
    } else if (p.punchType === PUNCH_TYPE.CLOCK_OUT && lastClockIn !== null) {
      totalMs += p.timestamp - lastClockIn;
      lastClockIn = null;
    }
  }

  // If still clocked in, count up to now
  if (lastClockIn !== null) {
    totalMs += Date.now() - lastClockIn;
  }

  return totalMs / (1000 * 60 * 60);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimesheetStore = create<TimesheetState & TimesheetActions>(
  (set, get) => ({
    walletAddress: null,
    employerAddress: null,
    agreementId: null,
    punches: [],
    isClockedIn: false,
    currentShiftStart: null,
    loading: false,
    error: null,
    pendingPunches: [],

    initFromIPFS: async (workerAddress, employerAddress, agreementId) => {
      set({
        walletAddress: workerAddress,
        employerAddress,
        agreementId,
        loading: true,
        error: null,
      });

      try {
        const punches = await fetchWeekPunches(
          workerAddress,
          employerAddress,
        );

        // Derive clocked-in state from the most recent punch.
        // If the last punch is CLOCK_IN (regardless of date), the worker
        // is still in a shift — they may have forgotten to clock out.
        const sorted = [...punches].sort((a, b) => a.timestamp - b.timestamp);
        const lastPunch = sorted[sorted.length - 1];
        const isClockedIn =
          lastPunch?.punchType === PUNCH_TYPE.CLOCK_IN;

        set({
          punches,
          isClockedIn,
          currentShiftStart: isClockedIn ? lastPunch!.timestamp : null,
          loading: false,
        });
      } catch (err) {
        console.error("[PNW-TK] Failed to load punches from IPFS:", err);
        set({
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load punches",
        });
      }
    },

    punchIn: async () => {
      const { walletAddress, employerAddress, agreementId, isClockedIn } =
        get();
      if (!walletAddress || !employerAddress || !agreementId || isClockedIn)
        return;

      const now = Date.now();
      const punch: PunchData = {
        punchId: "",
        workerAddress: walletAddress,
        agreementId,
        timestamp: now,
        punchType: PUNCH_TYPE.CLOCK_IN,
        date: todayString(),
      };
      punch.punchId = hashPunch(punch);

      // Optimistic update — show clocked in immediately
      set((state) => ({
        isClockedIn: true,
        currentShiftStart: now,
        punches: [...state.punches, punch],
        pendingPunches: [
          ...state.pendingPunches,
          { type: PUNCH_TYPE.CLOCK_IN, timestamp: now, status: "saving" as PunchStatus },
        ],
      }));

      // Upload in background
      try {
        await uploadPunch(punch, employerAddress, walletAddress);
        set((state) => ({
          pendingPunches: state.pendingPunches.map((p) =>
            p.timestamp === now ? { ...p, status: "saved" as PunchStatus } : p,
          ),
        }));
      } catch (err) {
        console.error("[PNW-TK] Punch upload failed:", err);
        set((state) => ({
          pendingPunches: state.pendingPunches.map((p) =>
            p.timestamp === now
              ? {
                  ...p,
                  status: "error" as PunchStatus,
                }
              : p,
          ),
          error: "Failed to save punch — retrying may be needed",
        }));
      }
    },

    punchOut: async () => {
      const { walletAddress, employerAddress, agreementId, isClockedIn } =
        get();
      if (!walletAddress || !employerAddress || !agreementId || !isClockedIn)
        return;

      const now = Date.now();
      const punch: PunchData = {
        punchId: "",
        workerAddress: walletAddress,
        agreementId,
        timestamp: now,
        punchType: PUNCH_TYPE.CLOCK_OUT,
        date: todayString(),
      };
      punch.punchId = hashPunch(punch);

      // Optimistic update
      set((state) => ({
        isClockedIn: false,
        currentShiftStart: null,
        punches: [...state.punches, punch],
        pendingPunches: [
          ...state.pendingPunches,
          { type: PUNCH_TYPE.CLOCK_OUT, timestamp: now, status: "saving" as PunchStatus },
        ],
      }));

      // Upload in background
      try {
        await uploadPunch(punch, employerAddress, walletAddress);
        set((state) => ({
          pendingPunches: state.pendingPunches.map((p) =>
            p.timestamp === now ? { ...p, status: "saved" as PunchStatus } : p,
          ),
        }));
      } catch (err) {
        console.error("[PNW-TK] Punch upload failed:", err);
        set((state) => ({
          pendingPunches: state.pendingPunches.map((p) =>
            p.timestamp === now
              ? { ...p, status: "error" as PunchStatus }
              : p,
          ),
          error: "Failed to save punch — retrying may be needed",
        }));
      }
    },

    getCurrentWeekHours: () => {
      return computeHoursFromPunches(get().punches);
    },

    getTodayHours: () => {
      const today = todayString();
      const todayPunches = get().punches.filter((p) => p.date === today);
      return computeHoursFromPunches(todayPunches);
    },

    getPunchesByDate: () => {
      const { punches } = get();
      const grouped = new Map<string, PunchData[]>();
      const sorted = [...punches].sort((a, b) => b.timestamp - a.timestamp);
      for (const p of sorted) {
        if (!grouped.has(p.date)) grouped.set(p.date, []);
        grouped.get(p.date)!.push(p);
      }
      return grouped;
    },
  }),
);
