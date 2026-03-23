"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * PortalDoors — Two painted wooden doors positioned over the trunk
 * of the pnw-tree.png hero image. Each door uses SVG with fractalNoise
 * filters to simulate painterly wood grain matching the artwork's palette.
 *
 * Blue door (employer): teal-cyan base sampled from the painting
 * Green door (worker):  warm green base sampled from the painting
 * Both have: dark olive frame, golden threshold, warm interior light
 */

/* ─── SVG Door Art ─── */

function BlueDoorSVG() {
  return (
    <svg viewBox="0 0 34 72" className="w-full h-full block">
      <defs>
        <filter id="bGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.45 0.07"
            numOctaves="5"
            seed="2"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="soft-light" />
          <feGaussianBlur stdDeviation="0.3" />
        </filter>
        <linearGradient id="bPaint" x1="0.1" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#004058" />
          <stop offset="18%" stopColor="#006880" />
          <stop offset="35%" stopColor="#007898" />
          <stop offset="50%" stopColor="#0090a8" />
          <stop offset="62%" stopColor="#007890" />
          <stop offset="78%" stopColor="#005870" />
          <stop offset="90%" stopColor="#004858" />
          <stop offset="100%" stopColor="#003848" />
        </linearGradient>
        <linearGradient id="bHi" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#30b0c8" stopOpacity="0" />
          <stop offset="25%" stopColor="#30b0c8" stopOpacity="0.2" />
          <stop offset="40%" stopColor="#60c8d8" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#30a0b8" stopOpacity="0.15" />
          <stop offset="75%" stopColor="#208898" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#30b0c8" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="bVign" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="#002030" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="bThresh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a88020" />
          <stop offset="50%" stopColor="#c8a838" />
          <stop offset="100%" stopColor="#b09028" />
        </linearGradient>
      </defs>
      {/* Base painted surface */}
      <rect x="0" y="0" width="34" height="68" rx="2.5" fill="url(#bPaint)" filter="url(#bGrain)" />
      {/* Soft painterly highlight streaks */}
      <rect x="8" y="4" width="10" height="56" rx="3" fill="url(#bHi)" opacity="0.6" />
      <rect x="16" y="10" width="7" height="44" rx="2" fill="url(#bHi)" opacity="0.3" />
      {/* Vignette to darken edges naturally */}
      <rect x="0" y="0" width="34" height="68" rx="2.5" fill="url(#bVign)" />
      {/* Soft edge shadows instead of hard borders */}
      <rect x="0" y="0" width="2.5" height="68" rx="1" fill="#003040" opacity="0.3" />
      <rect x="31.5" y="0" width="2.5" height="68" rx="1" fill="#003848" opacity="0.25" />
      <rect x="0" y="0" width="34" height="3" rx="2" fill="#003040" opacity="0.25" />
      {/* Warm painted light hints */}
      <ellipse cx="14" cy="16" rx="9" ry="6" fill="#c8a830" opacity="0.04" />
      <ellipse cx="18" cy="48" rx="7" ry="5" fill="#a08828" opacity="0.03" />
      {/* Knob on LEFT (hinge is right for employer door) */}
      <circle cx="7" cy="36" r="2" fill="#b09828" />
      <circle cx="7" cy="36" r="1.2" fill="#d0b840" />
      <circle cx="6.6" cy="35.5" r="0.5" fill="#e8d060" opacity="0.7" />
      {/* Golden threshold */}
      <rect x="0" y="66" width="34" height="6" rx="1" fill="url(#bThresh)" />
      <rect x="0" y="66" width="34" height="0.8" fill="#d8c048" opacity="0.3" />
    </svg>
  );
}

