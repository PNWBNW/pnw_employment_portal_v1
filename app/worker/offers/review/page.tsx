"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { decodeOfferIntent, encodeAcceptanceSignal, buildAcceptanceUrl } from "@/src/handshake/codec";
import { verifyOfferIntegrity, recomputeFromOffer, buildAcceptChallengeBytes } from "@/src/handshake/engine";
import { toHex } from "@/src/lib/pnw-adapter/hash";
import { useOfferStore } from "@/src/stores/offer_store";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import { PROGRAMS } from "@/src/config/programs";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";
import type { AcceptanceSignal } from "@/src/handshake/types";
import QRCode from "react-qr-code";

function ReviewContent() {
  const searchParams = useSearchParams();
  const { address } = useAleoSession();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();
  const addReceivedOffer = useOfferStore((s) => s.addReceivedOffer);
  const updateOfferStatus = useOfferStore((s) => s.updateOfferStatus);

  const [accepted, setAccepted] = useState(false);
  const [acceptanceUrl, setAcceptanceUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [onChainTxId, setOnChainTxId] = useState<string | null>(null);

  const offerParam = searchParams.get("offer");

  const result = useMemo(() => {
    if (!offerParam) return { error: "No offer parameter found in URL." };

    const offer = decodeOfferIntent(offerParam);
    if (!offer) return { error: "Invalid offer data. The link may be corrupted." };

    // Verify hash integrity
    if (!verifyOfferIntegrity(offer)) {
      return { error: "Offer integrity check failed. The terms may have been tampered with." };
    }

    const computed = recomputeFromOffer(offer);
    return { offer, computed };
  }, [offerParam]);

  if ("error" in result) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
        <h2 className="text-sm font-semibold text-red-400">Invalid Offer</h2>
        <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
      </div>
    );
  }

  const { offer, computed } = result;
  const suffix = INDUSTRY_SUFFIXES[offer.industry_code];

  // Check if this offer is for the connected wallet
  const isForMe = address && address === offer.worker_address;
  const wrongWallet = address && !isForMe;

  function handleAccept() {
    if (!address) return;

    // Build acceptance challenge + sign (preview mode: use challenge hash as placeholder sig)
    const { challengeBytes, timestamp } = buildAcceptChallengeBytes(
      computed.agreement_id,
      offer.employer_address,
    );

    const signal: AcceptanceSignal = {
      version: 1,
      agreement_id: computed.agreement_id,
      worker_address: address,
      worker_signature: toHex(challengeBytes), // placeholder in preview mode
      signature_timestamp: timestamp,
    };

    // Store in session
    addReceivedOffer({
      offer,
      computed,
      status: "accepted",
      acceptance: signal,
      created_at: Date.now(),
    });
    updateOfferStatus(computed.agreement_id, "accepted");

    // Generate acceptance URL for employer
    const url = buildAcceptanceUrl(signal);
    setAcceptanceUrl(url);
    setAccepted(true);
  }

  function handleDecline() {
    addReceivedOffer({
      offer,
      computed,
      status: "declined",
      created_at: Date.now(),
    });
    updateOfferStatus(computed.agreement_id, "declined");
  }

  async function handleCopy() {
    if (!acceptanceUrl) return;
    try {
      await navigator.clipboard.writeText(acceptanceUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textArea = document.createElement("textarea");
      textArea.value = acceptanceUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (accepted && acceptanceUrl) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
          <h2 className="text-sm font-semibold text-green-400">
            Offer Accepted
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Share the acceptance signal with your employer. They will use it to
            broadcast the agreement on-chain.
          </p>
        </div>

        {/* QR code for employer to scan */}
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-lg bg-white p-4">
            <QRCode value={acceptanceUrl} size={200} level="M" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Employer scans this to receive your acceptance
          </p>
        </div>

        {/* Copyable link */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Acceptance Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={acceptanceUrl}
              readOnly
              className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted whitespace-nowrap"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        {/* On-chain acceptance (requires PendingAgreement record) */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            On-Chain Acceptance
          </h3>
          <p className="text-xs text-muted-foreground">
            After the employer broadcasts <code>create_job_offer</code>, your wallet receives
            a PendingAgreement record. Click below to accept on-chain via <code>accept_job_offer</code>.
          </p>

          {isExecuting && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-xs text-primary">
                {txStatus === "submitting" ? "Submitting..." : "Waiting for confirmation..."}
              </p>
            </div>
          )}

          {txError && (
            <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
              <p className="text-xs text-red-400">{txError}</p>
            </div>
          )}

          {onChainTxId && (
            <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
              <p className="text-xs text-green-400">
                Accepted on-chain: <span className="font-mono">{onChainTxId.slice(0, 20)}...</span>
              </p>
            </div>
          )}

          {!onChainTxId && (
            <button
              onClick={async () => {
                // accept_job_offer requires the PendingAgreement record + accept_time_hash
                // The wallet adapter handles record selection
                const acceptTimeHash = computed.offer_time_hash; // reuse as placeholder
                const result = await execute(
                  PROGRAMS.layer1.employer_agreement,
                  "accept_job_offer",
                  [
                    // PendingAgreement record is auto-selected by wallet
                    acceptTimeHash,
                  ],
                );
                if (result.status === "confirmed") {
                  setOnChainTxId(result.txId);
                }
              }}
              disabled={isExecuting}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
            >
              {isExecuting ? "Broadcasting..." : "Accept On-Chain"}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">
          Job Offer Review
        </h1>
        <p className="text-sm text-muted-foreground">
          Review the terms of this job offer before accepting.
        </p>
      </div>

      {/* Integrity badge */}
      <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3 flex items-center gap-2">
        <span className="text-green-400 text-sm">&#10003;</span>
        <span className="text-xs text-green-400">
          Offer integrity verified — hashes match
        </span>
      </div>

      {wrongWallet && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
          <p className="text-sm text-yellow-400">
            This offer is for a different wallet address.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Offer is for: {offer.worker_address.slice(0, 16)}...
          </p>
          <p className="text-xs text-muted-foreground">
            Connected: {address?.slice(0, 16)}...
          </p>
        </div>
      )}

      {/* Offer details */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">
          Offer Details
        </h3>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Employer</p>
            <p className="font-mono text-xs text-foreground break-all">
              {offer.employer_address}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Industry</p>
            <p className="text-sm text-foreground">
              {suffix?.label ?? `Code ${offer.industry_code}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pay Frequency</p>
            <p className="text-sm text-foreground">
              {PAY_FREQUENCY_LABELS[offer.pay_frequency_code] ?? "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Start Epoch</p>
            <p className="text-sm text-foreground">{offer.start_epoch}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End Epoch</p>
            <p className="text-sm text-foreground">
              {offer.end_epoch === 0 ? "Open-ended" : offer.end_epoch}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Review Epoch</p>
            <p className="text-sm text-foreground">{offer.review_epoch}</p>
          </div>
        </div>

        {/* Agreement terms */}
        <div>
          <p className="text-xs text-muted-foreground mb-1">Agreement Terms</p>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {offer.terms_text}
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Terms hash: <span className="font-mono">{offer.terms_doc_hash.slice(0, 20)}...</span>
          </p>
        </div>

        {/* Cryptographic details (collapsed) */}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Cryptographic details
          </summary>
          <div className="mt-2 space-y-1 font-mono text-muted-foreground">
            <p className="break-all">Agreement ID: {computed.agreement_id}</p>
            <p className="break-all">Parties Key: {computed.parties_key}</p>
            <p className="break-all">Terms Root: {computed.terms_root}</p>
            <p className="break-all">Offer Time Hash: {computed.offer_time_hash}</p>
            <p>Employer Sig: {offer.employer_signature.slice(0, 20)}...</p>
          </div>
        </details>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleDecline}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          disabled={!isForMe}
          className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          Accept Offer
        </button>
      </div>
    </div>
  );
}

export default function OfferReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Loading offer...</p>
        </div>
      }
    >
      <ReviewContent />
    </Suspense>
  );
}
