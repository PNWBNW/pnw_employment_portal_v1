/**
 * Plugin Loader
 *
 * Utilities for loading and initialising plugins at application startup.
 *
 * loadPlugins()  — registers an array of plugin definitions and returns
 *                  a teardown function that unregisters them all.
 *
 * loadPlugin()   — registers a single plugin and returns its teardown.
 *
 * Typical usage in a Next.js root layout (server component):
 *   The actual registration happens inside <PluginProvider initialPlugins={…}>
 *   because registration is a client-side concern (React context, sessionStorage).
 *
 * Typical usage in tests or scripts:
 *   const teardown = await loadPlugins([myPlugin, anotherPlugin]);
 *   // ... do work ...
 *   await teardown();
 */

import { pluginRegistry } from "./registry";
import type { PluginDefinition } from "./types";

// ----------------------------------------------------------------
// loadPlugin
// ----------------------------------------------------------------

/**
 * Register a single plugin.
 * Returns an async teardown function that unregisters the plugin.
 *
 * @throws If a plugin with the same id is already registered.
 */
export async function loadPlugin(
  plugin: PluginDefinition
): Promise<() => Promise<void>> {
  await pluginRegistry.register(plugin);
  return () => pluginRegistry.unregister(plugin.id);
}

// ----------------------------------------------------------------
// loadPlugins
// ----------------------------------------------------------------

/**
 * Register multiple plugins in order.
 * Returns an async teardown function that unregisters them all in
 * reverse registration order (LIFO — mirrors a stack teardown).
 *
 * Plugins that fail to register are skipped (error is logged),
 * so the remaining plugins still load.
 */
export async function loadPlugins(
  plugins: PluginDefinition[]
): Promise<() => Promise<void>> {
  const loaded: string[] = [];

  for (const plugin of plugins) {
    try {
      await pluginRegistry.register(plugin);
      loaded.push(plugin.id);
    } catch (err) {
      console.error(
        `[loadPlugins] Failed to load plugin "${plugin.id}":`,
        err
      );
    }
  }

  return async () => {
    // Unregister in reverse order.
    for (const id of [...loaded].reverse()) {
      await pluginRegistry.unregister(id);
    }
  };
}

// ----------------------------------------------------------------
// isPluginLoaded
// ----------------------------------------------------------------

/** Returns true if a plugin with the given id is currently registered. */
export function isPluginLoaded(id: string): boolean {
  return pluginRegistry.has(id);
}
