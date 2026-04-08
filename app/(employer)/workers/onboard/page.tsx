"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useEmployerIdentityStore } from "@/src/stores/employer_identity_store";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import { computeAgreementValues } from "@/src/handshake/engine";
import { computeNameHash, queryNameOwner, queryWorkerName, queryNamePlaintext, INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { ENV } from "@/src/config/env";
import { fromHex } from "@/src/lib/pnw-adapter/hash";
import { PROGRAMS, VERSIONS } from "@/src/config/programs";
import { encryptTerms } from "@/src/lib/terms-vault/encrypt";
import { uploadEncryptedTerms } from "@/src/lib/terms-vault/ipfs";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";
import type { Field } from "@/src/lib/pnw-adapter/aleo_types";

const FIELD_MODULUS = 8444461749428370424248824938781546531375899335154063827935233455917409239041n;

/** Aleo produces ~1 block every 3 seconds */
const BLOCKS_PER_SECOND = 1 / 3;
const BLOCKS_PER_DAY = Math.floor(BLOCKS_PER_SECOND * 86400); // ~28800

/** Convert a Date to an approximate block height relative to current height */
function dateToBlockHeight(date: Date, currentHeight: number, currentTime: Date): number {
  const diffSeconds = (date.getTime() - currentTime.getTime()) / 1000;
  return Math.max(currentHeight, currentHeight + Math.floor(diffSeconds * BLOCKS_PER_SECOND));
}

/** Convert a block height to approximate date relative to current height */
function blockHeightToDate(height: number, currentHeight: number, currentTime: Date): Date {
  const diffBlocks = height - currentHeight;
  const diffSeconds = diffBlocks * 3; // 3 seconds per block
  return new Date(currentTime.getTime() + diffSeconds * 1000);
}

/** Format a date as YYYY-MM-DD for input[type=date] */
function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

function bytesToAleoU8Array(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) {
    bytes.push(parseInt(clean.slice(i, i + 2), 16));
  }
  return "[ " + bytes.map(b => `${b}u8`).join(", ") + " ]";
}

function fieldFromHash(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  let value = 0n;
  for (let i = 0; i < clean.length; i += 2) {
    value = (value << 8n) | BigInt(parseInt(clean.slice(i, i + 2), 16));
  }
  return (value % FIELD_MODULUS).toString(10);
}

type Step = "form" | "review" | "broadcasting" | "done";

