# NFT Plan — Generative Topographic Credential Art

> Implementation plan for deterministic generative art on worker credential NFTs.
> Created 2026-04-08. For cross-referencing with `pnw_mvp_v2` before implementation.

---

## 1. Goal

Build a client-side generative art system that gives each worker credential NFT a
unique, deterministic visual identity. The image is a **topographic contour map**
derived from the credential's hash, rendered on HTML5 Canvas, branded with PNW
colors and the worker's `.pnw` domain name.

**Scope:** Worker-side credential NFT art only. No changes to `pnw_mvp_v2`.
No IPFS. No server. Rendered on-demand from hash inputs.

**Why now:** All credential infrastructure is complete (E8). Workers have no visual
representation of their credentials — just text/hash tables and PDF certs. This
adds a visual identity layer that makes credentials feel tangible and unique.

---

## 2. Current State of the Portal

### Phase Completion

| Phase | Status | Relevant to NFT Art |
|-------|--------|---------------------|
| E8 — Credentials | Done | Credential store, issuance, revocation, PDF certs all exist |
| E9 — Audit + Worker stubs | Done | Worker dashboard, layout, nav exist |
| Post-E9 — Wallet + Landing | Done | Wallet connection, PNW branding established |
| E10 — E2E Testnet | Pending | Not blocked by this work |

### What Exists for Credentials

**Employer side (complete):**
- `app/(employer)/credentials/page.tsx` — list view with table
- `app/(employer)/credentials/issue/page.tsx` — issuance form
- `app/(employer)/credentials/[credential_id]/page.tsx` — detail + revoke
- `components/pdf/CredentialCertPDF.tsx` — PDF certificate generator

**Worker side (gap):**
- `app/worker/dashboard/page.tsx` — shows audit requests but NO credentials
- `app/worker/layout.tsx` — nav has Dashboard, Offers, Paystubs (no Credentials)
- **No dedicated worker credentials page exists**

### Credential Record Type

From `src/stores/credential_store.ts`:

```typescript
export type CredentialRecord = {
  credential_id: Bytes32;       // unique per credential — PRIMARY ART INPUT
  credential_type: CredentialType; // "employment_verified" | "skills" | "clearance" | "custom"
  credential_type_label: string;
  worker_addr: Address;
  employer_addr: Address;
  subject_hash: Field;          // worker name hash
  issuer_hash: Field;           // employer name hash
  scope: string;                // e.g. "Full-time, WA State"
  scope_hash: Bytes32;
  doc_hash: Bytes32;
  issued_epoch: number;
  expires_epoch?: number;
  status: CredentialStatus;     // "active" | "revoked" | "pending"
  tx_id?: string;
  revoke_tx_id?: string;
  signature_proof?: string;
};
```

### Worker Identity Data Available

From `src/stores/worker_identity_store.ts`:

```typescript
{
  walletAddress: string;     // Aleo address
  workerNameHash: Field;     // BLAKE3 hash of .pnw name
  chosenName: string;        // plaintext, e.g. "alice_smith" → displayed as "alice_smith.pnw"
  profileAnchored: boolean;
}
```

---

## 3. Cross-Repo Reference Points (for pnw_mvp_v2 verification)

### 3.1 Credential NFT On-Chain Structure

**Portal file:** `src/lib/pnw-adapter/layer2_router.ts`

```typescript
export type CredentialNftParams = {
  worker_addr: Address;
  employer_addr: Address;
  credential_type: U32;
  credential_hash: Bytes32;   // ← this is where art links to on-chain data
  issued_at: U32;
};
```

**Verify in pnw_mvp_v2:** Check that `credential_nft.aleo::mint_credential_nft`
accepts these fields and that `credential_hash` is stored as a public or private
field in the resulting NFT record. The art system uses `credential_hash` as the
deterministic seed — if the on-chain struct has room for a `metadata_hash` field
in a future version, we can add image hashes there.

### 3.2 Token ID Derivation

