"use client";

import { useEffect, useState } from "react";

/**
 * Subtle animated constellation dots in the sky region of the hero.
 * Matches the network/node pattern visible in the hero image's upper sky.
 */

interface Star {
  id: number;
  cx: number;
  cy: number;
  r: number;
  delay: number;
  duration: number;
}

export function ConstellationOverlay() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    setStars(
      Array.from({ length: 15 }, (_, i) => ({
        id: i,
        cx: 10 + Math.random() * 80,
        cy: 3 + Math.random() * 20,
        r: 0.8 + Math.random() * 1.2,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 3,
      }))
    );
  }, []);

  if (stars.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[4]"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {stars.map((star) => (
        <circle
          key={star.id}
          cx={star.cx}
          cy={star.cy}
          r={star.r}
          fill="rgba(255,255,255,0.6)"
          style={{
            animation: `constellation ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
      {/* Connect some stars with faint lines */}
      {stars.slice(0, 8).map((star, i) => {
        const next = stars[(i + 3) % stars.length]!;
        return (
          <line
            key={`line-${star.id}`}
            x1={star.cx}
            y1={star.cy}
            x2={next.cx}
            y2={next.cy}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="0.15"
            style={{
              animation: `constellation ${star.duration + 1}s ease-in-out ${star.delay + 0.5}s infinite`,
            }}
          />
        );
      })}
    </svg>
  );
}
