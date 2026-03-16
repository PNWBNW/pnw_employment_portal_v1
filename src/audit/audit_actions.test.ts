import { describe, it, expect } from "vitest";
import {
  computeAuthId,
  computeScopeHash,
  computeAuthorizationEventHash,
  computePolicyHash,
  createAuditRequest,
  buildMintAuditNftCommand,
} from "./audit_actions";

const EMPLOYER = "aleo1employer_test_address_0001";
const WORKER = "aleo1worker_test_address_0001";
const AUDITOR = "aleo1auditor_test_address_0001";
const SCOPE = "Payroll epochs 20260101–20260301";

describe("audit hash functions", () => {
  it("computeAuthId is deterministic", () => {
    const a = computeAuthId(EMPLOYER, WORKER, AUDITOR, SCOPE, 20260401);
    const b = computeAuthId(EMPLOYER, WORKER, AUDITOR, SCOPE, 20260401);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("computeAuthId differs with different inputs", () => {
    const a = computeAuthId(EMPLOYER, WORKER, AUDITOR, SCOPE, 20260401);
    const b = computeAuthId(EMPLOYER, WORKER, AUDITOR, SCOPE, 20260501);
    expect(a).not.toBe(b);
  });

  it("computeScopeHash is deterministic", () => {
    const a = computeScopeHash(SCOPE);
    const b = computeScopeHash(SCOPE);
    expect(a).toBe(b);
    expect(a).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("computeScopeHash differs for different scopes", () => {
    const a = computeScopeHash("Scope A");
    const b = computeScopeHash("Scope B");
    expect(a).not.toBe(b);
  });

  it("computeAuthorizationEventHash is deterministic", () => {
    const a = computeAuthorizationEventHash(EMPLOYER, WORKER, 1710000000);
    const b = computeAuthorizationEventHash(EMPLOYER, WORKER, 1710000000);
    expect(a).toBe(b);
  });

  it("computePolicyHash is deterministic", () => {
    const a = computePolicyHash(SCOPE, 1);
    const b = computePolicyHash(SCOPE, 1);
    expect(a).toBe(b);
  });

  it("computePolicyHash differs for different versions", () => {
    const a = computePolicyHash(SCOPE, 1);
    const b = computePolicyHash(SCOPE, 2);
    expect(a).not.toBe(b);
  });
});

describe("createAuditRequest", () => {
  it("produces a valid pending request", () => {
    const { request, command_preview } = createAuditRequest(
      {
        worker_addr: WORKER,
        auditor_addr: AUDITOR,
        auditor_display_name: "Test Auditor",
        scope: SCOPE,
        epoch_from: 20260101,
        epoch_to: 20260301,
        expires_epoch: 20260401,
      },
      EMPLOYER,
    );

    expect(request.status).toBe("pending_worker");
    expect(request.employer_addr).toBe(EMPLOYER);
    expect(request.worker_addr).toBe(WORKER);
    expect(request.auditor_addr).toBe(AUDITOR);
    expect(request.auditor_display_name).toBe("Test Auditor");
    expect(request.scope).toBe(SCOPE);
    expect(request.epoch_from).toBe(20260101);
    expect(request.epoch_to).toBe(20260301);
    expect(request.expires_epoch).toBe(20260401);
    expect(request.auth_id).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.scope_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.authorization_event_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.policy_hash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(request.created_at).toBeGreaterThan(0);
    expect(command_preview).toContain("audit_authorization.aleo");
    expect(command_preview).toContain("authorize_audit");
  });

  it("handles no expiry", () => {
    const { request } = createAuditRequest(
      {
        worker_addr: WORKER,
        auditor_addr: AUDITOR,
        scope: SCOPE,
        epoch_from: 20260101,
        epoch_to: 20260301,
      },
      EMPLOYER,
    );

    expect(request.expires_epoch).toBe(0);
  });
});

describe("buildMintAuditNftCommand", () => {
  it("builds a valid snarkos command", () => {
    const { request } = createAuditRequest(
      {
        worker_addr: WORKER,
        auditor_addr: AUDITOR,
        scope: SCOPE,
        epoch_from: 20260101,
        epoch_to: 20260301,
        expires_epoch: 20260401,
      },
      EMPLOYER,
    );

    const cmd = buildMintAuditNftCommand(request);
    expect(cmd).toContain("audit_authorization.aleo");
    expect(cmd).toContain("authorize_audit");
    expect(cmd).toContain(request.auth_id);
    expect(cmd).toContain(request.scope_hash);
    expect(cmd).toContain("u32");
  });
});