**Portal file:** `src/lib/pnw-adapter/token_id.ts`

```typescript
export function deriveCredentialTokenId(credentialHash: Bytes32): Field {
  const data = new TextEncoder().encode(`${TOKEN_ID_PREFIX.CREDENTIAL}:${credentialHash}`);
  return toHex(domainHash(DOMAIN_TAGS.LEAF, data));
}
```

Where `TOKEN_ID_PREFIX.CREDENTIAL = 0x02`.

**Verify in pnw_mvp_v2:** Ensure the token ID derivation in the portal matches
what `credential_nft.aleo` expects. The art system doesn't modify token IDs —
it only reads them for display.

### 3.3 Layer 2 Adapter Mapping

**Portal file:** `src/lib/pnw-adapter/layer2_adapter.ts`

```typescript
mint_credential_nft:  { program: "credential_nft.aleo", transition: "mint_credential_nft" }
revoke_credential_nft: { program: "credential_nft.aleo", transition: "revoke_credential_nft" }
```

**Verify in pnw_mvp_v2:** Confirm these program/transition names match the
deployed Leo programs. The art system doesn't call these — it only reads the
resulting credential records.

### 3.4 Hash Functions Used

**Portal file:** `src/lib/pnw-adapter/hash.ts`

```typescript
// Domain tags
DOMAIN_TAGS = {
  INPUTS: "PNW::INPUTS",
  DOC: "PNW::DOC",
  LEAF: "PNW::LEAF",
  NAME: "PNW::NAME",
  // ...
};

function domainHash(domain: string, data: Uint8Array): Uint8Array {
  return blake3(concat(encode(domain), data));
}

function fromHex(hex: string): Uint8Array { /* ... */ }
function toHex(bytes: Uint8Array): string { /* ... */ }
```

**Used by art system:** `fromHex()` to convert `credential_id` hex string into
raw bytes for parameter extraction. No hashing is modified — the art system
is purely a consumer of existing hash outputs.

### 3.5 Credential ID Computation

**Portal file:** `src/credentials/credential_actions.ts`

```
credential_id = BLAKE3("PNW::DOC", TLV(employer_addr, worker_addr, scope, issue_time))
```

**Verify in pnw_mvp_v2:** Ensure the TLV encoding and domain tag match the
canonical encoder in `pnw_mvp_v2/portal/src/commitments/canonical_encoder.ts`.
The art system trusts that `credential_id` is already correctly computed by
the credential actions module.

### 3.6 Program Registry

**Portal file:** `src/config/programs.ts`

```typescript
layer2: {
  payroll_nfts: "payroll_nfts.aleo",
  credential_nft: "credential_nft.aleo",
  audit_nft: "audit_nft.aleo",
}
```

**Verify in pnw_mvp_v2:** Cross-check against `config/testnet.manifest.json`
to ensure program IDs are current.

### 3.7 What This Plan Does NOT Change in pnw_mvp_v2

- No Leo program modifications
- No new transitions
- No new struct fields
- No TLV schema changes
- No adapter changes
- No hash function changes

The art system is purely a **Layer 3 presentation concern** — it reads existing
data structures and renders them visually. All cross-repo contracts remain intact.

---

## 4. Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Art style | Topographic / data-viz contour map | Hash bytes drive terrain; PNW nature palette; unique per credential |
| Card size | 600 x 400 px | Horizontal badge format; good inline display + PNG export |
| Renderer | Canvas 2D API | Pixel control, easy PNG via `toDataURL()`, no deps |
| Uniqueness source | `credential_id` (32 bytes) | Unique per credential; deterministic from BLAKE3 |
| Color palette | By `credential_type` | 4 visual families so types are instantly distinguishable |
| Identity display | Worker `.pnw` name on card | From `useWorkerIdentityStore.chosenName` |
| Storage | Client-side only | Render on-demand; defer IPFS to post-Shield-wallet |
| pnw_mvp_v2 impact | None | Pure presentation layer; reads existing data only |

