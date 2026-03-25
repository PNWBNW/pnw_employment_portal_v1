"use client";

import { useState } from "react";
import Link from "next/link";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { useTransactionExecutor } from "@/src/lib/wallet/useTransactionExecutor";
import { WorkerVerification } from "@/components/onboarding/WorkerVerification";
import { OfferForm } from "@/components/onboarding/OfferForm";
import { OfferQRDisplay } from "@/components/onboarding/OfferQRDisplay";
import { AcceptanceReceiver } from "@/components/onboarding/AcceptanceReceiver";
import type { OfferIntent, ComputedAgreementValues } from "@/src/handshake/types";
import type { AcceptanceSignal } from "@/src/handshake/types";
import type { Field } from "@/src/lib/pnw-adapter/aleo_types";

type OnboardStep =
  | "verify"   // Step 1: enter + verify worker address
  | "offer"    // Step 2: fill offer details
  | "dispatch" // Step 3: show QR/link
  | "confirm"  // Step 4: receive acceptance + show command preview
  | "done";    // Step 5: agreement ready for on-chain broadcast

export default function OnboardWorkerPage() {
  const { address: employerAddress } = useAleoSession();
  const { execute, status: txStatus, isExecuting, error: txError } = useTransactionExecutor();
  const [step, setStep] = useState<OnboardStep>("verify");
  const [broadcastTxId, setBroadcastTxId] = useState<string | null>(null);

  // Data passed between steps
  const [workerAddress, setWorkerAddress] = useState("");
  const [workerNameHash, setWorkerNameHash] = useState<Field>("");
  const [offerIntent, setOfferIntent] = useState<OfferIntent | null>(null);
  const [computed, setComputed] = useState<ComputedAgreementValues | null>(null);
  const [acceptance, setAcceptance] = useState<AcceptanceSignal | null>(null);

  const stepLabels: Record<OnboardStep, string> = {
    verify: "1. Verify Worker",
    offer: "2. Create Offer",
    dispatch: "3. Send Offer",
    confirm: "4. Confirm Acceptance",
    done: "5. Complete",
  };

  const steps: OnboardStep[] = ["verify", "offer", "dispatch", "confirm"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/workers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; Back to Workers
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Onboard Worker
        </h1>
        <p className="text-sm text-muted-foreground">
          Create a job offer via the off-chain handshake protocol
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1">
        {steps.map((s) => (
          <div
            key={s}
            className={`flex-1 rounded-sm px-2 py-1 text-center text-xs font-medium ${
              s === step
                ? "bg-primary text-primary-foreground"
                : steps.indexOf(s) < steps.indexOf(step)
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {stepLabels[s]}
          </div>
        ))}
      </div>

      {/* Step content */}
      {step === "verify" && (
        <WorkerVerification
          onVerified={(addr, nameHash) => {
            setWorkerAddress(addr);
            setWorkerNameHash(nameHash);
            setStep("offer");
          }}
        />
      )}

      {step === "offer" && employerAddress && (
        <OfferForm
          employerAddress={employerAddress}
          workerAddress={workerAddress}
          workerNameHash={workerNameHash}
          onOfferCreated={(intent, comp) => {
            setOfferIntent(intent);
            setComputed(comp);
            setStep("dispatch");
          }}
          onBack={() => setStep("verify")}
        />
      )}

      {step === "dispatch" && offerIntent && (
        <OfferQRDisplay
          offer={offerIntent}
          onProceed={() => setStep("confirm")}
          onBack={() => setStep("offer")}
        />
      )}

      {step === "confirm" && offerIntent && computed && (
        <AcceptanceReceiver
          offer={offerIntent}
          computed={computed}
          onAccepted={(signal) => {
            setAcceptance(signal);
            setStep("done");
          }}
          onBack={() => setStep("dispatch")}
        />
      )}

      {step === "done" && offerIntent && computed && acceptance && (
        <div className="space-y-4">
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-6">
            <h3 className="text-sm font-semibold text-green-400">
              Handshake Complete
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Both parties have agreed. The agreement is ready for on-chain broadcast.
            </p>
          </div>

          {/* Command preview */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              On-Chain Command Preview
            </h4>
            <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
              {`snarkos developer execute pnw_router_v2.aleo create_job_offer \\
  "${computed.agreement_id}" \\
  "${computed.parties_key}" \\
  ${offerIntent.employer_name_hash}field \\
  ${offerIntent.worker_name_hash}field \\
  ${offerIntent.worker_address} \\
  ${offerIntent.industry_code}u8 \\
  ${offerIntent.pay_frequency_code}u8 \\
  ${offerIntent.start_epoch}u32 \\
  ${offerIntent.end_epoch}u32 \\
  ${offerIntent.review_epoch}u32 \\
  1u16 ${offerIntent.schema_v}u16 ${offerIntent.policy_v}u16 \\
  "${computed.terms_doc_hash}" \\
  "${computed.terms_root}" \\
  "${computed.offer_time_hash}"`}
            </pre>
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

          {broadcastTxId && (
            <div className="rounded-md border border-green-500/20 bg-green-500/5 p-3">
              <p className="text-xs text-green-400">
                Transaction confirmed: <span className="font-mono">{broadcastTxId.slice(0, 20)}...</span>
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {!broadcastTxId && (
              <button
                onClick={async () => {
                  const result = await execute(
                    "pnw_router_v2.aleo",
                    "create_job_offer",
                    [
                      computed.agreement_id,
                      computed.parties_key,
                      `${offerIntent.employer_name_hash}field`,
                      `${offerIntent.worker_name_hash}field`,
                      offerIntent.worker_address,
                      `${offerIntent.industry_code}u8`,
                      `${offerIntent.pay_frequency_code}u8`,
                      `${offerIntent.start_epoch}u32`,
                      `${offerIntent.end_epoch}u32`,
                      `${offerIntent.review_epoch}u32`,
                      `1u16`,
                      `${offerIntent.schema_v}u16`,
                      `${offerIntent.policy_v}u16`,
                      computed.terms_doc_hash,
                      computed.terms_root,
                      computed.offer_time_hash,
                    ],
                  );
                  if (result.status === "confirmed") {
                    setBroadcastTxId(result.txId);
                  }
                }}
                disabled={isExecuting}
                className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isExecuting ? "Broadcasting..." : "Broadcast to Chain"}
              </button>
            )}
            <Link
              href="/workers"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              Back to Workers
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
