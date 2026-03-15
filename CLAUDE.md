# CLAUDE.md — PNW Employment Portal (Employer Side)

> Read this file first at the start of every session. It survives context compression.
> This file lives in `pnw_mvp_v2/employer_portal/` during design phase.
> When the new repo is created, this file moves to the root of `pnw_employment_portal_v1`.

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
| Next.js | 15 (App Router) | Framework |
| TypeScript | 5.x strict | No `any` except at adapter boundary |
| Tailwind | 3.x | Styling |
| shadcn/ui | latest | Component library |
| Vitest | latest | Tests |

---

## Architecture in One Paragraph

The portal is **Layer 3** — it sits above the Aleo blockchain (Layer 1) and the NFT
commitment programs (Layer 2). It owns payroll planning, manifest compilation, chunk
execution, receipt reconciliation, and UI. It never executes Leo programs directly —
it calls the adapter from `pnw_mvp_v2` which generates `snarkos developer execute`
commands. The central data object is the **PayrollRunManifest**: a deterministic,
hashable description of a full payroll run that the Settlement Coordinator uses to
drive chunk-by-chunk on-chain settlement.

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
| 2026-03-15 | Next.js 15 App Router + shadcn/ui + TanStack Table |
| 2026-03-15 | Zustand for payroll run state machine |
| 2026-03-15 | Copy-on-change interop with pnw_mvp_v2 (npm package post-MVP) |
| 2026-03-15 | Employer-first build; worker side added after E8 |
| 2026-03-15 | Option B: batch_id + row_hash in WorkerPayArgs (locked in pnw_mvp_v2) |
| 2026-03-15 | Single-worker settlement is the canonical settlement primitive |
| 2026-03-15 | batch_root anchored once per run via existing payroll_nfts.aleo cycle NFT |
| 2026-03-15 | Tauri desktop packaging deferred to post-MVP |

---

## File Map

### Layer 3 Portal Logic (off-chain, TypeScript)
- `src/lib/pnw-adapter/` — copied from `pnw_mvp_v2/portal/src/adapters/` + `router/` + `commitments/`
- `src/manifest/types.ts` — `PayrollRunManifest`, `PayrollRow`, `ChunkPlan` types
- `src/manifest/compiler.ts` — table input → deterministic manifest (row hashes, batch_id, row_root)
- `src/manifest/chunk_planner.ts` — manifest → ordered list of settlement chunks
- `src/coordinator/settlement_coordinator.ts` — drives adapter per chunk, tracks state
- `src/coordinator/receipt_reconciler.ts` — maps returned Layer 1 records → manifest rows
- `src/anchor/batch_anchor_finalizer.ts` — mints cycle NFT with batch_root after all rows settle

### UI (Next.js App Router)
- `app/(employer)/dashboard/` — employer dashboard
- `app/(employer)/workers/` — worker list, onboarding, agreements
- `app/(employer)/payroll/new/` — payroll table builder
- `app/(employer)/payroll/[run_id]/` — run status + chunk tracking
- `app/(employer)/credentials/` — issue / revoke
- `app/(employer)/audit/` — request audit authorization
- `app/(worker)/` — worker-side routes (stub, filled in post-E8)

### Components
- `components/payroll-table/` — TanStack Table spreadsheet-style editor
- `components/run-status/` — chunk-level status tracker
- `components/key-manager/` — private key + view key session management
- `components/pdf/` — paystub, credential, audit authorization PDFs

### Config
- `src/config/programs.ts` — mirrors `pnw_mvp_v2/config/testnet.manifest.json`
- `src/config/env.ts` — env var loading

---

## Canonical Endpoint

```
NEXT_PUBLIC_ALEO_ENDPOINT=https://api.explorer.provable.com/v1/testnet
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
| E1 | ⏳ Pending | Scaffold + key manager + config |
| E2 | ⏳ Pending | Worker list + agreement status |
| E3 | ⏳ Pending | Payroll table UI |
| E4 | ⏳ Pending | Manifest compiler |
| E5 | ⏳ Pending | Settlement Coordinator |
| E6 | ⏳ Pending | Run status UI |
| E7 | ⏳ Pending | Batch anchor finalizer |
| E8 | ⏳ Pending | Receipt viewer + credential issuer |
| E9 | ⏳ Pending | Audit authorization flow |
| Worker side | ⏳ Pending | After E9 |

See `BUILD_ORDER.md` for exit criteria on each phase.