---

## 5. Implementation Steps

### Step 1: Hash-to-Parameters Engine

**New file:** `src/nft-art/hash_params.ts`

Converts `credential_id` (32-byte hex string) into deterministic visual parameters:

```typescript
export type TerrainParams = {
  seed: number[];           // bytes 0-7 → noise function seed
  palette: PNWPalette;      // selected by credential_type
  contourLevels: number;    // byte 9 → range 8-16
  ridgeCenter: [number, number]; // bytes 10-11 → normalized 0-1
  flowAngle: number;        // byte 12 → radians
  accentIntensity: number;  // byte 13 → 0-1
};

export type PNWPalette = {
  deep: string;    // lowest elevation
  mid: string;     // mid elevation
  high: string;    // peaks
  accent: string;  // contour line highlight
  glow: string;    // peak glow
};
```

**Palette mapping by credential type:**

| Type | Deep | Mid | High | Accent | Glow | Theme |
|------|------|-----|------|--------|------|-------|
| employment_verified | #060e1a | #0097a7 | #00e5ff | #80deea | #00e5ff | Navy→Cyan |
| skills | #0d2818 | #2e7d32 | #f6d365 | #81c784 | #f6d365 | Forest→Gold |
| clearance | #060e1a | #92710a | #f6d365 | #d4a012 | #fef9e7 | Navy→Gold |
| custom | #0d2818 | #0097a7 | #00e5ff | #81c784 | #00e5ff | Forest→Cyan |

**Depends on:** `src/lib/pnw-adapter/hash.ts` (`fromHex` only — no modifications)

---

### Step 2: Topographic Renderer

**New file:** `src/nft-art/topo_renderer.ts`

Pure function: `renderTopoCard(canvas, params, credentialInfo) → void`

Canvas rendering pipeline (600x400):

```
Layer 1: Background fill (#030810 navy)
Layer 2: Heightmap (seeded value noise, 3 octaves, coarse grid + bilinear interp)
Layer 3: Contour lines (marching squares at N thresholds, palette-colored by elevation)
Layer 4: Peak glow (radial gradient at highest points, low opacity)
Layer 5: Type badge icon (top-left corner — shield/hexagon/lock/diamond)
Layer 6: Text overlay band (bottom, semi-transparent dark):
         - Worker .pnw name (large, white, bold)
         - Credential type label (accent color)
         - Scope text (muted)
         - Status indicator (green/red/yellow dot)
Layer 7: Hash fingerprint (bottom-right, monospace, first 8 chars of credential_id)
Layer 8: Border (1px accent at 30% opacity)
```

**No external dependencies.** Self-contained value noise (~30 LOC) + marching squares (~50 LOC).

**credentialInfo type passed to renderer:**

```typescript
type CredentialCardInfo = {
  workerName: string;           // "alice_smith.pnw"
  credentialTypeLabel: string;  // "Employment Verified"
  scope: string;                // "Full-time, WA State"
  status: CredentialStatus;     // "active" | "revoked" | "pending"
  credentialIdShort: string;    // first 8 hex chars
};
```

---

### Step 3: React Component

**New file:** `components/credential-art/CredentialCard.tsx`

```typescript
type CredentialCardProps = {
  credential: CredentialRecord;
  workerName: string;
  width?: number;   // default 600
  height?: number;  // default 400
};
```

- `useRef<HTMLCanvasElement>` + `useEffect` for rendering
- Derives `TerrainParams` from `credential.credential_id` + `credential.credential_type`
- Composites text info from credential record + worker name
- Active credentials at full brightness; revoked desaturated via CSS `filter: grayscale(0.6) opacity(0.7)`

---

### Step 4: Export Button

**New file:** `components/credential-art/ExportCardButton.tsx`

- Takes canvas ref
- `canvas.toBlob('image/png')` → object URL → download link click
- Filename: `credential-{credential_id.slice(2,14)}.png`
- Styling matches `components/pdf/DownloadPDFButton.tsx` pattern

