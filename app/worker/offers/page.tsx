"use client";

import Link from "next/link";
import { useOfferStore } from "@/src/stores/offer_store";
import { PAY_FREQUENCY_LABELS } from "@/src/handshake/types";
import { INDUSTRY_SUFFIXES } from "@/src/registry/name_registry";

export default function WorkerOffersPage() {
  const receivedOffers = useOfferStore((s) => s.receivedOffers);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">My Offers</h1>
        <p className="text-sm text-muted-foreground">
          Job offers received from employers via the handshake protocol.
        </p>
      </div>

      {receivedOffers.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No offers received yet. When an employer sends you an offer via QR code
            or link, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {receivedOffers.map((tracked) => {
            const o = tracked.offer;
            const suffix = INDUSTRY_SUFFIXES[o.industry_code];
            return (
              <div
                key={tracked.computed.agreement_id}
                className="rounded-lg border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {suffix?.label ?? `Industry ${o.industry_code}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PAY_FREQUENCY_LABELS[o.pay_frequency_code]} pay
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      tracked.status === "accepted"
                        ? "bg-green-500/10 text-green-400"
                        : tracked.status === "declined"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                    }`}
                  >
                    {tracked.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Employer: {o.employer_address.slice(0, 16)}...
                </p>
                <p className="text-xs text-muted-foreground">
                  Received: {new Date(tracked.created_at).toLocaleString()}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
