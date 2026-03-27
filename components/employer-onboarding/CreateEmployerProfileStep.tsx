"use client";

import { useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useEmployerIdentityStore } from "@/src/stores/employer_identity_store";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import {
  type EmployerProfileInput,
  ENTITY_TYPE_CODES,
  EMPLOYER_SIZE_CODES,
  buildCreateEmployerProfileCommand,
  encodeStringToU128,
} from "@/src/registry/profile_types";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { PROGRAMS } from "@/src/config/programs";
import { domainHash, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import { US_STATE_CODES, COUNTRY_CODES } from "@/components/worker-onboarding/geo_codes";

export function CreateEmployerProfileStep() {
  const { address } = useAleoSession();
  const {
    businesses,
    activeBusinessIndex,
    setStep,
    setProfileAnchored,
  } = useEmployerIdentityStore();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();

  // Get active business directly from array (not via getter for reactivity)
  const activeBiz = activeBusinessIndex !== null ? businesses[activeBusinessIndex] : null;
  const employerNameHash = activeBiz?.nameHash ?? null;
  const chosenName = activeBiz?.name ?? null;
  const suffixCode = activeBiz?.suffixCode ?? null;

  // Form state — matches employer_profiles.aleo record fields
  const [legalName, setLegalName] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [stateCode, setStateCode] = useState<number>(0);
  const [countryCode, setCountryCode] = useState<number>(840);
  const [formationYear, setFormationYear] = useState<number>(2024);
  const [entityTypeCode, setEntityTypeCode] = useState<number>(3); // LLC default
  const [employerSizeCode, setEmployerSizeCode] = useState<number>(1);
  const [operatingRegionCode, setOperatingRegionCode] = useState<number>(0);

  const [showCommand, setShowCommand] = useState(false);
  const [commandPreview, setCommandPreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Industry code must match suffix code (enforced by on-chain contract)
  const industryCode = suffixCode ?? 1;
  const industryLabel = INDUSTRY_SUFFIXES[industryCode]?.label ?? "Unknown";

  function validate(): string | null {
    if (!legalName.trim()) return "Legal name is required.";
    if (!registrationId.trim()) return "Registration ID is required.";
    if (stateCode === 0) return "Select your state of registration.";
    if (formationYear < 1800 || formationYear > 2030) return "Formation year must be between 1800 and 2030.";
    if (operatingRegionCode === 0) return "Select your primary operating region.";
    return null;
  }

  /**
   * Convert a Uint8Array to Aleo [u8; 32] input format: "[ 1u8, 2u8, ... ]"
   */
  function bytesToAleoU8Array(bytes: Uint8Array): string {
    return "[ " + Array.from(bytes).map(b => `${b}u8`).join(", ") + " ]";
  }

  function computeProfileAnchor(): string {
    const encoder = new TextEncoder();
    const tsBytes = new Uint8Array(4);
    const ts = Math.floor(Date.now() / 1000);
    tsBytes[0] = (ts >>> 24) & 0xff;
    tsBytes[1] = (ts >>> 16) & 0xff;
    tsBytes[2] = (ts >>> 8) & 0xff;
    tsBytes[3] = ts & 0xff;

    const data = tlvEncode(0x5011, [
      { tag: 0x01, value: encoder.encode(employerNameHash ?? "") },
      { tag: 0x02, value: encoder.encode(address ?? "") },
      { tag: 0x03, value: tsBytes },
    ]);
    const hashBytes = domainHash(DOMAIN_TAGS.DOC, data);
    return bytesToAleoU8Array(hashBytes);
  }

  function buildInput(): EmployerProfileInput {
    return {
      employer_name_hash: employerNameHash ?? "",
      suffix_code: suffixCode ?? 1,
      legal_name: legalName.trim(),
      registration_id: registrationId.trim(),
      registration_state_code: stateCode,
      country_code: countryCode,
      formation_year: formationYear,
      entity_type_code: entityTypeCode,
      industry_code: industryCode,
      employer_size_code: employerSizeCode,
      operating_region_code: operatingRegionCode,
    };
  }

  function handleBuildCommand() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    const profileAnchor = computeProfileAnchor();
    const input = buildInput();
    const cmd = buildCreateEmployerProfileCommand(input, profileAnchor);
    setCommandPreview(cmd);
    setShowCommand(true);
  }

  async function handleBroadcast() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    const profileAnchor = computeProfileAnchor();
    const input = buildInput();

    // Ensure name hash is within field modulus (safety check for stale session data)
    const FIELD_MODULUS = 8444461749428370424248824938781546531375899335154063827935233455917409239041n;
    const rawHash = BigInt(input.employer_name_hash);
    const safeHash = (rawHash % FIELD_MODULUS).toString(10);

    const result = await execute(
      PROGRAMS.layer1.employer_profiles,
      "create_employer_profile",
      [
        `${safeHash}field`,
        `${input.suffix_code}u8`,
        encodeStringToU128(input.legal_name),
        encodeStringToU128(input.registration_id),
        `${input.registration_state_code}u16`,
        `${input.country_code}u16`,
        `${input.formation_year}u16`,
        `${input.entity_type_code}u8`,
        `${input.industry_code}u8`,
        `${input.employer_size_code}u8`,
        `${input.operating_region_code}u16`,
        `1u16`, // schema_v
        `1u16`, // policy_v
        `1u16`, // profile_rev
        profileAnchor,
      ],
    );

    if (result.status === "confirmed") {
      setProfileAnchored(true);
      setStep("complete");
    }
  }

  function handleConfirm() {
    setProfileAnchored(true);
    setStep("complete");
  }

  return (
    <div className="mx-auto w-full max-w-lg py-12 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Create Your Employer Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your profile is stored as an encrypted private record. Only hashed
          anchors are published on-chain — never plaintext.
        </p>
      </div>

      {/* Name badge */}
      <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2">
        <span className="text-green-400 text-sm">&#10003;</span>
        <span className="text-sm text-green-400 font-medium">
          {chosenName ? `${chosenName}.pnw` : "Name registered"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {industryLabel}
        </span>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        <div className="flex-1 rounded-sm bg-primary/20 px-2 py-1 text-center text-xs font-medium text-primary">
          1. Name
        </div>
        <div className="flex-1 rounded-sm bg-primary px-2 py-1 text-center text-xs font-medium text-primary-foreground">
          2. Profile
        </div>
      </div>

      {/* Profile form */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        {/* Business info */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Business Information
          </h3>
          <p className="text-xs text-muted-foreground">
            This data is encrypted in your private record. It never appears in plaintext on-chain.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Legal Name *</label>
              <input
                type="text"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Business legal name"
                maxLength={16}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">Max 16 characters (u128 encoded)</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Registration ID *</label>
              <input
                type="text"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                placeholder="State filing ID"
                maxLength={16}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">Max 16 characters (u128 encoded)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
              <select
                value={entityTypeCode}
                onChange={(e) => setEntityTypeCode(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(ENTITY_TYPE_CODES).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Formation Year *</label>
              <input
                type="number"
                value={formationYear || ""}
                onChange={(e) => setFormationYear(Number(e.target.value))}
                min={1800}
                max={2030}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Registration & Operations
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Country</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {COUNTRY_CODES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Registration State *</label>
              <select
                value={stateCode}
                onChange={(e) => setStateCode(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={0}>Select state...</option>
                {US_STATE_CODES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Employer Size</label>
              <select
                value={employerSizeCode}
                onChange={(e) => setEmployerSizeCode(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(EMPLOYER_SIZE_CODES).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Operating Region *</label>
              <select
                value={operatingRegionCode}
                onChange={(e) => setOperatingRegionCode(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={0}>Select region...</option>
                {US_STATE_CODES.map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Industry (locked to suffix) */}
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Industry Classification
          </h3>
          <div className="rounded-md bg-muted/30 p-3">
            <p className="text-sm text-foreground">
              {industryLabel} (code {industryCode})
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Locked to your name suffix. On-chain contract enforces industry_code == suffix_code.
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Actions */}
      {!showCommand && (
        <div className="flex gap-2">
          <button
            onClick={() => setStep("register_name")}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            Back
          </button>
          <button
            onClick={handleBuildCommand}
            className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Create Profile
          </button>
        </div>
      )}

      {/* Command preview + broadcast */}
      {showCommand && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              On-Chain Profile Command
            </h4>
            <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
              {commandPreview}
            </pre>
          </div>

          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-blue-300">
              Your profile record is private — only the profile_anchor hash will be
              visible on-chain. All business fields are encrypted within the record.
            </p>
          </div>

          {/* Transaction status */}
          {isExecuting && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs text-primary">
                {txStatus === "submitting" ? "Submitting transaction..." : "Waiting for confirmation..."}
              </p>
            </div>
          )}

          {txError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">{txError}</p>
            </div>
          )}

          <div className="flex gap-2">
            {!isExecuting && (
              <button
                onClick={() => setShowCommand(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                Edit
              </button>
            )}
            <button
              onClick={handleBroadcast}
              disabled={isExecuting}
              className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isExecuting ? "Broadcasting..." : "Broadcast to Chain"}
            </button>
            <button
              onClick={handleConfirm}
              disabled={isExecuting}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Back to dashboard (only if user already has a completed business) */}
      {businesses.some(b => b.profileAnchored) && (
        <button
          onClick={() => setStep("complete")}
          className="w-full rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Back to Dashboard
        </button>
      )}
    </div>
  );
}