---

### Step 5: Worker Credentials Page

**New file:** `app/worker/credentials/page.tsx`

```
┌─────────────────────────────────────────────────┐
│  Your Credentials                                │
│                                                  │
│  ┌────────────────────────┐ ┌────────────────────┐
│  │  [Topo art 600x400]   │ │  [Topo art 600x400] │
│  │  alice_smith.pnw       │ │  alice_smith.pnw     │
│  │  Employment Verified   │ │  Skills              │
│  │  Full-time, WA State   │ │  Engineering, 2026   │
│  │  ● Active              │ │  ● Active            │
│  │  [Download] [Print]    │ │  [Download] [Print]  │
│  └────────────────────────┘ └────────────────────┘
│                                                  │
│  (empty state: "No credentials issued to you.")  │
└─────────────────────────────────────────────────┘
```

- Reads `useCredentialStore` (rehydrates on mount via `rehydrateCredentials()`)
- Filters: `cred.worker_addr === session.address`
- Gets `.pnw` name from `useWorkerIdentityStore` (`chosenName`)
- Grid: 1 col mobile, 2 cols desktop (`grid-cols-1 md:grid-cols-2`)
- Each card: `CredentialCard` + action row:
  - "Download Image" → `ExportCardButton`
  - "Print Certificate" → existing `DownloadPDFButton` + `generateCredentialCertPdf`

---

### Step 6: Update Worker Nav

**Edit file:** `app/worker/layout.tsx`

Add "Credentials" between Offers and Paystubs:

```typescript
const WORKER_NAV = [
  { href: "/worker/dashboard", label: "Dashboard" },
  { href: "/worker/offers", label: "Offers" },
  { href: "/worker/credentials", label: "Credentials" },  // ← NEW
  { href: "/worker/paystubs", label: "Paystubs" },
] as const;
```

---

### Step 7: Dashboard Integration

**Edit file:** `app/worker/dashboard/page.tsx`

Add to the stats row:

```
Credentials: {count}
```

Add a "Recent Credentials" section (below pending offers):

- Up to 3 thumbnail credential cards (scaled to 300x200)
- "View all →" link to `/worker/credentials`

---

## 6. Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/nft-art/hash_params.ts` | **Create** | Hash bytes → deterministic terrain parameters + palette |
| `src/nft-art/topo_renderer.ts` | **Create** | Canvas renderer: noise heightmap + marching squares contours + text |
| `components/credential-art/CredentialCard.tsx` | **Create** | React component wrapping canvas renderer |
| `components/credential-art/ExportCardButton.tsx` | **Create** | PNG download button |
| `app/worker/credentials/page.tsx` | **Create** | Worker credential gallery with generative art cards |
| `app/worker/layout.tsx` | **Edit** | Add "Credentials" nav item |
| `app/worker/dashboard/page.tsx` | **Edit** | Add credential count stat + recent credential thumbnails |

---

## 7. Existing Code Reused (Do Not Modify)

| File | What's Reused |
|------|---------------|
| `src/lib/pnw-adapter/hash.ts` | `fromHex()` to parse credential_id into bytes |
| `src/stores/credential_store.ts` | `useCredentialStore`, `rehydrateCredentials`, `CredentialRecord` |
| `src/stores/worker_identity_store.ts` | `useWorkerIdentityStore` for `.pnw` name |
| `components/key-manager/useAleoSession.ts` | `useAleoSession` for session address |
| `components/pdf/CredentialCertPDF.tsx` | Existing PDF cert (kept alongside art export) |
| `components/pdf/DownloadPDFButton.tsx` | Pattern reference for export button |
| `src/credentials/credential_actions.ts` | Credential hash computation (read only) |
| `src/lib/pnw-adapter/token_id.ts` | Token ID derivation (display only) |

---

## 8. PNW Color Reference

From `app/globals.css` — hardcoded in Canvas renderer:

