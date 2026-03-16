"use client";

import { useState } from "react";
import { decodeAcceptanceSignal } from "@/src/handshake/codec";
import { useOfferStore } from "@/src/stores/offer_store";
import type { OfferIntent, ComputedAgreementValues, AcceptanceSignal } from "@/src/handshake/types";

type Props = {
  offer: OfferIntent;
  computed: ComputedAgreementValues;
  onAccepted: (signal: AcceptanceSignal) => void;
  onBack: () => void;
};

export function AcceptanceReceiver({ offer, computed, onAccepted, onBack }: Props) {
  const [pastedInput, setPastedInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setAcceptance = useOfferStore((s) => s.setAcceptance);

  function handleDecode() {
    setError(null);

    // Try to extract the acceptance payload from either a raw base64 string or a URL
    let encoded = pastedInput.trim();

    // If it's a URL, extract the accept parameter
    if (encoded.includes("?accept=")) {
      const url = new URL(encoded, "https://placeholder.com");
      encoded = url.searchParams.get("accept") ?? "";
    }

    if (!encoded) {
      setError("No acceptance signal found in the input.");
      return;
    }

    const signal = decodeAcceptanceSignal(encoded);
    if (!signal) {
      setError("Invalid acceptance signal. The data may be corrupted or tampered with.");
      return;
    }

    // Verify agreement_id matches
    if (signal.agreement_id !== computed.agreement_id) {
      setError(
        "Agreement ID mismatch — this acceptance is for a different offer. " +
        "Expected: " + computed.agreement_id.slice(0, 16) + "... " +
        "Got: " + signal.agreement_id.slice(0, 16) + "...",
      );
      return;
    }

    // Verify worker address matches
    if (signal.worker_address !== offer.worker_address) {
      setError(
        "Worker address mismatch — this acceptance was signed by a different wallet.",
      );
      return;
    }

    // All checks passed
    setAcceptance(computed.agreement_id, signal);
    onAccepted(signal);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Step 4: Receive Worker Acceptance
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          After the worker reviews and accepts the offer in their Worker Portal,
          they will generate an acceptance signal. Paste the acceptance link or
          code below.
        </p>
      </div>

      {/* Waiting indicator */}
      <div className="rounded-md border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          <p className="text-sm text-blue-300">
            Waiting for worker acceptance...
          </p>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The worker must open the offer link in their Worker Portal, review the terms,
          and sign the acceptance with their wallet.
        </p>
      </div>

      {/* Paste area */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Paste Acceptance Signal (link or code)
        </label>
        <textarea
          value={pastedInput}
          onChange={(e) => {
            setPastedInput(e.target.value);
            setError(null);
          }}
          placeholder="Paste the acceptance link or base64 code from the worker..."
          rows={3}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Agreement ID reference */}
      <div className="rounded-md bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">
          Expected Agreement ID:
        </p>
        <p className="font-mono text-xs text-foreground break-all">
          {computed.agreement_id}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Back
        </button>
        <button
          onClick={handleDecode}
          disabled={!pastedInput.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Verify Acceptance
        </button>
      </div>
    </div>
  );
}
