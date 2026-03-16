"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

interface Section {
  id: string;
  tag: string;
  title: string;
  body: string;
  accent: string;
  icon: React.ReactNode;
}

const sections: Section[] = [
  {
    id: "what",
    tag: "01",
    title: "What is PNW?",
    body: "Proven National Workers is a privacy-first payroll framework on the Aleo blockchain. No plaintext wages, names, or addresses ever leave your session. Every payroll action is cryptographically committed — verifiable without revealing private data.",
    accent: "var(--pnw-gold-300)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: "security",
    tag: "02",
    title: "Zero-Knowledge Security",
    body: "Zero-knowledge proofs verify payroll correctness without revealing amounts. Private keys never leave your session. On-chain state holds only hashes and anchors — never plaintext. Client-side PDFs, client-side encryption, always.",
    accent: "var(--pnw-cyan-400)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: "goal",
    tag: "03",
    title: "Dignity by Default",
    body: "A world where every worker — from Pacific Northwest farmhands to urban contractors — can prove their employment history without surrendering their privacy. Payroll that respects people. Compliance without compromise.",
    accent: "var(--pnw-gold-500)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

function ScrollSection({
  section,
}: {
  section: Section;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { margin: "-15% 0px -15% 0px", once: false });

  return (
    <div
      ref={ref}
      className="relative min-h-[60vh] flex items-center justify-center px-6 py-16"
    >
      {/* Subtle dark vignette behind text for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(3,8,16,0.5) 0%, rgba(3,8,16,0.2) 60%, transparent 100%)",
        }}
      />

      {/* Content */}
      <motion.div
        className="relative z-10 max-w-2xl text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Section number */}
        <motion.div
          className="inline-flex items-center gap-3 mb-4"
          initial={{ opacity: 0, x: -20 }}
          animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <span
            className="font-mono text-xs tracking-widest uppercase"
            style={{ color: section.accent, opacity: 0.7 }}
          >
            {section.tag}
          </span>
          <div
            className="h-px w-8"
            style={{ background: section.accent, opacity: 0.4 }}
          />
        </motion.div>

        {/* Icon */}
        <motion.div
          className="mx-auto mb-4"
          style={{ color: section.accent }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={isInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {section.icon}
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 tracking-tight"
          style={{ color: "var(--pnw-section-heading)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          {section.title}
        </motion.h2>

        {/* Body */}
        <motion.p
          className="text-sm sm:text-base leading-relaxed"
          style={{ color: "var(--pnw-section-text)", opacity: 0.85 }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          {section.body}
        </motion.p>

        {/* Accent underline */}
        <motion.div
          className="mx-auto mt-6 h-0.5 rounded-full"
          style={{ background: section.accent, width: "60px" }}
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        />
      </motion.div>
    </div>
  );
}

export function CinematicSections() {
  return (
    <div className="relative">
      {sections.map((section, i) => (
        <ScrollSection key={section.id} section={section} />
      ))}
    </div>
  );
}