```
Navy:   #030810  #060e1a  #0a1628
Gold:   #fef9e7  #f6d365  #d4a012  #92710a
Forest: #e8f5e9  #81c784  #2e7d32  #1b4332  #0d2818
Cyan:   #80deea  #00e5ff  #00bcd4  #0097a7
Sky:    #bae6fd  #38bdf8
```

---

## 9. How It Works (Conceptual Flow)

```
credential_id (32-byte BLAKE3 hash, hex string)
        │
        ├── fromHex() → raw bytes
        │
        ▼
┌─────────────────────────────┐
│  hash_params.ts             │
│                             │
│  bytes[0..7]  → seed        │  ← drives unique terrain shape
│  byte[9]     → contours     │  ← 8-16 elevation levels
│  bytes[10,11] → ridge pos   │  ← mountain center offset
│  byte[12]    → flow angle   │  ← terrain tilt direction
│  byte[13]    → intensity    │  ← peak brightness
│  cred_type   → palette      │  ← 4 PNW color families
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  topo_renderer.ts           │
│  (Canvas 2D, 600×400)       │
│                             │
│  1. Navy background         │
│  2. Value noise heightmap   │  ← seeded PRNG, 3 octave layers
│  3. Marching squares        │  ← contour lines at thresholds
│  4. Palette gradient        │  ← deep → mid → high by elevation
│  5. Peak glow               │  ← radial gradient at maxima
│  6. Type badge              │  ← shield/hexagon/lock/diamond
│  7. Text overlay:           │
│     • alice_smith.pnw       │  ← from worker identity store
│     • Employment Verified   │  ← credential_type_label
│     • Full-time, WA State   │  ← scope
│     • ● Active              │  ← status
│  8. Hash fingerprint        │  ← first 8 chars of credential_id
│  9. Accent border           │
└──────────────┬──────────────┘
               │
               ▼
        Deterministic Image
        (same hash = same art, always)
```

---

## 10. What This Does NOT Touch

- **No `pnw_mvp_v2` changes** — no Leo programs, no adapters, no TLV schemas
- **No `src/lib/pnw-adapter/` edits** — synced files stay untouched
- **No `components/ui/` edits** — shadcn components untouched
- **No employer pages** — employer credential pages unchanged
- **No on-chain calls** — art is purely presentational
- **No IPFS / pinning** — deferred until wallet NFT viewing support
- **No new dependencies** — pure Canvas 2D API, no npm additions

---

## 11. Future Extensions (Not in Scope)

| Extension | When | Notes |
|-----------|------|-------|
| Payroll cycle NFT art | After credentials ship | Same engine, batch summary card layout |
| Paystub NFT art | After cycle NFTs | Per-worker per-epoch card |
| IPFS pinning | When Shield supports NFT gallery | Pin PNG, store CID with credential |
| User avatar overlay | Post-MVP | Upload image composited into card corner |
| Animated contours | Post-MVP | Framer Motion or requestAnimationFrame flow |
| Employer-side art | After worker side proven | Same cards on employer credential pages |
| `metadata_hash` on-chain | Future pnw_mvp_v2 update | Add image hash field to CredentialNftParams |

---

## 12. Verification Checklist

- [ ] `pnpm dev` → worker portal → `/worker/credentials` loads
- [ ] Issue credential from employer → appears on worker credentials page with topo art
- [ ] Same credential_id → identical image on refresh (determinism)
- [ ] One of each credential type → 4 visually distinct palettes
- [ ] "Download Image" → PNG at 600x400 downloads correctly
- [ ] "Print Certificate" → existing PDF still works alongside art
- [ ] Worker `.pnw` name displays correctly on card
- [ ] Active credentials full color; revoked desaturated
- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` — all existing tests pass (no regressions)
- [ ] Worker nav: Dashboard, Offers, **Credentials**, Paystubs
- [ ] Worker dashboard: credential count in stats + thumbnail previews
