# Repo Structure — PNW Employment Portal

> This is the target structure for the `pnw_employment_portal_v1` repo.
> Build phases (E1–E9) fill this in progressively. Stubs are created early.
> See `BUILD_ORDER.md` for which phase creates which file.

---

## Top-Level Layout

```
pnw_employment_portal_v1/
├── CLAUDE.md                     ← session context (copy from employer_portal/CLAUDE.md)
├── ARCHITECTURE.md               ← copy from employer_portal/ARCHITECTURE.md
├── TECH_STACK.md                 ← copy from employer_portal/TECH_STACK.md
├── INTEROP.md                    ← copy from employer_portal/INTEROP.md
├── PAYROLL_RUN_MANIFEST.md       ← copy from employer_portal/PAYROLL_RUN_MANIFEST.md
├── EMPLOYER_FLOWS.md             ← copy from employer_portal/EMPLOYER_FLOWS.md
├── BUILD_ORDER.md                ← copy from employer_portal/BUILD_ORDER.md
│
├── .env.example                  ← env var template (no secrets)
├── .env.local                    ← real secrets (gitignored)
├── .gitignore
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── tailwind.config.ts
├── vitest.config.ts
│
├── app/                          ← Next.js App Router
├── components/                   ← shared UI components
├── src/                          ← portal logic (non-UI)
└── public/                       ← static assets
```

---

## `app/` — Next.js App Router

```
app/
├── layout.tsx                    ← root layout: fonts, providers, session guard
├── page.tsx                      ← landing / login / connect wallet
├── globals.css
│
├── (employer)/                   ← employer-authenticated route group
│   ├── layout.tsx                ← checks employer session; redirects to / if none
│   ├── dashboard/
│   │   └── page.tsx              ← employer dashboard (worker count, USDCx, pending items)
│   ├── workers/
│   │   ├── page.tsx              ← worker list with agreement statuses
│   │   ├── onboard/
│   │   │   └── page.tsx          ← onboarding form → QR code generation
│   │   └── [worker_id]/
│   │       ├── page.tsx          ← worker detail + agreement status
│   │       └── agreement/
│   │           └── page.tsx      ← agreement lifecycle (pause/terminate/supersede)
│   ├── payroll/
│   │   ├── page.tsx              ← payroll run history list
│   │   ├── new/
│   │   │   └── page.tsx          ← payroll table builder + manifest preview
│   │   └── [run_id]/
│   │       └── page.tsx          ← run status: chunks, tx IDs, receipts, anchor
│   ├── credentials/
│   │   ├── page.tsx              ← credential list
│   │   ├── issue/
│   │   │   └── page.tsx          ← issue credential form
│   │   └── [credential_id]/
│   │       └── page.tsx          ← credential detail + revoke
│   └── audit/
│       ├── page.tsx              ← audit log + pending requests
│       └── request/
│           └── page.tsx          ← new audit authorization request form
│
└── (worker)/                     ← worker-authenticated route group (stub, post-E9)
    ├── layout.tsx                ← checks worker session
    ├── dashboard/
    │   └── page.tsx
    └── paystubs/
        └── page.tsx
```

---

## `components/` — Shared UI Components

```
components/
│
├── ui/                           ← shadcn/ui generated components (do not edit)
│   ├── button.tsx
│   ├── table.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── badge.tsx
│   ├── card.tsx
│   ├── tabs.tsx
│   ├── toast.tsx
│   ├── form.tsx
│   └── ... (others as needed)
│
├── key-manager/
│   ├── KeyManagerProvider.tsx    ← session context provider; wraps root layout
│   ├── ConnectWalletModal.tsx    ← wallet connection (Path A)
│   ├── EnterKeysModal.tsx        ← direct key entry (Path B)
│   └── useAleoSession.ts         ← hook: { address, view_key, sign }
│
├── payroll-table/
│   ├── PayrollTable.tsx          ← TanStack Table with inline editing
│   ├── PayrollTableRow.tsx       ← single editable row
│   ├── PayrollTableToolbar.tsx   ← add row, import CSV, totals summary
│   ├── PayrollTableValidation.tsx← per-row + run-level validation display
│   └── columns.ts                ← TanStack column definitions
│
├── run-status/
│   ├── RunStatusBanner.tsx       ← top-level run state (draft / proving / settled)
│   ├── ChunkStatusList.tsx       ← per-chunk status rows
│   ├── ChunkStatusRow.tsx        ← chunk: index, workers, status badge, tx ID
│   └── RunSummary.tsx            ← totals, anchor hash, timestamp
│
├── pdf/
│   ├── PaystubPDF.tsx            ← @react-pdf/renderer paystub document
│   ├── CredentialCertPDF.tsx     ← credential certificate
│   ├── AuditAuthPDF.tsx          ← audit authorization certificate
│   └── DownloadPDFButton.tsx     ← renders PDF and triggers download
│
├── qr/
│   ├── OnboardingQRCode.tsx      ← react-qr-code wrapper for onboarding QR
│   └── OnboardingQRSheet.tsx     ← full sheet: QR + printable instructions
│
└── nav/
    ├── EmployerNav.tsx           ← sidebar navigation for employer routes
    └── TopBar.tsx                ← top bar: address display, session indicator
```

