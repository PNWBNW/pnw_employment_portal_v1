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
        {/* Heavy painterly wood grain — coarser strokes, uneven pigment */}
        <filter id="trimGrain">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.1" numOctaves="5" seed="19" result="grain" />
          <feColorMatrix in="grain" type="saturate" values="0" result="bw" />
          <feComposite in="bw" in2="bw" operator="arithmetic" k1="0" k2="0.2" k3="0" k4="0" result="faint" />
          <feBlend in="SourceGraphic" in2="faint" mode="soft-light" result="grained" />
          <feTurbulence type="fractalNoise" baseFrequency="0.007 0.012" numOctaves="3" seed="29" result="broad" />
          <feColorMatrix in="broad" type="saturate" values="0" result="broadBW" />
          <feComposite in="broadBW" in2="broadBW" operator="arithmetic" k1="0" k2="0.08" k3="0" k4="0" result="broadFaint" />
          <feBlend in="grained" in2="broadFaint" mode="multiply" />
        </filter>
        {/* Trim body */}
        <linearGradient id="trimBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6e7838" />
          <stop offset="30%" stopColor="#656e2c" />
          <stop offset="70%" stopColor="#5a6428" />
          <stop offset="100%" stopColor="#4e5820" />
        </linearGradient>
        <linearGradient id="trimBodyH" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#6e7838" />
          <stop offset="50%" stopColor="#7a8440" />
          <stop offset="100%" stopColor="#6e7838" />
        </linearGradient>
        {/* Sill — warm golden */}
        <linearGradient id="sillBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7a7218" />
          <stop offset="50%" stopColor="#7c7b30" />
          <stop offset="100%" stopColor="#656e2c" />
        </linearGradient>
        {/* Decorative inlay — lighter accent */}
        <linearGradient id="inlayFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8a8a3a" />
          <stop offset="100%" stopColor="#6e7838" />
        </linearGradient>
      </defs>

      {/* ── HEAD CASING — arched with crown molding profile ── */}
      {/* Crown — top decorative curve */}
      <path
        d="M-1,4 L-1,1.5 Q-1,0 1,0 L45,0 Q47,0 47,1.5 L47,4 Q37,2.5 23,2.5 Q9,2.5 -1,4 Z"
        fill="url(#trimBodyH)" filter="url(#trimGrain)"
      />
      {/* Crown top highlight */}
      <path d="M1,0.3 Q23,-0.3 45,0.3" stroke="#8a8a3a" strokeWidth="0.5" fill="none" opacity="0.5" />
      {/* Main head casing with gentle arch on underside */}
      <path
        d="M0,3 L0,7 Q23,5.5 46,7 L46,3 Q23,1.5 0,3 Z"
        fill="url(#trimBodyH)" filter="url(#trimGrain)"
      />
      {/* Arch underside shadow */}
      <path d="M4,6.8 Q23,5.5 42,6.8" stroke="#2c3a17" strokeWidth="0.6" fill="none" opacity="0.5" />
      {/* Decorative keystone at center of arch */}
      <path
        d="M20,4 L20,7 Q23,6 26,7 L26,4 Q23,3 20,4 Z"
        fill="#7a8440" opacity="0.4"
      />

      {/* ── CORBELS / BRACKETS — where head meets legs ── */}
      {/* Left corbel — curved support bracket */}
      <path
        d="M0.5,7 L4.5,7 L4.5,12 Q4.5,8 0.5,7.5 Z"
        fill="url(#trimBody)" filter="url(#trimGrain)"
      />
      <path d="M4.5,7 L4.5,11.5 Q4.2,8.5 1.5,7.3" stroke="#8a8a3a" strokeWidth="0.3" fill="none" opacity="0.35" />
      {/* Right corbel */}
      <path
        d="M45.5,7 L41.5,7 L41.5,12 Q41.5,8 45.5,7.5 Z"
        fill="url(#trimBody)" filter="url(#trimGrain)"
      />
      <path d="M41.5,7 L41.5,11.5 Q41.8,8.5 44.5,7.3" stroke="#8a8a3a" strokeWidth="0.3" fill="none" opacity="0.35" />

      {/* ── LEFT JAMB — with beveled ogee profile ── */}
      <rect x="0" y="7" width="4.5" height="70.5" fill="url(#trimBody)" filter="url(#trimGrain)" />
      {/* Outer round-over bevel */}
      <path d="M0,7 Q0.8,7 0.8,7.5 L0.8,77 Q0.8,77.5 0,77.5" fill="#7a8440" opacity="0.25" />
      {/* Inner ogee curve — concave then convex profile */}
      <path d="M4.5,7.5 Q3.5,7.5 3.2,8 L3.2,77 Q3.5,77.5 4.5,77.5" fill="#2c3a17" opacity="0.35" />
      {/* Decorative routed channel in leg */}
      <path d="M1.8,14 L1.8,72" stroke="#5a6428" strokeWidth="0.8" fill="none" opacity="0.25" />
      <path d="M1.8,14 L1.8,72" stroke="#7a8440" strokeWidth="0.3" fill="none" opacity="0.2" />

      {/* ── RIGHT JAMB — mirrored ── */}
      <rect x="41.5" y="7" width="4.5" height="70.5" fill="url(#trimBody)" filter="url(#trimGrain)" />
      <path d="M46,7 Q45.2,7 45.2,7.5 L45.2,77 Q45.2,77.5 46,77.5" fill="#7a8440" opacity="0.25" />
      <path d="M41.5,7.5 Q42.5,7.5 42.8,8 L42.8,77 Q42.5,77.5 41.5,77.5" fill="#2c3a17" opacity="0.35" />
      <path d="M44.2,14 L44.2,72" stroke="#5a6428" strokeWidth="0.8" fill="none" opacity="0.25" />
      <path d="M44.2,14 L44.2,72" stroke="#7a8440" strokeWidth="0.3" fill="none" opacity="0.2" />

      {/* ── PLINTH BLOCKS — decorative base blocks where legs meet sill ── */}
      {/* Left plinth */}
      <rect x="-0.5" y="74" width="5.5" height="3.5" rx="0.3" fill="url(#trimBody)" filter="url(#trimGrain)" />
      <path d="M-0.5,74 L5,74" stroke="#8a8a3a" strokeWidth="0.3" opacity="0.4" />
      {/* Carved rosette in plinth */}
      <circle cx="2.25" cy="75.8" r="1" fill="none" stroke="#7a8440" strokeWidth="0.3" opacity="0.35" />
      <circle cx="2.25" cy="75.8" r="0.4" fill="#7a8440" opacity="0.2" />
      {/* Right plinth */}
      <rect x="41" y="74" width="5.5" height="3.5" rx="0.3" fill="url(#trimBody)" filter="url(#trimGrain)" />
      <path d="M41,74 L46.5,74" stroke="#8a8a3a" strokeWidth="0.3" opacity="0.4" />
      <circle cx="43.75" cy="75.8" r="1" fill="none" stroke="#7a8440" strokeWidth="0.3" opacity="0.35" />
      <circle cx="43.75" cy="75.8" r="0.4" fill="#7a8440" opacity="0.2" />

      {/* ── SILL — with bullnose front edge ── */}
      <path
        d="M-1.5,77.5 L47.5,77.5 L47.5,82 Q47.5,83 46.5,83 L-0.5,83 Q-1.5,83 -1.5,82 Z"
        fill="url(#sillBody)" filter="url(#trimGrain)"
      />
      {/* Bullnose top curve highlight */}
      <path d="M-1.5,77.5 Q23,77 47.5,77.5" stroke="#8a8a3a" strokeWidth="0.4" fill="none" opacity="0.4" />
      {/* Sill bottom shadow */}
      <path d="M-0.5,83 Q23,83.3 46.5,83" stroke="#2c3a17" strokeWidth="0.5" fill="none" opacity="0.5" />

      {/* ── INNER OPENING — arched top matching head casing ── */}
      <path
        d="M4.5,7 Q23,5.8 41.5,7 L41.5,77.5 L4.5,77.5 Z"
        fill="#141e08"
      />
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

  // Door body colors — vivid and saturated
  const bodyDark = isBlue ? "#005878" : "#2a7a2e";
  const bodyMid = isBlue ? "#006e98" : "#3a9838";
  const bodyLight = isBlue ? "#0080a8" : "#48a842";
  const bodyEdge = isBlue ? "#004a6a" : "#207028";

  // Panel recess colors
  const panelDark = isBlue ? "#004868" : "#1e6826";
  const panelMid = isBlue ? "#005e88" : "#2e8832";
  const panelLight = isBlue ? "#006a94" : "#38963a";

  // Highlight/shadow for bevels
  const bevelLight = isBlue ? "#18a0d8" : "#58c050";
  const bevelShadow = isBlue ? "#002840" : "#143818";

  // Accent for carved details
  const carveLight = isBlue ? "#40b8e0" : "#70d868";
  const carveMid = isBlue ? "#0090c0" : "#40a840";

  const kx = knobSide === "left" ? 7.5 : 26.5;

  return (
    <svg viewBox="0 0 34 68" className="w-full h-full block">
      <defs>
        <filter id={`${id}WoodGrain`}>
          {/* Fine grain — visible brush stroke texture */}
          <feTurbulence type="fractalNoise" baseFrequency="0.025 0.12" numOctaves="5" seed={seed} result="grain" />
          <feColorMatrix in="grain" type="saturate" values="0" result="bw" />
          <feComposite in="bw" in2="bw" operator="arithmetic" k1="0" k2="0.28" k3="0" k4="0" result="faint" />
          <feBlend in="SourceGraphic" in2="faint" mode="soft-light" result="grained" />
          {/* Broad variation — larger patches of lighter/darker paint */}
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="3" seed={seed + 10} result="broad" />
          <feColorMatrix in="broad" type="saturate" values="0" result="broadBW" />
          <feComposite in="broadBW" in2="broadBW" operator="arithmetic" k1="0" k2="0.14" k3="0" k4="0" result="broadFaint" />
          <feBlend in="grained" in2="broadFaint" mode="multiply" />
        </filter>
        <linearGradient id={`${id}Body`} x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor={bodyDark} />
          <stop offset="25%" stopColor={bodyMid} />
          <stop offset="50%" stopColor={bodyLight} />
          <stop offset="75%" stopColor={bodyMid} />
          <stop offset="100%" stopColor={bodyDark} />
        </linearGradient>
        <linearGradient id={`${id}Panel`} x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%" stopColor={panelDark} />
          <stop offset="40%" stopColor={panelMid} />
          <stop offset="100%" stopColor={panelLight} />
        </linearGradient>
      </defs>

      {/* ── DOOR SLAB ── */}
      <rect x="0" y="0" width="34" height="68" rx="0.8" fill={`url(#${id}Body)`} filter={`url(#${id}WoodGrain)`} />

      {/* Left stile rounded highlight */}
      <path d="M0.8,0.8 L0.8,67.2" stroke={bevelLight} strokeWidth="0.6" fill="none" opacity="0.2" />
      {/* Right stile shadow */}
      <path d="M33.2,0.8 L33.2,67.2" stroke={bevelShadow} strokeWidth="0.6" fill="none" opacity="0.3" />
      {/* Top highlight */}
      <path d="M0.8,0.5 L33.2,0.5" stroke={bevelLight} strokeWidth="0.4" fill="none" opacity="0.15" />

      {/* ═══ PANEL 1 — arched top panel ═══ */}
      <path
        d="M5.5,5 Q17,2.5 28.5,5 L28.5,15.5 Q17,16.5 5.5,15.5 Z"
        fill={`url(#${id}Panel)`} filter={`url(#${id}WoodGrain)`}
      />
      {/* Arch top bevel — light */}
      <path d="M5.5,5 Q17,2.5 28.5,5" stroke={bevelLight} strokeWidth="0.5" fill="none" opacity="0.35" />
      {/* Sides */}
      <line x1="5.5" y1="5" x2="5.5" y2="15.5" stroke={bevelLight} strokeWidth="0.4" opacity="0.2" />
      <line x1="28.5" y1="5" x2="28.5" y2="15.5" stroke={bevelShadow} strokeWidth="0.5" opacity="0.35" />
      {/* Bottom bevel */}
      <path d="M5.5,15.5 Q17,16.5 28.5,15.5" stroke={bevelShadow} strokeWidth="0.5" fill="none" opacity="0.35" />
      {/* Carved fan / sunburst detail inside arched panel */}
      <path d="M17,4 L12,12" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.12" />
      <path d="M17,4 L17,13" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.15" />
      <path d="M17,4 L22,12" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.12" />
      <path d="M17,4 L9,10" stroke={carveLight} strokeWidth="0.15" fill="none" opacity="0.08" />
      <path d="M17,4 L25,10" stroke={carveLight} strokeWidth="0.15" fill="none" opacity="0.08" />
      {/* Small carved arc at top of sunburst */}
      <path d="M12,10 Q17,7 22,10" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.12" />

      {/* ── UPPER RAIL with routed bead detail ── */}
      <rect x="3.5" y="16" width="27" height="2.5" fill={bodyEdge} opacity="0.35" />
      <path d="M5,17.2 Q17,16.8 29,17.2" stroke={carveMid} strokeWidth="0.25" fill="none" opacity="0.2" />

      {/* ═══ PANEL 2 — large center panel with cathedral arch ═══ */}
      <path
        d="M5.5,19.5 Q17,18 28.5,19.5 L28.5,44 Q17,45 5.5,44 Z"
        fill={`url(#${id}Panel)`} filter={`url(#${id}WoodGrain)`}
      />
      {/* Top arch */}
      <path d="M5.5,19.5 Q17,18 28.5,19.5" stroke={bevelLight} strokeWidth="0.5" fill="none" opacity="0.3" />
      <line x1="5.5" y1="19.5" x2="5.5" y2="44" stroke={bevelLight} strokeWidth="0.4" opacity="0.2" />
      <line x1="28.5" y1="19.5" x2="28.5" y2="44" stroke={bevelShadow} strokeWidth="0.5" opacity="0.35" />
      <path d="M5.5,44 Q17,45 28.5,44" stroke={bevelShadow} strokeWidth="0.5" fill="none" opacity="0.35" />
      {/* Carved diamond / lozenge inlay in center panel */}
      <path
        d="M17,24 L22,31.5 L17,39 L12,31.5 Z"
        fill="none" stroke={carveLight} strokeWidth="0.3" opacity="0.15"
      />
      {/* Inner diamond */}
      <path
        d="M17,26 L20,31.5 L17,37 L14,31.5 Z"
        fill="none" stroke={carveLight} strokeWidth="0.2" opacity="0.1"
      />
      {/* Small carved circles at diamond tips */}
      <circle cx="17" cy="24" r="0.6" fill="none" stroke={carveMid} strokeWidth="0.2" opacity="0.15" />
      <circle cx="17" cy="39" r="0.6" fill="none" stroke={carveMid} strokeWidth="0.2" opacity="0.15" />
      <circle cx="12" cy="31.5" r="0.6" fill="none" stroke={carveMid} strokeWidth="0.2" opacity="0.15" />
      <circle cx="22" cy="31.5" r="0.6" fill="none" stroke={carveMid} strokeWidth="0.2" opacity="0.15" />

      {/* ── LOCK RAIL with bead ── */}
      <rect x="3.5" y="44.5" width="27" height="2.5" fill={bodyEdge} opacity="0.35" />
      <path d="M5,45.7 Q17,45.3 29,45.7" stroke={carveMid} strokeWidth="0.25" fill="none" opacity="0.2" />

      {/* ═══ PANEL 3 — bottom panel with gentle arch ═══ */}
      <path
        d="M5.5,48 L28.5,48 L28.5,61 Q17,62.5 5.5,61 Z"
        fill={`url(#${id}Panel)`} filter={`url(#${id}WoodGrain)`}
      />
      <line x1="5.5" y1="48" x2="28.5" y2="48" stroke={bevelLight} strokeWidth="0.4" opacity="0.3" />
      <line x1="5.5" y1="48" x2="5.5" y2="61" stroke={bevelLight} strokeWidth="0.4" opacity="0.2" />
      <line x1="28.5" y1="48" x2="28.5" y2="61" stroke={bevelShadow} strokeWidth="0.5" opacity="0.35" />
      <path d="M5.5,61 Q17,62.5 28.5,61" stroke={bevelShadow} strokeWidth="0.5" fill="none" opacity="0.35" />
      {/* Carved quatrefoil / small rosette */}
      <circle cx="17" cy="54.5" r="2.5" fill="none" stroke={carveLight} strokeWidth="0.25" opacity="0.13" />
      <path d="M17,52 Q18.5,54.5 17,57" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.1" />
      <path d="M17,52 Q15.5,54.5 17,57" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.1" />
      <path d="M14.5,54.5 Q17,53 19.5,54.5" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.1" />
      <path d="M14.5,54.5 Q17,56 19.5,54.5" stroke={carveLight} strokeWidth="0.2" fill="none" opacity="0.1" />

      {/* ── BOTTOM RAIL — with ogee profile ── */}
      <path
        d="M0,64 L34,64 L34,67.5 Q34,68 33.2,68 L0.8,68 Q0,68 0,67.5 Z"
        fill={bodyEdge} opacity="0.35"
      />
      <path d="M0,64 L34,64" stroke={bevelLight} strokeWidth="0.3" fill="none" opacity="0.15" />
      <path d="M1,67.6 Q17,68 33,67.6" stroke={bevelShadow} strokeWidth="0.4" fill="none" opacity="0.25" />

      {/* ── HARDWARE — ornate oval backplate + round knob ── */}
      {/* Oval escutcheon plate */}
      <ellipse cx={kx} cy={45} rx="2.2" ry="4" fill="#8a7020" />
      <ellipse cx={kx} cy={45} rx="2.2" ry="4" fill="#6a5818" opacity="0.3" />
      {/* Escutcheon bevel */}
      <ellipse cx={kx} cy={45} rx="2.2" ry="4" fill="none" stroke="#b09828" strokeWidth="0.25" opacity="0.45" />
      {/* Decorative scrollwork on plate */}
      <path d={`M${kx - 1.2},42 Q${kx},41.5 ${kx + 1.2},42`} stroke="#c8a838" strokeWidth="0.2" fill="none" opacity="0.35" />
      <path d={`M${kx - 1.2},48 Q${kx},48.5 ${kx + 1.2},48`} stroke="#c8a838" strokeWidth="0.2" fill="none" opacity="0.35" />
      {/* Round knob */}
      <circle cx={kx} cy={44} r="1.6" fill="#b09828" />
      <circle cx={kx} cy={44} r="1.1" fill="#c8a838" />
      <circle cx={kx - 0.25} cy={43.6} r="0.4" fill="#e0c850" opacity="0.55" />
      {/* Keyhole */}
      <ellipse cx={kx} cy={47} rx="0.45" ry="0.6" fill="#1a1208" />
      <rect x={kx - 0.2} y={47.3} width="0.4" height="0.7" fill="#1a1208" />
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
      {/* Craftsman door trim — multiply blend lets trunk bark texture show through */}
      <div className="absolute" style={{ inset: "-12%", zIndex: 0, mixBlendMode: "multiply" }}>
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
        {/* Front face — painted wooden door with gentle warp */}
        <div
          className="absolute inset-0 rounded-t-[1px] overflow-hidden"
          style={{ backfaceVisibility: "hidden", filter: "url(#paintWarp)" }}
        >
          {isEmployer
            ? <CraftsmanDoorSVG color="blue" knobSide="left" />
            : <CraftsmanDoorSVG color="green" knobSide="right" />
          }
          {/* Canvas/linen texture — simulates paint on textured surface */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23807050' opacity='0.03'/%3E%3Crect x='0' y='0' width='2' height='1' fill='%23a09070' opacity='0.04'/%3E%3Crect x='2' y='2' width='2' height='1' fill='%23605030' opacity='0.04'/%3E%3C/svg%3E")`,
              backgroundSize: "3px 3px",
              mixBlendMode: "overlay",
              opacity: 0.7,
            }}
          />
          {/* Warm color wash — uneven pigment like thick oil paint */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 25% 20%, rgba(220,190,100,0.1), transparent 50%),
                           radial-gradient(ellipse at 80% 60%, rgba(20,15,5,0.12), transparent 45%),
                           radial-gradient(ellipse at 50% 85%, rgba(180,150,60,0.07), transparent 40%),
                           radial-gradient(ellipse at 60% 35%, rgba(160,130,50,0.06), transparent 35%)`,
              mixBlendMode: "soft-light",
            }}
          />
          {/* Paint edge vignette — darker edges where paint pools */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              boxShadow: "inset 0 0 8px 3px rgba(10,14,4,0.4), inset 0 -2px 4px 1px rgba(10,14,4,0.2)",
              mixBlendMode: "multiply",
            }}
          />
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

      {/* Painterly glow — radial gradient instead of box-shadow for organic light feel */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          inset: "-18px",
          zIndex: -1,
          background: `radial-gradient(ellipse at center, ${glowColor}25, ${glowColor}0a 50%, transparent 75%)`,
          mixBlendMode: "screen",
          borderRadius: "8px",
        }}
        animate={{
          opacity: hovered ? 0.7 : introPlaying ? 0 : 0.15,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Idle breathing glow — soft radial pulse, no hard borders */}
      {!hovered && !introPlaying && (
        <motion.div
          className="absolute pointer-events-none"
          style={{
            inset: "-8px",
            background: `radial-gradient(ellipse at center, ${accentColor}20, transparent 70%)`,
            mixBlendMode: "screen",
            borderRadius: "6px",
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
  // Uses bark-textured gradient instead of flat solid to blend with trunk
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: isEmployer ? "45.65%" : "51.51%",
        top: "32.05vw",
        width: "4.59%",
        height: "8.24vw",
        background: "radial-gradient(ellipse at 50% 40%, rgb(18,22,10), rgb(12,16,6) 60%, rgb(14,18,8) 100%)",
        filter: "url(#barkTexture)",
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
      {/* Shared SVG filters for painterly effects */}
      <svg className="absolute w-0 h-0" aria-hidden="true">
        <defs>
          {/* Gentle paint warp — very subtle displacement to break perfect digital lines */}
          <filter id="paintWarp" x="-2%" y="-2%" width="104%" height="104%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves="4" seed="5" result="warp" />
            <feDisplacementMap in="SourceGraphic" in2="warp" scale="0.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* Bark-like texture for blackout patches */}
          <filter id="barkTexture" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04 0.09" numOctaves="5" seed="42" result="bark" />
            <feColorMatrix in="bark" type="saturate" values="0" result="barkBW" />
            <feComposite in="barkBW" in2="barkBW" operator="arithmetic" k1="0" k2="0.12" k3="0" k4="0" result="faintBark" />
            <feBlend in="SourceGraphic" in2="faintBark" mode="soft-light" />
          </filter>
        </defs>
      </svg>

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
          filter: "blur(0.4px) contrast(1.06) saturate(0.85)",
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
          filter: "blur(0.4px) contrast(1.06) saturate(0.85)",
        }}
      >
        <Door side="worker" onClick={onWorkerClick} />
      </div>
    </>
  );
}
