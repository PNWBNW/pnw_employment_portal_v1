/**
 * Audit Actions — client-side logic for creating audit authorization requests
 * and minting AuditAuthorizationNFT after dual consent.
 *
 * Flow mirrors EMPLOYER_FLOWS.md §6.
 */

import { domainHash, toHex, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import type { Address, Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";
import type { AuditRequest } from "@/src/stores/audit_store";

// ----------------------------------------------------------------
// Input type (what the UI collects)
// ----------------------------------------------------------------

export type AuditRequestInput = {
  worker_addr: Address;
  auditor_addr: Address;
  auditor_display_name?: string;
  scope: string; // human-readable (e.g. "Payroll epochs 20260101–20260301")
  epoch_from: number;
  epoch_to: number;
  expires_epoch?: number;
};

// ----------------------------------------------------------------
// Hash computation
// ----------------------------------------------------------------

function encodeAddress(addr: string): Uint8Array {
  return new TextEncoder().encode(addr);
}

function encodeU32(v: number): Uint8Array {
  const buf = new Uint8Array(4);
  buf[0] = (v >>> 24) & 0xff;
  buf[1] = (v >>> 16) & 0xff;
  buf[2] = (v >>> 8) & 0xff;
  buf[3] = v & 0xff;
  return buf;
}

/** auth_id = BLAKE3("PNW::DOC", TLV(employer + worker + auditor + scope + expiry)) */
export function computeAuthId(
  employerAddr: Address,
  workerAddr: Address,
  auditorAddr: Address,
  scope: string,
  expiresEpoch: number,
): Bytes32 {
  const data = tlvEncode(0x6001, [
    { tag: 0x01, value: encodeAddress(employerAddr) },
    { tag: 0x02, value: encodeAddress(workerAddr) },
    { tag: 0x03, value: encodeAddress(auditorAddr) },
    { tag: 0x04, value: new TextEncoder().encode(scope) },
    { tag: 0x05, value: encodeU32(expiresEpoch) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/** scope_hash = BLAKE3("PNW::DOC", TLV(scope_text)) */
export function computeScopeHash(scope: string): Bytes32 {
  const data = tlvEncode(0x6002, [
    { tag: 0x01, value: new TextEncoder().encode(scope) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/** authorization_event_hash = BLAKE3("PNW::DOC", TLV(employer + worker + consent_time)) */
export function computeAuthorizationEventHash(
  employerAddr: Address,
  workerAddr: Address,
  consentTime: number,
): Bytes32 {
  const data = tlvEncode(0x6003, [
    { tag: 0x01, value: encodeAddress(employerAddr) },
    { tag: 0x02, value: encodeAddress(workerAddr) },
    { tag: 0x03, value: encodeU32(consentTime) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

/** policy_hash = BLAKE3("PNW::DOC", TLV(scope + policy_v)) */
export function computePolicyHash(
  scope: string,
  policyVersion: number,
): Bytes32 {
  const data = tlvEncode(0x6004, [
    { tag: 0x01, value: new TextEncoder().encode(scope) },
    { tag: 0x02, value: encodeU32(policyVersion) },
  ]);
  return toHex(domainHash(DOMAIN_TAGS.DOC, data));
}

// ----------------------------------------------------------------
// Create audit request (employer side — pending worker consent)
// ----------------------------------------------------------------

export type CreateAuditRequestResult = {
  request: AuditRequest;
  command_preview: string;
};

export function createAuditRequest(
  input: AuditRequestInput,
  employerAddr: Address,
): CreateAuditRequestResult {
  const consentTime = Math.floor(Date.now() / 1000);
  const expiresEpoch = input.expires_epoch ?? 0;

  const auth_id = computeAuthId(
    employerAddr,
    input.worker_addr,
    input.auditor_addr,
    input.scope,
    expiresEpoch,
  );
  const scope_hash = computeScopeHash(input.scope);
  const authorization_event_hash = computeAuthorizationEventHash(
    employerAddr,
    input.worker_addr,
    consentTime,
  );
  const policy_hash = computePolicyHash(input.scope, 1);

  const command_preview =
    `snarkos developer execute audit_authorization.aleo authorize_audit ` +
    `"${auth_id}field" "${scope_hash}field" "${authorization_event_hash}field" ` +
    `"${policy_hash}field" ${input.epoch_from}u32 ${expiresEpoch}u32 1u32 1u32`;

  const request: AuditRequest = {
    auth_id,
    employer_addr: employerAddr,
    worker_addr: input.worker_addr,
    auditor_addr: input.auditor_addr,
    auditor_display_name: input.auditor_display_name,
    scope: input.scope,
    scope_hash,
    authorization_event_hash,
    policy_hash,
    epoch_from: input.epoch_from,
    epoch_to: input.epoch_to,
    expires_epoch: expiresEpoch,
    status: "pending_worker",
    created_at: Date.now(),
  };

  return { request, command_preview };
}

// ----------------------------------------------------------------
// Build mint command (after both parties consent)
// ----------------------------------------------------------------

export function buildMintAuditNftCommand(request: AuditRequest): string {
  return (
    `snarkos developer execute audit_authorization.aleo authorize_audit ` +
    `"${request.auth_id}field" "${request.scope_hash}field" ` +
    `"${request.authorization_event_hash}field" "${request.policy_hash}field" ` +
    `${request.epoch_from}u32 ${request.expires_epoch ?? 0}u32 1u32 1u32`
  );
}
