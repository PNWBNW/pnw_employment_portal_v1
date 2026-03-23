/**
 * Built-in Plugin: Audit Trail
 *
 * Maintains an in-session log of all significant portal events.
 * Entries are stored in sessionStorage under the key "pnw_audit_trail"
 * so they survive page navigation within the same browser tab but are
 * wiped when the tab closes — matching the portal's session-memory model.
 *
 * No sensitive data (wages, private keys, raw addresses) is written to
 * the trail — only event metadata and opaque identifiers.
 *
 * Usage:
 *   import { auditTrailPlugin, getAuditTrail, clearAuditTrail }
 *     from "@/plugins/built-in/audit-trail";
 *
 *   <PluginProvider initialPlugins={[auditTrailPlugin]}>
 *
 *   // Read entries anywhere:
 *   const entries = getAuditTrail();
 *
 *   // Clear on sign-out:
 *   clearAuditTrail();
 */

import type { PluginDefinition } from "../types";

// ----------------------------------------------------------------
// Entry shape
// ----------------------------------------------------------------

export type AuditTrailEntry = {
  ts: string;       // ISO-8601 UTC timestamp
  event: string;    // Hook name (e.g. "onRunComplete")
  detail: Record<string, unknown>; // Safe, non-sensitive metadata
};

// ----------------------------------------------------------------
// SessionStorage helpers
// ----------------------------------------------------------------

const STORAGE_KEY = "pnw_audit_trail";

function loadEntries(): AuditTrailEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditTrailEntry[]) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: AuditTrailEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // sessionStorage quota exceeded — drop the oldest entry and retry once.
    const trimmed = entries.slice(Math.floor(entries.length / 2));
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Give up silently — the audit trail is best-effort.
    }
  }
}

function append(event: string, detail: Record<string, unknown>): void {
  const entries = loadEntries();
  entries.push({ ts: new Date().toISOString(), event, detail });
  saveEntries(entries);
}

// ----------------------------------------------------------------
// Public accessors
// ----------------------------------------------------------------

/** Returns all audit trail entries for the current session. */
export function getAuditTrail(): AuditTrailEntry[] {
  return loadEntries();
}

/** Clears the audit trail from sessionStorage. Call on sign-out. */
export function clearAuditTrail(): void {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// ----------------------------------------------------------------
// Plugin definition
// ----------------------------------------------------------------

export const auditTrailPlugin: PluginDefinition = {
  id: "pnw.built-in.audit-trail",
  name: "Audit Trail",
  version: "1.0.0",
  description:
    "Records portal lifecycle events to sessionStorage for in-session review. " +
    "No sensitive data (wages, keys, addresses) is stored.",

  onInstall() {
    append("plugin:install", { plugin_id: "pnw.built-in.audit-trail" });
  },

  hooks: {
    // ---- Session ----
    onSessionConnect({ address }) {
      // Store only first 8 chars of address to avoid full key disclosure.
      append("onSessionConnect", { address_prefix: address.slice(0, 8) });
    },
    onSessionDisconnect({ address }) {
      append("onSessionDisconnect", { address_prefix: address.slice(0, 8) });
    },

    // ---- Chunk settlement ----
    onChunkSettleStart({ chunk, manifest, attempt }) {
      append("onChunkSettleStart", {
        batch_id: manifest.batch_id,
        chunk_index: chunk.chunk_index,
        attempt,
      });
    },
    onChunkSettleSuccess({ chunk, manifest, tx_id }) {
      append("onChunkSettleSuccess", {
        batch_id: manifest.batch_id,
        chunk_index: chunk.chunk_index,
        tx_id,
      });
    },
    onChunkSettleFailure({ chunk, manifest, error, attempt, will_retry }) {
      append("onChunkSettleFailure", {
        batch_id: manifest.batch_id,
        chunk_index: chunk.chunk_index,
        error,
        attempt,
        will_retry,
      });
    },

    // ---- Run-level ----
    onRunComplete({ manifest, settled_count, failed_count }) {
      append("onRunComplete", {
        batch_id: manifest.batch_id,
        settled_count,
        failed_count,
      });
    },
    onRunFailed({ manifest, error }) {
      append("onRunFailed", {
        batch_id: manifest.batch_id,
        error,
      });
    },

    // ---- Batch anchor ----
    onBatchAnchorStart({ manifest, batch_root }) {
      append("onBatchAnchorStart", {
        batch_id: manifest.batch_id,
        batch_root,
      });
    },
    onBatchAnchorSuccess({ manifest, nft_id, tx_id }) {
      append("onBatchAnchorSuccess", {
        batch_id: manifest.batch_id,
        nft_id,
        tx_id,
      });
    },

    // ---- Credentials ----
    onCredentialIssued({ credential_type, credential_id }) {
      append("onCredentialIssued", { credential_type, credential_id });
    },
    onCredentialRevoked({ credential_id }) {
      append("onCredentialRevoked", { credential_id });
    },

    // ---- Audit ----
    onAuditRequested({ audit_id, manifest_batch_id }) {
      append("onAuditRequested", { audit_id, manifest_batch_id });
    },
  },
};
