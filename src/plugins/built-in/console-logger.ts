/**
 * Built-in Plugin: Console Logger
 *
 * Logs every plugin hook event to the browser console.
 * Enabled only in development (NODE_ENV !== "production") by default.
 *
 * Usage:
 *   import { consoleLoggerPlugin } from "@/plugins/built-in/console-logger";
 *
 *   // In PluginProvider:
 *   <PluginProvider initialPlugins={[consoleLoggerPlugin]}>
 *
 *   // Or conditionally in development only:
 *   const devPlugins = process.env.NODE_ENV === "development"
 *     ? [consoleLoggerPlugin]
 *     : [];
 *   <PluginProvider initialPlugins={devPlugins}>
 */

import type { PluginDefinition } from "../types";

const PREFIX = "[PNW Plugin | console-logger]";

export const consoleLoggerPlugin: PluginDefinition = {
  id: "pnw.built-in.console-logger",
  name: "Console Logger",
  version: "1.0.0",
  description:
    "Logs all portal lifecycle events to the browser console. " +
    "Intended for development and debugging only.",

  onInstall() {
    console.info(`${PREFIX} installed — listening to all portal events.`);
  },

  onUninstall() {
    console.info(`${PREFIX} uninstalled.`);
  },

  hooks: {
    // ---- Session ----
    onSessionConnect({ address }) {
      console.info(`${PREFIX} onSessionConnect`, { address });
    },
    onSessionDisconnect({ address }) {
      console.info(`${PREFIX} onSessionDisconnect`, { address });
    },

    // ---- Chunk-level settlement ----
    onChunkSettleStart({ chunk, manifest, attempt }) {
      console.debug(`${PREFIX} onChunkSettleStart`, {
        chunk_id: chunk.chunk_id,
        chunk_index: chunk.chunk_index,
        batch_id: manifest.batch_id,
        attempt,
      });
    },
    onChunkSettleSuccess({ chunk, manifest, tx_id }) {
      console.info(`${PREFIX} onChunkSettleSuccess`, {
        chunk_id: chunk.chunk_id,
        chunk_index: chunk.chunk_index,
        batch_id: manifest.batch_id,
        tx_id,
      });
    },
    onChunkSettleFailure({ chunk, manifest, error, attempt, will_retry }) {
      console.warn(`${PREFIX} onChunkSettleFailure`, {
        chunk_id: chunk.chunk_id,
        chunk_index: chunk.chunk_index,
        batch_id: manifest.batch_id,
        error,
        attempt,
        will_retry,
      });
    },

    // ---- Run-level settlement ----
    onRunComplete({ manifest, settled_count, failed_count }) {
      console.info(`${PREFIX} onRunComplete`, {
        batch_id: manifest.batch_id,
        settled_count,
        failed_count,
      });
    },
    onRunFailed({ manifest, error }) {
      console.error(`${PREFIX} onRunFailed`, {
        batch_id: manifest.batch_id,
        error,
      });
    },

    // ---- Batch anchor ----
    onBatchAnchorStart({ manifest, batch_root }) {
      console.info(`${PREFIX} onBatchAnchorStart`, {
        batch_id: manifest.batch_id,
        batch_root,
      });
    },
    onBatchAnchorSuccess({ manifest, batch_root, nft_id, tx_id }) {
      console.info(`${PREFIX} onBatchAnchorSuccess`, {
        batch_id: manifest.batch_id,
        batch_root,
        nft_id,
        tx_id,
      });
    },

    // ---- Credentials ----
    onCredentialIssued({ worker_addr, credential_type, credential_id }) {
      console.info(`${PREFIX} onCredentialIssued`, {
        worker_addr,
        credential_type,
        credential_id,
      });
    },
    onCredentialRevoked({ credential_id, worker_addr }) {
      console.info(`${PREFIX} onCredentialRevoked`, {
        credential_id,
        worker_addr,
      });
    },

    // ---- Audit ----
    onAuditRequested({ audit_id, manifest_batch_id, requester_addr }) {
      console.info(`${PREFIX} onAuditRequested`, {
        audit_id,
        manifest_batch_id,
        requester_addr,
      });
    },
  },
};
