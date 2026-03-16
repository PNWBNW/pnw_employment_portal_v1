"use client";

import { useEffect, useState } from "react";

/**
 * DeepRoots — extends the bottom root portion of the hero image
 * through the entire page below the hero, creating the illusion
 * that the merkle tree roots go infinitely deep.
 *
 * Uses the bottom ~15% of the hero image, darkened and repeated/stretched
 * vertically so the root tendrils appear to continue into the dark soil
 * beneath every section.
 */

export function DeepRoots() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 1, top: "100vh" }}
    >
      {/* The root image strip — bottom portion of the hero, stretched tall */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/images/pnw-hero.png')",
          backgroundPosition: "center bottom",
          backgroundSize: "100% auto",
          backgroundRepeat: "repeat-y",
          opacity: 0.15,
          filter: "brightness(0.6) saturate(1.4)",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.05) 100%)",
          WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.05) 100%)",
        }}
      />

      {/* Subtle cyan glow lines following the root positions */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="rootFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pnw-cyan-400)" stopOpacity="0.25" />
            <stop offset="30%" stopColor="var(--pnw-cyan-400)" stopOpacity="0.1" />
            <stop offset="70%" stopColor="var(--pnw-cyan-400)" stopOpacity="0.04" />
            <stop offset="100%" stopColor="var(--pnw-cyan-400)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Root lines matching the tree root positions in the hero image */}
        {/* P roots */}
        <line x1="12" y1="0" x2="8" y2="100" stroke="url(#rootFade)" strokeWidth="0.3" />
        <line x1="18" y1="0" x2="14" y2="100" stroke="url(#rootFade)" strokeWidth="0.4" />
        <line x1="6" y1="0" x2="3" y2="100" stroke="url(#rootFade)" strokeWidth="0.2" />

        {/* N roots */}
        <line x1="40" y1="0" x2="37" y2="100" stroke="url(#rootFade)" strokeWidth="0.3" />
        <line x1="45" y1="0" x2="43" y2="100" stroke="url(#rootFade)" strokeWidth="0.4" />
        <line x1="55" y1="0" x2="57" y2="100" stroke="url(#rootFade)" strokeWidth="0.4" />
        <line x1="60" y1="0" x2="63" y2="100" stroke="url(#rootFade)" strokeWidth="0.3" />

        {/* W roots */}
        <line x1="82" y1="0" x2="86" y2="100" stroke="url(#rootFade)" strokeWidth="0.4" />
        <line x1="88" y1="0" x2="92" y2="100" stroke="url(#rootFade)" strokeWidth="0.3" />
        <line x1="94" y1="0" x2="97" y2="100" stroke="url(#rootFade)" strokeWidth="0.2" />
      </svg>
    </div>
  );
}
