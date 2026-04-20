"use client";

/**
 * Timesheet Store — worker clock-in/clock-out time tracking.
 *
 * Stores time entries per wallet address in localStorage (keyed by
 * address so switching wallets shows the correct history). Each entry
 * is a clock-in/clock-out pair with computed duration.
 *
 * Privacy: all data stays in the browser. No time entries are sent
 * to any server. When payroll runs, only the TOTAL HOURS for the
 * pay period are used — individual clock-in/out timestamps never
 * leave the client.
 */

import { create } from "zustand";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeEntry = {
  id: string;
  clockIn: number;        // UTC ms
  clockOut: number | null; // UTC ms, null = still clocked in
  /** Duration in milliseconds (computed on clock-out) */
  durationMs: number | null;
  /** Optional note (e.g. "lunch break", "overtime") */
  note: string;
  /** Date string YYYY-MM-DD for grouping */
  date: string;
};

export type TimesheetState = {
  /** Current wallet address the timesheet belongs to */
  walletAddress: string | null;
  /** All time entries for this wallet */
  entries: TimeEntry[];
  /** Whether a shift is currently in progress */
  isClockedIn: boolean;
  /** The active entry (if clocked in) */
  activeEntryId: string | null;
};

type TimesheetActions = {
  /** Initialize for a specific wallet — loads from localStorage */
  initForWallet: (address: string) => void;
  /** Clock in — creates a new entry with clockIn = now */
  clockIn: (note?: string) => void;
  /** Clock out — sets clockOut = now on the active entry */
  clockOut: () => void;
  /** Delete a specific entry */
  deleteEntry: (id: string) => void;
  /** Update the note on an entry */
  updateNote: (id: string, note: string) => void;
  /** Get total hours for a specific date range */
  getHoursForRange: (startDate: string, endDate: string) => number;
  /** Get total hours for the current week (Mon-Sun) */
  getCurrentWeekHours: () => number;
  /** Get entries grouped by date */
  getEntriesByDate: () => Map<string, TimeEntry[]>;
  /** Clear all entries for the current wallet */
  clear: () => void;
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "pnw_timesheet_";

function storageKey(address: string): string {
  return `${STORAGE_PREFIX}${address}`;
}

function loadEntries(address: string): TimeEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveEntries(address: string, entries: TimeEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(address), JSON.stringify(entries));
  } catch {
    // Storage full or unavailable — silent fail
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateString(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function todayString(): string {
  return toDateString(Date.now());
}

/** Get the Monday of the current week as YYYY-MM-DD */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday = 0 offset
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return toDateString(monday.getTime());
}

/** Get Sunday of the current week as YYYY-MM-DD */
function currentWeekEnd(): string {
  const start = new Date(currentWeekStart());
  start.setDate(start.getDate() + 6);
  return toDateString(start.getTime());
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useTimesheetStore = create<TimesheetState & TimesheetActions>(
  (set, get) => ({
    walletAddress: null,
    entries: [],
    isClockedIn: false,
    activeEntryId: null,

    initForWallet: (address) => {
      const entries = loadEntries(address);
      // Check if there's an active (unclosed) entry
      const active = entries.find((e) => e.clockOut === null);
      set({
        walletAddress: address,
        entries,
        isClockedIn: !!active,
        activeEntryId: active?.id ?? null,
      });
    },

    clockIn: (note = "") => {
      const { walletAddress, entries, isClockedIn } = get();
      if (!walletAddress || isClockedIn) return;

      const now = Date.now();
      const entry: TimeEntry = {
        id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
        clockIn: now,
        clockOut: null,
        durationMs: null,
        note,
        date: todayString(),
      };

      const updated = [...entries, entry];
      saveEntries(walletAddress, updated);
      set({
        entries: updated,
        isClockedIn: true,
        activeEntryId: entry.id,
      });
    },

    clockOut: () => {
      const { walletAddress, entries, activeEntryId } = get();
      if (!walletAddress || !activeEntryId) return;

      const now = Date.now();
      const updated = entries.map((e) => {
        if (e.id === activeEntryId) {
          return {
            ...e,
            clockOut: now,
            durationMs: now - e.clockIn,
          };
        }
        return e;
      });

      saveEntries(walletAddress, updated);
      set({
        entries: updated,
        isClockedIn: false,
        activeEntryId: null,
      });
    },

    deleteEntry: (id) => {
      const { walletAddress, entries, activeEntryId } = get();
      if (!walletAddress) return;

      const updated = entries.filter((e) => e.id !== id);
      saveEntries(walletAddress, updated);
      set({
        entries: updated,
        isClockedIn: id === activeEntryId ? false : get().isClockedIn,
        activeEntryId: id === activeEntryId ? null : activeEntryId,
      });
    },

    updateNote: (id, note) => {
      const { walletAddress, entries } = get();
      if (!walletAddress) return;

      const updated = entries.map((e) =>
        e.id === id ? { ...e, note } : e,
      );
      saveEntries(walletAddress, updated);
      set({ entries: updated });
    },

    getHoursForRange: (startDate, endDate) => {
      const { entries } = get();
      let totalMs = 0;
      for (const e of entries) {
        if (e.date >= startDate && e.date <= endDate) {
          if (e.durationMs) {
            totalMs += e.durationMs;
          } else if (e.clockOut === null) {
            // Active shift — count up to now
            totalMs += Date.now() - e.clockIn;
          }
        }
      }
      return totalMs / (1000 * 60 * 60); // convert to hours
    },

    getCurrentWeekHours: () => {
      return get().getHoursForRange(currentWeekStart(), currentWeekEnd());
    },

    getEntriesByDate: () => {
      const { entries } = get();
      const grouped = new Map<string, TimeEntry[]>();
      // Sort newest first
      const sorted = [...entries].sort((a, b) => b.clockIn - a.clockIn);
      for (const e of sorted) {
        if (!grouped.has(e.date)) grouped.set(e.date, []);
        grouped.get(e.date)!.push(e);
      }
      return grouped;
    },

    clear: () => {
      const { walletAddress } = get();
      if (walletAddress) {
        localStorage.removeItem(storageKey(walletAddress));
      }
      set({
        entries: [],
        isClockedIn: false,
        activeEntryId: null,
      });
    },
  }),
);