export default function OnboardWorkerPage() {
  const { address: employerAddress } = useAleoSession();
  const { employerNameHash, chosenName, suffixCode } = useEmployerIdentityStore();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();

  const [step, setStep] = useState<Step>("form");
  const [termsUploadStatus, setTermsUploadStatus] = useState<"idle" | "encrypting" | "uploading" | "done" | "error">("idle");
  const [broadcastTxId, setBroadcastTxId] = useState<string | null>(null);

  // Form state
  const [lookupMode, setLookupMode] = useState<"name" | "address">("name");
  const [workerPnwName, setWorkerPnwName] = useState("");
  const [workerAddressInput, setWorkerAddressInput] = useState("");
  const [workerAddress, setWorkerAddress] = useState<string | null>(null);
  const [workerNameHash, setWorkerNameHash] = useState<Field | null>(null);
  const [workerLookupStatus, setWorkerLookupStatus] = useState<"idle" | "checking" | "found" | "not_found">("idle");

  const [industryCode, setIndustryCode] = useState(suffixCode ?? 1);
  const [payFrequency, setPayFrequency] = useState(2); // weekly
  const [startEpoch, setStartEpoch] = useState(1);
  const [endEpoch, setEndEpoch] = useState(0); // 0 = open-ended
  const [reviewEpoch, setReviewEpoch] = useState(1);
  const [termsText, setTermsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [currentBlockHeight, setCurrentBlockHeight] = useState<number | null>(null);

  // Computed values for review
  const [computed, setComputed] = useState<ReturnType<typeof computeAgreementValues> | null>(null);

  // Fetch current block height on load
  useEffect(() => {
    async function fetchBlockHeight() {
      try {
        const resp = await fetch(`${ENV.ALEO_ENDPOINT}/block/height/latest`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (resp.ok) {
          const height = await resp.json();
          if (typeof height === "number") {
            setCurrentBlockHeight(height);
            // Auto-set start epoch to current block if not yet set
            if (startEpoch <= 1) {
              setStartEpoch(height);
              setReviewEpoch(height);
            }
          }
        }
      } catch {
        // Silently fail — user can enter manually
      }
    }
    void fetchBlockHeight();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Look up worker by .pnw name
  async function handleLookupByName() {
    if (!workerPnwName.trim()) return;
    setWorkerLookupStatus("checking");

    try {
      const hash = computeNameHash(workerPnwName.trim().toLowerCase());
      const owner = await queryNameOwner(hash);

      if (owner) {
        setWorkerAddress(owner);
        setWorkerNameHash(hash);
        setWorkerLookupStatus("found");
      } else {
        setWorkerAddress(null);
        setWorkerNameHash(null);
        setWorkerLookupStatus("not_found");
      }
    } catch {
      setWorkerLookupStatus("not_found");
    }
  }

  // Look up worker by Aleo address — find their .pnw name via reverse resolver
  async function handleLookupByAddress() {
    if (!workerAddressInput.trim() || !workerAddressInput.startsWith("aleo1")) return;
    setWorkerLookupStatus("checking");

    try {
      const nameHash = await queryWorkerName(workerAddressInput.trim());

      if (nameHash) {
        const cleanHash = nameHash.replace(/field$/, "").trim();
        setWorkerAddress(workerAddressInput.trim());
        setWorkerNameHash(cleanHash);

        // Reverse resolve: hash → plaintext name
        const plaintext = await queryNamePlaintext(cleanHash);
        setWorkerPnwName(plaintext ?? "");

        setWorkerLookupStatus("found");
      } else {
        setWorkerAddress(null);
        setWorkerNameHash(null);
        setWorkerPnwName("");
        setWorkerLookupStatus("not_found");
      }
    } catch {
      setWorkerLookupStatus("not_found");
    }
  }

  function handleLookupWorker() {
    if (lookupMode === "name") {
      handleLookupByName();
    } else {
      handleLookupByAddress();
    }
  }

  function handleReview() {
    if (!employerAddress || !workerAddress || !workerNameHash || !employerNameHash) return;

    if (!termsText.trim()) {
      setError("Agreement terms are required.");
      return;
    }
    if (startEpoch <= 0) {
      setError("Start epoch must be greater than 0.");
      return;
    }
    if (currentBlockHeight && startEpoch < currentBlockHeight) {
      setError(`Start epoch must be at or after current block height (${currentBlockHeight}).`);
      return;
    }
    if (endEpoch !== 0 && endEpoch <= startEpoch) {
      setError("End epoch must be after start epoch (or 0 for open-ended).");
      return;
    }

    setError(null);

    const offerTime = Math.floor(Date.now() / 1000);
    const vals = computeAgreementValues(
      employerAddress,
      workerAddress,
      termsText.trim(),
      offerTime,
      VERSIONS.schema_v,
      VERSIONS.policy_v,
    );

    setComputed(vals);
    setStep("review");
  }

  async function handleBroadcast() {
    if (!computed || !employerAddress || !workerAddress || !workerNameHash || !employerNameHash) return;
    // Guard against double-submit (React strict mode, fast double-click, etc.)
    if (step === "broadcasting" || isExecuting) return;

    // Lock the UI immediately to prevent double-submit
    setStep("broadcasting");

    // Step 1: Encrypt and upload terms to IPFS
    setTermsUploadStatus("encrypting");
    try {
      const encrypted = await encryptTerms(
        termsText,
        computed.agreement_id,
        employerAddress,
        workerAddress,
      );
      setTermsUploadStatus("uploading");
      const cid = await uploadEncryptedTerms(encrypted, computed.agreement_id);
      console.log("[PNW] Terms uploaded to IPFS:", cid);
      setTermsUploadStatus("done");

      // Save CID locally for employer's reference
      const TERMS_KEY = `pnw_terms_cids_${employerAddress}`;
      try {
        const existing = JSON.parse(localStorage.getItem(TERMS_KEY) ?? "{}");
        existing[computed.agreement_id] = cid;
        localStorage.setItem(TERMS_KEY, JSON.stringify(existing));
      } catch { /* ignore */ }
    } catch (err) {
      console.error("[PNW] Terms upload failed:", err);
      setTermsUploadStatus("error");
      setError("Failed to encrypt and upload agreement terms. Please try again.");
      setStep("review");
      return;
    }

    // Step 2: Broadcast the on-chain transaction
    // Name hashes are already decimal field values from computeNameHash/store
    const empHash = employerNameHash.replace(/field$/, "").trim();
    const wrkHash = workerNameHash.replace(/field$/, "").trim();

    const inputs = [
      bytesToAleoU8Array(computed.agreement_id),
      bytesToAleoU8Array(computed.parties_key),
      `${empHash}field`,
      `${wrkHash}field`,
      workerAddress,
      `${industryCode}u8`,
      `${payFrequency}u8`,
      `${startEpoch}u32`,
      `${endEpoch}u32`,
      `${reviewEpoch}u32`,
      `1u16`,
      `${VERSIONS.schema_v}u16`,
      `${VERSIONS.policy_v}u16`,
      bytesToAleoU8Array(computed.terms_doc_hash),
      bytesToAleoU8Array(computed.terms_root),
      bytesToAleoU8Array(computed.offer_time_hash),
    ];

    console.log("[PNW] create_job_offer inputs:", inputs);

    const result = await execute(
      PROGRAMS.layer1.employer_agreement,
      "create_job_offer",
      inputs,
    );

    if (result.status === "confirmed") {
      setBroadcastTxId(result.txId);

      // Save to localStorage for the sent offers list
      const OFFERS_KEY = `pnw_sent_offers_${employerAddress}`;
      try {
        const existing = JSON.parse(localStorage.getItem(OFFERS_KEY) ?? "[]");
        existing.push({
          agreement_id: computed.agreement_id,
          worker_pnw_name: workerPnwName,
          worker_address: workerAddress,
          industry_code: industryCode,
          pay_frequency: payFrequency,
          terms_text: termsText,
          tx_id: result.txId,
          created_at: Date.now(),
        });
        localStorage.setItem(OFFERS_KEY, JSON.stringify(existing));
      } catch {
        // localStorage write failed
      }

      setStep("done");
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/workers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Workers
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Send Job Offer
        </h1>
        <p className="text-sm text-muted-foreground">
          Create an employment agreement offer. The worker will see it in their portal.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {["Offer Details", "Review & Send"].map((label, i) => (
          <div
            key={label}
            className={`flex-1 rounded-sm px-2 py-1 text-center text-xs font-medium ${
              (step === "form" && i === 0) || (step !== "form" && i === 1)
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Step 1: Offer Form */}
      {step === "form" && (
        <div className="space-y-4">
          {/* Worker lookup */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Find Worker
              </h3>
              <div className="flex rounded-md border border-border text-xs">
                <button
                  onClick={() => { setLookupMode("name"); setWorkerLookupStatus("idle"); }}
                  className={`px-3 py-1 rounded-l-md ${lookupMode === "name" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  .pnw Name
                </button>
                <button
                  onClick={() => { setLookupMode("address"); setWorkerLookupStatus("idle"); }}
                  className={`px-3 py-1 rounded-r-md ${lookupMode === "address" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                >
                  Wallet Address
                </button>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                {lookupMode === "name" ? (
                  <>
                    <label className="text-xs font-medium text-muted-foreground">Worker .pnw Name</label>
                    <div className="flex items-center rounded-md border border-border bg-background focus-within:ring-1 focus-within:ring-primary">
                      <input
                        type="text"
                        value={workerPnwName}
                        onChange={(e) => {
                          setWorkerPnwName(e.target.value.toLowerCase());
                          setWorkerLookupStatus("idle");
                        }}
                        placeholder="worker_name"
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                      />
                      <span className="pr-3 text-sm text-muted-foreground">.pnw</span>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="text-xs font-medium text-muted-foreground">Aleo Wallet Address</label>
                    <input
                      type="text"
                      value={workerAddressInput}
                      onChange={(e) => {
                        setWorkerAddressInput(e.target.value);
                        setWorkerLookupStatus("idle");
                      }}
                      placeholder="aleo1..."
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </>
                )}
              </div>
              <button
                onClick={handleLookupWorker}
                disabled={
                  (lookupMode === "name" && !workerPnwName.trim()) ||
                  (lookupMode === "address" && !workerAddressInput.trim()) ||
                  workerLookupStatus === "checking"
                }
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {workerLookupStatus === "checking" ? "..." : "Find"}
              </button>
            </div>

            {workerLookupStatus === "found" && workerAddress && (
              <div className="rounded-md border border-green-500/30 bg-green-500/5 p-2 space-y-1">
                {workerPnwName && (
                  <p className="text-sm font-medium text-green-400">{workerPnwName}.pnw</p>
                )}
                {lookupMode === "address" && workerNameHash && (
                  <p className="text-xs text-green-400">
                    .pnw identity found (hash: <span className="font-mono">{workerNameHash.slice(0, 12)}...</span>)
                  </p>
                )}
                <p className="text-xs text-green-400">
                  Address: <span className="font-mono">{workerAddress.slice(0, 16)}...{workerAddress.slice(-8)}</span>
                </p>
              </div>
            )}

            {workerLookupStatus === "not_found" && (
              <p className="text-xs text-red-400">Worker not found. Make sure they have a registered .pnw name.</p>
            )}
          </div>

          {/* Offer details */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Offer Details
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Industry</label>
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
                <label className="text-xs font-medium text-muted-foreground">Pay Frequency</label>
                <select
                  value={payFrequency}
                  onChange={(e) => setPayFrequency(Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(PAY_FREQUENCY_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {currentBlockHeight && (
              <div className="rounded-md bg-muted/30 p-2">
                <p className="text-xs text-muted-foreground">
                  Current block height: <span className="font-mono text-foreground">{currentBlockHeight.toLocaleString()}</span>
                  <span className="ml-2">(~1 block every 3 seconds)</span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                <input
                  type="date"
                  value={formatDateInput(currentBlockHeight
                    ? blockHeightToDate(startEpoch, currentBlockHeight, new Date())
                    : new Date())}
                  min={formatDateInput(new Date())}
                  onChange={(e) => {
                    if (currentBlockHeight) {
                      const date = new Date(e.target.value);
                      const height = dateToBlockHeight(date, currentBlockHeight, new Date());
                      setStartEpoch(height);
                      if (reviewEpoch < height) setReviewEpoch(height);
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">Block: {startEpoch.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">End Date <span className="text-muted-foreground/60">(optional)</span></label>
                <input
                  type="date"
                  value={endEpoch > 0 && currentBlockHeight
                    ? formatDateInput(blockHeightToDate(endEpoch, currentBlockHeight, new Date()))
                    : ""}
                  min={formatDateInput(currentBlockHeight
                    ? blockHeightToDate(startEpoch, currentBlockHeight, new Date())
                    : new Date())}
                  onChange={(e) => {
                    if (currentBlockHeight && e.target.value) {
                      const date = new Date(e.target.value);
                      setEndEpoch(dateToBlockHeight(date, currentBlockHeight, new Date()));
                    } else {
                      setEndEpoch(0);
                    }
                  }}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  {endEpoch > 0 ? `Block: ${endEpoch.toLocaleString()}` : "Open-ended"}
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Agreement Terms</label>
              <textarea
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                placeholder="Describe the employment terms, compensation, responsibilities..."
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-xs text-muted-foreground">
                Terms are hashed on-chain — the plaintext is never stored publicly.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <button
            onClick={handleReview}
            disabled={workerLookupStatus !== "found" || !termsText.trim()}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            Review Offer
          </button>
        </div>
      )}

      {/* Step 2: Review & Broadcast */}
      {(step === "review" || step === "broadcasting") && computed && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Offer Summary
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="text-foreground font-medium">{chosenName}.pnw</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="text-foreground font-medium">{workerPnwName}.pnw</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Industry</span>
                <span className="text-foreground">{INDUSTRY_SUFFIXES[industryCode]?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pay Frequency</span>
                <span className="text-foreground">{PAY_FREQUENCY_LABELS[payFrequency as keyof typeof PAY_FREQUENCY_LABELS]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Epochs</span>
                <span className="text-foreground">{startEpoch} → {endEpoch || "open-ended"}</span>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
            <p className="text-xs text-blue-300">
              This will broadcast a job offer to the Aleo network. The worker will see it
              as a pending offer in their portal. Only hashed terms are stored on-chain.
            </p>
          </div>

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
            {!isExecuting && step === "review" && (
              <button
                onClick={() => setStep("form")}
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
              {isExecuting ? "Broadcasting..." : "Send Offer to Chain"}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6 text-center">
            <h3 className="text-lg font-semibold text-green-400">
              Offer Sent!
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your job offer to <strong>{workerPnwName}.pnw</strong> has been broadcast to the Aleo network.
              They will see it as a pending offer in their Worker Portal.
            </p>
            {broadcastTxId && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                TX: {broadcastTxId.slice(0, 24)}...
              </p>
            )}
          </div>

          <Link
            href="/workers"
            className="block w-full rounded-md bg-primary px-4 py-3 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Back to Workers
          </Link>
        </div>
      )}
    </div>
  );
}
