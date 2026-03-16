"use client";

import { create } from "zustand";
import type { Address, Bytes32, Field } from "@/src/lib/pnw-adapter/aleo_types";

// ---------------------------------------------------------------------------
// Credential types
// ---------------------------------------------------------------------------

export type CredentialType =
  | "employment_verified"
  | "skills"
  | "clearance"
  | "custom";

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  employment_verified: "Employment Verified",
  skills: "Skills",
  clearance: "Clearance",
  custom: "Custom",
};

export type CredentialStatus = "active" | "revoked" | "pending";

export type CredentialRecord = {
  // Identity
  credential_id: Bytes32;
  credential_type: CredentialType;
  credential_type_label: string;

  // Parties (privacy-preserving hashes — never raw names)
  worker_addr: Address;
  employer_addr: Address;
  subject_hash: Field;
  issuer_hash: Field;

  // Content
  scope: string;
  scope_hash: Bytes32;
  doc_hash: Bytes32;

  // Timing
  issued_epoch: number;
  expires_epoch?: number; // undefined = no expiry

  // On-chain state
  status: CredentialStatus;
  tx_id?: string;       // mint tx
  revoke_tx_id?: string; // revoke tx (if revoked)

  // Wallet signature proof (if signed via wallet adapter)
  signature_proof?: string;
};

// ---------------------------------------------------------------------------
// Issue form input (what the UI collects before hashing)
// ---------------------------------------------------------------------------

export type CredentialIssueInput = {
  worker_addr: Address;
  worker_name_hash: Field;
  credential_type: CredentialType;
  scope: string;
  expires_epoch?: number;
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

type CredentialState = {
  credentials: CredentialRecord[];
  isIssuing: boolean;
  issueError: string | null;
};

type CredentialActions = {
  addCredential: (cred: CredentialRecord) => void;
  updateCredentialStatus: (
    credentialId: Bytes32,
    status: CredentialStatus,
    revokeTxId?: string,
  ) => void;
  setIssuing: (v: boolean) => void;
  setIssueError: (msg: string | null) => void;
  clear: () => void;
};

const STORAGE_KEY = "pnw_credentials";

function loadFromSession(): CredentialRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CredentialRecord[]) : [];
  } catch {
    return [];
  }
}

function saveToSession(credentials: CredentialRecord[]): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(credentials));
}

export const useCredentialStore = create<CredentialState & CredentialActions>(
  (set, get) => ({
    credentials: [],
    isIssuing: false,
    issueError: null,

    addCredential: (cred) => {
      const updated = [...get().credentials, cred];
      saveToSession(updated);
      set({ credentials: updated });
    },

    updateCredentialStatus: (credentialId, status, revokeTxId) => {
      const updated = get().credentials.map((c) =>
        c.credential_id === credentialId
          ? { ...c, status, ...(revokeTxId ? { revoke_tx_id: revokeTxId } : {}) }
          : c,
      );
      saveToSession(updated);
      set({ credentials: updated });
    },

    setIssuing: (isIssuing) => set({ isIssuing }),
    setIssueError: (issueError) => set({ issueError }),

    clear: () => {
      saveToSession([]);
      set({ credentials: [], isIssuing: false, issueError: null });
    },
  }),
);

/** Call on app mount to rehydrate session-stored credentials */
export function rehydrateCredentials(): void {
  const creds = loadFromSession();
  if (creds.length > 0) {
    useCredentialStore.getState().credentials.length === 0 &&
      useCredentialStore.setState({ credentials: creds });
  }
}
