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
  const color = isEmployer ? "var(--pnw-employer)" : "var(--pnw-worker)";
  const glowColor = isEmployer
    ? "var(--pnw-employer-glow)"
    : "var(--pnw-worker-glow)";
  const label = isEmployer ? "Employer Portal" : "Worker Portal";
  const sublabel = isEmployer
    ? "Manage payroll, credentials & compliance"
    : "View paystubs, agreements & documents";

  // Theme-matched light colors instead of generic yellow/gold
  const lightBright = isEmployer
    ? "rgba(37, 99, 235, 0.7)"
    : "rgba(22, 163, 74, 0.7)";
  const lightMid = isEmployer
    ? "rgba(59, 130, 246, 0.5)"
    : "rgba(34, 197, 94, 0.5)";
  const lightDim = isEmployer
    ? "rgba(37, 99, 235, 0.15)"
    : "rgba(22, 163, 74, 0.15)";
  const lightGlow = isEmployer
    ? "rgba(96, 165, 250, 0.9)"
    : "rgba(74, 222, 128, 0.9)";
  const lightGlowSoft = isEmployer
    ? "rgba(59, 130, 246, 0.5)"
    : "rgba(34, 197, 94, 0.5)";

  // Door is "open" during intro animation OR hover
  const isOpen = introPlaying || hovered;

  // Employer = left-hand swing (hinges on LEFT, opens revealing LEFT edge)
  // Worker   = right-hand swing (hinges on RIGHT, opens revealing RIGHT edge)
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
        /* Desktop: vw-based. Mobile: larger fixed minimums for tap targets */
        width: "clamp(60px, 6.5vw, 90px)",
        height: "clamp(85px, 10vw, 140px)",
        perspective: "800px",
      }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Door panel — actually rotates in 3D to look like it's opening */}
      <motion.div
        className="absolute inset-0"
        style={{
          transformOrigin: hingeOrigin,
          transformStyle: "preserve-3d",
        }}
        initial={{ rotateY: 0 }}
        animate={{
          rotateY: hovered
            ? isEmployer ? -25 : 25
            : introPlaying
              ? isEmployer ? -20 : 20
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
        {/* The door face — semi-transparent overlay matching the painted door */}
        <div
          className="absolute inset-0 rounded-t-sm"
          style={{
            background: isOpen
              ? `linear-gradient(180deg, ${lightDim} 0%, ${lightDim.replace("0.15", "0.06")} 100%)`
              : "transparent",
            borderTop: isOpen ? `1px solid ${lightDim}` : "1px solid transparent",
            transition: "all 0.4s",
          }}
        />
      </motion.div>

      {/* Light pouring from behind the opened door — fixed position, doesn't rotate */}
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
            {/* Bright vertical gap light on the HINGE side (where the opening crack is) */}
            <div
              className="absolute top-[5%] bottom-[5%]"
              style={{
                [isEmployer ? "right" : "left"]: "-1px",
                width: "4px",
                background: `linear-gradient(180deg, ${lightDim} 0%, ${lightBright} 20%, ${lightGlow} 50%, ${lightBright} 80%, ${lightDim} 100%)`,
                boxShadow: `0 0 12px ${lightMid}, 0 0 24px ${lightGlowSoft}`,
                borderRadius: "2px",
              }}
            />

            {/* Warm interior glow spreading from the open crack */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at ${isEmployer ? "90%" : "10%"} 50%, ${lightMid.replace("0.5", "0.35")} 0%, ${lightDim} 30%, transparent 65%)`,
              }}
            />

            {/* Ground light pool */}
            <div
              className="absolute left-[-30%] right-[-30%]"
              style={{
                bottom: "-20%",
                height: "35%",
                background: `radial-gradient(ellipse at 50% 0%, ${lightMid.replace("0.5", "0.25")} 0%, transparent 70%)`,
                filter: "blur(6px)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pulsing hint ring — subtle glow around door to draw attention */}
      {!hovered && !introPlaying && (
        <motion.div
          className="absolute inset-0 rounded-sm pointer-events-none"
          style={{
            border: `1px solid ${color}`,
            opacity: 0,
          }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 3,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Tooltip bubble */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap"
            style={{ bottom: "calc(100% + 12px)" }}
          >
            <div
              className="px-4 py-2.5 rounded-xl text-center"
              style={{
                background: "rgba(10, 22, 40, 0.92)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${color}`,
                boxShadow: `0 0 20px ${glowColor}, 0 8px 32px rgba(0,0,0,0.5)`,
              }}
            >
              <p className="text-sm font-semibold" style={{ color }}>
                {label}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">{sublabel}</p>
            </div>
            <div
              className="mx-auto w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `6px solid ${color}`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Click to enter" label that appears after intro finishes */}
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
              style={{ color, textShadow: `0 0 8px ${glowColor}` }}
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
      {/* Responsive positioning via CSS.
          The background image is w-full h-auto, so door Y-position scales with vw.
          On portrait mobile, the image is narrower → painted doors are higher. */}
      <style jsx>{`
        .portal-doors-container {
          position: absolute;
          z-index: 20;
          display: flex;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        /* Mobile portrait (narrow viewports) */
        @media (max-width: 639px) {
          .portal-doors-container {
            top: 42vw;
            gap: 2vw;
          }
        }
        /* Tablet */
        @media (min-width: 640px) and (max-width: 1023px) {
          .portal-doors-container {
            top: 46vw;
            gap: 1vw;
          }
        }
        /* Desktop */
        @media (min-width: 1024px) {
          .portal-doors-container {
            top: min(48vw, 82vh);
            gap: 0.5vw;
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
