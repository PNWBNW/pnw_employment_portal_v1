# PayrollRunManifest — Specification

> This is the central protocol object for the Employment Portal.
> It is a first-class data contract — not just a UI concern.
> The manifest spec is stable once Phase E4 ships. Changes require a version bump.

---

## Purpose

The PayrollRunManifest is a **deterministic, content-addressed description of a
complete payroll run**. It is produced by the manifest compiler from the employer's
payroll table and consumed by the Settlement Coordinator to drive chunk-by-chunk
on-chain settlement.

**Key properties:**
- Immutable once compiled (batch_id is a hash of the manifest)
- Every row has a unique row_hash derived from its content
- row_root is the Merkle root over all row hashes → one batch-level anchor
- batch_id + row_hash flow into each WorkerPayArgs settlement → on-chain linkage
- Status state machine tracks the run from draft to anchored
- Chunk state machine tracks each settlement unit independently

---

## TypeScript Types

```typescript
// src/manifest/types.ts

import type { Bytes32, Address, Field, U32, U128, U16 } from "../lib/pnw-adapter/aleo_types";

// ----------------------------------------------------------------
// Version tags — increment when calculation rules change
// Must match the schema_v / calc_v / policy_v in pnw_mvp_v2 programs
// ----------------------------------------------------------------
export type ManifestVersions = {
  schema_v: U16;   // structure/field changes
  calc_v:   U16;   // tax/fee calculation rule changes
  policy_v: U16;   // compliance policy changes
};

// ----------------------------------------------------------------
// A single worker's payroll row — the atomic settlement unit
// ----------------------------------------------------------------
export type PayrollRow = {
  // Identity
  row_index:         number;       // 0-based, stable sort by agreement_id
  worker_addr:       Address;      // Aleo address; private, in session only
  worker_name_hash:  Field;        // BLAKE3("PNW::NAME", worker_display_name)
  agreement_id:      Bytes32;      // from on-chain agreement record

  // Payroll period
  epoch_id:          U32;          // canonical epoch (e.g. 20260302 = YYYYMMDD)
  currency:          "USDCx";      // always USDCx for MVP

  // Amounts (minor units: 1 USDCx = 1_000_000 minor units)
  gross_amount:      U128;
  tax_withheld:      U128;
  fee_amount:        U128;
  net_amount:        U128;         // must equal gross_amount - tax_withheld - fee_amount

  // Pre-computed canonical hashes (produced by compiler using canonical_encoder.ts)
  payroll_inputs_hash: Bytes32;    // BLAKE3("PNW::INPUTS", TLV(inputs set))
  receipt_anchor:      Bytes32;    // BLAKE3("PNW::DOC", TLV(paystub doc))
  receipt_pair_hash:   Bytes32;    // BLAKE3("PNW::DOC", TLV(worker+employer anchors))
  utc_time_hash:       Bytes32;    // BLAKE3("PNW::DOC", TLV(utc epoch seconds))
  audit_event_hash:    Bytes32;    // BLAKE3("PNW::DOC", TLV(inputs+anchors+batch_id+row_hash))

  // Manifest linkage (Option B — from pnw_mvp_v2 WorkerPayArgs)
  row_hash:            Bytes32;    // BLAKE3("PNW::LEAF", TLV(this row))

  // Execution state (set by Settlement Coordinator after compilation)
  status:   PayrollRowStatus;
  tx_id?:   string;                // Aleo transaction ID once settled
  chunk_id?: string;               // which chunk this row belongs to
};

export type PayrollRowStatus =
  | "pending"          // not yet attempted
  | "proving"          // adapter generating proof
  | "broadcasting"     // tx submitted to Aleo network
  | "settled"          // tx confirmed, receipts returned
  | "conflict"         // double-pay guard rejected (already paid this epoch)
  | "failed"           // non-retryable failure
  | "needs_retry";     // retryable failure, waiting for operator

// ----------------------------------------------------------------
// A chunk — one adapter execution call covering 1 or 2 rows
// ----------------------------------------------------------------
export type ChunkPlan = {
  chunk_index: number;
  chunk_id:    Bytes32;   // BLAKE3("PNW::CHUNK", batch_id || u32_le(chunk_index))
  row_indices: number[];  // which manifest rows this chunk settles (1 or 2 for batch_2)
  net_total:   U128;      // sum of net_amount for all rows in chunk
  transition:  "execute_payroll" | "execute_payroll_batch_2";
  status:      ChunkStatus;
  tx_id?:      string;
  attempts:    number;
  last_error?:  string;
};

export type ChunkStatus =
  | "pending"
  | "proving"
  | "broadcasting"
  | "settled"
  | "failed"
  | "needs_retry";

// ----------------------------------------------------------------
// The manifest — canonical, immutable once batch_id is assigned
// ----------------------------------------------------------------
export type PayrollRunManifest = {
  // Identity
  batch_id:       Bytes32;   // BLAKE3("PNW::DOC", TLV(header + row_root)); content-addressed
  schema_v:       U16;       // manifest schema version
  calc_v:         U16;       // calculation rules version
  policy_v:       U16;       // compliance policy version

  // Parties
  employer_addr:       Address;  // in session only — not stored to localStorage
  employer_name_hash:  Field;

  // Period
  epoch_id:  U32;
  currency:  "USDCx";

  // Rows
  row_count:  number;
  rows:       PayrollRow[];

  // Aggregates (computed by compiler, verified before execution)
  total_gross_amount: U128;
  total_tax_withheld: U128;
  total_fee_amount:   U128;
  total_net_amount:   U128;

  // Merkle root over row hashes
  row_root:     Bytes32;   // MerkleRoot([row_hash_0, ..., row_hash_n])

  // Top-level commitment hashes
  inputs_hash:  Bytes32;   // hash of all rows' payroll_inputs_hash values concatenated
  doc_hash:     Bytes32;   // hash of full canonical manifest bytes

  // Run state (mutable — set by coordinator, persisted to sessionStorage)
  status:       PayrollRunStatus;
  chunks?:      ChunkPlan[];
  created_at:   number;   // Date.now() at compile time
  updated_at:   number;   // Date.now() at last state change

  // Final anchor (set by BatchAnchorFinalizer)
  anchor_tx_id?:     string;   // Aleo tx ID of cycle NFT
  anchor_nft_id?:    Bytes32;  // nft_id from payroll_nfts.aleo
};

export type PayrollRunStatus =
  | "draft"              // not yet compiled (table being edited)
  | "validated"          // compiler ran, all rows valid, no execution yet
  | "queued"             // chunks created, waiting for execution to start
  | "proving"            // at least one chunk being proved
  | "partially_settled"  // some chunks settled, more pending
  | "settled"            // all chunks settled, anchor not yet minted
  | "anchored"           // batch root NFT minted; run complete
  | "failed"             // unrecoverable error
  | "needs_retry";       // retryable; operator must action
```

