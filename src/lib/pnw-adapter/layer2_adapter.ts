// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/adapters/layer2_adapter.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

// Layer 2 program/transition mapping for payroll_nfts_v2.aleo and credential programs

export type Layer2Transition =
  | "mint_cycle_nft"
  | "update_cycle_nft"
  | "mint_credential_nft"
  | "revoke_credential_by_issuer"
  | "revoke_credential_by_owner"
  | "burn_credential_view"
  | "mint_paystub_nft"
  | "authorize_audit";

// Stub: actual implementation synced from pnw_mvp_v2
export const LAYER2_TRANSITIONS: Record<Layer2Transition, { program: string; transition: string }> = {
  mint_cycle_nft: { program: "payroll_nfts_v2.aleo", transition: "mint_cycle_nft" },
  update_cycle_nft: { program: "payroll_nfts_v2.aleo", transition: "update_cycle_nft" },
  // credential_nft_v2: dual-record mint, split revoke paths
  mint_credential_nft: { program: "credential_nft_v2.aleo", transition: "mint_credential_nft" },
  revoke_credential_by_issuer: { program: "credential_nft_v2.aleo", transition: "revoke_by_issuer" },
  revoke_credential_by_owner: { program: "credential_nft_v2.aleo", transition: "revoke_by_owner" },
  burn_credential_view: { program: "credential_nft_v2.aleo", transition: "burn_view" },
  mint_paystub_nft: { program: "payroll_nfts_v2.aleo", transition: "mint_paystub_nft" },
  authorize_audit: { program: "audit_nft.aleo", transition: "mint_authorization_nft" },
};
