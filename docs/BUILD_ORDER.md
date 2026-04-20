# Build Order — PNW Employment Portal

> Phase-by-phase build plan for `pnw_employment_portal_v1`.
> Each phase has: deliverables, files created, and exit criteria.
> Start each new conversation with this file to orient quickly.
> See CLAUDE.md for full project context, architecture, and tech decisions.

---

## Phase E0 — Repository Bootstrap

**Goal:** Working Next.js app with the right scaffolding. Nothing portal-specific yet.

### Tasks
1. `pnpm create next-app@latest pnw_employment_portal_v1 --typescript --tailwind --app`
2. Install dependencies: `zustand @tanstack/react-table @noble/hashes jspdf react-qr-code qrcode vitest @vitest/ui`
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
├── CLAUDE.md, INTEROP.md, PAYROLL_RUN_MANIFEST.md,
│   EMPLOYER_FLOWS.md, HANDSHAKE.md, BUILD_ORDER.md, README.md
├── next.config.ts
├── package.json, pnpm-lock.yaml, tsconfig.json, tailwind.config.ts, vitest.config.ts
├── .env.example, .gitignore
├── app/layout.tsx, app/page.tsx, app/globals.css
└── src/lib/pnw-adapter/   (all copied files with sync headers)
```

### Exit Criteria
- [x] `pnpm dev` starts with no errors
- [x] `pnpm tsc --noEmit` passes
- [x] `pnpm test` runs (0 tests, no failures)
- [x] shadcn Button and Table components render in `app/page.tsx` (smoke test)

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
- [x] Navigating to `/` shows login/connect UI
- [x] Entering any valid Aleo private key + view key → session created → redirect to `/employer/dashboard`
- [x] Dashboard shows truncated address from session
- [x] "Disconnect" clears session and redirects to `/`
- [x] Refreshing the page preserves session (sessionStorage)
- [x] Closing the tab clears the session

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
- [x] Worker list page loads and shows at least one decoded worker (testnet)
- [x] Dashboard shows correct USDCx balance (matches testnet record)
- [x] Clicking a worker shows agreement status correctly
- [x] Agreement status matches on-chain state (verify against Provable Explorer)

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
- [x] Can add 25 rows to the payroll table without performance degradation
- [x] Row validation: `net !== gross - tax - fee` shows red X with tooltip
- [x] Duplicate `(agreement_id, epoch_id)` shows error
- [x] Totals row updates correctly as amounts change
- [x] Import CSV with 5 rows populates the table correctly
- [x] "Save Draft" persists table to sessionStorage; survives refresh

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
- [x] `pnpm test` passes all compiler + chunk_planner tests
- [x] Same 3-row table always produces the same batch_id
- [x] Adding a worker changes batch_id
- [x] Manifest preview shows in UI after clicking "Validate"
- [x] `PayrollValidationError` messages appear as inline row validation in the table

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
- [x] `pnpm test` passes receipt reconciler tests
- [x] Single-worker payroll run executes successfully on testnet
- [x] `WorkerPayArgs.batch_id` and `row_hash` are populated from manifest
- [x] Receipt returned from Layer 1 maps back to manifest row correctly
- [x] Chunk retry works: simulate timeout → auto-retry → success
- [x] Double-pay guard: re-running same epoch → `conflict` status on row, run continues

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
- [x] 3-worker run: all three chunks show status updates in real time
- [x] Failed chunk shows error message + retry button
- [x] After all settled: "Mint Batch Anchor" button appears
- [x] Payroll history list shows all completed runs from session

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
- [x] `pnpm test` passes finalizer tests
- [x] Batch anchor NFT successfully minted on testnet
- [x] NFT's `root` field matches manifest `row_root`
- [x] `anchor_tx_id` stored in manifest + shown in UI
- [x] Manifest status updates to "anchored"

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
- [x] Payroll run PDF downloads with correct amounts, tx ID, batch anchor hash, QR code
- [x] Credential minted on testnet; certificate PDF shows correct scope + expiry
- [x] Credential revoked on testnet; status on detail page updates to REVOKED
- [x] No private data appears in any PDF (raw addresses, keys)

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
- [x] Employer submits audit request; pending request visible on employer audit page
- [x] Worker (via stub UI) can approve the request
- [x] AuditAuthorizationNFT minted on testnet after both consent
- [x] Audit authorization certificate PDF downloads
- [x] Worker can see their paystubs (decoded from receipt records via view key)

---

## Phase E10 — End-to-End Testnet Happy Path

**Goal:** Full end-to-end scenario executed against Aleo testnet from the portal UI.
This is the Phase 4 equivalent for the portal repo.

### Completed (2026-04-10)

First successful end-to-end private payroll + anchor executed from the portal UI:

| Step | Program | Transaction |
|---|---|---|
| Verify agreement | `employer_agreement_v4` | `at1mydsktdsr8pk7d4utzrp6n2rvtgkkpavthukyt4kpdadgyx5lg8sgljea3` |
| Transfer USDCx | `test_usdcx_stablecoin` | `at1yphn8n9zejqnnsktuev7rl9vkv8styq00rjpffa0h7rxnccssyyqdk9ltw` |
| Mint receipts | `paystub_receipts` | `at1w86wy80c9sgv0e2ukwlzja4r4km0vkld2tna586t9447q6pjvvrqhuvnw4` |
| Anchor event | `payroll_audit_log` | `at1jp6mertn92hpn79uak8vdy9t4ha2t0f4fwq877uy6rmjl20g0syqdzygp3` |
| Mint cycle NFT | `payroll_nfts_v2` | `at1d8ht598hqqjgmqfxjwvt0cf47aqafgynzjhazhtreze6j22hzcrq5992r5` |

---

## Post-E9 — Wallet Integration + Landing Page

**Goal:** Replace manual key entry as primary auth with official Provable wallet
adapters (Shield, Puzzle, Leo, Fox, Soter) and build an immersive landing page.

### Completed
- Official `@provablehq/aleo-wallet-adaptor-*` packages integrated (all 5 wallets)
- `WalletMultiButton` + `WalletModalProvider` from `@provablehq/aleo-wallet-adaptor-react-ui`
- Mobile deep-link handler (`WalletMobileRedirectHandler`) for LOADABLE wallets
- Leo/Fox configured with `isMobile` + `mobileWebviewUrl` for in-app browser connect
- Cinematic landing page with hero image, animated portal doors, constellation overlay, animated birds, root pulse, tree sway
- `EnterKeysModal` retained as fallback auth path for testnet/CLI

### Pending
- Mobile responsive formatting within employer portal pages
- Shield in-app browser deep-link (waiting on Shield adapter to expose URL scheme)

---

## Phase E11 — Multi-Worker Payroll + Hardening (Done 2026-04-11)

**Goal:** Execute payroll for multiple workers in one session with live progress tracking.

### Completed
- [x] 3-worker sequential payroll with automatic USDCx remainder-record handling between workers
- [x] `consumedUsdcxRecords: Set<string>` prevents double-spend across workers
- [x] Remainder-record polling: 8 attempts x 4s backoff between workers
- [x] Filling progress bar per worker (0→90% during proof, pause at 90%, jump to 100% on confirm)
- [x] `WorkerProgress` type with `onWorkerProgress` callback for live UI updates

---

## Phase E12 — Credential NFTs + Generative Art (Done 2026-04-12)

**Goal:** Employer issues verifiable credentials with on-chain authorization and generative visual art.

### Completed
- [x] `credential_nft_v3.aleo` deployed with 3 cross-program authorization checks
- [x] Dual-record mint (employer + worker copies in one transition)
- [x] `employer_agreement_v4.aleo` upgraded with `assert_employer_authorized` transition
- [x] Generative topographic blueprint card art (1-5 peaks, 4 palettes, deterministic from BLAKE3)
- [x] Worker credential gallery (wallet record scan)
- [x] Employer credential list (issued credentials per worker)
- [x] PNG download + PDF certificate print
- [x] `.pnw` name + truncated Aleo address on card header
- [x] `credential_nft_v4.aleo` deployed (adds employer license verification, staged)

---

## Phase E13 — Worker Portal Features (Done 2026-04-15)

**Goal:** Full worker experience — tax withholding, timesheet, paystub viewer, pay rates.

### Completed
- [x] **Federal tax engine** (`src/lib/tax-engine.ts`) — IRS annualization method, 2026 brackets, 4 filing statuses, FICA, Medicare with YTD tracking
- [x] **W-4 form** (`app/worker/w4/page.tsx`) — Steps 1-4 matching IRS Form W-4, dependent credits ($2,000/$500), adjustments
- [x] **W-4 encryption** (`src/lib/w4-crypto.ts`) — parties_key AES-256-GCM, IPFS pin via Pinata, cross-browser employer access
- [x] **Timesheet** (`app/worker/timesheet/page.tsx`) — clock-in/out, weekly hours, daily grouped entries, 40-hour progress bar
- [x] **Paystub viewer** (`app/worker/paystubs/page.tsx`) — wallet record scan (no view key), PDF print
- [x] **Pay rates in agreements** — hourly/salary pay type in offer flow, auto-fill payroll table
- [x] **Tax auto-fill in payroll table** — reads worker W-4 data, computes tax per worker on gross change
- [x] **Employer W-4 section** on worker detail page — reads encrypted W-4 from IPFS

---

## Phase E14 — Inline W-4 Form (Done 2026-04-20)

**Goal:** Remove PDF download/upload friction — make W-4 fillable directly in the portal.

### Completed
- [x] Remove PDF upload imports and 3-step download/fill/upload workflow
- [x] All W-4 fields directly editable in portal (radio buttons, checkboxes, number inputs)
- [x] Zero friction for mobile workers — no file picker or PDF reader needed
- [x] Encrypted IPFS upload preserved on submit via `uploadEncryptedW4`

---

## Summary Table

| Phase | Goal | New On-Chain Calls | Key Deliverable | Status |
|-------|------|-------------------|-----------------|--------|
| E0 | Bootstrap | None | Working Next.js app | Done |
| E1 | Session | None | Key manager + auth guard | Done |
| E2 | Read data | None (read only) | Worker list + balances | Done |
| E3 | Table UI | None | Payroll table editor | Done |
| E4 | Compiler | None | PayrollRunManifest + tests | Done |
| E5 | Execute | payroll_core | End-to-end settlement | Done |
| E6 | Status UI | None | Chunk tracking + retry | Done |
| E7 | Anchor | payroll_nfts (cycle) | Batch root NFT | Done |
| E8 | Docs + Creds | credential_nft | PDFs + credentials | Done |
| E9 | Audit + Worker | audit_nft | Dual-consent audit | Done |
| Post-E9 | Wallet + UX | None | Official wallet adapters + landing page | Done |
| E10 | E2E testnet | All | Happy path confirmed (2026-04-10) | Done |
| E11 | Multi-worker | payroll_core_v2 | 3-worker payroll, USDCx double-spend fix, progress bar | Done |
| E12 | Credentials | credential_nft_v3/v4 | Dual-record mint, on-chain auth, generative topo art, galleries | Done |
| E13 | Worker features | — | Tax engine, W-4 form, timesheet, paystub viewer, pay rates | Done |
| E14 | W-4 inline form | — | Remove PDF upload, inline fillable form, encrypted IPFS share | Done |
