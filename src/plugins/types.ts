/**
 * Plugin System — Type Definitions
 *
 * Defines the extension points available to portal plugins.
 *
 * Hook categories:
 *   - session:    wallet connect / disconnect
 *   - settlement: chunk-level and run-level payroll events
 *   - anchor:     batch anchor NFT lifecycle
 *   - credential: credential issuance / revocation
 *   - audit:      audit authorization events
 *
 * Plugins are pure event observers — they cannot mutate manifests or
 * alter on-chain calls. This preserves Architecture Invariant #6
 * (manifest immutability) and #5 (adapter is the only execution boundary).
 */

import type { Address } from "../lib/pnw-adapter/aleo_types";
import type {
  PayrollRunManifest,
  PayrollRow,
  ChunkPlan,
} from "../manifest/types";

// ----------------------------------------------------------------
// Hook event payloads
// ----------------------------------------------------------------

export type SessionConnectEvent = {
  address: Address;
};

export type SessionDisconnectEvent = {
  address: Address;
};

export type ChunkSettleStartEvent = {
  chunk: ChunkPlan;
  manifest: PayrollRunManifest;
  attempt: number;
};

export type ChunkSettleSuccessEvent = {
  chunk: ChunkPlan;
  manifest: PayrollRunManifest;
  tx_id: string;
};

export type ChunkSettleFailureEvent = {
  chunk: ChunkPlan;
  manifest: PayrollRunManifest;
  error: string;
  attempt: number;
  will_retry: boolean;
};

export type RunCompleteEvent = {
  manifest: PayrollRunManifest;
  settled_count: number;
  failed_count: number;
};

export type RunFailedEvent = {
  manifest: PayrollRunManifest;
  error: string;
};

export type BatchAnchorStartEvent = {
  manifest: PayrollRunManifest;
  batch_root: string;
};

export type BatchAnchorSuccessEvent = {
  manifest: PayrollRunManifest;
  batch_root: string;
  nft_id: string;
  tx_id: string;
};

export type CredentialIssuedEvent = {
  worker_addr: Address;
  credential_type: string;
  credential_id: string;
};

export type CredentialRevokedEvent = {
  credential_id: string;
  worker_addr: Address;
};

export type AuditRequestedEvent = {
  audit_id: string;
  manifest_batch_id: string;
  requester_addr: Address;
};

// ----------------------------------------------------------------
// Hook map — all extension points
// ----------------------------------------------------------------

export type PluginHooks = {
  // Session lifecycle
  onSessionConnect?: (event: SessionConnectEvent) => void | Promise<void>;
  onSessionDisconnect?: (event: SessionDisconnectEvent) => void | Promise<void>;

  // Chunk-level settlement
  onChunkSettleStart?: (event: ChunkSettleStartEvent) => void | Promise<void>;
  onChunkSettleSuccess?: (event: ChunkSettleSuccessEvent) => void | Promise<void>;
  onChunkSettleFailure?: (event: ChunkSettleFailureEvent) => void | Promise<void>;

  // Run-level settlement
  onRunComplete?: (event: RunCompleteEvent) => void | Promise<void>;
  onRunFailed?: (event: RunFailedEvent) => void | Promise<void>;

  // Batch anchor
  onBatchAnchorStart?: (event: BatchAnchorStartEvent) => void | Promise<void>;
  onBatchAnchorSuccess?: (event: BatchAnchorSuccessEvent) => void | Promise<void>;

  // Credentials
  onCredentialIssued?: (event: CredentialIssuedEvent) => void | Promise<void>;
  onCredentialRevoked?: (event: CredentialRevokedEvent) => void | Promise<void>;

  // Audit
  onAuditRequested?: (event: AuditRequestedEvent) => void | Promise<void>;
};

// ----------------------------------------------------------------
// Plugin definition
// ----------------------------------------------------------------

export type PluginDefinition = {
  /** Unique, stable identifier (e.g. "com.example.my-plugin"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** SemVer string (e.g. "1.0.0"). */
  version: string;
  /** Short description shown in the plugin list. */
  description: string;
  /** Lifecycle hooks this plugin implements. */
  hooks: PluginHooks;
  /**
   * Called once when the plugin is registered with the registry.
   * Use this to set up any plugin-internal state.
   */
  onInstall?: () => void | Promise<void>;
  /**
   * Called when the plugin is unregistered.
   * Use this to clean up timers, subscriptions, etc.
   */
  onUninstall?: () => void | Promise<void>;
};

// ----------------------------------------------------------------
// Hook name union (derived from PluginHooks keys)
// ----------------------------------------------------------------

export type PluginHookName = keyof PluginHooks;
