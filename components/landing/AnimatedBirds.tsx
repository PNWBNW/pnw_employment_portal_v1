"use client";

import { useEffect, useState } from "react";

interface Bird {
  id: number;
  startX: number;
  startY: number;
  size: number;
  duration: number;
  delay: number;
  direction: "ltr" | "rtl";
  flapSpeed: number;
}

function generateBirds(count: number): Bird[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX: i % 2 === 0 ? -5 + Math.random() * 10 : 90 + Math.random() * 10,
    startY: 5 + Math.random() * 25,
    size: 14 + Math.random() * 10,
    duration: 18 + Math.random() * 14,
    delay: Math.random() * 12,
    direction: (i % 2 === 0 ? "ltr" : "rtl") as "ltr" | "rtl",
    flapSpeed: 0.3 + Math.random() * 0.4,
  }));
}

export function AnimatedBirds() {
  const [birds, setBirds] = useState<Bird[]>([]);

  useEffect(() => {
    setBirds(generateBirds(7));
  }, []);

  if (birds.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10">
      {birds.map((bird) => (
        <svg
          key={bird.id}
          className="absolute"
          style={{
            left: `${bird.startX}%`,
            top: `${bird.startY}%`,
            width: bird.size,
            height: bird.size,
            animation: `${bird.direction === "ltr" ? "bird-fly-1" : "bird-fly-2"} ${bird.duration}s linear ${bird.delay}s infinite`,
          }}
          viewBox="0 0 24 12"
          fill="none"
        >
          <path
            d="M0,6 Q4,1 8,5 L12,6 L16,5 Q20,1 24,6"
            stroke="#5a4a2a"
            strokeWidth="1.5"
            fill="none"
            opacity="0.7"
          >
            <animate
              attributeName="d"
              values="M0,6 Q4,1 8,5 L12,6 L16,5 Q20,1 24,6;M0,6 Q4,9 8,7 L12,6 L16,7 Q20,9 24,6;M0,6 Q4,1 8,5 L12,6 L16,5 Q20,1 24,6"
              dur={`${bird.flapSpeed}s`}
              repeatCount="indefinite"
            />
          </path>
        </svg>
      ))}
    </div>
  );
}