function GreenDoorSVG() {
  return (
    <svg viewBox="0 0 34 72" className="w-full h-full block">
      <defs>
        <filter id="gGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.4 0.08"
            numOctaves="5"
            seed="7"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="soft-light" />
          <feGaussianBlur stdDeviation="0.3" />
        </filter>
        <linearGradient id="gPaint" x1="0.1" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#285810" />
          <stop offset="18%" stopColor="#3a7818" />
          <stop offset="35%" stopColor="#4a9020" />
          <stop offset="50%" stopColor="#58a028" />
          <stop offset="62%" stopColor="#4a8820" />
          <stop offset="78%" stopColor="#387018" />
          <stop offset="90%" stopColor="#2a5810" />
          <stop offset="100%" stopColor="#204808" />
        </linearGradient>
        <linearGradient id="gHi" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#90c048" stopOpacity="0" />
          <stop offset="25%" stopColor="#90c048" stopOpacity="0.2" />
          <stop offset="40%" stopColor="#b0d060" stopOpacity="0.3" />
          <stop offset="55%" stopColor="#88b040" stopOpacity="0.15" />
          <stop offset="75%" stopColor="#689830" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#90c048" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="gVign" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="100%" stopColor="#0a2800" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="gThresh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a88020" />
          <stop offset="50%" stopColor="#c8a838" />
          <stop offset="100%" stopColor="#b09028" />
        </linearGradient>
      </defs>
      {/* Base painted surface */}
      <rect x="0" y="0" width="34" height="68" rx="2.5" fill="url(#gPaint)" filter="url(#gGrain)" />
      {/* Soft painterly highlight streaks */}
      <rect x="10" y="4" width="10" height="56" rx="3" fill="url(#gHi)" opacity="0.6" />
      <rect x="18" y="10" width="7" height="44" rx="2" fill="url(#gHi)" opacity="0.3" />
      {/* Vignette to darken edges naturally */}
      <rect x="0" y="0" width="34" height="68" rx="2.5" fill="url(#gVign)" />
      {/* Soft edge shadows */}
      <rect x="0" y="0" width="2.5" height="68" rx="1" fill="#1a3808" opacity="0.3" />
      <rect x="31.5" y="0" width="2.5" height="68" rx="1" fill="#1a4008" opacity="0.25" />
      <rect x="0" y="0" width="34" height="3" rx="2" fill="#1a3808" opacity="0.25" />
      {/* Warm painted light hints */}
      <ellipse cx="16" cy="16" rx="9" ry="6" fill="#c8a830" opacity="0.04" />
      <ellipse cx="14" cy="48" rx="7" ry="5" fill="#a08828" opacity="0.03" />
      {/* Knob on RIGHT (hinge is left for worker door) */}
      <circle cx="27" cy="36" r="2" fill="#b09828" />
      <circle cx="27" cy="36" r="1.2" fill="#d0b840" />
      <circle cx="27.4" cy="35.5" r="0.5" fill="#e8d060" opacity="0.7" />
      {/* Golden threshold */}
      <rect x="0" y="66" width="34" height="6" rx="1" fill="url(#gThresh)" />
      <rect x="0" y="66" width="34" height="0.8" fill="#d8c048" opacity="0.3" />
    </svg>
  );
}

/* ─── Individual Door ─── */

interface DoorProps {
  side: "employer" | "worker";
  onClick: () => void;
}

