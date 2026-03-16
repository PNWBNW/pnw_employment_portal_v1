"use client";

import { useState, useMemo } from "react";
import QRCode from "react-qr-code";
import { encodeOfferIntent, buildOfferUrl } from "@/src/handshake/codec";
import type { OfferIntent } from "@/src/handshake/types";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";

type Props = {
  offer: OfferIntent;
  onProceed: () => void;
  onBack: () => void;
};

export function OfferQRDisplay({ offer, onProceed, onBack }: Props) {
  const [copied, setCopied] = useState(false);

  const shareableUrl = useMemo(() => buildOfferUrl(offer), [offer]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textArea = document.createElement("textarea");
      textArea.value = shareableUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const industrySuffix = INDUSTRY_SUFFIXES[offer.industry_code];

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Step 3: Send Offer to Worker
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Share the QR code or link with the worker. They will review the terms
          in their Worker Portal and sign an acceptance.
        </p>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-lg bg-white p-4">
          <QRCode
            value={shareableUrl}
            size={200}
            level="M"
          />
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Worker scans this QR code to review the offer
        </p>
      </div>

      {/* Shareable link */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Shareable Link
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareableUrl}
            readOnly
            className="flex-1 rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs text-foreground focus:outline-none"
          />
          <button
            onClick={handleCopyLink}
            className="rounded-md border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted whitespace-nowrap"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Offer summary */}
      <div className="rounded-md border border-border bg-muted/20 p-4 space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Offer Summary
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">Worker: </span>
            <span className="font-mono text-foreground">
              {offer.worker_address.slice(0, 12)}...
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Industry: </span>
            <span className="text-foreground">
              {industrySuffix?.label ?? `Code ${offer.industry_code}`}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Pay: </span>
            <span className="text-foreground">
              {PAY_FREQUENCY_LABELS[offer.pay_frequency_code] ?? "Unknown"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Start: </span>
            <span className="text-foreground">Epoch {offer.start_epoch}</span>
          </div>
          <div>
            <span className="text-muted-foreground">End: </span>
            <span className="text-foreground">
              {offer.end_epoch === 0 ? "Open-ended" : `Epoch ${offer.end_epoch}`}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Terms hash: </span>
            <span className="font-mono text-foreground">
              {offer.terms_doc_hash.slice(0, 14)}...
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onBack}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          Back
        </button>
        <button
          onClick={onProceed}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          I&apos;ve Shared the Offer
        </button>
      </div>
    </div>
  );
}
