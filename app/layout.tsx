import type { Metadata } from "next";
import { KeyManagerProvider } from "@/components/key-manager/KeyManagerProvider";
import { AleoWalletProviderWrapper } from "@/src/lib/wallet/wallet-provider";
import { PluginProvider } from "@/src/plugins/context";
import { auditTrailPlugin } from "@/src/plugins/built-in/audit-trail";
import { consoleLoggerPlugin } from "@/src/plugins/built-in/console-logger";
import "./globals.css";

export const metadata: Metadata = {
  title: "PNW Employment Portal",
  description:
    "Privacy-first payroll portal for Proven National Workers on Aleo",
};

const defaultPlugins =
  process.env.NODE_ENV === "development"
    ? [auditTrailPlugin, consoleLoggerPlugin]
    : [auditTrailPlugin];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AleoWalletProviderWrapper>
          <PluginProvider initialPlugins={defaultPlugins}>
            <KeyManagerProvider>{children}</KeyManagerProvider>
          </PluginProvider>
        </AleoWalletProviderWrapper>
      </body>
    </html>
  );
}
