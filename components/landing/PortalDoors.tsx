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

/* ─── Craftsman Door Trim SVG ─── */

/**
 * Craftsman-style door casing with proper molding profile:
 * - Wide flat head casing across top with slight reveal
 * - Matching side casings (legs) with beveled inner edge
 * - Thick sill / threshold at bottom
 * - Colors sampled from pnw-tree.png trunk pixels adjacent to doors
 */
function CraftsmanTrimSVG() {
  return (
    <svg
      viewBox="0 0 46 84"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Wood grain — vertical, visible but not overwhelming */}
        <filter id="trimGrain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04 0.18"
            numOctaves="4"
            seed="19"
            result="grain"
          />
          <feColorMatrix in="grain" type="saturate" values="0" result="bw" />
          <feBlend in="SourceGraphic" in2="bw" mode="soft-light" />
        </filter>
        {/* Trim body — olive-green from trunk */}
        <linearGradient id="trimBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5e6830" />
          <stop offset="30%" stopColor="#555e24" />
          <stop offset="70%" stopColor="#4a5520" />
          <stop offset="100%" stopColor="#434e1b" />
        </linearGradient>
        {/* Bevel highlight — lighter edge catching light */}
        <linearGradient id="trimHighL" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7d7421" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7d7421" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trimHighR" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0%" stopColor="#3e4c19" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3e4c19" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trimHighTop" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#76702a" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#76702a" stopOpacity="0" />
        </linearGradient>
        {/* Sill gradient — slightly warmer/golden */}
        <linearGradient id="sillBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#69620f" />
          <stop offset="50%" stopColor="#6c6b28" />
          <stop offset="100%" stopColor="#555e24" />
        </linearGradient>
      </defs>

      {/* ── HEAD CASING — wide flat board across top ── */}
      <rect x="0" y="0" width="46" height="6" rx="0.5" fill="url(#trimBody)" filter="url(#trimGrain)" />
      {/* Top bevel highlight */}
      <rect x="0" y="0" width="46" height="1.5" rx="0.3" fill="url(#trimHighTop)" />
      {/* Bottom edge shadow on head casing */}
      <rect x="0" y="5" width="46" height="1" fill="#2c3a17" opacity="0.5" />
      {/* Reveal line — thin dark gap between head and jambs */}
      <rect x="4" y="5.5" width="38" height="0.5" fill="#1a2808" opacity="0.7" />

      {/* ── LEFT JAMB (side casing) ── */}
      <rect x="0" y="5.5" width="4.5" height="72" fill="url(#trimBody)" filter="url(#trimGrain)" />
      {/* Left outer bevel — light catches left edge */}
      <rect x="0" y="5.5" width="1.2" height="72" fill="url(#trimHighL)" />
      {/* Right inner bevel — shadow where jamb meets door */}
      <rect x="3.5" y="5.5" width="1" height="72" fill="#2c3a17" opacity="0.45" />

      {/* ── RIGHT JAMB ── */}
      <rect x="41.5" y="5.5" width="4.5" height="72" fill="url(#trimBody)" filter="url(#trimGrain)" />
      {/* Right outer bevel — shadow on right edge */}
      <rect x="44.8" y="5.5" width="1.2" height="72" fill="url(#trimHighR)" />
      {/* Left inner bevel — shadow where jamb meets door */}
      <rect x="41.5" y="5.5" width="1" height="72" fill="#2c3a17" opacity="0.45" />

      {/* ── SILL / THRESHOLD — wider, slightly proud ── */}
      <rect x="-1" y="77" width="48" height="5" rx="0.5" fill="url(#sillBody)" filter="url(#trimGrain)" />
      {/* Sill top bevel — catches light */}
      <rect x="-1" y="77" width="48" height="1" fill="#76702a" opacity="0.35" />
      {/* Sill bottom shadow */}
      <rect x="-1" y="81" width="48" height="1" fill="#2c3a17" opacity="0.5" />

      {/* ── INNER OPENING — dark recess behind door ── */}
      <rect x="4.5" y="6" width="37" height="71" fill="#141e08" />
    </svg>
  );
}

/* ─── Craftsman 3-Panel Door SVG ─── */

