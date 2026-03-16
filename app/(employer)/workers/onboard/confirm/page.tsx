"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import Link from "next/link";
import { decodeAcceptanceSignal } from "@/src/handshake/codec";
import { useOfferStore } from "@/src/stores/offer_store";

function ConfirmContent() {
  const searchParams = useSearchParams();
  const acceptParam = searchParams.get("accept");
  const sentOffers = useOfferStore((s) => s.sentOffers);
  const setAcceptance = useOfferStore((s) => s.setAcceptance);

  const result = useMemo(() => {
    if (!acceptParam) return { error: "No acceptance parameter found in URL." };

    const signal = decodeAcceptanceSignal(acceptParam);
    if (!signal) return { error: "Invalid acceptance signal." };

    // Find the matching sent offer
    const tracked = sentOffers.find(
      (o) => o.computed.agreement_id === signal.agreement_id,
    );

    if (!tracked) {
      return {
        error:
          "No matching offer found in this session. You may need to open this link in the same browser where you created the offer.",
      };
    }

    // Verify worker address matches
    if (signal.worker_address !== tracked.offer.worker_address) {
      return { error: "Worker address mismatch — this acceptance was signed by a different wallet." };
    }

    // Auto-save the acceptance
    setAcceptance(signal.agreement_id, signal);

    return { signal, tracked };
  }, [acceptParam, sentOffers, setAcceptance]);

  if ("error" in result) {
    return (
      <div className="space-y-4">
        <Link
          href="/workers/onboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Onboard
        </Link>
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
          <h2 className="text-sm font-semibold text-red-400">
            Acceptance Error
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{result.error}</p>
        </div>
      </div>
    );
  }

  const { signal, tracked } = result;
  const computed = tracked.computed;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/workers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Workers
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Acceptance Confirmed
        </h1>
      </div>

      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
        <h3 className="text-sm font-semibold text-green-400">
          Handshake Complete
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Worker has accepted the offer. The agreement is ready for on-chain broadcast.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Acceptance Details
        </h4>
        <div className="space-y-1 text-xs">
          <p>
            <span className="text-muted-foreground">Worker: </span>
            <span className="font-mono text-foreground">{signal.worker_address}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Agreement ID: </span>
            <span className="font-mono text-foreground break-all">{signal.agreement_id}</span>
          </p>
          <p>
            <span className="text-muted-foreground">Signed at: </span>
            <span className="text-foreground">
              {new Date(signal.signature_timestamp * 1000).toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {/* Command preview */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
          On-Chain Command Preview
        </h4>
        <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
          {`snarkos developer execute pnw_router.aleo create_job_offer \\
  "${computed.agreement_id}" \\
  "${computed.parties_key}" \\
  ${tracked.offer.employer_name_hash}field \\
  ${tracked.offer.worker_name_hash}field \\
  ${tracked.offer.worker_address} \\
  ${tracked.offer.industry_code}u8 \\
  ${tracked.offer.pay_frequency_code}u8 \\
  ${tracked.offer.start_epoch}u32 \\
  ${tracked.offer.end_epoch}u32 \\
  ${tracked.offer.review_epoch}u32 \\
  1u16 ${tracked.offer.schema_v}u16 ${tracked.offer.policy_v}u16 \\
  "${computed.terms_doc_hash}" \\
  "${computed.terms_root}" \\
  "${computed.offer_time_hash}"`}
        </pre>
        <p className="mt-2 text-xs text-muted-foreground">
          Preview mode — actual execution will be wired once the adapter layer is connected.
        </p>
      </div>

      <Link
        href="/workers"
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Back to Workers
      </Link>
    </div>
  );
}

export default function AcceptanceConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center p-8">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <ConfirmContent />
    </Suspense>
  );
}
