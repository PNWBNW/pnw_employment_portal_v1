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
    body: "A privacy-first payroll framework on the Aleo blockchain. No plaintext wages, names, or addresses ever leave your session. Every payroll action is cryptographically committed — verifiable without revealing private data.",
    accent: "var(--pnw-gold-300)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
  },
  {
    id: "who",
    tag: "02",
    title: "Who is PNW for?",
    body: "Employers who run payroll for 1–25+ workers and demand real privacy. Agricultural operations, small businesses, contractors — anyone who believes wage data is nobody's business but the worker's and employer's.",
    accent: "var(--pnw-forest-300)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
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
    body: "Current payroll systems leak sensitive data across databases, APIs, and processors. Workers deserve dignity — their compensation is private, their identity is sovereign, and compliance shouldn't require surveillance.",
    accent: "var(--pnw-sky-400)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: "security",
    tag: "04",
    title: "Zero-Knowledge Security",
    body: "Zero-knowledge proofs verify payroll correctness without revealing amounts. Private keys never leave your session. On-chain state holds only hashes and anchors — never plaintext. Client-side everything, always.",
    accent: "var(--pnw-cyan-400)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  },
  {
    id: "inner",
    tag: "05",
    title: "The Inner Workings",
    body: "A PayrollRunManifest encodes every row deterministically. The Settlement Coordinator drives chunk-by-chunk on-chain settlement. Batch Anchor Finalizer mints a cycle NFT embedding the Merkle root. Every step is idempotent and auditable.",
    accent: "var(--pnw-cyan-200)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
        <line x1="12" y1="2" x2="12" y2="22" />
      </svg>
    ),
  },
  {
    id: "goal",
    tag: "06",
    title: "Dignity by Default",
    body: "A world where every worker — from Pacific Northwest farmhands to urban contractors — can prove their employment history without surrendering their privacy. Payroll that respects people. Compliance without compromise.",
    accent: "var(--pnw-gold-500)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
];

function SectionCard({
  section,
  delay,
}: {
  section: Section;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { margin: "-10% 0px -10% 0px", once: false });

  return (
    <motion.div
      ref={ref}
      className="relative text-center px-6 py-10"
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Section number */}
      <div className="inline-flex items-center gap-2 mb-3">
        <span
          className="font-mono text-[10px] tracking-widest uppercase"
          style={{ color: section.accent, opacity: 0.7 }}
        >
          {section.tag}
        </span>
        <div
          className="h-px w-6"
          style={{ background: section.accent, opacity: 0.4 }}
        />
      </div>

      {/* Icon */}
      <div className="mx-auto mb-3" style={{ color: section.accent }}>
        {section.icon}
      </div>

      {/* Title */}
      <h2
        className="text-xl sm:text-2xl font-bold mb-3 tracking-tight"
        style={{ color: "var(--pnw-section-heading)" }}
      >
        {section.title}
      </h2>

      {/* Body */}
      <p
        className="text-sm leading-relaxed max-w-sm mx-auto"
        style={{ color: "var(--pnw-section-text)", opacity: 0.85 }}
      >
        {section.body}
      </p>

      {/* Accent underline */}
      <motion.div
        className="mx-auto mt-4 h-0.5 rounded-full"
        style={{ background: section.accent, width: "40px" }}
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : { scaleX: 0 }}
        transition={{ duration: 0.6, delay: delay + 0.3 }}
      />
    </motion.div>
  );
}

export function CinematicSections() {
  // Pair sections into rows of 2
  const rows: Section[][] = [];
  for (let i = 0; i < sections.length; i += 2) {
    rows.push(sections.slice(i, i + 2));
  }

  return (
    <div className="relative py-16">
      {/* Subtle dark vignette behind all descriptors for readability */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 50%, rgba(3,8,16,0.5) 0%, rgba(3,8,16,0.2) 60%, transparent 100%)",
        }}
      />

      <div className="relative z-10 max-w-5xl mx-auto">
        {rows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 mb-8"
          >
            {row.map((section, colIdx) => (
              <SectionCard
                key={section.id}
                section={section}
                delay={colIdx * 0.15}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
