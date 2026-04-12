# CLAUDE.md — PNW Employment Portal

> Read this file first at the start of every session. It survives context compression.
> This is the single source of truth for project context, architecture, and tech decisions.

---

## What This Project Is

**PNW Employment Portal** — the employer-facing UI for the Proven National Workers
privacy-first payroll framework. This repo is a Next.js web application (dApp-style,
no backend server) that sits on top of `pnw_mvp_v2` and lets employers:

- Onboard workers (QR code flow → on-chain agreement anchoring)
- Run payroll for 1–25+ workers in a single portal action
- View private payroll history (decoded locally via view key)
- Issue and revoke employee credentials
- Initiate dual-consent audit authorizations
- Generate client-side PDFs for paystubs, credentials, and audit docs

The closest analogy is QuickBooks meets a blockchain payroll client — but zero
plaintext wage or identity data ever leaves the user's session.

**Companion repo:** `pnw_mvp_v2` owns all Leo programs, adapters, manifests, and
commitment primitives. This portal consumes them. It never owns on-chain logic.

---

## Active Branch

`main` is stable. All development goes on `feature/...` or `claude/...` branches.

---

## Commit Message Rules

- Plain descriptive text only.
- Never append `https://claude.ai/...` session links.
- Format: `<scope>: <what changed>` (e.g., `manifest: add chunk_planner`, `ui: payroll table row validation`)

---

## Toolchain

| Tool | Version | Notes |
|------|---------|-------|
| Node | 20 | LTS |
| pnpm | 9.x | Package manager |
| Next.js | 16 (App Router) | Framework — client-first, no backend |
| TypeScript | 5.x strict | No `any` except at adapter boundary |
| React | 19.x | UI library |
| Tailwind | 4.x | Utility-first styling |
| shadcn/ui | latest | Radix UI primitives, copied into `components/ui/` |
| TanStack Table | 8.x | Headless payroll table with inline editing |
| Zustand | 5.x | State management (payroll run state machine) |
| @noble/hashes | 2.x | BLAKE3 hashing (must match pnw_mvp_v2) |
| jspdf | 4.x | Client-side PDF generation |
| Framer Motion | 12.x | Landing page animations only |
| Wallet adapters | 0.3.0-alpha.3 | @provablehq/aleo-wallet-adaptor-* (5 wallets) |
| Vitest | 4.x | Unit tests |

### What We Are NOT Using

| Technology | Reason |
|-----------|--------|
| tRPC / GraphQL | No server; all data from Aleo RPC + session |
| Prisma / Postgres | No database; no persistent storage of private data |
| NextAuth / Clerk | No traditional auth; session = Aleo wallet connection |
| Redux | Zustand is sufficient with less boilerplate |
| React Query | Direct fetch from Aleo REST API is enough for MVP |
| @demox-labs/aleo-wallet-adapter-* | Replaced by official @provablehq/aleo-wallet-adaptor-* |
| @react-pdf/renderer | Replaced by jspdf (lighter, simpler) |

---

## Architecture

### Layer Model

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3 — Employment Portal (this repo)                        │
│                                                                 │
│  PayrollRunManifest  →  ChunkPlanner  →  SettlementCoordinator │
│       ↑                                        ↓               │
│  PayrollTableUI                        Layer 1/2 Adapter        │
│                                                ↓               │
├────────────────────────────────────────────────┼────────────────┤
│  LAYER 2 — NFT Commitment Programs             │ snarkos        │
│  payroll_nfts.aleo / credential_nft.aleo /     │ developer      │
│  audit_nft.aleo                                │ execute        │
├────────────────────────────────────────────────┼────────────────┤
│  LAYER 1 — Core Programs                       │               │
│  payroll_core.aleo / paystub_receipts.aleo /   ▼               │
│  employer_agreement_v2.aleo / ...          Aleo Testnet         │
└─────────────────────────────────────────────────────────────────┘
```

**Rule:** Layer 3 plans. Layer 1 settles. Layer 2 anchors. The portal never owns
on-chain state.

### Data Flow — Full Payroll Run

```
1. Employer fills payroll table
   → ManifestCompiler.compile(rows)
   → PayrollRunManifest {batch_id, rows[], row_root, doc_hash}
