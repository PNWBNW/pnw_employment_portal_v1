"use client";

/**
 * Plugin Context
 *
 * React context that exposes the plugin registry to components.
 * Wrap your app (or employer layout) with <PluginProvider> to make
 * the registry available via usePlugins().
 *
 * The provider also accepts an `initialPlugins` prop for registering
 * plugins at startup without a separate boot step.
 *
 * Example:
 *   // app/layout.tsx
 *   import { PluginProvider } from "@/plugins/context";
 *   import { consoleLoggerPlugin } from "@/plugins/built-in/console-logger";
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <PluginProvider initialPlugins={[consoleLoggerPlugin]}>
 *         {children}
 *       </PluginProvider>
 *     );
 *   }
 *
 *   // Inside any component:
 *   import { usePlugins } from "@/plugins/context";
 *
 *   const { registry, plugins } = usePlugins();
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { pluginRegistry } from "./registry";
import type { PluginDefinition } from "./types";

// ----------------------------------------------------------------
// Context value shape
// ----------------------------------------------------------------

type PluginContextValue = {
  /** The shared registry singleton. */
  registry: typeof pluginRegistry;
  /** Snapshot of currently registered plugins (reactive). */
  plugins: PluginDefinition[];
  /**
   * Imperatively register a plugin from a component.
   * Automatically unregisters on unmount if `autoCleanup` is true (default).
   */
  register: (plugin: PluginDefinition, autoCleanup?: boolean) => Promise<void>;
  /** Imperatively unregister a plugin by id. */
  unregister: (id: string) => Promise<void>;
};

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------

const PluginContext = createContext<PluginContextValue | null>(null);

// ----------------------------------------------------------------
// Provider
// ----------------------------------------------------------------

type PluginProviderProps = {
  children: React.ReactNode;
  /**
   * Plugins to register at mount time.
   * They are unregistered automatically on unmount.
   */
  initialPlugins?: PluginDefinition[];
};

export function PluginProvider({
  children,
  initialPlugins = [],
}: PluginProviderProps) {
  const [plugins, setPlugins] = useState<PluginDefinition[]>(
    pluginRegistry.list()
  );

  // Track plugin ids registered by this provider for cleanup.
  const ownedIds = useRef<Set<string>>(new Set());

  // Monotonic version counter — bumped on each unmount so a stale boot()
  // from a previous React Strict Mode cycle knows to bail out.
  const versionRef = useRef(0);

  // Promise that resolves once the previous teardown finishes.  The next
  // boot() awaits this so it never races with in-flight onUninstall() calls.
  const teardownRef = useRef<Promise<void>>(Promise.resolve());

  // Refresh the snapshot whenever the registry changes.
  function refresh() {
    setPlugins(pluginRegistry.list());
  }

  // Register initial plugins on mount.
  useEffect(() => {
    const mountVersion = ++versionRef.current;

    async function boot() {
      // Wait for any prior teardown to finish before re-registering.
      await teardownRef.current;

      for (const plugin of initialPlugins) {
        // Bail if a newer mount has already superseded us.
        if (versionRef.current !== mountVersion) return;
        if (!pluginRegistry.has(plugin.id)) {
          await pluginRegistry.register(plugin);
          ownedIds.current.add(plugin.id);
        }
      }
      if (versionRef.current === mountVersion) refresh();
    }

    void boot();

    return () => {
      // Bump version so the in-flight boot() above bails out.
      versionRef.current++;

      // Capture current owned ids and clear immediately so duplicate
      // teardowns (shouldn't happen, but defensive) are no-ops.
      const ids = Array.from(ownedIds.current);
      ownedIds.current.clear();

      // Chain teardown so the next boot() can await it.
      teardownRef.current = (async () => {
        for (const id of ids) {
          await pluginRegistry.unregister(id);
        }
      })();
    };
    // Intentionally empty deps — run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Imperative helpers
  // ----------------------------------------------------------------

  async function register(
    plugin: PluginDefinition,
    autoCleanup = true
  ): Promise<void> {
    await pluginRegistry.register(plugin);
    if (autoCleanup) ownedIds.current.add(plugin.id);
    refresh();
  }

  async function unregister(id: string): Promise<void> {
    await pluginRegistry.unregister(id);
    ownedIds.current.delete(id);
    refresh();
  }

  return (
    <PluginContext.Provider
      value={{ registry: pluginRegistry, plugins, register, unregister }}
    >
      {children}
    </PluginContext.Provider>
  );
}

// ----------------------------------------------------------------
// Hook
// ----------------------------------------------------------------

/**
 * Access the plugin registry and the reactive list of installed plugins.
 * Must be used inside <PluginProvider>.
 */
export function usePlugins(): PluginContextValue {
  const ctx = useContext(PluginContext);
  if (!ctx) {
    throw new Error("usePlugins() must be called inside <PluginProvider>.");
  }
  return ctx;
}
