"use client";

import { useState } from "react";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useWorkerIdentityStore } from "@/src/stores/worker_identity_store";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import {
  computeNameHash,
  queryNameOwner,
  buildRegisterWorkerNameCommand,
  WORKER_PRICE_BASE,
  DEFAULT_NAMING_FEE,
  USDCX_SCALE,
} from "@/src/registry/name_registry";
import { PROGRAMS } from "@/src/config/programs";

type AvailabilityState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "available"; nameHash: string }
  | { status: "taken" }
  | { status: "error"; message: string };

export function RegisterNameStep() {
  const { address } = useAleoSession();
  const { setWorkerNameHash, setStep, queryError } = useWorkerIdentityStore();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();

  const [name, setName] = useState("");
  const [availability, setAvailability] = useState<AvailabilityState>({ status: "idle" });
  const [showCommand, setShowCommand] = useState(false);
  const [commandPreview, setCommandPreview] = useState("");

  // Validation: alphanumeric + underscores, 3-16 chars
  const nameRegex = /^[a-z0-9_]{3,16}$/;
  const isValidFormat = nameRegex.test(name);

  async function handleCheckAvailability() {
    if (!isValidFormat) return;

    setAvailability({ status: "checking" });

    try {
      const hash = computeNameHash(name);
      const owner = await queryNameOwner(hash);

      if (owner) {
        // Already taken — but check if it belongs to the current wallet
        if (owner === address) {
          // This wallet already owns this name — proceed
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

    // Single transaction: register_worker_name internally calls
    // test_usdcx_stablecoin.aleo/transfer_public(DAO_TREASURY, base + fee)
    // The USDCx transfer is built into the on-chain transition.
    const registerCmd = buildRegisterWorkerNameCommand(hash, DEFAULT_NAMING_FEE);

    setCommandPreview(registerCmd);
    setShowCommand(true);
  }

  async function handleBroadcast() {
    if (availability.status !== "available") return;

    const hash = availability.nameHash;
    const result = await execute(
      PROGRAMS.layer1.pnw_name_registrar,
      "register_worker_name",
      [`${hash}field`, `${DEFAULT_NAMING_FEE}u128`],
    );

    if (result.status === "confirmed") {
      setWorkerNameHash(hash, name);
      setStep("create_profile");
    }
    // "rejected" and "unknown" errors are surfaced via txError from the hook
  }

  function handleConfirmRegistration() {
    if (availability.status !== "available") return;

    // Save the name hash and advance to profile step (preview/skip mode)
    setWorkerNameHash(availability.nameHash, name);
    setStep("create_profile");
  }

  const baseCost = Number(WORKER_PRICE_BASE) / Number(USDCX_SCALE);
  const feeCost = Number(DEFAULT_NAMING_FEE) / Number(USDCX_SCALE);
  const totalCost = baseCost + feeCost;
  const costDisplay = `${totalCost} USDCx`;

  return (
    <div className="mx-auto w-full max-w-lg py-12 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-foreground">
          Register Your .pnw Identity
        </h1>
        <p className="text-sm text-muted-foreground">
          Before using the Worker Portal, you need a .pnw name. This is your
          privacy-preserving identity on the Proven National Workers network.
        </p>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Soulbound</p>
          <p className="text-xs text-muted-foreground">
            1 worker name per wallet. Non-transferable.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Cost</p>
          <p className="text-xs text-muted-foreground">
            {totalCost > 0
              ? `${baseCost} USDCx base${feeCost > 0 ? ` + ${feeCost} USDCx naming fee` : ""}`
              : "Free on testnet"}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Privacy-First</p>
          <p className="text-xs text-muted-foreground">
            Only the name hash is stored on-chain. Never plaintext.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs font-medium text-foreground">Dual Roles</p>
          <p className="text-xs text-muted-foreground">
            You can also register employer names later (up to 3).
          </p>
        </div>
      </div>

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
            Choose Your Worker Name
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            3-16 characters. Lowercase letters, numbers, and underscores only.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label htmlFor="pnw-name" className="text-xs font-medium text-muted-foreground">
              Name
            </label>
            <div className="flex items-center rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-primary">
              <input
                id="pnw-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value.toLowerCase());
                  setAvailability({ status: "idle" });
                  setShowCommand(false);
                }}
                placeholder="your_name"
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
