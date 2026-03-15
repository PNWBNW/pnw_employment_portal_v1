# Build Order — PNW Employment Portal

> Phase-by-phase build plan for `pnw_employment_portal_v1`.
> Each phase has: deliverables, files created, and exit criteria.
> Start each new conversation with this file to orient quickly.
> See CLAUDE.md for session context and ARCHITECTURE.md for component details.

---

## Phase E0 — Repository Bootstrap

**Goal:** Working Next.js app with the right scaffolding. Nothing portal-specific yet.

### Tasks
1. `pnpm create next-app@latest pnw_employment_portal_v1 --typescript --tailwind --app`
2. Install dependencies: `zustand @tanstack/react-table @noble/hashes @react-pdf/renderer react-qr-code qrcode vitest @vitest/ui`
3. Init shadcn/ui: `pnpx shadcn@latest init`; choose default theme + slate base
4. Add shadcn components: `table dialog input badge card tabs toast form sheet select`
5. Set up `tsconfig.json` with strict mode + path aliases (`@/src/*`, `@/components/*`)
6. Set up `vitest.config.ts`
7. Create `.env.example`, `.gitignore`, `CLAUDE.md` (from employer_portal/CLAUDE.md)
8. Copy all markdown docs from employer_portal/ to repo root
9. Create stub directories: `src/lib/pnw-adapter/`, `src/manifest/`, `src/coordinator/`, `src/anchor/`
10. Copy pnw-adapter files from `pnw_mvp_v2/portal/src/adapters/` + `commitments/` + `types/` + `router/`
    Add sync headers to each copied file

### Files Created
```
pnw_employment_portal_v1/
├── CLAUDE.md, ARCHITECTURE.md, TECH_STACK.md, INTEROP.md,
│   PAYROLL_RUN_MANIFEST.md, EMPLOYER_FLOWS.md, BUILD_ORDER.md
├── next.config.ts
├── package.json, pnpm-lock.yaml, tsconfig.json, tailwind.config.ts, vitest.config.ts
├── .env.example, .gitignore
├── app/layout.tsx, app/page.tsx, app/globals.css
└── src/lib/pnw-adapter/   (all copied files with sync headers)
```

### Exit Criteria
- [ ] `pnpm dev` starts with no errors
- [ ] `pnpm tsc --noEmit` passes
- [ ] `pnpm test` runs (0 tests, no failures)
- [ ] shadcn Button and Table components render in `app/page.tsx` (smoke test)

---

## Phase E1 — Key Manager + Config + Root Layout

**Goal:** User can connect wallet or enter keys. Session is managed securely.
No on-chain calls yet — just the session infrastructure.

### Tasks
1. `src/stores/session_store.ts` — Zustand store for `{ address, view_key }`
   - Private key is NOT in Zustand; it lives in `sessionStorage` only
   - `getPrivateKey()` reads from `sessionStorage` each time (never cached in memory)
2. `components/key-manager/KeyManagerProvider.tsx` — wraps root layout
3. `components/key-manager/ConnectWalletModal.tsx` — placeholder (full wallet integration post-MVP)
4. `components/key-manager/EnterKeysModal.tsx` — pastes private key + view key; derives address
5. `components/key-manager/useAleoSession.ts` — hook: `{ address, view_key, isConnected, signOut }`
6. `src/config/env.ts` — `NEXT_PUBLIC_ALEO_ENDPOINT`, `NEXT_PUBLIC_NETWORK`
7. `src/config/programs.ts` — program ID registry mirroring testnet.manifest.json
8. `components/nav/EmployerNav.tsx` — sidebar nav (links only; pages are stubs)
9. `components/nav/TopBar.tsx` — address truncated, session indicator, "Disconnect"
10. `app/(employer)/layout.tsx` — auth guard; redirects to `/` if no session
11. `app/(employer)/dashboard/page.tsx` — static placeholder ("Dashboard — coming soon")

### Files Created
```
src/stores/session_store.ts
src/config/env.ts
src/config/programs.ts
components/key-manager/KeyManagerProvider.tsx
components/key-manager/ConnectWalletModal.tsx
components/key-manager/EnterKeysModal.tsx
components/key-manager/useAleoSession.ts
components/nav/EmployerNav.tsx
components/nav/TopBar.tsx
app/(employer)/layout.tsx
app/(employer)/dashboard/page.tsx
```

