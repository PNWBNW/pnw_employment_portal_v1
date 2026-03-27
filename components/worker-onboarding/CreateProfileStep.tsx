"use client";

import { useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWorkerIdentityStore } from "@/src/stores/worker_identity_store";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import {
  type WorkerProfileInput,
  GENDER_LABELS,
  buildCreateWorkerProfileCommand,
  encodeStringToU128,
} from "@/src/registry/profile_types";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { PROGRAMS } from "@/src/config/programs";
import { domainHash, DOMAIN_TAGS } from "@/src/lib/pnw-adapter/hash";
import { tlvEncode } from "@/src/lib/pnw-adapter/canonical_encoder";
import { US_STATE_CODES, COUNTRY_CODES } from "./geo_codes";

export function CreateProfileStep() {
  const { address } = useAleoSession();
  const { workerNameHash, chosenName, setStep, setProfileAnchored } =
    useWorkerIdentityStore();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState<number>(0);
  const [gender, setGender] = useState<number>(1);
  const [stateCode, setStateCode] = useState<number>(0);
  const [countryCode, setCountryCode] = useState<number>(840); // US default
  const [stateIssueId, setStateIssueId] = useState("");
  const [industryCode, setIndustryCode] = useState<number>(1);
  const [citizenshipFlag, setCitizenshipFlag] = useState<number>(1);

  const [showCommand, setShowCommand] = useState(false);
  const [commandPreview, setCommandPreview] = useState("");
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (age < 16 || age > 120) return "Age must be between 16 and 120.";
    if (stateCode === 0) return "Select your state of residency.";
    return null;
  }

  function bytesToAleoU8Array(bytes: Uint8Array): string {
    return "[ " + Array.from(bytes).map(b => `${b}u8`).join(", ") + " ]";
  }

  function computeProfileAnchor(): string {
    // Profile anchor = BLAKE3("PNW::DOC", TLV(name_hash, address, timestamp))
    const encoder = new TextEncoder();
    const tsBytes = new Uint8Array(4);
    const ts = Math.floor(Date.now() / 1000);
    tsBytes[0] = (ts >>> 24) & 0xff;
    tsBytes[1] = (ts >>> 16) & 0xff;
    tsBytes[2] = (ts >>> 8) & 0xff;
    tsBytes[3] = ts & 0xff;

    const data = tlvEncode(0x5010, [
      { tag: 0x01, value: encoder.encode(workerNameHash ?? "") },
      { tag: 0x02, value: encoder.encode(address ?? "") },
      { tag: 0x03, value: tsBytes },
    ]);
    return bytesToAleoU8Array(domainHash(DOMAIN_TAGS.DOC, data));
  }

  function handleBuildCommand() {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    setError(null);

    const profileAnchor = computeProfileAnchor();
    const input: WorkerProfileInput = {
      worker_name_hash: workerNameHash ?? "",
      first_name: firstName.trim(),
      middle_name: middleName.trim() || " ",
      last_name: lastName.trim(),
      age,
      gender,
      residency_state_code: stateCode,
      country_code: countryCode,
      state_issue_id: stateIssueId.trim() || "0",
      industry_code: industryCode,
      citizenship_flag: citizenshipFlag,
    };

    const cmd = buildCreateWorkerProfileCommand(input, profileAnchor);
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
    const input: WorkerProfileInput = {
      worker_name_hash: workerNameHash ?? "",
      first_name: firstName.trim(),
      middle_name: middleName.trim() || " ",
      last_name: lastName.trim(),
      age,
      gender,
      residency_state_code: stateCode,
      country_code: countryCode,
      state_issue_id: stateIssueId.trim() || "0",
      industry_code: industryCode,
      citizenship_flag: citizenshipFlag,
    };

    // Ensure name hash is within field modulus
    const FIELD_MODULUS = 8444461749428370424248824938781546531375899335154063827935233455917409239041n;
    const rawHash = BigInt(input.worker_name_hash);
    const safeHash = (rawHash % FIELD_MODULUS).toString(10);

    const result = await execute(
      PROGRAMS.layer1.worker_profiles,
      "create_worker_profile",
      [
        `${safeHash}field`,
        encodeStringToU128(input.first_name),
        encodeStringToU128(input.middle_name),
        encodeStringToU128(input.last_name),
        `${input.age}u8`,
        `${input.gender}u8`,
        `${input.residency_state_code}u16`,
        `${input.country_code}u16`,
        encodeStringToU128(input.state_issue_id),
        `${input.industry_code}u8`,
        `${input.citizenship_flag}u8`,
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
          Create Your Worker Profile
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
        <span className="text-xs text-muted-foreground font-mono ml-auto">
          {workerNameHash ? `${workerNameHash.slice(0, 14)}...` : ""}
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
        {/* Personal info */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Personal Information
          </h3>
          <p className="text-xs text-muted-foreground">
            This data is encrypted in your private record. It never appears in plaintext on-chain.
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">First Name *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                maxLength={16}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Middle Name</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                maxLength={16}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Last Name *</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                maxLength={16}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Age *</label>
              <input
                type="number"
                value={age || ""}
                onChange={(e) => setAge(Number(e.target.value))}
                min={16}
                max={120}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(GENDER_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Residency
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
              <label className="text-xs font-medium text-muted-foreground">State *</label>
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

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              State-Issued ID <span className="text-muted-foreground/60">(optional)</span>
            </label>
            <input
              type="text"
              value={stateIssueId}
              onChange={(e) => setStateIssueId(e.target.value)}
              placeholder="Driver's license or state ID number"
              maxLength={16}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              Optional on testnet. Encoded as u128 and stored in your private record only. Max 16 characters.
            </p>
          </div>
        </div>

        {/* Employment */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Employment
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Primary Industry
              </label>
              <select
                value={industryCode}
                onChange={(e) => setIndustryCode(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(INDUSTRY_SUFFIXES).map(([code, { label }]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Citizenship
              </label>
              <select
                value={citizenshipFlag}
                onChange={(e) => setCitizenshipFlag(Number(e.target.value))}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value={1}>US Citizen</option>
                <option value={2}>Permanent Resident</option>
                <option value={3}>Work Visa Holder</option>
                <option value={4}>Other</option>
              </select>
            </div>
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
              visible on-chain. All personal fields are encrypted within the record.
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
    </div>
  );
}
