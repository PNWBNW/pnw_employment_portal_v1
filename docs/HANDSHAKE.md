# HANDSHAKE.md — Employment Agreement Protocol

> PNW Employment Portal — Employer ↔ Worker agreement flow
> Updated 2026-04-01: Direct on-chain broadcast with encrypted terms vault (no QR codes)

---

## Overview

The PNW agreement protocol is a **direct blockchain broadcast** model:

1. **Employer broadcasts** a job offer directly to the Aleo network
2. **Worker receives** the offer as a private record in their wallet
3. **Worker reviews** encrypted terms fetched from IPFS, then accepts on-chain

No QR codes, no link sharing, no off-chain signaling. The blockchain IS the message bus.

---

## Prerequisites

### One Name Per Wallet Rule
- Each wallet gets exactly ONE `.pnw` name (worker OR employer, not both)
- The portal enforces this — employer gate checks for worker names, and vice versa

### Worker Prerequisites
1. Connect Shield wallet to PNW Portal
2. Register `.pnw` name via `pnw_name_registrar_v5.aleo/register_worker_name`
   - Costs 1 USDCx (testnet), routed to DAO treasury
   - Soulbound: non-transferable
   - Name plaintext stored on-chain for reverse resolution
3. Create worker profile via `pnw_worker_profiles_v2.aleo/create_worker_profile`
   - Bound to `.pnw` name (asserts ownership via registry_v2)
   - All identity fields are private (encrypted record)

### Employer Prerequisites
1. Obtain verified status via `employer_license_registry.aleo` (DAO authority sets `is_verified`)
2. Register `.pnw` employer name via `pnw_name_registrar_v5.aleo/register_employer_name`
   - Requires verified license
   - Costs 1 USDCx (testnet)
   - Industry suffix code required (40 categories)
   - Name plaintext stored on-chain for reverse resolution
3. Create employer profile via `employer_profiles_v2.aleo/create_employer_profile`
   - Verifies license + name ownership + suffix alignment
   - `industry_code == suffix_code` enforced on-chain

---

## Agreement Flow

### Step 1 — Employer Finds Worker

The employer enters the worker's `.pnw` name OR Aleo wallet address.

**By .pnw name:**
- Portal computes `name_hash = BLAKE3("PNW::NAME", TLV(name))` with field modulus reduction
- Queries `name_owner[name_hash]` → resolves to worker address

**By wallet address:**
- Queries `worker_primary_name_of[address]` → gets name hash
- Queries `name_plaintext[name_hash]` (registrar_v5 mapping) → resolves to `.pnw` name

### Step 2 — Employer Fills Offer Form

| Field | Type | Description |
|-------|------|-------------|
| Worker | .pnw name or address | Resolved to address + name hash |
| Industry | u8 (1-40) | Must match employer's suffix_code |
| Pay frequency | u8 | daily(1), weekly(2), biweekly(3), monthly(4), quarterly(5) |
| Start date | Date picker | Converted to approximate block height (~1 block/3s) |
| End date | Date picker (optional) | 0 = open-ended |
| Agreement terms | Text | Free-text scope, conditions, responsibilities |

### Step 3 — Portal Computes Deterministic Values

All hashes are computed client-side using BLAKE3 with domain tags:

```
offer_time_hash   = BLAKE3("PNW::DOC", TLV(utc_epoch_seconds))
terms_doc_hash    = BLAKE3("PNW::DOC", TLV(terms_text))
terms_root        = BLAKE3("PNW::DOC", TLV(terms_doc_hash, schema_v, policy_v))
parties_key       = BLAKE3("PNW::PARTIES", TLV(employer_addr, worker_addr))
agreement_id      = BLAKE3("PNW::DOC", TLV(employer_addr, terms_doc_hash, offer_time_hash))
```

### Step 4 — Encrypt and Upload Terms to IPFS