### Exit Criteria
- [ ] Navigating to `/` shows login/connect UI
- [ ] Entering any valid Aleo private key + view key → session created → redirect to `/employer/dashboard`
- [ ] Dashboard shows truncated address from session
- [ ] "Disconnect" clears session and redirects to `/`
- [ ] Refreshing the page preserves session (sessionStorage)
- [ ] Closing the tab clears the session

---

## Phase E2 — Worker List + Agreement Status (Read-Only)

**Goal:** Employer can see their workers and agreement statuses without making any
on-chain write calls. Requires USDCx record scanning and agreement record decoding.

### Tasks
1. `src/records/usdcx_scanner.ts` — fetch employer's Token records from Aleo REST API
   using view key; return list with `{ owner, amount }` (use `@provablehq/sdk` WASM)
2. `src/records/agreement_reader.ts` — decode employer's `FinalAgreementRecord` records
   to surface active worker list
3. `src/stores/worker_store.ts` — Zustand store for cached decoded worker records
4. `app/(employer)/workers/page.tsx` — worker list table
   - Columns: name_hash (truncated), agreement_id (truncated), status, last payroll epoch, actions
   - "Add Worker" button (links to onboard page)
5. `app/(employer)/workers/[worker_id]/page.tsx` — worker detail (read-only for now)
   - Agreement status badge (ACTIVE / PAUSED / TERMINATED)
   - Pay history (from session records, populated in E5+)
6. `app/(employer)/dashboard/page.tsx` — populated with real data:
   - Active worker count from `worker_store`
   - USDCx balance from `usdcx_scanner`

### Files Created/Updated
```
src/records/usdcx_scanner.ts
src/records/agreement_reader.ts
src/stores/worker_store.ts
app/(employer)/workers/page.tsx          (new)
app/(employer)/workers/[worker_id]/page.tsx  (new)
app/(employer)/dashboard/page.tsx        (updated)
```

### Exit Criteria
- [ ] Worker list page loads and shows at least one decoded worker (testnet)
- [ ] Dashboard shows correct USDCx balance (matches testnet record)
- [ ] Clicking a worker shows agreement status correctly
- [ ] Agreement status matches on-chain state (verify against Provable Explorer)

---

## Phase E3 — Payroll Table UI (No Execution)

**Goal:** Employer can build a payroll table, validate rows, and see totals.
No manifest compilation yet — just the table UI with validation.

### Tasks
1. `components/payroll-table/columns.ts` — TanStack Table column definitions
2. `components/payroll-table/PayrollTable.tsx` — main table with inline editing
3. `components/payroll-table/PayrollTableRow.tsx` — row with amount fields
4. `components/payroll-table/PayrollTableToolbar.tsx` — add row, import CSV, totals
5. `components/payroll-table/PayrollTableValidation.tsx` — per-row validation display
6. Row validation logic (inline in table, no external module):
   - `net === gross - tax - fee`
   - `gross > 0`, `net > 0`
   - `agreement_id` present and parseable
   - No duplicate `(agreement_id, epoch_id)` pairs
7. `app/(employer)/payroll/new/page.tsx` — full table builder page
8. Import CSV: map columns `worker,gross,tax,fee` → table rows
9. "Save Draft" → write table state to `sessionStorage`

### Files Created
```
components/payroll-table/columns.ts
components/payroll-table/PayrollTable.tsx
components/payroll-table/PayrollTableRow.tsx
components/payroll-table/PayrollTableToolbar.tsx
components/payroll-table/PayrollTableValidation.tsx
app/(employer)/payroll/new/page.tsx
app/(employer)/payroll/page.tsx        (history list — stub)
```

### Exit Criteria
- [ ] Can add 25 rows to the payroll table without performance degradation
- [ ] Row validation: `net !== gross - tax - fee` shows red X with tooltip
- [ ] Duplicate `(agreement_id, epoch_id)` shows error
- [ ] Totals row updates correctly as amounts change
- [ ] Import CSV with 5 rows populates the table correctly
- [ ] "Save Draft" persists table to sessionStorage; survives refresh

