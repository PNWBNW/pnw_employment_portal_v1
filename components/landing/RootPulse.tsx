"use client";

import { useEffect, useState } from "react";

/**
 * Animated root pulse effect for the lower portion of the hero.
 * Creates sequential downward-flowing cyan light pulses
 * along the tree root paths — like data flowing into the system.
 */

interface PulseStream {
  id: number;
  x: number;
  width: number;
  delay: number;
  duration: number;
  opacity: number;
}

function generateStreams(count: number): PulseStream[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 15 + (i / count) * 70 + (Math.random() - 0.5) * 8,
    width: 1 + Math.random() * 2,
    delay: Math.random() * 4,
    duration: 2 + Math.random() * 3,
    opacity: 0.3 + Math.random() * 0.5,
  }));
}

export function RootPulse() {
  const [streams, setStreams] = useState<PulseStream[]>([]);

  useEffect(() => {
    setStreams(generateStreams(18));
  }, []);

  if (streams.length === 0) return null;

  return (
    <div
      className="absolute bottom-0 left-0 right-0 pointer-events-none z-[6]"
      style={{ height: "45%", overflow: "hidden" }}
    >
      {/* Gradient overlay to darken the root zone */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(3,8,16,0.3) 30%, rgba(3,8,16,0.6) 100%)",
        }}
      />

      {/* Pulse streams */}
      {streams.map((stream) => (
        <div
          key={stream.id}
          className="absolute"
          style={{
            left: `${stream.x}%`,
            top: 0,
            width: `${stream.width}px`,
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "-30%",
              left: 0,
              width: "100%",
              height: "30%",
              background: `linear-gradient(180deg, transparent 0%, var(--pnw-cyan-400) 40%, var(--pnw-cyan-400) 60%, transparent 100%)`,
              opacity: stream.opacity,
              animation: `pulse-down ${stream.duration}s linear ${stream.delay}s infinite`,
              filter: `blur(${stream.width > 2 ? 1 : 0}px)`,
              boxShadow: `0 0 ${4 + stream.width * 2}px var(--pnw-cyan-400)`,
            }}
          />
        </div>
      ))}

      {/* Binary characters floating down */}
      <BinaryRain />
    </div>
  );
}

function BinaryRain() {
  const [columns, setColumns] = useState<
    { id: number; x: number; chars: string[]; delay: number; speed: number }[]
  >([]);

  useEffect(() => {
    const cols = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: 10 + (i / 12) * 80 + (Math.random() - 0.5) * 5,
      chars: Array.from({ length: 8 }, () =>
        Math.random() > 0.5 ? "1" : "0"
      ),
      delay: Math.random() * 6,
      speed: 4 + Math.random() * 4,
    }));
    setColumns(cols);
  }, []);

  if (columns.length === 0) return null;

  return (
    <>
      {columns.map((col) => (
        <div
          key={col.id}
          className="absolute font-mono text-[10px] leading-tight"
          style={{
            left: `${col.x}%`,
            top: 0,
            color: "var(--pnw-cyan-400)",
            opacity: 0.15,
            animation: `binary-rain ${col.speed}s linear ${col.delay}s infinite`,
            textShadow: "0 0 4px var(--pnw-cyan-400)",
          }}
        >
          {col.chars.map((ch, j) => (
            <div key={j}>{ch}</div>
          ))}
        </div>
      ))}
    </>
  );
}
