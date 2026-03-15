"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { EnterKeysModal } from "@/components/key-manager/EnterKeysModal";
import { ConnectWalletModal } from "@/components/key-manager/ConnectWalletModal";

export default function LandingPage() {
  const { isConnected } = useAleoSession();
  const router = useRouter();
  const [showKeys, setShowKeys] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div className="mx-4 w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            PNW Employment Portal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Privacy-first payroll for Proven National Workers
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => setShowWallet(true)}
            className="w-full rounded-md border border-input bg-card px-4 py-3 text-sm font-medium text-card-foreground hover:bg-accent"
          >
            Connect Wallet
          </button>

          <button
            onClick={() => setShowKeys(true)}
            className="w-full rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Enter Keys Manually
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Keys are stored in session memory only. Closing this tab clears all
          session data.
        </p>
      </div>

      <EnterKeysModal open={showKeys} onClose={() => setShowKeys(false)} />
      <ConnectWalletModal
        open={showWallet}
        onClose={() => setShowWallet(false)}
      />
    </div>
  );
}
