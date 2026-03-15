# Employer Flows — PNW Employment Portal

> All UX flows for the employer-authenticated side of the portal.
> Each section describes: trigger, steps, on-chain calls, and edge cases.
> Worker-side flows are out of scope until after Phase E9.

---

## 0. Session Management (Prerequisite for All Flows)

Before any employer action, the user must have an active Aleo session.

**Entry point:** `app/page.tsx` (landing page)

### Path A — Wallet Connection
1. User clicks "Connect Wallet"
2. `ConnectWalletModal` presents wallet options (Shield, Puzzle, Leo Wallet, Other)
3. Wallet extension provides: `address`, `view_key`, signing interface
4. Session stored in Zustand `session_store.ts` + `sessionStorage`
5. User redirected to `app/(employer)/dashboard/`

### Path B — Direct Key Entry
1. User clicks "Enter Keys Manually"
2. `EnterKeysModal` prompts for: Private Key, View Key
3. Address is derived from private key client-side (via `@provablehq/sdk`)
4. Private key stored in `sessionStorage` only (not Zustand, not localStorage)
5. View key stored in `sessionStorage` + Zustand (view_key is less sensitive)
6. User redirected to `app/(employer)/dashboard/`

### Session Expiry
- On tab close: all `sessionStorage` cleared automatically
- On navigate away mid-run: warn modal ("You have an active payroll run. Leaving will clear your session.")
- After session restore (from `sessionStorage` on refresh): re-validate that stored run state matches session

---

## 1. Employer Dashboard

**Route:** `app/(employer)/dashboard/page.tsx`

### What it shows

```
┌─────────────────────────────────────────────────────────┐
│ PNW Employment Portal — Employer View                    │
│                                                         │
│  [address truncated]  [USDCx balance]  [Disconnect]    │
│                                                         │
│  Active Workers: 12          Pending Payroll: Epoch 20260302
│                                                         │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────┐ │
│  │  Run Payroll    │  │  View Workers  │  │  Audit   │ │
│  │  (quick action) │  │                │  │  Pending │ │
│  └─────────────────┘  └────────────────┘  └──────────┘ │
│                                                         │
│  Recent Activity:                                       │
│  ✓ Payroll run epoch 20260228 — settled — 8 workers    │
│  ✓ Credential issued — John Doe — Employment Verified  │
│  ⏳ Audit request pending worker consent — epoch range  │
└─────────────────────────────────────────────────────────┘
```

### Data sources
- Worker count: count of active `employer_agreement_v2` records (decoded via view key)
- USDCx balance: sum of employer's `test_usdcx_stablecoin.aleo/Token` records
- Pending payroll: from current epoch detection (based on pay frequency in agreements)
- Recent activity: from session-cached manifest history + on-chain anchor status

---

## 2. Worker Onboarding — QR Code Flow

**Route:** `app/(employer)/workers/onboard/page.tsx`

### Purpose
Employer initiates onboarding. The portal generates a QR code the employer provides
to the prospective worker (printed, emailed, shown on screen). Worker scans → lands
on the portal onboarding page with terms pre-populated → accepts on-chain.

### Flow

**Step 1 — Employer fills in offer terms (employer side)**
```
Form fields:
  - Worker's prospective display name (for QR payload; hashed before chain)
  - Pay frequency (weekly / bi-weekly / semi-monthly / monthly)
  - Start epoch (estimated)
  - Jurisdiction / state suffix code (WA, CA, TX, etc.)
  - Initial credential types to issue at hire (optional)
  - Agreement terms (free text → hashed into terms_doc_hash)
```

**Step 2 — Portal generates onboarding package (client-side)**
```
Produces:
  - agreement_id = BLAKE3("PNW::DOC", TLV(employer_addr + terms_hash + offer_time))
  - terms_doc_hash = BLAKE3("PNW::DOC", TLV(terms_text))
  - offer_time_hash = BLAKE3("PNW::DOC", TLV(utc_epoch_seconds))
  - QR payload: { portal_url, employer_name_hash, agreement_id, schema_v }
  - Printable offer letter (PDF, client-side only)
```

**Step 3 — Employer dispatches `create_job_offer` (on-chain)**
```
Calls: employer_agreement_v2.aleo / create_job_offer
Inputs:
  agreement_id, parties_key, employer_name_hash, worker_name_hash (placeholder),
  worker_address (placeholder), industry_code, pay_frequency_code,
  start_epoch, end_epoch, review_epoch, agreement_rev=1,
  schema_v, policy_v, terms_doc_hash, terms_root, offer_time_hash
Outputs: PendingAgreementRecord (employer holds this)
```

