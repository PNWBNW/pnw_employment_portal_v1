# Architecture — PNW Employment Portal (Employer Side)

> This document describes the Layer 3 portal architecture.
> For Layer 1 / Layer 2 on-chain architecture, see `pnw_mvp_v2/ARCHITECTURE.md`.

---

## Layer Model

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

---

## Component Map

### A. PayrollRunManifest Compiler

**File:** `src/manifest/compiler.ts`

**Input:** Employer-filled payroll table (raw rows: worker addresses, amounts, agreements)

**Output:** `PayrollRunManifest` — a fully deterministic, hashable protocol object

**Steps:**
1. Validate each row (agreement active, amounts valid, no duplicates)
2. Normalize rows (canonical field ordering, string → BigInt conversions)
3. Assign `row_index` (0-based, stable sort by `agreement_id`)
4. Compute each row's canonical hashes via `canonical_encoder.ts`:
   - `payroll_inputs_hash` = BLAKE3(`PNW::INPUTS`, TLV(inputs))
   - `receipt_anchor` = BLAKE3(`PNW::DOC`, TLV(paystub_doc))
   - `receipt_pair_hash` = BLAKE3(`PNW::DOC`, TLV(receipt_pair))
   - `utc_time_hash` = BLAKE3(`PNW::DOC`, TLV(utc_context))
   - `audit_event_hash` = BLAKE3(`PNW::DOC`, TLV(audit_event))
   - `row_hash` = BLAKE3(`PNW::LEAF`, TLV(row)) — the manifest-level row hash
5. Compute `row_root` = Merkle root over `[row_hash_0, row_hash_1, ..., row_hash_n]`
6. Compute `inputs_hash` = BLAKE3 of all row input hashes concatenated
7. Compute `doc_hash` = BLAKE3 of the full manifest canonical bytes
8. Compute `batch_id` = BLAKE3(`PNW::DOC`, TLV(manifest_header + row_root))

**Invariant:** Given the same rows in the same order with the same versions, the
compiler always produces the same `batch_id`. The manifest is content-addressed.

---

### B. Chunk Planner

**File:** `src/manifest/chunk_planner.ts`

**Input:** `PayrollRunManifest`

**Output:** `ChunkPlan[]` — ordered list of settlement chunks

Each chunk is a set of rows to settle in one adapter execution call.

**Chunking rules (MVP):**
- Default chunk size: 1 row per chunk (canonical safety)
- Optional: 2-row micro-batch if both rows belong to the same employer and the
  `execute_payroll_batch_2` transition is available (benchmark first)
- Chunk ordering: same as `row_index` in manifest (stable, deterministic)
- Each chunk carries: `chunk_id`, `row_indices[]`, estimated `net_total`, `status`

**Chunk IDs are deterministic:**
```
chunk_id = BLAKE3("PNW::CHUNK", batch_id || u32_le(chunk_index))
```

---

### C. Settlement Coordinator

**File:** `src/coordinator/settlement_coordinator.ts`

**Input:** `PayrollRunManifest`, `ChunkPlan[]`, employer USDCx record, session keys

**Responsibility:** Execute each chunk in order using the adapter; track state; handle retries

**State machine per run:**

```
draft
  └─→ validated (all rows pass pre-flight checks)
        └─→ queued (chunks ready, waiting for executor)
              └─→ proving (chunk N being proved)
                    ├─→ broadcasting (proof submitted)
                    │     ├─→ partially_settled (some chunks done)
                    │     │     └─→ settled (all chunks done)
                    │     │           └─→ anchored (batch root NFT minted)
                    │     └─→ failed (chunk N failed, no retry left)
                    │           └─→ needs_retry (operator intervention)
                    └─→ failed (prove failed)
```

**State machine per chunk:**
```
pending → proving → broadcasting → settled | failed
```

**Retry rules:**
- Transient failures (timeout, network): up to 3 retries with exponential backoff
- On-chain revert (double-pay, invalid state): do not retry; mark row as `conflict`
- After operator intervention: restart from `needs_retry` state using same manifest

**Idempotency guarantee:**
- Each row has a unique `(agreement_id, epoch_id)` double-pay guard on-chain
- If a row already shows `settled` (chunk produced a tx ID), it is skipped on retry
- `batch_id` + `row_hash` are committed into each settlement proof; reconciliation is deterministic

---

### D. Receipt Reconciler

**File:** `src/coordinator/receipt_reconciler.ts`

**Input:** Returned `WorkerPaystubReceipt` + `EmployerPaystubReceipt` Aleo records, manifest

**Output:** Updated row statuses; `tx_id` per row; receipt record mapped to manifest row

**How matching works:**
- The receipt contains `payroll_inputs_hash` (from `paystub_receipts.aleo`)
- The manifest row has the same `payroll_inputs_hash` (computed before execution)
- Reconciler matches on `payroll_inputs_hash` → identifies which manifest row settled
- Secondary match: `agreement_id` + `epoch_id` (double-pay guard fields)

---

### E. Batch Anchor Finalizer

**File:** `src/anchor/batch_anchor_finalizer.ts`

**Input:** Fully settled manifest (all chunks `settled`), employer session

**Action:** Mints one `payroll_nfts.aleo/mint_cycle_nft` with:
- `doc_hash` = manifest `doc_hash`
- `root` = manifest `row_root` (the Merkle root over all row hashes)
- `inputs_hash` = manifest `inputs_hash`
- `nft_id` = derived from `batch_id` via `token_id.ts`
- `schema_v`, `calc_v`, `policy_v` from manifest

