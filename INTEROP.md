# Interop Contract — pnw_employment_portal_v1 ↔ pnw_mvp_v2

> This document is the canonical reference for how the portal repo depends on
> `pnw_mvp_v2`. Both repos must stay consistent with this contract.

---

## The Rule

**The portal never owns on-chain logic. `pnw_mvp_v2` never owns UI.**

The boundary between repos is the adapter layer:
```
portal UI
    │
    └── src/lib/pnw-adapter/          ← copied from pnw_mvp_v2
                │
                └── snarkos developer execute → Aleo testnet
```

---

## Sync Protocol

### How files are copied

Each file in `src/lib/pnw-adapter/` begins with a sync header:

```typescript
// ============================================================
// SYNCED FILE — do not edit here
// Source: pnw_mvp_v2/portal/src/adapters/aleo_cli_adapter.ts
// Synced from commit: <sha>
// Synced on: YYYY-MM-DD
// If you need to change this, edit pnw_mvp_v2 first, then re-sync.
// ============================================================
```

### When to sync

| Trigger | Files to sync |
|---------|--------------|
| `WorkerPayArgs` fields changed | `layer1_router.ts` |
| New Layer 1 transition added | `layer1_adapter.ts`, `layer1_router.ts` |
| New Layer 2 step kind added | `layer2_adapter.ts`, `layer2_router.ts`, `aleo_cli_adapter.ts` |
| TLV schema changed | `canonical_encoder.ts`, `canonical_types.ts` |
| New domain tag added | `hash.ts` |
| Merkle algorithm changed | `merkle.ts` |
| Program re-deployed | `src/config/programs.ts` (update from `testnet.manifest.json`) |

### Sync procedure

1. Pull latest `pnw_mvp_v2` main
2. Copy the changed file to `src/lib/pnw-adapter/`
3. Update the sync header (commit sha + date)
4. Run `pnpm test` — verify all manifest/coordinator tests still pass
5. Run `pnpm tsc --noEmit` — verify TypeScript compiles clean
6. Commit: `sync: update pnw-adapter from pnw_mvp_v2 @ <sha>`

---

## Program ID Registry

The portal's `src/config/programs.ts` mirrors `pnw_mvp_v2/config/testnet.manifest.json`.

```typescript
// src/config/programs.ts
// Synced from pnw_mvp_v2/config/testnet.manifest.json @ <sha>

export const PROGRAMS = {
  network: "testnet",
  layer1: {
    payroll_core:             "payroll_core.aleo",
    paystub_receipts:         "paystub_receipts.aleo",
    payroll_audit_log:        "payroll_audit_log.aleo",
    employer_agreement_v2:    "employer_agreement_v2.aleo",
    employer_license_registry:"employer_license_registry.aleo",
    employer_profiles:        "employer_profiles.aleo",
    worker_profiles:          "worker_profiles.aleo",
    pnw_name_registry:        "pnw_name_registry.aleo",
    pnw_router:               "pnw_router.aleo",
  },
  layer2: {
    payroll_nfts:    "payroll_nfts.aleo",
    credential_nft:  "credential_nft.aleo",
    audit_nft:       "audit_nft.aleo",
  },
  external: {
    usdcx: "test_usdcx_stablecoin.aleo",  // testnet only
  },
} as const;
```

When a program is re-deployed with a new name, update this file and commit with:
```
config: update program IDs from testnet manifest @ <pnw_mvp_v2-sha>
```

---

## WorkerPayArgs Field Contract

This is the most critical interface contract between the repos.

The Leo struct in `pnw_mvp_v2/src/layer1/payroll_core.aleo/src/main.leo`:

```leo
struct WorkerPayArgs {
    worker_addr:          address,
    worker_name_hash:     field,
    agreement_id:         [u8; 32],
    epoch_id:             u32,
    gross_amount:         u128,
    net_amount:           u128,
    tax_withheld:         u128,
    fee_amount:           u128,
    receipt_anchor:       [u8; 32],
    receipt_pair_hash:    [u8; 32],
    payroll_inputs_hash:  [u8; 32],
    utc_time_hash:        [u8; 32],
    audit_event_hash:     [u8; 32],
    batch_id:             [u8; 32],   // manifest linkage (Option B)
    row_hash:             [u8; 32],   // manifest linkage (Option B)
}
```

The TypeScript mirror in `layer1_router.ts` (`BatchPayrollWorker` + `execute_payroll` args):

```typescript
type BatchPayrollWorker = {
  worker_addr: Address;
  worker_name_hash: Field;
  agreement_id: Bytes32;
  epoch_id: U32;
  gross_amount: U128;
  net_amount: U128;
  tax_withheld: U128;
  fee_amount: U128;
  receipt_anchor: Bytes32;
  receipt_pair_hash: Bytes32;
  payroll_inputs_hash: Bytes32;
  utc_time_hash: Bytes32;
  audit_event_hash: Bytes32;
  batch_id: Bytes32;   // from PayrollRunManifest.batch_id
  row_hash: Bytes32;   // from PayrollRunManifest.rows[n].row_hash
};
```

