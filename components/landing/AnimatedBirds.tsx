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
  waveAmplitude: number;
}

function generateBirds(count: number): Bird[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    startX: i % 2 === 0 ? -3 : 103,
    startY: 8 + Math.random() * 15,
    size: 8 + Math.random() * 6,
    duration: 22 + Math.random() * 16,
    delay: i * 4 + Math.random() * 6,
    direction: (i % 2 === 0 ? "ltr" : "rtl") as "ltr" | "rtl",
    flapSpeed: 0.5 + Math.random() * 0.3,
    waveAmplitude: 2 + Math.random() * 3,
  }));
}

export function AnimatedBirds() {
  const [birds, setBirds] = useState<Bird[]>([]);

  useEffect(() => {
    setBirds(generateBirds(4));
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
            height: bird.size * 0.5,
            animation: `${bird.direction === "ltr" ? "bird-fly-1" : "bird-fly-2"} ${bird.duration}s linear ${bird.delay}s infinite`,
            opacity: 0.55,
          }}
          viewBox="0 0 30 14"
          fill="none"
        >
          {/* Graceful V-shaped bird silhouette with smooth wing flap */}
          <path
            d="M0,7 Q3,2 7,5 Q10,6.5 15,7 Q20,6.5 23,5 Q27,2 30,7"
            stroke="#3a2e1a"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          >
            <animate
              attributeName="d"
              values="M0,7 Q3,2 7,5 Q10,6.5 15,7 Q20,6.5 23,5 Q27,2 30,7;M0,7 Q3,10 7,8 Q10,7.2 15,7 Q20,7.2 23,8 Q27,10 30,7;M0,7 Q3,2 7,5 Q10,6.5 15,7 Q20,6.5 23,5 Q27,2 30,7"
              dur={`${bird.flapSpeed}s`}
              repeatCount="indefinite"
            />
          </path>
        </svg>
      ))}
    </div>
  );
}
