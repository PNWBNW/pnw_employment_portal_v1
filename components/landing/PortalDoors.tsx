"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface DoorProps {
  side: "employer" | "worker";
  onClick: () => void;
}

function Door({ side, onClick }: DoorProps) {
  const [hovered, setHovered] = useState(false);

  const isEmployer = side === "employer";
  const color = isEmployer ? "var(--pnw-employer)" : "var(--pnw-worker)";
  const glowColor = isEmployer
    ? "var(--pnw-employer-glow)"
    : "var(--pnw-worker-glow)";
  const label = isEmployer ? "Employer Portal" : "Worker Portal";
  const sublabel = isEmployer
    ? "Manage payroll, credentials & compliance"
    : "View paystubs, agreements & documents";

  // Employer = left-hand swing (hinges on LEFT, opens revealing LEFT edge)
  // Worker   = right-hand swing (hinges on RIGHT, opens revealing RIGHT edge)
  const hingeOrigin = isEmployer ? "right center" : "left center";

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer"
      style={{
        width: "clamp(50px, 6.5vw, 90px)",
        height: "clamp(70px, 10vw, 140px)",
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
        animate={{
          rotateY: hovered
            ? isEmployer ? -25 : 25
            : 0,
        }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* The door face — semi-transparent overlay matching the painted door */}
        <div
          className="absolute inset-0 rounded-t-sm"
          style={{
            background: hovered
              ? `linear-gradient(180deg, rgba(255,240,200,0.08) 0%, rgba(255,220,100,0.04) 100%)`
              : "transparent",
            borderTop: hovered ? "1px solid rgba(255,230,140,0.15)" : "1px solid transparent",
            transition: "all 0.4s",
          }}
        />
      </motion.div>

      {/* Light pouring from behind the opened door — fixed position, doesn't rotate */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="absolute inset-0 pointer-events-none overflow-visible"
          >
            {/* Bright vertical gap light on the HINGE side (where the opening crack is) */}
            <div
              className="absolute top-[5%] bottom-[5%]"
              style={{
                [isEmployer ? "right" : "left"]: "-1px",
                width: "4px",
                background: "linear-gradient(180deg, rgba(255,240,180,0.1) 0%, rgba(255,235,150,0.7) 20%, rgba(255,245,200,0.9) 50%, rgba(255,235,150,0.7) 80%, rgba(255,240,180,0.1) 100%)",
                boxShadow: "0 0 12px rgba(255,220,100,0.6), 0 0 24px rgba(255,200,50,0.3)",
                borderRadius: "2px",
              }}
            />

            {/* Warm interior glow spreading from the open crack */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at ${isEmployer ? "90%" : "10%"} 50%, rgba(255,230,140,0.35) 0%, rgba(255,210,80,0.15) 30%, transparent 65%)`,
              }}
            />

            {/* Ground light pool */}
            <div
              className="absolute left-[-30%] right-[-30%]"
              style={{
                bottom: "-20%",
                height: "35%",
                background: `radial-gradient(ellipse at 50% 0%, rgba(255,220,100,0.25) 0%, transparent 70%)`,
                filter: "blur(6px)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
    <div
      className="absolute z-20 flex gap-[0.5vw]"
      style={{
        /* Position over the painted doors in pnw-tree.png.
           Doors are at ~32% of image height. Image = 150vw tall.
           On a 16:9 screen, 32% of image = ~85% of viewport height.
           Use % of hero (h-screen) with a vw-based calculation. */
        left: "50%",
        top: "min(48vw, 82vh)",
        transform: "translate(-50%, -50%)",
      }}
    >
      <Door side="employer" onClick={onEmployerClick} />
      <Door side="worker" onClick={onWorkerClick} />
    </div>
  );
}