---

## Phase E4 — Manifest Compiler

**Goal:** Payroll table compiles into a deterministic `PayrollRunManifest`.
Pure TypeScript — no on-chain calls.

### Tasks
1. `src/manifest/types.ts` — all types from PAYROLL_RUN_MANIFEST.md
2. `src/manifest/compiler.ts` — table → manifest:
   - Sort rows by agreement_id
   - Assign row_index
   - Compute all canonical hashes using `canonical_encoder.ts` + `hash.ts` from pnw-adapter
   - Compute `row_hash` per row (BLAKE3("PNW::LEAF", TLV(row)))
   - Compute `row_root` via `merkle.ts`
   - Compute `batch_id`
   - Validate all invariants; throw `PayrollValidationError` with row-level detail
3. `src/manifest/chunk_planner.ts` — manifest → `ChunkPlan[]`
   - Default: 1 row per chunk
   - Assigns deterministic `chunk_id` per chunk
4. `src/manifest/compiler.test.ts` — Vitest tests:
   - Same rows → same batch_id (determinism)
   - Row order doesn't matter (stable sort)
   - Invalid net_amount → PayrollValidationError
   - Duplicate (agreement_id, epoch_id) → PayrollValidationError
   - batch_id changes when any row changes
5. `src/manifest/chunk_planner.test.ts` — chunk edge cases
6. `src/stores/payroll_run_store.ts` — Zustand state machine for manifest lifecycle
7. Update `app/(employer)/payroll/new/page.tsx`:
   - "Validate & Preview Manifest" button → calls compiler → shows manifest preview panel
   - Manifest preview: batch_id, row_root, totals, per-row row_hash

### Files Created
```
src/manifest/types.ts
src/manifest/compiler.ts
src/manifest/chunk_planner.ts
src/manifest/compiler.test.ts
src/manifest/chunk_planner.test.ts
src/stores/payroll_run_store.ts
```

### Exit Criteria
- [ ] `pnpm test` passes all compiler + chunk_planner tests
- [ ] Same 3-row table always produces the same batch_id
- [ ] Adding a worker changes batch_id
- [ ] Manifest preview shows in UI after clicking "Validate"
- [ ] `PayrollValidationError` messages appear as inline row validation in the table

---

## Phase E5 — Settlement Coordinator

**Goal:** Manifests execute. Workers get paid. The coordinator drives the adapter
per-chunk, handles retries, and reconciles receipts.

### Tasks
1. `src/coordinator/settlement_coordinator.ts` — full state machine:
   - Executes each chunk in order
   - Builds `WorkerPayArgs` from manifest row + `batch_id` + `row_hash`
   - Calls layer1 adapter (`aleo_cli_adapter.ts` equivalent for Layer 1 — or
     implement a Layer1CliAdapter mirroring the Layer2CliAdapter pattern)
   - Handles retries (3x with exponential backoff for transient errors)
   - Updates Zustand `payroll_run_store` after each chunk
2. `src/coordinator/receipt_reconciler.ts` — map receipts → manifest rows
   - Match on `payroll_inputs_hash`
   - Update row `status: "settled"`, `tx_id`
3. `src/coordinator/receipt_reconciler.test.ts` — Vitest tests
4. `src/records/receipt_scanner.ts` — scan employer's paystub receipt records via view key
5. Update `app/(employer)/payroll/new/page.tsx`:
   - "Send Payroll" button → triggers coordinator
   - Redirects to run status page on start

### Note on Layer1CliAdapter
The Layer2CliAdapter in `src/lib/pnw-adapter/aleo_cli_adapter.ts` handles Layer 2.
For Layer 1 (`payroll_core.aleo`), the portal needs a concrete Layer1CliAdapter
that calls `snarkos developer execute` for Layer 1 transitions. Build this in
`src/lib/pnw-adapter/layer1_cli_adapter.ts` following the same pattern.

### Files Created
```
src/coordinator/settlement_coordinator.ts
src/coordinator/receipt_reconciler.ts
src/coordinator/receipt_reconciler.test.ts
src/records/receipt_scanner.ts
src/lib/pnw-adapter/layer1_cli_adapter.ts  (new — not from pnw_mvp_v2)
```