---

## `src/` — Portal Logic (Non-UI)

```
src/
│
├── lib/
│   └── pnw-adapter/              ← COPIED from pnw_mvp_v2 (see INTEROP.md)
│       ├── aleo_cli_adapter.ts   ← execution boundary
│       ├── layer1_adapter.ts     ← L1 program/transition mapping
│       ├── layer2_adapter.ts     ← L2 program/transition mapping
│       ├── layer1_router.ts      ← L1 call plan types (WorkerPayArgs, BatchPayrollWorker)
│       ├── layer2_router.ts      ← L2 call plan types
│       ├── canonical_encoder.ts  ← TLV encoding + BLAKE3
│       ├── canonical_types.ts    ← CanonicalHashes type
│       ├── hash.ts               ← domain-separated hashing
│       ├── merkle.ts             ← Merkle tree construction + proofs
│       ├── token_id.ts           ← NFT token ID derivation
│       ├── aleo_types.ts         ← Address, Field, U8..U128, Bytes32
│       └── aleo_records.ts       ← opaque record type aliases
│
├── manifest/
│   ├── types.ts                  ← PayrollRunManifest, PayrollRow, ChunkPlan types
│   ├── compiler.ts               ← table input → deterministic manifest
│   ├── chunk_planner.ts          ← manifest → ChunkPlan[]
│   ├── compiler.test.ts          ← Vitest: row hashing, batch_id determinism
│   └── chunk_planner.test.ts     ← Vitest: chunking edge cases
│
├── coordinator/
│   ├── settlement_coordinator.ts ← drives adapter per chunk; run state machine
│   ├── receipt_reconciler.ts     ← maps receipts → manifest rows
│   └── receipt_reconciler.test.ts← Vitest: payroll_inputs_hash matching
│
├── anchor/
│   ├── batch_anchor_finalizer.ts ← mints cycle NFT after all chunks settle
│   └── batch_anchor_finalizer.test.ts
│
├── onboarding/
│   ├── qr_payload.ts             ← QR code payload schema + encoder/decoder
│   ├── onboarding_workflow.ts    ← wraps pnw_mvp_v2 onboarding_workflow.ts
│   └── qr_payload.test.ts
│
├── records/
│   ├── usdcx_scanner.ts          ← scans employer's USDCx records via view key
│   ├── receipt_scanner.ts        ← scans paystub receipts via view key
│   └── agreement_reader.ts       ← reads employer's agreement records
│
├── config/
│   ├── programs.ts               ← program ID registry (mirrors testnet.manifest.json)
│   └── env.ts                    ← env var loading (NEXT_PUBLIC_ALEO_ENDPOINT, etc.)
│
└── stores/
    ├── payroll_run_store.ts       ← Zustand: PayrollRunManifest state machine
    ├── session_store.ts           ← Zustand: Aleo session (address, view_key)
    └── worker_store.ts            ← Zustand: cached decoded worker records
```

---

## `public/` — Static Assets

```
public/
├── logo.svg
├── logo-dark.svg
└── favicon.ico
```

---

## Configuration Files

### `next.config.ts`
```typescript
import type { NextConfig } from 'next';

const config: NextConfig = {
  // Treat as client-first static app for testnet
  // output: 'export',   // Uncomment for fully static build (Tauri / IPFS)

  // Allow WASM for @provablehq/sdk
  webpack: (config) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true };
    return config;
  },
};

export default config;
```

### `.env.example`
```bash
# Aleo RPC endpoint
NEXT_PUBLIC_ALEO_ENDPOINT=https://api.explorer.provable.com/v1/testnet
NEXT_PUBLIC_NETWORK=testnet

# Session variables (never committed — entered by user at runtime)
# ALEO_PRIVATE_KEY=APrivateKey1...
# ALEO_VIEW_KEY=AViewKey1...
# ALEO_ADDRESS=aleo1...
```

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "bundler",
    "paths": {
      "@/components/*": ["./components/*"],
      "@/src/*": ["./src/*"],
      "@/app/*": ["./app/*"]
    }
  }
}
```

---

## File Ownership Rules

| Directory | Owned by | Never touched by |
|-----------|---------|-----------------|
| `components/ui/` | shadcn/ui CLI | Humans (regenerate, do not edit) |
| `src/lib/pnw-adapter/` | pnw_mvp_v2 sync | Portal development (edit in source) |
| `src/manifest/` | This repo | pnw_mvp_v2 |
| `src/coordinator/` | This repo | pnw_mvp_v2 |
| `app/` | This repo | pnw_mvp_v2 |
| `components/` (non-ui) | This repo | pnw_mvp_v2 |
