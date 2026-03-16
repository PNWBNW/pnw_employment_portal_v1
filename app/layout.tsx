import type { Metadata } from "next";
import { KeyManagerProvider } from "@/components/key-manager/KeyManagerProvider";
import { AleoWalletProviderWrapper } from "@/src/lib/wallet/wallet-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "PNW Employment Portal",
  description:
    "Privacy-first payroll portal for Proven National Workers on Aleo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <AleoWalletProviderWrapper>
          <KeyManagerProvider>{children}</KeyManagerProvider>
        </AleoWalletProviderWrapper>
      </body>
    </html>
  );
}
