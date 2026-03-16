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
    body: "Proven National Workers is a privacy-first payroll framework built on the Aleo blockchain. No plaintext wages, names, or addresses ever leave your session. Every payroll action is cryptographically committed — verifiable without revealing private data.",
    accent: "var(--pnw-gold-300)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: "who",
    tag: "02",
    title: "Who is PNW for?",
    body: "Employers who run payroll for 1–25+ workers and demand real privacy. Agricultural operations, small businesses, contractors — anyone who believes wage data should be nobody's business but the worker's and employer's.",
    accent: "var(--pnw-forest-300)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    id: "why",
    tag: "03",
    title: "Why we built PNW",
    body: "Current payroll systems leak sensitive data across databases, APIs, and third-party processors. We built PNW because workers deserve dignity — their compensation is private, their identity is sovereign, and compliance shouldn't require surveillance.",
    accent: "var(--pnw-sky-400)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "security",
    tag: "04",
    title: "How we keep PNW secure",
    body: "Zero-knowledge proofs verify payroll correctness without revealing amounts. Private keys never leave your session. View keys decode only your own records. On-chain state holds hashes and anchors — never plaintext. Client-side PDFs, client-side encryption, always.",
    accent: "var(--pnw-cyan-400)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: "inner",
    tag: "05",
    title: "The inner workings",
    body: "A PayrollRunManifest deterministically encodes every row. The Settlement Coordinator drives chunk-by-chunk on-chain settlement. Receipt Reconciler matches returned records. Batch Anchor Finalizer mints a cycle NFT embedding the Merkle root of the entire run. Every step is idempotent and auditable.",
    accent: "var(--pnw-cyan-200)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    id: "goal",
    tag: "06",
    title: "The goal of PNW",
    body: "A world where every worker — from Pacific Northwest farmhands to urban contractors — can prove their employment history without surrendering their privacy. Payroll that respects people. Compliance without compromise. Dignity by default.",
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
  index,
}: {
  section: Section;
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { margin: "-20% 0px -20% 0px", once: false });

  return (
    <div
      ref={ref}
      className="relative min-h-screen flex items-center justify-center px-6"
    >
      {/* Background — mostly transparent so roots image shows through as backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(3,8,16,0.55) 0%, rgba(3,8,16,0.3) 60%, rgba(3,8,16,0.15) 100%)`,
        }}
      />

      {/* Horizontal accent line */}
      <motion.div
        className="absolute left-0 right-0"
        style={{ top: "50%", height: "1px" }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={
          isInView
            ? { scaleX: 1, opacity: 0.1 }
            : { scaleX: 0, opacity: 0 }
        }
        transition={{ duration: 1.2, ease: "easeOut" }}
      >
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${section.accent}, transparent)`,
          }}
        />
      </motion.div>

      {/* Content */}
      <motion.div
        className="relative z-10 max-w-2xl text-center"
        initial={{ opacity: 0, y: 40 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        {/* Section number */}
        <motion.div
          className="inline-flex items-center gap-3 mb-6"
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
          className="mx-auto mb-6"
          style={{ color: section.accent }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={
            isInView
              ? { opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.5 }
          }
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          {section.icon}
        </motion.div>

        {/* Title */}
        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 tracking-tight"
          style={{ color: "var(--pnw-section-heading)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          {section.title}
        </motion.h2>

        {/* Body */}
        <motion.p
          className="text-base sm:text-lg leading-relaxed"
          style={{ color: "var(--pnw-section-text)", opacity: 0.85 }}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.7, delay: 0.5 }}
        >
          {section.body}
        </motion.p>

        {/* Accent underline */}
        <motion.div
          className="mx-auto mt-8 h-0.5 rounded-full"
          style={{ background: section.accent, width: "60px" }}
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
        />
      </motion.div>

      {/* Side root tendrils decoration */}
      <div className="absolute left-0 top-0 bottom-0 w-px opacity-[0.08]">
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(180deg, transparent, ${section.accent}, transparent)`,
          }}
        />
      </div>
      <div className="absolute right-0 top-0 bottom-0 w-px opacity-[0.08]">
        <div
          className="w-full h-full"
          style={{
            background: `linear-gradient(180deg, transparent, ${section.accent}, transparent)`,
          }}
        />
      </div>
    </div>
  );
}

export function CinematicSections() {
  return (
    <div className="relative">
      {sections.map((section, i) => (
        <ScrollSection key={section.id} section={section} index={i} />
      ))}
    </div>
  );
}