2. ChunkPlanner.plan(manifest)
   → ChunkPlan[] (1 row per chunk, deterministic order)
3. SettlementCoordinator.execute(manifest, chunks, employer_usdcx)
   → For each chunk: build WorkerPayArgs → push to adapter → collect receipts
   → ReceiptReconciler.match(receipts, manifest) → update row status
4. All chunks settled
   → BatchAnchorFinalizer.anchor(manifest) → mint cycle NFT
5. Run status: anchored
```

### Component Map

| Component | File | Purpose |
|-----------|------|---------|
| Manifest Compiler | `src/manifest/compiler.ts` | Table rows → deterministic manifest (row hashes, batch_id, row_root) |
| Chunk Planner | `src/manifest/chunk_planner.ts` | Manifest → ordered ChunkPlan[] |
| Settlement Coordinator | `src/coordinator/settlement_coordinator.ts` | Executes chunks via adapter; retry logic; state machine |
| Receipt Reconciler | `src/coordinator/receipt_reconciler.ts` | Maps returned receipts → manifest rows via payroll_inputs_hash |
| Batch Anchor Finalizer | `src/anchor/batch_anchor_finalizer.ts` | Mints cycle NFT with batch_root after all rows settle |

### Settlement State Machine

**Per run:**
```
draft → validated → queued → proving → broadcasting
  → partially_settled → settled → anchored
  → failed → needs_retry (operator intervention)