**Step 4 — Employer gives QR code to worker**
```
Portal shows:
  - QR code (react-qr-code)
  - "Print Offer Package" button (PDF with QR + offer terms)
  - Status: "Waiting for worker acceptance"
```

**Step 5 — Worker scans QR → accepts on their side (separate flow)**
Worker lands on `app/(worker)/onboard/[agreement_id]/page.tsx`, connects their wallet,
reviews terms, and dispatches `accept_job_offer`. This is the worker-side flow (post-E9).

**Step 6 — Employer's dashboard updates**
When the worker accepts, the `PendingAgreementRecord` transitions to `FinalAgreementRecord`
on-chain. The employer's portal refreshes and shows the worker in "Active Workers".

### Edge Cases
- Worker never scans: QR remains valid until `end_epoch`. Employer can cancel by marking
  the offer as terminated before acceptance.
- Wrong worker scans: the `accept_job_offer` transition enforces the worker address
  matches the offer — if mismatched, it reverts. (Worker address is set at offer time.)

---

## 3. Worker List + Agreement Management

**Route:** `app/(employer)/workers/page.tsx`

### What it shows

```
Workers (12 active)

Name Hash        Agreements    Last Payroll     Status    Actions
──────────────   ─────────────────────────────────────────────────
[truncated]      1 active      Epoch 20260228   Active    [Manage]
[truncated]      1 active      Epoch 20260228   Active    [Manage]
[truncated]      2 active      Epoch 20260215   Active    [Manage]
...
```

Note: display names are user-chosen labels set in session (not pulled from chain).
Chain holds only name hashes.

### Worker Detail — `app/(employer)/workers/[worker_id]/page.tsx`

Shows for a specific worker:
- Agreement status: ACTIVE / PAUSED / TERMINATED
- Pay history: list of epochs, net amounts, tx IDs
- Active credentials
- Pending audit requests

### Agreement Actions

**Pause:**
```
Calls: employer_agreement_v2.aleo / pause_agreement
Inputs: agreement_id, parties_key
Effect: Agreement status → PAUSED; payroll blocked until resumed
```

**Resume (employer):**
```
Calls: employer_agreement_v2.aleo / resume_agreement_employer
Notes: resume requires BOTH parties; employer starts, worker completes
```

**Terminate:**
```
Calls: employer_agreement_v2.aleo / terminate_agreement
Effect: Agreement terminal; cannot resume; final payroll recommended before this
```

**Supersede (replace with new terms):**
```
Calls: employer_agreement_v2.aleo / supersede_agreement
  then: create_job_offer (new terms)
Effect: Old agreement marked SUPERSEDED; new offer created; worker must re-accept
```

---

## 4. Payroll Run — Full Flow

**Routes:**
- Table builder: `app/(employer)/payroll/new/page.tsx`
- Run status: `app/(employer)/payroll/[run_id]/page.tsx`
- History: `app/(employer)/payroll/page.tsx`

This is the most complex flow. It spans UI → manifest compilation → chunk execution
→ receipt reconciliation → batch anchor finalization.

### Step 1 — Payroll Table (Draft)

Employer opens `app/(employer)/payroll/new/page.tsx`.

```
Payroll Table — New Run

Epoch: [20260302]  Currency: USDCx

Worker          Agreement ID   Gross      Tax       Fee       Net       Status
────────────────────────────────────────────────────────────────────────────────
[display label] [truncated]    $1,234.00  $185.10   $24.68   $1,024.22  ✓ Valid
[display label] [truncated]    $2,100.00  $315.00   $42.00   $1,743.00  ✓ Valid
[display label] [truncated]    $800.00    $120.00   $16.00   $664.00    ✓ Valid
[+ Add Row]

────────────────────────────────────────────────────────────────────────────────
Totals:                        $4,134.00  $620.10   $82.68   $3,431.22

[Cancel]  [Validate & Preview Manifest]  ─────────────────────────── [Save Draft]
```

**Table features (TanStack Table + shadcn):**
- Inline cell editing for all amount fields
- Worker selector dropdown (from decoded agreement records in session)
- Auto-calculation of `net_amount = gross - tax - fee`
- Row-level validation badge (green checkmark / red X with error tooltip)
- Import CSV (for large runs — maps CSV columns to row fields)
- Save Draft (stores table state in sessionStorage, not yet compiled)

### Step 2 — Validate & Preview Manifest

User clicks "Validate & Preview Manifest".