### Exit Criteria
- [ ] `pnpm test` passes receipt reconciler tests
- [ ] Single-worker payroll run executes successfully on testnet
- [ ] `WorkerPayArgs.batch_id` and `row_hash` are populated from manifest
- [ ] Receipt returned from Layer 1 maps back to manifest row correctly
- [ ] Chunk retry works: simulate timeout → auto-retry → success
- [ ] Double-pay guard: re-running same epoch → `conflict` status on row, run continues

---

## Phase E6 — Run Status UI

**Goal:** Real-time run status display. Chunk-level tracking. Readable by employer
mid-run and after completion.

### Tasks
1. `components/run-status/RunStatusBanner.tsx` — top-level run status badge
2. `components/run-status/ChunkStatusList.tsx` — list of all chunks with statuses
3. `components/run-status/ChunkStatusRow.tsx` — chunk row: worker, amount, status, tx ID, retry
4. `components/run-status/RunSummary.tsx` — totals, anchor hash, completion time
5. `app/(employer)/payroll/[run_id]/page.tsx` — full run status page
   - Polls `payroll_run_store` for live updates
   - Shows progress bar (chunks settled / total)
   - "Retry" button for `needs_retry` chunks
   - "Mint Batch Anchor" button appears after all settled
6. `app/(employer)/payroll/page.tsx` — payroll history:
   - List of past runs from sessionStorage manifests
   - Per-run: batch_id, epoch, worker count, total, status, anchor tx
7. "Export Payroll Run JSON" — downloads full manifest JSON from any run status page

### Files Created
```
components/run-status/RunStatusBanner.tsx
components/run-status/ChunkStatusList.tsx
components/run-status/ChunkStatusRow.tsx
components/run-status/RunSummary.tsx
app/(employer)/payroll/[run_id]/page.tsx   (populated)
app/(employer)/payroll/page.tsx            (populated)
```

### Exit Criteria
- [ ] 3-worker run: all three chunks show status updates in real time
- [ ] Failed chunk shows error message + retry button
- [ ] After all settled: "Mint Batch Anchor" button appears
- [ ] Payroll history list shows all completed runs from session

---

## Phase E7 — Batch Anchor Finalizer

**Goal:** After all chunks settle, employer mints one cycle NFT anchoring the batch root.

### Tasks
1. `src/anchor/batch_anchor_finalizer.ts`:
   - Derives `nft_id` from `batch_id` via `token_id.ts`
   - Builds `mint_cycle_nft` Layer 2 call plan step
   - Calls `aleo_cli_adapter.ts` (Layer 2)
   - Updates manifest `status: "anchored"`, `anchor_tx_id`, `anchor_nft_id`
2. `src/anchor/batch_anchor_finalizer.test.ts` — Vitest: verify NFT arg construction
3. Wire into run status page: "Mint Batch Anchor" button triggers finalizer
4. Show anchor result: tx ID + nft_id + explorer link
5. "Print Payroll Run Document" — generates PDF (wired in Phase E8)

### Files Created
```
src/anchor/batch_anchor_finalizer.ts
src/anchor/batch_anchor_finalizer.test.ts
```

### Exit Criteria
- [ ] `pnpm test` passes finalizer tests
- [ ] Batch anchor NFT successfully minted on testnet
- [ ] NFT's `root` field matches manifest `row_root`
- [ ] `anchor_tx_id` stored in manifest + shown in UI
- [ ] Manifest status updates to "anchored"

---

## Phase E8 — PDF Generation + Credential Issuer

**Goal:** Employer can print payroll run documents and issue/revoke employee credentials.

### Tasks

**PDFs:**
1. `components/pdf/PaystubPDF.tsx` — paystub per worker per epoch
2. `components/pdf/PayrollRunPDF.tsx` — full employer payroll run summary
3. `components/pdf/CredentialCertPDF.tsx` — credential certificate
4. `components/pdf/DownloadPDFButton.tsx` — client-side PDF generation + download
5. Wire into run status page: "Print Payroll Run" uses `PayrollRunPDF`
6. Wire into worker detail page: "Print Paystub" per epoch row