```

**Per chunk:**
```
pending → proving → broadcasting → settled | failed
```

Retries: transient failures get 3 attempts with exponential backoff. On-chain
reverts (double-pay) are not retried.

### Authentication Model

**Path A — Wallet Connection (Primary):**
Official `@provablehq/aleo-wallet-adaptor-*` (v0.3.0-alpha.3). Five wallets:
Shield, Puzzle, Leo, Fox, Soter. Mobile support via in-app browser redirect.

**Path B — Direct Key Entry (Fallback):**
User pastes private key + view key into session-only input. Held in
`sessionStorage`, cleared on tab close. For testnet testing without wallet extension.

### On-Chain Programs Called

All calls go through `src/lib/pnw-adapter/`. Never call `snarkos` directly.

**Layer 1:**
| Action | Program | Transition |
|--------|---------|------------|
| Create worker profile | `worker_profiles.aleo` | `create_worker_profile` |
| Create agreement | `employer_agreement_v2.aleo` | `create_job_offer` |
| Accept agreement | `employer_agreement_v2.aleo` | `accept_job_offer` |
| Pause/terminate/resume | `employer_agreement_v2.aleo` | respective transitions |
| Settle payroll (1 worker) | `payroll_core.aleo` | `execute_payroll` |
| Settle payroll (2 workers) | `payroll_core.aleo` | `execute_payroll_batch_2` |

**Layer 2:**
| Action | Program | Transition |
|--------|---------|------------|
| Anchor payroll run | `payroll_nfts.aleo` | `mint_cycle_nft` |
| Issue credential | `credential_nft.aleo` | `mint_credential_nft` |
| Revoke credential | `credential_nft.aleo` | `revoke_credential_nft` |
| Mint audit authorization | `audit_nft.aleo` | `mint_authorization_nft` |
| Anchor audit attestation | `audit_nft.aleo` | `anchor_audit_attestation` |

### Privacy Model

| Data | Where it lives | Who can see |
|------|---------------|-------------|
| Private keys / view keys | Session memory only | User who entered them |
| Worker addresses | Session memory; passed to adapter at execution | Employer |
| Wage amounts | Private Aleo records (decoded via view key) | Record owner only |
| Name hashes | Public chain | Anyone (hash only) |
| Agreement anchors | Public chain | Anyone (commitment only) |
| batch_id / row_root | Public chain (in cycle NFT) | Anyone (hash only) |
| PayrollRunManifest | Session memory + local storage | Employer who created it |
| PDFs | Client-side only | User who generated them |

---

## Architecture Invariants (Never Break These)

1. **No private keys, view keys, wages, names, or addresses stored in any database.**
   All sensitive values live in session memory only (`sessionStorage` or React state).
2. **No real credentials committed to git.** Env vars and `.env.local` (gitignored).
3. **No plaintext identity or salary on public chain state.** Public mappings hold
   hashes and anchors only. This is enforced by `pnw_mvp_v2` programs.
4. **PDFs generated client-side only.** No upload. No third-party PDF service.
5. **Adapter is the only execution boundary.** The portal never calls `snarkos` directly.
   All on-chain calls go through `src/lib/pnw-adapter/` (copied from `pnw_mvp_v2`).
6. **PayrollRunManifest is immutable once compiled.** Never mutate a compiled manifest.
   Create a new one. `batch_id` = BLAKE3(canonical manifest bytes); it changes if rows change.
7. **Settlement Coordinator is idempotent per row.** If a chunk fails, retry only that
   chunk using the same manifest. Never re-derive row hashes mid-run.

---

## Key Decisions (Durable)

| Date | Decision |
|------|----------|
| 2026-03-15 | Next.js 16 App Router + shadcn/ui + TanStack Table |
| 2026-03-15 | Zustand for payroll run state machine |
| 2026-03-15 | Copy-on-change interop with pnw_mvp_v2 (npm package post-MVP) |
| 2026-03-15 | Employer-first build; worker side added after E8 |
| 2026-03-15 | Option B: batch_id + row_hash in WorkerPayArgs (locked in pnw_mvp_v2) |
| 2026-03-15 | Single-worker settlement is the canonical settlement primitive |
| 2026-03-15 | batch_root anchored once per run via existing payroll_nfts.aleo cycle NFT |
| 2026-03-15 | Tauri desktop packaging deferred to post-MVP |
| 2026-03-16 | Official @provablehq/aleo-wallet-adaptor-* for wallet connection |
| 2026-03-16 | WalletMultiButton + WalletModalProvider (official Provable UI) |
| 2026-03-16 | jspdf replaces @react-pdf/renderer for PDF generation |
| 2026-03-16 | Cinematic landing page with Framer Motion animations |
| 2026-03-16 | Mobile wallet connect via in-app browser redirect (Leo/Fox) |

---

## File Map

### App Routes (Next.js App Router)

```
app/
├── layout.tsx                           ← root layout: fonts, metadata
├── providers.tsx                        ← client boundary: wallet + key manager providers
├── page.tsx                             ← cinematic landing page
│
├── (employer)/                          ← employer route group
│   ├── layout.tsx                       ← employer session guard
│   ├── dashboard/page.tsx               ← employer dashboard
│   ├── workers/
│   │   ├── page.tsx                     ← worker list with agreement statuses
│   │   ├── onboard/page.tsx             ← onboarding form → QR code
│   │   ├── onboard/confirm/page.tsx     ← onboarding confirmation
│   │   └── [worker_id]/page.tsx         ← worker detail + agreement status
│   ├── payroll/
│   │   ├── page.tsx                     ← payroll run history
│   │   ├── new/page.tsx                 ← payroll table builder + manifest preview
│   │   └── [run_id]/page.tsx            ← run status: chunks, tx IDs, anchor
│   ├── credentials/
│   │   ├── page.tsx                     ← credential list
│   │   ├── issue/page.tsx               ← issue credential form
│   │   └── [credential_id]/page.tsx     ← credential detail + revoke
│   ├── audit/
│   │   ├── page.tsx                     ← audit log + pending requests
│   │   └── request/page.tsx             ← new audit authorization request
│   └── dev/verify-employer/page.tsx     ← dev-only employer verification tool
│
└── worker/                              ← worker route group
    ├── layout.tsx                       ← worker session guard
    ├── dashboard/page.tsx               ← worker dashboard
    ├── offers/page.tsx                  ← pending job offers
    ├── offers/review/page.tsx           ← review + accept offer
    └── paystubs/page.tsx                ← paystub list (decoded via view key)