/**
 * Craftsman-style door with:
 * - Stiles (vertical side rails) and rails (horizontal crosspieces)
 * - 3 recessed panels: small top, large middle, small bottom
 * - Beveled panel edges for depth
 * - Wood grain texture
 * - Period-appropriate hardware (knob + backplate)
 */

interface CraftsmanDoorProps {
  color: "blue" | "green";
  knobSide: "left" | "right";
}

function CraftsmanDoorSVG({ color, knobSide }: CraftsmanDoorProps) {
  const isBlue = color === "blue";
  const id = isBlue ? "b" : "g";
  const seed = isBlue ? 2 : 7;

  // Door body colors
  const bodyDark = isBlue ? "#003048" : "#1e5a22";
  const bodyMid = isBlue ? "#004a68" : "#2d7a2e";
  const bodyLight = isBlue ? "#005878" : "#3a8e34";
  const bodyEdge = isBlue ? "#002838" : "#1a4c1e";

  // Panel recess colors (darker than body)
  const panelDark = isBlue ? "#00283c" : "#174a1c";
  const panelMid = isBlue ? "#003a52" : "#246828";
  const panelLight = isBlue ? "#004560" : "#2a7a2e";

  // Highlight/shadow for bevels
  const bevelLight = isBlue ? "#0070a0" : "#48a840";
  const bevelShadow = isBlue ? "#001820" : "#0e2e10";

  const kx = knobSide === "left" ? 7 : 27;

  return (
    <svg viewBox="0 0 34 68" className="w-full h-full block">
      <defs>
        <filter id={`${id}WoodGrain`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03 0.15"
            numOctaves="5"
            seed={seed}
            result="grain"
          />
          <feColorMatrix in="grain" type="saturate" values="0" result="bw" />
          <feBlend in="SourceGraphic" in2="bw" mode="soft-light" />
        </filter>
        {/* Door body gradient */}
        <linearGradient id={`${id}Body`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor={bodyDark} />
          <stop offset="25%" stopColor={bodyMid} />
          <stop offset="50%" stopColor={bodyLight} />
          <stop offset="75%" stopColor={bodyMid} />
          <stop offset="100%" stopColor={bodyDark} />
        </linearGradient>
        {/* Panel recess gradient */}
        <linearGradient id={`${id}Panel`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor={panelDark} />
          <stop offset="40%" stopColor={panelMid} />
          <stop offset="100%" stopColor={panelLight} />
        </linearGradient>
      </defs>

      {/* ── DOOR SLAB — full body ── */}
      <rect x="0" y="0" width="34" height="68" rx="0.5" fill={`url(#${id}Body)`} filter={`url(#${id}WoodGrain)`} />

      {/* ── STILES (vertical side rails) — implied by the panel cutouts ── */}
      {/* Left stile highlight */}
      <rect x="0" y="0" width="0.8" height="68" fill={bevelLight} opacity="0.15" />
      {/* Right stile shadow */}
      <rect x="33.2" y="0" width="0.8" height="68" fill={bevelShadow} opacity="0.25" />

      {/* ── TOP RAIL — above first panel ── */}
      <rect x="0" y="0" width="34" height="0.6" fill={bevelLight} opacity="0.12" />

      {/* ═══ PANEL 1 — small top panel ═══ */}
      {/* Panel recess */}
      <rect x="5" y="3" width="24" height="13" rx="0.5" fill={`url(#${id}Panel)`} filter={`url(#${id}WoodGrain)`} />
      {/* Top bevel — light edge */}
      <line x1="5" y1="3" x2="29" y2="3" stroke={bevelLight} strokeWidth="0.5" opacity="0.3" />
      {/* Left bevel — light edge */}
      <line x1="5" y1="3" x2="5" y2="16" stroke={bevelLight} strokeWidth="0.5" opacity="0.2" />
      {/* Bottom bevel — shadow */}
      <line x1="5" y1="16" x2="29" y2="16" stroke={bevelShadow} strokeWidth="0.6" opacity="0.4" />
      {/* Right bevel — shadow */}
      <line x1="29" y1="3" x2="29" y2="16" stroke={bevelShadow} strokeWidth="0.6" opacity="0.35" />

      {/* ── MID RAIL — between panel 1 and 2 ── */}
      <rect x="3.5" y="16" width="27" height="2.5" fill={bodyEdge} opacity="0.3" />
      <line x1="3.5" y1="16" x2="30.5" y2="16" stroke={bevelLight} strokeWidth="0.3" opacity="0.2" />

      {/* ═══ PANEL 2 — large center panel ═══ */}
      <rect x="5" y="19" width="24" height="27" rx="0.5" fill={`url(#${id}Panel)`} filter={`url(#${id}WoodGrain)`} />
      {/* Top bevel */}
      <line x1="5" y1="19" x2="29" y2="19" stroke={bevelLight} strokeWidth="0.5" opacity="0.3" />
      {/* Left bevel */}
      <line x1="5" y1="19" x2="5" y2="46" stroke={bevelLight} strokeWidth="0.5" opacity="0.2" />
      {/* Bottom bevel */}
      <line x1="5" y1="46" x2="29" y2="46" stroke={bevelShadow} strokeWidth="0.6" opacity="0.4" />
      {/* Right bevel */}
      <line x1="29" y1="19" x2="29" y2="46" stroke={bevelShadow} strokeWidth="0.6" opacity="0.35" />

      {/* ── LOCK RAIL — between panel 2 and 3 (where knob sits) ── */}
      <rect x="3.5" y="46" width="27" height="2.5" fill={bodyEdge} opacity="0.3" />
      <line x1="3.5" y1="46" x2="30.5" y2="46" stroke={bevelLight} strokeWidth="0.3" opacity="0.2" />

      {/* ═══ PANEL 3 — small bottom panel ═══ */}
      <rect x="5" y="49" width="24" height="14" rx="0.5" fill={`url(#${id}Panel)`} filter={`url(#${id}WoodGrain)`} />
      {/* Top bevel */}
      <line x1="5" y1="49" x2="29" y2="49" stroke={bevelLight} strokeWidth="0.5" opacity="0.3" />
      {/* Left bevel */}
      <line x1="5" y1="49" x2="5" y2="63" stroke={bevelLight} strokeWidth="0.5" opacity="0.2" />
      {/* Bottom bevel */}
      <line x1="5" y1="63" x2="29" y2="63" stroke={bevelShadow} strokeWidth="0.6" opacity="0.4" />
      {/* Right bevel */}
      <line x1="29" y1="49" x2="29" y2="63" stroke={bevelShadow} strokeWidth="0.6" opacity="0.35" />

      {/* ── BOTTOM RAIL ── */}
      <rect x="0" y="65" width="34" height="3" fill={bodyEdge} opacity="0.25" />
      <line x1="0" y1="67.5" x2="34" y2="67.5" stroke={bevelShadow} strokeWidth="0.5" opacity="0.3" />

      {/* ── KNOB — craftsman round knob with backplate ── */}
      {/* Square backplate */}
      <rect x={kx - 2.5} y={44 - 2.5} width="5" height="5" rx="0.5" fill="#8a7020" />
      <rect x={kx - 2.5} y={44 - 2.5} width="5" height="5" rx="0.5" fill="#705818" opacity="0.4" />
      {/* Backplate bevel */}
      <line x1={kx - 2.5} y1={44 - 2.5} x2={kx + 2.5} y2={44 - 2.5} stroke="#b09828" strokeWidth="0.3" opacity="0.5" />
      <line x1={kx - 2.5} y1={44 - 2.5} x2={kx - 2.5} y2={44 + 2.5} stroke="#b09828" strokeWidth="0.3" opacity="0.4" />
      {/* Round knob */}
      <circle cx={kx} cy={44} r="1.8" fill="#b09828" />
      <circle cx={kx} cy={44} r="1.2" fill="#c8a838" />
      <circle cx={kx - 0.3} cy={43.5} r="0.45" fill="#e0c850" opacity="0.6" />

      {/* ── Keyhole below knob ── */}
      <ellipse cx={kx} cy={47.5} rx="0.5" ry="0.7" fill="#1a1208" />
      <rect x={kx - 0.25} y={47.8} width="0.5" height="0.8" fill="#1a1208" />
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
      {/* Craftsman door trim */}
      <div className="absolute" style={{ inset: "-12%", zIndex: 0 }}>
        <CraftsmanTrimSVG />
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
          {isEmployer
            ? <CraftsmanDoorSVG color="blue" knobSide="left" />
            : <CraftsmanDoorSVG color="green" knobSide="right" />
          }
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
