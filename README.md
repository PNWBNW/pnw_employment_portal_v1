# PNW Employment Portal

**Privacy-first payroll on Aleo — the employer-facing web portal for Proven National Workers.**

---

## Vision

Proven National Workers (PNW) is a payroll framework where **zero plaintext wage or
identity data ever leaves the user's session**. Employers onboard workers, run payroll,
issue credentials, and authorize audits — all through a browser-based portal that
talks directly to the Aleo blockchain. No server database. No third-party services
touching private data. Think QuickBooks meets a blockchain payroll client, but with
real privacy guarantees enforced by zero-knowledge proofs.

This repo is the **employer-facing web application** — the UI layer that sits on top
of the on-chain programs defined in [`pnw_mvp_v2`](https://github.com/PNWBNW/pnw_mvp_v2).

---

## How This Repo Fits

```
┌───────────────────────────────────────────────────────┐
│  LAYER 3 — Employment Portal (this repo)              │
│  UI · Manifest Compiler · Settlement Coordinator      │
│                        ↓ adapter calls                │
├───────────────────────────────────────────────────────┤
│  LAYER 2 — NFT Commitment Programs (pnw_mvp_v2)      │
│  payroll_nfts.aleo · credential_nft.aleo · audit_nft  │
├───────────────────────────────────────────────────────┤
│  LAYER 1 — Core Programs (pnw_mvp_v2)                │
│  payroll_core.aleo · employer_agreement_v2.aleo · ... │
├───────────────────────────────────────────────────────┤
│  Aleo Testnet                                         │
└───────────────────────────────────────────────────────┘
```

| Responsibility | This repo | pnw_mvp_v2 |
|----------------|-----------|------------|
| Leo programs (on-chain logic) | Never | Owns all |
| Adapter / execution boundary | Copies from pnw_mvp_v2 | Source of truth |
| Payroll manifest compilation | Owns | — |
| Settlement orchestration | Owns | — |
| UI / UX | Owns | — |
| Cryptographic commitments | Copies hash + encoder | Source of truth |

The portal **never calls `snarkos` directly**. All on-chain interaction goes through
the adapter layer in `src/lib/pnw-adapter/`, which is synced from `pnw_mvp_v2`.
See [INTEROP.md](./INTEROP.md) for the sync protocol.

---

## Quick Start

```bash
# Prerequisites: Node 20+, pnpm 9+
git clone https://github.com/PNWBNW/pnw_employment_portal_v1.git
cd pnw_employment_portal_v1

pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # Vitest unit tests
pnpm build        # Production build
pnpm typecheck    # TypeScript strict check
```

Create `.env.local` from the template:
```bash
cp .env.example .env.local
# Edit NEXT_PUBLIC_ALEO_ENDPOINT if needed (defaults to Aleo testnet)
```

---

## Tech Stack

| Tool | Version | Role |
|------|---------|------|
| Next.js | 16 (App Router) | Framework — client-first dApp, no backend |
| TypeScript | 5.x strict | Language — `any` banned except adapter boundary |
| Tailwind CSS | 4.x | Styling |
| shadcn/ui | latest | Component library (Radix UI primitives) |
| TanStack Table | 8.x | Payroll table with inline editing |
| Zustand | 5.x | State management (payroll run state machine) |
| @noble/hashes | 2.x | BLAKE3 hashing (matches pnw_mvp_v2) |
| jspdf | 4.x | Client-side PDF generation |
| Framer Motion | 12.x | Landing page animations |
| @provablehq/aleo-wallet-adaptor-* | 0.3.0-alpha.3 | Wallet connection (5 wallets) |
| Vitest | 4.x | Unit tests |

---

## Project Status

| Phase | Status | What it delivered |
|-------|--------|-------------------|
| E1 | Done | Scaffold, key manager, config |
| E2 | Done | Worker list, agreement status |
| E3 | Done | Payroll table UI |
| E4 | Done | Manifest compiler |
| E5 | Done | Settlement Coordinator |
| E6 | Done | Run status UI |
| E7 | Done | Batch anchor finalizer |
| E8 | Done | Receipt viewer, credential issuer |
| E9 | Done | Audit authorization flow |
| Post-E9 | Done | Wallet adapters, cinematic landing page |
| **E10** | **Pending** | End-to-end testnet happy path |
| **Mobile** | **Pending** | Responsive formatting polish |

---

## Privacy Guarantees

1. **No private keys, view keys, wages, names, or addresses stored in any database.**
   All sensitive values live in session memory only.
2. **No plaintext identity or salary on the public chain.** Public mappings hold
   hashes and anchors only — enforced by pnw_mvp_v2 programs.
3. **PDFs generated client-side only.** No upload. No third-party PDF service.
4. **PayrollRunManifest is immutable once compiled.** Content-addressed by BLAKE3;
   `batch_id` changes if any row changes.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [CLAUDE.md](./CLAUDE.md) | Full project context — architecture, tech decisions, file map, invariants |
| [BUILD_ORDER.md](./BUILD_ORDER.md) | Phase-by-phase build plan with exit criteria |
| [EMPLOYER_FLOWS.md](./EMPLOYER_FLOWS.md) | All employer UX flows (session → payroll → credentials → audit) |
| [HANDSHAKE.md](./HANDSHAKE.md) | Two-phase agreement handshake protocol |
| [INTEROP.md](./INTEROP.md) | Cross-repo sync contract with pnw_mvp_v2 |
| [PAYROLL_RUN_MANIFEST.md](./PAYROLL_RUN_MANIFEST.md) | Manifest data contract (locked spec) |

---

## License

TBD