```

### Components

```
components/
├── ui/                                  ← shadcn/ui (generated, do not edit)
├── key-manager/                         ← session context: KeyManagerProvider, useAleoSession
├── landing/                             ← cinematic landing: hero, doors, animations, CTA
├── onboarding/                          ← offer form, QR display, acceptance, verification
├── employer-onboarding/                 ← employer profile + name registration
├── worker-onboarding/                   ← worker profile + name registration
├── payroll-table/                       ← TanStack Table spreadsheet editor
├── run-status/                          ← chunk-level status tracker
├── pdf/                                 ← paystub, credential, audit PDFs (jspdf)
└── nav/                                 ← EmployerNav sidebar, TopBar
```

### Portal Logic (`src/`)

```
src/
├── manifest/                            ← PayrollRunManifest types, compiler, chunk planner
├── coordinator/                         ← settlement coordinator, receipt reconciler
├── anchor/                              ← batch anchor finalizer (cycle NFT minting)
├── audit/                               ← audit authorization actions
├── credentials/                         ← credential issue/revoke actions
├── handshake/                           ← agreement handshake engine, codec, types
├── persistence/                         ← encrypted draft storage (AES + HMAC)
├── records/                             ← USDCx scanner, receipt scanner, agreement reader
├── registry/                            ← name registry lookups, profile types
├── stores/                              ← Zustand stores:
│   ├── session_store.ts                 ←   Aleo session (address, view_key)
│   ├── payroll_run_store.ts             ←   PayrollRunManifest state machine
│   ├── worker_store.ts                  ←   cached decoded worker records
│   ├── credential_store.ts              ←   credential lifecycle
│   ├── audit_store.ts                   ←   audit request state
│   ├── offer_store.ts                   ←   job offer state
│   ├── employer_identity_store.ts       ←   employer identity
│   └── worker_identity_store.ts         ←   worker identity
├── config/
│   ├── programs.ts                      ← program ID registry (mirrors testnet.manifest.json)
│   └── env.ts                           ← env var loading
└── lib/
    ├── pnw-adapter/                     ← COPIED from pnw_mvp_v2 (see INTEROP.md)
    │   ├── aleo_cli_adapter.ts          ← execution boundary
    │   ├── layer1_adapter.ts            ← L1 program/transition mapping
    │   ├── layer2_adapter.ts            ← L2 program/transition mapping
    │   ├── layer1_router.ts             ← L1 call plan types (WorkerPayArgs)
    │   ├── layer2_router.ts             ← L2 call plan types
    │   ├── canonical_encoder.ts         ← TLV encoding + BLAKE3
    │   ├── canonical_types.ts           ← CanonicalHashes type
    │   ├── hash.ts                      ← domain-separated hashing
    │   ├── merkle.ts                    ← Merkle tree construction + proofs
    │   ├── token_id.ts                  ← NFT token ID derivation
    │   ├── aleo_types.ts                ← Address, Field, U8..U128, Bytes32
    │   ├── aleo_records.ts              ← opaque record type aliases
    │   ├── credentials_manager.ts       ← credential record management
    │   ├── roster_credentials_manager.ts← roster credential management
    │   ├── roster_tree_builder.ts       ← roster Merkle tree
    │   ├── freeze_list_resolver.ts      ← freeze list lookups
    │   └── sealance_types.ts            ← sealance type definitions
    ├── wallet/
    │   ├── wallet-provider.tsx           ← AleoWalletProviderWrapper + mobile redirect
    │   ├── wallet-executor.ts            ← wallet-based transaction execution
    │   ├── credential-signer.ts          ← wallet-based credential signing
    │   └── useTransactionExecutor.ts     ← React hook for transaction execution
    └── utils.ts                          ← shared utilities (cn, etc.)
