"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface FooterCTAProps {
  onEmployerClick: () => void;
  onWorkerClick: () => void;
}

export function FooterCTA({ onEmployerClick, onWorkerClick }: FooterCTAProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { margin: "-10% 0px", once: false });

  return (
    <div
      ref={ref}
      className="relative min-h-[60vh] flex items-center justify-center px-6"
      style={{
        background:
          "linear-gradient(180deg, rgba(3,8,16,0.85) 0%, rgba(0,0,0,0.92) 100%)",
      }}
    >
      {/* Faint root glow from above */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-32"
        style={{
          background:
            "linear-gradient(180deg, var(--pnw-cyan-400), transparent)",
          opacity: 0.2,
        }}
      />

      <motion.div
        className="relative z-10 text-center max-w-lg"
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ duration: 0.8 }}
      >
        <h3
          className="text-2xl sm:text-3xl font-bold mb-3"
          style={{ color: "var(--pnw-section-heading)" }}
        >
          Enter the Portal
        </h3>
        <p className="text-sm text-gray-400 mb-8">
          Choose your path. Your keys, your data, your session.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <motion.button
            onClick={onEmployerClick}
            className="px-8 py-3 rounded-lg text-sm font-semibold tracking-wide transition-all"
            style={{
              background: "var(--pnw-employer)",
              color: "#fff",
              boxShadow: "0 0 20px var(--pnw-employer-glow)",
            }}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 35px var(--pnw-employer-glow)",
            }}
            whileTap={{ scale: 0.97 }}
          >
            Employer Portal
          </motion.button>
          <motion.button
            onClick={onWorkerClick}
            className="px-8 py-3 rounded-lg text-sm font-semibold tracking-wide transition-all"
            style={{
              background: "var(--pnw-worker)",
              color: "#fff",
              boxShadow: "0 0 20px var(--pnw-worker-glow)",
            }}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 35px var(--pnw-worker-glow)",
            }}
            whileTap={{ scale: 0.97 }}
          >
            Worker Portal
          </motion.button>
        </div>

        <p className="text-[10px] text-gray-500 mt-6">
          Keys are stored in session memory only. Closing this tab clears all
          data.
        </p>
      </motion.div>
    </div>
  );
}
