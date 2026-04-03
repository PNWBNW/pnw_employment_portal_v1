// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/adapters/layer1_adapter.ts
// Synced from commit: 9e9ca8b (Leo v4 migration)
// Synced on: 2026-04-02
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

// Layer 1 program/transition mapping for payroll_core_v2.aleo and related programs

export type Layer1Transition =
  | "create_worker_profile"
  | "create_job_offer"
  | "accept_job_offer"
  | "pause_agreement_employer"
  | "pause_agreement_worker"
  | "pause_agreement_dao"
  | "terminate_agreement_employer"
  | "terminate_agreement_worker"
  | "terminate_agreement_dao"
  | "approve_resume_employer"
  | "approve_resume_worker"
  | "approve_resume_dao"
  | "resume_agreement"
  | "execute_payroll"
  | "execute_payroll_batch_2"
  | "execute_payroll_with_creds"
  | "execute_payroll_batch_2_with_creds"
  | "execute_payroll_with_roster"
  | "execute_payroll_batch_2_with_roster"
  | "get_credentials"
  | "get_roster_credentials";

export const LAYER1_TRANSITIONS: Record<Layer1Transition, { program: string; transition: string }> = {
  create_worker_profile: { program: "pnw_worker_profiles_v2.aleo", transition: "create_worker_profile" },
  create_job_offer: { program: "employer_agreement_v4.aleo", transition: "create_job_offer" },
  accept_job_offer: { program: "employer_agreement_v4.aleo", transition: "accept_job_offer" },
  pause_agreement_employer: { program: "employer_agreement_v4.aleo", transition: "pause_agreement_employer" },
  pause_agreement_worker: { program: "employer_agreement_v4.aleo", transition: "pause_agreement_worker" },
  pause_agreement_dao: { program: "employer_agreement_v4.aleo", transition: "pause_agreement_dao" },
  terminate_agreement_employer: { program: "employer_agreement_v4.aleo", transition: "terminate_agreement_employer" },
  terminate_agreement_worker: { program: "employer_agreement_v4.aleo", transition: "terminate_agreement_worker" },
  terminate_agreement_dao: { program: "employer_agreement_v4.aleo", transition: "terminate_agreement_dao" },
  approve_resume_employer: { program: "employer_agreement_v4.aleo", transition: "approve_resume_employer" },
  approve_resume_worker: { program: "employer_agreement_v4.aleo", transition: "approve_resume_worker" },
  approve_resume_dao: { program: "employer_agreement_v4.aleo", transition: "approve_resume_dao" },
  resume_agreement: { program: "employer_agreement_v4.aleo", transition: "resume_agreement" },
  execute_payroll: { program: "payroll_core_v2.aleo", transition: "execute_payroll" },
  execute_payroll_batch_2: { program: "payroll_core_v2.aleo", transition: "execute_payroll_batch_2" },
  // Credential-enabled variants (settlement coordinator upgrades chunks to these)
  execute_payroll_with_creds: { program: "payroll_core_v2.aleo", transition: "execute_payroll_with_creds" },
  execute_payroll_batch_2_with_creds: { program: "payroll_core_v2.aleo", transition: "execute_payroll_batch_2_with_creds" },
  execute_payroll_with_roster: { program: "payroll_core_v2.aleo", transition: "execute_payroll_with_roster" },
  execute_payroll_batch_2_with_roster: { program: "payroll_core_v2.aleo", transition: "execute_payroll_batch_2_with_roster" },
  // Acquire freeze-list credentials (one Merkle proof → reusable Credentials record)
  get_credentials: { program: "test_usdcx_stablecoin.aleo", transition: "get_credentials" },
  // Acquire roster credentials (anchor roster_root on-chain)
  get_roster_credentials: { program: "payroll_core_v2.aleo", transition: "get_roster_credentials" },
};