```

### Tests (15 test files)

```
src/manifest/compiler.test.ts             src/coordinator/settlement_coordinator.test.ts
src/manifest/chunk_planner.test.ts        src/coordinator/receipt_reconciler.test.ts
src/manifest/validation.test.ts           src/anchor/batch_anchor_finalizer.test.ts
src/audit/audit_actions.test.ts           src/lib/wallet/credential-signer.test.ts
src/lib/pnw-adapter/hash.test.ts          src/records/usdcx_scanner.test.ts
src/lib/pnw-adapter/merkle.test.ts        src/persistence/__tests__/draft_encryptor.test.ts
src/lib/pnw-adapter/roster_tree_builder.test.ts
src/persistence/__tests__/draft_integrity.test.ts
src/persistence/__tests__/key_provider.test.ts
```

### File Ownership Rules

| Directory | Owned by | Never touched by |
|-----------|---------|-----------------|
| `components/ui/` | shadcn/ui CLI | Humans (regenerate, do not edit) |
| `src/lib/pnw-adapter/` | pnw_mvp_v2 sync | Portal development (edit in source) |
| `src/manifest/` | This repo | pnw_mvp_v2 |
| `src/coordinator/` | This repo | pnw_mvp_v2 |
| `app/` | This repo | pnw_mvp_v2 |
| `components/` (non-ui) | This repo | pnw_mvp_v2 |

---

## Canonical Endpoint

```
NEXT_PUBLIC_ALEO_ENDPOINT=https://api.explorer.provable.com/v2/testnet
```

---

## pnw_mvp_v2 Dependency Map

This portal depends on these files from `pnw_mvp_v2`:

| Portal path | Source in pnw_mvp_v2 | Sync trigger |
|-------------|----------------------|--------------|
| `src/lib/pnw-adapter/aleo_cli_adapter.ts` | `portal/src/adapters/aleo_cli_adapter.ts` | Any adapter change |
| `src/lib/pnw-adapter/layer1_adapter.ts` | `portal/src/adapters/layer1_adapter.ts` | Layer 1 program change |
| `src/lib/pnw-adapter/layer2_adapter.ts` | `portal/src/adapters/layer2_adapter.ts` | Layer 2 program change |
| `src/lib/pnw-adapter/layer1_router.ts` | `portal/src/router/layer1_router.ts` | WorkerPayArgs change |
| `src/lib/pnw-adapter/layer2_router.ts` | `portal/src/router/layer2_router.ts` | Layer 2 step change |
| `src/lib/pnw-adapter/canonical_encoder.ts` | `portal/src/commitments/canonical_encoder.ts` | TLV schema change |
| `src/lib/pnw-adapter/hash.ts` | `portal/src/commitments/hash.ts` | Domain tag change |
| `src/lib/pnw-adapter/merkle.ts` | `portal/src/commitments/merkle.ts` | Merkle algorithm change |
| `src/lib/pnw-adapter/canonical_types.ts` | `portal/src/commitments/canonical_types.ts` | Type change |
| `src/lib/pnw-adapter/aleo_types.ts` | `portal/src/types/aleo_types.ts` | Type alias change |
| `src/lib/pnw-adapter/aleo_records.ts` | `portal/src/types/aleo_records.ts` | Record shape change |
| `src/config/programs.ts` | `config/testnet.manifest.json` | Program re-deploy |

Each copied file starts with:
```typescript
// Synced from pnw_mvp_v2 @ <commit-sha> on <date>
// Source: portal/src/adapters/aleo_cli_adapter.ts
// Do not edit here — edit in pnw_mvp_v2 and re-sync.
```

---

## Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| E1 | Done | Scaffold + key manager + config |
| E2 | Done | Worker list + agreement status (from on-chain FinalAgreement records) |
| E3 | Done | Payroll table UI |
| E4 | Done | Manifest compiler |
| E5 | Done | Settlement Coordinator (sequential 4-step path for Shield compatibility) |
| E6 | Done | Run status UI (now sources history from on-chain receipts) |
| E7 | Done | Batch anchor finalizer via `payroll_nfts_v2.aleo` |
| E8 | Done | Receipt viewer + credential issuer |
| E9 | Done | Audit authorization flow |
| Post-E9 | Done | Official wallet adapters + cinematic landing page |
| **E10** | **Done (2026-04-10)** | **End-to-end testnet happy path succeeded** |
| E11 | In progress | Hardening: multi-worker, double-pay protection, error recovery |
| Mobile polish | Pending | Responsive formatting in employer portal |

### E10 Milestone Log (2026-04-10)

First successful end-to-end private payroll + anchor:

| Step | TX ID |
|---|---|
| 1. Verify agreement (`employer_agreement_v4::assert_agreement_active`) | `at1mydsktdsr8pk7d4utzrp6n2rvtgkkpavthukyt4kpdadgyx5lg8sgljea3` |
| 2. Transfer USDCx (`test_usdcx_stablecoin::transfer_private`) | `at1yphn8n9zejqnnsktuev7rl9vkv8styq00rjpffa0h7rxnccssyyqdk9ltw` |
| 3. Mint receipts (`paystub_receipts::mint_paystub_receipts`) | `at1w86wy80c9sgv0e2ukwlzja4r4km0vkld2tna586t9447q6pjvvrqhuvnw4` |
| 4. Anchor event (`payroll_audit_log::anchor_event`) | `at1jp6mertn92hpn79uak8vdy9t4ha2t0f4fwq877uy6rmjl20g0syqdzygp3` |
| 5. Mint payroll anchor NFT (`payroll_nfts_v2::mint_cycle_nft`) | `at1d8ht598hqqjgmqfxjwvt0cf47aqafgynzjhazhtreze6j22hzcrq5992r5` |

### Architecture Notes from E10

**Why sequential 4-step payroll instead of monolithic `execute_payroll`:**
Shield wallet's in-browser WASM prover silently drops `execute_payroll` (5-program proof) — the transaction returns a wallet-internal ID but never reaches the network and `transactionStatus()` returns "not found" forever. Splitting into 4 independent transactions lets each proof build successfully. `src/coordinator/settlement_coordinator.ts::executeSequentialPayroll` implements this.

**Critical Shield wallet flag:** `privateFee: false` must be passed to `executeTransaction` — without it Shield tries to use a private credits record for the fee, can't resolve it, and drops the proof silently.

**Merkle exclusion proof:** Uses `@provablehq/sdk` `SealanceMerkleTree` with Poseidon4 hashing and `TREE_DEPTH = 16` to match the on-chain `MerkleProof` struct (`siblings: [field; 16]`).

**Payroll history scanning (no localStorage):**
`src/records/payroll_history_scanner.ts` reads `EmployerPaystubReceipt` records via the wallet's `requestRecords` and groups them by `(employer_name_hash, epoch_id)` into historical runs. The `audit_event_hash` needed for anchor minting is recomputed deterministically from `payroll_inputs_hash` + `receipt_anchor` using the same formula as the manifest compiler.

**Deprecated: `payroll_nfts.aleo` (v1)**
Was `@noupgrade` with `employer_agreement_v2` imports. `payroll_nfts_v2.aleo` replaces it (imports v4). See `pnw_mvp_v2/src/layer2/payroll_nfts_v2.aleo/`.

### E11 Next Steps
- [ ] Multi-worker payroll (batch_2 path via sequential flow)
- [ ] Double-pay protection — the original `execute_payroll` wrote to `paid_epoch` in its finalize. The sequential flow lost this. Options: portal-side guard via manifest, or deploy a standalone `mark_epoch_paid` transition
- [ ] Step failure recovery — if Step 3 fails after Step 2 committed USDCx, we need a "resume from step 3" UI instead of restarting the whole run
- [ ] Local PDF storage in IndexedDB keyed by `batch_id` + BLAKE3 `doc_hash` passed to `mint_cycle_nft` (doc_hash is already a private field in the PayrollNFT record)
- [ ] Mobile/responsive polish
- [ ] Worker portal paystub viewer (scans `WorkerPaystubReceipt` records the same way)

See `docs/BUILD_ORDER.md` for exit criteria on each phase.

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| `docs/BUILD_ORDER.md` | Phase-by-phase build plan with exit criteria |
| `docs/EMPLOYER_FLOWS.md` | All employer UX flows (session → payroll → credentials → audit) |
| `docs/HANDSHAKE.md` | Agreement handshake protocol (direct on-chain broadcast) |
| `docs/INTEROP.md` | Cross-repo sync contract with pnw_mvp_v2 |
| `docs/PAYROLL_RUN_MANIFEST.md` | Manifest data contract (locked spec) |
| `docs/DESIGN_BRIEF.md` | Visual design brief for UI improvements |
| `docs/nft_plan.md` | Generative topographic credential NFT art — design, hash chain, anti-collision proof, dual-record mint |
