// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/types/aleo_records.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

import type { Address } from "./aleo_types";

export type AleoRecord = {
  owner: Address;
  data: Record<string, unknown>;
  nonce: string;
};

// Re-export commonly used record shapes
export type TokenRecord = AleoRecord;
export type AgreementRecord = AleoRecord;
export type PaystubReceiptRecord = AleoRecord;