---

## Compiler Rules

### Stable Row Ordering

Rows are sorted by `agreement_id` (lexicographic on the hex string) before
`row_index` is assigned. This ensures identical payroll tables always produce
identical manifests with identical `batch_id` values.

### Amount Invariants (Enforced by Compiler)

```
net_amount === gross_amount - tax_withheld - fee_amount
net_amount > 0
gross_amount >= net_amount
gross_amount >= tax_withheld
```

If any row fails these checks, compilation fails with a `PayrollValidationError`
listing which rows are invalid and why.

### No Duplicate Rows

Two rows with the same `(agreement_id, epoch_id)` pair are rejected. The
double-pay guard on `payroll_core.aleo` would revert one of them anyway.

### Version Tags

All rows in a manifest share the same `schema_v`, `calc_v`, and `policy_v`.
These are set from the portal's current config (`src/config/versions.ts`) and
match the values expected by the deployed `payroll_core.aleo`.

### Amounts Must Be Minor Units

Gross, net, tax, and fee amounts are stored as `U128` in minor units:
- 1 USDCx = 1,000,000 minor units
- The UI shows decimal amounts (`$1,234.56`); the compiler converts to minor units
- Conversion: `BigInt(Math.round(displayAmount * 1_000_000))`

---

## batch_id Computation

```
batch_id = BLAKE3("PNW::DOC", TLV_encode({
  type:        OBJ_PAYROLL_MANIFEST,     // new TLV tag: 0x3001
  employer:    employer_addr,
  epoch_id:    epoch_id,
  row_count:   row_count,
  row_root:    row_root,
  schema_v:    schema_v,
  calc_v:      calc_v,
  policy_v:    policy_v
}))
```

The `batch_id` changes if:
- Any row is added, removed, or modified
- The employer address changes
- The epoch_id changes
- Version tags change

The `batch_id` does NOT change if only the run `status` changes (status is mutable
state overlaid on an immutable manifest content).

---

## row_hash Computation

```
row_hash = BLAKE3("PNW::LEAF", TLV_encode({
  type:                OBJ_PAYROLL_ROW,   // new TLV tag: 0x3002
  row_index:           row_index,
  worker_addr:         worker_addr,
  worker_name_hash:    worker_name_hash,
  agreement_id:        agreement_id,
  epoch_id:            epoch_id,
  gross_amount:        gross_amount,
  net_amount:          net_amount,
  tax_withheld:        tax_withheld,
  fee_amount:          fee_amount,
  payroll_inputs_hash: payroll_inputs_hash,
  receipt_anchor:      receipt_anchor,
  receipt_pair_hash:   receipt_pair_hash,
  utc_time_hash:       utc_time_hash,
  audit_event_hash:    audit_event_hash,
  schema_v:            schema_v,
  calc_v:              calc_v,
  policy_v:            policy_v
}))
```

