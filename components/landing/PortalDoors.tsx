"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DoorProps {
  side: "employer" | "worker";
  onClick: () => void;
}

function Door({ side, onClick }: DoorProps) {
  const [hovered, setHovered] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(true);

  // Auto-play the open animation on mount, then close after a beat
  useEffect(() => {
    const timer = setTimeout(() => setIntroPlaying(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  const isEmployer = side === "employer";
  const label = isEmployer ? "Employer Portal" : "Worker Portal";
  const sublabel = isEmployer
    ? "Manage payroll, credentials & compliance"
    : "View paystubs, agreements & documents";

  // Solid door colors matching the painted doors in pnw-tree.png
  const doorColor = isEmployer ? "#2563eb" : "#16a34a";
  const doorColorLight = isEmployer ? "#3b82f6" : "#22c55e";
  const doorColorDark = isEmployer ? "#1d4ed8" : "#15803d";
  const frameColor = isEmployer ? "#1e3a5f" : "#14532d";
  const glowColor = isEmployer
    ? "rgba(37, 99, 235, 0.6)"
    : "rgba(22, 163, 74, 0.6)";
  const lightBright = isEmployer
    ? "rgba(59, 130, 246, 0.8)"
    : "rgba(34, 197, 94, 0.8)";
  const lightMid = isEmployer
    ? "rgba(59, 130, 246, 0.5)"
    : "rgba(34, 197, 94, 0.5)";

  // Door is "open" during intro animation OR hover
  const isOpen = introPlaying || hovered;

  // Employer = left-hand swing (hinges on RIGHT, opens toward left)
  // Worker   = right-hand swing (hinges on LEFT, opens toward right)
  const hingeOrigin = isEmployer ? "right center" : "left center";

  // Intro delay: employer door opens first (0.6s), worker follows (1.0s)
  const introDelay = isEmployer ? 0.6 : 1.0;

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer"
      style={{
        /* Pixel-measured from pnw-tree.png (1024×1536):
           Blue door: 28px wide × 41px tall → 2.73vw × 4.0vw
           Green door: ~20px wide × ~27px tall → 1.95vw × 2.64vw
           Using average + slight padding for clickable area. */
        width: "clamp(24px, 2.8vw, 42px)",
        height: "clamp(38px, 4.2vw, 64px)",
        perspective: "600px",
      }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Door panel — solid colored panel that rotates open in 3D */}
      <motion.div
        className="absolute inset-0"
        style={{
          transformOrigin: hingeOrigin,
          transformStyle: "preserve-3d",
        }}
        initial={{ rotateY: 0 }}
        animate={{
          rotateY: hovered
            ? isEmployer ? -35 : 35
            : introPlaying
              ? isEmployer ? -25 : 25
              : 0,
        }}
        transition={
          hovered
            ? { duration: 0.5, ease: [0.4, 0, 0.2, 1] }
            : introPlaying
              ? { duration: 0.8, delay: introDelay, ease: [0.4, 0, 0.2, 1] }
              : { duration: 0.6, ease: [0.4, 0, 0.2, 1] }
        }
      >
        {/* The actual door face — solid, visible, real door look */}
        <div
          className="absolute inset-0 rounded-[2px]"
          style={{
            background: `linear-gradient(170deg, ${doorColorLight} 0%, ${doorColor} 40%, ${doorColorDark} 100%)`,
            border: `1.5px solid ${frameColor}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 4px rgba(0,0,0,0.2)`,
          }}
        >
          {/* Door panel inset detail */}
          <div
            className="absolute rounded-[1px]"
            style={{
              top: "12%",
              left: "15%",
              right: "15%",
              bottom: "45%",
              border: `1px solid rgba(255,255,255,0.12)`,
              borderBottom: `1px solid rgba(0,0,0,0.15)`,
            }}
          />
          <div
            className="absolute rounded-[1px]"
            style={{
              top: "60%",
              left: "15%",
              right: "15%",
              bottom: "10%",
              border: `1px solid rgba(255,255,255,0.12)`,
              borderBottom: `1px solid rgba(0,0,0,0.15)`,
            }}
          />
          {/* Door handle — small dot on the latch side */}
          <div
            className="absolute rounded-full"
            style={{
              width: "3px",
              height: "3px",
              top: "50%",
              [isEmployer ? "left" : "right"]: "14%",
              transform: "translateY(-50%)",
              background: "rgba(255,255,255,0.5)",
              boxShadow: "0 0 2px rgba(255,255,255,0.3)",
            }}
          />
        </div>
      </motion.div>

      {/* Light pouring from behind the opened door */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={
              introPlaying
                ? { duration: 0.6, delay: introDelay + 0.2 }
                : { duration: 0.4, delay: 0.1 }
            }
            className="absolute inset-0 pointer-events-none overflow-visible"
          >
            {/* Bright vertical gap light on the opening edge */}
            <div
              className="absolute top-[3%] bottom-[3%]"
              style={{
                [isEmployer ? "right" : "left"]: "-2px",
                width: "3px",
                background: `linear-gradient(180deg, transparent 0%, ${lightBright} 20%, rgba(255,255,255,0.9) 50%, ${lightBright} 80%, transparent 100%)`,
                boxShadow: `0 0 8px ${lightMid}, 0 0 16px ${glowColor}`,
                borderRadius: "2px",
              }}
            />

            {/* Interior warm glow behind the door */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at ${isEmployer ? "85%" : "15%"} 50%, rgba(255,240,200,0.4) 0%, rgba(255,220,150,0.15) 40%, transparent 70%)`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Idle state: subtle glow outline to show interactivity */}
      {!hovered && !introPlaying && (
        <motion.div
          className="absolute pointer-events-none rounded-[2px]"
          style={{
            inset: "-2px",
            boxShadow: `0 0 8px ${glowColor}, 0 0 16px ${glowColor}`,
            border: `1px solid ${doorColor}`,
            opacity: 0,
          }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Hover glow intensifies */}
      {hovered && (
        <div
          className="absolute pointer-events-none rounded-[2px]"
          style={{
            inset: "-3px",
            boxShadow: `0 0 12px ${glowColor}, 0 0 24px ${glowColor}, 0 0 40px ${glowColor}`,
            border: `1px solid ${doorColorLight}`,
          }}
        />
      )}

      {/* Tooltip bubble */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap"
            style={{ bottom: "calc(100% + 14px)" }}
          >
            <div
              className="px-4 py-2.5 rounded-xl text-center"
              style={{
                background: "rgba(10, 22, 40, 0.95)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${doorColor}`,
                boxShadow: `0 0 20px ${glowColor}, 0 8px 32px rgba(0,0,0,0.6)`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color: doorColorLight }}>
                {label}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">{sublabel}</p>
            </div>
            <div
              className="mx-auto w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `6px solid ${doorColor}`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent label above door */}
      <AnimatePresence>
        {!introPlaying && !hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="absolute left-1/2 -translate-x-1/2 z-30 whitespace-nowrap"
            style={{ bottom: "calc(100% + 6px)" }}
          >
            <span
              className="text-[9px] font-medium tracking-wider uppercase"
              style={{ color: doorColorLight, textShadow: `0 0 8px ${glowColor}` }}
            >
              {isEmployer ? "Employer" : "Worker"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

interface PortalDoorsProps {
  onEmployerClick: () => void;
  onWorkerClick: () => void;
}

export function PortalDoors({
  onEmployerClick,
  onWorkerClick,
}: PortalDoorsProps) {
  return (
    <>
      {/* Positioning measured from pnw-tree.png pixel analysis:
          Image: 1024×1536 → displayed w-full h-auto → height = 150vw.
          Blue door center:  x=48.0%, y=37.6vw (px 492, 385)
          Green door center: x=53.5%, y=38.2vw (px 548, 391)
          Combined center:   x=50.8%, y=37.9vw
          Gap between doors: 3.13vw (32px) */}
      <style jsx>{`
        .portal-doors-container {
          position: absolute;
          z-index: 20;
          display: flex;
          /* Slightly right of 50% — doors in image are at 50.8% horizontal */
          left: 50.8%;
          transform: translate(-50%, -50%);
        }
        /* Mobile portrait (narrow viewports) */
        @media (max-width: 639px) {
          .portal-doors-container {
            top: 37.9vw;
            gap: 3vw;
          }
        }
        /* Tablet */
        @media (min-width: 640px) and (max-width: 1023px) {
          .portal-doors-container {
            top: 37.9vw;
            gap: 3vw;
          }
        }
        /* Desktop — no vh cap; doors must track the image position exactly */
        @media (min-width: 1024px) {
          .portal-doors-container {
            top: 37.9vw;
            gap: 3vw;
          }
        }
      `}</style>
      <div className="portal-doors-container">
        <Door side="employer" onClick={onEmployerClick} />
        <Door side="worker" onClick={onWorkerClick} />
      </div>
    </>
  );
}