**Why this works:**
`payroll_nfts.aleo` already has `doc_hash` and `root` fields — these were designed
for exactly this purpose. The `row_root` anchored here creates a Merkle inclusion
path for any individual worker row. The employer can later prove any row was in the
batch by producing the row hash and its Merkle path.

**Timing:** Only triggered after ALL chunks show `settled`. The coordinator gates this.

---

## Data Flow — Full Payroll Run

```
1. Employer fills payroll table
   │
   ▼
2. ManifestCompiler.compile(rows)
   → PayrollRunManifest {batch_id, rows[], row_root, doc_hash, ...}
   │
   ▼
3. ChunkPlanner.plan(manifest)
   → ChunkPlan[] (ordered, deterministic)
   │
   ▼
4. SettlementCoordinator.execute(manifest, chunks, employer_usdcx)
   │
   ├─ For each chunk:
   │   ├─ Build WorkerPayArgs[] (with batch_id + row_hash from manifest)
   │   ├─ Push to Layer 1 adapter → snarkos developer execute payroll_core.aleo
   │   ├─ Collect ComplianceRecord, remaining_usdcx, WorkerPaystubReceipt,
   │   │   EmployerPaystubReceipt
   │   └─ ReceiptReconciler.match(receipts, manifest) → update row status
   │
   ▼
5. All chunks settled
   │
   ▼
6. BatchAnchorFinalizer.anchor(manifest)
   → mint_cycle_nft(batch_root, doc_hash, ...)
   → PayrollNFT minted on payroll_nfts.aleo
   │
   ▼
7. Run status: anchored
   Employer sees: run complete, PayrollNFT anchor hash, tx IDs per worker
```

---

## Privacy Model

This portal inherits the privacy model from `pnw_mvp_v2`:

| Data | Where it lives | Who can see |
|------|---------------|-------------|
| Private keys / view keys | Session memory only | User who entered them |
| Worker addresses | Session memory; passed to adapter at execution time | Employer (at dispatch) |
| Wage amounts | Private Aleo records (decoded via view key each session) | Record owner only |
| Name hashes | Public chain | Anyone (hash only) |
| Agreement anchors | Public chain | Anyone (commitment only) |
| batch_id / row_root | Public chain (anchored in cycle NFT) | Anyone (hash only) |
| PayrollRunManifest | Session memory + local storage (no server) | Employer who created it |
| Receipt records | Private Aleo records | Record owner only |
| PDFs | Client-side only | User who generated them |

**What never happens in this repo:**
- No server database that stores wages, names, or addresses
- No server-side session (Next.js is used as a static/client-first app)
- No external PDF service that receives private data
- No hardcoded private keys or addresses anywhere

---

## Authentication Model

Two paths, both supported from day one:

**Path A — Wallet Connection**
User connects a compatible Aleo wallet (Shield, Puzzle, Leo Wallet, or any wallet
that exposes `address`, `view_key`, and a signing interface). The private key never
leaves the wallet. The portal receives address + view key for the session.

**Path B — Direct Key Entry (CLI / Codespace / testing)**
User pastes private key + view key into a session-only input. Portal holds them in
`sessionStorage` (cleared on tab close). This path is needed for testnet testing
where wallet extensions may not be available.

**Common session interface:**
```typescript
type AleoSession = {
  address: string;          // public address
  view_key: string;         // for decoding own records
  sign: (inputs: ...) => Promise<...>;  // wallet or derived from private key
};
```

---

## Key-Manager Component

`components/key-manager/` handles session state for both auth paths. It:
- Never persists private keys to `localStorage` (only `sessionStorage`)
- Clears on tab close automatically
- Shows a warning if the user tries to navigate away mid-run
- Exposes `useAleoSession()` hook to all downstream components

---

## On-Chain Programs This Portal Calls

All calls go through `src/lib/pnw-adapter/`. Never call `snarkos` directly.

### Layer 1 (via layer1_adapter.ts)
| Action | Program | Transition |
|--------|---------|------------|
| Onboard worker: create profile | `worker_profiles.aleo` | `create_worker_profile` |
| Onboard worker: create agreement | `employer_agreement_v2.aleo` | `create_job_offer` |
| Accept agreement | `employer_agreement_v2.aleo` | `accept_job_offer` |
| Pause / terminate / resume agreement | `employer_agreement_v2.aleo` | respective transitions |
| Settle payroll (single worker) | `payroll_core.aleo` | `execute_payroll` |
| Settle payroll (two workers) | `payroll_core.aleo` | `execute_payroll_batch_2` |

### Layer 2 (via aleo_cli_adapter.ts)
| Action | Program | Transition |
|--------|---------|------------|
| Anchor payroll run | `payroll_nfts.aleo` | `mint_cycle_nft` |
| Anchor quarterly summary | `payroll_nfts.aleo` | `mint_quarter_nft` |
| Anchor YTD | `payroll_nfts.aleo` | `mint_ytd_nft` |
| Issue credential | `credential_nft.aleo` | `mint_credential_nft` |
| Revoke credential | `credential_nft.aleo` | `revoke_credential_nft` |
| Mint audit authorization | `audit_nft.aleo` | `mint_authorization_nft` |
| Anchor audit attestation | `audit_nft.aleo` | `anchor_audit_attestation` |
