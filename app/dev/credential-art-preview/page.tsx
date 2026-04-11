"use client";

/**
 * Credential Art Preview — dev-only tuning page.
 *
 * Pre-populated with pnw_dao.pnw + the name hash the user provided so the
 * first render shows the real sample they asked for. All inputs are editable
 * so you can tune line weights, palettes, and proportions in isolation
 * before wiring the art system into the full worker credentials page.
 *
 * This page is intentionally outside the (employer) route group so it
 * doesn't require wallet connection or employer onboarding.
 */

import { useRef, useState } from "react";
import {
  CredentialCard,
  type CredentialCardHandle,
} from "@/components/credential-art/CredentialCard";
import { ExportCardButton } from "@/components/credential-art/ExportCardButton";
import {
  CREDENTIAL_TYPE_LABELS,
  type CredentialType,
  type CredentialStatus,
} from "@/src/stores/credential_store";

// Pre-populated with the real pnw_dao.pnw name hash the user provided
const DEFAULT_SEED =
  "2799329730299227402922864368934752110359530977217366040351776574486990205182";
const DEFAULT_NAME = "pnw_dao.pnw";
const DEFAULT_TYPE: CredentialType = "clearance";
const DEFAULT_SCOPE = "Diamond Security Clearance";
const DEFAULT_STATUS: CredentialStatus = "active";

const CREDENTIAL_TYPES: CredentialType[] = [
  "employment_verified",
  "skills",
  "clearance",
  "custom",
];

const STATUSES: CredentialStatus[] = ["active", "pending", "revoked"];

export default function CredentialArtPreviewPage() {
  const [seed, setSeed] = useState(DEFAULT_SEED);
  const [workerName, setWorkerName] = useState(DEFAULT_NAME);
  const [credentialType, setCredentialType] =
    useState<CredentialType>(DEFAULT_TYPE);
  const [scope, setScope] = useState(DEFAULT_SCOPE);
  const [status, setStatus] = useState<CredentialStatus>(DEFAULT_STATUS);

  const cardRef = useRef<CredentialCardHandle | null>(null);

  // Attempt to render; if the seed is invalid, show an error panel instead of crashing
  let renderError: string | null = null;
  try {
    // Touch the seed validation path
    if (seed.trim().length === 0) throw new Error("Seed is required");
  } catch (err) {
    renderError = err instanceof Error ? err.message : String(err);
  }

  return (
    <div className="min-h-screen bg-[#030810] text-slate-200 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Credential Art Preview
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Dev-only tuning page for the generative topographic credential NFT
            art system. Pre-populated with the pnw_dao.pnw diamond security
            clearance sample.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                Seed (hex, 0x-hex, or decimal field element)
              </label>
              <textarea
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                spellCheck={false}
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Accepts a .pnw name hash (decimal), a credential_id hex, or any
                32-byte seed.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                Worker .pnw name
              </label>
              <input
                type="text"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                Credential type
              </label>
              <select
                value={credentialType}
                onChange={(e) =>
                  setCredentialType(e.target.value as CredentialType)
                }
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {CREDENTIAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CREDENTIAL_TYPE_LABELS[t]} ({t})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                Scope
              </label>
              <input
                type="text"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-400 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as CredentialStatus)}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2">
                Credential type palettes
              </h3>
              <ul className="space-y-1 text-xs text-slate-300">
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-cyan-400 mr-2 align-middle" />
                  Employment Verified — cyan ink on navy
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-yellow-300 mr-2 align-middle" />
                  Skills — gold ink on navy
                </li>
                <li>
                  <span
                    className="inline-block w-3 h-3 rounded-full mr-2 align-middle"
                    style={{ background: "#fef9e7" }}
                  />
                  Clearance — pale parchment ink on navy
                </li>
                <li>
                  <span className="inline-block w-3 h-3 rounded-full bg-green-400 mr-2 align-middle" />
                  Custom — forest ink on navy
                </li>
              </ul>
            </div>
          </div>

          {/* Rendered card */}
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
              {renderError ? (
                <div className="w-[400px] h-[600px] flex items-center justify-center text-red-400 text-sm">
                  {renderError}
                </div>
              ) : (
                <CredentialCard
                  ref={cardRef}
                  seed={seed}
                  credentialType={credentialType}
                  workerName={workerName}
                  scope={scope}
                  status={status}
                />
              )}
            </div>

            <div className="flex gap-2">
              <ExportCardButton
                cardRef={cardRef}
                fileName={`credential-preview-${workerName.replace(/\./g, "_")}`}
                label="Download PNG"
                className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
              />
            </div>

            <p className="max-w-sm text-center text-[11px] text-slate-500">
              The image above is deterministic: the same seed + credential type
              always produces pixel-identical output. Edit any input to see it
              re-render live.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