function Door({ side, onClick }: DoorProps) {
  const [hovered, setHovered] = useState(false);
  const [introPlaying, setIntroPlaying] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIntroPlaying(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  const isEmployer = side === "employer";
  const label = isEmployer ? "Employer Portal" : "Worker Portal";
  const sublabel = isEmployer
    ? "Manage payroll, credentials & compliance"
    : "View paystubs, agreements & documents";

  const accentColor = isEmployer ? "#00a8d8" : "#58a020";
  const glowColor = isEmployer ? "#00c8e8" : "#68b830";

  const isOpen = introPlaying || hovered;
  const hingeOrigin = isEmployer ? "right center" : "left center";
  const introDelay = isEmployer ? 0.6 : 1.0;

  // Open angle: wider on hover than intro
  const openAngle = hovered ? 72 : 25;

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer block"
      style={{
        width: "100%",
        height: "100%",
        perspective: "900px",
      }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Soft dark frame surround — matching bark color of trunk */}
      <div
        className="absolute rounded-[3px]"
        style={{
          inset: "-2px",
          background:
            "linear-gradient(180deg, #222c14 0%, #161e0c 50%, #0e1408 100%)",
          boxShadow: "0 0 3px rgba(10,14,6,0.5), inset 0 0 2px rgba(40,52,24,0.2)",
          zIndex: 0,
        }}
      />

      {/* Warm golden light behind door */}
      <div
        className="absolute rounded-t-[1px] overflow-hidden"
        style={{ inset: "2px", zIndex: 1 }}
      >
        <motion.div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at center 40%,
              rgba(240,200,48,0.19),
              rgba(212,152,32,0.13) 30%,
              rgba(160,104,16,0.02) 60%,
              transparent 100%)`,
          }}
          animate={{ opacity: isOpen ? 1 : 0.15 }}
          transition={{ duration: 0.5 }}
        />
        {/* Interior warm glow */}
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(248,208,96,0.25), rgba(224,160,32,0.19), rgba(128,80,8,0.05))",
          }}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* THE DOOR — swings open in 3D */}
      <motion.div
        className="absolute rounded-t-[1px]"
        style={{
          inset: "1px",
          transformStyle: "preserve-3d",
          transformOrigin: hingeOrigin,
          zIndex: 2,
        }}
        initial={{ rotateY: 0 }}
        animate={{
          rotateY: hovered
            ? isEmployer
              ? -openAngle
              : openAngle
            : introPlaying
              ? isEmployer
                ? -openAngle
                : openAngle
              : 0,
        }}
        transition={
          hovered
            ? { duration: 0.65, ease: [0.22, 1, 0.36, 1] }
            : introPlaying
              ? { duration: 0.8, delay: introDelay, ease: [0.22, 1, 0.36, 1] }
              : { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
        }
      >
        {/* Front face — painted wooden door */}
        <div
          className="absolute inset-0 rounded-t-[1px] overflow-hidden"
          style={{ backfaceVisibility: "hidden" }}
        >
          {isEmployer ? <BlueDoorSVG /> : <GreenDoorSVG />}
        </div>
        {/* Back face — dark wood interior */}
        <div
          className="absolute inset-0 rounded-t-[1px]"
          style={{
            background:
              "linear-gradient(180deg, #1a1208 0%, #100a04 70%, #201008 100%)",
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
          }}
        />
      </motion.div>

      {/* Light spill onto trunk when open */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          top: "-10%",
          bottom: "-25%",
          [isEmployer ? "left" : "right"]: "-60%",
          width: "120%",
          zIndex: 0,
        }}
        animate={{
          background: isOpen
            ? `radial-gradient(ellipse at ${isEmployer ? "right" : "left"} center, rgba(240,200,48,0.09), transparent 65%)`
            : `radial-gradient(ellipse at ${isEmployer ? "right" : "left"} center, rgba(240,200,48,0), transparent 65%)`,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Painterly glow halo */}
      <motion.div
        className="absolute pointer-events-none rounded-t-lg"
        style={{ inset: "-10px", zIndex: -1 }}
        animate={{
          boxShadow: hovered
            ? `0 0 20px ${glowColor}40, 0 0 45px ${glowColor}20, 0 0 80px ${glowColor}0a, inset 0 0 15px ${glowColor}10`
            : introPlaying
              ? "none"
              : `0 0 6px ${accentColor}15, 0 0 20px ${accentColor}08`,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Idle breathing glow */}
      {!hovered && !introPlaying && (
        <motion.div
          className="absolute pointer-events-none rounded-[2px]"
          style={{
            inset: "-2px",
            border: `1px solid ${accentColor}`,
          }}
          animate={{ opacity: [0, 0.4, 0] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            repeatDelay: 2,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ duration: 0.25, delay: 0.15 }}
            className="absolute left-1/2 -translate-x-1/2 z-50 whitespace-nowrap"
            style={{ bottom: "calc(100% + 14px)" }}
          >
            <div
              className="px-4 py-2.5 rounded-xl text-center"
              style={{
                background: "rgba(3, 8, 16, 0.92)",
                backdropFilter: "blur(12px)",
                border: `1px solid ${accentColor}50`,
                boxShadow: `0 4px 20px rgba(0,0,0,0.5), 0 0 12px ${accentColor}18`,
              }}
            >
              <p
                className="text-sm font-semibold"
                style={{ color: glowColor }}
              >
                {label}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">{sublabel}</p>
            </div>
            <div
              className="mx-auto w-0 h-0"
              style={{
                borderLeft: "6px solid transparent",
                borderRight: "6px solid transparent",
                borderTop: `6px solid ${accentColor}50`,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent label */}
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
              style={{
                color: glowColor,
                textShadow: `0 0 8px ${accentColor}80`,
              }}
            >
              {isEmployer ? "Employer" : "Worker"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

/* ─── Blackout Patches ───
 * Solid dark patches that fully cover the original painted doors in the
 * hero image. The SVG doors are then placed on top, so it feels like
 * you're interacting with the painting itself.
 *
 * Pixel measurements from pnw-tree.png (1024×1536) via color sampling:
 *   Blue door colored pixels:  x=476-506, y=345-398
 *   Green door colored pixels: x=536-566, y=330-398
 *   Gold frame elements extend a few px beyond in each direction.
 *
 * Blackout patches are sized generously (+6px padding) to fully erase
 * the originals, using the trunk's dark bark color.
 */

function DoorBlackout({ side }: { side: "employer" | "worker" }) {
  const isEmployer = side === "employer";
  // Exactly the same size/position as the SVG door so it sits invisibly behind it
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: isEmployer ? "46.09%" : "51.95%",
        top: "32.85vw",
        width: "3.71%",
        height: "6.64vw",
        backgroundColor: "rgb(14,18,8)",
        zIndex: 19,
      }}
    />
  );
}

/* ─── Container ─── */

interface PortalDoorsProps {
  onEmployerClick: () => void;
  onWorkerClick: () => void;
}

/**
 * Pixel measurements from pnw-tree.png (1024×1536) via PIL color sampling:
 *
 *   Blue door (including frame): x=472-510, y=340-402  → 38×62px
 *   Green door (including frame): x=532-570, y=328-402  → 38×74px
 *
 * Image is displayed w-full h-auto, so:
 *   CSS left/width = (px / 1024) * 100  → percentage of viewport width
 *   CSS top/height = (px / 1024) * 100  → vw units
 */
export function PortalDoors({
  onEmployerClick,
  onWorkerClick,
}: PortalDoorsProps) {
  return (
    <>
      {/* Blackout patches — fully erase the painted doors from the image */}
      <DoorBlackout side="employer" />
      <DoorBlackout side="worker" />

      {/* Blue (employer) door — both doors are identical size */}
      <div
        className="absolute"
        style={{
          left: "46.09%",
          top: "32.85vw",
          width: "3.71%",
          height: "6.64vw",
          zIndex: 20,
        }}
      >
        <Door side="employer" onClick={onEmployerClick} />
      </div>

      {/* Green (worker) door — same size, bottom-aligned with employer */}
      <div
        className="absolute"
        style={{
          left: "51.95%",
          top: "32.85vw",
          width: "3.71%",
          height: "6.64vw",
          zIndex: 20,
        }}
      >
        <Door side="worker" onClick={onWorkerClick} />
      </div>
    </>
  );
}
