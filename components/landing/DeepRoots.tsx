"use client";

import { useEffect, useRef, useState } from "react";

/**
 * DeepRoots — continuous root/code streams that extend from the hero image's
 * tree roots all the way through the entire page to the footer.
 *
 * These are positioned at the same X% as the tree roots in the hero image:
 *   P tree:  ~12%, ~18%, ~8%
 *   N tree (left trunk):  ~40%, ~44%
 *   N tree (right trunk): ~56%, ~58%
 *   W tree:  ~82%, ~88%, ~92%
 *
 * Each root stream is a vertical column of flowing code/hex that gets thinner
 * and more transparent as it goes deeper — like roots tapering into soil.
 */

interface RootStream {
  id: string;
  /** X position as percentage */
  x: number;
  /** Width of the stream in px */
  width: number;
  /** Base opacity */
  opacity: number;
  /** Animation duration */
  duration: number;
  /** Animation delay */
  delay: number;
  /** How far down the page the root extends (0-1, 1 = full page) */
  reach: number;
  /** Code snippets for this stream */
  code: string[];
}

const ROOT_STREAMS: RootStream[] = [
  // P tree roots — left side
  { id: "p1", x: 10, width: 2, opacity: 0.12, duration: 8, delay: 0, reach: 0.9,
    code: ["0x7f", "hash", "01", "10", "0b", "leaf", "11", "00", "0x"] },
  { id: "p2", x: 16, width: 3, opacity: 0.18, duration: 10, delay: 1.5, reach: 1,
    code: ["root", "0xa1", "h()", "01", "10", "nonce", "0xbe", "11", "00", "merkle"] },
  { id: "p3", x: 6, width: 1.5, opacity: 0.08, duration: 12, delay: 3, reach: 0.7,
    code: ["01", "10", "0x", "11", "00", "01", "10"] },

  // N tree roots — center-left
  { id: "n1", x: 39, width: 2, opacity: 0.14, duration: 9, delay: 0.8, reach: 0.95,
    code: ["sha", "0xc0", "10", "01", "proof", "11", "0x", "00", "field"] },
  { id: "n2", x: 44, width: 2.5, opacity: 0.16, duration: 11, delay: 2, reach: 1,
    code: ["verify", "0xde", "01", "h()", "10", "00", "commit", "11", "0xa1"] },

  // N tree roots — center-right
  { id: "n3", x: 56, width: 2.5, opacity: 0.16, duration: 10, delay: 1, reach: 1,
    code: ["0xbe", "root", "01", "10", "hash", "00", "11", "leaf", "0x7f"] },
  { id: "n4", x: 60, width: 2, opacity: 0.12, duration: 12, delay: 2.5, reach: 0.85,
    code: ["10", "01", "0x", "nonce", "11", "00", "01"] },

  // W tree roots — right side
  { id: "w1", x: 82, width: 3, opacity: 0.18, duration: 9, delay: 0.5, reach: 1,
    code: ["merkle", "0xa1", "01", "h()", "10", "00", "root", "11", "0xc0"] },
  { id: "w2", x: 88, width: 2, opacity: 0.14, duration: 11, delay: 1.8, reach: 0.95,
    code: ["field", "0x", "01", "10", "proof", "11", "00", "sha"] },
  { id: "w3", x: 94, width: 1.5, opacity: 0.08, duration: 13, delay: 3.5, reach: 0.7,
    code: ["01", "10", "0x", "00", "11", "01", "10"] },
];

/** A single root stream that flows code downward */
function StreamColumn({ stream }: { stream: RootStream }) {
  return (
    <div
      className="absolute top-0 font-mono pointer-events-none"
      style={{
        left: `${stream.x}%`,
        width: `${stream.width}px`,
        height: `${stream.reach * 100}%`,
      }}
    >
      {/* The faint static root line — always visible */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            var(--pnw-cyan-400) 0%,
            var(--pnw-cyan-400) 30%,
            rgba(0,229,255,0.5) 70%,
            transparent 100%)`,
          opacity: stream.opacity * 0.5,
        }}
      />

      {/* Animated code fragments flowing downward */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ opacity: stream.opacity }}
      >
        <div
          className="flex flex-col items-center gap-6"
          style={{
            animation: `deep-root-flow ${stream.duration}s linear ${stream.delay}s infinite`,
          }}
        >
          {/* Duplicate the code array for seamless loop */}
          {[...stream.code, ...stream.code, ...stream.code].map((snippet, i) => (
            <span
              key={i}
              className="text-[8px] whitespace-nowrap writing-vertical"
              style={{
                color: "var(--pnw-cyan-400)",
                textShadow: "0 0 4px var(--pnw-cyan-400)",
                writingMode: "vertical-lr",
                letterSpacing: "2px",
                opacity: 0.7 + Math.sin(i * 0.8) * 0.3,
              }}
            >
              {snippet}
            </span>
          ))}
        </div>
      </div>

      {/* Periodic bright pulse traveling down the root */}
      <div
        className="absolute left-0 right-0"
        style={{
          width: `${stream.width + 4}px`,
          height: "30px",
          marginLeft: "-2px",
          background: `radial-gradient(ellipse, var(--pnw-cyan-400) 0%, transparent 70%)`,
          opacity: 0.4,
          animation: `deep-root-pulse ${stream.duration * 0.7}s ease-in-out ${stream.delay}s infinite`,
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}

export function DeepRoots() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 2 }}
    >
      {ROOT_STREAMS.map((stream) => (
        <StreamColumn key={stream.id} stream={stream} />
      ))}
    </div>
  );
}
