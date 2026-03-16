"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { AnimatedBirds } from "./AnimatedBirds";
import { TreeSwayOverlay } from "./TreeSwayOverlay";
import { PortalDoors } from "./PortalDoors";
import { RootPulse } from "./RootPulse";
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

  // Parallax: image moves up slower than scroll
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  // Fade the hero slightly as user scrolls away
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.3]);

  return (
    <div ref={containerRef} className="relative h-screen w-full overflow-hidden">
      {/* Background image with parallax */}
      <motion.div
        className="absolute inset-0 w-full h-[130%]"
        style={{ y: imageY }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/images/pnw-hero.png')",
          }}
        />
      </motion.div>

      {/* Animated overlays — all within the hero viewport */}
      <motion.div className="absolute inset-0" style={{ opacity: heroOpacity }}>
        {/* Constellation dots in sky */}
        <ConstellationOverlay />

        {/* Tree wind sway */}
        <TreeSwayOverlay />

        {/* Flying birds */}
        <AnimatedBirds />

        {/* Root pulse in lower half */}
        <RootPulse />

        {/* Interactive doors */}
        <PortalDoors
          onEmployerClick={onEmployerClick}
          onWorkerClick={onWorkerClick}
        />
      </motion.div>

      {/* Bottom tagline */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 z-30 text-center"
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

      {/* Gradient transition to dark sections below */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 z-20 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, var(--pnw-navy-950) 100%)",
        }}
      />
    </div>
  );
}