**Credentials:**
7. `app/(employer)/credentials/page.tsx` — credential list
8. `app/(employer)/credentials/issue/page.tsx` — issue form (see EMPLOYER_FLOWS.md §5)
9. `app/(employer)/credentials/[credential_id]/page.tsx` — detail + revoke
10. Wire Layer 2 adapter for `mint_credential_nft` + `revoke_credential_nft`

### Files Created
```
components/pdf/PaystubPDF.tsx
components/pdf/PayrollRunPDF.tsx
components/pdf/CredentialCertPDF.tsx
components/pdf/DownloadPDFButton.tsx
app/(employer)/credentials/page.tsx
app/(employer)/credentials/issue/page.tsx
app/(employer)/credentials/[credential_id]/page.tsx
```

### Exit Criteria
- [ ] Payroll run PDF downloads with correct amounts, tx ID, batch anchor hash, QR code
- [ ] Credential minted on testnet; certificate PDF shows correct scope + expiry
- [ ] Credential revoked on testnet; status on detail page updates to REVOKED
- [ ] No private data appears in any PDF (raw addresses, keys)

---

## Phase E9 — Audit Authorization Flow + Worker Stubs

**Goal:** Employer can request audit authorization. Worker side routes are stubbed
so the worker can accept (even if worker UI is minimal).

### Tasks

**Audit:**
1. `app/(employer)/audit/page.tsx` — audit log + pending requests list
2. `app/(employer)/audit/request/page.tsx` — request form (see EMPLOYER_FLOWS.md §6)
3. `components/pdf/AuditAuthPDF.tsx` — audit authorization certificate PDF
4. Wire Layer 2 adapter for `mint_authorization_nft`
5. "Share Disclosure Key" step after NFT minted

**Worker stubs (minimal — just enough for testnet end-to-end):**
6. `app/(worker)/layout.tsx` — worker session guard
7. `app/(worker)/dashboard/page.tsx` — shows pending audit requests
8. `app/(worker)/paystubs/page.tsx` — paystub list (decoded via view key)
9. Wire worker consent for audit → triggers `mint_authorization_nft` jointly

### Files Created
```
app/(employer)/audit/page.tsx
app/(employer)/audit/request/page.tsx
components/pdf/AuditAuthPDF.tsx
app/(worker)/layout.tsx
app/(worker)/dashboard/page.tsx
app/(worker)/paystubs/page.tsx
```

### Exit Criteria
- [ ] Employer submits audit request; pending request visible on employer audit page
- [ ] Worker (via stub UI) can approve the request
- [ ] AuditAuthorizationNFT minted on testnet after both consent
- [ ] Audit authorization certificate PDF downloads
- [ ] Worker can see their paystubs (decoded from receipt records via view key)

---

## Phase E10 — End-to-End Testnet Happy Path

**Goal:** Full end-to-end scenario executed against Aleo testnet from the portal UI.
This is the Phase 4 equivalent for the portal repo.

### Scenario

```
1. Employer connects via key entry (testnet keys)
2. Employer onboards 1 worker → QR flow → agreement on-chain
3. Employer runs payroll for that worker → manifest → settlement → anchor
4. Worker views their paystub
5. Employer issues a credential to that worker
6. Employer requests audit authorization for that worker
7. Worker approves → AuditNFT minted
8. Employer prints all three documents (paystub, credential cert, audit auth)
```

### Exit Criteria
All eight steps complete successfully with real testnet tx IDs.
This is the Portal Phase 4 exit criteria.

---

## Summary Table

| Phase | Goal | New On-Chain Calls | Key Deliverable |
|-------|------|-------------------|-----------------|
| E0 | Bootstrap | None | Working Next.js app |
| E1 | Session | None | Key manager + auth guard |
| E2 | Read data | None (read only) | Worker list + balances |
| E3 | Table UI | None | Payroll table editor |
| E4 | Compiler | None | PayrollRunManifest + tests |
| E5 | Execute | payroll_core | End-to-end settlement |
| E6 | Status UI | None | Chunk tracking + retry |
| E7 | Anchor | payroll_nfts (cycle) | Batch root NFT |
| E8 | Docs + Creds | credential_nft | PDFs + credentials |
| E9 | Audit + Worker | audit_nft | Dual-consent audit |
| E10 | E2E testnet | All | Happy path confirmed |