Note: `row_hash` does NOT include `batch_id` (that would be circular). The binding
to the batch happens at the Merkle tree level (`row_root`) and in the `batch_id`
computation.

---

## Merkle Tree (row_root)

Uses `merkle.ts` from `src/lib/pnw-adapter/` (copied from pnw_mvp_v2):

```typescript
import { buildMerkleTree, getMerkleRoot } from "../lib/pnw-adapter/merkle";

const leaves = manifest.rows.map(r => r.row_hash);
const tree = buildMerkleTree(leaves);
const row_root = getMerkleRoot(tree);
```

The Merkle tree uses domain-separated BLAKE3 for internal nodes:
```
node = BLAKE3("PNW::MERKLE_NODE", left_child || right_child)
```

**Inclusion proof:** Any row can be proven to be part of a batch by providing its
`row_hash` and Merkle path to `row_root`. The `row_root` is anchored on-chain in
the cycle NFT's `root` field.

---

## Status Transitions

```
draft
  │ (user clicks "Compile")
  ▼
validated
  │ (user clicks "Send Payroll")
  ▼
queued
  │ (coordinator starts chunk 0)
  ▼
proving ←────────────────────────────────────┐
  │ (proof complete, tx submitted)            │
  ▼                                           │
[chunk 0 settled] ──→ partially_settled ─────┤ (next chunk starts)
  │                         │                 │
  │                         └─ (last chunk) ──┘
  ▼
settled
  │ (BatchAnchorFinalizer runs)
  ▼
anchored  ← TERMINAL SUCCESS


Any state
  │ (unrecoverable error)
  ▼
failed   ← TERMINAL FAILURE

Any state
  │ (retryable error, operator must act)
  ▼
needs_retry
  │ (operator retries)
  ▼
proving  (resumes from where it failed)
```

---

## Persistence

The manifest is **not** stored in a server database. It lives in:

1. **React state** (Zustand `payroll_run_store.ts`) — during an active session
2. **`sessionStorage`** — survives page refreshes, cleared on tab close
3. **Exported JSON** — employer can download the manifest JSON as a local file for
   their own records or for retry in a future session

The manifest JSON export is the same as the in-memory object. It includes the full
`status`, `chunks[]`, and `tx_id` values so a partially-complete run can be resumed.

**What is NOT persisted anywhere:**
- `employer_addr` is removed from the JSON export (re-injected from session on import)
- `worker_addr` values are included in the JSON export only when the user explicitly
  requests it (they are needed for reconciliation)

---

## JSON Serialization Rules

For canonical hashing, all `Bytes32` values are serialized as lowercase hex strings
with `0x` prefix: `"0xabcd..."` (66 chars).

For JSON export/display, the same format is used.

`U128`, `U32`, `U16` values are serialized as decimal strings (`"1000000"` not
`1000000`) to avoid JavaScript `Number` precision loss with large BigInt values.

The canonical bytes used for hashing (not the JSON export) use TLV encoding via
`canonical_encoder.ts`. JSON is for display/export only.

---

## Sample Manifest (1 worker, minimal amounts)

```json
{
  "batch_id": "0x<32-byte-hash>",
  "schema_v": 1,
  "calc_v": 1,
  "policy_v": 1,
  "employer_addr": "<session-only>",
  "employer_name_hash": "0x<field>",
  "epoch_id": "20260302",
  "currency": "USDCx",
  "row_count": 1,
  "rows": [
    {
      "row_index": 0,
      "worker_addr": "<session-only>",
      "worker_name_hash": "0x<field>",
      "agreement_id": "0x<32-byte-hash>",
      "epoch_id": "20260302",
      "currency": "USDCx",
      "gross_amount": "1000000",
      "tax_withheld": "150000",
      "fee_amount": "20000",
      "net_amount": "830000",
      "payroll_inputs_hash": "0x<32-byte-hash>",
      "receipt_anchor": "0x<32-byte-hash>",
      "receipt_pair_hash": "0x<32-byte-hash>",
      "utc_time_hash": "0x<32-byte-hash>",
      "audit_event_hash": "0x<32-byte-hash>",
      "row_hash": "0x<32-byte-hash>",
      "status": "pending"
    }
  ],
  "total_gross_amount": "1000000",
  "total_tax_withheld": "150000",
  "total_fee_amount": "20000",
  "total_net_amount": "830000",
  "row_root": "0x<32-byte-hash>",
  "inputs_hash": "0x<32-byte-hash>",
  "doc_hash": "0x<32-byte-hash>",
  "status": "validated",
  "created_at": 1741910400000,
  "updated_at": 1741910400000
}
```
