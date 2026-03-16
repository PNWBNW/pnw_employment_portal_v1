"use client";

import { useEffect, useState } from "react";

/**
 * Animated root pulse effect that follows the actual tree root paths
 * in the hero image. The PNW hero has three main tree-letter structures:
 *   P (left ~5-25%), N (center ~38-62%), W (right ~75-95%)
 * Roots extend from the base of each letter downward.
 *
 * Cyan light pulses flow DOWN the roots like data through a merkle tree.
 * Binary/hex snippets appear embedded in the roots, not floating randomly.
 */

interface RootPath {
  id: string;
  /** SVG path that follows a root curve */
  d: string;
  /** Stroke width */
  width: number;
  /** Animation delay */
  delay: number;
  /** Animation duration */
  duration: number;
  /** Opacity range */
  maxOpacity: number;
}

/** Root paths traced along the visible roots in the hero image */
const ROOT_PATHS: RootPath[] = [
  // === P tree roots (left) ===
  { id: "p1", d: "M18,72 Q16,78 12,84 Q8,90 5,98", width: 2.5, delay: 0, duration: 2.8, maxOpacity: 0.6 },
  { id: "p2", d: "M20,72 Q22,80 18,88 Q14,94 10,100", width: 2, delay: 1.2, duration: 3.2, maxOpacity: 0.5 },
  { id: "p3", d: "M15,74 Q10,82 6,90 Q3,96 2,100", width: 1.5, delay: 2.4, duration: 2.5, maxOpacity: 0.4 },

  // === N tree roots (center-left trunk) ===
  { id: "n1", d: "M42,75 Q40,82 38,90 Q36,96 34,100", width: 2, delay: 0.5, duration: 3, maxOpacity: 0.5 },
  { id: "n2", d: "M44,74 Q46,82 44,90 Q42,96 40,100", width: 2.5, delay: 1.8, duration: 2.6, maxOpacity: 0.6 },

  // === N tree roots (center-right trunk) ===
  { id: "n3", d: "M56,75 Q58,82 60,90 Q62,96 64,100", width: 2, delay: 0.8, duration: 3.1, maxOpacity: 0.5 },
  { id: "n4", d: "M54,74 Q52,82 54,90 Q56,96 58,100", width: 1.5, delay: 2, duration: 2.8, maxOpacity: 0.4 },

  // === W tree roots (right) ===
  { id: "w1", d: "M80,72 Q78,80 82,88 Q86,94 90,100", width: 2.5, delay: 0.3, duration: 2.9, maxOpacity: 0.6 },
  { id: "w2", d: "M82,72 Q84,80 86,88 Q90,94 94,100", width: 2, delay: 1.5, duration: 3.3, maxOpacity: 0.5 },
  { id: "w3", d: "M85,74 Q88,82 92,90 Q96,96 98,100", width: 1.5, delay: 2.2, duration: 2.7, maxOpacity: 0.4 },
];

/** Code-like snippets that appear embedded along root paths */
interface CodeFragment {
  id: number;
  x: number;
  y: number;
  text: string;
  delay: number;
  duration: number;
  fontSize: number;
}

function generateCodeFragments(): CodeFragment[] {
  const snippets = [
    "0x7f3a", "hash()", "0b1101", "verify", "0xc0de",
    "root[]", "h(leaf)", "0xa1e0", "commit", "merkle",
    "sha256", "0xbeef", "nonce", "proof", "field",
  ];

  // Position fragments along the root zones
  const positions = [
    // P roots
    { x: 12, y: 80 }, { x: 8, y: 88 }, { x: 16, y: 92 },
    // N roots
    { x: 40, y: 82 }, { x: 52, y: 84 }, { x: 44, y: 92 }, { x: 58, y: 90 },
    // W roots
    { x: 84, y: 80 }, { x: 90, y: 88 }, { x: 86, y: 94 },
  ];

  return positions.map((pos, i) => ({
    id: i,
    x: pos.x + (Math.random() - 0.5) * 3,
    y: pos.y + (Math.random() - 0.5) * 2,
    text: snippets[i % snippets.length]!,
    delay: i * 0.8 + Math.random() * 2,
    duration: 3 + Math.random() * 2,
    fontSize: 7 + Math.random() * 3,
  }));
}

export function RootPulse() {
  const [fragments, setFragments] = useState<CodeFragment[]>([]);

  useEffect(() => {
    setFragments(generateCodeFragments());
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-[6]">
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradient for the flowing pulse */}
          <linearGradient id="pulseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pnw-cyan-400)" stopOpacity="0" />
            <stop offset="30%" stopColor="var(--pnw-cyan-400)" stopOpacity="0.8" />
            <stop offset="70%" stopColor="var(--pnw-cyan-400)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--pnw-cyan-400)" stopOpacity="0" />
          </linearGradient>

          {/* Glow filter */}
          <filter id="rootGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Static faint root lines (always visible) */}
        {ROOT_PATHS.map((root) => (
          <path
            key={`static-${root.id}`}
            d={root.d}
            fill="none"
            stroke="var(--pnw-cyan-400)"
            strokeWidth={root.width * 0.4}
            strokeLinecap="round"
            opacity={0.08}
          />
        ))}

        {/* Animated pulse flowing down each root path */}
        {ROOT_PATHS.map((root) => (
          <g key={`pulse-${root.id}`} filter="url(#rootGlow)">
            <path
              d={root.d}
              fill="none"
              stroke="var(--pnw-cyan-400)"
              strokeWidth={root.width}
              strokeLinecap="round"
              strokeDasharray="4 20"
              opacity={root.maxOpacity}
            >
              <animate
                attributeName="stroke-dashoffset"
                from="24"
                to="0"
                dur={`${root.duration}s`}
                begin={`${root.delay}s`}
                repeatCount="indefinite"
              />
              <animate
                attributeName="opacity"
                values={`0;${root.maxOpacity};${root.maxOpacity};0`}
                dur={`${root.duration}s`}
                begin={`${root.delay}s`}
                repeatCount="indefinite"
              />
            </path>
          </g>
        ))}

        {/* Code fragments along roots */}
        {fragments.map((frag) => (
          <text
            key={frag.id}
            x={frag.x}
            y={frag.y}
            fill="var(--pnw-cyan-400)"
            fontSize={frag.fontSize * 0.12}
            fontFamily="monospace"
            opacity="0"
          >
            {frag.text}
            <animate
              attributeName="opacity"
              values="0;0.25;0.25;0"
              dur={`${frag.duration}s`}
              begin={`${frag.delay}s`}
              repeatCount="indefinite"
            />
          </text>
        ))}
      </svg>
    </div>
  );
}
