// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/adapters/layer1_adapter.ts
// Synced from commit: pending-initial-sync
// Synced on: 2026-03-15
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================

// Layer 1 program/transition mapping for payroll_core.aleo and related programs

export type Layer1Transition =
  | "create_worker_profile"
  | "create_job_offer"
  | "accept_job_offer"
  | "pause_agreement"
  | "resume_agreement_employer"
  | "terminate_agreement"
  | "supersede_agreement"
  | "execute_payroll"
  | "execute_payroll_batch_2";

// Stub: actual implementation synced from pnw_mvp_v2
export const LAYER1_TRANSITIONS: Record<Layer1Transition, { program: string; transition: string }> = {
  create_worker_profile: { program: "worker_profiles.aleo", transition: "create_worker_profile" },
  create_job_offer: { program: "employer_agreement_v2.aleo", transition: "create_job_offer" },
  accept_job_offer: { program: "employer_agreement_v2.aleo", transition: "accept_job_offer" },
  pause_agreement: { program: "employer_agreement_v2.aleo", transition: "pause_agreement" },
  resume_agreement_employer: { program: "employer_agreement_v2.aleo", transition: "resume_agreement_employer" },
  terminate_agreement: { program: "employer_agreement_v2.aleo", transition: "terminate_agreement" },
  supersede_agreement: { program: "employer_agreement_v2.aleo", transition: "supersede_agreement" },
  execute_payroll: { program: "payroll_core.aleo", transition: "execute_payroll" },
  execute_payroll_batch_2: { program: "payroll_core.aleo", transition: "execute_payroll_batch_2" },
};
