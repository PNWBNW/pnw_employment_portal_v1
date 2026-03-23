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
            baseFrequency="0.6 0.08"
            numOctaves="4"
            seed="2"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="overlay" />
        </filter>
        <linearGradient id="bPaint" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#005880" />
          <stop offset="15%" stopColor="#0090b8" />
          <stop offset="30%" stopColor="#00a8d8" />
          <stop offset="45%" stopColor="#18c0e8" />
          <stop offset="55%" stopColor="#28d8f0" />
          <stop offset="65%" stopColor="#0098c0" />
          <stop offset="78%" stopColor="#006890" />
          <stop offset="88%" stopColor="#005878" />
          <stop offset="100%" stopColor="#004060" />
        </linearGradient>
        <linearGradient id="bHi" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#40e0f0" stopOpacity="0" />
          <stop offset="20%" stopColor="#40e0f0" stopOpacity="0.35" />
          <stop offset="35%" stopColor="#90f0ff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#40e0f0" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#20b0d0" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#40e0f0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bThresh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c09020" />
          <stop offset="50%" stopColor="#e8c850" />
          <stop offset="100%" stopColor="#d0a830" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="34" height="68" rx="1.5" fill="url(#bPaint)" filter="url(#bGrain)" />
      <rect x="6" y="3" width="12" height="58" rx="1" fill="url(#bHi)" opacity="0.7" />
      <rect x="16" y="8" width="8" height="48" rx="1" fill="url(#bHi)" opacity="0.4" transform="skewX(-2)" />
      <rect x="0" y="0" width="2" height="68" fill="#002838" opacity="0.5" />
      <rect x="32" y="0" width="2" height="68" fill="#003040" opacity="0.4" />
      <rect x="0" y="0" width="34" height="3" fill="#003848" opacity="0.4" />
      <rect x="4" y="6" width="26" height="52" rx="1" fill="none" stroke="#40c8e0" strokeWidth="0.5" opacity="0.2" />
      <ellipse cx="14" cy="12" rx="8" ry="4" fill="#c8a030" opacity="0.06" />
      <ellipse cx="20" cy="50" rx="6" ry="3" fill="#a08020" opacity="0.04" />
      <circle cx="28" cy="36" r="2" fill="#c0a030" />
      <circle cx="28" cy="36" r="1.2" fill="#e0c850" />
      <circle cx="27.5" cy="35.5" r="0.5" fill="#f0e080" opacity="0.8" />
      <rect x="0" y="66" width="34" height="6" fill="url(#bThresh)" />
      <rect x="0" y="66" width="34" height="1" fill="#f0d860" opacity="0.4" />
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
            baseFrequency="0.5 0.09"
            numOctaves="4"
            seed="7"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="overlay" />
        </filter>
        <linearGradient id="gPaint" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#2a6610" />
          <stop offset="12%" stopColor="#489818" />
          <stop offset="28%" stopColor="#68b830" />
          <stop offset="42%" stopColor="#80cc48" />
          <stop offset="55%" stopColor="#90d850" />
          <stop offset="65%" stopColor="#78c038" />
          <stop offset="78%" stopColor="#58a020" />
          <stop offset="88%" stopColor="#3a7810" />
          <stop offset="100%" stopColor="#2a5808" />
        </linearGradient>
        <linearGradient id="gHi" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#d0f080" stopOpacity="0" />
          <stop offset="20%" stopColor="#d0f080" stopOpacity="0.35" />
          <stop offset="35%" stopColor="#e8f898" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#c0e070" stopOpacity="0.25" />
          <stop offset="70%" stopColor="#90c040" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#d0f080" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="gThresh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b88818" />
          <stop offset="50%" stopColor="#e0c040" />
          <stop offset="100%" stopColor="#c89828" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="34" height="68" rx="1.5" fill="url(#gPaint)" filter="url(#gGrain)" />
      <rect x="8" y="3" width="14" height="58" rx="1" fill="url(#gHi)" opacity="0.65" />
      <rect x="18" y="6" width="7" height="50" rx="1" fill="url(#gHi)" opacity="0.35" transform="skewX(2)" />
      <rect x="0" y="0" width="2" height="68" fill="#1a4008" opacity="0.5" />
      <rect x="32" y="0" width="2" height="68" fill="#204810" opacity="0.4" />
      <rect x="0" y="0" width="34" height="3" fill="#285010" opacity="0.4" />
      <rect x="4" y="6" width="26" height="52" rx="1" fill="none" stroke="#a0d858" strokeWidth="0.5" opacity="0.2" />
      <ellipse cx="18" cy="14" rx="9" ry="4" fill="#c8a830" opacity="0.06" />
      <ellipse cx="14" cy="48" rx="5" ry="3" fill="#a09020" opacity="0.04" />
      <circle cx="6" cy="36" r="2" fill="#c0a030" />
      <circle cx="6" cy="36" r="1.2" fill="#e0c850" />
      <circle cx="5.5" cy="35.5" r="0.5" fill="#f0e080" opacity="0.8" />
      <rect x="0" y="66" width="34" height="6" fill="url(#gThresh)" />
      <rect x="0" y="66" width="34" height="1" fill="#e8d050" opacity="0.4" />
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
      {/* Dark olive frame surround — matching bark color of trunk */}
      <div
        className="absolute rounded-t-[2px]"
        style={{
          inset: "-3px",
          background:
            "linear-gradient(180deg, #2a3418 0%, #1a2010 50%, #0d1408 100%)",
          border: "1px solid rgba(58, 74, 32, 0.25)",
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

/* ─── Blackout Patch ───
 * Covers the original painted door in the hero image so the SVG door
 * appears to BE the door, not a layer on top of it.
 */
function DoorBlackout({ side }: { side: "employer" | "worker" }) {
  const isEmployer = side === "employer";
  // Slightly larger than the door to fully cover the painted original
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: isEmployer ? "45.5%" : "51.0%",
        top: "34.4vw",
        width: "3.6%",
        height: "5.8vw",
        background: `radial-gradient(ellipse at center,
          rgba(20,28,12,0.95) 30%,
          rgba(20,28,12,0.85) 60%,
          rgba(20,28,12,0.4) 85%,
          transparent 100%)`,
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
 * Pixel measurements from pnw-tree.png (1024×1536):
 * Image displayed as w-full h-auto → 1px = (100/1024)vw = 0.09766vw
 *
 * Blue door:  left edge ~474px, top ~358px, width ~26px, height ~54px
 * Green door: left edge ~530px, top ~358px, width ~26px, height ~54px
 *
 * As percentages of image width (since image is w-full):
 *   left:   (px / 1024) * 100  → percentage of viewport width
 *   top:    (px / 1024) * 100  → vw units (image aspect ratio preserved)
 *   width:  (px / 1024) * 100  → percentage of viewport width
 *   height: (px / 1024) * 100  → vw units
 */
export function PortalDoors({
  onEmployerClick,
  onWorkerClick,
}: PortalDoorsProps) {
  return (
    <>
      {/* Blackout patches to hide the painted doors in the image */}
      <DoorBlackout side="employer" />
      <DoorBlackout side="worker" />

      {/* Blue (employer) door — positioned exactly over the left painted door */}
      <div
        className="absolute"
        style={{
          left: "46.29%",
          top: "34.96vw",
          width: "2.54%",
          height: "5.27vw",
          zIndex: 20,
        }}
      >
        <Door side="employer" onClick={onEmployerClick} />
      </div>

      {/* Green (worker) door — positioned exactly over the right painted door */}
      <div
        className="absolute"
        style={{
          left: "51.76%",
          top: "34.96vw",
          width: "2.54%",
          height: "5.27vw",
          zIndex: 20,
        }}
      >
        <Door side="worker" onClick={onWorkerClick} />
      </div>
    </>
  );
}
