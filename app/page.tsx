"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { EnterKeysModal } from "@/components/key-manager/EnterKeysModal";
import { ConnectWalletModal } from "@/components/key-manager/ConnectWalletModal";
import { HeroSection } from "@/components/landing/HeroSection";
import { CinematicSections } from "@/components/landing/CinematicSections";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { DeepRoots } from "@/components/landing/DeepRoots";

export default function LandingPage() {
  const { isConnected } = useAleoSession();
  const router = useRouter();
  const [showKeys, setShowKeys] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [portalChoice, setPortalChoice] = useState<
    "employer" | "worker" | null
  >(null);

  useEffect(() => {
    if (isConnected && portalChoice === "employer") {
      router.push("/dashboard");
    } else if (isConnected && portalChoice === "worker") {
      router.push("/worker/dashboard");
    } else if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, portalChoice, router]);

  const handlePortalClick = useCallback(
    (portal: "employer" | "worker") => {
      setPortalChoice(portal);
      // Show wallet connect first, with manual key fallback
      setShowWallet(true);
    },
    []
  );

  return (
    <div className="relative hide-scrollbar" style={{ background: "#000" }}>
      {/* Deep root streams — span entire page, behind content */}
      <DeepRoots />

      {/* Hero: full viewport with image, doors, trees, roots */}
      <HeroSection
        onEmployerClick={() => handlePortalClick("employer")}
        onWorkerClick={() => handlePortalClick("worker")}
      />

      {/* Cinematic scroll sections — 6 descriptors */}
      <CinematicSections />

      {/* Final CTA at the deepest root */}
      <FooterCTA
        onEmployerClick={() => handlePortalClick("employer")}
        onWorkerClick={() => handlePortalClick("worker")}
      />

      {/* Auth modals */}
      <ConnectWalletModal
        open={showWallet}
        onClose={() => {
          setShowWallet(false);
          if (!isConnected) setPortalChoice(null);
        }}
      />
      <EnterKeysModal
        open={showKeys}
        onClose={() => {
          setShowKeys(false);
          if (!isConnected) setPortalChoice(null);
        }}
      />
    </div>
  );
}