1. Portal encrypts the terms text using **AES-256-GCM** (Web Crypto API)
2. Encryption key derived via **HKDF** from: `PNW::TERMS::{agreement_id}::{employer_addr}::{worker_addr}`
3. Encrypted blob uploaded to **Pinata IPFS** via `/api/terms/upload` (server-side, hides JWT)
4. Pinata returns a **CID** (content hash) — logged for reference
5. CID is discoverable via `/api/terms/lookup?agreementId=...` (queries Pinata metadata)

**Security:** Only the employer and worker can derive the decryption key (they're the only ones who know both addresses + the agreement_id). The encrypted blob on IPFS is public but unreadable without the key.

### Step 5 — Employer Broadcasts `create_job_offer`

Portal calls `employer_agreement_v3.aleo/create_job_offer` with 16 inputs via Shield wallet.

**Inputs:**
- `agreement_id: [u8; 32]` — deterministic content hash
- `parties_key: [u8; 32]` — hash of both party addresses
- `employer_name_hash: field` — from employer identity store
- `worker_name_hash: field` — resolved from lookup
- `worker_address: address` — resolved from lookup
- `industry_code: u8`, `pay_frequency_code: u8`
- `start_epoch: u32`, `end_epoch: u32`, `review_epoch: u32`
- `agreement_rev: u16`, `schema_v: u16`, `policy_v: u16`
- `terms_doc_hash: [u8; 32]`, `terms_root: [u8; 32]`, `offer_time_hash: [u8; 32]`

**On-chain effects:**
- `PendingAgreement` record minted, **owned by worker_address** (lands in worker's wallet)
- `agreement_status[agreement_id] = PENDING (0)`
- `agreement_anchor_height[agreement_id] = block.height`
- `agreement_parties_commitment[agreement_id] = BHP1024(parties_key, emp_hash, wrk_hash)`

**On-chain preconditions enforced:**
- Employer must own `employer_name_hash` via `pnw_name_registry_v2.aleo`
- Employer must be verified via `employer_license_registry.aleo`
- `agreement_id` must be fresh (never seen before)

### Step 6 — Worker Sees Pending Offer

Worker opens the portal → Offers page.

1. Portal calls `requestRecords("employer_agreement_v3.aleo", true)` from Shield wallet
2. Parses `PendingAgreement` records from `recordPlaintext` format
3. Displays list of pending offers with employer address, industry, pay frequency, dates

### Step 7 — Worker Reviews Encrypted Terms

Worker clicks "Review & Accept" on an offer:

1. Portal computes `agreement_id` from the record's byte array
2. Calls `/api/terms/lookup?agreementId=...` → gets IPFS CID
3. Fetches encrypted blob from `https://gateway.pinata.cloud/ipfs/{CID}`
4. Derives decryption key from `PNW::TERMS::{agreement_id}::{employer_addr}::{worker_addr}`
5. Decrypts with AES-256-GCM → displays plaintext terms to worker

Also resolves employer `.pnw` name via `queryNamePlaintext(employer_name_hash)`.

### Step 8 — Worker Accepts Offer

Worker clicks "Accept Offer":

1. Portal computes `accept_time_hash = BLAKE3("PNW::DOC", TLV(utc_epoch_seconds))`
2. Calls `employer_agreement_v3.aleo/accept_job_offer` with:
   - `PendingAgreement` record (passed as **plaintext string** — Shield handles encryption)
   - `accept_time_hash: [u8; 32]`

**On-chain effects:**
- `PendingAgreement` consumed (UTXO destroyed)
- `FinalAgreement` minted, **owned by DAO_ADDRESS**
- `agreement_status[agreement_id] = ACTIVE (1)`

**On-chain preconditions enforced:**
- `offer.worker_address == self.caller` (only intended worker can accept)
- Worker must own `worker_name_hash` via `pnw_name_registry_v2.aleo`
- Status must be `PENDING`
- `parties_commitment` must match stored value

---

## Terms Vault Architecture

```
Employer Browser          Server (/api)         Pinata IPFS           Worker Browser
     │                        │                      │                      │
     ├─ Encrypt terms ────────┤                      │                      │
     │  (AES-256-GCM)         │                      │                      │
     │                        ├─ Upload encrypted ───→│                      │
     │                        │  (POST pinFileToIPFS) │                      │
     │                        │←── CID ──────────────┤                      │
     │←── CID ────────────────┤                      │                      │
     │                        │                      │                      │
     │  (later, worker side)  │                      │                      │
     │                        │                      │  ←── Lookup CID ────┤
     │                        │←── agreementId ──────│──── /api/lookup ────┤
     │                        ├─ Query pin list ─────→│                      │
     │                        │←── CID ──────────────┤                      │
     │                        │                      │──── CID ───────────→│
     │                        │                      │                      ├─ Fetch blob
     │                        │                      │←─────────────────────┤
     │                        │                      │──── encrypted ──────→│
     │                        │                      │                      ├─ Decrypt
     │                        │                      │                      │  (AES-256-GCM)
     │                        │                      │                      ├─ Display terms
```

**Encryption details:**
- Algorithm: AES-256-GCM (Web Crypto API, zero dependencies)
- Key derivation: HKDF-SHA256 from `PNW::TERMS::{agreement_id}::{employer}::{worker}`
- Salt: `pnw-terms-vault-v1`
- IV: 12 random bytes, prepended to ciphertext
- Output: `[12-byte IV] + [ciphertext + 16-byte auth tag]`

**Pinata configuration:**
- API key permissions: `pinFileToIPFS` (Pinning) + `pinList` (Data)
- Server-side proxy: `PINATA_JWT` env var on Vercel (never exposed to client)
- Gateway: `https://gateway.pinata.cloud/ipfs/{CID}`

---

## Security Properties

| Attack | Defense |
|--------|---------|
| Register fake identities | `.pnw` name costs USDCx, soulbound, 1 per wallet |
| Dual identity (worker + employer) | Portal cross-checks both name types, blocks registration |
| Read agreement terms | AES-256-GCM encrypted, key requires both addresses + agreement_id |
| Modify terms after offer | `terms_doc_hash` is on-chain in the PendingAgreement record |
| Replay a consumed agreement | Aleo UTXO model — PendingAgreement destroyed on accept |
| Accept offer meant for another | `worker_address == self.caller` enforced in circuit |
| Employer impersonation | License + `.pnw` name ownership verified on-chain |
| IPFS blob tampering | Content-addressed (CID = hash of content) — tamper changes CID |
| Pinata JWT exposure | Server-side only via Next.js API route, never sent to client |

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
EMPLOYER PORTAL                         ALEO NETWORK                     WORKER PORTAL
───────────────                         ────────────                     ─────────────
Fill offer form
Encrypt terms → IPFS
Broadcast create_job_offer ──────────→ PendingAgreement record ──────→ Wallet receives record
                                       agreement_status = PENDING
                                                                        Scan wallet records
                                                                        Fetch + decrypt terms
                                                                        Review terms
                                       accept_job_offer ←────────────── Accept offer
                                       FinalAgreement → DAO
                                       agreement_status = ACTIVE
                                                                        Worker appears in payroll
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `src/handshake/engine.ts` | Deterministic hash computations (BLAKE3 + TLV) |
| `src/lib/terms-vault/encrypt.ts` | AES-256-GCM encrypt/decrypt (Web Crypto API) |
| `src/lib/terms-vault/ipfs.ts` | Pinata upload/lookup/fetch |
| `app/api/terms/upload/route.ts` | Server-side Pinata upload proxy |
| `app/api/terms/lookup/route.ts` | Server-side CID lookup by agreement ID |
| `app/(employer)/workers/onboard/page.tsx` | Employer offer form + broadcast |
| `app/worker/offers/page.tsx` | Worker offer scan + review + accept |
| `src/registry/name_registry.ts` | .pnw name resolution (forward + reverse) |