**Client-side:**
1. Manifest compiler runs (`src/manifest/compiler.ts`)
2. Validation errors surface inline (duplicate epoch, invalid amounts, inactive agreement)
3. If all valid: `PayrollRunManifest` produced with `status: "validated"`
4. Manifest preview panel slides in showing:
   - `batch_id` (hex)
   - `row_root` (hex)
   - `total_net_amount` in USDCx
   - Per-row row_hash values
   - Estimated chunk count

```
Manifest Preview

batch_id:     0x7f3a...
row_root:     0x9b12...
Total Net:    $3,431.22 USDCx
Rows:         3
Chunks:       3 (single-worker each)

[ Row 0 ] row_hash: 0xa1b2...   net: $1,024.22
[ Row 1 ] row_hash: 0xc3d4...   net: $1,743.00
[ Row 2 ] row_hash: 0xe5f6...   net: $664.00

[Back to Edit]  [Send Payroll]
```

### Step 3 — Send Payroll (Execution)

User clicks "Send Payroll". Portal confirms:
```
Are you sure?
Sending payroll to 3 workers.
Total: $3,431.22 USDCx
This will consume from your USDCx record.
[Cancel]  [Confirm & Send]
```

On confirm:
1. `ChunkPlanner.plan(manifest)` produces `ChunkPlan[]`
2. `SettlementCoordinator.execute(manifest, chunks, employer_usdcx)` starts
3. User is redirected to `app/(employer)/payroll/[run_id]/` (run status page)

### Step 4 — Run Status Page

Live-updating status as chunks execute:

```
Payroll Run — Epoch 20260302
batch_id: 0x7f3a...
Status: PROVING  [3 workers]

Chunk 0  [Row 0] John D.   $1,024.22   ● SETTLED    tx: at3z...   [Explorer ↗]
Chunk 1  [Row 1] Jane S.   $1,743.00   ● PROVING    —
Chunk 2  [Row 2] Bob T.    $664.00     ○ PENDING    —

[2 / 3 settled]  ████████░░  67%

───────────────────────────────────────────────────────────────
Anchoring: waiting for all chunks to settle...
```

After all chunks settle:
```
Status: SETTLED  ✓ All 3 workers paid

[Mint Batch Anchor NFT]
```

After anchor:
```
Status: ANCHORED  ✓

Batch Anchor:
  PayrollNFT tx:  ab12...   [Explorer ↗]
  nft_id:         0xdef0...
  row_root:       0x9b12...

[Print Payroll Run Document]  [Done]
```

### Step 5 — Batch Anchor (BatchAnchorFinalizer)

Triggered by user clicking "Mint Batch Anchor NFT" (or automatically after all settle).

```
Calls: payroll_nfts.aleo / mint_cycle_nft
Inputs:
  nft_id = token_id.derive(batch_id, "payroll_cycle")
  agreement_id = employer_addr (cycle NFT is employer-level, not per-agreement)
  period_start = epoch_id
  period_end = epoch_id
  doc_hash = manifest.doc_hash
  root = manifest.row_root
  inputs_hash = manifest.inputs_hash
  schema_v, calc_v, policy_v
Output: PayrollNFT (owned by employer) + on-chain anchor
```

### Error Handling

| Error | Display | Recovery |
|-------|---------|----------|
| Proof generation failed | "Chunk N failed to prove: [reason]" | Retry button |
| Tx broadcast timeout | "Chunk N: broadcast timeout" | Retry button |
| Double-pay guard rejected | "Row N: already paid this epoch" | Mark as conflict, continue other rows |
| USDCx insufficient | "Insufficient USDCx: need $X, have $Y" | Error before execution starts |
| Agreement inactive | "Row N: agreement not ACTIVE" | Error during validation (step 2) |

---

## 5. Credential Issuance

**Route:** `app/(employer)/credentials/issue/page.tsx`

### Flow

**Step 1 — Fill credential form**
```
Issue Credential to: [Worker selector]
Credential Type: [Employment Verified / Skills / Clearance / Custom]
Scope: [e.g. "Full-time, WA State"]
Valid Through: [Block height or "No Expiry"]
```

**Step 2 — Portal computes credential hashes**
```
credential_id = BLAKE3("PNW::DOC", TLV(employer_addr + worker_addr + scope + issue_time))
subject_hash = worker_name_hash (from agreement record)
issuer_hash = employer_name_hash
scope_hash = BLAKE3("PNW::DOC", TLV(scope_text))
doc_hash = BLAKE3("PNW::DOC", TLV(credential_doc))
root = MerkleRoot([subject_hash, issuer_hash, scope_hash])
```

