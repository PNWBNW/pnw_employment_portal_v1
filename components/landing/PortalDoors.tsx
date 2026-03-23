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

/* ─── Trunk Frame SVG ─── */

/**
 * Organic bark frame that wraps each door, matching the tree trunk palette.
 * Uses fractalNoise for bark texture. The frame has slightly irregular edges
 * to feel like carved-out trunk wood rather than manufactured trim.
 */
function TrunkFrameSVG() {
  return (
    <svg
      viewBox="0 0 44 82"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="barkGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.12 0.04"
            numOctaves="6"
            seed="13"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="overlay" />
          <feGaussianBlur stdDeviation="0.25" />
        </filter>
        {/* Dark bark body — sampled from trunk in painting */}
        <linearGradient id="barkBody" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#1a2210" />
          <stop offset="15%" stopColor="#1e2812" />
          <stop offset="35%" stopColor="#222e16" />
          <stop offset="55%" stopColor="#1c2410" />
          <stop offset="75%" stopColor="#161e0c" />
          <stop offset="100%" stopColor="#0e1408" />
        </linearGradient>
        {/* Subtle moss/lichen highlight on outer edges */}
        <linearGradient id="barkHighlight" x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#2a3518" stopOpacity="0.6" />
          <stop offset="50%" stopColor="#1e2812" stopOpacity="0" />
          <stop offset="100%" stopColor="#2a3518" stopOpacity="0.4" />
        </linearGradient>
        {/* Inner shadow for depth — the carved-out doorway */}
        <linearGradient id="barkInnerShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0a0e06" stopOpacity="0.8" />
          <stop offset="20%" stopColor="#0a0e06" stopOpacity="0.3" />
          <stop offset="80%" stopColor="#0a0e06" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#0a0e06" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Outer bark frame — slightly organic shape */}
      <path
        d="M3,1 C1.5,1 0.5,2 0.5,3.5 L0.3,77 C0.3,79 1.2,80.5 3,80.8 L41,80.8 C42.8,80.5 43.7,79 43.7,77 L43.5,3.5 C43.5,2 42.5,1 41,1 Z"
        fill="url(#barkBody)"
        filter="url(#barkGrain)"
      />
      {/* Bark highlight layer */}
      <path
        d="M3,1 C1.5,1 0.5,2 0.5,3.5 L0.3,77 C0.3,79 1.2,80.5 3,80.8 L41,80.8 C42.8,80.5 43.7,79 43.7,77 L43.5,3.5 C43.5,2 42.5,1 41,1 Z"
        fill="url(#barkHighlight)"
      />

      {/* Inner doorway cutout — dark recess */}
      <rect x="4" y="3" width="36" height="74" rx="1.5" fill="#080c04" />

      {/* Inner edge shadow for carved-in depth */}
      <rect
        x="4"
        y="3"
        width="36"
        height="74"
        rx="1.5"
        fill="url(#barkInnerShadow)"
      />

      {/* Top lintel bark ridge — slightly thicker, organic */}
      <path
        d="M3.5,2.5 L40.5,2.5 L40.5,4.5 C38,5 30,5.2 22,5 C14,4.8 6,5 3.5,4.5 Z"
        fill="#1e2812"
        opacity="0.6"
        filter="url(#barkGrain)"
      />

      {/* Bottom threshold bark ridge */}
      <path
        d="M3.5,76 C6,76.5 14,76.8 22,77 C30,77.2 38,76.5 40.5,76 L40.5,79.5 L3.5,79.5 Z"
        fill="#161e0c"
        opacity="0.5"
        filter="url(#barkGrain)"
      />
    </svg>
  );
}

/* ─── SVG Door Art ─── */

