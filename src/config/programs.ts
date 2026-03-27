// ============================================================
// Program ID Registry
// Mirrors pnw_mvp_v2/config/testnet.manifest.json
// Synced from commit: b1f9dfb (pnw_mvp_v2 main)
// Synced on: 2026-03-26
// ============================================================

export const PROGRAMS = {
  network: "testnet",
  layer1: {
    payroll_core: "payroll_core.aleo",
    paystub_receipts: "paystub_receipts.aleo",
    payroll_audit_log: "payroll_audit_log.aleo",
    employer_agreement: "employer_agreement_v3.aleo",
    employer_license_registry: "employer_license_registry.aleo",
    employer_profiles: "employer_profiles_v2.aleo",
    worker_profiles: "pnw_worker_profiles_v2.aleo",
    pnw_name_registry: "pnw_name_registry_v2.aleo",
    pnw_name_registrar: "pnw_name_registrar_v3.aleo",
    pnw_router: "pnw_router_v3.aleo",
  },
  layer2: {
    payroll_nfts: "payroll_nfts.aleo",
    credential_nft: "credential_nft.aleo",
    audit_nft: "audit_nft.aleo",
  },
  external: {
    usdcx: "test_usdcx_stablecoin.aleo", // testnet only
    usdcx_freezelist: "test_usdcx_freezelist.aleo", // testnet only
  },
} as const;

/** Current version tags — must match deployed program expectations */
export const VERSIONS = {
  schema_v: 1,
  calc_v: 1,
  policy_v: 1,
} as const;