**Step 3 — Dispatch on-chain**
```
Calls: credential_nft.aleo / mint_credential_nft
Inputs: credential_id, subject_hash, issuer_hash, scope_hash, doc_hash, root, schema_v, policy_v
Output: CredentialNFT (owned by worker) + on-chain anchor
```

**Step 4 — Generate credential certificate**
```
Portal shows "Print Certificate" button
PDF generated client-side via @react-pdf/renderer
Contains: credential type, scope, expiry, tx ID, QR → explorer
```

### Revoke Credential

**Route:** `app/(employer)/credentials/[credential_id]/page.tsx` → Revoke button

```
Calls: credential_nft.aleo / revoke_credential_nft
Input: credential NFT record (decoded from employer's records via view key)
Effect: on-chain status → REVOKED; worker's NFT becomes inactive
```

---

## 6. Audit Authorization Request

**Route:** `app/(employer)/audit/request/page.tsx`

### Context

Audit authorization requires BOTH employer and worker consent (dual-consent model).
The employer creates a pending request; the worker approves or declines from their side.
Only after worker approval does the `AuditAuthorizationNFT` get minted.

### Flow

**Step 1 — Employer fills audit request form**
```
Auditor Address: [Aleo address input]
Auditor Display Name: [free text — for PDF only, not stored]
Worker: [selector]
Scope — Pay epochs: from [epoch] to [epoch]
Expiry: block height [input] (portal shows estimated date)
Policy Hash: [auto-computed from scope + policy_v]
```

**Step 2 — Portal creates pending request (off-chain)**
A pending request object is stored in sessionStorage (and optionally in a
shared off-chain coordination mechanism — for MVP, employer communicates
the pending request to the worker verbally or via email with a portal link).

```
Pending Request:
  auth_id: BLAKE3("PNW::DOC", TLV(employer + worker + auditor + scope + expiry))
  scope_hash: BLAKE3("PNW::DOC", TLV(scope))
  authorization_event_hash: BLAKE3("PNW::DOC", TLV(employer + worker + consent_time))
```

**Step 3 — Worker consent (worker side — post-E9)**
Worker sees pending request on their dashboard, reviews scope + expiry, and approves.
Both parties' consent triggers the NFT mint.

**Step 4 — Mint AuditAuthorizationNFT (after both consent)**
```
Calls: audit_nft.aleo / mint_authorization_nft
Inputs:
  auth_id, scope_hash, authorization_event_hash, policy_hash,
  issued_epoch, expires_epoch, schema_v, policy_v
Output: AuditAuthorizationNFT (owned by auditor) + on-chain anchor
```

**Step 5 — Generate audit authorization PDF**
```
Both employer and worker can now print the audit authorization certificate.
Contains: scope, expiry, auditor name (display only), tx ID, QR → explorer
No payroll data — just the authorization scope.
```

**Step 6 — Share disclosure key with auditor (employer action)**
```
Portal shows a "Share Disclosure" step:
  "Provide your view key (scoped to these epochs) to the authorized auditor."
  [Copy View Key for epochs X–Y]

For MVP: employer copies view key manually and provides to auditor.
Post-MVP: portal encrypts view key to auditor's public key automatically.
```

---

## 7. YTD Summary + Export

**Route:** `app/(employer)/payroll/page.tsx` (payroll history section)

### YTD Per-Worker View
For each worker with at least one settled payroll run in the current year:
- Total gross earned
- Total net received
- Total tax withheld
- USDCx transferred
- All computed locally from decoded paystub receipt records

### Export Options
- "Export CSV" — downloads a CSV of the above per-worker table
- "Print YTD Summary" — generates a PDF with the full employer YTD table

Neither action makes any network request. All data is already decoded in session.

---

## UX Principles

1. **One employer action = one coherent result.** Selecting 25 workers and clicking
   "Send Payroll" should feel like one action, even though it executes multiple chunks.

2. **Failure is visible and actionable.** If chunk 3 fails, the UI shows exactly which
   worker, what the error was, and a "Retry" button. Not a generic error screen.

3. **No data loss on refresh.** Everything in progress is in sessionStorage. A page
   refresh resumes from where the user was.

4. **Privacy by default.** No amounts or names appear in page titles or URL params.
   The URL `payroll/run_abc123` only exposes the batch_id, which is a hash.

5. **Transaction IDs are always available.** Every on-chain action produces a tx ID
   that links to Provable Explorer. Users can verify independently.
