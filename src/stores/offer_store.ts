"use client";

import { create } from "zustand";
import type { TrackedOffer, OfferStatus } from "@/src/handshake/types";
import type { AcceptanceSignal } from "@/src/handshake/types";
import type { Bytes32 } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Offer Store — tracks sent and received offers in session
// ---------------------------------------------------------------------------

type OfferState = {
  /** Offers sent by the employer (employer portal) */
  sentOffers: TrackedOffer[];
  /** Offers received by the worker (worker portal) */
  receivedOffers: TrackedOffer[];
};

type OfferActions = {
  addSentOffer: (offer: TrackedOffer) => void;
  addReceivedOffer: (offer: TrackedOffer) => void;
  updateOfferStatus: (agreementId: Bytes32, status: OfferStatus) => void;
  setAcceptance: (agreementId: Bytes32, acceptance: AcceptanceSignal) => void;
  getSentOffer: (agreementId: Bytes32) => TrackedOffer | undefined;
  getReceivedOffer: (agreementId: Bytes32) => TrackedOffer | undefined;
  clear: () => void;
};

const STORAGE_KEY = "pnw_offers";

function persistToSession(state: OfferState): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be full or unavailable
  }
}

function restoreFromSession(): Partial<OfferState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      return {
        sentOffers: Array.isArray(obj.sentOffers) ? obj.sentOffers as TrackedOffer[] : [],
        receivedOffers: Array.isArray(obj.receivedOffers) ? obj.receivedOffers as TrackedOffer[] : [],
      };
    }
  } catch {
    // ignore
  }
  return {};
}

export const useOfferStore = create<OfferState & OfferActions>((set, get) => {
  const restored = restoreFromSession();

  return {
    sentOffers: restored.sentOffers ?? [],
    receivedOffers: restored.receivedOffers ?? [],

    addSentOffer: (offer) => {
      const state = { sentOffers: [...get().sentOffers, offer], receivedOffers: get().receivedOffers };
      set({ sentOffers: state.sentOffers });
      persistToSession(state);
    },

    addReceivedOffer: (offer) => {
      // Deduplicate by agreement_id
      const existing = get().receivedOffers;
      if (existing.some((o) => o.computed.agreement_id === offer.computed.agreement_id)) return;
      const state = { sentOffers: get().sentOffers, receivedOffers: [...existing, offer] };
      set({ receivedOffers: state.receivedOffers });
      persistToSession(state);
    },

    updateOfferStatus: (agreementId, status) => {
      const update = (offers: TrackedOffer[]) =>
        offers.map((o) =>
          o.computed.agreement_id === agreementId ? { ...o, status } : o,
        );
      const state = {
        sentOffers: update(get().sentOffers),
        receivedOffers: update(get().receivedOffers),
      };
      set(state);
      persistToSession(state);
    },

    setAcceptance: (agreementId, acceptance) => {
      const sentOffers = get().sentOffers.map((o) =>
        o.computed.agreement_id === agreementId
          ? { ...o, acceptance, status: "accepted" as const }
          : o,
      );
      const state = { sentOffers, receivedOffers: get().receivedOffers };
      set({ sentOffers });
      persistToSession(state);
    },

    getSentOffer: (agreementId) =>
      get().sentOffers.find((o) => o.computed.agreement_id === agreementId),

    getReceivedOffer: (agreementId) =>
      get().receivedOffers.find((o) => o.computed.agreement_id === agreementId),

    clear: () => {
      set({ sentOffers: [], receivedOffers: [] });
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    },
  };
});
