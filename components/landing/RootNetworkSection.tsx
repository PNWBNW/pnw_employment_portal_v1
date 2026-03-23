"use client";

import { useEffect, useRef, useState, useMemo } from "react";

/**
 * RootNetworkSection — the "underground" visual bridge between
 * CinematicSections and FooterCTA.
 *
 * Renders:
 * 1. Binary/glyph rain columns falling through the root zone
 * 2. Glowing cyan root tendrils branching from center
 * 3. Floating proof-fragment words that drift downward
 *
 * Uses existing CSS keyframes: root-pulse, deep-root-pulse, binary-rain.
 * All animation respects prefers-reduced-motion via CSS.
 */

const GLYPHS =
  "01アイウエオカキクサシスセソタチツテトナニヌネハヒフヘマミムメモヤユヨラリルレロワン∅∑∏∫≡≈∂λΣΩ";

const PROOF_WORDS = [
  "verify()",
  "proof",
  "hash",
  "0x7f3a",
  "snark",
  "nullifier",
  "commit",
  "valid",
  "field",
  "aleo1…",
  "settle",
  "encrypt",
  "finalize",
  "record",
  "decrypt",
  "zk_proof",
  "282bytes",
  "∅→✓",
];

/* ─── Rain Column ─── */
function RainColumn({
  x,
  speed,
  startDelay,
  chars,
  isWord,
}: {
  x: number;
  speed: number;
  startDelay: number;
  chars: string;
  isWord: boolean;
}) {
  const [offset, setOffset] = useState(-30);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const d = setTimeout(() => {
      function anim(ts: number) {
        if (!startRef.current) startRef.current = ts;
        setOffset(
          (((ts - startRef.current) * speed) / 1000) % 130 - 30,
        );
        frameRef.current = requestAnimationFrame(anim);
      }
      frameRef.current = requestAnimationFrame(anim);
    }, startDelay);
    return () => {
      clearTimeout(d);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [speed, startDelay]);

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${offset}%`,
        fontFamily: "'SF Mono','Fira Code','Consolas',monospace",
        fontSize: isWord ? "9px" : "10px",
        lineHeight: isWord ? undefined : "13px",
        color: "var(--pnw-cyan-400)",
        opacity: isWord ? 0.35 : 0.18,
        whiteSpace: isWord ? "nowrap" : "pre",
        transform: "translateX(-50%)",
        filter: `drop-shadow(0 0 ${isWord ? 4 : 2}px rgba(0,229,255,${isWord ? 0.53 : 0.2}))`,
        pointerEvents: "none",
        zIndex: 3,
        ...(isWord
          ? {}
          : {
              writingMode: "vertical-lr" as const,
              textOrientation: "upright" as const,
              letterSpacing: "-1px",
            }),
      }}
    >
      {chars}
    </div>
  );
}

/* ─── Root Glow Tendrils ─── */
function RootTendrils() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 2 }}
    >
      {/* Central spine */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: "0%",
          width: "5px",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(0,229,255,0) 0%, rgba(0,229,255,0.12) 15%, rgba(0,229,255,0.25) 50%, rgba(0,229,255,0.12) 85%, rgba(0,229,255,0.04) 100%)",
          filter: "blur(6px) drop-shadow(0 0 16px rgba(0,229,255,0.3))",
          animation: "root-pulse 4s ease-in-out infinite",
        }}
      />
      {/* Ambient radial glow */}
      <div
        className="absolute left-1/4 top-1/4 w-1/2 h-1/2"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,229,255,0.06) 0%, transparent 70%)",
          animation: "root-pulse 5.5s ease-in-out infinite",
          animationDelay: "1.2s",
        }}
      />
      {/* Left branch */}
      <div
        className="absolute"
        style={{
          left: "28%",
          top: "10%",
          width: "3px",
          height: "35%",
          transform: "rotate(22deg)",
          transformOrigin: "top center",
          background:
            "linear-gradient(180deg, rgba(0,229,255,0) 0%, rgba(0,229,255,0.1) 40%, rgba(0,229,255,0.04) 100%)",
          filter: "blur(4px) drop-shadow(0 0 8px rgba(0,229,255,0.2))",
          animation: "root-pulse 5.5s ease-in-out infinite",
          animationDelay: "0.8s",
        }}
      />
      {/* Right branch */}
      <div
        className="absolute"
        style={{
          right: "28%",
          top: "10%",
          width: "3px",
          height: "35%",
          transform: "rotate(-20deg)",
          transformOrigin: "top center",
          background:
            "linear-gradient(180deg, rgba(0,229,255,0) 0%, rgba(0,229,255,0.1) 40%, rgba(0,229,255,0.04) 100%)",
          filter: "blur(4px) drop-shadow(0 0 8px rgba(0,229,255,0.2))",
          animation: "root-pulse 6s ease-in-out infinite",
          animationDelay: "1.5s",
        }}
      />
      {/* Far-left tendril */}
      <div
        className="absolute"
        style={{
          left: "15%",
          top: "20%",
          width: "2px",
          height: "28%",
          transform: "rotate(32deg)",
          transformOrigin: "top center",
          background:
            "linear-gradient(180deg, rgba(0,229,255,0) 0%, rgba(0,229,255,0.07) 50%, rgba(0,229,255,0.02) 100%)",
          filter: "blur(3px) drop-shadow(0 0 5px rgba(0,229,255,0.15))",
          animation: "root-pulse 7s ease-in-out infinite",
          animationDelay: "2.2s",
        }}
      />
      {/* Far-right tendril */}
      <div
        className="absolute"
        style={{
          right: "15%",
          top: "20%",
          width: "2px",
          height: "28%",
          transform: "rotate(-30deg)",
          transformOrigin: "top center",
          background:
            "linear-gradient(180deg, rgba(0,229,255,0) 0%, rgba(0,229,255,0.07) 50%, rgba(0,229,255,0.02) 100%)",
          filter: "blur(3px) drop-shadow(0 0 5px rgba(0,229,255,0.15))",
          animation: "root-pulse 6.5s ease-in-out infinite",
          animationDelay: "3s",
        }}
      />
    </div>
  );
}

/* ─── Main Section ─── */
export function RootNetworkSection() {
  const columns = useMemo(() => {
    const cols: {
      x: number;
      speed: number;
      startDelay: number;
      chars: string;
      isWord: boolean;
    }[] = [];

    // Glyph rain columns
    for (let i = 0; i < 40; i++) {
      let ch = "";
      for (let j = 0; j < 8 + Math.floor(Math.random() * 10); j++) {
        ch += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      cols.push({
        x: 3 + (i / 40) * 94 + (Math.random() - 0.5) * 3,
        speed: 10 + Math.random() * 16,
        startDelay: Math.random() * 5000,
        chars: ch,
        isWord: false,
      });
    }

    // Floating proof-word fragments
    for (let i = 0; i < 12; i++) {
      cols.push({
        x: 8 + Math.random() * 84,
        speed: 5 + Math.random() * 8,
        startDelay: Math.random() * 7000,
        chars: PROOF_WORDS[Math.floor(Math.random() * PROOF_WORDS.length)] ?? "proof",
        isWord: true,
      });
    }

    return cols;
  }, []);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: "clamp(200px, 35vh, 380px)",
        background:
          "linear-gradient(180deg, var(--pnw-navy-900) 0%, var(--pnw-navy-950) 50%, var(--pnw-navy-900) 100%)",
      }}
    >
      {/* Rain columns — masked to fade at top/bottom edges */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          maskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 10%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.3) 90%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.3) 10%, rgba(0,0,0,0.7) 30%, rgba(0,0,0,0.7) 70%, rgba(0,0,0,0.3) 90%, transparent 100%)",
          zIndex: 3,
        }}
      >
        {columns.map((col, i) => (
          <RainColumn key={i} {...col} />
        ))}
      </div>

      {/* Root tendrils */}
      <RootTendrils />

      {/* Top/bottom edge fades for seamless blending */}
      <div
        className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, var(--pnw-navy-900), transparent)",
          zIndex: 4,
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{
          background:
            "linear-gradient(0deg, var(--pnw-navy-900), transparent)",
          zIndex: 4,
        }}
      />
    </div>
  );
}
