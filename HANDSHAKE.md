# HANDSHAKE.md — Off-Chain Agreement Handshake Protocol

> PNW Employment Portal — Employer ↔ Worker agreement flow
> This document describes the off-chain handshake that precedes on-chain agreement creation.

---

## Overview

The PNW agreement handshake is a **two-phase protocol**:

1. **Off-chain intent exchange** — employer and worker agree on terms without spending gas
2. **On-chain finalization** — both parties broadcast transactions to create the binding agreement

This design ensures gas is only spent after mutual consent, and no on-chain state is created for offers that would be rejected.

---

## Prerequisites

Before the handshake can begin, both parties must have completed registration:

### Worker Prerequisites
1. Connect wallet to PNW Portal
2. Register `.pnw` name via `pnw_name_registry.aleo/register_worker_name`
   - Costs 1 USDCx + naming fee (routed to presiding DAO treasury)
   - Soulbound: non-transferable, 1 name max per wallet
3. Create worker profile via `worker_profiles.aleo/create_worker_profile`
   - Bound to `.pnw` name (asserts ownership)
   - All identity fields are private (encrypted record)
   - Only `profile_anchor → block.height` is published

### Employer Prerequisites
1. Obtain verified business license via `employer_license_registry.aleo`
2. Register `.pnw` employer name via `pnw_name_registry.aleo/register_employer_name`
   - Requires verified license
   - Tiered pricing: 10 / 100 / 300 USDCx (1st / 2nd / 3rd name)
   - Industry suffix code required (40 categories)
3. Create employer profile via `employer_profiles.aleo/create_employer_profile`
   - Verifies license + name ownership + suffix alignment
   - `industry_code == suffix_code` enforced on-chain

---

## Phase 1: Off-Chain Intent Exchange (Zero Gas)

### Step 1 — Employer Enters Worker Address

The employer enters the worker's Aleo wallet address in the portal.

Portal verifies on-chain:
- `worker_primary_name_of[worker_addr] != 0field` — worker has a registered `.pnw` name
- `profile_anchor_height[profile_anchor] != 0` — worker profile is anchored

If both checks pass, the portal shows the worker as verified and eligible for an offer.

### Step 2 — Employer Fills Offer Form

The employer provides:

| Field | Type | Description |
|-------|------|-------------|
| Pay frequency | u8 | daily(1), weekly(2), biweekly(3), monthly(4), quarterly(5) |
| Start epoch | u32 | Estimated start block height / epoch |
| End epoch | u32 | 0 = open-ended |
| Review epoch | u32 | When agreement is reviewed (>= start) |
| Industry code | u8 | Must match employer's suffix_code |
| Terms text | string | Free-text scope, conditions, responsibilities |
| Display name | string | Portal-only label for this worker (session memory) |

### Step 3 — Portal Computes Deterministic Values

All hashes are computed client-side using BLAKE3 with domain tags:

```
offer_time_hash   = BLAKE3("PNW::DOC", TLV(utc_epoch_seconds))
terms_doc_hash    = BLAKE3("PNW::DOC", TLV(terms_text))
terms_root        = BLAKE3("PNW::DOC", TLV(terms_doc_hash, schema_v, policy_v))
parties_key       = BLAKE3("PNW::PARTIES", TLV(employer_addr, worker_addr))
agreement_id      = BLAKE3("PNW::DOC", TLV(employer_addr, terms_doc_hash, offer_time_hash))
```

The `parties_key` is deterministic — both employer and worker can independently compute
it from the same inputs. It is needed for future agreement operations (pause, resume, terminate).

### Step 4 — Generate Offer Intent Package

The portal encodes an `OfferIntent` containing:

```typescript
type OfferIntent = {
  version: 1;
  employer_address: Address;
  employer_name_hash: Field;
  worker_address: Address;
  worker_name_hash: Field;
  industry_code: number;
  pay_frequency_code: number;
  start_epoch: number;
  end_epoch: number;
  review_epoch: number;
  terms_text: string;           // plaintext for worker review
  terms_doc_hash: Bytes32;      // BLAKE3 hash for verification
  offer_time_utc: number;       // UTC epoch seconds
  schema_v: number;
  policy_v: number;
  employer_signature: string;   // wallet signature over offer challenge
  signature_timestamp: number;
};
```

The employer's wallet signs a challenge:
```
challenge = BLAKE3("PNW::DOC", TLV(agreement_id, worker_addr, timestamp))
```

### Step 5 — Deliver via QR Code or Shareable Link

The `OfferIntent` is encoded as:

1. **QR Code** — displayed on screen for in-person scanning (farms, job sites, offices)
2. **Shareable Link** — copyable URL with base64-encoded payload, sent via any channel

Both encode the same payload. The worker opens the link or scans the QR to load the offer in their portal.

### Step 6 — Worker Reviews Offer

The worker's portal:
1. Decodes the `OfferIntent` payload
2. Verifies employer signature against `employer_address`
3. Recomputes `terms_doc_hash` from `terms_text` — must match
4. Recomputes `parties_key` from `(employer_addr, worker_addr)` — must match
5. Queries chain: `name_owner[employer_name_hash] == employer_address`
6. Queries chain: `agreement_anchor_height[agreement_id] == 0` (not already on-chain)

