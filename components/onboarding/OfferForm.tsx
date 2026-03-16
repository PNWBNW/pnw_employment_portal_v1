"use client";

import { useState } from "react";
import { useOfferStore } from "@/src/stores/offer_store";
import { buildOfferIntent } from "@/src/handshake/engine";
import { computeNameHash } from "@/src/registry/name_registry";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import { toHex } from "@/src/lib/pnw-adapter/hash";
import type { Address, Field } from "@/src/lib/pnw-adapter/aleo_types";
import type { OfferIntent, ComputedAgreementValues } from "@/src/handshake/types";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";

type Props = {
  employerAddress: Address;
  workerAddress: Address;
  workerNameHash: Field;
  onOfferCreated: (offer: OfferIntent, computed: ComputedAgreementValues) => void;
  onBack: () => void;
};

export function OfferForm({
  employerAddress,
  workerAddress,
  workerNameHash,
  onOfferCreated,
  onBack,
}: Props) {
  const addSentOffer = useOfferStore((s) => s.addSentOffer);

  // Form state
  const [industryCode, setIndustryCode] = useState(1);
  const [payFrequency, setPayFrequency] = useState(2); // weekly
  const [startEpoch, setStartEpoch] = useState(0);
  const [endEpoch, setEndEpoch] = useState(0);
  const [reviewEpoch, setReviewEpoch] = useState(0);
  const [termsText, setTermsText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For preview: use a placeholder employer_name_hash
  // In production, this comes from the employer's session/profile
  const [employerNameInput, setEmployerNameInput] = useState("");

  async function handleCreate() {
    if (!termsText.trim()) {
      setError("Agreement terms are required.");
      return;
    }
    if (startEpoch <= 0) {
      setError("Start epoch must be greater than 0.");
      return;
    }
    if (endEpoch !== 0 && endEpoch <= startEpoch) {
      setError("End epoch must be after start epoch (or 0 for open-ended).");
      return;
    }
    if (reviewEpoch < startEpoch) {
      setError("Review epoch must be >= start epoch.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const employerNameHash = employerNameInput.trim()
        ? computeNameHash(employerNameInput.trim())
        : "0x0000000000000000000000000000000000000000000000000000000000000000";

      const { intent, computed, challengeBytes } = buildOfferIntent({
        employer_address: employerAddress,
        employer_name_hash: employerNameHash,
        worker_address: workerAddress,
        worker_name_hash: workerNameHash,
        industry_code: industryCode,
        pay_frequency_code: payFrequency,
        start_epoch: startEpoch,
        end_epoch: endEpoch,
        review_epoch: reviewEpoch,
        terms_text: termsText.trim(),
      });

      // In preview mode, use a placeholder signature
      // In production, this would come from wallet.signMessage(challengeBytes)
      const fullIntent: OfferIntent = {
        ...intent,
        employer_signature: toHex(challengeBytes), // placeholder
        signature_timestamp: Math.floor(Date.now() / 1000),
      };

      // Track the offer in session
      addSentOffer({
        offer: fullIntent,
        computed,
        status: "sent",
        display_name: displayName || undefined,
        created_at: Date.now(),
      });

      onOfferCreated(fullIntent, computed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create offer");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Step 2: Create Job Offer
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Define the agreement terms. All values are hashed before any on-chain interaction.
        </p>
      </div>

      {/* Worker address (read-only) */}
      <div className="rounded-md border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">Worker Address</p>
        <p className="font-mono text-xs text-foreground break-all">{workerAddress}</p>
      </div>

      {/* Display name */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Display Name (portal only, not on-chain)
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. Juan Garcia"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Employer .pnw name (for hash computation) */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Your .pnw Name (for hash computation)
        </label>
        <input
          type="text"
          value={employerNameInput}
          onChange={(e) => setEmployerNameInput(e.target.value)}
          placeholder="e.g. mycompany"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Industry code */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Industry Classification
        </label>
        <select
          value={industryCode}
          onChange={(e) => setIndustryCode(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {Object.entries(INDUSTRY_SUFFIXES).map(([code, { label }]) => (
            <option key={code} value={code}>
              {label} ({code})
            </option>
          ))}
        </select>
      </div>

      {/* Pay frequency */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Pay Frequency
        </label>
        <select
          value={payFrequency}
          onChange={(e) => setPayFrequency(Number(e.target.value))}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {Object.entries(PAY_FREQUENCY_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Epochs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Start Epoch
          </label>
          <input
            type="number"
            value={startEpoch || ""}
            onChange={(e) => setStartEpoch(Number(e.target.value))}
            placeholder="Block height"
            min={1}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            End Epoch (0 = open)
          </label>
          <input
            type="number"
            value={endEpoch || ""}
            onChange={(e) => setEndEpoch(Number(e.target.value))}
            placeholder="0 for open-ended"
            min={0}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Review Epoch
          </label>
          <input
            type="number"
            value={reviewEpoch || ""}
            onChange={(e) => setReviewEpoch(Number(e.target.value))}
            placeholder="When to review"
            min={0}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Terms text */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">
          Agreement Terms
        </label>
        <textarea
          value={termsText}
          onChange={(e) => setTermsText(e.target.value)}
          placeholder="Describe the scope of work, responsibilities, conditions..."
          rows={5}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
        <p className="text-xs text-muted-foreground">
          This text is shown to the worker for review. Only its hash goes on-chain.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Back
        </button>
        <button
          onClick={handleCreate}
          disabled={isCreating}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isCreating ? "Creating..." : "Create Offer"}
        </button>
      </div>
    </div>
  );
}
