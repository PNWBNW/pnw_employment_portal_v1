"use client";

import { KeyManagerProvider } from "@/components/key-manager/KeyManagerProvider";
import { AleoWalletProviderWrapper } from "@/src/lib/wallet/wallet-provider";
import { PluginProvider } from "@/src/plugins/context";
import { auditTrailPlugin } from "@/src/plugins/built-in/audit-trail";
import { consoleLoggerPlugin } from "@/src/plugins/built-in/console-logger";

const defaultPlugins =
  process.env.NODE_ENV === "development"
    ? [auditTrailPlugin, consoleLoggerPlugin]
    : [auditTrailPlugin];

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AleoWalletProviderWrapper>
      <PluginProvider initialPlugins={defaultPlugins}>
        <KeyManagerProvider>{children}</KeyManagerProvider>
      </PluginProvider>
    </AleoWalletProviderWrapper>
  );
}
