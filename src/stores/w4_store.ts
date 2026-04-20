"use client";

/**
 * W-4 Store — worker tax withholding elections.
 *
 * Mirrors the 2020+ IRS Form W-4 structure. Workers fill this out
 * in their portal after accepting an agreement. The employer's payroll
 * page reads each worker's W-4 to auto-compute withholding via the
 * tax engine — no manual filing status dropdown needed.
 *
 * Privacy: W-4 data is stored in localStorage keyed by wallet address.
 * It never leaves the browser unencrypted. When shared with the employer
 * (via encrypted IPFS or agreement terms), only the two parties can read it.
 */

import { create } from "zustand";
import type { FilingStatus } from "@/src/lib/tax-engine";

// ---------------------------------------------------------------------------
// W-4 Data (mirrors IRS Form W-4, 2020+ revision)
// ---------------------------------------------------------------------------

export type W4Data = {
  /** Step 1: Filing status */
  filingStatus: FilingStatus;

  /** Step 2: Multiple jobs or spouse works (checkbox) */
  multipleJobsOrSpouseWorks: boolean;

  /** Step 3: Number of qualifying children (for $2,000 credit each) */
  qualifyingChildren: number;

  /** Step 3: Number of other dependents (for $500 credit each) */
  otherDependents: number;

  /** Step 3: Total dependent credit (computed: children × $2,000 + other × $500) */
  totalDependentCredit: number;

  /** Step 4a: Other income (not from jobs — investments, etc.) */
  otherIncome: number;

  /** Step 4b: Deductions beyond the standard deduction (itemized excess) */
  extraDeductions: number;

  /** Step 4c: Extra withholding per pay period (flat dollar amount) */
  extraWithholding: number;

  /** When the W-4 was last updated (UTC ms) */
  updatedAt: number;

  /** Whether the W-4 has been completed at least once */
  completed: boolean;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type W4State = {
  /** Current wallet address */
  walletAddress: string | null;
  /** W-4 data for the current wallet */
  w4: W4Data;
};

type W4Actions = {
  /** Initialize for a wallet — loads from localStorage */
  initForWallet: (address: string) => void;
  /** Update W-4 fields */
  updateW4: (updates: Partial<W4Data>) => void;
  /** Mark W-4 as completed and persist */
  submitW4: () => void;
  /** Reset to defaults */
  reset: () => void;
};

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

function defaultW4(): W4Data {
  return {
    filingStatus: "single",
    multipleJobsOrSpouseWorks: false,
    qualifyingChildren: 0,
    otherDependents: 0,
    totalDependentCredit: 0,
    otherIncome: 0,
    extraDeductions: 0,
    extraWithholding: 0,
    updatedAt: 0,
    completed: false,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = "pnw_w4_";

function loadW4(address: string): W4Data {
  if (typeof window === "undefined") return defaultW4();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${address}`);
    if (!raw) return defaultW4();
    const parsed = JSON.parse(raw);
    return { ...defaultW4(), ...parsed };
  } catch {
    return defaultW4();
  }
}

function saveW4(address: string, data: W4Data): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${address}`, JSON.stringify(data));
  } catch {
    // Storage full — non-critical
  }
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useW4Store = create<W4State & W4Actions>((set, get) => ({
  walletAddress: null,
  w4: defaultW4(),

  initForWallet: (address) => {
    const w4 = loadW4(address);
    set({ walletAddress: address, w4 });
  },

  updateW4: (updates) => {
    const { walletAddress, w4 } = get();
    if (!walletAddress) return;

    const updated = { ...w4, ...updates };

    // Auto-compute total dependent credit
    updated.totalDependentCredit =
      updated.qualifyingChildren * 2000 +
      updated.otherDependents * 500;

    set({ w4: updated });
  },

  submitW4: () => {
    const { walletAddress, w4 } = get();
    if (!walletAddress) return;

    const final = {
      ...w4,
      completed: true,
      updatedAt: Date.now(),
      // Recompute credit on submit
      totalDependentCredit:
        w4.qualifyingChildren * 2000 + w4.otherDependents * 500,
    };

    saveW4(walletAddress, final);
    set({ w4: final });
  },

  reset: () => {
    const { walletAddress } = get();
    if (walletAddress) {
      localStorage.removeItem(`${STORAGE_PREFIX}${walletAddress}`);
    }
    set({ w4: defaultW4() });
  },
}));

/**
 * Load a worker's W-4 data by their wallet address.
 * Used by the employer's payroll page to read each worker's elections.
 * Returns null if the worker hasn't completed their W-4.
 */
export function loadWorkerW4(workerAddress: string): W4Data | null {
  const data = loadW4(workerAddress);
  return data.completed ? data : null;
}
