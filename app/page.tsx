"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAleoSession } from "@/components/key-manager/useAleoSession";
import { EnterKeysModal } from "@/components/key-manager/EnterKeysModal";
import { ConnectWalletModal } from "@/components/key-manager/ConnectWalletModal";

const STORY_SECTIONS = [
  {
    eyebrow: "What is PNW",
    title: "A cinematic payroll portal built on cryptographic certainty",
    body: "PNW gives employers and workers a shared truth for payroll. Every run is deterministic, every receipt is traceable, and every step is designed for privacy-first operations on Aleo.",
  },
  {
    eyebrow: "How it works",
    title: "From manifest to settlement to anchored proof",
    body: "Payroll rows become canonical manifests. Manifests become chunked settlements. Settlements become provable outcomes and immutable anchors—so finance teams can operate fast without losing trust.",
  },
  {
    eyebrow: "Who it is for",
    title: "Designed for both employers and workers",
    body: "Employers orchestrate payroll runs and monitor settlement health. Workers receive transparent paystub and record continuity. One ecosystem, two clear experiences.",
  },
  {
    eyebrow: "Why teams choose PNW",
    title: "Fewer blind spots. More confidence.",
    body: "Real-time run status, deterministic reconciliation, and explicit audit surfaces reduce ambiguity. Teams spend less time hunting errors and more time shipping payroll.",
  },
  {
    eyebrow: "Security by design",
    title: "Privacy-first controls without sacrificing usability",
    body: "Session-scoped keys, deterministic hashing, and explicit run states create a hardened workflow that still feels approachable for day-to-day operators.",
  },
];

export default function LandingPage() {
  const { isConnected } = useAleoSession();
  const router = useRouter();
  const [showKeys, setShowKeys] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  useEffect(() => {
    if (isConnected) {
      router.push("/dashboard");
    }
  }, [isConnected, router]);

  return (
    <div className="pnw-landing bg-background text-foreground">
      <section className="hero-shell relative overflow-hidden">
        <div className="hero-backdrop" aria-hidden="true" />
        <div className="hero-overlay" aria-hidden="true" />

        <div className="hero-content relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-12 md:pt-16">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="hero-kicker">PROVEN NATIONAL WORKERS</p>
            <h1 className="hero-title">Enter the PNW Employment Portal</h1>
            <p className="hero-subtitle">
              Follow the roots from cryptographic proof to payroll clarity.
              Choose your path and step into a privacy-first system designed for
              real payroll operations.
            </p>
          </div>

          <div className="door-stage" role="group" aria-label="Choose a portal">
            <div className="door-card employer-door">
              <div className="door-light" aria-hidden="true" />
              <div className="door-body" aria-hidden="true" />
              <div className="door-content">
                <h2>Employer Portal</h2>
                <p>
                  Run payroll, monitor settlement status, and manage worker
                  records from one operator console.
                </p>
                <div className="door-actions">
                  <button
                    onClick={() => setShowWallet(true)}
                    className="door-btn door-btn-muted"
                  >
                    Connect Wallet
                  </button>
                  <button
                    onClick={() => setShowKeys(true)}
                    className="door-btn door-btn-primary"
                  >
                    Enter Keys
                  </button>
                </div>
              </div>
            </div>

            <div className="door-card worker-door">
              <div className="door-light" aria-hidden="true" />
              <div className="door-body" aria-hidden="true" />
              <div className="door-content">
                <h2>Worker Portal</h2>
                <p>
                  Access your worker experience and prepare for upcoming
                  paystub-focused workflows.
                </p>
                <div className="door-actions">
                  <button
                    onClick={() => router.push("/worker/dashboard")}
                    className="door-btn door-btn-primary"
                  >
                    Enter Worker Site
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="hero-footnote text-center text-xs text-muted-foreground">
            Keys are stored in session memory only. Closing this tab clears all
            session data.
          </p>
        </div>

        <div className="root-stream" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, index) => (
            <span
              key={`root-${index}`}
              className="root-branch"
              style={{
                left: `${6 + index * 6}%`,
                animationDelay: `${index * 0.22}s`,
              }}
            />
          ))}
          {Array.from({ length: 48 }).map((_, index) => (
            <span
              key={`bit-${index}`}
              className="binary-bit"
              style={{
                left: `${(index * 17) % 100}%`,
                animationDelay: `${(index % 9) * 0.7}s`,
                animationDuration: `${6 + (index % 5)}s`,
              }}
            >
              {index % 2}
            </span>
          ))}
        </div>
      </section>

      <section className="story-shell">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="story-grid">
            {STORY_SECTIONS.map((section, index) => (
              <article
                key={section.eyebrow}
                className="story-card"
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <p className="story-eyebrow">{section.eyebrow}</p>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <EnterKeysModal open={showKeys} onClose={() => setShowKeys(false)} />
      <ConnectWalletModal
        open={showWallet}
        onClose={() => setShowWallet(false)}
      />
    </div>
  );
}
