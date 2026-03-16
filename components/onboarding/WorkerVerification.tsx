"use client";

import { useState } from "react";
import { queryWorkerName, queryNameOwner } from "@/src/registry/name_registry";
import type { Address, Field } from "@/src/lib/pnw-adapter/aleo_types";

type Props = {
  onVerified: (workerAddress: Address, workerNameHash: Field) => void;
};

type VerifyState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "verified"; nameHash: Field }
  | { status: "not_registered" }
  | { status: "error"; message: string };

export function WorkerVerification({ onVerified }: Props) {
  const [address, setAddress] = useState("");
  const [state, setState] = useState<VerifyState>({ status: "idle" });

  async function handleVerify() {
    const trimmed = address.trim();
    if (!trimmed.startsWith("aleo1") || trimmed.length < 60) {
      setState({ status: "error", message: "Enter a valid Aleo address (aleo1...)" });
      return;
    }

    setState({ status: "checking" });

    try {
      // Query worker_primary_name_of mapping
      const nameHash = await queryWorkerName(trimmed);

      if (!nameHash) {
        setState({ status: "not_registered" });
        return;
      }

      // Verify the name owner matches the address
      const owner = await queryNameOwner(nameHash);
      if (owner && owner !== trimmed) {
        setState({ status: "error", message: "Name ownership mismatch — potential fraud" });
        return;
      }

      setState({ status: "verified", nameHash });
    } catch {
      setState({ status: "error", message: "Failed to query on-chain state. Check network." });
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">
          Step 1: Verify Worker Identity
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Enter the worker&apos;s Aleo wallet address. The portal will verify they have
          a registered .pnw name and an anchored profile.
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="worker-address"
          className="text-xs font-medium text-muted-foreground"
        >
          Worker Wallet Address
        </label>
        <input
          id="worker-address"
          type="text"
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setState({ status: "idle" });
          }}
          placeholder="aleo1..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        onClick={handleVerify}
        disabled={state.status === "checking" || !address.trim()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {state.status === "checking" ? "Verifying..." : "Verify Worker"}
      </button>

      {/* Status messages */}
      {state.status === "verified" && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-2">
          <p className="text-sm font-medium text-green-400">
            Worker verified
          </p>
          <p className="text-xs text-muted-foreground font-mono break-all">
            .pnw name hash: {state.nameHash}
          </p>
          <button
            onClick={() => onVerified(address.trim(), state.nameHash)}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500"
          >
            Proceed to Offer
          </button>
        </div>
      )}

      {state.status === "not_registered" && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
          <p className="text-sm font-medium text-yellow-400">
            No .pnw name found
          </p>
          <p className="text-xs text-muted-foreground">
            This address does not have a registered .pnw identity. The worker must
            register via the Worker Portal before they can receive a job offer.
          </p>
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm font-medium text-red-400">
            {state.message}
          </p>
        </div>
      )}
    </div>
  );
}
