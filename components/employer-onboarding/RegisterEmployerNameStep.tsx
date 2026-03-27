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
  const { addBusiness, setStep, queryError, businesses } = useEmployerIdentityStore();
  const hasCompletedBusiness = businesses.some(b => b.profileAnchored);
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();

  const [name, setName] = useState("");
  const [suffixCode, setSuffixCode] = useState<number>(1);
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const [showCommand, setShowCommand] = useState(false);
  const [commandPreview, setCommandPreview] = useState("");
  const [nameCount, setNameCount] = useState(0);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  // Validation: alphanumeric + underscores, 3-16 chars
  const nameRegex = /^[a-z0-9_]{3,16}$/;
  const isValidFormat = nameRegex.test(name);

  // Tiered pricing based on how many names the wallet already has
  const priceIndex = Math.min(nameCount, 2); // 0, 1, or 2
  const basePrice = EMPLOYER_PRICES[priceIndex]!;
  const feeCost = Number(DEFAULT_NAMING_FEE) / Number(USDCX_SCALE);
  const baseCost = Number(basePrice) / Number(USDCX_SCALE);
  const totalCost = baseCost + feeCost;
  const costDisplay = `${totalCost} USDCx`;
  const suffix = INDUSTRY_SUFFIXES[suffixCode];

  async function handleCheckAvailability() {
    if (!isValidFormat || !address) return;

    setAvailability({ status: "checking" });

    try {
      // Check verification status
      const verified = await queryEmployerVerified(address);
      setIsVerified(verified);

      // Check existing name count for pricing
      const count = await queryEmployerNameCount(address);
      setNameCount(count);

      if (count >= 3) {
        setAvailability({
          status: "error",
          message: "Maximum 3 employer names per wallet. Sell an existing name to register a new one.",
        });
        return;
      }

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
    const count = nameCount; // program expects current count (0, 1, or 2), not count+1
    const registerCmd = buildRegisterEmployerNameCommand(hash, suffixCode, count, DEFAULT_NAMING_FEE);

    setCommandPreview(registerCmd);
    setShowCommand(true);
  }

  async function handleBroadcast() {
    if (availability.status !== "available") return;

    const hash = availability.nameHash;
    const count = nameCount; // program expects current count (0, 1, or 2), not count+1

    const inputs = [
      `${hash}field`,
      `${suffixCode}u8`,
      `${count}u8`,
      `${DEFAULT_NAMING_FEE}u128`,
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
      addBusiness(hash, name, suffixCode);
      setStep("create_profile");
    }
    // "rejected" and "unknown" errors are surfaced via txError from the hook
  }

  function handleConfirmRegistration() {
    if (availability.status !== "available") return;
    addBusiness(availability.nameHash, name, suffixCode);
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
          <p className="text-xs font-medium text-foreground">Up to 3 Names</p>
          <p className="text-xs text-muted-foreground">
            Employers can register up to 3 .pnw names per wallet.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Tiered Pricing</p>
          <p className="text-xs text-muted-foreground">
            {totalCost > 0
              ? "1st: 10 USDCx, 2nd: 100 USDCx, 3rd: 300 USDCx"
              : "Free on testnet (mainnet: 10 / 100 / 300 USDCx)"}
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
              Industry: {suffix?.label} ({suffix?.code}) | Name #{nameCount + 1} of 3
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
          Register {name}.pnw{totalCost > 0 ? ` for ${costDisplay}` : ""}
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
              {totalCost > 0
                ? `This transaction costs ${costDisplay}. You must have sufficient USDCx balance. `
                : "No USDCx fee on testnet. "}
              Aleo network execution fees are paid separately.
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

      {/* Back to dashboard (only if user already has a completed business) */}
      {hasCompletedBusiness && (
        <button
          onClick={() => setStep("complete")}
          className="w-full rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Back to Dashboard
        </button>
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
