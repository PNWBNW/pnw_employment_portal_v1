"use client";

import { useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useEmployerIdentityStore } from "@/src/stores/employer_identity_store";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import {
  computeNameHash,
  queryNameOwner,
  queryEmployerNameCount,
  queryEmployerVerified,
  buildRegisterEmployerNameCommand,
  EMPLOYER_PRICES,
  DEFAULT_NAMING_FEE,
  USDCX_SCALE,
  INDUSTRY_SUFFIXES,
} from "@/src/registry/name_registry";
import { PROGRAMS } from "@/src/config/programs";

type AvailabilityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; nameHash: string }
  | { status: "taken" }
  | { status: "error"; message: string };

export function RegisterEmployerNameStep() {
  const { address } = useAleoSession();
  const { setEmployerNameHash, setStep, queryError } = useEmployerIdentityStore();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();

  const [name, setName] = useState("");
  const [suffixCode, setSuffixCode] = useState<number>(1);
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const [showCommand, setShowCommand] = useState(false);
  const [commandPreview, setCommandPreview] = useState("");
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // Validation: alphanumeric + underscores, 3-16 chars
  const nameRegex = /^[a-z0-9_]{3,16}$/;
  const isValidFormat = nameRegex.test(name);

  // Flat pricing: 1 USDCx per name
  const costDisplay = "1 USDCx";
  const suffix = INDUSTRY_SUFFIXES[suffixCode];

  async function handleCheckAvailability() {
    if (!isValidFormat || !address) return;

    setAvailability({ status: "checking" });

    try {
      // Check verification status
      const verified = await queryEmployerVerified(address);
      setIsVerified(verified);

      const hash = computeNameHash(name);
      const owner = await queryNameOwner(hash);

      if (owner) {
        if (owner === address) {
          setAvailability({ status: "available", nameHash: hash });
        } else {
          setAvailability({ status: "taken" });
        }
      } else {
        setAvailability({ status: "available", nameHash: hash });
      }
    } catch {
      setAvailability({ status: "error", message: "Failed to check name availability." });
    }
  }

  function handleRegister() {
    if (availability.status !== "available") return;

    const hash = availability.nameHash;
    const registerCmd = `snarkos developer execute pnw_name_registrar_v4.aleo register_employer_name ${hash}field ${suffixCode}u8`;

    setCommandPreview(registerCmd);
    setShowCommand(true);
  }

  async function handleBroadcast() {
    if (availability.status !== "available") return;

    const hash = availability.nameHash;

    // Encode name as u128 (big-endian, up to 16 chars) for reverse resolver
    const nameBytes = new TextEncoder().encode(name.slice(0, 16));
    let nameU128 = 0n;
    for (const b of nameBytes) {
      nameU128 = (nameU128 << 8n) | BigInt(b);
    }

    const inputs = [
      `${hash}field`,
      `${nameU128}u128`,
      `${suffixCode}u8`,
    ];

    console.log("[PNW] register_employer_name inputs:", JSON.stringify(inputs, null, 2));
    console.log("[PNW] hash raw value:", hash);
    console.log("[PNW] hash type:", typeof hash);
    console.log("[PNW] hash length:", hash.length);

    const result = await execute(
      PROGRAMS.layer1.pnw_name_registrar,
      "register_employer_name",
      inputs,
    );

    if (result.status === "confirmed") {
      setEmployerNameHash(hash, name, suffixCode);
      setStep("create_profile");
    }
  }

  function handleConfirmRegistration() {
    if (availability.status !== "available") return;
    setEmployerNameHash(availability.nameHash, name, suffixCode);
    setStep("create_profile");
  }

  return (
    <div className="mx-auto w-full max-w-lg py-12 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M3 21h18" />
            <path d="M3 7v1a3 3 0 006 0V7m0 1a3 3 0 006 0V7m0 1a3 3 0 006 0V7H3l2-4h14l2 4" />
            <path d="M5 21V10.87" />
            <path d="M19 21V10.87" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Register Your Employer .pnw Identity
        </h1>
        <p className="text-sm text-muted-foreground">
          Before using the Employer Portal, you need a .pnw employer name. This is your
          privacy-preserving business identity on the Proven National Workers network.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">One Name Per Wallet</p>
          <p className="text-xs text-muted-foreground">
            Each wallet gets one .pnw identity — either worker or employer.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Flat Pricing</p>
          <p className="text-xs text-muted-foreground">
            {costDisplay} (testnet)
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Industry Suffix</p>
          <p className="text-xs text-muted-foreground">
            Each name is tagged with an industry code that must match your profile.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">75% Sellback</p>
          <p className="text-xs text-muted-foreground">
            On mainnet, names can be sold back for 75% of the base price.
          </p>
        </div>
      </div>

      {/* Verification warning */}
      {isVerified === false && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
          <p className="text-xs text-yellow-400 font-medium">Wallet Not Verified</p>
          <p className="text-xs text-muted-foreground mt-1">
            Your wallet has not been verified by the PNW authority yet. On testnet, visit
            the <a href="/dev/verify-employer" className="underline text-yellow-400">dev verification page</a> for
            instructions. On-chain registration will fail without verification.
          </p>
        </div>
      )}

      {/* Network error from gate check */}
      {queryError && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
          <p className="text-xs text-yellow-400">{queryError}</p>
          <p className="text-xs text-muted-foreground mt-1">
            You can still register below. The portal will re-check once the network is reachable.
          </p>
        </div>
      )}

      {/* Name input */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">
            Choose Your Employer Name
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            3-16 characters. Lowercase letters, numbers, and underscores only.
          </p>
        </div>

        {/* Industry suffix selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Industry Suffix *
          </label>
          <select
            value={suffixCode}
            onChange={(e) => {
              setSuffixCode(Number(e.target.value));
              setAvailability({ status: "idle" });
              setShowCommand(false);
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {Object.entries(INDUSTRY_SUFFIXES).map(([code, { label }]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="employer-pnw-name" className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <div className="flex items-center rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-primary">
              <input
                id="employer-pnw-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setAvailability({ status: "idle" });
                  setShowCommand(false);
                }}
                placeholder="your_business"
                maxLength={16}
                className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              <span className="pr-3 text-sm text-muted-foreground">.pnw</span>
            </div>
          </div>
          <button
            onClick={handleCheckAvailability}
            disabled={!isValidFormat || availability.status === "checking"}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {availability.status === "checking" ? "Checking..." : "Check"}
          </button>
        </div>

        {/* Validation hint */}
        {name.length > 0 && !isValidFormat && (
          <p className="text-xs text-red-400">
            {name.length < 3
              ? "Name must be at least 3 characters."
              : name.length > 16
                ? "Name must be 16 characters or fewer."
                : "Only lowercase letters, numbers, and underscores allowed."}
          </p>
        )}

        {/* Availability result */}
        {availability.status === "available" && (
          <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-green-400 text-sm">&#10003;</span>
              <span className="text-sm font-medium text-green-400">
                {name}.pnw is available
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Industry: {suffix?.label} ({suffix?.code})
            </p>
            <p className="text-xs text-muted-foreground font-mono break-all">
              Name hash: {availability.nameHash}
            </p>
          </div>
        )}

        {availability.status === "taken" && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-red-400">
              {name}.pnw is already taken. Try a different name.
            </p>
          </div>
        )}

        {availability.status === "error" && (
          <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-red-400">{availability.message}</p>
          </div>
        )}
      </div>

      {/* Register button */}
      {availability.status === "available" && !showCommand && (
        <button
          onClick={handleRegister}
          className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Register {name}.pnw for {costDisplay}
        </button>
      )}

      {/* Command preview + broadcast */}
      {showCommand && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              On-Chain Registration Command
            </h4>
            <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
              {commandPreview}
            </pre>
          </div>

          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-blue-300">
              This transaction costs {costDisplay}. Aleo network execution fees are paid separately.
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
            <button
              onClick={handleBroadcast}
              disabled={isExecuting}
              className="flex-1 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isExecuting ? "Broadcasting..." : "Broadcast to Chain"}
            </button>
            <button
              onClick={handleConfirmRegistration}
              disabled={isExecuting}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50"
            >
              Skip (Preview Only)
            </button>
          </div>
        </div>
      )}


      {/* Connected wallet info */}
      <div className="rounded-md bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Connected wallet:{" "}
          <span className="font-mono text-foreground">
            {address ? `${address.slice(0, 14)}...${address.slice(-8)}` : "not connected"}
          </span>
        </p>
      </div>
    </div>
  );
}
