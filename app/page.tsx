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
    <div
      className="relative hide-scrollbar"
      style={{ background: "var(--pnw-navy-950)" }}
    >
      {/* Background: the tall pnw-tree.png at full width, natural height.
          Positioned at top, scrolls with the page. Fades to dark at bottom. */}
      <div className="absolute top-0 left-0 right-0 z-0">
        <img
          src="/images/pnw-tree.png"
          alt=""
          className="w-full h-auto block"
          draggable={false}
          style={{
            maskImage:
              "linear-gradient(180deg, black 0%, black 70%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.2) 95%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, black 0%, black 70%, rgba(0,0,0,0.6) 85%, rgba(0,0,0,0.2) 95%, transparent 100%)",
          }}
        />
      </div>

      {/* All content layers on top */}
      <div className="relative z-10">
        <HeroSection
          onEmployerClick={() => handlePortalClick("employer")}
          onWorkerClick={() => handlePortalClick("worker")}
        />

        <CinematicSections />

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
