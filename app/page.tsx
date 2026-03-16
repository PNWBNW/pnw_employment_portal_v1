"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { EnterKeysModal } from "@/components/key-manager/EnterKeysModal";
import { ConnectWalletModal } from "@/components/key-manager/ConnectWalletModal";
import { HeroSection } from "@/components/landing/HeroSection";
import { CinematicSections } from "@/components/landing/CinematicSections";
import { FooterCTA } from "@/components/landing/FooterCTA";

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
      setShowWallet(true);
    },
    []
  );

  return (
    <div className="relative hide-scrollbar">
      {/* Single tall background image spanning the entire page.
          Trees at top, roots at bottom — scrolls naturally with content.
          object-fit: contain ensures no side cropping on wide screens. */}
      <div
        className="absolute inset-0 z-0 overflow-hidden"
        style={{ background: "var(--pnw-navy-950)" }}
      >
        <img
          src="/images/pnw-tree.png"
          alt=""
          className="w-full h-full object-contain object-top"
          draggable={false}
        />
      </div>

      {/* All content layers on top of the background */}
      <div className="relative z-10">
        {/* Hero: viewport-height section with doors, constellations */}
        <HeroSection
          onEmployerClick={() => handlePortalClick("employer")}
          onWorkerClick={() => handlePortalClick("worker")}
        />

        {/* Cinematic scroll sections — 6 descriptors over the roots */}
        <CinematicSections />

        {/* Final CTA at the deepest root */}
        <FooterCTA
          onEmployerClick={() => handlePortalClick("employer")}
          onWorkerClick={() => handlePortalClick("worker")}
        />
      </div>

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
