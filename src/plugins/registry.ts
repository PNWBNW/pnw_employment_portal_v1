/**
 * Plugin Registry
 *
 * Singleton that holds all registered plugins and dispatches hook events
 * to every plugin that has implemented the corresponding hook.
 *
 * Usage:
 *   import { pluginRegistry } from "@/plugins/registry";
 *
 *   // Register
 *   await pluginRegistry.register(myPlugin);
 *
 *   // Dispatch (called internally by coordinator, anchor finalizer, etc.)
 *   await pluginRegistry.emit("onRunComplete", { manifest, settled_count: 5, failed_count: 0 });
 *
 *   // Unregister
 *   await pluginRegistry.unregister("com.example.my-plugin");
 */

import type {
  PluginDefinition,
  PluginHooks,
  PluginHookName,
} from "./types";

// Infer the event payload type for a given hook name.
type HookPayload<K extends PluginHookName> = NonNullable<PluginHooks[K]> extends (
  event: infer E
) => unknown
  ? E
  : never;

class PluginRegistry {
  private plugins = new Map<string, PluginDefinition>();

  // ----------------------------------------------------------------
  // Registration
  // ----------------------------------------------------------------

  /**
   * Register a plugin. Calls onInstall() if provided.
   * Throws if a plugin with the same id is already registered.
   */
  async register(plugin: PluginDefinition): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(
        `[PluginRegistry] Plugin "${plugin.id}" is already registered. ` +
          `Unregister it first or use a unique id.`
      );
    }
    this.plugins.set(plugin.id, plugin);
    if (plugin.onInstall) {
      await plugin.onInstall();
    }
  }

  /**
   * Unregister a plugin by id. Calls onUninstall() if provided.
   * No-op if the plugin is not registered.
   */
  async unregister(id: string): Promise<void> {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    if (plugin.onUninstall) {
      await plugin.onUninstall();
    }
    this.plugins.delete(id);
  }

  // ----------------------------------------------------------------
  // Querying
  // ----------------------------------------------------------------

  /** Returns all currently registered plugins in insertion order. */
  list(): PluginDefinition[] {
    return Array.from(this.plugins.values());
  }

  /** Returns a plugin by id, or undefined if not registered. */
  get(id: string): PluginDefinition | undefined {
    return this.plugins.get(id);
  }

  /** Returns true if a plugin with the given id is registered. */
  has(id: string): boolean {
    return this.plugins.has(id);
  }

  /** Number of registered plugins. */
  get size(): number {
    return this.plugins.size;
  }

  // ----------------------------------------------------------------
  // Event dispatch
  // ----------------------------------------------------------------

  /**
   * Emit a hook event to all plugins that implement it.
   *
   * Plugins are called sequentially in registration order.
   * A hook that throws will not prevent subsequent plugins from running —
   * the error is caught, logged, and execution continues.
   *
   * @param hook - The hook name (e.g. "onRunComplete")
   * @param event - The event payload
   */
  async emit<K extends PluginHookName>(
    hook: K,
    event: HookPayload<K>
  ): Promise<void> {
    for (const plugin of this.plugins.values()) {
      const handler = plugin.hooks[hook];
      if (typeof handler !== "function") continue;
      try {
        // TypeScript needs this cast because the generic inference doesn't
        // flow into the runtime handler call.
        await (handler as (e: HookPayload<K>) => void | Promise<void>)(event);
      } catch (err) {
        console.error(
          `[PluginRegistry] Plugin "${plugin.id}" threw in hook "${hook}":`,
          err
        );
      }
    }
  }
}

// ----------------------------------------------------------------
// Singleton export
// ----------------------------------------------------------------

export const pluginRegistry = new PluginRegistry();
