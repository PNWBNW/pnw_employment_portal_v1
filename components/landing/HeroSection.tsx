"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { WalletMultiButton } from "@provablehq/aleo-wallet-adaptor-react-ui";
import { TreeSwayOverlay } from "./TreeSwayOverlay";
import { PortalDoors } from "./PortalDoors";
import { ConstellationOverlay } from "./ConstellationOverlay";

interface HeroSectionProps {
  onEmployerClick: () => void;
  onWorkerClick: () => void;
}

export function HeroSection({
  onEmployerClick,
  onWorkerClick,
}: HeroSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Fade the hero overlays as user scrolls away
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <div ref={containerRef} className="relative h-screen w-full">
      {/* Overlays positioned over the top portion of the background image */}
      <motion.div className="absolute inset-0" style={{ opacity: heroOpacity }}>
        {/* Constellation dots in sky */}
        <ConstellationOverlay />

        {/* Tree wind sway */}
        <TreeSwayOverlay />

        {/* Interactive doors — positioned over the painted doors */}
        <PortalDoors
          onEmployerClick={onEmployerClick}
          onWorkerClick={onWorkerClick}
        />
      </motion.div>

      {/* Top-right wallet button — away from the doors */}
      <motion.div
        className="absolute top-4 right-4 z-40"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.8 }}
      >
        <WalletMultiButton />
      </motion.div>

      {/* Bottom section — tagline */}
      <motion.div
        className="absolute bottom-12 left-0 right-0 z-30 text-center"
        style={{ opacity: heroOpacity }}
      >
        <motion.p
          className="text-sm sm:text-base font-light tracking-[0.2em] uppercase"
          style={{ color: "rgba(255,255,255,0.7)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          Privacy-First Payroll on Aleo
        </motion.p>
        <motion.div
          className="mt-4 mx-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5, duration: 1 }}
        >
          <div className="flex flex-col items-center gap-1 text-white/40">
            <span className="text-xs">Scroll to explore</span>
            <motion.svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <path
                d="M10 4 L10 14 M6 10 L10 14 L14 10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </motion.svg>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
