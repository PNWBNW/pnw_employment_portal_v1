"use client";

import { KeyManagerProvider } from "@/components/key-manager/KeyManagerProvider";
import { AleoWalletProviderWrapper } from "@/src/lib/wallet/wallet-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AleoWalletProviderWrapper>
      <KeyManagerProvider>{children}</KeyManagerProvider>
    </AleoWalletProviderWrapper>
  );
}