function BlueDoorSVG() {
  return (
    <svg viewBox="0 0 34 72" className="w-full h-full block">
      <defs>
        <filter id="bGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.35 0.06"
            numOctaves="5"
            seed="2"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="soft-light" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        {/* Dark teal body — sampled from painting edges */}
        <linearGradient id="bBody" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#003b52" />
          <stop offset="20%" stopColor="#003f5e" />
          <stop offset="40%" stopColor="#005b7a" />
          <stop offset="60%" stopColor="#004b67" />
          <stop offset="80%" stopColor="#003f59" />
          <stop offset="100%" stopColor="#0a323a" />
        </linearGradient>
        {/* Edge vignette blending into trunk bark */}
        <radialGradient id="bVign" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="70%" stopColor="transparent" />
          <stop offset="100%" stopColor="#0a323a" stopOpacity="0.5" />
        </radialGradient>
        <linearGradient id="bThresh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a88020" />
          <stop offset="50%" stopColor="#c8a838" />
          <stop offset="100%" stopColor="#b09028" />
        </linearGradient>
      </defs>
      {/* Opaque base — ensures nothing behind bleeds through */}
      <rect x="0" y="0" width="34" height="72" fill="#003848" />
      {/* Dark teal door body */}
      <rect x="0" y="0" width="34" height="68" rx="2" fill="url(#bBody)" filter="url(#bGrain)" />
      {/* Subtle depth variation */}
      <ellipse cx="16" cy="34" rx="10" ry="16" fill="#005b7a" opacity="0.3" />
      {/* Vignette darkening edges to blend with trunk */}
      <rect x="0" y="0" width="34" height="68" rx="2" fill="url(#bVign)" />
      {/* Knob on LEFT (hinge is right for employer door) */}
      <circle cx="7" cy="36" r="1.8" fill="#b09828" />
      <circle cx="7" cy="36" r="1.1" fill="#d0b840" />
      <circle cx="6.7" cy="35.5" r="0.4" fill="#e8d060" opacity="0.7" />
      {/* Golden threshold */}
      <rect x="0" y="66" width="34" height="6" rx="1" fill="url(#bThresh)" />
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
            baseFrequency="0.35 0.06"
            numOctaves="5"
            seed="7"
          />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="soft-light" />
          <feGaussianBlur stdDeviation="0.35" />
        </filter>
        {/* Dark forest green body — sampled from painting edges */}
        <linearGradient id="gBody" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor="#216f28" />
          <stop offset="20%" stopColor="#318732" />
          <stop offset="40%" stopColor="#3f9131" />
          <stop offset="60%" stopColor="#498e2e" />
          <stop offset="80%" stopColor="#2b6a2c" />
          <stop offset="100%" stopColor="#266628" />
        </linearGradient>
        {/* Edge vignette */}
        <radialGradient id="gVign" cx="0.5" cy="0.45" r="0.55">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="70%" stopColor="transparent" />
          <stop offset="100%" stopColor="#1a3808" stopOpacity="0.5" />
        </radialGradient>
        <linearGradient id="gThresh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a88020" />
          <stop offset="50%" stopColor="#c8a838" />
          <stop offset="100%" stopColor="#b09028" />
        </linearGradient>
      </defs>
      {/* Opaque base — ensures nothing behind bleeds through */}
      <rect x="0" y="0" width="34" height="72" fill="#204808" />
      {/* Dark green door body */}
      <rect x="0" y="0" width="34" height="68" rx="2" fill="url(#gBody)" filter="url(#gGrain)" />
      {/* Subtle depth variation */}
      <ellipse cx="18" cy="34" rx="10" ry="16" fill="#498e2e" opacity="0.3" />
      {/* Vignette darkening edges */}
      <rect x="0" y="0" width="34" height="68" rx="2" fill="url(#gVign)" />
      {/* Knob on RIGHT (hinge is left for worker door) */}
      <circle cx="27" cy="36" r="1.8" fill="#b09828" />
      <circle cx="27" cy="36" r="1.1" fill="#d0b840" />
      <circle cx="27.3" cy="35.5" r="0.4" fill="#e8d060" opacity="0.7" />
      {/* Golden threshold */}
      <rect x="0" y="66" width="34" height="6" rx="1" fill="url(#gThresh)" />
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
      {/* Organic trunk bark frame */}
      <div className="absolute" style={{ inset: "-12%", zIndex: 0 }}>
        <TrunkFrameSVG />
      </div>

      {/* Warm golden light behind door */}
      <div
        className="absolute rounded-t-[1px] overflow-hidden"
        style={{ inset: "0", zIndex: 1 }}
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
            style={{ bottom: "calc(100% + 6px)" }}
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

      {/* Wooden placard above door */}
      <AnimatePresence>
        {!introPlaying && !hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="absolute left-1/2 -translate-x-1/2 z-30 whitespace-nowrap"
            style={{ bottom: "calc(100% + 2px)" }}
          >
            <svg
              viewBox="0 0 60 14"
              className="block"
              style={{ width: "clamp(48px, 5vw, 72px)", height: "auto" }}
            >
              <defs>
                <filter id={`plGrain${side}`}>
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.08 0.03"
                    numOctaves="4"
                    seed={isEmployer ? 31 : 37}
                  />
                  <feColorMatrix type="saturate" values="0" />
                  <feBlend in="SourceGraphic" mode="soft-light" />
                </filter>
                <linearGradient id={`plBody${side}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2a3018" />
                  <stop offset="40%" stopColor="#1e2612" />
                  <stop offset="100%" stopColor="#161c0e" />
                </linearGradient>
              </defs>
              {/* Plank shape — slightly organic edges */}
              <path
                d="M4,1.5 C2.5,1.5 1.5,2.5 1.5,3.5 L1.5,10.5 C1.5,11.5 2.5,12.5 4,12.5 L56,12.5 C57.5,12.5 58.5,11.5 58.5,10.5 L58.5,3.5 C58.5,2.5 57.5,1.5 56,1.5 Z"
                fill={`url(#plBody${side})`}
                filter={`url(#plGrain${side})`}
                stroke="#0e1408"
                strokeWidth="0.5"
              />
              {/* Carved text */}
              <text
                x="30"
                y="9"
                textAnchor="middle"
                fontSize="5"
                fontWeight="600"
                letterSpacing="0.8"
                fill={glowColor}
                style={{ textTransform: "uppercase" } as React.CSSProperties}
                opacity="0.9"
              >
                {isEmployer ? "Employer" : "Worker"}
              </text>
              {/* Nail holes */}
              <circle cx="6" cy="7" r="0.8" fill="#0a0e06" />
              <circle cx="6" cy="7" r="0.4" fill="#1e2612" />
              <circle cx="54" cy="7" r="0.8" fill="#0a0e06" />
              <circle cx="54" cy="7" r="0.4" fill="#1e2612" />
            </svg>
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
  // Slightly larger than the door to cover the frame area
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: isEmployer ? "45.65%" : "51.51%",
        top: "32.05vw",
        width: "4.59%",
        height: "8.24vw",
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