**The manifest compiler produces `batch_id` and `row_hash`.**
**The settlement coordinator injects them into each `WorkerPayArgs`.**
These two fields are what links every on-chain settlement back to its portal manifest row.

---

## Canonical Hash Computation Pipeline

The portal must compute exactly these hash values before building `WorkerPayArgs`.
All of them use `canonical_encoder.ts` + `hash.ts` from `src/lib/pnw-adapter/`.

```
payroll_inputs_hash
  = BLAKE3("PNW::INPUTS", TLV_encode(InputsSet {
      agreement_id, epoch_id,
      gross_amount, net_amount, tax_withheld, fee_amount,
      worker_addr, employer_addr,
      schema_v, calc_v, policy_v
    }))

receipt_anchor
  = BLAKE3("PNW::DOC", TLV_encode(PaystubDocument {
      worker_name_hash, employer_name_hash,
      agreement_id, epoch_id,
      gross_amount, net_amount, tax_withheld, fee_amount,
      payroll_inputs_hash,
      utc_time_hash, schema_v, calc_v, policy_v
    }))

receipt_pair_hash
  = BLAKE3("PNW::DOC", TLV_encode({
      worker_receipt_anchor, employer_receipt_anchor
    }))

utc_time_hash
  = BLAKE3("PNW::DOC", TLV_encode({ utc_epoch_seconds }))

audit_event_hash
  = BLAKE3("PNW::DOC", TLV_encode({
      payroll_inputs_hash, receipt_anchor, batch_id, row_hash
    }))
    // batch_id and row_hash are folded in here so the
    // on-chain audit anchor is tied to the manifest row

row_hash (manifest level)
  = BLAKE3("PNW::LEAF", TLV_encode(PayrollRow {
      row_index, worker_addr, worker_name_hash,
      agreement_id, epoch_id,
      gross_amount, net_amount, tax_withheld, fee_amount,
      payroll_inputs_hash, receipt_anchor, receipt_pair_hash,
      utc_time_hash, audit_event_hash,
      schema_v, calc_v, policy_v
    }))

row_root
  = MerkleRoot([row_hash_0, row_hash_1, ..., row_hash_n])
  // using merkle.ts from pnw-adapter

batch_id
  = BLAKE3("PNW::DOC", TLV_encode({
      employer_addr, epoch_id, row_count, row_root,
      schema_v, calc_v, policy_v
    }))
```

---

## Environment Variables Shared Between Repos

| Variable | Used by | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_ALEO_ENDPOINT` | portal | RPC endpoint for Aleo REST API |
| `NEXT_PUBLIC_NETWORK` | portal | `testnet` or `mainnet` |
| `ALEO_PRIVATE_KEY` | pnw_mvp_v2 CI | Signing key for testnet execution |
| `ALEO_ADDRESS` | pnw_mvp_v2 CI + portal | Public employer address |
| `ALEO_VIEW_KEY` | portal session | Decoding employer records |

The portal never reads `ALEO_PRIVATE_KEY` from a `.env` file during normal use —
the user provides it through the key manager UI. It is only present in `.env.local`
for development/testing convenience.

---

## Scenario Files as Integration Fixtures

`pnw_mvp_v2/config/scenarios/testnet/` JSON files can be used as integration test
fixtures in the portal. The portal's manifest compiler should produce output that
is compatible with these scenario files.

Specifically:
- `min_spend.payroll.json` → single-worker scenario input; compiler should produce
  a manifest whose `rows[0]` has all matching hash values
- `batch_payroll_smoke.json` → three-worker scenario; compiler should produce a
  manifest with three rows and matching hash values

Add a portal integration test: `src/manifest/scenario_compat.test.ts` that loads
these JSON files and verifies the compiler produces consistent hashes.

---

## What the Portal Never Imports from pnw_mvp_v2

| Path | Reason not to import |
|------|---------------------|
| `src/layer1/**` | Leo source; not TypeScript |
| `src/layer2/**` | Leo source; not TypeScript |
| `scripts/**` | Shell/Python; not TypeScript |
| `.github/**` | CI config; not for portal |
| `portal/src/payroll/**` | paystub_builder, summary_builder, etc. are lower-level utilities — evaluate before copying; may not be needed |

---

## Breaking Change Protocol

If `pnw_mvp_v2` makes a breaking change to `WorkerPayArgs` or any adapter
interface, the following sequence is required before the portal can ship:

1. `pnw_mvp_v2` merges the breaking change with a `BREAKING:` commit prefix
2. `pnw_mvp_v2` tags: `adapter-breaking-v<N>`
3. Portal opens a sync PR: updates `src/lib/pnw-adapter/`, all affected types,
   all affected tests
4. Portal's sync PR must pass all tests before merge
5. Both repos deploy together — no half-migrated state on testnet
