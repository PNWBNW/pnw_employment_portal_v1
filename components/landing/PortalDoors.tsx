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

  return (
    <motion.button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer group"
      style={{
        width: "clamp(60px, 8vw, 100px)",
        height: "clamp(80px, 12vw, 150px)",
      }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Door base shape */}
      <div
        className="absolute inset-0 rounded-t-lg transition-all duration-500"
        style={{
          border: `2px solid ${color}`,
          background: hovered
            ? `linear-gradient(180deg, ${glowColor} 0%, rgba(255,255,255,0.15) 50%, ${glowColor} 100%)`
            : "rgba(0,0,0,0.3)",
          boxShadow: hovered
            ? `0 0 40px ${glowColor}, inset 0 0 30px rgba(255,255,255,0.2)`
            : `0 0 10px rgba(0,0,0,0.3)`,
          transform: hovered
            ? "perspective(400px) rotateY(-8deg)"
            : "perspective(400px) rotateY(0deg)",
          transformOrigin: isEmployer ? "left center" : "right center",
          transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        {/* Door handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-3 rounded-full"
          style={{
            [isEmployer ? "right" : "left"]: "15%",
            background: hovered ? "#ffd700" : "#8b8b8b",
            boxShadow: hovered ? "0 0 8px #ffd700" : "none",
            transition: "all 0.5s",
          }}
        />

        {/* Light spill from inside when door "opens" */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 rounded-t-lg overflow-hidden"
            >
              <div
                className="absolute inset-0"
                style={{
                  background: `radial-gradient(ellipse at ${isEmployer ? "80%" : "20%"} 60%, rgba(255,220,100,0.4) 0%, transparent 70%)`,
                }}
              />
              {/* Light rays */}
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="absolute bottom-0"
                  style={{
                    left: isEmployer ? `${60 + i * 12}%` : `${10 + i * 12}%`,
                    width: "2px",
                    height: `${40 + i * 15}%`,
                    background: `linear-gradient(to top, rgba(255,220,100,0.5), transparent)`,
                    transform: `rotate(${isEmployer ? 5 - i * 5 : -5 + i * 5}deg)`,
                    transformOrigin: "bottom",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

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
              <p
                className="text-sm font-semibold"
                style={{ color }}
              >
                {label}
              </p>
              <p className="text-[10px] text-gray-300 mt-0.5">{sublabel}</p>
            </div>
            {/* Arrow */}
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
        /* Position over the two doors in the hero image center */
        left: "50%",
        top: "50%",
        transform: "translate(-52%, -18%)",
      }}
    >
      <Door side="employer" onClick={onEmployerClick} />
      <Door side="worker" onClick={onWorkerClick} />
    </div>
  );
}