If all checks pass, the worker sees the full offer details for review.

### Step 7 — Worker Accepts Intent (Off-Chain)

The worker clicks "Accept" and their wallet signs an acceptance challenge:
```
challenge = BLAKE3("PNW::DOC", TLV(agreement_id, employer_addr, timestamp))
```

The portal generates an `AcceptanceSignal`:

```typescript
type AcceptanceSignal = {
  version: 1;
  agreement_id: Bytes32;
  worker_address: Address;
  worker_signature: string;
  signature_timestamp: number;
};
```

This is delivered back to the employer via QR code or shareable link.

### Step 8 — Employer Receives Acceptance

The employer's portal:
1. Decodes the `AcceptanceSignal`
2. Verifies `worker_signature` against the expected `worker_address`
3. Shows: "Both parties have agreed. Ready to broadcast on-chain."

---

## Phase 2: On-Chain Finalization (Gas Spent)

### Step 9 — Employer Broadcasts `create_job_offer`

```
snarkos developer execute employer_agreement_v2.aleo create_job_offer \
  <agreement_id> <parties_key> <employer_name_hash> <worker_name_hash> \
  <worker_address> <industry_code> <pay_frequency_code> <start_epoch> \
  <end_epoch> <review_epoch> <agreement_rev> <schema_v> <policy_v> \
  <terms_doc_hash> <terms_root> <offer_time_hash>
```

Effects:
- `PendingAgreement` record minted, **owned by worker_address**
- `agreement_status[agreement_id] = PENDING`
- `agreement_anchor_height[agreement_id] = block.height`
- `agreement_parties_commitment[agreement_id] = BHP1024(parties_key, employer_hash, worker_hash)`

On-chain preconditions enforced:
- Employer must own `employer_name_hash` via `pnw_name_registry.aleo`
- Employer must be verified via `employer_license_registry.aleo`
- `agreement_id` must be fresh (never seen before)

### Step 10 — Worker Broadcasts `accept_job_offer`

```
snarkos developer execute employer_agreement_v2.aleo accept_job_offer \
  <PendingAgreement record> <accept_time_hash>
```

Effects:
- `PendingAgreement` consumed (UTXO destroyed — prevents replay)
- `FinalAgreement` minted, **owned by DAO_ADDRESS** (immutable custody)
- `agreement_status[agreement_id] = ACTIVE`

On-chain preconditions enforced:
- `offer.worker_address == self.caller` (only intended worker can accept)
- Worker must own `worker_name_hash` via `pnw_name_registry.aleo`
- Status must be `PENDING`
- `parties_commitment` must match stored value

---

## Security Properties

| Attack | Defense |
|--------|---------|
| Register fake identities | `.pnw` name costs USDCx, soulbound, 1 per wallet |
| Duplicate a worker identity | Non-transferable, enforced on-chain |
| Forge an offer intent | Employer wallet signature required |
| Forge an acceptance signal | Worker wallet signature required |
| Modify terms after signing | `terms_doc_hash` recomputed by worker from plaintext |
| MITM the QR/link | Attacker cannot sign without private keys |
| Replay a consumed agreement | Aleo UTXO model — record destroyed on use |
| Accept offer meant for another | `worker_address == self.caller` in circuit |
| Employer impersonation | License + `.pnw` name ownership verified on-chain |
| Create offer without consent | Gas wasted; worker simply doesn't accept |
| Resume without full consent | 3-of-3 approval required (employer + worker + DAO) |

---

## Post-Agreement Lifecycle

Once `ACTIVE`, the agreement supports:

| Action | Who | Transition |
|--------|-----|-----------|
| Pause | Employer, Worker, or DAO (independently) | `pause_agreement_*` → status = PAUSED |
| Resume | All three (3-of-3 bitmask) | `approve_resume_*` then `resume_agreement` → ACTIVE |
| Terminate | Employer, Worker, or DAO (independently) | `terminate_agreement_*` → TERMINATED (final) |
| Supersede | Any party | `supersede_agreement` → SUPERSEDED + new offer created |

All operations re-verify `.pnw` name ownership and (for employers) license status.

---

## Portal Data Flow Summary

```
OFF-CHAIN                              ON-CHAIN
─────────                              ────────
OfferIntent (QR/link)      →  create_job_offer  →  PendingAgreement (worker-owned)
AcceptanceSignal (QR/link)  →  accept_job_offer  →  FinalAgreement (DAO-owned)
                                                     agreement_status = ACTIVE
                                                     Worker appears in payroll
```

---

## Implementation Notes

- All hash computations use `@noble/hashes/blake3` via `src/lib/pnw-adapter/hash.ts`
- TLV encoding via `src/lib/pnw-adapter/canonical_encoder.ts`
- Wallet signatures via `src/lib/wallet/credential-signer.ts` (extended for offer/accept challenges)
- QR generation via `react-qr-code` (already installed)
- Offer intent payloads encoded as base64 JSON in URL query params
- On-chain calls are preview-mode only until adapter layer is fully wired to pnw_mvp_v2
