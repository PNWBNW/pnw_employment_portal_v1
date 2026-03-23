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
        {/* Gentle bark texture — keeps color saturation intact */}
        <filter id="barkGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06 0.02"
            numOctaves="5"
            seed="13"
            result="noise"
          />
          <feColorMatrix in="noise" type="saturate" values="0" result="bw" />
          <feBlend in="SourceGraphic" in2="bw" mode="soft-light" result="textured" />
          {/* Mix 70% original color back in to prevent grey washout */}
          <feBlend in="SourceGraphic" in2="textured" mode="normal" />
          <feGaussianBlur stdDeviation="0.15" />
        </filter>
        {/* Vivid olive-green bark — pixel-sampled from trunk next to doors */}
        <linearGradient id="barkBody" x1="0.1" y1="0" x2="0.25" y2="1">
          <stop offset="0%" stopColor="#5e6830" />
          <stop offset="12%" stopColor="#69620f" />
          <stop offset="28%" stopColor="#6c6b28" />
          <stop offset="42%" stopColor="#62723c" />
          <stop offset="58%" stopColor="#555e24" />
          <stop offset="72%" stopColor="#4a5520" />
          <stop offset="88%" stopColor="#434e1b" />
          <stop offset="100%" stopColor="#3e4c19" />
        </linearGradient>
        {/* Golden-amber highlights — from green door right edge */}
        <linearGradient id="barkWarm" x1="0" y1="0.15" x2="1" y2="0.85">
          <stop offset="0%" stopColor="#9b7814" stopOpacity="0.35" />
          <stop offset="25%" stopColor="#76702a" stopOpacity="0.2" />
          <stop offset="50%" stopColor="#69620f" stopOpacity="0.15" />
          <stop offset="75%" stopColor="#76702a" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#845406" stopOpacity="0.3" />
        </linearGradient>
        {/* Mossy green tint — from blue door left edge */}
        <radialGradient id="barkMoss" cx="0.4" cy="0.35" r="0.65">
          <stop offset="0%" stopColor="#62723c" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#555e24" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#434e1b" stopOpacity="0.08" />
        </radialGradient>
        {/* Inner shadow — dark green, not grey */}
        <linearGradient id="barkInnerShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2808" stopOpacity="0.85" />
          <stop offset="15%" stopColor="#1a2808" stopOpacity="0.35" />
          <stop offset="85%" stopColor="#1a2808" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#1a2808" stopOpacity="0.75" />
        </linearGradient>
        {/* Side inner shadows */}
        <linearGradient id="barkInnerSideL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1a2808" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#1a2808" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="barkInnerSideR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#1a2808" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#1a2808" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base bark frame shape — warm brown with coarse grain */}
      <path
        d="M3,0.8 C1.2,1 0.4,2.2 0.3,4 L0.2,77.5 C0.2,79.5 1.3,81 3.2,81.2 L40.8,81.2 C42.7,81 43.8,79.5 43.8,77.5 L43.7,4 C43.6,2.2 42.8,1 41,0.8 Z"
        fill="url(#barkBody)"
        filter="url(#barkGrain)"
      />
      {/* Second texture pass — finer grain overlay */}
      <path
        d="M3,0.8 C1.2,1 0.4,2.2 0.3,4 L0.2,77.5 C0.2,79.5 1.3,81 3.2,81.2 L40.8,81.2 C42.7,81 43.8,79.5 43.8,77.5 L43.7,4 C43.6,2.2 42.8,1 41,0.8 Z"
        fill="url(#barkWarm)"
        filter="url(#barkFine)"
      />
      {/* Subtle moss tint — PNW trees have green-tinged bark */}
      <path
        d="M3,0.8 C1.2,1 0.4,2.2 0.3,4 L0.2,77.5 C0.2,79.5 1.3,81 3.2,81.2 L40.8,81.2 C42.7,81 43.8,79.5 43.8,77.5 L43.7,4 C43.6,2.2 42.8,1 41,0.8 Z"
        fill="url(#barkMoss)"
      />

      {/* Inner doorway cutout — darkest green-black from trunk shadows */}
      <rect x="4.5" y="3.5" width="35" height="73" rx="1" fill="#141e08" />

      {/* Inner edge shadows — all 4 sides for carved depth */}
      <rect x="4.5" y="3.5" width="35" height="73" rx="1" fill="url(#barkInnerShadow)" />
      <rect x="4.5" y="3.5" width="8" height="73" rx="1" fill="url(#barkInnerSideL)" />
      <rect x="31.5" y="3.5" width="8" height="73" rx="1" fill="url(#barkInnerSideR)" />

      {/* Bark ridge highlights — irregular bumps along the frame */}
      <path
        d="M2,8 C1.8,12 2.2,18 1.8,24 C1.5,30 2,36 1.7,42 C2.1,48 1.6,54 2,60 C1.8,66 2.2,72 2,76"
        stroke="#7d7421"
        strokeWidth="1.2"
        fill="none"
        opacity="0.35"
      />
      <path
        d="M42,6 C42.2,12 41.8,18 42.1,24 C42.4,30 41.9,36 42.2,42 C41.8,48 42.3,54 42,60 C42.2,66 41.8,72 42,78"
        stroke="#7d7421"
        strokeWidth="1.2"
        fill="none"
        opacity="0.3"
      />

      {/* Top lintel — vivid olive from trunk */}
      <path
        d="M2.5,1.5 L41.5,1.5 L41.5,4 C38,4.3 30,4.5 22,4.3 C14,4.1 6,4.3 2.5,4 Z"
        fill="#5e6830"
        opacity="0.55"
      />

      {/* Bottom sill — golden olive */}
      <path
        d="M2.5,76.5 C6,77 14,77.3 22,77.5 C30,77.3 38,77 41.5,76.5 L41.5,80 L2.5,80 Z"
        fill="#4a5520"
        opacity="0.5"
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
                  <stop offset="0%" stopColor="#495119" />
                  <stop offset="40%" stopColor="#3e4c19" />
                  <stop offset="100%" stopColor="#304011" />
                </linearGradient>
              </defs>
              {/* Plank shape — slightly organic edges */}
              <path
                d="M4,1.5 C2.5,1.5 1.5,2.5 1.5,3.5 L1.5,10.5 C1.5,11.5 2.5,12.5 4,12.5 L56,12.5 C57.5,12.5 58.5,11.5 58.5,10.5 L58.5,3.5 C58.5,2.5 57.5,1.5 56,1.5 Z"
                fill={`url(#plBody${side})`}
                filter={`url(#plGrain${side})`}
                stroke="#2c3a17"
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
              <circle cx="6" cy="7" r="0.8" fill="#1e2e02" />
              <circle cx="6" cy="7" r="0.4" fill="#3e4c19" />
              <circle cx="54" cy="7" r="0.8" fill="#1e2e02" />
              <circle cx="54" cy="7" r="0.4" fill="#3e4c19" />
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
