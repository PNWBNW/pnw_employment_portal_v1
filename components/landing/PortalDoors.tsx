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

  // The door "opens" from the hinge side — employer hinges left, worker hinges right
  const hingeOrigin = isEmployer ? "left center" : "right center";
  // Light spills from the opening edge
  const lightSide = isEmployer ? "85%" : "15%";

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer"
      style={{
        width: "clamp(60px, 8vw, 100px)",
        height: "clamp(80px, 12vw, 150px)",
      }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Completely invisible hit area — NO border, NO background, NO outline */}
      <div
        className="absolute inset-0"
        style={{
          transformOrigin: hingeOrigin,
          transform: hovered
            ? `perspective(600px) rotateY(${isEmployer ? "-15" : "15"}deg)`
            : "perspective(600px) rotateY(0deg)",
          transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      />

      {/* Interior light spill — bright warm light pouring from the cracked-open door */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 pointer-events-none overflow-visible"
          >
            {/* Bright gap light — the crack of the open door */}
            <div
              className="absolute top-[2%] bottom-[2%]"
              style={{
                [isEmployer ? "right" : "left"]: "-2px",
                width: "6px",
                background: "linear-gradient(180deg, rgba(255,240,180,0.2) 0%, rgba(255,230,120,0.95) 15%, rgba(255,245,200,1) 50%, rgba(255,230,120,0.95) 85%, rgba(255,240,180,0.2) 100%)",
                boxShadow: "0 0 20px rgba(255,220,100,0.8), 0 0 40px rgba(255,200,50,0.4), 0 0 60px rgba(255,180,30,0.2)",
                borderRadius: "3px",
                filter: "blur(0.5px)",
              }}
            />

            {/* Interior warm glow flooding out */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(ellipse at ${lightSide} 45%, rgba(255,230,140,0.5) 0%, rgba(255,200,80,0.25) 25%, rgba(255,180,50,0.08) 50%, transparent 70%)`,
              }}
            />

            {/* Light rays fanning out from the gap */}
            {[...Array(5)].map((_, i) => {
              const angle = isEmployer
                ? -20 + i * 10  // fan from right edge leftward
                : 20 - i * 10; // fan from left edge rightward
              const rayHeight = 50 + i * 12;
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    [isEmployer ? "right" : "left"]: "0",
                    top: `${15 + i * 8}%`,
                    width: `${60 + i * 10}%`,
                    height: "2px",
                    background: `linear-gradient(${isEmployer ? "to left" : "to right"}, rgba(255,230,140,${0.5 - i * 0.08}), transparent)`,
                    transform: `rotate(${angle}deg)`,
                    transformOrigin: isEmployer ? "right center" : "left center",
                    filter: "blur(1px)",
                  }}
                />
              );
            })}

            {/* Floor light pool — light spilling onto the ground below the door */}
            <div
              className="absolute left-[-20%] right-[-20%]"
              style={{
                bottom: "-15%",
                height: "30%",
                background: "radial-gradient(ellipse at 50% 0%, rgba(255,220,100,0.3) 0%, rgba(255,200,80,0.1) 50%, transparent 80%)",
                filter: "blur(4px)",
              }}
            />

            {/* Subtle portal-colored accent at base */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[8%]"
              style={{
                background: `linear-gradient(to top, ${glowColor}, transparent)`,
                opacity: 0.5,
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
      className="absolute z-20 flex gap-[1vw]"
      style={{
        left: "50%",
        top: "55%",
        transform: "translate(-52%, -50%)",
      }}
    >
      <Door side="employer" onClick={onEmployerClick} />
      <Door side="worker" onClick={onWorkerClick} />
    </div>
  );
}
