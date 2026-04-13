# PNW Employment Portal

**Privacy-first payroll on Aleo — the employer and worker web portal for Proven National Workers.**

---

## What This Is

The PNW Employment Portal is a Next.js dApp where employers onboard workers, run private payroll, issue verifiable credentials with generative topographic art, and authorize audits — and where workers view their paystubs, credentials, and job offers. No plaintext wages, identities, or employment data ever leave the browser unencrypted. Everything sensitive lives in private Aleo records decoded locally by the connected wallet.

The portal has no traditional backend database. Two lightweight Next.js API routes (`app/api/terms/upload` and `app/api/terms/lookup`) proxy encrypted agreement terms to Pinata IPFS using a server-side `PINATA_JWT` — but these routes only handle already-encrypted ciphertext. The encryption key never leaves the client.

This repo is the **UI and orchestration layer** — it sits on top of the on-chain programs defined in [`pnw_mvp_v2`](https://github.com/PNWBNW/pnw_mvp_v2). The master project repo is [`pnw`](https://github.com/PNWBNW/pnw).

---

## How This Repo Fits

```
┌───────────────────────────────────────────────────────────┐
│  LAYER 3 — Employment Portal (this repo)                  │
│  UI · ManifestCompiler · SettlementCoordinator ·          │
│  CredentialArtEngine · WalletRecordScanners · PDFs        │
│                        ↓ adapter calls                    │
├───────────────────────────────────────────────────────────┤
│  LAYER 2 — NFT Commitment Programs (pnw_mvp_v2)          │
│  payroll_nfts_v2 · credential_nft_v3 · audit_nft         │
├───────────────────────────────────────────────────────────┤
│  LAYER 1 — Core Programs (pnw_mvp_v2)                    │
│  payroll_core_v2 · employer_agreement_v4 ·                │
│  paystub_receipts · payroll_audit_log ·                   │
│  pnw_name_registry_v2 · employer_license_registry · ...   │
├───────────────────────────────────────────────────────────┤
│  Aleo Testnet                                             │
└───────────────────────────────────────────────────────────┘
```

| Responsibility | This repo | pnw_mvp_v2 |
|---|---|---|
| Leo programs (on-chain logic) | Never | Owns all |
| Adapter / execution boundary | Copies from pnw_mvp_v2 | Source of truth |
| Payroll manifest compilation | Owns | — |
| Settlement orchestration | Owns | — |
| Generative credential art | Owns | — |
| Wallet record scanning | Owns | — |
| Client-side PDF generation | Owns | — |
| UI / UX | Owns | — |

The portal **never calls `snarkos` directly**. All on-chain interaction goes through the adapter layer in `src/lib/pnw-adapter/`, synced from `pnw_mvp_v2`. See [docs/INTEROP.md](./docs/INTEROP.md) for the sync protocol.

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
| @provablehq/aleo-wallet-adaptor-* | 0.3.0-alpha.3 | Wallet connection (Shield, Puzzle, Leo, Fox, Soter) |
| Vitest | 4.x | Unit tests |

---

## Project Status

| Phase | Status | What it delivered |
|-------|--------|-------------------|
| E1–E4 | Done | Scaffold, key manager, worker list, payroll table UI, manifest compiler |
| E5 | Done | Settlement Coordinator (monolithic `execute_payroll` path) |
| E6 | Done | Run status UI with on-chain receipt scanning |
| E7 | Done | Batch anchor finalizer via `payroll_nfts_v2.aleo` |
| E8 | Done | Receipt viewer, credential issuer |
| E9 | Done | Audit authorization flow, worker portal stubs |
| Post-E9 | Done | Official wallet adapters (5 wallets), cinematic landing page |
| **E10** | **Done (2026-04-10)** | End-to-end testnet happy path — payroll + anchor confirmed |
| **E11** | **Done (2026-04-12)** | Multi-worker payroll (3 workers), USDCx double-spend fix, filling progress bar |
| **Credentials** | **Done (2026-04-12)** | `credential_nft_v3` with on-chain auth, dual-record mint, generative topographic art, worker + employer galleries, PNG download, PDF print |
| **Paystubs** | **Done (2026-04-12)** | Worker paystub viewer via wallet scan (no view key), PDF print with credential badge thumbnails |
| **Identity** | **Done (2026-04-12)** | Wallet-switch identity reset, on-chain `.pnw` name resolution |
| Mobile | Pending | Responsive formatting polish |

---

## Privacy Guarantees

1. **No sensitive data in any database.** Private keys, view keys, wages, names, and addresses live in session memory only. No backend server, no database.
2. **No plaintext on public chain state.** Public mappings hold only hashes and anchors — enforced by `pnw_mvp_v2` programs.
3. **Encrypted agreement terms.** Employment terms are AES-256-GCM encrypted client-side before IPFS pin. Only the two parties hold the decryption key.
4. **Client-side PDFs.** Paystubs, credential certificates, and audit authorizations are generated entirely in the browser. No upload, no third-party service.
5. **Deterministic credential art.** Each credential's visual is a pure function of its BLAKE3 hash — rendered on Canvas client-side, no image stored anywhere.
6. **Immutable manifests.** `PayrollRunManifest` is content-addressed by BLAKE3; `batch_id` changes if any row changes.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/BUILD_ORDER.md](./docs/BUILD_ORDER.md) | Phase-by-phase build plan with exit criteria |
| [docs/EMPLOYER_FLOWS.md](./docs/EMPLOYER_FLOWS.md) | All employer UX flows (session → payroll → credentials → audit) |
| [docs/HANDSHAKE.md](./docs/HANDSHAKE.md) | Agreement handshake protocol (encrypted IPFS + on-chain broadcast) |
| [docs/INTEROP.md](./docs/INTEROP.md) | Cross-repo sync contract with pnw_mvp_v2 |
| [docs/PAYROLL_RUN_MANIFEST.md](./docs/PAYROLL_RUN_MANIFEST.md) | Manifest data contract (locked spec) |
| [docs/DESIGN_BRIEF.md](./docs/DESIGN_BRIEF.md) | Visual design brief for UI improvements |
| [docs/nft_plan.md](./docs/nft_plan.md) | Generative topographic credential NFT art system |

---

## License

Proprietary — PNW Smart Contract License v1.7. See the master repo [`LICENSE.md`](https://github.com/PNWBNW/pnw/blob/main/LICENSE.md).
