/**
 * Plugin System — Public API
 *
 * Import from "@/plugins" to access the full plugin system.
 *
 * Quick start:
 *
 *   import {
 *     PluginProvider,
 *     usePlugins,
 *     pluginRegistry,
 *     consoleLoggerPlugin,
 *     auditTrailPlugin,
 *   } from "@/plugins";
 *
 *   // Wrap the app:
 *   <PluginProvider initialPlugins={[auditTrailPlugin]}>
 *     {children}
 *   </PluginProvider>
 *
 *   // Emit from the settlement coordinator:
 *   await pluginRegistry.emit("onRunComplete", { manifest, settled_count, failed_count });
 *
 *   // Build your own plugin:
 *   import type { PluginDefinition } from "@/plugins";
 *   const myPlugin: PluginDefinition = {
 *     id: "com.acme.my-plugin",
 *     name: "My Plugin",
 *     version: "1.0.0",
 *     description: "...",
 *     hooks: { onRunComplete: (e) => console.log(e) },
 *   };
 */

// Core types
export type {
  PluginDefinition,
  PluginHooks,
  PluginHookName,
  SessionConnectEvent,
  SessionDisconnectEvent,
  ChunkSettleStartEvent,
  ChunkSettleSuccessEvent,
  ChunkSettleFailureEvent,
  RunCompleteEvent,
  RunFailedEvent,
  BatchAnchorStartEvent,
  BatchAnchorSuccessEvent,
  CredentialIssuedEvent,
  CredentialRevokedEvent,
  AuditRequestedEvent,
} from "./types";

// Registry singleton
export { pluginRegistry } from "./registry";

// React context + hook
export { PluginProvider, usePlugins } from "./context";

// Loader utilities
export { loadPlugin, loadPlugins, isPluginLoaded } from "./loader";

// Built-in plugins
export { consoleLoggerPlugin } from "./built-in/console-logger";
export {
  auditTrailPlugin,
  getAuditTrail,
  clearAuditTrail,
} from "./built-in/audit-trail";
export type { AuditTrailEntry } from "./built-in/audit-trail";
